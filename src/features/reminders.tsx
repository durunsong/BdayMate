'use client';
import Link from 'next/link';
import Image from 'next/image';
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
  Textarea,
} from '@/components/ui';
import type { ContactDTO, Workspace } from '@/lib/types';
import { greetingPresets } from '@/lib/greeting-presets';
import './greeting-editor.css';
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
          <h3>提醒我准备生日</h3>
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
          hint="用逗号分隔，0 表示生日当天提醒自己，例如 7,3,1,0"
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
      <p className="field-hint" style={{ marginBottom: 14 }}>
        提醒发送给你本人：{workspace.user.email}，不会发给联系人。
      </p>
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
          {workspace.preference.sendTime} 提醒自己。0 表示生日当天提醒自己。
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
export function ContactGreetingForm({
  contact,
  workspace,
}: {
  contact: ContactDTO;
  workspace: Workspace;
}) {
  const [enabled, setEnabled] = useState(
    contact.greetingSetting?.enabled ?? false,
  );
  const [message, setMessage] = useState(
    contact.greetingSetting?.message ?? greetingPresets[0].message,
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const { run, pending } = useAction();
  const unavailable = !contact.email || !!contact.archivedAt;
  return (
    <form
      className="inline-form greeting-editor"
      aria-label="自动生日祝福"
      onChange={() => {
        setSaved(false);
        setError('');
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        if (unavailable || pending) return;
        setSaved(false);
        const content = message.trim();
        if (!content || content.length > 3000) {
          setError('请输入 1–3000 字的生日祝福');
          return;
        }
        setError('');
        const data = new FormData(event.currentTarget);
        const result = await run('saveContactGreeting', {
          contactId: contact.id,
          enabled,
          sendTime: data.get('sendTime'),
          message: content,
        });
        if (result.ok) {
          setMessage(content);
          setSaved(true);
        } else setError(result.message);
      }}
    >
      <div className="switch-row">
        <div>
          <h3>生日当天，替你送出祝福</h3>
          <p>需要单独开启，不受“提醒自己”的开关影响。</p>
        </div>
        <button
          type="button"
          className="switch"
          role="switch"
          aria-checked={enabled && !unavailable}
          aria-label="开启自动生日祝福"
          onClick={() => {
            setEnabled((value) => !value);
            setSaved(false);
            setError('');
          }}
          disabled={pending || unavailable}
        >
          <span />
        </button>
      </div>
      <div className="stack-sm">
        <p className="small muted" style={{ overflowWrap: 'anywhere' }}>
          收件人：<span>{contact.email || '尚未填写邮箱'}</span>
          <br />
          发送时区：<span>{workspace.timeZone}</span>
          <br />
          署名：{workspace.user.name}
        </p>
        {!contact.email && (
          <div className="notice warm">
            <p>
              先填写联系人邮箱，再开启自动祝福。{' '}
              <Link
                className="text-link"
                style={{ color: 'var(--primary-dark)' }}
                href={`/contacts/${contact.id}/edit`}
              >
                填写联系人邮箱
              </Link>
            </p>
          </div>
        )}
        {contact.archivedAt && (
          <p className="notice warm">
            这位联系人已归档，自动祝福已暂停。恢复联系人后可重新设置。
          </p>
        )}
        <Field
          id="greeting-time"
          label="祝福发送时间"
          hint="按上方账户时区发送"
        >
          <Input
            id="greeting-time"
            name="sendTime"
            type="time"
            required
            disabled={pending || unavailable}
            defaultValue={contact.greetingSetting?.sendTime ?? '09:00'}
          />
        </Field>
        <fieldset
          className="greeting-presets"
          disabled={pending || unavailable}
        >
          <legend>从一句灵感开始</legend>
          <p className="field-hint">
            选择会替换当前草稿，你还可以改成自己的话。
          </p>
          <div className="greeting-preset-options">
            {greetingPresets.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant="secondary"
                aria-label={`使用${preset.label}模板`}
                aria-pressed={message === preset.message}
                onClick={() => {
                  setMessage(preset.message);
                  setSaved(false);
                  setError('');
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </fieldset>
        <Field id="greeting-message" label="生日祝福内容">
          <Textarea
            id="greeting-message"
            name="message"
            required
            maxLength={3000}
            rows={7}
            disabled={pending || unavailable}
            value={message}
            aria-invalid={!!error}
            aria-describedby="greeting-message-help greeting-message-count"
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="greeting-writing-hints">
            <p id="greeting-message-help" className="field-hint">
              1–3000 字，换行会保留
            </p>
            <span id="greeting-message-count" className="field-hint">
              {message.length} / 3000
            </span>
          </div>
        </Field>
        <section className="greeting-preview" aria-label="生日邮件预览">
          <div className="greeting-preview-label">
            <h3>
              <Mail size={14} />
              邮件预览
            </h3>
            <span>仅供预览</span>
          </div>
          <div className="greeting-letter">
            <div className="greeting-letter-brand">
              <Image
                src="/brand/bdaymate-logo.png"
                width={30}
                height={30}
                alt=""
              />
              <span>BdayMate · 生日搭子</span>
            </div>
            <h3>{contact.name}，生日快乐！</h3>
            <div className="greeting-letter-body">
              {message.trim() || (
                <span className="muted">
                  写下祝福，这里会同步呈现你的心意。
                </span>
              )}
            </div>
            <p className="greeting-letter-signature">
              来自：{workspace.user.name}
            </p>
            <p className="greeting-letter-footer">
              这封生日祝福由发送者通过 BdayMate
              安排。如不希望继续收到，请联系发送者关闭自动祝福。
            </p>
            <p className="greeting-letter-motto">Never Miss a Special Day.</p>
          </div>
          <p className="field-hint greeting-preview-note">
            预览会随文字更新；实际排版可能因邮箱而异。
          </p>
        </section>
        <p className="field-hint">
          每年按{contact.birthdayType === 'LUNAR' ? '农历' : '公历'}
          生日与上方庆祝规则，在生日当天重复发送。关闭此开关、移除邮箱或归档联系人会停止发送。
        </p>
        <p className="field-hint">
          邮件仅包含联系人称呼、这段祝福和你的昵称，不会自动添加年龄、关系、内部备注或私有链接。请确认内容适合直接发送。
        </p>
        <p className="field-hint">
          需已配置邮件通道并启用后台调度；到达设定时间后由服务器发送，可能有延迟。
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="field-hint" role="status">
            生日祝福设置已保存
          </p>
        )}
      </div>
      <div className="form-actions">
        <Button
          size="sm"
          type="submit"
          loading={pending}
          disabled={unavailable}
        >
          <Save size={15} />
          保存生日祝福设置
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
        description="给自己的提前提醒和给联系人的当天祝福，分别设置。"
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
                  <span>{day === 0 ? '提醒自己' : '天前提醒'}</span>
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
                  这些提醒只发给你本人，0
                  表示生日当天提醒自己。打开联系人详情，在“提醒自己”中自定义提醒节奏。
                </p>
              </div>
              <Link className="text-link" href="/contacts">
                设置联系人提醒与自动祝福 →
              </Link>
              <div className="notice warm">
                <Settings size={16} />
                <p>
                  需已配置邮件通道并启用后台调度，关闭浏览器后才可继续发送；调度或邮件投递可能延迟。发送失败会有限次重试，投递结果不明确时需检查日志后处理。
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
