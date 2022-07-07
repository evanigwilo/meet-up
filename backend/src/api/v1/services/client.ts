// 👇 Redis
import Redis, { RedisOptions } from 'ioredis';
// 👇 Constants, Helpers & Types
import { ClientDB } from '../types/enum';
import { REDIS_DB_HOST, REDIS_DB_PORT, testDbConnectionFailed, testing } from '../constants';

const clientOptions = (db: ClientDB): RedisOptions => ({
  host: REDIS_DB_HOST,
  port: Number(REDIS_DB_PORT),
  db,
  lazyConnect: true,
  // 👇 no reconnecting if testing
  reconnectOnError: () => !testing,
  maxRetriesPerRequest: testing ? 0 : 20,
});

const clientEvents = (client: Redis & { connected?: boolean }, dbName: string) => {
  client.on('connect', () => {
    console.log(`Connected to RedisDB(db:${dbName})`);
    client.connected = true;
  });

  client.on('error', () => {
    // 👇 fail test on first error connecting to redis client
    if (testing) {
      client.quit();
      if (!client.connected) {
        throw new Error(testDbConnectionFailed);
      }
    } else {
      console.log(`Waiting for RedisDB(db:${dbName})`);
    }
  });
};

// 👇 Configure redis clients
export const socket = new Redis(clientOptions(ClientDB.SOCKET));
clientEvents(socket, 'socket');
export const session = new Redis(clientOptions(ClientDB.SESSION));
clientEvents(session, 'session');

export const publisher = new Redis(clientOptions(ClientDB.PUBLISHER));
export const subscriber = new Redis(clientOptions(ClientDB.SUBSCRIBER));
clientEvents(publisher, 'publisher');
clientEvents(subscriber, 'subscriber');
