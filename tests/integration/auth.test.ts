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
      expect(result.output).toContain('20 passed');
      console.info('Real authentication lifecycle: 20 checks passed.');
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
        await db.verification.deleteMany({
          where: { identifier: 'sign-in-otp-' + email },
        });
        await db.$disconnect();
      }
    });
    const otpIdentifier = 'sign-in-otp-' + email;
    const requestOTP = () =>
      auth.api.sendVerificationOTP({
        headers,
        body: { email, type: 'sign-in' },
        asResponse: true,
      });
    const readOTP = async () => {
      const mails = await readMail(process.env.BDAY_CAPTURE_URL!, email);
      const mail = mails
        .filter((item) => item.text.includes('登录验证码'))
        .at(-1);
      const code = mail?.text.match(/验证码[：:]\s*(\d{6})/)?.[1];
      expect(Boolean(code), 'SMTP delivered a six-digit login code').toBe(true);
      return code!;
    };
    const loginOTP = (otp: string) =>
      auth.api.signInEmailOTP({
        headers,
        body: { email, otp },
        asResponse: true,
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
    it('delivers a login code through SMTP without storing or logging it in plaintext', async () => {
      expect((await requestOTP()).status).toBe(200);
      const otp = await readOTP();
      const row = await db.verification.findFirstOrThrow({
        where: { identifier: otpIdentifier },
      });
      expect(row.value.includes(otp)).toBe(false);
      expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(240_000);
      expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(300_000);
      const logs = await db.emailLog.findMany({
        where: { userId, template: 'LOGIN_OTP' },
      });
      expect(logs).toHaveLength(1);
      expect(JSON.stringify(logs).includes(otp)).toBe(false);
    });
    it('rejects a wrong code then creates a session once, even for concurrent correct submissions', async () => {
      const otp = await readOTP();
      const wrong = otp === '000000' ? '111111' : '000000';
      const invalid = await loginOTP(wrong);
      expect(invalid.status).toBe(400);
      expect((await invalid.json()).code).toBe('INVALID_OTP');
      const responses = await Promise.all([loginOTP(otp), loginOTP(otp)]);
      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 400,
      ]);
      saveCookie(responses.find((response) => response.status === 200)!);
      expect(
        (await auth.api.getSession({ headers: sessionHeaders() }))?.user.id,
      ).toBe(userId);
      expect((await loginOTP(otp)).status).toBe(400);
    });
    it('rejects an expired code', async () => {
      expect((await requestOTP()).status).toBe(200);
      const otp = await readOTP();
      await db.verification.updateMany({
        where: { identifier: otpIdentifier },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const result = await loginOTP(otp);
      expect(result.status).toBe(400);
      expect((await result.json()).code).toBe('OTP_EXPIRED');
    });
    it('locks out a code after three wrong guesses', async () => {
      expect((await requestOTP()).status).toBe(200);
      const otp = await readOTP();
      const wrong = otp === '000000' ? '111111' : '000000';
      for (let attempt = 0; attempt < 3; attempt++)
        expect((await loginOTP(wrong)).status).toBe(400);
      const result = await loginOTP(otp);
      expect(result.status).toBe(403);
      expect((await result.json()).code).toBe('TOO_MANY_ATTEMPTS');
    });
    it('rotates a previous code on resend', async () => {
      expect((await requestOTP()).status).toBe(200);
      const oldRow = await db.verification.findFirstOrThrow({
        where: { identifier: otpIdentifier },
      });
      expect((await requestOTP()).status).toBe(200);
      const newRow = await db.verification.findFirstOrThrow({
        where: { identifier: otpIdentifier },
        orderBy: { createdAt: 'desc' },
      });
      expect(newRow.id).not.toBe(oldRow.id);
      expect((await loginOTP(await readOTP())).status).toBe(200);
      expect(
        await db.verification.count({ where: { identifier: otpIdentifier } }),
      ).toBe(0);
    });
    it('does not send mail or create an account for an unknown address', async () => {
      const unknown = 'test-unknown-' + randomUUID() + '@example.test';
      const result = await auth.api.sendVerificationOTP({
        headers,
        body: { email: unknown, type: 'sign-in' },
        asResponse: true,
      });
      expect(result.status).toBe(200);
      expect(
        await readMail(process.env.BDAY_CAPTURE_URL!, unknown),
      ).toHaveLength(0);
      expect(
        (
          await auth.api.signInEmailOTP({
            headers,
            body: { email: unknown, otp: '000000' },
            asResponse: true,
          })
        ).status,
      ).toBe(400);
      expect(await db.user.count({ where: { email: unknown } })).toBe(0);
      expect(
        await db.verification.count({
          where: { identifier: 'sign-in-otp-' + unknown },
        }),
      ).toBe(0);
    });
    it('limits HTTP sends and exposes no unused OTP authentication flows', async () => {
      const requestHeaders = {
        origin: baseURL,
        'content-type': 'application/json',
        'x-forwarded-for': '198.18.0.42',
      };
      const post = (path: string, body: object) =>
        auth.handler(
          new Request(baseURL + '/api/auth' + path, {
            method: 'POST',
            headers: requestHeaders,
            body: JSON.stringify(body),
          }),
        );
      for (let attempt = 0; attempt < 3; attempt++)
        expect(
          (
            await post('/email-otp/send-verification-otp', {
              email,
              type: 'sign-in',
            })
          ).status,
        ).toBe(200);
      expect(
        (
          await post('/email-otp/send-verification-otp', {
            email,
            type: 'sign-in',
          })
        ).status,
      ).toBe(429);
      await expect(
        auth.api.sendVerificationOTP({
          headers,
          body: { email, type: 'forget-password' },
          asResponse: true,
        }),
      ).rejects.toMatchObject({ status: 'BAD_REQUEST' });
      expect(
        (await post('/email-otp/request-password-reset', { email })).status,
      ).toBe(400);
    });
    it('reports SMTP delivery failure without returning a successful send', async () => {
      const { closeTransporter } = await import('../../src/services/email');
      const port = process.env.SMTP_PORT;
      closeTransporter();
      process.env.SMTP_PORT = '1';
      try {
        const result = await auth.handler(
          new Request(baseURL + '/api/auth/email-otp/send-verification-otp', {
            method: 'POST',
            headers: {
              origin: baseURL,
              'content-type': 'application/json',
              'x-forwarded-for': '198.18.0.43',
            },
            body: JSON.stringify({ email, type: 'sign-in' }),
          }),
        );
        expect(result.status).toBe(503);
        expect((await result.json()).code).toBe('OTP_DELIVERY_FAILED');
      } finally {
        closeTransporter();
        process.env.SMTP_PORT = port;
      }
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
