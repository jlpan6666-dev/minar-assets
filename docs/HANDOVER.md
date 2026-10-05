# MINAR 實驗室整合管理系統 — 系統交接文件

> 本文件以 **2026-09-30 的 `main` 分支** 為準，內容都對照過程式碼。
> 之後改了系統請順手更新本文件，否則下一位接手的人會被誤導。

| 項目 | 內容 |
|---|---|
| 交接人 | （請填寫） |
| 接手人 | （請填寫） |
| 交接日期 | （請填寫） |
| 原始碼 | https://github.com/jlpan6666-dev/minar-assets （**公開** repo） |
| 正式網址 | （請向 Vercel 專案擁有者確認後填寫，見 [§3](#3-帳號與存取權交接清單)） |

---

## 目錄

1. [系統概覽](#1-系統概覽)
2. [架構](#2-架構)
3. [帳號與存取權（交接清單）](#3-帳號與存取權交接清單)
4. [登入與權限](#4-登入與權限)
5. [各入口功能說明](#5-各入口功能說明)
6. [Excel 匯入匯出](#6-excel-匯入匯出)
7. [資料庫結構（Firestore）](#7-資料庫結構firestore)
8. [外部整合：Google 試算表與 Apps Script](#8-外部整合google-試算表與-apps-script)
9. [開發、測試與部署](#9-開發測試與部署)
10. [程式碼結構](#10-程式碼結構)
11. [常見操作 SOP](#11-常見操作-sop)
12. [常見問題排除](#12-常見問題排除)
13. [已知問題與待辦](#13-已知問題與待辦)
14. [附錄：重要 ID 與網址](#14-附錄重要-id-與網址)

---

## 1. 系統概覽

屏科大 MINAR 實驗室的網頁版整合入口。所有人先用 **Google 帳號** 登入，系統確認是實驗室成員後，才會看到自己有權限的入口。

| 入口 | 程式內 id | 類型 | 用途 |
|---|---|---|---|
| 實驗室設備管理 | `lab` | 系統內 | 設備庫存、借還、櫃位圖、實驗室配置圖、電腦盤點 |
| 建良老師設備管理 | `property_jl` | 系統內 | 財產清單，清單可自由命名 |
| 龔老師財產盤點 | `property_kung` | 系統內 | 年度盤點（初盤／複盤） |
| 龔老師績效 | `performance` | 系統內獨立頁 | 直接讀寫「龔老師成果績效」Google 試算表 |
| 歷屆專案系統 | `projects` | 外部連結 | `http://140.127.22.162:8088`，**僅限校內網路**，是另一套系統，不在本 repo |

入口清單定義在 `src/App.jsx` 的 `SYSTEM_CONFIGS`；可分配權限的入口定義在 `src/permissions.js` 的 `SYSTEM_IDS`。兩邊要一致。

---

## 2. 架構

```
                 ┌─────────────────────────────── 瀏覽器 ───────────────────────────────┐
                 │  React 19 單頁應用（Vite 建置，部署在 Vercel）                           │
                 └───┬──────────────┬──────────────────┬──────────────────┬────────────┘
                     │              │                  │                  │
          Firebase Auth      Cloud Firestore     Google 試算表         Apps Script ①
         （Google 登入、       （所有系統資料、     （gviz CSV 唯讀：     績效 API
           匿名登入）           成員名單、圖片）     設備來源表、         （讀寫績效試算表）
                                                   電腦盤點表）

  電腦盤點掃描工具 v4（Windows／macOS／Ubuntu） ──► Apps Script ② ──► 電腦盤點試算表
```

- **沒有自己的後端伺服器**。資料都在 Firebase；Google 試算表相關的讀寫透過 Apps Script。
- **CSS** 用 Tailwind 的 CDN 版（`index.html` 內 `<script src="https://cdn.tailwindcss.com">`），沒有 Tailwind 建置步驟。
- **Excel 函式庫** 由 CDN 動態載入：SheetJS（一般匯出）、ExcelJS（含圖片的匯入匯出，需要時才載入）。
- **圖片** 壓縮成 base64 JPEG（寬 600px、品質 0.5）後**直接存在 Firestore 文件裡**，沒有使用 Firebase Storage。

---

## 3. 帳號與存取權（交接清單）

交接最容易漏的是「權限還掛在前一個人的個人帳號上」。請逐項確認：

| # | 資源 | 位置 | 交接要做的事 |
|---|---|---|---|
| 1 | GitHub repo | `jlpan6666-dev/minar-assets` | Settings → Collaborators 加入接手人 |
| 2 | Vercel 專案 | 連結上述 repo 的 Vercel 專案（**不在目前維護者可查的帳號下**，應在 repo 擁有者的帳號） | 確認正式網址、確認推到 `main` 會自動部署、把接手人加入專案 |
| 3 | Firebase 專案 | `lab-assets-7e996` | Firebase Console → 專案設定 → 使用者和權限，加入接手人 |
| 4 | 實驗室設備來源試算表 | ID 見 §14 | 共用 → 編輯者加入接手人 |
| 5 | 電腦盤點試算表 | ID 見 §14 | 同上 |
| 6 | 龔老師績效試算表 | ID 見 §14 | 同上（**編輯者名單同時決定誰能在系統內修改績效**，見 §5.4） |
| 7 | Apps Script ① 績效 API | 綁在績效試算表（擴充功能 → Apps Script） | 以「執行身分：我」部署，**部署者帳號失效，績效頁就無法讀寫**。建議改由實驗室共用帳號重新部署 |
| 8 | Apps Script ② 電腦盤點寫入 | 綁在電腦盤點試算表（**原始碼不在 repo**，見 §8.3） | 同上；並轉交 `電腦盤點寫入API.gs` 原始碼 |
| 9 | 系統「老師帳號」 | `src/permissions.js` 的 `OWNER_EMAILS`（目前 3 個：兩位老師＋目前維護者） | 維護者換人時，改成新維護者的 Gmail 並重新部署（見 §11.2） |

---

## 4. 登入與權限

### 4.1 登入流程

1. 開啟網頁時會先**匿名登入** Firebase（用來讀成員名單做判斷）。
2. 使用者按「使用 Google 帳號登入」（彈出視窗）。
3. 系統讀取 Firestore 的 `configs/authorized_members`，比對 email：
   - 是 `OWNER_EMAILS` 內的帳號 → 所有入口可讀寫，且可管理成員。
   - 在成員名單內、且至少一個入口不是「禁止存取」→ 進入入口選單，只顯示有權限的入口。
   - 其他 → 顯示「此帳號未獲授權」。
4. 使用中若被移除或降權，**即時生效**：失去全部權限會被登出；失去某入口權限會被退回選單。

### 4.2 權限模型

每位成員、**每個入口各自**設定一種權限：

| 權限 | 可以做什麼 |
|---|---|
| 禁止存取 | 看不到這個入口 |
| 唯讀 | 能看、能匯出，所有新增／修改／刪除按鈕都不顯示 |
| 可讀寫 | 能新增、修改、刪除 |

另有一個獨立的 **「可管理成員」** 核取框：勾選的人可以邀請成員、調整任何人的權限、移除成員。

> ⚠️ **被勾「可管理成員」的人，也能改自己的權限**（例如把自己各入口都改成可讀寫）。只勾給信任的人。
>
> ⚠️ 老師帳號（`OWNER_EMAILS`）寫死在程式碼裡，不會出現在名單中、也不能被移除。

**操作位置**：入口選單或任一系統右上角齒輪 → 「實驗室成員管理」。

### 4.3 權限在哪裡被檢查（重要）

目前權限**只在前端畫面檢查**（按鈕是否顯示、`guardWrite()` 擋下寫入動作）。
Firestore 安全規則**不在本 repo 內**，實際內容要到 Firebase Console → Firestore → 規則 查看。
若規則允許任何已登入（含匿名）使用者讀寫，懂技術的人可以繞過畫面直接改資料。建議處理方式見 §13。

相關程式：`src/permissions.js`（純函式，有測試）、`src/App.jsx` 的 `AuthScreen`、`MemberModal`、`PermissionMatrix`。

---

## 5. 各入口功能說明

### 5.1 實驗室設備管理（`lab`）

資料以 **「版次」** 為單位（例如「2025 上學期」），每個版次有自己的一份設備清單、借還紀錄、配置圖。**分類是全域共用**，不分版次。

> **櫃位功能目前隱藏**（2026-10-03 起）：首頁的櫃位總覽、側邊的「櫃位圖」、設備表單的櫃位欄位都不顯示，首頁改為四張統計卡橫排。設備已填的櫃位資料仍保留在資料庫，編輯設備時也會原樣存回。要恢復請把 `src/App.jsx` 的 `SHOW_CABINET` 改為 `true`。下表的櫃位相關說明是恢復後的行為。

| 頁面 | 說明 |
|---|---|
| 首頁概覽 | 以**最新版次**統計：設備總數、借出中、庫存偏低、逾期／3 天內到期的借用、櫃位總覽。點櫃位在桌機直接展開，手機會跳到櫃位圖 |
| 版次總覽 | 建立版次時可選「從某個既有版次複製」，會複製設備（借出數歸零）與配置圖 |
| 設備列表 | 搜尋、分類篩選、排序、照片、櫃位；可多選後匯出或刪除 |
| 借用登記 | 購物車式一次借多樣設備；預設借 7 天 |
| 借還紀錄表 | 可部分歸還（拆成已還＋未還兩筆） |
| 櫃位圖 | 抽屜格視覺地圖。代碼格式為「欄字母＋列數字」如 `A1`、`H12`；預設 8 欄 × 12 列，設備用到更大的代碼時自動擴展（上限 26 × 40）。一格可以放多種設備 |
| 實驗室配置圖 | 可拖曳、縮放的平面配置圖 |
| 電腦盤點 | 唯讀顯示「電腦盤點試算表」內容（卡片式），每次進入自動重新整理；可下載掃描工具。要修改資料請點連結到試算表改 |
| 全域分類設定 | 新增／改名／刪除設備分類 |

另外齒輪選單有 **「從 Google 試算表匯入」**：從「實驗室設備來源試算表」單向匯入，以**設備名稱**比對（不分大小寫），名稱不存在就新增、存在就更新數量與備註。欄位固定為 `src/sheetSync.js` 的 `SHEET_HEADERS`。

### 5.2 建良老師設備管理（`property_jl`）

- 資料以「清單」為單位，**清單名稱自由命名**（例如「研究室設備」）。
- 每份清單底下可以有多個「表單」（例如不同房間），財產屬於某個表單。
- 每筆財產可切換「已盤點／未盤點」。

### 5.3 龔老師財產盤點（`property_kung`）

- 與 5.2 結構相同，差別在清單名稱固定為 `{年度}年度-{階段}`（例如 `114年度-初盤`），階段為初盤或複盤。

### 5.4 龔老師績效（`performance`）

- 顯示「龔老師成果績效」試算表，**共 25 張工作表**，每張欄位不同，系統依各表自己的表頭通用呈現。
- 功能：切換工作表、搜尋、複製單列、新增、編輯、刪除（刪除前確認）。
- **自動編號**：新增的資料放在最上面；若該表第一欄是 `1, 2, 3…` 連續流水號，新增或刪除後會自動重編為最新＝1。像「歷屆碩士畢業論文」第一欄是年度，不會被重編。
- **誰能編輯**：由 **績效試算表本身的共用設定** 決定 — 是該試算表的擁有者或編輯者才能在系統內修改，其他人只能看。要開放某人編輯，去試算表按「共用」加入他即可，不用改系統。
- 讀寫都經過 Apps Script ①，試算表可以設成完全不公開。詳見 §8.2。

### 5.5 歷屆專案系統（`projects`）

只是一個外部連結，點了開新分頁到 `http://140.127.22.162:8088`。那是另一套系統，有自己的登入，只能在校內網路連線。

---

## 6. Excel 匯入匯出

位置：各系統的清單頁 → 右上角齒輪。程式：`src/excelImport.js`（純函式，有測試）＋ `src/App.jsx`。

### 6.1 匯入

- **依欄名對應，不看欄序**。認得的欄名（含別名）：

  | 欄位 | 可用欄名 |
  |---|---|
  | 名稱 | 名稱、設備名稱、財產名稱、材料設備、品名 |
  | 數量 | 數量、總數量 |
  | 分類 | 分類、類別 |
  | 圖片 | 圖片、照片、相片、圖片網址 |
  | 財產編號 | 財產編號、材料編號 |
  | 其他財產欄位 | 廠牌型別、現值、取得日期、使用年限、使用人、存置地點、備註、盤點狀況、所屬表單 |

- **圖片**：可以把圖片直接貼在 Excel 的圖片欄格子上（系統依圖片位置對回那一列），也可以填圖片網址。
- 表頭可以不在第一列（前面有標題列也行），也支援同一列左右並排好幾組相同欄位。
- 名稱與財產編號都空白的列會略過。
- 認不出欄名時，會退回舊版的「依欄位順序」對應（相容學校提供的舊格式）。
- 匯入時會顯示進度；圖片會先壓縮再存。

### 6.2 統一匯入範本

齒輪 → **「下載統一匯入範本」**。一份範本兩個系統通用，附「填寫說明」分頁。實驗室設備只要填名稱／分類／數量／備註／圖片；財產盤點再填財產編號之後的欄位。用不到的欄可以留空或整欄刪掉。

### 6.3 匯出

| 功能 | 適用 | 說明 |
|---|---|---|
| 匯出清單 Excel | 全部 | 最後一欄是「圖片」，有上傳照片的會嵌入圖片 |
| 匯出（試算表格式） | 實驗室設備 | 欄位同 Google 試算表，可貼回線上試算表；圖片欄加在最後 |
| 匯出整份清單（各表單分頁） | 財產 | 每個表單一個工作表 |
| 匯出紀錄 | 實驗室設備借還紀錄 | 純文字 |

清單內若完全沒有照片，匯出時會提示「圖片欄會是空的」。匯出的檔案可以原樣再匯入。

---

## 7. 資料庫結構（Firestore）

所有資料都在同一個路徑底下：

```
artifacts / lab-management-system-production / public / data / {集合}
```

| 集合／文件 | 用途 | 主要欄位 |
|---|---|---|
| `configs/authorized_members` | 成員名單 | `members: [{ email, canManage, levels: { lab, property_jl, property_kung, performance, projects } }]`，等級值為 `none`／`low`／`mid` |
| `configs/passwords` | 舊版密碼登入用，**已停用** | — |
| `sessions` | 實驗室版次 | `name, date, createdBy, createdAt` |
| `equipment` | 實驗室設備 | `sessionId, name, quantity, borrowedCount, categoryId, categoryName, cabinet, note, addDate, imageUrl, lastUpdatedStr` |
| `loans` | 借還紀錄 | `sessionId, equipmentId, equipmentName, borrower, phone, purpose, quantity, borrowDate, borrowDays, returnDate, status`（`borrowed`／`returned`） |
| `categories` | 設備分類（全域） | `name` |
| `layouts` | 配置圖元件 | `sessionId, type, label, x, y, width, height` |
| `sessions_property_jl`、`sessions_property_kung` | 財產清單 | `name, date, createdBy`；kung 另有 `year, stage` |
| `tables_property_jl`、`tables_property_kung` | 清單內的表單 | `sessionId, name, createdAt` |
| `items_property_jl`、`items_property_kung` | 財產 | `sessionId, tableId, tableName, propId, name, brandModel, value, acquireDate, lifespan, user, location, note, status, imageUrl` |

注意事項：

- **日期** 多為 `YYYY-MM-DD` 字串；財產的 `acquireDate` 保留匯入時的原始字串。
- **圖片** 存在 `imageUrl`，通常是 `data:image/jpeg;base64,...`。Firestore 單一文件上限 1MB，一張壓縮後約 15–60KB。
- **刪除清單／版次** 會一併刪除其設備／財產、表單、配置圖，但**不會刪除借還紀錄**。
- 舊版成員資料格式（`{emails: [...]}`、`{members: [{email, level, systems}]}`）讀取時會自動轉換，不需手動遷移。

---

## 8. 外部整合：Google 試算表與 Apps Script

### 8.1 Google 試算表

| 試算表 | ID 寫在哪 | 用途 | 讀取方式 | 需要公開？ |
|---|---|---|---|---|
| 實驗室設備來源表 | `src/App.jsx` 的 `LAB_SHEET_ID` | 設備單向匯入 | gviz CSV | 需要（知道連結者可檢視）。也可在匯入視窗貼 CSV 或自訂網址（存在瀏覽器 localStorage） |
| 電腦盤點表 | `src/pcInventory.js` 的 `PC_SHEET_ID` | 電腦盤點頁 | gviz CSV | 需要 |
| 龔老師成果績效 | `src/performance.js` 的 `PERF_SHEET_ID` | 績效頁 | Apps Script ① | 不需要 |

> 電腦盤點表的**欄位格式以試算表為準**，系統端依欄名取值、不改欄位。欄位調整順序沒關係，改欄名（例如「設備識別碼」「最後更新」）會影響卡片顯示。

### 8.2 Apps Script ① — 績效 API

- **原始碼**：`apps-script/performance-api.gs`（檔頭有完整部署步驟）。
- **部署網址**：寫在 `src/performance.js` 的 `PERF_API_URL`。
- **運作方式**：前端送出 Firebase 登入憑證（ID token）→ 腳本向 Firebase 驗證取得 email → 用 `DriveApp` 比對該 email 是不是績效試算表的擁有者／編輯者 → 才允許寫入。
- **提供的操作**：`list`（讀取，前端遇到暫時性錯誤會自動重試 2 次）、`save`（新增／修改，支援插在最上面）、`delete`（刪除並重編號）。`save`、`delete` **絕不重試**，避免重複新增或刪錯列。
- **腳本內寫死**：績效試算表 ID、Firebase Web API 金鑰。換試算表或換 Firebase 專案時都要改。

**更新腳本（網址不變的做法）**：

1. 績效試算表 → 擴充功能 → Apps Script，貼上新版程式碼、存檔。
2. 部署 → **管理部署作業** → 右上鉛筆 → 版本選 **「新版本」** → 部署。

> ⚠️ **不要按「新增部署作業」**，那會產生新網址，系統就連不上了（網址寫死在 `src/performance.js`）。

### 8.3 Apps Script ② — 電腦盤點寫入

- 由掃描工具呼叫，把掃到的電腦資訊寫進電腦盤點試算表的「電腦盤點」工作表。
- 網址寫在各掃描工具內的 `WEB_APP_URL`（完整網址見 §14）。
- v4 版（2026-10-05 起）**依欄名寫入**：以「設備識別碼」更新或新增；缺少的欄名自動補在最右邊；試算表欄位可自由調整順序；「遠端桌面」「使用者名稱/密碼」等人工欄位不會被覆蓋。
- ⚠️ **原始碼不在本 repo**（腳本內含寫入用 token，而 repo 是公開的）。目前的原始碼在維護者電腦的 `文件\GitHub\電腦盤點工具_v4\電腦盤點寫入API.gs`，交接時請一併轉交，或存放在不公開的位置。

### 8.4 電腦掃描工具

- 檔案：`public/pc-scan.zip`（下載檔名 `電腦盤點工具_v4.1.zip`），系統「電腦盤點」頁提供下載。內含：
  - `電腦資訊快速查詢_v4_Windows.bat` ＋ `pc-inventory-windows.ps1`：雙擊 bat 執行，兩個檔案要在同一個資料夾。
  - `電腦資訊快速查詢_v4_macOS.command`：終端機用 `bash` 執行。
  - `電腦資訊快速查詢_v4_Ubuntu.sh`：終端機用 `bash` 執行，會自動要求 sudo。
  - `使用說明.txt`
- 收集的資料：設備識別碼（BIOS 序號，讀不到時用電腦名稱）、電腦名稱、主機名稱、內網 IP 與網卡 MAC（只列實體網卡）、公網 IP 與位置、CPU、GPU／VRAM、主機板、RAM、磁碟、作業系統。
- macOS／Ubuntu 版可用 `DRY_RUN=1 bash 檔名` 試跑：只顯示要送出的資料，不上傳。
- Windows 版（v4.1 起）分工：`pc-inventory-windows.ps1` 只讀硬體資訊並產生 JSON（存在 `%TEMP%\minar-pc-inventory\`）；bat 用 Windows 內建的 `curl.exe` 上傳（連線逾時 15 秒、總時限 90 秒、自動重試 3 次），失敗才以 `-Upload` 參數改用 PowerShell 上傳（會套用 Windows 的 proxy 設定）。
  - 不要再改回「把 PowerShell 程式碼 base64 編碼塞進 bat、執行時解碼再 `Invoke-Expression`」的寫法：v3／v4 曾這樣做，被 Symantec 以行為偵測 `AGR.Terminate!g2` 終止。
  - `.ps1` 必須存成 **UTF-8 含 BOM**（Windows PowerShell 5.1 才能正確讀中文）；`.bat` 必須是 **UTF-8 不含 BOM**、CRLF 換行。
  - 產生的 `payload.json` 不能有 BOM，否則 Apps Script 解析 JSON 會失敗。
  - **不要讓 HTTP 工具自動跟隨轉址**：Apps Script 會先回 302，轉到一次性的 `script.googleusercontent.com/macros/echo?...` 結果網址，該網址只能用 GET 讀一次。若跟隨轉址時沿用 POST，會得到雲端硬碟的「很抱歉，目前無法開啟這個檔案」（HTTP 405）。工具的做法是先 POST、讀出 `Location`，再自己用 GET 取回結果。資料在第一次 POST 時就已寫入。
- macOS／Ubuntu 腳本必須維持 Unix 換行（LF），用 Windows 編輯器存成 CRLF 會無法執行。
- **更新工具**：換掉 `public/pc-scan.zip`；若檔名版本改變，順便改 `src/pcInventory.js` 的 `SCAN_TOOL_FILENAME`（下載時顯示的檔名）。

### 8.5 CDN 相依（網路不通或 CDN 故障時會受影響）

| 用途 | 來源 |
|---|---|
| 所有畫面樣式 | `https://cdn.tailwindcss.com` |
| 一般 Excel 匯出 | `https://cdn.sheetjs.com/xlsx-0.20.1/...` |
| 含圖片的 Excel 匯入匯出 | `https://cdn.jsdelivr.net/npm/exceljs@4.4.0/...` |

---

## 9. 開發、測試與部署

### 9.1 環境

- Node.js（目前開發環境為 v24）、npm。
- 編輯器不限。專案是純 JavaScript（JSX），沒有 TypeScript。

### 9.2 常用指令

```bash
npm install        # 第一次或 package.json 有變動時
npm run dev        # 本機開發，http://localhost:5173
npm test           # 單元測試（vitest）
npm run build      # 產生 dist/
npm run lint       # ESLint
```

本機開發時 Google 登入可以直接用（Firebase 預設允許 `localhost`），**連到的是正式資料庫**，測試時請小心不要誤刪資料。

### 9.3 部署

1. 提交並推送到 GitHub 的 `main`。
2. Vercel 會自動執行 `npm run build` 並上線。
3. `dist/` 目前**也有納入版控**：提交前請先 `npm run build`，讓 repo 內的 `dist/` 跟原始碼一致。

> ⚠️ **不要把 `node_modules/` 提交進 git**（已列入 `.gitignore`）。曾經因此造成 Vercel 建置失敗：`vite: Permission denied`。

### 9.4 測試現況

- 7 個測試檔、156 個測試，全部通過。
- 只涵蓋**純函式模組**（權限、櫃位、借用到期、試算表解析、電腦盤點、績效、Excel 匯入）。畫面與 Firestore 讀寫**沒有自動化測試**，改完要手動點過。
- 慣例：新的邏輯盡量寫成 `src/` 底下的純函式模組並附測試，`App.jsx` 只負責畫面與資料庫。

### 9.5 Lint 現況

`npm run lint` 目前有 14 個問題，全部在 `src/App.jsx`、都是既有的：13 個 React hooks 規則提示（元件定義位置、effect 內 setState、相依陣列）與 1 個未使用變數，**不影響建置與執行**。

---

## 10. 程式碼結構

| 檔案 | 說明 |
|---|---|
| `src/main.jsx` | 進入點 |
| `src/App.jsx` | **主程式（約 4,000 行）**：所有畫面、Firebase 讀寫、登入、各系統功能都在這裡 |
| `src/permissions.js` | 權限判斷、老師帳號清單、成員資料格式相容 |
| `src/cabinet.js` | 櫃位代碼解析、櫃位格計算 |
| `src/loanDue.js` | 借用到期日計算（避免時區差一天） |
| `src/sheetSync.js` | 實驗室設備 Google 試算表匯入的解析與比對 |
| `src/pcInventory.js` | 電腦盤點試算表解析、掃描工具路徑 |
| `src/performance.js` | 績效試算表解析、Apps Script 呼叫與重試 |
| `src/excelImport.js` | Excel 欄名對應、圖片錨點對應、匯出圖片欄、統一範本 |
| `src/*.test.js` | 對應模組的單元測試 |
| `src/index.css` | 少量全域樣式（進度條動畫、隱藏捲軸） |
| `apps-script/performance-api.gs` | Apps Script ① 原始碼 |
| `public/pc-scan.zip` | 電腦掃描工具 |
| `public/1000019541-removebg-preview.png` | 網站圖示 |
| `index.html` | 載入 Tailwind CDN |
| `docs/superpowers/plans/` | 過去某次功能的實作計畫（歷史紀錄，可不看） |

`App.jsx` 內主要區塊（由上往下）：Firebase 設定與 `SYSTEM_CONFIGS` → 工具函式（圖片壓縮、ExcelJS 載入、CSV 解析）→ 小元件（Modal、櫃位圖、績效頁 `PerformancePage`、電腦卡片 `PcCard`、成員管理 `MemberModal`、登入畫面 `AuthScreen`）→ 主元件 `App`（狀態、Firestore 監聽、各種 handler、畫面）。

---

## 11. 常見操作 SOP

### 11.1 新增成員／調整權限

1. 用老師帳號（或有「可管理成員」的帳號）登入。
2. 齒輪 → 實驗室成員管理。
3. 輸入對方的 Gmail，在權限表勾選每個入口的權限，需要的話勾「可管理成員」→ 新增。
4. 對方重新整理網頁、用該 Gmail 登入即可。

> 較早加入的成員，「龔老師績效」「歷屆專案系統」兩個入口預設是禁止存取（這兩個入口是後來才加的），需要的話請幫他們補勾。

### 11.2 更換「老師帳號」（例如維護者交接）

1. 修改 `src/permissions.js` 的 `OWNER_EMAILS`（一律小寫）。
2. `npm test`，同步修改 `src/permissions.test.js` 內寫到舊帳號的測試。
3. `npm run build` → 提交 → 推送，等 Vercel 部署完成。

> 被移出 `OWNER_EMAILS` 的人，若還需要使用系統，記得先在成員管理把他加成一般成員。

### 11.3 新增一個入口

1. `src/permissions.js` 的 `SYSTEM_IDS` 加上新 id。
2. `src/App.jsx` 的 `SYSTEM_CONFIGS` 加上設定：
   - 外部連結：加 `externalUrl`（可加 `notice` 顯示提醒文字）。
   - 系統內獨立頁面：加 `standalone: true`，並在 `App.jsx` 內實作該頁面。
3. 更新 `src/permissions.test.js` 內「五個入口」的測試。
4. 到成員管理幫需要的人開權限。

### 11.4 更換 Google 試算表

| 要換的 | 改哪裡 |
|---|---|
| 實驗室設備來源表 | `src/App.jsx` 的 `LAB_SHEET_ID` |
| 電腦盤點表 | `src/pcInventory.js` 的 `PC_SHEET_ID`；並更新 Apps Script ② 與掃描工具 |
| 績效表 | `src/performance.js` 的 `PERF_SHEET_ID` **和** `apps-script/performance-api.gs` 的 `SHEET_ID`，腳本要重新部署到新試算表底下，並更新 `PERF_API_URL` |

### 11.5 更換 Firebase 專案（極少發生）

1. `src/App.jsx` 的 `YOUR_FIREBASE_CONFIG` 換成新專案的網頁設定。
2. 新專案要：啟用 Authentication 的 Google 與匿名登入、建立 Firestore、把正式網域加入授權網域。
3. `apps-script/performance-api.gs` 的 `FIREBASE_API_KEY` 改成新金鑰並重新部署。
4. 資料要自行搬移。

---

## 12. 常見問題排除

| 狀況 | 原因與處理 |
|---|---|
| 畫面變成「這個畫面發生錯誤」 | 畫面元件出錯，由 `src/ErrorBoundary.jsx` 攔下並顯示錯誤訊息（以前會整頁空白）。若提示是自動翻譯造成，請關閉該網站的翻譯；`index.html` 已宣告 `lang="zh-TW"`、`translate="no"`、`class="notranslate"` 避免瀏覽器翻譯。其他錯誤請依畫面上的訊息追查 |
| 登入後顯示「此帳號未獲授權」 | 該 Gmail 不在成員名單，或所有入口都是禁止存取 → 到成員管理加入／開權限 |
| Google 登入視窗關閉後沒反應、或出現 `auth/unauthorized-domain` | 網站網域不在 Firebase 授權網域 → Firebase Console → Authentication → 設定 → 授權網域，加入正式網址 |
| 績效頁「伺服器回應 HTTP 404」 | Apps Script 偶發錯誤，系統已自動重試 2 次；按重試通常就好。若一直發生，檢查部署是否還在、部署者帳號是否還有效 |
| 績效頁能看不能改 | 該 Gmail 不是績效試算表的編輯者 → 在試算表「共用」加入他 |
| 電腦盤點沒有資料 | 電腦盤點試算表不再是「知道連結者可檢視」，或 ID 改了 |
| 從 Google 試算表匯入失敗 | 設備來源表未公開；可改用匯入視窗內的「貼上 CSV」 |
| Excel 匯入說找不到資料 | 至少要有「名稱」或「財產編號」欄；表頭要在前 20 列內，且至少認得兩個欄名 |
| 匯出的圖片欄是空的 | 那份清單的項目沒有上傳照片（系統會提示） |
| Vercel 建置失敗 `vite: Permission denied` | `node_modules` 被提交進 git → `git rm -r --cached node_modules` 後重新提交 |
| 改了程式碼但網站沒變 | Vercel 還在部署，或瀏覽器快取 → 等部署完成後強制重新整理（Ctrl+F5） |

---

## 13. 已知問題與待辦

依建議處理的優先順序排列。

### 高

- **權限只在前端檢查**：建議把 §4 的權限規則寫進 Firestore 安全規則（依 `configs/authorized_members` 判斷各集合的讀寫），並把規則檔納入 repo 版控。
- **Apps Script 綁在個人帳號**：①② 都以部署者身分執行，部署者離開後會失效。建議改由實驗室共用帳號擁有並部署。
- **Apps Script ② 原始碼只在維護者電腦上**：見 §8.3，交接時務必轉交。

### 中

- **電腦盤點試算表為公開可讀**：系統靠公開 CSV 讀取。若表內有不宜公開的欄位，建議改為不公開，並比照績效頁改走 Apps Script 驗證登入者。
- **大量資料的整批操作**：建立版次時「從既有版次複製」與「刪除清單」都用單一批次寫入，Firestore 單批上限 500 筆；清單非常大時可能失敗，屆時需改成分批。
- **刪除版次不會刪借還紀錄**：舊版次的 `loans` 會殘留在資料庫（不影響畫面）。

### 低（整理類）

- `SYSTEM_CONFIGS` 內仍有舊密碼登入時期留下的 `pwd` 欄位；「更改系統密碼」功能與 `configs/passwords` 文件也已無作用，可一併移除。
- repo 內有開發工具產生的檔案被提交：`.claude-flow/`、`.deep-research/`，可移出版控並加入 `.gitignore`。
- Vite 樣板殘留：`src/App.css`（空檔）、`src/assets/react.svg`、`public/vite.svg`。
- `index.html` 的網頁標題仍是 `lab-system`。
- `App.jsx` 約 4,000 行，之後新功能建議拆成獨立檔案。
- `npm run lint` 的 14 個既有問題（§9.5）。

---

## 14. 附錄：重要 ID 與網址

以下資訊皆已存在於公開原始碼中。

| 項目 | 值 |
|---|---|
| GitHub | https://github.com/jlpan6666-dev/minar-assets |
| Firebase 專案 ID | `lab-assets-7e996` |
| Firestore 資料根路徑 | `artifacts/lab-management-system-production/public/data` |
| 實驗室設備來源試算表 ID | `1qOZWJ88tAxN4pNsJXD8v077iiBrBVTztrd9s9OZLMh0` |
| 電腦盤點試算表 ID | `1qVp95yg-6HGSb2kWQ4-Bg8E-uF6mFgusYbEH_9uYm6E` |
| 龔老師成果績效試算表 ID | `16d-1IZ9ZYU4V0oqfEXI9PWFqZoHMXBOAo7kScCcfzhA` |
| Apps Script ① 績效 API | `https://script.google.com/macros/s/AKfycbysK4jvbblqoYtVorHnxd-MmpmK3FdHF01V_lcUOf8EjqS50zHfC3HRV9v_vgjrzvm-Xg/exec` |
| Apps Script ② 電腦盤點寫入 | `https://script.google.com/macros/s/AKfycbwordYLp0W9hmuPfSMkAxrYrR_S10jbSjSPzNTuev6aEGDykQWVC4FvBEHja3M0eDgb/exec` |
| 歷屆專案系統 | `http://140.127.22.162:8088`（僅限校內網路） |

試算表網址格式：`https://docs.google.com/spreadsheets/d/{ID}/edit`

---

## 交接確認清單

- [ ] 接手人已加入 GitHub repo
- [ ] 接手人已加入 Vercel 專案，並確認正式網址（填回本文件開頭）
- [ ] 接手人已加入 Firebase 專案
- [ ] 接手人已是三份 Google 試算表的編輯者
- [ ] Apps Script ①② 的擁有者／部署者已確認（必要時改由共用帳號重新部署）
- [ ] Apps Script ② 原始碼（`電腦盤點寫入API.gs`）已轉交接手人
- [ ] `OWNER_EMAILS` 已依需要更新並部署
- [ ] 接手人在自己電腦跑過 `npm install`、`npm run dev`、`npm test`
- [ ] 接手人已實際登入正式網站，並在成員管理看得到自己
