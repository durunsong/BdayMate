import { z } from 'zod';
import { relationships } from '@/lib/types';

const optionalText = z.string().optional();
export const contactFormSchema = z
  .object({
    name: z.string().trim().min(1, '请输入姓名').max(80, '姓名最多 80 字'),
    avatar: z
      .string()
      .refine(
        (value) => !value || /^https?:\/\//.test(value),
        '请输入 http 或 https 图片地址',
      )
      .optional(),
    gender: optionalText,
    birthdayType: z.enum(['SOLAR', 'LUNAR']),
    birthYear: z
      .string()
      .refine(
        (value) =>
          !value ||
          (/^\d{1,4}$/.test(value) &&
            +value >= 1 &&
            +value <= new Date().getFullYear()),
        '请输入有效的出生年份，不能晚于今年',
      ),
    solarMonth: z.string(),
    solarDay: z.string(),
    lunarMonth: z.string(),
    lunarDay: z.string(),
    isLeapMonth: z.boolean(),
    leapDayPolicy: z.enum(['FEB28', 'MAR1']),
    lunarLeapPolicy: z.enum(['REGULAR', 'SKIP']),
    relationship: z.enum(
      Object.keys(relationships) as [
        keyof typeof relationships,
        ...(keyof typeof relationships)[],
      ],
    ),
    email: z
      .string()
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        '请输入有效邮箱',
      )
      .optional(),
    phone: z.string().max(30, '手机号最多 30 字').optional(),
    notes: z.string().max(3000, '备注最多 3000 字').optional(),
    tagIds: z.array(z.string()),
  })
  .superRefine((data, ctx) => {
    const solar = data.birthdayType === 'SOLAR';
    const month = Number(solar ? data.solarMonth : data.lunarMonth);
    const day = Number(solar ? data.solarDay : data.lunarDay);
    if (!Number.isInteger(month) || month < 1 || month > 12)
      ctx.addIssue({
        code: 'custom',
        path: [solar ? 'solarMonth' : 'lunarMonth'],
        message: '请选择月份',
      });
    const year = data.birthYear ? Number(data.birthYear) : 2000;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const maxDay = solar
      ? [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
      : 30;
    if (!solar && data.birthYear && Number(data.birthYear) < 1900)
      ctx.addIssue({
        code: 'custom',
        path: ['birthYear'],
        message: '农历出生年份支持 1900–2100 年',
      });
    if (!Number.isInteger(day) || day < 1 || day > maxDay)
      ctx.addIssue({
        code: 'custom',
        path: [solar ? 'solarDay' : 'lunarDay'],
        message: '这个月份没有该日期',
      });
  });
export type ContactFormValues = z.infer<typeof contactFormSchema>;
export function parseReminderDays(value: string): number[] {
  const parts = value.split(/[,，]/).map((item) => item.trim());
  if (parts.length > 12) throw new Error('最多设置 12 个提醒时间');
  if (parts.some((item) => !/^\d+$/.test(item) || +item > 45))
    throw new Error('提前天数请输入 0–45 的整数，以逗号分隔');
  return [...new Set(parts.map(Number))].sort((a, b) => b - a);
}
