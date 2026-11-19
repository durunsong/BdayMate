import { test, expect, registerAndVerify, CAPTURE_URL } from './fixtures';
import { readMail } from './mail-capture';

test('email code login validates input, handles errors and establishes a session', async ({
  page,
  account,
}) => {
  await registerAndVerify(page, account);
  await page.context().clearCookies();
  await page.goto('/login');
  await page
    .getByRole('button', { name: '邮箱验证码登录', exact: true })
    .click();
  await expect(page.getByLabel('密码', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(
    page.getByText('请输入有效的邮箱地址', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  const send = page.waitForResponse((response) =>
    response.url().endsWith('/email-otp/send-verification-otp'),
  );
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  expect((await send).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: /重新发送（\d+ 秒后）/ }),
  ).toBeDisabled();
  await page.getByLabel('邮箱验证码', { exact: true }).fill('123456');
  await page
    .getByLabel('邮箱地址', { exact: true })
    .fill('test-other@example.test');
  await expect(page.getByLabel('邮箱验证码', { exact: true })).toHaveValue('');
  await expect(page.locator('.validation-success')).toHaveCount(0);
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(
    page.getByText('请输入 6 位数字验证码', { exact: true }),
  ).toBeVisible();
  const messages = await readMail(CAPTURE_URL, account.email);
  const otp = messages
    .filter((mail) => mail.text.includes('登录验证码'))
    .at(-1)
    ?.text.match(/验证码[：:]\s*(\d{6})/)?.[1];
  expect(Boolean(otp)).toBe(true);
  await page
    .getByLabel('邮箱验证码', { exact: true })
    .fill(otp === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(
    page.getByText('验证码不正确或已失效，请重试或重新发送。', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '密码登录', exact: true }).click();
  await expect(page.getByLabel('密码', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: '邮箱验证码登录', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: /重新发送（\d+ 秒后）/ }),
  ).toBeDisabled();
  await expect(page.getByLabel('邮箱验证码', { exact: true })).toHaveValue('');
  await page.getByLabel('邮箱验证码', { exact: true }).fill(otp!);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '账户菜单', exact: true }),
  ).toBeVisible();
});

test('email code send recovers from rate limits and network errors without a false success', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByRole('button', { name: '邮箱验证码登录', exact: true })
    .click();
  await page
    .getByLabel('邮箱地址', { exact: true })
    .fill('test-unregistered@example.test');
  await page.route('**/email-otp/send-verification-otp', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Too many requests. Please try again later.',
      }),
    }),
  );
  await page.clock.install();
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(
    page.getByText('操作太频繁，请稍等一分钟后重试。', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /重新发送（\d+ 秒后）/ }),
  ).toBeDisabled();
  await page.clock.fastForward(61_000);
  await page.unroute('**/email-otp/send-verification-otp');
  await page.route('**/email-otp/send-verification-otp', (route) =>
    route.abort('failed'),
  );
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '发送验证码', exact: true }),
  ).toBeEnabled();
  await expect(page.locator('.validation-success')).toHaveCount(0);
});

test('first email proof by OTP can recover a password from account settings', async ({
  page,
  account,
}) => {
  const registered = await page.request.post('/api/auth/sign-up/email', {
    data: {
      email: account.email,
      password: account.password,
      name: '验证码首次验证',
    },
  });
  expect(registered.status()).toBe(200);
  account.id = (await registered.json()).user.id;
  await page.goto('/login');
  await page
    .getByRole('button', { name: '邮箱验证码登录', exact: true })
    .click();
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  const sent = page.waitForResponse((response) =>
    response.url().endsWith('/email-otp/send-verification-otp'),
  );
  await page.getByRole('button', { name: '发送验证码', exact: true }).click();
  expect((await sent).status()).toBe(200);
  const mail = (await readMail(CAPTURE_URL, account.email))
    .filter((item) => item.text.includes('登录验证码'))
    .at(-1);
  const otp = mail?.text.match(/验证码[：:]\s*(\d{6})/)?.[1];
  expect(Boolean(otp)).toBe(true);
  await page.getByLabel('邮箱验证码', { exact: true }).fill(otp!);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    await account.db.account.count({
      where: { userId: account.id, providerId: 'credential' },
    }),
  ).toBe(0);
  await page.goto('/settings');
  await page.getByRole('button', { name: '账户安全', exact: true }).click();
  const recovery = page.getByRole('button', {
    name: '通过邮件设置密码',
    exact: true,
  });
  await expect(recovery).toBeVisible();
  await recovery.click();
  await expect(
    page.getByText('密码设置邮件已发送，请检查收件箱和垃圾邮件。', {
      exact: true,
    }),
  ).toBeVisible();
  const link = (await readMail(CAPTURE_URL, account.email))
    .flatMap((item) => item.links)
    .find((url) => url.includes('/api/auth/reset-password/'));
  expect(Boolean(link)).toBe(true);
  await page.goto(link!);
  const newPassword = 'Otp-recovered-password-123!';
  await page.getByLabel('新密码', { exact: true }).fill(newPassword);
  await page.getByLabel('确认密码', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: '重置密码', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(
    await account.db.account.count({
      where: { userId: account.id, providerId: 'credential' },
    }),
  ).toBe(1);
});
