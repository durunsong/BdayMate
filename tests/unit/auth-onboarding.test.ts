import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { AuthForm } from '../../src/features/auth';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/components/app-shell', () => ({ Brand: () => null }));

test('verification names the destination and links only to a known inbox provider', () => {
  const html = renderToStaticMarkup(
    createElement(AuthForm, { mode: 'verify', email: 'person@gmail.com' }),
  );
  expect(html).toContain('href="https://mail.google.com/"');
  expect(html).toContain('person@gmail.com');
  expect(html).toContain('我已点击验证，检查状态');
});

test('unknown email domains do not become untrusted inbox links', () => {
  const html = renderToStaticMarkup(
    createElement(AuthForm, {
      mode: 'verify',
      email: 'person@gmail.com.attacker.test',
    }),
  );
  expect(html).not.toMatch(/href="https?:\/\/[^" ]*attacker/);
  expect(html).toContain('打开你的邮箱应用');
});
