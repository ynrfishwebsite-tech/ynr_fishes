import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  ShoppingCart,
  Clock,
  FileText,
  LayoutDashboard,
  BarChart3,
  Package,
  Fish,
  BookOpen,
  BookMarked,
  IndianRupee,
  Truck,
  Layers,
  Settings as SettingsIcon,
  Bell,
  ShoppingBag,
  Store,
  ArrowUpRight,
  Users,
  Shield,
  Tags,
  Lock,
  Printer,
  FileEdit,
  Smartphone
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

export default function GlobalSearchBar({
  onNavigate,
  onOpenWhatsApp,
  isPermitted
}) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search input from ANY page
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Complete Registry of searchable features across the entire system
  const ALL_FEATURES = useMemo(() => [
    {
      id: 'billing',
      title: 'New Order / POS',
      subtitle: 'Counter Billing Terminal',
      category: 'Billing',
      icon: ShoppingCart,
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      navView: 'billing',
      navOptions: {},
      keywords: ['new order', 'pos', 'billing', 'cart', 'sell', 'counter', 'cashier', 'table']
    },
    {
      id: 'billing-retail',
      title: 'Retail Order Mode',
      subtitle: 'Outside Walk-in & Kg Billing',
      category: 'Billing',
      icon: ShoppingBag,
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      navView: 'billing',
      navOptions: { mode: 'individual' },
      keywords: ['retail', 'individual', 'kg', 'walk in', 'retail mode']
    },
    {
      id: 'billing-wholesale',
      title: 'Wholesale Order Mode',
      subtitle: 'Daily Market & Box Consignment',
      category: 'Billing',
      icon: Store,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      navView: 'billing',
      navOptions: { mode: 'bulk' },
      keywords: ['wholesale', 'bulk', 'crates', 'boxes', 'wholesale mode', 'dealer order']
    },
    {
      id: 'billing-export',
      title: 'Export (Bulk) Order Mode',
      subtitle: 'Local & DAM Consignments',
      category: 'Billing',
      icon: ArrowUpRight,
      iconColor: '#2563eb',
      iconBg: '#eff6ff',
      navView: 'billing',
      navOptions: { mode: 'export' },
      keywords: ['export', 'dam', 'local export', 'consignment', 'export mode', 'bulk export']
    },
    {
      id: 'active-orders',
      title: 'Active Orders',
      subtitle: 'Live Counter & Export Queue',
      category: 'Billing',
      icon: Clock,
      iconColor: '#ea580c',
      iconBg: '#fff7ed',
      navView: 'active-orders',
      navOptions: {},
      keywords: ['active orders', 'pending', 'open orders', 'billed', 'hold', 'queue', 'settle', 'dispatch']
    },
    {
      id: 'bill-history',
      title: 'Bill History',
      subtitle: 'Past Invoices & Receipts',
      category: 'Billing',
      icon: FileText,
      iconColor: '#2563eb',
      iconBg: '#eff6ff',
      navView: 'bill-history',
      navOptions: {},
      keywords: ['bill history', 'invoices', 'receipts', 'sales history', 'past bills', 'history']
    },
    {
      id: 'edited-bills',
      title: 'Edited Bills',
      subtitle: 'Audit Log & Bill Voids',
      category: 'Billing',
      icon: FileEdit,
      iconColor: '#ea580c',
      iconBg: '#fff7ed',
      navView: 'edited-bills',
      navOptions: {},
      keywords: ['edited bills', 'voids', 'modifications', 'audit log', 'changes', 'reprint']
    },
    {
      id: 'second-dashboard',
      title: 'Second Dashboard',
      subtitle: '8-Module Operations Grid',
      category: 'Overview',
      icon: LayoutDashboard,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      navView: 'second-dashboard',
      navOptions: {},
      keywords: ['second dashboard', 'operations grid', 'overview', 'summary', 'modules']
    },
    {
      id: 'analytics',
      title: 'Analytics & Reports',
      subtitle: 'Sales Metrics & Trends',
      category: 'Overview',
      icon: BarChart3,
      iconColor: '#7c3aed',
      iconBg: '#f5f3ff',
      navView: 'analytics',
      navOptions: {},
      keywords: ['analytics', 'reports', 'charts', 'sales report', 'trends', 'insights', 'profit']
    },
    {
      id: 'inventory',
      title: 'Stock Catch Ledger',
      subtitle: 'Procurement (Local & DAM)',
      category: 'Inventory',
      icon: Package,
      iconColor: '#0891b2',
      iconBg: '#ecfeff',
      navView: 'inventory',
      navOptions: {},
      keywords: ['stock', 'catch', 'inventory', 'procurement', 'dam', 'local stock in', 'crates']
    },
    {
      id: 'menu',
      title: 'Fish Registry',
      subtitle: 'Species Catalog & Rates',
      category: 'Inventory',
      icon: Fish,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      navView: 'menu',
      navOptions: {},
      keywords: ['fish registry', 'fish species', 'varieties', 'menu', 'rates', 'pricing', 'items']
    },
    {
      id: 'day-book',
      title: 'Day Book Ledger',
      subtitle: 'Cash Flow (In / Out)',
      category: 'Finance',
      icon: BookOpen,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      navView: 'day-book',
      navOptions: {},
      keywords: ['day book', 'ledger', 'cash in', 'cash out', 'daily accounts', 'transactions']
    },
    {
      id: 'khata',
      title: 'Khata Book',
      subtitle: 'Credit Accounts & Customer Due',
      category: 'Finance',
      icon: BookMarked,
      iconColor: '#e11d48',
      iconBg: '#fff1f2',
      navView: 'khata',
      navOptions: {},
      keywords: ['khata', 'credit', 'customer balance', 'khata book', 'due', 'udhar', 'ledger']
    },
    {
      id: 'expenses',
      title: 'Daily Expenses',
      subtitle: 'Petty Cash & Overhead',
      category: 'Finance',
      icon: IndianRupee,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      navView: 'expenses',
      navOptions: {},
      keywords: ['expenses', 'daily expenses', 'spending', 'petty cash', 'cost', 'bills']
    },
    {
      id: 'vehicles',
      title: 'Vehicles & Fleet Transport',
      subtitle: 'Trips, Dispatch & Fuel Tracker',
      category: 'Operations',
      icon: Truck,
      iconColor: '#9333ea',
      iconBg: '#faf5ff',
      navView: 'vehicles',
      navOptions: {},
      keywords: ['vehicles', 'transport', 'fleet', 'trips', 'drivers', 'dispatch', 'fuel', 'logistics']
    },
    {
      id: 'crm',
      title: 'Customers & CRM',
      subtitle: 'Dealers, Wholesalers & Retail',
      category: 'Billing',
      icon: Users,
      iconColor: '#0891b2',
      iconBg: '#ecfeff',
      navView: 'crm',
      navOptions: {},
      keywords: ['customers', 'crm', 'dealers', 'wholesale buyers', 'contacts', 'address', 'phone']
    },
    {
      id: 'staff',
      title: 'Admin Control Panel',
      subtitle: 'Staff Users, Drivers & Passwords',
      category: 'System',
      icon: Shield,
      iconColor: '#7c3f1d',
      iconBg: '#FAF0E4',
      navView: 'staff',
      navOptions: {},
      keywords: ['staff', 'admin control panel', 'users', 'logins', 'drivers', 'suppliers', 'roles', 'passwords']
    },
    {
      id: 'discount',
      title: 'Discounts & Offers',
      subtitle: 'Seasonal Schemes & Coupons',
      category: 'Billing',
      icon: Tags,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      navView: 'discount',
      navOptions: {},
      keywords: ['discounts', 'offers', 'schemes', 'coupons', 'special rates']
    },
    {
      id: 'security',
      title: 'Security & PINs',
      subtitle: 'Manager Passcode & Terminal Lock',
      category: 'System',
      icon: Lock,
      iconColor: '#b91c1c',
      iconBg: '#fef2f2',
      navView: 'security',
      navOptions: {},
      keywords: ['security', 'pin', 'manager pin', 'passcode', 'lock', 'access']
    },
    {
      id: 'printer',
      title: 'Printer Config',
      subtitle: 'Thermal 80mm Bill Printing',
      category: 'System',
      icon: Printer,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      navView: 'printer',
      navOptions: {},
      keywords: ['printer', 'thermal', 'bluetooth', 'receipt print', 'pos printer', '80mm']
    },
    {
      id: 'whatsapp-bot',
      title: 'WhatsApp Bot Login',
      subtitle: 'QR Code & Client Invoices',
      category: 'Operations',
      icon: Smartphone,
      iconColor: '#16a34a',
      iconBg: '#f0fdf4',
      isWhatsApp: true,
      keywords: ['whatsapp', 'bot', 'qr', 'whatsapp login', 'client alerts', 'messages']
    },
    {
      id: 'operations',
      title: 'Extra Operations',
      subtitle: 'System Hub & Desk Utilities',
      category: 'Operations',
      icon: Layers,
      iconColor: '#b45309',
      iconBg: '#fffbeb',
      navView: 'operations',
      navOptions: {},
      keywords: ['operations', 'extra operations', 'tools', 'batch', 'depot', 'utility']
    },
    {
      id: 'settings',
      title: 'System Settings',
      subtitle: 'Branch Details & Preferences',
      category: 'System',
      icon: SettingsIcon,
      iconColor: '#475569',
      iconBg: '#f8fafc',
      navView: 'settings',
      navOptions: {},
      keywords: ['settings', 'configuration', 'branch', 'system', 'preferences']
    },
    {
      id: 'notifications',
      title: 'Alerts & Notices',
      subtitle: 'Notifications & Broadcasts',
      category: 'System',
      icon: Bell,
      iconColor: '#dc2626',
      iconBg: '#fef2f2',
      navView: 'notifications',
      navOptions: {},
      keywords: ['alerts', 'notifications', 'notices', 'warnings', 'messages']
    },
    {
      id: 'driver-portal',
      title: 'Driver Portal',
      subtitle: 'Assigned Deliveries & Box Shipments',
      category: 'Operations',
      icon: Truck,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      navView: 'driver-portal',
      navOptions: {},
      keywords: ['driver portal', 'driver', 'trips', 'delivery route', 'my trips']
    },
    {
      id: 'supplier-portal',
      title: 'Supplier Portal',
      subtitle: 'Catch Vouchers & Ledger Passbook',
      category: 'Finance',
      icon: BookMarked,
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      navView: 'supplier-portal',
      navOptions: {},
      keywords: ['supplier portal', 'supplier', 'catch vouchers', 'passbook', 'ledger']
    }
  ], []);

  // Filter features based on search query and user permissions
  const matchingFeatures = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return ALL_FEATURES.filter(item => {
      // Permission check
      if (isPermitted && !isPermitted(item.id)) return false;

      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSubtitle = (item.subtitle || '').toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some(k => k.toLowerCase().includes(q));
      return matchTitle || matchSubtitle || matchKeywords;
    }).slice(0, 8); // Top 8 relevant matches
  }, [query, ALL_FEATURES, isPermitted]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [matchingFeatures]);

  const handleSelectFeature = (item) => {
    if (!item) return;
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();

    if (item.isWhatsApp) {
      if (onOpenWhatsApp) onOpenWhatsApp();
      return;
    }

    if (item.navView) {
      onNavigate(item.navView, item.navOptions || {});
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (matchingFeatures.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + matchingFeatures.length) % (matchingFeatures.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (matchingFeatures.length > 0) {
        handleSelectFeature(matchingFeatures[selectedIndex]);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md lg:max-w-lg mx-2 lg:mx-4">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
          <Search size={15} />
        </div>

        <input
          id="global-search-input"
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t("Search features... (e.g., New Order, Stock, Reports)")}
          className="w-full pl-8.5 pr-16 py-1.5 sm:py-2 rounded-xl bg-white border border-[#E8DCCB] text-slate-800 placeholder-slate-400 text-xs sm:text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#7c3f1d]/20 focus:border-[#7c3f1d] shadow-2xs transition-all"
        />

        <div className="absolute right-2.5 flex items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Clear"
            >
              <X size={13} />
            </button>
          ) : (
            <kbd className="inline-flex items-center px-1.5 py-0.5 text-[9.5px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded select-none pointer-events-none">
              Ctrl + K
            </kbd>
          )}
        </div>
      </div>

      {/* Autocomplete / Instant Navigation Dropdown */}
      {isOpen && query.trim() && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-[#E8DCCB] rounded-xl shadow-xl z-50 overflow-hidden max-h-[360px] overflow-y-auto animate-fadeIn">
          {matchingFeatures.length > 0 ? (
            <div className="p-1.5 space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {t("Quick Jump (Press Enter to Open)")}
              </div>

              {matchingFeatures.map((item, index) => {
                const ItemIcon = item.icon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectFeature(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#FAF0E4] text-[#7c3f1d] border-l-2 border-[#7c3f1d]'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: item.iconBg,
                          color: item.iconColor,
                          borderColor: `${item.iconColor}30`
                        }}
                      >
                        <ItemIcon size={14} strokeWidth={2.4} />
                      </div>

                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {t(item.title)}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {t(item.subtitle)}
                        </div>
                      </div>
                    </div>

                    <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded shrink-0 ml-2">
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500">
              {t("No feature found matching")} "<span className="font-semibold text-slate-700">{query}</span>"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

