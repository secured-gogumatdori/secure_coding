import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
dotenv.config({ path: path.join(repositoryRoot, '.env') });

const webOriginSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }, 'WEB_ORIGIN은 경로와 마지막 슬래시가 없는 http(s) Origin이어야 합니다.');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_ORIGIN: webOriginSchema.default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    SESSION_MAX_AGE_MS: z.coerce.number().int().min(300000).default(28800000),
    TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0),
    PRODUCT_REPORT_THRESHOLD: z.coerce.number().int().min(2).default(3),
    USER_REPORT_THRESHOLD: z.coerce.number().int().min(2).default(5),
    DEMO_INITIAL_BALANCE: z.coerce.number().int().min(0).default(100000),
    UPLOAD_DIR: z.string().default('apps/api/uploads'),
    MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).default(5242880),
    MAX_IMAGE_PIXELS: z.coerce.number().int().min(10000).default(16000000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    if (!value.WEB_ORIGIN.startsWith('https://'))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['WEB_ORIGIN'],
        message: 'production WEB_ORIGIN에는 HTTPS가 필요합니다.',
      });
    if (
      value.SESSION_SECRET.length < 48 ||
      /replace|change|example|password|secret/i.test(value.SESSION_SECRET)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SESSION_SECRET'],
        message: 'production SESSION_SECRET에는 48자 이상의 무작위 값이 필요합니다.',
      });
  });

const parsed = schema.parse(process.env);
export const config = {
  ...parsed,
  UPLOAD_DIR: path.isAbsolute(parsed.UPLOAD_DIR)
    ? parsed.UPLOAD_DIR
    : path.resolve(repositoryRoot, parsed.UPLOAD_DIR),
};
