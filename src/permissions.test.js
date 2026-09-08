import { describe, it, expect } from 'vitest';
import {
  SYSTEM_IDS, ACCESS_LEVELS, LEVEL_LABELS, isOwnerEmail, normalizeMembers, getAccess,
  levelFor, canEnterSystem, canEditIn, hasAnyAccess, levelsForAll, canManageMembers,
} from './permissions';

describe('isOwnerEmail', () => {
  it('教師帳號不分大小寫皆為 true', () => {
    expect(isOwnerEmail('jlpan0126@gmail.com')).toBe(true);
    expect(isOwnerEmail('JLPAN6666@GMAIL.COM')).toBe(true);
    expect(isOwnerEmail('jim635241@gmail.com')).toBe(true);
  });
  it('非教師、空值為 false', () => {
    expect(isOwnerEmail('student@gmail.com')).toBe(false);
    expect(isOwnerEmail('')).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });
});

describe('權限等級設定', () => {
  it('五個入口都可分配', () => {
    expect(SYSTEM_IDS).toEqual(['lab', 'property_jl', 'property_kung', 'performance', 'projects']);
  });
  it('三種權限由低到高，管理成員是獨立選項不列在其中', () => {
    expect(ACCESS_LEVELS).toEqual(['none', 'low', 'mid']);
    expect(LEVEL_LABELS.none).toBe('禁止存取');
    expect(LEVEL_LABELS.mid).toBe('可讀寫');
    expect(LEVEL_LABELS.high).toBeUndefined();
  });
  it('levelsForAll 產生所有入口同一等級', () => {
    const all = levelsForAll('low');
    expect(Object.keys(all)).toHaveLength(5);
    expect(all.lab).toBe('low');
  });
});

describe('normalizeMembers 三種格式相容', () => {
  it('新版 levels 原樣保留，缺少的入口補為禁止存取', () => {
    const out = normalizeMembers({ members: [{ email: 'a@b.c', levels: { lab: 'mid' } }] });
    expect(out[0].levels.lab).toBe('mid');
    expect(out[0].levels.performance).toBe('none'); // 未指定 → 禁止存取
    expect(Object.keys(out[0].levels)).toHaveLength(5);
  });

  it('舊版 level+systems 依授權入口展開，其餘為禁止存取', () => {
    const out = normalizeMembers({ members: [{ email: 'a@b.c', level: 'low', systems: ['lab', 'performance'] }] });
    expect(out[0].levels).toEqual({
      lab: 'low', property_jl: 'none', property_kung: 'none', performance: 'low', projects: 'none',
    });
  });

  it('更舊的 emails 陣列 → 全部入口可讀寫', () => {
    const out = normalizeMembers({ emails: ['a@b.c'] });
    expect(out[0].levels).toEqual(levelsForAll('mid'));
  });

  it('空物件/null 回傳空陣列', () => {
    expect(normalizeMembers({})).toEqual([]);
    expect(normalizeMembers(null)).toEqual([]);
  });
});

describe('getAccess', () => {
  const members = [{ email: 'stu@gmail.com', canManage: false, levels: { ...levelsForAll('none'), lab: 'low' } }];

  it('教師 → 全部入口可讀寫且可管理成員（即使不在名單）', () => {
    const a = getAccess('jlpan6666@gmail.com', []);
    expect(a.levels).toEqual(levelsForAll('mid'));
    expect(a.canManage).toBe(true);
  });
  it('名單成員 → 其設定值，email 比對不分大小寫', () => {
    expect(getAccess('STU@gmail.com', members).levels.lab).toBe('low');
    expect(getAccess('STU@gmail.com', members).canManage).toBe(false);
  });
  it('不在名單、空 email → null', () => {
    expect(getAccess('nobody@gmail.com', members)).toBeNull();
    expect(getAccess('', members)).toBeNull();
    expect(getAccess(null, members)).toBeNull();
  });
});

describe('canManageMembers 可管理成員', () => {
  it('老師帳號可管理', () => {
    expect(canManageMembers(getAccess('jlpan6666@gmail.com', []))).toBe(true);
  });
  it('被勾選可管理的成員也可以', () => {
    const members = [{ email: 'ta@gmail.com', canManage: true, levels: levelsForAll('mid') }];
    expect(canManageMembers(getAccess('ta@gmail.com', members))).toBe(true);
  });
  it('一般成員不可管理', () => {
    const members = [{ email: 'stu@gmail.com', canManage: false, levels: levelsForAll('mid') }];
    expect(canManageMembers(getAccess('stu@gmail.com', members))).toBe(false);
  });
  it('未授權者不可管理', () => {
    expect(canManageMembers(null)).toBe(false);
  });
});

describe('舊資料的同老師權限收斂為可讀寫', () => {
  it('levels 內的 high → mid', () => {
    const out = normalizeMembers({ members: [{ email: 'a@b.c', levels: { lab: 'high' } }] });
    expect(out[0].levels.lab).toBe('mid');
  });
  it('舊版 level=high + systems 也轉為 mid', () => {
    const out = normalizeMembers({ members: [{ email: 'a@b.c', level: 'high', systems: ['lab'] }] });
    expect(out[0].levels.lab).toBe('mid');
  });
  it('未知等級視為禁止存取', () => {
    const out = normalizeMembers({ members: [{ email: 'a@b.c', levels: { lab: 'superuser' } }] });
    expect(out[0].levels.lab).toBe('none');
  });
  it('舊資料沒有 canManage 欄位時預設為否', () => {
    const out = normalizeMembers({ members: [{ email: 'a@b.c', levels: { lab: 'mid' } }] });
    expect(out[0].canManage).toBe(false);
  });
});

describe('逐入口權限判定', () => {
  // 每個入口各自不同的設定，正是這次改版的重點
  const access = {
    levels: {
      lab: 'high',           // 同老師權限
      property_jl: 'mid',    // 可讀寫
      property_kung: 'low',  // 唯讀
      performance: 'none',   // 禁止存取
      projects: 'mid',
    },
  };

  it('levelFor 取得該入口的等級，未設定視為禁止存取', () => {
    expect(levelFor(access, 'lab')).toBe('high');
    expect(levelFor(access, 'performance')).toBe('none');
    expect(levelFor(null, 'lab')).toBe('none');
  });

  it('canEnterSystem：非禁止存取即可進入', () => {
    expect(canEnterSystem(access, 'lab')).toBe(true);
    expect(canEnterSystem(access, 'property_kung')).toBe(true); // 唯讀也進得去
    expect(canEnterSystem(access, 'performance')).toBe(false);
    expect(canEnterSystem(null, 'lab')).toBe(false);
  });

  it('canEditIn：唯讀與禁止存取不可編輯', () => {
    expect(canEditIn(access, 'lab')).toBe(true);
    expect(canEditIn(access, 'property_jl')).toBe(true);
    expect(canEditIn(access, 'property_kung')).toBe(false); // 唯讀
    expect(canEditIn(access, 'performance')).toBe(false);
  });

  it('同一人可以在不同入口有不同權限', () => {
    expect(levelFor(access, 'lab')).not.toBe(levelFor(access, 'property_kung'));
    expect(canEditIn(access, 'property_jl')).toBe(true);
    expect(canEditIn(access, 'property_kung')).toBe(false);
  });

  it('hasAnyAccess：全部禁止存取才算無效成員', () => {
    expect(hasAnyAccess(access)).toBe(true);
    expect(hasAnyAccess({ levels: levelsForAll('none') })).toBe(false);
    expect(hasAnyAccess(null)).toBe(false);
  });
});
