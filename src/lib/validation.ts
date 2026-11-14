import { z } from 'zod';
import { BirthdayService, localDate } from '@/services/birthday';
export const idSchema = z.string().min(1).max(100);
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.string().trim().max(max).nullable(),
  );
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === undefined || v === null ? null : v),
  z.coerce.number().int().nullable(),
);
const httpUrl = z
  .string()
  .url()
  .max(2048)
  .refine(
    (v) => ['https:', 'http:'].includes(new URL(v).protocol),
    '链接必须使用 http 或 https',
  );
export const optionalUrl = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  httpUrl.nullable(),
);
export const relationshipSchema = z.enum([
  'FAMILY',
  'FRIEND',
  'CLASSMATE',
  'COLLEAGUE',
  'MANAGER',
  'CLIENT',
  'PARTNER',
  'OTHER',
]);
export const timeZoneSchema = z
  .string()
  .max(100)
  .refine((v) => {
    try {
      localDate(new Date(), v);
      return true;
    } catch {
      return false;
    }
  }, '请选择有效的 IANA 时区');
export const reminderFields = {
  emailEnabled: z.boolean(),
  daysBefore: z
    .array(z.number().int().min(0).max(45))
    .min(1)
    .max(12)
    .transform((v) => [...new Set(v)].sort((a, b) => b - a)),
  sendTime: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, '发送时间应为 HH:mm'),
};
export const preferenceSchema = z.object({
  ...reminderFields,
  timeZone: timeZoneSchema,
});
export const contactSchema = z
  .object({
    id: idSchema.optional(),
    name: z.string().trim().min(1, '请输入姓名').max(100),
    avatar: optionalUrl,
    gender: optionalText(30),
    birthdayType: z.enum(['SOLAR', 'LUNAR']),
    birthYear: optionalNumber,
    solarMonth: optionalNumber,
    solarDay: optionalNumber,
    lunarMonth: optionalNumber,
    lunarDay: optionalNumber,
    isLeapMonth: z.boolean().default(false),
    leapDayPolicy: z.enum(['FEB28', 'MAR1']).default('FEB28'),
    lunarLeapPolicy: z.enum(['REGULAR', 'SKIP']).default('REGULAR'),
    relationship: relationshipSchema.default('FRIEND'),
    email: z.preprocess(
      (v) => (v === '' || v === undefined ? null : v),
      z.email().max(254).nullable(),
    ),
    phone: optionalText(40),
    notes: optionalText(5000),
    tagIds: z
      .array(idSchema)
      .max(100)
      .default([])
      .transform((v) => [...new Set(v)]),
  })
  .transform((v) => ({
    ...v,
    ...(v.birthdayType === 'SOLAR'
      ? { lunarMonth: null, lunarDay: null, isLeapMonth: false }
      : { solarMonth: null, solarDay: null }),
  }))
  .superRefine((value, ctx) => {
    try {
      BirthdayService.next(value);
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: e instanceof Error ? e.message : '生日日期不正确',
        path: ['birthdayType'],
      });
    }
  });
export const tagSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#6366F1'),
  description: optionalText(500),
});
export const wishSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(3000),
  relationship: relationshipSchema.default('OTHER'),
});
const dateString = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .refine((v) => {
    const d = new Date(v + 'T00:00:00Z');
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, '日期不存在');
export const giftSchema = z.object({
  id: idSchema.optional(),
  contactId: idSchema,
  name: z.string().trim().min(1).max(120),
  description: optionalText(3000),
  budget: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z
      .string()
      .regex(
        /^(0|[1-9][0-9]{0,9})([.][0-9]{1,2})?$/,
        '预算必须为非负金额，最多两位小数',
      )
      .nullable(),
  ),
  currency: z.enum(['CNY', 'USD', 'EUR', 'HKD', 'JPY', 'GBP']).default('CNY'),
  purchaseUrl: optionalUrl,
  givenAt: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    dateString.nullable(),
  ),
  status: z.enum(['IDEA', 'PLANNED', 'PURCHASED', 'GIVEN']).default('IDEA'),
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  image: optionalUrl,
  timeZone: timeZoneSchema,
});
export const contactReminderSchema = z.object({
  contactId: idSchema,
  useGlobal: z.boolean(),
  enabled: z.boolean(),
  daysBefore: reminderFields.daysBefore,
  sendTime: reminderFields.sendTime,
});

export const contactGreetingSchema = z.object({
  contactId: idSchema,
  enabled: z.boolean(),
  sendTime: reminderFields.sendTime,
  message: z.string().trim().min(1, '请输入生日祝福').max(3000),
});
