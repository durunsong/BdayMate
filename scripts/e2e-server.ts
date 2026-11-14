import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { config } from 'dotenv';
import { startMailCapture } from '../tests/e2e/mail-capture';

const capture = await startMailCapture(3101);
const env = { ...process.env };
config({ processEnv: env, quiet: true });
Object.assign(env, {
  BETTER_AUTH_URL: 'http://127.0.0.1:3100',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: String(capture.smtpPort),
  SMTP_SECURE: 'false',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'test-sender@example.test',
  NEXT_TELEMETRY_DISABLED: '1',
});
if (!env.DATABASE_URL || !env.BETTER_AUTH_SECRET || !env.CRON_SECRET) {
  await capture.close();
  throw new Error(
    'E2E requires DATABASE_URL, BETTER_AUTH_SECRET and CRON_SECRET in the local environment.',
  );
}
// Next request logs can include verification tokens. Keep the child output private.
const child = spawn(
  process.execPath,
  [
    createRequire(import.meta.url).resolve('next/dist/bin/next'),
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3100',
  ],
  {
    env,
    stdio: ['ignore', 'ignore', 'ignore'],
  },
);
let stopping = false;
async function stop(code: number) {
  if (stopping) return;
  stopping = true;
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 5_000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await capture.close();
  process.exit(code);
}
child.once('error', () => {
  console.error('Local E2E Next process could not start.');
  void stop(1);
});
child.once('exit', (code) => {
  if (!stopping) {
    console.error('Local E2E Next process exited.');
    void stop(code ?? 1);
  }
});
process.once('SIGINT', () => {
  void stop(0);
});
process.once('SIGTERM', () => {
  void stop(0);
});
