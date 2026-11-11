import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import ynrLogo from '../../assets/ynr_logo_hd.jpg';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  LogOut,
  Settings as SettingsIcon,
  User,
  ArrowLeft,
  Home,
  Calculator
} from 'lucide-react';

// Imported Admin Components
import MainEntranceDashboard from '../../components/admin/hub/MainEntranceDashboard';
import Dashboard from '../../components/admin/analytics/Dashboard';
import BillingPage from '../../components/admin/billing/BillingPage';
import ActiveOrders, { getOrderCategory } from '../../components/admin/billing/ActiveOrders';
import BillHistory from '../../components/admin/billing/BillHistory';
import ChannelHub from '../../components/admin/channel/ChannelHub';
import MenuManagement from '../../components/admin/catalog/MenuManagement';
import FishInventoryManager from '../../components/admin/inventory/FishInventoryManager';
import DayBook from '../../components/admin/finance/DayBook';
import Expenses from '../../components/admin/finance/Expenses';
import VehicleManagement from '../../components/admin/operations/VehicleManagement';
import Analytics from '../../components/admin/analytics/Analytics';
import PrinterConfig from '../../components/admin/system/PrinterConfig';
import Settings from '../../components/admin/system/Settings';
import WhatsAppConnectModal from '../../components/admin/communication/WhatsAppConnectModal';
import CalculatorModal from '../../components/admin/system/CalculatorModal';
import Operations from '../../components/admin/operations/Operations';
import DiscountConfig from '../../components/admin/finance/DiscountConfig';
import SecuritySettings from '../../components/admin/system/SecuritySettings';
import AdminPanel from '../../components/admin/system/AdminPanel';
import EditedBills from '../../components/admin/billing/EditedBills';
import SupplierManagement from '../../components/admin/operations/SupplierManagement';
import GlobalSearchBar from '../../components/admin/common/GlobalSearchBar';
import NotificationPanel from '../../components/admin/communication/NotificationPanel';
import NotificationsPage from '../../components/admin/communication/NotificationsPage';
import useNotifications from '../../hooks/useNotifications';
import useServerStatus from '../../hooks/useServerStatus';
import { getOpenOrders } from '../../api/billing/billing';
import { getCachedOpenOrders } from '../../db/offlineDb';
import realtimeService from '../../services/realtimeService';

export default function AdminDashboard() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user, logout } = useAuth();

  // Super-admin has a dedicated enterprise dashboard at /dashboard/super-admin
  if (user?.role === 'super-admin') {
    return <Navigate to="/dashboard/super-admin" replace />;
  }
  if (user?.role === 'driver') {
    return <Navigate to="/dashboard/driver" replace />;
  }
  if (user?.role === 'supplier') {
    return <Navigate to="/dashboard/supplier" replace />;
  }

  const VALID_VIEWS = [
    'dashboard', 'second-dashboard', 'billing', 'active-orders', 'bill-history', 'edited-bills',
    'retail-active-orders', 'wholesale-active-orders', 'export-active-orders',
    'retail-bill-history', 'wholesale-bill-history', 'export-bill-history',
    'menu', 'inventory', 'day-book', 'khata', 'expenses', 'vehicles', 'analytics',
    'crm', 'staff', 'printer', 'operations', 'discount', 'security', 'settings',
    'notifications', 'suppliers'
  ];

  const { notifications, unreadCount, markAllAsRead, clearNotification } = useNotifications(user?.role || 'Admin');
  const { isServerConnected } = useServerStatus(4000);
  const [showNotifications, setShowNotifications] = useState(false);

  const isFullAdmin = !user?.role || ['super-admin', 'admin'].includes(user.role.toLowerCase());
  const userPermitted = Array.isArray(user?.permittedPages) && user.permittedPages.length > 0
    ? user.permittedPages
    : (user?.role === 'manager'
      ? ['dashboard', 'second-dashboard', 'billing', 'active-orders', 'bill-history', 'menu', 'inventory', 'day-book', 'khata', 'expenses', 'vehicles', 'analytics', 'operations', 'suppliers']
      : (user?.role === 'driver'
        ? ['driver-portal']
        : (user?.role === 'supplier'
          ? ['supplier-portal']
          : ['dashboard', 'billing', 'active-orders', 'bill-history', 'inventory'])));

  const isPagePermitted = (pageId) => {
    if (user?.role === 'driver') return pageId === 'driver-portal';
    if (user?.role === 'supplier') return pageId === 'supplier-portal';
    if (isFullAdmin) return true;
    if (pageId === 'dashboard' || pageId === 'second-dashboard') return true;
    if (['retail-active-orders', 'wholesale-active-orders', 'export-active-orders'].includes(pageId)) {
      return userPermitted.includes('active-orders');
    }
    if (['retail-bill-history', 'wholesale-bill-history', 'export-bill-history'].includes(pageId)) {
      return userPermitted.includes('bill-history');
    }
    return userPermitted.includes(pageId);
  };

  const getInitialView = () => {
    try {
      if (user?.role === 'driver') return 'driver-portal';
      if (user?.role === 'supplier') return 'supplier-portal';
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && VALID_VIEWS.includes(hash) && isPagePermitted(hash)) return hash;
      const saved = localStorage.getItem('admin_current_view');
      if (saved && VALID_VIEWS.includes(saved) && isPagePermitted(saved)) return saved;
    } catch (e) { }
    return user?.role === 'driver' ? 'driver-portal' : (user?.role === 'supplier' ? 'supplier-portal' : 'dashboard');
  };

  const [currentView, setCurrentView] = useState(getInitialView);
  const [viewHistory, setViewHistory] = useState(() => {
    const init = getInitialView();
    return [init || 'dashboard'];
  });

  const [selectedOrderTable, setSelectedOrderTable] = useState(null);
  const [selectedOrderAction, setSelectedOrderAction] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [activeOrdersBreakdown, setActiveOrdersBreakdown] = useState({ total: 0, retail: 0, wholesale: 0, export: 0 });
  const [billingKey, setBillingKey] = useState(1);
  const [selectedOrderMode, setSelectedOrderMode] = useState(() => {
    try {
      const saved = localStorage.getItem('billing_fish_order_mode');
      if (saved && ['individual', 'bulk', 'export'].includes(saved)) {
        return saved;
      }
    } catch (e) { }
    return 'individual';
  });

  // Navigate with step-by-step history tracking
  const navigateTo = (view, options = {}) => {
    if (!view || !VALID_VIEWS.includes(view)) return;
    if (!isPagePermitted(view)) return;

    if (view === 'billing') {
      let resolvedMode = options.mode;
      if (!resolvedMode && options.table) {
        if (options.table.startsWith('RET-')) resolvedMode = 'individual';
        else if (options.table.startsWith('WS-')) resolvedMode = 'bulk';
        else if (options.table.startsWith('EXP-')) resolvedMode = 'export';
      }

      if (resolvedMode) {
        setSelectedOrderMode(resolvedMode);
        try { localStorage.setItem('billing_fish_order_mode', resolvedMode); } catch (e) {}
      }
      const isNew = options.action === 'new' || options.table === 'NEW_ORDER';
      if (isNew) {
        try {
          localStorage.removeItem('billing_show_wholesale_wizard');
          localStorage.removeItem('billing_wholesale_wizard_fish');
          localStorage.removeItem('billing_wholesale_available_fish');
          localStorage.removeItem('wholesale_wizard_data_bulk');
          localStorage.removeItem('wholesale_wizard_data_export');
          localStorage.removeItem('billing_active_cart');
          localStorage.removeItem('billing_customer_phone');
          localStorage.removeItem('billing_customer_name');
          localStorage.setItem('billing_mobile_tab', 'menu');
        } catch (e) {}
      } else if (options.table) {
        try {
          localStorage.removeItem('billing_active_cart');
          localStorage.removeItem('billing_customer_phone');
          localStorage.removeItem('billing_customer_name');
          localStorage.setItem('billing_mobile_tab', 'cart');
        } catch (e) {}
      }
      const tableToSet = isNew ? null : (options.table !== undefined ? options.table : (options.preserveTable ? selectedOrderTable : null));
      const actionToSet = isNew ? 'new' : (options.action !== undefined ? options.action : (options.preserveTable ? selectedOrderAction : null));

      setSelectedOrderTable(tableToSet);
      setSelectedOrderAction(actionToSet);

      try {
        if (tableToSet) {
          sessionStorage.setItem('ms_initial_table', tableToSet);
        } else {
          sessionStorage.removeItem('ms_initial_table');
        }
        if (actionToSet) {
          sessionStorage.setItem('ms_initial_action', actionToSet);
        } else {
          sessionStorage.removeItem('ms_initial_action');
        }
      } catch (e) {}
      // Always remount BillingPage when navigating to an order so previous order items NEVER leak
      setBillingKey(k => k + 1);
    } else {
      try {
        localStorage.removeItem('billing_show_wholesale_wizard');
        localStorage.removeItem('billing_wholesale_wizard_fish');
        localStorage.removeItem('billing_wholesale_available_fish');
        localStorage.removeItem('wholesale_wizard_data_bulk');
        localStorage.removeItem('wholesale_wizard_data_export');
      } catch (e) {}
    }

    if (view === currentView) return;

    if (options.replace) {
      setViewHistory(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = view;
        return copy;
      });
    } else {
      setViewHistory(prev => [...prev, view]);
    }
    setCurrentView(view);
  };

  // Back button returns to the exact previous page
  const goBack = () => {
    try {
      localStorage.removeItem('billing_show_wholesale_wizard');
      localStorage.removeItem('billing_wholesale_wizard_fish');
      localStorage.removeItem('billing_wholesale_available_fish');
      localStorage.removeItem('wholesale_wizard_data_bulk');
      localStorage.removeItem('wholesale_wizard_data_export');
    } catch (e) {}
    setViewHistory(prev => {
      if (prev.length > 1) {
        const nextHistory = prev.slice(0, -1);
        const previousView = nextHistory[nextHistory.length - 1];
        setCurrentView(previousView);
        return nextHistory;
      } else {
        setCurrentView('dashboard');
        return ['dashboard'];
      }
    });
  };

  // Clicking Logo jumps directly to Main Entrance Dashboard
  const goToHome = () => {
    try {
      localStorage.removeItem('billing_show_wholesale_wizard');
      localStorage.removeItem('billing_wholesale_wizard_fish');
      localStorage.removeItem('billing_wholesale_available_fish');
      localStorage.removeItem('wholesale_wizard_data_bulk');
      localStorage.removeItem('wholesale_wizard_data_export');
    } catch (e) {}
    if (user?.role === 'driver') {
      setViewHistory(['driver-portal']);
      setCurrentView('driver-portal');
      return;
    }
    if (user?.role === 'supplier') {
      setViewHistory(['supplier-portal']);
      setCurrentView('supplier-portal');
      return;
    }
    setViewHistory(['dashboard']);
    setCurrentView('dashboard');
  };

  const fetchActiveOrdersCount = React.useCallback(async () => {
    const processOrdersList = (ordersList) => {
      if (!Array.isArray(ordersList)) return;
      const openOrBilled = ordersList.filter(o => o && (o.status === 'Open' || o.status === 'Billed'));
      setActiveOrdersCount(openOrBilled.length);

      let ret = 0;
      let ws = 0;
      let exp = 0;
      openOrBilled.forEach(o => {
        const cat = getOrderCategory(o);
        if (cat === 'Export') exp++;
        else if (cat === 'Wholesale') ws++;
        else ret++;
      });
      setActiveOrdersBreakdown({ total: openOrBilled.length, retail: ret, wholesale: ws, export: exp });
    };

    try {
      const orders = await getOpenOrders();
      processOrdersList(orders);
    } catch (e) {
      try {
        const cached = await getCachedOpenOrders();
        processOrdersList(cached);
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    fetchActiveOrdersCount();
    const interval = setInterval(fetchActiveOrdersCount, 5000);

    const handleRealtime = () => fetchActiveOrdersCount();
    const unsub1 = realtimeService.subscribe ? realtimeService.subscribe('order:created', handleRealtime) : null;
    const unsub2 = realtimeService.subscribe ? realtimeService.subscribe('order:updated', handleRealtime) : null;
    const unsub3 = realtimeService.subscribe ? realtimeService.subscribe('order:settled', handleRealtime) : null;
    const unsub4 = realtimeService.subscribe ? realtimeService.subscribe('order:cancelled', handleRealtime) : null;
    const unsub5 = realtimeService.subscribe ? realtimeService.subscribe('billSettled', handleRealtime) : null;
    const unsub6 = realtimeService.subscribe ? realtimeService.subscribe('orderUpdated', handleRealtime) : null;

    window.addEventListener('remoteOrderUpdated', handleRealtime);
    window.addEventListener('billSettled', handleRealtime);

    return () => {
      clearInterval(interval);
      if (typeof unsub1 === 'function') unsub1();
      if (typeof unsub2 === 'function') unsub2();
      if (typeof unsub3 === 'function') unsub3();
      if (typeof unsub4 === 'function') unsub4();
      if (typeof unsub5 === 'function') unsub5();
      if (typeof unsub6 === 'function') unsub6();
      window.removeEventListener('remoteOrderUpdated', handleRealtime);
      window.removeEventListener('billSettled', handleRealtime);
    };
  }, [fetchActiveOrdersCount]);

  useEffect(() => {
    try {
      localStorage.setItem('admin_current_view', currentView);
      if (window.location.hash.replace('#', '') !== currentView) {
        window.location.hash = currentView;
      }
    } catch (e) { }
  }, [currentView]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && VALID_VIEWS.includes(hash) && isPagePermitted(hash)) {
        if (hash !== currentView) {
          setViewHistory(prev => [...prev, hash]);
          setCurrentView(hash);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user, currentView]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const branchName = user?.branch?.name || (user?.role === 'super-admin' ? 'Headquarters' : 'Kadapa City Depot');

  return (
    <div className="admin-cream-ui" style={{ minHeight: '100vh', height: '100dvh', maxHeight: '100dvh', width: '100%', background: '#F7EFE2', color: '#1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* Top Header Bar (No Sidebar across entire application) */}
      <header
        style={{
          position: 'relative',
          padding: isMobile ? '8px 12px' : '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          gap: isMobile ? '8px' : '14px',
          borderBottom: '1px solid #E8DCCB',
          background: '#FDFBF7',
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.02)',
          zIndex: (showNotifications || showProfileMenu) ? 99999 : 45
        }}
      >
        {/* Left: Brand Logo, Depot Name & Header Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px' }}>
          {/* Brand Logo - Clicking always takes you Home */}
          <div
            onClick={goToHome}
            title="Home / Main Dashboard"
            style={{
              width: isMobile ? '36px' : '42px',
              height: isMobile ? '36px' : '42px',
              borderRadius: '50%',
              border: '2px solid #fdba74',
              padding: '2px',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <img
              src={ynrLogo}
              alt="YNR Fishes"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = ynrLogo;
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          </div>

          {/* Title & Branch Subtitle */}
          <div
            onClick={goToHome}
            title="Home / Main Dashboard"
            style={{ cursor: 'pointer', userSelect: 'none' }}
          >
            <h2 style={{
              margin: 0,
              fontSize: isMobile ? '1.05rem' : '1.2rem',
              fontWeight: 900,
              color: '#0f2942',
              letterSpacing: '-0.02em',
              lineHeight: 1.1
            }}>
              YNR FISHES
            </h2>
            <p style={{
              margin: '2px 0 0 0',
              fontSize: '0.72rem',
              color: '#64748b',
              fontWeight: 600
            }}>
              {branchName} | {user?.role === 'driver' ? 'Driver Portal' : user?.role === 'supplier' ? 'Supplier Portal' : (user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin')}
            </p>
          </div>
        </div>

        {/* Center on Tablet & Desktop: Global Quick-Jump Search Bar */}
        {!isMobile && (
          <GlobalSearchBar
            onNavigate={navigateTo}
            onOpenWhatsApp={() => setShowWhatsAppModal(true)}
            isPermitted={isPagePermitted}
          />
        )}

        {/* Right Area: Live Status & Date/Time + Alerts Bell & Profile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '14px' }}>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                title={isServerConnected ? "Server Connected" : "Server Disconnected"}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: isServerConnected
                    ? 'radial-gradient(circle at 35% 35%, #86efac 0%, #22c55e 40%, #15803d 75%, #052e16 100%)'
                    : 'radial-gradient(circle at 35% 35%, #fca5a5 0%, #ef4444 40%, #b91c1c 75%, #450a0a 100%)',
                  boxShadow: isServerConnected
                    ? '0 0 10px rgba(34, 197, 94, 0.7), inset -2px -2px 4px rgba(0, 0, 0, 0.4), inset 2px 2px 3px rgba(255, 255, 255, 0.8)'
                    : '0 0 10px rgba(239, 68, 68, 0.7), inset -2px -2px 4px rgba(0, 0, 0, 0.4), inset 2px 2px 3px rgba(255, 255, 255, 0.8)',
                  flexShrink: 0,
                  cursor: 'pointer'
                }}
              />

              <div className="hidden lg:flex" style={{ flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b' }}>
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          )}
          {isMobile && (
            <div
              title={isServerConnected ? "Server Connected" : "Server Disconnected"}
              style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: isServerConnected
                  ? 'radial-gradient(circle at 35% 35%, #86efac 0%, #22c55e 40%, #15803d 75%, #052e16 100%)'
                  : 'radial-gradient(circle at 35% 35%, #fca5a5 0%, #ef4444 40%, #b91c1c 75%, #450a0a 100%)',
                boxShadow: isServerConnected
                  ? '0 0 8px rgba(34, 197, 94, 0.7), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.4), inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.8)'
                  : '0 0 8px rgba(239, 68, 68, 0.7), inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.4), inset 1.5px 1.5px 2px rgba(255, 255, 255, 0.8)',
                flexShrink: 0
              }}
            />
          )}

          {/* Alerts Bell Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) {
                  markAllAsRead();
                }
              }}
              aria-label="Notifications"
              title="Alerts"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                background: '#FDFBF7',
                border: '1.5px solid #E8DCCB',
                color: '#475569',
                borderRadius: isMobile ? '10px' : '12px',
                padding: isMobile ? '7px 9px' : '7px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              <Bell size={isMobile ? 18 : 16} strokeWidth={2.2} />
              {!isMobile && <span>Alerts</span>}
              {unreadCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '999px',
                  marginLeft: '2px'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationPanel
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkAllAsRead={markAllAsRead}
                onClearNotification={clearNotification}
                onViewAll={() => {
                  setShowNotifications(false);
                  navigateTo('notifications');
                }}
                onNavigate={(viewId) => {
                  setShowNotifications(false);
                  navigateTo(viewId);
                }}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          {/* Profile Avatar Icon & Dropdown Menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                if (showNotifications) setShowNotifications(false);
              }}
              aria-label="Profile and account menu"
              title="User Profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: isMobile ? '34px' : '38px',
                height: isMobile ? '34px' : '38px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #FAF0E4 0%, #F5E8D8 100%)',
                border: '1.5px solid #E8DCCB',
                color: '#7c3f1d',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <User size={isMobile ? 18 : 19} strokeWidth={2.4} />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div
                  onClick={() => setShowProfileMenu(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99990
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '260px',
                    maxWidth: '85vw',
                    background: '#FDFBF7',
                    borderRadius: '16px',
                    border: '1.5px solid #E8DCCB',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.15)',
                    padding: '16px',
                    zIndex: 99999,
                    boxSizing: 'border-box'
                  }}
                >
                  {/* User Profile Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid #E8DCCB' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #a0522d 0%, #7c3f1d 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.1rem',
                      boxShadow: '0 2px 8px rgba(124, 63, 29, 0.25)',
                      flexShrink: 0
                    }}>
                      {(user?.name || user?.username || 'A')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem', color: '#0f2942', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.name || user?.username || 'Admin User'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{
                          background: '#FAF0E4',
                          border: '1px solid #eedecb',
                          color: '#7c3f1d',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          textTransform: 'uppercase'
                        }}>
                          {user?.role || 'Admin'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {branchName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Profile Actions: Calculator, Settings & Logout */}
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowCalculator(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '9px 12px',
                        background: '#FAF0E4',
                        border: '1px solid #E8DCCB',
                        borderRadius: '10px',
                        color: '#475569',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Calculator size={16} strokeWidth={2.2} style={{ color: '#ea580c' }} />
                      <span>Calculator</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigateTo('settings');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '9px 12px',
                        background: '#FAF0E4',
                        border: '1px solid #E8DCCB',
                        borderRadius: '10px',
                        color: '#475569',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <SettingsIcon size={16} strokeWidth={2.2} style={{ color: '#7c3f1d' }} />
                      <span>Account Settings</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutModal(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '9px 12px',
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        borderRadius: '10px',
                        color: '#dc2626',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <LogOut size={16} strokeWidth={2.4} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Full-Width Content View (No Sidebar, 100% responsive on all screen sizes) */}
      <div style={{ flex: 1, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <main
          id="admin-main-viewport"
          style={{
            flex: 1,
            width: '100%',
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflowY: currentView === 'billing' ? 'hidden' : 'scroll',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            padding: currentView === 'billing' ? 0 : undefined
          }}
        >
          {/* Main Entrance Dashboard (The New Simple Categorized Buttons Hub) */}
          {currentView === 'dashboard' && (
            <MainEntranceDashboard
              user={user}
              onNavigate={navigateTo}
              activeOrdersCount={activeOrdersCount}
              activeOrdersBreakdown={activeOrdersBreakdown}
              unreadNotificationsCount={unreadCount}
              branchName={branchName}
              onOpenWhatsApp={() => setShowWhatsAppModal(true)}
            />
          )}

          {/* Second Dashboard (The 8-Module Operations Grid + Top Selling Items + Sales Chart) */}
          {currentView === 'second-dashboard' && (
            <Dashboard
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* New Order / POS Counter */}
          {currentView === 'billing' && (
            <BillingPage
              key={`${billingKey}-${selectedOrderMode}`}
              user={user}
              initialTable={selectedOrderTable}
              initialAction={selectedOrderAction}
              initialFishMode={selectedOrderMode}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Active Orders (Master / All) */}
          {currentView === 'active-orders' && (
            <ActiveOrders
              user={user}
              onNavigate={navigateTo}
              onSelectOrder={(tableNo, action, mode) => {
                let resolvedMode = mode;
                if (!resolvedMode) {
                  if (tableNo && tableNo.startsWith('RET-')) resolvedMode = 'individual';
                  else if (tableNo && tableNo.startsWith('WS-')) resolvedMode = 'bulk';
                  else if (tableNo && tableNo.startsWith('EXP-')) resolvedMode = 'export';
                  else resolvedMode = 'individual';
                }
                try { localStorage.setItem('billing_mobile_tab', 'cart'); } catch (e) {}
                navigateTo('billing', { table: tableNo, action, mode: resolvedMode });
              }}
              onGoBack={goBack}
            />
          )}

          {/* Retail Active Orders */}
          {currentView === 'retail-active-orders' && (
            <ActiveOrders
              user={user}
              onNavigate={navigateTo}
              onSelectOrder={(tableNo, action, mode) => {
                try { localStorage.setItem('billing_mobile_tab', 'cart'); } catch (e) {}
                navigateTo('billing', { table: tableNo, action, mode: mode || 'individual' });
              }}
              onGoBack={goBack}
              initialChannel="Retail"
              pageTitle="Retail Active Orders"
              lockChannel={true}
            />
          )}

          {/* Wholesale Active Orders */}
          {currentView === 'wholesale-active-orders' && (
            <ActiveOrders
              user={user}
              onNavigate={navigateTo}
              onSelectOrder={(tableNo, action, mode) => {
                try { localStorage.setItem('billing_mobile_tab', 'cart'); } catch (e) {}
                navigateTo('billing', { table: tableNo, action, mode: mode || 'bulk' });
              }}
              onGoBack={goBack}
              initialChannel="Wholesale"
              pageTitle="Wholesale Active Orders"
              lockChannel={true}
            />
          )}

          {/* Export Active Orders */}
          {currentView === 'export-active-orders' && (
            <ActiveOrders
              user={user}
              onNavigate={navigateTo}
              onSelectOrder={(tableNo, action, mode) => {
                try { localStorage.setItem('billing_mobile_tab', 'cart'); } catch (e) {}
                navigateTo('billing', { table: tableNo, action, mode: mode || 'export' });
              }}
              onGoBack={goBack}
              initialChannel="Export"
              pageTitle="Export Active Orders"
              lockChannel={true}
            />
          )}

          {/* Bill History (Master / All) */}
          {currentView === 'bill-history' && (
            <BillHistory
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Retail Bill + CRM + Khata Hub */}
          {currentView === 'retail-bill-history' && (
            <ChannelHub
              channel="Retail"
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Wholesale Bill + CRM + Khata Hub */}
          {currentView === 'wholesale-bill-history' && (
            <ChannelHub
              channel="Wholesale"
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Export Bill + CRM + Khata Hub */}
          {currentView === 'export-bill-history' && (
            <ChannelHub
              channel="Export"
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Edited Bills */}
          {currentView === 'edited-bills' && (
            <EditedBills
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Stock / Seafood Catch Ledger */}
          {currentView === 'inventory' && (
            <FishInventoryManager
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Fish Registry / Menu */}
          {currentView === 'menu' && (
            <MenuManagement
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Day Book */}
          {currentView === 'day-book' && (
            <DayBook
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Khata Book -> Direct to Khata Tab (All Channels / Wholesale / Retail / Export) */}
          {currentView === 'khata' && (
            <ChannelHub
              channel="All"
              initialTab="khata"
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Expenses */}
          {currentView === 'expenses' && (
            <Expenses
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Vehicles */}
          {currentView === 'vehicles' && (
            <VehicleManagement
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Analytics */}
          {currentView === 'analytics' && (
            <Analytics
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* CRM -> Direct to Wholesale Hub CRM Tab */}
          {currentView === 'crm' && (
            <ChannelHub
              channel="Wholesale"
              initialTab="crm"
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Extra Operations */}
          {currentView === 'operations' && (
            <Operations
              userRole={user?.role}
              onNavigate={navigateTo}
              onGoBack={goBack}
              onOpenWhatsApp={() => setShowWhatsAppModal(true)}
            />
          )}

          {/* Discounts */}
          {currentView === 'discount' && (
            <DiscountConfig
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Security */}
          {currentView === 'security' && (
            <SecuritySettings
              onGoBack={goBack}
            />
          )}

          {/* Staff Panel */}
          {currentView === 'staff' && (
            <AdminPanel
              onGoBack={goBack}
            />
          )}

          {/* Printer Config */}
          {currentView === 'printer' && (
            <PrinterConfig
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Settings */}
          {currentView === 'settings' && (
            <Settings
              user={user}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* System Notifications */}
          {currentView === 'notifications' && (
            <NotificationsPage
              userRole={user?.role || 'Admin'}
              onNavigate={navigateTo}
              onGoBack={goBack}
            />
          )}

          {/* Dedicated Admin Supplier Directory Management */}
          {currentView === 'suppliers' && (
            <SupplierManagement
              onGoBack={goBack}
            />
          )}
        </main>
      </div>

      {/* WhatsApp Modal Trigger */}
      {showWhatsAppModal && (
        <WhatsAppConnectModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '380px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#dc2626'
              }}
            >
              <LogOut size={28} />
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
              Confirm Sign Out
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
              Are you sure you want to end your current session for <strong>{user?.name || user?.username}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                }}
                style={{
                  flex: 1,
                  padding: '11px 16px',
                  background: '#dc2626',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)'
                }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </div>
  );
}
