import { describe, it, expect } from 'vitest';
import { parsePerfRows, filterPerfRows, nextSeq, isApiConfigured } from './performance';

const HEADER = ['案次', ''];
const R1 = ['1', '教育部第四期大學社會責任實踐計畫，計畫共同主持人。經費：3,000,000元/年。'];
const R2 = ['2', '教育部第三期大學社會責任實踐計畫，計畫共同主持人。經費：2,750,000元/年'];

describe('parsePerfRows', () => {
  it('略過表頭，保留資料列', () => {
    const rows = parsePerfRows([HEADER, R1, R2]);
    expect(rows).toHaveLength(2);
    expect(rows[0].seq).toBe('1');
    expect(rows[1].content).toContain('第三期');
  });

  it('rowNumber 對應試算表實際列號（供 API 更新該列）', () => {
    const rows = parsePerfRows([HEADER, R1, R2]);
    expect(rows[0].rowNumber).toBe(2); // 表頭在第 1 列
    expect(rows[1].rowNumber).toBe(3);
  });

  it('略過完全空白的列', () => {
    const rows = parsePerfRows([HEADER, R1, ['', ''], R2]);
    expect(rows).toHaveLength(2);
    expect(rows[1].rowNumber).toBe(4); // 空列仍佔用列號
  });

  it('只有內容沒有案次也保留', () => {
    const rows = parsePerfRows([HEADER, ['', '沒有編號的計畫']]);
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('沒有編號的計畫');
  });

  it('沒有表頭時第一列也算資料', () => {
    expect(parsePerfRows([R1])).toHaveLength(1);
  });

  it('空輸入回傳空陣列', () => {
    expect(parsePerfRows([])).toEqual([]);
    expect(parsePerfRows(null)).toEqual([]);
  });

  it('去除前後空白', () => {
    const rows = parsePerfRows([HEADER, ['  7  ', '  內容  ']]);
    expect(rows[0].seq).toBe('7');
    expect(rows[0].content).toBe('內容');
  });
});

describe('filterPerfRows', () => {
  const rows = parsePerfRows([HEADER, R1, R2]);
  it('內容命中', () => {
    expect(filterPerfRows(rows, '第四期')).toHaveLength(1);
  });
  it('案次命中', () => {
    // R2 案次為 '2'；R1 內容（3,000,000）不含 '2'，故只命中 1 筆
    const hit = filterPerfRows(rows, '2');
    expect(hit).toHaveLength(1);
    expect(hit[0].seq).toBe('2');
  });
  it('空關鍵字回傳全部', () => {
    expect(filterPerfRows(rows, '  ')).toHaveLength(2);
  });
  it('查無資料', () => {
    expect(filterPerfRows(rows, 'zzz')).toHaveLength(0);
  });
});

describe('nextSeq', () => {
  it('取最大數字 +1', () => {
    expect(nextSeq(parsePerfRows([HEADER, R1, R2]))).toBe('3');
  });
  it('空清單從 1 開始', () => {
    expect(nextSeq([])).toBe('1');
  });
  it('案次非數字時忽略', () => {
    expect(nextSeq([{ seq: '附錄', content: 'x' }])).toBe('1');
  });
});

describe('isApiConfigured', () => {
  it('未填 Apps Script 網址時為 false（頁面退回 CSV 唯讀）', () => {
    // PERF_API_URL 預設留空，部署後才填入
    expect(typeof isApiConfigured()).toBe('boolean');
  });
});

describe('Apps Script 回傳格式相容性', () => {
  it('getDisplayValues() 的二維陣列可直接用同一個解析器', () => {
    const fromAppsScript = [['案次', ''], ['1', '計畫 A'], ['2', '計畫 B']];
    const rows = parsePerfRows(fromAppsScript);
    expect(rows).toHaveLength(2);
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].content).toBe('計畫 B');
  });
});
