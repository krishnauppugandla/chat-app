import redis from '../config/redis.js';

const ONLINE_KEY = 'online_users';

export const setOnline = (userId) => redis.sadd(ONLINE_KEY, userId);

export const setOffline = (userId) => redis.srem(ONLINE_KEY, userId);

export const isOnline = async (userId) => {
  const result = await redis.sismember(ONLINE_KEY, userId);
  return result === 1;
};

export const getOnlineUsers = () => redis.smembers(ONLINE_KEY);
