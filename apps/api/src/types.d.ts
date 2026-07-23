import 'express-session';
import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    activeUser?: { id: string; role: 'USER' | 'ADMIN' };
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: 'USER' | 'ADMIN';
    csrfToken?: string;
    authenticatedAt?: number;
  }
}
