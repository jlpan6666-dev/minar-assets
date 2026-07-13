// 純函式權限模組：不依賴 React / Firebase，可單獨測試
export const SYSTEM_IDS = ['lab', 'property_jl', 'property_kung'];

export const LEVEL_LABELS = {
  high: '高：同老師權限',
  mid: '中：可讀寫',
  low: '低：僅瀏覽',
};

// 教師/管理者帳號直接寫死（免邀請即可登入，且不可被名單移除）
export const OWNER_EMAILS = ['jlpan0126@gmail.com', 'jlpan6666@gmail.com', 'jim635241@gmail.com'];

export const isOwnerEmail = (email) => OWNER_EMAILS.includes((email || '').toLowerCase());

// Firestore 文件 → Member[]；相容舊格式 {emails:[...]}（視為中權限、全系統）
export const normalizeMembers = (data) => {
  if (!data) return [];
  if (Array.isArray(data.members)) return data.members;
  if (Array.isArray(data.emails)) {
    return data.emails.map((email) => ({ email, level: 'mid', systems: SYSTEM_IDS }));
  }
  return [];
};

// email → { level, systems } 或 null（未授權）
export const getAccess = (email, members) => {
  const lower = (email || '').toLowerCase();
  if (!lower) return null;
  if (isOwnerEmail(lower)) return { level: 'high', systems: SYSTEM_IDS };
  const m = members.find((x) => (x.email || '').toLowerCase() === lower);
  return m ? { level: m.level, systems: m.systems } : null;
};
