import { test, expect } from '@playwright/test';

test('themes persist, follow the system and keep mobile forms readable', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/login');
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '夜色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const other = await context.newPage();
  await other.goto('/login');
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitemradio', { name: '日光', exact: true }).click();
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'light');
  await other.close();
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page
    .getByRole('menuitemradio', { name: '跟随系统', exact: true })
    .click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const colors = await page
    .locator('.input')
    .first()
    .evaluate((el) => ({
      fg: getComputedStyle(el).color,
      bg: getComputedStyle(el).backgroundColor,
    }));
  expect(colors.bg).not.toBe('rgb(255, 255, 255)');
  expect(colors.fg).not.toBe(colors.bg);
});

test('loading buttons keep spinner, label and arrow aligned on one line', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/sign-in/email', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/login');
  await page
    .getByLabel('邮箱地址', { exact: true })
    .fill('layout-check@example.test');
  await page.getByLabel('密码', { exact: true }).fill('not-a-real-password');
  const button = page.getByRole('button', { name: '登录', exact: true });
  try {
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    const centers = await button.locator('svg').evaluateAll((icons) =>
      icons.map((icon) => {
        const r = icon.getBoundingClientRect();
        return r.y + r.height / 2;
      }),
    );
    expect(centers.length).toBe(2);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
    expect((await button.boundingBox())!.height).toBeLessThan(56);
  } finally {
    release();
  }
  await expect(button).toBeEnabled();
});

test('top route progress covers a delayed navigation and then clears', async ({
  page,
}) => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/register?*', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/login');
  try {
    const click = page
      .getByRole('link', { name: '创建一个', exact: true })
      .click();
    await expect(
      page.getByRole('progressbar', { name: '正在打开页面' }),
    ).toBeVisible();
    release();
    await click;
    await expect(page).toHaveURL(/\/register$/);
    await expect(
      page.getByRole('heading', {
        name: '从今天，记住每一份在乎',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole('progressbar', { name: '正在打开页面' }),
    ).toBeHidden();
  } finally {
    release();
  }
});

import { test as accountTest, registerAndVerify } from './fixtures';
accountTest(
  'CSV downloads do not leave a navigation progress bar running',
  async ({ page, account }) => {
    await registerAndVerify(page, account);
    await page.goto('/contacts');
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: '导出', exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
    await expect(
      page.getByRole('progressbar', { name: '正在打开页面' }),
    ).toBeHidden({ timeout: 1500 });
  },
);

accountTest(
  'sign-in keeps route progress visible while the workspace loads',
  async ({ page, account }) => {
    await registerAndVerify(page, account);
    await page.context().clearCookies();
    await page.goto('/login');
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/dashboard?*', async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByLabel('邮箱地址', { exact: true }).fill(account.email);
    await page.getByLabel('密码', { exact: true }).fill(account.password);
    try {
      await page.getByRole('button', { name: '登录', exact: true }).click();
      await expect(
        page.getByRole('progressbar', { name: '正在打开页面' }),
      ).toBeVisible({ timeout: 5000 });
      release();
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(
        page.getByRole('progressbar', { name: '正在打开页面' }),
      ).toBeHidden();
    } finally {
      release();
    }
  },
);
