import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContactGreetingForm } from '@/features/reminders';
import type { ContactDTO, Workspace } from '@/lib/types';

vi.mock('@/features/use-action', () => ({
  useAction: () => ({ pending: false, run: async () => ({ ok: true }) }),
}));

const contact: ContactDTO = {
  id: 'greeting-preview-contact',
  name: '小满',
  avatar: null,
  gender: null,
  birthdayType: 'SOLAR',
  birthYear: 1991,
  solarMonth: 6,
  solarDay: 15,
  lunarMonth: null,
  lunarDay: null,
  isLeapMonth: false,
  leapDayPolicy: 'FEB28',
  lunarLeapPolicy: 'REGULAR',
  relationship: 'FRIEND',
  email: 'friend@example.test',
  phone: 'private-phone',
  notes: 'private-note-not-for-recipient',
  createdAt: '2026-01-01T00:00:00.000Z',
  archivedAt: null,
  tags: [],
  next: null,
  greetingSetting: null,
  reminderSetting: null,
};
const workspace: Workspace = {
  user: { id: 'owner', name: '阿明', email: 'owner@example.test', image: null },
  timeZone: 'Asia/Shanghai',
  preference: { emailEnabled: false, daysBefore: [0], sendTime: '09:00' },
  contacts: [],
  tags: [],
  wishes: [],
  gifts: [],
  wishRecords: [],
  notifications: [],
  queue: [],
  emailLogs: [],
  smtpConfigured: false,
};

describe('birthday greeting editor', () => {
  it('previews the saved draft with its line breaks and escapes without exposing private contact fields', () => {
    const html = renderToStaticMarkup(
      createElement(ContactGreetingForm, {
        workspace,
        contact: {
          ...contact,
          greetingSetting: {
            enabled: false,
            sendTime: '08:35',
            message: '只属于我们的回忆 <一起出发>\n新的一岁，慢慢来。',
          },
        },
      }),
    );
    const preview = html.match(
      /<section[^>]*aria-label="生日邮件预览"[\s\S]*?<\/section>/,
    )?.[0];
    expect(preview).toBeDefined();
    expect(preview).toContain(
      '只属于我们的回忆 &lt;一起出发&gt;\n新的一岁，慢慢来。',
    );
    expect(preview).toContain('小满');
    expect(preview).toContain('阿明');
    expect(preview).not.toContain('private-note-not-for-recipient');
    expect(preview).not.toContain('private-phone');
    expect(preview).not.toContain('1991');
    expect(preview).not.toContain('/contacts/');
    expect(html).toMatch(
      /<textarea[^>]*maxLength="3000"[^>]*>只属于我们的回忆 &lt;一起出发&gt;\n新的一岁，慢慢来。<\/textarea>/i,
    );
  });

  it('offers explicit draft templates and labels the preview while leaving sending off by default', () => {
    const html = renderToStaticMarkup(
      createElement(ContactGreetingForm, { contact, workspace }),
    );
    expect(html).toContain('仅供预览');
    expect(html).toContain('aria-label="使用温柔日常模板"');
    expect(html).toContain('aria-label="使用默契好友模板"');
    expect(html).toContain('aria-label="使用俏皮庆生模板"');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toMatch(/<textarea[^>]*>[\s\S]*?\n[\s\S]*?<\/textarea>/);
    expect(html).toContain('保存生日祝福设置');
  });
});
