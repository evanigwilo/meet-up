// 👇 Session
import session from 'express-session';
// 👇 Redis
import connectRedis from 'connect-redis';
// 👇 Constants, Helpers & Types
import { SESSION_ID, SESSION_SECRET, API_VERSION, maxAge, production } from '../constants';
import { session as client } from '../services/client';

const redisStore = connectRedis(session);

// 👇 configure session using redis client
export default session({
  name: SESSION_ID,
  secret: SESSION_SECRET,
  saveUninitialized: false,
  resave: false,
  store: new redisStore({
    client,
    disableTouch: true,
  }),
  cookie: {
    // path: API_VERSION,
    maxAge,
    secure: false,
    // 👇 prevent client side JS from reading the cookie
    httpOnly: true,
  },
});
