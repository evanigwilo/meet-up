declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PROTOCOL: string;
      SERVER_PORT: string;
      SERVER_HOST: string;
      NODE_ENV: string;
      API_VERSION: string;
      DEV_LANG: string;
      SESSION_ID: string;
      SESSION_SECRET: string;
      OAUTH_GOOGLE_CLIENTID: string;
      OAUTH_GOOGLE_CLIENTSECRET: string;
      FACEBOOK_CLIENT_ID: string;
      FACEBOOK_CLIENT_SECRET: string;
      REDIS_DB_HOST: string;
      REDIS_DB_PORT: string;
      DATABASE_DIALECT: string;
      DATABASE_USER: string;
      DATABASE_PASSWORD: string;
      DATABASE_DB: string;
      DATABASE_HOST: string;
      DATABASE_PORT: string;
      MONGO_INITDB_ROOT_USERNAME: string;
      MONGO_INITDB_ROOT_PASSWORD: string;
      MONGO_INITDB_DATABASE: string;
      MONGO_DB_HOST: string;
      MONGO_DB_PORT: string;
      NGINX_SERVER_HOST: string;
      NGINX_SERVER_PORT: string;
      NGINX_SERVER_PORT_1: string;
      NGINX_SERVER_PORT_2: string;
      TEST_ARGS: string;
    }
  }
}

export {}
