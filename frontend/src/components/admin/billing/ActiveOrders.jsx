import { getApiUrl } from "../../../config.js";
import { useLanguage } from "../../../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import BackButton from '../common/BackButton';
import { getOpenOrders } from '../../../api/billing/billing';
import { getCachedOpenOrders } from '../../../db/offlineDb';
import { 
  Clock, ChevronRight, FileText, CheckCircle, ShoppingBag, 
  Fish, RefreshCw, AlertCircle, User, Lock, MapPin, Package, Building, ArrowUpRight,
  Truck, X, Navigation, Phone, Car, ArrowLeft
} from 'lucide-react';
import { getVehicles, logTrip } from '../../../api/operations/vehicle';
import realtimeService from '../../../services/realtimeService';
import { formatTime12 } from '../../../utils/formatters/timeFormat';

const STATUS_STYLES = {
  'Billed': {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    icon: CheckCircle,
    label: 'Ready to Settle'
  },
  'Open': {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    button: 'bg-[#ea580c] hover:bg-[#c2410c] text-white',
    icon: Clock,
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
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Billed' | 'Open'
  const [channelFilter, setChannelFilter] = useState('All'); // 'All' | 'Retail' | 'Wholesale' | 'Export - Local' | 'Export - DAM'

  // Vehicle Dispatch Sync Modal State
  const [dispatchOrder, setDispatchOrder] = useState(null);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [dispatchKm, setDispatchKm] = useState({ startKm: '', endKm: '' });
  const [dispatchRouteTo, setDispatchRouteTo] = useState('');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchToast, setDispatchToast] = useState(null);

  const handleOpenDispatch = async (order) => {
    setDispatchOrder(order);
    setDispatchRouteTo(order.customerAddress || 'Kadapa Local Market');
    try {
      const vList = await getVehicles();
      const list = Array.isArray(vList) ? vList : [];
      setFleetVehicles(list);
      if (list.length > 0) {
        setSelectedVehicleId(list[0]._id);
        setDispatchKm({
          startKm: String(list[0].currentKm || 0),
          endKm: String((list[0].currentKm || 0) + 35)
        });
      }
    } catch (e) {
      console.error('Failed to fetch vehicles for dispatch', e);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchOrder || !selectedVehicleId) return;
    const veh = fleetVehicles.find(v => v._id === selectedVehicleId);
    if (!veh) return;
    setIsDispatching(true);
    try {
      const sub = dispatchOrder.exportSubCategory || (dispatchOrder.orderMode === 'export' ? 'Local' : 'General');
      await logTrip({
        vehicleId: veh._id,
        driverName: veh.driverName,
        date: new Date().toISOString().split('T')[0],
        startKm: dispatchKm.startKm || String(veh.currentKm || 0),
        endKm: dispatchKm.endKm || String((veh.currentKm || 0) + 35),
        purpose: `${sub === 'DAM' ? 'DAM Consignment' : 'Local Delivery'} • Order #${dispatchOrder.tableNo}`,
        routeFrom: 'Kadapa City Depot',
        routeTo: dispatchRouteTo || 'Local Market',
        exportType: sub,
        orderId: dispatchOrder._id,
        orderTableNo: dispatchOrder.tableNo,
        customerName: dispatchOrder.customerName,
        customerPhone: dispatchOrder.customerPhone,
        customerAddress: dispatchOrder.customerAddress,
        boxesCount: Number(dispatchOrder.totalBoxes) || 0,
        totalWeightKg: Number(dispatchOrder.totalWeight) || 0,
        status: 'In Transit'
      });
      setDispatchToast(`Consignment dispatched via ${veh.vehicleNumber} (${veh.driverName || 'Assigned Driver'})!`);
      setTimeout(() => setDispatchToast(null), 4000);
      setDispatchOrder(null);
    } catch (err) {
      alert('Error dispatching consignment: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDispatching(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (!o) return false;
    // Status check
    if (statusFilter !== 'All' && o.status !== statusFilter) return false;

    // Channel check
    if (channelFilter !== 'All') {
      const cat = o.customerCategory || (o.billType === 'Wholesale' ? 'Wholesale' : (o.billType === 'Export' ? 'Export' : 'Retail'));
      const sub = o.exportSubCategory || 'Local';

      if (channelFilter === 'Retail' && cat !== 'Retail') return false;
      if (channelFilter === 'Wholesale' && cat !== 'Wholesale') return false;
      if (channelFilter === 'Export - Local' && (cat !== 'Export' || sub !== 'Local')) return false;
      if (channelFilter === 'Export - DAM' && (cat !== 'Export' || sub !== 'DAM')) return false;
    }
    return true;
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
      onNavigate('billing', { table: tableNo, action });
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
    realtimeService.on('orderUpdated', handleRealtimeOrders);
    realtimeService.on('newOrder', handleRealtimeOrders);

    return () => {
      clearInterval(interval);
      realtimeService.off('orderUpdated', handleRealtimeOrders);
      realtimeService.off('newOrder', handleRealtimeOrders);
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

  const getChannelBadge = (order) => {
    const cat = order.customerCategory || (order.billType === 'Wholesale' ? 'Wholesale' : (order.billType === 'Export' ? 'Export' : 'Retail'));
    const sub = order.exportSubCategory || 'Local';

    if (cat === 'Wholesale') {
      return (
        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
          <Building size={9} className="sm:w-2.5 sm:h-2.5" />
          {t("Wholesale")}
        </span>
      );
    }
    if (cat === 'Export') {
      if (sub === 'DAM') {
        return (
          <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 whitespace-nowrap shrink-0">
            <ArrowUpRight size={9} className="sm:w-2.5 sm:h-2.5" />
            {t("Export DAM")}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap shrink-0">
          <ArrowUpRight size={9} className="sm:w-2.5 sm:h-2.5" />
          {t("Export Local")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap shrink-0">
        <Fish size={9} className="sm:w-2.5 sm:h-2.5" />
        {t("Retail")}
      </span>
    );
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
        <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4 lg:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 animate-pulse space-y-3 shadow-xs">
                <div className="flex justify-between items-start">
                  <div className="w-16 sm:w-24 h-4 sm:h-5 bg-slate-100 rounded"></div>
                  <div className="w-12 sm:w-16 h-4 sm:h-5 bg-slate-100 rounded-full"></div>
                </div>
                <div className="h-10 sm:h-12 bg-slate-100 rounded-lg"></div>
                <div className="h-7 sm:h-8 bg-slate-100 rounded-lg"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F7EFE2] text-slate-800">
      {/* Ultra-Compact Low-Height Top Header */}
      <div className="px-2.5 py-1.5 sm:px-4 sm:py-2 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-10 shadow-2xs">
        {/* Row 1: Back + Title + Status Pills + Refresh Button in 1 Tight Row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left: Back Arrow + Active Orders + Count */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {(onGoBack || onNavigate) && (
              <button
                type="button"
                onClick={onGoBack || (() => onNavigate('dashboard'))}
                className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                title={t('Back')}
              >
                <ArrowLeft size={13} />
                <span className="hidden sm:inline">{t('Back')}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-800 tracking-tight truncate">
                {t("Active Orders")}
              </h2>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold shrink-0">
                {filteredOrders.length}{orders.length !== filteredOrders.length && `/${orders.length}`}
              </span>
            </div>
          </div>

          {/* Right: Compact Status Toggle Pills & Refresh */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Billed' ? 'All' : 'Billed')}
              className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Billed'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'Billed' ? 'bg-white' : 'bg-emerald-500'}`}></span>
              <span>{typeCounts.Billed} {t("Ready")}</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'Open' ? 'All' : 'Open')}
              className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === 'Open'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'Open' ? 'bg-white' : 'bg-amber-500'}`}></span>
              <span>{typeCounts.Open} {t("Open")}</span>
            </button>

            <button
              onClick={() => fetchOrders(false)}
              title={t("Refresh Orders")}
              className="p-1 sm:p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer shrink-0"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Row 2: Very Low-Height Compact Filter Buttons Bar with Small Text */}
        <div className="flex items-center gap-1 mt-1 sm:mt-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'All', label: t('All') },
            { id: 'Retail', label: t('Retail') },
            { id: 'Wholesale', label: t('Wholesale') },
            { id: 'Export - Local', label: t('Export Local') },
            { id: 'Export - DAM', label: t('Export DAM') }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setChannelFilter(tab.id)}
              className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                channelFilter === tab.id
                  ? 'bg-[#ea580c] text-white shadow-2xs font-bold'
                  : 'bg-white/80 text-slate-600 hover:text-slate-900 border border-slate-200/80 hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-6">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#FAF0E4] border border-[#fed7aa] flex items-center justify-center text-[#ea580c] mb-4 shadow-xs">
              <Fish size={40} className="opacity-80" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-1">
              {t("No Active Orders Found")}
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mb-5 leading-relaxed">
              {channelFilter !== 'All' 
                ? t(`No active orders in ${channelFilter}. Switch filters or create a new order.`)
                : t("No open or pending orders at the moment. Create a new sale from the New Order page.")}
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
          /* Mobile: 2 per row (grid-cols-2) | Tablet: 3 per row (md:grid-cols-3) | Desktop: 4 per row (xl:grid-cols-4) */
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3.5 md:gap-4 lg:gap-5">
            {filteredOrders.map((order) => {
              if (!order) return null;
              const statusKey = order.status === 'Billed' ? 'Billed' : 'Open';
              const style = STATUS_STYLES[statusKey];
              const StatusIcon = style.icon;
              const isBilled = order.status === 'Billed';
              const displayTableNo = order.tableNo 
                ? (order.tableNo.includes('-') ? order.tableNo.replace(/^#+/, '') : (order.tableNo.startsWith('#') ? order.tableNo : `#${order.tableNo}`))
                : 'ORDER';

              return (
                <div
                  key={order._id || order.tableNo}
                  onClick={() => handleSelect(order.tableNo, isBilled ? 'settle' : 'open')}
                  className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-all p-2 sm:p-3 md:p-4 flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer group"
                >
                  <div>
                    {/* Top Header: Order No on left, Clean Status Pill on right (Never crops) */}
                    <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight whitespace-nowrap shrink-0 select-all">
                          {displayTableNo}
                        </span>
                        {/* Channel Badge inline on tablet/desktop */}
                        <div className="hidden sm:block shrink-0">
                          {getChannelBadge(order)}
                        </div>
                      </div>

                      {/* Single, clean status pill */}
                      <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-semibold border ${style.badge} shrink-0 whitespace-nowrap`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${isBilled ? 'animate-pulse' : ''}`}></span>
                        <span className="hidden sm:inline">{t(style.label)}</span>
                        <span className="sm:hidden">{isBilled ? t('Ready') : t('Open')}</span>
                      </span>
                    </div>

                    {/* Mobile: Channel Badge + Timestamp (Balanced 2-column header) */}
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-[11px] text-slate-500 mb-1.5 sm:mb-2 font-mono gap-1">
                      <div className="sm:hidden shrink-0">
                        {getChannelBadge(order)}
                      </div>
                      <div className="hidden sm:flex items-center gap-0.5 text-slate-400 font-sans">
                        <Clock size={10} className="shrink-0" />
                        <span>Time:</span>
                      </div>
                      <span className="font-semibold text-slate-600 truncate text-right text-[9px] sm:text-[10px]">
                        {order.orderDateFormatted || order.orderTimeFormatted
                          ? `${order.orderDateFormatted || ''} ${order.orderTimeFormatted || ''}`.trim()
                          : formatOrderDateTime(order.orderLockedAt || order.createdAt)}
                      </span>
                    </div>

                    {/* Customer Information (Clean card) */}
                    {(order.customerName || order.customerPhone) ? (
                      <div className="mb-2 p-1.5 sm:p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center gap-1.5 sm:gap-2">
                        {order.customerPhoto ? (
                          <img
                            src={order.customerPhoto}
                            alt={order.customerName}
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] sm:text-xs flex items-center justify-center shrink-0">
                            {(order.customerName || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-[11px] sm:text-xs text-slate-900 truncate">
                            {order.customerName || 'Customer'}
                          </div>
                          <div className="font-mono text-[9.5px] sm:text-[10.5px] text-slate-500 truncate">
                            {order.customerPhone || '—'}
                          </div>
                          {order.customerAddress && (
                            <div className="text-[9px] sm:text-[10px] text-slate-400 truncate flex items-center gap-0.5 mt-0.5">
                              <MapPin size={8} className="shrink-0" />
                              <span className="truncate">{order.customerAddress}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium py-1 mb-1.5 sm:mb-2 truncate">
                        Counter Walk-in Order
                      </div>
                    )}

                    {/* Items & Total Summary */}
                    <div className="pt-1.5 pb-2 border-t border-slate-100 flex items-baseline justify-between gap-1">
                      <div>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Qty</span>
                        <span className="font-bold text-[11px] sm:text-xs text-slate-800 truncate block">
                          {order.totalBoxes > 0 ? `${order.totalBoxes} Boxes` : `${order.items?.filter(i => !i.isCancelled).length || 0} Items`}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Total</span>
                        <span className="font-mono text-xs sm:text-sm md:text-base font-extrabold text-slate-900 whitespace-nowrap">
                          ₹{(order.total || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="space-y-1 sm:space-y-1.5 pt-1 border-t border-slate-100">
                    {/* Consignment Vehicle Dispatch button (if export or boxes) */}
                    {(order.orderMode === 'export' || order.exportSubCategory || order.customerCategory === 'Export' || (Number(order.totalBoxes) > 0)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDispatch(order);
                        }}
                        className="w-full py-1 sm:py-1.5 px-2 rounded-lg font-semibold text-[10px] sm:text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <Truck size={12} className="text-slate-600 shrink-0" />
                        <span className="truncate">{t("Dispatch Vehicle")}</span>
                      </button>
                    )}

                    {/* Main Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(order.tableNo, isBilled ? 'settle' : 'open');
                      }}
                      className={`w-full py-1.5 sm:py-2 md:py-2.5 rounded-lg font-bold text-[11px] sm:text-xs md:text-sm flex items-center justify-center gap-1 sm:gap-1.5 transition-colors cursor-pointer ${style.button}`}
                    >
                      {isBilled ? (
                        <>
                          <CheckCircle size={13} className="shrink-0" />
                          <span>{t("Settle Bill")}</span>
                        </>
                      ) : (
                        <>
                          <FileText size={13} className="shrink-0" />
                          <span>{t("Open Order")}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Dispatch Success Notification */}
      {dispatchToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs sm:text-sm font-bold animate-bounce">
          <Truck size={18} />
          <span>{dispatchToast}</span>
        </div>
      )}

      {/* Consignment Vehicle Dispatch Modal */}
      {dispatchOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-amber-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-orange-500 to-[#ea580c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Truck size={18} />
                </div>
                <div>
                  <h3 className="font-black text-base leading-tight">
                    Dispatch Consignment Vehicle
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Order #{dispatchOrder.tableNo} • {dispatchOrder.exportSubCategory === 'DAM' ? 'DAM Consignment' : 'Local Delivery'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchOrder(null)}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Consignment Info */}
            <div className="p-4 bg-[#FAF0E4]/60 border-b border-[#fed7aa]/60 flex items-center justify-between text-xs">
              <div>
                <div className="font-black text-slate-800 text-sm">
                  {dispatchOrder.customerName || 'Registered Dealer'}
                </div>
                <div className="font-mono text-slate-500 text-[11px]">
                  {dispatchOrder.customerPhone || 'No Phone Registered'}
                </div>
              </div>
              <div className="text-right">
                <span className="px-2 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold rounded-lg text-xs">
                  {dispatchOrder.totalBoxes > 0 ? `${dispatchOrder.totalBoxes} Boxes` : `${dispatchOrder.items?.length || 1} Lots`}
                </span>
                <div className="font-mono font-bold text-emerald-700 text-xs mt-1">
                  ₹{(dispatchOrder.total || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Fleet Vehicle & Driver *
                </label>
                {fleetVehicles.length === 0 ? (
                  <div className="text-xs text-rose-500 p-2 bg-rose-50 rounded-xl border border-rose-200">
                    No vehicles found in fleet. Please add vehicles in Fleet Management first.
                  </div>
                ) : (
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setSelectedVehicleId(selId);
                      const sel = fleetVehicles.find(v => v._id === selId);
                      if (sel) {
                        setDispatchKm({
                          startKm: String(sel.currentKm || 0),
                          endKm: String((sel.currentKm || 0) + 35)
                        });
                      }
                    }}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    {fleetVehicles.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.vehicleNumber} ({v.modelName || 'Vehicle'}) — Driver: {v.driverName || 'Depot Staff'} (Odo: {v.currentKm || 0} KM)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Destination Route
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nellore Harbour / Dealer Shop"
                  value={dispatchRouteTo}
                  onChange={(e) => setDispatchRouteTo(e.target.value)}
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#FAF0E4]/40 p-3 rounded-xl border border-[#fed7aa]">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Start Odometer (KM)</label>
                  <input
                    type="number"
                    value={dispatchKm.startKm}
                    onChange={(e) => setDispatchKm({ ...dispatchKm, startKm: e.target.value })}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Estimated End (KM)</label>
                  <input
                    type="number"
                    value={dispatchKm.endKm}
                    onChange={(e) => setDispatchKm({ ...dispatchKm, endKm: e.target.value })}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDispatchOrder(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDispatching || fleetVehicles.length === 0}
                onClick={handleConfirmDispatch}
                className="px-5 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Truck size={14} />
                <span>{isDispatching ? 'Dispatching...' : 'Confirm & Log Consignment Trip'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveOrders;
