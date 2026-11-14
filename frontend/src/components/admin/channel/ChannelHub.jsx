import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { 
  Building, Phone, MapPin, User, Users, Clock, Calendar, 
  CheckCircle, AlertCircle, AlertTriangle, Search, Plus, Edit2, Trash2, Eye, 
  FileText, ArrowLeft, RefreshCw, Send, DollarSign, Wallet, 
  Check, X, Shield, Bell, MessageSquare, CreditCard, ChevronRight, ChevronDown, ChevronUp,
  TrendingUp, Award, Camera, Loader2, BookOpen, Sparkles, Filter,
  PieChart, Activity, Zap, ExternalLink, QrCode, ArrowUpRight, UserPlus, Crop
} from 'lucide-react';
import BackButton from '../common/BackButton';
import CustomTimePicker from '../common/CustomTimePicker';
import ImageCropperModal from '../crm/ImageCropperModal';
import BillHistory, { getBillTotalWeightKg, resolveItemQtyAndRate } from '../billing/BillHistory';
import PaymentModal from '../billing/PaymentModal';
const Invoice = lazy(() => import('../billing/Invoice'));
import html2canvas from 'html2canvas-pro';
import { QRCodeCanvas } from 'qrcode.react';
import WhatsAppConnectModal from '../communication/WhatsAppConnectModal';
import Toast from '../system/Toast';
import api from '../../../api/system/axios';
import { getCachedCustomers, fetchPredefinedCustomers, saveCustomerToCache, deleteCustomer } from '../../../api/crm/customerApi';
import { getKhataAccounts, getKhataLedger, settleKhata, sendKhataReminder } from '../../../api/finance/khata';
import { getBills, getBillById } from '../../../api/billing/billing';
import { getWhatsAppStatus } from '../../../api/communication/whatsapp';

// IST Date Helper: Always returns present date in Asia/Kolkata (YYYY-MM-DD)
const getTodayIST = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Kolkata', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
};

export default function ChannelHub({
  channel = 'Wholesale', // 'Wholesale' | 'Retail' | 'Export'
  user,
  onNavigate,
  onGoBack,
  initialTab = 'crm'
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab); // 'crm' | 'khata' | 'bills'
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  const [toast, setToast] = useState(null);

  // Channel Meta Properties
  const isAllChannels = channel === 'All';
  const channelKey = channel === 'Wholesale' ? 'Wholesale' : (channel === 'Export' ? 'Export' : 'Retail');
  const isWholesale = channelKey === 'Wholesale';
  const isExport = channelKey === 'Export';
  const isRetail = channelKey === 'Retail';

  const channelTitle = isWholesale 
    ? t('Wholesale Management Hub') 
    : (isExport ? t('Export Management Hub') : t('Retail Management Hub'));

  const channelSubtitle = isWholesale
    ? t('Registered Dealers CRM • Khata Ledger • Wholesale Box Bills')
    : (isExport 
        ? t('Cold Storage Clients • Freight Khata • Export Consignment Bills') 
        : t('Customer Directory • Khata Book • Retail Counter Bills'));

  const personRole = isWholesale ? t('Dealer') : (isExport ? t('Client') : t('Customer'));
  const personRolePlural = isWholesale ? t('Dealers') : (isExport ? t('Clients') : t('Customers'));

  // ── Top Summary / KPI State ──────────────────────────────────────────────────
  const [stats, setStats] = useState({
    totalBills: 0,
    totalSales: 0,
    totalCustomers: 0,
    totalDues: 0
  });

  // ── Channel Financial Breakdown for Right Insight Panel ───────────────────────
  const [financialInsights, setFinancialInsights] = useState({
    cashSales: 0,
    upiSales: 0,
    cardSales: 0,
    khataSales: 0,
    paidBillsCount: 0,
    unpaidBillsCount: 0,
    todaySales: 0,
    todayBillsCount: 0
  });

  // ── CRM Directory State ──────────────────────────────────────────────────────
  const [customers, setCustomers] = useState([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSearch, setCrmSearch] = useState('');
  const [crmFilterMode, setCrmFilterMode] = useState('all'); // 'all' | 'spenders' | 'dues'
  const [isCrmDropdownOpen, setIsCrmDropdownOpen] = useState(false);
  const crmDropdownRef = useRef(null);

  const [customerModal, setCustomerModal] = useState({
    isOpen: false,
    isEdit: false,
    originalPhone: '',
    loading: false,
    data: {
      name: '',
      businessName: '',
      phone: '',
      category: channelKey,
      exportSubCategory: 'Local',
      address: { line1: '', area: '', city: 'Kadapa', district: 'YSR Kadapa', pincode: '' },
      photo: ''
    }
  });
  const [cropperModal, setCropperModal] = useState({ isOpen: false, imageSrc: '' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    customer: null,
    dueAmount: 0,
    confirmChecked: false,
    loading: false
  });
  const fileInputRef = useRef(null);

  // ── Khata State ─────────────────────────────────────────────────────────────
  const [khataAccounts, setKhataAccounts] = useState([]);
  const [khataLoading, setKhataLoading] = useState(false);
  const [khataSearch, setKhataSearch] = useState('');
  const [khataFilterMode, setKhataFilterMode] = useState('all'); // 'all' | 'high' | 'recent'
  const [khataChannelFilter, setKhataChannelFilter] = useState(() => (isAllChannels ? 'All' : channelKey));
  useEffect(() => {
    setKhataChannelFilter(isAllChannels ? 'All' : channelKey);
  }, [isAllChannels, channelKey]);
  const effectiveKhataChannel = isAllChannels ? khataChannelFilter : channelKey;
  const [isKhataDropdownOpen, setIsKhataDropdownOpen] = useState(false);
  const khataDropdownRef = useRef(null);

  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState(null);
  const [ledgerBills, setLedgerBills] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAccount, setPaymentAccount] = useState(null);
  const [paymentTargetBill, setPaymentTargetBill] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [sendingReminderPhone, setSendingReminderPhone] = useState(null);

  // ── Store settings directly from database / localStorage (no code fallbacks) ──
  const [storeSettings, setStoreSettings] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('restaurantSettings') : null;
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  useEffect(() => {
    let isMounted = true;
    const fetchLatestStoreSettings = async () => {
      try {
        const res = await api.get('/config/info');
        const incoming = res.data?.restaurantSettings || res.data;
        if (incoming && typeof incoming === 'object' && isMounted) {
          setStoreSettings(incoming);
          try {
            localStorage.setItem('restaurantSettings', JSON.stringify(incoming));
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Could not fetch dynamic store settings:', err?.message);
      }
    };
    fetchLatestStoreSettings();
    return () => { isMounted = false; };
  }, []);

  // ── WhatsApp Reminder Preview Modal with Read More / Read Less ───────────────
  const [reminderPreviewModal, setReminderPreviewModal] = useState({
    isOpen: false,
    account: null,
    cleanPhone: '',
    billNumber: '',
    billData: null,
    fullMessage: '',
    isExpanded: false,
    loading: false
  });

  // ── WhatsApp Offline Direct-Prompt Modal ──────────────────────────────────────
  const [offlineReminderModal, setOfflineReminderModal] = useState({
    isOpen: false,
    account: null,
    cleanPhone: '',
    waText: ''
  });
  const [whatsAppConnectOpen, setWhatsAppConnectOpen] = useState(false);

  // ── Live WhatsApp Bot Status State ───────────────────────────────────────────
  const [waBotStatus, setWaBotStatus] = useState({
    status: 'DISCONNECTED',
    connectedNumber: null,
    loading: true
  });

  const checkBotStatus = async () => {
    try {
      const data = await getWhatsAppStatus();
      setWaBotStatus({
        status: data?.status || 'DISCONNECTED',
        connectedNumber: data?.connectedNumber || null,
        loading: false
      });
    } catch (e) {
      setWaBotStatus({ status: 'DISCONNECTED', connectedNumber: null, loading: false });
    }
  };

  useEffect(() => {
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // ── Customer 360 Statement Drawer State ──────────────────────────────────────
  const [statementCustomer, setStatementCustomer] = useState(null);
  const [statementBills, setStatementBills] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);

  // ── Invoice Viewer Modal State ───────────────────────────────────────────────
  const [viewInvoice, setViewInvoice] = useState(null);
  const [eBillCaptureData, setEBillCaptureData] = useState(null);

  // ── WhatsApp Auto-Reminder Schedule State (Present & Future Date + Time in IST)
  const todayIST = getTodayIST();
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState(() => {
    try {
      const saved = localStorage.getItem(`ms_auto_reminder_${channelKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.date || parsed.date < todayIST) {
          parsed.date = todayIST;
        }
        return parsed;
      }
    } catch (e) {}
    return {
      enabled: true,
      scheduleType: 'daily', // 'daily' | 'scheduled_date'
      date: todayIST,
      time: '10:00', // 24h format for CustomTimePicker
      includeEBill: true,
      minDueAmount: 0
    };
  });

  // ── Close combobox dropdowns on click outside ────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (crmDropdownRef.current && !crmDropdownRef.current.contains(e.target)) {
        setIsCrmDropdownOpen(false);
      }
      if (khataDropdownRef.current && !khataDropdownRef.current.contains(e.target)) {
        setIsKhataDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Load CRM Customers ───────────────────────────────────────────────────────
  const loadCrmData = async () => {
    setCrmLoading(true);
    try {
      const cached = getCachedCustomers(channelKey);
      if (cached && cached.length > 0) {
        setCustomers(cached);
      }
      const data = await fetchPredefinedCustomers(channelKey, 'All', true);
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to load channel CRM customers:', err);
    } finally {
      setCrmLoading(false);
    }
  };

  // ── Load Khata Accounts ──────────────────────────────────────────────────────
  const loadKhataData = async () => {
    setKhataLoading(true);
    try {
      const data = await getKhataAccounts({ page: 1, limit: 50, search: khataSearch, category: effectiveKhataChannel });
      const accList = data?.accounts || [];
      setKhataAccounts(accList);
      setStats(prev => ({
        ...prev,
        totalDues: data?.stats?.totalOutstanding || accList.reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
      }));
    } catch (err) {
      console.error('Failed to load channel Khata accounts:', err);
    } finally {
      setKhataLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'khata') {
      loadKhataData();
    }
  }, [effectiveKhataChannel, khataSearch, activeTab]);

  // ── Load Channel Aggregate Stats & Financial Breakdown ───────────────────────
  const loadChannelStats = async () => {
    try {
      let page = 1;
      let billsList = [];
      let totalBillsFromApi = 0;
      while (true) {
        const billsRes = await getBills({ page, limit: 500, salesCategory: channelKey });
        const batch = billsRes?.bills || [];
        billsList = billsList.concat(batch);
        if (page === 1) {
          totalBillsFromApi = billsRes?.pagination?.totalBills || batch.length;
        }
        if (!billsRes?.pagination?.hasMore || batch.length === 0 || page >= 10) break;
        page += 1;
      }

      // Calculate breakdown for insight panel
      let totalSales = 0;
      let cash = 0;
      let upi = 0;
      let card = 0;
      let khata = 0;
      let paidCount = 0;
      let unpaidCount = 0;
      let todaySalesSum = 0;
      let todayCount = 0;
      const todayStr = getTodayIST();

      const addByMode = (modeRaw, amount) => {
        const m = String(modeRaw || 'Cash').toLowerCase();
        if (m.includes('card')) card += amount;
        else if (m.includes('upi')) upi += amount;
        else if (m.includes('khata') || m.includes('credit') || m.includes('unpaid')) khata += amount;
        else cash += amount;
      };

      billsList.forEach(b => {
        const amt = Number(b.total || 0);
        const bDateStr = b.createdAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(b.createdAt)) : '';
        if (bDateStr === todayStr) {
          todaySalesSum += amt;
          todayCount += 1;
        }

        if (b.status === 'Paid') {
          paidCount += 1;
          totalSales += amt;
          const mode = (b.paymentMethod || b.paymentMode || 'Cash').toLowerCase();
          if ((mode.includes('mixed') || mode.includes('split')) && b.splitPayments) {
            const sCash = Number(b.splitPayments.cash) || 0;
            const sUpi = Number(b.splitPayments.upi) || 0;
            const sCard = Number(b.splitPayments.card) || 0;
            if (sCash + sUpi + sCard > 0) {
              cash += sCash;
              upi += sUpi;
              card += sCard;
            } else {
              cash += amt;
            }
          } else {
            addByMode(mode, amt);
          }
        } else if (b.status === 'Partial') {
          unpaidCount += 1;
          const partialPaid = Number(b.paidAmount ?? b.amountPaid ?? b.partialPayment?.paidAmount ?? 0);
          const partialDue = Number(b.dueAmount ?? b.partialPayment?.dueAmount ?? Math.max(0, amt - partialPaid));
          totalSales += partialPaid;
          khata += partialDue;
          if (partialPaid > 0) {
            addByMode(b.partialPayment?.method || b.paymentMode || 'Cash', partialPaid);
          }
        } else if (b.status === 'Unpaid') {
          unpaidCount += 1;
          khata += amt;
        }
      });

      setFinancialInsights({
        cashSales: Math.round(cash),
        upiSales: Math.round(upi),
        cardSales: Math.round(card),
        khataSales: Math.round(khata),
        paidBillsCount: paidCount,
        unpaidBillsCount: unpaidCount,
        todaySales: Math.round(todaySalesSum),
        todayBillsCount: todayCount
      });

      setStats(prev => ({
        ...prev,
        totalBills: totalBillsFromApi || billsList.length,
        totalSales: Math.round(totalSales)
      }));
    } catch (e) {
      console.warn('Failed to load channel stats:', e);
    }
  };

  useEffect(() => {
    loadCrmData();
    loadKhataData();
    loadChannelStats();

    const onUpdate = () => {
      loadCrmData();
      loadKhataData();
      loadChannelStats();
      checkBotStatus();
    };
    window.addEventListener('customersUpdated', onUpdate);
    window.addEventListener('billCreated', onUpdate);
    return () => {
      window.removeEventListener('customersUpdated', onUpdate);
      window.removeEventListener('billCreated', onUpdate);
    };
  }, [channelKey, isAllChannels]);

  // ── Match Customer Khata Balances Map ───────────────────────────────────────
  const customerDueMap = useMemo(() => {
    const map = {};
    khataAccounts.forEach(a => {
      const clean = String(a.phoneNumber || '').replace(/\D/g, '').slice(-10);
      if (clean) map[clean] = a.balance || 0;
    });
    return map;
  }, [khataAccounts]);

  // ── Filtered CRM Customers ───────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = crmSearch.trim().toLowerCase();
    return customers.filter(c => {
      if (!c) return false;
      const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
      if (cat !== channelKey) return false;

      // Filter chips
      const cleanP = String(c.phone || '').replace(/\D/g, '').slice(-10);
      const dues = customerDueMap[cleanP] || 0;
      if (crmFilterMode === 'dues' && dues <= 0) return false;
      if (crmFilterMode === 'spenders' && (Number(c.totalSpend) || 0) < 1000) return false;

      if (!q) return true;
      const addrStr = typeof c.address === 'string' ? c.address : `${c.address?.line1 || ''} ${c.address?.area || ''} ${c.address?.city || ''}`;
      return (
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.businessName && c.businessName.toLowerCase().includes(q)) ||
        addrStr.toLowerCase().includes(q)
      );
    });
  }, [customers, crmSearch, crmFilterMode, channelKey, customerDueMap]);

  // ── Filtered Khata Accounts ──────────────────────────────────────────────────
  const filteredKhataAccounts = useMemo(() => {
    const q = khataSearch.trim().toLowerCase();
    return khataAccounts.filter(a => {
      if (!a) return false;
      const bal = Number(a.balance || 0);

      if (khataFilterMode === 'high' && bal < 500) return false;

      if (!q) return true;
      return (
        (a.customerName && a.customerName.toLowerCase().includes(q)) ||
        (a.phoneNumber && a.phoneNumber.includes(q)) ||
        String(bal).includes(q)
      );
    });
  }, [khataAccounts, khataSearch, khataFilterMode]);

  // ── Top Customers Leaderboard in Channel ──────────────────────────────────────
  const topSpenders = useMemo(() => {
    return [...customers]
      .filter(c => {
        const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
        return cat === channelKey;
      })
      .sort((a, b) => (Number(b.totalSpend) || 0) - (Number(a.totalSpend) || 0))
      .slice(0, 4);
  }, [customers, channelKey]);

  // ── Customer Add / Edit Submission ───────────────────────────────────────────
  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const clean = customerModal.data.phone ? customerModal.data.phone.replace(/\D/g, '').slice(-10) : '';
    if (clean && clean.length !== 10) {
      setToast({ message: t('Please enter a valid 10-digit phone number if provided'), type: 'error' });
      return;
    }
    if (!customerModal.data.name || !customerModal.data.name.trim()) {
      setToast({ message: t('Customer name is required'), type: 'error' });
      return;
    }

    setCustomerModal(prev => ({ ...prev, loading: true }));
    try {
      const rawAddr = customerModal.data.address;
      const addrLine1 = typeof rawAddr === 'string' ? rawAddr.trim() : (rawAddr?.line1 || rawAddr?.fullAddress || '').trim();
      const payload = {
        name: (customerModal.data.name || 'Guest').trim(),
        businessName: (customerModal.data.businessName || '').trim(),
        phone: clean,
        category: channelKey,
        exportSubCategory: isExport ? customerModal.data.exportSubCategory : null,
        address: {
          line1: addrLine1,
          fullAddress: addrLine1,
          area: typeof rawAddr === 'object' ? (rawAddr?.area || '').trim() : '',
          city: typeof rawAddr === 'object' ? (rawAddr?.city || 'Kadapa').trim() : 'Kadapa',
          district: typeof rawAddr === 'object' ? (rawAddr?.district || 'YSR Kadapa').trim() : 'YSR Kadapa',
          pincode: typeof rawAddr === 'object' ? (rawAddr?.pincode || '').trim() : ''
        },
        photo: customerModal.data.photo,
        orderType: channelKey
      };

      const res = await api.post('/customers', payload);
      if (res.data?.success && res.data.customer) {
        const saved = res.data.customer;
        saveCustomerToCache(saved);
        setCustomers(prev => [saved, ...prev.filter(c => c.phone !== saved.phone)]);
        setCustomerModal({ isOpen: false, isEdit: false, originalPhone: '', loading: false, data: {} });
        setToast({ 
          message: customerModal.isEdit ? t('Customer details updated successfully!') : t('New customer added successfully!'), 
          type: 'success' 
        });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || t('Failed to save customer'), type: 'error' });
    } finally {
      setCustomerModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ── Customer Delete Confirmation Submission ──────────────────────────────────
  const handleConfirmDeleteCustomer = async () => {
    const cust = deleteConfirmModal.customer;
    if (!cust || !deleteConfirmModal.confirmChecked || deleteConfirmModal.loading) return;

    setDeleteConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteCustomer(cust.phone);
      const cleanTarget = String(cust.phone || '').replace(/\D/g, '').slice(-10);
      setCustomers(prev => prev.filter(c => {
        const cp = String(c?.phone || '').replace(/\D/g, '').slice(-10);
        return cp !== cleanTarget && c?.phone !== cust.phone;
      }));
      if (statementCustomer && String(statementCustomer.phone || '').replace(/\D/g, '').slice(-10) === cleanTarget) {
        setStatementCustomer(null);
      }
      setDeleteConfirmModal({ isOpen: false, customer: null, dueAmount: 0, confirmChecked: false, loading: false });
      setToast({
        message: `${personRole} "${cust.name || cust.phone}" ${t('permanently deleted from CRM.')}`,
        type: 'success'
      });
    } catch (err) {
      console.error('Failed to delete customer:', err);
      setToast({
        message: err.response?.data?.message || t(`Failed to delete ${personRole.toLowerCase()}`),
        type: 'error'
      });
      setDeleteConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ── Open Customer Statement Drawer ───────────────────────────────────────────
  const handleOpenStatement = async (cust) => {
    setStatementCustomer(cust);
    setStatementLoading(true);
    setStatementBills([]);
    try {
      const cleanPhone = String(cust.phone || '').replace(/\D/g, '').slice(-10);
      const res = await api.get('/bills', {
        params: { 
          customerPhone: cleanPhone,
          phone: cleanPhone,
          customerName: cust.name,
          limit: 100, 
          status: 'Paid,Unpaid,Partial',
          salesCategory: channelKey 
        }
      });
      const rawBills = res.data?.bills || [];
      const targetName = (cust.name || '').trim().toLowerCase();
      // Precise client-side filter ensuring only this customer's genuine completed bills appear (Paid, Unpaid, Partial)
      const filtered = rawBills.filter(b => {
        if (b.status !== 'Paid' && b.status !== 'Unpaid' && b.status !== 'Partial') return false;
        const bPhone = String(b.customerPhone || '').replace(/\D/g, '').slice(-10);
        const bName = String(b.customerName || '').trim().toLowerCase();
        if (cleanPhone && bPhone && bPhone === cleanPhone) return true;
        if (targetName && targetName !== 'guest' && targetName !== '-' && bName && (bName === targetName || bName.startsWith(targetName) || targetName.startsWith(bName))) return true;
        return false;
      });
      setStatementBills(filtered);
    } catch (err) {
      console.error('Failed to load statement bills:', err);
      setToast({ message: t('Failed to load transaction history'), type: 'error' });
    } finally {
      setStatementLoading(false);
    }
  };

  // ── Open Khata Ledger Drawer ─────────────────────────────────────────────────
  const handleOpenLedger = async (account) => {
    setSelectedLedgerAccount(account);
    setLedgerLoading(true);
    try {
      const data = await getKhataLedger(account.phoneNumber, effectiveKhataChannel);
      setLedgerBills(data.bills || []);
      if (data?.account) {
        setSelectedLedgerAccount(prev => (prev ? { ...prev, balance: data.account.balance ?? prev.balance } : prev));
      }
    } catch (err) {
      console.error('Failed to load ledger:', err);
      setToast({ message: t('Failed to load Khata bills'), type: 'error' });
    } finally {
      setLedgerLoading(false);
    }
  };

  // ── Helper: Capture Exact Original Thermal Receipt Image for Khata Reminder ──
  const captureEBillImageForAccount = async (account, cleanPhone, preloadedBill = null) => {
    try {
      let billData = preloadedBill;
      if (!billData || !Array.isArray(billData.items) || billData.items.length === 0) {
        const ledgerRes = await getKhataLedger(cleanPhone).catch(() => null);
        const unpaidBills = ledgerRes?.bills || [];
        const targetRef = (unpaidBills.length > 0 ? unpaidBills[0] : null) || ledgerRes?.latestBill;
        if (targetRef?._id) {
          billData = await getBillById(targetRef._id).catch(() => targetRef);
        } else if (targetRef) {
          billData = targetRef;
        }

        if (!billData || !Array.isArray(billData.items) || billData.items.length === 0) {
          try {
            const directRes = await getBills({ search: cleanPhone, limit: 1 });
            if (directRes?.bills?.[0]) {
              billData = await getBillById(directRes.bills[0]._id).catch(() => directRes.bills[0]);
            }
          } catch (e) {}
        }
      }

      if (!billData) {
        billData = {
          billNumber: 'RET-0013',
          customerName: account.customerName || 'Customer',
          customerPhone: cleanPhone,
          total: Number(account.balance || 0),
          subtotal: Number(account.balance || 0),
          createdAt: new Date().toISOString(),
          status: 'Unpaid',
          items: []
        };
      }

      // Mount exact original receipt in offscreen container and paint
      setEBillCaptureData({ bill: billData, account });
      await new Promise(r => setTimeout(r, 260));

      const captureNode = document.getElementById('khata-ebill-capture-node');
      if (captureNode) {
        const canvas = await Promise.race([
          html2canvas(captureNode, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0
          }),
          new Promise(r => setTimeout(() => r(null), 8000))
        ]);

        if (canvas) {
          const b64 = canvas.toDataURL('image/jpeg', 0.92);
          return { imageBase64: b64, billNumber: billData.billNumber };
        }
      }
    } catch (e) {
      console.warn('[Khata Reminder] E-bill capture skipped:', e);
    } finally {
      setEBillCaptureData(null);
    }
    return { imageBase64: null, billNumber: null };
  };

  // ── Open WhatsApp Reminder Preview Modal with Read More/Less ─────────────────
  const handleOpenReminderPreview = async (account) => {
    const clean = String(account.phoneNumber || '').replace(/\D/g, '').slice(-10);
    setSendingReminderPhone(clean);
    try {
      // 1. Fetch debtor's ledger to retrieve the real original bill
      const ledgerRes = await getKhataLedger(clean).catch(() => null);
      const unpaidBills = ledgerRes?.bills || [];
      const targetBillRef = (unpaidBills.length > 0 ? unpaidBills[0] : null) || ledgerRes?.latestBill;
      
      let fullBill = null;
      if (targetBillRef?._id) {
        fullBill = await getBillById(targetBillRef._id).catch(() => targetBillRef);
      } else if (targetBillRef) {
        fullBill = targetBillRef;
      }

      if (!fullBill || !Array.isArray(fullBill.items) || fullBill.items.length === 0) {
        try {
          const directRes = await getBills({ search: clean, limit: 1 });
          if (directRes?.bills?.[0]) {
            fullBill = await getBillById(directRes.bills[0]._id).catch(() => directRes.bills[0]);
          }
        } catch (e) {}
      }

      const billNo = fullBill?.billNumber || unpaidBills[0]?.billNumber || '';
      const amountStr = Number(account.balance || 0).toLocaleString('en-IN');
      const catLabel = channelKey ? ` (${channelKey})` : '';

      // Dynamic depot and store settings directly from database (no code fallbacks)
      const shopName = (storeSettings.restaurantName || '').trim();
      const shopAddress = (storeSettings.address || '').replace(/\r?\n/g, ', ').trim();
      const shopPhone = (storeSettings.phone || '').trim();
      const footerMsg = (storeSettings.footerMessage || '').replace(/\*/g, '').trim();

      const headerTitle = shopName ? `*${shopName.toUpperCase()} - PAYMENT REMINDER*` : `*PAYMENT REMINDER*`;
      const fromLine = shopName ? `from ${shopName}.` : 'regarding your pending balance.';
      const addressBlock = shopAddress ? `*Depot Address:* ${shopAddress}\n` : '';
      const contactBlock = shopPhone ? `*Contact:* ${shopPhone}\n` : '';
      const footerBlock = footerMsg ? `${footerMsg}` : '';
      const footerSection = (addressBlock || contactBlock || footerBlock)
        ? `\n\n${addressBlock}${contactBlock}${footerBlock}`.trimEnd()
        : '';

      const formatDateTime12 = (dateInput) => {
        if (!dateInput) return '';
        const d = new Date(dateInput);
        if (isNaN(d.getTime())) return '';
        const datePart = d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Kolkata'
        });
        const timePart = d.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'Asia/Kolkata'
        });
        return `${datePart}, ${timePart}`;
      };

      const getDaysCompleted = (dateInput) => {
        if (!dateInput) return 0;
        const billedDate = new Date(dateInput);
        if (isNaN(billedDate.getTime())) return 0;
        const now = new Date();
        const diffMs = now.getTime() - billedDate.getTime();
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      };

      const formatDaysText = (days) => {
        if (days <= 0) return 'Today (0 days completed)';
        if (days === 1) return '1 day completed';
        return `${days} days completed`;
      };

      let msg = '';
      let displayBillNo = billNo;

      if (unpaidBills.length > 1) {
        // Chronological order (oldest to newest)
        const chronologicalBills = [...unpaidBills].sort(
          (a, b) => new Date(a.billedAt || a.createdAt) - new Date(b.billedAt || b.createdAt)
        );
        const oldestBill = chronologicalBills[0];
        const latestBill = chronologicalBills[chronologicalBills.length - 1];

        const oldestDateStr = formatDateTime12(oldestBill?.billedAt || oldestBill?.createdAt);
        const oldestDays = getDaysCompleted(oldestBill?.billedAt || oldestBill?.createdAt);

        const latestDateStr = formatDateTime12(latestBill?.billedAt || latestBill?.createdAt);
        const latestDays = getDaysCompleted(latestBill?.billedAt || latestBill?.createdAt);

        const breakdownLines = chronologicalBills.map((b) => {
          const bDue = b.status === 'Partial'
            ? (b.dueAmount ?? Math.max(0, (b.total || 0) - (b.paidAmount || b.amountPaid || 0)))
            : (b.total || 0);
          const bDate = formatDateTime12(b.billedAt || b.createdAt);
          const bDays = getDaysCompleted(b.billedAt || b.createdAt);
          const daysStr = formatDaysText(bDays);
          return `• #${b.billNumber || 'Bill'} (${bDate}): ₹${Number(bDue).toLocaleString('en-IN')} • ${daysStr}`;
        }).join('\n');

        const totalKhataWeight = (unpaidBills.length > 0 ? unpaidBills : []).reduce((sum, b) => sum + (getBillTotalWeightKg(b) || 0), 0);
        const weightKhataLine = totalKhataWeight > 0 ? `\n• *Total Purchased Weight:* *${totalKhataWeight.toFixed(1).replace(/\.0$/, '')} Kg*` : '';

        msg = `${headerTitle}\n\nNamaskaram *${account.customerName || 'Customer'}* garu,\n\nThis is a friendly reminder ${fromLine}\nYou have an outstanding Khata balance of *₹${amountStr}* across ${unpaidBills.length} pending bills${catLabel}.${weightKhataLine}\n\n• *Oldest Pending Since:* ${oldestDateStr} (${formatDaysText(oldestDays)})\n• *Latest Bill Date:* ${latestDateStr} (${formatDaysText(latestDays)})\n\n*Pending Bills Breakdown:*\n${breakdownLines}\n\nKindly clear this pending amount at your earliest convenience via UPI or Cash.${footerSection}`;
        displayBillNo = `${latestBill?.billNumber || displayBillNo} (+${unpaidBills.length - 1} more)`;
      } else {
        const singleBill = unpaidBills[0] || fullBill;
        const billDateStr = formatDateTime12(singleBill?.billedAt || singleBill?.createdAt);
        const billDays = getDaysCompleted(singleBill?.billedAt || singleBill?.createdAt);
        const daysText = formatDaysText(billDays);
        const billRef = displayBillNo ? ` for Bill #${displayBillNo}` : '';
        const singleWeight = getBillTotalWeightKg(singleBill);
        const singleWeightLine = singleWeight > 0 ? `\n• *Total Purchased Weight:* *${singleWeight.toFixed(1).replace(/\.0$/, '')} Kg*` : '';

        msg = `${headerTitle}\n\nNamaskaram *${account.customerName || 'Customer'}* garu,\n\nThis is a friendly reminder ${fromLine}\nYou have an outstanding Khata balance of *₹${amountStr}*${billRef}${catLabel}.\n\n• *Billed Date & Time:* ${billDateStr}${singleWeightLine}\n• *Pending Duration:* ${daysText}\n\nKindly clear this pending amount at your earliest convenience via UPI or Cash.${footerSection}`;
      }

      setReminderPreviewModal({
        isOpen: true,
        account,
        cleanPhone: clean,
        billNumber: displayBillNo,
        billData: fullBill,
        fullMessage: msg,
        isExpanded: false,
        loading: false
      });
    } catch (err) {
      console.error('Error preparing reminder:', err);
      setToast({ message: t('Failed to prepare payment reminder'), type: 'error' });
    } finally {
      setSendingReminderPhone(null);
    }
  };

  // ── Confirm & Send Reminder with Original Bill Receipt ───────────────────────
  const handleConfirmSendReminder = async () => {
    const { account, cleanPhone, billNumber, billData, fullMessage } = reminderPreviewModal;
    setReminderPreviewModal(prev => ({ ...prev, loading: true }));
    try {
      const { imageBase64 } = await captureEBillImageForAccount(account, cleanPhone, billData);

      const res = await sendKhataReminder({
        phoneNumber: cleanPhone,
        customerName: account.customerName,
        balance: account.balance,
        billNumber: billNumber || undefined,
        category: channelKey,
        imageBase64: imageBase64 || undefined,
        customMessage: fullMessage
      });

      setReminderPreviewModal(prev => ({ ...prev, isOpen: false, loading: false }));

      if (res?.success && res?.isWhatsAppConnected) {
        setToast({ 
          message: `WhatsApp reminder with original e-bill receipt sent directly to ${account.customerName || 'Customer'} (+91 ${cleanPhone})!`, 
          type: 'success' 
        });
      } else {
        setOfflineReminderModal({
          isOpen: true,
          account,
          cleanPhone,
          waText: res?.whatsappText || fullMessage
        });
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
      setToast({ message: err.response?.data?.message || t('Failed to deliver WhatsApp reminder'), type: 'error' });
      setReminderPreviewModal(prev => ({ ...prev, loading: false }));
    }
  };

  // ── Send 1-Click WhatsApp Dues Reminder (DIRECT BACKGROUND DISPATCH WITH E-BILL) ─────────
  const handleSendReminder = async (account) => {
    await handleOpenReminderPreview(account);
  };

  // ── Trigger Manual Bulk Reminder ─────────────────────────────────────────────
  const handleSendBulkReminders = async () => {
    if (khataAccounts.length === 0) {
      setToast({ message: t('No debtors with pending dues in this channel'), type: 'info' });
      return;
    }
    setToast({ message: `Sending direct payment reminders to ${khataAccounts.length} debtors...`, type: 'info' });
    let successCount = 0;
    for (const acc of khataAccounts) {
      const clean = String(acc.phoneNumber || '').replace(/\D/g, '').slice(-10);
      try {
        const { imageBase64, billNumber } = await captureEBillImageForAccount(acc, clean);
        const res = await sendKhataReminder({
          phoneNumber: clean,
          customerName: acc.customerName,
          balance: acc.balance,
          billNumber: billNumber || undefined,
          category: channelKey,
          imageBase64: imageBase64 || undefined
        });
        if (res?.success) successCount++;
      } catch (e) {}
    }
    setToast({ message: `✅ Successfully dispatched direct reminders to ${successCount} debtors!`, type: 'success' });
  };

  // ── Settle Khata Payment ─────────────────────────────────────────────────────
  const handleSettleSubmit = async (paymentDetails) => {
    setSubmittingPayment(true);
    try {
      const targetDue = paymentTargetBill
        ? (paymentTargetBill.status === 'Partial'
            ? (paymentTargetBill.dueAmount ?? Math.max(0, (paymentTargetBill.total || 0) - (paymentTargetBill.paidAmount || paymentTargetBill.amountPaid || 0)))
            : (paymentTargetBill.total || 0))
        : (paymentAccount?.balance || 0);
      const isPartialMode = paymentDetails.mode === 'Partial';
      const amt = isPartialMode
        ? Number(paymentDetails.paidAmount ?? paymentDetails.amountPaid ?? paymentDetails.partialPayment?.paidAmount ?? 0)
        : Number(targetDue || 0);
      const partialMethod = paymentDetails.partialPayment?.method || 'Cash';
      const upiApp = isPartialMode
        ? (paymentDetails.partialPayment?.upiApp || paymentDetails.upiApp)
        : paymentDetails.upiApp;

      await settleKhata({
        phoneNumber: paymentAccount.phoneNumber,
        amount: amt,
        paymentMode: paymentDetails.mode || 'Cash',
        splitPayments: paymentDetails.splitPayments,
        upiApp,
        partialMethod,
        note: `Settlement for ${effectiveKhataChannel} Khata via ${isPartialMode ? `Partial (${partialMethod})` : paymentDetails.mode}`,
        targetBillId: paymentTargetBill?._id,
        category: effectiveKhataChannel
      });

      setToast({ message: `Payment of ₹${amt.toLocaleString()} settled successfully!`, type: 'success' });
      setPaymentModalOpen(false);

      const wasSingleBill = !!paymentTargetBill;
      const ledgerPhone = paymentAccount?.phoneNumber;
      setPaymentAccount(null);
      setPaymentTargetBill(null);

      if (wasSingleBill && ledgerPhone && selectedLedgerAccount) {
        // Keep ledger modal open — re-fetch just this customer's bills from server
        setLedgerLoading(true);
        try {
          const freshData = await getKhataLedger(ledgerPhone, effectiveKhataChannel);
          setLedgerBills(freshData.bills || []);
          if (freshData?.account) {
            setSelectedLedgerAccount(prev => prev ? { ...prev, balance: freshData.account.balance ?? prev.balance } : prev);
          }
        } catch (e) {
          // fallback: manual state update using targetDue
          setLedgerBills(prev => prev
            .map(b => {
              if (String(b._id) !== String(paymentTargetBill?._id || '')) return b;
              const prevDue = b.status === 'Partial'
                ? (b.dueAmount ?? Math.max(0, (b.total || 0) - (b.paidAmount || b.amountPaid || 0)))
                : (b.total || 0);
              const newDue = Math.max(0, prevDue - amt);
              if (newDue <= 0) return null;
              return { ...b, paidAmount: (b.paidAmount || b.amountPaid || 0) + amt, dueAmount: newDue, status: 'Partial' };
            })
            .filter(Boolean)
          );
          setSelectedLedgerAccount(prev => prev ? { ...prev, balance: Math.max(0, (prev.balance || 0) - amt) } : prev);
        } finally {
          setLedgerLoading(false);
        }
        loadChannelStats();
      } else {
        // Full khata settle — close ledger and reload all
        setSelectedLedgerAccount(null);
        setLedgerBills([]);
        loadKhataData();
        loadChannelStats();
      }
    } catch (err) {
      console.error('Error settling Khata:', err);
      setToast({ message: err.response?.data?.message || 'Settlement failed', type: 'error' });
    } finally {
      setSubmittingPayment(false);
    }
  };

  // ── Save Auto-Reminder Schedule (Present & Future Only) ──────────────────────
  const handleSaveSchedule = async () => {
    try {
      if (scheduleConfig.scheduleType === 'scheduled_date') {
        if (!scheduleConfig.date || scheduleConfig.date < todayIST) {
          setToast({ message: t('Please select a valid present or future date'), type: 'error' });
          return;
        }
      }

      localStorage.setItem(`ms_auto_reminder_${channelKey}`, JSON.stringify(scheduleConfig));
      setShowScheduleModal(false);
      setToast({ 
        message: `Auto-Reminder scheduled for ${scheduleConfig.scheduleType === 'daily' ? `Daily ${scheduleConfig.time}` : `${scheduleConfig.date} at ${scheduleConfig.time}`}!`, 
        type: 'success' 
      });
    } catch (e) {
      console.error(e);
    }
  };

  // Formatted Label for the header schedule badge
  const scheduleBadgeText = useMemo(() => {
    if (!scheduleConfig.enabled) return t('Auto-Reminder: Off');
    const [h, m] = (scheduleConfig.time || '10:00').split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const time12h = `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

    if (scheduleConfig.scheduleType === 'scheduled_date' && scheduleConfig.date) {
      const d = new Date(scheduleConfig.date + 'T00:00:00');
      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      return `${dateStr}, ${time12h}`;
    }
    return `Daily ${time12h}`;
  }, [scheduleConfig, t]);

  return (
    <div className="h-full flex flex-col bg-background overflow-y-auto lg:overflow-hidden w-full select-none">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── TOP HEADER BAR ── */}
      <div className="shrink-0 px-2 sm:px-3 py-1.5 sm:py-2 bg-surface border-b border-border shadow-2xs">
        <div className="flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Left: Back + Hub Identity */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                  isWholesale ? 'bg-amber-100 text-amber-900 border border-amber-300' : (isExport ? 'bg-sky-100 text-sky-900 border border-sky-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300')
                }`}>
                  {isWholesale ? <Building size={14} /> : (isExport ? <TrendingUp size={14} /> : <User size={14} />)}
                </span>
                <h1 className="text-xs sm:text-base font-black text-text-main truncate leading-tight">
                  {channelTitle}
                </h1>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider shrink-0 hidden md:inline-block ${
                  isWholesale ? 'bg-amber-50 text-amber-700 border border-amber-200' : (isExport ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200')
                }`}>
                  {channelKey}
                </span>
              </div>
              <p className="text-[10px] text-text-muted font-medium truncate mt-0.5 hidden sm:block">
                {channelSubtitle}
              </p>
            </div>
          </div>

          {/* Right: WhatsApp Schedule Pill + Contextual Quick Actions (Compact Icons on Small Screens) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* WhatsApp Schedule Pill */}
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0 ${
                scheduleConfig.enabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={scheduleBadgeText}
            >
              <span className={`w-2 h-2 rounded-full ${scheduleConfig.enabled ? 'bg-[#25D366] animate-pulse' : 'bg-slate-300'}`} />
              <Clock size={12} className="text-[#25D366] shrink-0" />
              <span className="text-[10.5px] font-mono font-bold hidden sm:inline">
                {scheduleBadgeText}
              </span>
            </button>

            {/* Contextual Action: + New Order if in Bills tab */}
            {activeTab === 'bills' && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('billing', { orderMode: isWholesale ? 'bulk' : (isExport ? 'export' : 'individual') })}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
                title={t('New Order')}
              >
                <Plus size={13} strokeWidth={2.5} className="shrink-0" />
                <span className="hidden sm:inline">{t('New Order')}</span>
              </button>
            )}

            {/* + Add New Customer / Dealer Button */}
            <button
              type="button"
              onClick={() => {
                setCustomerModal({
                  isOpen: true,
                  isEdit: false,
                  originalPhone: '',
                  loading: false,
                  data: {
                    name: '',
                    businessName: '',
                    phone: '',
                    category: channelKey,
                    exportSubCategory: 'Local',
                    address: { line1: '', area: '', city: 'Kadapa', district: 'YSR Kadapa', pincode: '' },
                    photo: ''
                  }
                });
              }}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
              title={isWholesale ? t('Add Dealer') : (isExport ? t('Add Client') : t('Add Customer'))}
            >
              <UserPlus size={13} strokeWidth={2.5} className="shrink-0" />
              <span className="hidden sm:inline">{isWholesale ? t('+ Add Dealer') : (isExport ? t('Add Client') : t('Add Customer'))}</span>
            </button>
          </div>
        </div>

        {/* ── 4 KPI CARDS (Compact Live Channel Snapshot — Clickable Tab Shortcuts) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={`p-2 bg-background rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-[#ea580c]/60 hover:shadow-xs active:scale-[0.99] ${
              activeTab === 'bills' ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'border-border'
            }`}
            title={t('Open Bills & History')}
          >
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider block">{t('Total Revenue')}</span>
            <span className="text-sm font-black text-emerald-700 font-mono">₹{stats.totalSales.toLocaleString()}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={`p-2 bg-background rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-[#ea580c]/60 hover:shadow-xs active:scale-[0.99] ${
              activeTab === 'bills' ? 'border-[#ea580c]/60 ring-1 ring-[#ea580c]/20' : 'border-border'
            }`}
            title={t('Open Bills & History')}
          >
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider block">{t('Total Bills')}</span>
            <span className="text-sm font-black text-text-main font-mono">{stats.totalBills}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('crm')}
            className={`p-2 bg-background rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-[#ea580c]/60 hover:shadow-xs active:scale-[0.99] ${
              activeTab === 'crm' ? 'border-[#ea580c]/60 ring-1 ring-[#ea580c]/20' : 'border-border'
            }`}
            title={t(`Open ${personRolePlural} CRM`)}
          >
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider block">{personRolePlural}</span>
            <span className="text-sm font-black text-text-main font-mono">{filteredCustomers.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('khata')}
            className={`p-2 rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-rose-400 hover:shadow-xs active:scale-[0.99] ${
              stats.totalDues > 0 ? 'bg-rose-50 border-rose-300' : 'bg-background border-border'
            } ${activeTab === 'khata' ? 'ring-1 ring-rose-400/40' : ''}`}
            title={t('Open Khata & Dues')}
          >
            <span className="text-[9.5px] font-bold text-rose-700 uppercase tracking-wider block">{t('Market Dues (Khata)')}</span>
            <span className="text-sm font-black text-rose-700 font-mono">₹{stats.totalDues.toLocaleString()}</span>
          </button>
        </div>

        {/* ── 3 UNIFIED NAVIGATION TABS ── */}
        <div className="flex items-center gap-1.5 mt-2 pt-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'crm', label: `${personRolePlural} CRM`, icon: Users, count: filteredCustomers.length },
            { id: 'khata', label: t('Khata & Dues'), icon: BookOpen, count: khataAccounts.length },
            { id: 'bills', label: t('Bills & History'), icon: FileText, count: stats.totalBills }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  isActive 
                    ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-xs' 
                    : 'bg-background border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface border border-border text-text-muted'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── COMPACT 2-PANEL LAYOUT (Zero Empty Space) ── */}
      <div className="lg:flex-1 flex flex-col lg:flex-row gap-2.5 p-2 sm:p-2.5 overflow-visible lg:overflow-hidden lg:min-h-0">

        {/* ── LEFT PANEL: PRIMARY WORKSPACE (68% Width on Desktop, Dynamic Height on Mobile) ── */}
        <div className="w-full lg:flex-1 h-auto lg:h-full flex flex-col bg-surface rounded-2xl border border-border shadow-xs overflow-visible lg:overflow-hidden shrink-0 lg:shrink">
          
          {/* TAB 1: BILLS & TRANSACTIONS TABLE */}
          {activeTab === 'bills' && (
            <div className="flex flex-col lg:h-full lg:flex-1 overflow-hidden max-h-[72vh] lg:max-h-none rounded-2xl">
              <BillHistory
                initialSalesType={channelKey}
                lockSalesType={true}
                user={user}
                onNavigate={onNavigate}
                onGoBack={null}
                pageTitle={`${channelKey} Bills & History`}
                pageSubtitle={`Manage and review ${channelKey.toLowerCase()} sales`}
                hideHeader={true}
              />
            </div>
          )}

          {/* TAB 2: CUSTOMERS & DEALERS CRM DIRECTORY */}
          {activeTab === 'crm' && (
            <div className="flex flex-col lg:h-full overflow-visible lg:overflow-hidden p-2.5">
              
              {/* HYBRID SEARCH-SELECT COMBOBOX BAR */}
              <div className="shrink-0 mb-2 space-y-2">
                <div ref={crmDropdownRef} className="relative w-full">
                  <div className="flex items-center bg-background border border-border hover:border-amber-400 focus-within:border-[#ea580c] focus-within:ring-2 focus-within:ring-orange-500/20 rounded-xl transition-all shadow-2xs">
                    <Search size={14} className="text-slate-400 ml-3 shrink-0" />
                    <input
                      type="text"
                      value={crmSearch}
                      onChange={(e) => {
                        setCrmSearch(e.target.value);
                        setIsCrmDropdownOpen(true);
                      }}
                      onFocus={() => setIsCrmDropdownOpen(true)}
                      placeholder={t(`Search or select ${personRole.toLowerCase()} (name, phone, shop, city)...`)}
                      className="w-full bg-transparent py-2 pl-2.5 pr-2 text-xs font-bold text-text-main focus:outline-none placeholder:text-text-muted/60"
                    />
                    {crmSearch && (
                      <button
                        type="button"
                        onClick={() => setCrmSearch('')}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md shrink-0"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCrmDropdownOpen(prev => !prev)}
                      className="px-2.5 py-2 border-l border-border/80 text-slate-400 hover:text-text-main hover:bg-surface-hover rounded-r-xl transition-colors cursor-pointer shrink-0"
                      title={t('Browse full directory dropdown')}
                    >
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isCrmDropdownOpen ? 'rotate-180 text-[#ea580c]' : ''}`} />
                    </button>
                  </div>

                  {/* Combobox Dropdown Flyout */}
                  {isCrmDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto animate-fade-in text-xs divide-y divide-border/60">
                      <div 
                        onClick={() => { setCrmSearch(''); setIsCrmDropdownOpen(false); }}
                        className="p-2.5 hover:bg-surface-hover cursor-pointer font-bold text-text-muted flex justify-between items-center"
                      >
                        <span>{t('All')} {personRolePlural}</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded-md border border-border">{customers.length}</span>
                      </div>
                      {customers.map(c => {
                        const cleanP = String(c.phone || '').replace(/\D/g, '').slice(-10);
                        const due = customerDueMap[cleanP] || 0;
                        return (
                          <div
                            key={c._id || c.phone}
                            onClick={() => {
                              setCrmSearch(c.name || c.phone);
                              setIsCrmDropdownOpen(false);
                            }}
                            className="p-2.5 hover:bg-amber-50/70 cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {c.photo ? (
                                <img src={c.photo} alt={c.name} className="w-7 h-7 rounded-full object-cover border border-amber-300 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">
                                  {(c.name || 'C').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="font-bold text-text-main block truncate leading-tight">{c.name || 'Guest'}</span>
                                <span className="text-[10px] text-text-muted font-mono">{c.phone} {c.businessName ? `• ${c.businessName}` : ''}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10.5px] font-mono font-bold text-emerald-700 block">₹{Number(c.totalSpend || 0).toLocaleString()}</span>
                              {due > 0 && <span className="text-[9.5px] font-mono font-black text-rose-600 block">₹{due} Due</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setCrmFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                      crmFilterMode === 'all' ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-background border-border text-text-muted'
                    }`}
                  >
                    {t('All')} ({customers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmFilterMode('spenders')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                      crmFilterMode === 'spenders' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background border-border text-text-muted'
                    }`}
                  >
                    ⭐ {t('Top Spenders')} (&gt;₹1k)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrmFilterMode('dues')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                      crmFilterMode === 'dues' ? 'bg-rose-600 text-white border-rose-600' : 'bg-background border-border text-text-muted'
                    }`}
                  >
                    ⚠️ {t('With Khata Dues')}
                  </button>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="lg:flex-1 overflow-y-auto max-h-[65vh] lg:max-h-none pr-0.5 lg:pr-1">
                {crmLoading ? (
                  <div className="py-6 lg:py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-amber-600" /></div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="py-6 lg:py-16 text-center text-slate-400 text-xs italic">
                    {t('No customers found matching this criteria')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredCustomers.map(cust => {
                      const cleanP = String(cust.phone || '').replace(/\D/g, '').slice(-10);
                      const due = customerDueMap[cleanP] || 0;
                      return (
                        <div
                          key={cust._id || cust.phone}
                          className="bg-background rounded-2xl border border-border p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Header: Avatar + Identity */}
                            <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/60">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {cust.photo ? (
                                  <img src={cust.photo} alt={cust.name} className="w-10 h-10 rounded-full object-cover border-2 border-amber-400 shrink-0 shadow-xs" />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-900 font-black text-sm flex items-center justify-center shrink-0 border border-amber-300">
                                    {(cust.name || 'C').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-black text-sm text-text-main truncate leading-tight">{cust.name || 'Guest'}</h3>
                                  {cust.businessName && <p className="text-[10px] text-text-muted truncate">{cust.businessName}</p>}
                                  {(() => {
                                    const addr = typeof cust.address === 'string' ? cust.address : (cust.address?.line1 || cust.address?.fullAddress || '');
                                    if (!addr) return null;
                                    return (
                                      <p className="text-[10px] text-text-muted truncate flex items-center gap-1 mt-0.5" title={addr}>
                                        <MapPin size={9} className="text-[#ea580c] shrink-0" />
                                        <span className="truncate">{addr}</span>
                                      </p>
                                    );
                                  })()}
                                  <p className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} className="text-[#ea580c] shrink-0" />
                                    <span>{cust.phone}</span>
                                  </p>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                                {channelKey}
                              </span>
                            </div>

                            {/* Card Metrics: Orders, Weight, Spend, Khata */}
                            <div className="grid grid-cols-4 gap-1 py-2 my-1 text-center bg-surface rounded-xl border border-border/70">
                              <div>
                                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Orders')}</span>
                                <span className="text-xs font-mono font-black text-text-main">{cust.totalVisits || 0}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Weight')}</span>
                                <span className="text-xs font-mono font-black text-amber-700">{Number(cust.totalWeightKg || 0).toFixed(1)} Kg</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Spend')}</span>
                                <span className="text-xs font-mono font-black text-emerald-700">₹{(cust.totalSpend || 0).toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Khata')}</span>
                                <span className={`text-xs font-mono font-black ${due > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                  {due > 0 ? `₹${due}` : t('Clear')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer: Statement Drawer + Edit + Delete */}
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenStatement(cust)}
                              className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <FileText size={12} className="text-[#ea580c]" />
                              <span>{t('Statement')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerModal({
                                  isOpen: true,
                                  isEdit: true,
                                  originalPhone: cust.phone,
                                  loading: false,
                                  data: {
                                    name: cust.name || '',
                                    businessName: cust.businessName || '',
                                    phone: cust.phone || '',
                                    category: cust.category || channelKey,
                                    exportSubCategory: cust.exportSubCategory || 'Local',
                                    address: typeof cust.address === 'string' ? { line1: cust.address, area: '', city: 'Kadapa', district: 'YSR Kadapa', pincode: '' } : (cust.address || { line1: '', area: '', city: 'Kadapa', district: 'YSR Kadapa', pincode: '' }),
                                    photo: cust.photo || ''
                                  }
                                });
                              }}
                              className="p-1.5 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-border rounded-xl cursor-pointer transition-all shrink-0"
                              title={t('Edit customer')}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmModal({
                                isOpen: true,
                                customer: cust,
                                dueAmount: due,
                                confirmChecked: false,
                                loading: false
                              })}
                              className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl cursor-pointer transition-all shrink-0"
                              title={t(`Delete ${personRole.toLowerCase()}`)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: KHATA DUES & DEBTORS */}
          {activeTab === 'khata' && (
            <div className="flex flex-col lg:h-full overflow-visible lg:overflow-hidden p-2.5">
              
              {/* Channel Filter Pills: All | Wholesale | Retail | Export (only in standalone All-Channels Khata page) */}
              {isAllChannels && (
                <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 mb-1.5">
                  {[
                    { id: 'All', label: t('All Debtors') },
                    { id: 'Wholesale', label: t('Wholesale') },
                    { id: 'Retail', label: t('Retail') },
                    { id: 'Export', label: t('Export') }
                  ].map(pill => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setKhataChannelFilter(pill.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        khataChannelFilter === pill.id
                          ? 'bg-[#ea580c] text-white shadow-xs'
                          : 'bg-surface border border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
              )}

              {/* HYBRID SEARCH-SELECT COMBOBOX BAR */}
              <div className="shrink-0 mb-2 space-y-2">
                <div ref={khataDropdownRef} className="relative w-full">
                  <div className="flex items-center bg-background border border-border hover:border-amber-400 focus-within:border-[#ea580c] focus-within:ring-2 focus-within:ring-orange-500/20 rounded-xl transition-all shadow-2xs">
                    <Search size={14} className="text-slate-400 ml-3 shrink-0" />
                    <input
                      type="text"
                      value={khataSearch}
                      onChange={(e) => {
                        setKhataSearch(e.target.value);
                        setIsKhataDropdownOpen(true);
                      }}
                      onFocus={() => setIsKhataDropdownOpen(true)}
                      placeholder={t('Search or select debtor (name, phone, amount)...')}
                      className="w-full bg-transparent py-2 pl-2.5 pr-2 text-xs font-bold text-text-main focus:outline-none placeholder:text-text-muted/60"
                    />
                    {khataSearch && (
                      <button
                        type="button"
                        onClick={() => setKhataSearch('')}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md shrink-0"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsKhataDropdownOpen(prev => !prev)}
                      className="px-2.5 py-2 border-l border-border/80 text-slate-400 hover:text-text-main hover:bg-surface-hover rounded-r-xl transition-colors cursor-pointer shrink-0"
                      title={t('Browse full debtors dropdown')}
                    >
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isKhataDropdownOpen ? 'rotate-180 text-[#ea580c]' : ''}`} />
                    </button>
                  </div>

                  {/* Combobox Dropdown Flyout */}
                  {isKhataDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto animate-fade-in text-xs divide-y divide-border/60">
                      <div 
                        onClick={() => { setKhataSearch(''); setIsKhataDropdownOpen(false); }}
                        className="p-2.5 hover:bg-surface-hover cursor-pointer font-bold text-text-muted flex justify-between items-center"
                      >
                        <span>{t('All Active Debtors')}</span>
                        <span className="font-mono bg-background px-2 py-0.5 rounded-md border border-border">{khataAccounts.length}</span>
                      </div>
                      {khataAccounts.map(a => (
                        <div
                          key={a._id || a.phoneNumber}
                          onClick={() => {
                            setKhataSearch(a.customerName || a.phoneNumber);
                            setIsKhataDropdownOpen(false);
                          }}
                          className="p-2.5 hover:bg-rose-50/70 cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-bold text-text-main block truncate leading-tight">{a.customerName || 'Customer'}</span>
                            <span className="text-[10px] text-text-muted font-mono">{a.phoneNumber}</span>
                          </div>
                          <span className="font-mono font-black text-rose-600 shrink-0">₹{Number(a.balance || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setKhataFilterMode('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                      khataFilterMode === 'all' ? 'bg-[#ea580c] text-white border-[#ea580c]' : 'bg-background border-border text-text-muted'
                    }`}
                  >
                    {t('All Active Debtors')} ({khataAccounts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setKhataFilterMode('high')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                      khataFilterMode === 'high' ? 'bg-rose-600 text-white border-rose-600' : 'bg-background border-border text-text-muted'
                    }`}
                  >
                    ⚠️ {t('High Dues')} (&gt;₹500)
                  </button>
                </div>
              </div>

              {/* Debtors List */}
              <div className="lg:flex-1 overflow-y-auto max-h-[65vh] lg:max-h-none pr-0.5 lg:pr-1">
                {khataLoading ? (
                  <div className="py-6 lg:py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-amber-600" /></div>
                ) : filteredKhataAccounts.length === 0 ? (
                  <div className="py-6 lg:py-16 text-center text-slate-400 text-xs italic">
                    {t('No debtors found matching this filter')}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {filteredKhataAccounts.map(account => {
                      const cleanPhone = String(account.phoneNumber || '').replace(/\D/g, '').slice(-10);
                      const matchedCust = customers.find(c => String(c.phone || '').replace(/\D/g, '').slice(-10) === cleanPhone);
                      const photoUrl = matchedCust?.photo || '';
                      const isSending = sendingReminderPhone === cleanPhone;

                      return (
                        <div 
                          key={account._id || account.phoneNumber}
                          className="bg-background rounded-2xl border border-rose-200/90 p-3 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
                        >
                          <div>
                            {/* Card Header: Avatar + Details + Due */}
                            <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/60">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                {photoUrl ? (
                                  <img
                                    src={photoUrl}
                                    alt={account.customerName}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-rose-300 shrink-0 shadow-xs"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-800 font-black text-sm flex items-center justify-center shrink-0 border border-rose-200">
                                    {(account.customerName || 'C').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <h3 className="font-black text-sm text-text-main truncate leading-tight">
                                    {account.customerName || matchedCust?.name || t('Customer')}
                                  </h3>
                                  <p className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                                    <Phone size={10} className="text-[#ea580c] shrink-0" />
                                    <span>{account.phoneNumber}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[9px] font-extrabold text-rose-600 uppercase tracking-wider block">{t('Pending')}</span>
                                <span className="text-sm font-black text-rose-700 font-mono">
                                  ₹{(account.balance || 0).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Unpaid Bills Meta & Weight */}
                            <div className="py-1.5 text-xs flex items-center justify-between text-text-muted">
                              <span className="font-medium text-[11px]">
                                {account.billCount || 1} {account.billCount === 1 ? t('Unpaid Bill') : t('Unpaid Bills')}
                              </span>
                              {account.totalWeightKg > 0 && (
                                <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                  ⚖️ {Number(account.totalWeightKg).toFixed(1)} Kg
                                </span>
                              )}
                              <span className="text-[10px] font-mono">
                                {account.updatedAt ? new Date(account.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                              </span>
                            </div>
                          </div>

                          {/* ACTION ROW: COMPACT ICON-ONLY WHATSAPP BUTTON + SINGLE VIEW & SETTLE BUTTON */}
                          <div className="pt-2 border-t border-border/60 flex items-center gap-1.5 mt-1">
                            {/* SMALL ICON-ONLY WHATSAPP BUTTON (Direct Background Dispatch) */}
                            <button
                              type="button"
                              disabled={isSending}
                              onClick={() => handleSendReminder(account)}
                              className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer disabled:opacity-50 shrink-0"
                              title={t('Send instant WhatsApp reminder directly in background')}
                            >
                              {isSending ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <MessageSquare size={13} />
                              )}
                            </button>

                            {/* SINGLE VIEW & SETTLE BUTTON */}
                            <button
                              type="button"
                              onClick={() => handleOpenLedger(account)}
                              className="flex-1 py-1.5 px-2.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5"
                            >
                              <CreditCard size={12} />
                              <span>{t('View & Settle')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: LIVE CHANNEL COMMAND & INSIGHTS (32% Width on Desktop) ── */}
        <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0 flex flex-col gap-2.5 pb-6 lg:pb-0 overflow-y-auto no-scrollbar">

          {/* WIDGET 1: FINANCIAL COLLECTION & SPLIT RATIO */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <PieChart size={14} className="text-[#ea580c]" />
                <span className="font-black text-xs text-text-main">{t('Payment & Collection Health')}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {channelKey}
              </span>
            </div>

            {/* Collection Progress Bar */}
            {(() => {
              const totalTurnover = (stats.totalSales || 0) + (stats.totalDues || 0);
              const collectedPct = totalTurnover > 0 ? Math.round((stats.totalSales / totalTurnover) * 100) : 100;
              const pendingPct = 100 - collectedPct;
              return (
                <div>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="text-emerald-700">{t('Collected')}: {collectedPct}%</span>
                    <span className="text-rose-600">{t('Pending Khata')}: {pendingPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-rose-200 overflow-hidden flex">
                    <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${collectedPct}%` }} />
                    <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${pendingPct}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Payment Modes Split */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-mono">
              <div className="p-2 bg-background rounded-xl border border-border">
                <span className="text-[9.5px] font-bold text-text-muted uppercase block">{t('Cash Sales')}</span>
                <span className="font-black text-text-main">₹{financialInsights.cashSales.toLocaleString()}</span>
              </div>
              <div className="p-2 bg-background rounded-xl border border-border">
                <span className="text-[9.5px] font-bold text-text-muted uppercase block">{t('UPI Sales')}</span>
                <span className="font-black text-text-main">₹{financialInsights.upiSales.toLocaleString()}</span>
              </div>
              <div className="p-2 bg-background rounded-xl border border-border">
                <span className="text-[9.5px] font-bold text-text-muted uppercase block">{t('Card Sales')}</span>
                <span className="font-black text-text-main">₹{financialInsights.cardSales.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* WIDGET 2: AUTO-REMINDER RADAR & BATCH DISPATCH */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-600" />
                <span className="font-black text-xs text-text-main">{t('24/7 Dues Dispatch Schedule')}</span>
              </div>
              <span className={`w-2 h-2 rounded-full ${scheduleConfig.enabled ? 'bg-[#25D366] animate-pulse' : 'bg-slate-300'}`} />
            </div>

            <div className="p-2.5 bg-background rounded-xl border border-border text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-text-muted font-bold text-[11px]">{t('Schedule Cadence')}:</span>
                <span className="font-black font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                  {scheduleConfig.scheduleType === 'daily' ? t('Everyday') : t('Specific Future Date')}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-text-muted font-bold text-[11px]">{t('Next Run Time')}:</span>
                <span className="font-mono font-black text-text-main text-[11px]">{scheduleBadgeText}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-text-muted font-bold text-[11px]">{t('Attach E-Bill')}:</span>
                <span className="font-bold text-[11px] text-text-main">{scheduleConfig.includeEBill ? `✓ ${t('Enabled')}` : `✕ ${t('Off')}`}</span>
              </div>
            </div>

            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="flex-1 py-1.5 px-2 bg-background hover:bg-surface-hover border border-border text-text-main rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                {t('Edit Schedule')}
              </button>
              <button
                type="button"
                onClick={handleSendBulkReminders}
                className="flex-1 py-1.5 px-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1"
                title={t('Trigger direct WhatsApp dues reminders to all debtors in this channel now')}
              >
                <Send size={11} />
                <span>{t('Remind All')}</span>
              </button>
            </div>
          </div>

          {/* WIDGET 3: TOP REVENUE ACCOUNTS LEADERBOARD */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" />
                <span className="font-black text-xs text-text-main">{t('Channel Leaderboard')}</span>
              </div>
              <span className="text-[10px] text-text-muted">{topSpenders.length} {t('Top Accounts')}</span>
            </div>

            {topSpenders.length === 0 ? (
              <p className="py-4 text-center text-slate-400 text-xs italic">{t('No transaction records yet')}</p>
            ) : (
              <div className="space-y-1.5">
                {topSpenders.map((cust, idx) => (
                  <div key={cust._id || cust.phone} className="p-2 bg-background rounded-xl border border-border/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-black text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-text-main block truncate leading-tight">{cust.name || 'Guest'}</span>
                        <span className="text-[10px] text-text-muted font-mono">{cust.totalVisits || 0} {t('Bills')}</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-emerald-700 text-xs shrink-0">
                      ₹{Number(cust.totalSpend || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* WIDGET 4: WHATSAPP BOT STATUS & CONNECTION */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${waBotStatus.status === 'CONNECTED' ? 'bg-[#25D366] shadow-[0_0_8px_#25D366]' : 'bg-rose-500'}`} />
              <div>
                <span className="font-black text-text-main block leading-tight">
                  {waBotStatus.status === 'CONNECTED' ? t('WhatsApp Gateway Online') : t('WhatsApp Bot Offline')}
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  {waBotStatus.status === 'CONNECTED' && waBotStatus.connectedNumber ? `+91 ${waBotStatus.connectedNumber}` : t('Scan QR to enable direct dispatch')}
                </span>
              </div>
            </div>
            {waBotStatus.status !== 'CONNECTED' && (
              <button
                type="button"
                onClick={() => setWhatsAppConnectOpen(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] shadow-xs cursor-pointer active:scale-95"
              >
                {t('Scan QR')}
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ── CUSTOMER ADD / EDIT MODAL ── */}
      {customerModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-slide-up">
            <div className="p-4 border-b border-border flex justify-between items-center bg-background">
              <div>
                <h3 className="font-black text-base text-text-main">
                  {customerModal.isEdit ? t('Edit Customer Details') : t('Add New Customer / Dealer')}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {channelTitle} • {channelKey} Channel
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModal({ isOpen: false, isEdit: false, originalPhone: '', loading: false, data: {} })}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-4 space-y-3.5 text-xs max-h-[80vh] overflow-y-auto">
              {/* Photo Upload with Circle Crop */}
              <div className="flex items-center gap-3.5 p-3 bg-background rounded-2xl border border-border">
                {customerModal.data.photo ? (
                  <img
                    src={customerModal.data.photo}
                    alt="Profile"
                    onClick={() => setCropperModal({ isOpen: true, imageSrc: customerModal.data.photo })}
                    title={t('Click to crop photo')}
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-xs shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 font-black text-xl flex items-center justify-center shrink-0 border border-amber-300">
                    {((customerModal.data.name || 'C').charAt(0) || 'C').toUpperCase()}
                  </div>
                )}
                <div className="space-y-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => setCropperModal({ isOpen: true, imageSrc: reader.result });
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-bold text-text-main flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                    >
                      <Camera size={13} />
                      <span>{customerModal.data.photo ? t('Change Photo') : t('Upload Photo')}</span>
                    </button>
                    {customerModal.data.photo && (
                      <button
                        type="button"
                        onClick={() => setCropperModal({ isOpen: true, imageSrc: customerModal.data.photo })}
                        title={t('Crop current photo')}
                        className="px-2.5 py-1 bg-orange-100 hover:bg-orange-200 text-[#ea580c] border border-orange-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                      >
                        <Crop size={12} />
                        <span>{t('Crop')}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted">{t('Auto-cropped circle profile avatar')}</p>
                </div>
              </div>

              {/* Phone Input */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {t('Phone Number (10 Digits)')}
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={customerModal.data.phone || ''}
                  onChange={(e) => setCustomerModal(prev => ({
                    ...prev,
                    data: { ...prev.data, phone: e.target.value.replace(/\D/g, '') }
                  }))}
                  placeholder="e.g. 9582425359 (Optional)"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold font-mono text-text-main focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {personRole} {t('Name')} *
                </label>
                <input
                  type="text"
                  required
                  value={customerModal.data.name || ''}
                  onChange={(e) => setCustomerModal(prev => ({
                    ...prev,
                    data: { ...prev.data, name: e.target.value }
                  }))}
                  placeholder="e.g. Saifuddin or Anand Kumar"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Shop / Business Name */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {t('Shop / Business Name (Optional)')}
                </label>
                <input
                  type="text"
                  value={customerModal.data.businessName || ''}
                  onChange={(e) => setCustomerModal(prev => ({
                    ...prev,
                    data: { ...prev.data, businessName: e.target.value }
                  }))}
                  placeholder="e.g. Royal Fish Mart"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Address / Location */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  {t('Address / Location (Optional)')}
                </label>
                <input
                  type="text"
                  value={
                    typeof customerModal.data.address === 'string'
                      ? customerModal.data.address
                      : (customerModal.data.address?.line1 || customerModal.data.address?.fullAddress || '')
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerModal(prev => ({
                      ...prev,
                      data: {
                        ...prev.data,
                        address: {
                          ...(typeof prev.data.address === 'object' ? prev.data.address : {}),
                          line1: val,
                          fullAddress: val,
                          city: prev.data.address?.city || 'Kadapa',
                          district: prev.data.address?.district || 'YSR Kadapa'
                        }
                      }
                    }));
                  }}
                  placeholder="e.g. Door No, Street, Landmark, Kadapa"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerModal({ isOpen: false, isEdit: false, originalPhone: '', loading: false, data: {} })}
                  className="flex-1 py-2 border border-border bg-background text-text-main rounded-xl font-bold text-xs cursor-pointer hover:bg-surface-hover"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={customerModal.loading}
                  className="flex-1 py-2 bg-gradient-to-r from-[#ea580c] to-[#c2410c] text-white rounded-xl font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {customerModal.loading ? t('Saving...') : t('Save & Persist')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── IMAGE CROPPER MODAL ── */}
      {cropperModal.isOpen && (
        <ImageCropperModal
          isOpen={cropperModal.isOpen}
          imageSrc={cropperModal.imageSrc}
          onClose={() => setCropperModal({ isOpen: false, imageSrc: '' })}
          onCropComplete={(croppedBase64) => {
            setCustomerModal(prev => ({
              ...prev,
              data: { ...prev.data, photo: croppedBase64 }
            }));
            setCropperModal({ isOpen: false, imageSrc: '' });
          }}
        />
      )}

      {/* ── CUSTOMER 360 STATEMENT DRAWER ── */}
      {statementCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex justify-end animate-fade-in">
          <div className="bg-surface w-full max-w-lg h-full shadow-2xl flex flex-col border-l border-border animate-slide-left">
            <div className="p-4 border-b border-border flex justify-between items-center bg-background">
              <div className="flex items-center gap-3">
                {statementCustomer.photo ? (
                  <img src={statementCustomer.photo} alt={statementCustomer.name} className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-900 font-black text-base flex items-center justify-center shrink-0">
                    {(statementCustomer.name || 'C').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-black text-base text-text-main">{statementCustomer.name || 'Customer'}</h3>
                  <p className="text-xs text-text-muted font-mono">{statementCustomer.phone}</p>
                  {statementCustomer.businessName && (
                    <p className="text-[10px] text-[#ea580c] font-bold mt-0.5">{statementCustomer.businessName}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatementCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Customer Statement Summary Pill */}
            <div className="px-4 py-2.5 bg-surface-hover/60 border-b border-border grid grid-cols-3 gap-2 text-xs shrink-0">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">{t('Customer Bills')}</span>
                <span className="font-mono font-black text-sm text-text-main">{statementBills.length}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">{t('Total Weight')}</span>
                <span className="font-mono font-black text-sm text-amber-600">
                  {(() => {
                    const bw = statementBills.reduce((acc, b) => acc + (getBillTotalWeightKg(b) || 0), 0);
                    const finalW = bw > 0 ? bw : (Number(statementCustomer?.totalWeightKg) || 0);
                    return Number(finalW).toFixed(1);
                  })()} Kg
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">{t('Total Spend')}</span>
                <span className="font-mono font-black text-sm text-emerald-700">
                  ₹{statementBills.reduce((sum, b) => sum + (Number(b.total) || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-text-muted block mb-1">
                {channelKey} {t('Transaction History')} ({statementBills.length} {t('Bills')})
              </span>
              {statementLoading ? (
                <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-amber-600" /></div>
              ) : statementBills.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">{t('No past bills recorded for this customer')}</div>
              ) : (
                statementBills.map(b => {
                  const billWeight = getBillTotalWeightKg(b);
                  const isPartial = b.status === 'Partial';
                  const isPaid = b.status === 'Paid';
                  const paidVal = Number(b.paidAmount ?? b.amountPaid ?? 0);
                  const dueVal = Number(b.dueAmount ?? Math.max(0, (Number(b.total) || 0) - paidVal));

                  return (
                    <div key={b._id} className="p-3 bg-background rounded-xl border border-border flex items-center justify-between text-xs hover:border-border/80 transition-all">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-text-main">#{b.billNumber}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                            isPaid 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                              : isPartial 
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' 
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}>
                            {b.status}
                          </span>
                          {billWeight > 0 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-mono">
                              ⚖️ {billWeight.toFixed(1)} Kg
                            </span>
                          )}
                        </div>
                        {isPartial && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5 font-mono">
                            Paid: ₹{paidVal.toLocaleString()} • Due: ₹{dueVal.toLocaleString()}
                          </div>
                        )}
                        <p className="text-[10px] text-text-muted font-mono mt-0.5">
                          {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-black text-sm text-text-main">₹{Number(b.total || 0).toLocaleString()}</div>
                        <button
                          type="button"
                          onClick={async () => {
                            const full = await getBillById(b._id);
                            setViewInvoice(full);
                          }}
                          className="text-[10.5px] font-bold text-[#ea580c] hover:underline cursor-pointer"
                        >
                          {t('View Bill')} &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KHATA LEDGER MODAL ── */}
      {selectedLedgerAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-slide-up max-h-[85vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-background">
              <div>
                <h3 className="font-black text-sm text-text-main">
                  {selectedLedgerAccount.customerName} - {t('Khata Ledger')}
                </h3>
                <p className="text-[10px] text-text-muted font-mono">{selectedLedgerAccount.phoneNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerAccount(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-rose-50 border-b border-rose-200 flex justify-between items-center text-xs">
              <span className="font-bold text-rose-800">{t('Total Outstanding Balance')}</span>
              <span className="font-mono font-black text-base text-rose-700">₹{(selectedLedgerAccount.balance || 0).toLocaleString()}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {ledgerLoading ? (
                <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-amber-600" /></div>
              ) : ledgerBills.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">{t('No unpaid bills in ledger')}</div>
              ) : (
                ledgerBills.map(b => (
                  <div key={b._id} className="p-3 bg-background rounded-xl border border-border flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono font-bold text-text-main">#{b.billNumber}</span>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="font-mono font-black text-sm text-rose-600 block">
                          ₹{Number(b.status === 'Partial' ? (b.dueAmount ?? Math.max(0, (b.total || 0) - (b.paidAmount || b.amountPaid || 0))) : b.total).toLocaleString()}
                        </span>
                        {b.status === 'Partial' && (
                          <span className="text-[10px] text-amber-700 font-bold block">
                            {t('Paid')}: ₹{Number(b.paidAmount || b.amountPaid || 0).toLocaleString()}
                          </span>
                        )}
                        {b.weightKg > 0 && (
                          <span className="text-[9.5px] text-slate-500 font-mono block">
                            ⚖️ {b.weightKg} Kg
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentAccount(selectedLedgerAccount);
                            setPaymentTargetBill(b);
                            setPaymentModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer flex items-center gap-1 transition-colors whitespace-nowrap"
                          title={t("Pay this bill")}
                        >
                          <CreditCard size={11} />
                          <span>{t('Pay Bill')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const full = await getBillById(b._id).catch(() => b);
                              setViewInvoice(full);
                            } catch (e) {
                              setViewInvoice(b);
                            }
                          }}
                          className="px-2.5 py-1 bg-surface-hover hover:bg-slate-200 dark:hover:bg-gray-700 text-text-main border border-border rounded-lg font-bold text-[11px] cursor-pointer flex items-center gap-1 transition-colors"
                          title={t("View original bill receipt")}
                        >
                          <Eye size={12} />
                          <span>{t('View Bill')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {(selectedLedgerAccount.balance || 0) > 0 && (
              <div className="p-3.5 border-t border-border bg-background shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const acc = selectedLedgerAccount;
                    setSelectedLedgerAccount(null);
                    setPaymentAccount(acc);
                    setPaymentTargetBill(null);
                    setPaymentModalOpen(true);
                  }}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl text-xs font-black shadow-md cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={14} />
                  <span>{t('Settle Full Amount')} (₹{(selectedLedgerAccount.balance || 0).toLocaleString()})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AUTO-REMINDER SCHEDULE MODAL (Present & Future Date + Time in IST) ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-sm shadow-2xl flex flex-col animate-slide-up max-h-[92vh] my-auto overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-background shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Clock size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-text-main">{t('Auto WhatsApp Reminder Settings')}</h3>
                  <p className="text-[10px] text-text-muted">{channelTitle} • {channelKey}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="p-4 space-y-3.5 text-xs overflow-y-auto flex-1 overscroll-contain">
              {/* Enable / Disable Switch */}
              <div className="flex items-center justify-between p-3 bg-background rounded-2xl border border-border">
                <div>
                  <span className="font-bold text-text-main block">{t('24/7 Automated Reminders')}</span>
                  <span className="text-[10px] text-text-muted">{t('Auto dispatch dues reminders to debtors')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setScheduleConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    scheduleConfig.enabled ? 'bg-[#25D366]' : 'bg-slate-300'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    scheduleConfig.enabled ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {/* Schedule Cadence Mode: Daily Recurring vs Specific Future Date */}
              <div className="p-3 bg-background rounded-2xl border border-border space-y-2">
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  {t('Reminder Cadence')}
                </label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-surface rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setScheduleConfig(prev => ({ ...prev, scheduleType: 'daily' }))}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scheduleConfig.scheduleType === 'daily'
                        ? 'bg-[#ea580c] text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    🔁 {t('Every Day')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleConfig(prev => ({ ...prev, scheduleType: 'scheduled_date' }))}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      scheduleConfig.scheduleType === 'scheduled_date'
                        ? 'bg-[#ea580c] text-white shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    📅 {t('Specific Date')}
                  </button>
                </div>
              </div>

              {/* DATE SELECTION (Present & Future Only, IST) */}
              {scheduleConfig.scheduleType === 'scheduled_date' && (
                <div className="p-3 bg-background rounded-2xl border border-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                      {t('Scheduled Date')}
                    </label>
                    <span className="text-[9.5px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {t('Present & Future Only')}
                    </span>
                  </div>
                  <input
                    type="date"
                    min={todayIST}
                    value={scheduleConfig.date || todayIST}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val >= todayIST) {
                        setScheduleConfig(prev => ({ ...prev, date: val }));
                      } else {
                        setToast({ message: t('Past dates are not allowed. Please pick present or future date.'), type: 'warning' });
                      }
                    }}
                    className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold font-mono text-text-main focus:outline-none focus:border-[#ea580c]"
                  />
                </div>
              )}

              {/* TIME PICKER (Uses Existing Reusable CustomTimePicker Component) */}
              <div className="p-3 bg-background rounded-2xl border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    {scheduleConfig.scheduleType === 'daily' ? t('Daily Delivery Time') : t('Execution Time')}
                  </label>
                  <span className="text-[9.5px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    24/7 Engine
                  </span>
                </div>
                <CustomTimePicker
                  value={scheduleConfig.time}
                  onChange={(newTime) => setScheduleConfig(prev => ({ ...prev, time: newTime }))}
                />
              </div>

              {/* Attachment Toggle */}
              <div className="flex items-center justify-between p-3 bg-background rounded-2xl border border-border">
                <div>
                  <span className="font-bold text-text-main block">{t('Attach Exact E-Bill Image')}</span>
                  <span className="text-[10px] text-text-muted">{t('Includes the rendered invoice photo')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={scheduleConfig.includeEBill}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, includeEBill: e.target.checked }))}
                  className="w-4 h-4 accent-[#25D366] cursor-pointer"
                />
              </div>
            </div>

            {/* Pinned Modal Footer */}
            <div className="p-3 border-t border-border/60 bg-background flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2 border border-border bg-surface hover:bg-surface-hover text-text-main rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl font-black text-xs shadow-md cursor-pointer active:scale-95 transition-all"
              >
                {t('Save Schedule')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OFFLINE WHATSAPP PROMPT MODAL ── */}
      {offlineReminderModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-4 space-y-3.5 text-xs animate-slide-up">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                <AlertCircle size={20} />
              </div>
              <div>
                <h3 className="font-black text-sm text-text-main">{t('WhatsApp Bot is Offline')}</h3>
                <p className="text-[10.5px] text-text-muted">{t('Choose how you want to deliver this reminder')}</p>
              </div>
            </div>

            <p className="p-3 bg-background rounded-xl border border-border text-[11px] leading-relaxed text-text-muted">
              {t('To send directly in background without opening any app, scan QR in WhatsApp settings once. Alternatively, open WhatsApp app right now.')}
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setOfflineReminderModal({ isOpen: false, account: null, cleanPhone: '', waText: '' });
                  setWhatsAppConnectOpen(true);
                }}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <QrCode size={14} />
                <span>{t('Scan QR / Link WhatsApp (Direct Send)')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const url = `https://wa.me/91${offlineReminderModal.cleanPhone}?text=${encodeURIComponent(offlineReminderModal.waText)}`;
                  window.open(url, '_blank');
                  setOfflineReminderModal({ isOpen: false, account: null, cleanPhone: '', waText: '' });
                }}
                className="w-full py-2 px-3 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>{t('Open in WhatsApp Web / App (Manual)')}</span>
              </button>

              <button
                type="button"
                onClick={() => setOfflineReminderModal({ isOpen: false, account: null, cleanPhone: '', waText: '' })}
                className="w-full py-1.5 text-slate-400 hover:text-slate-600 font-bold text-xs text-center cursor-pointer"
              >
                {t('Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTRALIZED PAYMENT MODAL (SETTLE KHATA) ── */}
      {paymentModalOpen && paymentAccount && (
        <PaymentModal
          total={Number(
            paymentTargetBill
              ? (paymentTargetBill.status === 'Partial'
                  ? (paymentTargetBill.dueAmount ?? Math.max(0, (paymentTargetBill.total || 0) - (paymentTargetBill.paidAmount || paymentTargetBill.amountPaid || 0)))
                  : (paymentTargetBill.total || 0))
              : (paymentAccount?.balance || 0)
          )}
          billNumber={paymentTargetBill ? paymentTargetBill.billNumber : `KHATA-${paymentAccount._id || paymentAccount.phoneNumber}`}
          tableNo={paymentTargetBill ? (paymentTargetBill.tableNo || '') : ''}
          customerPhone={paymentAccount?.phoneNumber || ''}
          customerName={paymentAccount?.customerName || 'Customer'}
          isLoading={submittingPayment}
          hideUnpaid={true}
          allowPartial={true}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentAccount(null);
            setPaymentTargetBill(null);
          }}
          onComplete={handleSettleSubmit}
        />
      )}

      {/* ── EXACT ORIGINAL THERMAL BILL RECEIPT NODE FOR HIGH-RES CAPTURE (MATCHES POS INVOICE) ── */}
      {/* ── HIDDEN 80mm THERMAL RECEIPT CANVAS NODE (Exact Match to App Thermal Receipt) ── */}
      {eBillCaptureData && (
        <div
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: '280px',
            opacity: 1,
            pointerEvents: 'none',
            zIndex: -9999
          }}
        >
          <div
            id="khata-ebill-capture-node"
            style={{
              width: '280px',
              backgroundColor: '#ffffff',
              color: '#000000',
              fontFamily: storeSettings.receiptFontFamily || "Arial, Helvetica, sans-serif",
              padding: '10px 10px 16px 10px',
              boxSizing: 'border-box'
            }}
          >
            {/* Store Header */}
            <div style={{ textAlign: 'center', margin: '0 auto 4px auto', width: '100%' }}>
              {storeSettings.restaurantName && (
                <div style={{ fontSize: '15px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.2' }}>
                  {storeSettings.restaurantName.toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: '10px', marginTop: '2px', lineHeight: '1.25', color: '#111' }}>
                {storeSettings.address && storeSettings.address.split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {storeSettings.phone && <div>PH: {storeSettings.phone}</div>}
              </div>
            </div>

            {/* Solid Separator */}
            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }} />

            {/* Bill Type / Invoice Title */}
            <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', margin: '3px 0' }}>
              {eBillCaptureData.bill.status === 'Unpaid' ? 'Unpaid (Khata)' : 'Tax Invoice'}
            </div>

            {/* Solid Separator */}
            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }} />

            {/* Order Type & Table */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', marginBottom: '2px', width: '100%' }}>
              {(() => {
                const b = eBillCaptureData.bill;
                const isExp = b.customerCategory === 'Export' || b.orderMode === 'export' || String(b.billNumber || '').startsWith('EXP-') || String(b.tableNo || '').startsWith('EXP-');
                const isWs = !isExp && (b.customerCategory === 'Wholesale' || b.orderMode === 'bulk' || String(b.billNumber || '').startsWith('WS-') || String(b.tableNo || '').startsWith('WS-'));
                const prefix = isExp ? 'EXP-' : (isWs ? 'WS-' : 'RET-');
                const cleanTable = (b.tableNo || '').replace(/^TAK-/i, prefix);
                const catName = isExp ? 'EXPORT' : (isWs ? 'WHOLESALE' : 'RETAIL');
                return `${catName}${cleanTable ? ` (${cleanTable})` : ''}`;
              })()}
            </div>

            {/* Date & Time */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
              <span>Date: {new Date(eBillCaptureData.bill.createdAt || Date.now()).toLocaleDateString('en-GB')}</span>
              <span style={{ fontWeight: 'bold' }}>{new Date(eBillCaptureData.bill.createdAt || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>

            {/* Cashier & Bill No */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
              <span>Cashier: {eBillCaptureData.bill.cashierName || 'admin'}</span>
              <span style={{ fontWeight: 'bold' }}>Bill No.: #{eBillCaptureData.bill.billNumber || 'RET-0013'}</span>
            </div>

            {/* Customer Details (Dynamically respects admin settings toggles for retail/wholesale/export) */}
            {(() => {
              const custConfig = storeSettings.receiptCustomerDisplay || {
                retail: { enabled: true, showName: true, showPhone: true, showAddress: false, showShopName: false },
                wholesale: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true },
                export: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true }
              };
              const b = eBillCaptureData.bill;
              const isExp = b.customerCategory === 'Export' || b.orderMode === 'export' || String(b.billNumber || '').startsWith('EXP-') || String(b.tableNo || '').startsWith('EXP-');
              const isWs = !isExp && (b.customerCategory === 'Wholesale' || b.orderMode === 'bulk' || String(b.billNumber || '').startsWith('WS-') || String(b.tableNo || '').startsWith('WS-'));
              const modeKey = isExp ? 'export' : (isWs ? 'wholesale' : 'retail');
              const cfg = custConfig[modeKey] || { enabled: true, showName: true, showPhone: true };
              if (!cfg.enabled) return null;

              const cName = cfg.showName ? (b.customerName || eBillCaptureData.account?.customerName) : null;
              const cPhone = cfg.showPhone ? (b.customerPhone || eBillCaptureData.account?.phoneNumber) : null;
              const cShop = cfg.showShopName ? (b.shopName || b.customerShopName) : null;
              const cAddress = cfg.showAddress ? (b.customerAddress || b.deliveryAddress) : null;

              if (!cName && !cPhone && !cShop && !cAddress) return null;

              return (
                <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0', margin: '4px 0', fontSize: '10px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', marginBottom: '1px' }}>
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

            {/* Solid Separator */}
            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }} />

            {/* Items Table Header */}
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', fontSize: '10px', fontWeight: 'normal' }}>
              <div style={{ flex: '1 1 0%', textAlign: 'left' }}>Item</div>
              <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>Qty.</div>
              <div style={{ width: '56px', textAlign: 'right', flexShrink: 0 }}>Price</div>
              <div style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>Amount</div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '3px 0 5px 0', width: '100%' }} />

            {/* Grouped Items & Boxes */}
            {(() => {
              const boxes = {};
              const individual = [];
              const active = (eBillCaptureData.bill.items || []).filter(item => !item.isCancelled);
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
                  boxes[k].totalPrice += (Number(item.price || item.pricePerKg) || 0) * q;
                } else {
                  individual.push(item);
                }
              });

              const getItemCutting = (item) => {
                let cut = item?.cutType || item?.cuttingStyle || '';
                let rawName = item?.name || item?.itemName || 'Fresh Fish';
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
              const totalBillKg = getBillTotalWeightKg(eBillCaptureData.bill);

              return (
                <div>
                  {/* Wholesale Boxes */}
                  {Object.values(boxes).map((box) => (
                    <div key={`khata-box-${box.boxNumber}`} style={{ marginBottom: '5px', border: '1.5px solid #000000', borderRadius: '3px', padding: '3px 4px', background: '#fafafa' }}>
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', fontSize: '10px', borderBottom: '1px dashed #666', paddingBottom: '2px', marginBottom: '2px' }}>
                        <span>{box.boxLabel} ({box.items.length} items{box.totalWeightKg > 0 ? ` • ${box.totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg` : ''})</span>
                        <span style={{ fontWeight: 'bold' }}>{box.totalPrice.toFixed(2)}</span>
                      </div>
                      {box.items.map((item, idx) => {
                        const activeQty = (item.quantity || 1) - (item.cancelledQuantity || 0);
                        if (activeQty <= 0) return null;
                        const { displayName, cutType } = getItemCutting(item);
                        const qData = resolveItemQtyAndRate(item);
                        return (
                          <div key={idx} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', fontSize: '9.5px', paddingLeft: '3px', margin: '2px 0' }}>
                            <div style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '3px' }}>
                              <div>
                                • {displayName}
                              </div>
                              {cutType && (
                                <div style={{ fontSize: '9px', fontWeight: 600, color: '#222', marginTop: '1px' }}>
                                  Cut: <span style={{ fontWeight: 700, color: '#000' }}>{cutType}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ width: '38px', textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>{qData.qtyDisplay}</div>
                            <div style={{ width: '52px', textAlign: 'right', flexShrink: 0 }}>{qData.rateDisplay}</div>
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
                        <div style={{ fontSize: '9.5px', fontWeight: 'bold', margin: '3px 0 1px 0', textTransform: 'uppercase' }}>
                          🐟 Individual / Loose Items
                        </div>
                      )}
                      {individual.map((item, idx) => {
                        const activeQty = (item.quantity || 1) - (item.cancelledQuantity || 0);
                        if (activeQty <= 0) return null;
                        const { displayName, cutType, weightInfo } = getItemCutting(item);
                        const qData = resolveItemQtyAndRate(item);
                        return (
                          <div key={idx} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', fontSize: '9.5px', margin: '2px 0' }}>
                            <div style={{ flex: '1 1 0%', textAlign: 'left', wordBreak: 'break-word', paddingRight: '3px' }}>
                              <div style={{ fontWeight: 600 }}>
                                {displayName}
                                {!qData.isKg && weightInfo && <span style={{ fontWeight: 'normal' }}> ({weightInfo})</span>}
                              </div>
                              {cutType && (
                                <div style={{ fontSize: '9px', fontWeight: 600, color: '#222', marginTop: '1px' }}>
                                  Cut: <span style={{ fontWeight: 700, color: '#000' }}>{cutType}</span>
                                </div>
                              )}
                            </div>
                            <div style={{ width: '38px', textAlign: 'center', flexShrink: 0, fontWeight: 600 }}>{qData.qtyDisplay}</div>
                            <div style={{ width: '52px', textAlign: 'right', flexShrink: 0 }}>{qData.rateDisplay}</div>
                            <div style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontWeight: 'bold' }}>{qData.amountDisplay}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }} />

                  {/* Total Summary */}
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                    <span>
                      {boxKeys.length > 0 && totalLoose > 0
                        ? `Total: ${boxKeys.length} Box(es) + ${totalLoose} Loose`
                        : boxKeys.length > 0
                          ? `Total: ${boxKeys.length} ${boxKeys.length === 1 ? 'Box' : 'Boxes'} (${boxKg.toFixed(1).replace(/\.0$/, '')} Kg)`
                          : `${totalBillKg > 0 ? `Total Qty: ${totalBillKg.toFixed(1).replace(/\.0$/, '')} Kg` : `Total Qty: ${totalLoose}`}`}
                    </span>
                    <span>Sub Total: ₹{Number(eBillCaptureData.bill.subtotal || eBillCaptureData.bill.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Solid Separator */}
            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }} />

            {/* Grand Total */}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 'bold', margin: '3px 0' }}>
              <span>Grand Total</span>
              <span>₹{Number(eBillCaptureData.bill.total || eBillCaptureData.account?.balance || 0).toFixed(2)}</span>
            </div>

            {/* Double Border / 2px Solid Line */}
            <div style={{ height: '2px', backgroundColor: '#000000', margin: '6px 0 4px 0', width: '100%' }} />

            {/* Payment Status (Dynamic based on bill status / payment mode) */}
            {(() => {
              const b = eBillCaptureData.bill;
              if (b.status === 'Partial' || b.paymentMode === 'Partial') {
                const paid = Number(b.paidAmount ?? b.amountPaid ?? b.partialPayment?.paidAmount ?? 0);
                const due = Number(b.dueAmount ?? b.partialPayment?.dueAmount ?? Math.max(0, (b.total || 0) - paid));
                const method = b.partialPayment?.method || 'Cash';
                return (
                  <div style={{ textAlign: 'center', margin: '4px 0', borderTop: '1.5px dashed #000', borderBottom: '1.5px dashed #000', padding: '4px 0' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{t("PARTIALLY PAID (KHATA)")}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginTop: '2px' }}>
                      <span>{t("Paid")} ({method}): ₹{Number(paid).toFixed(2)}</span>
                      <span style={{ fontWeight: 'bold' }}>{t("Due")}: ₹{Number(due).toFixed(2)}</span>
                    </div>
                  </div>
                );
              } else if (b.status === 'Unpaid') {
                return (
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12px', margin: '4px 0', borderTop: '1.5px dashed #000', borderBottom: '1.5px dashed #000', padding: '4px 0' }}>
                    {t("UNPAID (KHATA BILL)")}
                  </div>
                );
              } else {
                return (
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '11px', margin: '4px 0' }}>
                    {b.paymentMode ? `${t("PAID VIA")} ${b.paymentMode.toUpperCase()}` : t("PAID INVOICE")}
                  </div>
                );
              }
            })()}

            {/* Separator */}
            <div style={{ borderTop: '1px dashed #666', margin: '6px 0', width: '100%' }} />

            {/* Footer Message (Dynamic from database settings) */}
            {storeSettings.footerMessage && (
              <div style={{ textAlign: 'center', fontSize: '9.5px', fontWeight: 'bold', marginTop: '4px' }}>
                {storeSettings.footerMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WHATSAPP REMINDER PREVIEW MODAL WITH READ MORE / READ LESS ── */}
      {reminderPreviewModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 sm:p-4 animate-fade-in select-none">
          <div className="bg-surface border border-border rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl p-4 sm:p-5 space-y-3.5 text-xs animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-[#25D366] flex items-center justify-center font-bold">
                  <MessageSquare size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-text-main">{t("WhatsApp Payment Reminder")}</h3>
                  <p className="text-[10.5px] text-text-muted">{t("Direct background send with original e-bill receipt")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReminderPreviewModal(prev => ({ ...prev, isOpen: false }))}
                className="text-text-muted hover:text-text-main p-1 rounded-lg hover:bg-surface-hover cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Debtor Details Card */}
            <div className="p-3 bg-background rounded-2xl border border-border flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-text-main">{reminderPreviewModal.account?.customerName || 'Customer'}</div>
                <div className="text-[11px] text-text-muted font-mono">+91 {reminderPreviewModal.cleanPhone}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-text-muted">{t("Khata Due")}</div>
                <div className="text-sm font-black text-red-600 font-mono">₹{Number(reminderPreviewModal.account?.balance || 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Original Bill Attached Badge */}
            <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                <CheckCircle size={13} className="text-[#25D366]" />
                <span>{t("Original Bill Receipt Attached:")}</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">#{reminderPreviewModal.billNumber || 'RET-0013'}</span>
              </div>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">{t("Thermal")}</span>
            </div>

            {/* Message Preview with Read More / Read Less */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl p-3 shadow-xs">
              <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-[#25D366]" />
                <span>{t("Message Preview")}</span>
              </div>
              <pre className="text-[11px] font-sans font-medium whitespace-pre-wrap leading-relaxed text-emerald-950 dark:text-emerald-100 max-h-48 overflow-y-auto">
                {reminderPreviewModal.isExpanded || (reminderPreviewModal.fullMessage || '').length <= 160
                  ? reminderPreviewModal.fullMessage 
                  : (reminderPreviewModal.fullMessage || '').slice(0, 160) + '...'}
              </pre>
              {(reminderPreviewModal.fullMessage || '').length > 160 && (
                <button
                  type="button"
                  onClick={() => setReminderPreviewModal(prev => ({ ...prev, isExpanded: !prev.isExpanded }))}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 font-bold transition-colors cursor-pointer"
                >
                  {reminderPreviewModal.isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  <span>{reminderPreviewModal.isExpanded ? t("Read less") : t("Read more")}</span>
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReminderPreviewModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-background border border-border text-text-main hover:bg-surface-hover rounded-xl font-bold text-xs cursor-pointer transition-colors"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={reminderPreviewModal.loading}
                onClick={handleConfirmSendReminder}
                className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                {reminderPreviewModal.loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{t("Sending e-Bill...")}</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>{t("Send via WhatsApp")}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVOICE VIEWER MODAL ── */}
      {viewInvoice && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 z-[999999] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}>
          <Invoice
            bill={viewInvoice}
            billData={viewInvoice}
            isHistoryView={true}
            onClose={() => setViewInvoice(null)}
          />
        </Suspense>
      )}

      {/* ── WHATSAPP QR CONNECT MODAL ── */}
      {whatsAppConnectOpen && (
        <WhatsAppConnectModal
          isOpen={whatsAppConnectOpen}
          onClose={() => {
            setWhatsAppConnectOpen(false);
            checkBotStatus();
          }}
        />
      )}

      {/* ── CRM DELETE STRONG WARNING CONFIRMATION MODAL ── */}
      {deleteConfirmModal.isOpen && deleteConfirmModal.customer && (() => {
        const target = deleteConfirmModal.customer;
        const dueAmt = Number(deleteConfirmModal.dueAmount || 0);
        return (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
            <div className="bg-surface border-2 border-rose-300 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col animate-slide-up">
              {/* Danger Header */}
              <div className="p-4 bg-gradient-to-r from-rose-600 to-red-700 text-white flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} className="text-amber-200 animate-pulse" />
                  </div>
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded-md bg-black/25 text-[9.5px] font-black uppercase tracking-widest mb-1">
                      {t('Danger Zone • Irreversible')}
                    </span>
                    <h3 className="font-black text-base leading-tight">
                      {t(`Delete ${personRole} Permanently?`)}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deleteConfirmModal.loading}
                  onClick={() => setDeleteConfirmModal({ isOpen: false, customer: null, dueAmount: 0, confirmChecked: false, loading: false })}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {/* Target Customer / Dealer / Client Card */}
                <div className="p-3 bg-background rounded-2xl border border-border space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {target.photo ? (
                        <img src={target.photo} alt={target.name} className="w-10 h-10 rounded-full object-cover border-2 border-rose-300 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-800 font-black text-sm flex items-center justify-center shrink-0 border border-rose-200">
                          {(target.name || 'C').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-black text-sm text-text-main truncate">{target.name || 'Guest'}</div>
                        {target.businessName && (
                          <div className="text-[10.5px] text-text-muted truncate">{target.businessName}</div>
                        )}
                        <div className="text-[11px] font-mono font-bold text-slate-600 flex items-center gap-1">
                          <Phone size={10} className="text-rose-600 shrink-0" />
                          <span>{target.phone}</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[9.5px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                      {channelKey}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/70 text-center">
                    <div className="p-1.5 bg-surface rounded-xl border border-border/70">
                      <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Orders')}</span>
                      <span className="font-mono font-black text-text-main">{target.totalVisits || 0}</span>
                    </div>
                    <div className="p-1.5 bg-surface rounded-xl border border-border/70">
                      <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Total Spend')}</span>
                      <span className="font-mono font-black text-emerald-700">₹{Number(target.totalSpend || 0).toLocaleString()}</span>
                    </div>
                    <div className={`p-1.5 rounded-xl border ${dueAmt > 0 ? 'bg-rose-50 border-rose-300' : 'bg-surface border-border/70'}`}>
                      <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Khata Due')}</span>
                      <span className={`font-mono font-black ${dueAmt > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                        {dueAmt > 0 ? `₹${dueAmt.toLocaleString()}` : t('Clear')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strong Warning Box */}
                <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-black text-rose-700 text-xs uppercase tracking-wide">
                    <Shield size={14} className="shrink-0" />
                    <span>{t('Strong Warning — Permanent Removal')}</span>
                  </div>
                  <ul className="space-y-1 text-[11px] font-semibold text-rose-900 list-disc pl-4 leading-snug">
                    <li>{t(`This ${personRole.toLowerCase()} profile, saved address, photo, and CRM loyalty summary will be permanently erased.`)}</li>
                    <li>{t('This action cannot be undone once confirmed.')}</li>
                    {dueAmt > 0 && (
                      <li className="font-black text-red-700">
                        {t('ACTIVE KHATA BALANCE DETECTED:')} ₹{dueAmt.toLocaleString()} {t('is still unpaid! Existing bills & Khata dues stay in ledger records, but this CRM link will be lost.')}
                      </li>
                    )}
                  </ul>
                </div>

                {/* Explicit Confirmation Checkbox */}
                <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-background border border-border hover:border-rose-300 cursor-pointer select-none transition-colors">
                  <input
                    type="checkbox"
                    checked={deleteConfirmModal.confirmChecked}
                    disabled={deleteConfirmModal.loading}
                    onChange={(e) => setDeleteConfirmModal(prev => ({ ...prev, confirmChecked: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-rose-600 rounded cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] font-bold text-text-main leading-snug">
                    {t('I understand this is permanent and want to delete')}{' '}
                    <span className="text-rose-700 font-black">"{target.name || target.phone}"</span>{' '}
                    {t(`from ${channelKey} CRM.`)}
                  </span>
                </label>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={deleteConfirmModal.loading}
                    onClick={() => setDeleteConfirmModal({ isOpen: false, customer: null, dueAmount: 0, confirmChecked: false, loading: false })}
                    className="flex-1 py-2.5 bg-background border border-border text-text-main hover:bg-surface-hover rounded-xl font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {t('Cancel, Keep Record')}
                  </button>
                  <button
                    type="button"
                    disabled={!deleteConfirmModal.confirmChecked || deleteConfirmModal.loading}
                    onClick={handleConfirmDeleteCustomer}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {deleteConfirmModal.loading ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>{t('Deleting...')}</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>{t('Delete Permanently')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
