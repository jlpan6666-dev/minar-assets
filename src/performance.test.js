import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseSheetTable, filterSheetRows, isSequenceColumn, newFirstCell, groupSheetNames, isApiConfigured, perfCsvUrl, mainCellIndex, rowToText, callPerfApi } from './performance';

// 取自實際試算表：每張工作表欄位都不同，解析器不能假設欄位
const 產業績效 = [['案次', ''], ['1', '教育部第四期大學社會責任實踐計畫，經費：3,000,000元/年。'], ['2', '教育部第三期，經費：2,750,000元/年']];
const 期刊論文 = [['編號', '分類', '名稱'], ['1', 'SCI 與 EI 國際期刊論文', 'Architecture, Technologies, and Applications...'], ['2', 'SCI', 'Another paper']];
const 碩士論文 = [['年度', '學生姓名', '畢業碩士論文'], ['90', '郭福文', '整合與分化式網路下之多媒體服務品質']];

describe('parseSheetTable 通用解析', () => {
  it('案次+內容 的兩欄結構', () => {
    const { headers, rows } = parseSheetTable(產業績效);
    expect(headers).toEqual(['案次', '']);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells[1]).toContain('第四期');
  });

  it('編號+分類+名稱 的三欄結構', () => {
    const { headers, rows } = parseSheetTable(期刊論文);
    expect(headers).toEqual(['編號', '分類', '名稱']);
    expect(rows[0].cells).toHaveLength(3);
    expect(rows[0].cells[1]).toBe('SCI 與 EI 國際期刊論文');
  });

  it('年度+姓名+論文 的三欄結構', () => {
    const { headers, rows } = parseSheetTable(碩士論文);
    expect(headers[0]).toBe('年度');
    expect(rows[0].cells[1]).toBe('郭福文');
  });

  it('rowNumber 對應試算表實際列號', () => {
    const { rows } = parseSheetTable(期刊論文);
    expect(rows[0].rowNumber).toBe(2); // 表頭在第 1 列
    expect(rows[1].rowNumber).toBe(3);
  });

  it('裁掉尾端無標題且整欄空白的欄位（授課表有 20+ 個空欄）', () => {
    const 授課 = [['編號', '名稱', '', '', ''], ['1', '90 學年上學期：計算機概論', '', '', '']];
    const { headers, rows } = parseSheetTable(授課);
    expect(headers).toEqual(['編號', '名稱']);
    expect(rows[0].cells).toHaveLength(2);
  });

  it('保留無標題但有資料的欄位（案次表第二欄沒標題）', () => {
    const { headers } = parseSheetTable(產業績效);
    expect(headers).toHaveLength(2);
  });

  it('略過整列空白', () => {
    const { rows } = parseSheetTable([['編號', '名稱'], ['1', 'A'], ['', ''], ['2', 'B']]);
    expect(rows).toHaveLength(2);
    expect(rows[1].rowNumber).toBe(4); // 空列仍佔列號
  });

  it('每列補齊到相同寬度', () => {
    const { rows } = parseSheetTable([['A', 'B', 'C'], ['1']]);
    expect(rows[0].cells).toEqual(['1', '', '']);
  });

  it('空輸入回傳空結構', () => {
    expect(parseSheetTable([])).toEqual({ headers: [], rows: [] });
    expect(parseSheetTable(null)).toEqual({ headers: [], rows: [] });
  });
});

describe('filterSheetRows', () => {
  const { rows } = parseSheetTable(期刊論文);
  it('任一欄位命中即保留', () => {
    expect(filterSheetRows(rows, 'Architecture')).toHaveLength(1);
    expect(filterSheetRows(rows, 'SCI')).toHaveLength(2);
  });
  it('不分大小寫', () => {
    expect(filterSheetRows(rows, 'architecture')).toHaveLength(1);
  });
  it('空關鍵字回傳全部', () => {
    expect(filterSheetRows(rows, '  ')).toHaveLength(2);
  });
});

describe('isSequenceColumn 判斷是否為流水號欄', () => {
  it('1,2,3 連續 → 是', () => {
    expect(isSequenceColumn(parseSheetTable(期刊論文).rows)).toBe(true);
  });
  it('年度欄（90,91…）→ 否，避免覆蓋年度', () => {
    const rows = parseSheetTable([['年度', '姓名'], ['90', '甲'], ['91', '乙']]).rows;
    expect(isSequenceColumn(rows)).toBe(false);
  });
  it('有跳號 → 否（不確定就不要亂動）', () => {
    const rows = parseSheetTable([['編號', '名稱'], ['1', 'A'], ['3', 'B']]).rows;
    expect(isSequenceColumn(rows)).toBe(false);
  });
  it('不是從 1 開始 → 否', () => {
    const rows = parseSheetTable([['編號', '名稱'], ['2', 'A'], ['3', 'B']]).rows;
    expect(isSequenceColumn(rows)).toBe(false);
  });
  it('空清單 → 否', () => {
    expect(isSequenceColumn([])).toBe(false);
  });
});

describe('newFirstCell 新增時的第一欄', () => {
  it('流水號表給 1（最新的排最前面）', () => {
    expect(newFirstCell(parseSheetTable(期刊論文).rows)).toBe('1');
  });
  it('非流水號表留空讓使用者自己填', () => {
    const rows = parseSheetTable([['年度', '姓名'], ['90', '甲']]).rows;
    expect(newFirstCell(rows)).toBe('');
  });
});

describe('groupSheetNames', () => {
  it('依「-」前綴分組', () => {
    const groups = groupSheetNames(['研究著作-專書', '研究著作-期刊論文', '計畫與專利-專利', '授課']);
    expect(groups).toEqual([
      { label: '研究著作', items: ['研究著作-專書', '研究著作-期刊論文'] },
      { label: '計畫與專利', items: ['計畫與專利-專利'] },
      { label: '其他', items: ['授課'] },
    ]);
  });
  it('空清單', () => {
    expect(groupSheetNames([])).toEqual([]);
  });
});

describe('mainCellIndex 主要內容欄', () => {
  it('取第一欄之後最長的那欄', () => {
    // 編號, 類別, 專利名稱(最長) → 相對索引 1
    expect(mainCellIndex(['1', '新型專利', '“蟲害預測防治裝置”，中華民國專利證書…'])).toBe(1);
  });
  it('尾端有多餘空欄時仍正確（專利表的情況）', () => {
    expect(mainCellIndex(['1', '新型專利', '很長的專利名稱內容……', ''])).toBe(1);
  });
  it('年度+姓名+論文 取論文欄', () => {
    expect(mainCellIndex(['90', '郭福文', '整合與分化式網路下之多媒體服務品質定義'])).toBe(1);
  });
  it('只有兩欄時取第二欄', () => {
    expect(mainCellIndex(['1', '內容'])).toBe(0);
  });
  it('只有一欄時回 -1', () => {
    expect(mainCellIndex(['1'])).toBe(-1);
    expect(mainCellIndex([])).toBe(-1);
  });
});

describe('rowToText 複製用文字', () => {
  it('以空格串接各欄', () => {
    expect(rowToText(['90', '郭福文', '整合與分化式網路'])).toBe('90 郭福文 整合與分化式網路');
  });
  it('略過空欄（專利表尾端有多餘空欄）', () => {
    expect(rowToText(['1', '新型專利', '蟲害預測防治裝置', ''])).toBe('1 新型專利 蟲害預測防治裝置');
  });
  it('去除前後空白', () => {
    expect(rowToText(['  1  ', ' 內容 '])).toBe('1 內容');
  });
  it('空列回空字串', () => {
    expect(rowToText(['', ''])).toBe('');
    expect(rowToText([])).toBe('');
  });
});

describe('callPerfApi 重試策略', () => {
  const okBody = { ok: true, values: [['編號', '名稱']] };
  const reply = (status, body) => ({ ok: status === 200, status, json: async () => body });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('讀取遇到 404 會自動重試並成功', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls += 1; return calls < 3 ? reply(404) : reply(200, okBody); });
    await expect(callPerfApi({ action: 'list' })).resolves.toEqual(okBody);
    expect(calls).toBe(3);
  });

  it('讀取重試耗盡後才拋錯', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls += 1; return reply(404); });
    await expect(callPerfApi({ action: 'list' })).rejects.toThrow('HTTP 404');
    expect(calls).toBe(3); // 首次 + 2 次重試
  });

  it('寫入絕不重試（避免重複新增）', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls += 1; return reply(404); });
    await expect(callPerfApi({ action: 'save' })).rejects.toThrow('HTTP 404');
    expect(calls).toBe(1);
  });

  it('權限或憑證錯誤不重試，直接回報原訊息', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async () => { calls += 1; return reply(200, { ok: false, error: '此帳號沒有這份試算表的編輯權限。' }); });
    await expect(callPerfApi({ action: 'list' })).rejects.toThrow('編輯權限');
    expect(calls).toBe(1);
  });

  it('每次請求都帶不同的防快取參數', async () => {
    const urls = [];
    vi.stubGlobal('fetch', async (u) => { urls.push(u); return urls.length < 2 ? reply(404) : reply(200, okBody); });
    await callPerfApi({ action: 'list' });
    expect(urls).toHaveLength(2);
    expect(urls[0]).not.toBe(urls[1]);
  });
});

describe('設定', () => {
  it('API 網址已設定', () => {
    expect(isApiConfigured()).toBe(true);
  });
  it('CSV 網址可指定工作表', () => {
    expect(perfCsvUrl('研究著作-專書')).toContain('sheet=');
    expect(perfCsvUrl()).not.toContain('sheet=');
  });
});
