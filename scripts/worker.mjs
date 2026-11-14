// Standalone deployment worker. Secrets come from runtime environment, never URLs.
const base = process.env.WORKER_APP_URL || process.env.BETTER_AUTH_URL;
const secret = process.env.CRON_SECRET;
if (!base || !secret || secret.length < 32)
  throw new Error('Worker requires application URL and a strong CRON_SECRET');
let stopping = false;
let nextGeneration = 0;
let wake;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    stopping = true;
    wake?.();
  });
async function invoke(endpoint) {
  try {
    const response = await fetch(new URL('/api/cron/' + endpoint, base), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secret },
      signal: AbortSignal.timeout(300000),
    });
    if (!response.ok)
      console.error(endpoint + ' failed with HTTP ' + response.status);
    else console.info(endpoint + ' completed');
  } catch {
    console.error(endpoint + ' could not reach the application');
  }
}
while (!stopping) {
  if (Date.now() >= nextGeneration) {
    await invoke('generate-reminders');
    nextGeneration = Date.now() + 300000;
  }
  if (!stopping) await invoke('process-email-queue');
  if (!stopping)
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 60000);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
}
