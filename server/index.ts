import { resolve } from 'node:path';
import { startServer } from './server';

const port = Number(process.env.PORT || 3111);
const host = process.env.HOST || '0.0.0.0';
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Invalid PORT');
  process.exit(1);
}
const dataDir = resolve(process.env.SIM_LIFE_DATA_DIR || 'server-data');
startServer({ port, host, dataDir, distDir: resolve('dist'),
  testNoCodes:process.env.SIM_LIFE_TEST_NO_CODES==='1' })
  .then((server) => {
    console.log('🏡 Sim-Life server: http://127.0.0.1:' + server.port);
    console.log('Invite codes (private): ' + resolve(dataDir, 'access.json'));
    console.log('Use trusted home Wi-Fi only; this prototype uses HTTP, not HTTPS.');
  })
  .catch((error: unknown) => {
    console.error('Failed to start Sim-Life:', error);
    process.exitCode = 1;
  });
