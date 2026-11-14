import { z } from 'zod';
import { DomainError } from './errors';
export function smtpConfig() {
  const host = process.env.SMTP_HOST || '';
  const from = process.env.SMTP_FROM || '';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE !== 'false';
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (
    !host ||
    host === 'xxxx' ||
    !z.email().safeParse(from).success ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    throw new DomainError('SMTP 尚未配置，请管理员填写邮件服务参数', 503);
  if (!local && (!user || !pass || user === 'xxxx' || pass === 'xxxx'))
    throw new DomainError('SMTP 身份凭据尚未配置', 503);
  return {
    host,
    port,
    secure,
    requireTLS: !local && !secure,
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' as const },
    auth: user && pass && user !== 'xxxx' ? { user, pass } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    pool: true as const,
    maxConnections: 3,
    from: { name: process.env.SMTP_FROM_NAME || 'BdayMate', address: from },
  };
}
export function smtpConfigured() {
  try {
    smtpConfig();
    return true;
  } catch {
    return false;
  }
}
