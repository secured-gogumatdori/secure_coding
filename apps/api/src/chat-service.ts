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
  const { content, clientMessageId } = parse(messageSchema, value);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (user?.status !== 'ACTIVE')
    throw new HttpError(403, 'ACCOUNT_RESTRICTED', '채팅을 이용할 수 없는 계정입니다.');
  const include = {
    sender: { select: { id: true, displayName: true, username: true } },
  } as const;
  if (!clientMessageId)
    return prisma.message.create({
      data: { chatRoomId: roomId, senderId: userId, content },
      include,
    });
  const message = await prisma.message.upsert({
    where: { senderId_clientMessageId: { senderId: userId, clientMessageId } },
    update: {},
    create: { chatRoomId: roomId, senderId: userId, clientMessageId, content },
    include,
  });
  if (message.chatRoomId !== roomId || message.content !== content)
    throw new HttpError(409, 'MESSAGE_KEY_CONFLICT', '메시지 전송 정보를 다시 확인해 주세요.');
  return message;
}
