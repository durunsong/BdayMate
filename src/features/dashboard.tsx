'use client';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Cake,
  Clock,
  Gift,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
} from '@/components/ui';
import { ContactBirthdayRow, birthdayLabel } from '@/features/contact-display';
import type { Workspace } from '@/lib/types';
import { BirthdayService, localDate } from '@/services/birthday';
export function Dashboard({ workspace }: { workspace: Workspace }) {
  const contacts = workspace.contacts.filter((c) => !c.archivedAt);
  const today = localDate(new Date(), workspace.timeZone);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const birthdaysToday = contacts.filter((c) => c.next?.daysUntil === 0);
  const upcoming = contacts
    .filter((c) => c.next && c.next.daysUntil > 0)
    .sort((a, b) => a.next!.daysUntil - b.next!.daysUntil);
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    name: `${i + 1}月`,
    birthdays: 0,
  }));
  contacts.forEach((contact) => {
    try {
      BirthdayService.between(
        contact,
        `${year}-01-01`,
        `${year}-12-31`,
        workspace.timeZone,
      ).forEach(
        (date) => monthly[Number(date.date.slice(5, 7)) - 1].birthdays++,
      );
    } catch {
      /* Invalid dates are surfaced on contact detail. */
    }
  });
  const stats = [
    { label: '联系人总数', value: contacts.length, icon: Users, tone: '' },
    {
      label: '今日生日',
      value: birthdaysToday.length,
      icon: Cake,
      tone: 'warm',
    },
    {
      label: '本月生日',
      value: monthly[month - 1].birthdays,
      icon: CalendarDays,
      tone: 'pink',
    },
    {
      label: '未来 7 天',
      value: contacts.filter(
        (c) => c.next && c.next.daysUntil >= 0 && c.next.daysUntil <= 7,
      ).length,
      icon: Clock,
      tone: '',
    },
    {
      label: '未来 30 天',
      value: contacts.filter(
        (c) => c.next && c.next.daysUntil >= 0 && c.next.daysUntil <= 30,
      ).length,
      icon: Gift,
      tone: 'warm',
    },
  ];
  const recent = [...contacts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  return (
    <>
      <PageHeading
        title={`${workspace.user.name}，把在乎记在心上`}
        description="生活里的小小仪式感，从记住一个生日开始。"
      >
        <span className="date-label">
          <CalendarDays size={14} />
          {new Intl.DateTimeFormat('zh-CN', {
            timeZone: workspace.timeZone,
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          }).format(new Date())}
        </span>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus size={17} />
            添加联系人
          </Link>
        </Button>
      </PageHeading>
      <div className="stats-grid">
        {stats.map((stat) => (
          <div className={`stat-card ${stat.tone}`} key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className="stat-icon">
                <stat.icon size={16} />
              </span>
            </div>
            <div className="stat-value">
              {stat.value}
              <small>位</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <div>
          <section className="today-panel">
            <div className="today-empty">
              <div>
                <div className="today-heading">
                  <Sparkles size={19} />
                  <h2>
                    {birthdaysToday.length
                      ? '今天，有人值得被祝福'
                      : '今天，也适合表达在乎'}
                  </h2>
                </div>
                <p>
                  {birthdaysToday.length
                    ? `${birthdaysToday.length} 位重要的人今天过生日，别忘了送上心意。`
                    : '今天没有联系人过生日。不妨提前为下一个生日准备一份心意。'}
                </p>
              </div>
              <Cake className="today-decoration" size={68} strokeWidth={1} />
            </div>
            {birthdaysToday.length > 0 && (
              <div className="today-people">
                {birthdaysToday.map((c) => (
                  <Link
                    href={`/contacts/${c.id}`}
                    key={c.id}
                    className="today-person"
                  >
                    <Avatar name={c.name} src={c.avatar} />
                    <div>
                      <strong>{c.name}</strong>
                      <p>
                        {c.next?.age == null
                          ? '生日快乐'
                          : `${c.next.age} 岁生日快乐`}
                      </p>
                    </div>
                    <ArrowRight size={14} />
                  </Link>
                ))}
              </div>
            )}
          </section>
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>即将到来的生日</h2>
                <p>给每一份心意，多留一点准备时间</p>
              </div>
              <Link href="/calendar">
                查看日历
                <ArrowRight size={14} />
              </Link>
            </div>
            {upcoming.length > 0 ? (
              <>
                {upcoming.slice(0, 6).map((c) => (
                  <ContactBirthdayRow contact={c} key={c.id} />
                ))}
                <div className="panel-foot">
                  <Link href="/contacts">
                    查看全部联系人 <span aria-hidden>→</span>
                  </Link>
                </div>
              </>
            ) : (
              <EmptyState
                title={
                  contacts.length
                    ? '近期没有待准备的生日'
                    : '从第一个重要的人开始'
                }
                description={
                  contacts.length
                    ? '有日期异常的联系人可前往详情检查生日设置。'
                    : '记下家人、朋友的生日，让每一份祝福都准时抵达。'
                }
                action="添加联系人"
                href="/contacts/new"
              />
            )}
          </Panel>
        </div>
        <div className="stack dashboard-side">
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>一年里的小期待</h2>
                <p>{year} 年 · 每月生日分布</p>
              </div>
              <CalendarDays size={17} className="muted" />
            </div>
            {contacts.length ? (
              <div
                className="chart-wrap"
                role="img"
                aria-label={monthly
                  .map((m) => `${m.name}${m.birthdays}人`)
                  .join('，')}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthly}
                    margin={{ top: 5, right: 2, left: -28, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="#f0f1f6" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: '#f5f5fd' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid #e7e9f0',
                        fontSize: 12,
                      }}
                      formatter={(value) => [`${value} 位`, '生日人数']}
                    />
                    <Bar
                      dataKey="birthdays"
                      fill="#a49ce7"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={17}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="chart-empty">
                <CalendarDays size={29} strokeWidth={1} />
                <p>添加联系人后，这里会亮起生日的月份</p>
              </div>
            )}
          </Panel>
          <Panel className="recent-list">
            <div className="panel-heading">
              <h2>最近添加的联系人</h2>
              <Badge>{contacts.length} 位联系人</Badge>
            </div>
            {recent.length ? (
              recent.map((c) => (
                <Link
                  className="birthday-row"
                  key={c.id}
                  href={`/contacts/${c.id}`}
                >
                  <Avatar name={c.name} src={c.avatar} size="small" />
                  <div className="birthday-row-info">
                    <strong className="birthday-name">{c.name}</strong>
                    <div className="birthday-meta">{birthdayLabel(c)}</div>
                  </div>
                  <ArrowRight size={14} className="muted" />
                </Link>
              ))
            ) : (
              <p className="dropdown-empty">你添加的联系人会出现在这里</p>
            )}
          </Panel>
          <div className="reminder-note">
            <Bell size={19} />
            <div>
              <strong>
                {workspace.preference.emailEnabled
                  ? '提前一点，把心意准备好'
                  : '开启提醒，重要日子不再错过'}
              </strong>
              <p>
                {workspace.preference.emailEnabled
                  ? `已设置在生日${workspace.preference.daysBefore.map((d) => (d === 0 ? '当天' : `前 ${d} 天`)).join('、')}提醒你。`
                  : '设置邮件提醒，即使没有打开 BdayMate，也能记得重要的生日。'}
              </p>
              <Link href="/reminders">
                管理生日提醒 <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
