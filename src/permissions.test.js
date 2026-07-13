import { describe, it, expect } from 'vitest';
import { SYSTEM_IDS, isOwnerEmail, normalizeMembers, getAccess } from './permissions';

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
