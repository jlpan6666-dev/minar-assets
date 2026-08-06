// Google 試算表同步的純函式：不依賴 React / Firebase，可單獨測試
// 線上試算表欄位（順序即為匯出/匯入依據）
export const SHEET_HEADERS = [
  '材料設備', '材料編號', '數量', '借用人(學號)', '預約日期(起訖)', '預約日期(訖)', '電話', '信箱', '備註',
];

const COL_NAME = 0;
const COL_QUANTITY = 2;
const COL_NOTE = 8;

const clean = (v) => (v == null ? '' : String(v).trim());
const key = (name) => clean(name).toLowerCase();

// CSV 二維陣列 → [{ name, quantity, note }]
// 略過表頭列與無名稱列；數量非數字視為 0
export const parseSheetRows = (rows) => {
  if (!Array.isArray(rows)) return [];
  const out = [];
  rows.forEach((row, i) => {
    if (!Array.isArray(row)) return;
    const name = clean(row[COL_NAME]);
    if (!name) return;
    if (i === 0 && name === SHEET_HEADERS[COL_NAME]) return; // 表頭
    const quantity = parseInt(clean(row[COL_QUANTITY]), 10);
    out.push({ name, quantity: Number.isNaN(quantity) ? 0 : quantity, note: clean(row[COL_NOTE]) });
  });
  return out;
};

// 試算表資料 vs 現有設備 → 要新增／要更新／不變
// 比對鍵為設備名稱（去空白、不分大小寫）；同名重複列以最後一列為準
export const diffEquipment = (sheetRows, existingItems = []) => {
  const existing = new Map();
  existingItems.forEach((item) => {
    const k = key(item.name);
    if (k) existing.set(k, item);
  });

  const toAdd = [];
  const toUpdate = [];
  let unchanged = 0;
  const seen = new Set();

  sheetRows.forEach((row) => {
    const k = key(row.name);
    if (seen.has(k)) {
      // 同名重複：移除先前結果，改用最後一列
      const idxAdd = toAdd.findIndex((r) => key(r.name) === k);
      if (idxAdd >= 0) toAdd.splice(idxAdd, 1);
      const idxUpd = toUpdate.findIndex((r) => key(r.name) === k);
      if (idxUpd >= 0) toUpdate.splice(idxUpd, 1);
    }
    seen.add(k);

    const item = existing.get(k);
    if (!item) { toAdd.push(row); return; }

    const changes = {};
    if (item.quantity !== row.quantity) changes.quantity = row.quantity;
    if (clean(item.note) !== row.note) changes.note = row.note;
    if (Object.keys(changes).length === 0) { unchanged++; return; }
    toUpdate.push({ id: item.id, name: item.name, changes });
  });

  return { toAdd, toUpdate, unchanged };
};
