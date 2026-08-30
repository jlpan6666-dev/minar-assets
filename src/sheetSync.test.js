import { describe, it, expect } from 'vitest';
import { parseSheetRows, diffEquipment } from './sheetSync';

const HEADER = ['材料設備', '材料編號', '數量', '借用人(學號)', '預約日期(起訖)', '預約日期(訖)', '電話', '信箱', '備註'];

describe('parseSheetRows', () => {
  it('略過表頭列與無名稱列', () => {
    const rows = [HEADER, ['170小麵包板', '', '32', '', '', '', '', '', '旁邊大紙箱'], ['', '', '9', '', '', '', '', '', '']];
    expect(parseSheetRows(rows)).toEqual([{ name: '170小麵包板', quantity: 32, note: '旁邊大紙箱' }]);
  });
  it('數量非數字或留空視為 0，前後空白去除', () => {
    expect(parseSheetRows([[' 光敏電阻 ', '', '', '', '', '', '', '', ' 備註 ']]))
      .toEqual([{ name: '光敏電阻', quantity: 0, note: '備註' }]);
    expect(parseSheetRows([['水流計', '', 'N/A']])).toEqual([{ name: '水流計', quantity: 0, note: '' }]);
  });
  it('非陣列輸入回傳空陣列', () => {
    expect(parseSheetRows(null)).toEqual([]);
    expect(parseSheetRows([null, undefined])).toEqual([]);
  });
});

describe('diffEquipment', () => {
  const existing = [
    { id: 'a', name: '光敏電阻', quantity: 105, note: '' },
    { id: 'b', name: '水流計', quantity: 1, note: '舊備註' },
  ];

  it('新名稱進 toAdd', () => {
    const r = diffEquipment([{ name: '雨滴感測器', quantity: 3, note: '' }], existing);
    expect(r.toAdd).toEqual([{ name: '雨滴感測器', quantity: 3, note: '' }]);
    expect(r.toUpdate).toEqual([]);
  });

  it('同名只回報有變動的欄位，名稱比對不分大小寫與前後空白', () => {
    const r = diffEquipment([{ name: ' 水流計 ', quantity: 4, note: '舊備註' }], existing);
    expect(r.toUpdate).toEqual([{ id: 'b', name: '水流計', changes: { quantity: 4 } }]);
    expect(r.toAdd).toEqual([]);
  });

  it('完全相同計入 unchanged', () => {
    const r = diffEquipment([{ name: '光敏電阻', quantity: 105, note: '' }], existing);
    expect(r).toEqual({ toAdd: [], toUpdate: [], unchanged: 1 });
  });

  it('試算表同名重複時以最後一列為準', () => {
    const r = diffEquipment([
      { name: '洞洞板', quantity: 1, note: '' },
      { name: '洞洞板', quantity: 19, note: '' },
    ], existing);
    expect(r.toAdd).toEqual([{ name: '洞洞板', quantity: 19, note: '' }]);
  });

  it('現有清單為空時全部視為新增', () => {
    const r = diffEquipment([{ name: '抽水馬達', quantity: 7, note: '' }]);
    expect(r.toAdd).toHaveLength(1);
    expect(r.unchanged).toBe(0);
  });
});
