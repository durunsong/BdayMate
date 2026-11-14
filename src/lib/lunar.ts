import { Lunar, LunarMonth, Solar } from 'lunar-javascript';

// Product coverage, deliberately narrower than the library's astronomical model.
export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = 2100;
export const LUNAR_MIN_SOLAR_DATE = '1900-01-31';
export const LUNAR_MAX_SOLAR_DATE = '2101-01-28';
export type LunarDate = {
  year: number;
  month: number;
  day: number;
  isLeapMonth: boolean;
};

export function assertLunarYear(year: number): void {
  if (
    !Number.isInteger(year) ||
    year < LUNAR_MIN_YEAR ||
    year > LUNAR_MAX_YEAR
  ) {
    throw new RangeError('Supported lunar years are 1900–2100.');
  }
}

export function assertLunarSolarRange(date: string): void {
  if (date < LUNAR_MIN_SOLAR_DATE || date > LUNAR_MAX_SOLAR_DATE) {
    throw new RangeError(
      'Supported lunar conversion dates are 1900-01-31 through 2101-01-28.',
    );
  }
}

export function lunarMonthDays(
  year: number,
  month: number,
  isLeapMonth: boolean,
): number | null {
  assertLunarYear(year);
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    typeof isLeapMonth !== 'boolean'
  ) {
    throw new RangeError('Invalid lunar month.');
  }
  return (
    LunarMonth.fromYm(year, isLeapMonth ? -month : month)?.getDayCount() ?? null
  );
}

export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  isLeapMonth: boolean,
): string {
  const days = lunarMonthDays(year, month, isLeapMonth);
  if (days === null || !Number.isInteger(day) || day < 1 || day > days) {
    throw new RangeError('The source lunar date does not exist.');
  }
  return Lunar.fromYmd(year, isLeapMonth ? -month : month, day)
    .getSolar()
    .toYmd();
}

export function lunarFromSolar(date: string): LunarDate {
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (
    !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError(
      'Expected a valid Gregorian date in yyyy-MM-dd format.',
    );
  }
  assertLunarSolarRange(date);
  const lunar = Solar.fromYmd(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  ).getLunar();
  return {
    year: lunar.getYear(),
    month: Math.abs(lunar.getMonth()),
    day: lunar.getDay(),
    isLeapMonth: lunar.getMonth() < 0,
  };
}
