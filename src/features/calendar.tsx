'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  Panel,
  Select,
} from '@/components/ui';
import { relationships, type ContactDTO, type Workspace } from '@/lib/types';
import {
  BirthdayService,
  addDaysToDate,
  localDate,
  type BirthdayOccurrence,
} from '@/services/birthday';
import { birthdayLabel } from '@/features/contact-display';
type CalendarEvent = { contact: ContactDTO; occurrence: BirthdayOccurrence };
export function BirthdayCalendar({ workspace }: { workspace: Workspace }) {
  const today = localDate(new Date(), workspace.timeZone);
  const [cursor, setCursor] = useState(today);
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [relationship, setRelationship] = useState('');
  const [tag, setTag] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const year = Number(cursor.slice(0, 4)),
    month = Number(cursor.slice(5, 7));
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const monday = (date: string) =>
    addDaysToDate(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
  const start =
    view === 'week' ? monday(cursor) : view === 'month' ? monday(first) : first;
  const end =
    view === 'week'
      ? addDaysToDate(start, 6)
      : view === 'month'
        ? addDaysToDate(start, 41)
        : last;
  const contacts = workspace.contacts.filter(
    (c) =>
      !c.archivedAt &&
      (!relationship || c.relationship === relationship) &&
      (!tag || c.tags.some((t) => t.id === tag)),
  );
  const events: CalendarEvent[] = [];
  const errors: string[] = [];
  contacts.forEach((contact) => {
    try {
      BirthdayService.between(contact, start, end, workspace.timeZone).forEach(
        (occurrence) => events.push({ contact, occurrence }),
      );
    } catch {
      errors.push(contact.name);
    }
  });
  events.sort(
    (a, b) =>
      a.occurrence.date.localeCompare(b.occurrence.date) ||
      a.contact.name.localeCompare(b.contact.name, 'zh-CN'),
  );
  function move(direction: number) {
    if (view === 'week') setCursor(addDaysToDate(cursor, direction * 7));
    else
      setCursor(
        new Date(Date.UTC(year, month - 1 + direction, 1))
          .toISOString()
          .slice(0, 10),
      );
  }
  function changeMonth(newYear: number, newMonth: number) {
    setCursor(`${newYear}-${String(newMonth).padStart(2, '0')}-01`);
  }
  const dayEvents = (day: string) =>
    events.filter((event) => event.occurrence.date === day);
  return (
    <>
      <PageHeading
        title="把值得期待的日子圈起来"
        description="公历、农历，都会在正确的那一天相见。"
      >
        <Button asChild>
          <Link href="/contacts/new">
            <Plus size={16} />
            记下生日
          </Link>
        </Button>
      </PageHeading>
      <Panel>
        <div className="calendar-toolbar">
          <div className="calendar-controls">
            <Button
              variant="ghost"
              size="icon"
              aria-label={view === 'week' ? '上一周' : '上个月'}
              onClick={() => move(-1)}
            >
              <ChevronLeft size={19} />
            </Button>
            <h2 className="calendar-heading">
              {year} 年 {month} 月
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label={view === 'week' ? '下一周' : '下个月'}
              onClick={() => move(1)}
            >
              <ChevronRight size={19} />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCursor(today)}
            >
              今天
            </Button>
          </div>
          <div className="filter-status" role="group" aria-label="日历视图">
            {(['month', 'week', 'list'] as const).map((type, i) => (
              <button
                className={view === type ? 'active' : ''}
                key={type}
                onClick={() => setView(type)}
              >
                {['月视图', '周视图', '列表'][i]}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar">
          <Select
            aria-label="选择年份"
            value={year}
            onChange={(e) => changeMonth(+e.target.value, month)}
          >
            {Array.from({ length: 201 }, (_, i) => (
              <option key={i} value={1900 + i}>
                {1900 + i} 年
              </option>
            ))}
          </Select>
          <Select
            aria-label="选择月份"
            value={month}
            onChange={(e) => changeMonth(year, +e.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1} 月
              </option>
            ))}
          </Select>
          <Select
            aria-label="筛选关系"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            <option value="">全部关系</option>
            {Object.entries(relationships).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="筛选标签"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">全部标签</option>
            {workspace.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        {errors.length > 0 && (
          <div className="notification-inline danger-text">
            {errors.length}{' '}
            位联系人在所选日期范围内无法换算，请前往联系人详情检查生日：
            {errors.join('、')}。
          </div>
        )}
        {view === 'list' ? (
          events.length ? (
            <div>
              {events.map((event) => (
                <Link
                  href={`/contacts/${event.contact.id}`}
                  className="calendar-list-row"
                  key={`${event.contact.id}-${event.occurrence.date}`}
                >
                  <div className="calendar-list-date">
                    <strong>{Number(event.occurrence.date.slice(8))}</strong>
                    {Number(event.occurrence.date.slice(5, 7))} 月
                  </div>
                  <Avatar
                    name={event.contact.name}
                    src={event.contact.avatar}
                  />
                  <div className="birthday-row-info">
                    <strong>{event.contact.name}</strong>
                    <p className="birthday-meta">
                      {birthdayLabel(event.contact)} ·{' '}
                      {relationships[event.contact.relationship]}
                      {event.occurrence.age != null
                        ? ` · ${event.occurrence.age} 岁`
                        : ''}
                    </p>
                  </div>
                  {event.occurrence.date === today && (
                    <Badge tone="warm">今天生日</Badge>
                  )}
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="这个月，留一点期待"
              description="所选范围内没有生日，试试其他月份或调整筛选。"
              icon={<CalendarDays size={30} />}
            />
          )
        ) : (
          <>
            <div className="calendar-weekdays">
              {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
                <div key={day}>周{day}</div>
              ))}
            </div>
            <div
              className={`calendar-grid ${view === 'week' ? 'calendar-week' : ''}`}
            >
              {Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => {
                const day = addDaysToDate(start, index);
                const items = dayEvents(day);
                return (
                  <div
                    className={`calendar-cell ${day.slice(0, 7) !== first.slice(0, 7) ? 'outside' : ''} ${day === today ? 'today' : ''}`}
                    key={day}
                  >
                    <button
                      className="calendar-day"
                      aria-label={`${day}，${items.length} 位生日`}
                      onClick={() => setSelectedDate(day)}
                    >
                      {Number(day.slice(8))}
                    </button>
                    {items.slice(0, view === 'week' ? 10 : 2).map((event) => (
                      <Link
                        className="calendar-event"
                        href={`/contacts/${event.contact.id}`}
                        key={event.contact.id}
                        title={`${event.contact.name} · ${birthdayLabel(event.contact)}`}
                      >
                        <Avatar
                          name={event.contact.name}
                          src={event.contact.avatar}
                          size="small"
                        />
                        <span>{event.contact.name}</span>
                      </Link>
                    ))}
                    {items.length > (view === 'week' ? 10 : 2) && (
                      <button
                        className="calendar-more"
                        onClick={() => setSelectedDate(day)}
                      >
                        +{items.length - (view === 'week' ? 10 : 2)} 位生日
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="calendar-legend">
          <span>
            <span className="color-dot" style={{ background: '#6366f1' }} />{' '}
            今天
          </span>
          <span>
            <span className="color-dot" style={{ background: '#c5bcec' }} />{' '}
            联系人生日
          </span>
          <span>时区：{workspace.timeZone}</span>
        </div>
      </Panel>
      <Modal
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
        title={
          selectedDate
            ? `${Number(selectedDate.slice(5, 7))}月${Number(selectedDate.slice(8))}日的生日`
            : ''
        }
        description="点击联系人，查看生日、礼物和祝福记录。"
      >
        {selectedDate && dayEvents(selectedDate).length ? (
          dayEvents(selectedDate).map((event) => (
            <Link
              href={`/contacts/${event.contact.id}`}
              key={event.contact.id}
              className="birthday-row"
            >
              <Avatar name={event.contact.name} src={event.contact.avatar} />
              <div className="birthday-row-info">
                <strong>{event.contact.name}</strong>
                <p className="birthday-meta">
                  {birthdayLabel(event.contact)}
                  {event.occurrence.age != null
                    ? ` · ${event.occurrence.age} 岁`
                    : ''}
                </p>
              </div>
              <ChevronRight size={16} />
            </Link>
          ))
        ) : (
          <EmptyState
            title="这一天还没有记录生日"
            description="想起了哪位重要的人？现在就把生日记下来。"
            action="添加联系人"
            href="/contacts/new"
          />
        )}
      </Modal>
    </>
  );
}
