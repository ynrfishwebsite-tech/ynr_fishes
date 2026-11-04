import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  User, Users, Search, Check, Lock, Unlock, Plus, Phone, 
  MapPin, X, ChevronDown, Building, ArrowUpRight, Camera, Loader2 
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { getCachedCustomers, fetchPredefinedCustomers } from '../../../api/crm/customerApi';
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
  
  // Quick Add Modal State
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    name: '',
    phone: '',
    businessName: '',
    category: 'Wholesale',
    exportSubCategory: 'Local',
    address: '',
    photo: ''
  });
  const [showCropper, setShowCropper] = useState(false);
  const [cropperSrc, setCropperSrc] = useState('');
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);

  // Sync category mode with quick add default
  useEffect(() => {
    if (orderMode === 'bulk') {
      setQuickAddData(prev => ({ ...prev, category: 'Wholesale' }));
    } else if (orderMode === 'export') {
      setQuickAddData(prev => ({ ...prev, category: 'Export', exportSubCategory: 'Local' }));
    } else {
      setQuickAddData(prev => ({ ...prev, category: 'Retail' }));
    }
  }, [orderMode]);

  // Load predefined customers on mount and when orderMode changes
  const loadCustomers = () => {
    const targetCategory = orderMode === 'bulk' ? 'Wholesale' : (orderMode === 'export' ? 'Export' : 'All');
    const cached = getCachedCustomers(targetCategory);
    if (cached && cached.length > 0) {
      setCustomers(cached);
    }
    // Fetch fresh from backend
    fetchPredefinedCustomers(targetCategory).then(data => {
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    });
  };

  useEffect(() => {
    loadCustomers();
    // Listen for customer directory updates
    const handleUpdate = () => loadCustomers();
    window.addEventListener('customersUpdated', handleUpdate);
    return () => window.removeEventListener('customersUpdated', handleUpdate);
  }, [orderMode]);

  // Find currently selected customer object
  useEffect(() => {
    if (customerPhone) {
      const match = customers.find(c => c.phone === customerPhone);
      if (match) {
        setSelectedCustomerObj(match);
      } else {
        setSelectedCustomerObj({
          name: customerName || 'Selected Dealer',
          phone: customerPhone,
          category: orderMode === 'bulk' ? 'Wholesale' : (orderMode === 'export' ? 'Export' : 'Retail')
        });
      }
    } else {
      setSelectedCustomerObj(null);
    }
  }, [customerPhone, customerName, customers, orderMode]);

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

  // Filter list by channel and search
  const filteredList = useMemo(() => {
    const s = search.toLowerCase().trim();
    return customers.filter(c => {
      const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
      const sub = c.exportSubCategory || 'Local';

      // Match channel
      if (orderMode === 'bulk' && cat !== 'Wholesale') return false;
      if (orderMode === 'export') {
        if (cat !== 'Export') return false;
        if (exportFilter !== 'All' && sub !== exportFilter) return false;
      }

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
  }, [customers, orderMode, exportFilter, search]);

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
        category: quickAddData.category,
        exportSubCategory: quickAddData.category === 'Export' ? quickAddData.exportSubCategory : null,
        address: quickAddData.address,
        photo: quickAddData.photo,
        orderType: quickAddData.category
      };

      const res = await api.post('/customers', payload);
      if (res.data?.success && res.data.customer) {
        const newCust = res.data.customer;
        setCustomers(prev => [newCust, ...prev]);
        handleSelect(newCust);
        setShowQuickAdd(false);
        setQuickAddData({
          name: '',
          phone: '',
          businessName: '',
          category: orderMode === 'bulk' ? 'Wholesale' : (orderMode === 'export' ? 'Export' : 'Retail'),
          exportSubCategory: 'Local',
          address: '',
          photo: ''
        });
      }
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('Failed to register dealer'));
    } finally {
      setQuickAddLoading(false);
    }
  };

  const currentChannelTitle = orderMode === 'bulk' 
    ? t('Wholesale Dealers') 
    : (orderMode === 'export' ? t('Export Consignment Dealers') : t('Select Customer'));

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
      <div className={`p-2 rounded-2xl border transition-all ${
        selectedCustomerObj
          ? (isLocked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[#F7EFE2] border-[#E8DCCB]')
          : 'bg-[#FDFBF7] border-[#E8DCCB] hover:border-amber-400'
      }`}>
        <div className="flex items-center justify-between gap-2">
          {/* Customer Identity / Selector */}
          <div 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          >
            {selectedCustomerObj?.photo ? (
              <img
                src={selectedCustomerObj.photo}
                alt={selectedCustomerObj.name}
                className="w-8 h-8 rounded-full object-cover border border-amber-500/40 shadow-xs shrink-0"
              />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                selectedCustomerObj 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {selectedCustomerObj ? (selectedCustomerObj.name || 'D').charAt(0).toUpperCase() : <User size={15} />}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-slate-800 truncate">
                  {selectedCustomerObj?.name || (orderMode === 'bulk' ? t('Select Wholesale Dealer') : (orderMode === 'export' ? t('Select Export Dealer') : t('Select Customer')))}
                </span>
                {orderMode === 'bulk' && (
                  <span className="text-[9.5px] font-extrabold bg-amber-500/20 text-amber-800 px-1.5 py-0.2 rounded shrink-0">
                    {t('Wholesale')}
                  </span>
                )}
                {orderMode === 'export' && (
                  <span className="text-[9.5px] font-extrabold bg-sky-500/20 text-sky-800 px-1.5 py-0.2 rounded shrink-0">
                    {selectedCustomerObj?.exportSubCategory === 'DAM' ? t('Export DAM') : t('Export Local')}
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
                  <span>{t('Click to search or pick predefined customer')}</span>
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
              title={t('Register a new dealer on the fly')}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="text-[10px] hidden sm:inline">{t('New Dealer')}</span>
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
                placeholder={t('Search by Name, Phone (4 digits), Shop...')}
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
            {orderMode === 'export' && (
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
                <p className="text-xs font-bold">{t('No matching dealers found')}</p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowQuickAdd(true);
                  }}
                  className="mt-2 text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
                >
                  {t('+ Quick Register This Dealer')}
                </button>
              </div>
            ) : (
              filteredList.map((cust) => {
                const isSelected = cust.phone === customerPhone;
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
                          className="w-8 h-8 rounded-full object-cover border border-[#E8DCCB] shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                          {(cust.name || 'D').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 truncate">{cust.name}</span>
                          {cust.exportSubCategory && (
                            <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-1 rounded">
                              {cust.exportSubCategory}
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

      {/* QUICK ADD DEALER MODAL */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999999] flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white border border-[#E8DCCB] rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-slide-up flex flex-col">
            <div className="p-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 text-[#ea580c] rounded-xl">
                  <Plus size={16} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">{t('Quick Register Dealer')}</h3>
                  <p className="text-[10px] text-slate-500">{t('Available instantly for billing lock')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
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
                    alt="Dealer"
                    className="w-12 h-12 rounded-full object-cover border border-[#ea580c] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                    <Camera size={18} />
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer"
                  >
                    {quickAddData.photo ? t('Change Photo') : t('+ Upload Photo')}
                  </button>
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
                  {t('Dealer / Customer Name *')}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Reddy"
                  value={quickAddData.name}
                  onChange={(e) => setQuickAddData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Shop / Business Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {t('Shop Name (Optional)')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Royal Fish Traders"
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
                  className="flex-1 py-2 border border-[#E8DCCB] bg-[#F7EFE2] text-slate-700 rounded-xl font-bold text-xs hover:bg-[#F5E8D8]"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="flex-1 py-2 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl font-black text-xs shadow-md flex items-center justify-center gap-1.5"
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

