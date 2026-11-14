import 'server-only';
import { contactSchema } from '@/lib/validation';
import { parseCsv, encodeCsv } from '@/lib/csv';
import { DomainError } from '@/lib/errors';
import type { ContactDTO } from '@/lib/types';
export const csvColumns = [
  'name',
  'birthdayType',
  'birthYear',
  'solarMonth',
  'solarDay',
  'lunarMonth',
  'lunarDay',
  'isLeapMonth',
  'leapDayPolicy',
  'lunarLeapPolicy',
  'relationship',
  'email',
  'phone',
  'notes',
  'tags',
  'avatar',
  'gender',
] as const;
export function contactsFromCsv(csv: string) {
  const [header, ...rows] = parseCsv(csv);
  if (!header || !header.includes('name') || !header.includes('birthdayType'))
    throw new DomainError('CSV 需要 name、birthdayType 表头，可先导出示例格式');
  if (
    new Set(header).size !== header.length ||
    header.some((h) => !csvColumns.includes(h as (typeof csvColumns)[number]))
  )
    throw new DomainError('CSV 包含重复或未知表头');
  if (!rows.length) throw new DomainError('CSV 没有联系人数据');
  return rows.map((row, index) => {
    const raw = Object.fromEntries(header.map((h, i) => [h, row[i]]));
    if (raw.isLeapMonth && !['true', 'false'].includes(raw.isLeapMonth))
      throw new DomainError(
        `第 ${index + 2} 行 isLeapMonth 应为 true 或 false`,
      );
    const parsed = contactSchema.safeParse({
      ...raw,
      isLeapMonth: raw.isLeapMonth === 'true',
      relationship: raw.relationship || 'FRIEND',
      leapDayPolicy: raw.leapDayPolicy || 'FEB28',
      lunarLeapPolicy: raw.lunarLeapPolicy || 'REGULAR',
      tagIds: [],
    });
    if (!parsed.success)
      throw new DomainError(
        `第 ${index + 2} 行：${parsed.error.issues[0].message}`,
      );
    const tagNames = [
      ...new Set(
        (raw.tags || '')
          .split('|')
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    ];
    if (tagNames.length > 20 || tagNames.some((v) => v.length > 40))
      throw new DomainError(`第 ${index + 2} 行标签超过限制`);
    return { ...parsed.data, tagNames };
  });
}
export function contactsToCsv(contacts: ContactDTO[]) {
  return encodeCsv([
    [...csvColumns],
    ...contacts.map((c) =>
      csvColumns.map((k) =>
        k === 'tags' ? c.tags.map((t) => t.name).join('|') : String(c[k] ?? ''),
      ),
    ),
  ]);
}
