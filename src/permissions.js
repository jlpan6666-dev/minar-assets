// 純函式權限模組：不依賴 React / Firebase，可單獨測試
// 五個入口都可由老師在成員管理中「逐一入口」設定權限
export const SYSTEM_IDS = ['lab', 'property_jl', 'property_kung', 'performance', 'projects'];

// 每個入口各自可選的權限（由低到高）
export const ACCESS_LEVELS = ['none', 'low', 'mid', 'high'];

export const LEVEL_LABELS = {
  none: '禁止存取',
  low: '唯讀',
  mid: '可讀寫',
  high: '同老師權限',
};

// 教師/管理者帳號直接寫死（免邀請即可登入、全部入口最高權限，且不可被名單移除）
// 成員管理也只有這些帳號能操作——避免被授予「同老師權限」的人反過來提升自己其他入口的權限
export const OWNER_EMAILS = ['jlpan0126@gmail.com', 'jlpan6666@gmail.com', 'jim635241@gmail.com'];

export const isOwnerEmail = (email) => OWNER_EMAILS.includes((email || '').toLowerCase());

// 所有入口都給同一個等級，用於建立預設值與舊資料轉換
export const levelsForAll = (level) =>
  SYSTEM_IDS.reduce((acc, id) => ({ ...acc, [id]: level }), {});

// 舊格式的整體等級 → 各入口等級（僅被授權的入口沿用該等級，其餘為禁止存取）
const fromLegacy = (level, systems = []) =>
  SYSTEM_IDS.reduce((acc, id) => ({ ...acc, [id]: systems.includes(id) ? (level || 'mid') : 'none' }), {});

// Firestore 文件 → Member[]，每筆為 { email, levels }
// 相容三種格式：
//   1. 新版 { members: [{ email, levels }] }
//   2. 舊版 { members: [{ email, level, systems }] }  → 依 systems 展開
//   3. 更舊 { emails: [...] }                         → 全部入口可讀寫
export const normalizeMembers = (data) => {
  if (!data) return [];

  if (Array.isArray(data.members)) {
    return data.members.map((m) => ({
      email: m.email,
      levels: m.levels ? { ...levelsForAll('none'), ...m.levels } : fromLegacy(m.level, m.systems),
    }));
  }

  if (Array.isArray(data.emails)) {
    return data.emails.map((email) => ({ email, levels: levelsForAll('mid') }));
  }

  return [];
};

// email → { levels } 或 null（未授權）
export const getAccess = (email, members) => {
  const lower = (email || '').toLowerCase();
  if (!lower) return null;
  if (isOwnerEmail(lower)) return { levels: levelsForAll('high') };
  const m = members.find((x) => (x.email || '').toLowerCase() === lower);
  return m ? { levels: m.levels } : null;
};

// 某人在某個入口的權限
export const levelFor = (access, systemId) => access?.levels?.[systemId] || 'none';

// 能不能看到／進入這個入口
export const canEnterSystem = (access, systemId) => levelFor(access, systemId) !== 'none';

// 在這個入口能不能編輯（唯讀不行）
export const canEditIn = (access, systemId) => ['mid', 'high'].includes(levelFor(access, systemId));

// 至少有一個入口可進入，才算是有效成員
export const hasAnyAccess = (access) => SYSTEM_IDS.some((id) => canEnterSystem(access, id));
