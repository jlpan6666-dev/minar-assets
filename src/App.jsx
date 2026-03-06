import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  query, 
  where,
  orderBy,
  increment,
  writeBatch,
  getDocs
} from 'firebase/firestore';

import { 
  Beaker, Settings, LogOut, Plus, Search, Trash2, Edit2, 
  AlertTriangle, LayoutGrid, Menu, X, CheckCircle, 
  AlertCircle, ChevronRight, ChevronLeft, Calendar, FolderOpen,
  History, UserCheck, Phone, Clock, FileDown, ArrowUpRight, ArrowDownLeft, 
  MousePointerClick, Sparkles, Timer, ShoppingCart, Minus, ArrowUpDown, 
  Camera, Image as ImageIcon, Upload, CheckSquare, Box, Activity, Home, Hash, Filter,
  FileSpreadsheet, Check, XCircle
} from 'lucide-react';

// ==========================================
// 🟢 您的 Firebase 設定
// ==========================================
const YOUR_FIREBASE_CONFIG = {
  apiKey: "AIzaSyABbI80ZUt5nhuIB5bkc2sOnLyZXCC2bmE",
  authDomain: "lab-assets-7e996.firebaseapp.com",
  projectId: "lab-assets-7e996",
  storageBucket: "lab-assets-7e996.firebasestorage.app",
  messagingSenderId: "773589657868",
  appId: "1:773589657868:web:66e391857687c324784129",
  measurementId: "G-1KGF96H6MY"
};

// --- 系統初始化 ---
const app = initializeApp(YOUR_FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'lab-management-system-production';

// --- 常數設定 ---
const ITEMS_PER_PAGE = 6; 

const SYSTEM_CONFIGS = [
  { id: 'lab', name: '實驗室設備管理', icon: Beaker, pwd: 'minar7917', colorClass: 'bg-teal-600', hoverClass: 'hover:bg-teal-700', textClass: 'text-teal-600' },
  { id: 'property_jl', name: '建良老師設備管理', icon: Box, pwd: 'jlpan@314', colorClass: 'bg-blue-600', hoverClass: 'hover:bg-blue-700', textClass: 'text-blue-600' },
  { id: 'property_kung', name: '龔老師財產盤點', icon: Box, pwd: 'kung7917', colorClass: 'bg-indigo-600', hoverClass: 'hover:bg-indigo-700', textClass: 'text-indigo-600' }
];

// --- 🔵 工具函式：民國日期取得 ---
const getMinguoDateString = () => {
  const d = new Date();
  const minguoYear = d.getFullYear() - 1911;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${minguoYear}/${month}/${day}`;
};

// --- 🔵 工具函式：圖片壓縮轉 Base64 ---
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 600; // 稍微調降解析度，避免超過 Firestore 1MB 單筆文件限制
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // 壓縮品質調整為 0.5
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- 🔵 工具函式：解析 CSV (處理引號與換行) ---
const parseCSV = (text) => {
  const result = [];
  let row = [];
  let inQuotes = false;
  let val = '';
  for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i+1];
      if (char === '"') {
          if (inQuotes && nextChar === '"') { val += '"'; i++; }
          else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
          row.push(val.trim()); val = '';
      } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
          if (char === '\r') i++;
          row.push(val.trim()); val = '';
          result.push(row); row = [];
      } else {
          val += char;
      }
  }
  if (val || row.length > 0) { row.push(val.trim()); result.push(row); }
  return result;
};

// --- 🔵 備用圖示 Base64 (防止破圖) ---
const FALLBACK_IMAGE_SRC = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NDBhMWEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg==';

// --- 元件：自定義確認視窗 ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isDangerous }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDangerous ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
            {isDangerous ? <AlertTriangle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消</button>
            <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium shadow-md transition-colors ${isDangerous ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>確認</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 元件：歸還數量確認視窗 ---
const ReturnModal = ({ isOpen, loan, onConfirm, onCancel }) => {
  const [returnQty, setReturnQty] = useState(1);
  useEffect(() => { if (loan) setReturnQty(loan.quantity); }, [loan]);
  if (!isOpen || !loan) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-green-100 text-green-600">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">歸還確認</h3>
          <p className="text-sm text-gray-500 mb-4 text-center">{loan.equipmentName}<br/>(目前借用: {loan.quantity})</p>
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2 text-center">本次歸還數量</label>
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setReturnQty(Math.max(1, returnQty - 1))} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Minus className="w-4 h-4" /></button>
              <input type="number" className="w-20 text-center text-2xl font-bold border-b-2 border-slate-200 focus:border-green-500 outline-none pb-1" value={returnQty} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setReturnQty(Math.max(1, Math.min(loan.quantity, val))); }}/>
              <button onClick={() => setReturnQty(Math.min(loan.quantity, returnQty + 1))} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="text-center mt-2 text-xs text-slate-400">{returnQty === loan.quantity ? "全部歸還" : `部分歸還 (剩餘 ${loan.quantity - returnQty} 件)`}</div>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消</button>
            <button onClick={() => onConfirm(loan.id, returnQty, loan.quantity)} className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium shadow-md transition-colors">確認歸還</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 元件：選擇借用數量視窗 ---
const SelectQuantityModal = ({ isOpen, item, onConfirm, onCancel }) => {
  const [qty, setQty] = useState(1);
  const [maxQty, setMaxQty] = useState(1);
  useEffect(() => { if (item) { setQty(1); setMaxQty(item.quantity - (item.borrowedCount || 0)); } }, [item]);
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-indigo-100 text-indigo-600"><ShoppingCart className="w-6 h-6" /></div>
          <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">選擇借用數量</h3>
          <p className="text-sm text-gray-500 mb-4 text-center">{item.name}<br/><span className="text-teal-600 font-bold">最大可借: {maxQty}</span></p>
          <div className="mb-6">
            <div className="flex items-center justify-center gap-3">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Minus className="w-4 h-4" /></button>
              <input type="number" className="w-20 text-center text-2xl font-bold border-b-2 border-slate-200 focus:border-indigo-500 outline-none pb-1" value={qty} onChange={(e) => { const val = parseInt(e.target.value); if (!isNaN(val)) setQty(Math.max(1, Math.min(maxQty, val))); }} />
              <button onClick={() => setQty(Math.min(maxQty, qty + 1))} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消</button>
            <button onClick={() => onConfirm(item, qty)} className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-md transition-colors">確認加入</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 元件：分頁控制器 ---
const PaginationControl = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 p-4 bg-white border-t border-slate-100">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-30 hover:bg-teal-50 hover:text-teal-600 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
      <span className="text-sm font-bold text-slate-600">{currentPage} / {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-30 hover:bg-teal-50 hover:text-teal-600 transition-colors"><ChevronRight className="w-5 h-5" /></button>
    </div>
  );
};

// --- 元件：訊息提示 Toast ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 2000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-[80] animate-in slide-in-from-right duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${type === 'success' ? 'bg-white border-teal-100 text-teal-800' : 'bg-white border-red-100 text-red-800'}`}>
        {type === 'success' ? <CheckCircle className="w-5 h-5 text-teal-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
        <span className="font-medium text-sm">{message}</span>
      </div>
    </div>
  );
};

// --- 元件：儀表板卡片 ---
const StatCard = ({ title, value, subtext, icon: Icon, colorClass, onClick }) => (
  <div onClick={onClick} className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between transition-all group relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 active:scale-95' : ''}`}>
    <div className="relative z-10">
      <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">{title}{onClick && <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity"/>}</p>
      <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-xl ${colorClass} shadow-sm group-hover:scale-110 transition-transform`}><Icon className="w-6 h-6 text-white" /></div>
  </div>
);

// --- 頁面：多系統登入 ---
const AuthScreen = ({ setAppMode }) => {
  const [selectedSys, setSelectedSystem] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { const clearStaleAuth = async () => { try { await signOut(auth); } catch (e) {} }; clearStaleAuth(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== selectedSys.pwd) { setError('密碼錯誤，請重新輸入'); return; }
    setLoading(true);
    try {
      await signInAnonymously(auth);
      localStorage.setItem('appMode', selectedSys.id);
      setAppMode(selectedSys.id);
    } catch (err) { 
      setError("系統連線失敗，請檢查網路"); setLoading(false); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal-200/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-200/30 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-4xl w-full z-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3 tracking-tight">整合管理系統入口</h1>
          <p className="text-slate-500">請選擇您要進入的系統模組並輸入專屬管理密碼</p>
        </div>

        {!selectedSys ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SYSTEM_CONFIGS.map(sys => {
              const Icon = sys.icon;
              return (
                <div key={sys.id} onClick={() => setSelectedSystem(sys)} className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 cursor-pointer hover:shadow-xl hover:-translate-y-2 transition-all group flex flex-col items-center text-center">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 shadow-md transition-transform group-hover:scale-110 ${sys.colorClass}`}>
                    <Icon className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{sys.name}</h3>
                  <p className="text-sm text-slate-400">點擊進入登入頁面</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden p-8 animate-in zoom-in-95 duration-300">
            <button onClick={() => {setSelectedSystem(null); setPassword(''); setError('');}} className="text-sm text-slate-400 hover:text-slate-700 flex items-center gap-1 mb-6 transition-colors">
              <ChevronLeft className="w-4 h-4"/> 返回選擇系統
            </button>
            <div className="text-center mb-8">
              <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg ${selectedSys.colorClass}`}>
                <selectedSys.icon className="w-8 h-8 text-white"/>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{selectedSys.name}</h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <input type="password" placeholder="請輸入管理密碼" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border-2 border-slate-200 p-3.5 rounded-xl outline-none focus:border-indigo-500 transition-colors text-lg tracking-widest text-center font-mono" required autoFocus/>
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center gap-2"><AlertTriangle className="w-4 h-4"/> {error}</div>}
              <button type="submit" disabled={loading} className={`w-full text-white py-3.5 rounded-xl font-bold transition-colors shadow-md disabled:opacity-70 ${selectedSys.colorClass} ${selectedSys.hoverClass}`}>
                {loading ? '系統驗證中...' : '確認登入'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// --- 主應用程式 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appMode, setAppMode] = useState(localStorage.getItem('appMode') || null);
  
  // Navigation State
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [currentSession, setCurrentSession] = useState(null); 

  // Data State
  const [sessions, setSessions] = useState([]);
  const [itemsList, setItemsList] = useState([]); // 通用 List (設備 或 財產)
  const [categories, setCategories] = useState([]);
  const [loans, setLoans] = useState([]); // Lab only
  
  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({ latestSessionId: null, latestSessionName: '無資料', totalItems: 0, totalBorrowedOrInventoried: 0, lowStockOrUninventoried: 0, groupedActivity: [] });

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDate, setSearchDate] = useState(''); 
  const [searchStatus, setSearchStatus] = useState('all'); // Property Only
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all'); // Lab Only
  const [sortOption, setSortOption] = useState('created_desc'); 
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLoanPage, setCurrentLoanPage] = useState(1);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });
  const [returnDialog, setReturnDialog] = useState({ isOpen: false, loan: null }); 
  const [selectQuantityDialog, setSelectQuantityDialog] = useState({ isOpen: false, item: null }); 
  
  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [editItem, setEditItem] = useState(null);
  
  // Forms State
  const [sessionForm, setSessionForm] = useState({ name: '', date: '', year: '', stage: '初盤', copyFromPrevious: false });
  const [equipForm, setEquipForm] = useState({ name: '', quantity: 1, categoryId: '', note: '', imageUrl: '', addDate: '' });
  const [propForm, setPropForm] = useState({ propId: '', name: '', brandModel: '', value: '', acquireDate: '', lifespan: '', user: '', location: '', note: '', status: '未盤點', imageUrl: '' });
  
  const [imagePreview, setImagePreview] = useState(''); 
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef(null); // For CSV Import
  
  const [catForm, setCatForm] = useState({ name: '' });
  const [cartItems, setCartItems] = useState([]);
  const [borrowForm, setBorrowForm] = useState({ borrower: '', phone: '', date: new Date().toISOString().slice(0,10), purpose: '', borrowDays: 7 });
  const [mobileBorrowTab, setMobileBorrowTab] = useState('equipment');
  const [fullScreenImage, setFullScreenImage] = useState(null); // 🟢 全螢幕圖片預覽狀態

  // DB Path Helpers
  const colSessionsName = appMode === 'lab' ? 'sessions' : `sessions_${appMode}`;
  const colItemsName = appMode === 'lab' ? 'equipment' : `items_${appMode}`;
  const isLab = appMode === 'lab';
  const themeColor = isLab ? 'teal' : appMode === 'property_jl' ? 'blue' : 'indigo';

  // Init Auth
  useEffect(() => { const unsubscribe = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); }); return () => unsubscribe(); }, []);

  // Reset Filters & Navigation on Mode Change
  useEffect(() => {
    setViewMode('dashboard');
    setCurrentSession(null);
    setSearchTerm(''); setSearchDate(''); setSearchStatus('all'); setSelectedCategoryFilter('all');
  }, [appMode]);

  // Reset Pagination when Filters Change
  useEffect(() => { setCurrentPage(1); setCurrentLoanPage(1); }, [searchTerm, searchDate, searchStatus, selectedCategoryFilter, sortOption, viewMode, currentSession]);

  // Global Listeners
  useEffect(() => {
    if (!user || !appMode) return;
    
    // Categories (Lab only)
    let unsubCat = () => {};
    if (isLab) unsubCat = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), snap => setCategories(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    // Sessions
    const qSession = query(collection(db, 'artifacts', appId, 'public', 'data', colSessionsName), orderBy('date', 'desc'));
    const unsubSess = onSnapshot(qSession, snap => setSessions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    return () => { unsubCat(); unsubSess(); };
  }, [user, appMode, isLab, colSessionsName]);

  // Dashboard Logic
  useEffect(() => {
    if (!user || viewMode !== 'dashboard' || !appMode) return;
    if (sessions.length === 0) {
        setDashboardStats({ latestSessionId: null, latestSessionName: '尚無資料', totalItems: 0, totalBorrowedOrInventoried: 0, lowStockOrUninventoried: 0, groupedActivity: [] });
        return;
    }
    const latestSession = sessions[0];
    const targetSessionId = latestSession.id;

    const qItems = query(collection(db, 'artifacts', appId, 'public', 'data', colItemsName), where('sessionId', '==', targetSessionId));
    const unsubItems = onSnapshot(qItems, (snap) => {
      let total = snap.size; 
      let countA = 0, countB = 0; // Lab: Borrowed, LowStock. Prop: Inventoried, Uninventoried
      
      snap.forEach(doc => {
        const data = doc.data();
        if (isLab) {
            countA += (data.borrowedCount || 0);
            if ((data.quantity - (data.borrowedCount || 0)) < 3) countB++;
        } else {
            if (data.status === '已盤點') countA++;
            else countB++;
        }
      });
      setDashboardStats(prev => ({ ...prev, latestSessionId: targetSessionId, latestSessionName: latestSession.name, totalItems: total, totalBorrowedOrInventoried: countA, lowStockOrUninventoried: countB }));
    });

    let unsubLoans = () => {};
    if (isLab) {
        const qLoans = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('sessionId', '==', targetSessionId));
        unsubLoans = onSnapshot(qLoans, (snap) => {
          const rawEvents = [];
          snap.forEach(doc => {
            const data = doc.data();
            const loanId = doc.id;
            rawEvents.push({ id: loanId + '_borrow', originalId: loanId, sessionId: data.sessionId, type: 'borrow', date: data.borrowDate, borrower: data.borrower, equipmentName: data.equipmentName, quantity: data.quantity, timestamp: data.createdAt ? data.createdAt.seconds : 0 });
            if (data.status === 'returned' && data.returnDate) rawEvents.push({ id: loanId + '_return', originalId: loanId, sessionId: data.sessionId, type: 'return', date: data.returnDate, borrower: data.borrower, equipmentName: data.equipmentName, quantity: data.quantity, timestamp: data.updatedAt ? data.updatedAt.seconds : Date.now()/1000 });
          });
          rawEvents.sort((a, b) => b.timestamp - a.timestamp);
          const grouped = [];
          rawEvents.forEach(event => {
            const group = grouped.find(g => g.type === event.type && g.borrower === event.borrower && Math.abs(g.timestamp - event.timestamp) < 60 && g.date === event.date);
            if (group) group.items.push({ name: event.equipmentName, quantity: event.quantity, id: event.id });
            else grouped.push({ ...event, items: [{ name: event.equipmentName, quantity: event.quantity, id: event.id }] });
          });
          setDashboardStats(prev => ({ ...prev, groupedActivity: grouped.slice(0, 10) }));
        });
    }

    return () => { unsubItems(); unsubLoans(); };
  }, [user, appMode, viewMode, sessions, isLab, colItemsName]); 

  // Session Data
  useEffect(() => {
    if (!user || !currentSession || !appMode) return;
    const qItems = query(collection(db, 'artifacts', appId, 'public', 'data', colItemsName), where('sessionId', '==', currentSession.id));
    const unsubItems = onSnapshot(qItems, snap => setItemsList(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    let unsubLoans = () => {};
    if (isLab) {
        const qLoan = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('sessionId', '==', currentSession.id));
        unsubLoans = onSnapshot(qLoan, snap => {
          const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
          list.sort((a, b) => (a.borrowDate > b.borrowDate ? -1 : 1));
          setLoans(list);
        });
    }
    return () => { unsubItems(); unsubLoans(); };
  }, [user, appMode, currentSession, isLab, colItemsName]);

  const showToast = (msg, type='success') => setToast({message: msg, type});
  
  // Handlers
  const handleLogout = async () => { try { await signOut(auth); localStorage.removeItem('appMode'); setAppMode(null); } catch(e){} };

  // UI/Action Helpers
  const getAvailability = (item) => isLab ? (item.quantity - (item.borrowedCount || 0)) : 0;
  
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try { setIsCompressing(true); const base64String = await compressImage(file); setImagePreview(base64String); setIsCompressing(false); } 
      catch (error) { showToast("圖片處理失敗", "error"); setIsCompressing(false); }
    }
  };

  // CSV Import for Property
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentSession || isLab) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target.result;
        const rows = parseCSV(text);
        if (rows.length < 2) { showToast("CSV 格式錯誤或無資料", "error"); return; }

        let successCount = 0;
        try {
            const batch = writeBatch(db);
            const nowTime = new Date().toISOString().split('T')[0];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < 2) continue; // skip empty rows
                
                const propId = row[0] || '';
                const name = row[1] || '';
                const brandModel = row[2] || '';
                const value = row[3] || '';
                const acquireDate = row[4] || '';
                const lifespan = row[5] || '';
                const user = row[6] || '';
                const location = row[7] || '';
                const note = row[8] || '';
                
                // 🟢 檢查盤點狀態若為空白則設為未盤點
                const statusRaw = row[9] ? row[9].trim() : '';
                const status = statusRaw === '' ? '未盤點' : statusRaw;

                const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', colItemsName));
                batch.set(newRef, {
                    sessionId: currentSession.id, propId, name, brandModel, value, acquireDate, lifespan, user, location, note, status, addDate: nowTime, lastUpdatedStr: nowTime, imageUrl: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });
                successCount++;
            }
            await batch.commit();
            showToast(`成功匯入 ${successCount} 筆資料`);
        } catch (err) { console.error(err); showToast("匯入失敗", "error"); }
        if (fileInputRef.current) fileInputRef.current.value = ''; // reset input
    };
    reader.readAsText(file);
  };

  const handleExportCSV = async (sessionToExport = currentSession) => {
    if (!sessionToExport) return;
    let exportItems = [];
    if (currentSession && sessionToExport.id === currentSession.id) exportItems = itemsList;
    else {
        try {
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', colItemsName), where('sessionId', '==', sessionToExport.id));
            const snapshot = await getDocs(q);
            exportItems = snapshot.docs.map(d => d.data());
        } catch (e) { showToast("匯出失敗", "error"); return; }
    }
    if (!exportItems.length) { showToast("無資料可匯出", "error"); return; }
    
    let headers = [];
    let rows = [];
    if (isLab) {
        headers = ["設備名稱", "分類", "總數量", "已借出", "剩餘庫存", "加入日期", "備註"];
        rows = exportItems.map(item => {
            const borrowed = item.borrowedCount || 0; const remaining = item.quantity - borrowed;
            return [`"${(item.name||'').replace(/"/g, '""')}"`, `"${item.categoryName||''}"`, item.quantity, borrowed, remaining, `"${item.addDate||''}"`, `"${(item.note||'').replace(/"/g, '""')}"`].join(",");
        });
    } else {
        headers = ["財產編號", "財產名稱", "廠牌型別", "現值", "取得日期", "使用年限", "使用人", "存置地點", "備註", "盤點狀態"];
        rows = exportItems.map(item => {
            return [`"${item.propId||''}"`, `"${(item.name||'').replace(/"/g, '""')}"`, `"${(item.brandModel||'').replace(/"/g, '""')}"`, `"${item.value||''}"`, `"${item.acquireDate||''}"`, `"${item.lifespan||''}"`, `"${(item.user||'').replace(/"/g, '""')}"`, `"${(item.location||'').replace(/"/g, '""')}"`, `"${(item.note||'').replace(/"/g, '""')}"`, `"${item.status||'未盤點'}"`].join(",");
        });
    }

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `${sessionToExport.name}_清單.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    showToast("CSV 下載已開始");
  };

  // 🟢 強化刪除清單機制：連同附屬的設備/財產資料一起刪除
  const deleteSession = (id) => {
    setConfirmDialog({
      isOpen: true,
      title: "刪除清單",
      message: "確定要刪除此清單嗎？（其內含的所有資料也會一併刪除）",
      isDangerous: true,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colSessionsName, id));
          
          // 串聯刪除該清單下的所有項目，避免成為無主資料
          const qItems = query(collection(db, 'artifacts', appId, 'public', 'data', colItemsName), where('sessionId', '==', id));
          const snapshot = await getDocs(qItems);
          const batch = writeBatch(db);
          snapshot.forEach(d => {
            batch.delete(d.ref);
          });
          await batch.commit();

          setConfirmDialog(p => ({ ...p, isOpen: false }));
          showToast("清單已徹底刪除");
          
          // 如果刪除的是當前正在檢視的清單，則跳回總覽
          if (currentSession && currentSession.id === id) {
            setCurrentSession(null);
            setViewMode('sessions');
          }
        } catch (err) {
          console.error(err);
          showToast("刪除失敗", "error");
        }
      }
    });
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    try {
      const sName = isLab ? sessionForm.name : `${sessionForm.year}年度-${sessionForm.stage}`;
      const basePayload = { name: sName, date: sessionForm.date, createdBy: user.uid, ...(isLab ? {} : { year: sessionForm.year, stage: sessionForm.stage }) };
      let newSessionRef;
      if (editItem) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', colSessionsName, editItem.id), { ...basePayload, updatedAt: serverTimestamp() });
        showToast("已更新");
      } else {
        newSessionRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', colSessionsName), { ...basePayload, createdAt: serverTimestamp() });
        if (sessionForm.copyFromPrevious && sessions.length > 0) {
              const latestSession = sessions[0];
              const qSource = query(collection(db, 'artifacts', appId, 'public', 'data', colItemsName), where('sessionId', '==', latestSession.id));
              const sourceDocs = await getDocs(qSource);
              const batch = writeBatch(db);
              let count = 0;
              sourceDocs.forEach(docSnap => {
                  const data = docSnap.data();
                  const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', colItemsName));
                  const resetFields = isLab ? { borrowedCount: 0 } : { status: '未盤點' };
                  batch.set(newRef, { ...data, sessionId: newSessionRef.id, ...resetFields, updatedAt: serverTimestamp(), createdAt: serverTimestamp() });
                  count++;
              });
              if (count > 0) await batch.commit();
              showToast(`已建立並複製 ${count} 項資料`);
        } else showToast("建立成功");
      }
      setIsModalOpen(false);
    } catch (err) { showToast("錯誤", "error"); }
  };
  
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!currentSession) return;
    if (isCompressing) { showToast("圖片正在處理中...", "error"); return; }

    const now = new Date();
    const formattedTime = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      let payload = { sessionId: currentSession.id, imageUrl: imagePreview || '', lastUpdatedStr: formattedTime, updatedAt: serverTimestamp() };
      
      if (isLab) {
        const cat = categories.find(c => c.id === equipForm.categoryId);
        payload = { ...payload, name: equipForm.name, quantity: parseInt(equipForm.quantity), categoryId: equipForm.categoryId, categoryName: cat ? cat.name : '未分類', note: equipForm.note, addDate: equipForm.addDate || '', ...(editItem ? {} : { borrowedCount: 0 }) };
      } else {
        payload = { ...payload, ...propForm, imageUrl: imagePreview || '', ...(editItem ? {} : { createdAt: serverTimestamp() }) };
      }

      if (editItem) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', colItemsName, editItem.id), payload);
      else { payload.createdAt = serverTimestamp(); await addDoc(collection(db, 'artifacts', appId, 'public', 'data', colItemsName), payload); }
      setIsModalOpen(false); showToast("儲存成功");
    } catch (err) { showToast("錯誤 (可能圖片太大)", "error"); }
  };

  const togglePropertyStatus = async (item) => {
    if (isLab) return;
    const newStatus = item.status === '已盤點' ? '未盤點' : '已盤點';
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', colItemsName, item.id), { status: newStatus, updatedAt: serverTimestamp() });
        showToast(`標記為${newStatus}`);
    } catch(e) { showToast("狀態更新失敗", "error"); }
  };

  const deleteItem = (id) => {
    setConfirmDialog({ isOpen: true, title: "刪除確認", message: "確定要刪除這筆資料嗎？", isDangerous: true, action: async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', colItemsName, id)); setConfirmDialog(p => ({...p, isOpen: false})); showToast("已刪除"); } });
  };

  // --- Filtering & Sorting ---
  const filteredItems = useMemo(() => {
    const result = itemsList.filter(item => {
      const matchSearch = isLab 
        ? item.name.toLowerCase().includes(searchTerm.toLowerCase())
        : (item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.propId && item.propId.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchDate = searchDate ? item.addDate === searchDate : true;
      if (isLab) return matchSearch && matchDate && (selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter);
      return matchSearch && matchDate && (searchStatus === 'all' || item.status === searchStatus);
    });
    result.sort((a, b) => {
      if (isLab) {
          if (sortOption === 'quantity_desc') return b.quantity - a.quantity;
          if (sortOption === 'quantity_asc') return a.quantity - b.quantity;
          if (sortOption === 'created_desc') return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
          return a.name.localeCompare(b.name, 'zh-Hant');
      } else {
          if (sortOption === 'created_desc') return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
          if (sortOption === 'propId_asc') return (a.propId||'').localeCompare((b.propId||''), 'zh-Hant');
          if (sortOption === 'propId_desc') return (b.propId||'').localeCompare((a.propId||''), 'zh-Hant');
          return a.name.localeCompare(b.name, 'zh-Hant');
      }
    });
    return result;
  }, [itemsList, searchTerm, searchDate, selectedCategoryFilter, searchStatus, sortOption, isLab]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => { const startIndex = (currentPage - 1) * ITEMS_PER_PAGE; return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE); }, [filteredItems, currentPage]);
  const totalLoanPages = Math.ceil(loans.length / ITEMS_PER_PAGE);
  const paginatedLoans = useMemo(() => { const startIndex = (currentLoanPage - 1) * ITEMS_PER_PAGE; return loans.slice(startIndex, startIndex + ITEMS_PER_PAGE); }, [loans, currentLoanPage]);

  // --- Modal Openers ---
  const openSessionModal = (item=null) => { 
      setModalType('session'); setEditItem(item); 
      setSessionForm({ name: item ? item.name : '', date: item ? item.date : new Date().toISOString().slice(0,10), year: item ? item.year||'' : new Date().getFullYear()-1911, stage: item ? item.stage||'初盤' : '初盤', copyFromPrevious: false }); 
      setIsModalOpen(true); 
  };
  const openItemModal = (item=null) => { 
      setModalType('item'); setEditItem(item); setImagePreview(item?.imageUrl || '');
      const todayStr = new Date().toISOString().slice(0, 10);
      const minguoStr = getMinguoDateString();
      if (isLab) {
          setEquipForm(item ? { name: item.name, quantity: item.quantity, categoryId: item.categoryId, note: item.note, imageUrl: item.imageUrl, addDate: item.addDate || '' } : { name: '', quantity: 1, categoryId: categories[0]?.id || '', note: '', imageUrl: '', addDate: todayStr }); 
      } else {
          setPropForm(item ? { propId: item.propId||'', name: item.name||'', brandModel: item.brandModel||'', value: item.value||'', acquireDate: item.acquireDate||'', lifespan: item.lifespan||'', user: item.user||'', location: item.location||'', note: item.note||'', status: item.status||'未盤點', imageUrl: item.imageUrl||'' } : { propId: '', name: '', brandModel: '', value: '', acquireDate: minguoStr, lifespan: '', user: '', location: '', note: '', status: '未盤點', imageUrl: '' });
      }
      setIsModalOpen(true); 
  };

  // --- Cart Helpers (Lab Only) ---
  const initiateAddToCart = (item) => { const avail = getAvailability(item); if(avail<=0){showToast("已無庫存","error");return;} setSelectQuantityDialog({ isOpen: true, item }); };
  const confirmAddToCart = (item, qty) => {
    const existing = cartItems.find(c => c.id === item.id); const avail = getAvailability(item);
    if (existing) {
      if (existing.borrowQty + qty <= avail) { setCartItems(cartItems.map(c => c.id === item.id ? { ...c, borrowQty: existing.borrowQty + qty } : c)); showToast(`已追加`); }
      else { setCartItems(cartItems.map(c => c.id === item.id ? { ...c, borrowQty: avail } : c)); showToast(`已達上限 (${avail})`, "error"); }
    } else { setCartItems([...cartItems, { ...item, borrowQty: qty, maxQty: avail }]); showToast(`已加入借用`); }
    setSelectQuantityDialog({ isOpen: false, item: null });
  };
  const updateCartQty = (id, delta) => { setCartItems(cartItems.map(c => { if(c.id === id) { const n = c.borrowQty + delta; if(n > 0 && n <= c.maxQty) return {...c, borrowQty: n}; } return c; })); };
  const handleBatchBorrow = async (e) => { 
    e.preventDefault(); if (!currentSession) return; if (!cartItems.length) { showToast("請先加入設備", "error"); return; }
    try { 
      const promises = cartItems.map(item => {
        addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), { sessionId: currentSession.id, equipmentId: item.id, equipmentName: item.name, borrower: borrowForm.borrower, phone: borrowForm.phone, purpose: borrowForm.purpose, quantity: item.borrowQty, borrowDays: borrowForm.borrowDays, borrowDate: borrowForm.date, returnDate: null, status: 'borrowed', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); 
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', item.id), { borrowedCount: increment(item.borrowQty) }); 
      });
      await Promise.all(promises); setCartItems([]); setBorrowForm({ borrower: '', phone: '', date: new Date().toISOString().slice(0,10), purpose: '', borrowDays: 7 }); showToast("借出成功"); setViewMode('loans'); setMobileBorrowTab('equipment');
    } catch (err) { showToast("借用失敗", "error"); } 
  };
  const handleReturnConfirm = async (loanId, returnQty, originalQty) => {
    try {
        const loanDoc = loans.find(l => l.id === loanId); if (!loanDoc) return;
        if (returnQty >= originalQty) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', loanId), { returnDate: new Date().toISOString().split('T')[0], status: 'returned', updatedAt: serverTimestamp() });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', loanDoc.equipmentId), { borrowedCount: increment(-originalQty) });
            showToast("歸還完成");
        } else {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', loanId), { quantity: originalQty - returnQty, updatedAt: serverTimestamp() });
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), { ...loanDoc, quantity: returnQty, status: 'returned', returnDate: new Date().toISOString().split('T')[0], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', loanDoc.equipmentId), { borrowedCount: increment(-returnQty) });
            showToast(`部分歸還成功`);
        }
        setReturnDialog({ isOpen: false, loan: null });
    } catch (err) { showToast("操作失敗", "error"); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-teal-600 font-medium animate-pulse">系統環境載入中...</div>;
  if (!user || !appMode) return <AuthScreen setAppMode={setAppMode} />;

  const SysConfig = SYSTEM_CONFIGS.find(s => s.id === appMode) || SYSTEM_CONFIGS[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.action} onCancel={()=>setConfirmDialog(p=>({...p, isOpen:false}))} isDangerous={confirmDialog.isDangerous} />
      <ReturnModal isOpen={returnDialog.isOpen} loan={returnDialog.loan} onConfirm={handleReturnConfirm} onCancel={() => setReturnDialog({isOpen: false, loan: null})} />
      <SelectQuantityModal isOpen={selectQuantityDialog.isOpen} item={selectQuantityDialog.item} onConfirm={confirmAddToCart} onCancel={() => setSelectQuantityDialog({isOpen: false, item: null})} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)} />}

      {/* 🟢 新增：全螢幕圖片放大視窗 */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setFullScreenImage(null)}>
          <button onClick={() => setFullScreenImage(null)} className="absolute top-4 right-4 text-white hover:text-slate-300 p-2 bg-black/50 rounded-full transition-colors"><X className="w-8 h-8"/></button>
          <img src={fullScreenImage} alt="全螢幕預覽" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative z-50 w-64 bg-slate-900 text-slate-100 h-screen transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col shadow-2xl`}>
        <div className={`p-6 ${SysConfig.colorClass}`}>
          <h1 className="text-lg font-bold flex items-center gap-2"><SysConfig.icon className="w-5 h-5"/> {SysConfig.name}</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setViewMode('dashboard'); setCurrentSession(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'dashboard' ? 'bg-white/20 text-white shadow-lg font-bold' : 'hover:bg-white/10 text-slate-300'}`}><Home className="w-5 h-5" /> 首頁概覽</button>
          <button onClick={() => { setViewMode('sessions'); setCurrentSession(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'sessions' ? 'bg-white/20 text-white shadow-lg font-bold' : 'hover:bg-white/10 text-slate-300'}`}><FolderOpen className="w-5 h-5" /> {isLab ? '版次總覽' : '清單總覽'}</button>
          {isLab && <button onClick={() => { setViewMode('categories'); setCurrentSession(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'categories' ? 'bg-white/20 text-white shadow-lg font-bold' : 'hover:bg-white/10 text-slate-300'}`}><Settings className="w-5 h-5" /> 全域分類設定</button>}
          
          {currentSession && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className={`px-4 text-xs font-bold uppercase mb-2 ${SysConfig.textClass} brightness-150`}>當前清單：{currentSession.name}</p>
              <button onClick={() => { setViewMode('items'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'items' ? 'bg-white/10 text-white shadow-lg font-bold border border-white/10' : 'hover:bg-white/5 text-slate-300'}`}><LayoutGrid className="w-5 h-5" /> {isLab ? '設備列表' : '財產總覽'}</button>
              {isLab && (
                <>
                <button onClick={() => { setViewMode('borrow-request'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'borrow-request' ? 'bg-white/10 text-white shadow-lg font-bold border border-white/10' : 'hover:bg-white/5 text-slate-300'}`}><ShoppingCart className="w-5 h-5" /> 借用登記</button>
                <button onClick={() => { setViewMode('loans'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'loans' ? 'bg-white/10 text-white shadow-lg font-bold border border-white/10' : 'hover:bg-white/5 text-slate-300'}`}><History className="w-5 h-5" /> 借還紀錄表</button>
                </>
              )}
            </div>
          )}
        </nav>
        <div className="p-4 border-t border-white/10"><button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-300 hover:text-red-400 font-bold transition-colors w-full p-2 rounded hover:bg-white/5"><LogOut className="w-4 h-4"/> 登出系統 / 切換模組</button></div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="bg-white shadow-sm border-b border-slate-100 p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
             <button onClick={()=>setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu/></button>
             <div>
                <div className="min-w-0 flex-1 pr-2">
                  <h2 className="text-lg md:text-2xl font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">
                    {viewMode === 'sessions' && (isLab ? '版次管理' : '年度盤點清單')}
                    {viewMode === 'categories' && '分類設定'}
                    {viewMode === 'dashboard' && '首頁概覽'}
                    {currentSession && viewMode === 'items' && currentSession.name}
                    {currentSession && viewMode === 'borrow-request' && `${currentSession.name} - 借用登記`}
                    {currentSession && viewMode === 'loans' && `${currentSession.name} - 借還紀錄`}
                  </h2>
                  {currentSession && viewMode !== 'dashboard' && viewMode !== 'sessions' && viewMode !== 'categories' && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate"><Clock className="w-3 h-3"/> 建立: {currentSession.date}</p>
                  )}
                </div>
             </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {viewMode === 'items' && (
                <>
                <button onClick={()=>handleExportCSV()} className="bg-white border border-slate-200 text-slate-700 px-3 py-2 md:px-3 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 shadow-sm transition-all active:scale-95"><FileDown className="w-4 h-4 text-emerald-600"/> <span className="hidden sm:inline font-bold">匯出 CSV</span></button>
                {!isLab && (
                  <>
                  <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleImportCSV} />
                  <button onClick={()=>fileInputRef.current?.click()} className="bg-white border border-slate-200 text-slate-700 px-3 py-2 md:px-3 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 shadow-sm transition-all active:scale-95"><FileSpreadsheet className="w-4 h-4 text-emerald-600"/> <span className="hidden sm:inline font-bold">匯入 CSV</span></button>
                  </>
                )}
                <button onClick={()=>openItemModal()} className={`text-white px-3 py-2 md:px-4 rounded-lg flex items-center gap-2 shadow-sm font-bold transition-all active:scale-95 ${SysConfig.colorClass} ${SysConfig.hoverClass}`}><Plus className="w-4 h-4"/> <span className="hidden sm:inline">{isLab ? '新增設備' : '新增財產'}</span><span className="inline sm:hidden">新增</span></button>
                </>
            )}
            {viewMode === 'sessions' && <button onClick={()=>openSessionModal()} className={`text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm ${SysConfig.colorClass} ${SysConfig.hoverClass}`}><Plus className="w-4 h-4"/> 新增清單</button>}
            {viewMode === 'categories' && <button onClick={()=>{setModalType('category');setEditItem(null);setCatForm({name:''});setIsModalOpen(true)}} className={`text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold shadow-sm ${SysConfig.colorClass} ${SysConfig.hoverClass}`}><Plus className="w-4 h-4"/> 新增分類</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          
          {/* Dashboard View */}
          {viewMode === 'dashboard' && (
             <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`p-2 rounded-lg bg-opacity-10 text-opacity-100 ${SysConfig.colorClass.replace('bg-', 'bg-').replace('600', '100')} ${SysConfig.textClass}`}><Sparkles className="w-5 h-5"/></div>
                  <span className="text-sm font-bold text-slate-500">目前鎖定清單：<span className={`text-base ${SysConfig.textClass}`}>{dashboardStats.latestSessionName}</span></span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title={isLab ? "管理中版次總數" : "歷史清單總數"} value={sessions.length} icon={FolderOpen} colorClass="bg-slate-700" onClick={() =>setViewMode('sessions')} />
                    <StatCard title={isLab ? "最新版次設備種類" : "清單財產總筆數"} value={dashboardStats.totalItems} icon={Box} colorClass={SysConfig.colorClass} onClick={() => handleStatClick('items')} />
                    <StatCard title={isLab ? "目前外借中" : "已完成盤點"} value={dashboardStats.totalBorrowedOrInventoried} icon={Activity} colorClass={isLab ? "bg-orange-500" : "bg-emerald-500"} onClick={() => handleStatClick('borrowed')} />
                    <StatCard title={isLab ? "低庫存警示" : "尚未盤點"} value={dashboardStats.lowStockOrUninventoried} subtext={isLab ? "庫存低於 3 件" : "待處理項目"} icon={AlertTriangle} colorClass="bg-rose-500" onClick={() => handleStatClick('lowstock')} />
                </div>
                
                {isLab ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-teal-600"/> 最新借用動態</h3></div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left min-w-[500px]">
                        <thead className="text-slate-400 text-xs uppercase bg-slate-50 sticky top-0 z-10"><tr><th className="p-3">日期</th><th className="p-3">動作</th><th className="p-3">借用人</th><th className="p-3">物品清單</th></tr></thead>
                        <tbody className="divide-y divide-slate-50 text-sm">
                            {dashboardStats.groupedActivity.map((group, idx) => (
                            <tr key={idx} onClick={() => handleActivityClick(group)} className="hover:bg-slate-50/80 cursor-pointer transition-colors group">
                                <td className="p-3 text-slate-500 align-top">{group.date}</td>
                                <td className="p-3 align-top">{group.type === 'borrow' ? <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-xs w-fit font-bold border border-orange-100"><ArrowUpRight className="w-3 h-3"/> 借出</span> : <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs w-fit font-bold border border-green-100"><ArrowDownLeft className="w-3 h-3"/> 歸還</span>}</td>
                                <td className="p-3 font-medium text-slate-700 align-top">{group.borrower}</td>
                                <td className="p-3 align-top">
                                    <div className="flex flex-wrap gap-2">
                                        {group.items.map((item, i) => ( <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200">{item.name} <span className="font-bold text-slate-500">x{item.quantity}</span></span> ))}
                                    </div>
                                </td>
                            </tr>
                            ))}
                            {dashboardStats.groupedActivity.length===0 && <tr><td colSpan="4" className="p-6 text-center text-slate-400">近期無活動</td></tr>}
                        </tbody>
                        </table>
                    </div>
                    </div>
                    <div className={`bg-gradient-to-br from-${themeColor}-600 to-${themeColor}-800 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center relative overflow-hidden`}>
                        <h3 className="font-bold text-lg mb-2 relative z-10">系統提示</h3>
                        <p className={`text-${themeColor}-100 text-sm mb-6 relative z-10`}>系統預設鎖定最新清單。若需檢視過去資料，請前往「版次總覽」。</p>
                        <button onClick={() => { setViewMode('sessions'); setCurrentSession(null); }} className="w-full bg-white/20 hover:bg-white/30 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 relative z-10 border border-white/20">查看所有 <ChevronRight className="w-4 h-4"/></button>
                    </div>
                </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center mt-6">
                     <div className="mx-auto w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4"><CheckSquare className="w-8 h-8"/></div>
                     <h3 className="text-xl font-bold text-slate-700 mb-2">開始盤點作業</h3>
                     <p className="text-slate-500 mb-6 max-w-md mx-auto">請前往「清單總覽」選擇您要進行盤點的年度與階段。您可以隨時匯入學校提供的 Excel 清單，或是將盤點結果匯出為 CSV 檔案以利歸檔。</p>
                     <button onClick={() => { setViewMode('sessions'); setCurrentSession(null); }} className={`px-6 py-3 rounded-xl font-bold text-white shadow-md transition-colors ${SysConfig.colorClass} ${SysConfig.hoverClass}`}>前往盤點清單總覽</button>
                  </div>
                )}
             </div>
          )}
          
          {/* Sessions View */}
          {viewMode === 'sessions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 max-w-7xl mx-auto animate-in fade-in duration-300">
              {sessions.map(sess => (
                <div key={sess.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden transform hover:-translate-y-1">
                  <div onClick={() => { setCurrentSession(sess); setViewMode('items'); }} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`p-3 rounded-lg bg-opacity-10 ${SysConfig.colorClass.replace('bg-','bg-').replace('600','50')} ${SysConfig.textClass}`}><Calendar className="w-6 h-6"/></div>
                      <span className="text-xs font-mono text-slate-400">{sess.date}</span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-800 mb-1">{sess.name}</h3>
                    <p className="text-sm text-slate-500">點擊進入管理清單</p>
                  </div>
                  <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-mono tracking-wider">ID: {sess.id.slice(0,8)}</span>
                    <div className="flex gap-1">
                      <button onClick={(e)=>{e.stopPropagation(); handleExportCSV(sess);}} className={`p-2 rounded-lg text-slate-400 hover:bg-slate-200 ${SysConfig.textClass.replace('text-','hover:text-')} transition-colors`} title="匯出 CSV"><FileDown className="w-4 h-4"/></button>
                      <button onClick={(e)=>{e.stopPropagation();openSessionModal(sess)}} className={`p-2 rounded-lg text-slate-400 hover:bg-slate-200 ${SysConfig.textClass.replace('text-','hover:text-')} transition-colors`}><Edit2 className="w-4 h-4"/></button>
                      <button onClick={(e)=>{e.stopPropagation();deleteSession(sess.id)}} className="p-2 rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <div className="col-span-full text-center py-20 text-slate-400">尚未建立任何清單，請點擊右上角「新增」。</div>}
            </div>
          )}

          {/* 🟡 [PAGINATED] Items (Equipment or Property) View */}
          {viewMode === 'items' && currentSession && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {/* Filter Bar */}
              <div className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 z-10 sticky top-0">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                  <input type="text" placeholder={isLab ? "搜尋設備名稱、備註..." : "搜尋財產名稱或編號..."} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-300 bg-slate-50 focus:bg-white transition-colors text-sm"/>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 items-center hide-scrollbar">
                    
                    {/* Date Filter */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative flex items-center justify-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                            <Calendar className={`w-4 h-4 ${searchDate ? SysConfig.textClass : 'text-slate-500'}`} />
                            <input type="date" value={searchDate} onChange={e=>setSearchDate(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title={searchDate ? `已篩選: ${searchDate}` : "依加入日期篩選"} />
                        </div>
                        {searchDate && <div className={`flex items-center gap-1 bg-opacity-10 px-2 py-1.5 rounded-lg border text-xs font-bold ${SysConfig.textClass} ${SysConfig.colorClass.replace('bg-','border-').replace('600','200')} ${SysConfig.colorClass.replace('bg-','bg-').replace('600','50')}`}>{searchDate} <button onClick={()=>setSearchDate('')} className="hover:bg-black/10 p-0.5 rounded-full transition-colors"><X className="w-3 h-3"/></button></div>}
                    </div>
                    
                    {/* Lab Category Filter */}
                    {isLab && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative flex items-center justify-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                            <Filter className={`w-4 h-4 ${selectedCategoryFilter !== 'all' ? SysConfig.textClass : 'text-slate-500'}`} />
                            <select value={selectedCategoryFilter} onChange={e=>setSelectedCategoryFilter(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="篩選分類">
                              <option value="all">所有分類</option>
                              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        {selectedCategoryFilter !== 'all' && <div className={`flex items-center gap-1 bg-opacity-10 px-2 py-1.5 rounded-lg border text-xs font-bold ${SysConfig.textClass} ${SysConfig.colorClass.replace('bg-','border-').replace('600','200')} ${SysConfig.colorClass.replace('bg-','bg-').replace('600','50')}`}>{categories.find(c => c.id === selectedCategoryFilter)?.name} <button onClick={()=>setSelectedCategoryFilter('all')} className="hover:bg-black/10 p-0.5 rounded-full transition-colors"><X className="w-3 h-3"/></button></div>}
                    </div>
                    )}

                    {/* Property Status Filter */}
                    {!isLab && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative flex items-center justify-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                            <CheckSquare className={`w-4 h-4 ${searchStatus !== 'all' ? SysConfig.textClass : 'text-slate-500'}`} />
                            <select value={searchStatus} onChange={e=>setSearchStatus(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="篩選盤點狀態">
                              <option value="all">全部狀態</option>
                              <option value="未盤點">未盤點</option>
                              <option value="已盤點">已盤點</option>
                            </select>
                        </div>
                        {searchStatus !== 'all' && <div className={`flex items-center gap-1 bg-opacity-10 px-2 py-1.5 rounded-lg border text-xs font-bold ${SysConfig.textClass} ${SysConfig.colorClass.replace('bg-','border-').replace('600','200')} ${SysConfig.colorClass.replace('bg-','bg-').replace('600','50')}`}>{searchStatus} <button onClick={()=>setSearchStatus('all')} className="hover:bg-black/10 p-0.5 rounded-full transition-colors"><X className="w-3 h-3"/></button></div>}
                    </div>
                    )}

                    {/* Sort Options */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative flex items-center justify-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                            <ArrowUpDown className={`w-4 h-4 ${sortOption !== 'created_desc' ? SysConfig.textClass : 'text-slate-500'}`} />
                            <select value={sortOption} onChange={e=>setSortOption(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="排序方式">
                                <option value="created_desc" hidden>預設(最新)</option>
                                <option value="name">名稱排序</option>
                                {isLab && <option value="quantity_desc">數量 (多→少)</option>}
                                {isLab && <option value="quantity_asc">數量 (少→多)</option>}
                                {!isLab && <option value="propId_asc">財產編號 (小→大)</option>}
                                {!isLab && <option value="propId_desc">財產編號 (大→小)</option>}
                            </select>
                        </div>
                        {sortOption !== 'created_desc' && (
                           <div className={`flex items-center gap-1 bg-opacity-10 px-2 py-1.5 rounded-lg border text-xs font-bold ${SysConfig.textClass} ${SysConfig.colorClass.replace('bg-','border-').replace('600','200')} ${SysConfig.colorClass.replace('bg-','bg-').replace('600','50')}`}>
                             {sortOption === 'name' && '名稱排序'}
                             {sortOption === 'quantity_desc' && '數量 (多→少)'}
                             {sortOption === 'quantity_asc' && '數量 (少→多)'}
                             {sortOption === 'propId_asc' && '編號 (小→大)'}
                             {sortOption === 'propId_desc' && '編號 (大→小)'}
                             <button onClick={()=>setSortOption('created_desc')} className="hover:bg-black/10 p-0.5 rounded-full transition-colors"><X className="w-3 h-3"/></button>
                           </div>
                        )}
                    </div>
                </div>
              </div>

              {/* Mobile Card View (Paginated) */}
              <div className="block md:hidden">
                <div className="space-y-4">
                  {paginatedItems.map(item => {
                    const available = isLab ? (item.quantity - (item.borrowedCount || 0)) : 0;
                    return (
                      <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-3 relative">
                        {item.imageUrl ? (
                           <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-slate-100">
                             <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover cursor-pointer" onClick={() => setFullScreenImage(item.imageUrl)} onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE_SRC; }}/>
                           </div>
                        ) : (
                           <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-slate-50 flex flex-col items-center justify-center text-slate-400 border border-slate-100">
                             <ImageIcon className="w-5 h-5 mb-1"/>
                             <span className="text-[10px]">無照片</span>
                           </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <div className="min-w-0 flex-1">
                              {!isLab && item.propId && <div className={`font-mono font-bold text-sm tracking-wider mb-0.5 truncate ${SysConfig.textClass}`}>{item.propId}</div>}
                              <h3 className="font-bold text-base text-slate-800 truncate">{item.name}</h3>
                            </div>
                          </div>
                          
                          {/* 🟢 財產詳細資料展示 (手機版) */}
                          {!isLab && (
                             <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 mb-2 text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                                <div className="truncate"><span className="text-slate-400">廠牌:</span> {item.brandModel || '-'}</div>
                                <div className="truncate"><span className="text-slate-400">現值:</span> ${item.value || 0}</div>
                                <div className="truncate"><span className="text-slate-400">取得:</span> {item.acquireDate || '-'}</div>
                                <div className="truncate"><span className="text-slate-400">年限:</span> {item.lifespan || '-'}</div>
                                <div className="col-span-2 truncate"><span className="text-slate-400">備註:</span> {item.note || '-'}</div>
                             </div>
                          )}

                          {/* Tags & Meta */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {isLab ? (
                                <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium">{item.categoryName}</span>
                            ) : (
                                <>
                                {item.user && <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><UserCheck className="w-3 h-3"/>{item.user}</span>}
                                <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-medium">{item.location || '無地點'}</span>
                                </>
                            )}
                            {item.addDate && isLab && <span className={`inline-block bg-opacity-10 text-[10px] px-1.5 py-0.5 rounded font-bold ${SysConfig.colorClass.replace('bg-','bg-').replace('600','50')} ${SysConfig.textClass}`}>{item.addDate}</span>}
                          </div>
                          {item.lastUpdatedStr && <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Clock className="w-2.5 h-2.5"/> 更新: {item.lastUpdatedStr}</div>}
                          
                          {/* Bottom Action Area */}
                          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between gap-2">
                            {isLab ? (
                                <>
                                <div className="flex gap-2 text-xs text-slate-600 font-mono">
                                    <span>總 {item.quantity}</span><span className="text-orange-500">借 {item.borrowedCount || 0}</span><span className={`font-bold ${available===0?'text-rose-500':'text-emerald-600'}`}>剩 {available}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <div className="flex gap-0.5 bg-slate-50 rounded-lg border border-slate-100 p-0.5">
                                      <button onClick={()=>openItemModal(item)} className={`p-1.5 text-slate-400 hover:bg-white rounded ${SysConfig.textClass.replace('text-','hover:text-')}`}><Edit2 className="w-3.5 h-3.5"/></button>
                                      <button onClick={()=>deleteItem(item.id)} className="p-1.5 text-slate-400 hover:bg-rose-50 rounded hover:text-rose-600"><Trash2 className="w-3.5 h-3.5"/></button>
                                    </div>
                                    <button onClick={()=>initiateAddToCart(item)} disabled={available <= 0} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-white shadow-sm ${available <= 0 ? 'bg-slate-300' : SysConfig.colorClass}`}>
                                      <Plus className="w-3 h-3"/> 借用
                                    </button>
                                </div>
                                </>
                            ) : (
                                <>
                                <button onClick={() => togglePropertyStatus(item)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${item.status === '已盤點' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                    {item.status === '已盤點' ? <><CheckCircle className="w-3.5 h-3.5"/> 已盤點</> : <><XCircle className="w-3.5 h-3.5"/> 未盤點</>}
                                </button>
                                <div className="flex gap-0.5 flex-shrink-0 bg-slate-50 rounded-lg border border-slate-100 p-0.5">
                                  <button onClick={()=>openItemModal(item)} className={`p-1.5 text-slate-400 hover:bg-white rounded ${SysConfig.textClass.replace('text-','hover:text-')}`}><Edit2 className="w-3.5 h-3.5"/></button>
                                  <button onClick={()=>deleteItem(item.id)} className="p-1.5 text-slate-400 hover:bg-rose-50 rounded hover:text-rose-600"><Trash2 className="w-3.5 h-3.5"/></button>
                                </div>
                                </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredItems.length===0 && <div className="text-center py-10 text-slate-400">沒有找到相符資料</div>}
                </div>
                <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>

              {/* Desktop Table View (Paginated) */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500 sticky top-0 z-10 shadow-sm">
                        <tr>
                        <th className="p-3 w-14 text-center">圖</th>
                        {isLab ? (
                            <>
                            <th className="p-3 font-semibold w-1/4">設備資訊</th>
                            <th className="p-3 font-semibold w-1/4">分類 / 日期</th>
                            <th className="p-3 font-semibold w-1/4">庫存狀態</th>
                            <th className="p-3 font-semibold text-right w-1/4">操作</th>
                            </>
                        ) : (
                            <>
                            {/* 🟢 財產桌面版表頭調整 */}
                            <th className="p-3 font-semibold w-[20%]">財產編號 / 名稱</th>
                            <th className="p-3 font-semibold w-[15%]">廠牌型別</th>
                            <th className="p-3 font-semibold w-[15%]">使用人 / 存置地點</th>
                            <th className="p-3 font-semibold w-[20%]">取得日期 / 現值 / 年限</th>
                            <th className="p-3 font-semibold w-[10%] text-center">狀態</th>
                            <th className="p-3 font-semibold text-right w-[15%]">操作</th>
                            </>
                        )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {paginatedItems.map(item => {
                        const available = isLab ? (item.quantity - (item.borrowedCount || 0)) : 0;
                        return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="p-3 text-center align-top pt-4">
                                {item.imageUrl ? (
                                    <div onClick={() => setFullScreenImage(item.imageUrl)} className="inline-block w-10 h-10 rounded-lg overflow-hidden border border-slate-200 hover:scale-150 transition-transform origin-left shadow-sm cursor-pointer">
                                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE_SRC; }}/>
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 mx-auto rounded-lg bg-slate-50 flex flex-col items-center justify-center text-slate-400 border border-slate-100">
                                        <ImageIcon className="w-4 h-4 mb-0.5"/>
                                        <span className="text-[8px] leading-none scale-90 font-bold">無照片</span>
                                    </div>
                                )}
                            </td>
                            {isLab ? (
                                <>
                                <td className="p-3 align-top">
                                    <div className="font-bold text-slate-800">{item.name}</div>
                                    <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={item.note}>{item.note || '-'}</div>
                                    {item.lastUpdatedStr && <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><Clock className="w-3 h-3"/> 更新: {item.lastUpdatedStr}</div>}
                                </td>
                                <td className="p-3 align-top">
                                    <span className="inline-block bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs font-medium text-slate-600 mb-1">{item.categoryName}</span>
                                    {item.addDate && <div className={`text-[10px] font-bold mt-1 ${SysConfig.textClass}`}>加入: {item.addDate}</div>}
                                </td>
                                <td className="p-3 align-top">
                                    <div className="flex items-center gap-2">
                                    <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">總 {item.quantity}</span>
                                    <span className="font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded text-xs">借 {item.borrowedCount || 0}</span>
                                    <span className={`font-mono px-2 py-0.5 rounded text-xs font-bold ${available === 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>剩 {available}</span>
                                    </div>
                                </td>
                                <td className="p-3 text-right align-top">
                                    <div className="flex justify-end gap-1.5">
                                    <button onClick={()=>initiateAddToCart(item)} disabled={available <= 0} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-white shadow-sm transition-all active:scale-95 ${available <= 0 ? 'bg-slate-300 cursor-not-allowed' : SysConfig.colorClass}`}>
                                        <Plus className="w-3.5 h-3.5"/> 借用
                                    </button>
                                    <button onClick={()=>openItemModal(item)} className="p-1.5 text-slate-400 hover:text-teal-600 bg-transparent hover:bg-slate-100 rounded-lg transition-colors"><Edit2 className="w-4 h-4"/></button>
                                    <button onClick={()=>deleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-transparent hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </td>
                                </>
                            ) : (
                                <>
                                <td className="p-3 align-top">
                                    <div className={`font-mono font-bold text-sm tracking-wider mb-1 ${SysConfig.textClass}`}>{item.propId || '無編號'}</div>
                                    <div className="font-bold text-slate-800 text-sm">{item.name}</div>
                                    {item.lastUpdatedStr && <div className="text-[9px] text-slate-400 mt-2 flex items-center gap-1"><Clock className="w-3 h-3"/> 更新: {item.lastUpdatedStr}</div>}
                                </td>
                                <td className="p-3 align-top text-xs text-slate-600">
                                    {item.brandModel || '-'}
                                </td>
                                <td className="p-3 align-top">
                                    <div className="text-sm font-medium text-slate-700 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-slate-400"/> {item.user || '-'}</div>
                                    <div className="text-xs text-slate-500 mt-1">{item.location || '-'}</div>
                                </td>
                                <td className="p-3 align-top text-xs text-slate-600 space-y-1">
                                    <div><span className="text-slate-400">取得:</span> {item.acquireDate || '-'}</div>
                                    <div><span className="text-slate-400">現值:</span> <span className="font-mono">${item.value || 0}</span></div>
                                    <div><span className="text-slate-400">年限:</span> {item.lifespan || '-'}</div>
                                </td>
                                <td className="p-3 align-top text-center">
                                    <button onClick={() => togglePropertyStatus(item)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer w-24 ${item.status === '已盤點' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'}`} title="點擊切換狀態">
                                        {item.status === '已盤點' ? <><Check className="w-3.5 h-3.5"/> 已盤點</> : <><Minus className="w-3.5 h-3.5"/> 未盤點</>}
                                    </button>
                                </td>
                                <td className="p-3 text-right align-top">
                                    <div className="flex justify-end gap-1">
                                    <button onClick={()=>openItemModal(item)} className={`p-1.5 text-slate-400 bg-transparent hover:bg-slate-100 rounded-lg transition-colors ${SysConfig.textClass.replace('text-', 'hover:text-')}`}><Edit2 className="w-4 h-4"/></button>
                                    <button onClick={()=>deleteItem(item.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-transparent hover:bg-rose-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </td>
                                </>
                            )}
                            </tr>
                        );
                        })}
                        {filteredItems.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-slate-400">沒有找到相符資料</td></tr>}
                    </tbody>
                    </table>
                </div>
                <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            </div>
          )}

          {/* 🟡 [PAGINATED] Borrow Request View (LAB ONLY) */}
          {isLab && viewMode === 'borrow-request' && currentSession && (
             <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-full lg:overflow-hidden animate-in fade-in duration-300">
                <div className="flex bg-slate-200 p-1 rounded-xl lg:hidden shrink-0">
                   <button onClick={() => setMobileBorrowTab('equipment')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mobileBorrowTab === 'equipment' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>1. 選擇設備</button>
                   <button onClick={() => setMobileBorrowTab('form')} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-1.5 ${mobileBorrowTab === 'form' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>2. 借用登記 {cartItems.length > 0 && <span className="bg-teal-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{cartItems.length}</span>}</button>
                </div>

                <div className={`flex-1 lg:w-7/12 flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[520px] lg:h-full lg:min-h-0 ${mobileBorrowTab === 'equipment' ? 'flex' : 'hidden lg:flex'}`}>
                   <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Search className="w-4 h-4"/> 搜尋可用設備</h3>
                      <div className="flex flex-col gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                          <input type="text" placeholder="輸入名稱搜尋..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500 bg-white text-sm"/>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <div className="relative flex items-center justify-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                                    <Filter className={`w-4 h-4 ${selectedCategoryFilter !== 'all' ? 'text-teal-600' : 'text-slate-500'}`} />
                                    <select value={selectedCategoryFilter} onChange={e=>setSelectedCategoryFilter(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="篩選分類"><option value="all">所有分類</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
                                </div>
                                {selectedCategoryFilter !== 'all' && <div className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-1 rounded-lg border border-teal-200 text-xs font-bold">{categories.find(c => c.id === selectedCategoryFilter)?.name} <button onClick={()=>setSelectedCategoryFilter('all')} className="hover:bg-teal-200 p-0.5 rounded-full transition-colors"><X className="w-3 h-3"/></button></div>}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <div className="relative flex items-center justify-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                                    <ArrowUpDown className={`w-4 h-4 ${sortOption !== 'created_desc' ? 'text-teal-600' : 'text-slate-500'}`} />
                                    <select value={sortOption} onChange={e=>setSortOption(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" title="排序方式"><option value="created_desc" hidden>預設</option><option value="name">名稱排序</option><option value="quantity_desc">數量 (多→少)</option><option value="quantity_asc">數量 (少→多)</option></select>
                                </div>
                                {sortOption !== 'created_desc' && <div className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-1 rounded-lg border border-teal-200 text-xs font-bold">{sortOption === 'name' ? '名稱排序' : sortOption === 'quantity_desc' ? '數量 (多→少)' : '數量 (少→多)'} <button onClick={()=>setSortOption('created_desc')} className="hover:bg-teal-200 p-0.5 rounded-full transition-colors"><X className="w-3 h-3"/></button></div>}
                            </div>
                        </div>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50">
                      {paginatedItems.map(item => {
                        const available = getAvailability(item);
                        if(available <= 0) return null; 
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 hover:border-teal-300 transition-colors shadow-sm">
                             <div className="flex items-center gap-3 min-w-0">
                                {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-md object-cover border border-slate-100 flex-shrink-0" onError={(e) => { e.target.onerror = null; e.target.src = FALLBACK_IMAGE_SRC; }}/> : <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-100 flex flex-col items-center justify-center flex-shrink-0 text-slate-300"><ImageIcon className="w-4 h-4"/></div>}
                                <div className="min-w-0 pr-2">
                                   <div className="font-bold text-slate-700 truncate text-sm">{item.name}</div>
                                   <div className="text-[10px] text-slate-500 mt-0.5">分類: {item.categoryName} | 庫存: <span className="text-teal-600 font-bold">{available}</span></div>
                                </div>
                             </div>
                             <button onClick={()=>initiateAddToCart(item)} className="bg-teal-50 text-teal-600 hover:bg-teal-600 hover:text-white p-2 rounded-full transition-colors flex-shrink-0"><Plus className="w-4 h-4"/></button>
                          </div>
                        );
                      })}
                      {filteredItems.filter(i => getAvailability(i) > 0).length === 0 && <div className="text-center p-10 text-slate-400 text-sm">無可用設備</div>}
                   </div>
                   <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>

                <div className={`flex-1 lg:w-5/12 flex-col gap-4 lg:overflow-y-auto lg:h-full ${mobileBorrowTab === 'form' ? 'flex' : 'hidden lg:flex'}`}>
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-teal-600"/> 借用清單 ({cartItems.length})</h3>
                      {cartItems.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-sm">尚未選擇任何設備<br/>請從列表點擊 + 加入</div>
                      ) : (
                        <div className="space-y-2 max-h-[250px] lg:max-h-[300px] overflow-y-auto pr-1">
                           {cartItems.map(item => (
                             <div key={item.id} className="flex items-center justify-between p-2.5 bg-teal-50/50 rounded-lg border border-teal-100">
                                <div className="flex-1 min-w-0 pr-2">
                                   <div className="font-bold text-teal-900 truncate text-sm">{item.name}</div>
                                   <div className="text-[10px] text-teal-600 mt-0.5">上限: {item.maxQty}</div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 bg-white rounded-lg border border-teal-100 p-0.5 shadow-sm">
                                   <button onClick={()=>updateCartQty(item.id, -1)} className="p-1 text-teal-600 hover:bg-teal-50 rounded"><Minus className="w-3 h-3"/></button>
                                   <input type="number" className="w-8 text-center text-sm font-bold text-slate-700 outline-none" value={item.borrowQty} onChange={(e) => handleCartQtyInput(item.id, e.target.value)} min="1" max={item.maxQty} />
                                   <button onClick={()=>updateCartQty(item.id, 1)} className="p-1 text-teal-600 hover:bg-teal-50 rounded"><Plus className="w-3 h-3"/></button>
                                   <div className="w-px h-4 bg-teal-100 mx-0.5"></div>
                                   <button onClick={()=>removeFromCart(item.id)} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><X className="w-3 h-3"/></button>
                                </div>
                             </div>
                           ))}
                        </div>
                      )}
                   </div>
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-1 min-h-0 lg:overflow-y-auto">
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-teal-600"/> 借用人資訊</h3>
                      <form onSubmit={handleBatchBorrow} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-bold text-slate-600 block mb-1">姓名</label><input className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" value={borrowForm.borrower} onChange={e=>setBorrowForm({...borrowForm, borrower:e.target.value})} required/></div>
                          <div><label className="text-xs font-bold text-slate-600 block mb-1">電話</label><input type="tel" className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" value={borrowForm.phone} onChange={e=>setBorrowForm({...borrowForm, phone:e.target.value})} required/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div><label className="text-xs font-bold text-slate-600 block mb-1">借用日期</label><input type="date" className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" value={borrowForm.date} onChange={e=>setBorrowForm({...borrowForm, date:e.target.value})} required/></div>
                           <div><label className="text-xs font-bold text-slate-600 block mb-1">預計天數</label><div className="relative"><input type="number" min="1" className="w-full border border-slate-200 rounded-lg p-2 pr-8 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" value={borrowForm.borrowDays} onChange={e=>setBorrowForm({...borrowForm, borrowDays:e.target.value})} required/><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">天</span></div></div>
                        </div>
                        {borrowForm.date && borrowForm.borrowDays && (<div className="text-xs text-teal-700 flex items-center gap-1.5 bg-teal-50 p-2.5 rounded-lg border border-teal-100 font-medium"><Timer className="w-3.5 h-3.5"/> 預計歸還：{getExpectedReturnDate(borrowForm.date, borrowForm.borrowDays)}</div>)}
                        <div><label className="text-xs font-bold text-slate-600 block mb-1">用途說明</label><textarea className="w-full border border-slate-200 rounded-lg p-2 h-16 resize-none text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" value={borrowForm.purpose} onChange={e=>setBorrowForm({...borrowForm, purpose:e.target.value})} required/></div>
                        <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md mt-2">確認借出 ({cartItems.length} 項物品)</button>
                      </form>
                   </div>
                </div>
             </div>
          )}

          {/* 🟡 [PAGINATED] Loan History View (LAB ONLY) */}
          {isLab && viewMode === 'loans' && currentSession && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><History className="w-5 h-5 text-teal-600"/> 借用與歸還紀錄</h3>
                <span className="text-xs bg-teal-50 text-teal-700 border border-teal-100 px-2.5 py-1 rounded-full font-bold">共 {loans.length} 筆</span>
              </div>
              <div className="block md:hidden space-y-4">
                {paginatedLoans.map(loan => (
                  <div key={loan.id} className={`bg-white p-4 rounded-xl shadow-sm border ${loan.status === 'borrowed' ? 'border-orange-200' : 'border-emerald-200'}`}>
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${loan.status === 'borrowed' ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>{loan.status === 'borrowed' ? '借用中' : '已歸還'}</span>
                      <div className="text-xs text-slate-400 font-mono">{loan.borrowDate}</div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between"><span className="text-sm font-bold text-slate-700">{loan.borrower}</span><span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3"/> {loan.phone}</span></div>
                      {/* 🟢 修改：為借用紀錄的設備名稱加上 truncate 防止超長撐破 */}
                      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm font-medium text-slate-800 flex justify-between items-center gap-2">
                        <span className="truncate">{loan.equipmentName}</span>
                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-600 shadow-sm flex-shrink-0">x{loan.quantity}</span>
                      </div>
                      {loan.purpose && <div className="text-xs text-slate-500 mt-1 px-1">用途: {loan.purpose}</div>}
                    </div>
                    {loan.status === 'borrowed' ? <button onClick={()=>initiateReturn(loan.id)} className="w-full py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-colors"><CheckCircle className="w-4 h-4"/> 確認歸還</button> : <div className="text-center text-xs text-emerald-600 py-2 bg-emerald-50 rounded-lg font-medium border border-emerald-100">歸還日期: {loan.returnDate}</div>}
                  </div>
                ))}
                {paginatedLoans.length === 0 && <div className="text-center py-10 text-slate-400">無紀錄</div>}
                <PaginationControl currentPage={currentLoanPage} totalPages={totalLoanPages} onPageChange={setCurrentLoanPage} />
              </div>
              <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[1000px]">
                    <thead className="bg-slate-50 border-b uppercase text-slate-500 text-xs sticky top-0 z-20 shadow-sm">
                      <tr><th className="p-4 font-semibold w-24">狀態</th><th className="p-4 font-semibold w-48">借用人資訊</th><th className="p-4 font-semibold w-48">設備 (數量)</th><th className="p-4 font-semibold w-64">借用用途</th><th className="p-4 font-semibold w-32">借用日期</th><th className="p-4 font-semibold w-32">歸還日期</th><th className="p-4 font-semibold text-right w-32 sticky right-0 bg-slate-50">動作</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLoans.map(loan => (
                        <tr key={loan.id} className={`hover:bg-slate-50/50 transition-colors ${loan.status === 'borrowed' ? 'bg-orange-50/20' : ''}`}>
                          <td className="p-4">{loan.status === 'borrowed' ? <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded text-[10px] font-bold border border-orange-100 whitespace-nowrap">借用中</span> : <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-[10px] font-bold border border-emerald-100 whitespace-nowrap">已歸還</span>}</td>
                          <td className="p-4"><div className="font-bold text-slate-700 text-sm">{loan.borrower}</div><div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/> {loan.phone}</div></td>
                          <td className="p-4 font-medium text-slate-800 text-sm">{loan.equipmentName} <span className="ml-2 bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">x{loan.quantity}</span></td>
                          <td className="p-4 text-slate-600 text-xs max-w-xs truncate" title={loan.purpose}>{loan.purpose || '-'}</td>
                          <td className="p-4 font-mono text-slate-500 text-xs whitespace-nowrap">{loan.borrowDate}</td>
                          <td className="p-4 font-mono text-slate-500 text-xs whitespace-nowrap">{loan.returnDate || '-'}</td>
                          <td className="p-4 text-right sticky right-0 bg-white">
                            {loan.status === 'borrowed' && <button onClick={()=>initiateReturn(loan.id)} className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap flex items-center gap-1 ml-auto"><CheckCircle className="w-3 h-3"/> 歸還</button>}
                          </td>
                        </tr>
                      ))}
                      {paginatedLoans.length === 0 && <tr><td colSpan="7" className="p-12 text-center text-slate-400">目前無借用紀錄</td></tr>}
                    </tbody>
                  </table>
                </div>
                <PaginationControl currentPage={currentLoanPage} totalPages={totalLoanPages} onPageChange={setCurrentLoanPage} />
              </div>
            </div>
          )}

          {/* Categories View (LAB ONLY) */}
          {isLab && viewMode === 'categories' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto animate-in fade-in duration-300">
               {categories.map(c => (
                 <div key={c.id} className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 hover:border-teal-400 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex-shrink-0 flex items-center justify-center text-teal-600"><Hash className="w-4 h-4"/></div>
                    <span className="font-bold text-slate-700 text-sm break-words leading-tight">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={(e)=>{e.stopPropagation(); setModalType('category');setEditItem(c);setCatForm({name:c.name});setIsModalOpen(true)}} className="p-2 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"><Edit2 className="w-3.5 h-3.5"/></button>
                    <button onClick={(e)=>{e.stopPropagation(); handleDeleteCategory(c.id)}} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                 </div>
               ))}
               {categories.length === 0 && <div className="col-span-full text-center py-10 text-slate-400">尚未設定分類</div>}
             </div>
          )}
        </div>
      </main>

      {/* Modals (Forms) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={()=>setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
              <h3 className={`text-xl font-bold ${SysConfig.textClass} flex items-center gap-2`}>
                {modalType === 'session' && (editItem ? (isLab ? '編輯版次' : '編輯計畫') : (isLab ? '新增版次' : '建立年度清單'))}
                {modalType === 'item' && (editItem ? (isLab ? '編輯設備' : '編輯財產') : (isLab ? '新增設備' : '新增財產'))}
                {modalType === 'category' && (editItem ? '編輯分類' : '新增分類')}
              </h3>
              <button onClick={()=>setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-6 h-6"/></button>
            </div>
            
            {/* Session Form */}
            {modalType === 'session' && (
              <form onSubmit={handleSaveSession} className="space-y-4">
                {isLab ? (
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">版次名稱</label><input className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" value={sessionForm.name} onChange={e=>setSessionForm({...sessionForm, name:e.target.value})} placeholder="例如: 2023 上學期" required/></div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block">盤點年度</label><input type="number" className={`w-full border border-slate-200 rounded-lg p-2.5 focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={sessionForm.year} onChange={e=>setSessionForm({...sessionForm, year:e.target.value})} placeholder="例如: 113" required/></div>
                        <div><label className="text-sm font-bold text-slate-700 mb-1 block">階段</label><select className={`w-full border border-slate-200 rounded-lg p-2.5 focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none bg-white`} value={sessionForm.stage} onChange={e=>setSessionForm({...sessionForm, stage:e.target.value})}><option value="初盤">初盤</option><option value="複盤">複盤</option></select></div>
                    </div>
                )}
                
                <div><label className="text-sm font-bold text-slate-700 mb-1 block">建立日期</label><input type="date" className={`w-full border border-slate-200 rounded-lg p-2.5 focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={sessionForm.date} onChange={e=>setSessionForm({...sessionForm, date:e.target.value})} required/></div>
                
                {!editItem && sessions.length > 0 && (
                  <div className={`flex items-center gap-3 p-4 bg-${themeColor}-50 rounded-xl border border-${themeColor}-100`}>
                    <input type="checkbox" id="copyFromPrevious" className={`w-5 h-5 text-${themeColor}-600 rounded focus:ring-${themeColor}-500 cursor-pointer`} checked={sessionForm.copyFromPrevious} onChange={e=>setSessionForm({...sessionForm, copyFromPrevious:e.target.checked})}/>
                    <label htmlFor="copyFromPrevious" className={`text-sm text-${themeColor}-800 cursor-pointer select-none leading-relaxed`}><span className="font-bold block">複製上一期的{isLab?'設備':'財產'}資料？</span><span className={`text-xs text-${themeColor}-600/80`}>{isLab ? '將複製名稱、分類、總數等，借出數會歸零' : '將複製所有財產資料，盤點狀態會重置為「未盤點」'}</span></label>
                  </div>
                )}
                <button type="submit" className={`w-full text-white py-3 rounded-xl font-bold shadow-md mt-6 transition-colors ${SysConfig.colorClass} ${SysConfig.hoverClass}`}>儲存建立</button>
              </form>
            )}

            {/* Item Form (Equipment or Property) */}
            {modalType === 'item' && (
              <form onSubmit={handleSaveItem} className="space-y-4">
                {isLab ? (
                    <>
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">設備名稱</label><input className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm" value={equipForm.name} onChange={e=>setEquipForm({...equipForm, name:e.target.value})} required/></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-sm font-bold text-slate-700 mb-1 block">數量</label><input type="number" className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm" value={equipForm.quantity} onChange={e=>setEquipForm({...equipForm, quantity:e.target.value})} required/></div>
                      <div><label className="text-sm font-bold text-slate-700 mb-1 block">分類</label><select className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white text-sm" value={equipForm.categoryId} onChange={e=>setEquipForm({...equipForm, categoryId:e.target.value})} required><option value="" disabled>選擇分類</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                    </div>
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">加入日期 (非必填)</label><input type="date" className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none bg-white text-sm" value={equipForm.addDate} onChange={e=>setEquipForm({...equipForm, addDate:e.target.value})}/></div>
                    <div><label className="text-sm font-bold text-slate-700 mb-1 block">備註</label><input className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm" value={equipForm.note} onChange={e=>setEquipForm({...equipForm, note:e.target.value})}/></div>
                    </>
                ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto px-1 pb-2 hide-scrollbar">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">財產編號</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.propId} onChange={e=>setPropForm({...propForm, propId:e.target.value})} required/></div>
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">財產名稱</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.name} onChange={e=>setPropForm({...propForm, name:e.target.value})} required/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">廠牌型別</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.brandModel} onChange={e=>setPropForm({...propForm, brandModel:e.target.value})}/></div>
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">現值</label><input type="number" className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.value} onChange={e=>setPropForm({...propForm, value:e.target.value})}/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* 🟢 取得日期加上隱藏的日期選擇器，自動轉換民國年 */}
                        <div>
                          <label className="text-xs font-bold text-slate-600 mb-1 block">取得日期</label>
                          <div className="relative flex items-center">
                            <input 
                              type="text" 
                              className={`w-full border border-slate-200 rounded-md p-2 pr-10 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none bg-white`} 
                              value={propForm.acquireDate} 
                              onChange={e=>setPropForm({...propForm, acquireDate:e.target.value})} 
                              placeholder="例如: 113/05/20"
                            />
                            <input 
                              type="date" 
                              className="absolute right-0 top-0 bottom-0 w-10 opacity-0 cursor-pointer"
                              onChange={(e) => {
                                if(!e.target.value) return;
                                const d = new Date(e.target.value);
                                const mYear = d.getFullYear() - 1911;
                                const mMonth = String(d.getMonth() + 1).padStart(2, '0');
                                const mDay = String(d.getDate()).padStart(2, '0');
                                setPropForm({...propForm, acquireDate: `${mYear}/${mMonth}/${mDay}`});
                              }}
                            />
                            <Calendar className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                          </div>
                        </div>
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">使用年限</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.lifespan} onChange={e=>setPropForm({...propForm, lifespan:e.target.value})} placeholder="例如: 5年"/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {/* 🟢 交換位置：使用人移到存置地點前面 */}
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">使用人</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.user} onChange={e=>setPropForm({...propForm, user:e.target.value})}/></div>
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">存置地點</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.location} onChange={e=>setPropForm({...propForm, location:e.target.value})}/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">狀態</label><select className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none bg-white`} value={propForm.status} onChange={e=>setPropForm({...propForm, status:e.target.value})}><option value="未盤點">未盤點</option><option value="已盤點">已盤點</option></select></div>
                        <div><label className="text-xs font-bold text-slate-600 mb-1 block">備註</label><input className={`w-full border border-slate-200 rounded-md p-2 text-sm focus:border-${themeColor}-500 focus:ring-1 focus:ring-${themeColor}-500 outline-none`} value={propForm.note} onChange={e=>setPropForm({...propForm, note:e.target.value})}/></div>
                      </div>
                    </div>
                )}

                {/* 共同圖片上傳 */}
                <div className={`p-4 rounded-xl border border-slate-200 bg-slate-50 mt-4`}>
                  <label className="block text-sm font-bold text-slate-700 mb-3">現場照片</label>
                  <div className="flex items-center gap-4">
                    {imagePreview ? (
                      <div className="relative w-24 h-24 flex-shrink-0 group">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl border-2 border-white shadow-md" />
                        <button type="button" onClick={() => setImagePreview('')} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1.5 shadow-sm hover:scale-110 transition-transform"><X className="w-3 h-3"/></button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-white border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 flex-shrink-0 shadow-sm">
                         {isCompressing ? <div className={`animate-spin w-6 h-6 border-2 border-${themeColor}-500 border-t-transparent rounded-full`}></div> : <><ImageIcon className="w-6 h-6 mb-1" /><span className="text-[10px]">無照片</span></>}
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-center gap-2">
                        <input type="file" accept="image/*" capture="environment" id="camera-upload" className="hidden" onChange={handleImageChange} disabled={isCompressing}/>
                        <label htmlFor="camera-upload" className={`cursor-pointer bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-100 shadow-sm text-sm font-bold transition-all active:scale-95 ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}><Camera className={`w-4 h-4 text-${themeColor}-600`} /> 開啟相機</label>

                        <input type="file" accept="image/*" id="file-upload" className="hidden" onChange={handleImageChange} disabled={isCompressing}/>
                        <label htmlFor="file-upload" className={`cursor-pointer bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-100 shadow-sm text-sm font-bold transition-all active:scale-95 ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}><Upload className={`w-4 h-4 text-${themeColor}-600`} /> 瀏覽圖庫</label>
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={isCompressing} className={`w-full text-white py-3.5 rounded-xl font-bold shadow-md mt-6 transition-colors disabled:opacity-50 ${SysConfig.colorClass} ${SysConfig.hoverClass}`}>
                    {isCompressing ? '圖片處理中...' : '儲存資料'}
                </button>
              </form>
            )}

            {isLab && modalType === 'category' && (
              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div><label className="text-sm font-bold text-slate-700 mb-1 block">分類名稱</label><input className="w-full border border-slate-200 rounded-lg p-2.5 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm" value={catForm.name} onChange={e=>setCatForm({...catForm, name:e.target.value})} required/></div>
                <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors shadow-md mt-4">儲存分類</button>
              </form>
            )}
           </div>
        </div>
      )}
    </div>
  );
}
