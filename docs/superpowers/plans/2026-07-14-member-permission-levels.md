# 成員權限等級與系統存取控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 老師在齒輪選單邀請學生時，可勾選學生能進入哪些系統，並指定高（同老師）／中（可讀寫）／低（僅瀏覽）三種權限等級，全系統即時生效。

**Architecture:** 純前端 React 單檔應用（`src/App.jsx`，~2600 行）+ Firebase（匿名/Google Auth + Firestore 即時監聽）。成員名單存於 Firestore 單一文件 `artifacts/lab-management-system-production/public/data/configs/authorized_members`，資料形狀從 `{emails:[string]}` 升級為 `{members:[{email,level,systems}]}`（讀取端自動相容舊格式）。權限採兩層防護：UI 隱藏（UX）+ 中央 mutation handler 防護（正確性）。權限檢查為 client-side，信任模型與既有密碼機制相同。

**Tech Stack:** React 19、Vite（rolldown-vite 7.2.5）、Firebase 12（firebase/auth、firebase/firestore）、lucide-react、Tailwind class 字串（無 tailwind 建置，class 已可用）、vitest（本計畫新增，僅測純函式）。

## Global Constraints

- UI 文案一律繁體中文（zh-TW），風格對齊現有文案（例：「已加入成員名單」「唯讀權限」）。
- 教師帳號寫死於程式碼：`OWNER_EMAILS = ['jlpan0126@gmail.com', 'jlpan6666@gmail.com', 'jim635241@gmail.com']`（來源 `src/App.jsx:70`，Task 1 移至 `src/permissions.js`），永遠視為 `level:'high'` + 全系統，不可被名單移除。
- 三個系統 id 固定：`'lab'`、`'property_jl'`、`'property_kung'`（見 `src/App.jsx` 的 `SYSTEM_CONFIGS`）。
- 等級語意：`high` = 同老師（含成員管理、更改密碼、所有讀寫）；`mid` = 可讀寫資料，但無成員管理與更改密碼；`low` = 僅瀏覽與匯出 Excel，所有寫入被擋。
- 不改動既有登入流程：入口 Google 閘門、property_jl 直接進入、lab/kung 密碼登入（原始模式）全部保留。
- 不新增 runtime 依賴；devDependencies 僅允許新增 `vitest`。
- 修改 `src/App.jsx` 時沿用其現有慣例：單檔、inline Tailwind class、`showToast(msg, type)` 提示、🟢 註解標記新增區塊。
- 舊資料相容：Firestore 文件若仍是 `{emails:[...]}`，讀取時視為 `level:'mid'`、`systems: 全部`；首次寫入後自然轉為新格式。
- 每個 Task 結束都要 `npx vite build` 通過再 commit；commit 訊息結尾加 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- 專案在 Windows（PowerShell/Git Bash 皆可），路徑含中文，git 指令需在 repo 根目錄執行。

---

### Task 1: 權限純函式模組 `src/permissions.js` + vitest

**Files:**
- Create: `src/permissions.js`
- Create: `src/permissions.test.js`
- Modify: `package.json`（新增 test script 與 vitest devDep）

**Interfaces:**
- Consumes: 無（純模組，零依賴）。
- Produces（後續 Task 全部依賴這些簽名）:
  - `SYSTEM_IDS: string[]` — `['lab','property_jl','property_kung']`
  - `LEVEL_LABELS: Record<'high'|'mid'|'low', string>` — UI 顯示名稱
  - `OWNER_EMAILS: string[]`、`isOwnerEmail(email: string|null|undefined): boolean`
  - `normalizeMembers(data: object|null|undefined): Member[]`，其中 `Member = { email: string, level: 'high'|'mid'|'low', systems: string[] }`
  - `getAccess(email: string|null|undefined, members: Member[]): { level: 'high'|'mid'|'low', systems: string[] } | null`

- [ ] **Step 1: 安裝 vitest 並加 test script**

```bash
cd "D:\OneDrive - 國立屏東科技大學\文件\GitHub\minar-assets"
npm install -D vitest
```

在 `package.json` 的 `"scripts"` 加入一行（其餘不動）：

```json
    "test": "vitest run",
```

- [ ] **Step 2: 寫失敗測試 `src/permissions.test.js`**

```js
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
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `Cannot find module './permissions'`（或同義錯誤）。

- [ ] **Step 4: 實作 `src/permissions.js`**

```js
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
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS，3 個 describe、9 個 test 全綠。

- [ ] **Step 6: Commit**

```bash
git add src/permissions.js src/permissions.test.js package.json package-lock.json
git commit -m "feat: 新增權限純函式模組（等級/系統存取）與 vitest 測試

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: App.jsx 接上權限模組（access 狀態、系統守門）

**Files:**
- Modify: `src/App.jsx`（imports、`OWNER_EMAILS` 區塊、成員 state 區塊、名單監聽 effect、授權複查 effect）

**Interfaces:**
- Consumes: Task 1 的 `SYSTEM_IDS, isOwnerEmail, normalizeMembers, getAccess`。
- Produces（Task 3–5 依賴）:
  - App 內變數 `members: Member[]`（取代 `memberEmails: string[]`）
  - `access: {level, systems} | null`（useMemo）
  - `isAuthorizedMember: boolean`、`isAdmin: boolean`（high 或教師）、`canEdit: boolean`（非 low）
  - `guardWrite(): boolean` — 非 canEdit 時 toast「您為唯讀權限，無法執行此操作」並回傳 false

- [ ] **Step 1: 改 import 與刪除重複常數**

`src/App.jsx` 頂部（`import { Beaker, ... } from 'lucide-react';` 之後）加入：

```js
import { SYSTEM_IDS, LEVEL_LABELS, OWNER_EMAILS, isOwnerEmail, normalizeMembers, getAccess } from './permissions';
```

刪除既有區塊（約 line 68–74）中重複的兩行，只保留 `membersDocRef`：

```js
// --- 🟢 Google 授權設定 ---
// 教師/管理者帳號與權限邏輯見 src/permissions.js
// 成員名單（由教師於系統內管理）
const membersDocRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'configs', 'authorized_members');
```

（即刪除 `const OWNER_EMAILS = [...]` 與 `const isOwnerEmail = ...` 兩行定義，避免與 import 衝突。）

- [ ] **Step 2: 改成員 state 與衍生旗標**

找到 App 內這個區塊（搜尋「實驗室成員授權管理」）：

```js
  // 🟢 實驗室成員授權管理
  const userEmail = (user?.email || '').toLowerCase();
  const isOwner = !!user && !user.isAnonymous && isOwnerEmail(userEmail);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberEmails, setMemberEmails] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const isAuthorizedMember = isOwner || (!!user && !user.isAnonymous && memberEmails.map(e => e.toLowerCase()).includes(userEmail));
```

整段替換為：

```js
  // 🟢 實驗室成員授權管理（權限邏輯見 src/permissions.js）
  const userEmail = (user?.email || '').toLowerCase();
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const access = useMemo(
    () => (!user || user.isAnonymous ? null : getAccess(userEmail, members)),
    [user, userEmail, members]
  );
  const isAuthorizedMember = !!access;
  const isAdmin = access?.level === 'high';           // 同老師：成員管理、更改密碼
  const canEdit = !!access && access.level !== 'low'; // 低權限 = 唯讀
```

（`memberInput` state 移除；Task 3 的 MemberModal 會改為內部管理表單 state。）

- [ ] **Step 3: 改名單監聽 effect（normalize）**

找到：

```js
    const unsub = onSnapshot(membersDocRef(), snap => {
      setMemberEmails(snap.exists() ? (snap.data().emails || []) : []);
      setMembersLoaded(true);
    });
```

替換為：

```js
    const unsub = onSnapshot(membersDocRef(), snap => {
      setMembers(normalizeMembers(snap.exists() ? snap.data() : null));
      setMembersLoaded(true);
    });
```

- [ ] **Step 4: 授權複查 effect 加入「系統層級」守門**

找到：

```js
  // 🟢 授權複查：名單載入後，持有系統模式但已非授權成員者一律退回登入閘門（移除授權即時生效）
  useEffect(() => {
    if (!appMode || !user || !membersLoaded) return;
    if (!isAuthorizedMember) handleLogout();
  }, [appMode, user, membersLoaded, isAuthorizedMember]);
```

替換為：

```js
  // 🟢 授權複查：非成員 → 登出；成員但無此系統權限 → 退回選單（移除/降權即時生效）
  useEffect(() => {
    if (!appMode || !user || !membersLoaded) return;
    if (!access) { handleLogout(); return; }
    if (!access.systems.includes(appMode)) {
      localStorage.removeItem('appMode');
      setAppMode(null);
      showToast('您沒有進入此系統的權限', 'error');
    }
  }, [appMode, user, membersLoaded, access]);
```

- [ ] **Step 5: 新增 `guardWrite` 防護 helper**

在 `const showToast = ...`（搜尋 `const showToast`）的下一行加入：

```js
  // 🟢 寫入防護：低權限（唯讀）一律擋下並提示
  const guardWrite = () => {
    if (canEdit) return true;
    showToast('您為唯讀權限，無法執行此操作', 'error');
    return false;
  };
```

- [ ] **Step 6: 暫時修補尚未改版的呼叫點（讓本 Task 可獨立編譯）**

本 Task 先讓舊 UI 用新資料跑起來，Task 3/4 再全面改版。做三個最小替換：

a. `handleAddMember` / `handleRemoveMember`（搜尋「新增 / 移除受邀成員 Email」）整段替換為：

```js
  // 🟢 新增 / 更新 / 移除成員（僅 isAdmin 可操作；MemberModal 於 Task 3 改版）
  const handleAddMember = async (form) => {
    if (!isAdmin) { showToast('僅老師可管理成員', 'error'); return false; }
    const email = (form.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email 格式錯誤', 'error'); return false; }
    if (isOwnerEmail(email)) { showToast('教師帳號無需邀請', 'error'); return false; }
    if (members.some(m => (m.email || '').toLowerCase() === email)) { showToast('此 Email 已在名單中', 'error'); return false; }
    if (!form.systems || form.systems.length === 0) { showToast('請至少勾選一個系統', 'error'); return false; }
    try {
      await setDoc(membersDocRef(), { members: [...members, { email, level: form.level, systems: form.systems }] }, { merge: true });
      showToast('已加入成員名單，該學生即可用此 Google 帳號登入');
      return true;
    } catch (err) { console.error(err); showToast('新增失敗', 'error'); return false; }
  };

  const handleUpdateMember = async (email, patch) => {
    if (!isAdmin) { showToast('僅老師可管理成員', 'error'); return; }
    const next = members.map(m => m.email === email ? { ...m, ...patch } : m);
    try { await setDoc(membersDocRef(), { members: next }, { merge: true }); }
    catch (err) { console.error(err); showToast('更新失敗', 'error'); }
  };

  const handleRemoveMember = async (email) => {
    if (!isAdmin) { showToast('僅老師可管理成員', 'error'); return; }
    try {
      await setDoc(membersDocRef(), { members: members.filter(m => m.email !== email) }, { merge: true });
      showToast('已移除授權');
    } catch (err) { console.error(err); showToast('移除失敗', 'error'); }
  };
```

b. App 早退 render（搜尋 `return <AuthScreen`）整行替換為：

```js
  if (!user || !appMode || !isAuthorizedMember) return <AuthScreen setAppMode={setAppMode} systemPasswords={systemPasswords} user={user} access={access} membersLoaded={membersLoaded} isAdmin={isAdmin} members={members} onAddMember={handleAddMember} onUpdateMember={handleUpdateMember} onRemoveMember={handleRemoveMember} />;
```

c. 主畫面 `<MemberModal ...>`（搜尋「實驗室成員管理 Modal」）替換為：

```js
      {/* 🟢 實驗室成員管理 Modal（僅老師/高權限） */}
      <MemberModal isOpen={isMemberModalOpen && isAdmin} onClose={() => setIsMemberModalOpen(false)} members={members} onAdd={handleAddMember} onUpdate={handleUpdateMember} onRemove={handleRemoveMember} />
```

注意：此時 `MemberModal` 與 `AuthScreen` 內部仍引用舊 props（`memberEmails`、`isOwner` 等），Task 3/4 立刻接手改版。為了讓 Task 2 可獨立建置且行為正確，先把 `AuthScreen` 的參數列中 `isAuthorizedMember, isOwner, memberEmails, memberInput, setMemberInput` 換成 `access, isAdmin, members, onUpdateMember`，並把 AuthScreen 內舊引用做最小替換：閘門判斷 `if (!isAuthorizedMember)` → `if (!access)`；`isOwner` → `isAdmin`；`<MemberModal ... memberEmails={memberEmails} memberInput={memberInput} setMemberInput={setMemberInput} onAdd={onAddMember} onRemove={onRemoveMember} />` → `<MemberModal isOpen={isMemberOpen && isAdmin} onClose={() => setIsMemberOpen(false)} members={members} onAdd={onAddMember} onUpdate={onUpdateMember} onRemove={onRemoveMember} />`。`MemberModal` 本體在 Task 3 前暫以 `memberEmails={members.map(m=>m.email)}` 相容不可行——因此 Task 2 與 Task 3 必須同一個 PR/連續執行，Task 2 的 commit 允許 MemberModal 顯示尚未改版（僅列 email）：把 MemberModal 參數列 `({ isOpen, onClose, memberEmails, memberInput, setMemberInput, onAdd, onRemove })` 暫改為 `({ isOpen, onClose, members, onAdd, onUpdate, onRemove })`，body 中 `memberEmails.length` → `members.length`、`memberEmails.map(email => ...)` → `members.map(({ email }) => ...)`，表單 `onSubmit={onAdd}` 暫改 `onSubmit={(e) => e.preventDefault()}`、input 的 `value={memberInput} onChange=...` 暫改 `defaultValue=""`（Task 3 重寫整個表單）。

- [ ] **Step 7: 建置驗證**

Run: `npx vite build`
Expected: `✓ built in ...`，無錯誤。

Run: `npm test`
Expected: PASS（Task 1 測試不受影響）。

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: App.jsx 接上 permissions 模組，新增 access/isAdmin/canEdit 與系統守門

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: MemberModal 改版（邀請時設定系統與權限、名單內可調整）

**Files:**
- Modify: `src/App.jsx` — `MemberModal` 元件整個重寫（搜尋「元件：實驗室成員管理 Modal」）

**Interfaces:**
- Consumes: Task 1 `SYSTEM_IDS, LEVEL_LABELS`；App.jsx 模組層 `SYSTEM_CONFIGS`（取系統顯示名）；Task 2 handlers `onAdd(form) => Promise<boolean>`、`onUpdate(email, patch) => Promise<void>`、`onRemove(email) => Promise<void>`。
- Produces: `MemberModal({ isOpen, onClose, members, onAdd, onUpdate, onRemove })` — Task 2 已接好的呼叫介面，本 Task 補齊內部實作。

- [ ] **Step 1: 重寫 MemberModal**

以下整段取代現有 `const MemberModal = ...` 元件：

```jsx
// --- 元件：實驗室成員管理 Modal（僅老師/高權限帳號） ---
const MemberModal = ({ isOpen, onClose, members, onAdd, onUpdate, onRemove }) => {
  const emptyForm = { email: '', level: 'mid', systems: [...SYSTEM_IDS] };
  const [form, setForm] = useState(emptyForm);
  if (!isOpen) return null;

  const toggle = (arr, id) => arr.includes(id) ? arr.filter(s => s !== id) : [...arr, id];
  const sysName = (id) => (SYSTEM_CONFIGS.find(s => s.id === id)?.name || id);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await onAdd(form);
    if (ok) setForm(emptyForm);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-bold text-blue-600 flex items-center gap-2"><UserCheck className="w-5 h-5"/> 實驗室成員管理</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6"/></button>
        </div>

        {/* 邀請表單 */}
        <form onSubmit={submit} className="bg-slate-50 rounded-xl p-4 mb-5 space-y-3 border border-slate-100">
          <input type="email" placeholder="student@gmail.com" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white" required/>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1.5">可進入的系統</p>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_IDS.map(id => (
                <button type="button" key={id} onClick={()=>setForm({...form, systems: toggle(form.systems, id)})} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${form.systems.includes(id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                  {sysName(id)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-1.5">權限等級</p>
            <div className="flex gap-2">
              {Object.entries(LEVEL_LABELS).map(([lv, label]) => (
                <button type="button" key={lv} onClick={()=>setForm({...form, level: lv})} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors ${form.level === lv ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow-sm flex items-center justify-center gap-1"><Plus className="w-4 h-4"/> 邀請</button>
        </form>

        {/* 成員清單（可就地調整等級與系統） */}
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {members.length === 0 && <p className="text-sm text-slate-400 text-center py-4">尚未邀請任何學生</p>}
          {members.map(m => (
            <div key={m.email} className="bg-slate-50 rounded-xl px-3 py-3 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-700 truncate">{m.email}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select value={m.level} onChange={e=>onUpdate(m.email, { level: e.target.value })} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-blue-500">
                    {Object.entries(LEVEL_LABELS).map(([lv, label]) => <option key={lv} value={lv}>{label}</option>)}
                  </select>
                  <button onClick={() => onRemove(m.email)} title="移除授權" className="text-slate-400 hover:text-rose-500 p-1 transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SYSTEM_IDS.map(id => {
                  const on = (m.systems || []).includes(id);
                  return (
                    <button key={id} onClick={()=>{ const next = toggle(m.systems || [], id); if (next.length === 0) return; onUpdate(m.email, { systems: next }); }} className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${on ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200'}`}>
                      {sysName(id)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

備註：成員列的系統 chip 若取消到剩 0 個會被擋（`if (next.length === 0) return;`）——成員至少要有一個系統，否則等同移除，請老師直接按垃圾桶。

- [ ] **Step 2: 建置與手動驗證**

Run: `npx vite build` → Expected: `✓ built`。

手動（dev server `npm run dev`，教師 Google 帳號登入）：
1. 入口右上齒輪 → 實驗室成員管理 → 邀請表單有 Email、三個系統 chip（預設全選）、三個等級鈕（預設「中：可讀寫」）。
2. 填測試 email、取消勾選「實驗室設備管理」、選「低：僅瀏覽」→ 邀請 → 名單出現該列，等級下拉顯示「低：僅瀏覽」，系統 chips 只亮兩個。
3. 就地把等級改「高：同老師權限」→ Firestore 即時更新（重開 modal 仍正確）。
4. 全部系統 chip 取消到最後一個 → 點擊無效（不會變 0 個）。

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: 成員管理支援邀請時設定可進入系統與高/中/低權限等級

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: AuthScreen 依 access.systems 過濾系統卡片

**Files:**
- Modify: `src/App.jsx` — `AuthScreen` 元件（參數列已在 Task 2 改為新 props）

**Interfaces:**
- Consumes: props `access: {level, systems}|null`、`isAdmin: boolean`、`membersLoaded`、`user`、`members`、`onAddMember/onUpdateMember/onRemoveMember`。
- Produces: 無新介面；行為變更 — 選單只顯示 `access.systems` 內的系統卡片。

- [ ] **Step 1: 閘門判斷改用 access**

AuthScreen 內找到：

```js
  // 🟢 第一道關卡：必須以 Google 登入並確認為實驗室成員，才能看到系統選單
  if (!isAuthorizedMember) {
```

由於 Task 2 已把 props 從 `isAuthorizedMember` 換成 `access`，此行改為：

```js
  // 🟢 第一道關卡：必須以 Google 登入並確認為實驗室成員，才能看到系統選單
  if (!access) {
```

（若 Task 2 執行時已順手改掉，此步驟為 no-op，確認即可。）

- [ ] **Step 2: 卡片列表依 systems 過濾**

找到選單 grid：

```jsx
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SYSTEM_CONFIGS.map(sys => {
```

替換為（同時把 grid 欄數依可見數量調整，避免 1–2 張卡片時排版鬆散）：

```jsx
          <div className={`grid grid-cols-1 gap-6 ${access.systems.length >= 3 ? 'md:grid-cols-3' : access.systems.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : 'max-w-sm mx-auto'}`}>
            {SYSTEM_CONFIGS.filter(sys => access.systems.includes(sys.id)).map(sys => {
```

卡片內部（direct 判斷、onClick）維持不變。

- [ ] **Step 3: 已驗證成員列顯示權限等級**

找到：

```jsx
            <UserCheck className="w-3.5 h-3.5 text-teal-500"/> 已驗證成員：{user?.email}
```

替換為：

```jsx
            <UserCheck className="w-3.5 h-3.5 text-teal-500"/> 已驗證成員：{user?.email}（{LEVEL_LABELS[access.level]}）
```

- [ ] **Step 4: 建置與手動驗證**

Run: `npx vite build` → Expected: `✓ built`。

手動：
1. 教師登入 → 三張卡片都在，帳號列顯示「（高：同老師權限）」。
2. 用 Task 3 邀請的測試帳號（只給 property_jl + property_kung）登入 → 只看到兩張卡片、置中排版。
3. 該帳號點「建良老師設備管理」直接進入；被老師即時把 property_jl 系統 chip 關掉 → 畫面被踢回選單並 toast「您沒有進入此系統的權限」。

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: 入口選單依成員可進入系統過濾卡片並顯示權限等級

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 全站權限執行（低=唯讀、高=同老師）

**Files:**
- Modify: `src/App.jsx` — 各 mutation handler 加防護 + 各 view 隱藏寫入 UI

**Interfaces:**
- Consumes: Task 2 的 `guardWrite()`、`canEdit`、`isAdmin`。
- Produces: 無新介面；行為 — low 帳號全站唯讀。

- [ ] **Step 1: 中央 handler 防護（正確性層）**

在下列每個 handler 函式體的第一行加上 `if (!guardWrite()) return;`（async 亦同，直接 return）。以 `handleSaveItem` 為例：

```js
  const handleSaveItem = async (e) => {
    if (!guardWrite()) return;
    e.preventDefault();
    ...
```

⚠️ 有 `e.preventDefault()` 的 handler，防護行放在 `e.preventDefault()` **之後**（避免唯讀者觸發表單原生送出）：`if (!guardWrite()) return;` 移到 preventDefault 下一行。

需加防護的 handlers（名稱以現檔為準，皆可搜尋到）：
`handleImportExcel`、`deleteSession`、`handleDeleteSelected`、`handleSaveTable`、`deleteTable`、`handleSaveSession`、`handleSaveItem`、`togglePropertyStatus`、`deleteItem`、`confirmAddToCart`、`handleBatchBorrow`、`handleReturnConfirm`、`handleAddLayoutItem`、`handleDeleteLayoutItem`、`handleSaveLayoutLabel`、`handleDeleteCategory`（若存在，搜尋確認）以及分類 modal 的儲存 handler（搜尋 `modalType === 'category'` 對應的 submit）。

拖曳類 handler 用「靜默防護」（不 toast，避免滑過即噴訊息）——在 `handleLayoutPointerDown` 與 `handleResizePointerDown` 第一行加：

```js
    if (!canEdit) return;
```

`handlePwdSubmit` 改為 admin 防護（第一行、`e.preventDefault()` 之後）：

```js
    if (!isAdmin) return showToast('僅老師可更改系統密碼', 'error');
```

- [ ] **Step 2: 隱藏寫入 UI（UX 層）— header 與齒輪**

於 header 區（搜尋各字串）套 `canEdit &&`：

a. 新增設備/財產鈕（搜尋 `openItemModal()` 的 header 按鈕）：
`{(isLab || currentTable) && <button ...` → `{canEdit && (isLab || currentTable) && <button ...`

b. 新增清單鈕：`{viewMode === 'sessions' && <button ...` → `{viewMode === 'sessions' && canEdit && <button ...`

c. 新增分類鈕：`{viewMode === 'categories' && <button ...` → `{viewMode === 'categories' && canEdit && <button ...`

d. 選取模式的「刪除選定」鈕（搜尋 `handleDeleteSelected`）外層加 `{canEdit && ...}`（「匯出選定」保留）。

e. 齒輪選單「匯入 Excel 資料」項（搜尋 `匯入 Excel 資料`）：`{!isLab && currentTable && (` → `{canEdit && !isLab && currentTable && (`。

f. 齒輪選單「更改系統密碼」項（搜尋 `更改系統密碼`）外層加 `{isAdmin && ...}`；成員管理項已是 `isOwner &&`——改為 `isAdmin &&`（Task 2 若已改則確認）。

g. 密碼 Modal 開關（搜尋 `isPwdModalOpen && (`）：改 `{isPwdModalOpen && isAdmin && (`。

- [ ] **Step 3: 隱藏寫入 UI — sessions/tables 檢視**

a. 清單卡片編輯/刪除（搜尋 `openSessionModal(sess)`）：該兩顆按鈕外層包 `{canEdit && <>...</>}`。

b. 表單 tab 的 `Edit2`/`Trash2` 圖示（搜尋 `openTableModal(t)`）：兩個 icon 外層包 `{canEdit && <>...</>}`。

c. 「新增表單」兩顆按鈕（搜尋 `openTableModal()`）：各自外層加 `{canEdit && ...}`。

- [ ] **Step 4: 隱藏寫入 UI — items 檢視**

以下每處按鈕（grep 佐證的行號僅供定位，執行時以搜尋字串為準）外層加 `{canEdit && ...}`：

- 4 處 `onClick={()=>openItemModal(item)}` 的 `Edit2` 鈕與其相鄰 `onClick={()=>deleteItem(item.id)}` 的 `Trash2` 鈕（卡片視圖與表格視圖各兩組）。
- 2 處「借用」鈕（搜尋 `> 借用`，lab 專用）。
- 2 處 `togglePropertyStatus(item)` 盤點狀態切換鈕：low 帳號改為顯示唯讀徽章。表格視圖已有現成唯讀徽章分支（搜尋 `title="點擊切換狀況"` 附近的三元判斷），把該三元條件由現有判斷改為 `canEdit ? <button ...> : <span ...>`；卡片視圖同理，若無現成 span 分支，複製表格視圖的唯讀 `<span>` 版本。

- [ ] **Step 5: 隱藏寫入 UI — 借用登記與配置圖（lab）**

a. 側欄「借用登記」鈕（搜尋 `借用登記</button>`）外層由 `{isLab && (` 區塊內的按鈕改為 `{canEdit && <button ...借用登記...}`（借還紀錄表、配置圖保留可看）。

b. 借用登記 view 本體（搜尋 `viewMode === 'borrow-request'`）保險：view 條件改為 `viewMode === 'borrow-request' && canEdit`。

c. 配置圖工具列的新增/編輯控制（搜尋 `handleAddLayoutItem`）：外層加 `{canEdit && ...}`；畫布本身保留（可看、可縮放平移；拖曳已在 Step 1 靜默擋下）。配置圖項目的刪除/編輯鈕（搜尋 `handleDeleteLayoutItem`、`openLayoutEditModal`）同樣包 `{canEdit && ...}`。

- [ ] **Step 6: 隱藏寫入 UI — 分類與借還紀錄**

a. 分類卡的編輯/刪除鈕（搜尋 `handleDeleteCategory(c.id)`）：兩顆按鈕外層包 `{canEdit && <>...</>}`。

b. 借還紀錄「動作」欄的歸還鈕（搜尋 `setReturnDialog({` 的按鈕，桌機表格與手機卡片兩處）：外層加 `{canEdit && ...}`，低權限顯示 `<span className="text-xs text-slate-300">—</span>`。

- [ ] **Step 7: 建置、測試與手動驗證**

Run: `npx vite build` → Expected: `✓ built`。
Run: `npm test` → Expected: PASS。

手動驗證矩陣（dev server + 三個測試帳號）：

| 動作 | 高 | 中 | 低 |
|---|---|---|---|
| 入口齒輪見「實驗室成員管理」 | ✅ | ❌ | ❌ |
| 齒輪見「更改系統密碼」 | ✅ | ❌ | ❌ |
| 新增/編輯/刪除 清單、表單、財產、設備 | ✅ | ✅ | ❌（鈕消失） |
| 匯入 Excel | ✅ | ✅ | ❌（選項消失） |
| 匯出 Excel | ✅ | ✅ | ✅ |
| 借用登記 / 歸還 | ✅ | ✅ | ❌ |
| 配置圖拖曳/新增/刪除 | ✅ | ✅ | ❌（僅可看與縮放） |
| 瀏覽所有列表/儀表板 | ✅ | ✅ | ✅ |

再以低權限帳號打開 DevTools console 直接呼叫可觸及的表單（例如按 Enter 送出殘留表單）確認 toast「您為唯讀權限」出現且 Firestore 無寫入。

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: 高/中/低權限全站執行——低權限唯讀、admin 專屬成員與密碼管理

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 建置部署與線上驗證

**Files:**
- Modify: `dist/`（build 產物，repo 有追蹤）

- [ ] **Step 1: 完整建置**

```bash
npx vite build
```

Expected: `✓ built`，且 `grep -l "唯讀權限" dist/assets/*.js` 有命中（確認新碼進 bundle）。

- [ ] **Step 2: Commit + push（觸發 Vercel 部署）**

```bash
git add dist
git commit -m "build: 更新 dist（成員權限等級功能）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 3: 線上驗證**

到 Vercel dashboard 確認 build 綠燈後，用教師帳號在正式站重跑 Task 5 Step 7 的驗證矩陣（至少抽驗：低權限帳號看不到新增鈕、被關掉系統後被踢回選單）。

---

## 已知限制（刻意不做，YAGNI）

- 權限檢查在前端；懂技術的使用者可繞過 UI 直接呼叫 Firestore。信任模型與既有密碼機制相同。若日後需要真正防護，需寫 Firestore Security Rules 以 `request.auth.token.email` 比對 `authorized_members` 文件。
- 等級是「每位成員一個」而非「每系統一個」；需求如變成每系統不同等級，把 `Member.level` 改為 `Member.levels: {[systemId]: level}` 並調整 `getAccess`。
- 低權限在配置圖僅擋拖曳與增刪，縮放/平移仍可用（純視覺操作）。
