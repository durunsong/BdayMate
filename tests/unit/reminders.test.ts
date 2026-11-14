import 'dotenv/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reminderInstant } from '../../src/services/reminders';
import { authorizeCron, readCronOptions } from '../../src/lib/cron-auth';

afterEach(() => vi.unstubAllEnvs());

describe('civil reminder send times', () => {
  it.each([
    ['2026-11-14', '09:00', 'Asia/Shanghai', '2026-11-14T01:00:00.000Z'],
    ['2026-03-08', '02:30', 'America/New_York', '2026-03-08T07:30:00.000Z'],
    ['2026-11-01', '01:30', 'America/New_York', '2026-11-01T05:30:00.000Z'],
    ['2026-10-04', '02:15', 'Australia/Lord_Howe', '2026-10-03T15:45:00.000Z'],
  ])('converts %s %s %s deterministically', (date, time, zone, expected) => {
    expect(reminderInstant(date, time, zone).toISOString()).toBe(expected);
  });
  it('rejects malformed civil dates and send times', () => {
    expect(() => reminderInstant('2026-02-30', '09:00', 'UTC')).toThrow();
    expect(() => reminderInstant('2026-01-01', '24:00', 'UTC')).toThrow();
    expect(() => reminderInstant('2026-01-01', '09:00', 'Not/AZone')).toThrow();
  });
});

describe('cron authorization', () => {
  it('requires configured secret and exact Bearer token', () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(() => authorizeCron(new Request('http://localhost'))).toThrow();
    vi.stubEnv('CRON_SECRET', 'a-long-test-cron-secret');
    expect(() =>
      authorizeCron(
        new Request('http://localhost', {
          headers: { authorization: 'Bearer wrong' },
        }),
      ),
    ).toThrow();
    expect(() =>
      authorizeCron(
        new Request('http://localhost', {
          headers: { authorization: 'Bearer a-long-test-cron-secret' },
        }),
      ),
    ).not.toThrow();
  });
});

import {
  GET as generateGet,
  POST as generatePost,
} from '../../src/app/api/cron/generate-reminders/route';
import {
  GET as processGet,
  POST as processPost,
} from '../../src/app/api/cron/process-email-queue/route';

describe('cron HTTP boundaries', () => {
  it.each([generateGet, processGet])(
    'protects Vercel GET invocations with the same bearer authentication',
    async (get) => {
      expect(get).toBeTypeOf('function');
      vi.stubEnv('CRON_SECRET', 'test-private-cron-key');
      const response = await get(
        new Request('http://localhost/api/cron?userId=test-not-authorized'),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.text()).not.toContain('test-private-cron-key');
    },
  );
  it('preserves a GET acceptance scope rather than processing every user', async () => {
    expect(
      await readCronOptions(
        new Request('http://localhost/api/cron?userId=test-owner&limit=2'),
      ),
    ).toEqual({ userId: 'test-owner', limit: 2 });
  });
  it.each(['userId=', 'limit=101', 'limit=invalid', 'now=2000-01-01'])(
    'rejects invalid GET query options: %s',
    async (query) => {
      await expect(
        readCronOptions(new Request('http://localhost/api/cron?' + query)),
      ).rejects.toThrow();
    },
  );
  it.each([generatePost, processPost])(
    'denies unauthenticated requests before queue access',
    async (post) => {
      vi.stubEnv('CRON_SECRET', 'test-private-cron-key');
      const response = await post(new Request('http://localhost/api/cron'));
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain('test-private-cron-key');
    },
  );
  it.each([generatePost, processPost])(
    'rejects invalid scopes and caller-supplied clocks',
    async (post) => {
      vi.stubEnv('CRON_SECRET', 'test-private-cron-key');
      for (const body of [
        { userId: '' },
        { userId: 42 },
        { now: '2000-01-01' },
        { limit: 101 },
      ]) {
        const response = await post(
          new Request('http://localhost/api/cron', {
            method: 'POST',
            headers: { authorization: 'Bearer test-private-cron-key' },
            body: JSON.stringify(body),
          }),
        );
        expect(response.status).toBe(400);
      }
    },
  );
});
