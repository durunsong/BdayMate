import { describe, expect, it } from 'vitest';
import {
  contactSchema,
  preferenceSchema,
  giftSchema,
} from '../../src/lib/validation';
import { parseCsv, encodeCsv } from '../../src/lib/csv';
const contact = {
  name: '小林',
  birthdayType: 'SOLAR',
  solarMonth: 2,
  solarDay: 29,
  relationship: 'FRIEND',
  tagIds: [],
};
describe('server data validation', () => {
  it('allows unknown birth year and valid leap-day anniversary', () =>
    expect(contactSchema.parse(contact).birthYear).toBeNull());
  it('rejects invalid birth dates and year-specific invalid leap days', () => {
    expect(() =>
      contactSchema.parse({ ...contact, solarMonth: 4, solarDay: 31 }),
    ).toThrow();
    expect(() =>
      contactSchema.parse({ ...contact, birthYear: 2001 }),
    ).toThrow();
  });
  it('rejects unsafe avatar and gift links', () => {
    expect(() =>
      contactSchema.parse({ ...contact, avatar: 'javascript:alert(1)' }),
    ).toThrow();
    expect(() =>
      giftSchema.parse({
        name: '礼物',
        contactId: 'a',
        purchaseUrl: 'javascript:alert(1)',
      }),
    ).toThrow();
  });
  it('rejects invalid timezone, send time and reminder day boundaries', () => {
    const p = {
      emailEnabled: true,
      daysBefore: [7, 0],
      sendTime: '09:00',
      timeZone: 'Asia/Shanghai',
    };
    expect(preferenceSchema.parse(p).daysBefore).toEqual([7, 0]);
    for (const patch of [
      { daysBefore: [-1] },
      { daysBefore: [46] },
      { sendTime: '25:00' },
      { timeZone: 'Mars/X' },
    ])
      expect(() => preferenceSchema.parse({ ...p, ...patch })).toThrow();
  });
  it('does not accept fractional cents or a negative budget', () => {
    expect(() =>
      giftSchema.parse({ name: '礼物', contactId: 'a', budget: '10.001' }),
    ).toThrow();
    expect(() =>
      giftSchema.parse({ name: '礼物', contactId: 'a', budget: '-1' }),
    ).toThrow();
  });
});
describe('CSV safety and correctness', () => {
  it('parses quoted commas, escaped quotes and multiline values', () => {
    const rows = [
      ['name', 'notes'],
      ['小林,先生', '第一行' + String.fromCharCode(10) + '他说"你好"'],
    ];
    expect(parseCsv(encodeCsv(rows))).toEqual(rows);
  });
  it('neutralizes spreadsheet formulas', () => {
    expect(encodeCsv([['=HYPERLINK("bad")', '+cmd', '@SUM(1)']])).toContain(
      "'=HYPERLINK",
    );
  });
  it('rejects malformed quote boundaries', () =>
    expect(() =>
      parseCsv('name,notes' + String.fromCharCode(10) + 'a,"unterminated'),
    ).toThrow());
  it('rejects oversized input', () =>
    expect(() => parseCsv('a'.repeat(2_000_001))).toThrow());
});
