// 龔老師成果績效試算表的純函式：不依賴 React / Firebase，可單獨測試
//
// 這份試算表有 25 張工作表，每張的欄位都不同（案次+內容、編號+分類+名稱、年度+姓名+論文…），
// 因此一律以「該張表自己的表頭」為準通用呈現，不在系統端假設欄位。
//
// 讀寫都經由 Apps Script（apps-script/performance-api.gs）：
//   - 使用者不需要任何 Google 授權，也不會看到「未驗證應用程式」警告
//   - 能不能編輯，由該試算表的共用設定決定（編輯者才能改）

export const PERF_SHEET_ID = '16d-1IZ9ZYU4V0oqfEXI9PWFqZoHMXBOAo7kScCcfzhA';
export const PERF_SHEET_EDIT_URL = `https://docs.google.com/spreadsheets/d/${PERF_SHEET_ID}/edit`;
export const perfCsvUrl = (sheetName) =>
  `https://docs.google.com/spreadsheets/d/${PERF_SHEET_ID}/gviz/tq?tqx=out:csv${sheetName ? `&sheet=${encodeURIComponent(sheetName)}` : ''}`;

// 🟢 apps-script/performance-api.gs 的部署網址
// 留空時：頁面仍可顯示第一張工作表（讀公開 CSV），但不提供編輯功能
// 註：更新腳本請用「管理部署作業 → 新版本」，網址才不會變
export const PERF_API_URL = 'https://script.google.com/macros/s/AKfycbysK4jvbblqoYtVorHnxd-MmpmK3FdHF01V_lcUOf8EjqS50zHfC3HRV9v_vgjrzvm-Xg/exec';

export const isApiConfigured = () => PERF_API_URL.startsWith('https://');

const clean = (v) => (v == null ? '' : String(v).trim());

// 二維陣列（CSV 或 Apps Script 回傳）→ { headers, rows: [{ rowNumber, cells }] }
// rowNumber 為試算表實際列號（含表頭），供更新該列使用
// 尾端「無標題且整欄空白」的欄位會被裁掉（試算表常見的多餘空欄）
export const parseSheetTable = (values) => {
  if (!Array.isArray(values) || values.length === 0) return { headers: [], rows: [] };

  const headers = (values[0] || []).map(clean);
  const body = values.slice(1).map((r, i) => ({
    rowNumber: i + 2, // 表頭為第 1 列
    cells: (Array.isArray(r) ? r : []).map(clean),
  })).filter(r => r.cells.some(c => c !== ''));

  let width = Math.max(headers.length, ...body.map(r => r.cells.length), 0);
  while (width > 0) {
    const i = width - 1;
    if (!headers[i] && body.every(r => !r.cells[i])) width -= 1;
    else break;
  }

  return {
    headers: headers.slice(0, width),
    rows: body.map(r => ({ rowNumber: r.rowNumber, cells: Array.from({ length: width }, (_, i) => r.cells[i] || '') })),
  };
};

// 主要內容欄的索引（相對於「第一欄之後」）：取文字最長的那一欄。
// 比「固定用最後一欄」穩健——有些表尾端有多餘空欄（例：專利表）。
export const mainCellIndex = (cells = []) => {
  const rest = cells.slice(1);
  if (rest.length === 0) return -1;
  return rest.reduce((best, c, i) => (c.length > rest[best].length ? i : best), 0);
};

// 一列 → 可直接貼進文件的純文字：略過空欄，以空格串接
// 保留第一欄（年度、類別等有時是有意義的資訊；純序號使用者自行刪即可）
export const rowToText = (cells = []) => cells.map(clean).filter(Boolean).join(' ');

// 關鍵字過濾：任一欄位命中即保留（不分大小寫）
export const filterSheetRows = (rows, term) => {
  const q = clean(term).toLowerCase();
  if (!q) return rows;
  return rows.filter(r => r.cells.some(c => c.toLowerCase().includes(q)));
};

// 第一欄是否為「1,2,3… 連續流水號」。
// 只有這種表才適合自動編號與重排——像「歷屆碩士畢業論文」第一欄是年度(90,91…)，
// 誤判會把年度覆蓋掉，因此條件訂得嚴格：必須從 1 開始且完全連續。
export const isSequenceColumn = (rows = []) => {
  if (rows.length === 0) return false;
  return rows.every((r, i) => String(r.cells?.[0] ?? '').trim() === String(i + 1));
};

// 新增時第一欄要帶的值：流水號表一律給 1（最新的排最前面），其他表留空由使用者填
export const newFirstCell = (rows) => (isSequenceColumn(rows) ? '1' : '');

// 工作表名稱以「-」分組，供下拉選單顯示（例：研究著作-專書 → 群組「研究著作」）
export const groupSheetNames = (names = []) => {
  const groups = [];
  names.forEach(name => {
    const idx = name.indexOf('-');
    const label = idx > 0 ? name.slice(0, idx) : '其他';
    const group = groups.find(g => g.label === label);
    if (group) group.items.push(name);
    else groups.push({ label, items: [name] });
  });
  return groups;
};

// 呼叫 Apps Script。刻意使用 text/plain 以避開 CORS 預檢（preflight）；
// Apps Script 端讀的是 e.postData.contents，不受 Content-Type 影響。
//
// Apps Script 偶發回傳 404/5xx（Google 端暫時性故障）。讀取是冪等的，可安全自動重試；
// 寫入若重試，可能在「其實已寫入成功但回應失敗」時重複新增一筆，因此一律不重試。
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isTransient = (e) => /HTTP (404|429|5\d\d)/.test(e.message) || e.name === 'TypeError';

export const callPerfApi = async (payload) => {
  const retries = payload.action === 'list' ? 2 : 0;
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // 每次都帶不同的查詢參數，避免瀏覽器重用 Apps Script 的一次性重導向網址
      const res = await fetch(`${PERF_API_URL}?_=${Date.now()}-${attempt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`伺服器回應 HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || '操作失敗'); // 業務錯誤（權限、憑證）不重試
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt < retries && isTransient(e)) { await sleep(500 * (attempt + 1)); continue; }
      throw e;
    }
  }
  throw lastErr;
};
