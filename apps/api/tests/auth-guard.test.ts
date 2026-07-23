import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userSearchSchema } from '@tiny/shared';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('../src/db.js', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique },
  },
}));

import { HttpError, requireAuth } from '../src/http.js';

function requestWithSession(userId = '00000000-0000-4000-8000-000000000001') {
  return { session: { userId } } as unknown as Request;
}

describe('공용 인증 guard와 검색 입력', () => {
  beforeEach(() => vi.clearAllMocks());

  it('비활성 계정의 기존 세션을 거부한다', async () => {
    mocks.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      role: 'USER',
      status: 'DORMANT',
    });
    const next = vi.fn();

    requireAuth(requestWithSession(), {} as Response, next as NextFunction);

    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    const error = next.mock.calls[0]?.[0] as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(error.code).toBe('ACCOUNT_RESTRICTED');
  });

  it('활성 계정만 통과시키고 DB의 최신 role을 세션에 반영한다', async () => {
    mocks.findUnique.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    const request = requestWithSession();
    const next = vi.fn();

    requireAuth(request, {} as Response, next as NextFunction);

    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    expect(next).toHaveBeenCalledWith();
    expect(request.session.role).toBe('ADMIN');
  });

  it('빈 값과 문자열 이외의 검색 query를 거부한다', () => {
    expect(userSearchSchema.safeParse({ q: '' }).success).toBe(false);
    expect(userSearchSchema.safeParse({ q: ['admin'] }).success).toBe(false);
    expect(userSearchSchema.safeParse({ q: { $ne: '' } }).success).toBe(false);
    expect(userSearchSchema.safeParse({ q: "' OR 1=1 --" }).success).toBe(true);
  });
});
