import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  room: vi.fn(),
  user: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../src/db.js', () => ({
  prisma: {
    chatRoom: { findUnique: mocks.room },
    user: { findUnique: mocks.user },
    message: { create: mocks.create, upsert: mocks.upsert },
  },
}));

import { createMessage } from '../src/chat-service.js';
import { HttpError } from '../src/http.js';

const userId = '00000000-0000-4000-8000-000000000001';
const roomId = '00000000-0000-4000-8000-000000000002';
const clientMessageId = '00000000-0000-4000-8000-000000000003';

describe('채팅 메시지 REST fallback 멱등성', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.room.mockResolvedValue({ type: 'GLOBAL', members: [] });
    mocks.user.mockResolvedValue({ status: 'ACTIVE' });
  });

  it('같은 메시지 의도 키를 upsert에 전달한다', async () => {
    const stored = {
      id: '00000000-0000-4000-8000-000000000004',
      chatRoomId: roomId,
      senderId: userId,
      clientMessageId,
      content: '안전한 메시지',
      sender: { id: userId, username: 'member', displayName: '회원' },
    };
    mocks.upsert.mockResolvedValue(stored);

    await expect(
      createMessage(userId, roomId, { content: '안전한 메시지', clientMessageId }),
    ).resolves.toEqual(stored);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { senderId_clientMessageId: { senderId: userId, clientMessageId } },
      }),
    );
  });

  it('같은 키를 다른 메시지 내용에 재사용하면 거부한다', async () => {
    mocks.upsert.mockResolvedValue({
      chatRoomId: roomId,
      content: '원래 메시지',
    });

    const promise = createMessage(userId, roomId, {
      content: '변조된 메시지',
      clientMessageId,
    });
    await expect(promise).rejects.toMatchObject<HttpError>({
      status: 409,
      code: 'MESSAGE_KEY_CONFLICT',
    });
  });

  it('이전 클라이언트처럼 의도 키가 없으면 일반 저장을 사용한다', async () => {
    const stored = { chatRoomId: roomId, content: '호환 메시지' };
    mocks.create.mockResolvedValue(stored);

    await expect(createMessage(userId, roomId, { content: '호환 메시지' })).resolves.toEqual(
      stored,
    );
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
