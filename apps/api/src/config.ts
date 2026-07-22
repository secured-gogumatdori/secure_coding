import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
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
  LOG_LEVEL: z.string().default('info'),
});

const parsed = schema.parse(process.env);
const repositoryRoot = path.resolve(import.meta.dirname, '../../..');
export const config = {
  ...parsed,
  UPLOAD_DIR: path.isAbsolute(parsed.UPLOAD_DIR)
    ? parsed.UPLOAD_DIR
    : path.resolve(repositoryRoot, parsed.UPLOAD_DIR),
};
