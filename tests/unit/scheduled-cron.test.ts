import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runScheduledCron } from '../../scripts/scheduled-cron.mjs';

const configuration = {
  BDAYMATE_APP_URL: 'https://bdaymate.example.test',
  CRON_SECRET: 'test-scheduler-secret-with-at-least-32-characters',
};
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('GitHub scheduled invocation', () => {
  it('keeps manual acceptance runs scoped to the selected account', async () => {
    fetcher.mockImplementation(async () =>
      Response.json({ ok: true, failed: 0 }),
    );
    expect(
      await runScheduledCron({
        ...configuration,
        BDAYMATE_CRON_USER_ID: 'test-exact-user',
      }),
    ).toBe(true);
    expect(
      fetcher.mock.calls.map(([, options]) =>
        JSON.parse(String(options?.body)),
      ),
    ).toEqual([
      { userId: 'test-exact-user' },
      { userId: 'test-exact-user', limit: 3 },
    ]);
  });
  it.each([
    '',
    'http://bdaymate.example.test',
    'https://user:password@bdaymate.example.test',
    'https://bdaymate.example.test?secret=bad',
  ])(
    'rejects unsafe deployment addresses before sending secrets: %s',
    async (url) => {
      await expect(
        runScheduledCron({ ...configuration, BDAYMATE_APP_URL: url }),
      ).rejects.toThrow();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('rejects absent or placeholder Cron secrets before requests', async () => {
    for (const value of ['', 'xxxx', 'short']) {
      await expect(
        runScheduledCron({ ...configuration, CRON_SECRET: value }),
      ).rejects.toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('generates then consumes with a bounded batch and redirects disabled', async () => {
    fetcher.mockResolvedValueOnce(
      Response.json({ ok: true, generated: 4, users: 1 }),
    );
    fetcher.mockResolvedValueOnce(
      Response.json({ ok: true, sent: 3, failed: 0, processed: 3 }),
    );
    expect(await runScheduledCron(configuration)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [generate, consume] = fetcher.mock.calls;
    expect(String(generate[0])).toBe(
      'https://bdaymate.example.test/api/cron/generate-reminders',
    );
    expect(String(consume[0])).toBe(
      'https://bdaymate.example.test/api/cron/process-email-queue',
    );
    expect(consume[1]).toMatchObject({
      method: 'POST',
      redirect: 'error',
      body: '{"limit":3}',
      headers: { authorization: 'Bearer ' + configuration.CRON_SECRET },
    });
  });

  it('still consumes existing tasks when generation fails, and reports failure', async () => {
    fetcher.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    fetcher.mockResolvedValueOnce(
      Response.json({ ok: true, sent: 1, failed: 0, processed: 1 }),
    );
    expect(await runScheduledCron(configuration)).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('makes SMTP failures visible as a failed scheduled run', async () => {
    fetcher.mockResolvedValueOnce(
      Response.json({ ok: true, generated: 0, users: 1 }),
    );
    fetcher.mockResolvedValueOnce(
      Response.json({ ok: true, sent: 0, failed: 1, processed: 1 }),
    );
    expect(await runScheduledCron(configuration)).toBe(false);
  });

  it('sanitizes network errors and supports the optional Vercel protection header', async () => {
    fetcher.mockRejectedValue(
      new Error('network failure ' + configuration.CRON_SECRET),
    );
    expect(
      await runScheduledCron({
        ...configuration,
        VERCEL_AUTOMATION_BYPASS_SECRET: 'test-bypass',
      }),
    ).toBe(false);
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      'x-vercel-protection-bypass': 'test-bypass',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      configuration.CRON_SECRET,
    );
  });
});
