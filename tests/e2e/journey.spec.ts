import {
  test,
  expect,
  registerAndVerify,
  environment,
  CAPTURE_URL,
  type OwnedAccount,
} from './fixtures';
import { readMail } from './mail-capture';
import { localDate } from '../../src/services/birthday';

async function scopedCron(
  account: OwnedAccount,
  path: string,
  method: 'GET' | 'POST' = 'POST',
) {
  if (!account.id || !environment.CRON_SECRET)
    throw new Error('Scoped Cron test prerequisites are missing.');
  // Native fetch avoids persisting the Cron bearer in Playwright request traces/errors.
  const url = new URL('http://127.0.0.1:3100/api/cron/' + path);
  if (method === 'GET') url.searchParams.set('userId', account.id);
  const response = await fetch(url, {
    method,
    headers: {
      authorization: 'Bearer ' + environment.CRON_SECRET,
      'content-type': 'application/json',
    },
    ...(method === 'POST'
      ? { body: JSON.stringify({ userId: account.id }) }
      : {}),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  return response.json();
}

test('anonymous pages, exports and Cron remain protected', async ({
  page,
  request,
}) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  expect((await request.get('/api/export/contacts')).status()).toBe(401);
  for (const endpoint of ['generate-reminders', 'process-email-queue']) {
    expect((await request.get('/api/cron/' + endpoint)).status()).toBe(401);
  }
  expect(
    (
      await request.post('/api/cron/generate-reminders', {
        data: { userId: 'test-not-authorized' },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post('/api/cron/process-email-queue', {
        headers: { authorization: 'Bearer test-invalid' },
        data: { userId: 'test-not-authorized' },
      })
    ).status(),
  ).toBe(401);
});

test('register, verify, manage a birthday, deliver its reminder, import CSV and navigate mobile', async ({
  page,
  account,
}) => {
  await registerAndVerify(page, account);
  const today = localDate(new Date(), 'Asia/Shanghai');
  const [, month, day] = today.split('-');
  const name = '今天的生日朋友';
  await page.goto('/contacts/new');
  await page.getByLabel('姓名 *', { exact: true }).fill(name);
  await page
    .getByLabel('月份 *', { exact: true })
    .selectOption(String(Number(month)));
  await page
    .getByLabel('日期 *', { exact: true })
    .selectOption(String(Number(day)));
  await page
    .getByLabel('联系人邮箱', { exact: true })
    .fill('never-send-to-contact@example.test');
  await page.getByRole('button', { name: '保存联系人', exact: true }).click();
  await expect(page).toHaveURL(/\/contacts$/);
  await page.getByRole('link').filter({ hasText: name }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.getByLabel('使用全局提醒设置', { exact: true }).uncheck();
  await page.getByLabel('提前提醒天数', { exact: true }).fill('0');
  await page.getByLabel('提醒时间', { exact: true }).fill('00:00');
  await page
    .getByRole('button', { name: '保存此联系人的提醒', exact: true })
    .click();
  await expect(
    page.getByText('联系人提醒已更新', { exact: true }),
  ).toBeVisible();
  await page.goto('/reminders');
  await page.getByRole('button', { name: '同步未来提醒', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: '今天是 ' + name + ' 的生日',
      exact: true,
    }),
  ).toBeVisible();
  await scopedCron(account, 'generate-reminders', 'GET');
  await scopedCron(account, 'generate-reminders');
  await scopedCron(account, 'process-email-queue', 'GET');
  expect(await scopedCron(account, 'process-email-queue')).toMatchObject({
    processed: 0,
  });
  await expect
    .poll(async () =>
      account.db.emailLog.count({
        where: { userId: account.id!, template: 'BIRTHDAY', status: 'SENT' },
      }),
    )
    .toBe(1);
  const mail = await readMail(CAPTURE_URL, account.email);
  expect(mail.some((item) => item.text.includes(name))).toBe(true);
  expect(
    mail.every(
      (item) =>
        item.recipients.length === 1 && item.recipients[0] === account.email,
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: '邮件记录', exact: true }).click();
  const row = page
    .getByRole('row')
    .filter({ hasText: '今天是 ' + name + ' 的生日' });
  await expect(row.getByText('已发送', { exact: true })).toBeVisible();
  await expect(row.getByText(account.email, { exact: true })).toBeVisible();

  await page.goto('/contacts');
  await page.getByRole('button', { name: '导入', exact: true }).click();
  await page.getByLabel('CSV 文件', { exact: true }).setInputFiles({
    name: 'contacts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'name,birthdayType,solarMonth,solarDay,relationship\nCSV 朋友,SOLAR,6,15,FRIEND\n=SUM(1),SOLAR,7,1,FRIEND\n',
      'utf8',
    ),
  });
  await page.getByRole('button', { name: '开始导入', exact: true }).click();
  await expect(
    page.getByRole('link').filter({ hasText: 'CSV 朋友' }),
  ).toBeVisible();
  const exported = await page.request.get('/api/export/contacts');
  expect(exported.status()).toBe(200);
  const csv = await exported.text();
  expect(csv).toContain('CSV 朋友');
  expect(csv).toContain("'=SUM(1)");

  await page.goto('/dashboard');
  await expect(
    page.getByRole('heading', {
      name: '验收生日搭子，把在乎记在心上',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link').filter({ hasText: name }).first(),
  ).toBeVisible();
  const chart = page.getByRole('img', { name: /1月[0-9]+人/ });
  await expect(chart).toBeVisible();
  await expect
    .poll(() =>
      chart
        .locator('path.recharts-rectangle')
        .evaluateAll(
          (bars) =>
            bars.filter((bar) => bar.getBoundingClientRect().height > 1).length,
        ),
    )
    .toBe(new Set([Number(month), 6, 7]).size);
  await page.screenshot({
    path: '/tmp/bdaymate-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/contacts');
  await expect(
    page.getByRole('heading', { name: '重要的人，都在这里', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/bdaymate-mobile.png', fullPage: true });
  await page.getByRole('button', { name: '打开菜单', exact: true }).click();
  const navigation = page.getByRole('dialog', { name: '主导航', exact: true });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: '生日日历', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(navigation).not.toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test('password reset email opens a real UI flow and invalidates the former password', async ({
  page,
  account,
}) => {
  await registerAndVerify(page, account);
  await page.context().clearCookies();
  await page.goto('/forgot-password');
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  await page.getByRole('button', { name: '发送重置链接', exact: true }).click();
  await expect(
    page.getByText(
      '如果这个邮箱已注册，重置链接会发送到你的收件箱。请同时检查垃圾邮件文件夹。',
      { exact: true },
    ),
  ).toBeVisible();
  let resetLink = '';
  await expect
    .poll(async () => {
      resetLink =
        (await readMail(CAPTURE_URL, account.email))
          .flatMap((mail) => mail.links)
          .find((url) => url.includes('/api/auth/reset-password/')) || '';
      return Boolean(resetLink);
    })
    .toBe(true);
  await page.goto(resetLink);
  await page
    .getByLabel('新密码', { exact: true })
    .fill('Changed-password-456!');
  await page
    .getByLabel('确认密码', { exact: true })
    .fill('Changed-password-456!');
  await page.getByRole('button', { name: '重置密码', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
  await page.getByLabel('密码', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(
    page.getByText('邮箱或密码不正确，请检查后重试。', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('密码', { exact: true }).fill('Changed-password-456!');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
