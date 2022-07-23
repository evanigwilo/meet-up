// 👇 Server
import { request } from 'http';
// 👇 ensures that all necessary environment variables are defined after reading from .env
import { config } from 'dotenv-safe';

// 👇 load variables from .env file
config();

const options /*: RequestOptions */ = {
  host: process.env.SERVER_HOST,
  port: process.env.SERVER_PORT,
  path: process.env.API_VERSION + '/status',
  timeout: 2000,
  method: 'GET',
};

// 👇 server is healthy if status code is 200
const healthCheck = request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode == 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', (error) => {
  console.error('ERROR', { error });
  process.exit(1);
});

healthCheck.end();
