import {
  test,
  expect,
  APP_URL,
  CAPTURE_URL,
  registerAndVerify,
} from './fixtures';
import { readMail } from './mail-capture';

test('signup explains inbox verification, resend recovers, and real mail verifies the account', async ({
  page,
  account,
}) => {
  await page.clock.install();
  await page.goto('/register');
  await page.getByLabel('昵称', { exact: true }).fill('生日搭子引导验收');
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
  account.id = (await response.json()).user.id;
  await expect(
    page.getByRole('heading', { name: '确认是你的邮箱', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.auth-destination')).toContainText(account.email);
  await expect(
    page.getByText('点击邮件里的「验证邮箱」', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /重新发送（\d+ 秒后）/ }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: '我已点击验证，检查状态', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('还没有确认到验证结果');
  await expect(
    page.getByRole('heading', { name: '邮箱验证成功', exact: true }),
  ).toHaveCount(0);

  // The completed session check confirms hydration before simulating a background tab.
  // Cooldown must follow elapsed time, even when browser timers are suspended.
  await page.clock.fastForward(61_000);
  const resend = page.getByRole('button', {
    name: '重新发送验证邮件',
    exact: true,
  });
  await expect(resend).toBeEnabled();
  await page.route(
    '**/api/auth/send-verification-email',
    (route) => route.abort(),
    { times: 1 },
  );
  await resend.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(resend).toBeEnabled();
  await resend.click();
  await expect(page.locator('.validation-success')).toContainText(
    '新的验证链接',
  );
  await expect(
    page.getByRole('button', { name: /重新发送（\d+ 秒后）/ }),
  ).toBeDisabled();
  await page.clock.resume();

  let verificationLink = '';
  await expect
    .poll(async () => {
      verificationLink =
        (await readMail(CAPTURE_URL, account.email))
          .flatMap((mail) => mail.links)
          .find((url) => url.includes('/api/auth/verify-email?')) || '';
      return Boolean(verificationLink);
    })
    .toBe(true);
  expect(new URL(verificationLink).origin).toBe(APP_URL);
  const callbackPage = await page.context().newPage();
  await callbackPage.goto(verificationLink);
  await expect(
    callbackPage.getByRole('heading', { name: '邮箱验证成功', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: '我已点击验证，检查状态', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: '邮箱验证成功', exact: true }),
  ).toBeVisible();
  await callbackPage.close();
  await page.getByRole('link', { name: '进入生日搭子' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('verified accounts skip guest-only pages while verification and reset callbacks remain usable', async ({
  page,
  account,
}) => {
  await registerAndVerify(page, account);
  for (const route of ['/login', '/register', '/forgot-password']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await page.goto('/verify-email');
  await expect(
    page.getByRole('heading', { name: '邮箱验证成功', exact: true }),
  ).toBeVisible();
  const reset = await page.request.post('/api/auth/request-password-reset', {
    data: { email: account.email, redirectTo: APP_URL + '/reset-password' },
    headers: { Origin: APP_URL },
  });
  expect(reset.ok()).toBe(true);
  const link = (await readMail(CAPTURE_URL, account.email))
    .flatMap((mail) => mail.links)
    .find((url) => url.includes('/api/auth/reset-password/'));
  expect(link).toBeTruthy();
  expect(new URL(link!).origin).toBe(APP_URL);
  await page.goto(link!);
  await expect(
    page.getByRole('heading', { name: '设置一个新密码', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('新密码', { exact: true })).toBeVisible();
});

test('query flags cannot pretend verification and only known providers get inbox links', async ({
  page,
}) => {
  await page.goto('/verify-email?verified=1&email=person%40gmail.com');
  await expect(
    page.getByRole('heading', { name: '确认是你的邮箱', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: '邮箱验证成功', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: '前往 Gmail 收件箱' }),
  ).toHaveAttribute('href', 'https://mail.google.com/');
  await page.goto('/verify-email?email=person%40gmail.com.attacker.test');
  await expect(
    page.getByText('打开你的邮箱应用，完成上面两个小步骤。'),
  ).toBeVisible();
  await expect(page.locator('a[href^="https://mail.google.com"]')).toHaveCount(
    0,
  );
});
