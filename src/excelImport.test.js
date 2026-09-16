import { describe, it, expect } from 'vitest';
import { headerKey, findHeaderRow, buildGroups, groupForColumn, parseSheet, toQuantity } from './excelImport';

// 取自使用者提供的「感測器物件清單.xlsx」：表頭在第 3 列（索引 2），左右並排兩組 名稱/數量/圖片
const 感測器清單 = [
  [],
  [],
  ['', '', '名稱', '數量', '圖片', '', '', '名稱', '數量', '圖片'],
  ['', '1', 'RS485 to TTL 轉換器', '5', '', '', '43', '四角全彩 RGB LED', '11', ''],
  ['', '2', 'WS2812-RGB燈條', '27', '', '', '44', '按鈕', '55', ''],
];

const 財產清單 = [
  ['所屬表單', '財產編號', '財產名稱', '廠牌型別', '現值', '取得日期', '使用年限', '使用人', '存置地點', '備註', '盤點狀況'],
  ['甲表', 'P-001', '示波器', 'ACME X1', '12000', '2024/03/01', '5', '王小明', 'A-101', '—', '已盤點'],
];

describe('headerKey 欄名別名', () => {
  it('實驗室與財產的欄名都認得', () => {
    expect(headerKey('設備名稱')).toBe('name');
    expect(headerKey('財產名稱')).toBe('name');
    expect(headerKey('名稱')).toBe('name');
    expect(headerKey('總數量')).toBe('quantity');
    expect(headerKey('圖片')).toBe('image');
    expect(headerKey('照片')).toBe('image');
  });
  it('忽略半形與全形空白', () => {
    expect(headerKey(' 財產編號 ')).toBe('propId');
    expect(headerKey('設　備　名　稱')).toBe('name');
  });
  it('不認得的欄名回 null', () => {
    expect(headerKey('流水號')).toBeNull();
    expect(headerKey('')).toBeNull();
    expect(headerKey(null)).toBeNull();
  });
});

describe('findHeaderRow', () => {
  it('跳過前面的空列找到真正的表頭', () => {
    expect(findHeaderRow(感測器清單)).toBe(2);
  });
  it('表頭在第一列', () => {
    expect(findHeaderRow(財產清單)).toBe(0);
  });
  it('只認得一個欄名不算表頭（避免把資料列誤判成表頭）', () => {
    expect(findHeaderRow([['名稱'], ['A']])).toBe(-1);
  });
  it('完全認不得時回 -1', () => {
    expect(findHeaderRow([['甲', '乙'], ['1', '2']])).toBe(-1);
    expect(findHeaderRow([])).toBe(-1);
  });
});

describe('buildGroups 左右並排的欄組', () => {
  it('同一列出現第二次「名稱」就切新組', () => {
    const groups = buildGroups(感測器清單[2]);
    expect(groups).toHaveLength(2);
    expect(groups[0].cols).toEqual({ name: 2, quantity: 3, image: 4 });
    expect(groups[1].cols).toEqual({ name: 7, quantity: 8, image: 9 });
  });
  it('一般單組表頭只有一組', () => {
    expect(buildGroups(財產清單[0])).toHaveLength(1);
  });
  it('沒有可辨識欄名時回空陣列', () => {
    expect(buildGroups(['甲', '乙'])).toEqual([]);
  });
});

describe('groupForColumn 圖片錨點歸組', () => {
  const groups = buildGroups(感測器清單[2]);
  it('錨在該組的圖片欄 → 該組', () => {
    expect(groupForColumn(groups, 4)).toBe(0);
    expect(groupForColumn(groups, 9)).toBe(1);
  });
  it('錨在非圖片欄 → 歸左側最近的一組', () => {
    expect(groupForColumn(groups, 3)).toBe(0);
    expect(groupForColumn(groups, 8)).toBe(1);
  });
  it('錨在所有欄組左側 → -1', () => {
    expect(groupForColumn(groups, 0)).toBe(-1);
  });
});

describe('parseSheet 依欄名解析', () => {
  it('兩組欄位都展開成資料列', () => {
    const { headerRow, records } = parseSheet(感測器清單);
    expect(headerRow).toBe(2);
    expect(records).toHaveLength(4);
    expect(records.map((r) => r.fields.name)).toEqual([
      'RS485 to TTL 轉換器', '四角全彩 RGB LED', 'WS2812-RGB燈條', '按鈕',
    ]);
    expect(records[1].fields.quantity).toBe('11');
  });

  it('嵌入圖片依錨點的列與欄對到正確那一筆', () => {
    const images = [
      { row: 3, col: 4, dataUrl: 'data:image/jpeg;base64,LEFT' },
      { row: 4, col: 9, dataUrl: 'data:image/jpeg;base64,RIGHT' },
    ];
    const { records } = parseSheet(感測器清單, images);
    expect(records.find((r) => r.fields.name === 'RS485 to TTL 轉換器').image).toBe('data:image/jpeg;base64,LEFT');
    expect(records.find((r) => r.fields.name === '按鈕').image).toBe('data:image/jpeg;base64,RIGHT');
    // 沒有圖片的那兩筆維持 null
    expect(records.filter((r) => r.image === null)).toHaveLength(2);
  });

  it('圖片欄是網址時直接採用', () => {
    const rows = [['名稱', '數量', '圖片'], ['感測器', '3', 'https://example.com/a.jpg']];
    expect(parseSheet(rows).records[0].image).toBe('https://example.com/a.jpg');
  });

  it('圖片欄是說明文字時不當成圖片', () => {
    const rows = [['名稱', '數量', '圖片'], ['感測器', '3', '見附件']];
    expect(parseSheet(rows).records[0].image).toBeNull();
  });

  it('嵌入圖片蓋過圖片欄的文字網址', () => {
    const rows = [['名稱', '圖片'], ['感測器', 'https://example.com/old.jpg']];
    const { records } = parseSheet(rows, [{ row: 1, col: 1, dataUrl: 'data:image/jpeg;base64,NEW' }]);
    expect(records[0].image).toBe('data:image/jpeg;base64,NEW');
  });

  it('財產欄位完整對應', () => {
    const { records } = parseSheet(財產清單);
    expect(records[0].fields).toEqual({
      tableName: '甲表', propId: 'P-001', name: '示波器', brandModel: 'ACME X1',
      value: '12000', acquireDate: '2024/03/01', lifespan: '5',
      user: '王小明', location: 'A-101', note: '—', status: '已盤點',
    });
  });

  it('欄位順序被調換也照樣對應', () => {
    const rows = [['備註', '名稱', '數量'], ['壞了', '電阻', '100']];
    expect(parseSheet(rows).records[0].fields).toEqual({ note: '壞了', name: '電阻', quantity: '100' });
  });

  it('名稱與編號都空白的列直接略過', () => {
    const rows = [['名稱', '數量'], ['', ''], ['電阻', '1']];
    expect(parseSheet(rows).records).toHaveLength(1);
  });

  it('認不出表頭時退回舊版的位置對應', () => {
    const rows = [['甲', '乙', '丙'], ['P-002', '三用電表', 'ACME']];
    const { records } = parseSheet(rows);
    expect(records[0].fields.propId).toBe('P-002');
    expect(records[0].fields.name).toBe('三用電表');
    expect(records[0].fields.brandModel).toBe('ACME');
  });

  it('位置對應時仍認得「所屬表單」造成的整欄位移', () => {
    const rows = [['所屬表單', '甲', '乙'], ['乙表', 'P-003', '電源供應器']];
    const { records } = parseSheet(rows);
    expect(records[0].fields.tableName).toBe('乙表');
    expect(records[0].fields.propId).toBe('P-003');
    expect(records[0].fields.name).toBe('電源供應器');
  });

  it('空輸入不炸', () => {
    expect(parseSheet([]).records).toEqual([]);
    expect(parseSheet().records).toEqual([]);
  });
});

describe('toQuantity', () => {
  it('純數字', () => expect(toQuantity('29')).toBe(29));
  it('帶單位', () => expect(toQuantity('12 個')).toBe(12));
  it('空白或非數字視為 0', () => {
    expect(toQuantity('')).toBe(0);
    expect(toQuantity('若干')).toBe(0);
    expect(toQuantity(null)).toBe(0);
  });
  it('負數視為 0（數量不可能為負）', () => expect(toQuantity('-3')).toBe(0));
});
