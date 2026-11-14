import { test, expect, registerAndVerify } from './fixtures';

test('business surfaces and dialogs stay within the viewport in both themes', async ({
  page,
  account,
}, testInfo) => {
  test.setTimeout(180_000);
  await registerAndVerify(page, account);
  const routes = [
    '/dashboard',
    '/contacts',
    '/contacts/new',
    '/calendar',
    '/groups',
    '/wishes',
    '/reminders',
    '/settings',
  ];
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator('.page-heading')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'data-theme',
          colorScheme,
        );
        const size = await page.evaluate(() => ({
          actual: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
        expect(
          size.actual,
          route + ' / ' + colorScheme + ' / ' + width,
        ).toBeLessThanOrEqual(size.viewport);
        if (route === '/groups') {
          await page
            .getByRole('button', { name: '创建标签', exact: true })
            .click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toBeVisible();
          const box = await dialog.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
          const close = dialog.getByRole('button', {
            name: '关闭',
            exact: true,
          });
          await expect(close).toHaveCSS('position', 'absolute');
          const closeBox = await close.boundingBox();
          expect(closeBox!.y - box!.y).toBeLessThan(30);
          expect(
            box!.x + box!.width - closeBox!.x - closeBox!.width,
          ).toBeLessThan(30);
        }
        await page.screenshot({
          path: testInfo.outputPath(
            route.replaceAll('/', '_') +
              '-' +
              colorScheme +
              '-' +
              width +
              '.png',
          ),
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  }
});
