// 純函式：把 Excel 工作表（純文字格子 + 浮動圖片錨點）解析成可寫入的資料列
// 不依賴 ExcelJS／React／Firebase，可單獨測試

// 欄位別名 → 內部欄位名。同一個檔案可能混用實驗室設備與財產的欄名，一起認就好
const ALIASES = {
  tableName: ['所屬表單'],
  propId: ['財產編號', '材料編號'],
  name: ['設備名稱', '財產名稱', '材料設備', '名稱', '品名'],
  categoryName: ['分類', '類別'],
  quantity: ['總數量', '數量'],
  brandModel: ['廠牌型別', '廠牌型式', '廠牌'],
  value: ['現值'],
  acquireDate: ['取得日期'],
  lifespan: ['使用年限'],
  user: ['使用人'],
  location: ['存置地點', '存放位置'],
  note: ['備註'],
  status: ['盤點狀況'],
  image: ['圖片', '照片', '相片', '圖片網址'],
};

export const FIELD_KEYS = Object.keys(ALIASES);

const LOOKUP = Object.entries(ALIASES).reduce((acc, [key, names]) => {
  names.forEach((n) => { acc[n] = key; });
  return acc;
}, {});

// 去掉空白再比對，避免「設 備 名 稱」這種手打欄名對不上（\s 已涵蓋全形空白 U+3000）
export const headerKey = (text) => LOOKUP[String(text ?? '').replace(/\s/g, '')] || null;

// 表頭列＝第一列能認出兩個以上欄名的（前面常有標題列、空列）
export const findHeaderRow = (rows) => {
  const limit = Math.min(rows?.length || 0, 20);
  for (let i = 0; i < limit; i += 1) {
    const hit = new Set((rows[i] || []).map(headerKey).filter(Boolean));
    if (hit.size >= 2) return i;
  }
  return -1;
};

// 同一列可能左右並排好幾組相同欄位（使用者那份感測器清單就是 C:E 與 H:J 兩組）
// 由左往右掃，遇到「這組已經出現過的欄名」就開新的一組
export const buildGroups = (headerCells = []) => {
  const groups = [];
  let cur = null;
  headerCells.forEach((cellText, col) => {
    const key = headerKey(cellText);
    if (!key) return;
    if (!cur || cur.cols[key] !== undefined) {
      cur = { cols: {}, minCol: col };
      groups.push(cur);
    }
    cur.cols[key] = col;
  });
  return groups;
};

// 圖片錨在哪一欄 → 屬於哪一組：優先對到該組的圖片欄，否則歸給左側最近的一組
export const groupForColumn = (groups, col) => {
  const exact = groups.findIndex((g) => g.cols.image === col);
  if (exact >= 0) return exact;
  let best = -1;
  groups.forEach((g, i) => { if (g.minCol <= col) best = i; });
  return best;
};

const cellText = (row, col) => (col === undefined ? '' : String(row?.[col] ?? '').trim());

// 沒有表頭時的退路：沿用舊版「依位置對應」的財產欄序
const POSITIONAL = ['propId', 'name', 'brandModel', 'value', 'acquireDate', 'lifespan', 'user', 'location', 'note', 'status'];

/**
 * rows   0-based 的純文字二維陣列
 * images [{ row, col, dataUrl }]，row/col 皆 0-based 錨點
 * 回傳   { headerRow, groups, records }；record = { row, group, fields, image }
 */
export const parseSheet = (rows = [], images = []) => {
  const headerRow = findHeaderRow(rows);

  if (headerRow < 0) {
    // 認不出欄名就照舊用位置對應，避免既有的學校格式匯入失效
    const offset = String(rows?.[0]?.[0] ?? '').trim() === '所屬表單' ? 1 : 0;
    const records = [];
    for (let r = 1; r < rows.length; r += 1) {
      const fields = {};
      POSITIONAL.forEach((key, i) => { fields[key] = cellText(rows[r], i + offset); });
      if (offset) fields.tableName = cellText(rows[r], 0);
      if (fields.propId || fields.name) records.push({ row: r, group: 0, fields, image: null });
    }
    return { headerRow: 0, groups: [], records };
  }

  const groups = buildGroups(rows[headerRow]);
  const records = [];
  const index = new Map(); // `${row}:${group}` → record

  for (let r = headerRow + 1; r < rows.length; r += 1) {
    groups.forEach((g, gi) => {
      const fields = {};
      Object.entries(g.cols).forEach(([key, col]) => { fields[key] = cellText(rows[r], col); });
      if (!fields.name && !fields.propId) return;
      // 圖片欄若是網址或 data URI，直接當成圖片來源
      const text = fields.image || '';
      const rec = { row: r, group: gi, fields, image: /^(https?:|data:image)/i.test(text) ? text : null };
      records.push(rec);
      index.set(`${r}:${gi}`, rec);
    });
  }

  // 嵌入的浮動圖片蓋過文字欄（同一列兩者都有時，嵌入圖才是使用者看到的那張）
  images.forEach(({ row, col, dataUrl }) => {
    if (!dataUrl) return;
    const gi = groupForColumn(groups, col);
    const rec = index.get(`${row}:${gi < 0 ? 0 : gi}`);
    if (rec) rec.image = dataUrl;
  });

  return { headerRow, groups, records };
};

// 數量欄可能是 "12"、"12 個"、空白
export const toQuantity = (text) => {
  const n = parseInt(String(text ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

// --- 匯出 ---

// 把每筆資料的 imageUrl 攤成「圖片欄文字」與「要嵌入的圖片清單」
// base64 的嵌進檔案裡；外部網址嵌不進去（跨網域抓不到），改寫成文字讓人點得到
// imageCol 為 0-based 欄號；回傳的 images.row 已含表頭列（第一筆資料是 row 1）
export const buildImageColumn = (items = [], imageCol = 0) => {
  const images = [];
  const texts = items.map((item, i) => {
    const url = item?.imageUrl || '';
    if (url.startsWith('data:image')) {
      images.push({ row: i + 1, col: imageCol, dataUrl: url });
      return '';
    }
    return url;
  });
  return { texts, images };
};

// --- 統一匯入格式 ---
// 一份範本兩個系統通用：實驗室設備只要填 名稱/分類/數量/備註/圖片，
// 財產盤點再多填 財產編號 之後那幾欄。匯入是依欄名對應，用不到的欄留空即可
export const TEMPLATE_HEADERS = [
  '名稱', '分類', '數量', '備註', '圖片',
  '財產編號', '廠牌型別', '現值', '取得日期', '使用年限', '使用人', '存置地點', '盤點狀況',
];

export const TEMPLATE_EXAMPLE_ROWS = [
  ['土壤溼度感測器', '感測器', '29', '放在 A3 抽屜', '', '', '', '', '', '', '', '', ''],
  ['示波器', '', '1', '', '', 'P-001', 'ACME X1', '12000', '2024/03/01', '5', '王小明', 'A-101', '未盤點'],
];

export const TEMPLATE_NOTES = [
  ['欄位', '說明'],
  ['名稱', '必填。實驗室設備管理與財產盤點都用這一欄。'],
  ['圖片', '把圖片直接貼在這一欄的格子裡即可，匯入時會自動抓進系統；也可以填圖片網址。'],
  ['數量', '只有實驗室設備管理會用到，填數字。'],
  ['分類', '只有實驗室設備管理會用到；名稱要和系統既有分類一致才會自動歸類。'],
  ['財產編號 以後各欄', '只有財產盤點會用到，實驗室設備可整欄留空。'],
  ['盤點狀況', '留空視為「未盤點」。'],
  ['欄位順序', '可以自由調換，也可以刪掉用不到的欄，系統是依欄名對應而不是依欄序。'],
];
