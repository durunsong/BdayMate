import { describe, expect, it } from 'vitest';
import {
  addDaysToDate,
  BirthdayService,
  localDate,
  type BirthdayInput,
} from '../../src/services/birthday';
const solar = (overrides: Partial<BirthdayInput> = {}): BirthdayInput => ({
  birthdayType: 'SOLAR',
  birthYear: 2000,
  solarMonth: 3,
  solarDay: 9,
  lunarMonth: null,
  lunarDay: null,
  isLeapMonth: false,
  ...overrides,
});
const lunar = (overrides: Partial<BirthdayInput> = {}): BirthdayInput => ({
  birthdayType: 'LUNAR',
  birthYear: 2000,
  solarMonth: null,
  solarDay: null,
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
  ...overrides,
});
describe('solar birthdays and civil dates', () => {
  it('includes today and reports the age on that birthday', () => {
    expect(
      BirthdayService.next(
        solar(),
        'Asia/Shanghai',
        new Date('2025-03-08T16:00:00Z'),
      ),
    ).toEqual({ date: '2025-03-09', daysUntil: 0, age: 25 });
  });
  it('rolls past birthdays into the following year', () => {
    expect(
      BirthdayService.next(
        solar({ solarMonth: 1, solarDay: 1 }),
        'UTC',
        new Date('2025-12-31T12:00:00Z'),
      ),
    ).toEqual({ date: '2026-01-01', daysUntil: 1, age: 26 });
  });
  it('counts civil days across the spring DST gap', () => {
    expect(
      BirthdayService.next(
        solar(),
        'America/New_York',
        new Date('2025-03-08T17:00:00Z'),
      ),
    ).toEqual({ date: '2025-03-09', daysUntil: 1, age: 25 });
  });
  it('counts civil days across the autumn DST overlap', () => {
    expect(
      BirthdayService.next(
        solar({ solarMonth: 11, solarDay: 3 }),
        'America/New_York',
        new Date('2025-11-02T04:30:00Z'),
      ),
    ).toEqual({ date: '2025-11-03', daysUntil: 1, age: 25 });
  });
  it('uses the user timezone for the same instant', () => {
    const now = new Date('2025-03-09T00:30:00Z');
    expect(BirthdayService.next(solar(), 'Asia/Shanghai', now).daysUntil).toBe(
      0,
    );
    expect(
      BirthdayService.next(solar(), 'America/Los_Angeles', now).daysUntil,
    ).toBe(1);
  });
  it('defaults February 29 to February 28, retaining leap-year birthdays', () => {
    expect(
      BirthdayService.between(
        solar({ solarMonth: 2, solarDay: 29 }),
        '2023-01-01',
        '2024-12-31',
      ),
    ).toEqual([
      { date: '2023-02-28', daysUntil: 58, age: 23 },
      { date: '2024-02-29', daysUntil: 424, age: 24 },
    ]);
  });
  it('honors the March 1 leap-day policy', () => {
    expect(
      BirthdayService.next(
        solar({ solarMonth: 2, solarDay: 29, leapDayPolicy: 'MAR1' }),
        'UTC',
        new Date('2025-02-28T00:00:00Z'),
      ),
    ).toEqual({ date: '2025-03-01', daysUntil: 1, age: 25 });
  });
  it('returns no age when the birth year is unknown', () => {
    expect(
      BirthdayService.next(
        solar({ birthYear: null, solarMonth: 2, solarDay: 29 }),
        'UTC',
        new Date('2025-02-28T00:00:00Z'),
      ),
    ).toEqual({ date: '2025-02-28', daysUntil: 0, age: null });
  });
  it('excludes all occurrences before the source birth year', () => {
    expect(
      BirthdayService.between(
        solar({ birthYear: 2026 }),
        '2024-01-01',
        '2025-12-31',
      ),
    ).toEqual([]);
    expect(
      BirthdayService.next(
        solar({ birthYear: 2026 }),
        'UTC',
        new Date('2024-03-09T00:00:00Z'),
      ),
    ).toEqual({ date: '2026-03-09', daysUntil: 730, age: 0 });
  });
  it('includes both bounds exactly once', () => {
    expect(
      BirthdayService.between(solar(), '2025-03-09', '2026-03-09'),
    ).toEqual([
      { date: '2025-03-09', daysUntil: 0, age: 25 },
      { date: '2026-03-09', daysUntil: 365, age: 26 },
    ]);
  });
  it('adds civil days without DST or host timezone shifts', () => {
    expect(addDaysToDate('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDaysToDate('2025-01-01', -1)).toBe('2024-12-31');
    expect(
      localDate(new Date('2025-01-01T02:00:00Z'), 'America/Los_Angeles'),
    ).toBe('2024-12-31');
  });
});

describe('lunar birthdays', () => {
  // Independent Gregorian-lunar fixtures: Hong Kong Observatory annual tables, 2023–2025.
  it.each([
    ['2023-01-22', 2023],
    ['2024-02-10', 2024],
    ['2025-01-29', 2025],
  ])('converts known new year %s to lunar year %i', (date, year) => {
    expect(BirthdayService.solarToLunar(date)).toEqual({
      year,
      month: 1,
      day: 1,
      isLeapMonth: false,
    });
    expect(
      BirthdayService.next(lunar(), 'UTC', new Date(date + 'T00:00:00Z')),
    ).toEqual({ date, daysUntil: 0, age: year - 2000 });
  });
  it('resolves the previous lunar year in January and uses that year for age', () => {
    expect(
      BirthdayService.next(
        lunar({ birthYear: 2023, lunarMonth: 12, lunarDay: 30 }),
        'UTC',
        new Date('2025-01-01T00:00:00Z'),
      ),
    ).toEqual({ date: '2025-01-28', daysUntil: 27, age: 1 });
  });
  it('finds two distinct lunar birthdays in a single Gregorian year', () => {
    expect(
      BirthdayService.between(
        lunar({ lunarMonth: 12, lunarDay: 1 }),
        '2024-01-01',
        '2024-12-31',
      ),
    ).toEqual([
      { date: '2024-01-11', daysUntil: 10, age: 23 },
      { date: '2024-12-31', daysUntil: 365, age: 24 },
    ]);
  });
  it('uses the leap month when present without also emitting the regular month', () => {
    expect(
      BirthdayService.between(
        lunar({ birthYear: 2023, lunarMonth: 2, isLeapMonth: true }),
        '2023-01-22',
        '2023-12-31',
      ),
    ).toEqual([{ date: '2023-03-22', daysUntil: 59, age: 0 }]);
    expect(BirthdayService.solarToLunar('2023-03-22')).toEqual({
      year: 2023,
      month: 2,
      day: 1,
      isLeapMonth: true,
    });
  });
  it('defaults missing leap months to the regular month', () => {
    expect(
      BirthdayService.next(
        lunar({ birthYear: 2023, lunarMonth: 2, isLeapMonth: true }),
        'UTC',
        new Date('2024-01-01T00:00:00Z'),
      ),
    ).toEqual({ date: '2024-03-10', daysUntil: 69, age: 1 });
  });
  it('skips missing leap months and searches beyond the next year', () => {
    const input = lunar({
      birthYear: null,
      lunarMonth: 6,
      isLeapMonth: true,
      lunarLeapPolicy: 'SKIP',
    });
    expect(BirthdayService.between(input, '2023-01-22', '2024-12-31')).toEqual(
      [],
    );
    expect(
      BirthdayService.next(input, 'UTC', new Date('2023-01-22T00:00:00Z')),
    ).toEqual({ date: '2025-07-25', daysUntil: 915, age: null });
  });
  it('clamps day thirty in a short lunar month for unknown birth years', () => {
    expect(
      BirthdayService.next(
        lunar({
          birthYear: null,
          lunarMonth: 2,
          lunarDay: 30,
          isLeapMonth: true,
        }),
        'UTC',
        new Date('2023-03-22T00:00:00Z'),
      ),
    ).toEqual({ date: '2023-04-19', daysUntil: 28, age: null });
  });
  it('does not invent birthdays before a known lunar birth year', () => {
    const input = lunar({ birthYear: 2025 });
    expect(BirthdayService.between(input, '2024-01-01', '2025-01-28')).toEqual(
      [],
    );
    expect(
      BirthdayService.next(input, 'UTC', new Date('2024-01-01T00:00:00Z')),
    ).toEqual({ date: '2025-01-29', daysUntil: 394, age: 0 });
  });
  it('accepts the exact supported lunar interval endpoints', () => {
    expect(BirthdayService.solarToLunar('1900-01-31')).toEqual({
      year: 1900,
      month: 1,
      day: 1,
      isLeapMonth: false,
    });
    expect(BirthdayService.solarToLunar('2101-01-28')).toEqual({
      year: 2100,
      month: 12,
      day: 29,
      isLeapMonth: false,
    });
  });
});

describe('date and birthday validation', () => {
  it.each([
    { solarMonth: 4, solarDay: 31 },
    { solarMonth: 0 },
    { solarMonth: 13 },
    { solarDay: 0 },
    { solarDay: 32 },
    { solarDay: 1.5 },
    { solarMonth: null },
    { birthYear: 2001, solarMonth: 2, solarDay: 29 },
    { birthYear: 0 },
    { birthYear: -1 },
    { birthYear: 10000 },
    { birthYear: Number.NaN },
    { birthdayType: 'INVALID' },
    { leapDayPolicy: 'INVALID' },
    { lunarLeapPolicy: 'INVALID' },
    { isLeapMonth: 'false' },
  ])('rejects an invalid solar source: %j', (overrides) => {
    expect(() =>
      BirthdayService.next(solar(overrides as Partial<BirthdayInput>)),
    ).toThrow(RangeError);
  });
  it.each([
    { lunarMonth: 0 },
    { lunarMonth: 13 },
    { lunarMonth: -2 },
    { lunarDay: 0 },
    { lunarDay: 31 },
    { lunarDay: 1.5 },
    { lunarMonth: null },
    { birthYear: 1899 },
    { birthYear: 2101 },
    { birthYear: 2024, lunarMonth: 2, isLeapMonth: true },
    { birthYear: 2023, lunarMonth: 2, lunarDay: 30, isLeapMonth: true },
    { birthYear: 2024, lunarMonth: 12, lunarDay: 30 },
  ])(
    'rejects an invalid lunar source without applying anniversary fallback: %j',
    (overrides) => {
      expect(() => BirthdayService.next(lunar(overrides))).toThrow(RangeError);
    },
  );
  it.each([
    '2025-02-29',
    '2024-04-31',
    '2025-1-01',
    '2025-01-01T00:00:00Z',
    'not-a-date',
    '0000-01-01',
  ])('rejects invalid civil date %s', (date) => {
    expect(() => BirthdayService.between(solar(), date, '2026-01-01')).toThrow(
      RangeError,
    );
    expect(() => BirthdayService.between(solar(), '2024-01-01', date)).toThrow(
      RangeError,
    );
    expect(() => BirthdayService.solarToLunar(date)).toThrow(RangeError);
    expect(() => addDaysToDate(date, 1)).toThrow(RangeError);
  });
  it('rejects reversed interval bounds', () => {
    expect(() =>
      BirthdayService.between(solar(), '2026-01-01', '2025-01-01'),
    ).toThrow(RangeError);
  });
  it.each(['Mars/Olympus', '', '+08:00'])(
    'rejects non-IANA timezone %j on both query methods',
    (zone) => {
      expect(() => BirthdayService.next(solar(), zone)).toThrow(RangeError);
      expect(() =>
        BirthdayService.between(solar(), '2025-01-01', '2026-01-01', zone),
      ).toThrow(RangeError);
      expect(() => localDate(new Date(), zone)).toThrow(RangeError);
    },
  );
  it('rejects invalid instants and fractional civil day offsets', () => {
    expect(() =>
      BirthdayService.next(solar(), 'UTC', new Date(Number.NaN)),
    ).toThrow(RangeError);
    expect(() => addDaysToDate('2025-01-01', 0.5)).toThrow(RangeError);
    expect(() => addDaysToDate('2025-01-01', Number.POSITIVE_INFINITY)).toThrow(
      RangeError,
    );
    expect(() => addDaysToDate('9999-12-31', 1)).toThrow(RangeError);
  });
  it.each(['1900-01-30', '2101-01-29'])(
    'rejects dates beyond supported lunar interval: %s',
    (date) => {
      expect(() => BirthdayService.solarToLunar(date)).toThrow(RangeError);
      expect(() =>
        BirthdayService.next(lunar(), 'UTC', new Date(date + 'T00:00:00Z')),
      ).toThrow(RangeError);
    },
  );
  it('rejects lunar interval queries whose endpoints exceed coverage', () => {
    expect(() =>
      BirthdayService.between(lunar(), '1900-01-01', '1900-12-31'),
    ).toThrow(RangeError);
    expect(() =>
      BirthdayService.between(lunar(), '2100-01-01', '2101-01-29'),
    ).toThrow(RangeError);
  });
  it('reports absence of a future occurrence at the coverage boundary', () => {
    expect(() =>
      BirthdayService.next(lunar(), 'UTC', new Date('2101-01-28T00:00:00Z')),
    ).toThrow(RangeError);
    expect(() =>
      BirthdayService.next(solar(), 'UTC', new Date('9999-12-31T00:00:00Z')),
    ).toThrow(RangeError);
  });
});

describe('additional calendar boundaries', () => {
  it('counts two civil days across an actual 23-hour DST day', () => {
    expect(
      BirthdayService.next(
        solar({ solarDay: 10 }),
        'America/New_York',
        new Date('2025-03-08T05:00:00Z'),
      ),
    ).toEqual({ date: '2025-03-10', daysUntil: 2, age: 25 });
  });
  it('counts two civil days across an actual 25-hour DST day', () => {
    expect(
      BirthdayService.next(
        solar({ solarMonth: 11, solarDay: 3 }),
        'America/New_York',
        new Date('2025-11-01T04:00:00Z'),
      ),
    ).toEqual({ date: '2025-11-03', daysUntil: 2, age: 25 });
  });
  it('rejects an out-of-range current era instead of turning BCE into CE', () => {
    expect(() => localDate(new Date('0000-01-01T00:00:00Z'), 'UTC')).toThrow(
      RangeError,
    );
    expect(() =>
      BirthdayService.next(solar(), 'UTC', new Date('-000001-01-01T00:00:00Z')),
    ).toThrow(RangeError);
  });
  it('handles non-leap centuries without JavaScript year-0-to-99 remapping', () => {
    expect(
      BirthdayService.next(
        solar({ birthYear: null, solarMonth: 2, solarDay: 29 }),
        'UTC',
        new Date('2100-01-01T00:00:00Z'),
      ),
    ).toEqual({ date: '2100-02-28', daysUntil: 58, age: null });
    expect(
      BirthdayService.next(
        solar({ birthYear: 4, solarMonth: 2, solarDay: 29 }),
        'UTC',
        new Date('0099-01-01T00:00:00Z'),
      ),
    ).toEqual({ date: '0099-02-28', daysUntil: 58, age: 95 });
  });
});
