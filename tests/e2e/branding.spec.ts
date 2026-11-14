import { test, expect } from '@playwright/test';

test('the supplied brand is visible on desktop and mobile without overflow', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    const brand = page.locator('.brand:visible');
    await expect(brand).toHaveAccessibleName('BdayMate 生日搭子首页');
    const logo = brand.locator('img');
    await expect(logo).toBeVisible();
    expect(
      decodeURIComponent((await logo.getAttribute('src')) ?? ''),
    ).toContain('/brand/bdaymate-logo.png');
    await expect
      .poll(() =>
        logo.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('browser, Apple, app and sharing icons resolve to real branded assets', async ({
  page,
  request,
}) => {
  await page.goto('/login');
  await expect(
    page.locator('link[rel="icon"][href^="/favicon.ico"]'),
  ).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'sizes',
    '180x180',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(1);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );
  const iconLinks = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href),
    );
  for (const url of iconLinks) {
    const response = await request.get(url);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/');
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  const favicon = await request.get('/favicon.ico');
  const header = await favicon.body();
  expect(header.readUInt16LE(2)).toBe(1);
  expect(header.readUInt16LE(4)).toBeGreaterThanOrEqual(3);
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href');
  expect(manifestUrl).toBeTruthy();
  const manifest = await (await request.get(manifestUrl!)).json();
  expect(manifest.name).toBe('BdayMate · 生日搭子');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).ok()).toBe(true);
  const shareUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute('content');
  const share = await request.get(shareUrl!);
  expect(share.ok()).toBe(true);
  expect(share.headers()['content-type']).toContain('image/png');
});
