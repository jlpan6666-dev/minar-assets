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

// 去掉空白（含全形）再比對，避免「設 備 名 稱」這種手打欄名對不上
export const headerKey = (text) => LOOKUP[String(text ?? '').replace(/[\s　]/g, '')] || null;

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
