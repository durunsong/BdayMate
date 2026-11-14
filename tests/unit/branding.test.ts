import { expect, test } from 'vitest';
import { createElement } from 'react';
import { render } from '@react-email/render';
import { BrandedEmail } from '../../src/emails/branded';

test('transactional email includes the supplied logo with an absolute image URL and text fallback', async () => {
  const html = await render(
    createElement(BrandedEmail, { heading: '生日提醒', body: '测试内容' }),
  );
  expect(html).toMatch(
    new RegExp('<img[^>]+src="https?://[^"]+/brand/bdaymate-logo[.]png"'),
  );
  expect(html).toContain('alt="BdayMate 生日搭子"');
  expect(html).toContain('BdayMate · 生日搭子');
});

test('contact greeting footer does not imply that the recipient owns an account', async () => {
  const html = await render(
    createElement(BrandedEmail, {
      heading: '生日快乐',
      body: '祝福正文',
      footer: 'Contact the sender to stop future greetings.',
    }),
  );
  expect(html).toContain('Contact the sender to stop future greetings.');
  expect(html).not.toContain('来自你的 BdayMate 账户');
});
