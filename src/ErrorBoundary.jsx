import { Component } from 'react';

// Google 翻譯／其他翻譯外掛會改寫網頁文字，React 換頁時找不到自己的節點就會丟出這類錯誤
const looksLikeTranslation = (error) =>
  /removeChild|insertBefore|not a child of this node/i.test(error?.message || '') ||
  /translated-(ltr|rtl)/.test(document.documentElement.className);

// 畫面出錯時顯示原因，而不是整頁空白
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('畫面錯誤', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const translated = looksLikeTranslation(error);
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f8fafc', fontFamily: 'system-ui, "Microsoft JhengHei", sans-serif' }}>
        <div style={{ maxWidth: 520, width: '100%', background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 10px 30px rgba(15,23,42,.12)', color: '#1e293b' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 12px' }}>這個畫面發生錯誤</h1>
          {translated ? (
            <p style={{ margin: '0 0 12px', lineHeight: 1.7 }}>
              看起來是<strong>瀏覽器的自動翻譯</strong>改動了網頁內容。請關閉這個網站的翻譯（網址列右側的翻譯圖示 → 選「一律不翻譯」，或停用翻譯外掛）後重新載入。
            </p>
          ) : (
            <p style={{ margin: '0 0 12px', lineHeight: 1.7 }}>請重新載入。若一直發生，請把下面的錯誤訊息截圖給系統維護者。</p>
          )}
          <pre style={{ background: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 16px', maxHeight: 200, overflow: 'auto' }}>
            {String(error?.message || error)}
          </pre>
          <button type="button" onClick={() => window.location.reload()} style={{ background: '#0d9488', color: '#fff', border: 0, borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>
            重新載入
          </button>
        </div>
      </div>
    );
  }
}
