// 借用到期計算的純函式：不依賴 React / Firebase，可單獨測試
// 日期一律以 'YYYY-MM-DD' 字串進出，內部用 UTC 運算避免時區造成差一天

const parseYMD = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const DAY = 86400000;

// 'YYYY-MM-DD' + n 天 → 'YYYY-MM-DD'；輸入無效時回空字串
export const addDays = (dateStr, days) => {
  const base = parseYMD(dateStr);
  const n = parseInt(days, 10);
  if (base === null || isNaN(n)) return '';
  return new Date(base + n * DAY).toISOString().slice(0, 10);
};

// 從 today 到 dateStr 還有幾天（負數代表已經過期幾天）；無效輸入回 null
export const daysUntil = (dateStr, todayStr) => {
  const target = parseYMD(dateStr);
  const today = parseYMD(todayStr);
  if (target === null || today === null) return null;
  return Math.round((target - today) / DAY);
};

// 未歸還的借用單 → { overdue, dueSoon }
// overdue：已超過應歸還日，逾期最久的排前面
// dueSoon：soonDays 天內到期（含今天），最快到期的排前面
export const splitLoansByDue = (loans = [], todayStr, soonDays = 3) => {
  const overdue = [];
  const dueSoon = [];
  loans.forEach((loan) => {
    if (loan.status !== 'borrowed') return;
    const dueDate = addDays(loan.borrowDate, loan.borrowDays);
    const daysLeft = dueDate ? daysUntil(dueDate, todayStr) : null;
    if (daysLeft === null) return; // 沒有借用日期或天數就無從判斷，不猜
    const row = { ...loan, dueDate, daysLeft };
    if (daysLeft < 0) overdue.push(row);
    else if (daysLeft <= soonDays) dueSoon.push(row);
  });
  overdue.sort((a, b) => a.daysLeft - b.daysLeft);
  dueSoon.sort((a, b) => a.daysLeft - b.daysLeft);
  return { overdue, dueSoon };
};
