import { UmamiRedisClient } from '@umami/redis-client';

const REDIS = 'redis';
const enabled = !!process.env.REDIS_URL;

function getClient() {
  const redis = new UmamiRedisClient({ url: process.env.REDIS_URL });
  const originalConnect = redis.connect.bind(redis);
  let connectPromise: Promise<void> | null = null;

  const resetConnectionState = () => {
    redis.isConnected = false;
  };

  redis.client.on('end', resetConnectionState);
  redis.client.on('reconnecting', resetConnectionState);

  redis.connect = async () => {
    if (redis.client.isReady || redis.client.isOpen) {
      redis.isConnected = true;
      return;
    }

    if (connectPromise) {
      return connectPromise;
    }

    connectPromise = (async () => {
      try {
        await originalConnect();
      } catch (error) {
        redis.isConnected = false;
        throw error;
      } finally {
        connectPromise = null;
      }
    })();

    return connectPromise;
  };

  if (process.env.NODE_ENV !== 'production') {
    globalThis[REDIS] = redis;
  }

  return redis;
}

const client = globalThis[REDIS] || getClient();

export default { client, enabled };
