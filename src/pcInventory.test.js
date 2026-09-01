import { describe, it, expect } from 'vitest';
import { parsePcRows, filterPcRows, latestUpdatedAt } from './pcInventory';

// 取自實際試算表的欄位（欄位格式不可更動）
const HEADERS = ['最後更新時間', '設備識別碼', '電腦名稱', '內網IPv4', 'CPU', ''];
const ROW_A = ['2026-09-01 21:53:42', 'UDVMTTA0126', 'DESKTOP-4F6DA9H(家瑋)', '140.127.22.145', 'Intel(R) Core(TM) i5-6500', ''];
const ROW_B = ['2026-08-30 10:00:00', 'ABC123', 'LAB-PC-02', '140.127.22.200', 'AMD Ryzen 5 5600', ''];

describe('parsePcRows', () => {
  it('第一列為表頭時分離表頭與資料', () => {
    const { headers, rows } = parsePcRows([HEADERS, ROW_A]);
    expect(headers).toEqual(HEADERS.slice(0, 5));
    expect(rows).toHaveLength(1);
    expect(rows[0][2]).toBe('DESKTOP-4F6DA9H(家瑋)');
  });

  it('裁掉尾端無標題且無資料的空欄', () => {
    const { headers, rows } = parsePcRows([HEADERS, ROW_A]);
    expect(headers).toHaveLength(5);
    expect(rows[0]).toHaveLength(5);
  });

  it('保留中間的空值，不改變欄位順序', () => {
    const { headers, rows } = parsePcRows([HEADERS, ['2026-09-01', 'X1', '', '10.0.0.1', 'CPU-X', '']]);
    expect(headers[2]).toBe('電腦名稱');
    expect(rows[0][2]).toBe('');
    expect(rows[0][3]).toBe('10.0.0.1');
  });

  it('略過整列空白', () => {
    const { rows } = parsePcRows([HEADERS, ROW_A, ['', '', '', '', '', ''], ROW_B]);
    expect(rows).toHaveLength(2);
  });

  it('去除前後空白', () => {
    const { rows } = parsePcRows([HEADERS, ['  2026-09-01  ', ' X1 ', 'PC', '', '', '']]);
    expect(rows[0][0]).toBe('2026-09-01');
    expect(rows[0][1]).toBe('X1');
  });

  it('沒有表頭時 headers 為空、資料全保留', () => {
    const { headers, rows } = parsePcRows([['a', 'b'], ['c', 'd']]);
    expect(headers).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('空輸入回傳空結構', () => {
    expect(parsePcRows([])).toEqual({ headers: [], rows: [] });
    expect(parsePcRows(null)).toEqual({ headers: [], rows: [] });
  });
});

describe('filterPcRows', () => {
  const rows = [ROW_A.slice(0, 5), ROW_B.slice(0, 5)];

  it('任一欄位命中即保留', () => {
    expect(filterPcRows(rows, '家瑋')).toHaveLength(1);
    expect(filterPcRows(rows, '140.127.22.200')).toHaveLength(1);
  });
  it('不分大小寫', () => {
    expect(filterPcRows(rows, 'amd ryzen')).toHaveLength(1);
    expect(filterPcRows(rows, 'INTEL')).toHaveLength(1);
  });
  it('空關鍵字回傳全部', () => {
    expect(filterPcRows(rows, '')).toHaveLength(2);
    expect(filterPcRows(rows, '   ')).toHaveLength(2);
  });
  it('查無資料回傳空陣列', () => {
    expect(filterPcRows(rows, '不存在的東西')).toHaveLength(0);
  });
});

describe('latestUpdatedAt', () => {
  it('取最後更新時間的最大值', () => {
    const rows = [ROW_A.slice(0, 5), ROW_B.slice(0, 5)];
    expect(latestUpdatedAt(HEADERS.slice(0, 5), rows)).toBe('2026-09-01 21:53:42');
  });
  it('找不到該欄位時回空字串', () => {
    expect(latestUpdatedAt(['A', 'B'], [['1', '2']])).toBe('');
  });
});
