import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { formatInTimeZone } from 'date-fns-tz';
import type { Prisma } from '@/generated/prisma/client';
import { db, type TransactionClient } from '@/lib/db';
import { DomainError, safeError } from '@/lib/errors';
import {
  BirthdayService,
  addDaysToDate,
  localDate,
  type BirthdayInput,
} from './birthday';
import { sendBirthdayReminderEmail, type BirthdayEmail } from './email';

/** Repeated wall times use the earlier instant; gaps advance by the gap length. */
export function reminderInstant(
  date: string,
  time: string,
  timeZone: string,
): Date {
  addDaysToDate(date, 0);
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    throw new RangeError('Invalid reminder send time.');
  }
  const wall = `${date}T${time}:00`;
  const nominal = Date.parse(`${wall}Z`);
  const pattern = "yyyy-MM-dd'T'HH:mm:ss";
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = nominal + hours * 3_600_000;
    offsets.add(
      Date.parse(formatInTimeZone(sample, timeZone, pattern) + 'Z') - sample,
    );
  }
  const candidates = [...offsets].map((offset) => ({
    instant: new Date(nominal - offset),
    wall: formatInTimeZone(nominal - offset, timeZone, pattern),
  }));
  const exact = candidates
    .filter((candidate) => candidate.wall === wall)
    .sort((a, b) => a.instant.getTime() - b.instant.getTime());
  if (exact.length) return exact[0].instant;
  const next = candidates
    .filter((candidate) => candidate.wall > wall)
    .sort(
      (a, b) =>
        a.wall.localeCompare(b.wall) ||
        a.instant.getTime() - b.instant.getTime(),
    );
  if (!next.length) throw new RangeError('Cannot resolve reminder timezone.');
  return next[0].instant;
}

const MAX_ATTEMPTS = 5;
const CANCELLED = 'CANCELLED: 提醒配置已变更或生日已过期';
const UNCERTAIN =
  'DELIVERY_UNCERTAIN: SMTP 可能已接受邮件，请核实投递记录；为避免重复，系统不会自动重发';
const userInclude = {
  profile: true,
  reminderPreference: true,
  contacts: { include: { reminderSetting: true } },
} as const;
type ReminderUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type ReminderPayload = Pick<
  BirthdayEmail,
  | 'contactName'
  | 'birthdayDate'
  | 'daysBefore'
  | 'relationship'
  | 'age'
  | 'notes'
> & { sendDate: string };
type PlannedReminder = {
  userId: string;
  contactId: string;
  recipient: string;
  template: string;
  subject: string;
  payload: ReminderPayload;
  scheduledAt: Date;
  dedupeKey: string;
};

export async function lockUser(
  tx: TransactionClient,
  userId: string,
): Promise<void> {
  // Return a supported scalar so Prisma need not decode PostgreSQL void.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
}

function planReminders(
  user: ReminderUser,
  now: Date,
): Map<string, PlannedReminder> {
  const plans = new Map<string, PlannedReminder>();
  if (!user.emailVerified || user.reminderPreference?.emailEnabled === false)
    return plans;
  const timeZone = user.profile?.timeZone || 'Asia/Shanghai';
  const today = localDate(now, timeZone);
  const lastSendDate = addDaysToDate(today, 45);
  for (const contact of user.contacts) {
    if (contact.archivedAt || contact.reminderSetting?.enabled === false)
      continue;
    const setting = contact.reminderSetting || user.reminderPreference;
    const days = setting?.daysBefore ?? [7, 3, 1, 0];
    if (
      !days.length ||
      days.length > 12 ||
      days.some((day) => !Number.isInteger(day) || day < 0 || day > 45)
    ) {
      throw new DomainError('提醒提前天数必须在 0–45 天内');
    }
    if (
      !['FEB28', 'MAR1'].includes(contact.leapDayPolicy) ||
      !['REGULAR', 'SKIP'].includes(contact.lunarLeapPolicy)
    ) {
      throw new DomainError('生日处理策略无效');
    }
    const birthday: BirthdayInput = {
      ...contact,
      leapDayPolicy: contact.leapDayPolicy as 'FEB28' | 'MAR1',
      lunarLeapPolicy: contact.lunarLeapPolicy as 'REGULAR' | 'SKIP',
    };
    const occurrences = BirthdayService.between(
      birthday,
      today,
      addDaysToDate(lastSendDate, Math.max(...days)),
      timeZone,
    );
    for (const occurrence of occurrences) {
      for (const daysBefore of new Set(days)) {
        const sendDate = addDaysToDate(occurrence.date, -daysBefore);
        if (sendDate > lastSendDate) continue;
        const dedupeKey = `birthday:${user.id}:${contact.id}:${occurrence.date}:${daysBefore}`;
        plans.set(dedupeKey, {
          userId: user.id,
          contactId: contact.id,
          recipient: user.email,
          template: 'BIRTHDAY',
          subject:
            daysBefore === 0
              ? `今天是 ${contact.name} 的生日`
              : `${contact.name} 的生日还有 ${daysBefore} 天`,
          payload: {
            contactName: contact.name,
            birthdayDate: occurrence.date,
            daysBefore,
            relationship: contact.relationship,
            age: occurrence.age,
            notes: contact.notes,
            sendDate,
          },
          scheduledAt: reminderInstant(
            sendDate,
            setting?.sendTime || '09:00',
            timeZone,
          ),
          dedupeKey,
        });
      }
    }
  }
  return plans;
}

/** Caller holds lockUser inside the same transaction as the domain change. */
export async function syncUserReminders(
  tx: TransactionClient,
  userId: string,
  now = new Date(),
): Promise<number> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    include: userInclude,
  });
  if (!user) return 0;
  const plans = planReminders(user, now);
  const existing = await tx.emailQueue.findMany({
    where: { userId, template: 'BIRTHDAY' },
  });
  const known = new Set(existing.map((job) => job.dedupeKey));
  const updates: {
    id: string;
    recipient: string;
    subject: string;
    payload: ReminderPayload;
    scheduledAt: string;
    status: 'PENDING' | 'FAILED';
    lastError: string | null;
  }[] = [];
  const obsolete: string[] = [];
  for (const job of existing) {
    if (
      job.status === 'SENT' ||
      job.status === 'PROCESSING' ||
      job.lastError?.startsWith('DELIVERY_UNCERTAIN:')
    )
      continue;
    const planned = plans.get(job.dedupeKey);
    if (!planned) {
      if (job.lastError !== CANCELLED) obsolete.push(job.id);
      continue;
    }
    const restored =
      job.lastError?.startsWith('CANCELLED:') &&
      job.attemptCount < MAX_ATTEMPTS;
    const scheduledAt = job.attemptCount
      ? new Date(
          Math.max(job.scheduledAt.getTime(), planned.scheduledAt.getTime()),
        )
      : planned.scheduledAt;
    if (
      job.recipient === planned.recipient &&
      job.subject === planned.subject &&
      JSON.stringify(job.payload) === JSON.stringify(planned.payload) &&
      scheduledAt.getTime() === job.scheduledAt.getTime() &&
      !restored
    )
      continue;
    updates.push({
      id: job.id,
      recipient: planned.recipient,
      subject: planned.subject,
      payload: planned.payload,
      scheduledAt: scheduledAt.toISOString(),
      status: restored ? 'PENDING' : (job.status as 'PENDING' | 'FAILED'),
      lastError: restored ? null : job.lastError,
    });
  }
  if (obsolete.length)
    await tx.emailQueue.updateMany({
      where: {
        userId,
        id: { in: obsolete },
        status: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        status: 'FAILED',
        lastError: CANCELLED,
        lockedAt: null,
        lockToken: null,
      },
    });
  if (updates.length)
    await tx.$executeRaw`
    UPDATE bday_email_queue AS q SET recipient = v.recipient, subject = v.subject, payload = v.payload,
      "scheduledAt" = v."scheduledAt", status = v.status::"EmailStatus", "lastError" = v."lastError", "updatedAt" = NOW()
    FROM jsonb_to_recordset(${JSON.stringify(updates)}::jsonb) AS v(id text, recipient text, subject text, payload jsonb, "scheduledAt" timestamp, status text, "lastError" text)
    WHERE q.id = v.id AND q."userId" = ${userId} AND q.status IN ('PENDING', 'FAILED')`;
  const today = localDate(now, user.profile?.timeZone || 'Asia/Shanghai');
  const additions = [...plans.values()].filter(
    (plan) => !known.has(plan.dedupeKey) && plan.payload.sendDate >= today,
  );
  if (!additions.length) return 0;
  const result = await tx.emailQueue.createMany({
    data: additions,
    skipDuplicates: true,
  });
  return result.count;
}

export async function generateReminders(
  options: { userId?: string; now?: Date } = {},
): Promise<{ generated: number; users: number }> {
  const now = options.now ?? new Date();
  const users = await db.user.findMany({
    where: {
      ...(options.userId ? { id: options.userId } : {}),
      emailVerified: true,
    },
    select: { id: true },
  });
  let generated = 0;
  for (const user of users) {
    generated += await db.$transaction(
      async (tx) => {
        await lockUser(tx, user.id);
        return syncUserReminders(tx, user.id, now);
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  }
  return { generated, users: users.length };
}

type Claim = { id: string; userId: string; lockToken: string };

function definitelyRejected(error: unknown): boolean {
  if (error instanceof DomainError) return true;
  if (!error || typeof error !== 'object') return false;
  const details = error as {
    code?: string;
    responseCode?: number;
    command?: string;
  };
  if (
    details.responseCode &&
    details.responseCode >= 400 &&
    details.responseCode < 600
  )
    return true;
  if (
    ['EAUTH', 'EENVELOPE', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS'].includes(
      details.code || '',
    )
  )
    return true;
  // Generic ECONNECTION / CONN errors also occur after accepted DATA. Only
  // explicit pre-DATA commands or rejection responses are safe to retry.
  return (
    ['ETIMEDOUT', 'ESOCKET'].includes(details.code || '') &&
    ['AUTH', 'EHLO', 'HELO', 'STARTTLS', 'MAIL FROM', 'RCPT TO'].includes(
      details.command || '',
    )
  );
}

async function quarantineExpiredClaims(
  now: Date,
  limit: number,
  userId?: string,
): Promise<void> {
  const cutoff = new Date(now.getTime() - 15 * 60_000);
  const expired = await db.emailQueue.findMany({
    where: {
      ...(userId ? { userId } : {}),
      template: 'BIRTHDAY',
      status: 'PROCESSING',
      OR: [{ lockedAt: { lte: cutoff } }, { lockedAt: null }],
    },
    select: { id: true, userId: true },
    take: limit,
  });
  for (const item of expired) {
    await db.$transaction(
      async (tx) => {
        await lockUser(tx, item.userId);
        const job = await tx.emailQueue.findFirst({
          where: {
            id: item.id,
            userId: item.userId,
            status: 'PROCESSING',
            OR: [{ lockedAt: { lte: cutoff } }, { lockedAt: null }],
          },
        });
        if (!job) return;
        const changed = await tx.emailQueue.updateMany({
          where: {
            id: job.id,
            userId: job.userId,
            status: 'PROCESSING',
            lockToken: job.lockToken,
          },
          data: {
            status: 'FAILED',
            lastError: UNCERTAIN,
            lockedAt: null,
            lockToken: null,
          },
        });
        if (changed.count)
          await tx.emailLog.create({
            data: {
              userId: job.userId,
              queueId: job.id,
              recipient: job.recipient,
              subject: job.subject,
              template: job.template,
              status: 'FAILED',
              error: UNCERTAIN,
            },
          });
      },
      { maxWait: 10_000, timeout: 60_000 },
    );
  }
}

async function claimDueJob(
  now: Date,
  userId?: string,
): Promise<Claim | undefined> {
  const token = randomUUID();
  const rows = await db.$queryRaw<Claim[]>`
    WITH due AS (
      SELECT id FROM bday_email_queue
      WHERE template = 'BIRTHDAY' AND status IN ('PENDING', 'FAILED') AND "attemptCount" < ${MAX_ATTEMPTS}
        AND "scheduledAt" <= ${now} AND (${userId ?? null}::text IS NULL OR "userId" = ${userId ?? null})
        AND ("lastError" IS NULL OR ("lastError" NOT LIKE 'CANCELLED:%' AND "lastError" NOT LIKE 'DELIVERY_UNCERTAIN:%'))
      ORDER BY "scheduledAt", id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE bday_email_queue AS q SET status = 'PROCESSING', "attemptCount" = q."attemptCount" + 1,
      "lockedAt" = ${now}, "lockToken" = ${token}, "updatedAt" = NOW()
    FROM due WHERE q.id = due.id RETURNING q.id, q."userId", q."lockToken"`;
  return rows[0];
}

async function deliverClaim(
  claim: Claim,
  now: Date,
): Promise<'sent' | 'failed' | 'skipped'> {
  // This same lock serializes contact/settings edits with the external SMTP send.
  // SMTP and DB are not a distributed transaction: accepted-but-uncommitted jobs
  // retain PROCESSING and become DELIVERY_UNCERTAIN, requiring provider review.
  return db.$transaction(
    async (tx) => {
      await lockUser(tx, claim.userId);
      const job = await tx.emailQueue.findFirst({
        where: {
          id: claim.id,
          userId: claim.userId,
          status: 'PROCESSING',
          lockToken: claim.lockToken,
        },
      });
      if (!job) return 'skipped';
      const user = await tx.user.findUnique({
        where: { id: claim.userId },
        include: userInclude,
      });
      const planned = user && planReminders(user, now).get(job.dedupeKey);
      const claimedWhere = {
        id: claim.id,
        userId: claim.userId,
        status: 'PROCESSING' as const,
        lockToken: claim.lockToken,
      };
      if (!planned) {
        await tx.emailQueue.updateMany({
          where: claimedWhere,
          data: {
            status: 'FAILED',
            lastError: CANCELLED,
            attemptCount: job.attemptCount - 1,
            lockedAt: null,
            lockToken: null,
          },
        });
        return 'skipped';
      }
      if (planned.scheduledAt > now) {
        await tx.emailQueue.updateMany({
          where: claimedWhere,
          data: {
            status: 'PENDING',
            scheduledAt: planned.scheduledAt,
            recipient: planned.recipient,
            subject: planned.subject,
            payload: planned.payload,
            attemptCount: job.attemptCount - 1,
            lockedAt: null,
            lockToken: null,
          },
        });
        return 'skipped';
      }
      const today = localDate(now, user.profile?.timeZone || 'Asia/Shanghai');
      const daysBefore =
        (Date.parse(planned.payload.birthdayDate) - Date.parse(today)) /
        86_400_000;
      const subject =
        daysBefore === 0
          ? `今天是 ${planned.payload.contactName} 的生日`
          : `${planned.payload.contactName} 的生日还有 ${daysBefore} 天`;
      const messageId = `<bdaymate-${createHash('sha256').update(job.dedupeKey).digest('hex')}@bdaymate.local>`;
      let result: { messageId: string };
      try {
        result = await sendBirthdayReminderEmail(
          {
            ...planned.payload,
            daysBefore,
            userId: job.userId,
            recipient: user.email,
            contactId: planned.contactId,
            queueId: job.id,
            messageId,
          },
          { log: false },
        );
      } catch (error) {
        const lastError = definitelyRejected(error)
          ? safeError(error)
          : UNCERTAIN;
        await tx.emailQueue.updateMany({
          where: claimedWhere,
          data: {
            status: 'FAILED',
            lastError,
            recipient: user.email,
            subject,
            payload: planned.payload,
            scheduledAt: new Date(
              now.getTime() + 60_000 * 2 ** (job.attemptCount - 1),
            ),
            lockedAt: null,
            lockToken: null,
          },
        });
        await tx.emailLog.create({
          data: {
            userId: job.userId,
            queueId: job.id,
            recipient: user.email,
            subject,
            template: job.template,
            status: 'FAILED',
            error: lastError,
          },
        });
        return 'failed';
      }
      await tx.emailQueue.updateMany({
        where: claimedWhere,
        data: {
          status: 'SENT',
          sentAt: now,
          recipient: user.email,
          subject,
          payload: planned.payload,
          lastError: null,
          lockedAt: null,
          lockToken: null,
        },
      });
      await tx.emailLog.create({
        data: {
          userId: job.userId,
          queueId: job.id,
          recipient: user.email,
          subject,
          template: job.template,
          status: 'SENT',
          sentAt: now,
          messageId: result.messageId,
        },
      });
      return 'sent';
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

export async function processEmailQueue(
  options: { userId?: string; now?: Date; limit?: number } = {},
): Promise<{ sent: number; failed: number; processed: number }> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new DomainError('单次队列处理数量必须在 1–100 之间');
  if (!Number.isFinite(now.getTime())) throw new DomainError('任务时间无效');
  await quarantineExpiredClaims(now, limit, options.userId);
  const result = { sent: 0, failed: 0, processed: 0 };
  for (let i = 0; i < limit; i++) {
    const job = await claimDueJob(now, options.userId);
    if (!job) break;
    const status = await deliverClaim(job, now);
    if (status !== 'skipped') {
      result[status]++;
      result.processed++;
    }
  }
  return result;
}

export async function retryFailedEmail(
  userId: string,
  id: string,
): Promise<void> {
  await db.$transaction(
    async (tx) => {
      await lockUser(tx, userId);
      const job = await tx.emailQueue.findFirst({
        where: { id, userId, template: 'BIRTHDAY' },
      });
      if (!job) throw new DomainError('邮件任务不存在或无权访问', 404);
      if (
        job.status !== 'FAILED' ||
        job.attemptCount >= MAX_ATTEMPTS ||
        job.lastError?.startsWith('DELIVERY_UNCERTAIN:') ||
        job.lastError?.startsWith('CANCELLED:')
      ) {
        throw new DomainError('该任务不能安全重试，请先检查投递记录或提醒设置');
      }
      const now = new Date();
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: userInclude,
      });
      const planned = user && planReminders(user, now).get(job.dedupeKey);
      if (!planned)
        throw new DomainError('提醒已失效，请检查账户、联系人和提醒设置');
      await tx.emailQueue.updateMany({
        where: { id, userId, status: 'FAILED' },
        data: {
          status: 'PENDING',
          lastError: null,
          scheduledAt: new Date(
            Math.max(now.getTime(), planned.scheduledAt.getTime()),
          ),
          recipient: planned.recipient,
          subject: planned.subject,
          payload: planned.payload,
          lockedAt: null,
          lockToken: null,
        },
      });
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}
