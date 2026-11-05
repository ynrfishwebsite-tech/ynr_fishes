import { getApiUrl, getSuperadminApiUrl } from "../../../config.js";
import { useLanguage } from "../../../context/LanguageContext";
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Search, Star, TrendingUp, Calendar, ChevronLeft, ChevronRight, 
  FileText, X, Loader2, Eye, Settings, ChevronDown, ChevronUp, Save, 
  CheckCircle2, Award, Coins, UserPlus, Edit2, Trash2, Phone, MapPin, 
  Camera, Building, ArrowUpRight, Check
} from 'lucide-react';
import BackButton from '../common/BackButton';
import Invoice from '../billing/Invoice';
import ImageCropperModal from './ImageCropperModal';
import { getBills, getBillById } from '../../../api/billing/billing';
import api from '../../../api/system/axios';
import { formatTime12 } from '../../../utils/formatters/timeFormat';

const CRM = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All'); // 'All' | 'Retail' | 'Wholesale' | 'Export - Local' | 'Export - DAM'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Customer Add / Edit Modal State
  const [customerModal, setCustomerModal] = useState({
    isOpen: false,
    isEdit: false,
    originalPhone: '',
    loading: false,
    data: {
      name: '',
      businessName: '',
      phone: '',
      category: 'Wholesale', // 'Retail' | 'Wholesale' | 'Export'
      exportSubCategory: 'Local', // 'Local' | 'DAM'
      address: {
        line1: '',
        area: '',
        city: 'Kadapa',
        district: 'YSR Kadapa',
        pincode: ''
      },
      photo: ''
    }
  });

  // Image Cropper Modal State
  const [cropperModal, setCropperModal] = useState({
    isOpen: false,
    imageSrc: ''
  });
  const fileInputRef = useRef(null);

  // Modal states for viewing bills
  const [billsModal, setBillsModal] = useState({ isOpen: false, customer: null, bills: [], loading: false, error: '' });
  const [billsPage, setBillsPage] = useState(1);
  const billsScrollRef = useRef(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBillId, setLoadingBillId] = useState(null);

  const [expandedFavorites, setExpandedFavorites] = useState({});
  const [vipSettingsOpen, setVipSettingsOpen] = useState(false);
  const [vipSettings, setVipSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('resto_vip_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { vipVisitThreshold: 5, vipSpendThreshold: 5000 };
  });
  const [fullSettings, setFullSettings] = useState({});
  const [savingVipSettings, setSavingVipSettings] = useState(false);

  const [adjustModal, setAdjustModal] = useState({
    isOpen: false,
    customer: null,
    action: 'add_points',
    amount: '',
    reason: '',
    loading: false
  });

  const handleAdjustLoyalty = async () => {
    if (!adjustModal.customer?.phone) return;
    const val = Math.abs(Number(adjustModal.amount) || 0);
    if (val <= 0) {
      alert(t('Please enter a valid amount greater than 0'));
      return;
    }
    setAdjustModal(prev => ({ ...prev, loading: true }));
    try {
      let pointsDelta = 0;
      let walletDelta = 0;
      if (adjustModal.action === 'add_points') pointsDelta = val;
      else if (adjustModal.action === 'deduct_points') pointsDelta = -val;
      else if (adjustModal.action === 'add_wallet') walletDelta = val;
      else if (adjustModal.action === 'deduct_wallet') walletDelta = -val;

      const res = await api.post('/loyalty/adjust', {
        phone: adjustModal.customer.phone,
        customerId: adjustModal.customer._id,
        pointsDelta: pointsDelta !== 0 ? pointsDelta : undefined,
        walletDelta: walletDelta !== 0 ? walletDelta : undefined,
        reason: adjustModal.reason
      });

      if (res.data?.customer) {
        setCustomers(prev => prev.map(c =>
          (c._id === adjustModal.customer._id || c.phone === adjustModal.customer.phone)
            ? { ...c, points: res.data.customer.points, walletBalance: res.data.customer.walletBalance }
            : c
        ));
      }
      setAdjustModal({ isOpen: false, customer: null, action: 'add_points', amount: '', reason: '', loading: false });
    } catch (err) {
      console.error('Error adjusting loyalty:', err);
      alert(err.response?.data?.message || t('Failed to adjust loyalty balance'));
      setAdjustModal(prev => ({ ...prev, loading: false }));
    }
  };

  const toggleFavorites = (customerId) => {
    setExpandedFavorites(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }));
  };

  const loadVipSettings = async () => {
    try {
      const res = await api.get('/config/info');
      const backendSettings = res.data?.restaurantSettings || res.data || {};
      setFullSettings(backendSettings);

      const visits = (backendSettings.vipVisitThreshold !== undefined && backendSettings.vipVisitThreshold !== null && backendSettings.vipVisitThreshold !== '')
        ? Number(backendSettings.vipVisitThreshold)
        : 5;
      const spend = (backendSettings.vipSpendThreshold !== undefined && backendSettings.vipSpendThreshold !== null && backendSettings.vipSpendThreshold !== '')
        ? Number(backendSettings.vipSpendThreshold)
        : 5000;

      const newVip = {
        vipVisitThreshold: visits,
        vipSpendThreshold: spend
      };

      setVipSettings(newVip);
      localStorage.setItem('resto_vip_settings', JSON.stringify(newVip));
    } catch (err) {
      console.error('Failed to load VIP settings', err);
    }
  };

  const saveVipSettings = async () => {
    setSavingVipSettings(true);
    try {
      const visitVal = (vipSettings.vipVisitThreshold !== undefined && vipSettings.vipVisitThreshold !== '' && !isNaN(Number(vipSettings.vipVisitThreshold)))
        ? Math.max(1, Number(vipSettings.vipVisitThreshold))
        : 5;
      const spendVal = (vipSettings.vipSpendThreshold !== undefined && vipSettings.vipSpendThreshold !== '' && !isNaN(Number(vipSettings.vipSpendThreshold)))
        ? Math.max(0, Number(vipSettings.vipSpendThreshold))
        : 5000;

      const cleanVip = {
        vipVisitThreshold: visitVal,
        vipSpendThreshold: spendVal
      };

      await api.post('/config/info', { restaurantSettings: cleanVip });

      setVipSettings(cleanVip);
      localStorage.setItem('resto_vip_settings', JSON.stringify(cleanVip));

      try {
        const storedResto = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
        const updatedResto = { ...storedResto, ...cleanVip };
        localStorage.setItem('restaurantSettings', JSON.stringify(updatedResto));
        window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: updatedResto }));
      } catch (e) {}

      setVipSettingsOpen(false);
    } catch (err) {
      console.error('Save VIP settings failed:', err);
      alert(t('Failed to save VIP settings. Please check your connection and try again.'));
    } finally {
      setSavingVipSettings(false);
    }
  };

  const isCustomerVIP = (customer) => {
    const visits = (vipSettings.vipVisitThreshold !== undefined && vipSettings.vipVisitThreshold !== '' && !isNaN(Number(vipSettings.vipVisitThreshold)))
      ? Number(vipSettings.vipVisitThreshold)
      : 5;
    const spend = (vipSettings.vipSpendThreshold !== undefined && vipSettings.vipSpendThreshold !== '' && !isNaN(Number(vipSettings.vipSpendThreshold)))
      ? Number(vipSettings.vipSpendThreshold)
      : 5000;
    return (customer.totalVisits || 0) >= visits || (customer.totalSpend || 0) >= spend;
  };

  const fetchCustomers = async () => {
    try {
      const cached = localStorage.getItem('resto_crm_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomers(parsed);
          setLoading(false);
        }
      }
    } catch (e) {}

    try {
      const API_BASE_URL = getApiUrl();
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
        localStorage.setItem('resto_crm_cache', JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVipSettings();
    fetchCustomers();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  // Handle Photo Picker
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropperModal({
        isOpen: true,
        imageSrc: reader.result
      });
    };
    reader.readAsDataURL(file);
    // Reset file input value so re-selecting same image works
    e.target.value = '';
  };

  const handleOpenAddCustomer = () => {
    setCustomerModal({
      isOpen: true,
      isEdit: false,
      originalPhone: '',
      loading: false,
      data: {
        name: '',
        businessName: '',
        phone: '',
        category: filterType === 'Retail' ? 'Retail' : (filterType.startsWith('Export') ? 'Export' : 'Wholesale'),
        exportSubCategory: filterType === 'Export - DAM' ? 'DAM' : 'Local',
        address: {
          line1: '',
          area: '',
          city: 'Kadapa',
          district: 'YSR Kadapa',
          pincode: ''
        },
        photo: ''
      }
    });
  };

  const handleOpenEditCustomer = (cust) => {
    const addr = cust.address || {};
    setCustomerModal({
      isOpen: true,
      isEdit: true,
      originalPhone: cust.phone,
      loading: false,
      data: {
        name: cust.name || '',
        businessName: cust.businessName || '',
        phone: cust.phone || '',
        category: cust.category || (cust.lastOrderType === 'Wholesale' ? 'Wholesale' : (cust.lastOrderType === 'Export' ? 'Export' : 'Retail')),
        exportSubCategory: cust.exportSubCategory || 'Local',
        address: {
          line1: addr.line1 || (typeof cust.address === 'string' ? cust.address : ''),
          area: addr.area || '',
          city: addr.city || 'Kadapa',
          district: addr.district || 'YSR Kadapa',
          pincode: addr.pincode || ''
        },
        photo: cust.photo || ''
      }
    });
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    const { name, phone, businessName, category, exportSubCategory, address, photo } = customerModal.data;
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      alert(t('Please enter a valid 10-digit phone number.'));
      return;
    }

    setCustomerModal(prev => ({ ...prev, loading: true }));
    try {
      const payload = {
        name: (name || 'Guest').trim(),
        businessName: (businessName || '').trim(),
        phone: cleanPhone,
        category,
        exportSubCategory: category === 'Export' ? exportSubCategory : null,
        address,
        photo,
        orderType: category
      };

      const res = await api.post('/customers', payload);
      if (res.data?.success && res.data.customer) {
        const updated = res.data.customer;
        setCustomers(prev => {
          const exists = prev.some(c => c.phone === cleanPhone);
          const next = exists
            ? prev.map(c => c.phone === cleanPhone ? { ...c, ...updated } : c)
            : [updated, ...prev];
          localStorage.setItem('resto_crm_cache', JSON.stringify(next));
          return next;
        });

        // Broadcast storage event for billing pre-cached customers
        try {
          window.dispatchEvent(new CustomEvent('customersUpdated', { detail: updated }));
        } catch {}

        setCustomerModal(prev => ({ ...prev, isOpen: false, loading: false }));
      }
    } catch (err) {
      console.error('Error saving customer:', err);
      alert(err.response?.data?.message || t('Failed to save customer. Please try again.'));
      setCustomerModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteCustomer = async (customer) => {
    if (!customer.phone) return;
    const confirmDelete = window.confirm(
      t(`Are you sure you want to delete "${customer.name || customer.phone}" from the directory?`)
    );
    if (!confirmDelete) return;

    try {
      await api.delete(`/customers/${customer.phone}`);
      setCustomers(prev => {
        const next = prev.filter(c => c.phone !== customer.phone);
        localStorage.setItem('resto_crm_cache', JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error('Error deleting customer:', err);
      alert(err.response?.data?.message || t('Failed to delete customer'));
    }
  };

  // Filter Customers
  const filteredCustomers = customers.filter((c) => {
    const s = searchTerm.toLowerCase().trim();
    const fullAddr = typeof c.address === 'string' ? c.address : `${c.address?.line1 || ''} ${c.address?.city || ''} ${c.address?.district || ''}`;
    const matchesSearch =
      !s ||
      (c.name && c.name.toLowerCase().includes(s)) ||
      (c.phone && c.phone.includes(s)) ||
      (c.businessName && c.businessName.toLowerCase().includes(s)) ||
      fullAddr.toLowerCase().includes(s);

    if (!matchesSearch) return false;
    if (filterType === 'All') return true;

    const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
    const subCat = c.exportSubCategory || 'Local';

    if (filterType === 'Retail') return cat === 'Retail';
    if (filterType === 'Wholesale') return cat === 'Wholesale';
    if (filterType === 'Export - Local') return cat === 'Export' && subCat === 'Local';
    if (filterType === 'Export - DAM') return cat === 'Export' && subCat === 'DAM';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredCustomers.length);
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Category Badge Render Helper
  const getCategoryBadge = (customer) => {
    const cat = customer.category || (customer.lastOrderType === 'Wholesale' ? 'Wholesale' : (customer.lastOrderType === 'Export' ? 'Export' : 'Retail'));
    const subCat = customer.exportSubCategory || 'Local';

    if (cat === 'Wholesale') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold bg-amber-500/10 text-amber-700 border border-amber-500/25 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {t('Wholesale (Boxes)')}
        </span>
      );
    }
    if (cat === 'Export') {
      if (subCat === 'DAM') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold bg-sky-500/10 text-sky-700 border border-sky-500/25 whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            {t('Export (DAM Bulk)')}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold bg-purple-500/10 text-purple-700 border border-purple-500/25 whitespace-nowrap shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {t('Export (Local Dealer)')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold bg-emerald-500/10 text-emerald-700 border border-emerald-500/25 whitespace-nowrap shadow-2xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {t('Retail (Walk-in)')}
      </span>
    );
  };

  const handleViewBills = async (customer) => {
    if (!customer.phone) return;
    setBillsPage(1);
    setBillsModal({ isOpen: true, customer, bills: [], loading: true, error: '' });
    try {
      const data = await getBills({ limit: 500, search: customer.phone });
      let customerBills = [];
      if (Array.isArray(data)) {
        customerBills = data;
      } else if (data && data.bills) {
        customerBills = data.bills;
      }
      customerBills = customerBills.filter(b => b.customerPhone === customer.phone);
      setBillsModal(prev => ({ ...prev, bills: customerBills, loading: false }));
    } catch (err) {
      console.error('Error fetching customer bills:', err);
      setBillsModal(prev => ({ ...prev, loading: false, error: 'Failed to fetch bills' }));
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-background">
        <div className="flex flex-col items-center justify-center gap-3 bg-surface p-8 rounded-3xl border border-border shadow-xl max-w-xs sm:max-w-sm w-full text-center animate-fade-in">
          <div className="relative flex items-center justify-center my-2">
            <div className="w-14 h-14 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <Users size={22} className="text-primary absolute animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-text-main">{t("Loading Customer Directory")}</h3>
            <p className="text-xs text-text-muted mt-1">{t("Fetching customer profiles, channels & photos...")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full shrink-0 flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 pb-24 touch-pan-y">
      {/* Hidden File Input for Image Cropper */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between mb-2 sm:mb-2.5 gap-2 bg-surface p-2 sm:p-2.5 rounded-2xl border border-border shrink-0 shadow-2xs">
        {/* Row 1: Back + Title + Filter Pills + Add Customer */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 w-full xl:w-auto shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-primary/10 text-primary rounded-xl">
                <Users size={18} />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm font-black text-text-main whitespace-nowrap">
                  {t("CUSTOMER & DEALER DIRECTORY")}
                </h1>
                <p className="text-[10px] text-text-muted font-medium">
                  {t("Retail, Wholesale & Export Customer Management")}
                </p>
              </div>
            </div>
          </div>

          {/* Depot Filter Pills */}
          <div className="flex bg-background p-0.5 rounded-xl border border-border shrink-0 overflow-x-auto no-scrollbar">
            {[
              { id: 'All', label: t('All') },
              { id: 'Retail', label: t('Retail (Kg)') },
              { id: 'Wholesale', label: t('Wholesale') },
              { id: 'Export - Local', label: t('Export (Local)') },
              { id: 'Export - DAM', label: t('Export (DAM)') }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filterType === tab.id
                    ? 'bg-primary text-white shadow-xs font-black'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Search + Add Customer Button + Pagination */}
        <div className="flex items-center gap-1.5 sm:gap-2 w-full xl:w-auto flex-1 xl:flex-initial min-w-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0 xl:w-56">
            <input
              type="text"
              placeholder={t("Search Name, Phone, Shop, City...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-2.5 py-1.5 pl-7 text-[11px] sm:text-xs focus:outline-none focus:border-primary text-text-main placeholder:text-text-muted font-medium" 
            />
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" size={13} />
          </div>

          {/* Add Customer Button */}
          <button
            type="button"
            onClick={handleOpenAddCustomer}
            className="flex items-center gap-1.5 bg-gradient-to-r from-primary to-orange-600 hover:from-primary-hover hover:to-orange-500 text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0 active:scale-95"
          >
            <UserPlus size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">{t("Add Customer")}</span>
            <span className="sm:hidden">{t("+ Add")}</span>
          </button>

          {/* Pagination */}
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-xl px-1.5 py-1 shrink-0 shadow-2xs">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-0.5 rounded text-text-muted hover:text-text-main disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] font-bold text-text-muted px-1 font-mono">
              {currentPage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-0.5 rounded text-text-muted hover:text-text-main disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2 sm:mb-2.5 shrink-0">
        <div className="bg-surface border border-border rounded-2xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("Total Registered")}</span>
            <div className="text-base sm:text-lg font-black text-text-main mt-0.5">{customers.length}</div>
          </div>
          <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
            <Users size={16} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("Wholesale Dealers")}</span>
            <div className="text-base sm:text-lg font-black text-amber-600 mt-0.5">
              {customers.filter(c => (c.category || c.lastOrderType) === 'Wholesale').length}
            </div>
          </div>
          <div className="p-2 bg-amber-500/10 text-amber-600 rounded-xl">
            <Building size={16} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("Export Consignments")}</span>
            <div className="text-base sm:text-lg font-black text-sky-600 mt-0.5">
              {customers.filter(c => (c.category || c.lastOrderType) === 'Export').length}
            </div>
          </div>
          <div className="p-2 bg-sky-500/10 text-sky-600 rounded-xl">
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{t("Retail Walk-in")}</span>
            <div className="text-base sm:text-lg font-black text-emerald-600 mt-0.5">
              {customers.filter(c => (!c.category && (!c.lastOrderType || c.lastOrderType === 'Retail' || c.lastOrderType === 'Dine-In')) || c.category === 'Retail').length}
            </div>
          </div>
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <TrendingUp size={16} />
          </div>
        </div>
      </div>

      {/* Main Table (Desktop / Tablet) */}
      <div className="hidden md:block flex-1 bg-surface rounded-2xl border border-border shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background/80 sticky top-0 z-10 backdrop-blur-xs">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">{t("Customer / Dealer")}</th>
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">{t("Phone")}</th>
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">{t("Channel / Category")}</th>
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">{t("Address")}</th>
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider text-center">{t("Visits")}</th>
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">{t("Total Spend")}</th>
                <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider text-center">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-text-muted">
                    <Users size={32} className="mx-auto text-text-muted/40 mb-2" />
                    <p className="font-bold text-sm">{t("No customers found")}</p>
                    <p className="text-xs text-text-muted mt-1">{t("Try adjusting your filter or search terms")}</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((cust) => {
                  const addr = cust.address || {};
                  const addrString = typeof cust.address === 'string'
                    ? cust.address
                    : [addr.line1, addr.city, addr.district].filter(Boolean).join(', ');

                  return (
                    <tr key={cust._id || cust.phone} className="hover:bg-background/40 transition-colors h-12">
                      {/* Name & Photo */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {cust.photo ? (
                            <img
                              src={cust.photo}
                              alt={cust.name}
                              className="w-8 h-8 rounded-full object-cover border border-border shadow-xs shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-orange-500/20 text-primary font-black text-xs flex items-center justify-center shrink-0 border border-primary/20">
                              {(cust.name || 'G').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-text-main truncate max-w-[150px]">
                                {cust.name || 'Guest'}
                              </span>
                              {isCustomerVIP(cust) && (
                                <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider shrink-0">
                                  {t("VIP")}
                                </span>
                              )}
                            </div>
                            {cust.businessName && (
                              <p className="text-[10px] text-text-muted truncate max-w-[150px]">
                                {cust.businessName}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-2 font-mono text-text-main font-bold whitespace-nowrap">
                        {cust.phone}
                      </td>

                      {/* Channel Badge */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {getCategoryBadge(cust)}
                      </td>

                      {/* Address */}
                      <td className="px-3 py-2 text-text-muted truncate max-w-[180px]" title={addrString}>
                        {addrString ? (
                          <div className="flex items-center gap-1">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{addrString}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">--</span>
                        )}
                      </td>

                      {/* Visits */}
                      <td className="px-3 py-2 text-center font-bold text-text-main whitespace-nowrap">
                        {cust.totalVisits || 0}
                      </td>

                      {/* Total Spend */}
                      <td className="px-3 py-2 text-right font-black text-emerald-600 font-mono whitespace-nowrap">
                        ₹{(cust.totalSpend || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCustomer(cust)}
                            className="p-1.5 text-text-muted hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
                            title={t("Edit Customer Profile & Photo")}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleViewBills(cust)}
                            className="p-1.5 text-text-muted hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={t("View Invoices")}
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomer(cust)}
                            className="p-1.5 text-text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={t("Delete Customer")}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2 pb-4">
        {filteredCustomers.length === 0 ? (
          <div className="p-8 text-center text-text-muted bg-surface rounded-2xl border border-border">
            <Users size={32} className="mx-auto text-text-muted/40 mb-2" />
            <p className="font-bold text-sm">{t("No customers found")}</p>
          </div>
        ) : (
          paginatedCustomers.map((cust) => {
            const addr = cust.address || {};
            const addrString = typeof cust.address === 'string'
              ? cust.address
              : [addr.line1, addr.city, addr.district].filter(Boolean).join(', ');

            return (
              <div key={cust._id || cust.phone} className="bg-surface rounded-2xl border border-border p-3 shadow-2xs space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {cust.photo ? (
                      <img
                        src={cust.photo}
                        alt={cust.name}
                        className="w-10 h-10 rounded-full object-cover border border-border shadow-xs shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0 border border-primary/20">
                        {(cust.name || 'G').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-text-main text-xs sm:text-sm truncate">
                          {cust.name || 'Guest'}
                        </span>
                        {isCustomerVIP(cust) && (
                          <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase">
                            {t("VIP")}
                          </span>
                        )}
                      </div>
                      {cust.businessName && (
                        <p className="text-[10px] text-text-muted truncate">{cust.businessName}</p>
                      )}
                      <p className="text-[11px] font-mono text-text-muted font-bold">{cust.phone}</p>
                    </div>
                  </div>

                  <span className="text-xs font-black text-emerald-600 font-mono shrink-0">
                    ₹{(cust.totalSpend || 0).toFixed(0)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div>{getCategoryBadge(cust)}</div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditCustomer(cust)}
                      className="p-1.5 bg-background border border-border rounded-lg text-slate-700 hover:text-primary transition-colors cursor-pointer"
                      title={t("Edit")}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewBills(cust)}
                      className="p-1.5 bg-background border border-border rounded-lg text-slate-700 hover:text-blue-600 transition-colors cursor-pointer"
                      title={t("Bills")}
                    >
                      <FileText size={13} />
                    </button>
                  </div>
                </div>

                {addrString && (
                  <div className="flex items-center gap-1 text-[10.5px] text-text-muted pt-0.5">
                    <MapPin size={10} className="text-slate-400 shrink-0" />
                    <span className="truncate">{addrString}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {customerModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white border border-[#E8DCCB] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 border border-orange-200 text-[#ea580c] rounded-2xl shadow-xs">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">
                    {customerModal.isEdit ? t("Edit Customer Profile") : t("Register New Customer / Dealer")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {t("Specify channel, phone, address and dealer photo")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCustomer} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Photo Selector with Image Cropper Trigger */}
              <div className="flex items-center gap-3.5 bg-[#FDFBF7] p-3 rounded-2xl border border-[#E8DCCB]">
                <div className="relative group shrink-0">
                  {customerModal.data.photo ? (
                    <img
                      src={customerModal.data.photo}
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover border-2 border-[#ea580c] shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                      <Camera size={20} />
                      <span className="text-[9px] font-bold mt-0.5">{t("Photo")}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-[#ea580c] text-white rounded-full shadow-md hover:bg-[#c2410c] transition-all cursor-pointer"
                    title={t("Upload & Crop Photo")}
                  >
                    <Camera size={12} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-800">{t("Dealer Photo / Identity")}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {t("Upload dealer or shop photo with interactive cropping")}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1.5 text-[11px] font-bold text-[#ea580c] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    {customerModal.data.photo ? t("Change / Re-crop Photo") : t("+ Upload & Crop")}
                  </button>
                </div>
              </div>

              {/* Channel / Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  {t("Market Category / Channel *")}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'Retail', label: t('Retail (Walk-in)') },
                    { id: 'Wholesale', label: t('Wholesale') },
                    { id: 'Export', label: t('Export (Bulk)') }
                  ].map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCustomerModal(prev => ({
                        ...prev,
                        data: { ...prev.data, category: cat.id }
                      }))}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        customerModal.data.category === cat.id
                          ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-xs font-black'
                          : 'bg-[#F7EFE2] text-slate-700 border-[#E8DCCB] hover:bg-[#F5E8D8]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Subcategory if Export is chosen */}
                {customerModal.data.category === 'Export' && (
                  <div className="mt-2.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl space-y-1 animate-fade-in">
                    <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                      {t("Export Sub-Category (Destination Type)")}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomerModal(prev => ({
                          ...prev,
                          data: { ...prev.data, exportSubCategory: 'Local' }
                        }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          customerModal.data.exportSubCategory === 'Local'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-blue-800 border-blue-200'
                        }`}
                      >
                        {t("Local Transport Dealer")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerModal(prev => ({
                          ...prev,
                          data: { ...prev.data, exportSubCategory: 'DAM' }
                        }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          customerModal.data.exportSubCategory === 'DAM'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-blue-800 border-blue-200'
                        }`}
                      >
                        {t("DAM (Inter-State Bulk)")}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t("Phone Number (10 Digits) *")}
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={customerModal.data.phone}
                    onChange={(e) => setCustomerModal(prev => ({
                      ...prev,
                      data: { ...prev.data, phone: e.target.value.replace(/\D/g, '') }
                    }))}
                    className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-sm font-bold text-slate-800 font-mono focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    {t("Customer Name *")}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Reddy"
                    value={customerModal.data.name}
                    onChange={(e) => setCustomerModal(prev => ({
                      ...prev,
                      data: { ...prev.data, name: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                  />
                </div>
              </div>

              {/* Business / Shop Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  {t("Shop / Transport Agency Name (Optional)")}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sri Balaji Fish Traders / Kadapa Transport"
                  value={customerModal.data.businessName}
                  onChange={(e) => setCustomerModal(prev => ({
                    ...prev,
                    data: { ...prev.data, businessName: e.target.value }
                  }))}
                  className="w-full px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              {/* Address Section */}
              <div className="space-y-2 pt-1 border-t border-[#E8DCCB]">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {t("Address Details")}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={t("Door / Street / Area")}
                    value={customerModal.data.address.line1}
                    onChange={(e) => setCustomerModal(prev => ({
                      ...prev,
                      data: {
                        ...prev.data,
                        address: { ...prev.data.address, line1: e.target.value }
                      }
                    }))}
                    className="w-full px-3 py-1.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                  />
                  <input
                    type="text"
                    placeholder={t("City / Town (e.g. Kadapa)")}
                    value={customerModal.data.address.city}
                    onChange={(e) => setCustomerModal(prev => ({
                      ...prev,
                      data: {
                        ...prev.data,
                        address: { ...prev.data.address, city: e.target.value }
                      }
                    }))}
                    className="w-full px-3 py-1.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                  />
                  <input
                    type="text"
                    placeholder={t("District (e.g. YSR Kadapa)")}
                    value={customerModal.data.address.district}
                    onChange={(e) => setCustomerModal(prev => ({
                      ...prev,
                      data: {
                        ...prev.data,
                        address: { ...prev.data.address, district: e.target.value }
                      }
                    }))}
                    className="w-full px-3 py-1.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                  />
                  <input
                    type="text"
                    placeholder={t("Pincode")}
                    maxLength={6}
                    value={customerModal.data.address.pincode}
                    onChange={(e) => setCustomerModal(prev => ({
                      ...prev,
                      data: {
                        ...prev.data,
                        address: { ...prev.data.address, pincode: e.target.value }
                      }
                    }))}
                    className="w-full px-3 py-1.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomerModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 border border-[#E8DCCB] bg-[#F7EFE2] text-slate-700 rounded-xl font-bold text-xs hover:bg-[#F5E8D8] transition-colors cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={customerModal.loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  {customerModal.loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>{t("Saving...")}</span>
                    </>
                  ) : (
                    <span>{customerModal.isEdit ? t("Update Customer") : t("Register Customer")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE CROPPER MODAL */}
      {cropperModal.isOpen && (
        <ImageCropperModal
          imageSrc={cropperModal.imageSrc}
          onCropComplete={(croppedBase64) => {
            setCustomerModal(prev => ({
              ...prev,
              data: { ...prev.data, photo: croppedBase64 }
            }));
            setCropperModal({ isOpen: false, imageSrc: '' });
          }}
          onClose={() => setCropperModal({ isOpen: false, imageSrc: '' })}
        />
      )}

      {/* Bills Modal */}
      {billsModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-3">
          <div className="bg-surface rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-border flex justify-between items-center bg-[#FDFBF7]">
              <div>
                <h3 className="font-extrabold text-sm text-text-main">{t("Customer Invoices")}</h3>
                <p className="text-[11px] text-text-muted">{billsModal.customer?.name} ({billsModal.customer?.phone})</p>
              </div>
              <button
                type="button"
                onClick={() => setBillsModal({ isOpen: false, customer: null, bills: [], loading: false, error: '' })}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {billsModal.loading ? (
                <div className="py-12 text-center text-text-muted">
                  <Loader2 size={24} className="animate-spin mx-auto text-primary mb-2" />
                  <p className="text-xs">{t("Loading bills...")}</p>
                </div>
              ) : billsModal.bills.length === 0 ? (
                <div className="py-12 text-center text-text-muted">
                  <FileText size={24} className="mx-auto text-text-muted/40 mb-2" />
                  <p className="text-xs">{t("No bills found for this customer.")}</p>
                </div>
              ) : (
                billsModal.bills.map(b => (
                  <div key={b._id} className="p-3 bg-background rounded-2xl border border-border flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-text-main">Bill #{b.billNumber || b._id?.slice(-5)}</div>
                      <div className="text-[10px] text-text-muted">{new Date(b.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-600 font-mono">₹{b.total?.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const full = await getBillById(b._id);
                            setSelectedBill(full);
                          } catch {}
                        }}
                        className="px-2.5 py-1 bg-surface border border-border rounded-xl text-xs font-bold hover:text-primary transition-colors cursor-pointer"
                      >
                        {t("View")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Viewer */}
      {selectedBill && (
        <Invoice
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}
    </div>
  );
};

export default CRM;
