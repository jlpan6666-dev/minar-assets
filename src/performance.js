// 龔老師績效試算表的純函式：不依賴 React / Firebase，可單獨測試
//
// 讀寫都經由 Apps Script（apps-script/performance-api.gs）：
//   - 使用者不需要任何 Google 授權，也不會看到「未驗證應用程式」警告
//   - 能不能編輯，由該試算表的共用設定決定（編輯者才能改）
// 尚未部署 Apps Script 時，自動退回公開 CSV 唯讀顯示。

export const PERF_SHEET_ID = '16d-1IZ9ZYU4V0oqfEXI9PWFqZoHMXBOAo7kScCcfzhA';
export const PERF_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${PERF_SHEET_ID}/edit`;
export const PERF_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${PERF_SHEET_ID}/gviz/tq?tqx=out:csv`;

// 🟢 部署 apps-script/performance-api.gs 後，把「網頁應用程式網址」貼在這裡
// 留空時：頁面仍可正常顯示（讀公開 CSV），但不提供編輯功能
export const PERF_API_URL = '';

export const isApiConfigured = () => PERF_API_URL.startsWith('https://');

const clean = (v) => (v == null ? '' : String(v).trim());

// 二維陣列（CSV 或 Apps Script 回傳）→ [{ rowNumber, seq, content }]
// rowNumber 為試算表實際列號（含表頭），供更新該列使用
export const parsePerfRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out = [];
  rows.forEach((row, i) => {
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

// 呼叫 Apps Script。刻意使用 text/plain 以避開 CORS 預檢（preflight）；
// Apps Script 端讀的是 e.postData.contents，不受 Content-Type 影響。
export const callPerfApi = async (payload) => {
  const res = await fetch(PERF_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`伺服器回應 HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '操作失敗');
  return data;
};
