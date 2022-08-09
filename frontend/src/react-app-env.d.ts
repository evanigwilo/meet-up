/// <reference types="react-scripts" />
/*
  declare module "*.mp4" {
    const src: string;
    export default src;
  }
*/

declare namespace NodeJS {
  interface ProcessEnv {
    REACT_APP_SERVER_PROTOCOL: string;
    REACT_APP_SERVER_HOST: string;
    REACT_APP_SERVER_PATH: string;
    REACT_APP_SERVER_API_VERSION: string;
    REACT_APP_SERVER_PORT: string;
    PORT: string;
    TEST_ARGS: string;
  }
}
