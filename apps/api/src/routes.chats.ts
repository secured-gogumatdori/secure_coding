import { Router } from 'express';
import { directRoomSchema, idSchema } from '@tiny/shared';
import { createMessage, canAccessRoom } from './chat-service.js';
import { prisma } from './db.js';
import { asyncHandler, HttpError, parse, requireAuth } from './http.js';

export const chatsRouter = Router();
chatsRouter.use(requireAuth);

chatsRouter.get(
  '/rooms',
  asyncHandler(async (req, res) => {
    let global = await prisma.chatRoom.findFirst({ where: { type: 'GLOBAL' } });
    global ??= await prisma.chatRoom.create({ data: { type: 'GLOBAL' } });
    const direct = await prisma.chatRoom.findMany({
      where: { type: 'DIRECT', members: { some: { userId: req.session.userId } } },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ rooms: [global, ...direct] });
  }),
);

chatsRouter.post(
  '/direct',
  asyncHandler(async (req, res) => {
    const { userId } = parse(directRoomSchema, req.body);
    if (userId === req.session.userId)
      throw new HttpError(400, 'SELF_CHAT_DENIED', '본인과 채팅방을 만들 수 없습니다.');
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (target?.status !== 'ACTIVE')
      throw new HttpError(400, 'TARGET_UNAVAILABLE', '채팅할 수 없는 사용자입니다.');
    const ids = [req.session.userId!, userId].sort();
    const directKey = `${ids[0]}:${ids[1]}`;
    const room = await prisma.chatRoom.upsert({
      where: { directKey },
      update: {},
      create: { type: 'DIRECT', directKey, members: { create: ids.map((id) => ({ userId: id })) } },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
      },
    });
    res.status(201).json({ room });
  }),
);

chatsRouter.get(
  '/:roomId/messages',
  asyncHandler(async (req, res) => {
    const roomId = parse(idSchema, req.params.roomId);
    if (!(await canAccessRoom(req.session.userId!, roomId)))
      throw new HttpError(403, 'ROOM_ACCESS_DENIED', '채팅방에 접근할 수 없습니다.');
    const messages = await prisma.message.findMany({
      where: { chatRoomId: roomId, status: 'VISIBLE' },
      include: { sender: { select: { id: true, username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ messages: messages.reverse() });
  }),
);

chatsRouter.post(
  '/:roomId/messages',
  asyncHandler(async (req, res) => {
    const roomId = parse(idSchema, req.params.roomId);
    const message = await createMessage(req.session.userId!, roomId, req.body);
    res.status(201).json({ message });
  }),
);
