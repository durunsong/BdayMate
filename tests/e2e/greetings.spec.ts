import { test, expect, registerAndVerify } from './fixtures';

test('contact birthday greetings require an email and retain independent opt-in settings', async ({
  page,
  account,
}) => {
  await registerAndVerify(page, account);
  await account.db.reminderPreference.upsert({
    where: { userId: account.id! },
    create: { userId: account.id!, emailEnabled: false },
    update: { emailEnabled: false },
  });
  const contact = await account.db.contact.create({
    data: {
      userId: account.id!,
      name: '自动祝福朋友',
      birthdayType: 'LUNAR',
      lunarMonth: 6,
      lunarDay: 15,
      relationship: 'FRIEND',
    },
  });
  await page.goto(`/contacts/${contact.id}`);
  const greeting = page.getByRole('form', {
    name: '自动生日祝福',
    exact: true,
  });
  const toggle = greeting.getByRole('switch', { name: '开启自动生日祝福' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(toggle).toBeDisabled();
  await expect(
    greeting.getByLabel('祝福发送时间', { exact: true }),
  ).toHaveValue('09:00');
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await greeting.screenshot({
      path: `/tmp/bdaymate-greeting-missing-email-${viewport.width}.png`,
      animations: 'disabled',
    });
  }
  await greeting
    .getByRole('link', { name: '填写联系人邮箱', exact: true })
    .click();
  const recipient = `birthday-${account.email}`;
  await page.getByLabel('联系人邮箱', { exact: true }).fill(recipient);
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contact.id}$`));
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(greeting.getByText(recipient, { exact: true })).toBeVisible();
  await expect(
    greeting.getByText('Asia/Shanghai', { exact: true }),
  ).toBeVisible();
  await expect(greeting.getByText(/每年按农历生日/)).toBeVisible();
  await toggle.click();
  await greeting.getByLabel('祝福发送时间', { exact: true }).fill('08:35');
  await greeting.getByLabel('生日祝福内容', { exact: true }).fill('   ');
  await greeting
    .getByRole('button', { name: '保存生日祝福设置', exact: true })
    .click();
  await expect(greeting.getByRole('alert')).toContainText(
    '请输入 1–3000 字的生日祝福',
  );
  await greeting
    .getByLabel('生日祝福内容', { exact: true })
    .fill('  愿你的新一岁平安喜乐！  ');
  await greeting
    .getByRole('button', { name: '保存生日祝福设置', exact: true })
    .click();
  await expect(greeting.getByRole('status')).toContainText(
    '生日祝福设置已保存',
  );
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(
    greeting.getByLabel('祝福发送时间', { exact: true }),
  ).toHaveValue('08:35');
  await expect(
    greeting.getByLabel('生日祝福内容', { exact: true }),
  ).toHaveValue('愿你的新一岁平安喜乐！');
  expect(
    (
      await account.db.reminderPreference.findUnique({
        where: { userId: account.id! },
      })
    )?.emailEnabled,
  ).toBe(false);
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      greeting.getByRole('button', { name: '保存生日祝福设置', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
    });
    await page.screenshot({
      path: `/tmp/bdaymate-greetings-${viewport.width}.png`,
      fullPage: false,
      animations: 'disabled',
    });
    await greeting.screenshot({
      path: `/tmp/bdaymate-greeting-form-${viewport.width}.png`,
      animations: 'disabled',
    });
  }
  await toggle.click();
  await greeting
    .getByRole('button', { name: '保存生日祝福设置', exact: true })
    .click();
  await expect(greeting.getByRole('status')).toContainText(
    '生日祝福设置已保存',
  );
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await greeting
    .getByRole('button', { name: '保存生日祝福设置', exact: true })
    .click();
  await expect(greeting.getByRole('status')).toContainText(
    '生日祝福设置已保存',
  );
  await page.getByRole('button', { name: '归档', exact: true }).click();
  await expect(
    page.getByText('这位联系人已归档', { exact: true }),
  ).toBeVisible();
  await expect(toggle).toBeDisabled();
  await expect(greeting.getByText(/已归档，自动祝福已暂停/)).toBeVisible();
});
