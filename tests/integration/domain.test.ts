import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { addDaysToDate, localDate } from '@/services/birthday';
import {
  mutate,
  getWorkspace,
  exportContacts,
  exportData,
} from '@/services/domain';
const a = 'test-' + randomUUID(),
  b = 'test-' + randomUUID();
const input = {
  name: '生日测试',
  birthdayType: 'SOLAR',
  birthYear: null,
  solarMonth: 6,
  solarDay: 15,
  relationship: 'FRIEND',
  tagIds: [],
};
let contactId = '';
let tagId = '';
beforeAll(async () => {
  for (const id of [a, b])
    await db.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        name: '验收测试',
        emailVerified: true,
      },
    });
});
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [a, b] } } });
  await db.$disconnect();
});
describe('real PostgreSQL domain isolation', () => {
  it('creates and reads a persistent contact with tags', async () => {
    const tag = await mutate(a, 'saveTag', {
      name: '重要的人',
      color: '#6366F1',
    });
    tagId = (tag.data as { id: string }).id;
    const result = await mutate(a, 'saveContact', {
      ...input,
      tagIds: [tagId],
    });
    contactId = (result.data as { id: string }).id;
    const workspace = await getWorkspace(a);
    expect(workspace.contacts[0].name).toBe(input.name);
    expect(workspace.contacts[0].tags[0].id).toBe(tagId);
    expect(workspace.contacts[0].next?.age).toBeNull();
  });
  it('cannot read or edit another owner contact', async () => {
    expect((await getWorkspace(b)).contacts).toHaveLength(0);
    await expect(
      mutate(b, 'saveContact', { ...input, id: contactId, name: '越权修改' }),
    ).rejects.toThrow();
    await expect(
      mutate(b, 'deleteContact', { id: contactId }),
    ).rejects.toThrow();
    expect(
      (await db.contact.findUniqueOrThrow({ where: { id: contactId } })).name,
    ).toBe(input.name);
  });
  it('rejects foreign tags and gifts at the service and database layer', async () => {
    await expect(
      mutate(b, 'saveContact', { ...input, tagIds: [tagId] }),
    ).rejects.toThrow();
    await expect(
      mutate(b, 'saveGift', { contactId, name: '非法关联' }),
    ).rejects.toThrow();
    const own = await db.contact.create({
      data: {
        userId: b,
        name: '自己的',
        birthdayType: 'SOLAR',
        solarMonth: 1,
        solarDay: 1,
      },
    });
    await expect(
      db.contactTag.create({ data: { userId: b, contactId: own.id, tagId } }),
    ).rejects.toThrow();
  });
  it('supports edit, archive, restore and duplicate warnings', async () => {
    await mutate(a, 'saveContact', { ...input, id: contactId, name: '已编辑' });
    await mutate(a, 'archiveContact', { id: contactId, archived: true });
    expect((await getWorkspace(a)).contacts[0].archivedAt).not.toBeNull();
    await mutate(a, 'archiveContact', { id: contactId, archived: false });
    expect((await getWorkspace(a)).contacts[0].archivedAt).toBeNull();
    const duplicate = await mutate(a, 'saveContact', {
      ...input,
      name: '已编辑',
    });
    expect(duplicate.message).toContain('重复');
  });
  it('imports atomically, exports Unicode and neutralizes formulas', async () => {
    const count = await db.contact.count({ where: { userId: a } });
    await expect(
      mutate(a, 'importContacts', {
        csv:
          'name,birthdayType,solarMonth,solarDay' +
          String.fromCharCode(10) +
          '有效,SOLAR,3,1' +
          String.fromCharCode(10) +
          '无效,SOLAR,4,31',
      }),
    ).rejects.toThrow();
    expect(await db.contact.count({ where: { userId: a } })).toBe(count);
    await mutate(a, 'importContacts', {
      csv:
        'name,birthdayType,solarMonth,solarDay' +
        String.fromCharCode(10) +
        '=SUM(1),SOLAR,3,1',
    });
    expect(await exportContacts(a)).toContain("'=SUM(1)");
  });
  it('scopes bulk operations as an atomic set', async () => {
    await expect(
      mutate(b, 'bulkContacts', { ids: [contactId], operation: 'delete' }),
    ).rejects.toThrow();
    expect(
      await db.contact.count({ where: { id: contactId, userId: a } }),
    ).toBe(1);
  });
  it('stores wishes, sent records and monetary gifts without precision loss', async () => {
    const wish = await mutate(a, 'saveWish', {
      title: '给朋友',
      content: '生日快乐！',
      relationship: 'FRIEND',
    });
    expect((wish.data as { id: string }).id).toBeTruthy();
    await mutate(a, 'recordWish', { contactId, content: '生日快乐！' });
    const gift = await mutate(a, 'saveGift', {
      contactId,
      name: '一本书',
      budget: '123.45',
      currency: 'CNY',
      status: 'PURCHASED',
    });
    const id = (gift.data as { id: string }).id;
    expect((await getWorkspace(a)).gifts.find((g) => g.id === id)?.budget).toBe(
      '123.45',
    );
    await expect(mutate(b, 'deleteGift', { id })).rejects.toThrow();
    expect(
      (await getWorkspace(a)).notifications.some((n) =>
        n.title.includes('祝福'),
      ),
    ).toBe(true);
    expect((await getWorkspace(a)).wishRecords[0].contactId).toBe(contactId);
  });
  it('imports the documented 500-row limit atomically', async () => {
    const date = addDaysToDate(localDate(new Date(), 'Asia/Shanghai'), 14);
    const csv = [
      'name,birthdayType,solarMonth,solarDay,tags',
      ...Array.from(
        { length: 500 },
        (_, i) =>
          '批量验收' +
          i +
          ',SOLAR,' +
          Number(date.slice(5, 7)) +
          ',' +
          Number(date.slice(8, 10)) +
          ',批量标签',
      ),
    ].join(String.fromCharCode(10));
    const result = await mutate(a, 'importContacts', { csv });
    expect((result.data as { count: number }).count).toBe(500);
    expect(
      await db.contact.count({
        where: { userId: a, name: { startsWith: '批量验收' } },
      }),
    ).toBe(500);
  }, 80000);
  it('returns complete queue and data exports beyond 200 records', async () => {
    const count = await db.emailQueue.count({ where: { userId: a } });
    expect(count).toBeGreaterThan(200);
    expect((await getWorkspace(a)).queue).toHaveLength(count);
    expect((await exportData(a)).queue).toHaveLength(count);
  });
  it('logs SMTP verification failure and rate-limits subsequent tests', async () => {
    vi.stubEnv('SMTP_HOST', 'xxxx');
    try {
      await expect(mutate(a, 'testSmtp', {})).rejects.toThrow('SMTP');
      const logs = await db.emailLog.findMany({
        where: { userId: a, template: 'SMTP_TEST' },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('FAILED');
      await expect(mutate(a, 'testSmtp', {})).rejects.toThrow('一分钟');
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('requires explicit confirmation to erase only owned personal data', async () => {
    await expect(
      mutate(a, 'deleteData', { confirmation: 'no' }),
    ).rejects.toThrow();
    await mutate(a, 'deleteData', { confirmation: '删除个人数据' });
    expect((await getWorkspace(a)).contacts).toHaveLength(0);
    expect(await db.contact.count({ where: { userId: b } })).toBe(1);
    expect(await db.user.count({ where: { id: a } })).toBe(1);
  });
});
