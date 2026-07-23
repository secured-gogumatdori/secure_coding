import crypto from 'node:crypto';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { errorHandler, HttpError, verifyCsrf } from './http.js';
import { logger } from './logger.js';
import { adminRouter } from './routes.admin.js';
import { authRouter } from './routes.auth.js';
import { chatsRouter } from './routes.chats.js';
import { productsRouter } from './routes.products.js';
import { reportsRouter } from './routes.reports.js';
import { usersRouter } from './routes.users.js';
import { walletRouter } from './routes.wallet.js';
import { sessionMiddleware } from './session.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY);
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(incoming)
          ? incoming
          : crypto.randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
  }),
);
app.use((req, res, next) => {
  req.setTimeout(15_000);
  res.setTimeout(15_000);
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", config.WEB_ORIGIN],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);
app.use(
  cors({
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-ID'],
  }),
);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(sessionMiddleware);
app.use(
  '/uploads',
  express.static(path.resolve(config.UPLOAD_DIR), {
    dotfiles: 'deny',
    fallthrough: false,
    maxAge: '1d',
    immutable: false,
  }),
);

const rateLimitHandler = (req: express.Request, res: express.Response) =>
  res.status(429).json({
    error: { code: 'RATE_LIMITED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
    requestId: req.id,
  });

const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.NODE_ENV === 'test' ? 10_000 : 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const reportLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: config.NODE_ENV === 'test' ? 10_000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});
const transferLimiter = rateLimit({
  windowMs: 60_000,
  limit: config.NODE_ENV === 'test' ? 10_000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/reports', reportLimiter);
app.use('/api/wallet/transfers', transferLimiter);
app.use('/api', verifyCsrf);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (_req, _res, next) =>
  next(new HttpError(404, 'NOT_FOUND', 'API 경로를 찾을 수 없습니다.')),
);
app.use((_req, _res, next) =>
  next(new HttpError(404, 'NOT_FOUND', '요청한 경로를 찾을 수 없습니다.')),
);
app.use(errorHandler);
