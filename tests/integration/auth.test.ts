import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readMail, startMailCapture } from '../e2e/mail-capture';

if (process.env.BDAY_AUTH_WORKER !== '1') {
  it('runs the real authentication lifecycle with isolated SMTP and environment', async () => {
    const capture = await startMailCapture();
    const env = { ...process.env };
    config({ processEnv: env, quiet: true });
    Object.assign(env, {
      BDAY_AUTH_WORKER: '1',
      BDAY_CAPTURE_URL: capture.url,
      BETTER_AUTH_URL: 'http://127.0.0.1:3100',
      NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(capture.smtpPort),
      SMTP_SECURE: 'false',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: 'test-sender@example.test',
    });
    try {
      const result = await new Promise<{ code: number | null; output: string }>(
        (resolve, reject) => {
          const child = spawn(
            'pnpm',
            [
              'exec',
              'vitest',
              'run',
              'tests/integration/auth.test.ts',
              '--reporter=dot',
            ],
            { env, stdio: ['ignore', 'pipe', 'pipe'] },
          );
          let output = '';
          child.stdout.on('data', (chunk) => {
            output += String(chunk);
          });
          child.stderr.on('data', (chunk) => {
            output += String(chunk);
          });
          const timer = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error('Authentication integration child timed out'));
          }, 110_000);
          child.once('error', (error) => {
            clearTimeout(timer);
            reject(error);
          });
          child.once('close', (code) => {
            clearTimeout(timer);
            resolve({ code, output });
          });
        },
      );
      if (result.code !== 0) {
        let safe = result.output;
        for (const key of [
          'DATABASE_URL',
          'DIRECT_URL',
          'BETTER_AUTH_SECRET',
          'CRON_SECRET',
        ]) {
          if (env[key]) safe = safe.split(env[key]!).join('[REDACTED]');
        }
        throw new Error(
          'Authentication integration failed:' + String.fromCharCode(10) + safe,
        );
      }
      expect(result.output).toContain('12 passed');
      console.info('Real authentication lifecycle: 12 checks passed.');
    } finally {
      await capture.close();
    }
  }, 120_000);
} else {
  describe('real Better Auth and SMTP lifecycle', () => {
    const email = 'test-auth-' + randomUUID() + '@example.test';
    const password = 'Test-password-123!';
    const newPassword = 'Changed-password-456!';
    const baseURL = 'http://127.0.0.1:3100';
    const headers = new Headers({ origin: baseURL });
    const identifiers = new Set<string>();
    let auth: (typeof import('../../src/lib/auth'))['auth'];
    let db: (typeof import('../../src/lib/db'))['db'];
    let userId: string | undefined;
    let cookie = '';
    let resetToken = '';
    let ownedContactId = '';
    let ownedGiftId = '';

    beforeAll(async () => {
      ({ auth } = await import('../../src/lib/auth'));
      ({ db } = await import('../../src/lib/db'));
    });
    afterAll(async () => {
      const { closeTransporter } = await import('../../src/services/email');
      closeTransporter();
      if (db) {
        // A failed post-signup email hook can leave the account saved: discover only this exact generated email.
        const user = await db.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (user) {
          userId = user.id;
          const rows = await db.verification.findMany({
            where: { value: userId },
            select: { identifier: true },
          });
          rows.forEach((row) => identifiers.add(row.identifier));
          if (identifiers.size)
            await db.verification.deleteMany({
              where: { identifier: { in: [...identifiers] }, value: userId },
            });
          await db.user.deleteMany({ where: { id: userId, email } });
        }
        await db.$disconnect();
      }
    });
    const sessionHeaders = () => new Headers({ origin: baseURL, cookie });
    const saveCookie = (response: Response) => {
      cookie = response.headers
        .getSetCookie()
        .map((part) => part.split(';')[0])
        .join('; ');
    };

    it('registers a unique account and delivers a real SMTP verification message', async () => {
      const response = await auth.api.signUpEmail({
        headers,
        body: {
          email,
          name: 'test-auth-account',
          password,
          callbackURL: baseURL + '/dashboard',
        },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      userId = result.user.id as string;
      expect(result.user.emailVerified).toBe(false);
      expect(result.token).toBeNull();
      const messages = await readMail(process.env.BDAY_CAPTURE_URL!, email);
      expect(
        messages.some((mail) =>
          mail.links.some((link) => link.includes('/verify-email?')),
        ),
      ).toBe(true);
      expect(
        await db.emailLog.count({
          where: { userId, template: 'VERIFICATION', status: 'SENT' },
        }),
      ).toBe(1);
    });
    it('does not create another account on duplicate registration', async () => {
      const response = await auth.api.signUpEmail({
        headers,
        body: { email, name: 'test-duplicate', password },
        asResponse: true,
      });
      expect([200, 400, 422]).toContain(response.status);
      expect(await db.user.count({ where: { email } })).toBe(1);
      expect(await db.account.count({ where: { userId } })).toBe(1);
    });
    it('rejects password login before verification', async () => {
      const response = await auth.api.signInEmail({
        headers,
        body: { email, password },
        asResponse: true,
      });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe('EMAIL_NOT_VERIFIED');
    });
    it('verifies the token received through SMTP and persists verified state', async () => {
      const messages = await readMail(process.env.BDAY_CAPTURE_URL!, email);
      const link = messages
        .flatMap((mail) => mail.links)
        .find((value) => value.includes('/verify-email?'));
      expect(Boolean(link)).toBe(true);
      const token = new URL(link!).searchParams.get('token')!;
      const response = await auth.api.verifyEmail({
        headers,
        query: { token },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: userId! } }))
          .emailVerified,
      ).toBe(true);
    });
    it('rejects a wrong password', async () => {
      const response = await auth.api.signInEmail({
        headers,
        body: { email, password: 'Definitely-wrong-password' },
        asResponse: true,
      });
      expect(response.status).toBe(401);
    });
    it('logs in and returns an authenticated persisted session', async () => {
      const response = await auth.api.signInEmail({
        headers,
        body: { email, password },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      saveCookie(response);
      expect(Boolean(cookie)).toBe(true);
      const session = await auth.api.getSession({ headers: sessionHeaders() });
      expect(session?.user.id).toBe(userId);
    });
    it('requests password reset through real SMTP and rejects a fabricated token', async () => {
      const response = await auth.api.requestPasswordReset({
        headers,
        body: { email, redirectTo: baseURL + '/reset-password' },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      const messages = await readMail(process.env.BDAY_CAPTURE_URL!, email);
      const link = messages
        .flatMap((mail) => mail.links)
        .find((value) => value.includes('/api/auth/reset-password/'));
      expect(Boolean(link)).toBe(true);
      resetToken = new URL(link!).pathname.split('/').at(-1)!;
      const rows = await db.verification.findMany({
        where: { value: userId! },
        select: { identifier: true },
      });
      rows.forEach((row) => identifiers.add(row.identifier));
      const invalid = await auth.api.resetPassword({
        headers,
        body: { token: 'test-invalid-' + randomUUID(), newPassword },
        asResponse: true,
      });
      expect(invalid.status).toBe(400);
    });
    it('changes password, invalidates the previous password and revokes existing sessions', async () => {
      const response = await auth.api.resetPassword({
        headers,
        body: { token: resetToken, newPassword },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(
        await auth.api.getSession({ headers: sessionHeaders() }),
      ).toBeNull();
      const old = await auth.api.signInEmail({
        headers,
        body: { email, password },
        asResponse: true,
      });
      expect(old.status).toBe(401);
      const fresh = await auth.api.signInEmail({
        headers,
        body: { email, password: newPassword },
        asResponse: true,
      });
      expect(fresh.status).toBe(200);
      saveCookie(fresh);
      expect(
        (await auth.api.getSession({ headers: sessionHeaders() }))?.user.id,
      ).toBe(userId);
    });
    it('revokes a session and rejects the revoked cookie', async () => {
      const session = await auth.api.getSession({ headers: sessionHeaders() });
      expect(Boolean(session)).toBe(true);
      const response = await auth.api.revokeSession({
        headers: sessionHeaders(),
        body: { token: session!.session.token },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(
        await auth.api.getSession({ headers: sessionHeaders() }),
      ).toBeNull();
      expect(await db.session.count({ where: { userId } })).toBe(0);
    });
    it('rejects deletion without a password even with a fresh authenticated cookie', async () => {
      const login = await auth.api.signInEmail({
        headers,
        body: { email, password: newPassword },
        asResponse: true,
      });
      expect(login.status).toBe(200);
      saveCookie(login);
      ownedContactId = (
        await db.contact.create({
          data: {
            userId: userId!,
            name: 'test-owned-contact',
            solarMonth: 1,
            solarDay: 1,
          },
        })
      ).id;
      ownedGiftId = (
        await db.giftRecord.create({
          data: {
            userId: userId!,
            contactId: ownedContactId,
            name: 'test-owned-gift',
          },
        })
      ).id;
      for (const body of [{}, { password: '' }]) {
        const requestHeaders = sessionHeaders();
        requestHeaders.set('content-type', 'application/json');
        const response = await auth.handler(
          new Request(baseURL + '/api/auth/delete-user', {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(body),
          }),
        );
        expect(response.status).toBe(400);
        expect((await response.json()).code).toBe('PASSWORD_REQUIRED');
        expect(await db.user.count({ where: { id: userId! } })).toBe(1);
        expect(
          await db.contact.count({
            where: { id: ownedContactId, userId: userId! },
          }),
        ).toBe(1);
        expect(
          await db.giftRecord.count({
            where: { id: ownedGiftId, userId: userId! },
          }),
        ).toBe(1);
      }
    });
    it('lets Better Auth reject the wrong deletion password without removing owned data', async () => {
      const response = await auth.api.deleteUser({
        headers: sessionHeaders(),
        body: { password: 'Wrong-deletion-password' },
        asResponse: true,
      });
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe('INVALID_PASSWORD');
      expect(await db.user.count({ where: { id: userId! } })).toBe(1);
      expect(
        await db.contact.count({
          where: { id: ownedContactId, userId: userId! },
        }),
      ).toBe(1);
      expect(
        await db.giftRecord.count({
          where: { id: ownedGiftId, userId: userId! },
        }),
      ).toBe(1);
    });
    it('deletes the account and its owned fixtures only after validating the current password', async () => {
      const response = await auth.api.deleteUser({
        headers: sessionHeaders(),
        body: { password: newPassword },
        asResponse: true,
      });
      expect(response.status).toBe(200);
      expect(await db.user.count({ where: { id: userId! } })).toBe(0);
      expect(await db.contact.count({ where: { id: ownedContactId } })).toBe(0);
      expect(await db.giftRecord.count({ where: { id: ownedGiftId } })).toBe(0);
      expect(await db.account.count({ where: { userId: userId! } })).toBe(0);
      expect(await db.session.count({ where: { userId: userId! } })).toBe(0);
      expect(await db.emailLog.count({ where: { userId: userId! } })).toBe(0);
      expect(
        await auth.api.getSession({ headers: sessionHeaders() }),
      ).toBeNull();
    });
  });
}
