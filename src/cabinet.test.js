import { describe, it, expect } from 'vitest';
import {
  colLetter, formatSlot, parseSlot, normalizeSlot,
  slotStatus, buildGrid, countByStatus, unassignedItems, fitGridSize,
} from './cabinet';

describe('櫃位代碼解析', () => {
  it('欄索引轉字母', () => {
    expect(colLetter(0)).toBe('A');
    expect(colLetter(7)).toBe('H');
    expect(colLetter(26)).toBe('');
  });
  it('組出櫃位代碼', () => {
    expect(formatSlot(0, 1)).toBe('A1');
    expect(formatSlot(3, 12)).toBe('D12');
  });
  it('解析大小寫與空白', () => {
    expect(parseSlot('A1')).toEqual({ colIndex: 0, row: 1 });
    expect(parseSlot(' c7 ')).toEqual({ colIndex: 2, row: 7 });
  });
  it('無效輸入回 null', () => {
    expect(parseSlot('')).toBeNull();
    expect(parseSlot('1A')).toBeNull();
    expect(parseSlot('AA1')).toBeNull();
    expect(parseSlot('A0')).toBeNull();
    expect(parseSlot('A99')).toBeNull();
    expect(parseSlot(null)).toBeNull();
  });
  it('正規化：有效轉大寫、無效轉空字串', () => {
    expect(normalizeSlot('b3')).toBe('B3');
    expect(normalizeSlot('亂打')).toBe('');
  });
});

describe('slotStatus 格子狀態', () => {
  it('沒有設備 → empty', () => {
    expect(slotStatus([])).toBe('empty');
  });
  it('全部借出 → out', () => {
    expect(slotStatus([{ quantity: 2, borrowedCount: 2 }])).toBe('out');
  });
  it('剩餘低於門檻 → low', () => {
    expect(slotStatus([{ quantity: 5, borrowedCount: 3 }])).toBe('low');
  });
  it('剩餘充足 → ok', () => {
    expect(slotStatus([{ quantity: 10, borrowedCount: 0 }])).toBe('ok');
  });
  it('同格多筆設備數量合計後判斷', () => {
    expect(slotStatus([{ quantity: 1 }, { quantity: 2 }])).toBe('ok');
  });
});

describe('buildGrid 網格建立', () => {
  const items = [
    { id: '1', name: '示波器', cabinet: 'A1', quantity: 5, borrowedCount: 0 },
    { id: '2', name: '電阻包', cabinet: 'a1', quantity: 2, borrowedCount: 0 },
    { id: '3', name: '麵包板', cabinet: 'B2', quantity: 3, borrowedCount: 3 },
    { id: '4', name: '未配置的線材', cabinet: '', quantity: 9, borrowedCount: 0 },
  ];

  it('格數 = 欄 × 列', () => {
    expect(buildGrid(items, { cols: 3, rows: 2 })).toHaveLength(6);
  });
  it('同一格（含大小寫不同）的設備會合併', () => {
    const a1 = buildGrid(items, { cols: 3, rows: 2 }).find(c => c.slot === 'A1');
    expect(a1.items).toHaveLength(2);
    expect(a1.total).toBe(7);
    expect(a1.available).toBe(7);
    expect(a1.status).toBe('ok');
  });
  it('全借出的格子狀態為 out', () => {
    const b2 = buildGrid(items, { cols: 3, rows: 2 }).find(c => c.slot === 'B2');
    expect(b2.status).toBe('out');
    expect(b2.available).toBe(0);
  });
  it('沒有設備的格子為 empty', () => {
    const c1 = buildGrid(items, { cols: 3, rows: 2 }).find(c => c.slot === 'C1');
    expect(c1.status).toBe('empty');
    expect(c1.items).toEqual([]);
  });
  it('未配置櫃位的設備不會出現在任何格子', () => {
    const all = buildGrid(items, { cols: 3, rows: 2 }).flatMap(c => c.items.map(i => i.id));
    expect(all).not.toContain('4');
  });

  it('countByStatus 統計各狀態格數', () => {
    const counts = countByStatus(buildGrid(items, { cols: 3, rows: 2 }));
    expect(counts).toEqual({ all: 6, empty: 4, ok: 1, low: 0, out: 1 });
  });

  it('unassignedItems 找出未配置櫃位的設備', () => {
    expect(unassignedItems(items).map(i => i.id)).toEqual(['4']);
  });
});

describe('fitGridSize 自動撐大網格', () => {
  it('設備超出預設範圍時擴大', () => {
    const items = [{ cabinet: 'J20' }];
    expect(fitGridSize(items, { cols: 8, rows: 12 })).toEqual({ cols: 10, rows: 20 });
  });
  it('設備都在範圍內時維持原尺寸', () => {
    expect(fitGridSize([{ cabinet: 'A1' }], { cols: 8, rows: 12 })).toEqual({ cols: 8, rows: 12 });
  });
  it('無效櫃位不影響尺寸', () => {
    expect(fitGridSize([{ cabinet: '' }], { cols: 8, rows: 12 })).toEqual({ cols: 8, rows: 12 });
  });
});
