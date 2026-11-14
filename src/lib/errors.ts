export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
export function safeError(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  const descriptions: Record<string, string> = {
    EAUTH: 'SMTP 身份验证失败，请检查账号配置',
    ECONNECTION: 'SMTP 连接失败，请检查主机和端口',
    ECONNREFUSED: 'SMTP 连接被拒绝',
    ETIMEDOUT: 'SMTP 连接超时',
    ESOCKET: 'SMTP 连接中断',
    EENVELOPE: 'SMTP 拒绝收件地址',
    EMESSAGE: 'SMTP 拒绝邮件内容',
    P2002: '记录已存在，请检查重复数据',
    P2025: '记录不存在或无权访问',
  };
  return descriptions[code] || '操作未完成，请稍后重试或联系管理员检查服务配置';
}
