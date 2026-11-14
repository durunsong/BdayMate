import {
  assertLunarSolarRange,
  assertLunarYear,
  LUNAR_MAX_YEAR,
  lunarFromSolar,
  lunarMonthDays,
  lunarToSolar,
  type LunarDate,
} from '../lib/lunar';

export type BirthdayInput = {
  birthdayType: 'SOLAR' | 'LUNAR';
  birthYear: number | null;
  solarMonth: number | null;
  solarDay: number | null;
  lunarMonth: number | null;
  lunarDay: number | null;
  isLeapMonth: boolean;
  leapDayPolicy?: 'FEB28' | 'MAR1';
  lunarLeapPolicy?: 'REGULAR' | 'SKIP';
};
export type BirthdayOccurrence = {
  date: string;
  daysUntil: number;
  age: number | null;
};

const DAY_MS = 86_400_000;
const dateString = (year: number, month: number, day: number) =>
  String(year).padStart(4, '0') +
  '-' +
  String(month).padStart(2, '0') +
  '-' +
  String(day).padStart(2, '0');
const isLeapYear = (year: number) =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

function civilDate(date: string): Date {
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.getUTCFullYear() < 1 ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError(
      'Expected a valid Gregorian date in yyyy-MM-dd format (years 0001–9999).',
    );
  }
  return parsed;
}

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  if (typeof timeZone !== 'string' || !timeZone || /^[+-]/.test(timeZone)) {
    throw new RangeError('Expected an IANA timezone identifier.');
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    era: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function assertInteger(
  value: number | null,
  min: number,
  max: number,
  field: string,
): asserts value is number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new RangeError(field + ' is outside the supported range.');
  }
}

function validateInput(input: BirthdayInput): void {
  if (
    !input ||
    !['SOLAR', 'LUNAR'].includes(input.birthdayType) ||
    typeof input.isLeapMonth !== 'boolean'
  ) {
    throw new RangeError('Invalid birthday type or leap-month flag.');
  }
  if (
    input.leapDayPolicy !== undefined &&
    !['FEB28', 'MAR1'].includes(input.leapDayPolicy)
  ) {
    throw new RangeError('Invalid February 29 policy.');
  }
  if (
    input.lunarLeapPolicy !== undefined &&
    !['REGULAR', 'SKIP'].includes(input.lunarLeapPolicy)
  ) {
    throw new RangeError('Invalid lunar leap-month policy.');
  }
  if (input.birthYear !== null)
    assertInteger(input.birthYear, 1, 9999, 'Birth year');
  if (input.birthdayType === 'SOLAR') {
    assertInteger(input.solarMonth, 1, 12, 'Solar month');
    assertInteger(input.solarDay, 1, 31, 'Solar day');
    // A leap reference year permits February 29 when the actual birth year is unknown.
    civilDate(
      dateString(input.birthYear ?? 2000, input.solarMonth, input.solarDay),
    );
  } else {
    assertInteger(input.lunarMonth, 1, 12, 'Lunar month');
    assertInteger(input.lunarDay, 1, 30, 'Lunar day');
    if (input.birthYear !== null) {
      assertLunarYear(input.birthYear);
      // Anniversary fallback must never repair an impossible source birth date.
      lunarToSolar(
        input.birthYear,
        input.lunarMonth,
        input.lunarDay,
        input.isLeapMonth,
      );
    }
  }
}

function calendarYear(input: BirthdayInput, date: string): number {
  return input.birthdayType === 'LUNAR'
    ? lunarFromSolar(date).year
    : Number(date.slice(0, 4));
}

function occurrence(
  input: BirthdayInput,
  year: number,
  start: string,
): BirthdayOccurrence | null {
  let date: string;
  if (input.birthdayType === 'LUNAR') {
    let leap = input.isLeapMonth;
    let days = lunarMonthDays(year, input.lunarMonth!, leap);
    if (days === null) {
      if (input.lunarLeapPolicy === 'SKIP') return null;
      leap = false;
      days = lunarMonthDays(year, input.lunarMonth!, false)!;
    }
    date = lunarToSolar(
      year,
      input.lunarMonth!,
      Math.min(input.lunarDay!, days),
      leap,
    );
  } else {
    let month = input.solarMonth!;
    let day = input.solarDay!;
    if (month === 2 && day === 29 && !isLeapYear(year)) {
      month = input.leapDayPolicy === 'MAR1' ? 3 : 2;
      day = input.leapDayPolicy === 'MAR1' ? 1 : 28;
    }
    date = dateString(year, month, day);
  }
  return {
    date,
    // Compare UTC representations of civil dates, never local elapsed 24-hour periods.
    daysUntil:
      (civilDate(date).getTime() - civilDate(start).getTime()) / DAY_MS,
    age: input.birthYear === null ? null : year - input.birthYear,
  };
}

export class BirthdayService {
  static next(
    input: BirthdayInput,
    timeZone = 'Asia/Shanghai',
    now = new Date(),
  ): BirthdayOccurrence {
    validateInput(input);
    const start = localDate(now, timeZone);
    const firstYear = Math.max(
      calendarYear(input, start),
      input.birthYear ?? 1,
    );
    const lastYear = input.birthdayType === 'LUNAR' ? LUNAR_MAX_YEAR : 9999;
    for (let year = firstYear; year <= lastYear; year++) {
      const result = occurrence(input, year, start);
      if (result && result.date >= start) return result;
    }
    throw new RangeError(
      'No future birthday occurs within the supported date range.',
    );
  }

  static between(
    input: BirthdayInput,
    start: string,
    end: string,
    timeZone = 'Asia/Shanghai',
  ): BirthdayOccurrence[] {
    validateInput(input);
    zoneFormatter(timeZone);
    civilDate(start);
    civilDate(end);
    if (start > end)
      throw new RangeError('The start date must not be after the end date.');
    if (input.birthdayType === 'LUNAR') {
      assertLunarSolarRange(start);
      assertLunarSolarRange(end);
    }
    const firstYear = Math.max(
      calendarYear(input, start),
      input.birthYear ?? 1,
    );
    const lastYear = calendarYear(input, end);
    const results: BirthdayOccurrence[] = [];
    for (let year = firstYear; year <= lastYear; year++) {
      const result = occurrence(input, year, start);
      if (result && result.date >= start && result.date <= end)
        results.push(result);
    }
    return results;
  }

  static solarToLunar(date: string): LunarDate {
    civilDate(date);
    return lunarFromSolar(date);
  }
}

export function localDate(now: Date, timeZone: string): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new RangeError('Invalid current instant.');
  const parts = zoneFormatter(timeZone).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  if (part('era') !== 'AD')
    throw new RangeError('Supported civil years are 0001–9999.');
  const date = dateString(
    Number(part('year')),
    Number(part('month')),
    Number(part('day')),
  );
  civilDate(date);
  return date;
}

export function addDaysToDate(date: string, days: number): string {
  if (!Number.isSafeInteger(days))
    throw new RangeError('Civil day offsets must be safe integers.');
  const result = new Date(civilDate(date).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
  civilDate(result);
  return result;
}
