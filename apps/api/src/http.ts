import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ZodError, type ZodType } from 'zod';
import { prisma } from './db.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    void fn(req, res, next).catch(next);

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  if (!req.session.userId) throw new HttpError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, role: true, status: true },
  });
  if (!user) throw new HttpError(401, 'SESSION_INVALID', '세션이 유효하지 않습니다.');
  if (user.status !== 'ACTIVE')
    throw new HttpError(
      403,
      'ACCOUNT_RESTRICTED',
      `계정 상태(${user.status})로 인해 이용할 수 없습니다.`,
    );
  req.session.role = user.role;
  next();
});

export const requireAdmin = [
  requireAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.session.role !== 'ADMIN')
      return next(new HttpError(403, 'ADMIN_REQUIRED', '관리자 권한이 필요합니다.'));
    next();
  },
];

export function verifyCsrf(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const expected = req.session.csrfToken;
  const actual = req.get('x-csrf-token');
  if (!expected || !actual)
    return next(new HttpError(403, 'CSRF_INVALID', 'CSRF 토큰이 유효하지 않습니다.'));
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return next(new HttpError(403, 'CSRF_INVALID', 'CSRF 토큰이 유효하지 않습니다.'));
  next();
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError)
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값을 확인해 주세요.',
        details: error.flatten(),
      },
      requestId: req.id,
    });
  if (error instanceof HttpError)
    return res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message }, requestId: req.id });
  const known = error as { code?: string };
  if (known?.code === 'P2002')
    return res.status(409).json({
      error: { code: 'DUPLICATE', message: '이미 존재하는 데이터입니다.' },
      requestId: req.id,
    });
  req.log?.error({ err: error }, 'request failed');
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '요청을 처리하지 못했습니다.' },
    requestId: req.id,
  });
}

export const publicUser = (user: {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  role: string;
  status: string;
  createdAt: Date;
}) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  bio: user.bio,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
});

export const jsonBigInt = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item)),
  );
