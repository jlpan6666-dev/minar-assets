// 櫃位（抽屜格）計算的純函式：不依賴 React / Firebase，可單獨測試
// 櫃位代碼格式為「欄字母 + 列數字」，例如 A1、C7、H12（欄 A 起算，列 1 起算）

export const DEFAULT_COLS = 8;   // A..H
export const DEFAULT_ROWS = 12;  // 1..12
export const MAX_COLS = 26;      // A..Z
export const MAX_ROWS = 40;

// 0 → 'A'、1 → 'B'…（超出 A~Z 回空字串）
export const colLetter = (index) => (index >= 0 && index < 26 ? String.fromCharCode(65 + index) : '');

// (0, 1) → 'A1'
export const formatSlot = (colIndex, row) => `${colLetter(colIndex)}${row}`;

// 'a1' / ' C7 ' → { colIndex, row }；格式錯誤或超出範圍回 null
export const parseSlot = (slot) => {
  const m = /^([A-Za-z])\s*(\d{1,2})$/.exec(String(slot || '').trim());
  if (!m) return null;
  const colIndex = m[1].toUpperCase().charCodeAt(0) - 65;
  const row = Number(m[2]);
  if (row < 1 || row > MAX_ROWS) return null;
  return { colIndex, row };
};

// 正規化使用者輸入：'a1' → 'A1'；無效回空字串（代表未配置櫃位）
export const normalizeSlot = (slot) => {
  const p = parseSlot(slot);
  return p ? formatSlot(p.colIndex, p.row) : '';
};

// 單一設備的可借數量（總數 - 借出數，不小於 0）
const availableOf = (item) => Math.max(0, (Number(item.quantity) || 0) - (Number(item.borrowedCount) || 0));

// 一格的狀態：空的 / 全借出 / 低庫存 / 有貨
// lowStockThreshold 與系統既有的「低庫存警示」一致（預設剩餘低於 3 件）
export const slotStatus = (items, lowStockThreshold = 3) => {
  if (!items || items.length === 0) return 'empty';
  const available = items.reduce((sum, it) => sum + availableOf(it), 0);
  if (available === 0) return 'out';
  if (available < lowStockThreshold) return 'low';
  return 'ok';
};

// 設備清單 → 櫃位格陣列（依列由上而下、欄由左而右）
// 回傳每格：{ slot, colIndex, row, items, total, available, status }
export const buildGrid = (items = [], { cols = DEFAULT_COLS, rows = DEFAULT_ROWS, lowStockThreshold = 3 } = {}) => {
  const bySlot = new Map();
  items.forEach((it) => {
    const slot = normalizeSlot(it.cabinet);
    if (!slot) return;
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(it);
  });

  const grid = [];
  for (let row = 1; row <= rows; row++) {
    for (let colIndex = 0; colIndex < cols; colIndex++) {
      const slot = formatSlot(colIndex, row);
      const cellItems = bySlot.get(slot) || [];
      grid.push({
        slot,
        colIndex,
        row,
        items: cellItems,
        total: cellItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0),
        available: cellItems.reduce((s, it) => s + availableOf(it), 0),
        status: slotStatus(cellItems, lowStockThreshold),
      });
    }
  }
  return grid;
};

// 各狀態的格數統計，供篩選列顯示（全部 / 空的 / 有貨 / 低庫存 / 全借出）
export const countByStatus = (grid = []) => {
  const counts = { all: grid.length, empty: 0, ok: 0, low: 0, out: 0 };
  grid.forEach((cell) => { counts[cell.status] += 1; });
  return counts;
};

// 未配置櫃位的設備（櫃位空白或格式錯誤）
export const unassignedItems = (items = []) => items.filter((it) => !normalizeSlot(it.cabinet));

// 讓網格至少容納所有已使用的櫃位（避免設定太小導致設備藏起來看不到）
export const fitGridSize = (items = [], { cols = DEFAULT_COLS, rows = DEFAULT_ROWS } = {}) => {
  let maxCol = cols, maxRow = rows;
  items.forEach((it) => {
    const p = parseSlot(it.cabinet);
    if (!p) return;
    if (p.colIndex + 1 > maxCol) maxCol = p.colIndex + 1;
    if (p.row > maxRow) maxRow = p.row;
  });
  return { cols: Math.min(maxCol, MAX_COLS), rows: Math.min(maxRow, MAX_ROWS) };
};
