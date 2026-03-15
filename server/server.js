import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initSocket } from './sockets/index.js';
import prisma from './config/database.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);
initSocket(httpServer);

const startServer = async () => {
  try {
    await prisma.$connect();

    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] Connected to PostgreSQL');
    }

    httpServer.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

startServer();
