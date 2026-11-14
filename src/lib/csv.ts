import { DomainError } from './errors';
const LF = String.fromCharCode(10),
  CR = String.fromCharCode(13);
export function parseCsv(input: string): string[][] {
  if (new TextEncoder().encode(input).byteLength > 2_000_000)
    throw new DomainError('CSV 文件不能超过 2 MB');
  const csv = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closed = false;
  const cell = () => {
    row.push(field);
    field = '';
    closed = false;
  };
  const line = () => {
    cell();
    if (row.some((v) => v !== '')) rows.push(row);
    row = [];
    if (rows.length > 501) throw new DomainError('每次最多导入 500 行联系人');
  };
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += ch;
      continue;
    }
    if (closed && ch !== ',' && ch !== LF && ch !== CR)
      throw new DomainError('CSV 引号后含有无效字符');
    if (ch === '"') {
      if (field) throw new DomainError('CSV 引号位置不正确');
      quoted = true;
    } else if (ch === ',') cell();
    else if (ch === LF || ch === CR) {
      if (ch === CR && csv[i + 1] === LF) i++;
      line();
    } else field += ch;
  }
  if (quoted) throw new DomainError('CSV 引号未闭合');
  if (field || row.length || closed) line();
  if (rows.length && rows.some((r) => r.length !== rows[0].length))
    throw new DomainError('CSV 每行的列数必须与表头一致');
  return rows;
}
export function encodeCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const v = String(value);
          const first = v.trimStart().charAt(0);
          const safe =
            ['=', '+', '-', '@'].includes(first) ||
            v.startsWith(String.fromCharCode(9))
              ? "'" + v
              : v;
          return '"' + safe.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join(CR + LF);
}
