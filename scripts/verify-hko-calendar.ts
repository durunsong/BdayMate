import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { lunarFromSolar, lunarToSolar } from '../src/lib/lunar';

// Offline verification by default; --refresh fetches HKO's 200 published tables
// and replaces only the compact independent test fixture after validating it.
const fixtureUrl = new URL(
  '../tests/fixtures/hko-calendar.json',
  import.meta.url,
);
type Row = [string, number, number, number, boolean];
type Fixture = {
  source: string;
  retrievedAt: string;
  first: Row;
  last: Row;
  days: number;
  filesSha256: Record<string, string>;
  months: [string, number, number][];
};
const DAY_MS = 86_400_000;
const stamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
let fixture: Fixture;
if (process.argv.includes('--refresh')) {
  const source =
    'https://www.hko.gov.hk/en/gts/time/calendar/text/files/T{year}e.txt';
  const files = new Map<number, { text: string; sha: string }>();
  let nextYear = 1901;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (nextYear <= 2100) {
        const year = nextYear++;
        const response = await fetch(source.replace('{year}', String(year)), {
          signal: AbortSignal.timeout(30000),
        });
        assert(response.ok, `HKO ${year}: HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        // Date columns are ASCII; older files contain non-UTF-8 editorial text.
        files.set(year, {
          text: buffer.toString('latin1'),
          sha: createHash('sha256').update(buffer).digest('hex'),
        });
      }
    }),
  );
  const rows: Row[] = [];
  const months: Fixture['months'] = [];
  const filesSha256: Record<string, string> = {};
  let lunarYear = 1900,
    lunarMonth = 11,
    leap = false;
  for (let year = 1901; year <= 2100; year++) {
    const file = files.get(year)!;
    filesSha256[`T${year}e.txt`] = file.sha;
    let count = 0;
    for (const line of file.text.split(/\r?\n/)) {
      const match = line.match(
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(.*?)(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,
      );
      if (!match) continue;
      assert.equal(Number(match[1]), year);
      const date = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      const token = match[4].trim();
      let day: number;
      if (/lunar month/i.test(token)) {
        const month = Number.parseInt(token, 10);
        leap = month === lunarMonth;
        if (month === 1 && !leap) lunarYear = year;
        lunarMonth = month;
        day = 1;
        months.push([date, lunarYear, leap ? -month : month]);
      } else {
        assert(/^[0-9]+$/.test(token), `Unexpected HKO date token: ${token}`);
        day = Number(token);
      }
      assert(day >= 1 && day <= 30 && lunarMonth >= 1 && lunarMonth <= 12);
      const previous = rows.at(-1);
      if (previous) {
        assert.equal(stamp(date) - stamp(previous[0]), DAY_MS);
        if (day === 1) assert([29, 30].includes(previous[3]));
        else assert.equal(day, previous[3] + 1);
      }
      rows.push([date, lunarYear, lunarMonth, day, leap]);
      count++;
    }
    assert.equal(
      count,
      (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS,
    );
  }
  assert.equal(rows.length, 73049);
  fixture = {
    source,
    retrievedAt: new Date().toISOString().slice(0, 10),
    first: rows[0],
    last: rows.at(-1)!,
    days: rows.length,
    filesSha256,
    months,
  };
  await writeFile(
    fixtureUrl,
    await format(JSON.stringify(fixture), { parser: 'json' }),
  );
} else {
  fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as Fixture;
}

let monthIndex = 0;
let [, year, month, day, isLeapMonth] = fixture.first;
let checked = 0;
for (
  let time = stamp(fixture.first[0]);
  time <= stamp(fixture.last[0]);
  time += DAY_MS
) {
  const date = new Date(time).toISOString().slice(0, 10);
  const start = fixture.months[monthIndex];
  if (start?.[0] === date) {
    year = start[1];
    month = Math.abs(start[2]);
    isLeapMonth = start[2] < 0;
    day = 1;
    monthIndex++;
  }
  assert.deepEqual(
    lunarFromSolar(date),
    { year, month, day, isLeapMonth },
    date,
  );
  assert.equal(lunarToSolar(year, month, day, isLeapMonth), date, date);
  day++;
  checked++;
}
assert.equal(checked, fixture.days);
assert.equal(monthIndex, fixture.months.length);
console.log(
  `HKO verified: ${checked} civil dates, both directions, ${fixture.months.length} lunar month starts (${fixture.first[0]} through ${fixture.last[0]}).`,
);
