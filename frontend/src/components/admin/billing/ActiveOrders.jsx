import { getApiUrl } from "../../../config.js";
import { useLanguage } from "../../../context/LanguageContext";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import BackButton from '../common/BackButton';
import { getOpenOrders } from '../../../api/billing/billing';
import { getCachedOpenOrders } from '../../../db/offlineDb';
import { 
  Clock, ChevronRight, FileText, CheckCircle, ShoppingBag, 
  Fish, RefreshCw, AlertCircle, User, Lock, MapPin, Package, Building, ArrowUpRight,
  Truck, X, Navigation, Phone, Car, ArrowLeft, Scale, ChevronDown, Search, Filter
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

export const calculateOrderTotalWeight = (order) => {
  if (!order) return 0;
  const explicitWt = Number(order.totalWeight || order.totalWeightKg || 0);
  if (explicitWt > 0) return explicitWt;

  if (!Array.isArray(order.items)) return 0;

  const total = order.items.reduce((acc, it) => {
    if (!it || it.isCancelled) return acc;
    const rawWt = Number(it.weightKg || it.enteredWeight || it.weight || it.netWeightKg || it.grossWeightKg || 0);
    if (rawWt > 0) {
      const qty = Math.max(1, Number(it.quantity || 1) - Number(it.cancelledQuantity || 0));
      const effectiveWt = (it.isWholesaleBox || Number(it.boxNumber || 0) > 0) ? rawWt : (rawWt * qty);
      return acc + effectiveWt;
    }

    if (it.sellingUnit === 'Kg' || it.unit === 'Kg' || it.unit === 'kg') {
      const qty = Math.max(0, Number(it.quantity || 0) - Number(it.cancelledQuantity || 0));
      return acc + qty;
    }

    return acc;
  }, 0);

  return parseFloat(total.toFixed(2));
};

export const getOrderCategory = (order) => {
  if (!order) return 'Retail';
  const table = String(order.tableNo || order.orderNo || order.billNumber || '');
  if (
    order.customerCategory === 'Export' ||
    order.orderMode === 'export' ||
    order.billType === 'Export' ||
    order.exportSubCategory ||
    table.startsWith('EXP-')
  ) {
    return 'Export';
  }
  if (
    order.customerCategory === 'Wholesale' ||
    order.orderChannel === 'Wholesale-Box' ||
    order.orderMode === 'bulk' ||
    order.billType === 'Wholesale' ||
    table.startsWith('WS-') ||
    (Number(order.totalBoxes) > 0) ||
    (Array.isArray(order.boxes) && order.boxes.length > 0) ||
    order.items?.some(i => i.isWholesaleBox || Number(i.boxNumber || 0) > 0 || i.pricingTier === 'wholesale' || Number(i.weight || i.weightKg || i.enteredWeight || 0) >= 20)
  ) {
    return 'Wholesale';
  }
  return 'Retail';
};

const ActiveOrders = ({
  onSelectOrder,
  onNavigate,
  onGoBack,
  initialChannel = 'All',
  pageTitle = null,
  lockChannel = false
}) => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Billed' | 'Open'
  const [channelFilter, setChannelFilter] = useState((lockChannel && initialChannel) ? initialChannel : (initialChannel || 'All'));

  // Customized Person Dropdown & Search Filters
  const [selectedPerson, setSelectedPerson] = useState('All');
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const personDropdownRef = useRef(null);

  // Close person dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (personDropdownRef.current && !personDropdownRef.current.contains(e.target)) {
        setIsPersonDropdownOpen(false);
      }
    };
    if (isPersonDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isPersonDropdownOpen]);

  useEffect(() => {
    if (initialChannel) {
      setChannelFilter(initialChannel);
      setSelectedPerson('All');
    }
  }, [initialChannel]);

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
        totalWeightKg: calculateOrderTotalWeight(dispatchOrder),
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

  // Orders filtered by the current active channel (Retail vs Wholesale vs Export)
  const channelScopedOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o) return false;
      if (channelFilter === 'All') return true;
      const cat = getOrderCategory(o);
      const sub = o.exportSubCategory || 'Local';

      if (channelFilter === 'Retail') return cat === 'Retail';
      if (channelFilter === 'Wholesale') return cat === 'Wholesale';
      if (channelFilter === 'Export') return cat === 'Export';
      if (channelFilter === 'Export - Local') return cat === 'Export' && sub === 'Local';
      if (channelFilter === 'Export - DAM') return cat === 'Export' && sub === 'DAM';
      return true;
    });
  }, [orders, channelFilter]);

  // Extract unique persons (customers / wholesale dealers / export clients) for the active channel
  const availablePersons = useMemo(() => {
    const map = new Map();
    channelScopedOrders.forEach((o) => {
      const name = (o.customerName || '').trim() || 'Counter Walk-in';
      const phone = (o.customerPhone || '').trim();
      const key = `${name}__${phone}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name,
          phone,
          label: phone ? `${name} (${phone})` : name,
          orderCount: 0,
          totalAmount: 0
        });
      }
      const entry = map.get(key);
      entry.orderCount += 1;
      entry.totalAmount += Number(o.total || 0);
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [channelScopedOrders]);

  // Keep selectedPerson valid when availablePersons changes
  useEffect(() => {
    if (selectedPerson !== 'All') {
      const exists = availablePersons.some(p => p.key === selectedPerson);
      if (!exists) {
        setSelectedPerson('All');
      }
    }
  }, [availablePersons, selectedPerson]);

  const personRoleLabel = useMemo(() => {
    if (channelFilter === 'Wholesale') return t('Wholesale Dealer');
    if (channelFilter === 'Retail') return t('Retail Customer');
    if (channelFilter.startsWith('Export')) return t('Export Client');
    return t('Customer / Dealer');
  }, [channelFilter, t]);

  const personPluralLabel = useMemo(() => {
    if (channelFilter === 'Wholesale') return t('Wholesale Dealers');
    if (channelFilter === 'Retail') return t('Retail Customers');
    if (channelFilter.startsWith('Export')) return t('Export Clients');
    return t('Customers & Dealers');
  }, [channelFilter, t]);

  const searchPlaceholder = useMemo(() => {
    if (channelFilter === 'Wholesale') return t('Search dealer, order #, fish...');
    if (channelFilter === 'Retail') return t('Search customer, order #, fish...');
    if (channelFilter.startsWith('Export')) return t('Search client, order #, fish...');
    return t('Search order #, person, fish...');
  }, [channelFilter, t]);

  const selectedPersonObj = useMemo(() => {
    return availablePersons.find(p => p.key === selectedPerson);
  }, [availablePersons, selectedPerson]);

  // Filtered orders applying status, person, and live search term
  const filteredOrders = useMemo(() => {
    return channelScopedOrders.filter((o) => {
      if (!o) return false;

      // Status check
      if (statusFilter !== 'All' && o.status !== statusFilter) return false;

      // Person check
      if (selectedPerson !== 'All') {
        const oName = (o.customerName || '').trim() || 'Counter Walk-in';
        const oPhone = (o.customerPhone || '').trim();
        const oKey = `${oName}__${oPhone}`;
        if (oKey !== selectedPerson) return false;
      }

      // Live search term check
      if (searchTerm && searchTerm.trim() !== '') {
        const query = searchTerm.trim().toLowerCase();
        const tNo = String(o.tableNo || o.orderNo || '').toLowerCase();
        const cName = String(o.customerName || '').toLowerCase();
        const cPhone = String(o.customerPhone || '').toLowerCase();
        const matchesItems = Array.isArray(o.items) && o.items.some(it => {
          if (!it || it.isCancelled) return false;
          return String(it.name || '').toLowerCase().includes(query) ||
                 String(it.nameTelugu || '').toLowerCase().includes(query);
        });
        if (!tNo.includes(query) && !cName.includes(query) && !cPhone.includes(query) && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [channelScopedOrders, statusFilter, selectedPerson, searchTerm]);

  // Channel-scoped status counts
  const typeCounts = useMemo(() => ({
    'All': channelScopedOrders.length,
    'Billed': channelScopedOrders.filter(o => o && o.status === 'Billed').length,
    'Open': channelScopedOrders.filter(o => o && o.status === 'Open').length,
  }), [channelScopedOrders]);

  // Aggregate stats for the current filtered view
  const channelTotalWeight = useMemo(() => {
    const sum = filteredOrders.reduce((acc, o) => acc + calculateOrderTotalWeight(o), 0);
    return parseFloat(sum.toFixed(2));
  }, [filteredOrders]);

  const channelTotalAmount = useMemo(() => {
    return filteredOrders.reduce((acc, o) => acc + Number(o.total || 0), 0);
  }, [filteredOrders]);

  const handleSelect = (orderOrTableNo, action = 'open') => {
    let tableNo = typeof orderOrTableNo === 'object' ? orderOrTableNo?.tableNo : orderOrTableNo;
    let mode = 'individual';
    if (typeof orderOrTableNo === 'object') {
      const cat = getOrderCategory(orderOrTableNo);
      mode = cat === 'Wholesale' ? 'bulk' : (cat === 'Export' ? 'export' : 'individual');
    } else {
      const found = orders.find(o => o.tableNo === tableNo);
      if (found) {
        const cat = getOrderCategory(found);
        mode = cat === 'Wholesale' ? 'bulk' : (cat === 'Export' ? 'export' : 'individual');
      }
    }

    try {
      if (tableNo) {
        sessionStorage.setItem('ms_initial_table', tableNo);
      }
      sessionStorage.removeItem('ms_initial_action');
    } catch (e) {
      console.warn('sessionStorage error', e);
    }

    if (onSelectOrder) {
      onSelectOrder(tableNo, 'open', mode);
    } else if (onNavigate) {
      onNavigate('billing', { table: tableNo, action: 'open', mode });
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
    const cat = getOrderCategory(order);
    const sub = order.exportSubCategory || 'Local';

    if (cat === 'Wholesale') {
      const boxCount = Number(order.totalBoxes) || (Array.isArray(order.boxes) ? order.boxes.length : 0) || 1;
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 whitespace-nowrap shrink-0 shadow-2xs">
          <Package size={11} className="text-amber-800 shrink-0" />
          <span>{t("Wholesale")}</span>
          <span className="bg-amber-200/90 text-amber-950 px-1.5 py-0.5 rounded text-[9px] font-mono font-black leading-none">
            {boxCount} {boxCount === 1 ? 'Box' : 'Boxes'}
          </span>
        </span>
      );
    }
    if (cat === 'Export') {
      if (sub === 'DAM') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300 whitespace-nowrap shrink-0 shadow-2xs">
            <ArrowUpRight size={11} className="text-purple-800 shrink-0" />
            <span>{t("Export DAM")}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300 whitespace-nowrap shrink-0 shadow-2xs">
          <ArrowUpRight size={11} className="text-sky-800 shrink-0" />
          <span>{t("Export Local")}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap shrink-0 shadow-2xs">
        <Fish size={11} className="text-slate-600 shrink-0" />
        <span>{t("Retail")}</span>
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
      <div className="px-2.5 py-2 sm:px-4 sm:py-2.5 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-20 shadow-2xs">
        {/* Row 1: Back + Title + Status Pills + Refresh Button in 1 Tight Row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left: Back Arrow + Active Orders + Count */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {(onGoBack || onNavigate) && (
              <button
                type="button"
                onClick={onGoBack || (() => onNavigate('dashboard'))}
                className="p-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0 transition-all active:scale-95 shadow-2xs"
                title={t('Back')}
              >
                <ArrowLeft size={13} />
                <span className="hidden sm:inline">{t('Back')}</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-800 tracking-tight truncate">
                {pageTitle ? t(pageTitle) : t("Active Orders")}
              </h2>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200/80 text-slate-700 text-[10px] font-mono font-bold shrink-0">
                {filteredOrders.length}{channelScopedOrders.length !== filteredOrders.length && `/${channelScopedOrders.length}`}
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
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
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
                  ? 'bg-amber-600 text-white shadow-2xs font-bold'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'Open' ? 'bg-white' : 'bg-amber-500'}`}></span>
              <span>{typeCounts.Open} {t("Open")}</span>
            </button>

            <button
              onClick={() => fetchOrders(false)}
              title={t("Refresh Orders")}
              className="p-1 sm:p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Row 2: Optional Channel Selector Tabs (when lockChannel is false) */}
        {!lockChannel && (
          <div className="flex items-center gap-1 mt-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'All', label: t('All') },
              { id: 'Retail', label: t('Retail') },
              { id: 'Wholesale', label: t('Wholesale') },
              { id: 'Export', label: t('Export (All)') },
              { id: 'Export - Local', label: t('Export Local') },
              { id: 'Export - DAM', label: t('Export DAM') }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setChannelFilter(tab.id);
                  setSelectedPerson('All');
                }}
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
        )}

        {/* Row 3: Customized Person Filter Dropdown + Search Input + Stat Badges */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mt-2 pt-1.5 border-t border-[#E8DCCB]/70">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-[200px] flex-wrap sm:flex-nowrap">
            {/* Customized Dropdown Filter for Persons (Dealers / Customers / Clients) */}
            <div className="relative shrink-0" ref={personDropdownRef}>
              <button
                type="button"
                onClick={() => setIsPersonDropdownOpen(prev => !prev)}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs select-none ${
                  selectedPerson !== 'All'
                    ? 'bg-amber-100/90 border-amber-400 text-amber-950 ring-2 ring-amber-400/30'
                    : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
                }`}
                title={selectedPersonObj ? selectedPersonObj.label : `Filter by ${personRoleLabel}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <User size={12} className={selectedPerson !== 'All' ? 'text-[#ea580c]' : 'text-slate-500'} />
                  <span className="truncate max-w-[130px] sm:max-w-[180px]">
                    {selectedPersonObj ? selectedPersonObj.label : `${t("All")} ${personPluralLabel} (${availablePersons.length})`}
                  </span>
                </div>
                <ChevronDown size={12} className={`text-slate-500 transition-transform ${isPersonDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isPersonDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-64 sm:w-72 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span>{personPluralLabel}</span>
                    <span className="font-mono text-slate-500 font-bold">{availablePersons.length} {t("active")}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPerson('All');
                      setIsPersonDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-orange-50/60 cursor-pointer transition-colors ${
                      selectedPerson === 'All' ? 'bg-orange-50 font-black text-[#ea580c]' : 'font-medium text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedPerson === 'All' ? 'bg-[#ea580c]' : 'bg-transparent'}`} />
                      <span>{t("All")} {personPluralLabel}</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {channelScopedOrders.length} {channelScopedOrders.length === 1 ? 'order' : 'orders'}
                    </span>
                  </button>

                  {availablePersons.length === 0 ? (
                    <div className="px-3 py-3 text-center text-xs text-slate-400 italic">
                      {t("No persons with active orders")}
                    </div>
                  ) : (
                    availablePersons.map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setSelectedPerson(p.key);
                          setIsPersonDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-orange-50/60 cursor-pointer border-t border-slate-50 transition-colors ${
                          selectedPerson === p.key ? 'bg-orange-50 font-black text-[#ea580c]' : 'font-medium text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="truncate font-bold text-slate-800">{p.name}</div>
                          {p.phone && <div className="text-[10px] font-mono text-slate-400">{p.phone}</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-full font-mono font-bold block">
                            {p.orderCount} {p.orderCount === 1 ? 'ord' : 'ords'}
                          </span>
                          <span className="text-[9.5px] font-mono text-slate-500 font-bold block mt-0.5">
                            ₹{p.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Search Input for fast filtering by order #, phone, customer, fish */}
            <div className="relative flex-1 min-w-[130px] sm:max-w-xs">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-7 pr-6 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 cursor-pointer"
                  title={t("Clear search")}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Reset Filter Button (visible when filter or search active) */}
            {(selectedPerson !== 'All' || searchTerm.trim() !== '' || statusFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson('All');
                  setSearchTerm('');
                  setStatusFilter('All');
                }}
                className="px-2 py-1 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 bg-slate-200/70 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
                title={t("Clear all filters")}
              >
                {t("Reset")}
              </button>
            )}
          </div>

          {/* Right Stat Summary: Total Filtered Orders + Total Weight + Revenue */}
          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600 font-mono font-bold bg-[#FAF0E4] border border-[#E8DCCB] px-2 py-0.5 rounded-md shrink-0 ml-auto shadow-2xs">
            <span>{filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}</span>
            {channelTotalWeight > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-amber-900 flex items-center gap-0.5">
                  <Scale size={10} className="text-amber-800" />
                  {channelTotalWeight} Kg
                </span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="text-slate-900 font-black">₹{channelTotalAmount.toLocaleString()}</span>
          </div>
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
          /* Responsive Orders Grid: 1 on mobile, 2 on tablet (< 1024px), 3 on laptop, 4 on wide desktop */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 w-full">
            {filteredOrders.map((order) => {
              if (!order) return null;
              const statusKey = order.status === 'Billed' ? 'Billed' : 'Open';
              const style = STATUS_STYLES[statusKey];
              const isBilled = order.status === 'Billed';
              const category = getOrderCategory(order);
              const correctedTableNo = (order.tableNo || '').replace(/^TAK-/i, category === 'Export' ? 'EXP-' : (category === 'Wholesale' ? 'WS-' : 'RET-'));
              const displayTableNo = correctedTableNo 
                ? (correctedTableNo.includes('-') ? correctedTableNo.replace(/^#+/, '') : (correctedTableNo.startsWith('#') ? correctedTableNo : `#${correctedTableNo}`))
                : 'ORDER';

              const orderWeight = calculateOrderTotalWeight(order);
              const activeItems = (order.items || []).filter(i => !i?.isCancelled);

              return (
                <div
                  key={order._id || order.tableNo}
                  onClick={() => handleSelect(order, 'open')}
                  className="w-full bg-white rounded-xl border border-slate-200/90 hover:border-orange-400 transition-all p-2.5 sm:p-3 flex flex-col justify-between shadow-2xs hover:shadow-md cursor-pointer group overflow-hidden"
                >
                  <div>
                    {/* Top Header: Order ID + Channel Badge on left, Status Badge on right */}
                    <div className="flex items-center justify-between gap-1.5 pb-1.5 border-b border-slate-100 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="font-mono text-xs sm:text-[13px] font-black text-slate-900 tracking-tight select-all">
                          {displayTableNo}
                        </span>
                        {getChannelBadge(order)}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${style.badge} shrink-0 whitespace-nowrap ml-auto`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ${isBilled ? 'animate-pulse' : ''}`}></span>
                        <span>{isBilled ? t('Ready') : t('Open')}</span>
                      </span>
                    </div>

                    {/* Sub-Header: Customer & Timestamp in compact normal para text + Weight Badge */}
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500 py-1 font-mono gap-1 flex-wrap">
                      <div className="flex items-center gap-1 truncate text-slate-600 min-w-0">
                        <User size={10} className="shrink-0 text-slate-400" />
                        <span className="truncate font-semibold">{order.customerName || 'Counter Walk-in'}</span>
                        {order.customerPhone && <span className="text-slate-400 font-mono text-[9px] truncate">({order.customerPhone})</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                        {orderWeight > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-bold text-[9px] border border-amber-200/80">
                            <Scale size={9} className="text-amber-800" />
                            <span>{orderWeight} Kg</span>
                          </span>
                        )}
                        <div className="flex items-center gap-0.5 text-slate-400">
                          <Clock size={9} className="shrink-0" />
                          <span>
                            {order.orderDateFormatted || order.orderTimeFormatted
                              ? `${order.orderDateFormatted || ''} ${order.orderTimeFormatted || ''}`.trim()
                              : formatOrderDateTime(order.orderLockedAt || order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ordered Fish Items Breakdown (Compact Structured Format) */}
                    {activeItems.length > 0 && (
                      <div className="my-1.5 rounded-lg border border-amber-200/70 bg-amber-50/30 p-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-amber-900/80 px-0.5 flex-wrap gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>Items ({activeItems.length})</span>
                            {orderWeight > 0 && (
                              <span className="bg-amber-200/90 text-amber-950 font-black px-1.5 py-0.2 rounded text-[8.5px] font-mono flex items-center gap-0.5 shadow-2xs">
                                <Scale size={9} className="text-amber-900" />
                                <span>{orderWeight} Kg Total</span>
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[8px] text-amber-700 bg-amber-100/80 px-1 py-0.2 rounded font-bold ml-auto">
                            Detailed List
                          </span>
                        </div>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-0.5 no-scrollbar">
                          {activeItems.map((it, idx) => {
                            const itemName = it.name || it.dishName || it.title || 'Seafood Item';
                            const telugu = it.nameTelugu || it.teluguName || '';
                            const weightStr = it.weight ? `${it.weight} kg` : (it.weightKg ? `${it.weightKg} kg` : (it.enteredWeight ? `${it.enteredWeight} kg` : (it.quantity ? `${it.quantity} ${it.unit || 'qty'}` : '1 kg')));
                            const cut = it.cuttingStyle || it.cutType || '';
                            const itemPrice = it.price || it.totalPrice || it.rate || 0;
                            return (
                              <div key={idx} className="flex items-center justify-between p-1 rounded bg-white border border-amber-100 shadow-2xs gap-1.5 text-[10px]">
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-slate-800 truncate leading-tight">
                                    {itemName} {telugu && <span className="font-normal text-slate-500 text-[9px]">({telugu})</span>}
                                  </div>
                                  <div className="flex items-center gap-1 text-[8.5px] text-slate-500 font-mono mt-0.5 flex-wrap">
                                    <span className="bg-amber-100 text-amber-900 font-bold px-1 rounded">{weightStr}</span>
                                    {(it.boxNumber || it.isWholesaleBox || getOrderCategory(order) === 'Wholesale') && (
                                      <span className="bg-amber-200/90 text-amber-950 font-black px-1 rounded flex items-center gap-0.5">
                                        <Package size={8} /> #{it.boxNumber || 1}
                                      </span>
                                    )}
                                    {cut && <span className="bg-slate-100 text-slate-600 px-1 rounded">{cut}</span>}
                                  </div>
                                </div>
                                <span className="font-mono font-black text-slate-900 shrink-0 text-right text-[10.5px]">
                                  ₹{Number(itemPrice).toLocaleString()}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Items & Total Summary + Actions Area (Zero Overflow, Responsive Flex-Wrap) */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 mt-auto">
                    <div className="min-w-0">
                      <span className="text-[8.5px] text-slate-400 uppercase tracking-wider block font-bold leading-none">Total</span>
                      <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
                        <span className="font-mono text-sm sm:text-base font-black text-slate-900 leading-none">
                          ₹{(order.total || 0).toLocaleString()}
                        </span>
                        <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                          ({order.totalBoxes > 0 ? `${order.totalBoxes} Bx` : `${activeItems.length} Itm`}{orderWeight > 0 ? ` • ${orderWeight} Kg` : ''})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-auto flex-wrap">
                      {/* Consignment Vehicle Dispatch button (if export or boxes) */}
                      {(order.orderMode === 'export' || order.exportSubCategory || order.customerCategory === 'Export' || (Number(order.totalBoxes) > 0)) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDispatch(order);
                          }}
                          className="py-1 px-2 rounded-lg font-bold text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer active:scale-95 shrink-0"
                          title={t("Dispatch Consignment")}
                        >
                          <Truck size={10} className="text-slate-600 shrink-0" />
                          <span>{t("Dispatch")}</span>
                        </button>
                      )}

                      {/* Main Action Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(order, 'open');
                        }}
                        className={`py-1.5 px-2.5 sm:px-3 rounded-lg font-black text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-[0.98] shrink-0 ${style.button}`}
                      >
                        {isBilled ? (
                          <>
                            <CheckCircle size={12} className="shrink-0" />
                            <span>{t("Settle Bill")}</span>
                          </>
                        ) : (
                          <>
                            <FileText size={12} className="shrink-0" />
                            <span>{t("Open Order")}</span>
                          </>
                        )}
                      </button>
                    </div>
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
                  Delivery Destination
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
