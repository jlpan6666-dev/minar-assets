// 電腦盤點試算表的純函式：不依賴 React / Firebase，可單獨測試
// 資料由「電腦資訊快速查詢.bat」掃描後寫入 Google 試算表，系統端只負責讀取顯示（唯讀）

export const PC_SHEET_ID = '18yPL7bCspyBo2FEHQc-5OdNG_FwQPa8AuTe-v3XyZxM';
export const PC_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${PC_SHEET_ID}/edit`;
// gviz 端點對公開試算表會回傳 CORS 標頭，可直接於瀏覽器讀取
export const PC_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${PC_SHEET_ID}/gviz/tq?tqx=out:csv`;

// 掃描工具（放在 public/，部署後同網域可直接下載）
export const SCAN_TOOL_PATH = '/pc-scan.bat';
export const SCAN_TOOL_FILENAME = '電腦資訊快速查詢_v2.bat';

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

// 找出「最後更新時間」欄的最大值，供畫面顯示資料新舊
export const latestUpdatedAt = (headers, rows) => {
  const idx = headers.findIndex(h => h.includes('最後更新'));
  if (idx < 0) return '';
  return rows.reduce((max, r) => (clean(r[idx]) > max ? clean(r[idx]) : max), '');
};
