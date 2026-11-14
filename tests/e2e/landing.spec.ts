import { test, expect } from '@playwright/test';

test('public homepage offers a working calendar demo, motion control and registration', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('把在乎');
  await expect(page.locator('.landing-header .brand')).toHaveAttribute(
    'href',
    '/',
  );
  await page.getByRole('button', { name: '农历生日', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '农历生日', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.landing-demo-date')).toContainText(
    '每年重新换算对应的公历日期',
  );
  await page.getByRole('button', { name: '公历生日', exact: true }).click();
  await expect(page.locator('.landing-demo-date')).toContainText(
    '每年，同一个月，同一天',
  );
  await page.getByRole('button', { name: '暂停装饰动效' }).click();
  await expect(page.locator('.landing')).toHaveAttribute(
    'data-motion',
    'paused',
  );
  await expect(page.locator('.landing-orbit-traveler')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
  await page.getByRole('link', { name: '开始记住重要的人' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('pausing ambient motion does not freeze newly revealed content or calendar changes', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '暂停装饰动效' }).click();
  await page.getByRole('button', { name: '农历生日', exact: true }).click();
  await expect(page.locator('.landing-demo')).toHaveClass(/is-in-view/);
  await expect(page.locator('.landing-demo .landing-section-copy')).toHaveCSS(
    'opacity',
    '1',
  );
  await expect(page.locator('.landing-demo-date > strong')).toHaveCSS(
    'opacity',
    '1',
  );
  await page.locator('.landing-ritual-copy').scrollIntoViewIfNeeded();
  await expect(page.locator('.landing-ritual')).toHaveClass(/is-in-view/);
  await expect(page.locator('.landing-ritual-copy')).toHaveCSS('opacity', '1');
  await expect(page.locator('.landing-feature-line').first()).toHaveCSS(
    'opacity',
    '1',
  );
  await expect(page.locator('.landing-orbit-traveler')).toHaveCSS(
    'animation-play-state',
    'paused',
  );
});

test('homepage remains readable on mobile with reduced motion and no horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.landing-orbit-traveler')).toHaveCSS(
    'animation-name',
    'none',
  );
  await expect(
    page.getByRole('link', { name: '开始记住重要的人' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '农历生日', exact: true }).click();
  await expect(page.locator('.landing-demo-date')).toContainText('八月');
  await expect(page.locator('.landing-demo-date')).toContainText('十五');
});
