import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  signOut,
  signInWithCustomToken,
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
  limit,
  writeBatch,
  getDocs
} from 'firebase/firestore';
// 🔴 已移除 Firebase Storage 相關引用
import { 
  Beaker, ClipboardList, Settings, LogOut, Plus, Search, Trash2, Edit2, 
  Download, Filter, AlertTriangle, User, LayoutGrid, Menu, X, CheckCircle, 
  AlertCircle, Eye, EyeOff, ChevronRight, ChevronLeft, UserPlus, Calendar, FolderOpen,
  History, UserCheck, Phone, ArrowLeft, Clock, FileText, Hash, Home, 
  Activity, Box, FileDown, ArrowUpRight, ArrowDownLeft, MousePointerClick, Sparkles, MoreVertical, Timer, ShoppingCart, Minus, ArrowUpDown, Copy, Camera, Image as ImageIcon, Upload, CheckSquare
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
// 🔴 已移除 const storage = getStorage(app); 
const appId = 'lab-management-system-production';

// --- 常數設定 ---
const ITEMS_PER_PAGE = 6; // 每頁顯示 6 筆

// --- 🔵 工具函式：圖片壓縮轉 Base64 ---
// 這是為了確保圖片不會超過 Firestore 1MB 的限制
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // 設定最大寬度為 800px，高度等比例縮放
        const maxWidth = 800;
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

        // 轉成 JPEG 格式，品質設定為 0.6 (60%)
        // 這樣可以大幅減少體積，適合存入資料庫
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// --- 元件：自定義確認視窗 (一般/危險操作) ---
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isDangerous }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-6 text-center">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${isDangerous ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-600'}`}>
            {isDangerous ? <AlertTriangle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">取消</button>
            <button onClick={onConfirm} className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium shadow-md transition-colors ${isDangerous ? 'bg-red-500 hover:bg-red-600' : 'bg-teal-600 hover:bg-teal-700'}`}>確認</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- 元件：歸還數量確認視窗 ---
const ReturnModal = ({ isOpen, loan, onConfirm, onCancel }) => {
  const [returnQty, setReturnQty] = useState(1);

  useEffect(() => {
    if (loan) setReturnQty(loan.quantity);
  }, [loan]);

  if (!isOpen || !loan) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-6">
          <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-green-100 text-green-600">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1 text-center">歸還確認</h3>
          <p className="text-sm text-gray-500 mb-4 text-center">
            {loan.equipmentName}<br/>
            (目前借用: {loan.quantity})
          </p>
           
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2 text-center">本次歸還數量</label>
            <div className="flex items-center justify-center gap-3">
              <button 
                onClick={() => setReturnQty(Math.max(1, returnQty - 1))}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input 
                type="number" 
                className="w-20 text-center text-2xl font-bold border-b-2 border-slate-200 focus:border-green-500 outline-none pb-1"
                value={returnQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) setReturnQty(Math.max(1, Math.min(loan.quantity, val)));
                }}
              />
              <button 
                onClick={() => setReturnQty(Math.min(loan.quantity, returnQty + 1))}
                className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-center mt-2 text-xs text-slate-400">
              {returnQty === loan.quantity ? "全部歸還" : `部分歸還 (剩餘 ${loan.quantity - returnQty} 件)`}
            </div>
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

// --- 元件：加入清單成功提示彈窗 ---
const AddedToCartModal = ({ isOpen, item, onClose }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 1500); // 1.5秒後自動關閉
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
      <div className="bg-slate-800/90 backdrop-blur text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in zoom-in fade-in duration-200 transform scale-110">
        <div className="bg-teal-500 rounded-full p-2 text-white">
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
            <h4 className="font-bold text-lg">已加入借用清單</h4>
            <p className="text-sm text-slate-300">{item?.name} x 1</p>
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
      <button 
        onClick={() => onPageChange(currentPage - 1)} 
        disabled={currentPage === 1}
        className="p-2 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-30 hover:bg-teal-50 hover:text-teal-600 transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="text-sm font-bold text-slate-600">
        {currentPage} / {totalPages}
      </span>
      <button 
        onClick={() => onPageChange(currentPage + 1)} 
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-30 hover:bg-teal-50 hover:text-teal-600 transition-colors"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
};

// --- 元件：訊息提示 Toast ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 1000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed top-4 right-4 z-[70] animate-in slide-in-from-right duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${type === 'success' ? 'bg-white border-teal-100 text-teal-800' : 'bg-white border-red-100 text-red-800'}`}>
        {type === 'success' ? <CheckCircle className="w-5 h-5 text-teal-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
        <span className="font-medium text-sm">{message}</span>
      </div>
    </div>
  );
};

// --- 元件：儀表板卡片 ---
const StatCard = ({ title, value, subtext, icon: Icon, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between transition-all group relative overflow-hidden ${onClick ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 active:scale-95' : ''}`}
  >
    <div className="relative z-10">
      <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-1">
        {title}
        {onClick && <MousePointerClick className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity"/>}
      </p>
      <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
      {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-xl ${colorClass} shadow-sm group-hover:scale-110 transition-transform`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
  </div>
);

// --- 頁面：登入與註冊 ---
const AuthScreen = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const clearStaleAuth = async () => { try { await signOut(auth); } catch (e) {} };
    clearStaleAuth();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (isRegister) await createUserWithEmailAndPassword(auth, email, password);
      else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { 
      console.error(err);
      let msg = `登入失敗 (${err.code})`;
      if(err.code === 'auth/invalid-email') msg = "Email 格式不正確";
      if(err.code === 'auth/user-not-found') msg = "找不到此使用者，請先註冊";
      if(err.code === 'auth/wrong-password') msg = "密碼錯誤";
      if(err.code === 'auth/email-already-in-use') msg = "此 Email 已被註冊";
      if(err.code === 'auth/weak-password') msg = "密碼太弱（至少需 6 位）";
      if(err.code === 'auth/invalid-credential') msg = "帳號或密碼錯誤";
      setError(msg);
    } finally { setLoading(false); }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try { await signInAnonymously(auth); } 
    catch (err) { setError("訪客登入失敗 (請確認 Firebase 後台已啟用匿名登入)"); } 
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg"><Beaker className="w-8 h-8 text-white"/></div>
          <h1 className="text-2xl font-bold text-slate-800">實驗室設備管理系統</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:border-teal-500" required />
          <input type="password" placeholder="密碼 (至少6位)" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:border-teal-500" required />
          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0"/> {error}</div>}
          <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition-colors">{loading?'處理中...':(isRegister?'註冊帳號':'登入系統')}</button>
        </form>
        <button onClick={() => {setIsRegister(!isRegister); setError('')}} className="w-full mt-4 text-sm text-slate-500 hover:text-teal-600">切換為 {isRegister ? '登入' : '註冊'}</button>
        
      </div>
    </div>
  );
};

// --- 主應用程式 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Navigation State
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [currentSession, setCurrentSession] = useState(null); 

  // Data State
  const [sessions, setSessions] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loans, setLoans] = useState([]);
  
  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    latestSessionId: null,
    latestSessionName: '無資料',
    totalEquipment: 0,
    totalBorrowed: 0,
    lowStockCount: 0,
    groupedActivity: [] 
  });

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [sortOption, setSortOption] = useState('name');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [currentLoanPage, setCurrentLoanPage] = useState(1); // 🟢 新增：借還紀錄的分頁狀態

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: null });
  const [returnDialog, setReturnDialog] = useState({ isOpen: false, loan: null }); 
  const [addedItemModal, setAddedItemModal] = useState({ isOpen: false, item: null }); 
  
  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); 
  const [editItem, setEditItem] = useState(null);
  
  // Forms State
  const [sessionForm, setSessionForm] = useState({ name: '', date: '', copyFromPrevious: false });
  const [equipForm, setEquipForm] = useState({ name: '', quantity: 1, categoryId: '', note: '', imageUrl: '' });
  
  // 🔵 修改：移除了 equipImage 檔案物件 State，因為我們直接轉換成 Base64
  const [equipImagePreview, setEquipImagePreview] = useState(''); 
  const [isCompressing, setIsCompressing] = useState(false); // 新增：圖片處理中狀態
  
  const [catForm, setCatForm] = useState({ name: '' });
  const [cartItems, setCartItems] = useState([]);
  const [borrowForm, setBorrowForm] = useState({ 
    borrower: '', phone: '', date: new Date().toISOString().slice(0,10), purpose: '', borrowDays: 7 
  });

  // Init Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, u => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);

  // Reset Pagination when Filters Change
  useEffect(() => {
    setCurrentPage(1);
    setCurrentLoanPage(1);
  }, [searchTerm, selectedCategoryFilter, sortOption, viewMode, currentSession]);

  // Global Listeners
  useEffect(() => {
    if (!user) return;
    const unsubCat = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), snap => setCategories(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const qSession = query(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), orderBy('date', 'desc'));
    const unsubSess = onSnapshot(qSession, snap => setSessions(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    return () => { unsubCat(); unsubSess(); };
  }, [user]);

  // Dashboard Logic with GROUPING
  useEffect(() => {
    if (!user || viewMode !== 'dashboard') return;
    if (sessions.length === 0) {
        setDashboardStats({ latestSessionId: null, latestSessionName: '尚無版次', totalEquipment: 0, totalBorrowed: 0, lowStockCount: 0, groupedActivity: [] });
        return;
    }
    const latestSession = sessions[0];
    const targetSessionId = latestSession.id;

    const qEquip = query(collection(db, 'artifacts', appId, 'public', 'data', 'equipment'), where('sessionId', '==', targetSessionId));
    const unsubEquip = onSnapshot(qEquip, (snap) => {
      let equipCount = 0, borrowedCount = 0, lowStock = 0;
      snap.forEach(doc => {
        const data = doc.data();
        equipCount += (data.quantity || 0);
        borrowedCount += (data.borrowedCount || 0);
        if ((data.quantity - (data.borrowedCount || 0)) < 3) lowStock++;
      });
      setDashboardStats(prev => ({ ...prev, latestSessionId: targetSessionId, latestSessionName: latestSession.name, totalEquipment: equipCount, totalBorrowed: borrowedCount, lowStockCount: lowStock }));
    });

    const qLoans = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('sessionId', '==', targetSessionId));
    const unsubLoans = onSnapshot(qLoans, (snap) => {
      const rawEvents = [];
      snap.forEach(doc => {
        const data = doc.data();
        const loanId = doc.id;
        rawEvents.push({
          id: loanId + '_borrow',
          originalId: loanId,
          sessionId: data.sessionId,
          type: 'borrow',
          date: data.borrowDate, 
          borrower: data.borrower,
          equipmentName: data.equipmentName,
          quantity: data.quantity,
          timestamp: data.createdAt ? data.createdAt.seconds : 0
        });
        if (data.status === 'returned' && data.returnDate) {
          rawEvents.push({
            id: loanId + '_return',
            originalId: loanId,
            sessionId: data.sessionId,
            type: 'return',
            date: data.returnDate,
            borrower: data.borrower,
            equipmentName: data.equipmentName,
            quantity: data.quantity,
            timestamp: data.updatedAt ? data.updatedAt.seconds : Date.now()/1000
          });
        }
      });

      rawEvents.sort((a, b) => b.timestamp - a.timestamp);

      const grouped = [];
      rawEvents.forEach(event => {
        const group = grouped.find(g => 
          g.type === event.type && 
          g.borrower === event.borrower && 
          Math.abs(g.timestamp - event.timestamp) < 60 &&
          g.date === event.date
        );

        if (group) {
            group.items.push({ name: event.equipmentName, quantity: event.quantity, id: event.id });
        } else {
            grouped.push({
                ...event,
                items: [{ name: event.equipmentName, quantity: event.quantity, id: event.id }]
            });
        }
      });

      setDashboardStats(prev => ({ ...prev, groupedActivity: grouped.slice(0, 10) }));
    });
    return () => { unsubEquip(); unsubLoans(); };
  }, [user, viewMode, sessions]); 

  // Session Data
  useEffect(() => {
    if (!user || !currentSession) return;
    const qEquip = query(collection(db, 'artifacts', appId, 'public', 'data', 'equipment'), where('sessionId', '==', currentSession.id));
    const unsubEquip = onSnapshot(qEquip, snap => setEquipment(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    
    const qLoan = query(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), where('sessionId', '==', currentSession.id));
    const unsubLoans = onSnapshot(qLoan, snap => {
      const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
      list.sort((a, b) => (a.borrowDate > b.borrowDate ? -1 : 1));
      setLoans(list);
    });
    return () => { unsubEquip(); unsubLoans(); };
  }, [user, currentSession]);

  const showToast = (msg, type='success') => setToast({message: msg, type});
  const getAvailability = (item) => (item.quantity - (item.borrowedCount || 0));

  // Cart Helpers
  const addToCart = (item) => {
    const existing = cartItems.find(c => c.id === item.id);
    const available = getAvailability(item);
    if(available <= 0) { showToast("此設備已無庫存", "error"); return; }
    
    setAddedItemModal({ isOpen: true, item: item });

    if (existing) {
      if (existing.borrowQty < available) setCartItems(cartItems.map(c => c.id === item.id ? { ...c, borrowQty: c.borrowQty + 1 } : c));
      else showToast("已達最大可借數量", "error");
    } else {
      setCartItems([...cartItems, { ...item, borrowQty: 1, maxQty: available }]);
    }
  };

  const removeFromCart = (id) => {
    setCartItems(cartItems.filter(c => c.id !== id));
  };
  
  const updateCartQty = (id, delta) => {
    setCartItems(cartItems.map(c => {
      if(c.id === id) {
        const newQty = c.borrowQty + delta;
        if(newQty > 0 && newQty <= c.maxQty) return {...c, borrowQty: newQty};
      }
      return c;
    }));
  };

  const handleCartQtyInput = (id, val) => {
      const newQty = parseInt(val);
      setCartItems(cartItems.map(c => {
          if(c.id === id) {
              if(isNaN(newQty) || newQty < 1) return {...c, borrowQty: 1};
              if(newQty > c.maxQty) {
                  showToast(`庫存不足 (上限: ${c.maxQty})`, "error");
                  return {...c, borrowQty: c.maxQty};
              }
              return {...c, borrowQty: newQty};
          }
          return c;
      }));
  };

  // 🔵 修改：圖片處理邏輯 - 壓縮並轉 Base64
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setIsCompressing(true);
        // 使用壓縮工具函式
        const base64String = await compressImage(file);
        setEquipImagePreview(base64String);
        setIsCompressing(false);
      } catch (error) {
        console.error("Image processing error:", error);
        showToast("圖片處理失敗", "error");
        setIsCompressing(false);
      }
    }
  };

  const handleStatClick = (target) => {
    if (!dashboardStats.latestSessionId) { showToast("目前無資料", "error"); return; }
    const targetSession = sessions.find(s => s.id === dashboardStats.latestSessionId);
    if (targetSession) {
      setCurrentSession(targetSession);
      if (target === 'borrowed') setViewMode('loans');
      else setViewMode('equipment');
      showToast(`已進入最新版次：${targetSession.name}`);
    }
  };

  const handleActivityClick = (activity) => {
    const targetSession = sessions.find(s => s.id === activity.sessionId);
    if (targetSession) {
      setCurrentSession(targetSession);
      setViewMode('loans');
      showToast(`已跳轉至版次：${targetSession.name}`);
    }
  };

  const handleExportCSV = async (sessionToExport = currentSession) => {
    if (!sessionToExport) return;
    let itemsToExport = [];
    if (currentSession && sessionToExport.id === currentSession.id) {
        itemsToExport = equipment;
    } else {
        try {
            const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'equipment'), where('sessionId', '==', sessionToExport.id));
            const snapshot = await getDocs(q);
            itemsToExport = snapshot.docs.map(d => d.data());
        } catch (e) { showToast("匯出失敗", "error"); return; }
    }
    if (!itemsToExport.length) { showToast("此版次無資料可匯出", "error"); return; }
    
    const headers = ["設備名稱", "分類", "總數量", "已借出", "剩餘庫存", "備註"];
    const rows = itemsToExport.map(item => {
      const borrowed = item.borrowedCount || 0;
      const remaining = item.quantity - borrowed;
      return [`"${item.name.replace(/"/g, '""')}"`, `"${item.categoryName}"`, item.quantity, borrowed, remaining, `"${(item.note || "").replace(/"/g, '""')}"`].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sessionToExport.name}_設備清單.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV 下載已開始");
  };

  const handleSaveSession = async (e) => {
    e.preventDefault();
    try {
      const basePayload = {
        name: sessionForm.name,
        date: sessionForm.date,
        createdBy: user.uid
      };
      let newSessionRef;
      if (editItem) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', editItem.id), {
          ...basePayload,
          updatedAt: serverTimestamp()
        });
        showToast("版次已更新");
      } else {
        newSessionRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), {
          ...basePayload,
          createdAt: serverTimestamp()
        });
        if (sessionForm.copyFromPrevious && sessions.length > 0) {
              const latestSession = sessions[0];
              const qSource = query(collection(db, 'artifacts', appId, 'public', 'data', 'equipment'), where('sessionId', '==', latestSession.id));
              const sourceDocs = await getDocs(qSource);
              const batch = writeBatch(db);
              let count = 0;
              sourceDocs.forEach(docSnap => {
                  const data = docSnap.data();
                  const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'equipment'));
                  batch.set(newRef, {
                      ...data,
                      sessionId: newSessionRef.id,
                      borrowedCount: 0,
                      updatedAt: serverTimestamp(),
                      createdAt: serverTimestamp()
                  });
                  count++;
              });
              if (count > 0) await batch.commit();
              showToast(`已建立版次並複製 ${count} 項設備`);
        } else {
              showToast("版次建立成功");
        }
      }
      setIsModalOpen(false);
    } catch (err) { 
        console.error(err);
        showToast("錯誤", "error"); 
    }
  };
  
  const deleteSession = (id) => {
    setConfirmDialog({
      isOpen: true, title: "刪除版次", message: "確定要刪除此版次嗎？", isDangerous: true, action: async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', id)); setConfirmDialog(p => ({...p, isOpen: false})); showToast("版次已刪除"); }
    });
  };

  // 🔵 修改：handleSaveEquipment - 直接使用 Base64 字串儲存
  const handleSaveEquipment = async (e) => {
    e.preventDefault();
    if (!currentSession) return;
    
    // 如果在壓縮中，阻止儲存
    if (isCompressing) {
        showToast("圖片正在處理中，請稍候...", "error");
        return;
    }

    // 直接使用預覽圖 (Base64) 作為 imageUrl
    // 如果使用者沒有更換圖片，equipImagePreview 會是原本的 Base64 或舊的 URL
    let imageUrl = equipImagePreview || '';

    try {
      const cat = categories.find(c => c.id === equipForm.categoryId);
      const payload = {
        name: equipForm.name,
        quantity: parseInt(equipForm.quantity),
        categoryId: equipForm.categoryId,
        categoryName: cat ? cat.name : '未分類',
        note: equipForm.note,
        imageUrl: imageUrl, // 存入 Base64
        sessionId: currentSession.id,
        ...(editItem ? {} : { borrowedCount: 0 }), 
        updatedAt: serverTimestamp()
      };
      if (editItem) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', editItem.id), payload);
      else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'equipment'), payload);
      setIsModalOpen(false);
      showToast("設備儲存成功");
    } catch (err) { 
        console.error(err);
        showToast("錯誤 (可能圖片太大)", "error"); 
    }
  };

  const handleSaveCategory = async (e) => { e.preventDefault(); try { if (editItem) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', editItem.id), {name: catForm.name}); else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'categories'), {name: catForm.name}); setIsModalOpen(false); showToast("分類儲存成功"); } catch (err) { showToast("錯誤", "error"); } };
  const handleDeleteCategory = (id) => { setConfirmDialog({ isOpen: true, title: "刪除分類", message: "確定要刪除此分類嗎？", isDangerous: true, action: async () => { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'categories', id)); setConfirmDialog(p => ({...p, isOpen: false})); showToast("分類已刪除"); } }); };

  const handleBatchBorrow = async (e) => { 
    e.preventDefault(); if (!currentSession) return; 
    if (cartItems.length === 0) { showToast("請先選擇設備加入借用清單", "error"); return; }
    const days = parseInt(borrowForm.borrowDays);
    if (days <= 0) { showToast("借用天數錯誤", "error"); return; }
    try { 
      const promises = cartItems.map(async (item) => {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), { 
          sessionId: currentSession.id, equipmentId: item.id, equipmentName: item.name, borrower: borrowForm.borrower, phone: borrowForm.phone, purpose: borrowForm.purpose, quantity: item.borrowQty, borrowDays: days, borrowDate: borrowForm.date, returnDate: null, status: 'borrowed', createdAt: serverTimestamp(), updatedAt: serverTimestamp() 
        }); 
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', item.id), { borrowedCount: increment(item.borrowQty) }); 
      });
      await Promise.all(promises);
      setCartItems([]); setBorrowForm({ borrower: '', phone: '', date: new Date().toISOString().slice(0,10), purpose: '', borrowDays: 7 }); showToast(`成功借出 ${cartItems.length} 項設備`); setViewMode('loans'); 
    } catch (err) { showToast("借用失敗", "error"); } 
  };

  const initiateReturn = (loanId) => {
      const loan = loans.find(l => l.id === loanId);
      if (loan) setReturnDialog({ isOpen: true, loan });
  };

  const handleReturnConfirm = async (loanId, returnQty, originalQty) => {
    try {
        const loanDoc = loans.find(l => l.id === loanId);
        if (!loanDoc) return;
        
        const isFullReturn = returnQty >= originalQty;

        if (isFullReturn) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', loanId), { 
                returnDate: new Date().toISOString().split('T')[0], 
                status: 'returned', 
                updatedAt: serverTimestamp() 
            });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', loanDoc.equipmentId), { 
                borrowedCount: increment(-originalQty) 
            });
            showToast("全部歸還完成");
        } else {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'loans', loanId), {
                quantity: originalQty - returnQty,
                updatedAt: serverTimestamp()
            });
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'loans'), {
                ...loanDoc,
                quantity: returnQty,
                status: 'returned',
                returnDate: new Date().toISOString().split('T')[0],
                createdAt: serverTimestamp(), 
                updatedAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', loanDoc.equipmentId), {
                borrowedCount: increment(-returnQty)
            });
            showToast(`已歸還 ${returnQty} 個，剩餘 ${originalQty - returnQty} 個`);
        }
        setReturnDialog({ isOpen: false, loan: null });
    } catch (err) {
        console.error(err);
        showToast("操作失敗", "error");
    }
  };
  
  const filteredEquipment = useMemo(() => {
    const result = equipment.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategoryFilter === 'all' || item.categoryId === selectedCategoryFilter;
      return matchSearch && matchCat;
    });
    result.sort((a, b) => {
      switch (sortOption) {
        case 'quantity_desc': return b.quantity - a.quantity;
        case 'quantity_asc': return a.quantity - b.quantity;
        case 'created_desc': 
          const tA = a.updatedAt?.seconds || 0;
          const tB = b.updatedAt?.seconds || 0;
          return tB - tA;
        case 'name':
        default: return a.name.localeCompare(b.name, 'zh-Hant');
      }
    });
    return result;
  }, [equipment, searchTerm, selectedCategoryFilter, sortOption]);

  // 🟢 計算設備列表分頁
  const totalPages = Math.ceil(filteredEquipment.length / ITEMS_PER_PAGE);
  const paginatedEquipment = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEquipment.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredEquipment, currentPage]);

  // 🟢 計算借還紀錄分頁
  const totalLoanPages = Math.ceil(loans.length / ITEMS_PER_PAGE);
  const paginatedLoans = useMemo(() => {
    const startIndex = (currentLoanPage - 1) * ITEMS_PER_PAGE;
    return loans.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [loans, currentLoanPage]);

  const openSessionModal = (item=null) => { 
      setModalType('session'); 
      setEditItem(item); 
      setSessionForm({
          name: item ? item.name : '', 
          date: item ? item.date : new Date().toISOString().slice(0,10),
          copyFromPrevious: false 
      }); 
      setIsModalOpen(true); 
  };
  const openEquipModal = (item=null) => { 
      setModalType('equipment'); 
      setEditItem(item); 
      setEquipForm(item ? {name: item.name, quantity: item.quantity, categoryId: item.categoryId, note: item.note, imageUrl: item.imageUrl} : {name: '', quantity: 1, categoryId: categories[0]?.id || '', note: '', imageUrl: ''}); 
      // 直接設定 Base64 預覽
      setEquipImagePreview(item?.imageUrl || '');
      setIsModalOpen(true); 
  };
  const openBorrowModal = (item) => {
    const available = getAvailability(item);
    if (available <= 0) { showToast("無庫存可借", "error"); return; }
    setModalType('borrow');
    setBorrowForm({ borrower: '', phone: '', purpose: '', date: new Date().toISOString().slice(0,10), equipmentId: item.id, equipmentName: item.name, quantity: 1, maxQuantity: available });
    setIsModalOpen(true);
  };
  const getExpectedReturnDate = (dateStr, days) => { if(!dateStr || !days) return ''; const d = new Date(dateStr); d.setDate(d.getDate() + parseInt(days)); return d.toISOString().slice(0,10); };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-teal-600 font-medium">系統載入中...</div>;
  if (!user) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.action} onCancel={()=>setConfirmDialog(p=>({...p, isOpen:false}))} isDangerous={confirmDialog.isDangerous} />
      <ReturnModal isOpen={returnDialog.isOpen} loan={returnDialog.loan} onConfirm={handleReturnConfirm} onCancel={() => setReturnDialog({isOpen: false, loan: null})} />
      <AddedToCartModal isOpen={addedItemModal.isOpen} item={addedItemModal.item} onClose={() => setAddedItemModal({isOpen: false, item: null})} />
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)} />}

      {/* 🟢 [FIXED] Mobile Sidebar Overlay (z-40) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 🟢 [FIXED] Sidebar (z-50) */}
      <aside className={`fixed md:relative z-50 w-64 bg-teal-800 text-teal-50 h-screen transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col shadow-2xl`}>
        <div className="p-6 bg-teal-900/40">
          <h1 className="text-xl font-bold flex items-center"><Beaker/> 實驗室設備管理系統</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => { setViewMode('dashboard'); setCurrentSession(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'dashboard' ? 'bg-teal-600 text-white shadow-lg' : 'hover:bg-teal-700/50'}`}>
            <Home className="w-5 h-5" /> <span className="font-medium">首頁概覽</span>
          </button>
          <button onClick={() => { setViewMode('sessions'); setCurrentSession(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'sessions' ? 'bg-teal-600 text-white shadow-lg' : 'hover:bg-teal-700/50'}`}>
            <FolderOpen className="w-5 h-5" /> <span className="font-medium">版次/清單總覽</span>
          </button>
          <button onClick={() => { setViewMode('categories'); setCurrentSession(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'categories' ? 'bg-teal-600 text-white shadow-lg' : 'hover:bg-teal-700/50'}`}>
            <Settings className="w-5 h-5" /> <span className="font-medium">全域分類設定</span>
          </button>
          {currentSession && (
            <div className="mt-6 pt-6 border-t border-teal-700/50">
              <p className="px-4 text-xs font-bold text-teal-300 uppercase mb-2">當前版次：{currentSession.name}</p>
              <button onClick={() => { setViewMode('equipment'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'equipment' ? 'bg-teal-500 text-white shadow-lg' : 'hover:bg-teal-700/50'}`}>
                <LayoutGrid className="w-5 h-5" /> <span className="font-medium">設備列表</span>
              </button>
              <button onClick={() => { setViewMode('borrow-request'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'borrow-request' ? 'bg-teal-500 text-white shadow-lg' : 'hover:bg-teal-700/50'}`}>
                <ShoppingCart className="w-5 h-5" /> <span className="font-medium">借用登記</span>
              </button>
              <button onClick={() => { setViewMode('loans'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${viewMode === 'loans' ? 'bg-teal-500 text-white shadow-lg' : 'hover:bg-teal-700/50'}`}>
                <History className="w-5 h-5" /> <span className="font-medium">借還紀錄表</span>
              </button>
            </div>
          )}
        </nav>
        <div className="p-4 border-t border-teal-700">
           <button onClick={()=>signOut(auth)} className="flex items-center gap-2 text-sm text-red-200 hover:text-white"><LogOut className="w-4 h-4"/> 登出</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white shadow-sm p-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
             <button onClick={()=>setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2"><Menu/></button>
             <div>
                <div className="min-w-0 flex-1 pr-2">
                  <h2 className="text-lg md:text-2xl font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">
                    {viewMode === 'sessions' && '版次管理'}
                    {viewMode === 'categories' && '分類設定'}
                    {viewMode === 'dashboard' && '首頁概覽'}
                    {currentSession && viewMode === 'equipment' && `${currentSession.name} - 設備`}
                    {currentSession && viewMode === 'borrow-request' && `${currentSession.name} - 借用登記`}
                    {currentSession && viewMode === 'loans' && `${currentSession.name} - 借還紀錄`}
                  </h2>
                  {currentSession && viewMode !== 'dashboard' && viewMode !== 'sessions' && viewMode !== 'categories' && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                      <Clock className="w-3 h-3"/> 建立日期: {currentSession.date}
                    </p>
                  )}
                </div>
             </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {viewMode === 'equipment' && (
                <>
                <button onClick={()=>handleExportCSV()} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 md:px-4 rounded-lg flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all active:scale-95"><FileDown className="w-4 h-4 text-teal-600"/> <span className="hidden sm:inline">匯出 CSV</span></button>
                <button onClick={()=>openEquipModal()} className="bg-teal-600 text-white px-3 py-2 md:px-4 rounded-lg flex items-center gap-2 hover:bg-teal-700"><Plus className="w-4 h-4"/> <span className="hidden sm:inline">新增設備</span><span className="inline sm:hidden">新增</span></button>
                </>
            )}
            {viewMode === 'sessions' && <button onClick={()=>openSessionModal()} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-teal-700"><Plus className="w-4 h-4"/> 新增版次</button>}
            {viewMode === 'categories' && <button onClick={()=>{setModalType('category');setEditItem(null);setCatForm({name:''});setIsModalOpen(true)}} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-teal-700"><Plus className="w-4 h-4"/> 新增分類</button>}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
          
          {/* Dashboard View */}
          {viewMode === 'dashboard' && (
             <div className="space-y-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-2 mb-4"><div className="bg-teal-100 text-teal-700 p-2 rounded-lg"><Sparkles className="w-5 h-5"/></div><span className="text-sm font-bold text-slate-500">目前鎖定：<span className="text-teal-700 text-base">{dashboardStats.latestSessionName}</span></span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="最新版次設備總數" value={dashboardStats.totalEquipment} icon={Box} colorClass="bg-teal-500" onClick={() => handleStatClick('equipment')} />
                    <StatCard title="目前外借中" value={dashboardStats.totalBorrowed} icon={Activity} colorClass="bg-orange-500" onClick={() => handleStatClick('borrowed')} />
                    <StatCard title="低庫存警示" value={dashboardStats.lowStockCount} subtext="庫存低於 3 件" icon={AlertTriangle} colorClass="bg-red-500" onClick={() => handleStatClick('lowstock')} />
                    <StatCard title="管理中版次總數" value={sessions.length} icon={FolderOpen} colorClass="bg-blue-500" onClick={() =>setViewMode('sessions')} />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-teal-600"/> {dashboardStats.latestSessionName} - 最新借用動態</h3></div>
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
                                        {group.items.map((item, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs border border-slate-200">
                                                {item.name} <span className="font-bold text-slate-500">x{item.quantity}</span>
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                            ))}
                            {dashboardStats.groupedActivity.length===0 && <tr><td colSpan="4" className="p-6 text-center text-slate-400">本版次暫無近期活動</td></tr>}
                        </tbody>
                        </table>
                    </div>
                    </div>
                    <div className="bg-gradient-to-br from-teal-600 to-teal-800 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
                        <h3 className="font-bold text-lg mb-2 relative z-10">最新版次提示</h3>
                        <p className="text-teal-100 text-sm mb-6 relative z-10">系統目前自動鎖定在日期最新的版次「{dashboardStats.latestSessionName}」。儀表板上的數據僅反映此版次的內容。</p>
                        <button onClick={() => { setViewMode('sessions'); setCurrentSession(null); }} className="w-full bg-white/20 hover:bg-white/30 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 relative z-10 border border-white/20">查看所有版次 <ChevronRight className="w-4 h-4"/></button>
                    </div>
                </div>
             </div>
          )}
          
          {/* Sessions View */}
          {viewMode === 'sessions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {sessions.map(sess => (
                <div key={sess.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden transform hover:-translate-y-1">
                  <div onClick={() => { setCurrentSession(sess); setViewMode('equipment'); }} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-teal-50 rounded-lg text-teal-600"><Calendar className="w-6 h-6"/></div>
                      <span className="text-xs font-mono text-slate-400">{sess.date}</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{sess.name}</h3>
                    <p className="text-sm text-slate-500">點擊進入管理設備與借用</p>
                  </div>
                  <div className="bg-slate-50 px-6 py-3 border-t flex justify-between items-center">
                    <span className="text-xs text-slate-400">ID: {sess.id.slice(0,6)}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e)=>{e.stopPropagation(); handleExportCSV(sess);}} 
                        className="p-2 text-slate-400 hover:text-teal-600 transition-colors" 
                        title="匯出 CSV"
                      >
                        <FileDown className="w-4 h-4"/>
                      </button>
                      <button onClick={(e)=>{e.stopPropagation();openSessionModal(sess)}} className="p-2 text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={(e)=>{e.stopPropagation();deleteSession(sess.id)}} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && <div className="col-span-full text-center py-20 text-slate-400">尚未建立任何版次，請點擊右上角新增。</div>}
            </div>
          )}

          {/* 🟡 [PAGINATED] Equipment View */}
          {viewMode === 'equipment' && currentSession && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                  <input type="text" placeholder="搜尋設備名稱、備註..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500"/>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <select value={selectedCategoryFilter} onChange={e=>setSelectedCategoryFilter(e.target.value)} className="border rounded-lg px-4 py-2 outline-none bg-white min-w-[120px]">
                      <option value="all">所有分類</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select value={sortOption} onChange={e=>setSortOption(e.target.value)} className="border rounded-lg pl-10 pr-4 py-2 outline-none bg-white min-w-[140px]">
                            <option value="name">名稱排序</option>
                            <option value="quantity_desc">數量 (多→少)</option>
                            <option value="quantity_asc">數量 (少→多)</option>
                            <option value="created_desc">最新建立</option>
                        </select>
                    </div>
                </div>
              </div>

              {/* Mobile Card View (Paginated) */}
              <div className="block md:hidden">
                <div className="space-y-4">
                  {paginatedEquipment.map(item => {
                    const borrowed = item.borrowedCount || 0; 
                    const available = item.quantity - borrowed;
                    return (
                      <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex gap-3">
                        {item.imageUrl && (
                          <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-slate-100">
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-bold text-lg text-slate-800 truncate">{item.name}</h3>
                              <span className="inline-block bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded mt-1">{item.categoryName}</span>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={()=>openEquipModal(item)} className="p-2 text-slate-400 hover:text-teal-600"><Edit2 className="w-4 h-4"/></button>
                              <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', item.id))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm text-slate-600 mb-2">
                            <span>總: {item.quantity}</span>
                            <span className="text-orange-600">借: {borrowed}</span>
                            <span className={`font-bold ${available===0?'text-red-600':'text-green-600'}`}>剩: {available}</span>
                          </div>
                          <button 
                            onClick={()=>addToCart(item)} 
                            disabled={available <= 0}
                            className={`w-full py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 ${available <= 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
                          >
                            <Plus className="w-4 h-4"/> 加入借用
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredEquipment.length===0 && <div className="text-center py-10 text-slate-400">無資料</div>}
                </div>
                {/* Pagination Control */}
                <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>

              {/* Desktop Table View (Paginated) */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b text-sm uppercase text-slate-500 sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="p-4 font-semibold text-slate-600 w-16">圖片</th>
                      <th className="p-4 font-semibold w-1/4 bg-slate-50">設備名稱</th>
                      <th className="p-4 font-semibold w-1/3 bg-slate-50">庫存狀態 (總數 | 借出 | 剩餘)</th>
                      <th className="p-4 font-semibold bg-slate-50 whitespace-nowrap">分類</th>
                      <th className="p-4 font-semibold text-right bg-slate-50 sticky right-0">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEquipment.map(item => {
                      const borrowed = item.borrowedCount || 0;
                      const available = item.quantity - borrowed;
                      return (
                        <tr key={item.id} className="hover:bg-teal-50/30 transition-colors">
                          <td className="p-4">
                              {item.imageUrl ? (
                                  <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="block w-10 h-10 rounded overflow-hidden border border-slate-200 hover:scale-150 transition-transform origin-left">
                                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                  </a>
                              ) : (
                                  <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-300"><ImageIcon className="w-5 h-5"/></div>
                              )}
                          </td>
                          <td className="p-4 font-medium">{item.name} <span className="text-xs text-slate-400 block">{item.note}</span></td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded text-sm whitespace-nowrap">總 {item.quantity}</span>
                              <div className="h-4 w-px bg-slate-300"></div>
                              <span className="font-mono text-orange-600 bg-orange-50 px-2 py-1 rounded text-sm whitespace-nowrap">借 {borrowed}</span>
                              <div className="h-4 w-px bg-slate-300"></div>
                              <span className={`font-mono px-2 py-1 rounded text-sm font-bold whitespace-nowrap ${available === 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                剩 {available}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                            <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded">{item.categoryName}</span>
                          </td>
                          <td className="p-4 text-right sticky right-0 bg-white group-hover:bg-teal-50/30">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={()=>addToCart(item)} 
                                disabled={available <= 0}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap ${available <= 0 ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'}`}
                              >
                                <Plus className="w-3.5 h-3.5"/> {available <= 0 ? '缺貨' : '加入借用'}
                              </button>
                              <button onClick={()=>openEquipModal(item)} className="p-2 text-slate-400 hover:text-teal-600 bg-transparent hover:bg-teal-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                              <button onClick={()=>deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'equipment', item.id))} className="p-2 text-slate-400 hover:text-red-600 bg-transparent hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredEquipment.length === 0 && <tr><td colSpan="5" className="p-12 text-center text-slate-400">沒有找到相關設備</td></tr>}
                  </tbody>
                </table>
                {/* Pagination Control */}
                <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>
            </div>
          )}

          {/* 🟡 [PAGINATED] Borrow Request View */}
          {viewMode === 'borrow-request' && currentSession && (
             <div className="flex flex-col lg:flex-row gap-6 lg:h-full lg:overflow-hidden">
                <div className="flex-1 lg:w-7/12 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-[520px] lg:h-full lg:min-h-0">
                   <div className="p-4 border-b bg-slate-50 shrink-0">
                      <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Search className="w-4 h-4"/> 搜尋可用設備</h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                        <input type="text" placeholder="輸入名稱搜尋..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-teal-500"/>
                      </div>
                   </div>
                   <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {paginatedEquipment.map(item => {
                        const available = getAvailability(item);
                        if(available <= 0) return null; 
                        return (
                          <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-teal-300 transition-colors">
                             <div className="flex items-center gap-3">
                                {item.imageUrl && <img src={item.imageUrl} alt="" className="w-10 h-10 rounded object-cover border border-slate-200"/>}
                                <div>
                                   <div className="font-bold text-slate-700 break-words">{item.name}</div>
                                   <div className="text-xs text-slate-500">分類: {item.categoryName} | 庫存: <span className="text-teal-600 font-bold">{available}</span></div>
                                </div>
                             </div>
                             <button onClick={()=>addToCart(item)} className="bg-teal-600 text-white p-2 rounded-full hover:bg-teal-700 shadow-sm active:scale-95 flex-shrink-0"><Plus className="w-4 h-4"/></button>
                          </div>
                        );
                      })}
                      {filteredEquipment.filter(i => getAvailability(i) > 0).length === 0 && <div className="text-center p-10 text-slate-400">無可用設備</div>}
                   </div>
                   {/* Pagination Control */}
                   <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                </div>

                <div className="flex-1 lg:w-5/12 flex flex-col gap-4 lg:overflow-y-auto lg:h-full">
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 shrink-0">
                      <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-indigo-600"/> 借用清單 ({cartItems.length})</h3>
                      {cartItems.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-sm">
                          尚未選擇任何設備<br/>請從列表點擊 + 加入
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[250px] lg:max-h-[300px] overflow-y-auto pr-1">
                           {cartItems.map(item => (
                             <div key={item.id} className="flex items-center justify-between p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="flex-1 min-w-0 pr-2">
                                   <div className="font-bold text-indigo-900 truncate">{item.name}</div>
                                   <div className="text-xs text-indigo-600">上限: {item.maxQty}</div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                   <button onClick={()=>updateCartQty(item.id, -1)} className="p-1 bg-white rounded text-indigo-600 hover:bg-indigo-200"><Minus className="w-3 h-3"/></button>
                                   <input 
                                      type="number" 
                                      className="w-10 text-center border border-indigo-200 rounded text-sm py-0.5 focus:ring-1 focus:ring-indigo-500 outline-none"
                                      value={item.borrowQty}
                                      onChange={(e) => handleCartQtyInput(item.id, e.target.value)}
                                      min="1"
                                      max={item.maxQty}
                                   />
                                   <button onClick={()=>updateCartQty(item.id, 1)} className="p-1 bg-white rounded text-indigo-600 hover:bg-indigo-200"><Plus className="w-3 h-3"/></button>
                                   <button onClick={()=>removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-100 rounded ml-1"><X className="w-4 h-4"/></button>
                                </div>
                             </div>
                           ))}
                        </div>
                      )}
                   </div>
                   <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex-1 min-h-0 lg:overflow-y-auto">
                      <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><UserCheck className="w-5 h-5 text-indigo-600"/> 借用人資訊</h3>
                      <form onSubmit={handleBatchBorrow} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="text-xs font-bold text-slate-600 block mb-1">姓名</label><input className="w-full border rounded p-2 text-sm" value={borrowForm.borrower} onChange={e=>setBorrowForm({...borrowForm, borrower:e.target.value})} required/></div>
                          <div><label className="text-xs font-bold text-slate-600 block mb-1">電話</label><input type="tel" className="w-full border rounded p-2 text-sm" value={borrowForm.phone} onChange={e=>setBorrowForm({...borrowForm, phone:e.target.value})} required/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div><label className="text-xs font-bold text-slate-600 block mb-1">借用日期</label><input type="date" className="w-full border rounded p-2 text-sm" value={borrowForm.date} onChange={e=>setBorrowForm({...borrowForm, date:e.target.value})} required/></div>
                           <div>
                             <label className="text-xs font-bold text-slate-600 block mb-1">預計天數</label>
                             <div className="relative">
                               <input type="number" min="1" className="w-full border rounded p-2 pr-8 text-sm" value={borrowForm.borrowDays} onChange={e=>setBorrowForm({...borrowForm, borrowDays:e.target.value})} required/>
                               <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">天</span>
                             </div>
                           </div>
                        </div>
                        {borrowForm.date && borrowForm.borrowDays && (<div className="text-xs text-indigo-600 flex items-center gap-1 bg-indigo-50 p-2 rounded"><Timer className="w-3 h-3"/> 預計歸還：{getExpectedReturnDate(borrowForm.date, borrowForm.borrowDays)}</div>)}
                        <div><label className="text-xs font-bold text-slate-600 block mb-1">用途說明</label><textarea className="w-full border rounded p-2 h-16 resize-none text-sm" value={borrowForm.purpose} onChange={e=>setBorrowForm({...borrowForm, purpose:e.target.value})} required/></div>
                        
                        <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 mt-2">
                           確認借出 ({cartItems.length} 項物品)
                        </button>
                      </form>
                   </div>
                </div>
             </div>
          )}

          {/* 🟡 [PAGINATED] Loan History View - Mobile Cards & Desktop Table */}
          {viewMode === 'loans' && currentSession && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center sticky top-0 z-30 shadow-sm">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><History className="w-5 h-5"/> 借用與歸還紀錄</h3>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-bold">共 {loans.length} 筆</span>
              </div>

              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4">
                {paginatedLoans.map(loan => (
                  <div key={loan.id} className={`bg-white p-4 rounded-xl shadow-sm border ${loan.status === 'borrowed' ? 'border-orange-200' : 'border-green-200'}`}>
                    <div className="flex justify-between items-start mb-3 pb-3 border-b border-slate-100">
                      <div>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${loan.status === 'borrowed' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                          {loan.status === 'borrowed' ? '借用中' : '已歸還'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">{loan.borrowDate}</div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-sm font-bold text-slate-700">{loan.borrower}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3"/> {loan.phone}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-800 flex justify-between items-center">
                        {loan.equipmentName}
                        <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-600 shadow-sm">x{loan.quantity}</span>
                      </div>
                      {loan.purpose && (
                        <div className="text-xs text-slate-500 mt-1 px-1">
                          用途: {loan.purpose}
                        </div>
                      )}
                    </div>

                    {loan.status === 'borrowed' ? (
                      <button onClick={()=>initiateReturn(loan.id)} className="w-full py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4"/> 確認歸還
                      </button>
                    ) : (
                      <div className="text-center text-xs text-green-600 py-2 bg-green-50 rounded-lg">
                        歸還日期: {loan.returnDate}
                      </div>
                    )}
                  </div>
                ))}
                {paginatedLoans.length === 0 && <div className="text-center py-10 text-slate-400">無紀錄</div>}
                <PaginationControl currentPage={currentLoanPage} totalPages={totalLoanPages} onPageChange={setCurrentLoanPage} />
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[1000px]">
                    <thead className="bg-slate-50 border-b uppercase text-slate-500 text-xs sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="p-4 font-semibold w-24 bg-slate-50">狀態</th>
                        <th className="p-4 font-semibold w-48 bg-slate-50">借用人資訊</th>
                        <th className="p-4 font-semibold w-48 bg-slate-50">設備 (數量)</th>
                        <th className="p-4 font-semibold w-64 bg-slate-50">借用用途</th>
                        <th className="p-4 font-semibold w-32 bg-slate-50">借用日期</th>
                        <th className="p-4 font-semibold w-32 bg-slate-50">歸還日期</th>
                        <th className="p-4 font-semibold text-right w-32 bg-slate-50 sticky right-0">動作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedLoans.map(loan => (
                        <tr key={loan.id} className={loan.status === 'borrowed' ? 'bg-orange-50/30' : ''}>
                          <td className="p-4">
                            {loan.status === 'borrowed' 
                              ? <span className="text-orange-700 bg-orange-100 px-2.5 py-1 rounded-full text-xs font-bold border border-orange-200 whitespace-nowrap">借用中</span>
                              : <span className="text-green-700 bg-green-100 px-2.5 py-1 rounded-full text-xs font-bold border border-green-200 whitespace-nowrap">已歸還</span>
                            }
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-700">{loan.borrower}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/> {loan.phone}</div>
                          </td>
                          <td className="p-4 font-medium text-slate-800">
                            {loan.equipmentName} 
                            <span className="ml-2 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">x{loan.quantity}</span>
                          </td>
                          <td className="p-4 text-slate-600 max-w-xs truncate" title={loan.purpose}>
                            {loan.purpose || <span className="text-slate-300 italic">無</span>}
                          </td>
                          <td className="p-4 font-mono text-slate-500 whitespace-nowrap">{loan.borrowDate}</td>
                          <td className="p-4 font-mono text-slate-500 whitespace-nowrap">{loan.returnDate || '-'}</td>
                          <td className="p-4 text-right sticky right-0 bg-white (loan.status === 'borrowed' ? 'bg-orange-50/30' : '')">
                            {loan.status === 'borrowed' && (
                              <button onClick={()=>initiateReturn(loan.id)} className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 whitespace-nowrap flex items-center gap-1 ml-auto">
                                <CheckCircle className="w-3 h-3"/> 確認歸還
                              </button>
                            )}
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

          {/* Categories View */}
          {viewMode === 'categories' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
               {categories.map(c => (
                 <div key={c.id} className="bg-white px-4 py-3 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between gap-2 hover:border-teal-400 transition-colors">
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <div className="w-6 h-6 rounded-md bg-teal-50 flex-shrink-0 flex items-center justify-center text-teal-600">
                      <Hash className="w-3.5 h-3.5"/>
                    </div>
                    <span className="font-bold text-slate-700 text-sm break-words leading-tight">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={(e)=>{e.stopPropagation(); setModalType('category');setEditItem(c);setCatForm({name:c.name});setIsModalOpen(true)}} className="p-1.5 text-slate-400 hover:text-teal-600 rounded-md hover:bg-teal-50 transition-colors"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={(e)=>{e.stopPropagation(); handleDeleteCategory(c.id)}} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4"/></button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between mb-6 border-b pb-3">
              <h3 className="text-xl font-bold text-slate-800">
                {modalType === 'session' && (editItem ? '編輯版次' : '新增版次')}
                {modalType === 'equipment' && (editItem ? '編輯設備' : '新增設備')}
                {modalType === 'category' && (editItem ? '編輯分類' : '新增分類')}
                {modalType === 'borrow' && '借用登記'}
              </h3>
              <button onClick={()=>setIsModalOpen(false)}><X className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            
            {/* Session Form */}
            {modalType === 'session' && (
              <form onSubmit={handleSaveSession} className="space-y-4">
                <div><label className="text-sm font-bold text-slate-700 mb-1 block">版次名稱</label><input className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" value={sessionForm.name} onChange={e=>setSessionForm({...sessionForm, name:e.target.value})} placeholder="例如: 2023 上學期" required/></div>
                <div><label className="text-sm font-bold text-slate-700 mb-1 block">日期</label><input type="date" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" value={sessionForm.date} onChange={e=>setSessionForm({...sessionForm, date:e.target.value})} required/></div>
                
                {!editItem && sessions.length > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-teal-50 rounded border border-teal-100">
                    <input type="checkbox" id="copyFromPrevious" className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500" checked={sessionForm.copyFromPrevious} onChange={e=>setSessionForm({...sessionForm, copyFromPrevious:e.target.checked})}/>
                    <label htmlFor="copyFromPrevious" className="text-sm text-teal-800 cursor-pointer select-none"><span className="font-bold">複製上一個版次的設備資料?</span><br/><span className="text-xs text-teal-600">(將複製名稱、分類、總數，但借出數會歸零)</span></label>
                  </div>
                )}

                <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors">儲存</button>
              </form>
            )}

            {/* Equipment Form with Image Upload */}
            {modalType === 'equipment' && (
              <form onSubmit={handleSaveEquipment} className="space-y-4">
                <div><label className="text-sm font-bold text-slate-700 mb-1 block">名稱</label><input className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" value={equipForm.name} onChange={e=>setEquipForm({...equipForm, name:e.target.value})} required/></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-sm font-bold text-slate-700 mb-1 block">數量</label><input type="number" className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" value={equipForm.quantity} onChange={e=>setEquipForm({...equipForm, quantity:e.target.value})} required/></div>
                  <div><label className="text-sm font-bold text-slate-700 mb-1 block">分類</label><select className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none bg-white" value={equipForm.categoryId} onChange={e=>setEquipForm({...equipForm, categoryId:e.target.value})} required><option value="" disabled>選擇分類</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
                
                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">設備照片</label>
                  <div className="flex items-center gap-4">
                    {equipImagePreview ? (
                      <div className="relative w-24 h-24">
                        <img src={equipImagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg border" />
                        <button type="button" onClick={() => setEquipImagePreview('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3"/></button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center text-slate-400">
                         {isCompressing ? <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full"></div> : <ImageIcon className="w-8 h-8" />}
                      </div>
                    )}
                    <div className="flex-1 flex flex-col gap-2">
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" // Camera
                          id="equip-camera-upload"
                          className="hidden"
                          onChange={handleImageChange}
                          disabled={isCompressing}
                        />
                        <label htmlFor="equip-camera-upload" className={`cursor-pointer bg-teal-50 border border-teal-200 text-teal-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-teal-100 w-full shadow-sm font-medium transition-colors ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <Camera className="w-4 h-4" /> 拍攝照片
                        </label>

                        <input 
                          type="file" 
                          accept="image/*" 
                          // No capture attribute -> File Picker
                          id="equip-file-upload"
                          className="hidden"
                          onChange={handleImageChange}
                          disabled={isCompressing}
                        />
                        <label htmlFor="equip-file-upload" className={`cursor-pointer bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-50 w-full shadow-sm font-medium transition-colors ${isCompressing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <Upload className="w-4 h-4" /> 上傳檔案
                        </label>
                    </div>
                  </div>
                  {isCompressing && <p className="text-xs text-teal-600 mt-1">正在壓縮圖片中...</p>}
                </div>

                <div><label className="text-sm font-bold text-slate-700 mb-1 block">備註</label><input className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" value={equipForm.note} onChange={e=>setEquipForm({...equipForm, note:e.target.value})}/></div>
                <button type="submit" disabled={isCompressing} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors disabled:opacity-50">
                    {isCompressing ? '圖片處理中...' : '儲存'}
                </button>
              </form>
            )}

            {modalType === 'category' && (
              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div><label className="text-sm font-bold text-slate-700 mb-1 block">分類名稱</label><input className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-teal-500 outline-none" value={catForm.name} onChange={e=>setCatForm({...catForm, name:e.target.value})} required/></div>
                <button type="submit" className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors">儲存</button>
              </form>
            )}
           </div>
        </div>
      )}
    </div>
  );
}
