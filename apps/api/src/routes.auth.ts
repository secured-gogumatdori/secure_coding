import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import argon2 from 'argon2';
import { loginSchema, passwordChangeSchema, profileSchema, signupSchema } from '@tiny/shared';
import { config } from './config.js';
import { pgPool, prisma } from './db.js';
import { asyncHandler, HttpError, parse, publicUser, requireAuth } from './http.js';
import { disconnectUserSockets } from './socket-control.js';

export const authRouter = Router();
const hashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 3,
  parallelism: 1,
} as const;
const dummyHash = await argon2.hash('constant-time-dummy-password', hashOptions);

function regenerate(req: Express.Request) {
  return new Promise<void>((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
}

authRouter.get('/csrf', (req, res) => {
  req.session.csrfToken ??= randomBytes(32).toString('base64url');
  res.json({ csrfToken: req.session.csrfToken });
});

authRouter.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const input = parse(signupSchema, req.body);
    const exists = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (exists) throw new HttpError(409, 'USERNAME_UNAVAILABLE', '사용할 수 없는 아이디입니다.');
    const passwordHash = await argon2.hash(input.password, hashOptions);
    const balance = config.NODE_ENV === 'production' ? 0n : BigInt(config.DEMO_INITIAL_BALANCE);
    const user = await prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        passwordHash,
        wallet: { create: { balance } },
      },
    });
    res.status(201).json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    const valid = await argon2
      .verify(user?.passwordHash ?? dummyHash, input.password)
      .catch(() => false);
    if (!user || !valid || user.status !== 'ACTIVE')
      throw new HttpError(401, 'LOGIN_FAILED', '아이디 또는 비밀번호를 확인해 주세요.');
    await regenerate(req);
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.authenticatedAt = Date.now();
    req.session.csrfToken = randomBytes(32).toString('base64url');
    res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  }),
);

authRouter.post('/logout', (req, res, next) => {
  const userId = req.session.userId;
  disconnectUserSockets(req, userId);
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('tiny.sid');
    res.status(204).end();
  });
});

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session.userId) return res.json({ user: null });
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) return res.json({ user: null });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = parse(profileSchema, req.body);
    const user = await prisma.user.update({
      where: { id: req.session.userId },
      data: { bio: input.bio },
    });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.session.authenticatedAt || Date.now() - req.session.authenticatedAt > 30 * 60_000)
      throw new HttpError(401, 'REAUTH_REQUIRED', '민감한 작업을 위해 다시 로그인해 주세요.');
    const input = parse(passwordChangeSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } });
    if (!(await argon2.verify(user.passwordHash, input.currentPassword)))
      throw new HttpError(400, 'PASSWORD_INCORRECT', '현재 비밀번호가 올바르지 않습니다.');
    const passwordHash = await argon2.hash(input.newPassword, hashOptions);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    await pgPool.query("DELETE FROM session WHERE sess->>'userId' = $1", [user.id]);
    disconnectUserSockets(req, user.id);
    res.clearCookie('tiny.sid');
    res.status(204).end();
  }),
);
