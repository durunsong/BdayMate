import { describe, expect, it } from 'vitest';
import { contactFormSchema, parseReminderDays } from '@/features/validation';

const base = {
  name: '朋友',
  birthdayType: 'SOLAR',
  relationship: 'FRIEND',
  solarMonth: '2',
  solarDay: '29',
  lunarMonth: '1',
  lunarDay: '1',
  birthYear: '',
  isLeapMonth: false,
  leapDayPolicy: 'FEB28',
  lunarLeapPolicy: 'REGULAR',
  tagIds: [],
};
describe('contact form constraints', () => {
  it('allows unknown year and recurring February 29', () => {
    expect(contactFormSchema.safeParse(base).success).toBe(true);
  });
  it('rejects impossible Gregorian dates', () => {
    expect(
      contactFormSchema.safeParse({ ...base, solarDay: '30' }).success,
    ).toBe(false);
  });
  it('rejects February 29 when a non-leap birth year is known', () => {
    expect(
      contactFormSchema.safeParse({ ...base, birthYear: '1991' }).success,
    ).toBe(false);
  });
  it('allows the first supported lunar birth year', () => {
    expect(
      contactFormSchema.safeParse({
        ...base,
        birthdayType: 'LUNAR',
        birthYear: '1900',
      }).success,
    ).toBe(true);
  });
  it('rejects day 31 in lunar mode', () => {
    expect(
      contactFormSchema.safeParse({
        ...base,
        birthdayType: 'LUNAR',
        lunarDay: '31',
      }).success,
    ).toBe(false);
  });
  it('requires a nonblank name', () => {
    expect(contactFormSchema.safeParse({ ...base, name: ' ' }).success).toBe(
      false,
    );
  });
});
describe('reminder input', () => {
  it('normalizes and deduplicates valid days', () => {
    expect(parseReminderDays('7, 3，1,0,7')).toEqual([7, 3, 1, 0]);
  });
  it('rejects negative, fractional and unsupported days', () => {
    for (const value of [
      '-1',
      '1.5',
      '46',
      'a',
      '',
      '0,1,2,3,4,5,6,7,8,9,10,11,12',
    ])
      expect(() => parseReminderDays(value)).toThrow();
  });
});
