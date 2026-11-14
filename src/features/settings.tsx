'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Database,
  Download,
  Laptop,
  LockKeyhole,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeading,
  Panel,
  Skeleton,
} from '@/components/ui';
import type { Workspace } from '@/lib/types';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/features/auth';
import { PreferencesForm, TimeZoneField } from '@/features/reminders';
import { useAction } from '@/features/use-action';
type ActiveSession = {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
};
export function SettingsPageContent({ workspace }: { workspace: Workspace }) {
  const [tab, setTab] = useState('profile');
  const [image, setImage] = useState(workspace.user.image ?? '');
  const [modal, setModal] = useState<
    'password' | 'email' | 'sessions' | 'delete-data' | 'delete-account' | null
  >(null);
  const [authPending, setAuthPending] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [currentSession, setCurrentSession] = useState('');
  const [sessionsError, setSessionsError] = useState('');
  const { run, pending } = useAction();
  const router = useRouter();
  const tabs = [
    { id: 'profile', label: '个人资料', icon: UserRound },
    { id: 'notifications', label: '通知设置', icon: Bell },
    { id: 'security', label: '账户安全', icon: ShieldCheck },
    { id: 'data', label: '我的数据', icon: Database },
  ];
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run('saveProfile', {
      name: data.get('name'),
      image: data.get('image') || undefined,
      timeZone: data.get('timeZone'),
    });
  }
  async function authTask(
    task: () => Promise<{ error?: { message?: string; code?: string } | null }>,
    success: string,
    close = true,
  ) {
    setAuthPending(true);
    try {
      const result = await task();
      if (result.error) {
        toast.error(authErrorMessage(result.error));
        return false;
      }
      toast.success(success);
      if (close) setModal(null);
      router.refresh();
      return true;
    } catch {
      toast.error('网络异常，请稍后重试');
      return false;
    } finally {
      setAuthPending(false);
    }
  }
  async function loadSessions() {
    setModal('sessions');
    setSessionsError('');
    setAuthPending(true);
    try {
      const [list, current] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession(),
      ]);
      if (list.error) {
        setSessionsError('暂时无法加载登录设备，请重试');
        return;
      }
      setSessions(list.data ?? []);
      setCurrentSession(current.data?.session.id ?? '');
    } catch {
      setSessionsError('网络异常，请重试');
    } finally {
      setAuthPending(false);
    }
  }
  function openDanger(kind: 'delete-data' | 'delete-account') {
    setConfirmation('');
    setModal(kind);
  }
  return (
    <>
      <PageHeading
        title="照顾好你的生日空间"
        description="按自己的习惯，设置资料、提醒与账户安全。"
      />
      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="设置分类">
          {tabs.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? 'active' : ''}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {tab === 'profile' && (
            <Panel>
              <form onSubmit={saveProfile}>
                <section className="settings-section">
                  <h2>个人资料</h2>
                  <p>你的昵称与头像，会陪你记下每一个特别的日子。</p>
                  <div className="row" style={{ marginBottom: 25, gap: 18 }}>
                    <Avatar
                      name={workspace.user.name}
                      src={image}
                      size="large"
                    />
                    <div>
                      <strong>{workspace.user.name}</strong>
                      <p className="small muted">{workspace.user.email}</p>
                      <Badge tone="success">邮箱已验证</Badge>
                    </div>
                  </div>
                  <div className="form-grid">
                    <Field id="profile-name" label="昵称 *">
                      <Input
                        id="profile-name"
                        name="name"
                        required
                        maxLength={80}
                        defaultValue={workspace.user.name}
                      />
                    </Field>
                    <Field
                      id="profile-email"
                      label="账户邮箱"
                      hint="如需修改，请前往账户安全"
                    >
                      <Input
                        id="profile-email"
                        type="email"
                        value={workspace.user.email}
                        readOnly
                      />
                    </Field>
                    <Field
                      id="profile-image"
                      label="头像链接"
                      className="full-width"
                      hint="使用公开的 https 图片地址；留空会显示昵称首字"
                    >
                      <Input
                        id="profile-image"
                        name="image"
                        type="url"
                        value={image}
                        onChange={(event) => setImage(event.target.value)}
                        placeholder="https://…"
                      />
                    </Field>
                    <div className="full-width">
                      <TimeZoneField
                        id="profile-timeZone"
                        defaultValue={workspace.timeZone}
                      />
                    </div>
                  </div>
                  <div className="form-actions">
                    <Button type="submit" loading={pending}>
                      <Save size={15} />
                      保存个人资料
                    </Button>
                  </div>
                </section>
              </form>
            </Panel>
          )}
          {tab === 'notifications' && (
            <Panel>
              <section className="settings-section">
                <h2>让祝福准时抵达</h2>
                <p>全局设置会应用到没有独立提醒规则的联系人。</p>
                <PreferencesForm workspace={workspace} />
              </section>
              <section className="settings-section">
                <div className="row-between">
                  <div>
                    <h3>测试邮件通道</h3>
                    <p className="small muted" style={{ marginTop: 5 }}>
                      发送一封测试邮件至你的账户邮箱。
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    loading={pending}
                    onClick={() => void run('testSmtp', {})}
                  >
                    <Mail size={15} />
                    发送测试邮件
                  </Button>
                </div>
                {!workspace.smtpConfigured && (
                  <p className="pending-status">
                    SMTP 尚未配置，测试会返回配置提示。
                  </p>
                )}
              </section>
            </Panel>
          )}
          {tab === 'security' && (
            <div className="stack">
              <Panel>
                <section className="settings-section">
                  <h2>账户安全</h2>
                  <p>定期更新密码，只在自己的设备上保持登录。</p>
                  <div>
                    <div className="security-row">
                      <div className="row">
                        <LockKeyhole size={20} className="muted" />
                        <div>
                          <h3>登录密码</h3>
                          <p>修改密码后，会退出其他设备的登录。</p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setModal('password')}
                      >
                        修改密码
                      </Button>
                    </div>
                    <div className="security-row">
                      <div className="row">
                        <Mail size={20} className="muted" />
                        <div>
                          <h3>邮箱地址</h3>
                          <p>{workspace.user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setModal('email')}
                      >
                        修改邮箱
                      </Button>
                    </div>
                    <div className="security-row">
                      <div className="row">
                        <Laptop size={20} className="muted" />
                        <div>
                          <h3>登录设备</h3>
                          <p>查看活跃会话，退出不再使用的设备。</p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        loading={authPending}
                        onClick={() => void loadSessions()}
                      >
                        查看登录设备
                      </Button>
                    </div>
                  </div>
                </section>
              </Panel>
              <Panel className="danger-zone">
                <section className="settings-section">
                  <h2>注销账户</h2>
                  <p>
                    永久删除你的账户以及关联的全部生日、礼物和提醒数据。操作无法撤销。
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => openDanger('delete-account')}
                  >
                    <Trash2 size={15} />
                    注销账户
                  </Button>
                </section>
              </Panel>
            </div>
          )}
          {tab === 'data' && (
            <div className="stack">
              <Panel>
                <section className="settings-section">
                  <h2>带走你的生日记录</h2>
                  <p>随时导出数据，为每一份重要记录留一份备份。</p>
                  <div className="security-row">
                    <div>
                      <h3>联系人 CSV</h3>
                      <p>适合在电子表格中查看、编辑或再次导入。</p>
                    </div>
                    <Button variant="secondary" asChild>
                      <a href="/api/export/contacts" download>
                        <Download size={15} />
                        导出联系人
                      </a>
                    </Button>
                  </div>
                  <div className="security-row">
                    <div>
                      <h3>完整生日数据 JSON</h3>
                      <p>导出联系人、标签、祝福与礼物等业务记录。</p>
                    </div>
                    <Button variant="secondary" asChild>
                      <a href="/api/export/data" download>
                        <Download size={15} />
                        导出全部数据
                      </a>
                    </Button>
                  </div>
                </section>
              </Panel>
              <Panel className="danger-zone">
                <section className="settings-section">
                  <h2>清空个人数据</h2>
                  <p>
                    删除所有业务记录，保留登录账户。请先导出需要保留的数据。
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => openDanger('delete-data')}
                  >
                    <Trash2 size={15} />
                    删除个人数据
                  </Button>
                </section>
              </Panel>
            </div>
          )}
        </div>
      </div>
      <Modal
        open={modal === 'password'}
        onOpenChange={(open) => !open && setModal(null)}
        title="修改登录密码"
        description="使用至少 10 位的新密码。修改后将退出其他设备。"
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (data.get('newPassword') !== data.get('confirmPassword')) {
              toast.error('两次输入的新密码不一致');
              return;
            }
            await authTask(
              () =>
                authClient.changePassword({
                  currentPassword: String(data.get('currentPassword')),
                  newPassword: String(data.get('newPassword')),
                  revokeOtherSessions: true,
                }),
              '密码已修改，其他设备已退出',
            );
          }}
        >
          <Field id="current-password" label="当前密码">
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field id="new-password" label="新密码">
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </Field>
          <Field id="confirm-new-password" label="确认新密码">
            <Input
              id="confirm-new-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </Field>
          <div className="form-actions">
            <Button type="submit" loading={authPending}>
              更新密码
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={modal === 'email'}
        onOpenChange={(open) => !open && setModal(null)}
        title="修改账户邮箱"
        description="我们会先向当前邮箱发送确认链接，确认后再验证新邮箱。"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            await authTask(
              () =>
                authClient.changeEmail({
                  newEmail: String(data.get('newEmail')),
                  callbackURL: '/settings',
                }),
              '请打开当前邮箱，确认更改请求',
            );
          }}
        >
          <Field id="new-email" label="新的邮箱地址">
            <Input
              id="new-email"
              name="newEmail"
              type="email"
              required
              autoComplete="email"
              placeholder="new@example.com"
            />
          </Field>
          <div className="form-actions">
            <Button type="submit" loading={authPending}>
              发送确认邮件
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={modal === 'sessions'}
        onOpenChange={(open) => !open && setModal(null)}
        title="已登录的设备"
        description="如果发现不认识的设备，请退出该会话并修改密码。"
      >
        {authPending && !sessions ? (
          <Skeleton className="skeleton-panel" />
        ) : sessionsError ? (
          <div className="stack">
            <p className="danger-text">{sessionsError}</p>
            <Button variant="secondary" onClick={() => void loadSessions()}>
              重新加载
            </Button>
          </div>
        ) : (
          <div className="sessions-list">
            {sessions?.map((session) => (
              <div key={session.id} className="session-row">
                <div className="row">
                  <Laptop size={20} className="muted" />
                  <div>
                    <strong>
                      {session.userAgent?.includes('Mobile')
                        ? '移动设备'
                        : session.userAgent?.includes('Mac')
                          ? 'Mac 设备'
                          : session.userAgent?.includes('Windows')
                            ? 'Windows 设备'
                            : '浏览器设备'}
                    </strong>
                    <p>
                      {session.ipAddress || '地址未知'} ·{' '}
                      {new Intl.DateTimeFormat('zh-CN', {
                        timeZone: workspace.timeZone,
                        month: 'short',
                        day: 'numeric',
                      }).format(new Date(session.createdAt))}{' '}
                      登录
                    </p>
                  </div>
                </div>
                {session.id === currentSession ? (
                  <Badge tone="success">当前设备</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={authPending}
                    onClick={async () => {
                      if (
                        await authTask(
                          () =>
                            authClient.revokeSession({ token: session.token }),
                          '已退出该设备',
                          false,
                        )
                      )
                        await loadSessions();
                    }}
                  >
                    退出
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="form-actions">
          <Button
            variant="secondary"
            disabled={authPending}
            onClick={() => void loadSessions()}
          >
            <RefreshCw size={14} />
            刷新
          </Button>
          <Button
            loading={authPending}
            onClick={async () => {
              if (
                await authTask(
                  () => authClient.revokeOtherSessions(),
                  '其他设备已退出',
                  false,
                )
              )
                await loadSessions();
            }}
          >
            退出其他设备
          </Button>
        </div>
      </Modal>
      <Modal
        open={modal === 'delete-data'}
        onOpenChange={(open) => !open && setModal(null)}
        title="确认删除个人数据"
        description="所有联系人、礼物、标签、祝福、提醒与邮件记录都将被删除，无法恢复。登录账户仍然保留。"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if ((await run('deleteData', { confirmation })).ok) {
              setModal(null);
              router.refresh();
            }
          }}
        >
          <Field
            id="delete-data-confirmation"
            label="请输入“删除个人数据”以确认"
          >
            <Input
              id="delete-data-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal(null)}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={confirmation !== '删除个人数据'}
              loading={pending}
            >
              永久删除个人数据
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={modal === 'delete-account'}
        onOpenChange={(open) => !open && setModal(null)}
        title="永久注销账户"
        description="账户与全部关联数据将永久删除，无法恢复。请确认已导出需要保留的数据。"
      >
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (
              await authTask(
                () =>
                  authClient.deleteUser({
                    password: String(data.get('password')),
                  }),
                '账户已注销',
              )
            ) {
              router.push('/register');
              router.refresh();
            }
          }}
        >
          <Field id="delete-account-password" label="当前登录密码">
            <Input
              id="delete-account-password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </Field>
          <Field
            id="delete-account-confirmation"
            label="请输入“注销账户”以确认"
          >
            <Input
              id="delete-account-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModal(null)}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={confirmation !== '注销账户'}
              loading={authPending}
            >
              永久注销账户
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
