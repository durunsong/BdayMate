'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  Save,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeading,
  Panel,
  Select,
} from '@/components/ui';
import type { ContactDTO, Workspace } from '@/lib/types';
import { useAction } from '@/features/use-action';
import { parseReminderDays } from '@/features/validation';
import {
  reminderPresentation,
  statusLabels,
} from '@/features/reminder-presentation';
export function TimeZoneField({
  defaultValue,
  id = 'timeZone',
}: {
  defaultValue: string;
  id?: string;
}) {
  return (
    <Field id={id} label="时区" hint="生日日期和提醒时间都会按这个时区计算">
      <Input
        id={id}
        name="timeZone"
        list={`${id}-options`}
        required
        defaultValue={defaultValue}
        placeholder="Asia/Shanghai"
      />
      <datalist id={`${id}-options`}>
        {[
          'Asia/Shanghai',
          'Asia/Hong_Kong',
          'Asia/Tokyo',
          'Asia/Singapore',
          'America/Los_Angeles',
          'America/New_York',
          'Europe/London',
          'Europe/Paris',
          'Australia/Sydney',
          'Pacific/Auckland',
          'UTC',
        ].map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </Field>
  );
}
export function PreferencesForm({ workspace }: { workspace: Workspace }) {
  const [enabled, setEnabled] = useState(workspace.preference.emailEnabled);
  const { run, pending } = useAction();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const daysBefore = parseReminderDays(String(data.get('daysBefore')));
      await run('savePreferences', {
        emailEnabled: enabled,
        daysBefore,
        sendTime: data.get('sendTime'),
        timeZone: data.get('timeZone'),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '请检查提醒设置');
    }
  }
  return (
    <form onSubmit={save}>
      <div className="switch-row">
        <div>
          <h3>邮件生日提醒</h3>
          <p>将提醒发送至 {workspace.user.email}</p>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={enabled}
          aria-label="开启邮件生日提醒"
          onClick={() => setEnabled((value) => !value)}
          disabled={pending}
        >
          <span />
        </button>
      </div>
      <div className="form-grid">
        <Field
          id="reminder-days"
          label="提前提醒天数"
          hint="用逗号分隔，0 表示生日当天，例如 7,3,1,0"
        >
          <Input
            id="reminder-days"
            name="daysBefore"
            required
            defaultValue={workspace.preference.daysBefore.join(',')}
            placeholder="7,3,1,0"
          />
        </Field>
        <Field id="sendTime" label="每日发送时间" hint="按你选择的时区发送">
          <Input
            id="sendTime"
            name="sendTime"
            required
            type="time"
            defaultValue={workspace.preference.sendTime}
          />
        </Field>
        <div className="full-width">
          <TimeZoneField defaultValue={workspace.timeZone} />
        </div>
      </div>
      <div className="form-actions">
        <Button type="submit" loading={pending}>
          <Save size={15} />
          保存提醒设置
        </Button>
      </div>
    </form>
  );
}
export function ContactReminderForm({
  contact,
  workspace,
}: {
  contact: ContactDTO;
  workspace: Workspace;
}) {
  const [global, setGlobal] = useState(!contact.reminderSetting);
  const [enabled, setEnabled] = useState(
    contact.reminderSetting?.enabled ?? true,
  );
  const { run, pending } = useAction();
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
          await run('saveContactReminder', {
            contactId: contact.id,
            useGlobal: global,
            enabled,
            daysBefore: global
              ? workspace.preference.daysBefore
              : parseReminderDays(String(data.get('daysBefore'))),
            sendTime: global
              ? workspace.preference.sendTime
              : data.get('sendTime'),
          });
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : '请检查提醒设置',
          );
        }
      }}
    >
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={global}
          onChange={(e) => setGlobal(e.target.checked)}
        />
        使用全局提醒设置
      </label>
      {global ? (
        <div className="notice" style={{ marginTop: 14 }}>
          提前 {workspace.preference.daysBefore.join('、')} 天，
          {workspace.preference.sendTime} 提醒。0 表示生日当天。
        </div>
      ) : (
        <div className="stack-sm" style={{ marginTop: 14 }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            为这位联系人开启提醒
          </label>
          <Field
            id="contact-days"
            label="提前提醒天数"
            hint="0–45 天，逗号分隔"
          >
            <Input
              id="contact-days"
              name="daysBefore"
              required
              defaultValue={(
                contact.reminderSetting?.daysBefore ??
                workspace.preference.daysBefore
              ).join(',')}
            />
          </Field>
          <Field id="contact-time" label="提醒时间">
            <Input
              id="contact-time"
              name="sendTime"
              required
              type="time"
              defaultValue={
                contact.reminderSetting?.sendTime ??
                workspace.preference.sendTime
              }
            />
          </Field>
        </div>
      )}
      {!workspace.preference.emailEnabled && (
        <p className="field-hint" style={{ marginTop: 12 }}>
          全局邮件提醒当前关闭。请先在提醒管理中开启邮件提醒。
        </p>
      )}
      <div className="form-actions">
        <Button size="sm" loading={pending} type="submit">
          保存此联系人的提醒
        </Button>
      </div>
    </form>
  );
}
export function ReminderManagement({ workspace }: { workspace: Workspace }) {
  const { run, pending } = useAction();
  const [tab, setTab] = useState('queue');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const filteredQueue = workspace.queue.filter(
    (item) =>
      !statusFilter ||
      reminderPresentation(item).label === statusLabels[statusFilter],
  );
  const filteredLogs = workspace.emailLogs.filter(
    (log) =>
      !statusFilter ||
      reminderPresentation({
        status: log.status,
        lastError: log.error,
        attemptCount: 0,
      }).label === statusLabels[statusFilter],
  );
  const total = tab === 'queue' ? filteredQueue.length : filteredLogs.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const firstRow = (currentPage - 1) * pageSize;
  const visibleQueue = filteredQueue.slice(firstRow, firstRow + pageSize);
  const visibleLogs = filteredLogs.slice(firstRow, firstRow + pageSize);
  const formatTime = (value: string) =>
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: workspace.timeZone,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  return (
    <>
      <PageHeading
        title="重要的日子，我们提前说"
        description="设好提醒，关掉浏览器也不会错过。邮件只会发送给你本人。"
      >
        <Button
          variant="secondary"
          loading={pending}
          onClick={() => void run('testSmtp', {})}
        >
          <Mail size={15} />
          发送测试邮件
        </Button>
        <Button
          loading={pending}
          onClick={() => void run('generateReminders', {})}
        >
          <RefreshCw size={15} />
          同步未来提醒
        </Button>
      </PageHeading>
      {!workspace.smtpConfigured && (
        <div className="status-callout">
          <AlertCircle size={21} />
          <div>
            <strong>邮件通道尚未完成配置</strong>
            <p>
              你仍可以管理生日和提醒规则。SMTP
              配置完成并启用服务器定时任务后，邮件提醒才会实际发送。
            </p>
          </div>
        </div>
      )}
      <div className="reminders-grid">
        <Panel>
          <div className="panel-heading">
            <div>
              <h2>你的提醒节奏</h2>
              <p>给心意留足准备时间</p>
            </div>
            <Bell size={18} className="muted" />
          </div>
          <div className="settings-section" style={{ paddingTop: 0 }}>
            <PreferencesForm workspace={workspace} />
          </div>
        </Panel>
        <Panel>
          <div className="panel-heading">
            <h2>提醒如何抵达</h2>
            <Badge tone={workspace.smtpConfigured ? 'success' : 'warm'}>
              {workspace.smtpConfigured ? '邮件通道已配置' : '等待配置'}
            </Badge>
          </div>
          <div className="settings-section" style={{ paddingTop: 0 }}>
            <div className="row">
              <Clock size={18} className="muted" />
              <strong style={{ fontSize: 13 }}>当前默认提醒日</strong>
            </div>
            <div className="reminder-summary">
              {workspace.preference.daysBefore.map((day) => (
                <div className="reminder-day" key={day}>
                  <strong>{day === 0 ? '当天' : day}</strong>
                  <span>{day === 0 ? '生日祝福' : '天前提醒'}</span>
                </div>
              ))}
            </div>
            <div className="stack">
              <p className="small muted">
                每天 {workspace.preference.sendTime} · {workspace.timeZone}
                <br />
                接收邮箱：{workspace.user.email}
              </p>
              <div className="notice">
                <CheckCircle2 size={16} />
                <p>
                  联系人可以设置独立的提醒节奏。打开联系人详情，在“生日提醒”中自定义。
                </p>
              </div>
              <Link className="text-link" href="/contacts">
                为特别的人单独设置提醒 →
              </Link>
              <div className="notice warm">
                <Settings size={16} />
                <p>
                  未来提醒由服务器计划任务生成，发送失败会有限次重试。投递结果不明确的邮件需检查日志后处理。
                </p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
      <Panel>
        <div className="panel-heading">
          <h2>提醒与发送记录</h2>
          <div className="filter-status">
            <button
              className={tab === 'queue' ? 'active' : ''}
              onClick={() => {
                setTab('queue');
                setPage(1);
              }}
            >
              提醒队列
            </button>
            <button
              className={tab === 'logs' ? 'active' : ''}
              onClick={() => {
                setTab('logs');
                setPage(1);
              }}
            >
              邮件记录
            </button>
          </div>
        </div>
        <div className="toolbar">
          <Select
            aria-label="筛选提醒或邮件状态"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">全部状态</option>
            {[
              'PENDING',
              'PROCESSING',
              'SENT',
              'FAILED',
              'UNCERTAIN',
              'CANCELLED',
            ].map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </Select>
          <span className="small muted">
            {tab === 'queue' ? '按计划时间从早到晚' : '最近的发送记录在前'} ·
            每页 50 条
          </span>
        </div>
        {tab === 'queue' ? (
          filteredQueue.length ? (
            visibleQueue.map((item) => {
              const presentation = reminderPresentation(item);
              return (
                <div className="queue-item" key={item.id}>
                  <div className="row-between">
                    <div>
                      <h3>{item.subject}</h3>
                      <p>
                        {formatTime(item.scheduledAt)} · {item.recipient} ·
                        已尝试 {item.attemptCount} 次
                      </p>
                    </div>
                    <div className="row">
                      <Badge tone={presentation.tone}>
                        {presentation.label}
                      </Badge>
                      {presentation.canRetry && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={pending}
                          onClick={() =>
                            void run('retryEmail', { id: item.id })
                          }
                        >
                          重试
                        </Button>
                      )}
                    </div>
                  </div>
                  {(presentation.guidance || item.lastError) && (
                    <p className="queue-error">
                      {presentation.guidance || item.lastError}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <EmptyState
              title={
                statusFilter ? '没有这个状态的提醒' : '下一份提醒，还在酝酿中'
              }
              description={
                statusFilter
                  ? '试试其他状态，或切回全部状态查看完整记录。'
                  : '添加生日并启用提醒后，未来的发送计划会出现在这里。'
              }
              icon={<Bell size={28} />}
            />
          )
        ) : filteredLogs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>邮件主题</th>
                  <th>接收邮箱</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => {
                  const presentation = reminderPresentation({
                    status: log.status,
                    lastError: log.error,
                    attemptCount: 0,
                  });
                  return (
                    <tr key={log.id}>
                      <td>
                        {log.subject}
                        {log.error && (
                          <p
                            className="danger-text small"
                            style={{ marginTop: 4 }}
                          >
                            {log.error}
                          </p>
                        )}
                      </td>
                      <td>{log.recipient}</td>
                      <td>
                        <Badge tone={presentation.tone}>
                          {presentation.label}
                        </Badge>
                      </td>
                      <td>{formatTime(log.sentAt ?? log.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={statusFilter ? '没有这个状态的邮件记录' : '还没有发送记录'}
            description={
              statusFilter
                ? '试试其他状态，或切回全部状态查看完整记录。'
                : '生日提醒、验证邮件和测试邮件的投递结果会保存在这里。'
            }
            icon={<Mail size={28} />}
          />
        )}
        <div className="table-foot" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span role="status" aria-live="polite">
            共 {total} 条
            {total > 0
              ? `，显示 ${firstRow + 1}–${Math.min(firstRow + pageSize, total)} 条`
              : ''}
          </span>
          <div className="row" aria-label="记录分页">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              上一页
            </Button>
            <span aria-label={`第 ${currentPage} 页，共 ${pageCount} 页`}>
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </Panel>
    </>
  );
}
