# MINAR 實驗室整合管理系統

屏科大 MINAR 實驗室的網頁版整合入口：實驗室設備管理、建良老師設備管理、龔老師財產盤點、龔老師績效、歷屆專案系統。
使用 Google 帳號登入，依成員權限顯示可進入的系統。

**接手維護請先讀 → [系統交接文件](docs/HANDOVER.md)**

## 快速開始

```bash
npm install
npm run dev     # http://localhost:5173（連到正式資料庫，請小心操作）
npm test
npm run build
```

技術：React 19、Vite、Firebase（Auth + Firestore）、Google Apps Script，部署於 Vercel。
