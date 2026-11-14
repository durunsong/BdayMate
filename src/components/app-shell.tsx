'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Cake,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Tags,
  Users,
  X,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { useState, type ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';
import type { Workspace } from '@/lib/types';
import { useNavigation } from '@/stores/navigation';
import { useAction } from '@/features/use-action';
import { Avatar, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/dashboard', label: '生日概览', icon: LayoutDashboard },
  { href: '/contacts', label: '联系人', icon: Users },
  { href: '/calendar', label: '生日日历', icon: CalendarDays },
  { href: '/reminders', label: '生日提醒', icon: Bell },
  { href: '/groups', label: '标签与分组', icon: Tags },
  { href: '/wishes', label: '祝福语', icon: Heart },
];
export function Brand() {
  return (
    <Link
      href="/dashboard"
      className="brand"
      aria-label="BdayMate 生日搭子首页"
    >
      <span className="brand-icon">
        <Cake size={24} strokeWidth={1.8} />
      </span>
      <span>
        <strong>
          BdayMate<span className="brand-dot">.</span>
        </strong>
        <small>生日搭子</small>
      </span>
    </Link>
  );
}
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <>
      <Brand />
      <div className="sidebar-caption">每个重要的日子，都记得</div>
      <nav className="main-navigation" aria-label="主导航">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={path.startsWith(item.href) ? 'page' : undefined}
            className={cn('nav-link', path.startsWith(item.href) && 'active')}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
            {path.startsWith(item.href) && <span className="nav-dot" />}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <span className="little-cake">
            <Cake size={26} />
          </span>
          <strong>把在乎，放进日历</strong>
          <p>
            一句准时的祝福，
            <br />
            是一份刚刚好的心意。
          </p>
          <Link href="/contacts/new" onClick={onNavigate}>
            记下一个生日 <ChevronRight size={14} />
          </Link>
        </div>
        <Link
          href="/settings"
          className={cn('nav-link', path === '/settings' && 'active')}
          onClick={onNavigate}
        >
          <Settings size={19} />
          个人设置
        </Link>
        <span className="sidebar-footer">Never Miss a Special Day.</span>
      </div>
    </>
  );
}
export function AppShell({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const { open, setOpen } = useNavigation();
  const { run, pending } = useAction();
  const [signingOut, setSigningOut] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const unread = workspace.notifications.filter((n) => !n.readAt).length;
  const current =
    navigation.find((n) => path.startsWith(n.href))?.label ?? '个人设置';
  async function signOut() {
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        toast.error('退出失败，请重试');
        return;
      }
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('网络异常，请重试');
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳转到内容
      </a>
      <aside className="sidebar">
        <Navigation />
      </aside>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content className="mobile-sidebar">
            <Dialog.Title className="sr-only">主导航</Dialog.Title>
            <Dialog.Description className="sr-only">
              访问生日搭子的各个页面
            </Dialog.Description>
            <Dialog.Close
              className="mobile-nav-close button button-ghost button-icon"
              aria-label="关闭菜单"
            >
              <X size={20} />
            </Dialog.Close>
            <Navigation onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="app-body">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="打开菜单"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </Button>
            <span className="breadcrumb">
              我的空间 <ChevronRight size={14} />
              <strong>{current}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <Link href="/contacts" className="header-search">
              <Search size={17} />
              <span>查找联系人</span>
            </Link>
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="notification-trigger"
                  aria-label={unread ? `通知，${unread} 条未读` : '通知'}
                >
                  <Bell size={20} />
                  {unread > 0 && <span className="notification-dot" />}
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  align="end"
                  sideOffset={12}
                  className="dropdown-content notifications-dropdown"
                >
                  <div className="dropdown-heading">
                    <strong>通知</strong>
                    <span>{unread} 条未读</span>
                  </div>
                  {workspace.notifications.length === 0 ? (
                    <p className="dropdown-empty">
                      暂无通知，新的提醒会出现在这里。
                    </p>
                  ) : (
                    workspace.notifications.slice(0, 15).map((n) => (
                      <Dropdown.Item
                        key={n.id}
                        className={cn(
                          'notification-item',
                          !n.readAt && 'unread',
                        )}
                        disabled={pending}
                        onSelect={async (event) => {
                          event.preventDefault();
                          const result = await run('markNotification', {
                            id: n.id,
                          });
                          if (result.ok && n.href) router.push(n.href);
                        }}
                      >
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                        <small>
                          {new Intl.DateTimeFormat('zh-CN', {
                            timeZone: workspace.timeZone,
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(n.createdAt))}
                        </small>
                      </Dropdown.Item>
                    ))
                  )}
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
            <span className="header-divider" />
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <button className="user-trigger" aria-label="账户菜单">
                  <Avatar
                    name={workspace.user.name}
                    src={workspace.user.image}
                    size="small"
                  />
                  <span>{workspace.user.name}</span>
                  <ChevronDown size={14} />
                </button>
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content
                  className="dropdown-content user-dropdown"
                  align="end"
                  sideOffset={12}
                >
                  <div className="dropdown-heading user-menu-heading">
                    <strong>{workspace.user.name}</strong>
                    <span>{workspace.user.email}</span>
                  </div>
                  <Dropdown.Item asChild>
                    <Link href="/settings" className="dropdown-item">
                      <Settings size={16} />
                      个人设置
                    </Link>
                  </Dropdown.Item>
                  <Dropdown.Item
                    className="dropdown-item"
                    disabled={signingOut}
                    onSelect={() => void signOut()}
                  >
                    <LogOut size={16} />
                    {signingOut ? '正在退出…' : '退出登录'}
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>BdayMate · 让每一份在乎准时抵达</span>
          <Link href="/contacts/new">
            <Plus size={13} />
            添加联系人
          </Link>
        </footer>
      </div>
    </div>
  );
}
