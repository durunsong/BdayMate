import { afterEach, describe, expect, it, vi } from 'vitest';
import { smtpConfig } from '../../src/lib/email-config';
afterEach(() => vi.unstubAllEnvs());
describe('SMTP boundary', () => {
  it('rejects placeholder credentials instead of claiming delivery', () => {
    vi.stubEnv('SMTP_HOST', 'xxxx');
    expect(() => smtpConfig()).toThrow('SMTP');
  });
  it('requires TLS and certificate validation for nonlocal delivery', () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_SECURE', 'false');
    vi.stubEnv('SMTP_USER', 'sender');
    vi.stubEnv('SMTP_PASS', 'password');
    vi.stubEnv('SMTP_FROM', 'sender@example.com');
    const c = smtpConfig();
    expect(c.requireTLS).toBe(true);
    expect(c.tls.rejectUnauthorized).toBe(true);
    expect(c.secure).toBe(false);
  });
});
