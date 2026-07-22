import { Router } from 'express';
import { idSchema } from '@tiny/shared';
import { prisma } from './db.js';
import { asyncHandler, HttpError, parse, publicUser } from './http.js';

export const usersRouter = Router();

usersRouter.get(
  '/search',
  asyncHandler(async (req, res) => {
    if (!req.session.userId) throw new HttpError(401, 'AUTH_REQUIRED', '로그인이 필요합니다.');
    const q = String(req.query.q ?? '')
      .trim()
      .slice(0, 30);
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        id: { not: req.session.userId },
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    res.json({ users: users.map(publicUser) });
  }),
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    res.json({ user: publicUser(user) });
  }),
);
