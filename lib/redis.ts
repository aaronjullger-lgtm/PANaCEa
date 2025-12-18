import Redis from 'ioredis';

let redis: Redis | null = null;

(() => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not set; Redis-backed rate limiting is disabled.');
    return;
  }

  try {
    const client = new Redis(redisUrl);
    client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
    redis = client;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    redis = null;
  }
})();

export { redis };
