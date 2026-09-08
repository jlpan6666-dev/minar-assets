import { describe, it, expect } from 'vitest';
import { SYSTEM_IDS, isOwnerEmail, normalizeMembers, getAccess, meetsRequirement, canEnterSystem } from './permissions';

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

describe('normalizeMembers', () => {
  it('新格式 members 陣列原樣回傳', () => {
    const members = [{ email: 'a@b.c', level: 'low', systems: ['lab'] }];
    expect(normalizeMembers({ members })).toEqual(members);
  });
  it('舊格式 emails 陣列 → 中權限 + 全系統', () => {
    expect(normalizeMembers({ emails: ['a@b.c'] })).toEqual([
      { email: 'a@b.c', level: 'mid', systems: SYSTEM_IDS },
    ]);
  });
  it('members 優先於 emails；空物件/null 回傳空陣列', () => {
    expect(normalizeMembers({ members: [], emails: ['a@b.c'] })).toEqual([]);
    expect(normalizeMembers({})).toEqual([]);
    expect(normalizeMembers(null)).toEqual([]);
  });
});

describe('getAccess', () => {
  const members = [
    { email: 'stu@gmail.com', level: 'low', systems: ['property_jl'] },
  ];
  it('教師 → high + 全系統（即使不在名單）', () => {
    expect(getAccess('jlpan6666@gmail.com', [])).toEqual({ level: 'high', systems: SYSTEM_IDS });
  });
  it('名單成員 → 其設定值，email 比對不分大小寫', () => {
    expect(getAccess('STU@gmail.com', members)).toEqual({ level: 'low', systems: ['property_jl'] });
  });
  it('不在名單、空 email → null', () => {
    expect(getAccess('nobody@gmail.com', members)).toBeNull();
    expect(getAccess('', members)).toBeNull();
    expect(getAccess(null, members)).toBeNull();
  });
});

describe('meetsRequirement 權限門檻', () => {
  it('admin 只有高權限通過', () => {
    expect(meetsRequirement('high', 'admin')).toBe(true);
    expect(meetsRequirement('mid', 'admin')).toBe(false);
    expect(meetsRequirement('low', 'admin')).toBe(false);
  });
  it('edit 需中或高權限', () => {
    expect(meetsRequirement('high', 'edit')).toBe(true);
    expect(meetsRequirement('mid', 'edit')).toBe(true);
    expect(meetsRequirement('low', 'edit')).toBe(false);
  });
  it('無門檻時任何等級皆可', () => {
    expect(meetsRequirement('low', undefined)).toBe(true);
  });
});

describe('canEnterSystem 進入系統', () => {
  const all = SYSTEM_IDS;
  it('老師（高）三個系統都能進', () => {
    const a = { level: 'high', systems: all };
    expect(canEnterSystem(a, 'lab')).toBe(true);
    expect(canEnterSystem(a, 'property_jl')).toBe(true);
    expect(canEnterSystem(a, 'property_kung')).toBe(true);
  });
  it('中權限可進實驗室與建良老師，但進不了龔老師財產盤點', () => {
    const a = { level: 'mid', systems: all };
    expect(canEnterSystem(a, 'lab')).toBe(true);
    expect(canEnterSystem(a, 'property_jl')).toBe(true);
    expect(canEnterSystem(a, 'property_kung')).toBe(false);
  });
  it('低權限只能進沒有門檻的建良老師設備管理', () => {
    const a = { level: 'low', systems: all };
    expect(canEnterSystem(a, 'lab')).toBe(false);
    expect(canEnterSystem(a, 'property_jl')).toBe(true);
    expect(canEnterSystem(a, 'property_kung')).toBe(false);
  });
  it('達到門檻但系統未被授權仍不可進入', () => {
    expect(canEnterSystem({ level: 'high', systems: ['property_jl'] }, 'lab')).toBe(false);
  });
  it('未授權者一律不可進入', () => {
    expect(canEnterSystem(null, 'lab')).toBe(false);
  });
});
