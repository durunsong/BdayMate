import { test, expect, registerAndVerify } from './fixtures';

test('greeting drafts stay editable, preview safely and only save on explicit submission', async ({
  page,
  account,
}) => {
  await registerAndVerify(page, account);
  const savedMessage =
    '我们的下一次见面，值得好好期待。\n生日快乐，老朋友 <一起去旅行>！';
  const contact = await account.db.contact.create({
    data: {
      userId: account.id!,
      name: '祝福预览朋友',
      email: 'preview-friend@example.test',
      solarMonth: 6,
      solarDay: 15,
      notes: '只给自己看的私人备注',
    },
  });
  await account.db.contactGreetingSetting.create({
    data: {
      userId: account.id!,
      contactId: contact.id,
      enabled: false,
      sendTime: '08:35',
      message: savedMessage,
    },
  });
  await page.goto('/contacts/' + contact.id);
  const greeting = page.getByRole('form', {
    name: '自动生日祝福',
    exact: true,
  });
  const editor = greeting.getByLabel('生日祝福内容', { exact: true });
  const preview = greeting.getByRole('region', { name: '生日邮件预览' });
  const previewBody = preview.locator('.greeting-letter-body');
  const toggle = greeting.getByRole('switch', { name: '开启自动生日祝福' });
  await expect(editor).toHaveValue(savedMessage);
  await expect(editor).toHaveAttribute('maxlength', '3000');
  await expect(preview).toContainText('仅供预览');
  await expect(preview).not.toContainText('只给自己看的私人备注');
  expect(await previewBody.textContent()).toBe(savedMessage);
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  await greeting.getByRole('button', { name: '使用俏皮庆生模板' }).click();
  await expect(editor).toHaveValue(/今日主角/);
  await expect(previewBody).toContainText('今日主角');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  const unsavedSetting = await account.db.contactGreetingSetting.findUnique({
    where: { contactId: contact.id },
  });
  expect(unsavedSetting?.message).toBe(savedMessage);
  expect(unsavedSetting?.enabled).toBe(false);

  const customMessage = '  今日快乐加倍！\n\n愿你一直做自己喜欢的自己。  ';
  await editor.fill(customMessage);
  expect(await previewBody.textContent()).toBe(customMessage.trim());
  await expect(
    greeting.getByRole('button', { name: '使用俏皮庆生模板' }),
  ).toHaveAttribute('aria-pressed', 'false');
  await greeting
    .getByRole('button', { name: '保存生日祝福设置', exact: true })
    .click();
  await expect(greeting.getByRole('status')).toContainText(
    '生日祝福设置已保存',
  );
  await page.reload();
  await expect(editor).toHaveValue(customMessage.trim());
  expect(await previewBody.textContent()).toBe(customMessage.trim());
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(
    greeting.getByLabel('祝福发送时间', { exact: true }),
  ).toHaveValue('08:35');

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      // Wait for the responsive CSS breakpoint, independently of overflow.
      const mobileMenu = page.getByRole('button', {
        name: '打开菜单',
        exact: true,
      });
      if (viewport.width <= 767) await expect(mobileMenu).toBeVisible();
      else await expect(mobileMenu).toBeHidden();
      await expect(page.locator('.app-body')).toHaveCSS(
        'margin-left',
        viewport.width <= 767 ? '0px' : '234px',
      );
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        mobileMedia: window.matchMedia('(max-width: 767px)').matches,
        bodyMargin: getComputedStyle(document.querySelector('.app-body')!)
          .marginLeft,
        elements: Array.from(document.querySelectorAll('*'))
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              class: element.getAttribute('class') || '',
              right: Math.round(rect.right * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
            };
          })
          .filter(
            (element) => element.width > 0 && element.right > window.innerWidth,
          )
          .sort((a, b) => b.right - a.right),
      }));
      expect(
        overflow.scrollWidth,
        JSON.stringify({ colorScheme, viewport, ...overflow }, null, 2),
      ).toBeLessThanOrEqual(overflow.innerWidth);
      await greeting.screenshot({
        path:
          '/tmp/bdaymate-greeting-editor-' +
          colorScheme +
          '-' +
          viewport.width +
          '.png',
        animations: 'disabled',
      });
    }
  }
});
