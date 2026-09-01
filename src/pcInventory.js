// 電腦盤點試算表的純函式：不依賴 React / Firebase，可單獨測試
// 資料由「電腦資訊快速查詢.bat」掃描後寫入 Google 試算表，系統端只負責讀取顯示（唯讀）

export const PC_SHEET_ID = '1qVp95yg-6HGSb2kWQ4-Bg8E-uF6mFgusYbEH_9uYm6E';
export const PC_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${PC_SHEET_ID}/edit`;
// gviz 端點對公開試算表會回傳 CORS 標頭，可直接於瀏覽器讀取
export const PC_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${PC_SHEET_ID}/gviz/tq?tqx=out:csv`;

// 掃描工具（放在 public/，部署後同網域可直接下載；壓縮檔可避免瀏覽器攔截 .bat）
export const SCAN_TOOL_PATH = '/pc-scan.zip';
export const SCAN_TOOL_FILENAME = '電腦資訊快速查詢_v3.zip';

// 表頭關鍵欄位，用來辨識第一列是否為表頭（欄位格式以試算表為準，不在系統端改動）
const HEADER_HINT = '設備識別碼';

const clean = (v) => (v == null ? '' : String(v).trim());

// CSV 二維陣列 → { headers, rows }
// 完全依試算表原始欄位順序，不重新命名、不增減欄位；尾端全空的欄位會被裁掉
export const parsePcRows = (csvRows) => {
  if (!Array.isArray(csvRows) || csvRows.length === 0) return { headers: [], rows: [] };

  const first = csvRows[0].map(clean);
  const hasHeader = first.includes(HEADER_HINT);
  const headers = hasHeader ? first : [];
  const body = (hasHeader ? csvRows.slice(1) : csvRows)
    .map(r => (Array.isArray(r) ? r.map(clean) : []))
    .filter(r => r.some(v => v !== '')); // 略過整列空白

  // 裁掉尾端沒有標題、也沒有任何資料的欄位（試算表常見的多餘空欄）
  let width = headers.length || Math.max(0, ...body.map(r => r.length));
  while (width > 0) {
    const i = width - 1;
    const headerEmpty = !clean(headers[i]);
    const colEmpty = body.every(r => !clean(r[i]));
    if (headerEmpty && colEmpty) width -= 1;
    else break;
  }

  return {
    headers: headers.slice(0, width),
    rows: body.map(r => Array.from({ length: width }, (_, i) => clean(r[i]))),
  };
};

// 關鍵字過濾：任一欄位包含關鍵字即保留（不分大小寫）
export const filterPcRows = (rows, term) => {
  const q = clean(term).toLowerCase();
  if (!q) return rows;
  return rows.filter(r => r.some(v => v.toLowerCase().includes(q)));
};

// 依「欄位名稱」取值（而非固定索引），這樣試算表調整欄位順序也不會錯位
// 先精準比對，找不到再退回包含比對；都沒有則回空字串
export const makeFieldGetter = (headers) => {
  const exact = new Map();
  headers.forEach((h, i) => { if (!exact.has(clean(h))) exact.set(clean(h), i); });
  return (row, name) => {
    let idx = exact.has(name) ? exact.get(name) : -1;
    if (idx < 0) idx = headers.findIndex(h => clean(h).includes(name));
    return idx >= 0 ? clean(row[idx]) : '';
  };
};

// 卡片主要欄位以外的其他欄位（展開時逐項列出，確保不漏資料）
export const restFields = (headers, row, usedNames) => {
  const used = new Set(usedNames);
  return headers
    .map((h, i) => ({ label: clean(h), value: clean(row[i]) }))
    .filter(f => !used.has(f.label) && f.value !== '');
};

// 找出「最後更新時間」欄的最大值，供畫面顯示資料新舊
export const latestUpdatedAt = (headers, rows) => {
  const idx = headers.findIndex(h => h.includes('最後更新'));
  if (idx < 0) return '';
  return rows.reduce((max, r) => (clean(r[idx]) > max ? clean(r[idx]) : max), '');
};
