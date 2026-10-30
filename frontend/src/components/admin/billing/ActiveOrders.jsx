import { getApiUrl } from "../../../config.js";
import { useLanguage } from "../../../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import BackButton from '../common/BackButton';
import { getOpenOrders } from '../../../api/billing/billing';
import { getCachedOpenOrders } from '../../../db/offlineDb';
import { Clock, ChevronRight, FileText, CheckCircle, ShoppingBag, Fish, RefreshCw, AlertCircle } from 'lucide-react';
import realtimeService from '../../../services/realtimeService';
import { formatTime12 } from '../../../utils/formatters/timeFormat';

const STATUS_STYLES = {
  'Billed': {
    cardBg: 'bg-[#FDFBF7] border-emerald-300 hover:border-emerald-400 shadow-sm hover:shadow-md',
    topBar: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
    button: 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-sm active:scale-95',
    icon: CheckCircle,
    label: 'Ready to Settle'
  },
  'Open': {
    cardBg: 'bg-[#FDFBF7] border-[#E8DCCB] hover:border-[#fed7aa] shadow-sm hover:shadow-md',
    topBar: 'bg-[#ea580c]',
    badge: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
    button: 'bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white font-black shadow-sm active:scale-95',
    icon: ShoppingBag,
    label: 'In Progress'
  }
};

const formatOrderDateTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const timeFormatted = formatTime12(d);
  return `${dateFormatted}, ${timeFormatted}`;
};

const ActiveOrders = ({ onSelectOrder, onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('All'); // 'All', 'Billed', 'Open'

  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    if (filterType === 'All') return true;
    return o.status === filterType;
  });

  const typeCounts = {
    'All': orders.length,
    'Billed': orders.filter(o => o && o.status === 'Billed').length,
    'Open': orders.filter(o => o && o.status === 'Open').length,
  };

  const handleSelect = (tableNo, action = 'open') => {
    try {
      if (tableNo) {
        sessionStorage.setItem('ms_initial_table', tableNo);
      }
      if (action === 'settle') {
        sessionStorage.setItem('ms_initial_action', 'settle');
      } else {
        sessionStorage.removeItem('ms_initial_action');
      }
    } catch (e) {
      console.warn('sessionStorage error', e);
    }

    if (onSelectOrder) {
      onSelectOrder(tableNo, action);
    } else if (onNavigate) {
      onNavigate('billing');
    }
  };

  useEffect(() => {
    // 1. Instant Cache Load
    getCachedOpenOrders().then((cached) => {
      if (cached && Array.isArray(cached) && cached.length > 0) {
        const validOpen = cached.filter(o => o.status === 'Open' || o.status === 'Billed');
        if (validOpen.length > 0) {
          setOrders(validOpen);
          setLoading(false);
        }
      }
    }).catch(() => {});

    // 2. Initial Load directly from server
    fetchOrders(false);

    // 3. Periodic refresh
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 8000);

    // Listen for real-time events
    const handleRealtimeOrders = (data) => {
      if (data && data.order) {
        fetchOrders(true);
      }
    };

    const unsub1 = realtimeService.subscribe ? realtimeService.subscribe('order:created', handleRealtimeOrders) : null;
    const unsub2 = realtimeService.subscribe ? realtimeService.subscribe('order:updated', handleRealtimeOrders) : null;
    const unsub3 = realtimeService.subscribe ? realtimeService.subscribe('order:settled', handleRealtimeOrders) : null;
    const unsub4 = realtimeService.subscribe ? realtimeService.subscribe('order:cancelled', handleRealtimeOrders) : null;

    return () => {
      clearInterval(interval);
      if (typeof unsub1 === 'function') unsub1();
      if (typeof unsub2 === 'function') unsub2();
      if (typeof unsub3 === 'function') unsub3();
      if (typeof unsub4 === 'function') unsub4();
    };
  }, []);

  const fetchOrders = async (isBackground = false) => {
    try {
      if (!isBackground && orders.length === 0) setLoading(true);
      const res = await getOpenOrders();
      if (Array.isArray(res)) {
        const sorted = res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setOrders(sorted);
      }
    } catch (err) {
      console.error('Failed to load active orders', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="h-full flex flex-col bg-[#F7EFE2] text-slate-800">
        <div className="p-4 border-b border-[#E8DCCB] bg-[#FDFBF7] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FAF0E4] animate-pulse"></div>
            <div className="w-32 h-6 bg-[#FAF0E4] rounded-lg animate-pulse"></div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#FDFBF7] rounded-2xl border border-[#E8DCCB] p-5 animate-pulse space-y-4">
                <div className="flex justify-between items-start">
                  <div className="w-24 h-5 bg-[#FAF0E4] rounded"></div>
                  <div className="w-16 h-5 bg-[#FAF0E4] rounded-full"></div>
                </div>
                <div className="h-16 bg-[#F7EFE2] rounded-xl"></div>
                <div className="h-10 bg-[#FAF0E4] rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F7EFE2] text-slate-800">
      {/* Top Header */}
      <div className="p-3 sm:p-4 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-10 shadow-xs">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {(onGoBack || onNavigate) && (
              <BackButton onClick={onGoBack || (() => onNavigate('dashboard'))} />
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FAF0E4] border border-[#fed7aa] flex items-center justify-center text-[#ea580c] shadow-xs">
                <Fish size={20} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                  {t("Active Orders")}
                  <span className="bg-[#FAF0E4] text-[#7c3f1d] text-xs px-2.5 py-0.5 rounded-full font-mono font-bold border border-[#E8DCCB]">
                    {filteredOrders.length}{filterType !== 'All' && <span className="text-slate-500"> / {orders.length}</span>}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-600 font-medium">YNR Fish Store Live Counter Operations</p>
              </div>
            </div>

            {/* Quick Status Pill Indicators */}
            <div className="flex items-center gap-2 ml-1 sm:ml-4 flex-wrap text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                {t("Ready to Settle")}: {typeCounts.Billed}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                {t("In Progress")}: {typeCounts.Open}
              </span>
            </div>
          </div>

          {/* Filter Tabs & Manual Refresh */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto justify-between lg:justify-end">
            <div className="flex bg-[#FAF0E4] p-1 rounded-xl border border-[#E8DCCB] gap-1">
              {[
                { id: 'All', label: 'All Orders', count: typeCounts.All },
                { id: 'Billed', label: 'Ready to Settle', count: typeCounts.Billed },
                { id: 'Open', label: 'In Progress', count: typeCounts.Open }
              ].map((tab) => {
                const isActive = filterType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#ea580c] to-[#c2410c] text-white shadow-xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-[#FDFBF7]'
                    }`}
                  >
                    <span>{t(tab.label)}</span>
                    {tab.count > 0 && (
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center ${
                        isActive ? 'bg-white/25 text-white' : 'bg-[#FAF0E4] text-[#7c3f1d]'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => fetchOrders(false)}
              title="Refresh Orders"
              className="p-2 rounded-xl bg-[#FAF0E4] border border-[#E8DCCB] text-[#7c3f1d] hover:bg-[#FDFBF7] transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#FAF0E4] border border-[#fed7aa] flex items-center justify-center text-[#ea580c] mb-4 shadow-xs">
              <Fish size={40} className="opacity-80" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">
              {t("No Active Orders")}
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mb-5 leading-relaxed">
              {filterType === 'All'
                ? t("No open or pending orders at the moment. Create a new sale from the New Order page.")
                : `${t("No orders found with status")} "${filterType}".`}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSelect(null, 'open')}
                className="px-5 py-2.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white font-extrabold rounded-xl text-sm transition-all shadow-md shadow-orange-950/20 cursor-pointer"
              >
                + {t("Create New Sale")}
              </button>
              <button
                onClick={() => fetchOrders(false)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#FAF0E4] hover:bg-[#F5E8D8] text-slate-700 font-bold rounded-xl text-sm transition-all border border-[#E8DCCB] cursor-pointer"
              >
                <RefreshCw size={15} />
                {t("Refresh")}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredOrders.map((order) => {
              if (!order) return null;
              const statusKey = order.status === 'Billed' ? 'Billed' : 'Open';
              const style = STATUS_STYLES[statusKey];
              const StatusIcon = style.icon;
              const isBilled = order.status === 'Billed';

              return (
                <div
                  key={order._id || order.tableNo}
                  onClick={() => handleSelect(order.tableNo, isBilled ? 'settle' : 'open')}
                  className={`rounded-2xl border ${style.cardBg} transition-all duration-200 overflow-hidden group relative cursor-pointer flex flex-col justify-between hover:-translate-y-0.5`}
                >
                  {/* Top Status Indicator Strip */}
                  <div className={`h-1.5 ${style.topBar} w-full shadow-2xs`}></div>

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Order Header / Identifier */}
                      <div className="flex justify-between items-start mb-3 gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider ${style.badge}`}>
                              <StatusIcon size={11} />
                              {t(style.label)}
                            </span>
                            {order.orderSource && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#FAF0E4] text-[#7c3f1d] border border-[#E8DCCB]">
                                {order.orderSource}
                              </span>
                            )}
                          </div>
                          
                          <h3 className="text-lg font-black text-slate-900 font-mono tracking-wide truncate">
                            {order.tableNo || 'COUNTER-1'}
                          </h3>
                          
                          <p className="text-[11px] text-slate-500 font-mono font-medium mt-1 flex items-center gap-1 truncate">
                            <Clock size={12} className="shrink-0 text-[#ea580c] opacity-80" />
                            <span>{formatOrderDateTime(order.createdAt)}</span>
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${
                          isBilled 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {t(order.status || 'Open')}
                        </span>
                      </div>

                      {/* Customer Info (if present) */}
                      {(order.customerName || order.customerPhone) && (
                        <div className="mb-3 px-2.5 py-1 rounded-lg bg-[#FAF0E4] border border-[#E8DCCB] text-xs text-slate-700 truncate">
                          <span className="font-bold text-[#ea580c]">{order.customerName || 'Customer'}: </span>
                          <span className="font-mono text-slate-600">{order.customerPhone || ''}</span>
                        </div>
                      )}

                      {/* Items & Total Box */}
                      <div className="space-y-2 my-3 bg-[#FAF0E4] p-3.5 rounded-xl border border-[#E8DCCB]">
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-slate-600 font-medium">{t("Fish Items")}</span>
                          <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded-md border border-[#E8DCCB]">
                            {order.items?.filter(i => !i.isCancelled).length || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-[#E8DCCB] items-baseline">
                          <span className="text-slate-700 font-bold">{t("Grand Total")}</span>
                          <span className="font-black text-emerald-700 text-lg font-mono tracking-tight">
                            ₹{(order.total || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(order.tableNo, isBilled ? 'settle' : 'open');
                      }}
                      className={`w-full py-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${style.button}`}
                    >
                      {isBilled ? (
                        <>
                          <CheckCircle size={16} />
                          <span>{t("SETTLE BILL")}</span>
                        </>
                      ) : (
                        <>
                          <FileText size={16} />
                          <span>{t("MAKE BILL / VIEW")}</span>
                        </>
                      )}
                      <ChevronRight size={15} className="opacity-70 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveOrders;
