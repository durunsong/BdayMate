import 'server-only';
import { cache } from 'react';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, type TransactionClient } from '@/lib/db';
import { DomainError } from '@/lib/errors';
import {
  contactSchema,
  tagSchema,
  wishSchema,
  giftSchema,
  profileSchema,
  preferenceSchema,
  contactReminderSchema,
  idSchema,
} from '@/lib/validation';
import { BirthdayService, type BirthdayInput } from './birthday';
import {
  lockUser,
  syncUserReminders,
  generateReminders,
  retryFailedEmail,
} from './reminders';
import { smtpConfigured } from '@/lib/email-config';
import { sendTestEmail } from './email';
import { contactsFromCsv, contactsToCsv } from './contact-csv';
import type { Workspace, ContactDTO, TagDTO } from '@/lib/types';

const idInput = z.object({ id: idSchema });
async function ownedContact(tx: TransactionClient, userId: string, id: string) {
  const contact = await tx.contact.findFirst({ where: { id, userId } });
  if (!contact) throw new DomainError('联系人不存在或无权访问', 404);
  return contact;
}
async function verifiedUser(userId: string) {
  const user = await db.user.findFirst({
    where: { id: userId, emailVerified: true },
    select: { id: true, name: true, email: true, image: true },
  });
  if (!user) throw new DomainError('请先登录并验证邮箱', 401);
  return user;
}
function assertAffected(count: number) {
  if (!count) throw new DomainError('记录不存在或无权访问', 404);
}

async function readWorkspace(userId: string): Promise<Workspace> {
  const user = await verifiedUser(userId);
  const [
    profile,
    preference,
    contacts,
    tags,
    wishes,
    gifts,
    notifications,
    queue,
    emailLogs,
    wishRecords,
  ] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.reminderPreference.findUnique({ where: { userId } }),
    db.contact.findMany({
      where: { userId },
      include: { tags: { include: { tag: true } }, reminderSetting: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.tag.findMany({
      where: { userId },
      include: { _count: { select: { contacts: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.wishTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    db.giftRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    db.emailQueue.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'asc' },
    }),
    db.emailLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    db.wishRecord.findMany({ where: { userId }, orderBy: { sentAt: 'desc' } }),
  ]);
  const timeZone = profile?.timeZone || 'Asia/Shanghai';
  const tagDtos: TagDTO[] = tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    description: t.description,
    count: t._count.contacts,
  }));
  const contactDtos: ContactDTO[] = contacts.map((c) => {
    const birthday = {
      birthdayType: c.birthdayType,
      birthYear: c.birthYear,
      solarMonth: c.solarMonth,
      solarDay: c.solarDay,
      lunarMonth: c.lunarMonth,
      lunarDay: c.lunarDay,
      isLeapMonth: c.isLeapMonth,
      leapDayPolicy: c.leapDayPolicy as BirthdayInput['leapDayPolicy'],
      lunarLeapPolicy: c.lunarLeapPolicy as BirthdayInput['lunarLeapPolicy'],
    };
    let next: ContactDTO['next'] = null;
    let birthdayError: string | undefined;
    try {
      next = BirthdayService.next(birthday, timeZone);
    } catch (e) {
      birthdayError = e instanceof Error ? e.message : '生日日期超出支持范围';
    }
    return {
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      gender: c.gender,
      ...birthday,
      leapDayPolicy: c.leapDayPolicy as 'FEB28' | 'MAR1',
      lunarLeapPolicy: c.lunarLeapPolicy as 'REGULAR' | 'SKIP',
      relationship: c.relationship,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      archivedAt: c.archivedAt?.toISOString() || null,
      tags: c.tags
        .map((ct) => tagDtos.find((t) => t.id === ct.tagId)!)
        .filter(Boolean),
      next,
      birthdayError,
      reminderSetting: c.reminderSetting
        ? {
            enabled: c.reminderSetting.enabled,
            daysBefore: c.reminderSetting.daysBefore,
            sendTime: c.reminderSetting.sendTime,
          }
        : null,
    };
  });
  return {
    user,
    timeZone,
    preference: preference
      ? {
          emailEnabled: preference.emailEnabled,
          daysBefore: preference.daysBefore,
          sendTime: preference.sendTime,
        }
      : { emailEnabled: true, daysBefore: [7, 3, 1, 0], sendTime: '09:00' },
    contacts: contactDtos,
    tags: tagDtos,
    wishes: wishes.map((w) => ({
      id: w.id,
      title: w.title,
      content: w.content,
      relationship: w.relationship,
    })),
    gifts: gifts.map((g) => ({
      id: g.id,
      contactId: g.contactId,
      name: g.name,
      description: g.description,
      budget: g.budget?.toFixed(2) || null,
      currency: g.currency,
      purchaseUrl: g.purchaseUrl,
      givenAt: g.givenAt?.toISOString().slice(0, 10) || null,
      status: g.status,
    })),
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt?.toISOString() || null,
      createdAt: n.createdAt.toISOString(),
    })),
    queue: queue.map((q) => ({
      id: q.id,
      subject: q.subject,
      recipient: q.recipient,
      scheduledAt: q.scheduledAt.toISOString(),
      status: q.status,
      attemptCount: q.attemptCount,
      lastError: q.lastError,
    })),
    emailLogs: emailLogs.map((l) => ({
      id: l.id,
      subject: l.subject,
      recipient: l.recipient,
      template: l.template,
      status: l.status,
      error: l.error,
      sentAt: l.sentAt?.toISOString() || null,
      createdAt: l.createdAt.toISOString(),
    })),
    wishRecords: wishRecords.map((w) => ({
      id: w.id,
      contactId: w.contactId,
      content: w.content,
      sentAt: w.sentAt.toISOString(),
    })),
    smtpConfigured: smtpConfigured(),
  };
}

export const getWorkspace = cache(readWorkspace);

export async function mutate(
  userId: string,
  name: string,
  input: unknown,
): Promise<{ message: string; data?: unknown }> {
  const user = await verifiedUser(userId);
  if (name === 'generateReminders') {
    const result = await generateReminders({ userId });
    return { message: `已生成 ${result.generated} 个提醒任务`, data: result };
  }
  if (name === 'retryEmail') {
    const { id } = idInput.parse(input);
    await retryFailedEmail(userId, id);
    return { message: '邮件已重新加入队列' };
  }
  if (name === 'testSmtp') {
    return db.$transaction(
      async (tx) => {
        await lockUser(tx, userId);
        const recent = await tx.emailLog.count({
          where: {
            userId,
            template: 'SMTP_TEST',
            createdAt: { gte: new Date(Date.now() - 60000) },
          },
        });
        if (recent) throw new DomainError('请等待一分钟再发送测试邮件', 429);
        await sendTestEmail(user);
        return { message: 'SMTP 服务已接受测试邮件，请检查账户邮箱' };
      },
      { timeout: 45000, maxWait: 10000 },
    );
  }
  return db.$transaction(
    async (tx) => {
      await lockUser(tx, userId);
      let rebuild = false;
      let message = '已保存';
      let data: unknown;
      switch (name) {
        case 'saveContact': {
          const { id, tagIds, ...fields } = contactSchema.parse(input);
          if (id) await ownedContact(tx, userId, id);
          if (
            (await tx.tag.count({ where: { userId, id: { in: tagIds } } })) !==
            tagIds.length
          )
            throw new DomainError('标签不存在或不属于当前用户');
          const duplicate = await tx.contact.count({
            where: {
              userId,
              ...(id ? { id: { not: id } } : {}),
              name: fields.name,
              birthdayType: fields.birthdayType,
              solarMonth: fields.solarMonth,
              solarDay: fields.solarDay,
              lunarMonth: fields.lunarMonth,
              lunarDay: fields.lunarDay,
              isLeapMonth: fields.isLeapMonth,
            },
          });
          const saved = id
            ? await tx.contact.update({
                where: { id_userId: { id, userId } },
                data: fields,
              })
            : await tx.contact.create({ data: { ...fields, userId } });
          await tx.contactTag.deleteMany({
            where: { userId, contactId: saved.id },
          });
          if (tagIds.length)
            await tx.contactTag.createMany({
              data: tagIds.map((tagId) => ({
                userId,
                contactId: saved.id,
                tagId,
              })),
            });
          data = { id: saved.id, duplicates: duplicate };
          message = duplicate
            ? '已保存；发现同名同生日的重复记录，请检查联系人列表'
            : '联系人已保存';
          rebuild = true;
          break;
        }
        case 'deleteContact': {
          const { id } = idInput.parse(input);
          assertAffected(
            (await tx.contact.deleteMany({ where: { id, userId } })).count,
          );
          message = '联系人已删除';
          break;
        }
        case 'archiveContact': {
          const { id, archived } = z
            .object({ id: idSchema, archived: z.boolean() })
            .parse(input);
          assertAffected(
            (
              await tx.contact.updateMany({
                where: { id, userId },
                data: { archivedAt: archived ? new Date() : null },
              })
            ).count,
          );
          message = archived ? '联系人已归档' : '联系人已恢复';
          rebuild = true;
          break;
        }
        case 'bulkContacts': {
          const { ids, operation } = z
            .object({
              ids: z
                .array(idSchema)
                .min(1)
                .max(500)
                .transform((v) => [...new Set(v)]),
              operation: z.enum(['archive', 'restore', 'delete']),
            })
            .parse(input);
          if (
            (await tx.contact.count({ where: { userId, id: { in: ids } } })) !==
            ids.length
          )
            throw new DomainError('部分联系人不存在或无权访问', 404);
          if (operation === 'delete')
            await tx.contact.deleteMany({ where: { userId, id: { in: ids } } });
          else {
            await tx.contact.updateMany({
              where: { userId, id: { in: ids } },
              data: { archivedAt: operation === 'archive' ? new Date() : null },
            });
            rebuild = true;
          }
          message = `已处理 ${ids.length} 位联系人`;
          break;
        }
        case 'saveTag': {
          const { id, ...fields } = tagSchema.parse(input);
          if (id) {
            assertAffected(
              (await tx.tag.updateMany({ where: { id, userId }, data: fields }))
                .count,
            );
            data = { id };
          } else
            data = await tx.tag.create({
              data: { ...fields, userId },
              select: { id: true },
            });
          break;
        }
        case 'deleteTag': {
          const { id } = idInput.parse(input);
          assertAffected(
            (await tx.tag.deleteMany({ where: { id, userId } })).count,
          );
          message = '标签已删除，联系人仍保留';
          break;
        }
        case 'saveWish': {
          const { id, ...fields } = wishSchema.parse(input);
          if (id) {
            assertAffected(
              (
                await tx.wishTemplate.updateMany({
                  where: { id, userId },
                  data: fields,
                })
              ).count,
            );
            data = { id };
          } else
            data = await tx.wishTemplate.create({
              data: { ...fields, userId },
              select: { id: true },
            });
          break;
        }
        case 'deleteWish': {
          const { id } = idInput.parse(input);
          assertAffected(
            (await tx.wishTemplate.deleteMany({ where: { id, userId } })).count,
          );
          message = '祝福语已删除';
          break;
        }
        case 'recordWish': {
          const { contactId, content } = z
            .object({
              contactId: idSchema,
              content: z.string().trim().min(1).max(3000),
            })
            .parse(input);
          const contact = await ownedContact(tx, userId, contactId);
          await tx.wishRecord.create({ data: { userId, contactId, content } });
          await tx.notification.create({
            data: {
              userId,
              title: `已记录给 ${contact.name} 的祝福`,
              body: content,
              href: `/contacts/${contactId}`,
            },
          });
          message = '已记录祝福发送情况';
          break;
        }
        case 'saveGift': {
          const { id, contactId, givenAt, ...fields } = giftSchema.parse(input);
          await ownedContact(tx, userId, contactId);
          const giftData = {
            ...fields,
            contactId,
            givenAt: givenAt ? new Date(givenAt + 'T00:00:00Z') : null,
          };
          if (id) {
            assertAffected(
              (
                await tx.giftRecord.updateMany({
                  where: { id, userId },
                  data: giftData,
                })
              ).count,
            );
            data = { id };
          } else
            data = await tx.giftRecord.create({
              data: { ...giftData, userId },
              select: { id: true },
            });
          message = '礼物记录已保存';
          break;
        }
        case 'deleteGift': {
          const { id } = idInput.parse(input);
          assertAffected(
            (await tx.giftRecord.deleteMany({ where: { id, userId } })).count,
          );
          message = '礼物记录已删除';
          break;
        }
        case 'saveProfile': {
          const {
            name: displayName,
            image,
            timeZone,
          } = profileSchema.parse(input);
          await tx.user.update({
            where: { id: userId },
            data: { name: displayName, image },
          });
          await tx.profile.upsert({
            where: { userId },
            create: { userId, timeZone },
            update: { timeZone },
          });
          rebuild = true;
          message = '个人资料已更新';
          break;
        }
        case 'savePreferences': {
          const { timeZone, ...settings } = preferenceSchema.parse(input);
          await tx.profile.upsert({
            where: { userId },
            create: { userId, timeZone },
            update: { timeZone },
          });
          await tx.reminderPreference.upsert({
            where: { userId },
            create: { userId, ...settings },
            update: settings,
          });
          rebuild = true;
          message = '提醒偏好已更新';
          break;
        }
        case 'saveContactReminder': {
          const { contactId, useGlobal, ...settings } =
            contactReminderSchema.parse(input);
          await ownedContact(tx, userId, contactId);
          if (useGlobal)
            await tx.contactReminderSetting.deleteMany({
              where: { contactId, userId },
            });
          else
            await tx.contactReminderSetting.upsert({
              where: { contactId },
              create: { contactId, userId, ...settings },
              update: settings,
            });
          rebuild = true;
          message = '联系人提醒已更新';
          break;
        }
        case 'markNotification': {
          const { id } = idInput.parse(input);
          assertAffected(
            (
              await tx.notification.updateMany({
                where: { id, userId },
                data: { readAt: new Date() },
              })
            ).count,
          );
          message = '消息已标为已读';
          break;
        }
        case 'importContacts': {
          const { csv } = z
            .object({ csv: z.string().max(2_000_000) })
            .parse(input);
          const parsed = contactsFromCsv(csv);
          const tagNames = [...new Set(parsed.flatMap((row) => row.tagNames))];
          if (tagNames.length)
            await tx.tag.createMany({
              data: tagNames.map((name) => ({ userId, name })),
              skipDuplicates: true,
            });
          const tags = await tx.tag.findMany({
            where: { userId, name: { in: tagNames } },
            select: { id: true, name: true },
          });
          const tagMap = new Map(tags.map((tag) => [tag.name, tag.id]));
          const existing = await tx.contact.findMany({
            where: { userId },
            select: {
              name: true,
              birthdayType: true,
              solarMonth: true,
              solarDay: true,
              lunarMonth: true,
              lunarDay: true,
              isLeapMonth: true,
            },
          });
          const key = (row: (typeof existing)[number]) =>
            JSON.stringify([
              row.name,
              row.birthdayType,
              row.solarMonth,
              row.solarDay,
              row.lunarMonth,
              row.lunarDay,
              row.isLeapMonth,
            ]);
          const known = new Set(existing.map(key));
          let duplicates = 0;
          const links: { userId: string; contactId: string; tagId: string }[] =
            [];
          const rows = parsed.map((row) => {
            const {
              id: _id,
              tagIds: _tagIds,
              tagNames: names,
              ...fields
            } = row;
            void _id;
            void _tagIds;
            const contactId = randomUUID();
            const signature = key(fields);
            if (known.has(signature)) duplicates++;
            known.add(signature);
            for (const name of names) {
              const tagId = tagMap.get(name);
              if (!tagId) throw new DomainError('标签关联失败，请重新导入');
              links.push({ userId, contactId, tagId });
            }
            return { ...fields, id: contactId, userId };
          });
          await tx.contact.createMany({ data: rows });
          if (links.length) await tx.contactTag.createMany({ data: links });
          rebuild = true;
          message =
            '已导入 ' +
            rows.length +
            ' 位联系人' +
            (duplicates ? '；检测到重复生日，请检查列表' : '');
          data = { count: rows.length, duplicates };
          break;
        }
        case 'deleteData': {
          z.object({ confirmation: z.literal('删除个人数据') }).parse(input);
          await tx.emailLog.deleteMany({ where: { userId } });
          await tx.emailQueue.deleteMany({ where: { userId } });
          await tx.contact.deleteMany({ where: { userId } });
          await tx.tag.deleteMany({ where: { userId } });
          await tx.wishTemplate.deleteMany({ where: { userId } });
          await tx.notification.deleteMany({ where: { userId } });
          await tx.reminderPreference.deleteMany({ where: { userId } });
          await tx.profile.deleteMany({ where: { userId } });
          message = '个人业务数据已删除，登录账户保留';
          break;
        }
        default:
          throw new DomainError('不支持的操作', 400);
      }
      if (rebuild) await syncUserReminders(tx, userId);
      return { message, data };
    },
    { timeout: 60000, maxWait: 15000 },
  );
}
export async function exportContacts(userId: string) {
  return contactsToCsv((await getWorkspace(userId)).contacts);
}
export async function exportData(userId: string) {
  const workspace = await getWorkspace(userId);
  return { exportedAt: new Date().toISOString(), ...workspace };
}
