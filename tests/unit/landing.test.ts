import { beforeEach, expect, test, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Home from '../../src/app/page';

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock('@/lib/session', () => ({ currentUser }));
// Brand shares a module with authenticated navigation; isolate its server action.
vi.mock('@/app/actions', () => ({ performAction: vi.fn() }));

beforeEach(() => currentUser.mockResolvedValue(null));

test('public homepage renders a useful introduction and registration path without redirecting', async () => {
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain('<main');
  expect(html).toContain('href="/register"');
  expect(html).toContain('href="/login"');
  expect(html).toContain('aria-label="生日历法演示"');
  expect(html).toContain('aria-pressed="true"');
});

test('signed-in visitors can read the homepage and return directly to their dashboard', async () => {
  currentUser.mockResolvedValue({ id: 'verified-user', emailVerified: true });
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain('<main');
  expect(html).toContain('href="/dashboard"');
  expect(html).not.toContain('href="/register"');
  expect(html).not.toContain('href="/login"');
});
