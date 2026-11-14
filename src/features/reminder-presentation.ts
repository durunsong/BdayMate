export const statusLabels: Record<string, string> = {
  PENDING: '等待发送',
  PROCESSING: '发送中',
  SENT: '已发送',
  FAILED: '发送失败',
  CANCELLED: '已失效',
  UNCERTAIN: '需核实',
  AMBIGUOUS: '需核实',
};
type QueueStatus = {
  status: string;
  lastError: string | null;
  attemptCount: number;
};
export function reminderPresentation(item: QueueStatus): {
  label: string;
  canRetry: boolean;
  guidance: string | null;
  tone: 'success' | 'danger' | 'primary' | 'warm' | 'neutral';
} {
  if (item.lastError?.startsWith('CANCELLED:'))
    return {
      label: '已失效',
      canRetry: false,
      tone: 'neutral',
      guidance: '生日或提醒规则已变更，原提醒不再发送。',
    };
  if (item.lastError?.startsWith('DELIVERY_UNCERTAIN:'))
    return {
      label: '需核实',
      canRetry: false,
      tone: 'warm',
      guidance:
        '邮件可能已送达。请先核实邮件服务商的投递日志，避免重复发送；此任务不会自动重试。',
    };
  if (item.status === 'FAILED' && item.attemptCount >= 5)
    return {
      label: '发送失败',
      canRetry: false,
      tone: 'danger',
      guidance: '已达到 5 次尝试上限，请检查邮件通道配置与发送日志。',
    };
  return {
    label: statusLabels[item.status] ?? item.status,
    canRetry: item.status === 'FAILED',
    guidance: null,
    tone:
      item.status === 'SENT'
        ? 'success'
        : item.status === 'FAILED'
          ? 'danger'
          : 'primary',
  };
}
