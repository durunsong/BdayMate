import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BirthdayCalendar } from '@/features/calendar';
import { Dashboard } from '@/features/dashboard';
import type { ContactDTO, Workspace } from '@/lib/types';

const contact = (overrides: Partial<ContactDTO> = {}): ContactDTO => ({
  id: 'lunar-contact',
  name: '农历寿星',
  avatar: null,
  gender: null,
  birthdayType: 'LUNAR',
  birthYear: null,
  solarMonth: null,
  solarDay: null,
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
  leapDayPolicy: 'FEB28',
  lunarLeapPolicy: 'REGULAR',
  relationship: 'FRIEND',
  email: null,
  phone: null,
  notes: null,
  createdAt: '2024-01-01T00:00:00Z',
  archivedAt: null,
  tags: [],
  next: null,
  reminderSetting: null,
  greetingSetting: null,
  ...overrides,
});
const workspace = (contacts: ContactDTO[]): Workspace => ({
  user: {
    id: 'owner',
    name: '测试用户',
    email: 'owner@example.test',
    image: null,
  },
  timeZone: 'Asia/Shanghai',
  contacts,
  tags: [],
  wishes: [],
  gifts: [],
  wishRecords: [],
  notifications: [],
  queue: [],
  emailLogs: [],
  preference: { emailEnabled: false, daysBefore: [], sendTime: '09:00' },
  smtpConfigured: false,
});
const freeze = (instant: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));
};
afterEach(() => vi.useRealTimers());

describe('birthday display boundaries', () => {
  it('shows the final supported lunar birthday in the January 2101 grid', () => {
    freeze('2101-01-28T00:00:00Z');
    const html = renderToStaticMarkup(
      createElement(BirthdayCalendar, {
        workspace: workspace([contact({ lunarMonth: 12, lunarDay: 30 })]),
      }),
    );
    expect(html).toContain('2101-01-28，1 位生日');
    expect(html).toContain('value="2101" selected=""');
    expect(html).toContain('超出部分不参与显示');
  });

  it('keeps both birthdays of one lunar contact in the Gregorian year distribution', () => {
    freeze('2024-01-01T00:00:00Z');
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        workspace: workspace([
          contact({ lunarMonth: 12 }),
          contact({ id: 'archived', archivedAt: '2023-12-01T00:00:00Z' }),
        ]),
      }),
    );
    expect(html).toContain('1月1人，2月0人');
    expect(html).toContain('11月0人，12月1人');
    expect(html.match(/联系人总数.*?stat-value">([0-9]+)<small>/s)?.[1]).toBe(
      '1',
    );
  });

  it('counts upcoming birthdays across New Year using the user timezone', () => {
    freeze('2025-01-01T02:00:00Z');
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        workspace: {
          ...workspace([
            contact({
              birthdayType: 'SOLAR',
              solarMonth: 1,
              solarDay: 1,
              lunarMonth: null,
              lunarDay: null,
              next: { date: '2025-01-01', daysUntil: 0, age: null },
            }),
          ]),
          timeZone: 'America/Los_Angeles',
        },
      }),
    );
    expect(html.match(/今日生日.*?stat-value">([0-9]+)<small>/s)?.[1]).toBe(
      '0',
    );
    expect(html.match(/未来 7 天.*?stat-value">([0-9]+)<small>/s)?.[1]).toBe(
      '1',
    );
    expect(html.match(/未来 30 天.*?stat-value">([0-9]+)<small>/s)?.[1]).toBe(
      '1',
    );
  });

  it('keeps the supported birthday when a month grid crosses the lunar lower bound', () => {
    freeze('1900-01-31T00:00:00Z');
    const html = renderToStaticMarkup(
      createElement(BirthdayCalendar, {
        workspace: workspace([contact()]),
      }),
    );
    expect(html).toContain('1900-01-31，1 位生日');
    expect(html).not.toContain('农历寿星。');
  });

  it('counts the supported January birthday at the lunar lower bound', () => {
    freeze('1900-01-31T00:00:00Z');
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        workspace: workspace([contact()]),
      }),
    );
    expect(html.match(/本月生日.*?stat-value">([0-9]+)<small>/s)?.[1]).toBe(
      '1',
    );
  });

  it('derives today and birthday age from the current civil date instead of a stale snapshot', () => {
    freeze('2025-01-28T16:00:00Z');
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        workspace: workspace([
          contact({
            birthYear: 2000,
            next: { date: '2025-01-29', daysUntil: 1, age: 25 },
          }),
        ]),
      }),
    );
    expect(html.match(/今日生日.*?stat-value">([0-9]+)<small>/s)?.[1]).toBe(
      '1',
    );
    expect(html).toContain('25 岁生日快乐');
  });

  it('shows invalid birthdays beside statistics instead of silently treating them as zero', () => {
    freeze('2025-01-29T00:00:00Z');
    const html = renderToStaticMarkup(
      createElement(Dashboard, {
        workspace: workspace([
          contact({ name: '日期异常联系人', lunarDay: 31 }),
        ]),
      }),
    );
    expect(html).toMatch(/role="alert"[^>]*>.*?日期异常联系人/s);
  });
});
