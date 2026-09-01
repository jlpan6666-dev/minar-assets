// 龔老師績效試算表的純函式：不依賴 React / Firebase，可單獨測試
// 顯示走公開 CSV（所有成員可看）；新增/修改走 Sheets API（需該試算表的編輯權限）

export const PERF_SHEET_ID = '16d-1IZ9ZYU4V0oqfEXI9PWFqZoHMXBOAo7kScCcfzhA';
export const PERF_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${PERF_SHEET_ID}/edit`;
export const PERF_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${PERF_SHEET_ID}/gviz/tq?tqx=out:csv`;

// 需要的 Google 權限：讀寫試算表 + 讀取檔案權限資訊（判斷這個帳號能不能編輯）
export const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

const API = 'https://sheets.googleapis.com/v4/spreadsheets';
// 省略工作表名稱時，範圍套用到第一個工作表
export const valuesUrl = (range) => `${API}/${PERF_SHEET_ID}/values/${encodeURIComponent(range)}`;
export const appendUrl = () => `${valuesUrl('A:B')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
export const updateUrl = (rowNumber) => `${valuesUrl(`A${rowNumber}:B${rowNumber}`)}?valueInputOption=RAW`;
export const canEditUrl = () => `https://www.googleapis.com/drive/v3/files/${PERF_SHEET_ID}?fields=capabilities(canEdit),name`;

const clean = (v) => (v == null ? '' : String(v).trim());

// CSV 二維陣列 → [{ rowNumber, seq, content }]
// rowNumber 為試算表實際列號（含表頭），供 Sheets API 更新該列使用
export const parsePerfRows = (csvRows) => {
  if (!Array.isArray(csvRows) || csvRows.length === 0) return [];
  const out = [];
  csvRows.forEach((row, i) => {
    if (!Array.isArray(row)) return;
    const seq = clean(row[0]);
    const content = clean(row[1]);
    if (i === 0 && seq === '案次') return;      // 表頭
    if (!seq && !content) return;                // 空列
    out.push({ rowNumber: i + 1, seq, content });
  });
  return out;
};

// 關鍵字過濾（案次或內容命中即保留）
export const filterPerfRows = (rows, term) => {
  const q = clean(term).toLowerCase();
  if (!q) return rows;
  return rows.filter(r => `${r.seq} ${r.content}`.toLowerCase().includes(q));
};

// 新增時自動給下一個案次編號（現有最大數字 +1；沒有數字則從 1 開始）
export const nextSeq = (rows) => {
  const nums = rows.map(r => parseInt(r.seq, 10)).filter(n => !Number.isNaN(n));
  return String(nums.length ? Math.max(...nums) + 1 : 1);
};
