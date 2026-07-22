import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { config } from './config.js';
import { pgPool } from './db.js';

const PgStore = connectPgSimple(session);
export const sessionMiddleware = session({
  name: 'tiny.sid',
  secret: config.SESSION_SECRET,
  store: new PgStore({ pool: pgPool, tableName: 'session', createTableIfMissing: false }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: config.SESSION_MAX_AGE_MS,
  },
});
