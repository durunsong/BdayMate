import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { db } from '../../src/lib/db';
import {
  generateReminders,
  lockUser,
  syncUserReminders,
  processEmailQueue,
  retryFailedEmail,
} from '../../src/services/reminders';

import { closeTransporter } from '../../src/services/email';
import { startSMTP } from '../helpers/smtp';

const now = new Date('2001-06-14T02:00:00.000Z');
const users: string[] = [];
async function fixture(day = 21) {
  const id = `test-reminders-${randomUUID()}`;
  users.push(id);
  return db.user.create({
    data: {
      id,
      name: 'Reminder test',
      email: `${id}@example.test`,
      emailVerified: true,
      contacts: {
        create: {
          name: '生日朋友',
          solarMonth: 6,
          solarDay: day,
          email: 'never-send-to-contact@example.test',
        },
      },
    },
    include: { contacts: true },
  });
}
async function sync(userId: string) {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    return syncUserReminders(tx, userId, now);
  });
}
afterEach(async () => {
  await db.user.deleteMany({ where: { id: { in: users.splice(0) } } });
});
afterAll(async () => {
  await db.$disconnect();
});

describe('persisted reminder planning', () => {
  it('generates defaults once under concurrent calls and addresses the owner', async () => {
    const user = await fixture();
    const results = await Promise.all([
      generateReminders({ userId: user.id, now }),
      generateReminders({ userId: user.id, now }),
    ]);
    const rows = await db.emailQueue.findMany({
      where: { userId: user.id },
      orderBy: { scheduledAt: 'asc' },
    });
    expect(results.reduce((sum, result) => sum + result.generated, 0)).toBe(4);
    expect(rows).toHaveLength(4);
    expect(rows[0].scheduledAt.toISOString()).toBe('2001-06-14T01:00:00.000Z');
    expect(rows.every((row) => row.recipient === user.email)).toBe(true);
  });

  it('includes advance reminders whose birthday falls beyond the 45-day horizon', async () => {
    const user = await fixture();
    await db.contact.update({
      where: { id: user.contacts[0].id },
      data: {
        solarMonth: 8,
        solarDay: 15,
        reminderSetting: { create: { daysBefore: [45], sendTime: '09:00' } },
      },
    });
    await generateReminders({ userId: user.id, now });
    const rows = await db.emailQueue.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].scheduledAt.toISOString()).toBe('2001-07-01T01:00:00.000Z');
  });

  it('queues an overdue same-day send but never invents past lead reminders', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    expect(await db.emailQueue.count({ where: { userId: user.id } })).toBe(1);
  });

  it('refreshes current email, contact content and timezone while preserving sent dedupe', async () => {
    const user = await fixture();
    await generateReminders({ userId: user.id, now });
    const sent = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { scheduledAt: 'asc' },
    });
    await db.emailQueue.update({
      where: { id: sent.id },
      data: { status: 'SENT', sentAt: now },
    });
    await db.user.update({
      where: { id: user.id },
      data: {
        email: `${user.id}-new@example.test`,
        profile: { create: { timeZone: 'America/New_York' } },
      },
    });
    await db.contact.update({
      where: { id: user.contacts[0].id },
      data: { name: '新名字', notes: '新备注' },
    });
    await sync(user.id);
    const pending = await db.emailQueue.findMany({
      where: { userId: user.id, status: 'PENDING' },
      orderBy: { scheduledAt: 'asc' },
    });
    expect(pending).toHaveLength(3);
    expect(pending[0].scheduledAt.toISOString()).toBe(
      '2001-06-18T13:00:00.000Z',
    );
    expect(pending[0].recipient).toBe(`${user.id}-new@example.test`);
    expect(pending[0].payload).toMatchObject({
      contactName: '新名字',
      notes: '新备注',
    });
    expect(
      await db.emailQueue.count({ where: { userId: user.id, status: 'SENT' } }),
    ).toBe(1);
  });

  it('replaces an edited birthday occurrence while retaining obsolete dedupe records', async () => {
    const user = await fixture();
    await generateReminders({ userId: user.id, now });
    await db.contact.update({
      where: { id: user.contacts[0].id },
      data: { solarDay: 22 },
    });
    await sync(user.id);
    const pending = await db.emailQueue.findMany({
      where: { userId: user.id, status: 'PENDING' },
      orderBy: { scheduledAt: 'asc' },
    });
    expect(pending).toHaveLength(4);
    expect(pending[0].scheduledAt.toISOString()).toBe(
      '2001-06-15T01:00:00.000Z',
    );
    expect(
      await db.emailQueue.count({
        where: {
          userId: user.id,
          status: 'FAILED',
          lastError: { startsWith: 'CANCELLED:' },
        },
      }),
    ).toBe(4);
  });

  it('invalidates unsent jobs when archived, globally disabled or unverified', async () => {
    const user = await fixture();
    await generateReminders({ userId: user.id, now });
    await db.contact.update({
      where: { id: user.contacts[0].id },
      data: { archivedAt: now },
    });
    await sync(user.id);
    expect(
      await db.emailQueue.count({
        where: { userId: user.id, status: 'PENDING' },
      }),
    ).toBe(0);
    await db.contact.update({
      where: { id: user.contacts[0].id },
      data: { archivedAt: null },
    });
    await sync(user.id);
    expect(
      await db.emailQueue.count({
        where: { userId: user.id, status: 'PENDING' },
      }),
    ).toBe(4);
    await db.reminderPreference.create({
      data: { userId: user.id, emailEnabled: false },
    });
    await sync(user.id);
    expect(
      await db.emailQueue.count({
        where: { userId: user.id, status: 'PENDING' },
      }),
    ).toBe(0);
    await db.reminderPreference.update({
      where: { userId: user.id },
      data: { emailEnabled: true },
    });
    await db.user.update({
      where: { id: user.id },
      data: { emailVerified: false },
    });
    await sync(user.id);
    expect(
      await db.emailQueue.count({
        where: { userId: user.id, status: 'PENDING' },
      }),
    ).toBe(0);
  });
});

describe('atomic SMTP worker', () => {
  let smtp: Awaited<ReturnType<typeof startSMTP>>;
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
    if (smtp) await smtp.close();
    vi.unstubAllEnvs();
  });

  it('sends once across concurrent workers and revalidates the current account recipient', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    const recipient = `${user.id}-changed@example.test`;
    await db.user.update({
      where: { id: user.id },
      data: { email: recipient },
    });
    const results = await Promise.all([
      processEmailQueue({ userId: user.id, now, limit: 1 }),
      processEmailQueue({ userId: user.id, now, limit: 1 }),
    ]);
    expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(1);
    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0].recipient).toBe(recipient);
    expect(smtp.messages[0].source).toContain('Message-ID:');
    const queue = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(queue.status).toBe('SENT');
    expect(queue.attemptCount).toBe(1);
    expect(
      await db.emailLog.count({ where: { userId: user.id, status: 'SENT' } }),
    ).toBe(1);
    await generateReminders({ userId: user.id, now });
    await processEmailQueue({ userId: user.id, now, limit: 1 });
    expect(smtp.messages).toHaveLength(1);
  });

  it('limits both claims and expired-processing maintenance to the requested owner', async () => {
    const user = await fixture(14);
    const other = await fixture(14);
    await db.contact.create({
      data: {
        userId: other.id,
        name: 'Other contact',
        solarMonth: 6,
        solarDay: 14,
      },
    });
    await generateReminders({ userId: user.id, now });
    await generateReminders({ userId: other.id, now });
    const otherJob = await db.emailQueue.findFirstOrThrow({
      where: { userId: other.id },
    });
    await db.emailQueue.update({
      where: { id: otherJob.id },
      data: {
        status: 'PROCESSING',
        lockedAt: new Date(now.getTime() - 20 * 60_000),
        lockToken: 'another-owner-claim',
      },
    });
    await processEmailQueue({ userId: user.id, now, limit: 10 });
    expect(smtp.messages.map((message) => message.recipient)).toEqual([
      user.email,
    ]);
    expect(
      await db.emailQueue.count({
        where: { userId: other.id, status: 'PROCESSING' },
      }),
    ).toBe(1);
    expect(
      await db.emailQueue.count({
        where: { userId: other.id, status: 'PENDING' },
      }),
    ).toBe(1);
    expect(await db.emailLog.count({ where: { userId: other.id } })).toBe(0);
  });

  it('does not resend when SMTP receives DATA but the acknowledgement is lost', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    smtp.state.acceptWithoutAck = true;
    await processEmailQueue({ userId: user.id, now, limit: 1 });
    expect(smtp.messages).toHaveLength(1);
    const job = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(job.status).toBe('FAILED');
    expect(job.lastError).toMatch(/^DELIVERY_UNCERTAIN:/);
    await processEmailQueue({
      userId: user.id,
      now: new Date(now.getTime() + 60_000),
      limit: 1,
    });
    expect(smtp.messages).toHaveLength(1);
  });

  it('cancels stale snapshots when account configuration disables delivery', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    await db.reminderPreference.create({
      data: { userId: user.id, emailEnabled: false },
    });
    await processEmailQueue({ userId: user.id, now, limit: 1 });
    expect(smtp.messages).toHaveLength(0);
    const queue = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(queue.lastError).toMatch(/^CANCELLED:/);
    expect(queue.attemptCount).toBe(0);
  });

  it('defers a claimed job when current send time is now later', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    await db.reminderPreference.create({
      data: { userId: user.id, sendTime: '12:00' },
    });
    await processEmailQueue({ userId: user.id, now, limit: 1 });
    expect(smtp.messages).toHaveLength(0);
    const queue = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(queue.status).toBe('PENDING');
    expect(queue.scheduledAt.toISOString()).toBe('2001-06-14T04:00:00.000Z');
    expect(queue.attemptCount).toBe(0);
  });

  it('uses exponential backoff, preserves failures across generation, and stops after five attempts', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    smtp.state.reject = true;
    let at = now;
    for (let attempt = 1; attempt <= 5; attempt++) {
      const result = await processEmailQueue({
        userId: user.id,
        now: at,
        limit: 1,
      });
      expect(result).toEqual({ sent: 0, failed: 1, processed: 1 });
      let row = await db.emailQueue.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(row.status).toBe('FAILED');
      expect(row.attemptCount).toBe(attempt);
      expect(row.scheduledAt.getTime() - at.getTime()).toBe(
        60_000 * 2 ** (attempt - 1),
      );
      const scheduledAt = row.scheduledAt;
      await generateReminders({ userId: user.id, now: at });
      row = await db.emailQueue.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(row.attemptCount).toBe(attempt);
      expect(row.scheduledAt).toEqual(scheduledAt);
      at = scheduledAt;
    }
    expect(
      await processEmailQueue({ userId: user.id, now: at, limit: 1 }),
    ).toEqual({ sent: 0, failed: 0, processed: 0 });
    expect(
      await db.emailLog.count({ where: { userId: user.id, status: 'FAILED' } }),
    ).toBe(5);
  }, 60_000);

  it('cancels missed lead-day reminders instead of flooding the next day', async () => {
    const user = await fixture(21);
    await generateReminders({ userId: user.id, now });
    const missed = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { scheduledAt: 'asc' },
    });
    await processEmailQueue({
      userId: user.id,
      now: new Date('2001-06-15T02:00:00Z'),
      limit: 10,
    });
    expect(smtp.messages).toHaveLength(0);
    expect(
      await db.emailQueue.findUnique({ where: { id: missed.id } }),
    ).toMatchObject({
      lastError: expect.stringMatching(/^CANCELLED:/),
      attemptCount: 0,
    });
  });

  it('expires an overdue reminder after the birthday instead of mailing an obsolete date', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    await processEmailQueue({
      userId: user.id,
      now: new Date('2001-06-15T02:00:00Z'),
      limit: 1,
    });
    expect(smtp.messages).toHaveLength(0);
    const row = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(row.lastError).toMatch(/^CANCELLED:/);
    expect(row.attemptCount).toBe(0);
  });

  it('quarantines expired processing claims without resending an ambiguous SMTP result', async () => {
    const user = await fixture(14);
    await generateReminders({ userId: user.id, now });
    const row = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    await db.emailQueue.update({
      where: { id: row.id },
      data: {
        status: 'PROCESSING',
        attemptCount: 1,
        lockedAt: new Date(now.getTime() - 20 * 60_000),
        lockToken: 'interrupted-worker',
      },
    });
    await processEmailQueue({ userId: user.id, now, limit: 1 });
    expect(smtp.messages).toHaveLength(0);
    const failed = await db.emailQueue.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.lastError).toMatch(/^DELIVERY_UNCERTAIN:/);
    await generateReminders({ userId: user.id, now });
    await processEmailQueue({ userId: user.id, now, limit: 1 });
    expect(smtp.messages).toHaveLength(0);
    await expect(retryFailedEmail(user.id, row.id)).rejects.toThrow();
  });
});

describe('manual failure retry ownership', () => {
  it('retries only owned, still-valid, safe failed jobs without resetting attempts', async () => {
    const user = await fixture();
    const current = new Date();
    const next = new Date(current.getTime() + 86_400_000);
    await db.contact.update({
      where: { id: user.contacts[0].id },
      data: { solarMonth: next.getUTCMonth() + 1, solarDay: next.getUTCDate() },
    });
    await db.profile.create({ data: { userId: user.id, timeZone: 'UTC' } });
    await generateReminders({ userId: user.id, now: current });
    const row = await db.emailQueue.findFirstOrThrow({
      where: { userId: user.id },
    });
    await db.emailQueue.update({
      where: { id: row.id },
      data: { status: 'FAILED', attemptCount: 1, lastError: 'SMTP 连接失败' },
    });
    await expect(retryFailedEmail('another-user', row.id)).rejects.toThrow();
    await retryFailedEmail(user.id, row.id);
    const updated = await db.emailQueue.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(updated.status).toBe('PENDING');
    expect(updated.attemptCount).toBe(1);
    await db.emailQueue.update({
      where: { id: row.id },
      data: { status: 'FAILED', attemptCount: 5 },
    });
    await expect(retryFailedEmail(user.id, row.id)).rejects.toThrow();
  });
});
