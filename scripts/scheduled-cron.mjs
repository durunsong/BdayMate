import { pathToFileURL } from 'node:url';

// No application dependencies are needed on the GitHub-hosted runner.
/** @param {Record<string, string | undefined>} environment */
export async function runScheduledCron(environment = process.env) {
  let base;
  try {
    base = new URL(environment.BDAYMATE_APP_URL || '');
  } catch {
    throw new Error('Set BDAYMATE_APP_URL to the production HTTPS origin.');
  }
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/'
  ) {
    throw new Error(
      'BDAYMATE_APP_URL must be an HTTPS origin without credentials or a path.',
    );
  }
  const secret = environment.CRON_SECRET || '';
  if (secret.length < 32 || !/^[!-~]+$/.test(secret))
    throw new Error(
      'Set CRON_SECRET to the same strong secret used by Vercel.',
    );
  const userId = environment.BDAYMATE_CRON_USER_ID?.trim();
  if (userId && userId.length > 128)
    throw new Error('Invalid acceptance user ID.');
  const headers = {
    authorization: 'Bearer ' + secret,
    'content-type': 'application/json',
    ...(environment.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          'x-vercel-protection-bypass':
            environment.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : {}),
  };
  let succeeded = true;
  for (const endpoint of ['generate-reminders', 'process-email-queue']) {
    try {
      const response = await fetch(new URL('/api/cron/' + endpoint, base), {
        method: 'POST',
        redirect: 'error',
        headers,
        body: JSON.stringify({
          ...(userId ? { userId } : {}),
          ...(endpoint === 'process-email-queue' ? { limit: 3 } : {}),
        }),
        signal: AbortSignal.timeout(280_000),
      });
      if (!response.ok) {
        console.error(endpoint + ': HTTP ' + response.status);
        succeeded = false;
        continue;
      }
      const result = await response.json();
      if (result?.ok !== true || result.failed > 0) {
        console.error(endpoint + ': failed; inspect application email logs.');
        succeeded = false;
      } else {
        console.info(endpoint + ': completed');
      }
    } catch {
      // Fetch errors may contain URLs or headers; never print raw exceptions.
      console.error(
        endpoint + ': request failed; check deployment availability.',
      );
      succeeded = false;
    }
  }
  return succeeded;
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    if (!(await runScheduledCron())) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Scheduler configuration is invalid.',
    );
    process.exitCode = 1;
  }
}
