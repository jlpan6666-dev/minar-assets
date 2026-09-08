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

// 🟢 各系統的進入門檻（取代原本的密碼登入）
//   edit  = 需可讀寫（中或高）
//   admin = 需老師權限（高）
//   未列出 = 任何授權成員皆可進入
export const SYSTEM_REQUIREMENTS = {
  lab: 'edit',
  property_jl: 'admin',
  property_kung: 'admin',
};

export const REQUIREMENT_LABELS = {
  edit: '需可讀寫權限',
  admin: '需老師權限',
};

export const meetsRequirement = (level, requirement) => {
  if (requirement === 'admin') return level === 'high';
  if (requirement === 'edit') return level === 'high' || level === 'mid';
  return true; // 無門檻
};

// 這個人能不能進入該系統：要在授權名單內，且達到該系統的門檻
export const canEnterSystem = (access, systemId) =>
  !!access
  && access.systems.includes(systemId)
  && meetsRequirement(access.level, SYSTEM_REQUIREMENTS[systemId]);
