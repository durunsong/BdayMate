import { describe, expect, it } from 'vitest';
import { BirthdayService, type BirthdayInput } from '@/services/birthday';
import { lunarFromSolar, lunarMonthDays, lunarToSolar } from '@/lib/lunar';
import hko from '../fixtures/hko-calendar.json';

it('matches every published HKO month boundary, month length and birthday occurrence from 1901 to 2100', () => {
  const months = hko.months as [string, number, number][];
  for (let i = 0; i < months.length; i++) {
    const [date, year, signedMonth] = months[i];
    const month = Math.abs(signedMonth);
    const isLeapMonth = signedMonth < 0;
    expect(lunarFromSolar(date), date).toEqual({
      year,
      month,
      day: 1,
      isLeapMonth,
    });
    expect(lunarToSolar(year, month, 1, isLeapMonth), date).toBe(date);
    expect(
      BirthdayService.between(
        {
          birthdayType: 'LUNAR',
          birthYear: year,
          solarMonth: null,
          solarDay: null,
          lunarMonth: month,
          lunarDay: 1,
          isLeapMonth,
          lunarLeapPolicy: 'SKIP',
        },
        date,
        date,
      ),
      date,
    ).toEqual([{ date, daysUntil: 0, age: 0 }]);
    if (months[i + 1]) {
      const next = Date.parse(months[i + 1][0] + 'T00:00:00Z');
      const length = (next - Date.parse(date + 'T00:00:00Z')) / 86_400_000;
      const lastDay = new Date(next - 86_400_000).toISOString().slice(0, 10);
      expect(lunarMonthDays(year, month, isLeapMonth), date).toBe(length);
      expect(lunarToSolar(year, month, length, isLeapMonth), date).toBe(
        lastDay,
      );
      expect(lunarFromSolar(lastDay), date).toEqual({
        year,
        month,
        day: length,
        isLeapMonth,
      });
    }
  }
});

it('round-trips the supported edge dates outside HKO published coverage without claiming independent astronomical validation', () => {
  for (const [start, end] of [
    ['1900-01-31', '1900-12-31'],
    ['2101-01-01', '2101-01-28'],
  ]) {
    for (
      let time = Date.parse(start + 'T00:00:00Z');
      time <= Date.parse(end + 'T00:00:00Z');
      time += 86_400_000
    ) {
      const date = new Date(time).toISOString().slice(0, 10);
      const lunar = lunarFromSolar(date);
      expect(
        lunarToSolar(lunar.year, lunar.month, lunar.day, lunar.isLeapMonth),
        date,
      ).toBe(date);
    }
  }
});

describe('Hong Kong Observatory 2057 month boundary', () => {
  // https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2057e.txt
  it.each([
    ['2057-09-27', 8, 29],
    ['2057-09-28', 9, 1],
    ['2057-10-27', 9, 30],
    ['2057-10-28', 10, 1],
  ])(
    'matches the published calendar in both directions at %s',
    (date, month, day) => {
      expect(lunarFromSolar(date)).toEqual({
        year: 2057,
        month,
        day,
        isLeapMonth: false,
      });
      expect(lunarToSolar(2057, month, day, false)).toBe(date);
    },
  );

  it('uses the published month lengths for source validation and anniversary clamping', () => {
    expect(lunarMonthDays(2057, 8, false)).toBe(29);
    expect(lunarMonthDays(2057, 9, false)).toBe(30);
    expect(() => lunarToSolar(2057, 8, 30, false)).toThrow(RangeError);
    const input: BirthdayInput = {
      birthdayType: 'LUNAR',
      birthYear: null,
      solarMonth: null,
      solarDay: null,
      lunarMonth: 8,
      lunarDay: 30,
      isLeapMonth: false,
    };
    expect(BirthdayService.between(input, '2057-09-01', '2057-09-30')).toEqual([
      { date: '2057-09-27', daysUntil: 26, age: null },
    ]);
    expect(
      BirthdayService.between(
        { ...input, birthYear: 2057, lunarMonth: 9 },
        '2057-10-01',
        '2057-10-31',
      ),
    ).toEqual([{ date: '2057-10-27', daysUntil: 26, age: 0 }]);
  });
});
