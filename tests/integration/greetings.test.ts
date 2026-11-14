import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { mutate, getWorkspace } from '@/services/domain';
import { generateReminders, processEmailQueue } from '@/services/reminders';
import { closeTransporter } from '@/services/email';
import { startSMTP } from '../helpers/smtp';
import { decodeMail } from '../e2e/mail-capture';

const now = new Date('2001-06-14T02:00:00Z');
const users: string[] = [];
let smtp: Awaited<ReturnType<typeof startSMTP>>;
async function fixture() {
  const id = 'test-greeting-' + randomUUID();
  users.push(id);
  return db.user.create({
    data: {
      id,
      name: 'Owner Name',
      email: id + '@example.test',
      emailVerified: true,
      reminderPreference: { create: { emailEnabled: false } },
      contacts: {
        create: {
          name: 'Friend Name',
          solarMonth: 6,
          solarDay: 14,
          email: 'friend@example.test',
          notes: 'INTERNAL_PRIVATE_NOTE',
        },
      },
    },
    include: { contacts: true },
  });
}
const settings = (contactId: string) => ({
  contactId,
  enabled: true,
  sendTime: '09:00',
  message: 'Have a wonderful birthday!',
});
beforeEach(async () => {
  smtp = await startSMTP();
  vi.stubEnv('SMTP_HOST', '127.0.0.1');
  vi.stubEnv('SMTP_PORT', String(smtp.port));
  vi.stubEnv('SMTP_SECURE', 'false');
  vi.stubEnv('SMTP_USER', '');
  vi.stubEnv('SMTP_PASS', '');
  vi.stubEnv('SMTP_FROM', 'bdaymate@example.test');
});
afterEach(async () => {
  closeTransporter();
  await smtp.close();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  await db.user.deleteMany({ where: { id: { in: users.splice(0) } } });
});
afterAll(async () => {
  await db.$disconnect();
});

it('persists opt-in and sends one private-safe greeting independent of self reminders', async () => {
  const user = await fixture();
  const contact = user.contacts[0];
  await mutate(user.id, 'saveContactGreeting', settings(contact.id));
  expect(
    (await getWorkspace(user.id)).contacts[0].greetingSetting,
  ).toMatchObject({
    enabled: true,
    sendTime: '09:00',
    message: 'Have a wonderful birthday!',
  });
  await Promise.all([
    generateReminders({ userId: user.id, now }),
    generateReminders({ userId: user.id, now }),
  ]);
  const jobs = await db.emailQueue.findMany({
    where: { userId: user.id, scheduledAt: { lte: now } },
  });
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    template: 'BIRTHDAY_GREETING',
    recipient: 'friend@example.test',
  });
  const results = await Promise.all([
    processEmailQueue({ userId: user.id, now }),
    processEmailQueue({ userId: user.id, now }),
  ]);
  expect(results.reduce((total, r) => total + r.sent, 0)).toBe(1);
  expect(smtp.messages).toHaveLength(1);
  expect(smtp.messages[0].recipient).toBe('friend@example.test');
  expect(decodeMail(smtp.messages[0].source)).toContain(
    'Have a wonderful birthday!',
  );
  expect(decodeMail(smtp.messages[0].source)).toContain('Owner Name');
  expect(decodeMail(smtp.messages[0].source)).not.toContain(
    'INTERNAL_PRIVATE_NOTE',
  );
  expect(decodeMail(smtp.messages[0].source)).not.toContain('/contacts/');
  await generateReminders({ userId: user.id, now });
  await processEmailQueue({ userId: user.id, now });
  expect(smtp.messages).toHaveLength(1);
});

it('never opts existing contacts in implicitly', async () => {
  const user = await fixture();
  await generateReminders({ userId: user.id, now });
  await processEmailQueue({ userId: user.id, now });
  expect(smtp.messages).toHaveLength(0);
  expect(await db.emailQueue.count({ where: { userId: user.id } })).toBe(0);
});

it('rejects foreign ownership, missing recipient, invalid time and blank greeting', async () => {
  const a = await fixture(),
    b = await fixture();
  const input = settings(a.contacts[0].id);
  await expect(mutate(b.id, 'saveContactGreeting', input)).rejects.toThrow();
  await expect(
    mutate(a.id, 'saveContactGreeting', { ...input, sendTime: '24:00' }),
  ).rejects.toThrow();
  await expect(
    mutate(a.id, 'saveContactGreeting', { ...input, message: '   ' }),
  ).rejects.toThrow();
  await db.contact.update({
    where: { id: a.contacts[0].id },
    data: { email: null },
  });
  await expect(mutate(a.id, 'saveContactGreeting', input)).rejects.toThrow();
  await expect(
    db.contactGreetingSetting.create({ data: { ...input, userId: b.id } }),
  ).rejects.toThrow();
});

it('sends both owner reminder and contact greeting with distinct recipients and content', async () => {
  const user = await fixture();
  await db.reminderPreference.update({
    where: { userId: user.id },
    data: { emailEnabled: true, daysBefore: [0] },
  });
  await mutate(user.id, 'saveContactGreeting', settings(user.contacts[0].id));
  await generateReminders({ userId: user.id, now });
  expect((await processEmailQueue({ userId: user.id, now })).sent).toBe(2);
  expect(smtp.messages.map((m) => m.recipient).sort()).toEqual(
    [user.email, 'friend@example.test'].sort(),
  );
  expect(
    decodeMail(smtp.messages.find((m) => m.recipient === user.email)!.source),
  ).toContain('INTERNAL_PRIVATE_NOTE');
  expect(
    decodeMail(
      smtp.messages.find((m) => m.recipient === 'friend@example.test')!.source,
    ),
  ).not.toContain('INTERNAL_PRIVATE_NOTE');
});

it('revalidates the recipient and greeting text immediately before sending', async () => {
  const user = await fixture();
  const id = user.contacts[0].id;
  await mutate(user.id, 'saveContactGreeting', settings(id));
  await generateReminders({ userId: user.id, now });
  await db.contact.update({
    where: { id },
    data: { email: 'changed@example.test' },
  });
  await db.contactGreetingSetting.update({
    where: { contactId: id },
    data: { message: 'Current wishes only' },
  });
  await processEmailQueue({ userId: user.id, now });
  expect(smtp.messages).toHaveLength(1);
  expect(smtp.messages[0].recipient).toBe('changed@example.test');
  expect(decodeMail(smtp.messages[0].source)).toContain('Current wishes only');
  expect(decodeMail(smtp.messages[0].source)).not.toContain(
    'Have a wonderful birthday!',
  );
  expect(
    await db.emailLog.findFirst({ where: { userId: user.id } }),
  ).toMatchObject({
    recipient: 'changed@example.test',
    template: 'BIRTHDAY_GREETING',
    status: 'SENT',
  });
});

it.each([
  'disabled',
  'archived',
  'no-email',
  'unverified',
  'birthday-moved',
] as const)('cancels a queued greeting after %s', async (change) => {
  const user = await fixture();
  const id = user.contacts[0].id;
  await mutate(user.id, 'saveContactGreeting', settings(id));
  await generateReminders({ userId: user.id, now });
  if (change === 'disabled')
    await db.contactGreetingSetting.update({
      where: { contactId: id },
      data: { enabled: false },
    });
  if (change === 'archived')
    await db.contact.update({ where: { id }, data: { archivedAt: now } });
  if (change === 'no-email')
    await db.contact.update({ where: { id }, data: { email: null } });
  if (change === 'birthday-moved')
    await db.contact.update({ where: { id }, data: { solarDay: 15 } });
  if (change === 'unverified')
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: false },
    });
  await processEmailQueue({ userId: user.id, now });
  expect(smtp.messages).toHaveLength(0);
  expect(
    await db.emailQueue.findFirst({
      where: { userId: user.id, scheduledAt: { lte: now } },
    }),
  ).toMatchObject({
    status: 'FAILED',
    lastError: expect.stringMatching(/^CANCELLED:/),
    attemptCount: 0,
  });
});

it('respects later local time and never sends a missed greeting after the birthday', async () => {
  const user = await fixture();
  const id = user.contacts[0].id;
  await mutate(user.id, 'saveContactGreeting', settings(id));
  await generateReminders({ userId: user.id, now });
  await db.contactGreetingSetting.update({
    where: { contactId: id },
    data: { sendTime: '12:00' },
  });
  await processEmailQueue({ userId: user.id, now });
  expect(smtp.messages).toHaveLength(0);
  expect(
    await db.emailQueue.findFirst({ where: { userId: user.id } }),
  ).toMatchObject({
    status: 'PENDING',
    scheduledAt: new Date('2001-06-14T04:00:00Z'),
    attemptCount: 0,
  });
  await processEmailQueue({
    userId: user.id,
    now: new Date('2001-06-15T02:00:00Z'),
  });
  expect(smtp.messages).toHaveLength(0);
});

it('plans the next year greeting and advance self reminder across December/January', async () => {
  const user = await fixture();
  const id = user.contacts[0].id;
  await db.contact.update({
    where: { id },
    data: { solarMonth: 1, solarDay: 1 },
  });
  await db.reminderPreference.update({
    where: { userId: user.id },
    data: { emailEnabled: true, daysBefore: [1, 0] },
  });
  await mutate(user.id, 'saveContactGreeting', settings(id));
  const at = new Date('2001-12-31T02:00:00Z');
  await generateReminders({ userId: user.id, now: at });
  const rows = await db.emailQueue.findMany({
    where: { userId: user.id, status: 'PENDING' },
    orderBy: { scheduledAt: 'asc' },
  });
  expect(rows).toHaveLength(3);
  expect(rows.map((j) => j.scheduledAt.toISOString())).toEqual([
    '2001-12-31T01:00:00.000Z',
    '2002-01-01T01:00:00.000Z',
    '2002-01-01T01:00:00.000Z',
  ]);
  await processEmailQueue({ userId: user.id, now: at });
  expect(smtp.messages.map((m) => m.recipient)).toEqual([user.email]);
  await processEmailQueue({
    userId: user.id,
    now: new Date('2002-01-01T02:00:00Z'),
  });
  expect(smtp.messages).toHaveLength(3);
});

it('retries an explicitly rejected greeting but quarantines ambiguous SMTP acceptance', async () => {
  const user = await fixture();
  await mutate(user.id, 'saveContactGreeting', settings(user.contacts[0].id));
  await generateReminders({ userId: user.id, now });
  smtp.state.reject = true;
  expect((await processEmailQueue({ userId: user.id, now })).failed).toBe(1);
  smtp.state.reject = false;
  smtp.state.acceptWithoutAck = true;
  const retryAt = new Date(now.getTime() + 60000);
  await processEmailQueue({ userId: user.id, now: retryAt });
  expect(smtp.messages).toHaveLength(1);
  const row = await db.emailQueue.findFirstOrThrow({
    where: { userId: user.id },
  });
  expect(row.lastError).toMatch(/^DELIVERY_UNCERTAIN:/);
  await generateReminders({ userId: user.id, now: retryAt });
  await processEmailQueue({
    userId: user.id,
    now: new Date(now.getTime() + 600000),
  });
  expect(smtp.messages).toHaveLength(1);
});

it('refreshes the production clock between sends when a batch crosses local midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2001-06-14T15:59:00Z'));
  const user = await fixture();
  const second = await db.contact.create({
    data: {
      userId: user.id,
      name: 'Second Friend',
      solarMonth: 6,
      solarDay: 14,
      email: 'second@example.test',
    },
  });
  for (const contact of [user.contacts[0], second])
    await mutate(user.id, 'saveContactGreeting', settings(contact.id));
  smtp.state.onAccepted = () =>
    vi.setSystemTime(new Date('2001-06-14T16:01:00Z'));
  await processEmailQueue({ userId: user.id, limit: 10 });
  expect(smtp.messages).toHaveLength(1);
  expect(
    await db.emailQueue.count({
      where: {
        userId: user.id,
        status: 'FAILED',
        lastError: { startsWith: 'CANCELLED:' },
      },
    }),
  ).toBe(1);
});
