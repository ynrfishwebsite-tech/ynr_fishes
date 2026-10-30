import { getApiUrl, getSuperadminApiUrl } from "../../../config.js";
import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { getDailyStats, getBillById, deleteBill } from '../../../api/billing/billing';
import { getMenuItems } from '../../../api/catalog/menu';
import { LayoutDashboard, Clock, ChevronDown, Calendar, Crown, BarChart2, Fish, Scale, Boxes, TrendingUp } from 'lucide-react';
import realtimeService from '../../../services/realtimeService';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';

import Toast from '../system/Toast';
import Invoice from '../billing/Invoice';
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
    return '/assets/cards/sidebar_fish_crate.png';
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

      {/* 4 Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: isMobile ? '6px' : '16px',
        marginBottom: isMobile ? '12px' : '20px',
        padding: isMobile ? '0 4px' : 0
      }}>

        {/* Card 1: Total Fish Sales */}
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          borderRadius: '20px',
          padding: isMobile ? '12px 14px' : '18px 22px',
          border: '1px solid rgba(253,186,116,0.6)',
          boxShadow: '0 2px 8px rgba(234,88,12,0.06)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: isMobile ? '105px' : '142px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '50%',
                background: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(234,88,12,0.25)',
                flexShrink: 0
              }}>
                <Fish size={isMobile ? 15 : 17} strokeWidth={2.4} />
              </div>
              <span style={{
                fontSize: isMobile ? '0.78rem' : '0.86rem',
                fontWeight: 700,
                color: '#1e293b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {t('Total Fish Sales')}
              </span>
            </div>
            <span style={{
              background: '#ffedd5',
              color: '#c2410c',
              fontSize: isMobile ? '0.65rem' : '0.72rem',
              fontWeight: 700,
              padding: isMobile ? '2px 7px' : '2px 8px',
              borderRadius: '999px',
              border: '1px solid rgba(234,88,12,0.2)',
              flexShrink: 0
            }}>
              Today
            </span>
          </div>
          <div style={{ marginTop: isMobile ? '6px' : '10px' }}>
            <div style={{ fontSize: isMobile ? '1.3rem' : '2rem', fontWeight: 900, color: '#ea580c', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {formatCurrency(stats.sales || 0)}
            </div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.76rem', color: '#64748b', marginTop: '4px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stats.orders || 0} Total Invoices
            </div>
          </div>
        </div>

        {/* Card 2: Retail Orders */}
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          borderRadius: '20px',
          padding: isMobile ? '12px 14px' : '18px 22px',
          border: '1px solid rgba(134,239,172,0.6)',
          boxShadow: '0 2px 8px rgba(22,163,74,0.06)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: isMobile ? '105px' : '142px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '50%',
                background: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(22,163,74,0.25)',
                flexShrink: 0
              }}>
                <Scale size={isMobile ? 15 : 17} strokeWidth={2.4} />
              </div>
              <span style={{
                fontSize: isMobile ? '0.78rem' : '0.86rem',
                fontWeight: 700,
                color: '#1e293b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {t('Retail Orders (Kg)')}
              </span>
            </div>
            <span style={{
              background: '#dcfce7',
              color: '#15803d',
              fontSize: isMobile ? '0.65rem' : '0.72rem',
              fontWeight: 700,
              padding: isMobile ? '2px 7px' : '2px 8px',
              borderRadius: '999px',
              border: '1px solid rgba(22,163,74,0.2)',
              flexShrink: 0
            }}>
              Retail
            </span>
          </div>
          <div style={{ marginTop: isMobile ? '6px' : '10px' }}>
            <div style={{ fontSize: isMobile ? '1.3rem' : '2rem', fontWeight: 900, color: '#16a34a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {retailOrdersCount}
            </div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.76rem', color: '#64748b', marginTop: '4px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Individual fish cuts & weighed orders
            </div>
          </div>
        </div>

        {/* Card 3: Bulk Orders */}
        <div style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
          borderRadius: '20px',
          padding: isMobile ? '12px 14px' : '18px 22px',
          border: '1px solid rgba(253,224,71,0.6)',
          boxShadow: '0 2px 8px rgba(161,98,7,0.06)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: isMobile ? '105px' : '142px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '50%',
                background: '#ca8a04',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(202,138,4,0.25)',
                flexShrink: 0
              }}>
                <Boxes size={isMobile ? 15 : 17} strokeWidth={2.4} />
              </div>
              <span style={{
                fontSize: isMobile ? '0.78rem' : '0.86rem',
                fontWeight: 700,
                color: '#1e293b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {t('Bulk Orders (Boxes)')}
              </span>
            </div>
            <span style={{
              background: '#fef9c3',
              color: '#a16207',
              fontSize: isMobile ? '0.65rem' : '0.72rem',
              fontWeight: 700,
              padding: isMobile ? '2px 7px' : '2px 8px',
              borderRadius: '999px',
              border: '1px solid rgba(161,98,7,0.2)',
              flexShrink: 0
            }}>
              Wholesale
            </span>
          </div>
          <div style={{ marginTop: isMobile ? '6px' : '10px' }}>
            <div style={{ fontSize: isMobile ? '1.3rem' : '2rem', fontWeight: 900, color: '#ca8a04', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {bulkOrdersCount}
            </div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.76rem', color: '#64748b', marginTop: '4px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Wholesale box batches sold
            </div>
          </div>
        </div>

        {/* Card 4: Estimated Gross Profit */}
        <div style={{
          background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          borderRadius: '20px',
          padding: isMobile ? '12px 14px' : '18px 22px',
          border: '1px solid rgba(233,213,255,0.85)',
          boxShadow: '0 2px 8px rgba(168,85,247,0.06)',
          position: 'relative',
          overflow: 'hidden',
          minHeight: isMobile ? '105px' : '142px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', minWidth: 0 }}>
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '50%',
                background: '#9333ea',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(147,51,234,0.25)',
                flexShrink: 0
              }}>
                <BarChart2 size={isMobile ? 15 : 17} strokeWidth={2.4} />
              </div>
              <span style={{
                fontSize: isMobile ? '0.78rem' : '0.86rem',
                fontWeight: 700,
                color: '#1e293b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {t('Estimated Gross Profit')}
              </span>
            </div>
            <span style={{
              background: '#f3e8ff',
              color: '#7e22ce',
              fontSize: isMobile ? '0.65rem' : '0.72rem',
              fontWeight: 700,
              padding: isMobile ? '2px 7px' : '2px 8px',
              borderRadius: '999px',
              border: '1px solid rgba(147,51,234,0.2)',
              flexShrink: 0
            }}>
              Margin
            </span>
          </div>
          <div style={{ marginTop: isMobile ? '6px' : '10px' }}>
            <div style={{ fontSize: isMobile ? '1.3rem' : '2rem', fontWeight: 900, color: '#9333ea', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {formatCurrency(Math.round((stats.sales || 0) * 0.28))}
            </div>
            <div style={{ fontSize: isMobile ? '0.7rem' : '0.76rem', color: '#64748b', marginTop: '4px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Avg ~28% Fish Margin
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
                          e.target.src = '/assets/cards/sidebar_fish_crate.png';
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
                  src="/assets/cards/sidebar_fish_crate.png"
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

    </div>
  );
};

export default Dashboard;
