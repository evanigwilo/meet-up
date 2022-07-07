// 👇 Entities
import UserEntity from '../src/api/v1/entity/User';

declare module 'express-session' {
  interface SessionData {
    user: Partial<UserEntity>;
  }
}

declare global {
  namespace Express {
    // 👇 OAuth and Password User type
    interface User extends Partial<UserEntity> {}
    interface AuthInfo extends Partial<UserEntity> {}
  }
}
export {};
