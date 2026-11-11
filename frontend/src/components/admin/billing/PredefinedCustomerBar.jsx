import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Users, Search, Check, Lock, Unlock, Plus, Phone, 
  MapPin, X, ChevronDown, Building, ArrowUpRight, Camera, Loader2, Crop 
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { getCachedCustomers, fetchPredefinedCustomers, saveCustomerToCache } from '../../../api/crm/customerApi';
import ImageCropperModal from '../crm/ImageCropperModal';
import api from '../../../api/system/axios';

export default function PredefinedCustomerBar({
  orderMode, // 'individual' (Retail) | 'bulk' (Wholesale) | 'export'
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerInfo,
  onCustomerSelect,
  isLocked,
  setIsLocked,
  lockedTimestamp,
  setLockedTimestamp,
  showToast
}) {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [exportFilter, setExportFilter] = useState('All'); // 'All' | 'Local' | 'DAM'
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);

  const isRetail = orderMode === 'individual' || orderMode === 'retail' || (!orderMode);
  const isWholesale = orderMode === 'bulk' || orderMode === 'wholesale';
  const isExport = orderMode === 'export';
  const currentCategory = isWholesale ? 'Wholesale' : (isExport ? 'Export' : 'Retail');
  
  // Quick Add Modal State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    name: '',
    phone: '',
    businessName: '',
    category: currentCategory,
    exportSubCategory: 'Local',
    address: '',
    photo: ''
  });
  const [showCropper, setShowCropper] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  const [isBlinking, setIsBlinking] = useState(false);

  // Listen for trigger-crm-blink event (e.g., when user presses Enter on weight input)
  useEffect(() => {
    const handleTriggerCrmBlink = () => {
      setIsBlinking(true);
      // Ensure element is in view smoothly
      setTimeout(() => {
        const el = document.getElementById('crm-customer-bar-container') || containerRef.current;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);

      // Auto-cancel blink after 4 seconds
      const timer = setTimeout(() => {
        setIsBlinking(false);
      }, 4000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('trigger-crm-blink', handleTriggerCrmBlink);
    return () => window.removeEventListener('trigger-crm-blink', handleTriggerCrmBlink);
  }, []);

  // Sync category mode with quick add default
  useEffect(() => {
    if (isWholesale) {
      setQuickAddData(prev => ({ ...prev, category: 'Wholesale' }));
    } else if (isExport) {
      setQuickAddData(prev => ({ ...prev, category: 'Export', exportSubCategory: 'Local' }));
    } else {
      setQuickAddData(prev => ({ ...prev, category: 'Retail' }));
    }
  }, [orderMode, isWholesale, isExport]);

  // Load predefined customers on mount and when orderMode changes
  const loadCustomers = () => {
    const targetCategory = currentCategory;
    const cached = getCachedCustomers(targetCategory);
    if (cached && cached.length > 0) {
      setCustomers(cached);
    }
    // Fetch fresh from backend and keep cache and state in sync
    fetchPredefinedCustomers(targetCategory, 'All', true).then(data => {
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadCustomers();
    // Listen for customer directory updates across the app
    const handleUpdate = () => loadCustomers();
    window.addEventListener('customersUpdated', handleUpdate);
    return () => window.removeEventListener('customersUpdated', handleUpdate);
  }, [orderMode, currentCategory]);

  // Find currently selected customer object
  useEffect(() => {
    if (customerPhone) {
      const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
      const match = customers.find(c => {
        const p = String(c.phone || '').replace(/\D/g, '').slice(-10);
        return p === cleanPhone;
      });
      if (match) {
        setSelectedCustomerObj(match);
      } else {
        setSelectedCustomerObj({
          name: customerName || (isWholesale ? 'Wholesale Dealer' : (isExport ? 'Export Client' : 'Customer')),
          phone: customerPhone,
          category: currentCategory
        });
      }
    } else {
      setSelectedCustomerObj(null);
    }
  }, [customerPhone, customerName, customers, orderMode, currentCategory]);

  // If order is unlocked and switching modes to a different category, reset selection
  useEffect(() => {
    if (selectedCustomerObj && selectedCustomerObj.category && !isLocked) {
      const isExpected = 
        (isWholesale && selectedCustomerObj.category === 'Wholesale') ||
        (isExport && selectedCustomerObj.category === 'Export') ||
        (isRetail && selectedCustomerObj.category === 'Retail');
      if (!isExpected) {
        setCustomerName('');
        setCustomerPhone('');
        setSelectedCustomerObj(null);
      }
    }
  }, [orderMode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter list strictly by channel and search
  const filteredList = useMemo(() => {
    const s = search.toLowerCase().trim();
    return customers.filter(c => {
      if (!c) return false;
      const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
      const sub = c.exportSubCategory || 'Local';

      // Match channel strictly
      if (isWholesale && cat !== 'Wholesale') return false;
      if (isExport) {
        if (cat !== 'Export') return false;
        if (exportFilter !== 'All' && sub !== exportFilter) return false;
      }
      if (isRetail && cat !== 'Retail') return false;

      // Match search
      if (!s) return true;
      const addrStr = typeof c.address === 'string' ? c.address : `${c.address?.line1 || ''} ${c.address?.city || ''}`;
      return (
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.phone && c.phone.includes(s)) ||
        (c.businessName && c.businessName.toLowerCase().includes(s)) ||
        addrStr.toLowerCase().includes(s)
      );
    });
  }, [customers, isWholesale, isExport, isRetail, exportFilter, search]);

  const handleSelect = (cust) => {
    setCustomerPhone(cust.phone);
    setCustomerName(cust.name || 'Guest');
    setSelectedCustomerObj(cust);

    // Formatted date and time
    const now = new Date();
    const dateFormatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const fullTimestamp = `${dateFormatted}, ${timeFormatted}`;

    if (setLockedTimestamp) {
      setLockedTimestamp(fullTimestamp);
    }
    if (setIsLocked) {
      setIsLocked(true);
    }

    if (onCustomerSelect) {
      onCustomerSelect({
        ...cust,
        orderLockedAt: now,
        orderDateFormatted: dateFormatted,
        orderTimeFormatted: timeFormatted,
        isOrderLocked: true
      });
    }

    setIsOpen(false);
    if (showToast) {
      showToast(t(`Order locked to ${cust.name || cust.phone}`), 'success');
    }
  };

  const handleUnlock = () => {
    if (setIsLocked) setIsLocked(false);
    if (showToast) {
      showToast(t('Customer unlocked - you may switch or edit dealer'), 'info');
    }
  };

  // Quick Add submit
  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    const clean = quickAddData.phone.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      alert(t('Please enter a valid 10-digit phone number'));
      return;
    }

    setQuickAddLoading(true);
    try {
      const payload = {
        name: (quickAddData.name || 'Guest').trim(),
        businessName: (quickAddData.businessName || '').trim(),
        phone: clean,
        category: currentCategory,
        exportSubCategory: isExport ? quickAddData.exportSubCategory : null,
        address: quickAddData.address,
        photo: quickAddData.photo,
        orderType: currentCategory
      };

      const res = await api.post('/customers', payload);
      if (res.data?.success && res.data.customer) {
        const newCust = res.data.customer;
        // 1. Immediately persist to localStorage CRM cache
        saveCustomerToCache(newCust);

        // 2. Add to active component list & select
        setCustomers(prev => [newCust, ...prev.filter(c => c.phone !== newCust.phone)]);
        handleSelect(newCust);
        setShowQuickAdd(false);
        setQuickAddData({
          name: '',
          phone: '',
          businessName: '',
          category: currentCategory,
          exportSubCategory: 'Local',
          address: '',
          photo: ''
        });
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('Failed to register customer'));
    } finally {
      setQuickAddLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full select-none mb-1.5">
      {/* File input for quick add photo */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            setCropperSrc(reader.result);
            setShowCropper(true);
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Main Bar Trigger */}
      <div 
        id="crm-customer-bar-container"
        ref={containerRef}
        className={`p-2 rounded-2xl border transition-all ${
          isBlinking
            ? 'ring-4 ring-amber-500 shadow-xl animate-pulse bg-amber-100/90 border-amber-500'
            : selectedCustomerObj
              ? (isLocked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#F7EFE2] border-[#E8DCCB]')
              : 'bg-[#FDFBF7] border-[#E8DCCB] hover:border-amber-400'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Customer Identity / Selector */}
          <div 
            onClick={() => {
              setIsBlinking(false);
              setIsOpen(!isOpen);
            }}
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          >
            {selectedCustomerObj?.photo ? (
              <img
                src={selectedCustomerObj.photo}
                alt={selectedCustomerObj.name}
                className="w-9 h-9 rounded-full object-cover border-2 border-amber-500/40 shadow-xs shrink-0"
              />
            ) : (
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                selectedCustomerObj 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {selectedCustomerObj ? (selectedCustomerObj.name || 'C').charAt(0).toUpperCase() : <User size={16} />}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-[13px] font-black text-slate-900 truncate">
                  {selectedCustomerObj?.name || (isWholesale ? t('Select Wholesale Dealer') : (isExport ? t('Select Export Dealer') : t('Select Retail Customer')))}
                </span>
                {isWholesale && (
                  <span className="text-[9.5px] font-extrabold bg-amber-500/20 text-amber-800 px-1.5 py-0.2 rounded shrink-0">
                    {t('Wholesale')}
                  </span>
                )}
                {isExport && (
                  <span className="text-[9.5px] font-extrabold bg-sky-500/20 text-sky-800 px-1.5 py-0.2 rounded shrink-0">
                    {selectedCustomerObj?.exportSubCategory === 'DAM' ? t('Export DAM') : t('Export Local')}
                  </span>
                )}
                {isRetail && (
                  <span className="text-[9.5px] font-extrabold bg-emerald-500/20 text-emerald-800 px-1.5 py-0.2 rounded shrink-0">
                    {t('Retail')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[10.5px] text-slate-500 truncate">
                {selectedCustomerObj ? (
                  <>
                    <span className="font-mono font-bold text-slate-700">{selectedCustomerObj.phone}</span>
                    {selectedCustomerObj.businessName && (
                      <span className="truncate">&bull; {selectedCustomerObj.businessName}</span>
                    )}
                  </>
                ) : (
                  <span>
                    {isWholesale 
                      ? t('Click to search or pick wholesale dealer') 
                      : (isExport ? t('Click to search or pick export client') : t('Click to search or pick retail customer'))}
                  </span>
                )}
              </div>
            </div>

            <ChevronDown size={15} className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
          </div>

          {/* Right Controls: Lock Status + Quick Add */}
          <div className="flex items-center gap-1 shrink-0">
            {selectedCustomerObj && (
              <button
                type="button"
                onClick={isLocked ? handleUnlock : () => setIsLocked && setIsLocked(true)}
                className={`p-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  isLocked 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' 
                    : 'bg-white text-slate-600 border-slate-300 hover:text-amber-700'
                }`}
                title={isLocked ? t('Order is locked with this customer. Click to unlock.') : t('Lock order to this customer')}
              >
                {isLocked ? <Lock size={13} className="text-emerald-600" /> : <Unlock size={13} />}
                <span className="text-[10px] hidden sm:inline">{isLocked ? t('Locked') : t('Lock')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="p-1.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              title={isWholesale ? t('Register a new dealer on the fly') : (isExport ? t('Register a new export client') : t('Register a new customer'))}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="text-[10px] hidden sm:inline">
                {isWholesale ? t('New Dealer') : (isExport ? t('New Client') : t('New Customer'))}
              </span>
            </button>
          </div>
        </div>

        {/* Lock Timestamp Display */}
        {isLocked && lockedTimestamp && (
          <div className="flex items-center gap-1 mt-1 pt-1 border-t border-amber-500/20 text-[10px] text-amber-900 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('Locked at:')}</span>
            <span className="font-mono text-emerald-800">{lockedTimestamp}</span>
          </div>
        )}
      </div>

      {/* DROPDOWN MENU */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E8DCCB] rounded-2xl shadow-2xl z-[999] overflow-hidden animate-slide-up flex flex-col max-h-72">
          {/* Search & Filter Header */}
          <div className="p-2.5 bg-[#F7EFE2] border-b border-[#E8DCCB] space-y-1.5 shrink-0">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder={isWholesale ? t('Search dealer by Name, Phone, Shop...') : (isExport ? t('Search client by Name, Phone, Place...') : t('Search customer by Name, Phone...'))}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sub-channel pills for Export */}
            {isExport && (
              <div className="flex gap-1">
                {[
                  { id: 'All', label: t('All Export') },
                  { id: 'Local', label: t('Local Dealer') },
                  { id: 'DAM', label: t('DAM Bulk') }
                ].map(pill => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setExportFilter(pill.id)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      exportFilter === pill.id
                        ? 'bg-sky-600 text-white border-sky-600 font-black'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* List Items */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#E8DCCB]/60 p-1">
            {filteredList.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Users size={22} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs font-bold">
                  {isWholesale ? t('No matching wholesale dealers found') : (isExport ? t('No matching export clients found') : t('No matching retail customers found'))}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowQuickAdd(true);
                  }}
                  className="mt-2 text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
                >
                  {isWholesale ? t('+ Quick Register This Dealer') : (isExport ? t('+ Quick Register This Client') : t('+ Quick Register This Customer'))}
                </button>
              </div>
            ) : (
              filteredList.map((cust) => {
                const cleanPhone = String(cust.phone || '').replace(/\D/g, '').slice(-10);
                const selectedClean = String(customerPhone || '').replace(/\D/g, '').slice(-10);
                const isSelected = cleanPhone && selectedClean && cleanPhone === selectedClean;
                return (
                  <div
                    key={cust._id || cust.phone}
                    onClick={() => handleSelect(cust)}
                    className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                      isSelected ? 'bg-amber-500/15 font-bold' : 'hover:bg-[#F5E8D8]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {cust.photo ? (
                        <img
                          src={cust.photo}
                          alt={cust.name}
                          className="w-9 h-9 rounded-full object-cover border border-[#E8DCCB] shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                          {(cust.name || 'C').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs sm:text-[13px] font-bold text-slate-800 truncate">{cust.name}</span>
                          {cust.exportSubCategory && (
                            <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-1 rounded">
                              {cust.exportSubCategory}
                            </span>
                          )}
                          {cust.category && (
                            <span className={`text-[8.5px] font-bold px-1 rounded ${
                              cust.category === 'Wholesale' ? 'bg-amber-100 text-amber-800' : (cust.category === 'Export' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800')
                            }`}>
                              {cust.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                          <span className="font-mono font-bold text-slate-700">{cust.phone}</span>
                          {cust.businessName && <span className="truncate">&bull; {cust.businessName}</span>}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={16} className="text-amber-700 font-black shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* QUICK ADD DEALER / CUSTOMER MODAL */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white border border-[#E8DCCB] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up flex flex-col">
            <div className="p-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 text-[#ea580c] rounded-xl">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">
                    {isWholesale ? t('Quick Register Dealer') : (isExport ? t('Quick Register Export Client') : t('Quick Register Retail Customer'))}
                  </h3>
                  <p className="text-[10px] text-slate-500">{t('Available instantly for billing lock')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="p-4 space-y-3">
              {/* Photo Upload Thumbnail */}
              <div className="flex items-center gap-3 bg-[#FDFBF7] p-2.5 rounded-2xl border border-[#E8DCCB]">
                {quickAddData.photo ? (
                  <img
                    src={quickAddData.photo}
                    alt="Customer / Dealer"
                    onClick={() => {
                      setCropperSrc(quickAddData.photo);
                      setShowCropper(true);
                    }}
                    title={t("Click to crop photo")}
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#ea580c] shrink-0 cursor-pointer hover:opacity-85 transition-opacity"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                    <Camera size={18} />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
                    >
                      {quickAddData.photo ? t('Change Photo') : t('+ Upload Photo')}
                    </button>
                    {quickAddData.photo && (
                      <button
                        type="button"
                        onClick={() => {
                          setCropperSrc(quickAddData.photo);
                          setShowCropper(true);
                        }}
                        title={t("Crop current photo")}
                        className="px-2 py-0.5 bg-orange-100 hover:bg-orange-200 text-[#ea580c] border border-orange-300 rounded-lg text-[10.5px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                      >
                        <Crop size={11} />
                        <span>{t("Crop")}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">{t('Auto-cropped to circle')}</p>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {t('Phone (10 Digits) *')}
                </label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={quickAddData.phone}
                  onChange={(e) => setQuickAddData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                  className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-sm font-bold text-slate-800 font-mono focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {isWholesale ? t('Dealer Name *') : (isExport ? t('Client Name *') : t('Customer Name *'))}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isWholesale ? 'e.g. Saif Traders' : (isExport ? 'e.g. Hyderabad Coastal Traders' : 'e.g. Anand Reddy')}
                  value={quickAddData.name}
                  onChange={(e) => setQuickAddData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Shop / Business Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {isWholesale || isExport ? t('Shop / Business Name (Optional)') : t('Address / Landmark (Optional)')}
                </label>
                <input
                  type="text"
                  placeholder={isWholesale ? 'e.g. Royal Fish Traders' : (isExport ? 'e.g. Cold Storage Facility' : 'e.g. Market Road, Kadapa')}
                  value={quickAddData.businessName}
                  onChange={(e) => setQuickAddData(prev => ({ ...prev, businessName: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAdd(false)}
                  className="flex-1 py-2 border border-[#E8DCCB] bg-[#F7EFE2] text-slate-700 rounded-xl font-bold text-xs hover:bg-[#F5E8D8] cursor-pointer"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 py-2 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {quickAddLoading ? <Loader2 size={14} className="animate-spin" /> : <span>{t('Save & Select')}</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Cropper for Quick Add */}
      {showCropper && (
        <ImageCropperModal
          imageSrc={cropperSrc}
          onCropComplete={(croppedBase64) => {
            setQuickAddData(prev => ({ ...prev, photo: croppedBase64 }));
            setShowCropper(false);
          }}
          onClose={() => setShowCropper(false)}
        />
      )}
    </div>
  );
}
