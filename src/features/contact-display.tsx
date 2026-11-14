import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui';
import { relationships, type ContactDTO } from '@/lib/types';
export function birthdayLabel(contact: ContactDTO): string {
  return contact.birthdayType === 'LUNAR'
    ? `农历 ${contact.isLeapMonth ? '闰' : ''}${contact.lunarMonth}月${contact.lunarDay}日`
    : `${contact.solarMonth}月${contact.solarDay}日`;
}
export function shortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(month)}月${Number(day)}日`;
}
export function ContactBirthdayRow({ contact }: { contact: ContactDTO }) {
  return (
    <div className="birthday-row">
      <Link href={`/contacts/${contact.id}`} tabIndex={-1} aria-hidden>
        <Avatar name={contact.name} src={contact.avatar} />
      </Link>
      <div className="birthday-row-info">
        <div className="birthday-name">
          <Link
            className="birthday-row-name-link"
            href={`/contacts/${contact.id}`}
          >
            {contact.name}
          </Link>
          <Badge>{relationships[contact.relationship]}</Badge>
        </div>
        <div className="birthday-meta">
          <span>{birthdayLabel(contact)}</span>
          {contact.next?.age != null && <span>即将 {contact.next.age} 岁</span>}
          {contact.tags.slice(0, 1).map((tag) => (
            <span key={tag.id}>{tag.name}</span>
          ))}
        </div>
      </div>
      <div
        className={`countdown ${contact.next?.daysUntil === 0 ? 'today' : ''}`}
      >
        {contact.next ? (
          <>
            <strong>
              {contact.next.daysUntil === 0 ? '今天' : contact.next.daysUntil}
            </strong>
            {contact.next.daysUntil !== 0 && ' 天后'}
            <small>{shortDate(contact.next.date)}</small>
          </>
        ) : (
          <span>日期待检查</span>
        )}
      </div>
      <Link
        href={`/contacts/${contact.id}`}
        className="button button-ghost button-icon"
        aria-label={`查看${contact.name}`}
      >
        <ChevronRight size={16} />
      </Link>
    </div>
  );
}
