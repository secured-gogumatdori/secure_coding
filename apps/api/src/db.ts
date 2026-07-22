import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { config } from './config.js';

export const prisma = new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
export const pgPool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });
