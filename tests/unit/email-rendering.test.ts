import { expect, test } from 'vitest';
import { createElement } from 'react';
import { render } from '@react-email/render';
import { BrandedEmail } from '../../src/emails/branded';

test('a transactional CTA also exposes a copyable fallback URL', async () => {
  const url = 'https://example.test/verify-email?token=isolated-test';
  const html = await render(
    createElement(BrandedEmail, {
      heading: '确认邮箱',
      body: '请确认你的邮箱。',
      url,
      buttonLabel: '验证邮箱',
    }),
  );
  expect(html).toContain(
    '>https://example.test/verify-email?token=isolated-test</a>',
  );
  expect(html).toContain('验证邮箱');
});

test('custom letter text keeps line breaks and escapes HTML in mail clients', async () => {
  const html = await render(
    createElement(BrandedEmail, {
      heading: '生日快乐',
      body: '第一行\n<script>not executable</script>\n第三行',
      footer: '联系发送者管理生日祝福。',
    }),
  );
  expect(html).toMatch(/第一行<br\s*\/?>(?:<!-- -->)?&lt;script&gt;/);
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('来自你的 BdayMate 账户');
});
