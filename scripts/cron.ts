import 'dotenv/config';

async function main() {
  const task = process.argv[2];
  const userId = process.argv[3];
  if (!['generate-reminders', 'process-email-queue'].includes(task)) {
    throw new Error(
      'Usage: pnpm cron:generate [userId] | pnpm cron:process [userId]',
    );
  }
  const secret = process.env.CRON_SECRET;
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    'http://localhost:3000';
  if (!secret || secret === 'xxxx') throw new Error('CRON_SECRET is required.');
  const url = new URL(`/api/cron/${task}`, base);
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  ) {
    throw new Error('Cron URL must use HTTPS, except on localhost.');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(userId ? { userId } : {}),
    signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok)
    throw new Error(
      `Cron returned HTTP ${response.status}; check server configuration.`,
    );
  const result: unknown = await response.json();
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(
    error instanceof Error &&
      (error.message.startsWith('Usage:') ||
        error.message.startsWith('CRON_SECRET') ||
        error.message.startsWith('Cron '))
      ? error.message
      : 'Cron request failed. Check application URL and server availability.',
  );
  process.exitCode = 1;
});
