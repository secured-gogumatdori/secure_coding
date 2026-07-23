import { createServer } from 'node:http';
import { app } from './app.js';
import { config } from './config.js';
import { pgPool, prisma } from './db.js';
import { logger } from './logger.js';
import { createSocketServer } from './socket.js';

const server = createServer(app);
const io = createSocketServer(server);
app.set('io', io);
server.listen(config.PORT, () => logger.info({ port: config.PORT }, 'API server listening'));

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await prisma.$disconnect();
    await pgPool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
