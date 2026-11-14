import { beforeEach, expect, test, vi } from 'vitest';
import LoginPage from '../../src/app/(auth)/login/page';
import RegisterPage from '../../src/app/(auth)/register/page';
import ForgotPasswordPage from '../../src/app/(auth)/forgot-password/page';
import ResetPasswordPage from '../../src/app/(auth)/reset-password/page';
import VerifyEmailPage from '../../src/app/(auth)/verify-email/page';

const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
vi.mock('@/lib/session', () => ({ currentUser }));
vi.mock('@/features/auth', () => ({ AuthForm: () => null }));
beforeEach(() => currentUser.mockResolvedValue(null));

test.each([
  ['login', LoginPage],
  ['register', RegisterPage],
  ['forgot-password', ForgotPasswordPage],
] as const)(
  '%s redirects a verified account to its dashboard',
  async (_route, Page) => {
    currentUser.mockResolvedValue({
      id: 'verified-account',
      emailVerified: true,
    });
    await expect(Promise.resolve().then(() => Page())).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/dashboard;307;',
    });
  },
);

test.each([
  ['login', LoginPage],
  ['register', RegisterPage],
  ['forgot-password', ForgotPasswordPage],
] as const)(
  '%s keeps the form available without a verified session',
  async (_route, Page) => {
    expect(await Page()).toBeTruthy();
  },
);

test('verification reads confirmed session state without a success query parameter', async () => {
  currentUser.mockResolvedValue({
    id: 'verified-account',
    emailVerified: true,
  });
  const page = await VerifyEmailPage({ searchParams: Promise.resolve({}) });
  expect(page.props.verified).toBe(true);
});

test('a success query parameter cannot verify an unauthenticated visitor', async () => {
  const page = await VerifyEmailPage({
    searchParams: Promise.resolve({ verified: '1' }),
  });
  expect(page.props.verified).toBe(false);
});

test('a signed-in visitor can still use a password reset token', async () => {
  currentUser.mockResolvedValue({
    id: 'verified-account',
    emailVerified: true,
  });
  const page = await ResetPasswordPage({
    searchParams: Promise.resolve({ token: 'reset-token' }),
  });
  expect(page.props.token).toBe('reset-token');
});
