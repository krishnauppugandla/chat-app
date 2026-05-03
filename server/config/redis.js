import Redis from 'ioredis';

// Upstash requires TLS for rediss:// URLs — standard redis:// (local dev) works without it
const isTLS = process.env.REDIS_URL?.startsWith('rediss://');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  ...(isTLS && {
    tls: {
      rejectUnauthorized: false,
    },
  }),
});

redis.on('error', (err) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('[Redis] Connection error:', err.message);
  }
});

redis.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Redis] Connected');
  }
});

export default redis;
