import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
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
