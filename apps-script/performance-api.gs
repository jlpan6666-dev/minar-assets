/**
 * 龔老師成果績效 — 系統讀寫 API（Google Apps Script）
 * =====================================================================
 * 這支腳本讓實驗室管理系統可以讀寫績效試算表，而且：
 *   - 使用者不需要任何 Google 授權，不會看到「未驗證應用程式」警告
 *   - 誰能編輯，完全依「這份試算表的共用設定」決定（編輯者才能改）
 *   - 試算表可以設成完全不公開
 *   - 支援全部工作表，每張表各自的欄位原樣呈現
 *
 * 首次部署（只需做一次）
 * ---------------------------------------------------------------------
 * 1. 開啟績效試算表 → 上方選單「擴充功能」→「Apps Script」
 * 2. 把編輯器內原有內容刪掉，貼上本檔全部內容，按存檔
 * 3. 右上角「部署」→「新增部署作業」
 *      類型：選齒輪圖示 →「網頁應用程式」
 *      執行身分：我（您自己的帳號）
 *      誰可以存取：任何人
 *    →「部署」
 * 4. 首次會要求授權，選您的帳號 →「進階」→「前往...（不安全）」→「允許」
 * 5. 複製「網頁應用程式網址」交給系統設定
 *
 * ⚠️ 更新腳本時（網址不變的做法）
 * ---------------------------------------------------------------------
 * 貼上新版程式碼存檔後，請用「部署」→「管理部署作業」→ 右上鉛筆圖示
 * → 版本選「新版本」→「部署」。
 * 若改用「新增部署作業」會產生新網址，系統就連不上了。
 *
 * 安全性說明
 * ---------------------------------------------------------------------
 * 網址雖然是「任何人」可存取，但每個請求都必須附上系統登入後產生的憑證，
 * 腳本會向 Firebase 驗證該憑證是否有效並取得對應的 Email，偽造不了。
 * 通過驗證後再比對這個 Email 是否為試算表的擁有者或編輯者，才允許寫入。
 */

// 績效試算表 ID
var SHEET_ID = '16d-1IZ9ZYU4V0oqfEXI9PWFqZoHMXBOAo7kScCcfzhA';

// 系統的 Firebase 專案金鑰（用來驗證登入憑證）
// 這是公開金鑰，本來就會出現在網頁原始碼中，不是機密資訊
var FIREBASE_API_KEY = 'AIzaSyABbI80ZUt5nhuIB5bkc2sOnLyZXCC2bmE';

/** 用瀏覽器直接開啟部署網址時的健康檢查，方便確認部署成功 */
function doGet() {
  return json({ ok: true, version: 2, message: '績效 API 運作中（v2：支援全部工作表），請以 POST 呼叫。' });
}

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // 1) 驗證系統登入憑證，取得可信任的 Email
    var email = verifyIdToken(req.idToken);
    if (!email) return json({ ok: false, error: '登入憑證無效或已過期，請重新整理頁面。' });

    // 2) 依試算表共用設定判斷這個人能不能編輯
    var canEdit = hasEditPermission(email);
    var book = SpreadsheetApp.openById(SHEET_ID);
    var names = book.getSheets().map(function (s) { return s.getName(); });

    // 取得所有工作表名稱 + 指定工作表的內容（沒指定就給第一張）
    if (req.action === 'list') {
      var name = req.sheet && names.indexOf(req.sheet) >= 0 ? req.sheet : names[0];
      return json({
        ok: true, version: 2, email: email, canEdit: canEdit,
        sheets: names, sheet: name, values: readAll(book.getSheetByName(name))
      });
    }

    if (req.action === 'save') {
      if (!canEdit) return json({ ok: false, error: '此帳號沒有這份試算表的編輯權限。' });
      if (!req.sheet || names.indexOf(req.sheet) < 0) return json({ ok: false, error: '找不到工作表：' + req.sheet });

      var sheet = book.getSheetByName(req.sheet);
      var values = (req.values || []).map(function (v) { return v == null ? '' : String(v); });
      if (!values.length) return json({ ok: false, error: '沒有要寫入的內容。' });
      if (!values.join('').replace(/\s/g, '')) return json({ ok: false, error: '內容不可全部空白。' });

      if (req.rowNumber) {
        sheet.getRange(Number(req.rowNumber), 1, 1, values.length).setValues([values]);
      } else if (req.insertTop) {
        // 最新的排最前面：插在表頭下方，再把流水號重編為 1,2,3…
        sheet.insertRowBefore(2);
        sheet.getRange(2, 1, 1, values.length).setValues([values]);
        renumberIfSequence(sheet);
      } else {
        sheet.appendRow(values);
      }
      SpreadsheetApp.flush();
      return json({
        ok: true, version: 2, email: email, canEdit: true,
        sheets: names, sheet: req.sheet, values: readAll(sheet)
      });
    }

    return json({ ok: false, error: '未知的操作：' + req.action });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * 若第一欄原本是 1,2,3… 的連續流水號，就重編為 1..N（新插入的那列變成 1）。
 * 條件訂得嚴格：插入後第 3 列起必須恰好是舊的 1,2,3…；
 * 否則（例如「歷屆碩士畢業論文」第一欄是年度 90,91…）完全不動，避免覆蓋資料。
 */
function renumberIfSequence(sheet) {
  var last = sheet.getLastRow();
  if (last < 3) return; // 只有表頭與剛插入的那列，沒有舊資料可判斷

  var oldCount = last - 2;
  var old = sheet.getRange(3, 1, oldCount, 1).getDisplayValues();
  for (var i = 0; i < oldCount; i++) {
    if (String(old[i][0]).trim() !== String(i + 1)) return; // 不是連續流水號就不動
  }

  var nums = [];
  for (var j = 0; j < last - 1; j++) nums.push([j + 1]);
  sheet.getRange(2, 1, last - 1, 1).setValues(nums);
}

/** 讀取整張表（以顯示文字為準，避免日期／數字被轉成物件） */
function readAll(sheet) {
  if (!sheet || sheet.getLastRow() === 0) return [];
  return sheet.getDataRange().getDisplayValues();
}

/** 向 Firebase 驗證 ID Token，回傳已驗證的 Email（失敗回空字串） */
function verifyIdToken(idToken) {
  if (!idToken) return '';
  var res = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + FIREBASE_API_KEY,
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );
  if (res.getResponseCode() !== 200) return '';
  var data = JSON.parse(res.getContentText());
  var user = data.users && data.users[0];
  return user && user.email ? String(user.email).toLowerCase() : '';
}

/** 這個 Email 是否為試算表的擁有者或編輯者 */
function hasEditPermission(email) {
  var file = DriveApp.getFileById(SHEET_ID);

  var owner = file.getOwner();
  if (owner && String(owner.getEmail()).toLowerCase() === email) return true;

  var editors = file.getEditors();
  for (var i = 0; i < editors.length; i++) {
    if (String(editors[i].getEmail()).toLowerCase() === email) return true;
  }
  return false;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
