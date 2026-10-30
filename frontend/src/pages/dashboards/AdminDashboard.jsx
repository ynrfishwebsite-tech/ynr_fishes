import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import ynrLogo from '../../assets/ynr_logo_hd.jpg';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart,
  Clock,
  History,
  Fish,
  BookOpen,
  Wallet,
  Receipt,
  BarChart3,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  Bell,
  Package,
  Calculator,
  Layers,
  ChevronRight,
  Home,
  FileText,
  IndianRupee,
  BookMarked,
  Truck,
  Menu as MenuIcon,
  X as XIcon
} from 'lucide-react';

// Imported Admin Components
import Dashboard from '../../components/admin/analytics/Dashboard';
import BillingPage from '../../components/admin/billing/BillingPage';
import ActiveOrders from '../../components/admin/billing/ActiveOrders';
import BillHistory from '../../components/admin/billing/BillHistory';
import MenuManagement from '../../components/admin/catalog/MenuManagement';
import FishInventoryManager from '../../components/admin/inventory/FishInventoryManager';
import DayBook from '../../components/admin/finance/DayBook';
import KhataDashboard from '../../components/admin/finance/KhataDashboard';
import Expenses from '../../components/admin/finance/Expenses';
import VehicleManagement from '../../components/admin/operations/VehicleManagement';
import Analytics from '../../components/admin/analytics/Analytics';
import CRM from '../../components/admin/crm/CRM';
import PrinterConfig from '../../components/admin/system/PrinterConfig';
import Settings from '../../components/admin/system/Settings';
import WhatsAppConnectModal from '../../components/admin/communication/WhatsAppConnectModal';
import CalculatorModal from '../../components/admin/system/CalculatorModal';
import Operations from '../../components/admin/operations/Operations';
import DiscountConfig from '../../components/admin/finance/DiscountConfig';
import SecuritySettings from '../../components/admin/system/SecuritySettings';
import AdminPanel from '../../components/admin/system/AdminPanel';
import EditedBills from '../../components/admin/billing/EditedBills';
import NotificationPanel from '../../components/admin/communication/NotificationPanel';
import NotificationsPage from '../../components/admin/communication/NotificationsPage';
import useNotifications from '../../hooks/useNotifications';
import { getOpenOrders } from '../../api/billing/billing';
import { getCachedOpenOrders } from '../../db/offlineDb';
import realtimeService from '../../services/realtimeService';

export default function AdminDashboard() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { user, logout } = useAuth();

  // Super-admin has a dedicated enterprise dashboard at /dashboard/super-admin
  if (user?.role === 'super-admin') {
    return <Navigate to="/dashboard/super-admin" replace />;
  }
  const VALID_VIEWS = [
    'dashboard', 'billing', 'active-orders', 'bill-history', 'edited-bills',
    'menu', 'inventory', 'day-book', 'khata', 'expenses', 'vehicles', 'analytics',
    'crm', 'staff', 'printer', 'operations', 'discount', 'security', 'settings',
    'notifications'
  ];

  const { notifications, unreadCount, markAllAsRead, clearNotification } = useNotifications(user?.role || 'Admin');
  const [showNotifications, setShowNotifications] = useState(false);

  const isFullAdmin = !user?.role || ['super-admin', 'admin'].includes(user.role.toLowerCase());
  const userPermitted = Array.isArray(user?.permittedPages) && user.permittedPages.length > 0
    ? user.permittedPages
    : (user?.role === 'manager'
      ? ['dashboard', 'billing', 'active-orders', 'bill-history', 'menu', 'inventory', 'day-book', 'khata', 'expenses', 'vehicles', 'analytics', 'operations']
      : ['billing', 'active-orders', 'bill-history', 'inventory']);

  const isPagePermitted = (pageId) => {
    if (isFullAdmin) return true;
    return userPermitted.includes(pageId);
  };

  const getInitialView = () => {
    try {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash && VALID_VIEWS.includes(hash) && isPagePermitted(hash)) return hash;
      const saved = localStorage.getItem('admin_current_view');
      if (saved && VALID_VIEWS.includes(saved) && isPagePermitted(saved)) return saved;
    } catch (e) { }
    return isFullAdmin ? 'dashboard' : (userPermitted[0] || 'billing');
  };

  const [currentView, setCurrentView] = useState(getInitialView);
  const [selectedOrderTable, setSelectedOrderTable] = useState(null);
  const [selectedOrderAction, setSelectedOrderAction] = useState(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [billingKey, setBillingKey] = useState(1);

  const fetchActiveOrdersCount = React.useCallback(async () => {
    try {
      const orders = await getOpenOrders();
      if (Array.isArray(orders)) {
        const count = orders.filter(o => o && (o.status === 'Open' || o.status === 'Billed')).length;
        setActiveOrdersCount(count);
      }
    } catch (e) {
      try {
        const cached = await getCachedOpenOrders();
        if (Array.isArray(cached)) {
          const count = cached.filter(o => o && (o.status === 'Open' || o.status === 'Billed')).length;
          setActiveOrdersCount(count);
        }
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
        setCurrentView(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const branchName = user?.branch?.name || (user?.role === 'super-admin' ? 'Headquarters' : 'Kadapa City Depot');
  const branchCode = user?.branch?.code || (user?.role === 'super-admin' ? 'HQ' : 'KDP');
  const branchCity = user?.branch?.city || (user?.role === 'super-admin' ? 'Central' : 'Kadapa');

  const allNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'billing', label: 'New Order', icon: ShoppingCart },
    { id: 'active-orders', label: 'Active Orders', icon: Clock },
    { id: 'bill-history', label: 'Bill History', icon: FileText },
    { id: 'inventory', label: 'Stock', icon: Package },
    { id: 'menu', label: 'Fish Registry', icon: Fish },
    { id: 'day-book', label: 'Day Book', icon: BookOpen },
    { id: 'khata', label: 'Khata Book', icon: BookMarked },
    { id: 'expenses', label: 'Expenses', icon: IndianRupee },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'operations', label: 'Extra Operations', icon: Layers },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const navItems = isFullAdmin
    ? allNavItems
    : allNavItems.filter(item => isPagePermitted(item.id));

  return (
    <div className="admin-cream-ui" style={{ height: '100vh', maxHeight: '100vh', width: '100%', background: '#F7EFE2', color: '#1e293b', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* Top Header Bar */}
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
          zIndex: showNotifications ? 99999 : 45
        }}
      >
        {/* Left: Brand Logo & Title with Hamburger on Mobile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '12px' }}>
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Navigation Menu"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FAF0E4',
                border: '1.5px solid #E8DCCB',
                color: '#7c3f1d',
                borderRadius: '10px',
                padding: '6px',
                cursor: 'pointer'
              }}
            >
              {mobileMenuOpen ? <XIcon size={18} /> : <MenuIcon size={18} />}
            </button>
          )}

          <div
            onClick={() => setCurrentView('dashboard')}
            style={{
              width: isMobile ? '34px' : '42px',
              height: isMobile ? '34px' : '42px',
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
              flexShrink: 0
            }}
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

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!isMobile && (
                <h2 style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: '#0f2942',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1
                }}>
                  YNR FISHES
                </h2>
              )}
              <span style={{
                background: '#1d4ed8',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                {branchCode}
              </span>
            </div>
            {!isMobile && (
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '0.74rem',
                color: '#64748b',
                fontWeight: 500
              }}>
                {branchName} | Admin Terminal
              </p>
            )}
          </div>
        </div>

        {/* Center: Live Status & Date/Time (Hidden on Mobile) */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#15803d',
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '0.76rem',
              fontWeight: 700
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #22c55e' }} />
              <span>Online</span>
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        )}

        {/* Right Action Buttons - Icons only on mobile, text on desktop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px' }}>
          {/* New Order Button - Only + on mobile */}
          <button
            onClick={() => setCurrentView('billing')}
            title="New Order"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #a0522d 0%, #7c3f1d 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: isMobile ? '10px' : '12px',
              padding: isMobile ? '7px 9px' : '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124, 63, 29, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={isMobile ? 18 : 15} strokeWidth={isMobile ? 3 : 2.5} />
            {!isMobile && <span>New Order</span>}
          </button>

          {/* WhatsApp Button */}
          <button
            onClick={() => setShowWhatsAppModal(true)}
            title="WhatsApp"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: '#FDFBF7',
              color: '#1e293b',
              border: '1.5px solid #E8DCCB',
              borderRadius: isMobile ? '10px' : '12px',
              padding: isMobile ? '6px 8px' : '7px 14px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <MessageSquare size={16} style={{ color: '#059669' }} />
            {!isMobile && <span>WhatsApp</span>}
          </button>

          {/* Calculator Button */}
          <button
            onClick={() => setShowCalculator(true)}
            title="Quick Calculator"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#FDFBF7',
              border: '1.5px solid #E8DCCB',
              color: '#475569',
              borderRadius: isMobile ? '10px' : '12px',
              padding: isMobile ? '6px 8px' : '8px 11px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <Calculator size={16} strokeWidth={2.2} />
          </button>

          {/* Alerts Bell Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) {
                  markAllAsRead();
                }
              }}
              title="Alerts"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: '#FDFBF7',
                border: '1.5px solid #E8DCCB',
                color: '#475569',
                borderRadius: isMobile ? '10px' : '12px',
                padding: isMobile ? '6px 8px' : '7px 13px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}
            >
              <Bell size={16} strokeWidth={2.2} />
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
                onViewAll={() => setCurrentView('notifications')}
                onNavigate={(viewId) => setCurrentView(viewId)}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Sign Out"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: '#FDFBF7',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              borderRadius: isMobile ? '10px' : '12px',
              padding: isMobile ? '6px 8px' : '7px 13px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
            }}
          >
            <LogOut size={16} strokeWidth={2.2} />
            {!isMobile && <span>Sign Out</span>}
          </button>
        </div>
      </header>

      {/* Main Body Layout: Left Sidebar + Right Main View */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Mobile Backdrop Overlay */}
        {isMobile && mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 9998
            }}
          />
        )}

        {/* Left Vertical Sidebar (Off-Canvas on Mobile, Floating Island on Desktop) */}
        {(!isMobile || mobileMenuOpen) && (
          <aside
            style={isMobile ? {
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              width: '270px',
              maxWidth: '82vw',
              background: '#FDFBF7',
              borderRadius: '0 20px 20px 0',
              border: '1.5px solid #E8DCCB',
              borderLeft: 'none',
              boxShadow: '10px 0 40px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '16px 10px',
              overflowY: 'auto',
              boxSizing: 'border-box',
              zIndex: 9999,
              animation: 'slideInLeft 0.25s ease'
            } : {
              width: '218px',
              minWidth: '218px',
              margin: '12px 6px 12px 14px',
              background: '#FDFBF7',
              borderRadius: '20px',
              border: '1.5px solid #E8DCCB',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '12px 8px',
              overflowY: 'auto',
              boxSizing: 'border-box',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}
          >
            {/* Mobile Sidebar Close Header */}
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1.5px solid #E8DCCB' }}>
                <span style={{ fontWeight: 800, color: '#0f2942', fontSize: '1rem' }}>Admin Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
                >
                  <XIcon size={20} />
                </button>
              </div>
            )}

            {/* Nav Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                
                if (isActive) {
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'billing') {
                          setSelectedOrderTable(null);
                          setSelectedOrderAction(null);
                          try {
                            sessionStorage.removeItem('ms_initial_table');
                            sessionStorage.removeItem('ms_initial_action');
                          } catch (e) {}
                          setBillingKey(k => k + 1);
                        }
                        setCurrentView(item.id);
                        if (isMobile) setMobileMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '12px',
                        background: '#FAF0E4',
                        color: '#7c3f1d',
                        border: '1px solid #eedecb',
                        borderLeft: '4px solid #8b4513',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(139, 69, 19, 0.08)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icon size={17} strokeWidth={2.4} style={{ color: '#8b4513' }} />
                        <span style={{ color: '#7c3f1d', fontWeight: 800 }}>{item.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.id === 'active-orders' && activeOrdersCount > 0 && (
                          <span style={{
                            background: '#ea580c',
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 900,
                            padding: '1px 7px',
                            borderRadius: '10px',
                            lineHeight: 1.2
                          }}>
                            {activeOrdersCount}
                          </span>
                        )}
                        <ChevronRight size={14} strokeWidth={2.8} style={{ color: '#8b4513', opacity: 0.85 }} />
                      </div>
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'billing') {
                        setSelectedOrderTable(null);
                        setSelectedOrderAction(null);
                        try {
                          sessionStorage.removeItem('ms_initial_table');
                          sessionStorage.removeItem('ms_initial_action');
                        } catch (e) {}
                        setBillingKey(k => k + 1);
                      }
                      setCurrentView(item.id);
                      if (isMobile) setMobileMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      background: 'transparent',
                      color: '#475569',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F5E8D8';
                      e.currentTarget.style.color = '#7c3f1d';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#475569';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Icon size={17} strokeWidth={2} style={{ color: '#64748b' }} />
                      <span>{item.label}</span>
                    </div>
                    {item.id === 'active-orders' && activeOrdersCount > 0 && (
                      <span style={{
                        background: '#ea580c',
                        color: '#ffffff',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        lineHeight: 1.2
                      }}>
                        {activeOrdersCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Terminal Info */}
            <div style={{
              marginTop: '12px',
              padding: '10px 12px',
              background: '#FAF0E4',
              borderRadius: '12px',
              border: '1px solid #E8DCCB'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#1e293b' }}>
                    {branchName}
                  </span>
                  <span style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 600 }}>
                    {user?.role?.toUpperCase() || 'ADMIN'} TERMINAL
                  </span>
                </div>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #22c55e', flexShrink: 0 }} />
              </div>
            </div>
          </aside>
        )}

        {/* Right Main Content Area */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: currentView === 'billing' ? 0 : undefined
          }}
        >
          {currentView === 'dashboard' && <Dashboard user={user} onNavigate={setCurrentView} />}
          {currentView === 'billing' && (
            <BillingPage
              user={user}
              initialTable={selectedOrderTable}
              initialAction={selectedOrderAction}
              onNavigate={setCurrentView}
            />
          )}
          {currentView === 'active-orders' && (
            <ActiveOrders
              user={user}
              onNavigate={setCurrentView}
              onSelectOrder={(tableNo, action) => {
                setSelectedOrderTable(tableNo);
                setSelectedOrderAction(action);
                setCurrentView('billing');
              }}
              onGoBack={() => setCurrentView('billing')}
            />
          )}
          {currentView === 'bill-history' && <BillHistory user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'edited-bills' && <EditedBills user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
          {currentView === 'inventory' && <FishInventoryManager user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'menu' && <MenuManagement user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'day-book' && <DayBook user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'khata' && <KhataDashboard user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'expenses' && <Expenses user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'vehicles' && <VehicleManagement user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'analytics' && <Analytics user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'crm' && <CRM user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
          {currentView === 'operations' && (
            <Operations
              userRole={user?.role}
              onNavigate={setCurrentView}
              onGoBack={() => setCurrentView('dashboard')}
              onOpenWhatsApp={() => setShowWhatsAppModal(true)}
            />
          )}
          {currentView === 'discount' && (
            <DiscountConfig
              onNavigate={setCurrentView}
              onGoBack={() => setCurrentView('operations')}
            />
          )}
          {currentView === 'security' && (
            <SecuritySettings
              onGoBack={() => setCurrentView('operations')}
            />
          )}
          {currentView === 'staff' && <AdminPanel onGoBack={() => setCurrentView('operations')} />}
          {currentView === 'printer' && <PrinterConfig user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
          {currentView === 'settings' && <Settings user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'notifications' && (
            <NotificationsPage
              userRole={user?.role || 'Admin'}
              onNavigate={setCurrentView}
              onGoBack={() => setCurrentView('dashboard')}
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

      {/* Custom Logout Confirmation Modal */}
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