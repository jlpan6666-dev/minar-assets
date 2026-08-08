import { describe, it, expect } from 'vitest';
import { addDays, daysUntil, splitLoansByDue } from './loanDue';

describe('addDays', () => {
  it('跨月與跨年正確', () => {
    expect(addDays('2026-08-06', 7)).toBe('2026-08-13');
    expect(addDays('2026-08-28', 7)).toBe('2026-09-04');
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
  });
  it('天數為字串或 0 亦可', () => {
    expect(addDays('2026-08-06', '3')).toBe('2026-08-09');
    expect(addDays('2026-08-06', 0)).toBe('2026-08-06');
  });
  it('無效輸入回空字串', () => {
    expect(addDays('', 7)).toBe('');
    expect(addDays('2026-08-06', undefined)).toBe('');
  });
});

describe('daysUntil', () => {
  it('未來為正、今天為 0、過去為負', () => {
    expect(daysUntil('2026-08-10', '2026-08-06')).toBe(4);
    expect(daysUntil('2026-08-06', '2026-08-06')).toBe(0);
    expect(daysUntil('2026-08-01', '2026-08-06')).toBe(-5);
  });
  it('無效輸入回 null', () => {
    expect(daysUntil('bad', '2026-08-06')).toBeNull();
  });
});

describe('splitLoansByDue', () => {
  const today = '2026-08-06';
  const loans = [
    { id: 'a', status: 'borrowed', borrowDate: '2026-07-20', borrowDays: 7 },   // 應還 07-27 → 逾期 10 天
    { id: 'b', status: 'borrowed', borrowDate: '2026-08-01', borrowDays: 7 },   // 應還 08-08 → 剩 2 天
    { id: 'c', status: 'borrowed', borrowDate: '2026-08-01', borrowDays: 30 },  // 應還 08-31 → 還早
    { id: 'd', status: 'returned', borrowDate: '2026-07-01', borrowDays: 7 },   // 已歸還，忽略
    { id: 'e', status: 'borrowed', borrowDate: '2026-08-03', borrowDays: 1 },   // 應還 08-04 → 逾期 2 天
    { id: 'f', status: 'borrowed', borrowDate: '', borrowDays: 7 },             // 沒日期，忽略
  ];

  it('逾期依逾期最久排序，已歸還與缺資料的排除', () => {
    const { overdue } = splitLoansByDue(loans, today);
    expect(overdue.map(l => l.id)).toEqual(['a', 'e']);
    expect(overdue[0].daysLeft).toBe(-10);
    expect(overdue[0].dueDate).toBe('2026-07-27');
  });

  it('即將到期只含 soonDays 天內，且不含已逾期', () => {
    const { dueSoon } = splitLoansByDue(loans, today);
    expect(dueSoon.map(l => l.id)).toEqual(['b']);
    expect(dueSoon[0].daysLeft).toBe(2);
  });

  it('今天到期算即將到期，不算逾期', () => {
    const { overdue, dueSoon } = splitLoansByDue([{ id: 'x', status: 'borrowed', borrowDate: '2026-07-30', borrowDays: 7 }], today);
    expect(overdue).toEqual([]);
    expect(dueSoon.map(l => l.id)).toEqual(['x']);
  });

  it('空輸入不會爆', () => {
    expect(splitLoansByDue(undefined, today)).toEqual({ overdue: [], dueSoon: [] });
  });
});
