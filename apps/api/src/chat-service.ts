import { messageSchema } from '@tiny/shared';
import { prisma } from './db.js';
import { HttpError, parse } from './http.js';

export async function canAccessRoom(userId: string, roomId: string) {
  const room = await prisma.chatRoom.findUnique({
    where: { id: roomId },
    include: { members: { where: { userId }, select: { userId: true } } },
  });
  return !!room && (room.type === 'GLOBAL' || room.members.length === 1);
}

export async function createMessage(userId: string, roomId: string, value: unknown) {
  if (!(await canAccessRoom(userId, roomId)))
    throw new HttpError(403, 'ROOM_ACCESS_DENIED', '채팅방에 접근할 수 없습니다.');
  const { content } = parse(messageSchema, value);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (user?.status !== 'ACTIVE')
    throw new HttpError(403, 'ACCOUNT_RESTRICTED', '채팅을 이용할 수 없는 계정입니다.');
  return prisma.message.create({
    data: { chatRoomId: roomId, senderId: userId, content },
    include: { sender: { select: { id: true, displayName: true, username: true } } },
  });
}
