// 👇 Redis
import { RedisPubSub } from 'graphql-redis-subscriptions';
import { publisher, subscriber } from './client';

// 👇 Our PubSub instance enables our server code to both publish and listen to events
const pubsub = new RedisPubSub({
  publisher,
  subscriber,
});

/* 
const pubsub = new PubSub();
*/

export default pubsub;
