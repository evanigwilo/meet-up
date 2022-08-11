import axios from "axios";
import {
  REACT_APP_SERVER_PROTOCOL,
  REACT_APP_SERVER_HOST,
  REACT_APP_SERVER_PORT,
  REACT_APP_SERVER_API_VERSION,
  REACT_APP_SERVER_PATH,
} from "../utils/constants";

// 👇 axios instance
export default axios.create({
  baseURL: `${REACT_APP_SERVER_PROTOCOL}://${REACT_APP_SERVER_HOST}:${REACT_APP_SERVER_PORT}${REACT_APP_SERVER_PATH}${REACT_APP_SERVER_API_VERSION}`,
  withCredentials: true,
});
