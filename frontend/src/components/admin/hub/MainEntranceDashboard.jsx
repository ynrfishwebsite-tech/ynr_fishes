import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
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
  Boxes,
  ArrowUpRight,
  Search,
  X,
  Users,
  Shield,
  Tags,
  Lock,
  Printer,
  FileEdit,
  Smartphone,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Route,
  ClipboardList
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

const STORAGE_KEY = 'ynr_dashboard_cards_order_v2';

export default function MainEntranceDashboard({
  user,
  onNavigate,
  activeOrdersCount = 0,
  unreadNotificationsCount = 0,
  branchName,
  onOpenWhatsApp
}) {
  const { t } = useLanguage();
  const searchInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Persistent Custom Card Order (Sticks to localStorage like mobile apps)
  const [savedOrder, setSavedOrder] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const saveOrder = (newOrder) => {
    setSavedOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch (e) {}
  };

  const resetOrder = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setSavedOrder([]);
    setIsReorderMode(false);
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  // Auto-focus search input whenever user types ANY letter on this page (#dashboard) only
  useEffect(() => {
    const handleAutoType = (e) => {
      // 1. If user is already focused on an input, textarea, or contentEditable, do nothing
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
         activeEl.tagName === 'TEXTAREA' ||
         activeEl.isContentEditable)
      ) {
        return;
      }

      // 2. Ignore modifier combinations (Ctrl, Alt, Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // 3. Ignore non-printable keys (Enter, Tab, Escape, Backspace, Delete, Arrows, F1-F12, etc.)
      if (!e.key || e.key.length !== 1) return;

      // 4. Find the target search input:
      // On desktop & tablet (>= 768px): #global-search-input in the top nav header
      // On mobile (< 768px): searchInputRef.current on the dashboard page
      const isTabletOrDesktop = window.innerWidth >= 768;
      const targetInput = isTabletOrDesktop
        ? (document.getElementById('global-search-input') || searchInputRef.current)
        : (searchInputRef.current || document.getElementById('global-search-input'));

      if (targetInput) {
        targetInput.focus();

        // Ensure the typed letter is immediately registered
        setTimeout(() => {
          if (!targetInput.value || targetInput.value.length === 0) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
              nativeSetter.call(targetInput, e.key);
            } else {
              targetInput.value = e.key;
            }
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 10);
      }
    };

    window.addEventListener('keydown', handleAutoType);
    return () => window.removeEventListener('keydown', handleAutoType);
  }, []);

  const isFullAdmin = !user?.role || ['super-admin', 'admin'].includes(user.role.toLowerCase());
  const userPermitted = Array.isArray(user?.permittedPages) && user.permittedPages.length > 0
    ? user.permittedPages
    : (user?.role === 'manager'
      ? ['dashboard', 'second-dashboard', 'billing', 'active-orders', 'bill-history', 'edited-bills', 'menu', 'inventory', 'day-book', 'khata', 'expenses', 'vehicles', 'analytics', 'crm', 'staff', 'printer', 'operations', 'discount', 'security', 'settings', 'notifications']
      : (user?.role === 'driver'
        ? ['driver-portal']
        : (user?.role === 'supplier'
          ? ['supplier-portal']
          : ['dashboard', 'billing', 'active-orders', 'bill-history', 'inventory'])));

  const isPermitted = (id) => {
    if (isFullAdmin) return true;
    if (id === 'dashboard' || id === 'second-dashboard') return true;
    if (id === 'billing-retail' || id === 'billing-wholesale' || id === 'billing-export') {
      return userPermitted.includes('billing');
    }
    if (id === 'whatsapp-bot') {
      return userPermitted.includes('operations') || userPermitted.includes('settings');
    }
    return userPermitted.includes(id);
  };

  // Master List of Features (Core 17 + All Extra Operations Pages added to Main Dashboard by default)
  // ORDER: Primary cards first (pinned separately), then secondary in prescribed order
  const RAW_CARDS = useMemo(() => [
    // ═══ PRIMARY (pinned row - always shown highlighted) ═══
    // 1. Retail (New Order Mode)
    {
      id: 'billing-retail',
      title: 'Retail',
      subtitle: '(New Order Mode)',
      category: 'Billing',
      icon: ShoppingBag,
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      borderColor: '#a7f3d0',
      navView: 'billing',
      navOptions: { mode: 'individual' },
      keywords: ['retail', 'individual', 'kg', 'walk in', 'retail mode', 'counter customer']
    },
    // 2. Wholesale (New Order Mode)
    {
      id: 'billing-wholesale',
      title: 'Wholesale',
      subtitle: '(New Order Mode)',
      category: 'Billing',
      icon: Boxes,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      borderColor: '#fde68a',
      navView: 'billing',
      navOptions: { mode: 'bulk' },
      keywords: ['wholesale', 'bulk', 'crates', 'boxes', 'wholesale mode', 'dealer order']
    },
    // 3. Export (Bulk) (New Order Mode)
    {
      id: 'billing-export',
      title: 'Export (Bulk)',
      subtitle: '(New Order Mode)',
      category: 'Billing',
      icon: ArrowUpRight,
      iconColor: '#2563eb',
      iconBg: '#eff6ff',
      borderColor: '#bfdbfe',
      navView: 'billing',
      navOptions: { mode: 'export' },
      keywords: ['export', 'dam', 'local export', 'consignment', 'export mode', 'bulk export']
    },
    // 4. New Order
    {
      id: 'billing',
      title: 'New Order',
      subtitle: 'POS Terminal',
      category: 'Billing',
      icon: ShoppingCart,
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      borderColor: '#d1fae5',
      navView: 'billing',
      navOptions: {},
      keywords: ['new order', 'pos', 'billing', 'cart', 'sell', 'counter', 'cashier']
    },

    // ═══ SECONDARY (prescribed order) ═══
    // 5. Active Orders
    {
      id: 'active-orders',
      title: 'Active Orders',
      subtitle: 'Live Queue',
      category: 'Billing',
      icon: Clock,
      iconColor: '#ea580c',
      iconBg: '#fff7ed',
      borderColor: '#fed7aa',
      badge: activeOrdersCount > 0 ? `${activeOrdersCount} Pending` : null,
      badgeBg: '#ea580c',
      navView: 'active-orders',
      navOptions: {},
      keywords: ['active orders', 'pending', 'open', 'billed', 'hold', 'queue', 'dispatch']
    },
    // 6. Bill History
    {
      id: 'bill-history',
      title: 'Bill History',
      subtitle: 'Past Invoices',
      category: 'Billing',
      icon: FileText,
      iconColor: '#2563eb',
      iconBg: '#eff6ff',
      borderColor: '#bfdbfe',
      navView: 'bill-history',
      navOptions: {},
      keywords: ['bill history', 'invoices', 'receipts', 'sales history', 'past bills']
    },
    // 7. Second Dashboard
    {
      id: 'second-dashboard',
      title: 'Second Dashboard',
      category: 'Overview',
      icon: LayoutDashboard,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      borderColor: '#fde68a',
      pill: 'Operations Grid',
      pillBg: '#fffbeb',
      pillColor: '#b45309',
      navView: 'second-dashboard',
      navOptions: {},
      keywords: ['second dashboard', 'operations grid', 'overview', 'summary', 'charts']
    },
    // 8. Analytics & Reports
    {
      id: 'analytics',
      title: 'Analytics & Reports',
      subtitle: 'Sales & Trends',
      category: 'Overview',
      icon: BarChart3,
      iconColor: '#7c3aed',
      iconBg: '#f5f3ff',
      borderColor: '#ddd6fe',
      navView: 'analytics',
      navOptions: {},
      keywords: ['analytics', 'reports', 'charts', 'sales report', 'trends', 'insights']
    },
    // 9. Day Book Ledger
    {
      id: 'day-book',
      title: 'Day Book Ledger',
      subtitle: 'Cash Flow',
      category: 'Finance',
      icon: BookOpen,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      borderColor: '#bae6fd',
      navView: 'day-book',
      navOptions: {},
      keywords: ['day book', 'ledger', 'cash in', 'cash out', 'daily accounts', 'transactions']
    },
    // 10. Stock Catch Ledger
    {
      id: 'inventory',
      title: 'Stock Catch Ledger',
      subtitle: 'Catch & Intake',
      category: 'Inventory',
      icon: Package,
      iconColor: '#0891b2',
      iconBg: '#ecfeff',
      borderColor: '#a5f3fc',
      navView: 'inventory',
      navOptions: {},
      keywords: ['stock', 'catch', 'ledger', 'inventory', 'procurement', 'dam', 'local stock in']
    },
    // 11. Fish Registry
    {
      id: 'menu',
      title: 'Fish Registry',
      subtitle: 'Species & Rates',
      category: 'Inventory',
      icon: Fish,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      borderColor: '#bae6fd',
      navView: 'menu',
      navOptions: {},
      keywords: ['fish registry', 'fish species', 'varieties', 'menu', 'rates', 'pricing', 'items']
    },
    // 12. Khata Book
    {
      id: 'khata',
      title: 'Khata Book',
      subtitle: 'Credit Accounts',
      category: 'Finance',
      icon: BookMarked,
      iconColor: '#e11d48',
      iconBg: '#fff1f2',
      borderColor: '#fecdd3',
      navView: 'khata',
      navOptions: {},
      keywords: ['khata', 'credit', 'customer balance', 'khata book', 'due', 'udhar', 'ledger']
    },
    // 13. Daily Expenses
    {
      id: 'expenses',
      title: 'Daily Expenses',
      subtitle: 'Petty Cash',
      category: 'Finance',
      icon: IndianRupee,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      borderColor: '#fde68a',
      navView: 'expenses',
      navOptions: {},
      keywords: ['expenses', 'daily expenses', 'spending', 'petty cash', 'cost', 'bills']
    },
    // 14. Vehicles & Transport
    {
      id: 'vehicles',
      title: 'Vehicles & Transport',
      subtitle: 'Fleet Logistics',
      category: 'Operations',
      icon: Truck,
      iconColor: '#9333ea',
      iconBg: '#faf5ff',
      borderColor: '#e9d5ff',
      navView: 'vehicles',
      navOptions: {},
      keywords: ['vehicles', 'transport', 'fleet', 'trips', 'drivers', 'dispatch', 'fuel', 'logistics']
    },
    // 15. Customers & CRM
    {
      id: 'crm',
      title: 'Customers & CRM',
      subtitle: 'Dealers & Retailers',
      category: 'Billing',
      icon: Users,
      iconColor: '#0891b2',
      iconBg: '#ecfeff',
      borderColor: '#a5f3fc',
      navView: 'crm',
      navOptions: {},
      keywords: ['customers', 'crm', 'dealers', 'wholesale buyers', 'contacts', 'address', 'phone']
    },
    // 16. Extra Operations
    {
      id: 'operations',
      title: 'Extra Operations',
      subtitle: 'Utilities & Sync',
      category: 'Operations',
      icon: Layers,
      iconColor: '#b45309',
      iconBg: '#fffbeb',
      borderColor: '#fed7aa',
      navView: 'operations',
      navOptions: {},
      keywords: ['operations', 'extra operations', 'tools', 'batch', 'depot', 'utility']
    },
    // 17. System Settings
    {
      id: 'settings',
      title: 'System Settings',
      subtitle: 'Configuration',
      category: 'System',
      icon: SettingsIcon,
      iconColor: '#475569',
      iconBg: '#f8fafc',
      borderColor: '#e2e8f0',
      navView: 'settings',
      navOptions: {},
      keywords: ['settings', 'configuration', 'printer', 'branch', 'system', 'preferences']
    },
    // 18. Alerts & Notices
    {
      id: 'notifications',
      title: 'Alerts & Notices',
      subtitle: 'System Feed',
      category: 'System',
      icon: Bell,
      iconColor: '#dc2626',
      iconBg: '#fef2f2',
      borderColor: '#fecaca',
      badge: unreadNotificationsCount > 0 ? `${unreadNotificationsCount}` : null,
      badgeBg: '#dc2626',
      navView: 'notifications',
      navOptions: {},
      keywords: ['alerts', 'notifications', 'notices', 'warnings', 'messages', 'updates']
    },
    // 19. Admin Control Panel
    {
      id: 'staff',
      title: 'Admin Control Panel',
      subtitle: 'Staff & Roles',
      category: 'System',
      icon: Shield,
      iconColor: '#7c3f1d',
      iconBg: '#FAF0E4',
      borderColor: '#E8DCCB',
      navView: 'staff',
      navOptions: {},
      keywords: ['staff', 'admin control panel', 'users', 'logins', 'drivers', 'suppliers', 'roles', 'passwords']
    },
    // 20. Discounts & Offers
    {
      id: 'discount',
      title: 'Discounts & Offers',
      subtitle: 'Promos & Schemes',
      category: 'Billing',
      icon: Tags,
      iconColor: '#d97706',
      iconBg: '#fffbeb',
      borderColor: '#fde68a',
      navView: 'discount',
      navOptions: {},
      keywords: ['discounts', 'offers', 'schemes', 'coupons', 'special rates']
    },
    // 21. Security & PINs
    {
      id: 'security',
      title: 'Security & PINs',
      subtitle: 'Access & Lock',
      category: 'System',
      icon: Lock,
      iconColor: '#b91c1c',
      iconBg: '#fef2f2',
      borderColor: '#fecaca',
      navView: 'security',
      navOptions: {},
      keywords: ['security', 'pin', 'manager pin', 'passcode', 'lock', 'access']
    },
    // 22. Printer Config
    {
      id: 'printer',
      title: 'Printer Config',
      subtitle: 'Thermal Receipts',
      category: 'System',
      icon: Printer,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      borderColor: '#bae6fd',
      navView: 'printer',
      navOptions: {},
      keywords: ['printer', 'thermal', 'bluetooth', 'receipt print', 'pos printer', '80mm']
    },
    // 23. Edited Bills
    {
      id: 'edited-bills',
      title: 'Edited Bills',
      subtitle: 'Audit & Voids',
      category: 'Billing',
      icon: FileEdit,
      iconColor: '#ea580c',
      iconBg: '#fff7ed',
      borderColor: '#fed7aa',
      navView: 'edited-bills',
      navOptions: {},
      keywords: ['edited bills', 'voids', 'modifications', 'audit log', 'changes']
    },
    // 24. WhatsApp Bot Login
    {
      id: 'whatsapp-bot',
      title: 'WhatsApp Bot Login',
      subtitle: 'QR & Client Alerts',
      category: 'Operations',
      icon: Smartphone,
      iconColor: '#16a34a',
      iconBg: '#f0fdf4',
      borderColor: '#bbf7d0',
      isWhatsApp: true,
      keywords: ['whatsapp', 'bot', 'qr', 'whatsapp login', 'client alerts', 'messages']
    },

    // 25. Driver Portal (Conditional)
    ...(user?.role === 'driver' || isFullAdmin ? [{
      id: 'driver-portal',
      title: 'Driver Portal',
      subtitle: 'Assigned Deliveries',
      category: 'Operations',
      icon: Route,
      iconColor: '#0284c7',
      iconBg: '#f0f9ff',
      borderColor: '#bae6fd',
      navView: 'driver-portal',
      navOptions: {},
      keywords: ['driver portal', 'driver', 'trips', 'delivery route', 'my trips']
    }] : []),

    // 26. Supplier Portal (Conditional)
    ...(user?.role === 'supplier' || isFullAdmin ? [{
      id: 'supplier-portal',
      title: 'Supplier Portal',
      subtitle: 'Catch & Ledger',
      category: 'Finance',
      icon: ClipboardList,
      iconColor: '#059669',
      iconBg: '#ecfdf5',
      borderColor: '#a7f3d0',
      navView: 'supplier-portal',
      navOptions: {},
      keywords: ['supplier portal', 'supplier', 'catch vouchers', 'passbook', 'ledger']
    }] : []),

    // 27. Dedicated Supplier Directory (Admin & Manager)
    ...(isFullAdmin || user?.role === 'manager' ? [{
      id: 'suppliers',
      title: 'Supplier Directory',
      subtitle: 'Harbors & Vendors',
      category: 'Operations',
      icon: Users,
      iconColor: '#ea580c',
      iconBg: '#ffedd5',
      borderColor: '#fed7aa',
      navView: 'suppliers',
      navOptions: {},
      keywords: ['supplier directory', 'suppliers', 'vendors', 'fishermen', 'harbor', 'dam contractors', 'supplies']
    }] : [])
  ], [activeOrdersCount, unreadNotificationsCount, user?.role, isFullAdmin]);

  // Apply custom sticky order from localStorage
  const orderedCards = useMemo(() => {
    if (!savedOrder || savedOrder.length === 0) return RAW_CARDS;

    const map = new Map();
    RAW_CARDS.forEach(card => map.set(card.id, card));

    const result = [];
    savedOrder.forEach(id => {
      if (map.has(id)) {
        result.push(map.get(id));
        map.delete(id);
      }
    });

    // Append any new or unsaved cards to the end
    map.forEach(card => result.push(card));
    return result;
  }, [RAW_CARDS, savedOrder]);

  // Keep filteredCards for empty-state check (secondary only now)
  const filteredCards = useMemo(() => {
    let list = orderedCards.filter(card => isPermitted(card.id));
    if (selectedCategory !== 'ALL') {
      list = list.filter(card => card.category.toUpperCase() === selectedCategory.toUpperCase());
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter(card => {
      const matchTitle = card.title.toLowerCase().includes(query);
      const matchSubtitle = (card.subtitle || '').toLowerCase().includes(query);
      const matchKeywords = card.keywords?.some(k => k.toLowerCase().includes(query));
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [orderedCards, selectedCategory, searchQuery, userPermitted, isFullAdmin]);

  // Reordering functions (Drag & Drop + Mobile Arrows)
  const handleMoveCard = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const currentList = orderedCards.map(c => c.id);
    const sourceIndex = currentList.indexOf(sourceId);
    const targetIndex = currentList.indexOf(targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const updated = [...currentList];
    const [movedItem] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    saveOrder(updated);
  };

  const handleShiftCard = (cardId, direction, e) => {
    if (e) e.stopPropagation();
    const currentList = orderedCards.map(c => c.id);
    const index = currentList.indexOf(cardId);
    if (index === -1) return;

    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const updated = [...currentList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    saveOrder(updated);
  };

  // Card click handler
  const handleCardClick = (card) => {
    if (isReorderMode) return; // Prevent navigation during reorder mode

    if (card.isWhatsApp) {
      if (onOpenWhatsApp) onOpenWhatsApp();
      return;
    }

    if (card.navView) {
      onNavigate(card.navView, card.navOptions || {});
    }
  };

  // Handle Enter key inside search to launch first match
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && filteredCards.length > 0) {
      e.preventDefault();
      handleCardClick(filteredCards[0]);
    }
  };

  // Categories list for quick-filter tabs
  const categories = [
    { id: 'ALL', label: 'All Features' },
    { id: 'Billing', label: 'Billing & POS' },
    { id: 'Inventory', label: 'Fish & Stock' },
    { id: 'Finance', label: 'Accounts & Ledger' },
    { id: 'Operations', label: 'Fleet & Extra' },
    { id: 'System', label: 'System & Admin' }
  ];

  // --- PINNED PRIMARY CARDS (always shown, highlighted, never filtered out) ---
  const PRIMARY_IDS = ['billing-retail', 'billing-wholesale', 'billing-export', 'billing'];

  const primaryCards = useMemo(() =>
    PRIMARY_IDS.map(id => RAW_CARDS.find(c => c.id === id)).filter(Boolean),
    [RAW_CARDS]
  );

  // Secondary cards: everything else, filtered normally (excluding primary IDs)
  const secondaryFilteredCards = useMemo(() => {
    let list = orderedCards.filter(card => isPermitted(card.id) && !PRIMARY_IDS.includes(card.id));

    if (selectedCategory !== 'ALL') {
      list = list.filter(card => card.category.toUpperCase() === selectedCategory.toUpperCase());
    }

    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter(card => {
      const matchTitle = card.title.toLowerCase().includes(query);
      const matchSubtitle = (card.subtitle || '').toLowerCase().includes(query);
      const matchKeywords = card.keywords?.some(k => k.toLowerCase().includes(query));
      return matchTitle || matchSubtitle || matchKeywords;
    });
  }, [orderedCards, selectedCategory, searchQuery, userPermitted, isFullAdmin]);

  return (
    <div className="w-full min-h-full p-0 box-border flex flex-col justify-start">
      {/* 
        ========================================================================
        TOP BAR: Search Features (Ctrl + K) + Rearrange Toggle + Filter Tabs
        ========================================================================
      */}
      <div className="w-full px-2.5 sm:px-4 md:px-5 pt-2.5 sm:pt-3 md:pt-4 mb-2 sm:mb-3">
        {/* Mobile-Only Search Input Bar (On Desktop & Tablet, Global Search Bar is in the Top Nav Header) */}
        <div className="md:hidden relative flex items-center mb-2.5">
          <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
            <Search size={15} />
          </div>

          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t("Search features (e.g., POS, Stock, CRM)...")}
            className="w-full pl-9 pr-14 py-2 rounded-xl bg-white border border-[#E8DCCB] text-slate-800 placeholder-slate-400 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7c3f1d]/20 focus:border-[#7c3f1d] shadow-2xs transition-all"
          />

          <div className="absolute right-2.5 flex items-center">
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Action Controls & Category Filter Tags */}
        <div className="flex items-center justify-between gap-2 pt-2.5 sm:pt-3 pb-0.5 overflow-x-auto no-scrollbar">
          {/* Category Chips */}
          <div className="flex items-center gap-1.5 shrink-0">
            {categories.map(cat => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none ${
                    active
                      ? 'bg-[#7c3f1d] text-white shadow-xs'
                      : 'bg-white/70 hover:bg-white text-slate-600 hover:text-slate-900 border border-[#E8DCCB]'
                  }`}
                >
                  {t(cat.label)}
                </button>
              );
            })}
          </div>

          {/* Sticky Reorder Apps Button (Mobile-like app relocation) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsReorderMode(!isReorderMode)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                isReorderMode
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border border-[#E8DCCB]'
              }`}
              title="Drag or shift apps to customize your home screen"
            >
              {isReorderMode ? <Check size={13} strokeWidth={2.6} /> : <GripVertical size={13} />}
              <span>{isReorderMode ? t('Done') : t('Reorder Apps')}</span>
            </button>

            {savedOrder.length > 0 && (
              <button
                type="button"
                onClick={resetOrder}
                className="px-2 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 border border-[#E8DCCB] transition-all flex items-center gap-1 cursor-pointer select-none"
                title="Reset to default layout"
              >
                <RotateCcw size={12} />
                <span className="hidden sm:inline">{t('Reset Layout')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile/Touch Reorder Tip Bar */}
        {isReorderMode && (
          <div className="mt-2.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] sm:text-xs flex items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-1.5">
              <GripVertical size={14} className="text-amber-700 shrink-0" />
              <span>{t("Drag apps or tap ◀ ▶ to change positions. Your arrangement sticks permanently.")}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsReorderMode(false)}
              className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10.5px] hover:bg-amber-700 shrink-0 cursor-pointer"
            >
              {t("Done")}
            </button>
          </div>
        )}
      </div>

      {/* 
        ========================================================================
        UNIFIED GRID — Primary 4 always first (highlighted), then rest
        All cards same size. Primary cards styled with colored border + solid icon.
        ========================================================================
      */}
      <div className="w-full px-2.5 sm:px-4 md:px-5 pb-4">
        {(() => {
          // Build unified list: primary 4 always first (from RAW_CARDS), then secondaryFilteredCards
          const unifiedList = [
            ...primaryCards,
            ...secondaryFilteredCards
          ];

          if (unifiedList.length === 0) {
            return (
              <div className="flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
                  <Search size={22} />
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  {t("No features found matching")} "{searchQuery}"
                </h4>
                <p className="text-xs text-slate-500 mb-3">
                  {t("Try searching with different keywords like POS, CRM, Staff, or Expenses.")}
                </p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#7c3f1d] text-white hover:bg-[#603117] transition-colors cursor-pointer"
                >
                  {t("Reset Filter")}
                </button>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-3.5">
              {unifiedList.map((card, idx) => {
                const CardIcon = card.icon;
                const isPrimary = PRIMARY_IDS.includes(card.id);
                const isBeingDragged = draggedId === card.id;
                const isDragTarget = dragOverId === card.id;

                return (
                  <div
                    key={card.id}
                    draggable={!isPrimary}
                    onDragStart={!isPrimary ? (e) => {
                      e.dataTransfer.setData('text/plain', card.id);
                      setDraggedId(card.id);
                    } : undefined}
                    onDragOver={!isPrimary ? (e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverId !== card.id) setDragOverId(card.id);
                    } : undefined}
                    onDragLeave={!isPrimary ? () => {
                      if (dragOverId === card.id) setDragOverId(null);
                    } : undefined}
                    onDrop={!isPrimary ? (e) => {
                      e.preventDefault();
                      const sourceId = e.dataTransfer.getData('text/plain') || draggedId;
                      handleMoveCard(sourceId, card.id);
                      setDraggedId(null);
                      setDragOverId(null);
                    } : undefined}
                    onDragEnd={!isPrimary ? () => {
                      setDraggedId(null);
                      setDragOverId(null);
                    } : undefined}
                    onClick={() => handleCardClick(card)}
                    className={`group relative flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all duration-150 text-center select-none ${
                      isBeingDragged ? 'opacity-40 scale-95 border-dashed border-amber-500' : ''
                    } ${
                      isDragTarget ? 'ring-2 ring-[#7c3f1d]/30 scale-[1.02]' : ''
                    } ${
                      isReorderMode && !isPrimary ? 'cursor-grab ring-1 ring-amber-300' : 'cursor-pointer active:scale-[0.97]'
                    } shadow-2xs hover:shadow-md`}
                    style={{
                      minHeight: isMobile ? '98px' : '118px',
                      background: isPrimary
                        ? `linear-gradient(135deg, ${card.iconBg} 0%, #fff 65%)`
                        : '#ffffff',
                      borderColor: isPrimary
                        ? card.borderColor || '#E8DCCB'
                        : isDragTarget ? '#7c3f1d' : '#E8DCCB',
                      borderWidth: isPrimary ? '2px' : '1px',
                      boxShadow: isPrimary
                        ? `0 2px 10px ${card.iconColor}25, 0 1px 3px rgba(0,0,0,0.05)`
                        : undefined
                    }}
                  >
                    {/* Primary accent dot */}
                    {isPrimary && (
                      <div
                        className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: card.iconColor, opacity: 0.75 }}
                      />
                    )}

                    {/* Badge */}
                    {card.badge && (
                      <span
                        className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black text-white shadow-xs pointer-events-none tracking-tight animate-pulse"
                        style={{ backgroundColor: card.badgeBg || '#ea580c' }}
                      >
                        {card.badge}
                      </span>
                    )}

                    {/* Icon */}
                    <div
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0"
                      style={isPrimary ? {
                        backgroundColor: card.iconBg,
                        color: card.iconColor,
                        border: `1.5px solid ${card.borderColor || '#E8DCCB'}`
                      } : {
                        backgroundColor: card.iconBg,
                        color: card.iconColor,
                        border: `1.2px solid ${card.borderColor || '#E8DCCB'}`
                      }}
                    >
                      <CardIcon size={isMobile ? 18 : 21} strokeWidth={2.2} />
                    </div>

                    {/* Text */}
                    <div className="mt-2 w-full flex flex-col items-center justify-center px-0.5">
                      <span
                        className={`text-[11.5px] sm:text-xs md:text-[12.5px] tracking-tight leading-snug line-clamp-1 ${
                          isPrimary ? 'font-black' : 'font-bold text-slate-800 group-hover:text-slate-950'
                        }`}
                        style={isPrimary ? { color: card.iconColor } : undefined}
                      >
                        {t(card.title)}
                      </span>

                      {card.subtitle && (
                        <span className="text-[9px] sm:text-[9.5px] md:text-[10px] text-slate-400 font-medium leading-tight mt-0.5 line-clamp-1">
                          {t(card.subtitle)}
                        </span>
                      )}

                      {card.pill && (
                        <span
                          className="mt-1 px-1.5 py-0.5 rounded text-[8.5px] sm:text-[9px] font-bold border"
                          style={{
                            backgroundColor: card.pillBg,
                            color: card.pillColor,
                            borderColor: card.borderColor
                          }}
                        >
                          {card.pill}
                        </span>
                      )}
                    </div>

                    {/* Reorder Controls (secondary only) */}
                    {isReorderMode && !isPrimary && (
                      <div
                        className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-center gap-2 w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => handleShiftCard(card.id, -1, e)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                          title="Move Left"
                        >
                          <ArrowLeft size={11} strokeWidth={2.5} />
                        </button>
                        <span className="text-[9px] font-mono font-bold text-slate-400">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={idx === unifiedList.length - 1}
                          onClick={(e) => handleShiftCard(card.id, 1, e)}
                          className="p-1 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 cursor-pointer"
                          title="Move Right"
                        >
                          <ArrowRight size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
