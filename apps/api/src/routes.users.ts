import { Router } from 'express';
import { idSchema, userSearchSchema } from '@tiny/shared';
import { prisma } from './db.js';
import { asyncHandler, HttpError, parse, requireAuth } from './http.js';

export const usersRouter = Router();

usersRouter.get(
  '/search',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { q } = parse(userSearchSchema, req.query);
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
      },
    });
    res.json({ users });
  }),
);

usersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parse(idSchema, req.params.id);
    const user = await prisma.user.findFirst({
      where: { id, status: 'ACTIVE' },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
    res.json({ user });
  }),
);
