import type { Request } from 'express';
import type { Server } from 'socket.io';

const userSocketRoom = (userId: string) => `user:${userId}`;

export function joinUserSocketRoom(userId: string) {
  return userSocketRoom(userId);
}

export function disconnectUserSockets(req: Request, userId: string | undefined) {
  if (!userId) return;
  const io = req.app.get('io') as Server | undefined;
  io?.in(userSocketRoom(userId)).disconnectSockets(true);
}
