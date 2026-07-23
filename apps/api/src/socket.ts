import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import type { Request } from 'express';
import { config } from './config.js';
import { canAccessRoom, createMessage } from './chat-service.js';
import { prisma } from './db.js';
import { logger } from './logger.js';
import { sessionMiddleware } from './session.js';
import { joinUserSocketRoom } from './socket-control.js';

type SocketRequest = Request & { session: Express.Request['session'] };

function reloadSession(request: SocketRequest) {
  return new Promise<boolean>((resolve) =>
    request.session.reload((error) => resolve(!error && !!request.session.userId)),
  );
}

async function hasActiveSession(request: SocketRequest, expectedUserId: string) {
  if (!(await reloadSession(request)) || request.session.userId !== expectedUserId) return false;
  const user = await prisma.user.findUnique({
    where: { id: expectedUserId },
    select: { status: true },
  });
  return user?.status === 'ACTIVE';
}

export function createSocketServer(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: config.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 10_000,
  });
  io.engine.use(sessionMiddleware);
  io.use(async (socket, next) => {
    try {
      const request = socket.request as SocketRequest;
      if (socket.handshake.headers.origin !== config.WEB_ORIGIN || !request.session?.userId)
        return next(new Error('인증이 필요합니다.'));
      const user = await prisma.user.findUnique({
        where: { id: request.session.userId },
        select: { status: true },
      });
      if (user?.status !== 'ACTIVE') return next(new Error('채팅을 이용할 수 없습니다.'));
      next();
    } catch {
      next(new Error('연결을 인증하지 못했습니다.'));
    }
  });

  const buckets = new Map<string, number[]>();
  io.on('connection', (socket) => {
    const request = socket.request as SocketRequest;
    const userId = request.session.userId!;
    void socket.join(joinUserSocketRoom(userId));
    const revalidate = setInterval(() => {
      void hasActiveSession(request, userId)
        .then((active) => {
          if (!active) socket.disconnect(true);
        })
        .catch(() => socket.disconnect(true));
    }, 60_000);
    revalidate.unref();
    socket.on('disconnect', () => clearInterval(revalidate));
    socket.on('room:join', async (roomId: string, callback?: (value: object) => void) => {
      try {
        if (!(await hasActiveSession(request, userId))) {
          socket.disconnect(true);
          throw new Error('인증이 만료되었습니다.');
        }
        if (typeof roomId !== 'string' || !(await canAccessRoom(userId, roomId)))
          throw new Error('접근할 수 없습니다.');
        await socket.join(roomId);
        callback?.({ ok: true });
      } catch {
        callback?.({ ok: false, message: '채팅방에 참여할 수 없습니다.' });
      }
    });
    socket.on(
      'message:send',
      async (
        payload: { roomId?: unknown; content?: unknown },
        callback?: (value: object) => void,
      ) => {
        try {
          if (!(await hasActiveSession(request, userId))) {
            socket.disconnect(true);
            throw new Error('인증이 만료되었습니다.');
          }
          const now = Date.now();
          const recent = (buckets.get(userId) ?? []).filter((time) => now - time < 10_000);
          if (recent.length >= 10) throw new Error('요청이 너무 많습니다.');
          recent.push(now);
          buckets.set(userId, recent);
          if (typeof payload?.roomId !== 'string') throw new Error('잘못된 요청입니다.');
          const message = await createMessage(userId, payload.roomId, { content: payload.content });
          io.to(payload.roomId).emit('message:new', message);
          callback?.({ ok: true, message });
        } catch {
          callback?.({ ok: false, message: '메시지를 전송할 수 없습니다.' });
        }
      },
    );
  });
  setInterval(() => buckets.clear(), 60_000).unref();
  io.engine.on('connection_error', (error) =>
    logger.warn({ code: error.code }, 'socket connection rejected'),
  );
  return io;
}
