import { randomInt, randomUUID } from 'node:crypto';
import { config } from 'dotenv';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
import { test as base, expect, type Page } from '@playwright/test';
import { PrismaClient } from '../../src/generated/prisma/client';
import { readMail } from './mail-capture';

export const environment = { ...process.env };
config({ processEnv: environment, quiet: true });
export const APP_URL = 'http://127.0.0.1:3100';
export const CAPTURE_URL = 'http://127.0.0.1:3101';
export type OwnedAccount = {
  email: string;
  password: string;
  id?: string;
  db: PrismaClient;
};

export const test = base.extend<{ account: OwnedAccount }>({
  account: async ({ context }, runFixture) => {
    // Independent simulated visitors keep the real auth limiter enabled without
    // charging every isolated browser account to the same localhost address.
    await context.setExtraHTTPHeaders({
      'x-forwarded-for': '198.18.' + randomInt(256) + '.' + randomInt(1, 255),
    });
    const email = 'test-e2e-' + randomUUID() + '@example.test';
    const connectionString = environment.DATABASE_URL;
    if (!connectionString)
      throw new Error('E2E database configuration is missing.');
    const adapter = new URL(connectionString).hostname.endsWith('.neon.tech')
      ? new PrismaNeon({ connectionString })
      : new PrismaPg({ connectionString });
    const db = new PrismaClient({ adapter, log: [] });
    const account: OwnedAccount = { email, password: 'Test-password-123!', db };
    try {
      await runFixture(account);
    } finally {
      // Discover only this test's unpredictable address if the signup response failed after persistence.
      const created = await db.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (created) {
        if (account.id && account.id !== created.id)
          throw new Error('Test cleanup ownership mismatch.');
        account.id = created.id;
        const rows = await db.verification.findMany({
          where: { value: account.id },
          select: { identifier: true },
        });
        const identifiers = rows.map((row) => row.identifier);
        if (identifiers.length)
          await db.verification.deleteMany({
            where: { identifier: { in: identifiers }, value: account.id },
          });
        await db.user.deleteMany({ where: { id: account.id, email } });
      }
      await db.verification.deleteMany({
        where: { identifier: 'sign-in-otp-' + email },
      });
      await db.$disconnect();
    }
  },
});
export { expect };

export async function registerAndVerify(page: Page, account: OwnedAccount) {
  await page.goto('/register');
  await page.getByLabel('昵称', { exact: true }).fill('验收生日搭子');
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByLabel('确认密码', { exact: true }).fill(account.password);
  const registered = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/sign-up/email') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '创建账户', exact: true }).click();
  const response = await registered;
  expect(response.status()).toBe(200);
  const body = await response.json();
  account.id = body.user.id as string;
  await expect(
    page.getByRole('heading', { name: '确认是你的邮箱', exact: true }),
  ).toBeVisible();
  let verificationLink = '';
  await expect
    .poll(async () => {
      verificationLink =
        (await readMail(CAPTURE_URL, account.email))
          .flatMap((mail) => mail.links)
          .find((url) => url.includes('/verify-email?')) || '';
      return Boolean(verificationLink);
    })
    .toBe(true);
  if (new URL(verificationLink).origin !== APP_URL)
    throw new Error(
      'Verification email origin differs from the local test server.',
    );
  await page.goto(verificationLink);
  await expect(
    page.getByRole('heading', { name: '邮箱验证成功', exact: true }),
  ).toBeVisible();
  await page.context().clearCookies();
  await login(page, account);
}

export async function login(page: Page, account: OwnedAccount) {
  await page.goto('/login');
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole('button', { name: '账户菜单', exact: true }),
  ).toBeVisible();
}
