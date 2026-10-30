import { getApiUrl, getSuperadminApiUrl } from "../../../config.js";
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { getDailyStats, getBillById, deleteBill } from '../../../api/billing/billing';
import { getMenuItems } from '../../../api/catalog/menu';
import { LayoutDashboard, Clock, ChevronDown, Calendar, Crown, BarChart2, Fish, Scale, Boxes, TrendingUp, Ship, Package, IndianRupee, Wallet, ArrowDownLeft, RotateCcw, Truck } from 'lucide-react';
import OperationModal from '../operations/OperationModal';
import { getOperationsSummary } from '../../../api/operations/operations';
import realtimeService from '../../../services/realtimeService';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

import Toast from '../system/Toast';
import Invoice from '../billing/Invoice';
import defaultFishLogo from '../../../assets/ynr_logo_hd.jpg';
import EditHistoryModal from '../billing/EditHistoryModal';
import { formatTime12 } from '../../../utils/formatters/timeFormat';

const Dashboard = ({ onNavigate, onGoBack }) => {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    sales: 0, orders: 0, averageOrderValue: 0, totalItems: 0,
    totalDiscount: 0, totalTax: 0, paymentMethods: [],
    activeOrders: 0, deliveryOrders: 0, dineInOrders: 0,
    takeawayOrders: 0, topItems: [], recentBills: [],
    openKOTs: [], cancelledOrders: [], editedOrders: [], hourlySales: []
  });
  const [selectedBill, setSelectedBill] = useState(null);
  const [selectedEditHistory, setSelectedEditHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFilter, setDateFilter] = useState('Today');
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [menuCatalog, setMenuCatalog] = useState([]);
  const [activeOperationModal, setActiveOperationModal] = useState(null);
  const [operationsData, setOperationsData] = useState({
    import: { totalAmount: 0, totalNetKg: 0, count: 0 },
    export: { totalAmount: 0, totalNetKg: 0, totalBoxes: 0, count: 0 },
    sales: { totalAmount: 0, totalInvoices: 0, totalBoxes: 0 },
    expenses: { totalAmount: 0, count: 0 },
    purchase: { totalAmount: 0, totalNetKg: 0, count: 0 },
    purchaseReturn: { totalAmount: 0, totalNetKg: 0, count: 0 },
    salesReturn: { totalAmount: 0, totalNetKg: 0, count: 0 },
    vehicleOthers: { totalAmount: 0, count: 0 }
  });

  const fetchOperations = useCallback(async () => {
    try {
      const summary = await getOperationsSummary();
      if (summary) setOperationsData(summary);
    } catch (e) {
      console.error('Error fetching operations summary:', e);
    }
  }, []);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  useEffect(() => {
    getMenuItems().then(items => {
      if (items && Array.isArray(items)) {
        setMenuCatalog(items);
      }
    }).catch(() => {});
  }, []);

  const getFishItemImage = (item) => {
    if (item.image && typeof item.image === 'string' && item.image.trim()) {
      return item.image;
    }
    const idStr = String(item._id || item.name || '').toLowerCase();
    const idPrimary = idStr.split('/')[0].split('(')[0].trim();
    const matched = menuCatalog.find(m => {
      const mName = String(m.name || '').toLowerCase();
      const primaryName = mName.split('/')[0].trim();
      return idStr.includes(mName) || mName.includes(idPrimary) || (idPrimary && primaryName && (idPrimary.includes(primaryName) || primaryName.includes(idPrimary)));
    });
    if (matched && matched.image) {
      return matched.image;
    }
    return defaultFishLogo;
  };

  const fetchTodayStats = useCallback(async () => {
    try {
      setLoading(true);
      let startDate, endDate;
      const now = new Date();
      if (dateFilter === 'Today') {
        startDate = undefined; endDate = undefined;
      } else if (dateFilter === 'Last 7 Days') {
        const past = new Date(now); past.setDate(past.getDate() - 7);
        startDate = past.toISOString(); endDate = now.toISOString();
      } else if (dateFilter === '1 Month') {
        const past = new Date(now); past.setMonth(past.getMonth() - 1);
        startDate = past.toISOString(); endDate = now.toISOString();
      } else if (dateFilter === '3 Months') {
        const past = new Date(now); past.setMonth(past.getMonth() - 3);
        startDate = past.toISOString(); endDate = now.toISOString();
      } else if (dateFilter === '6 Months') {
        const past = new Date(now); past.setMonth(past.getMonth() - 6);
        startDate = past.toISOString(); endDate = now.toISOString();
      } else if (dateFilter === '1 Year') {
        const past = new Date(now); past.setFullYear(past.getFullYear() - 1);
        startDate = past.toISOString(); endDate = now.toISOString();
      } else if (dateFilter === 'Custom' && customDateRange.start && customDateRange.end) {
        startDate = new Date(customDateRange.start).toISOString();
        const endD = new Date(customDateRange.end); endD.setDate(endD.getDate() + 1);
        endDate = endD.toISOString();
      }
      const data = await getDailyStats(startDate, endDate);
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setToast({ message: 'Failed to load dashboard data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customDateRange]);

  useEffect(() => {
    fetchTodayStats();
    const unsubOrderUpdated = realtimeService.subscribe('orderUpdated', fetchTodayStats);
    const unsubBillSettled = realtimeService.subscribe('billSettled', fetchTodayStats);
    const unsubTableStatusChanged = realtimeService.subscribe('tableStatusChanged', fetchTodayStats);
    const unsubNewKOT = realtimeService.subscribe('newKOT', fetchTodayStats);
    return () => {
      unsubOrderUpdated(); unsubBillSettled();
      unsubTableStatusChanged(); unsubNewKOT();
    };
  }, [fetchTodayStats]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentDate(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const targetTimeSlots = [
    '12:00 am', '03:00 am', '06:00 am', '09:00 am',
    '12:00 pm', '03:00 pm', '06:00 pm', '09:00 pm', '11:00 pm'
  ];

  const salesOverviewData = targetTimeSlots.map(timeStr => {
    const matched = stats.hourlySales?.find(item => formatTime12(item.time) === timeStr);
    return { time: timeStr, sales: matched ? matched.sales : 0, orders: matched ? matched.orders : 0 };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(9, 24, 38, 0.96)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          border: '1px solid #0284c7',
          borderRadius: '8px', padding: '8px 12px', color: '#ffffff'
        }}>
          <p style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 700, margin: '0 0 4px 0', fontFamily: 'monospace' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ fontSize: '12px', fontWeight: 800, color: entry.color, margin: '2px 0' }}>
              {entry.name}: {entry.name.includes('sales') ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const retailOrdersCount = stats.recentBills?.filter(b => !b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round(stats.orders * 0.7) || 0;
  const bulkOrdersCount = stats.recentBills?.filter(b => b.items?.some(i => i.sellingUnit === 'Box' || (i.name && i.name.includes('Box')))).length || Math.round(stats.orders * 0.3) || 0;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: isMobile ? '12px 0px 32px 0px' : '20px 24px', boxSizing: 'border-box' }}>

      {/* Compact Header Card with Neutral Border (no harsh colored borders) */}
      <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-xs mb-3 sm:mb-4 flex items-center justify-between flex-nowrap gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-xl bg-orange-100 text-[#ea580c] border border-orange-200 shadow-2xs shrink-0 flex items-center justify-center">
            <LayoutDashboard size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-800 tracking-tight leading-none m-0 whitespace-nowrap">Dashboard</h1>
              <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-[#FAF0E4] text-slate-600 font-bold border border-[#E8DCCB]">
                Overview
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold m-0 mt-0.5 truncate hidden sm:block">Monitor your fish business operations at a glance</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="inline-flex items-center gap-1.5 bg-white border border-[#E8DCCB] hover:border-slate-300 rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 font-bold text-xs text-slate-700 cursor-pointer shadow-2xs transition-colors"
            >
              <Calendar size={13} className="text-slate-500" />
              <span>{t(dateFilter)}</span>
              <ChevronDown size={13} className="text-slate-400" />
            </button>
            {isFilterDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsFilterDropdownOpen(false)} 
                />
                <div className="absolute right-0 top-full mt-1.5 w-36 bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl shadow-xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {['Today', 'Last 7 Days', '1 Month', '3 Months', '6 Months', '1 Year', 'Custom'].map(filter => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        if (filter === 'Custom') { setShowCustomDateModal(true); setIsFilterDropdownOpen(false); }
                        else { setDateFilter(filter); setIsFilterDropdownOpen(false); }
                      }}
                      className={`w-full text-left px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                        dateFilter === filter ? 'bg-orange-50 text-[#ea580c]' : 'text-slate-700 hover:bg-[#F5E8D8]'
                      }`}
                    >
                      {t(filter)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="hidden md:inline-flex items-center gap-1.5 text-slate-500 text-xs font-bold bg-white/70 px-2.5 py-1 rounded-lg border border-[#E8DCCB]/60">
            <Clock size={12} />
            <span>{currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
        </div>
      </div>

      {/* 8 YNR Fishes Operations Cards (Matching Notebook Layout) */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
              YNR Fishes Operations Grid
            </span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300">
              8 Core Modules
            </span>
          </div>
          <span className="text-[10.5px] text-slate-500 font-bold">
            Tap any box to record or view ledger
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: isMobile ? '8px' : '14px'
        }}>
          {/* Row 1, Card 1: IMPORT */}
          <div
            onClick={() => setActiveOperationModal('Import')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-sky-50 to-blue-100/60 border border-sky-300 shadow-sm hover:shadow-md hover:border-sky-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Ship size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Import
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-sky-200 text-sky-900">
                Harbor
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-sky-950 font-mono">
                {formatCurrency(operationsData.import?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>{operationsData.import?.totalNetKg || 0} Kg Net</span>
                <span className="text-sky-700 font-bold">{operationsData.import?.count || 0} entries</span>
              </div>
            </div>
          </div>

          {/* Row 1, Card 2: EXPORT */}
          <div
            onClick={() => setActiveOperationModal('Export')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-100/60 border border-amber-300 shadow-sm hover:shadow-md hover:border-amber-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#ea580c] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Package size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Export
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                Wholesale
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-amber-950 font-mono">
                {formatCurrency(operationsData.export?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>{operationsData.export?.totalBoxes || 0} Boxes</span>
                <span className="text-amber-800 font-bold">{operationsData.export?.totalNetKg || 0} Kg</span>
              </div>
            </div>
          </div>

          {/* Row 1, Card 3: SALES */}
          <div
            onClick={() => onNavigate ? onNavigate('billing') : setActiveOperationModal('Sales')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-emerald-50 to-green-100/60 border border-emerald-300 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <IndianRupee size={16} strokeWidth={2.5} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Sales
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                Live POS
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-emerald-950 font-mono">
                {formatCurrency(stats.sales || operationsData.sales?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>{stats.orders || 0} Invoices</span>
                <span className="text-emerald-700 font-bold">{operationsData.sales?.totalBoxes || 0} Boxes</span>
              </div>
            </div>
          </div>

          {/* Row 1, Card 4: EXPENSES */}
          <div
            onClick={() => setActiveOperationModal('Expenses')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-rose-50 to-red-100/60 border border-rose-300 shadow-sm hover:shadow-md hover:border-rose-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Wallet size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Expenses
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">
                OpEx
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-rose-950 font-mono">
                {formatCurrency(operationsData.expenses?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>Ice / Labor / Stall</span>
                <span className="text-rose-700 font-bold">{operationsData.expenses?.count || 0} vouchers</span>
              </div>
            </div>
          </div>

          {/* Row 2, Card 5: PURCHASE */}
          <div
            onClick={() => setActiveOperationModal('Purchase')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-100/60 border border-blue-300 shadow-sm hover:shadow-md hover:border-blue-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ArrowDownLeft size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Purchase
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-blue-200 text-blue-900">
                Local / Farm
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-blue-950 font-mono">
                {formatCurrency(operationsData.purchase?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>{operationsData.purchase?.totalNetKg || 0} Kg Net</span>
                <span className="text-blue-700 font-bold">{operationsData.purchase?.count || 0} lots</span>
              </div>
            </div>
          </div>

          {/* Row 2, Card 6: PURCHASE RETURN */}
          <div
            onClick={() => setActiveOperationModal('Purchase Return')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100/70 border border-amber-400 shadow-sm hover:shadow-md hover:border-amber-600 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <RotateCcw size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Purchase Return
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-950">
                Debit Note
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-amber-950 font-mono">
                {formatCurrency(operationsData.purchaseReturn?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>{operationsData.purchaseReturn?.totalNetKg || 0} Kg Rejected</span>
                <span className="text-amber-800 font-bold">{operationsData.purchaseReturn?.count || 0} claims</span>
              </div>
            </div>
          </div>

          {/* Row 2, Card 7: SALES RETURN */}
          <div
            onClick={() => setActiveOperationModal('Sales Return')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-orange-50 to-amber-100/60 border border-orange-300 shadow-sm hover:shadow-md hover:border-orange-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <RotateCcw size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Sales Return
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-orange-200 text-orange-900">
                Credit Note
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-orange-950 font-mono">
                {formatCurrency(operationsData.salesReturn?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>{operationsData.salesReturn?.totalNetKg || 0} Kg</span>
                <span className="text-orange-700 font-bold">{operationsData.salesReturn?.count || 0} returns</span>
              </div>
            </div>
          </div>

          {/* Row 2, Card 8: VEHICLE / OTHERS */}
          <div
            onClick={() => setActiveOperationModal('Vehicle / Others')}
            className="cursor-pointer group rounded-2xl p-3.5 sm:p-4 bg-gradient-to-br from-purple-50 to-violet-100/60 border border-purple-300 shadow-sm hover:shadow-md hover:border-purple-500 transition-all active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Truck size={16} />
                </div>
                <span className="font-black text-xs sm:text-sm text-slate-900 uppercase tracking-wide truncate">
                  Vehicle / Others
                </span>
              </div>
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-purple-200 text-purple-900">
                Fleet & Misc
              </span>
            </div>
            <div className="mt-2">
              <div className="text-lg sm:text-xl font-black text-purple-950 font-mono">
                {formatCurrency(operationsData.vehicleOthers?.totalAmount || 0)}
              </div>
              <div className="text-[10px] text-slate-600 font-bold mt-0.5 flex items-center justify-between">
                <span>Diesel & Transport</span>
                <span className="text-purple-700 font-bold">{operationsData.vehicleOthers?.count || 0} trips</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Selling + Sales Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '18px', marginBottom: '20px' }}>

        {/* Top Selling Items */}
        <div style={{ background: '#FDFBF7', borderRadius: '20px', border: '1px solid #E8DCCB', boxShadow: '0 4px 18px rgba(0,0,0,0.03)', padding: '20px 22px', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Crown size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{t('Top Selling Items')}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>Most sold fish items based on today's orders</p>
              </div>
            </div>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>{t(dateFilter)}</span>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
            {stats.topItems && stats.topItems.length > 0 ? (
              stats.topItems.slice(0, 5).map((item, i) => {
                const fishImg = getFishItemImage(item);
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      background: '#FAF3E8', border: '1px solid #E8DCCB',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <img
                        src={fishImg}
                        alt={item._id}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: '1px solid #fed7aa',
                          background: '#fff7ed'
                        }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = defaultFishLogo;
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          title={item._id}
                          style={{
                            fontWeight: 800,
                            fontSize: '0.84rem',
                            color: '#0f2942',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.25
                          }}
                        >
                          {t(item._id)}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                          {item.quantity} {t('Sold')}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{
                        color: '#994d1c',
                        fontWeight: 900,
                        fontSize: '0.88rem',
                        fontFamily: 'monospace',
                        background: '#fff7ed',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        border: '1px solid #fed7aa',
                        display: 'inline-block'
                      }}>
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '30px 10px', margin: 'auto 0' }}>
                <img
                  src={defaultFishLogo}
                  alt="No sales"
                  style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', marginBottom: '10px', opacity: 0.7 }}
                />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', fontWeight: 800, color: '#1e293b' }}>{t('No items sold today')}</h4>
                <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8', maxWidth: '260px', lineHeight: 1.4 }}>Top selling fish items will appear here once there are sales.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sales Overview Chart */}
        <div style={{ background: '#FDFBF7', borderRadius: '20px', border: '1px solid #E8DCCB', boxShadow: '0 4px 18px rgba(0,0,0,0.03)', padding: '22px 24px', display: 'flex', flexDirection: 'column', minHeight: '340px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={18} strokeWidth={2.2} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>{t('Sales Overview')}</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: '#64748b', fontWeight: 500 }}>Orders and sales throughout the day</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: '#2563eb' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} />
                <span>Orders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', fontWeight: 700, color: '#ea580c' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ea580c', display: 'inline-block' }} />
                <span>Sales (₹)</span>
              </div>
              <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>{t(dateFilter)}</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '260px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={salesOverviewData} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(14,165,233,0.16)" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }} />
                <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="sales" stroke="#fb923c" strokeWidth={2.5} dot={{ fill: '#fb923c', r: 4, stroke: '#ea580c', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="orders" stroke="#38bdf8" strokeWidth={2.5} dot={{ fill: '#38bdf8', r: 4, stroke: '#0284c7', strokeWidth: 1 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      {showCustomDateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', maxWidth: '400px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>{t('Select Custom Date Range')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>{t('Start Date')}</label>
                <input type="date" max={new Date().toLocaleDateString('en-CA')} value={customDateRange.start}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>{t('End Date')}</label>
                <input type="date" min={customDateRange.start || undefined} max={new Date().toLocaleDateString('en-CA')} value={customDateRange.end}
                  onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', color: '#1e293b', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => { setShowCustomDateModal(false); setDateFilter('Today'); }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                {t('Cancel')}
              </button>
              <button type="button" onClick={() => { if (customDateRange.start && customDateRange.end) { setShowCustomDateModal(false); fetchTodayStats(); } else { setToast({ message: t('Please select both start and end dates'), type: 'error' }); } }}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#ea580c', color: '#ffffff', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer' }}>
                {t('Apply Range')}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedBill && (
        <Invoice bill={selectedBill} onClose={() => setSelectedBill(null)} onEdit={() => {}} onDelete={() => {}} />
      )}

      {selectedEditHistory && (
        <EditHistoryModal isOpen={!!selectedEditHistory} onClose={() => setSelectedEditHistory(null)} history={selectedEditHistory} />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

    
      {/* Operation Management Modal */}
      {activeOperationModal && (
        <OperationModal
          isOpen={!!activeOperationModal}
          onClose={() => setActiveOperationModal(null)}
          operationType={activeOperationModal}
          onSaved={fetchOperations}
          menuCatalog={menuCatalog}
        />
      )}
</div>
  );
};

export default Dashboard;

