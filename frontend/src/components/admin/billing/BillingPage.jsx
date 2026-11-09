import { getApiUrl, getSuperadminApiUrl } from "../../../config.js";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MenuGrid from '../catalog/MenuGrid';
import BillSummary from './BillSummary';
import PaymentModal from './PaymentModal';
import PaymentSuccessScreen from './PaymentSuccessScreen';
import Toast from '../system/Toast';
import { getActiveOrder, saveOrder, generateBill, settleBill, apiReopenOrder, apiCancelOrder, getOpenOrders, getDailyStats } from '../../../api/billing/billing';
import { sendWhatsAppBill, getWhatsAppStatus } from '../../../api/communication/whatsapp';
import api from '../../../api/system/axios';
import { getCachedOpenOrders, upsertCachedOpenOrder, removeCachedOpenOrder } from '../../../db/offlineDb';
import { Search, UtensilsCrossed, Maximize, Minimize, TrendingUp, ShoppingBag, LayoutGrid, Menu, ChevronLeft, ChevronRight, ChevronDown, Lock, Unlock, X, User, UserPlus, Phone, Loader2, Plus, Check,Printer } from 'lucide-react';
import useDebounce from '../../../hooks/useDebounce';
import Invoice from './Invoice';
import { getBillTotalWeightKg, resolveItemQtyAndRate } from './BillHistory';
import CancelOrderModal from './CancelOrderModal';
import { useLanguage } from '../../../context/LanguageContext';
import realtimeService from '../../../services/realtimeService';
import html2canvas from 'html2canvas';
import { QRCodeSVG } from 'qrcode.react';
// Pre-load canvas-confetti so it's ready instantly when payment succeeds (no cold-start lag)
import 'canvas-confetti';
import BackButton from '../common/BackButton';

// Animated count-up component for Sales Badge
const AnimatedSalesCount = ({ value, duration = 1500 }) => {
  const targetValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = targetValue;

    if (endValue === 0) {
      setDisplayValue(0);
      prevValueRef.current = 0;
      return;
    }

    if (startValue === endValue && displayValue === endValue) {
      return;
    }

    let animationFrameId;
    const startTime = performance.now();

    const updateCount = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      // Smooth ease-out cubic motion curve
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentNumber = Math.round(startValue + (endValue - startValue) * easeProgress);

      setDisplayValue(currentNumber);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrameId);
  }, [targetValue, duration]);

  return (
    <span className="text-xs font-black text-emerald-950 font-mono leading-tight">
      ₹{displayValue.toLocaleString()}
    </span>
  );
};

// Helper to match tables bidirectionally (e.g. "Ground Floor - Table 8" vs "Table 8" vs "T8", "Ground Floor - H-1" vs "H-1")
const isTableMatching = (tableA, tableB) => {
  if (!tableA || !tableB) return false;
  const cleanA = tableA.trim().replace(/\s+/g, ' ').toLowerCase();
  const cleanB = tableB.trim().replace(/\s+/g, ' ').toLowerCase();
  if (cleanA === cleanB) return true;

  const hasFloorA = cleanA.includes(' - ');
  const hasFloorB = cleanB.includes(' - ');

  // 1. If BOTH have a floor prefix, the floors MUST match!
  if (hasFloorA && hasFloorB) {
    const floorA = cleanA.split(' - ')[0].trim();
    const floorB = cleanB.split(' - ')[0].trim();
    if (floorA !== floorB) {
      return false; // Different floors (e.g. Ground Floor vs First Floor)
    }
  }

  // 2. Extract space parts
  const spaceA = hasFloorA ? cleanA.split(' - ').slice(1).join(' - ').trim() : cleanA;
  const spaceB = hasFloorB ? cleanB.split(' - ').slice(1).join(' - ').trim() : cleanB;

  if (spaceA === spaceB) return true;

  // 3. Compare alphanumeric normalization (e.g. "H-1" <-> "h1", "T-8" <-> "t8", "#008" <-> "008")
  const normA = spaceA.replace(/[^a-z0-9]/g, '');
  const normB = spaceB.replace(/[^a-z0-9]/g, '');
  if (normA && normB) {
    if (normA === normB) return true;
    const intA = parseInt(normA, 10);
    const intB = parseInt(normB, 10);
    if (!isNaN(intA) && !isNaN(intB) && intA === intB && String(intA) === normA.replace(/^0+/, '') && String(intB) === normB.replace(/^0+/, '')) {
      return true;
    }
  }

  // Support prefix like TAK-008 / DEL-008 matching #008 or 008
  const takDelMatchA = spaceA.match(/^(tak|del)[-\s]?0*(\d+)$/i);
  const numOnlyMatchB = spaceB.match(/^#?0*(\d+)$/);
  if (takDelMatchA && numOnlyMatchB && parseInt(takDelMatchA[2], 10) === parseInt(numOnlyMatchB[1], 10)) return true;
  const takDelMatchB = spaceB.match(/^(tak|del)[-\s]?0*(\d+)$/i);
  const numOnlyMatchA = spaceA.match(/^#?0*(\d+)$/);
  if (takDelMatchB && numOnlyMatchA && parseInt(takDelMatchB[2], 10) === parseInt(numOnlyMatchA[1], 10)) return true;

  // 4. Standard space types (table, cabin, sofa, room, bar)
  const stdMatchA = spaceA.match(/^(table|cabin|sofa|room|bar)\s*0*(\d+)$/i);
  const stdMatchB = spaceB.match(/^(table|cabin|sofa|room|bar)\s*0*(\d+)$/i);

  if (stdMatchA && stdMatchB) {
    const typeA = stdMatchA[1];
    const typeB = stdMatchB[1];
    const numA = parseInt(stdMatchA[2], 10);
    const numB = parseInt(stdMatchB[2], 10);
    return typeA === typeB && numA === numB;
  }

  // 5. Short code vs Full standard type (e.g. "t1" vs "table 1", "c2" vs "cabin 2")
  if (stdMatchA && !stdMatchB) {
    const letterA = stdMatchA[1].charAt(0);
    const numA = parseInt(stdMatchA[2], 10);
    const shortB = spaceB.match(/^([a-z]+)-?0*(\d+)$/);
    if (shortB && shortB[1] === letterA && parseInt(shortB[2], 10) === numA) return true;
  } else if (!stdMatchA && stdMatchB) {
    const letterB = stdMatchB[1].charAt(0);
    const numB = parseInt(stdMatchB[2], 10);
    const shortA = spaceA.match(/^([a-z]+)-?0*(\d+)$/);
    if (shortA && shortA[1] === letterB && parseInt(shortA[2], 10) === numB) return true;
  }

  return false;
};

const removeClearedTableRecord = (table) => {
  if (!table) return;
  try {
    const clearedMap = JSON.parse(localStorage.getItem('msbillings_cleared_tables') || '{}');
    delete clearedMap[table.trim().toLowerCase()];
    if (table.includes(' - ')) {
      const shortName = table.split(' - ').pop().trim().toLowerCase();
      delete clearedMap[shortName];
    }
    localStorage.setItem('msbillings_cleared_tables', JSON.stringify(clearedMap));
    window.dispatchEvent(new CustomEvent('tableOccupied', { detail: { tableNo: table } }));
  } catch (e) { }
};

// Global persistent set of newly generated tables across renders/re-mounts
const GENERATED_NEW_TABLES = new Set();

const BillingPage = ({ initialTable, initialAction, initialFishMode = 'individual', onOrderUpdate, onNavigate, onGoBack, userRole = 'Admin' }) => {
  const { t } = useLanguage();
  const isExplicitNew = (initialAction === 'new' || initialTable === 'NEW_ORDER' || (!initialTable && typeof window !== 'undefined' && sessionStorage.getItem('ms_initial_action') === 'new')) && initialAction !== 'open';
  const effectiveInitialTable = isExplicitNew ? '' : (initialTable || '');
  const [activeTable, setActiveTable] = useState(effectiveInitialTable);
  const [floors, setFloors] = useState([]);
  const [openOrdersList, setOpenOrdersList] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [isLayoutLocked, setIsLayoutLocked] = useState(() => {
    try {
      return localStorage.getItem('ms_billing_layout_locked') === 'true';
    } catch {
      return false;
    }
  });

  const [directPrintConfigs, setDirectPrintConfigs] = useState({
    kot: localStorage.getItem('msbillings_direct_kot') === 'true',
    save: localStorage.getItem('msbillings_direct_save') === 'true',
    settle: localStorage.getItem('msbillings_direct_settle') === 'true'
  });

  useEffect(() => {
    const handlePrintConfigChange = () => {
      setDirectPrintConfigs({
        kot: localStorage.getItem('msbillings_direct_kot') === 'true',
        save: localStorage.getItem('msbillings_direct_save') === 'true',
        settle: localStorage.getItem('msbillings_direct_settle') === 'true'
      });
    };
    window.addEventListener('printConfigChanged', handlePrintConfigChange);
    return () => window.removeEventListener('printConfigChanged', handlePrintConfigChange);
  }, []);

  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    try {
      const saved = localStorage.getItem('ms_billing_right_panel_width');
      return saved ? Number(saved) : 400;
    } catch {
      return 400;
    }
  });
  const isResizing = useRef(false);

  const toggleLayoutLock = () => {
    setIsLayoutLocked(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ms_billing_layout_locked', String(next));
      } catch (e) { }
      return next;
    });
  };

  const startResizing = useCallback((e) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    }
  }, []);

  const resize = useCallback((e) => {
    if (isResizing.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setRightPanelWidth(newWidth);
        try {
          localStorage.setItem('ms_billing_right_panel_width', String(newWidth));
        } catch (err) { }
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  // Refs to track modal state inside intervals without causing effect re-runs
  const showInvoiceRef = useRef(false);
  const showPaymentRef = useRef(false);

  useEffect(() => {
    // Instant cache load (0ms delay)
    getCachedOpenOrders().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setOpenOrdersList(cached);
      }
    }).catch(() => { });

    fetchOpenOrdersList();

    // Listen for real-time events via singleton RealtimeService
    const handleRealtimeUpdate = (data) => {
      fetchOpenOrdersList();
      if (data && data.tableNo) {
        window.dispatchEvent(new CustomEvent('remoteOrderUpdated', { detail: data }));
      } else {
        window.dispatchEvent(new CustomEvent('remoteOrderUpdated', { detail: {} }));
      }
    };

    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', handleRealtimeUpdate);
    const unsubCancellationResolved = realtimeService.subscribe('cancellationResolved', handleRealtimeUpdate);
    const unsubBillSettled = realtimeService.subscribe('billSettled', fetchOpenOrdersList);

    const handleOfflineSave = (e) => {
      showToast(`${e.detail?.message || 'Order saved offline. Will sync when backend reconnects.'}`, 'error');
    };
    window.addEventListener('offlineOrderSaved', handleOfflineSave);

    return () => {
      unsubOrderUpdated();
      unsubCancellationResolved();
      unsubBillSettled();
      window.removeEventListener('offlineOrderSaved', handleOfflineSave);
    };
  }, []);

  async function fetchOpenOrdersList() {
    try {
      const data = await getOpenOrders();
      setOpenOrdersList(data || []);
    } catch (error) {
      console.error('Error fetching open orders list:', error);
    }
  }

  async function fetchReservations() {
    // Fish store operates counter & direct wholesale/retail sales - no table reservations needed
    setReservations([]);
  }

  useEffect(() => {
    const loadSpaces = () => {
      const savedSpaces = localStorage.getItem('msbillings_spaces');
      if (savedSpaces) {
        try {
          let parsed = JSON.parse(savedSpaces);
          if (!Array.isArray(parsed)) {
            parsed = [{
              id: 'f-default',
              name: 'Ground Floor',
              tables: parsed.tables || [],
              cabins: parsed.cabins || [],
              sofas: parsed.sofas || []
            }];
          }
          setFloors(parsed);
          return;
        } catch (error) { console.error('Error loading spaces:', error); }
      }
      setFloors([{
        id: 'f-1',
        name: 'Ground Floor',
        tables: [{ id: 't1', name: 'Table 1' }, { id: 't2', name: 'Table 2' }, { id: 't3', name: 'Table 3' }],
        cabins: [{ id: 'c1', name: 'Cabin 1' }, { id: 'c2', name: 'Cabin 2' }],
        sofas: [{ id: 's1', name: 'Sofa 1' }]
      }]);
    };

    loadSpaces();

    const syncSpacesFromBackend = async () => {
      try {
        const res = await api.get('/config/info');
        if (res.data) {
          const data = res.data;
          if (data.spaces && Array.isArray(data.spaces) && data.spaces.length > 0) {
            localStorage.setItem('msbillings_spaces', JSON.stringify(data.spaces));
            setFloors(data.spaces);
          }
        }
      } catch (error) {
        // Silently use cached or default spaces without throwing console errors
      }
    };
    syncSpacesFromBackend();

    window.addEventListener('spacesUpdated', loadSpaces);
    return () => window.removeEventListener('spacesUpdated', loadSpaces);
  }, []);

  const [cart, setCart] = useState([]);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' or 'cart'
  const [orderId, setOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState('Open'); // Open, Billed, Paid
  const [billNumber, setBillNumber] = useState(null);

  const getDynamicTaxRateFromSettings = () => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      let tot = 0;
      if (s.enableCgst) tot += Number(s.cgstRate || 0);
      if (s.enableSgst) tot += Number(s.sgstRate || 0);
      if (s.enableGst) tot += Number(s.gstRate || 0);
      return tot;
    } catch (e) {
      return 0;
    }
  };

  const [billType, setBillType] = useState(() => {
    if (effectiveInitialTable.startsWith('DEL-')) return 'Delivery';
    if (effectiveInitialTable.startsWith('TAK-')) return 'Takeaway';
    if (effectiveInitialTable) return 'Dine-In';
    return 'Takeaway';
  });
  const [taxRate, setTaxRate] = useState(() => {
    const tot = getDynamicTaxRateFromSettings();
    return tot > 0 ? tot : '';
  });

  useEffect(() => {
    const handleSettingsUpdate = () => {
      const tot = getDynamicTaxRateFromSettings();
      setTaxRate(tot > 0 ? tot : '');
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, []);

  const [discount, setDiscount] = useState({ type: 'percentage', value: '' });
  const [walletRedemption, setWalletRedemption] = useState(0);

  // Delivery / CRM fields
  const [orderSource, setOrderSource] = useState('Direct');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerInfo, setCustomerInfo] = useState(null);
  const [customerCategory, setCustomerCategory] = useState('Retail');
  const [exportSubCategory, setExportSubCategory] = useState(null);
  const [customerPhoto, setCustomerPhoto] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isOrderLocked, setIsOrderLocked] = useState(false);
  const [lockedTimestamp, setLockedTimestamp] = useState('');

  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [containerCharge, setContainerCharge] = useState('0');
  const [cuttingCharge, setCuttingCharge] = useState('0');
  const [isCuttingChargeEnabled, setIsCuttingChargeEnabled] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      return s.enableCuttingCharges === true;
    } catch { return false; }
  });

  const [showPayment, setShowPayment] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showKOT, setShowKOT] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [activeKOTData, setActiveKOTData] = useState(null);
  const [completedBill, setCompletedBill] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [tempCustomerPhone, setTempCustomerPhone] = useState('');
  const [tempCustomerName, setTempCustomerName] = useState('');
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmCustomerFound, setCrmCustomerFound] = useState(null);
  const [crmSuggestions, setCrmSuggestions] = useState([]);
  const [showCrmSuggestions, setShowCrmSuggestions] = useState(false);

  const searchInputRef = useRef(null);
  const isViewingInvoiceRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem('ms_invoice_open');
      sessionStorage.removeItem('ms_completed_bill');
    } catch (e) { }
  }, []);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [fishOrderMode, setFishOrderMode] = useState(initialFishMode || 'individual'); // 'individual' (retail) | 'bulk' (wholesale) | 'export' (export bulk)
  const [foodTypeFilter, setFoodTypeFilter] = useState('all'); // legacy compatibility
  const [sweetModeFilter, setSweetModeFilter] = useState('all');
  const [menuFilterCounts, setMenuFilterCounts] = useState({ all: 0, veg: 0, nonVeg: 0, sweet: 0 }); // live counts from MenuGrid
  const [dailyStats, setDailyStats] = useState(() => {
    try {
      const cached = localStorage.getItem('ms_daily_stats_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (parsed && parsed.date === todayStr && parsed.stats && typeof parsed.stats.sales === 'number') {
          return parsed.stats;
        }
      }
    } catch (e) { }
    return { sales: 0, orders: 0 };
  });
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCartCollapsed, setIsCartCollapsed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // 'save' | 'hold' | 'print' | 'kot' | 'edit' | 'cancel' | 'settle'
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [successPaymentData, setSuccessPaymentData] = useState(null); // { paymentData, billData }
  const [offscreenBill, setOffscreenBill] = useState(null);

  // Customized Responsive Order Dropdown State & Click-Outside
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const orderDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(e.target)) {
        setIsOrderDropdownOpen(false);
      }
    };
    if (isOrderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOrderDropdownOpen]);

  // Mode-based active orders filter (Retail vs Wholesale vs Export)
  const modeFilteredOrders = useMemo(() => {
    return (openOrdersList || []).filter(o => {
      if (!o) return false;
      const tNo = String(o.tableNo || '');
      const isExp = o.customerCategory === 'Export' || o.orderMode === 'export' || tNo.startsWith('EXP-');
      const isWs = !isExp && (
        o.customerCategory === 'Wholesale' ||
        o.orderMode === 'bulk' ||
        tNo.startsWith('WS-') ||
        Number(o.totalBoxes || 0) > 0 ||
        (Array.isArray(o.boxes) && o.boxes.length > 0)
      );

      if (fishOrderMode === 'export') return isExp;
      if (fishOrderMode === 'bulk') return isWs;
      // Default: Retail mode (only show Retail orders, strictly no WS or EXP)
      return !isExp && !isWs;
    });
  }, [openOrdersList, fishOrderMode]);

  const currentModeTitle = useMemo(() => {
    if (fishOrderMode === 'export') return 'Export';
    if (fishOrderMode === 'bulk') return 'Wholesale';
    return 'Retail';
  }, [fishOrderMode]);

  // ─── WhatsApp Auto-Send Toggle & Status ──────────────────────────────────────
  // Mode-specific WhatsApp Auto-Send getter for Retail, Wholesale, and Export
  const getAutoWaForCurrentMode = useCallback((mode) => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      if (mode === 'export') {
        if (s.autoWhatsappExport !== undefined) return s.autoWhatsappExport === true;
        const local = localStorage.getItem('ms_auto_wa_export');
        return local !== null ? local === '1' : false;
      } else if (mode === 'bulk') {
        if (s.autoWhatsappWholesale !== undefined) return s.autoWhatsappWholesale === true;
        const local = localStorage.getItem('ms_auto_wa_wholesale');
        return local !== null ? local === '1' : false;
      } else {
        if (s.autoWhatsappRetail !== undefined) return s.autoWhatsappRetail === true;
        const local = localStorage.getItem('ms_auto_wa_retail');
        if (local !== null) return local === '1';
        const legacy = localStorage.getItem('ms_auto_wa');
        return legacy !== null ? legacy === '1' : false;
      }
    } catch {
      return false;
    }
  }, []);

  // Toggle persisted across sessions in localStorage so it stays active
  const [autoWhatsappEnabled, setAutoWhatsappEnabled] = useState(() => {
    return getAutoWaForCurrentMode(initialFishMode || 'individual');
  });

  // Sync mode-specific auto-whatsapp setting whenever mode changes or settings updated
  useEffect(() => {
    setAutoWhatsappEnabled(getAutoWaForCurrentMode(fishOrderMode));
    const handleStorageChange = () => {
      setAutoWhatsappEnabled(getAutoWaForCurrentMode(fishOrderMode));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fishOrderMode, getAutoWaForCurrentMode]);
  // Tracks bill IDs already sent via WhatsApp to prevent duplicate sends
  const whatsappBillSentIds = useRef(new Set());
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState(false);
  const [autoSendWhatsAppToInvoice, setAutoSendWhatsAppToInvoice] = useState(false);

  const checkWhatsAppConnection = useCallback(async () => {
    try {
      const res = await getWhatsAppStatus();
      const connected = Boolean(res && (res.status === 'CONNECTED' || res.connectedNumber));
      setIsWhatsAppConnected(connected);
    } catch {
      setIsWhatsAppConnected(false);
    }
  }, []);

  useEffect(() => {
    checkWhatsAppConnection();
    const interval = setInterval(checkWhatsAppConnection, 20000);
    return () => clearInterval(interval);
  }, [checkWhatsAppConnection]);

  const isBillAlreadySent = (id) => {
    if (!id) return false;
    try {
      if (whatsappBillSentIds.current.has(id)) return true;
      if (sessionStorage.getItem(`ms_wa_sent_${id}`) === 'true') return true;
    } catch { }
    return false;
  };

  const markBillAlreadySent = (id) => {
    if (!id) return;
    try {
      whatsappBillSentIds.current.add(id);
      sessionStorage.setItem(`ms_wa_sent_${id}`, 'true');
    } catch { }
  };

  const buildWhatsAppBillText = (bill, s = {}) => {
    const userObj = JSON.parse(localStorage.getItem('user') || localStorage.getItem('ynr_user') || '{}');
    const restName = (s.restaurantName || userObj.branch?.name || 'YNR Fishes').trim();
    const billNo = bill.billNumber || bill.confirmedBillNumber || '---';
    const customerName = bill.customerName || '';
    const customerPhone = bill.customerPhone || '';
    const bType = bill.billType || 'Dine-In';

    const settledAt = bill.settledAt ? new Date(bill.settledAt) : new Date();
    const dateStr = settledAt.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = settledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();

    const isExp = bill.customerCategory === 'Export' || bill.orderMode === 'export' || String(billNo).startsWith('EXP-') || String(bill.tableNo || '').startsWith('EXP-');
    const isWs = !isExp && (bill.customerCategory === 'Wholesale' || bill.orderMode === 'bulk' || String(billNo).startsWith('WS-') || String(bill.tableNo || '').startsWith('WS-') || Number(bill.totalBoxes || 0) > 0 || (Array.isArray(bill.boxes) && bill.boxes.length > 0));
    const catTitle = isExp ? 'EXPORT' : (isWs ? 'WHOLESALE' : 'RETAIL');
    const prefix = isExp ? 'EXP-' : (isWs ? 'WS-' : 'RET-');
    const cleanTable = (bill.tableNo || '').replace(/^TAK-/i, prefix);

    let tableInfo = cleanTable ? `${catTitle} (${cleanTable})` : catTitle;
    if (bType === 'Delivery' || String(bill.tableNo || '').startsWith('DEL')) {
      tableInfo = `DELIVERY${cleanTable ? ` (${cleanTable})` : ''}`;
    }

    let itemsList = '';
    let totalQty = 0;
    const totalWeightKg = getBillTotalWeightKg(bill);

    // Group items into Wholesale Boxes and Individual Items
    const boxes = {};
    const individual = [];
    const activeItems = (bill.items || []).filter(i => !i.isCancelled);

    activeItems.forEach(item => {
      if (item.boxNumber) {
        const k = String(item.boxNumber);
        if (!boxes[k]) {
          boxes[k] = {
            boxNumber: item.boxNumber,
            boxLabel: item.boxLabel || `Box #${item.boxNumber}`,
            items: [],
            totalWeightKg: 0,
            totalPrice: 0
          };
        }
        boxes[k].items.push(item);
        boxes[k].totalWeightKg += Number(item.weightKg) || 0;
        const q = (item.quantity || 1) - (item.cancelledQuantity || 0);
        boxes[k].totalPrice += (Number(item.price) || 0) * q;
      } else {
        individual.push(item);
      }
    });

    const getItemDetails = (item) => {
      let cut = item?.cutType || item?.cuttingStyle || '';
      let rawName = item?.name || 'Item';
      let weightInfo = '';

      const parenMatch = rawName.match(/\((.*?)\)/);
      if (parenMatch) {
        const inside = parenMatch[1];
        const cutMatch = inside.match(/\b(Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\b/i);
        if (cutMatch && !cut) cut = cutMatch[1];
        const weightMatch = inside.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gms|boxes|box))/i);
        if (weightMatch) weightInfo = weightMatch[1];
      }
      if (cut) {
        const cLower = cut.toLowerCase();
        if (cLower.includes('curry')) cut = 'Curry Cut';
        else if (cLower.includes('fry')) cut = 'Fry Cut';
        else if (cLower.includes('bone')) cut = 'Boneless';
        else if (cLower.includes('clean')) cut = 'Cleaned';
        else if (cLower.includes('whole')) cut = 'Whole';
      }
      let cleanName = rawName.replace(/\s*\((?:Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\s*-\s*[^)]+\)/i, '').trim();
      if (!cleanName) cleanName = rawName;
      return {
        displayName: cleanName,
        cutType: cut,
        weightInfo: weightInfo || (item?.weightKg ? `${item.weightKg} Kg` : (item?.enteredWeight ? `${item.enteredWeight} Kg` : ''))
      };
    };

    if (Object.keys(boxes).length > 0) {
      const boxLines = [];
      Object.values(boxes).forEach(box => {
        const wtStr = box.totalWeightKg > 0 ? ` • ${box.totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg` : '';
        boxLines.push(`📦 *${box.boxLabel} (${box.items.length} items${wtStr}) - ₹${box.totalPrice.toFixed(2)}*`);
        box.items.forEach(item => {
          const qty = (item.quantity || 1) - (item.cancelledQuantity || 0);
          totalQty += qty;
          const { displayName, cutType, weightInfo } = getItemDetails(item);
          const wtPart = item.weightKg ? ` (${item.weightKg}Kg @ ₹${item.pricePerKg || Math.round((item.price / (item.weightKg || 1)))}/kg)` : (weightInfo ? ` (${weightInfo})` : '');
          const cutPart = cutType ? ` [Cut: ${cutType}]` : '';
          boxLines.push(`  • ${displayName}${wtPart} x${qty} - ₹${(Number(item.price || 0) * qty).toFixed(2)}${cutPart}`);
        });
      });
      if (individual.length > 0) {
        boxLines.push(`🐟 *Individual Items:*`);
        individual.forEach(item => {
          const qty = (item.quantity || 1) - (item.cancelledQuantity || 0);
          totalQty += qty;
          const { displayName, cutType, weightInfo } = getItemDetails(item);
          const wtPart = weightInfo ? ` (${weightInfo})` : (item.weightKg ? ` (${item.weightKg} Kg)` : '');
          const cutPart = cutType ? ` [Cut: ${cutType}]` : '';
          boxLines.push(`  • ${displayName}${wtPart} x${qty} - ₹${(Number(item.price || 0) * qty).toFixed(2)}${cutPart}`);
        });
      }
      itemsList = boxLines.join('\n');
    } else if (activeItems.length > 0) {
      itemsList = activeItems.map(item => {
        const qty = (item.quantity || 1) - (item.cancelledQuantity || 0);
        totalQty += qty;
        const { displayName, cutType, weightInfo } = getItemDetails(item);
        const wtPart = weightInfo ? ` (${weightInfo})` : (item.weightKg ? ` (${item.weightKg} Kg)` : '');
        const cutPart = cutType ? ` [Cut: ${cutType}]` : '';
        return `• ${displayName}${wtPart} x${qty} - ₹${(Number(item.price || 0) * qty).toFixed(2)}${cutPart}`;
      }).join('\n');
    }

    const subtotal = Number(bill.subtotal || 0).toFixed(2);
    const total = Number(bill.total || 0).toFixed(2);
    let discount = bill.discount > 0 ? `\n• *Discount:* -₹${Number(bill.discount).toFixed(2)}` : '';

    let paymentInfo = 'Cash';
    const payMode = bill.paymentMode || bill.paymentMethod || 'Cash';
    if (payMode === 'UPI') {
      const upiApp = bill.upiApp || bill.upiAppName || (bill.paymentMethod !== 'UPI' ? bill.paymentMethod : '') || '';
      paymentInfo = upiApp && upiApp !== 'UPI' ? `UPI [${upiApp}]` : 'UPI';
    } else if (payMode === 'Mixed') {
      const split = bill.splitPayments || bill.paymentBreakdown;
      if (split) {
        const parts = [];
        if (Number(split.cash || 0) > 0) parts.push(`Cash: ₹${Number(split.cash).toFixed(2)}`);
        if (Number(split.upi || 0) > 0) parts.push(`UPI: ₹${Number(split.upi).toFixed(2)}`);
        if (Number(split.card || 0) > 0) parts.push(`Card: ₹${Number(split.card).toFixed(2)}`);
        paymentInfo = parts.length > 0 ? `Mixed (${parts.join(' | ')})` : 'Mixed';
      } else {
        paymentInfo = 'Mixed Payment';
      }
    } else if (payMode === 'Partial' || bill.status === 'Partial') {
      const paid = Number(bill.paidAmount ?? bill.amountPaid ?? bill.partialPayment?.paidAmount ?? 0);
      const due = Number(bill.dueAmount ?? bill.partialPayment?.dueAmount ?? Math.max(0, (bill.total || 0) - paid));
      const method = bill.partialPayment?.method || 'Cash';
      paymentInfo = `Partially Paid (Paid ${method}: ₹${paid.toFixed(2)} | Khata Due: ₹${due.toFixed(2)})`;
    } else if (payMode === 'Card') {
      paymentInfo = 'Card';
    } else if (payMode === 'Unpaid' || bill.status === 'Unpaid') {
      paymentInfo = 'Unpaid (Khata)';
    } else {
      paymentInfo = 'Cash';
    }

    const READ_MORE = String.fromCharCode(8206).repeat(4001);

    let header = '';
    let footerMessage = s.footerMessage;

    if (bType === 'Delivery') {
      header = customerName
        ? `🛵 Dear *${customerName}*, thank you for ordering delivery with us!\n🧾 *Delivery e-Bill #${billNo}* | *${restName.toUpperCase()}*`
        : `🛵 *HOME DELIVERY E-BILL* 🛵\n🏠 *${restName.toUpperCase()}* | Bill #${billNo}`;
      if (!footerMessage) footerMessage = '*** THANK YOU FOR YOUR DELIVERY ORDER! ENJOY YOUR MEAL ***';
    } else {
      const isExp = bill.customerCategory === 'Export' || bill.orderMode === 'export' || String(billNo).startsWith('EXP-');
      const isWs = !isExp && (bill.customerCategory === 'Wholesale' || bill.orderMode === 'bulk' || String(billNo).startsWith('WS-') || Number(bill.totalBoxes || 0) > 0);
      const catTitle = isExp ? 'EXPORT' : (isWs ? 'WHOLESALE' : 'RETAIL');
      header = customerName
        ? `🛍️ Dear *${customerName}*, thank you for your ${catTitle.toLowerCase()} order!\n🧾 *${catTitle} e-Bill #${billNo}* | *${restName.toUpperCase()}*`
        : `🛍️ *${catTitle} E-BILL RECEIPT* 🛍️\n📦 *${restName.toUpperCase()}* | Bill #${billNo}`;
      if (!footerMessage) footerMessage = '*** THANK YOU! VISIT AGAIN ***';
    }

    return `${header}\n${READ_MORE}\n` +
      (s.address ? `📍 ${s.address.split('\n')[0]}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Bill No:* #${billNo}\n` +
      `*Date & Time:* ${dateStr}, ${timeStr}\n` +
      `*Order Type:* ${tableInfo}\n` +
      (customerName ? `*Customer:* ${customerName}\n` : '') +
      (customerPhone ? `*Phone:* ${customerPhone}\n` : '') +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*ITEMS ORDERED (${totalQty} Qty${totalWeightKg > 0 ? ` • ${totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg` : ''}):*\n` +
      `${itemsList}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Subtotal:* ₹${subtotal}` +
      discount +
      (totalWeightKg > 0 ? `\n• *Total Weight:* *${totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg*` : '') +
      `\n• *GRAND TOTAL:* *₹${total}*\n` +
      `• *Payment Mode:* ${paymentInfo}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `_${footerMessage}_`;
  };

  const triggerInstantWhatsAppAutoSend = async (bill) => {
    if (!bill || !bill.customerPhone) return;
    let cleanPhone = bill.customerPhone.trim().replace(/[^0-9]/g, '');
    if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = '91' + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    if (cleanPhone.length < 10) return;

    const billNo = bill.billNumber || bill.confirmedBillNumber;
    if (isBillAlreadySent(billNo)) return;

    const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
    const billText = buildWhatsAppBillText(bill, s);
    showToast("Sending automated WhatsApp bill...", 'info');
    window.dispatchEvent(new CustomEvent('whatsappSending', { detail: { billNumber: billNo } }));

    // Mount offscreen bill for canvas capture
    setOffscreenBill(bill);

    // Yield frames so React mounts DOM element reliably
    let el = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 50));
      el = document.getElementById('wa-offscreen-receipt');
      if (el) break;
    }

    let imageBase64 = null;
    try {
      if (el) {
        // Wait for images inside el (like logo) to finish loading
        const imgs = Array.from(el.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(res => { img.onload = res; img.onerror = res; });
        }));

        const canvas = await Promise.race([
          html2canvas(el, {
            scale: 1.3,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 5000,
            scrollX: 0,
            scrollY: 0,
            windowWidth: 420,
            windowHeight: Math.max(1200, (el.scrollHeight || 800) + 400),
            onclone: (clonedDoc) => {
              const cel = clonedDoc.getElementById('wa-offscreen-receipt');
              if (cel) {
                cel.style.position = 'static';
                cel.style.opacity = '1';
                cel.style.left = '0';
                cel.style.top = '0';
                cel.style.visibility = 'visible';
                cel.style.width = '360px';
                cel.style.backgroundColor = '#ffffff';
              }
            }
          }),
          new Promise(r => setTimeout(() => r(null), 5000))
        ]);
        if (canvas) {
          imageBase64 = canvas.toDataURL('image/jpeg', 0.70);
          console.log(`[Instant WhatsApp Auto-Send] Captured receipt image (~${Math.round(imageBase64.length * 0.75 / 1024)} KB)`);
        }
      }
    } catch (err) {
      console.warn('[Instant WhatsApp Auto-Send] Receipt capture error:', err);
    }

    // CRITICAL MANDATE: Never send WhatsApp e-bill without receipt photo image!
    if (!imageBase64) {
      console.warn('[Instant WhatsApp Auto-Send] ❌ Receipt image capture returned null — ABORTING send to guarantee photo image requirement.');
      window.dispatchEvent(new CustomEvent('whatsappFailed', { detail: { billNumber: billNo } }));
      return;
    }

    console.log(`[Instant WhatsApp Auto-Send] Launching background dispatch to +${cleanPhone} for Bill #${billNo}...`);

    sendWhatsAppBill(
      cleanPhone,
      billText,
      imageBase64,
      null,
      `Bill_${billNo || 'Receipt'}.jpg`,
      null,
      null,
      bill._id || null,
      billNo || null
    ).then(res => {
      if (res && res.success) {
        markBillAlreadySent(billNo);
        window.dispatchEvent(new CustomEvent('whatsappSent', { detail: { billNumber: billNo } }));
        console.log(`[Instant WhatsApp Auto-Send] ✅ Receipt Image & Message delivered to +${cleanPhone} successfully!`);
        setToast({ message: `e-Bill & Receipt Image sent to +${cleanPhone} via WhatsApp! ✓`, type: 'success' });
      } else if (res && res.queued) {
        // First attempt failed — retrying in background. Do NOT mark as sent.
        console.log(`[Instant WhatsApp Auto-Send] ⏳ Queued for background retry for +${cleanPhone}`);
        setToast({ message: `WhatsApp send failed — retrying in background. Customer may receive it shortly.`, type: 'warning' });
        window.dispatchEvent(new CustomEvent('whatsappFailed', { detail: { billNumber: billNo } }));
      } else {
        console.warn(`[Instant WhatsApp Auto-Send] ⚠️ API returned error:`, res?.error);
        setToast({ message: `WhatsApp send failed: ${res?.error || 'Bot not connected'}`, type: 'error' });
        window.dispatchEvent(new CustomEvent('whatsappFailed', { detail: { billNumber: billNo } }));
      }
    }).catch(err => {
      const errMsg = err?.response?.data?.error || err?.message || 'WhatsApp send failed';
      console.warn('[Instant WhatsApp Auto-Send] ❌ Dispatch error:', errMsg);
      setToast({ message: `WhatsApp e-Bill failed: ${errMsg}`, type: 'error' });
      window.dispatchEvent(new CustomEvent('whatsappFailed', { detail: { billNumber: billNo } }));
    });
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // Safety guard: Automatically reset actionLoading state after 10s so UI buttons never stay permanently frozen in "Saving..."
  useEffect(() => {
    if (actionLoading) {
      const timer = setTimeout(() => {
        console.warn('[BillingPage] actionLoading safety timeout reached - resetting loading state');
        setActionLoading(null);
        setLoading(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [actionLoading]);

  const newlyGeneratedTables = useRef(new Set());
  const newlyGeneratedTablesDate = useRef('');

  // Tracks the last time user manually edited the cart (add/remove/qty change)
  // Background fetches are suppressed for 8s after any local edit to prevent
  // the 3s poll or socket orderUpdated from reverting local-first cart state.
  const lastLocalEditTime = useRef(0);
  const LOCAL_EDIT_LOCK_MS = 8000; // 8 seconds of protection after any cart edit
  // Tracks whether the cart has locally-added items that haven't been saved to DB yet.
  // When true, background polls and socket events will NEVER clear or overwrite the cart.
  // Only resets to false when the order is explicitly saved, KOT'd, billed, or table is changed.
  const hasPendingLocalChanges = useRef(false);
  const cartRef = useRef(cart);
  const activeTableRef = useRef(activeTable);
  const prevActiveTableRef = useRef(activeTable);
  const activeFetchReqIdRef = useRef(0);

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    activeTableRef.current = activeTable;
  }, [activeTable]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const generateSequentialOrderNo = (type) => {
    let prefix = 'RET-';
    if (type === 'Delivery' || type === 'DEL-NEW') {
      prefix = 'DEL-';
    } else if (fishOrderMode === 'export' || type === 'Export') {
      prefix = 'EXP-';
    } else if (fishOrderMode === 'bulk' || type === 'Wholesale') {
      prefix = 'WS-';
    } else {
      prefix = 'RET-';
    }

    // 1. Calculate current IST date key: 'YYYY-MM-DD'
    const now = new Date();
    const istTime = now.getTime() + (5.5 * 60 * 60 * 1000);
    const istDate = new Date(istTime);
    const todayIST = `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}-${String(istDate.getUTCDate()).padStart(2, '0')}`;

    // Reset newly generated table cache if a new calendar day has started in IST
    if (newlyGeneratedTablesDate.current !== todayIST) {
      newlyGeneratedTablesDate.current = todayIST;
      if (newlyGeneratedTables.current) {
        newlyGeneratedTables.current.clear();
      }
      GENERATED_NEW_TABLES.clear();
    }

    // Helper: test if an ISO or Date string belongs to today in IST
    const isOrderFromTodayIST = (dateStr) => {
      if (!dateStr) return true; // Active open session orders without timestamp are counted
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return true;
        const dIst = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
        const orderIST = `${dIst.getUTCFullYear()}-${String(dIst.getUTCMonth() + 1).padStart(2, '0')}-${String(dIst.getUTCDate()).padStart(2, '0')}`;
        return orderIST === todayIST;
      } catch (_) {
        return true;
      }
    };

    // Build the set of order numbers strictly for THIS prefix today in IST
    const countedNos = new Set();
    const prefixRegex = new RegExp(`^${prefix}(\\d+)`, 'i');

    // 1. From openOrdersList (Active open/billed orders for today in IST matching this prefix)
    if (openOrdersList && Array.isArray(openOrdersList)) {
      openOrdersList.forEach((o) => {
        if (!o || !o.tableNo) return;
        const tNo = String(o.tableNo).trim();
        if (prefixRegex.test(tNo) && isOrderFromTodayIST(o.createdAt || o.orderedAt || o.date)) {
          countedNos.add(tNo);
        }
      });
    }

    // 2. From dailyStats?.todayTableNos (Settled / billed tables queried strictly for today in IST by backend)
    if (dailyStats?.todayTableNos && Array.isArray(dailyStats.todayTableNos)) {
      dailyStats.todayTableNos.forEach((tNo) => {
        if (!tNo) return;
        const str = String(tNo).trim();
        if (prefixRegex.test(str)) {
          countedNos.add(str);
        }
      });
    }

    // 3. From activeTable (if current table matches this prefix)
    if (activeTable && prefixRegex.test(String(activeTable).trim())) {
      countedNos.add(String(activeTable).trim());
    }

    // 4. From newlyGeneratedTables
    if (newlyGeneratedTables.current) {
      newlyGeneratedTables.current.forEach((tNo) => {
        if (tNo && prefixRegex.test(String(tNo).trim())) {
          countedNos.add(String(tNo).trim());
        }
      });
    }

    // 5. From GENERATED_NEW_TABLES
    GENERATED_NEW_TABLES.forEach((tNo) => {
      if (tNo && prefixRegex.test(String(tNo).trim())) {
        countedNos.add(String(tNo).trim());
      }
    });

    // Extract maximum numeric sequence used for THIS SPECIFIC PREFIX today in IST
    let maxNum = 0;
    countedNos.forEach((tNo) => {
      const match = String(tNo).match(prefixRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum && num < 100000) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    const formattedNum = String(nextNum).padStart(3, '0');
    const resultOrderNo = `${prefix}${formattedNum}`;

    if (newlyGeneratedTables.current) {
      newlyGeneratedTables.current.add(resultOrderNo);
    }
    GENERATED_NEW_TABLES.add(resultOrderNo);

    return resultOrderNo;
  };

  useEffect(() => {
    if (initialTable) {
      if (initialTable === 'DEL-NEW' || initialTable === 'TAK-NEW' || initialTable === 'NEW_ORDER') {
        const type = initialTable === 'DEL-NEW' ? 'Delivery' : 'Takeaway';
        setBillType(type);
        // Clean New Order: no premature dummy order numbers like #002 or #004
        setActiveTable('');
        setCart([]);
        cartRef.current = [];
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
        try {
          sessionStorage.removeItem('ms_initial_table');
          sessionStorage.setItem('ms_initial_action', 'new');
        } catch (e) { }
      } else {
        setActiveTable(initialTable);
        setMobileTab('cart');
        if (initialTable.startsWith('DEL-')) {
          setBillType('Delivery');
        } else if (initialTable.startsWith('TAK-')) {
          setBillType('Takeaway');
        } else if (initialTable.startsWith('WS-')) {
          setBillType('Takeaway');
          setFishOrderMode('bulk');
          setCustomerCategory('Wholesale');
        } else if (initialTable.startsWith('EXP-')) {
          setBillType('Takeaway');
          setFishOrderMode('export');
          setCustomerCategory('Export');
        } else if (initialTable.startsWith('RET-')) {
          setBillType('Takeaway');
          setFishOrderMode('individual');
          setCustomerCategory('Retail');
        } else {
          setBillType('Dine-In');
        }
        fetchActiveOrder(initialTable, true);
      }
    } else if (initialAction === 'new') {
      setActiveTable('');
      setCart([]);
      cartRef.current = [];
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      setCompletedBill(null);
      try {
        sessionStorage.removeItem('ms_initial_table');
        sessionStorage.setItem('ms_initial_action', 'new');
      } catch (e) { }
    }
  }, [initialTable, initialAction]);

  useEffect(() => {
    // Only consider it a "local cart" if it's unsaved. If orderId exists, it's an occupied table from DB, so we should allow clearing it to switch tabs.
    const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0 && !orderId);
    if (isExplicitNew) return;
    if (activeTable && (activeTable.startsWith('RET-') || activeTable.startsWith('WS-') || activeTable.startsWith('EXP-') || activeTable.startsWith('TAK-') || activeTable.startsWith('DEL-'))) return;

    if ((billType === 'Delivery' || billType === 'Takeaway') && (!activeTable || activeTable === 'DEL-NEW' || activeTable === 'TAK-NEW' || !activeTable.match(/^(RET-|WS-|EXP-|DEL-|TAK-)/))) {
      let prefix = 'RET-';
      if (billType === 'Delivery') prefix = 'DEL-';
      else if (fishOrderMode === 'export') prefix = 'EXP-';
      else if (fishOrderMode === 'bulk') prefix = 'WS-';
      const isRecentOrder = (o) => {
        if (!o || !o.createdAt) return true;
        const diffHours = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60);
        return diffHours < 24;
      };
      const existingOrder = openOrdersList.find((o) =>
        o.tableNo?.startsWith(prefix) &&
        (o.status === 'Open' || o.status === 'Billed') &&
        isRecentOrder(o)
      );
      if (existingOrder && !initialTable && !hasLocalCart && !activeTable) {
        newlyGeneratedTables.current.delete(existingOrder.tableNo);
        setActiveTable(existingOrder.tableNo);
        if (existingOrder.orderSource) {
          setOrderSource(existingOrder.orderSource);
        }
        fetchActiveOrder(existingOrder.tableNo, true);
      } else if (!hasLocalCart && !initialTable && !activeTable) {
        setCart([]);
        cartRef.current = [];
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
        setCustomerPhone('');
        setCustomerName('');
        setDiscount({ type: 'percentage', value: '' });
        setDeliveryCharge('');
        setContainerCharge('');
        setActiveTable('');
      }
    } else if (billType === 'Dine-In' && activeTable && (activeTable.startsWith('DEL-') || activeTable.startsWith('TAK-')) && !initialTable) {
      if (!hasLocalCart) {
        setActiveTable('');
        setCart([]);
        cartRef.current = [];
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
        setCustomerPhone('');
        setCustomerName('');
        setDiscount({ type: 'percentage', value: '' });
        setDeliveryCharge('');
        setContainerCharge('');
      }
    }
  }, [billType, openOrdersList]);

  // Keep modal-state refs in sync so the poll interval reads the latest value
  // without needing to be re-created every time a modal opens/closes.
  useEffect(() => { showInvoiceRef.current = showInvoice; }, [showInvoice]);
  useEffect(() => { showPaymentRef.current = showPayment; }, [showPayment]);

  useEffect(() => {
    // Only reset pending local changes flag when the table actually changes.
    // This ensures that switching tables doesn't carry over the protection from the previous table,
    // while modal toggles (showInvoice, showPayment) will NOT reset active local cart state.
    const isTableChanged = prevActiveTableRef.current !== activeTable;
    const isNewGenerated = newlyGeneratedTables.current?.has(activeTable) || GENERATED_NEW_TABLES.has(activeTable);
    // If table was just auto-assigned when adding the first item to an empty cart, protect it from being wiped
    const isAutoAssignedTable = !prevActiveTableRef.current && activeTable && (isNewGenerated || (cartRef.current && cartRef.current.length > 0));

    if (isTableChanged) {
      if (!isAutoAssignedTable) {
        hasPendingLocalChanges.current = false;
      }
      prevActiveTableRef.current = activeTable;
    }

    const isExistingInOpenOrders = openOrdersList && openOrdersList.some(o => {
      if (!o || !o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
      return isTableMatching(o.tableNo, activeTable);
    });

    const isExplicitInitial = Boolean(initialTable && isTableMatching(activeTable, initialTable));

    if (isTableChanged && !isExistingInOpenOrders && !isExplicitInitial && !isAutoAssignedTable && !isNewGenerated && !activeTable.match(/^(WS-|EXP-|RET-)/)) {
      // ⚡ Immediate 0ms cart clear on switching to an empty table — no loading spinner
      setLoading(false);
      setCart([]);
      cartRef.current = [];
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      setCompletedBill(null);
      setCustomerPhone('');
      setCustomerName('');
      setCustomerInfo(null);
      setDiscount({ type: 'percentage', value: '' });
      setDeliveryCharge('');
      setContainerCharge('');
    }

    if (activeTable && !isAutoAssignedTable && !isNewGenerated && (isExistingInOpenOrders || (isExplicitInitial && !isExplicitNew) || !activeTable.includes('NEW'))) {
      fetchActiveOrder(activeTable, isTableChanged);
    } else if (activeTable && (isNewGenerated || isAutoAssignedTable)) {
      if (cart.length === 0 && (!cartRef.current || cartRef.current.length === 0)) {
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
      }
    }

    const handleRemoteOrderUpdate = (e) => {
      // Pause updates if the user is currently viewing the invoice or payment modal
      if (showInvoiceRef.current || showPaymentRef.current || isViewingInvoiceRef.current) return;

      const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0);
      if (hasLocalCart) {
        // Active cart has local unsaved items — protect it from being clobbered by remote socket events
        return;
      }

      const data = e.detail;
      if (data) {
        if (!data.tableNo || data.tableNo === activeTable) {
          const msSinceEdit = Date.now() - lastLocalEditTime.current;
          if (msSinceEdit > LOCAL_EDIT_LOCK_MS) {
            fetchActiveOrder(activeTable, false, true);
          }
        } else {
          const norm1 = (data.tableNo || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
          const norm2 = (activeTable || '').trim().replace(/[^a-z0-9]/gi, '').toLowerCase();
          if (norm1 && norm2 && norm1 === norm2) {
            const msSinceEdit = Date.now() - lastLocalEditTime.current;
            if (msSinceEdit > LOCAL_EDIT_LOCK_MS) {
              fetchActiveOrder(activeTable, false, true);
            }
          }
        }
      }
    };
    window.addEventListener('remoteOrderUpdated', handleRemoteOrderUpdate);

    // 5-Second polling to guarantee real-time bill summary UI updates.
    // Uses refs for modal state so the interval is NOT torn down on every modal open/close.
    const pollInterval = setInterval(() => {
      // Pause polling if the user is currently viewing the invoice or payment modal
      if (showInvoiceRef.current || showPaymentRef.current || isViewingInvoiceRef.current) return;

      if (activeTable) {
        const isNewUnsavedTable = (newlyGeneratedTables.current?.has(activeTable) || GENERATED_NEW_TABLES.has(activeTable)) && !openOrdersList.some(o => isTableMatching(o.tableNo, activeTable));
        // If user has unsaved cart items or pending local edits, or this is a brand new order not in DB yet, NEVER fetch or overwrite activeTable!
        const hasLocalCart = hasPendingLocalChanges.current || (cartRef.current && cartRef.current.length > 0);
        if (!hasLocalCart && !isNewUnsavedTable) {
          fetchActiveOrder(activeTable, false, true);
        }
      }
      fetchOpenOrdersList();
    }, 5000);

    return () => {
      window.removeEventListener('remoteOrderUpdated', handleRemoteOrderUpdate);
      clearInterval(pollInterval);
    };
    // Note: showInvoice/showPayment intentionally removed from deps — refs are used instead
    // to prevent the interval from being torn down and causing a loading flash on modal toggle.
  }, [activeTable]);

  useEffect(() => {
    const handleKotUpdatedSocket = (data) => {
      if (showInvoice || showPayment) return;

      if (data && (data.tableNo === activeTable || data.orderId === orderId)) {
        if (data.itemId || data.itemName) {
          setCart((prevCart) =>
            prevCart.map((i) => {
              if (
                (data.itemId && i._id?.toString() === data.itemId?.toString()) ||
                (data.itemName && i.name === data.itemName)
              ) {
                return {
                  ...i,
                  status: data.status || i.status,
                  unitStatuses: data.unitStatuses || i.unitStatuses,
                  preparedQuantity: data.preparedQuantity !== undefined ? data.preparedQuantity : i.preparedQuantity,
                  preparingQuantity: data.preparingQuantity !== undefined ? data.preparingQuantity : i.preparingQuantity,
                  pendingQuantity: data.pendingQuantity !== undefined ? data.pendingQuantity : i.pendingQuantity
                };
              }
              return i;
            })
          );
        }
        fetchActiveOrder(activeTable, false, true);
      }
    };

    const unsubKot = realtimeService.subscribe('kotUpdated', handleKotUpdatedSocket);
    const unsubReady = realtimeService.subscribe('foodReady', handleKotUpdatedSocket);
    return () => {
      unsubKot();
      unsubReady();
    };
  }, [activeTable, orderId, showInvoice, showPayment]);

  useEffect(() => {
    fetchDailyStats();
  }, []);

  useEffect(() => {
    if (customerPhone && customerPhone.length === 10) {
      const fetchCustomer = async () => {
        try {
          const API_BASE_URL = getApiUrl();
          const res = await fetch(`${API_BASE_URL}/customers/${customerPhone}`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
              'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
            }
          });
          if (res.ok) {
            const data = await res.json();
            if (!data.isNew) {
              setCustomerName(data.customer.name);
              setCustomerInfo(data);
            } else {
              setCustomerInfo(null);
            }
          }
        } catch (error) { console.error('Error fetching customer:', error); }
      };
      fetchCustomer();
    } else {
      setCustomerInfo(null);
    }
  }, [customerPhone]);

  useEffect(() => {
    if (billType === 'Delivery' || billType === 'Takeaway' || activeTable?.startsWith('DEL-') || activeTable?.startsWith('TAK-')) {
      setShowTransfer(false);
    }
  }, [billType, activeTable]);

  const handleOpenCustomerModal = () => {
    let phoneToUse = customerPhone || '';
    let nameToUse = customerName || '';

    if (!phoneToUse || !nameToUse) {
      const matchingOrder = openOrdersList.find(o => isTableMatching(o.tableNo, activeTable));
      if (matchingOrder) {
        phoneToUse = phoneToUse || matchingOrder.customerPhone || '';
        nameToUse = nameToUse || matchingOrder.customerName || '';
      }
    }

    setTempCustomerPhone(phoneToUse);
    setTempCustomerName(nameToUse);
    setCrmCustomerFound(null);
    setShowCustomerModal(true);

    if (phoneToUse && phoneToUse.length === 10) {
      handleCrmPhoneChange(phoneToUse);
    }
  };

  const handleCrmPhoneChange = async (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setTempCustomerPhone(digits);
    setCrmCustomerFound(null);

    if (digits.length >= 3 && digits.length < 10) {
      try {
        const API_BASE_URL = getApiUrl();
        const res = await fetch(`${API_BASE_URL}/customers/search?q=${digits}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
            'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          setCrmSuggestions(data || []);
          setShowCrmSuggestions(true);
        }
      } catch (err) { }
    } else {
      setShowCrmSuggestions(false);
    }

    if (digits.length === 10) {
      setCrmLoading(true);
      setShowCrmSuggestions(false);
      try {
        const API_BASE_URL = getApiUrl();
        const res = await fetch(`${API_BASE_URL}/customers/${digits}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
            'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.isNew && data.customer) {
            setTempCustomerName(data.customer.name || '');
            setCrmCustomerFound(data.customer);
          } else {
            setCrmCustomerFound(null);
          }
        }
      } catch (err) {
        console.error('CRM lookup error:', err);
      } finally {
        setCrmLoading(false);
      }
    }
  };

  const handleSaveCustomerCRM = async (e) => {
    if (e) e.preventDefault();
    const cleanPhone = tempCustomerPhone.trim().replace(/\D/g, '');
    const cleanName = tempCustomerName.trim();

    if (!cleanPhone && !cleanName) {
      showToast(t('Please enter customer name or phone number'), 'warning');
      return;
    }

    // 1. Instant Optimistic UI Update & Close Modal (0ms delay)
    setCustomerPhone(cleanPhone);
    setCustomerName(cleanName || 'Guest');
    setShowCustomerModal(false);
    showToast(t('Customer details linked to order'), 'success');

    setOpenOrdersList(prev => prev.map(o => isTableMatching(o.tableNo, activeTable) ? {
      ...o,
      customerPhone: cleanPhone,
      customerName: cleanName || 'Guest'
    } : o));

    if (activeTable) {
      upsertCachedOpenOrder({
        tableNo: activeTable,
        customerPhone: cleanPhone,
        customerName: cleanName || 'Guest'
      }).catch(() => { });
    }

    // 2. Non-blocking Background Parallel API Sync
    (async () => {
      try {
        const syncPromises = [];
        if (cleanPhone) {
          syncPromises.push(api.post('/customers', {
            name: cleanName || 'Guest',
            phone: cleanPhone,
            orderType: billType
          }));
        }

        const targetOrderId = orderId || openOrdersList.find(o => isTableMatching(o.tableNo, activeTable))?._id;
        if (targetOrderId && !targetOrderId.startsWith('offline_')) {
          syncPromises.push(api.patch(`/bills/${targetOrderId}/customer`, {
            customerName: cleanName || 'Guest',
            customerPhone: cleanPhone,
            billType
          }));
        }

        await Promise.all(syncPromises);
      } catch (err) {
        console.warn('Background customer CRM sync error:', err);
      }
    })();
  };

  const handlePredefinedCustomerSelect = (cust) => {
    if (!cust) return;
    const cleanPhone = cust.phone ? cust.phone.trim().replace(/\D/g, '') : '';
    setCustomerPhone(cleanPhone);
    setCustomerName(cust.name || 'Guest');
    setCustomerCategory(cust.category || (fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail')));
    setExportSubCategory(cust.exportSubCategory || null);
    setCustomerPhoto(cust.photo || '');
    const addr = typeof cust.address === 'string' ? cust.address : (cust.address?.fullAddress || cust.address?.line1 || '');
    setCustomerAddress(addr);
    setIsOrderLocked(true);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    setLockedTimestamp(`${dateFormatted}, ${timeFormatted}`);

    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();

    if (activeTable) {
      setOpenOrdersList(prev => prev.map(o => isTableMatching(o.tableNo, activeTable) ? {
        ...o,
        customerPhone: cleanPhone,
        customerName: cust.name || 'Guest',
        customerCategory: cust.category || (fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail')),
        exportSubCategory: cust.exportSubCategory || null,
        customerPhoto: cust.photo || '',
        customerAddress: addr,
        isOrderLocked: true,
        orderDateFormatted: dateFormatted,
        orderTimeFormatted: timeFormatted
      } : o));
    }
  };

  const handleOrderSourceChange = async (newSource) => {
    setOrderSource(newSource);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();

    const targetOrderId = orderId || openOrdersList.find(o => isTableMatching(o.tableNo, activeTable))?._id;
    if (targetOrderId && !targetOrderId.startsWith('offline_')) {
      try {
        await saveOrder({
          id: targetOrderId,
          tableNo: activeTable,
          billType: 'Delivery',
          orderSource: newSource,
          items: cart && cart.length > 0 ? cart : [{ name: 'Delivery Order', price: 0, quantity: 1 }],
          skipNotification: true
        });
        setOpenOrdersList(prev => prev.map(o => (o._id === targetOrderId || isTableMatching(o.tableNo, activeTable)) ? { ...o, orderSource: newSource } : o));
      } catch (err) {
        console.warn('Non-blocking error saving orderSource to DB:', err);
      }
    } else {
      setOpenOrdersList(prev => prev.map(o => isTableMatching(o.tableNo, activeTable) ? { ...o, orderSource: newSource } : o));
    }
  };

  // Global Keyboard Auto-Type to Search bar (Issue 7)
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // If user is currently typing in an input, textarea, select, or contenteditable, don't intercept
      const activeEl = document.activeElement;
      const tag = activeEl?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || activeEl?.isContentEditable;
      if (isInput) {
        if (e.key === 'Escape' && activeEl === searchInputRef.current) {
          setSearchTerm('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // If any modal is active or viewing invoice, do not hijack typing
      if (showInvoice || showPayment || showKOT || showTransfer || showCancelModal || showCustomerModal || isViewingInvoiceRef.current) {
        return;
      }

      // Ignore modifier keys, navigation, and function keys
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) {
        if (e.key === 'Escape') {
          setSearchTerm('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // If printable character (letters, numbers, space), auto-type into search bar
      if (/^[a-zA-Z0-9\s]$/.test(e.key)) {
        e.preventDefault();
        setSearchTerm((prev) => prev + e.key);
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showInvoice, showPayment, showKOT, showTransfer, showCancelModal, showCustomerModal]);

  async function fetchActiveOrder(tableToFetch = activeTable, forceReset = false, isBackground = false) {
    if (!tableToFetch) {
      setLoading(false);
      return;
    }

    const reqId = ++activeFetchReqIdRef.current;
    const fetchStartTime = Date.now();

    const hasLocalEdits = () => {
      const msSinceEdit = Date.now() - lastLocalEditTime.current;
      const isWithinLockWindow = msSinceEdit < LOCAL_EDIT_LOCK_MS;
      const hasItems = cartRef.current && cartRef.current.length > 0;
      const hasPending = hasPendingLocalChanges.current;
      const wasEditedSinceFetchStart = lastLocalEditTime.current >= fetchStartTime;
      return hasPending || hasItems || isWithinLockWindow || wasEditedSinceFetchStart;
    };

    // Helper to check orders array and apply order immediately (0ms delay)
    const checkAndApplyCache = (ordersArr) => {
      if (!ordersArr || !Array.isArray(ordersArr) || ordersArr.length === 0) return false;
      if (hasLocalEdits() && !forceReset) return false; // Never let stale cache clobber local edits

      const cached = ordersArr.find(o => {
        if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
        return isTableMatching(o.tableNo, tableToFetch);
      });

      if (cached && cached.items && cached.items.length > 0) {
        const kotStatusMap = {};
        if (cached.kots && Array.isArray(cached.kots)) {
          cached.kots.forEach(kot => {
            (kot.items || []).forEach(kItem => {
              if (kItem.name) {
                kotStatusMap[kItem.name] = kItem.status;
                if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
              }
            });
          });
        }

        const validItems = cached.items.filter(i => {
          if (i.isCancelled || i.status === 'Cancelled') return false;
          const activeQty = Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0));
          return activeQty > 0;
        }).map(i => ({
          ...i,
          specialNote: i.specialNote || '',
          printedQuantity: i.printedQuantity !== undefined ? i.printedQuantity : (cached.status === 'Open' ? (i.quantity || 0) : 0),
          lastPrintedNote: i.lastPrintedNote !== undefined ? i.lastPrintedNote : (i.specialNote || ''),
          status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status
        }));

        if (validItems.length > 0) {
          setCart(prev => {
            if (hasLocalEdits() && prev && prev.length > 0) {
              const localOnlyItems = prev.filter(pItem => !validItems.some(vItem => (vItem._id && vItem._id === pItem._id) || vItem.name === pItem.name));
              const merged = [...validItems, ...localOnlyItems];
              cartRef.current = merged;
              return merged;
            }
            if (!prev || prev.length === 0 || forceReset) {
              cartRef.current = validItems;
              return validItems;
            }
            return prev;
          });
          setOrderId(cached._id);
          setOrderStatus(cached.status);
          setBillNumber(cached.billNumber);
          setBillType(cached.billType || (cached.tableNo?.startsWith('DEL-') ? 'Delivery' : (cached.tableNo?.startsWith('TAK-') ? 'Takeaway' : 'Dine-In')));

          // ⚡ Automatically sync catalog view mode with order type (Retail vs Wholesale vs Export)
          const isCachedExport = cached.customerCategory === 'Export' || cached.orderChannel?.includes('Export') || cached.orderMode === 'export' || cached.billType === 'Export' || Boolean(cached.exportSubCategory);
          const isCachedWholesale = cached.customerCategory === 'Wholesale' || cached.orderChannel === 'Wholesale-Box' || cached.orderMode === 'bulk' || cached.billType === 'Wholesale' || (Number(cached.totalBoxes) > 0) || (Array.isArray(cached.boxes) && cached.boxes.length > 0) || cached.items?.some(i => i.isWholesaleBox || Number(i.boxNumber || 0) > 0 || i.pricingTier === 'wholesale' || Number(i.weight || i.weightKg || i.enteredWeight || 0) >= 20);

          if (isCachedExport) {
            setFishOrderMode('export');
            setCustomerCategory('Export');
            if (cached.exportSubCategory) setExportSubCategory(cached.exportSubCategory);
          } else if (isCachedWholesale) {
            setFishOrderMode('bulk');
            setCustomerCategory('Wholesale');
          } else {
            setFishOrderMode('individual');
            setCustomerCategory('Retail');
          }
          if (cached.orderSource) {
            setOrderSource(cached.orderSource);
          } else if (cached.billType === 'Delivery' || cached.tableNo?.startsWith('DEL-')) {
            setOrderSource('Direct');
          }
          if (cached.customerPhone) {
            setCustomerPhone(cached.customerPhone);
          }
          if (cached.customerName) {
            setCustomerName(cached.customerName);
          }
          setDeliveryCharge(cached.deliveryCharge !== undefined ? String(cached.deliveryCharge) : '0');
          setContainerCharge(cached.containerCharge !== undefined ? String(cached.containerCharge) : '0');
          const isRetailCached = !isCachedWholesale && !isCachedExport;
          setCuttingCharge(isRetailCached && cached.cuttingCharge !== undefined ? String(cached.cuttingCharge) : '0');
          setIsCuttingChargeEnabled(isRetailCached && Number(cached.cuttingCharge) > 0);
          if (cached.discountType || cached.discountValue !== undefined || cached.discountName) {
            setDiscount({
              type: cached.discountType || 'percentage',
              value: cached.discountValue !== undefined && cached.discountValue !== null ? cached.discountValue : '',
              name: cached.discountName || '',
              applicableTo: cached.applicableTo || 'all',
              targetCategory: cached.targetCategory || ''
            });
          }
          setLoading(false);
          const currentAction = initialAction || (typeof window !== 'undefined' ? sessionStorage.getItem('ms_initial_action') : null);
          if (currentAction === 'settle') {
            try { sessionStorage.removeItem('ms_initial_action'); } catch (e) { }
            setShowPayment(true);
          }
          return true;
        }
      }
      return false;
    };

    // 1. INSTANT 0ms CACHE READ (Memory + IndexedDB)
    let hasInstantCache = checkAndApplyCache(openOrdersList);
    if (!hasInstantCache) {
      try {
        const idbOrders = await getCachedOpenOrders();
        hasInstantCache = checkAndApplyCache(idbOrders);
      } catch (e) { }
    }

    if (hasInstantCache) {
      setLoading(false);
      return;
    }

    if (reqId !== activeFetchReqIdRef.current || !isTableMatching(tableToFetch, activeTableRef.current)) {
      return;
    }

    // If the user has local cart items or pending changes:
    // NEVER clear or clobber the cart during any background or poll fetch!
    if (isBackground && !forceReset && hasLocalEdits()) {
      return;
    }

    // Never clobber cart or completedBill while invoice or payment is active
    if (isViewingInvoiceRef.current || showInvoiceRef.current || showPaymentRef.current) {
      return;
    }

    const isKnownOrder = openOrdersList && openOrdersList.some(o => {
      if (!o || !o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
      return isTableMatching(o.tableNo, tableToFetch);
    });

    const isExplicitInitial = Boolean(initialTable && isTableMatching(tableToFetch, initialTable));

    // ⚡ EMPTY TABLE FAST-PATH: If table has no active order in open orders, it is an EMPTY table.
    // Instantly reset the cart to 0 items with 0ms latency. NEVER show loading spinner or skeleton!
    if (!isKnownOrder && !isExplicitInitial && openOrdersList && openOrdersList.length > 0) {
      newlyGeneratedTables.current.delete(tableToFetch);
      if (hasLocalEdits() && isTableMatching(tableToFetch, prevActiveTableRef.current)) {
        return;
      }
      setLoading(false);
      setCart([]);
      cartRef.current = [];
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      setCompletedBill(null);
      setCustomerPhone('');
      setCustomerName('');
      setCustomerInfo(null);
      setDiscount({ type: 'percentage', value: '' });
      setDeliveryCharge('');
      setContainerCharge('');

      // Silent background verification only (NEVER sets loading = true)
      getActiveOrder(tableToFetch).then(freshOrder => {
        if (reqId !== activeFetchReqIdRef.current || !isTableMatching(tableToFetch, activeTableRef.current)) return;
        if (freshOrder && freshOrder.tableNo && isTableMatching(freshOrder.tableNo, tableToFetch) && freshOrder.items && freshOrder.items.length > 0) {
          checkAndApplyCache([freshOrder]);
        }
      }).catch(() => { });
      return;
    }

    // Only set loading for known orders when cart is currently empty
    if (!isBackground && cartRef.current.length === 0) setLoading(true);

    try {
      let order = await getActiveOrder(tableToFetch);

      // Discard if a newer fetch was started or active table changed during async call
      if (reqId !== activeFetchReqIdRef.current || !isTableMatching(tableToFetch, activeTableRef.current)) {
        return;
      }

      if (order && (!order.tableNo || !isTableMatching(order.tableNo, tableToFetch))) {
        order = null;
      }
      if (!order && openOrdersList && openOrdersList.length > 0) {
        order = openOrdersList.find(o => {
          if (!o.tableNo || (o.status !== 'Open' && o.status !== 'Billed')) return false;
          return isTableMatching(o.tableNo, tableToFetch);
        });
      }

      if (order && order.tableNo && isTableMatching(order.tableNo, tableToFetch)) {
        const kotStatusMap = {};
        if (order.kots && Array.isArray(order.kots)) {
          order.kots.forEach(kot => {
            (kot.items || []).forEach(kItem => {
              if (kItem.name) {
                kotStatusMap[kItem.name] = kItem.status;
                if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
              }
            });
          });
        }

        const backendItems = (order.items || [])
          .filter(i => (Number(i.quantity || 0) > 0 || (i.isCancelled && (i.printedQuantity || 0) > 0)))
          .map(i => ({
            ...i,
            specialNote: i.specialNote || '',
            printedQuantity: i.printedQuantity !== undefined ? i.printedQuantity : (order.status === 'Open' ? (i.quantity || 0) : 0),
            lastPrintedNote: i.lastPrintedNote !== undefined ? i.lastPrintedNote : (i.specialNote || ''),
            status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status
          }));

        if (backendItems.length === 0) {
          if (hasLocalEdits()) {
            setOrderId(order._id);
            setOrderStatus(order.status || 'Open');
            setLoading(false);
            return;
          }
          setCart([]);
          cartRef.current = [];
          setOrderId(null);
          setOrderStatus('Open');
          setBillNumber(null);
          setLoading(false);
          return;
        }

        if (hasLocalEdits()) {
          setCart(prev => {
            const current = prev || [];
            const localOnlyItems = current.filter(pItem => !backendItems.some(bItem => (bItem._id && bItem._id === pItem._id) || bItem.name === pItem.name));
            const merged = [...backendItems, ...localOnlyItems];
            cartRef.current = merged;
            return merged;
          });
        } else {
          setCart(backendItems);
          cartRef.current = backendItems;
        }

        setOrderId(order._id);
        setOrderStatus(order.status);
        setBillNumber(order.billNumber);
        setBillType(order.billType || 'Dine-In');

        // ⚡ Automatically sync catalog view mode with order type (Retail vs Wholesale vs Export)
        const isOrderExport = order.customerCategory === 'Export' || order.orderChannel?.includes('Export') || order.orderMode === 'export' || order.billType === 'Export' || Boolean(order.exportSubCategory);
        const isOrderWholesale = order.customerCategory === 'Wholesale' || order.orderChannel === 'Wholesale-Box' || order.orderMode === 'bulk' || order.billType === 'Wholesale' || (Number(order.totalBoxes) > 0) || (Array.isArray(order.boxes) && order.boxes.length > 0) || order.items?.some(i => i.isWholesaleBox || Number(i.boxNumber || 0) > 0 || i.pricingTier === 'wholesale' || Number(i.weight || i.weightKg || i.enteredWeight || 0) >= 20);

        if (isOrderExport) {
          setFishOrderMode('export');
          setCustomerCategory('Export');
          if (order.exportSubCategory) setExportSubCategory(order.exportSubCategory);
        } else if (isOrderWholesale) {
          setFishOrderMode('bulk');
          setCustomerCategory('Wholesale');
        } else {
          setFishOrderMode('individual');
          setCustomerCategory('Retail');
        }
        if (order.billType === 'Delivery') {
          setOrderSource(order.orderSource || 'Direct');
        }
        if (order.customerPhone) {
          setCustomerPhone(order.customerPhone);
        }
        if (order.customerName) {
          setCustomerName(order.customerName);
        }
        setDeliveryCharge(order.deliveryCharge !== undefined ? String(order.deliveryCharge) : '0');
        setContainerCharge(order.containerCharge !== undefined ? String(order.containerCharge) : '0');
        const isOrderRetail = order.customerCategory !== 'Wholesale' && order.orderMode !== 'bulk' && order.customerCategory !== 'Export' && order.orderMode !== 'export' && !String(order.tableNo || '').startsWith('WS-') && !String(order.tableNo || '').startsWith('EXP-');
        setCuttingCharge(isOrderRetail && order.cuttingCharge !== undefined ? String(order.cuttingCharge) : '0');
        setIsCuttingChargeEnabled(isOrderRetail && Number(order.cuttingCharge) > 0);
        if (!isBackground || forceReset) {
          if (order.discountType || order.discountValue !== undefined || order.discountName) {
            setDiscount({
              type: order.discountType || 'percentage',
              value: order.discountValue !== undefined && order.discountValue !== null ? order.discountValue : '',
              name: order.discountName || '',
              applicableTo: order.applicableTo || 'all',
              targetCategory: order.targetCategory || ''
            });
          }
        }
        try {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          let tot = 0;
          if (s.enableCgst) tot += Number(s.cgstRate || 0);
          if (s.enableSgst) tot += Number(s.sgstRate || 0);
          if (s.enableGst) tot += Number(s.gstRate || 0);
          setTaxRate(tot > 0 ? tot : '');
        } catch (error) {
          console.error('Error parsing settings:', error);
          setTaxRate('');
        }
        const currentAction = initialAction || (typeof window !== 'undefined' ? sessionStorage.getItem('ms_initial_action') : null);
        if (currentAction === 'settle') {
          try { sessionStorage.removeItem('ms_initial_action'); } catch (e) { }
          setShowPayment(true);
        }
      } else {
        // If user has local cart items or pending local changes, NEVER reset cart!
        if (hasLocalEdits()) {
          setLoading(false);
          return;
        }

        if (isBackground && !forceReset) {
          setLoading(false);
          return;
        }

        // If it's a delivery or takeaway table that has no active order (e.g. already settled/paid),
        // transition cleanly to a blank New Order without inventing placeholder numbers
        if (!isBackground && !hasLocalEdits() && tableToFetch && (tableToFetch.startsWith('DEL-') || tableToFetch.startsWith('TAK-'))) {
          setActiveTable('');
          setCart([]);
          cartRef.current = [];
          setOrderId(null);
          setOrderStatus('Open');
          setBillNumber(null);
          setCompletedBill(null);
          setLoading(false);
          return;
        }

        setCart([]);
        cartRef.current = [];
        setOrderId(null);
        setOrderStatus('Open');
        setBillNumber(null);
        setCompletedBill(null);
        if (billType !== 'Delivery') {
          setOrderSource('Direct');
        }
        setCustomerPhone('');
        setCustomerName('');
        setCustomerInfo(null);
        setDiscount({ type: 'percentage', value: '' });
        setDeliveryCharge('');
        setContainerCharge('');
        try {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          let tot = 0;
          if (s.enableCgst) tot += Number(s.cgstRate || 0);
          if (s.enableSgst) tot += Number(s.sgstRate || 0);
          if (s.enableGst) tot += Number(s.gstRate || 0);
          setTaxRate(tot > 0 ? tot : '');
        } catch (error) {
          console.error('Error fetching settings:', error);
          setTaxRate('');
        }
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
    } finally {
      if (reqId === activeFetchReqIdRef.current) {
        setLoading(false);
      }
    }
  };



  async function fetchDailyStats() {
    setIsStatsLoading(true);
    try {
      const stats = await getDailyStats();
      if (stats && typeof stats.sales === 'number') {
        setDailyStats(stats);
        try {
          const todayStr = new Date().toISOString().slice(0, 10);
          localStorage.setItem('ms_daily_stats_cache', JSON.stringify({ date: todayStr, stats }));
        } catch (e) { }
      }
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const calculateSubtotal = () => cart.reduce((sum, item) => {
    if (item.isCancelled) return sum;
    const activeQty = item.quantity - (item.cancelledQuantity || 0);
    return sum + (item.price * activeQty);
  }, 0);

  const hasUnprintedItems = cart.length > 0 && cart.some((item) => {
    if (item.isCancelled) return false;
    const qty = item.quantity || 0;
    const printed = item.printedQuantity !== undefined ? item.printedQuantity : 0;
    const noteChanged = (item.specialNote || '').trim() !== (item.lastPrintedNote || '').trim();
    return qty !== printed || noteChanged;
  });

  const calculateDiscount = (subtotal) => {
    if (discount.type === 'complimentary') return subtotal;
    const val = discount.value === '' ? 0 : parseFloat(discount.value) || 0;

    // Handle category-specific discount
    if (discount.applicableTo === 'category' && discount.targetCategory) {
      const targetCat = String(discount.targetCategory).trim().toLowerCase();
      const targetWords = targetCat.split(/\s+/).filter(w => w.length > 2);
      const eligibleSubtotal = (cart || []).reduce((acc, item) => {
        if (item.isCancelled) return acc;
        let itemCat = '';
        if (item.category) {
          itemCat = typeof item.category === 'object' && item.category !== null ? (item.category.name || item.category._id) : item.category;
        }
        let isMatch = false;
        if (itemCat) {
          const itemCatNorm = String(itemCat).trim().toLowerCase();
          if (itemCatNorm === targetCat || itemCatNorm.includes(targetCat) || targetCat.includes(itemCatNorm)) {
            isMatch = true;
          }
        }
        if (!isMatch && item.name) {
          const itemNameNorm = item.name.toLowerCase();
          if (targetWords.length > 0 && targetWords.every(w => itemNameNorm.includes(w))) {
            isMatch = true;
          }
        }

        if (isMatch) {
          const qty = (item.quantity || 0) - (item.cancelledQuantity || 0);
          return acc + (Number(item.price || 0) * Math.max(0, qty));
        }
        return acc;
      }, 0);

      if (discount.type === 'percentage') {
        const cappedPercent = Math.min(100, Math.max(0, val));
        return Math.min(eligibleSubtotal, (eligibleSubtotal * cappedPercent) / 100);
      }
      return Math.min(eligibleSubtotal, Math.max(0, val));
    }

    if (discount.type === 'percentage') {
      const cappedPercent = Math.min(100, Math.max(0, val));
      return Math.min(subtotal, (subtotal * cappedPercent) / 100);
    }
    return Math.min(subtotal, Math.max(0, val));
  };

  const subtotal = calculateSubtotal();
  const discountAmount = calculateDiscount(subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxVal = taxRate === '' ? 0 : parseFloat(taxRate) || 0;
  const taxAmount = taxableAmount * taxVal / 100;
  const additionalCharges = parseFloat(deliveryCharge || 0) + parseFloat(containerCharge || 0) + (fishOrderMode === 'individual' ? parseFloat(cuttingCharge || 0) : 0);
  const total = Math.max(0, Math.round(taxableAmount + taxAmount + additionalCharges) - walletRedemption);

  const syncTimeoutRef = useRef(null);

  const autoSyncOrder = useCallback((targetTable, currentCart, currentOrderId) => {
    if (!targetTable) return;

    if (!currentCart || currentCart.length === 0) {
      // Clear debounced save
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

      // Instantly remove from IndexedDB and local state
      if (currentOrderId) {
        removeCachedOpenOrder(currentOrderId).catch(() => { });
      }
      removeCachedOpenOrder(targetTable).catch(() => { });
      setOpenOrdersList(prev => prev.filter(o => o.tableNo !== targetTable && o._id !== currentOrderId));
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);

      // Notify backend to cancel/delete the draft order and free the table
      if (currentOrderId) {
        saveOrder({
          tableNo: targetTable,
          items: [],
          billType,
          ...(currentOrderId && !currentOrderId.startsWith('offline_') && { id: currentOrderId })
        }).then(() => {
          if (onOrderUpdate) onOrderUpdate();
          realtimeService.emit('orderUpdated', { tableNo: targetTable, status: 'Cancelled', orderId: currentOrderId });
          realtimeService.emit('tableStatusChanged', { tableNo: targetTable, status: 'Available' });
        }).catch((err) => {
          console.warn('Auto-sync empty order error:', err);
        });
      }
      return;
    }
  }, [billType, onOrderUpdate]);

  const addToCart = (item) => {
    let currentTable = activeTableRef.current || activeTable;
    if (!currentTable) {
      if (billType === 'Takeaway' || billType === 'Delivery') {
        currentTable = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(currentTable);
        activeTableRef.current = currentTable;
        setActiveTable(currentTable);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    // Strict lock: Billed orders require clicking EDIT first
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const currentCart = cartRef.current || [];
    const itemKey = item.itemKey || `${item._id || item.name}_${item.sellingUnit || 'Kg'}_${item.enteredWeight || item.price}`;
    const existingIndex = currentCart.findIndex((i) => (i.itemKey && i.itemKey === itemKey) || (!item.itemKey && ((i._id && item._id && i._id === item._id) || i.name === item.name)));
    let newCart;
    if (existingIndex > -1) {
      showToast(`${t('increasedQty', { defaultValue: 'Increased quantity of' })} ${item.name}`, 'success');
      newCart = currentCart.map((i, idx) => {
        if (idx === existingIndex) {
          const addQty = item.quantity || 1;
          const newQty = (i.quantity || 0) + addQty;
          const unitPrice = Number(i.pricePerKg || i.price || 0);
          const newTotal = Number((unitPrice * newQty).toFixed(2));
          const baseUnitWeight = (i.quantity > 0 && i.enteredWeight) ? (Number(i.enteredWeight) / i.quantity) : Number(i.weightKg || i.enteredWeight || 1);
          const newWeight = Number((baseUnitWeight * newQty).toFixed(3));
          return {
            ...i,
            quantity: newQty,
            total: newTotal,
            weightKg: newWeight,
            enteredWeight: newWeight,
            netWeightKg: newWeight,
            grossWeightKg: newWeight,
            specialNote: i.specialNote || '',
            orderedAt: i.orderedAt || new Date().toISOString()
          };
        }
        return i;
      });
    } else {
      showToast(`${t('addedToOrder', { defaultValue: 'Added to order' })} ${item.name}`, 'success');
      newCart = [...currentCart, { ...item, itemKey, quantity: item.quantity || 1, specialNote: item.specialNote || '', orderedAt: item.orderedAt || new Date().toISOString() }];
    }
    cartRef.current = newCart;
    setCart(newCart);
    lastLocalEditTime.current = Date.now(); // Mark local edit time
    // Mark that user has pending local changes — prevents any background poll
    // from clearing the cart until the user explicitly saves/KOTs/cancels.
    hasPendingLocalChanges.current = true;
    // Clear any stale loading state immediately so items appear without any spinner delay
    setLoading(false);
  };

  const addBoxToCart = (boxItems) => {
    let currentTable = activeTableRef.current || activeTable;
    if (!currentTable) {
      if (billType === 'Takeaway' || billType === 'Delivery') {
        currentTable = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(currentTable);
        activeTableRef.current = currentTable;
        setActiveTable(currentTable);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    if (!Array.isArray(boxItems) || boxItems.length === 0) return;

    const currentCart = cartRef.current || [];
    const newItems = boxItems.map((item, idx) => {
      const itemKey = item.itemKey || `${item._id || item.name}_box${item.boxNumber}_slot${idx}_${Date.now()}`;
      return {
        ...item,
        itemKey,
        quantity: 1,
        specialNote: item.specialNote || '',
        orderedAt: new Date().toISOString()
      };
    });

    const updatedCart = [...currentCart, ...newItems];
    cartRef.current = updatedCart;
    setCart(updatedCart);
    lastLocalEditTime.current = Date.now();
    hasPendingLocalChanges.current = true;
    setLoading(false);
    const boxLabel = boxItems[0]?.boxLabel || `Box #${boxItems[0]?.boxNumber || 1}`;
    showToast(`Added ${boxLabel} (${boxItems.length} items) to order!`, 'success');
  };

  const removeBoxFromCart = (boxNumber) => {
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') return;
    const currentCart = cartRef.current || [];
    const updatedCart = currentCart.filter(i => Number(i.boxNumber) !== Number(boxNumber));
    cartRef.current = updatedCart;
    setCart(updatedCart);
    lastLocalEditTime.current = Date.now();
    hasPendingLocalChanges.current = true;
    showToast(`Removed Box #${boxNumber}`, 'info');
  };

  const updateQuantity = (id, delta) => {
    let currentTable = activeTableRef.current || activeTable;
    if (!currentTable) {
      if (billType === 'Takeaway' || billType === 'Delivery') {
        currentTable = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(currentTable);
        activeTableRef.current = currentTable;
        setActiveTable(currentTable);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    // Strict lock: Billed orders require clicking EDIT first
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const currentCart = cartRef.current || [];
    const newCart = currentCart.map((i) => {
      const idStr = String(id || '').trim().toLowerCase();
      const iKeyStr = String(i.itemKey || '').trim().toLowerCase();
      const iIdStr = String(i._id || '').trim().toLowerCase();
      const iNameStr = String(i.name || '').trim().toLowerCase();
      const match = (iKeyStr && idStr === iKeyStr) || (iIdStr && idStr === iIdStr) || (iNameStr && idStr === iNameStr);

      if (match) {
        const cancelledQty = i.cancelledQuantity || 0;
        const activeQty = Math.max(0, (i.quantity || 0) - cancelledQty);
        const newActiveQty = Math.max(0, activeQty + delta);
        // Store back as historical total + cancelled so BillSummary's (quantity - cancelledQuantity) = newActiveQty
        const newRawQty = newActiveQty + cancelledQty;
        if (newActiveQty === 0) {
          if ((i.printedQuantity || 0) > 0) {
            showToast(`${i.name} marked for cancellation (Print Slip)`, 'info');
          } else {
            showToast(`${i.name} ${t('removedFromOrder')}`, 'info');
          }
        }
        const unitPrice = Number(i.pricePerKg || i.price || 0);
        const newTotal = Number((unitPrice * newActiveQty).toFixed(2));
        const baseUnitWeight = (activeQty > 0 && i.enteredWeight) ? (Number(i.enteredWeight) / activeQty) : Number(i.weightKg || i.enteredWeight || 1);
        const newWeight = Number((baseUnitWeight * newActiveQty).toFixed(3));
        return {
          ...i,
          quantity: newRawQty,
          total: newTotal,
          weightKg: newWeight,
          enteredWeight: newWeight,
          netWeightKg: newWeight,
          grossWeightKg: newWeight,
          specialNote: i.specialNote || ''
        };
      }
      return i;
    }).filter((i) => {
      const cancelledQty = i.cancelledQuantity || 0;
      const activeQty = Math.max(0, (i.quantity || 0) - cancelledQty);
      return activeQty > 0 || (i.printedQuantity || 0) > 0;
    });

    cartRef.current = newCart;
    setCart(newCart);
    lastLocalEditTime.current = Date.now(); // Mark local edit time
    // Mark pending local changes if cart still has items
    if (newCart.length > 0) {
      hasPendingLocalChanges.current = true;
    } else {
      // Cart emptied — no longer pending
      hasPendingLocalChanges.current = false;
      autoSyncOrder(currentTable, [], orderId);
    }
  };

  const updateItemPrice = (id, newPrice) => {
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) return;
    const currentCart = cartRef.current || [];
    const newCart = currentCart.map((i) => {
      const idStr = String(id || '').trim().toLowerCase();
      const iIdStr = String(i._id || '').trim().toLowerCase();
      const iNameStr = String(i.name || '').trim().toLowerCase();
      const match = (iIdStr && idStr === iIdStr) || (iNameStr && idStr === iNameStr);
      if (match) {
        return { ...i, price: parsedPrice };
      }
      return i;
    });
    cartRef.current = newCart;
    setCart(newCart);
    lastLocalEditTime.current = Date.now();
    hasPendingLocalChanges.current = true;
  };

  const updateItemNote = async (identifier, specialNote) => {
    if (orderStatus === 'Paid' || orderStatus === 'Cancelled') {
      showToast(t('orderLocked', { defaultValue: 'Order is locked' }), 'error');
      return;
    }
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanNote = (specialNote || '').trim();

    lastLocalEditTime.current = Date.now();
    hasPendingLocalChanges.current = true;
    setCart((prev) => {
      return prev.map((i) => {
        const iIdStr = String(i._id || '').trim().toLowerCase();
        const iNameStr = String(i.name || '').trim().toLowerCase();
        const match = (iIdStr && cleanId === iIdStr) ||
          (iNameStr && cleanId === iNameStr);
        if (match) return { ...i, specialNote: cleanNote };
        return i;
      });
    });

    showToast(t('Note updated for butcher counter'), 'success');
  };

  // ─── Generate WhatsApp text bill (no DOM / image capture needed) ─────────────
  const generateBillTextMessage = (billData, overrideName = null) => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      const restName = (s.restaurantName || 'Restaurant').trim();
      const billNo = billData?.billNumber || 'PREVIEW';
      const now = new Date(billData?.settledAt || billData?.billedAt || Date.now());
      const dateStr = now.toLocaleDateString('en-GB');
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const bType = billData?.billType || 'Dine-In';
      const isExp = billData?.customerCategory === 'Export' || billData?.orderMode === 'export' || String(billNo).startsWith('EXP-') || String(billData?.tableNo || '').startsWith('EXP-');
      const isWs = !isExp && (billData?.customerCategory === 'Wholesale' || billData?.orderMode === 'bulk' || String(billNo).startsWith('WS-') || String(billData?.tableNo || '').startsWith('WS-') || Number(billData?.totalBoxes || 0) > 0);
      const catTitle = isExp ? 'EXPORT' : (isWs ? 'WHOLESALE' : 'RETAIL');
      const prefix = isExp ? 'EXP-' : (isWs ? 'WS-' : 'RET-');
      const cleanTable = (billData?.tableNo || '').replace(/^TAK-/i, prefix);

      let tableInfo = cleanTable ? `${catTitle} (${cleanTable})` : catTitle;
      if (bType === 'Delivery' || String(billData?.tableNo || '').startsWith('DEL')) {
        tableInfo = `DELIVERY${cleanTable ? ` (${cleanTable})` : ''}`;
      }
      const custName = overrideName || billData?.customerName || '';
      const itemsList = (billData?.items || [])
        .filter(i => !i.isCancelled)
        .map(i => {
          const qty = (i.quantity || 0) - (i.cancelledQuantity || 0);
          if (qty <= 0) return null;
          return `• ${i.name} x ${qty} @ ₹${(i.price || 0).toFixed(2)} = ₹${((i.price || 0) * qty).toFixed(2)}`;
        }).filter(Boolean).join('\n');
      const sub = Number(billData?.subtotal || 0);
      const disc = Number(billData?.discount || 0);
      const taxable = Math.max(0, sub - disc);
      const taxRupees = Number(billData?.total || 0) - taxable - Number(billData?.deliveryCharge || 0) - Number(billData?.containerCharge || 0) - Number(billData?.cuttingCharge || 0);
      const header = custName
        ? `👋 Dear *${custName}*, thank you for dining with us!\n🧾 *e-Bill #${billNo}* | *${restName.toUpperCase()}*`
        : `🧾 *DIGITAL e-BILL RECEIPT* 🧾\n🏨 *${restName.toUpperCase()}* | Bill #${billNo}`;
      const discText = disc > 0 ? `\n• *Discount:* -₹${disc.toFixed(2)}` : '';
      const taxText = taxRupees > 0 ? `\n• *Tax:* +₹${taxRupees.toFixed(2)}` : '';
      const dlvText = Number(billData?.deliveryCharge || 0) > 0 ? `\n• *Delivery:* +₹${Number(billData.deliveryCharge).toFixed(2)}` : '';
      const ctnText = Number(billData?.containerCharge || 0) > 0 ? `\n• *Container:* +₹${Number(billData.containerCharge).toFixed(2)}` : '';
      const cutText = Number(billData?.cuttingCharge || 0) > 0 ? `\n• *Cutting Charges:* +₹${Number(billData.cuttingCharge).toFixed(2)}` : '';
      let payMode = 'Cash';
      const rawMode = billData?.paymentMode || billData?.paymentMethod || 'Cash';
      if (rawMode === 'UPI') {
        const upiApp = billData?.upiApp || billData?.upiAppName || (billData?.paymentMethod !== 'UPI' ? billData?.paymentMethod : '') || '';
        payMode = upiApp && upiApp !== 'UPI' ? `UPI [${upiApp}]` : 'UPI';
      } else if (rawMode === 'Mixed') {
        const split = billData?.splitPayments || billData?.paymentBreakdown;
        if (split) {
          const parts = [];
          if (Number(split.cash || 0) > 0) parts.push(`Cash: ₹${Number(split.cash).toFixed(2)}`);
          if (Number(split.upi || 0) > 0) parts.push(`UPI: ₹${Number(split.upi).toFixed(2)}`);
          if (Number(split.card || 0) > 0) parts.push(`Card: ₹${Number(split.card).toFixed(2)}`);
          payMode = parts.length > 0 ? `Mixed (${parts.join(' | ')})` : 'Mixed';
        } else {
          payMode = 'Mixed Payment';
        }
      } else if (rawMode === 'Card') {
        payMode = 'Card';
      } else if (rawMode === 'Unpaid') {
        payMode = 'Unpaid (Khata)';
      } else {
        payMode = 'Cash';
      }
      const footer = s.footerMessage || '*** Thank You! Visit Again ***';
      return `${header}\n` +
        (s.address ? `📍 ${s.address.split('\n')[0]}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*Bill No:* #${billNo}\n*Date & Time:* ${dateStr}, ${timeStr}\n*Order Type:* ${tableInfo}\n` +
        (custName ? `*Customer:* ${custName}\n` : '') +
        (billData?.customerPhone ? `*Phone:* ${billData.customerPhone}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n🛒 *ITEMS ORDERED:*\n${itemsList}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n• *Subtotal:* ₹${sub.toFixed(2)}` +
        discText + taxText + dlvText + ctnText + cutText +
        `\n• *GRAND TOTAL:* *₹${Number(billData?.total || 0).toFixed(2)}*\n• *Payment Mode:* ${payMode}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n_${footer}_`;
    } catch (e) { return ''; }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSaveOrder = async (isHold = false, overrideItems = null) => {
    const isHoldStrict = isHold === true;
    setActionLoading(isHoldStrict ? 'hold' : 'save');
    let currentTable = activeTableRef.current || activeTable;
    if (!currentTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        activeTableRef.current = generatedOrderNo;
        setActiveTable(generatedOrderNo);
        setTimeout(() => handleSaveOrderWithTable(generatedOrderNo, isHoldStrict, overrideItems), 50);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        setActionLoading(null);
        return;
      }
    } else {
      handleSaveOrderWithTable(currentTable, isHoldStrict, overrideItems);
    }
  };

  const handleSaveOrderWithTable = async (tableNo, isHold = false, overrideItems = null) => {
    const currentCart = (overrideItems && Array.isArray(overrideItems) && overrideItems.length > 0)
      ? overrideItems
      : ((cartRef.current && cartRef.current.length > 0) ? cartRef.current : cart);

    if (!currentCart || currentCart.length === 0) {
      showToast(t('pleaseAddItemsToOrder'), 'warning');
      setActionLoading(null);
      return;
    }

    const isHoldStrict = isHold === true;
    const actionType = isHoldStrict ? 'hold' : 'save';
    setActionLoading(actionType);

    const isUpdate = !!(orderId && !orderId.startsWith('offline_'));
    lastLocalEditTime.current = Date.now();

    const orderData = {
      tableNo: tableNo,
      items: currentCart,
      billType: billType || (fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail')),
      orderChannel: fishOrderMode === 'bulk' ? 'Wholesale-Box' : (fishOrderMode === 'export' ? 'Online-Delivery' : 'Counter-Retail'),
      orderMode: fishOrderMode,
      customerName,
      customerPhone,
      customerCategory: customerCategory || (fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail')),
      exportSubCategory: exportSubCategory || (fishOrderMode === 'export' ? 'Local' : null),
      customerPhoto: customerPhoto || '',
      customerAddress: customerAddress || '',
      isOrderLocked: isOrderLocked || false,
      orderLockedAt: isOrderLocked ? new Date() : null,
      orderDateFormatted: lockedTimestamp ? lockedTimestamp.split(',')[0]?.trim() : '',
      orderTimeFormatted: lockedTimestamp ? lockedTimestamp.split(',')[1]?.trim() : '',
      discount: discountAmount,
      discountType: discount.type,
      discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
      discountName: discount.name || discount.offerName || '',
      applicableTo: discount.applicableTo || 'all',
      targetCategory: discount.targetCategory || '',
      tax: taxVal,
      deliveryCharge: parseFloat(deliveryCharge || 0),
      containerCharge: parseFloat(containerCharge || 0),
      cuttingCharge: fishOrderMode === 'individual' ? parseFloat(cuttingCharge || 0) : 0,
      isHold: isHoldStrict,
      skipNotification: !isHoldStrict, // Frontend already broadcast instantly via WebSocket — skip backend duplicate
      ...(orderId && !orderId.startsWith('offline_') && { id: orderId }),
      ...(billType === 'Delivery' && { orderSource })
    };

    try {
      // ⚡⚡ INSTANT 0ms OPTIMISTIC NOTIFICATION — broadcast via existing WebSocket BEFORE the API call.
      // All other screens (KDS, Captain tablet, Cashier PC) receive this in <10ms.
      // This is the same pattern used by WhatsApp/Slack for instant feel.
      if (!isHoldStrict) {
        // Check Global Live Notifications setting - if OFF, skip the broadcast entirely
        const _rs = (() => { try { return JSON.parse(localStorage.getItem('restaurantSettings') || '{}'); } catch (e) { return {}; } })();
        const globalNotifEnabled = _rs.enableGlobalNotifications !== false;

        if (globalNotifEnabled) {
          const tenantDb = localStorage.getItem('resto_db_name');
          // Build item summary from cart - e.g. "1x Biryani, 2x Butter Chicken"
          const activeCartItems = cart.filter(i => !i.isCancelled && Number(i.quantity || 0) > 0);
          let itemSummary = '';
          if (activeCartItems.length > 0) {
            const parts = activeCartItems.map(i => `${i.quantity}x ${i.name}`);
            const joined = parts.join(', ');
            itemSummary = joined.length > 80 ? joined.substring(0, 77) + '...' : joined;
          }
          const notifMessage = isUpdate
            ? `Order for ${tableNo} updated${itemSummary ? ' - ' + itemSummary : ''}`
            : `New order for ${tableNo}${itemSummary ? ' - ' + itemSummary : ''}`;

          realtimeService.broadcastNotification({
            title: isUpdate ? 'Order Updated' : 'New Order Placed',
            message: notifMessage,
            type: isUpdate ? 'info' : 'success',
            targetRoles: ['Manager', 'Admin', 'Captain', 'Cashier'],
            tenantDb,
            data: { tableNo, type: isUpdate ? 'order_updated' : 'new_order', optimistic: true }
          });
        }
      }

      // ⚡ Server save (DB persistence happens in background after notification already delivered)
      const savedOrder = await saveOrder(orderData);
      if (savedOrder) {
        // Silently reconcile orderId and cart with server-confirmed values
        if (savedOrder._id) setOrderId(savedOrder._id);
        if (tableNo !== activeTable) setActiveTable(tableNo);
        if (savedOrder.discountType || savedOrder.discountValue !== undefined || savedOrder.discountName) {
          setDiscount({
            type: savedOrder.discountType || discount.type || 'flat',
            value: savedOrder.discountValue !== undefined && savedOrder.discountValue !== null ? savedOrder.discountValue : discount.value,
            name: savedOrder.discountName || discount.name || '',
            applicableTo: savedOrder.applicableTo || discount.applicableTo || 'all',
            targetCategory: savedOrder.targetCategory || discount.targetCategory || ''
          });
        }
        if (savedOrder.items && savedOrder.items.length > 0) {
          const kotStatusMap = {};
          if (savedOrder.kots && Array.isArray(savedOrder.kots)) {
            savedOrder.kots.forEach(kot => {
              (kot.items || []).forEach(kItem => {
                if (kItem.name) kotStatusMap[kItem.name] = kItem.status;
                if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
              });
            });
          }
          const confirmedItems = savedOrder.items
            .filter(i => i.quantity > 0 || i.isCancelled)
            .map(i => ({ ...i, status: kotStatusMap[i._id?.toString()] || kotStatusMap[i.name] || i.status }));
          setCart(confirmedItems);
          cartRef.current = confirmedItems;
        }
        lastLocalEditTime.current = Date.now();
        if (savedOrder._id) {
          setOpenOrdersList(prev => {
            const list = Array.isArray(prev) ? prev : [];
            const idx = list.findIndex(o => (savedOrder._id && o._id === savedOrder._id) || isTableMatching(o.tableNo, savedOrder.tableNo));
            if (idx !== -1) {
              const updated = [...list];
              updated[idx] = { ...updated[idx], ...savedOrder };
              return updated;
            }
            return [savedOrder, ...list];
          });
        }
        if (onOrderUpdate) onOrderUpdate();
      }
      hasPendingLocalChanges.current = false;
      const successMsg = isHoldStrict
        ? 'Order placed on hold'
        : (isUpdate ? 'Order updated successfully' : 'Order saved successfully');
      showToast(successMsg, 'success');
    } catch (error) {
      console.error('Error saving order (background):', error);
      showToast(`${t('failedToSave')}: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // HOLD = SAVE: backend always stores with status 'Open' and marks table Occupied.
  // The "Hold Bills" counter in the header reflects all saved-but-unpaid Open orders.
  const handleHoldOrder = () => {
    handleSaveOrder(true);
  };

  const handleReopenOrder = async () => {
    if (!orderId && cart.length === 0) return;
    // ⚡ INSTANT OPTIMISTIC UNLOCK (0ms): Immediately unlock UI so cashier never waits
    setOrderStatus('Open');
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
    showToast(t('Order unlocked for editing', { defaultValue: 'Order unlocked for editing' }), 'success');

    // Notify backend and active order list in the background without blocking the UI
    if (orderId && !orderId.startsWith('offline_')) {
      apiReopenOrder(orderId).then(() => {
        if (onOrderUpdate) onOrderUpdate();
      }).catch(err => {
        console.error('Error reopening order for edit on server:', err);
      });
    } else {
      if (onOrderUpdate) onOrderUpdate();
    }
  };

  const handleDiscountChange = (val) => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setDiscount(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  const handleDeliveryChargeChange = (val) => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setDeliveryCharge(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  const handleContainerChargeChange = (val) => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setContainerCharge(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  const handleCuttingChargeChange = (val) => {
    if (fishOrderMode !== 'individual') {
      setCuttingCharge('0');
      setIsCuttingChargeEnabled(false);
      return;
    }
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is billed. Click EDIT to modify.', { defaultValue: 'Order is billed. Click EDIT to modify.' }), 'warning');
      return;
    }
    setCuttingCharge(val);
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
  };

  // Configurable & Species-Aware cutting charge calculation:
  // Cutting charges apply EXCLUSIVELY to Retail orders - NEVER in Wholesale or Export!
  const calculateCuttingCharge = (weightKg, ratePerKg = 10) => {
    if (fishOrderMode !== 'individual') return 0;
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      const baseRate = Number(ratePerKg) || (Number(s.cuttingChargePerKg) > 0 ? Number(s.cuttingChargePerKg) : 10);
      const tiers = s.cuttingTiers || [
        { label: 'Tier 1', maxKg: 1.5, multiplier: 1 },
        { label: 'Tier 2', maxKg: 2.5, multiplier: 2 },
        { label: 'Tier 3', maxKg: 3.5, multiplier: 3 },
        { label: 'Extra', extraPerKg: true, multiplier: 1 }
      ];
      const tier1Max = Number(tiers[0]?.maxKg) || 1.5;
      const tier2Max = Number(tiers[1]?.maxKg) || 2.5;
      const tier3Max = Number(tiers[2]?.maxKg) || 3.5;

      const w = Number(weightKg) || 0;
      if (w <= 0) return 0;
      if (w <= tier1Max) return baseRate;
      if (w <= tier2Max) return baseRate * 2;
      if (w <= tier3Max) return baseRate * 3;
      return baseRate * (3 + Math.ceil(w - tier3Max));
    } catch {
      const w = Number(weightKg) || 0;
      const rate = Number(ratePerKg) || 10;
      if (w <= 0) return 0;
      if (w <= 1.5) return rate;
      return (1 + Math.ceil(w - 1.5)) * rate;
    }
  };

  const totalCartFishWeight = useMemo(() => {
    // Only Retail orders have cutting charges
    if (fishOrderMode !== 'individual') return 0;
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      const speciesToggles = s.cuttingSpeciesToggles || { fish: true, prawn: true, crab: true };
      return cart.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        if (item.orderMode && item.orderMode !== 'individual') return sum;
        const sp = (item.speciesType || 'fish').toLowerCase();
        if (speciesToggles[sp] === false) return sum;

        // 1. Skip Whole / uncut fish (bought whole without cutting)
        const cut = (item.cutType || item.cuttingStyle || '').toLowerCase();
        const rawName = (item.name || '').toLowerCase();
        if (cut.includes('whole') || rawName.includes('(whole') || rawName.includes('- whole')) {
          return sum;
        }

        // 2. Skip if cutting charges are explicitly toggled OFF / stopped for this fish
        if (item.customCuttingChargeEnabled === false) {
          return sum;
        }

        const w = parseFloat(item.enteredWeight || item.netWeightKg || item.weightKg || (item.sellingUnit === 'Kg' ? item.quantity : 0) || 0);
        return sum + w;
      }, 0);
    } catch {
      return cart.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        if (item.orderMode && item.orderMode !== 'individual') return sum;
        const cut = (item.cutType || item.cuttingStyle || '').toLowerCase();
        const rawName = (item.name || '').toLowerCase();
        if (cut.includes('whole') || rawName.includes('(whole') || rawName.includes('- whole')) return sum;
        if (item.customCuttingChargeEnabled === false) return sum;
        const w = parseFloat(item.enteredWeight || item.netWeightKg || item.weightKg || (item.sellingUnit === 'Kg' ? item.quantity : 0) || 0);
        return sum + w;
      }, 0);
    }
  }, [cart, fishOrderMode]);

  const activeCuttingRate = useMemo(() => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      return Number(s.cuttingChargePerKg) > 0 ? Number(s.cuttingChargePerKg) : 10;
    } catch { return 10; }
  }, []);

  // Force reset cutting charge whenever switching to Wholesale or Export mode
  useEffect(() => {
    if (fishOrderMode !== 'individual') {
      if (cuttingCharge !== '0' && cuttingCharge !== 0 && cuttingCharge !== '') {
        setCuttingCharge('0');
      }
      if (isCuttingChargeEnabled) {
        setIsCuttingChargeEnabled(false);
      }
    }
  }, [fishOrderMode]);

  useEffect(() => {
    // Strictly zero out cutting charges in Wholesale or Export
    if (fishOrderMode !== 'individual') {
      if (cuttingCharge !== '0' && cuttingCharge !== 0 && cuttingCharge !== '') {
        setCuttingCharge('0');
      }
      if (isCuttingChargeEnabled) {
        setIsCuttingChargeEnabled(false);
      }
      return;
    }

    // If no eligible fish weight for cutting in cart (or whole fish / stopped fish), force 0 cutting charge
    if (totalCartFishWeight === 0) {
      if (cuttingCharge !== '0' && cuttingCharge !== 0 && cuttingCharge !== '') {
        setCuttingCharge('0');
      }
      return;
    }

    if (isCuttingChargeEnabled && totalCartFishWeight > 0) {
      // Calculate taking into account custom per-item / per-grade cutting charges
      try {
        const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        const speciesToggles = s.cuttingSpeciesToggles || { fish: true, prawn: true, crab: true };
        const baseRate = activeCuttingRate;
        const tiers = s.cuttingTiers || [
          { label: 'Tier 1', maxKg: 1.5, multiplier: 1 },
          { label: 'Tier 2', maxKg: 2.5, multiplier: 2 },
          { label: 'Tier 3', maxKg: 3.5, multiplier: 3 },
          { label: 'Extra', extraPerKg: true, multiplier: 1 }
        ];
        const tier1Max = Number(tiers[0]?.maxKg) || 1.5;
        const tier2Max = Number(tiers[1]?.maxKg) || 2.5;
        const tier3Max = Number(tiers[2]?.maxKg) || 3.5;

        let customTotal = 0;
        let standardWeight = 0;

        cart.forEach(item => {
          if (item.isCancelled) return;
          if (item.orderMode && item.orderMode !== 'individual') return;
          const sp = (item.speciesType || 'fish').toLowerCase();
          if (speciesToggles[sp] === false) return;

          // 1. Whole fish is uncut - strictly 0 cutting charge
          const cut = (item.cutType || item.cuttingStyle || '').toLowerCase();
          const rawName = (item.name || '').toLowerCase();
          if (cut.includes('whole') || rawName.includes('(whole') || rawName.includes('- whole')) {
            return;
          }

          // 2. Explicitly toggled OFF / stopped for this fish
          if (item.customCuttingChargeEnabled === false) {
            return;
          }

          const w = parseFloat(item.enteredWeight || item.netWeightKg || item.weightKg || (item.sellingUnit === 'Kg' ? item.quantity : 0) || 0);
          if (w <= 0) return;

          const gradeKey = item.sizeGrade || 'medium';
          const gradeCut = parseFloat(item.sizeGrades?.[gradeKey]?.cuttingCharge);
          const itemCut = parseFloat(item.cuttingCharge);
          const cutRate = gradeCut > 0 ? gradeCut : (itemCut > 0 ? itemCut : 0);

          if (item.customCuttingChargeEnabled) {
            if (cutRate > 0) {
              const steps = w <= tier1Max ? 1 : (1 + Math.ceil(w - tier1Max));
              customTotal += steps * cutRate;
            } else {
              // Explicitly 0 cutting charge for this item
              return;
            }
          } else {
            standardWeight += w;
          }
        });

        let standardCharge = 0;
        if (standardWeight > 0) {
          if (standardWeight <= tier1Max) standardCharge = baseRate;
          else if (standardWeight <= tier2Max) standardCharge = baseRate * 2;
          else if (standardWeight <= tier3Max) standardCharge = baseRate * 3;
          else standardCharge = baseRate * (3 + Math.ceil(standardWeight - tier3Max));
        }

        const calculated = Math.round(customTotal + standardCharge);
        setCuttingCharge(String(calculated));
      } catch {
        const calculated = calculateCuttingCharge(totalCartFishWeight, activeCuttingRate);
        setCuttingCharge(String(calculated));
      }
    } else if (isCuttingChargeEnabled && totalCartFishWeight === 0) {
      setCuttingCharge('0');
    }
  }, [isCuttingChargeEnabled, totalCartFishWeight, activeCuttingRate, cart, fishOrderMode]);

  // Immediately resets all state for a clean NEW ORDER (no premature placeholder numbers)
  const handleCreateNewOrder = useCallback(() => {
    // ⚡ 0ms instant reset of cart and order states
    setActiveTable('');
    setCart([]);
    cartRef.current = [];
    hasPendingLocalChanges.current = false;
    lastLocalEditTime.current = Date.now();
    setOrderId(null);
    setOrderStatus('Open');
    setBillNumber(null);
    setCompletedBill(null);

    // Reset customer, discount, extra charges
    setDiscount({ type: 'percentage', value: '', name: '' });
    setCustomerPhone('');
    setCustomerName('');
    setCustomerInfo(null);
    setIsOrderLocked(false);
    setLockedTimestamp('');
    setCustomerPhoto('');
    setCustomerAddress('');
    setCustomerCategory(fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail'));
    setExportSubCategory(fishOrderMode === 'export' ? 'Local' : null);
    setDeliveryCharge('');
    setContainerCharge('');
    setCuttingCharge('');
    setIsCuttingChargeEnabled(false);
    setIsPaid(false);

    try {
      sessionStorage.removeItem('ms_initial_table');
      sessionStorage.setItem('ms_initial_action', 'new');
    } catch (e) { }

    // Switch to menu tab on mobile
    setMobileTab('menu');

    showToast(t('newOrder'), 'success');
  }, [showToast, t, fishOrderMode]);

  // Seamlessly switch order mode (Retail / Wholesale / Export) and navigate directly to a fresh NEW ORDER
  const handleSwitchOrderMode = useCallback((targetMode) => {
    setFishOrderMode(targetMode);

    // Cleanly reset order and cart so switching modes always navigates to clean New Order page
    setActiveTable('');
    setCart([]);
    cartRef.current = [];
    hasPendingLocalChanges.current = false;
    lastLocalEditTime.current = Date.now();
    setOrderId(null);
    setOrderStatus('Open');
    setBillNumber(null);
    setCompletedBill(null);

    // Reset customer, discount, extra charges
    setDiscount({ type: 'percentage', value: '', name: '' });
    setCustomerPhone('');
    setCustomerName('');
    setCustomerInfo(null);
    setIsOrderLocked(false);
    setLockedTimestamp('');
    setCustomerPhoto('');
    setCustomerAddress('');
    setCustomerCategory(targetMode === 'bulk' ? 'Wholesale' : (targetMode === 'export' ? 'Export' : 'Retail'));
    setExportSubCategory(targetMode === 'export' ? 'Local' : null);
    setDeliveryCharge('');
    setContainerCharge('');
    setCuttingCharge('');
    setIsCuttingChargeEnabled(false);
    setIsPaid(false);

    try {
      sessionStorage.removeItem('ms_initial_table');
      sessionStorage.setItem('ms_initial_action', 'new');
    } catch (e) { }

    setMobileTab('menu');
  }, []);

  const handleGenerateBill = async (overrideItems = null) => {
    let tableToUse = activeTableRef.current || activeTable;
    if (!tableToUse) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        tableToUse = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(tableToUse);
        activeTableRef.current = tableToUse;
        setActiveTable(tableToUse);
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        return;
      }
    }

    const currentCart = (overrideItems && Array.isArray(overrideItems) && overrideItems.length > 0)
      ? overrideItems
      : ((cartRef.current && cartRef.current.length > 0) ? cartRef.current : cart);

    if (!currentCart || currentCart.length === 0) {
      showToast(t('pleaseAddItemsToOrder'), 'warning');
      return;
    }

    const currentSubtotal = currentCart.reduce((sum, item) => sum + (Number(item.price || 0) * (Number(item.quantity) || 1)), 0);
    const activeCutting = fishOrderMode === 'individual' ? (parseFloat(cuttingCharge) || 0) : 0;
    const currentTotal = Math.max(0, currentSubtotal - (parseFloat(discountAmount) || 0) + (parseFloat(taxVal) || 0) + (parseFloat(deliveryCharge) || 0) + (parseFloat(containerCharge) || 0) + activeCutting);

    // If order is ALREADY billed, open the invoice preview INSTANTLY.
    // If completedBill is already in memory, show it immediately with zero delay.
    // Then silently refresh from backend in the background if needed.
    if (orderStatus === 'Billed' && orderId && !hasPendingLocalChanges.current) {
      showToast(t('Bill already saved and printed'), 'info');
      // Instant open — use whatever we have in memory first
      isViewingInvoiceRef.current = true;
      setShowInvoice(true);
      // Then silently fetch fresh data in background if completedBill is stale
      if (!completedBill || completedBill._id !== orderId) {
        api.get(`/bills/${orderId}`).then(resp => {
          if (resp.data) setCompletedBill(resp.data);
        }).catch(() => { });
      }
      return;
    }

    setActionLoading('print');

    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      // ⚡ STRIP 300KB BASE64 LOGO FROM NETWORK PAYLOAD (99.4% payload reduction)
      const { logo, ...restDetailsNoLogo } = s;

      const cRate = s.enableCgst !== false ? s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5 : 0;
      const sRate = s.enableSgst !== false ? s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5 : 0;
      const gRate = s.enableGst === true ? s.gstRate !== undefined ? Number(s.gstRate) : 5 : 0;
      const totRate = cRate + sRate + gRate;

      let cAmt = 0, sAmt = 0, gAmt = 0;
      if (totRate > 0) {
        cAmt = taxVal * (cRate / totRate) || 0;
        sAmt = taxVal * (sRate / totRate) || 0;
        gAmt = taxVal * (gRate / totRate) || 0;
      }

      const billData = {
        tableNo: tableToUse,
        items: currentCart, // ⚡ Pass latest items directly — backend generates/updates bill in ONE single atomic call!
        subtotal: currentSubtotal,
        discount: discountAmount,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        discountName: discount.name || discount.offerName || '',
        applicableTo: discount.applicableTo || 'all',
        targetCategory: discount.targetCategory || '',
        tax: taxVal,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        cuttingCharge: fishOrderMode === 'individual' ? parseFloat(cuttingCharge || 0) : 0,
        total: currentTotal,
        billType,
        orderSource: billType === 'Delivery' ? orderSource : undefined,
        customerName: customerName || (openOrdersList?.find(o => isTableMatching(o.tableNo, tableToUse))?.customerName || ''),
        customerPhone: customerPhone || (openOrdersList?.find(o => isTableMatching(o.tableNo, tableToUse))?.customerPhone || ''),
        restaurantDetails: restDetailsNoLogo,
        taxBreakdown: {
          cgst: cAmt,
          sgst: sAmt,
          igst: gAmt
        },
        showLogo: (() => {
          try {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            return s.showLogo !== false;
          } catch (e) { return true; }
        })()
      };

      const targetId = (orderId && !orderId.startsWith('offline_')) ? orderId : 'new';

      // ⚡ INSTANT PREVIEW: Always show invoice preview immediately without waiting for network roundtrip
      const activePrefix = fishOrderMode === 'export' ? 'EXP' : fishOrderMode === 'bulk' ? 'WHL' : 'RET';
      const optimisticBillNumber = billNumber || `${activePrefix}-${Date.now().toString().slice(-4)}`;
      const optimisticBillData = {
        ...billData,
        _id: targetId,
        items: currentCart,
        restaurantDetails: s,
        billNumber: optimisticBillNumber,
        status: 'Billed',
        billedAt: new Date(),
        createdAt: new Date()
      };
      setCompletedBill(optimisticBillData);
      setBillNumber(optimisticBillNumber);
      setOrderStatus('Billed');
      isViewingInvoiceRef.current = true;
      setShowInvoice(true);

      // ⚡ Direct dynamic execution - pure server response time
      const billedOrder = await generateBill(targetId, billData);
      if (billedOrder) {
        const confirmedBillNumber = billedOrder?.billNumber || 'MS0001';
        if (billedOrder?._id) {
          setOrderId(billedOrder._id);
          upsertCachedOpenOrder(billedOrder).catch(() => { });
        }
        removeClearedTableRecord(tableToUse);
        const billedData = {
          ...billedOrder,
          items: (currentCart && currentCart.length > 0) ? currentCart : (billedOrder.items || []),
          tableNo: billedOrder.tableNo || tableToUse,
          subtotal: currentSubtotal || billedOrder.subtotal,
          tax: taxVal || billedOrder.tax,
          discount: discountAmount || billedOrder.discount,
          total: currentTotal || billedOrder.total,
          billType: billType || billedOrder.billType,
          orderSource: orderSource || billedOrder.orderSource,
          customerName: customerName || billedOrder.customerName || '',
          customerPhone: customerPhone || billedOrder.customerPhone || '',
          deliveryCharge: deliveryCharge,
          containerCharge: containerCharge,
          cuttingCharge: fishOrderMode === 'individual' ? cuttingCharge : 0,
          restaurantDetails: s,
          billNumber: confirmedBillNumber,
          status: 'Billed',
          billedAt: billedOrder.billedAt || new Date(),
          createdAt: billedOrder.createdAt || new Date()
        };
        setBillNumber(confirmedBillNumber);
        setCompletedBill(billedData);
        setOrderStatus('Billed');
        hasPendingLocalChanges.current = false;
        try {
          sessionStorage.setItem('ms_invoice_open', 'true');
          sessionStorage.setItem('ms_completed_bill', JSON.stringify(billedData));
        } catch (e) { }

        // Save & Print displays print receipt preview exclusively (no auto-send popup)
        setAutoSendWhatsAppToInvoice(false);

        isViewingInvoiceRef.current = true;
        setShowInvoice(true);
        fetchDailyStats();
        if (onOrderUpdate) onOrderUpdate();
        // ⚡ Parallel notification & toast arrival
        showToast(t('Bill saved & printed successfully', { defaultValue: 'Bill saved & printed successfully' }), 'success');
      }
    } catch (error) {
      console.error('Error generating bill:', error);

      if (error.response?.status === 400 && error.response?.data?.message?.includes('already billed')) {
        try {
          const ordToFetch = orderId;
          let order = null;
          if (ordToFetch && !ordToFetch.startsWith('offline_')) {
            try {
              const resp = await api.get(`/bills/${ordToFetch}`);
              order = resp.data;
            } catch (e) {
              if (tableToUse) order = await getActiveOrder(tableToUse);
            }
          } else if (tableToUse) {
            order = await getActiveOrder(tableToUse);
          }
          if (order && (order.status === 'Billed' || order.status === 'Paid')) {
            setOrderStatus(order.status);
            setBillNumber(order.billNumber);
            const currentSettings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            setCompletedBill({
              ...order,
              restaurantDetails: {
                ...(order.restaurantDetails || currentSettings),
                logo: (currentSettings.logo && currentSettings.logo !== '[logo_stored]') ? currentSettings.logo : (order.restaurantDetails?.logo || '')
              }
            });
            isViewingInvoiceRef.current = true;
            setShowInvoice(true);
            showToast(t('recoveredExistingBill'), 'info');
            return;
          }
        } catch (fetchError) {
          console.error('Error recovering order state:', fetchError);
        }
      }

      const errorMessage = error.response?.data?.message || error.message;
      showToast(`${t('failedToGenerateBill')}: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
      setActionLoading(null);
    }
  };

  const handleSettleBill = (paymentData) => {
    completeSettlement(paymentData);
  };

  const completeSettlement = async (paymentData) => {
    if (orderStatus === 'Paid') {
      showToast(t('billAlreadySettled'), 'info');
      setShowPayment(false);
      setShowInvoice(true);
      return;
    }

    let tableToUse = activeTable;
    if (!tableToUse) {
      tableToUse = generateSequentialOrderNo(billType);
      newlyGeneratedTables.current.add(tableToUse);
      setActiveTable(tableToUse);
    }

    setActionLoading('settle');

    const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
    const { logo, ...restDetailsNoLogo } = s;
    const cRate = s.enableCgst !== false ? s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5 : 0;
    const sRate = s.enableSgst !== false ? s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5 : 0;
    const gRate = s.enableGst === true ? s.gstRate !== undefined ? Number(s.gstRate) : 5 : 0;
    const totRate = cRate + sRate + gRate;
    let cAmt = 0, sAmt = 0, gAmt = 0;
    if (totRate > 0) {
      cAmt = taxVal * (cRate / totRate) || 0;
      sAmt = taxVal * (sRate / totRate) || 0;
      gAmt = taxVal * (gRate / totRate) || 0;
    }

    const optimisticBillNumber = billNumber || `MS${Date.now().toString().slice(-4)}`;

    const optimisticBill = {
      items: cart || [],
      status: paymentData.mode === 'Unpaid' ? 'Unpaid' : 'Paid',
      paymentMode: paymentData.mode === 'Unpaid' ? undefined : paymentData.mode,
      splitPayments: paymentData.splitPayments,
      amountPaid: paymentData.amountPaid,
      upiApp: paymentData.upiApp,
      billNumber: optimisticBillNumber,
      tableNo: tableToUse,
      subtotal,
      tax: taxVal,
      discount: discountAmount,
      walletRedemption,
      total,
      billType,
      orderSource: billType === 'Delivery' ? orderSource : undefined,
      customerName: customerName || (openOrdersList?.find(o => isTableMatching(o.tableNo, tableToUse))?.customerName || ''),
      customerPhone: customerPhone || (openOrdersList?.find(o => isTableMatching(o.tableNo, tableToUse))?.customerPhone || ''),
      deliveryCharge,
      containerCharge,
      cuttingCharge,
      restaurantDetails: s,
      showLogo: s.showLogo !== false,
      settledAt: new Date(),
      createdAt: new Date()
    };

    // ⚡ INSTANT 0ms RESPONSE: Show Payment Success Screen & Print Preview IMMEDIATELY on click!
    setShowPayment(false);
    setOrderStatus(optimisticBill.status);
    hasPendingLocalChanges.current = false;
    setSuccessPaymentData({ paymentData, billData: optimisticBill });
    setShowSuccessScreen(true);
    setShowInvoice(true);
    try {
      sessionStorage.setItem('ms_invoice_open', 'true');
      sessionStorage.setItem('ms_completed_bill', JSON.stringify(optimisticBill));
    } catch (e) { }

    // Build full settlement payload for server
    const settlementPayload = {
      tableNo: tableToUse,
      items: cart,
      subtotal,
      total,
      tax: taxVal,
      taxBreakdown: { cgst: cAmt, sgst: sAmt, igst: gAmt },
      discount: discountAmount,
      discountType: discount.type,
      discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
      discountName: discount.name || discount.offerName || '',
      walletRedemption,
      billType,
      orderSource: billType === 'Delivery' ? orderSource : undefined,
      customerPhone: optimisticBill.customerPhone,
      customerName: optimisticBill.customerName,
      deliveryCharge: parseFloat(deliveryCharge || 0),
      containerCharge: parseFloat(containerCharge || 0),
      restaurantDetails: restDetailsNoLogo,
      paymentMode: paymentData.mode,
      status: paymentData.mode === 'Unpaid' ? 'Unpaid' : undefined,
      splitPayments: paymentData.splitPayments,
      amountPaid: paymentData.amountPaid,
      upiApp: paymentData.upiApp,

      showLogo: (() => {
        try {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          return s.showLogo !== false;
        } catch (e) { return true; }
      })()
    };

    try {
      if (directPrintConfigs.settle) {
        const optimisticSettleBill = { ...optimisticBill, status: 'Paid', paymentMode: paymentData.mode, amountPaid: paymentData.amountPaid, billNumber: billNumber || 'MS0001', tableNo: tableToUse, subtotal, tax: taxVal, discount: discountAmount, total, billType, customerName, customerPhone, deliveryCharge, containerCharge, cuttingCharge: fishOrderMode === 'individual' ? cuttingCharge : 0, restaurantDetails: { ...s }, settledAt: new Date(), createdAt: new Date() };
        setCompletedBill(optimisticSettleBill);
        isViewingInvoiceRef.current = true;
        setShowInvoice(true);
      }

      // ⚡ Direct dynamic execution - pure server response time in background
      const settledOrder = await settleBill(orderId || 'new', settlementPayload);
      const confirmedBillNumber = settledOrder?.billNumber || optimisticBillNumber;
      if (confirmedBillNumber) {
        setBillNumber(confirmedBillNumber);
      }

      const confirmedBill = {
        ...optimisticBill,
        ...(settledOrder || {}),
        items: (cart && cart.length > 0) ? cart : (settledOrder?.items || []),
        status: paymentData.mode === 'Unpaid' ? 'Unpaid' : 'Paid',
        paymentMode: paymentData.mode === 'Unpaid' ? undefined : paymentData.mode,
        splitPayments: paymentData.splitPayments || settledOrder?.splitPayments,
        amountPaid: paymentData.amountPaid || settledOrder?.amountPaid,
        upiApp: paymentData.upiApp || settledOrder?.upiApp,
        walletRedemption: paymentData.walletRedemption || settledOrder?.walletRedemption || 0,
        billNumber: confirmedBillNumber,
        tableNo: tableToUse,
        subtotal,
        tax: taxVal,
        discount: discountAmount,
        total,
        billType,
        orderSource: billType === 'Delivery' ? orderSource : undefined,
        customerName: customerName || settledOrder?.customerName || optimisticBill.customerName,
        customerPhone: customerPhone || settledOrder?.customerPhone || optimisticBill.customerPhone,
        deliveryCharge,
        containerCharge,
        cuttingCharge: fishOrderMode === 'individual' ? cuttingCharge : 0,
        restaurantDetails: {
          ...(settledOrder?.restaurantDetails || s),
          logo: (s.logo && s.logo !== '[logo_stored]') ? s.logo : (settledOrder?.restaurantDetails?.logo || '')
        },
        settledAt: settledOrder?.settledAt || new Date(),
        createdAt: settledOrder?.createdAt || new Date()
      };

      isViewingInvoiceRef.current = true;
      setCompletedBill(confirmedBill);
      setSuccessPaymentData({ paymentData, billData: confirmedBill });

      // Instant Auto-send WhatsApp e-Bill (Fires in background immediately when Settle is clicked)
      const alreadySent = Boolean(settledOrder?.whatsappSent || (confirmedBillNumber && isBillAlreadySent(confirmedBillNumber)));
      const phoneToSend = (confirmedBill.customerPhone || settledOrder?.customerPhone || '').trim();
      const isModeAutoEnabled = getAutoWaForCurrentMode(fishOrderMode);
      const shouldAutoSend = Boolean((isModeAutoEnabled || autoWhatsappEnabled) && !alreadySent && phoneToSend.length >= 10);
      if (shouldAutoSend) {
        setTimeout(() => triggerInstantWhatsAppAutoSend(confirmedBill), 0);
      }
      setAutoSendWhatsAppToInvoice(false);

      try {
        sessionStorage.setItem('ms_invoice_open', 'true');
        sessionStorage.setItem('ms_completed_bill', JSON.stringify(confirmedBill));
      } catch (e) { }

      if (settledOrder?._id) removeCachedOpenOrder(settledOrder._id).catch(() => { });
      if (tableToUse) {
        removeCachedOpenOrder(tableToUse).catch(() => { });
        if (billType === 'Dine-In') {
          try {
            const clearedMap = JSON.parse(localStorage.getItem('msbillings_cleared_tables') || '{}');
            const nowIso = new Date().toISOString();
            clearedMap[tableToUse.trim().toLowerCase()] = nowIso;
            // Also store short table name if prefixed (e.g. Ground Floor - Table 3 -> table 3)
            if (tableToUse.includes(' - ')) {
              const shortName = tableToUse.split(' - ').pop().trim().toLowerCase();
              clearedMap[shortName] = nowIso;
            }
            localStorage.setItem('msbillings_cleared_tables', JSON.stringify(clearedMap));
            window.dispatchEvent(new CustomEvent('tableCleared', { detail: { tableNo: tableToUse, clearedAt: nowIso } }));
          } catch (e) { }
        }
      }
      fetchDailyStats();
      if (onOrderUpdate) onOrderUpdate();

      // ⚡ Optimistic Notification: Arrives instantly when settlement finishes
      const _rs = (() => { try { return JSON.parse(localStorage.getItem('restaurantSettings') || '{}'); } catch (e) { return {}; } })();
      const globalNotifEnabled = _rs.enableGlobalNotifications !== false;
      if (globalNotifEnabled) {
        const tenantDb = localStorage.getItem('resto_db_name');
        const cleanTable = (tableToUse || '').replace(/^Table\s*/i, '');
        const notifMessage = billType === 'Dine-In'
          ? `Bill of ₹${total || 0} for Table ${cleanTable} settled`
          : `Bill of ₹${total || 0} settled (${billType || 'Takeaway'})`;

        realtimeService.broadcastNotification({
          title: 'Bill Settled',
          message: notifMessage,
          type: 'success',
          targetRoles: ['Manager', 'Admin', 'Cashier'],
          tenantDb,
          data: { type: 'bill_settled', optimistic: true }
        });
      }
    } catch (error) {
      console.error('Error settling bill:', error);
      showToast(`${t('failedToSettleBill')}: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };


  const handlePrintKOT = async () => {
    if (!hasUnprintedItems) {
      showToast(t('Cutting slip already fired for current items. Status: Preparing'), 'info');
      return;
    }
    setActionLoading('kot');
    if (!activeTable) {
      if (billType === 'Delivery' || billType === 'Takeaway') {
        const generatedOrderNo = generateSequentialOrderNo(billType);
        newlyGeneratedTables.current.add(generatedOrderNo);
        setActiveTable(generatedOrderNo);
        setTimeout(() => handlePrintKOTWithTable(generatedOrderNo), 100);
        return;
      } else {
        showToast(t('pleaseSelectTable'), 'error');
        setActionLoading(null);
        return;
      }
    }
    handlePrintKOTWithTable(activeTable);
  };

  const handlePrintKOTWithTable = async (tableNo) => {
    try {
      setActionLoading('kot');
      const orderData = {
        tableNo: tableNo,
        items: cart,
        subtotal,
        tax: taxVal,
        discount: discountAmount,
        discountType: discount.type,
        discountValue: discount.value === '' ? 0 : parseFloat(discount.value) || 0,
        discountName: discount.name || discount.offerName || '',
        applicableTo: discount.applicableTo || 'all',
        targetCategory: discount.targetCategory || '',
        total,
        billType,
        orderSource: billType === 'Delivery' ? orderSource : undefined,
        customerPhone,
        customerName,
        deliveryCharge: parseFloat(deliveryCharge || 0),
        containerCharge: parseFloat(containerCharge || 0),
        skipNotification: true // Do not fire "New Order Placed" or "Order Updated" right before KOT is fired
      };

      let currentId = orderId;
      // ⚡ High-speed optimization: Only save if new draft or local pending edits exist
      if (!currentId || currentId.startsWith('offline_')) {
        const savedOrder = await saveOrder(orderData);
        currentId = savedOrder._id;
        setOrderId(savedOrder._id);
      } else if (hasPendingLocalChanges.current) {
        const savedOrder = await saveOrder({ id: currentId, ...orderData });
        if (savedOrder && savedOrder._id !== currentId) {
          currentId = savedOrder._id;
          setOrderId(savedOrder._id);
        }
      }

      removeClearedTableRecord(tableNo);
      // OPTIMISTIC KOT PRINT
      if (directPrintConfigs.kot) {
        const unprintedItems = cart.filter(i => (i.quantity - (i.printedQuantity || 0)) > 0);
        setActiveKOTData({ items: unprintedItems, tableNo: tableNo, billType, orderSource });
        setShowKOT(true);
      }

      const response = await apiGenerateKOT(currentId, cart, tableNo);

      // In ONE single shot: update cart with confirmed KOT items, show preview, show toast
      if (response.bill && response.bill.items) {
        setCart(response.bill.items.map(i => ({
          ...i,
          printedQuantity: i.printedQuantity !== undefined ? i.printedQuantity : i.quantity,
          lastPrintedNote: i.specialNote || ''
        })));
      } else {
        setCart(prev => prev.map(i => ({
          ...i,
          printedQuantity: i.quantity,
          lastPrintedNote: i.specialNote || ''
        })));
      }

      const kotData = response.kot || (response.bill?.kots ? response.bill.kots[response.bill.kots.length - 1] : null) || (response._offline ? { items: cart, createdAt: new Date(), kotNumber: 'OFFLINE-SYNC' } : null);
      const queueNo = response.queueNumber || response.bill?.queueNumber || 1;

      // Enrich KOT items with food type/category from cart so preview splits Veg/Non-Veg correctly
      if (kotData && kotData.items) {
        kotData.items = kotData.items.map(kotItem => {
          const cartMatch = cart.find(c =>
            (c.name || '').trim().toLowerCase() === (kotItem.name || '').trim().toLowerCase()
          );
          if (cartMatch) {
            return {
              ...kotItem,
              type: kotItem.type || cartMatch.type || cartMatch.foodType || '',
              foodType: kotItem.foodType || cartMatch.foodType || cartMatch.type || '',
              isVeg: kotItem.isVeg !== undefined ? kotItem.isVeg : cartMatch.isVeg,
              category: kotItem.category || cartMatch.category || '',
              department: kotItem.department || cartMatch.department || ''
            };
          }
          return kotItem;
        });
      }

      setActiveKOTData({
        ...kotData,
        tableNo: response.bill?.tableNo || tableNo,
        billType: billType,
        orderSource: kotData?.orderSource || orderSource || response?.bill?.orderSource,
        tokenNo: kotData?.tokenNo || kotData?.queueNumber || queueNo,
        queueNumber: kotData?.tokenNo || kotData?.queueNumber || queueNo,
        waiterName: userRole
      });
      setShowKOT(true);
      hasPendingLocalChanges.current = false;
      showToast(t('kotGeneratedSuccess', { defaultValue: 'KOT printed successfully' }), 'success');
      if (kotData) {
        getCachedKotHistory().then(cached => {
          if (Array.isArray(cached)) {
            const targetId = String(kotData._id || kotData.kotId || '');
            const exists = targetId && cached.some(k => String(k.kotId || k._id || '') === targetId);
            if (!exists) {
              const newEntry = {
                _id: kotData._id || `local_${Date.now()}`,
                kotId: kotData._id || `local_${Date.now()}`,
                kotNumber: kotData.kotNumber || 'KOT-1',
                tableNo: response.bill?.tableNo || tableNo,
                billType: billType,
                orderSource: kotData?.orderSource || orderSource,
                queueNumber: kotData?.queueNumber || kotData?.tokenNo || queueNo,
                tokenNo: kotData?.tokenNo || kotData?.queueNumber || queueNo,
                billId: response.bill?._id || currentId,
                createdAt: kotData.createdAt || new Date().toISOString(),
                items: (kotData.items || []).map(i => ({ ...i, status: i.status || 'Pending' }))
              };
              cacheKotHistory([newEntry, ...cached]);
            }
          }
        }).catch(() => { });
      }
      fetchDailyStats();
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error generating KOT:', error);
      showToast(error.response?.data?.message || error.message || t('failedToPrintKOT'), 'error');
    } finally {
      setActionLoading(null);
    }
  };


  const handleFinish = () => {
    setAutoSendWhatsAppToInvoice(false);
    isViewingInvoiceRef.current = false;
    if (completedBill && completedBill.status === 'Paid') {
      showToast(`${t('billSaved')} ${completedBill.billNumber || ''}`, 'success');
    }
    // Clear persisted invoice state
    try {
      sessionStorage.removeItem('ms_invoice_open');
      sessionStorage.removeItem('ms_completed_bill');
    } catch (e) { }
    setShowInvoice(false);
    setCart([]);
    cartRef.current = [];
    setOrderId(null);
    setOrderStatus('Open');
    setBillNumber(null);
    setCompletedBill(null);

    // Reset order-specific states to prevent carry-over to next order
    setDiscount({ type: 'percentage', value: '' });
    setCustomerPhone('');
    setCustomerName('');
    setCustomerInfo(null);
    setIsOrderLocked(false);
    setLockedTimestamp('');
    setCustomerPhoto('');
    setCustomerAddress('');
    setCustomerCategory(fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail'));
    setExportSubCategory(fishOrderMode === 'export' ? 'Local' : null);
    setDeliveryCharge('0');
    setContainerCharge('0');
    setOrderSource('Direct');

    // Automatically generate the next sequential order number for the SAME mode
    const modeType = fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : (billType === 'Delivery' ? 'Delivery' : 'Retail'));
    const nextOrderNo = generateSequentialOrderNo(modeType);
    newlyGeneratedTables.current.add(nextOrderNo);
    setActiveTable(nextOrderNo);
    activeTableRef.current = nextOrderNo;
    try {
      sessionStorage.setItem('ms_initial_table', nextOrderNo);
      sessionStorage.setItem('ms_initial_action', 'new');
    } catch (e) { }
    setMobileTab('menu');

    fetchDailyStats();

    if (onOrderUpdate) onOrderUpdate();
    // Do not call onGoBack() here: stay on current New Order page ready for the next order
  };



  const handleClearCart = () => {
    if (orderStatus === 'Paid') {
      showToast(t('Paid order cannot be modified or cleared.', { defaultValue: 'Paid order cannot be modified or cleared.' }), 'error');
      return false;
    }

    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is saved & printed. Please click EDIT button to modify or clear items.', { defaultValue: 'Order is saved & printed. Please click EDIT button to modify or clear items.' }), 'warning');
      return false;
    }

    setCart([]);
    cartRef.current = [];
    hasPendingLocalChanges.current = true;
    lastLocalEditTime.current = Date.now();
    showToast(t('All cart items cleared', { defaultValue: 'All cart items cleared' }), 'info');
    return true;
  };

  const handleCancelOrder = () => {
    if (orderStatus === 'Billed' && !hasPendingLocalChanges.current) {
      showToast(t('Order is saved & printed. Click EDIT to modify or cancel.', { defaultValue: 'Order is saved & printed. Click EDIT to modify or cancel.' }), 'warning');
      return;
    }
    if (orderStatus === 'Paid') {
      showToast(t('Paid order cannot be cancelled. Use Refund in Bill History.', { defaultValue: 'Paid order cannot be cancelled. Use Refund in Bill History.' }), 'warning');
      return;
    }

    if (!orderId && cart.length === 0) {
      return;
    }

    if (!orderId && cart.length > 0) {
      setCart([]);
      hasPendingLocalChanges.current = false;
      showToast(t('Cleared cart items'), 'info');
      return;
    }

    setShowCancelModal(true);
  };

  const confirmCancelOrder = async (cancelReason) => {
    setShowCancelModal(false);
    setActionLoading('cancel');
    const orderIdToCancel = orderId;
    const tableToCancel = activeTable;

    try {
      if (orderIdToCancel && !orderIdToCancel.startsWith('offline_')) {
        const response = await apiCancelOrder(orderIdToCancel, cancelReason);
        if (response?.kot) {
          setActiveKOTData({
            ...response.kot,
            tableNo: tableToCancel,
            billType,
            orderSource
          });
          setShowKOT(true);
        }
      }
      setCart([]);
      setOrderId(null);
      setOrderStatus('Open');
      setBillNumber(null);
      hasPendingLocalChanges.current = false;
      showToast(t('orderCancelled'), 'success');
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error cancelling order:', error);
      showToast(error.response?.data?.message || t('failedToCancelOrder'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTransferTable = async (newTableNo, sourceOrderId, sourceTableNo) => {
    const idToTransfer = sourceOrderId || orderId;
    if (!idToTransfer) return;
    try {
      await apiTransferTable(idToTransfer, newTableNo);
      showToast(`${t('billTransferred')} ${newTableNo}`, 'success');
      setShowTransfer(false);
      await fetchOpenOrdersList(); // Refresh open orders to reflect transfer
      if (!sourceTableNo || sourceTableNo === activeTable) {
        setActiveTable(newTableNo);
      }
      if (onOrderUpdate) onOrderUpdate();
    } catch (error) {
      console.error('Error transferring table:', error);
      showToast(error.response?.data?.message || t('failedToTransferTable'), 'error');
    } finally {
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header Navigation & Action Bar: 2 rows on Tablet, 1 row on Desktop */}
      <div className={`flex flex-col xl:flex-row xl:h-14 xl:items-center xl:justify-between px-2 sm:px-3 lg:px-6 bg-surface border-b border-border/50 shrink-0 relative ${isOrderDropdownOpen ? 'z-[100]' : 'z-30'} gap-1.5 py-1.5 xl:py-0`}>

        {/* ROW 1: (On Tablet: Back, Order Selector, New Order, Lock, Fullscreen) / (On Desktop: Left Section) */}
        <div className="flex items-center justify-between w-full xl:w-auto gap-2">
          {/* Left Section: Active / New Order Selector & Back Button */}
          <div className={`flex items-center gap-1 sm:gap-2 shrink-0 ${isOrderDropdownOpen ? 'z-[100]' : 'z-30'}`}>
            {(onGoBack || mobileTab === 'cart') && (
              <BackButton
                onClick={() => {
                  const scrollParent = document.querySelector('#billing-main-scroll-area') || window;
                  if (scrollParent && scrollParent.scrollTop > 80) {
                    scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                  }
                  if (onGoBack) {
                    onGoBack();
                  }
                }}
                label="Back"
                className="shrink-0 !px-2 sm:!px-3.5 !py-1 sm:!py-1.5 !text-xs !gap-1 sm:!gap-2"
              />
            )}
            <div ref={orderDropdownRef} className={`relative shrink-0 ${isOrderDropdownOpen ? 'z-[100]' : 'z-30'}`}>
              {/* Customized Responsive Trigger Button */}
              <button
                type="button"
                onClick={() => setIsOrderDropdownOpen(prev => !prev)}
                className={`flex items-center gap-1.5 sm:gap-2 bg-white border rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 transition-all cursor-pointer shadow-xs max-w-[150px] sm:max-w-[240px] md:max-w-[300px] select-none ${
                  isOrderDropdownOpen 
                    ? 'border-primary ring-2 ring-orange-200 bg-[#fff7ed]' 
                    : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${activeTable ? 'bg-emerald-500 ring-2 ring-emerald-100' : 'bg-primary animate-pulse ring-2 ring-orange-100'}`} />
                <span className="font-extrabold text-slate-800 text-xs sm:text-sm whitespace-nowrap truncate">
                  {activeTable ? `${activeTable.replace(/^#+/, '')} Order` : `${t('newOrder')}`}
                </span>
                <ChevronDown 
                  size={13} 
                  className={`text-slate-500 transition-transform duration-200 shrink-0 ${isOrderDropdownOpen ? 'rotate-180 text-primary' : ''}`} 
                />
              </button>

              {/* Customized Animated Popup Menu */}
              {isOrderDropdownOpen && (
                <>
                  {/* Backdrop overlay to prevent underlying dial items from showing through or catching taps */}
                  <div 
                    className="fixed inset-0 z-[95] bg-black/10 backdrop-blur-[0.5px]"
                    onClick={() => setIsOrderDropdownOpen(false)}
                  />
                  <div 
                    className="absolute top-full left-0 mt-1.5 w-64 sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                    style={{ maxHeight: '340px' }}
                  >
                  {/* Category Header */}
                  <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500 bg-slate-50/80">
                    <span className="uppercase tracking-wider text-[10px] font-extrabold text-slate-400">
                      {currentModeTitle} {t("Orders")}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                      {modeFilteredOrders.length} {t("active")}
                    </span>
                  </div>

                  {/* Option 1: + New Order Button */}
                  <div className="p-1 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsOrderDropdownOpen(false);
                        handleCreateNewOrder();
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-left flex items-center gap-2 text-xs sm:text-sm font-black text-primary hover:bg-orange-50 active:bg-orange-100 transition-colors cursor-pointer group"
                    >
                      <div className="w-6 h-6 rounded-lg bg-orange-100 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                        <Plus size={14} strokeWidth={3} />
                      </div>
                      <span className="flex-1">{t('newOrder')}</span>
                    </button>
                  </div>

                  {/* Scrollable Order List (Filtered Strictly by Mode) */}
                  <div className="overflow-y-auto max-h-[220px] p-1 space-y-0.5 no-scrollbar">
                    {modeFilteredOrders.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400 font-medium">
                        {t(`No active ${currentModeTitle.toLowerCase()} orders`)}
                      </div>
                    ) : (
                      modeFilteredOrders.map((o) => {
                        const isSelected = activeTable && isTableMatching(o.tableNo, activeTable);
                        const isBilled = o.status === 'Billed';
                        return (
                          <button
                            key={o._id || o.tableNo}
                            type="button"
                            onClick={() => {
                              setIsOrderDropdownOpen(false);
                              setActiveTable(o.tableNo);
                            }}
                            className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-orange-50/90 border border-orange-200 text-slate-900 shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isBilled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span className="font-mono font-bold text-xs sm:text-[13px] text-slate-900 truncate">
                                {o.tableNo?.replace(/^#+/, '')}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                                isBilled 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {isBilled ? t('Billed') : t('Open')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-black text-xs sm:text-[13px] text-slate-900">
                                ₹{Number(o.total || 0).toFixed(0)}
                              </span>
                              {isSelected && (
                                <Check size={14} className="text-primary shrink-0" strokeWidth={3} />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}

                    {/* Unsaved Current Order if not yet in modeFilteredOrders */}
                    {activeTable && cart.length > 0 && !modeFilteredOrders.some((o) => isTableMatching(o.tableNo, activeTable)) && (
                      <button
                        type="button"
                        onClick={() => setIsOrderDropdownOpen(false)}
                        className="w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 bg-orange-50 border border-orange-200 cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                          <span className="font-mono font-bold text-xs sm:text-[13px] text-primary truncate">
                            {activeTable.replace(/^#+/, '')}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-orange-100">
                          {t('Current')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            </div>
          </div>

          {/* Mobile Only (< md): Fish Order Mode Toggle */}
          <div className="flex md:hidden items-center bg-white p-0.5 rounded-lg border border-slate-300 shadow-xs shrink-0 gap-0.5 z-30">
            <button
              type="button"
              onClick={() => handleSwitchOrderMode('individual')}
              className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-[10.5px] font-bold transition-all cursor-pointer ${fishOrderMode === 'individual'
                ? 'bg-[#059669] text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-emerald-800'
                }`}
            >
              <span>Retail</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchOrderMode('bulk')}
              className={`px-1 sm:px-1.5 py-0.5 sm:py-1 rounded text-[10px] sm:text-[10.5px] font-bold transition-all cursor-pointer ${fishOrderMode === 'bulk'
                ? 'bg-[#d97706] text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-amber-800'
                }`}
            >
              <span>Wholesale</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchOrderMode('export')}
              className={`px-1 sm:px-1.5 py-0.5 sm:py-1 rounded text-[10px] sm:text-[10.5px] font-bold transition-all cursor-pointer ${fishOrderMode === 'export'
                ? 'bg-[#0284c7] text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-blue-800'
                }`}
            >
              <span>Export</span>
            </button>
          </div>

          {/* Tablet Only Right: New Order, Lock, Fullscreen */}
          <div className="hidden md:flex xl:hidden items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCreateNewOrder}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer shrink-0 select-none"
              title={t('Start a brand new empty order')}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{t('New Order')}</span>
            </button>
            <button
              onClick={toggleLayoutLock}
              className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${isLayoutLocked ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-primary hover:bg-primary/5'}`}
              title={isLayoutLocked ? t("Unlock Layout") : t("Lock Layout")}>
              {isLayoutLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            <button
              onClick={toggleFullScreen}
              className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all shrink-0">
              {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>

        {/* ROW 2 (On Tablet) / CENTER + RIGHT (On Desktop): Search Bar + Fish Order Mode Toggle */}
        <div className="hidden md:flex xl:flex flex-1 items-center justify-between w-full xl:w-auto gap-2 xl:gap-4">
          {/* Search Bar */}
          <div className="flex-1 max-w-none xl:max-w-md xl:mx-auto z-20 min-w-[120px]">
            <div className="relative w-full items-center">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('Search all menu items...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 bg-background border border-border rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-xs sm:text-sm text-text-main transition-all shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-text-muted bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition-all cursor-pointer shadow-2xs"
                  title={t("Clear search")}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* Fish Order Mode Toggle */}
          <div className="flex items-center bg-white p-0.5 rounded-lg sm:rounded-xl border border-slate-300 shadow-xs shrink-0 gap-0.5 sm:gap-1 z-30">
            <button
              type="button"
              onClick={() => handleSwitchOrderMode('individual')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer ${fishOrderMode === 'individual'
                ? 'bg-[#059669] text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-emerald-800 hover:bg-emerald-50'
                }`}
            >
              <span>Retail (Kg)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchOrderMode('bulk')}
              className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer ${fishOrderMode === 'bulk'
                ? 'bg-[#d97706] text-white shadow-sm shadow-amber-500/30 font-black'
                : 'text-slate-600 hover:text-amber-800 hover:bg-amber-50'
                }`}
            >
              <span>Wholesale (Boxes)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchOrderMode('export')}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md sm:rounded-lg text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer ${fishOrderMode === 'export'
                ? 'bg-[#0284c7] text-white shadow-sm shadow-blue-500/30 font-black'
                : 'text-slate-600 hover:text-blue-800 hover:bg-blue-50'
                }`}
            >
              <span>Export (Bulk)</span>
            </button>
          </div>

          {/* Desktop Only Right Controls: New Order, Lock, Fullscreen */}
          <div className="hidden xl:flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCreateNewOrder}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm hover:shadow-md active:scale-95 transition-all cursor-pointer shrink-0 select-none"
              title={t('Start a brand new empty order')}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{t('New Order')}</span>
            </button>
            <button
              onClick={toggleLayoutLock}
              className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${isLayoutLocked ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-primary hover:bg-primary/5'}`}
              title={isLayoutLocked ? t("Unlock Layout") : t("Lock Layout")}>
              {isLayoutLocked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
            <button
              onClick={toggleFullScreen}
              className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all shrink-0">
              {isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:hidden px-3 pt-2 gap-2 shrink-0 bg-background border-b border-border/50 pb-2.5">
        {/* Mobile Dealer / Customer Pill Bar (Retail only or when non-bulk/export) */}
        {!(fishOrderMode === 'bulk' || fishOrderMode === 'export') && customerName && (
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center justify-between text-xs transition-all ${isOrderLocked
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 shadow-xs'
                : 'bg-[#FAF0E4] border-[#E8DCCB] text-slate-700'
              }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold truncate text-[11px] text-slate-800">
                {customerName}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
              {isOrderLocked ? (
                <span className="text-emerald-700 font-extrabold flex items-center gap-0.5">
                  🔒 {lockedTimestamp ? (lockedTimestamp.split(',')[1] || 'Locked') : 'Locked'}
                </span>
              ) : (
                <span className="text-[#ea580c] font-black">{customerName}</span>
              )}
            </div>
          </div>
        )}

        {(mobileTab === 'menu' || fishOrderMode === 'bulk' || fishOrderMode === 'export') && (
          <div className="flex items-center gap-2 w-full mt-0.5">
            <div className="relative group flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={16} />
              <input
                type="text"
                placeholder={t('searchDishes') === 'searchDishes' ? 'Search Dishes...' : (t('searchDishes') || 'Search Dishes...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary text-xs text-text-main transition-all shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-text-muted bg-gray-200 rounded-full p-1 transition-all cursor-pointer"
                  title={t("Clear search")}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Mobile New Order (+) button replacing old Sales button on mobile */}
            <button
              type="button"
              onClick={handleCreateNewOrder}
              className="flex sm:hidden items-center justify-center gap-1 bg-gradient-to-r from-emerald-600 to-teal-600 active:from-emerald-700 active:to-teal-700 text-white px-2.5 py-1.5 rounded-xl font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer shrink-0 select-none"
              title={t('Start a brand new empty order')}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span className="text-[11px] font-black">{t('New')}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div id="billing-main-scroll-area" className="flex-1 flex flex-col xl:flex-row overflow-y-auto xl:overflow-hidden relative scroll-smooth">
          <div id="billing-menu-grid-container" className="flex flex-col bg-surface border-b xl:border-b-0 xl:border-r border-border/50 flex w-full xl:min-h-0 xl:flex-1 shrink-0 xl:shrink transition-all duration-300">
            <MenuGrid
              onSelectItem={addToCart}
              onAddBox={addBoxToCart}
              cart={cart}
              cartTotal={total}
              onViewOrder={() => {
                setTimeout(() => {
                  const cartEl = document.querySelector('#billing-cart-summary-container') || document.querySelector('.bill-summary-container') || document.querySelector('.counter-sale-cart');
                  if (cartEl) {
                    cartEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 80);
              }}
              activeTable={activeTable}
              billType={billType}
              fishOrderMode={fishOrderMode}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              foodTypeFilter={foodTypeFilter}
              onFoodTypeFilterChange={setFoodTypeFilter}
              sweetModeFilter={sweetModeFilter}
              onSweetModeFilterChange={setSweetModeFilter}
              onFilterCounts={setMenuFilterCounts}
              isLayoutLocked={isLayoutLocked}
              onNavigate={onNavigate}
              userRole={userRole}
              isLocked={orderStatus === 'Paid' || orderStatus === 'Cancelled' || (orderStatus === 'Billed' && !hasPendingLocalChanges.current)}
              orderStatus={orderStatus}
              hasPendingChanges={hasPendingLocalChanges.current}
              showToast={showToast}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerPhoto={customerPhoto}
              customerCategory={customerCategory}
              exportSubCategory={exportSubCategory}
              isOrderLocked={isOrderLocked}
              setIsOrderLocked={setIsOrderLocked}
              lockedTimestamp={lockedTimestamp}
              setLockedTimestamp={setLockedTimestamp}
              discount={discount}
              setDiscount={setDiscount}
              onOpenCustomerModal={() => handleOpenCustomerModal()}
              onCustomerSelect={handlePredefinedCustomerSelect}
              onSaveOrder={(overrideItems) => handleSaveOrder(false, overrideItems)}
              onGenerateBill={(overrideItems) => handleGenerateBill(overrideItems)}
              actionLoading={actionLoading}
            />
          </div>

          <div
            id="billing-cart-summary-container"
            style={typeof window !== 'undefined' && window.innerWidth >= 1280 ? {
              width: isCartCollapsed ? 0 : rightPanelWidth,
              maxWidth: '45vw',
              minWidth: isCartCollapsed ? 0 : '360px'
            } : { width: '100%', maxWidth: '100vw' }}
            className={`flex flex-col bg-surface ${isCartCollapsed ? 'xl:w-0 border-none opacity-0 xl:opacity-100 overflow-visible' : 'border-t md:border-t-2 xl:border-t-0 xl:border-l border-border/50 overflow-visible'} shrink-0 w-full xl:w-auto xl:h-full transition-none relative`}>


            {/* Drag Handle (Desktop only) */}
            {!isCartCollapsed && !isLayoutLocked &&
              <div
                onMouseDown={startResizing}
                className="hidden xl:block absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent z-40 transition-colors" />

            }

            <button
              type="button"
              onClick={() => setIsCartCollapsed(!isCartCollapsed)}
              className={`hidden xl:flex absolute top-1/2 -translate-y-1/2 z-30 bg-white/95 text-slate-700 hover:text-[#8b4513] hover:bg-[#FAF0E4] shadow-md rounded-l-xl py-2.5 px-1.5 transition-all items-center border-y border-l border-[#E8DCCB] cursor-pointer group ${isCartCollapsed ? 'right-0' : 'left-0 -translate-x-full'
                }`}
              title={isCartCollapsed ? t('expandCart') : t('collapseCart')}>
              {isCartCollapsed ? (
                <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
              ) : (
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
            <div className={`bill-summary-container w-full h-full flex flex-col overflow-hidden ${isCartCollapsed ? 'hidden' : 'flex'}`}>
              <BillSummary
                orderId={orderId}
                cart={cart}
                onBackToMenu={() => {
                  const scrollParent = document.querySelector('#billing-main-scroll-area') || window;
                  if (scrollParent && scrollParent.scrollTo) {
                    scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                  const menuEl = document.querySelector('#billing-menu-grid-container');
                  if (menuEl) {
                    menuEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                hasUnprintedItems={hasUnprintedItems}
                updateQuantity={updateQuantity}
                removeBoxFromCart={removeBoxFromCart}
                updateItemNote={updateItemNote}
                updateItemPrice={updateItemPrice}
                subtotal={subtotal}
                taxAmount={taxAmount}
                discountAmount={discountAmount}
                total={total}
                userRole={userRole}

                orderStatus={orderStatus}
                activeTable={activeTable}
                onSaveOrder={() => handleSaveOrder(false)}
                onGenerateBill={handleGenerateBill}
                onSettleBill={() => setShowPayment(true)}
                onPrintBill={() => setShowInvoice(true)}
                onReopenOrder={handleReopenOrder}
                onCancelOrder={handleCancelOrder}
                onClearCart={handleClearCart}
                showToast={showToast}
                onSelectTable={setActiveTable}

                discount={discount}
                setDiscount={handleDiscountChange}
                walletRedemption={walletRedemption}
                setWalletRedemption={setWalletRedemption}
                taxRate={taxRate}
                setTaxRate={setTaxRate}
                billType={billType}
                setBillType={setBillType}
                loading={loading}
                actionLoading={actionLoading}

                orderSource={orderSource}
                setOrderSource={handleOrderSourceChange}

                customerPhone={customerPhone}
                setCustomerPhone={setCustomerPhone}
                customerName={customerName}
                setCustomerName={setCustomerName}
                customerInfo={customerInfo}
                deliveryCharge={deliveryCharge}
                setDeliveryCharge={handleDeliveryChargeChange}
                containerCharge={containerCharge}
                setContainerCharge={handleContainerChargeChange}
                cuttingCharge={cuttingCharge}
                setCuttingCharge={handleCuttingChargeChange}
                isCuttingChargeEnabled={isCuttingChargeEnabled}
                setIsCuttingChargeEnabled={setIsCuttingChargeEnabled}
                hasPendingChanges={hasPendingLocalChanges.current}
                openOrders={openOrdersList}
                reservations={reservations}
                onOpenCustomerModal={handleOpenCustomerModal}
                onNavigate={onNavigate}
                autoWhatsappEnabled={autoWhatsappEnabled}
                onToggleAutoWhatsapp={(val) => {
                  setAutoWhatsappEnabled(val);
                  try {
                    const modeKey = fishOrderMode === 'export' ? 'autoWhatsappExport' : fishOrderMode === 'bulk' ? 'autoWhatsappWholesale' : 'autoWhatsappRetail';
                    const storageKey = fishOrderMode === 'export' ? 'ms_auto_wa_export' : fishOrderMode === 'bulk' ? 'ms_auto_wa_wholesale' : 'ms_auto_wa_retail';
                    localStorage.setItem(storageKey, val ? '1' : '0');
                    sessionStorage.setItem(storageKey, val ? '1' : '0');
                    localStorage.setItem('ms_auto_wa', val ? '1' : '0');
                    const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
                    s[modeKey] = val;
                    localStorage.setItem('restaurantSettings', JSON.stringify(s));
                    window.dispatchEvent(new Event('storage'));
                  } catch (e) { }
                }}
                isWhatsAppConnected={isWhatsAppConnected}
                whatsappBillSentIds={whatsappBillSentIds.current}
                fishOrderMode={fishOrderMode}
                isOrderLocked={isOrderLocked}
                setIsOrderLocked={setIsOrderLocked}
                lockedTimestamp={lockedTimestamp}
                setLockedTimestamp={setLockedTimestamp}
                onCustomerSelect={handlePredefinedCustomerSelect}
              />
            </div>

          </div>
        </div>

        {cart.length > 0 && (
          <div className="xl:hidden p-2.5 sm:p-3 bg-surface border-t border-border shadow-xl flex items-center justify-between shrink-0 animate-bounce-short z-30">
            <div className="flex flex-col">
              <span className="text-[10px] text-text-muted font-bold uppercase">
                {activeTable ? `${activeTable} • ` : ''}{cart.length} {cart.length === 1 ? 'Box/Item' : 'Boxes/Items'}
              </span>
              <span className="text-base font-black text-primary">₹{total.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleGenerateBill()}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Printer size={13} />
                <span>SAVE & PRINT</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showPayment &&
        <PaymentModal
          total={total}
          billNumber={billNumber}
          tableNo={activeTable}
          customerPhone={customerPhone}
          customerName={customerName}
          isLoading={loading || actionLoading === 'settle'}
          onClose={() => setShowPayment(false)}
          onComplete={handleSettleBill} />
      }

      {/* Payment Success Celebration Screen */}
      {showSuccessScreen && successPaymentData && (
        <PaymentSuccessScreen
          billData={successPaymentData.billData}
          paymentData={successPaymentData.paymentData}
          onDone={() => {
            setShowSuccessScreen(false);
            setSuccessPaymentData(null);
            setShowInvoice(true);
            try {
              sessionStorage.setItem('ms_invoice_open', 'true');
              sessionStorage.setItem('ms_completed_bill', JSON.stringify(successPaymentData.billData));
            } catch (e) { }
          }}
        />
      )}

      {showInvoice && (completedBill || (cart && cart.length > 0)) && (() => {
        const billToShow = completedBill || {
          _id: orderId,
          billNumber: billNumber,
          status: orderStatus,
          items: cart,
          subtotal: subtotal,
          tax: taxVal,
          discount: discountAmount,
          total: total,
          billType: billType,
          tableNo: activeTable,
          orderSource: orderSource,
          customerName: customerName,
          customerPhone: customerPhone,
          deliveryCharge: deliveryCharge,
          containerCharge: containerCharge,
          cuttingCharge: fishOrderMode === 'individual' ? cuttingCharge : 0,
          restaurantDetails: JSON.parse(localStorage.getItem('restaurantSettings') || '{}'),
          createdAt: new Date()
        };
        return (
          <Invoice
            key="invoice_modal"
            bill={billToShow}
            onClose={() => {
              setAutoSendWhatsAppToInvoice(false);
              handleFinish();
            }}
            onSave={() => {
              setAutoSendWhatsAppToInvoice(false);
              handleFinish();
            }}
            onSettle={() => {
              setAutoSendWhatsAppToInvoice(false);
              setShowInvoice(false);
              setShowPayment(true);
            }}
            whatsappBillSentIds={whatsappBillSentIds.current}
            onWhatsAppSent={(id) => {
              setAutoSendWhatsAppToInvoice(false);
              whatsappBillSentIds.current.add(id);
              try { sessionStorage.setItem(`ms_wa_sent_${id}`, 'true'); } catch (e) { }
            }}
            autoSendWhatsApp={autoSendWhatsAppToInvoice}
            isDirectPrint={billToShow.status === 'Paid' ? directPrintConfigs.settle : directPrintConfigs.save}
            onGlobalToast={showToast}
          />
        );
      })()}


      {toast &&
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)} />

      }

      <CancelOrderModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={confirmCancelOrder}
        requirePin={(() => {
          const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          return s.customLocks?.['cancel-order']?.enabled !== false;
        })()}
        validPins={[
          JSON.parse(localStorage.getItem('restaurantSettings') || '{}').customLocks?.['cancel-order']?.pin,
          JSON.parse(localStorage.getItem('restaurantSettings') || '{}').ownerPin,
          '1234'
        ].filter(Boolean)} />

      {/* Customer CRM Modal (Only Name and Phone Number) */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-fade-in">
          <div className="bg-white border border-[#E8DCCB] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up text-slate-800">
            <div className="p-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 border border-orange-200 text-[#ea580c] rounded-xl shadow-xs">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">{t("Customer CRM")}</h3>
                  <p className="text-[11px] text-slate-500">{t("Add customer name & phone number")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerCRM} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  {t("Phone Number (10 Digits)")}
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9876543210"
                    value={tempCustomerPhone}
                    onChange={(e) => handleCrmPhoneChange(e.target.value)}
                    onFocus={() => { if (crmSuggestions.length > 0) setShowCrmSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowCrmSuggestions(false), 200)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 transition-all font-mono"
                  />
                  {/* Suggestions Dropdown */}
                  {showCrmSuggestions && crmSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-[#E8DCCB] rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                      {crmSuggestions.map((cust, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-2.5 hover:bg-[#F5E8D8] cursor-pointer border-b border-[#E8DCCB] last:border-0 flex justify-between items-center"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCrmPhoneChange(cust.phone);
                            setTempCustomerName(cust.name && cust.name !== 'Guest' ? cust.name : '');
                            setShowCrmSuggestions(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800 font-mono">{cust.phone}</span>
                            <span className="text-xs text-slate-500">{cust.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {crmLoading && (
                  <p className="text-[11px] text-[#ea580c] mt-1 flex items-center gap-1 font-medium animate-pulse">
                    Checking CRM records...
                  </p>
                )}
                {crmCustomerFound && (
                  <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1 font-bold">
                    ✓ Existing customer found ({crmCustomerFound.totalVisits || 1} visits)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  {t("Customer Name")}
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Rahul Sharma"
                    value={tempCustomerName}
                    onChange={(e) => setTempCustomerName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 py-2.5 border border-[#E8DCCB] bg-[#F7EFE2] text-slate-700 rounded-xl font-bold text-xs hover:bg-[#F5E8D8] hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={crmSaving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {crmSaving ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{t("Save to Order")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offscreen Thermal Receipt for Instant WhatsApp Image Capture */}
      {offscreenBill && (
        <div
          id="wa-offscreen-receipt"
          style={{
            position: 'fixed',
            left: '0',
            top: '0',
            width: '360px',
            backgroundColor: '#ffffff',
            color: '#000000',
            padding: '16px 14px 24px 14px',
            fontFamily: 'sans-serif',
            fontSize: '12px',
            lineHeight: '1.4',
            boxSizing: 'border-box',
            zIndex: -1,
            opacity: 0.001,
            pointerEvents: 'none'
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            {(() => {
              const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
              const showLogo = s.whatsappShowLogo === true;
              return Boolean(showLogo && s.logo && s.logo !== '[logo_stored]') ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                  <img src={s.logo} alt="Logo" style={{ maxHeight: '45px', maxWidth: '140px', objectFit: 'contain' }} />
                </div>
              ) : null;
            })()}
            <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').restaurantName || ''}
            </div>
            <div style={{ fontSize: '11px', marginTop: '2px', color: '#333' }}>
              {(JSON.parse(localStorage.getItem('restaurantSettings') || '{}').address || '').split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').gstin && (
                <div>GSTIN: {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').gstin}</div>
              )}
              {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').phone && (
                <div>PH: {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').phone}</div>
              )}
              {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').fssai && (
                <div>FSSAI: {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').fssai}</div>
              )}
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Title */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
            {offscreenBill.status === 'Unpaid' ? 'Unpaid (Khata)' : 'Tax Invoice'}
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Type & Table */}
          <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '4px' }}>
            {(() => {
              const isExp = offscreenBill.customerCategory === 'Export' || offscreenBill.orderMode === 'export' || String(offscreenBill.billNumber || '').startsWith('EXP-') || String(offscreenBill.tableNo || '').startsWith('EXP-');
              const isWs = !isExp && (offscreenBill.customerCategory === 'Wholesale' || offscreenBill.orderMode === 'bulk' || String(offscreenBill.billNumber || '').startsWith('WS-') || String(offscreenBill.tableNo || '').startsWith('WS-') || Number(offscreenBill.totalBoxes || 0) > 0);
              const pfx = isExp ? 'EXP-' : (isWs ? 'WS-' : 'RET-');
              const cleanT = (offscreenBill.tableNo || '').replace(/^TAK-/i, pfx);
              if (offscreenBill.billType === 'Delivery' || (cleanT && cleanT.startsWith('DEL'))) {
                return `DELIVERY: ${cleanT || 'DEL'}`;
              }
              const catLbl = isExp ? 'EXPORT' : (isWs ? 'WHOLESALE' : 'RETAIL');
              return `${catLbl}${cleanT ? ` (${cleanT})` : ''}`;
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span>Date: {new Date(offscreenBill.settledAt || Date.now()).toLocaleDateString('en-GB')}</span>
            <span>{new Date(offscreenBill.settledAt || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
            <span>Cashier: {offscreenBill.cashier || (JSON.parse(localStorage.getItem('user') || '{}')?.name) || 'admin'}</span>
            <span style={{ fontWeight: 'bold' }}>Bill No.: #{offscreenBill.billNumber || offscreenBill.confirmedBillNumber || '---'}</span>
          </div>

          {/* Customer Details (Dynamically respects admin settings toggles for retail/wholesale/export) */}
          {(() => {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            const custConfig = s.receiptCustomerDisplay || {
              retail: { enabled: true, showName: true, showPhone: true, showAddress: false, showShopName: false },
              wholesale: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true },
              export: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true }
            };
            const isExp = offscreenBill.customerCategory === 'Export' || offscreenBill.orderMode === 'export' || String(offscreenBill.billNumber || '').startsWith('EXP-') || String(offscreenBill.tableNo || '').startsWith('EXP-');
            const isWs = !isExp && (offscreenBill.customerCategory === 'Wholesale' || offscreenBill.orderMode === 'bulk' || String(offscreenBill.billNumber || '').startsWith('WS-') || String(offscreenBill.tableNo || '').startsWith('WS-') || Number(offscreenBill.totalBoxes || 0) > 0);
            const modeKey = isExp ? 'export' : (isWs ? 'wholesale' : 'retail');
            const cfg = custConfig[modeKey] || { enabled: true, showName: true, showPhone: true };
            if (!cfg.enabled) return null;

            const cName = cfg.showName ? (offscreenBill.customerName || offscreenBill.customer?.name) : null;
            const cPhone = cfg.showPhone ? (offscreenBill.customerPhone || offscreenBill.customer?.phone) : null;
            const cShop = cfg.showShopName ? (offscreenBill.shopName || offscreenBill.customerShopName || offscreenBill.customer?.shopName) : null;
            const cAddress = cfg.showAddress ? (offscreenBill.customerAddress || offscreenBill.deliveryAddress || offscreenBill.customer?.address) : null;

            if (!cName && !cPhone && !cShop && !cAddress) return null;

            return (
              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0 6px 0', fontSize: '11px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>
                  CUSTOMER DETAILS:
                </div>
                {cName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Name:</span>
                    <span style={{ fontWeight: 'bold' }}>{cName}</span>
                  </div>
                )}
                {cShop && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Shop:</span>
                    <span style={{ fontWeight: 'bold' }}>{cShop}</span>
                  </div>
                )}
                {cPhone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Phone:</span>
                    <span style={{ fontWeight: 'bold' }}>{cPhone}</span>
                  </div>
                )}
                {cAddress && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Address:</span>
                    <span style={{ fontWeight: 'bold', maxWidth: '65%', textAlign: 'right' }}>{typeof cAddress === 'string' ? cAddress : JSON.stringify(cAddress)}</span>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Table Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ flex: 1 }}>Item</span>
            <span style={{ width: '36px', textAlign: 'center' }}>Qty.</span>
            <span style={{ width: '60px', textAlign: 'right' }}>Price</span>
            <span style={{ width: '64px', textAlign: 'right' }}>Amount</span>
          </div>

          <div style={{ borderTop: '1.5px solid #000', margin: '3px 0 5px 0' }}></div>

          {/* Grouped Items & Boxes */}
          {(() => {
            const boxes = {};
            const individual = [];
            const active = (offscreenBill.items || []).filter(item => !item.isCancelled);
            active.forEach(item => {
              if (item.boxNumber) {
                const k = String(item.boxNumber);
                if (!boxes[k]) {
                  boxes[k] = {
                    boxNumber: item.boxNumber,
                    boxLabel: item.boxLabel || `Box #${item.boxNumber}`,
                    items: [],
                    totalWeightKg: 0,
                    totalPrice: 0
                  };
                }
                boxes[k].items.push(item);
                boxes[k].totalWeightKg += Number(item.weightKg) || 0;
                const q = (item.quantity || 1) - (item.cancelledQuantity || 0);
                boxes[k].totalPrice += (Number(item.price) || 0) * q;
              } else {
                individual.push(item);
              }
            });

            const getItemCutting = (item) => {
              let cut = item?.cutType || item?.cuttingStyle || '';
              let rawName = item?.name || 'Item';
              let weightInfo = '';

              const parenMatch = rawName.match(/\((.*?)\)/);
              if (parenMatch) {
                const inside = parenMatch[1];
                const cutMatch = inside.match(/\b(Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\b/i);
                if (cutMatch && !cut) cut = cutMatch[1];
                const weightMatch = inside.match(/(\d+(?:\.\d+)?\s*(?:kg|g|gms|boxes|box))/i);
                if (weightMatch) weightInfo = weightMatch[1];
              }
              if (cut) {
                const cLower = cut.toLowerCase();
                if (cLower.includes('curry')) cut = 'Curry Cut';
                else if (cLower.includes('fry')) cut = 'Fry Cut';
                else if (cLower.includes('bone')) cut = 'Boneless';
                else if (cLower.includes('clean')) cut = 'Cleaned';
                else if (cLower.includes('whole')) cut = 'Whole';
              }
              let cleanName = rawName.replace(/\s*\((?:Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\s*-\s*[^)]+\)/i, '').trim();
              if (!cleanName) cleanName = rawName;
              return {
                displayName: cleanName,
                cutType: cut,
                weightInfo: weightInfo || (item?.weightKg ? `${item.weightKg} Kg` : (item?.enteredWeight ? `${item.enteredWeight} Kg` : ''))
              };
            };

            const boxKeys = Object.keys(boxes);
            const boxKg = Object.values(boxes).reduce((s, b) => s + b.totalWeightKg, 0);
            const totalLoose = individual.reduce((s, i) => s + ((i.quantity || 1) - (i.cancelledQuantity || 0)), 0);
            const totalBillKg = getBillTotalWeightKg(offscreenBill);

            return (
              <div>
                {/* Wholesale Boxes */}
                {Object.values(boxes).map((box) => (
                  <div key={`wa-box-${box.boxNumber}`} style={{ marginBottom: '6px', border: '1.5px solid #000000', borderRadius: '3px', padding: '4px 6px', background: '#fafafa' }}>
                    {/* Box Header Row */}
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '11.5px', borderBottom: '1px dashed #666', paddingBottom: '3px', marginBottom: '3px' }}>
                      <span>{box.boxLabel} ({box.items.length} items{box.totalWeightKg > 0 ? ` • ${box.totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg` : ''})</span>
                      <span style={{ fontWeight: 'bold' }}>{box.totalPrice.toFixed(2)}</span>
                    </div>
                    {/* Items inside Box */}
                    {box.items.map((item, idx) => {
                      const activeQty = (item.quantity || 1) - (item.cancelledQuantity || 0);
                      if (activeQty <= 0) return null;
                      const { displayName, cutType } = getItemCutting(item);
                      const qData = resolveItemQtyAndRate(item);
                      return (
                        <div key={idx} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', fontSize: '11px', paddingLeft: '4px', margin: '3px 0' }}>
                          <div style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '4px' }}>
                            <div>
                              • {displayName}
                            </div>
                            {cutType && (
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#222', marginTop: '1px' }}>
                                Cut: <span style={{ fontWeight: 700, color: '#000' }}>{cutType}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ width: '42px', textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>{qData.qtyDisplay}</div>
                          <div style={{ width: '54px', textAlign: 'right', flexShrink: 0 }}>{qData.rateDisplay}</div>
                          <div style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold' }}>{qData.amountDisplay}</div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Individual / Loose Items */}
                {individual.length > 0 && (
                  <div>
                    {boxKeys.length > 0 && (
                      <div style={{ fontSize: '11px', fontWeight: 'bold', margin: '4px 0 2px 0', textTransform: 'uppercase' }}>
                        🐟 Individual / Loose Items
                      </div>
                    )}
                    {individual.map((item, idx) => {
                      const activeQty = (item.quantity || 1) - (item.cancelledQuantity || 0);
                      if (activeQty <= 0) return null;
                      const { displayName, cutType, weightInfo } = getItemCutting(item);
                      const qData = resolveItemQtyAndRate(item);
                      return (
                        <div key={idx} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', fontSize: '11px', margin: '3px 0' }}>
                          <div style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '4px' }}>
                            <div style={{ fontWeight: 600 }}>
                              {displayName}
                              {!qData.isKg && weightInfo && <span style={{ fontWeight: 'normal' }}> ({weightInfo})</span>}
                            </div>
                            {cutType && (
                              <div style={{ fontSize: '10px', fontWeight: 600, color: '#222', marginTop: '1px' }}>
                                Cut: <span style={{ fontWeight: 700, color: '#000' }}>{cutType}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ width: '42px', textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>{qData.qtyDisplay}</div>
                          <div style={{ width: '54px', textAlign: 'right', flexShrink: 0 }}>{qData.rateDisplay}</div>
                          <div style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold' }}>{qData.amountDisplay}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

                {/* Totals Summary Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold' }}>
                  <span>
                    {boxKeys.length > 0 && totalLoose > 0
                      ? `Total: ${boxKeys.length} Box(es) + ${totalLoose} Loose`
                      : boxKeys.length > 0
                        ? `Total: ${boxKeys.length} ${boxKeys.length === 1 ? 'Box' : 'Boxes'} (${boxKg.toFixed(1).replace(/\.0$/, '')} Kg)`
                        : `${totalBillKg > 0 ? `Total Qty: ${totalBillKg.toFixed(1).replace(/\.0$/, '')} Kg` : `Total Qty: ${totalLoose}`}`}
                  </span>
                  <span>Sub Total: ₹{Number(offscreenBill.subtotal || 0).toFixed(2)}</span>
                </div>
              </div>
            );
          })()}

          <div style={{ borderTop: '2px solid #000', margin: '8px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
            <span>Grand Total</span>
            <span>₹{Number(offscreenBill.total || 0).toFixed(2)}</span>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Payment Status / Partial Khata Breakdown */}
          {(() => {
            if (offscreenBill.status === 'Partial' || offscreenBill.paymentMode === 'Partial') {
              const paid = Number(offscreenBill.paidAmount ?? offscreenBill.amountPaid ?? offscreenBill.partialPayment?.paidAmount ?? 0);
              const due = Number(offscreenBill.dueAmount ?? offscreenBill.partialPayment?.dueAmount ?? Math.max(0, (offscreenBill.total || 0) - paid));
              const method = offscreenBill.partialPayment?.method || 'Cash';
              return (
                <div style={{ textAlign: 'center', margin: '4px 0', borderTop: '1.5px dashed #000', borderBottom: '1.5px dashed #000', padding: '4px 0' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '12px' }}>PARTIALLY PAID (KHATA)</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '2px' }}>
                    <span>Paid ({method}): ₹{Number(paid).toFixed(2)}</span>
                    <span style={{ fontWeight: 'bold' }}>Due: ₹{Number(due).toFixed(2)}</span>
                  </div>
                </div>
              );
            } else if (offscreenBill.status === 'Unpaid') {
              return (
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', margin: '4px 0', borderTop: '1.5px dashed #000', borderBottom: '1.5px dashed #000', padding: '4px 0' }}>
                  UNPAID (KHATA BILL)
                </div>
              );
            } else {
              const isUpi = offscreenBill.paymentMode === 'UPI' || offscreenBill.paymentMode === 'QR' || offscreenBill.paymentMode === 'Online';
              const appSuffix = isUpi && (offscreenBill.upiApp || offscreenBill.paymentMethod) ? ` [${offscreenBill.upiApp || offscreenBill.paymentMethod}]` : '';
              return (
                <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', margin: '4px 0' }}>
                  Paid via {offscreenBill.paymentMode || 'Cash'}{appSuffix}
                </div>
              );
            }
          })()}

          {/* QR Code */}
          {(() => {
            const s = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            const upi = s.upiId;
            const showQr = s.whatsappShowQr === true;
            return (upi && showQr) ? (
              <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>SCAN TO PAY VIA UPI</div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
                  <QRCodeSVG value={`upi://pay?pa=${upi}&pn=${encodeURIComponent(JSON.parse(localStorage.getItem('restaurantSettings') || '{}').restaurantName || 'YNR FISHES')}&am=${offscreenBill.total}`} size={110} />
                </div>
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>UPI ID: {upi}</div>
              </div>
            ) : null;
          })()}

          <div style={{ textAlign: 'center', fontSize: '11px', fontWeight: 'bold', marginTop: '12px' }}>
            {JSON.parse(localStorage.getItem('restaurantSettings') || '{}').footerMessage || '*** THANK YOU! VISIT AGAIN ***'}
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
