const fs = require('fs');
const path = require('path');

// 1. Update DayBook.jsx text-white bug
const dayBookPath = path.resolve(__dirname, '../src/components/admin/finance/DayBook.jsx');
let dayBookCode = fs.readFileSync(dayBookPath, 'utf8');
dayBookCode = dayBookCode.replace(
  '<span className="font-bold text-white font-mono">₹{item.amount.toLocaleString()}</span>',
  '<span className="font-bold text-slate-800 font-mono">₹{item.amount.toLocaleString()}</span>'
);
fs.writeFileSync(dayBookPath, dayBookCode, 'utf8');
console.log('Fixed DayBook.jsx text-white issue');

// 2. Update Operations.jsx layout and colors
const opsPath = path.resolve(__dirname, '../src/components/admin/operations/Operations.jsx');
let opsCode = fs.readFileSync(opsPath, 'utf8');
// Ensure operations-page-container has warm cream background and proper padding
opsCode = opsCode.replace(
  '<div className="operations-page-container">',
  '<div className="operations-page-container" style={{ background: "#FAF7F2", minHeight: "100%", padding: "20px 24px", boxSizing: "border-box" }}>'
);
fs.writeFileSync(opsPath, opsCode, 'utf8');
console.log('Enhanced Operations.jsx container styling');

// 3. Update AdminDashboard.jsx with master calibrated hardware terminal for #dashboard
// and full admin navigation layout for other views
const adminDashPath = path.resolve(__dirname, '../src/pages/dashboards/AdminDashboard.jsx');

const newAdminDashboardCode = `import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart,
  Clock,
  Fish,
  BookOpen,
  IndianRupee,
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
  BookMarked
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

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const VALID_VIEWS = [
    'dashboard', 'billing', 'active-orders', 'bill-history', 'edited-bills',
    'menu', 'inventory', 'day-book', 'khata', 'expenses', 'analytics',
    'crm', 'staff', 'printer', 'operations', 'discount', 'security', 'settings',
    'notifications'
  ];

  const { notifications, unreadCount, markAllAsRead, clearNotification } = useNotifications(user?.role || 'Admin');
  const [showNotifications, setShowNotifications] = useState(false);

  const isFullAdmin = !user?.role || ['super-admin', 'admin'].includes(user.role.toLowerCase());
  const userPermitted = Array.isArray(user?.permittedPages) && user.permittedPages.length > 0
    ? user.permittedPages
    : (user?.role === 'manager'
      ? ['dashboard', 'billing', 'active-orders', 'bill-history', 'menu', 'inventory', 'day-book', 'khata', 'expenses', 'analytics', 'operations']
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
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'operations', label: 'Extra Operations', icon: Layers },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const navItems = isFullAdmin
    ? allNavItems
    : allNavItems.filter(item => isPagePermitted(item.id));

  // =========================================================================
  // VIEW 1: AUTHENTIC PHOTOREALISTIC SKEUOMORPHIC TERMINAL (#dashboard)
  // Replicating exactly the reference mockup image with interactive hotspots
  // =========================================================================
  if (currentView === 'dashboard') {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        maxHeight: '100vh',
        background: '#150c06',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Main Calibrated Console Container: maintains exact 1024 / 572 aspect ratio */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 'calc((100vh - 16px) * (1024 / 572))',
          maxHeight: 'calc(100vh - 16px)',
          aspectRatio: '1024 / 572',
          backgroundImage: "url('/assets/skeuo/master_terminal_bg.jpg')",
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 6px 16px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden'
        }}>
          {/* 1. Live Glowing Amber Nixie Clock */}
          <div style={{
            position: 'absolute',
            left: '43.0%',
            top: '7.8%',
            width: '16.6%',
            height: '6.2%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 20
          }}>
            <span style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: 'clamp(12px, 1.6vw, 19px)',
              fontWeight: 900,
              letterSpacing: '2px',
              color: '#fbbf24',
              textShadow: '0 0 5px #fbbf24, 0 0 14px rgba(245, 158, 11, 0.9), 0 0 22px rgba(217, 119, 6, 0.7)'
            }}>
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>

          {/* 2. Interactive Hotspot: Brand Logo Coin */}
          <div
            onClick={() => setCurrentView('dashboard')}
            title="YNR Fishes Terminal Dashboard"
            style={{
              position: 'absolute',
              left: '2.0%',
              top: '2.5%',
              width: '9.0%',
              height: '13.0%',
              cursor: 'pointer',
              zIndex: 25
            }}
          />

          {/* 3. Interactive Hotspot: + New Order Button */}
          <div
            onClick={() => setCurrentView('billing')}
            title="Create New Fish Order (POS)"
            style={{
              position: 'absolute',
              left: '62.5%',
              top: '7.8%',
              width: '10.3%',
              height: '6.2%',
              cursor: 'pointer',
              borderRadius: '16px',
              zIndex: 25,
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          />

          {/* 4. Interactive Hotspot: WhatsApp Button */}
          <div
            onClick={() => setShowWhatsAppModal(true)}
            title="Open WhatsApp Customer Communication"
            style={{
              position: 'absolute',
              left: '74.2%',
              top: '7.8%',
              width: '9.3%',
              height: '6.2%',
              cursor: 'pointer',
              borderRadius: '16px',
              zIndex: 25,
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          />

          {/* 5. Interactive Hotspot: Alerts Toggle */}
          <div
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications && unreadCount > 0) markAllAsRead();
            }}
            title={unreadCount > 0 ? \`\${unreadCount} Alerts Available\` : 'System Alerts'}
            style={{
              position: 'absolute',
              left: '84.5%',
              top: '7.8%',
              width: '4.9%',
              height: '6.2%',
              cursor: 'pointer',
              borderRadius: '10px',
              zIndex: 25,
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          />

          {/* 6. Interactive Hotspot: Sign Out Button */}
          <div
            onClick={() => setShowLogoutModal(true)}
            title="Sign Out of Terminal"
            style={{
              position: 'absolute',
              left: '90.3%',
              top: '7.8%',
              width: '4.9%',
              height: '6.2%',
              cursor: 'pointer',
              borderRadius: '8px',
              zIndex: 25,
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          />

          {/* 7. Sidebar Navigation Hotspots (Calibrated to exact pixel bounds) */}
          <div
            onClick={() => setCurrentView('dashboard')}
            title="Dashboard"
            style={{ position: 'absolute', left: '0.8%', top: '18.0%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('billing')}
            title="New Order"
            style={{ position: 'absolute', left: '0.8%', top: '22.9%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('active-orders')}
            title="Active Orders"
            style={{ position: 'absolute', left: '0.8%', top: '27.8%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('bill-history')}
            title="Bill History"
            style={{ position: 'absolute', left: '0.8%', top: '32.7%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('inventory')}
            title="Stock & Inventory"
            style={{ position: 'absolute', left: '0.8%', top: '37.7%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('menu')}
            title="Fish Registry & Pricing"
            style={{ position: 'absolute', left: '0.8%', top: '42.6%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('day-book')}
            title="Cash Flow & Day Book"
            style={{ position: 'absolute', left: '0.8%', top: '47.5%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('khata')}
            title="Khata Book (Credit Accounts)"
            style={{ position: 'absolute', left: '0.8%', top: '52.4%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('expenses')}
            title="Store Expenses"
            style={{ position: 'absolute', left: '0.8%', top: '57.3%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('analytics')}
            title="Analytics & Deep Reports"
            style={{ position: 'absolute', left: '0.8%', top: '62.2%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('operations')}
            title="Extra Operations & Config"
            style={{ position: 'absolute', left: '0.8%', top: '67.1%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('settings')}
            title="System Settings"
            style={{ position: 'absolute', left: '0.8%', top: '72.0%', width: '12.8%', height: '4.6%', cursor: 'pointer', zIndex: 25 }}
          />
          <div
            onClick={() => setCurrentView('settings')}
            title="Fresh Catch Depot Settings"
            style={{ position: 'absolute', left: '0.8%', top: '77.0%', width: '12.8%', height: '21.0%', cursor: 'pointer', zIndex: 25 }}
          />

          {/* Live Data Overlay Component (Mechanical Odometer, Counts, Modals) */}
          <Dashboard user={user} onNavigate={setCurrentView} />
        </div>

        {/* Notifications Floating Dropdown */}
        {showNotifications && (
          <div style={{ position: 'fixed', top: '70px', right: '120px', zIndex: 1000 }}>
            <NotificationPanel
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onClearNotification={clearNotification}
              onViewAll={() => setCurrentView('notifications')}
              onNavigate={(viewId) => setCurrentView(viewId)}
              onClose={() => setShowNotifications(false)}
            />
          </div>
        )}

        {/* WhatsApp Modal */}
        {showWhatsAppModal && (
          <WhatsAppConnectModal
            isOpen={showWhatsAppModal}
            onClose={() => setShowWhatsAppModal(false)}
          />
        )}

        {/* Calculator Modal */}
        <CalculatorModal
          isOpen={showCalculator}
          onClose={() => setShowCalculator(false)}
        />

        {/* Sign Out Modal */}
        {showLogoutModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '380px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#dc2626'
              }}>
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
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: FULL WORKSPACE NAVIGATION LAYOUT (Billing, Day Book, Operations, etc.)
  // Clean, consistent, and intuitive admin layout with top header and left sidebar
  // =========================================================================
  return (
    <div className="admin-cream-ui" style={{
      height: '100vh',
      maxHeight: '100vh',
      width: '100%',
      background: '#faf8f5',
      color: '#1e293b',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Top Header Bar */}
      <header
        style={{
          position: 'relative',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid #f1e5d8',
          background: "url('/assets/cards/header_market_bg.png') right top / auto 100% no-repeat, linear-gradient(to right, #ffffff 0%, #ffffff 42%, rgba(255, 255, 255, 0.4) 65%, transparent 100%), #ffffff",
          boxShadow: '0 1px 6px rgba(0, 0, 0, 0.02)',
          zIndex: 30
        }}
      >
        {/* Left: Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={() => setCurrentView('dashboard')}
            title="Return to Master Terminal Dashboard"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: '2px solid #fdba74',
              padding: '2px',
              background: '#ffffff',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img
              src="/assets/ynr_logo_hd.jpg"
              alt="YNR Fishes"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/ynr_logo.png";
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2
                onClick={() => setCurrentView('dashboard')}
                style={{
                  margin: 0,
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: '#0f2942',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  cursor: 'pointer'
                }}
              >
                YNR FISHES
              </h2>
              <span style={{
                background: '#1d4ed8',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                📍 {branchCode} • {branchCity}
              </span>
            </div>
            <p style={{
              margin: '2px 0 0 0',
              fontSize: '0.74rem',
              color: '#64748b',
              fontWeight: 500
            }}>
              {branchName} | Admin Terminal
            </p>
          </div>
        </div>

        {/* Center: Live Status & Date/Time */}
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
            <span>Online Node</span>
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

        {/* Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setCurrentView('billing')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f97316',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 16px',
              fontSize: '0.82rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(249, 115, 22, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <Plus size={15} strokeWidth={3} />
            <span>New Order</span>
          </button>

          <button
            onClick={() => setShowWhatsAppModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 15px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <MessageSquare size={15} />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={() => setShowCalculator(true)}
            title="Quick Calculator"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              color: '#c2410c',
              borderRadius: '12px',
              padding: '8px 11px',
              cursor: 'pointer'
            }}
          >
            <Calculator size={16} strokeWidth={2.2} />
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) {
                  markAllAsRead();
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                borderRadius: '12px',
                padding: '8px 14px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Bell size={15} strokeWidth={2.2} />
              <span>Alerts</span>
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

          <button
            onClick={() => setShowLogoutModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: '12px',
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <LogOut size={15} strokeWidth={2.2} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Body Area: Sidebar + Workspace View */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left Vertical Sidebar matching Image 1 */}
        <aside
          style={{
            width: '210px',
            minWidth: '210px',
            background: '#ffffff',
            borderRight: '1px solid #f1e5d8',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '14px 10px',
            overflowY: 'auto'
          }}
        >
          {/* Nav Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              if (isActive) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '12px',
                      background: 'linear-gradient(135deg, #a75d28 0%, #8b4513 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      boxShadow: '0 3px 10px rgba(139, 69, 19, 0.25)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <Icon size={17} strokeWidth={2.2} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight size={15} strokeWidth={2.5} style={{ opacity: 0.95 }} />
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'transparent',
                    color: '#475569',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fff7ed';
                    e.currentTarget.style.color = '#8b4513';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#475569';
                  }}
                >
                  <Icon size={16} strokeWidth={1.9} style={{ color: '#64748b' }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Bottom Seafood / Fish Platter */}
          <div style={{
            marginTop: '14px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #f1e5d8'
          }}>
            <img
              src="/assets/cards/sidebar_fish_crate.png"
              alt="Fresh Fish on Ice"
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
            />
          </div>
        </aside>

        {/* Right Main Content Workspace Area */}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            background: '#faf8f5',
            padding: currentView === 'billing' ? 0 : undefined
          }}
        >
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
          {currentView === 'bill-history' && <BillHistory user={user} onNavigate={setCurrentView} />}
          {currentView === 'edited-bills' && <EditedBills user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('operations')} />}
          {currentView === 'inventory' && <FishInventoryManager user={user} onNavigate={setCurrentView} />}
          {currentView === 'menu' && <MenuManagement user={user} onNavigate={setCurrentView} />}
          {currentView === 'day-book' && <DayBook user={user} onNavigate={setCurrentView} onGoBack={() => setCurrentView('dashboard')} />}
          {currentView === 'khata' && <KhataDashboard user={user} onNavigate={setCurrentView} />}
          {currentView === 'expenses' && <Expenses user={user} onNavigate={setCurrentView} />}
          {currentView === 'analytics' && <Analytics user={user} onNavigate={setCurrentView} />}
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
          {currentView === 'settings' && <Settings user={user} onNavigate={setCurrentView} />}
          {currentView === 'notifications' && (
            <NotificationsPage
              userRole={user?.role || 'Admin'}
              onNavigate={setCurrentView}
              onGoBack={() => setCurrentView('dashboard')}
            />
          )}
        </main>
      </div>

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <WhatsAppConnectModal
          isOpen={showWhatsAppModal}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {/* Sign Out Modal */}
      {showLogoutModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            maxWidth: '380px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: '#dc2626'
            }}>
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
    </div>
  );
}
`;

fs.writeFileSync(adminDashPath, newAdminDashboardCode, 'utf8');
console.log('Successfully written updated AdminDashboard.jsx');

