import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import {
  Users, Search, Plus, Phone, Truck, Anchor, MapPin, Building,
  CreditCard, FileText, Edit2, Trash2, X, Check, Loader2, MessageSquare,
  RefreshCw, ChevronLeft, ChevronRight, Upload, Image as ImageIcon,
  Crop, User, DollarSign, Wallet, AlertTriangle, AlertCircle, CheckCircle,
  TrendingUp, Award, Clock, ArrowDownLeft, Boxes, Scale, Send, ChevronDown,
  Printer, ArrowUpRight, ShieldCheck, Eye, ExternalLink, Calendar
} from 'lucide-react';
import BackButton from '../common/BackButton';
import SearchableDropdown from '../../common/SearchableDropdown';
import Toast from '../system/Toast';
import ImageCropperModal from '../crm/ImageCropperModal';
import FishInwardInvoice from '../inventory/FishInwardInvoice';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../../api/operations/operations';
import { getVehicles, updateVehicle } from '../../../api/operations/vehicle';
import { getInventoryLogs } from '../../../api/inventory/inventory';
import { getSupplyLogs } from '../../../api/operations/supplies';
import api from '../../../api/system/axios';

export default function SupplierHub({
  channel = 'All', // 'All' | 'Local' | 'DAM' | 'Consumables'
  initialTab = 'srm', // 'srm' | 'khata' | 'vouchers'
  user,
  onNavigate,
  onGoBack
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  // Channel classification
  const isAll = channel === 'All';
  const isLocal = channel === 'Local';
  const isDam = channel === 'DAM';
  const isSupplies = channel === 'Consumables' || channel === 'supplies';

  const channelTitle = isLocal
    ? t('Local Fishermen Hub')
    : isDam
    ? t('Dam Contractors Hub')
    : isSupplies
    ? t('Depot Supplies & Vendors Hub')
    : t('Supplier Management Hub (SRM)');

  const channelSubtitle = isLocal
    ? t('Harbor Catch Landings • Fishermen Khata • Inward Catch Vouchers')
    : isDam
    ? t('Reservoir Syndicates • Dam Khata • Consignment Vouchers')
    : isSupplies
    ? t('Packaging, Ice & Depot Vendors • Supplier Khata • Inward Invoices')
    : t('All Procurement Sources • Supplier Khata Ledger • Inward Catch Vouchers');

  const personRole = isLocal ? t('Fisherman') : isDam ? t('Contractor') : isSupplies ? t('Vendor') : t('Supplier');
  const personRolePlural = isLocal ? t('Fishermen') : isDam ? t('Contractors') : isSupplies ? t('Vendors') : t('Suppliers');

  // Core Data States
  const [suppliers, setSuppliers] = useState([]);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [inwardLogs, setInwardLogs] = useState([]);
  const [supplyLogs, setSupplyLogs] = useState([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(channel);
  useEffect(() => {
    setTypeFilter(channel);
  }, [channel]);

  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'spenders' | 'dues'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Pagination for Suppliers
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 8;

  // Modals
  const [supplierModal, setSupplierModal] = useState({
    isOpen: false,
    isEdit: false,
    id: null,
    loading: false
  });

  const [deleteConfirmModal, setDeleteConfirmModal] = useState({
    isOpen: false,
    supplier: null,
    loading: false
  });

  const [statementSupplier, setStatementSupplier] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  // Settlement Payout Modal
  const [settlementModal, setSettlementModal] = useState({
    isOpen: false,
    supplier: null,
    amount: '',
    paymentMode: 'Cash',
    refNo: '',
    notes: '',
    loading: false
  });

  // Image Cropper
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperRawSrc, setCropperRawSrc] = useState(null);
  const [cropperPendingInfo, setCropperPendingInfo] = useState(null);

  const initialFormState = {
    profileImage: '',
    name: '',
    companyName: '',
    phone: '',
    supplierType: isLocal ? 'Local' : isDam ? 'DAM' : isSupplies ? 'Consumables' : 'Local',
    vehicleNumber: '',
    harbor: '',
    city: 'Kadapa',
    address: '',
    contactPerson: '',
    balance: 0,
    bankDetails: {
      accountNo: '',
      bankName: '',
      ifsc: '',
      upiId: ''
    },
    notes: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Close combobox on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all suppliers, inward logs, and fleet
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [suppData, vehData, invLogsRes, supLogsRes] = await Promise.all([
        getSuppliers().catch(() => []),
        getVehicles().catch(() => []),
        getInventoryLogs({ limit: 500 }).catch(() => ({ logs: [] })),
        getSupplyLogs('All', 200).catch(() => [])
      ]);

      const loadedSuppliers = Array.isArray(suppData) ? suppData : (suppData?.data || []);
      setSuppliers(loadedSuppliers);
      setFleetVehicles(vehData || []);

      const logsList = Array.isArray(invLogsRes) ? invLogsRes : (invLogsRes?.logs || []);
      setInwardLogs(logsList);
      setSupplyLogs(supLogsRes || []);
    } catch (err) {
      console.error('Failed to load SRM data:', err);
      setToast({ message: 'Error loading supplier records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Format all inward logs into Inward Catch Vouchers
  const vouchers = useMemo(() => {
    const list = [];
    const groupedCatch = {};

    // 1. Process StockLog (Local & Dam)
    (inwardLogs || []).forEach(log => {
      const isProcurement = log.type === 'Procurement (Stock-In)' || log.type === 'Stock-In';
      if (!isProcurement) return;

      const intakeMode = log.intakeMode || (log.harbor ? 'local' : 'dam');
      const vNo = log.invoiceNo || `GIN-${intakeMode.toUpperCase()}-${String(log._id).slice(-6)}`;

      if (!groupedCatch[vNo]) {
        groupedCatch[vNo] = {
          id: vNo,
          invoiceNo: vNo,
          supplierName: log.supplierName || log.companyName || 'Local Catch Supplier',
          companyName: log.companyName || '',
          supplierPhone: log.supplierPhone || '',
          vehicleNumber: log.vehicleNumber || '',
          harbor: log.harbor || (intakeMode === 'dam' ? 'Inland Reservoir' : 'Harbor'),
          intakeMode: intakeMode,
          date: log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
          time: log.createdAt ? new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
          createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
          items: [],
          totalKg: 0,
          totalBoxes: 0,
          grossValue: 0,
          netPayable: 0,
          paymentMode: intakeMode === 'dam' ? 'Consignment Settlement' : 'Cash',
          status: 'Settled',
          notes: log.notes || ''
        };
      }

      const v = groupedCatch[vNo];
      const kg = Math.abs(Number(log.quantityChange || 0));
      const bx = Number(log.boxes || 0);
      const rate = Number(log.rate || log.price || 0);
      const rowVal = Number(log.grossValue || (kg * rate) || log.price || 0);

      v.items.push({
        name: log.itemName,
        fishName: log.itemName,
        boxes: bx,
        weightKg: kg,
        rateKg: rate,
        totalAmount: rowVal
      });

      v.totalKg += kg;
      v.totalBoxes += bx;
      v.grossValue += rowVal;
      v.netPayable = Number(log.netPayable || v.grossValue);
    });

    Object.values(groupedCatch).forEach(v => list.push(v));

    // 2. Process SupplyStockLogs (Consumables)
    (supplyLogs || []).forEach(s => {
      const vNo = s.voucherNumber || `GIN-SUP-${String(s._id).slice(-6).toUpperCase()}`;
      list.push({
        id: vNo,
        invoiceNo: vNo,
        supplierName: s.supplierName || 'Depot Supplies Vendor',
        companyName: '',
        supplierPhone: s.supplierPhone || '',
        vehicleNumber: '',
        harbor: 'Depot Store',
        intakeMode: 'supplies',
        date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        time: s.createdAt ? new Date(s.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        items: [{
          name: s.itemName,
          fishName: s.itemName,
          boxes: s.quantity || 0,
          weightKg: s.quantity || 0,
          rateKg: s.unitRate || 0,
          totalAmount: s.totalAmount || 0
        }],
        totalKg: s.quantity || 0,
        totalBoxes: s.quantity || 0,
        grossValue: s.totalAmount || 0,
        netPayable: s.totalAmount || 0,
        paidAmount: s.paidAmount || 0,
        balanceAmount: s.balanceAmount || 0,
        paymentMode: s.paymentMode || 'Cash',
        status: s.balanceAmount > 0 ? 'Pending Khata' : 'Settled',
        notes: s.notes || ''
      });
    });

    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [inwardLogs, supplyLogs]);

  // Aggregate stats per supplier from vouchers
  const supplierMetricsMap = useMemo(() => {
    const map = {};
    vouchers.forEach(v => {
      const suppKey = (v.supplierName || '').trim().toLowerCase();
      if (!suppKey) return;

      if (!map[suppKey]) {
        map[suppKey] = {
          deliveries: 0,
          totalKg: 0,
          totalPurchases: 0,
          vouchers: []
        };
      }
      map[suppKey].deliveries += 1;
      map[suppKey].totalKg += (v.totalKg || 0);
      map[suppKey].totalPurchases += (v.netPayable || v.grossValue || 0);
      map[suppKey].vouchers.push(v);
    });
    return map;
  }, [vouchers]);

  // Filtered Suppliers for Current View
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      // 1. Channel Filter
      const targetType = typeFilter === 'All' ? null : typeFilter;
      const matchesType = !targetType || s.supplierType === targetType;

      // 2. Search Filter
      const q = searchQuery.toLowerCase().trim();
      let matchesSearch = true;
      if (q) {
        matchesSearch = (
          (s.name || '').toLowerCase().includes(q) ||
          (s.companyName || '').toLowerCase().includes(q) ||
          (s.phone || '').includes(q) ||
          (s.harbor || '').toLowerCase().includes(q) ||
          (s.vehicleNumber || '').toLowerCase().includes(q) ||
          (s.city || '').toLowerCase().includes(q)
        );
      }

      // 3. Mode Filter (all, spenders, dues)
      let matchesMode = true;
      if (filterMode === 'dues') {
        matchesMode = (Number(s.balance) || 0) > 0;
      } else if (filterMode === 'spenders') {
        const suppKey = (s.name || '').trim().toLowerCase();
        const purchases = supplierMetricsMap[suppKey]?.totalPurchases || 0;
        matchesMode = purchases >= 10000;
      }

      return matchesType && matchesSearch && matchesMode;
    });
  }, [suppliers, typeFilter, searchQuery, filterMode, supplierMetricsMap]);

  // Paginated Suppliers
  const totalPages = Math.ceil(filteredSuppliers.length / PER_PAGE) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredSuppliers.slice(start, start + PER_PAGE);
  }, [filteredSuppliers, currentPage]);

  // Suppliers with Khata Dues
  const khataSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const targetType = typeFilter === 'All' ? null : typeFilter;
      const matchesType = !targetType || s.supplierType === targetType;
      const hasDues = (Number(s.balance) || 0) > 0;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || '').includes(q) ||
        (s.harbor || '').toLowerCase().includes(q)
      );
      return matchesType && hasDues && matchesSearch;
    });
  }, [suppliers, typeFilter, searchQuery]);

  // Channel Vouchers
  const channelVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (typeFilter === 'Local') return v.intakeMode === 'local';
      if (typeFilter === 'DAM') return v.intakeMode === 'dam';
      if (typeFilter === 'Consumables') return v.intakeMode === 'supplies';
      return true;
    }).filter(v => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        v.invoiceNo?.toLowerCase().includes(q) ||
        v.supplierName?.toLowerCase().includes(q) ||
        v.harbor?.toLowerCase().includes(q) ||
        v.vehicleNumber?.toLowerCase().includes(q)
      );
    });
  }, [vouchers, typeFilter, searchQuery]);

  // Aggregate Channel KPI Stats
  const stats = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let cashPayouts = 0;
    let upiPayouts = 0;
    let bankPayouts = 0;

    channelVouchers.forEach(v => {
      const val = Number(v.netPayable || v.grossValue || 0);
      totalPurchases += val;

      const pMode = String(v.paymentMode || 'Cash').toLowerCase();
      if (pMode.includes('upi')) upiPayouts += val;
      else if (pMode.includes('bank') || pMode.includes('transfer')) bankPayouts += val;
      else cashPayouts += val;
    });

    const relevantSuppliers = suppliers.filter(s => {
      if (typeFilter === 'Local') return s.supplierType === 'Local';
      if (typeFilter === 'DAM') return s.supplierType === 'DAM';
      if (typeFilter === 'Consumables') return s.supplierType === 'Consumables';
      return true;
    });

    const totalPayables = relevantSuppliers.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);

    return {
      totalPurchases,
      totalVouchers: channelVouchers.length,
      activeSuppliersCount: relevantSuppliers.length,
      totalPayables,
      cashPayouts,
      upiPayouts,
      bankPayouts
    };
  }, [channelVouchers, suppliers, typeFilter]);

  // Top Volume Suppliers Leaderboard
  const topSuppliers = useMemo(() => {
    const list = [...suppliers].filter(s => {
      if (typeFilter === 'Local') return s.supplierType === 'Local';
      if (typeFilter === 'DAM') return s.supplierType === 'DAM';
      if (typeFilter === 'Consumables') return s.supplierType === 'Consumables';
      return true;
    });

    return list.map(s => {
      const key = (s.name || '').trim().toLowerCase();
      const metric = supplierMetricsMap[key] || { deliveries: 0, totalKg: 0, totalPurchases: 0 };
      return {
        ...s,
        deliveries: metric.deliveries,
        totalKg: metric.totalKg,
        totalPurchases: metric.totalPurchases
      };
    }).sort((a, b) => b.totalKg - a.totalKg).slice(0, 4);
  }, [suppliers, typeFilter, supplierMetricsMap]);

  // Handle Add/Edit Supplier
  const handleOpenAddModal = () => {
    setFormData(initialFormState);
    setSupplierModal({ isOpen: true, isEdit: false, id: null, loading: false });
  };

  const handleOpenEditModal = (supplier) => {
    const linkedVeh = (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supplier._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supplier.name?.toLowerCase()) ||
      (supplier.vehicleNumber && v.vehicleNumber?.toUpperCase() === supplier.vehicleNumber.toUpperCase())
    );

    setFormData({
      profileImage: supplier.profileImage || '',
      name: supplier.name || '',
      companyName: supplier.companyName || '',
      phone: supplier.phone || '',
      supplierType: supplier.supplierType || (isLocal ? 'Local' : isDam ? 'DAM' : 'Consumables'),
      vehicleNumber: supplier.vehicleNumber || linkedVeh?.vehicleNumber || '',
      harbor: supplier.harbor || '',
      city: supplier.city || 'Kadapa',
      address: supplier.address || '',
      contactPerson: supplier.contactPerson || '',
      balance: supplier.balance || 0,
      bankDetails: {
        accountNo: supplier.bankDetails?.accountNo || '',
        bankName: supplier.bankDetails?.bankName || '',
        ifsc: supplier.bankDetails?.ifsc || '',
        upiId: supplier.bankDetails?.upiId || ''
      },
      notes: supplier.notes || ''
    });

    setSupplierModal({ isOpen: true, isEdit: true, id: supplier._id, loading: false });
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: 'Supplier name is required', type: 'error' });
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      setToast({ message: 'Phone number must be exactly 10 digits', type: 'error' });
      return;
    }

    setSupplierModal(prev => ({ ...prev, loading: true }));
    try {
      const payload = {
        ...formData,
        phone: cleanPhone,
        balance: Number(formData.balance || 0)
      };

      if (supplierModal.isEdit) {
        await updateSupplier(supplierModal.id, payload);
        setToast({ message: `Supplier "${formData.name}" updated successfully!`, type: 'success' });
      } else {
        await createSupplier(payload);
        setToast({ message: `Supplier "${formData.name}" created successfully!`, type: 'success' });
      }

      setSupplierModal({ isOpen: false, isEdit: false, id: null, loading: false });
      loadAllData();
    } catch (err) {
      console.error('Save supplier error:', err);
      setToast({ message: err.response?.data?.message || 'Error saving supplier record', type: 'error' });
      setSupplierModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteConfirmModal.supplier) return;
    setDeleteConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      await deleteSupplier(deleteConfirmModal.supplier._id);
      setToast({ message: `Supplier "${deleteConfirmModal.supplier.name}" removed`, type: 'success' });
      setDeleteConfirmModal({ isOpen: false, supplier: null, loading: false });
      loadAllData();
    } catch (err) {
      setToast({ message: 'Failed to delete supplier', type: 'error' });
      setDeleteConfirmModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Settle Payment / Payout Modal Action
  const handleOpenSettlement = (supplier) => {
    setSettlementModal({
      isOpen: true,
      supplier,
      amount: String(supplier.balance || ''),
      paymentMode: 'Cash',
      refNo: '',
      notes: '',
      loading: false
    });
  };

  const handleConfirmSettlement = async (e) => {
    e.preventDefault();
    const { supplier, amount, paymentMode, refNo, notes } = settlementModal;
    const payAmt = Number(amount);
    if (!payAmt || payAmt <= 0) {
      setToast({ message: 'Please enter a valid payout amount', type: 'error' });
      return;
    }

    setSettlementModal(prev => ({ ...prev, loading: true }));
    try {
      const currentBal = Number(supplier.balance || 0);
      const newBal = Math.max(0, currentBal - payAmt);

      await updateSupplier(supplier._id, {
        balance: newBal,
        notes: `${supplier.notes || ''}\n[Payout: ₹${payAmt} via ${paymentMode} on ${new Date().toLocaleDateString('en-IN')}${refNo ? ` Ref: ${refNo}` : ''}]`.trim()
      });

      setToast({ message: `Recorded payout of ₹${payAmt.toLocaleString()} to ${supplier.name}! New Khata: ₹${newBal.toLocaleString()}`, type: 'success' });
      setSettlementModal({ isOpen: false, supplier: null, amount: '', paymentMode: 'Cash', refNo: '', notes: '', loading: false });
      loadAllData();
    } catch (err) {
      console.error('Payout settlement error:', err);
      setToast({ message: 'Failed to record settlement payout', type: 'error' });
      setSettlementModal(prev => ({ ...prev, loading: false }));
    }
  };

  // Image Upload helper
  const handleImageFileChange = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image size must be under 5MB', type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = (event) => {
      setCropperRawSrc(event.target.result);
      setCropperPendingInfo({ name: file.name, size: `${(file.size / (1024 * 1024)).toFixed(2)} MB` });
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Fleet Vehicles Searchable Options
  const vehicleOptions = useMemo(() => {
    return (fleetVehicles || []).map(v => {
      const vNum = (v.vehicleNumber || '').toUpperCase().trim();
      return {
        value: vNum,
        label: `${vNum} (${v.vehicleName || v.vehicleType || 'Fleet'})`,
        subtitle: v.driverName ? `Driver: ${v.driverName} • ${v.operationalMode || ''}` : '',
        badge: v.status || 'Available',
        badgeColor: v.status === 'Available' ? 'emerald' : 'amber'
      };
    });
  }, [fleetVehicles]);

  return (
    <div className="w-full min-h-full flex flex-col bg-background text-text-main pb-20">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── TOP HEADER (Zero Empty Space) ── */}
      <div className="bg-surface border-b border-border px-3 py-2 sm:px-4 sm:py-2.5 shadow-2xs flex items-center justify-between gap-2 sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          {onGoBack && <BackButton onClick={onGoBack} label={t("Back")} />}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-orange-100 text-[#ea580c] border border-orange-200 flex items-center justify-center shrink-0 shadow-xs">
            <Users size={16} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-none m-0 truncate">
                {channelTitle}
              </h1>
              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-orange-100 text-[#c2410c] border border-orange-200 uppercase tracking-wider">
                {typeFilter}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium m-0 mt-0.5 truncate hidden sm:block">
              {channelSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={loadAllData}
            className="p-1.5 sm:p-2 bg-background border border-border hover:border-slate-300 rounded-xl text-text-muted hover:text-text-main shadow-2xs transition-colors cursor-pointer"
            title={t("Refresh SRM Directory")}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus size={13} strokeWidth={2.8} />
            <span>{t(`Add ${personRole}`)}</span>
          </button>
        </div>
      </div>

      {/* ── TOP KPI 4-CARDS ROW (Matching ChannelHub) ── */}
      <div className="px-2 sm:px-3 pt-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Card 1: Total Procurement Spend */}
          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className={`p-2 bg-surface rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-[#ea580c]/60 active:scale-[0.99] ${
              activeTab === 'vouchers' ? 'border-[#ea580c]/60 ring-1 ring-[#ea580c]/20' : 'border-border'
            }`}
          >
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider block">{t('Total Procurement')}</span>
            <span className="text-sm font-black text-emerald-700 font-mono">₹{stats.totalPurchases.toLocaleString()}</span>
          </button>

          {/* Card 2: Total Inward Catch Vouchers */}
          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className={`p-2 bg-surface rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-[#ea580c]/60 active:scale-[0.99] ${
              activeTab === 'vouchers' ? 'border-[#ea580c]/60 ring-1 ring-[#ea580c]/20' : 'border-border'
            }`}
          >
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider block">{t('Inward Vouchers')}</span>
            <span className="text-sm font-black text-text-main font-mono">{stats.totalVouchers}</span>
          </button>

          {/* Card 3: Active Suppliers Count */}
          <button
            type="button"
            onClick={() => setActiveTab('srm')}
            className={`p-2 bg-surface rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-[#ea580c]/60 active:scale-[0.99] ${
              activeTab === 'srm' ? 'border-[#ea580c]/60 ring-1 ring-[#ea580c]/20' : 'border-border'
            }`}
          >
            <span className="text-[9.5px] font-bold text-text-muted uppercase tracking-wider block">{personRolePlural}</span>
            <span className="text-sm font-black text-text-main font-mono">{filteredSuppliers.length}</span>
          </button>

          {/* Card 4: Supplier Payables (Accounts Payable / Khata) in Rose */}
          <button
            type="button"
            onClick={() => setActiveTab('khata')}
            className={`p-2 rounded-xl border shadow-2xs text-left cursor-pointer transition-all hover:border-rose-400 active:scale-[0.99] ${
              stats.totalPayables > 0 ? 'bg-rose-50 border-rose-300' : 'bg-surface border-border'
            } ${activeTab === 'khata' ? 'ring-1 ring-rose-400/40' : ''}`}
          >
            <span className="text-[9.5px] font-bold text-rose-700 uppercase tracking-wider block">{t('Supplier Payables (Khata)')}</span>
            <span className="text-sm font-black text-rose-700 font-mono">₹{stats.totalPayables.toLocaleString()}</span>
          </button>
        </div>

        {/* ── 3 UNIFIED NAVIGATION TABS ── */}
        <div className="flex items-center gap-1.5 mt-2 pt-0.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'srm', label: `${personRolePlural} SRM`, icon: Users, count: filteredSuppliers.length },
            { id: 'khata', label: t('Khata & Payables'), icon: CreditCard, count: khataSuppliers.length },
            { id: 'vouchers', label: t('Catch Vouchers / Bills'), icon: FileText, count: channelVouchers.length }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 border ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white border-[#ea580c] shadow-xs'
                    : 'bg-surface border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-background border border-border text-text-muted'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2-PANEL LAYOUT (Zero Empty Space) ── */}
      <div className="flex-1 flex flex-col lg:flex-row gap-2.5 p-2 sm:p-3 overflow-visible lg:min-h-0">

        {/* ── LEFT PANEL: PRIMARY SRM WORKSPACE (68% Width on Desktop) ── */}
        <div className="w-full lg:flex-1 h-auto flex flex-col bg-surface rounded-2xl border border-border shadow-xs overflow-visible p-2.5 sm:p-3">

          {/* TAB 1: SUPPLIERS SRM DIRECTORY */}
          {activeTab === 'srm' && (
            <div className="space-y-3">
              {/* Channel Filter Pills for Standalone / All View */}
              {isAll && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'All', label: 'All Suppliers', count: suppliers.length },
                    { id: 'Local', label: 'Local Fishermen', count: suppliers.filter(s => s.supplierType === 'Local').length },
                    { id: 'DAM', label: 'Dam Contractors', count: suppliers.filter(s => s.supplierType === 'DAM').length },
                    { id: 'Consumables', label: 'Packaging & Supplies', count: suppliers.filter(s => s.supplierType === 'Consumables').length }
                  ].map(pill => (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setTypeFilter(pill.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                        typeFilter === pill.id
                          ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-xs'
                          : 'bg-background border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      {pill.label} ({pill.count})
                    </button>
                  ))}
                </div>
              )}

              {/* Hybrid Search & Combobox Bar */}
              <div ref={dropdownRef} className="relative w-full">
                <div className="flex items-center bg-background border border-border hover:border-amber-400 focus-within:border-[#ea580c] focus-within:ring-2 focus-within:ring-orange-500/20 rounded-xl transition-all shadow-2xs">
                  <Search size={14} className="text-slate-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    placeholder={t(`Search or select ${personRole.toLowerCase()} (name, phone, company, harbor, vehicle)...`)}
                    className="w-full bg-transparent py-2 pl-2.5 pr-2 text-xs font-bold text-text-main focus:outline-none placeholder:text-text-muted/60"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded-md shrink-0"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(prev => !prev)}
                    className="px-2.5 py-2 border-l border-border/80 text-slate-400 hover:text-text-main hover:bg-surface-hover rounded-r-xl transition-colors cursor-pointer shrink-0"
                  >
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-[#ea580c]' : ''}`} />
                  </button>
                </div>

                {/* Combobox Dropdown Flyout */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-2xl shadow-xl z-50 max-h-60 overflow-y-auto animate-fade-in text-xs divide-y divide-border/60">
                    <div
                      onClick={() => { setSearchQuery(''); setIsDropdownOpen(false); }}
                      className="p-2.5 hover:bg-surface-hover cursor-pointer font-bold text-text-muted flex justify-between items-center"
                    >
                      <span>{t('All')} {personRolePlural}</span>
                      <span className="font-mono bg-background px-2 py-0.5 rounded-md border border-border">{suppliers.length}</span>
                    </div>
                    {suppliers.map(s => (
                      <div
                        key={s._id}
                        onClick={() => {
                          setSearchQuery(s.name);
                          setIsDropdownOpen(false);
                        }}
                        className="p-2.5 hover:bg-surface-hover cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <span className="font-bold text-text-main">{s.name}</span>
                          <span className="text-[10px] text-text-muted block">{s.companyName || s.harbor || s.phone}</span>
                        </div>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200">
                          {s.supplierType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Filter Mode Buttons (All, Top Spenders, With Dues) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: `${t('All')} (${filteredSuppliers.length})` },
                  { id: 'spenders', label: `⭐ ${t('Top Suppliers (>₹10k)')}` },
                  { id: 'dues', label: `⚠️ ${t('With Khata Dues')}` }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFilterMode(p.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                      filterMode === p.id
                        ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-xs'
                        : 'bg-background border-border text-text-muted hover:text-text-main hover:bg-surface-hover'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Supplier Cards Grid */}
              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-text-muted">
                  <Loader2 size={24} className="animate-spin text-[#ea580c]" />
                  <span className="text-xs font-bold">{t('Loading suppliers directory...')}</span>
                </div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="py-12 text-center bg-background rounded-2xl border border-dashed border-border p-6 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto border border-orange-200">
                    <Users size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-text-main">{t('No suppliers found')}</h3>
                    <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
                      {searchQuery ? t('Try adjusting your search query or channel filter') : t('Add your first fisherman or supplier to start logging inward stock.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ea580c] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:bg-[#c2410c]"
                  >
                    <Plus size={13} strokeWidth={2.5} />
                    <span>{t('Add New Supplier')}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {paginatedSuppliers.map(s => {
                    const suppKey = (s.name || '').trim().toLowerCase();
                    const metric = supplierMetricsMap[suppKey] || { deliveries: 0, totalKg: 0, totalPurchases: 0 };
                    const due = Number(s.balance || 0);

                    return (
                      <div
                        key={s._id}
                        className="p-3 bg-background hover:bg-surface-hover/70 rounded-2xl border border-border hover:border-orange-300 transition-all shadow-2xs flex flex-col justify-between gap-2.5 group"
                      >
                        {/* Card Header: Avatar, Name, Harbor, Phone, Supplier Type */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#ea580c] border border-orange-200 flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-2xs">
                                {s.profileImage ? (
                                  <img src={s.profileImage} alt={s.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(s.name || 'S').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-text-main truncate leading-tight group-hover:text-[#ea580c] transition-colors">
                                  {s.name}
                                </h4>
                                <div className="flex items-center gap-1 text-[10px] text-text-muted truncate mt-0.5">
                                  <MapPin size={10} className="shrink-0 text-amber-600" />
                                  <span className="truncate">{s.harbor || s.city || 'Local Area'}</span>
                                  {s.vehicleNumber && (
                                    <>
                                      <span>•</span>
                                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
                                        {s.vehicleNumber}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="text-[10px] font-mono font-bold text-slate-600 flex items-center gap-1 mt-0.5">
                                  <Phone size={10} className="text-[#ea580c] shrink-0" />
                                  <span>{s.phone}</span>
                                </p>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-orange-50 text-orange-800 border border-orange-200 shrink-0">
                              {s.supplierType}
                            </span>
                          </div>

                          {/* Card 4-Metric Grid (Deliveries, Weight, Purchases, Payable) */}
                          <div className="grid grid-cols-4 gap-1 py-2 my-1.5 text-center bg-surface rounded-xl border border-border/70">
                            <div>
                              <span className="text-[8.5px] font-bold text-text-muted uppercase block">{t('Deliveries')}</span>
                              <span className="text-xs font-mono font-black text-text-main">{metric.deliveries}</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-bold text-text-muted uppercase block">{t('Weight')}</span>
                              <span className="text-xs font-mono font-black text-amber-700">{metric.totalKg.toFixed(1)} Kg</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-bold text-text-muted uppercase block">{t('Purchases')}</span>
                              <span className="text-xs font-mono font-black text-emerald-700">₹{Math.round(metric.totalPurchases).toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-bold text-text-muted uppercase block">{t('Payable')}</span>
                              <span className={`text-xs font-mono font-black ${due > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {due > 0 ? `₹${due.toLocaleString()}` : t('Clear')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card Footer: Statement + Settle/Pay + Quick Call/WA + Edit/Delete */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => setStatementSupplier(s)}
                            className="flex-1 py-1.5 px-2 bg-surface hover:bg-surface-hover text-text-main border border-border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <FileText size={12} className="text-[#ea580c]" />
                            <span>{t('Statement')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenSettlement(s)}
                            className="py-1.5 px-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 shrink-0"
                            title={t('Record payment / settle Khata')}
                          >
                            <CreditCard size={12} />
                            <span>{t('Settle')}</span>
                          </button>

                          {s.phone && (
                            <a
                              href={`https://wa.me/91${s.phone.replace(/\D/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white border border-[#25D366]/30 rounded-xl transition-all shrink-0"
                              title="WhatsApp"
                            >
                              <MessageSquare size={12} />
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(s)}
                            className="p-1.5 bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-border rounded-xl cursor-pointer transition-all shrink-0"
                            title={t('Edit supplier')}
                          >
                            <Edit2 size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmModal({ isOpen: true, supplier: s, loading: false })}
                            className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl cursor-pointer transition-all shrink-0"
                            title={t('Delete supplier')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bottom Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                  <span className="text-text-muted">
                    Page {currentPage} of {totalPages} ({filteredSuppliers.length} Total)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-border bg-background hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: KHATA & PAYABLES (ACCOUNTS PAYABLE) */}
          {activeTab === 'khata' && (
            <div className="space-y-3">
              {/* Top Alert Banner */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-rose-900 block">{t('Total Supplier Accounts Payable')}</span>
                    <span className="text-[11px] text-rose-700 font-medium">
                      {khataSuppliers.length} {personRolePlural} awaiting payment settlement
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-black text-rose-700 font-mono block">
                    ₹{stats.totalPayables.toLocaleString()}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded">
                    Due for Payout
                  </span>
                </div>
              </div>

              {/* Payables Search */}
              <div className="flex items-center bg-background border border-border rounded-xl px-3 py-1.5 shadow-2xs">
                <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('Filter suppliers with pending payables...')}
                  className="w-full bg-transparent text-xs font-bold text-text-main focus:outline-none placeholder:text-text-muted/60"
                />
              </div>

              {/* Payables List */}
              {khataSuppliers.length === 0 ? (
                <div className="py-12 text-center bg-background rounded-2xl border border-dashed border-border p-6 space-y-2">
                  <CheckCircle size={28} className="text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-black text-text-main">{t('All Supplier Accounts Clear')}</h4>
                  <p className="text-xs text-text-muted">{t('No pending payouts or Khata dues recorded in this channel.')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {khataSuppliers.map(s => {
                    const due = Number(s.balance || 0);
                    const b = s.bankDetails || {};
                    return (
                      <div
                        key={s._id}
                        className="p-3 bg-background hover:bg-surface-hover/70 rounded-2xl border border-border hover:border-rose-300 transition-all shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0">
                            {(s.name || 'S').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-black text-text-main leading-tight truncate">{s.name}</h4>
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-orange-50 text-orange-800 border border-orange-200">
                                {s.supplierType}
                              </span>
                            </div>
                            <div className="text-[10px] text-text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span>{s.phone}</span>
                              {s.harbor && <span>• {s.harbor}</span>}
                              {b.bankName && <span>• {b.bankName} (A/C: {b.accountNo ? `...${b.accountNo.slice(-4)}` : '—'})</span>}
                              {b.upiId && <span>• UPI: {b.upiId}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                          <div className="text-left sm:text-right">
                            <span className="text-[9px] font-bold text-rose-600 uppercase block">{t('Pending Khata')}</span>
                            <span className="text-sm font-mono font-black text-rose-600">₹{due.toLocaleString()}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setStatementSupplier(s)}
                              className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-bold text-text-main cursor-pointer"
                            >
                              {t('Statement')}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenSettlement(s)}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer active:scale-95 flex items-center gap-1"
                            >
                              <CreditCard size={12} />
                              <span>{t('Pay Now')}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INWARD CATCH VOUCHERS & BILL HISTORY */}
          {activeTab === 'vouchers' && (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="flex items-center bg-background border border-border rounded-xl px-3 py-1.5 shadow-2xs">
                <Search size={14} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('Search vouchers by voucher #, supplier, harbor, variety...')}
                  className="w-full bg-transparent text-xs font-bold text-text-main focus:outline-none placeholder:text-text-muted/60"
                />
              </div>

              {/* Vouchers Table */}
              {channelVouchers.length === 0 ? (
                <div className="py-12 text-center bg-background rounded-2xl border border-dashed border-border p-6 space-y-2">
                  <FileText size={28} className="text-slate-400 mx-auto" />
                  <h4 className="text-sm font-black text-text-main">{t('No Inward Catch Vouchers Found')}</h4>
                  <p className="text-xs text-text-muted">{t('No stock arrivals matching your filter criteria.')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface border-b border-border text-[9.5px] uppercase font-black text-text-muted tracking-wider">
                        <th className="py-2.5 px-3">{t('Voucher #')}</th>
                        <th className="py-2.5 px-3">{t('Date & Time')}</th>
                        <th className="py-2.5 px-3">{t('Supplier')}</th>
                        <th className="py-2.5 px-3">{t('Channel')}</th>
                        <th className="py-2.5 px-3">{t('Items / Catch')}</th>
                        <th className="py-2.5 px-3 text-right">{t('Weight / Boxes')}</th>
                        <th className="py-2.5 px-3 text-right">{t('Total (₹)')}</th>
                        <th className="py-2.5 px-3 text-center">{t('Action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-background">
                      {channelVouchers.slice(0, 50).map(v => (
                        <tr key={v.id} className="hover:bg-surface-hover/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-text-main whitespace-nowrap">
                            #{v.invoiceNo}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-text-muted">
                            <span className="font-bold text-text-main block">{v.date}</span>
                            <span className="text-[10px]">{v.time}</span>
                          </td>
                          <td className="py-2.5 px-3 min-w-[140px]">
                            <span className="font-bold text-text-main block truncate">{v.supplierName}</span>
                            <span className="text-[10px] text-text-muted block truncate">{v.harbor || v.supplierPhone}</span>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                              v.intakeMode === 'dam'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : v.intakeMode === 'supplies'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-orange-50 text-orange-800 border border-orange-200'
                            }`}>
                              {v.intakeMode === 'dam' ? 'DAM Consignment' : v.intakeMode === 'supplies' ? 'Supplies Inward' : 'Local Catch'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-700">
                            {v.items && v.items.length > 0 ? (
                              <span>
                                {v.items.map(it => it.name || it.fishName).filter(Boolean).slice(0, 2).join(', ')}
                                {v.items.length > 2 && ` +${v.items.length - 2} more`}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            <span className="text-amber-800 block">{v.totalKg.toFixed(1)} Kg</span>
                            {v.totalBoxes > 0 && <span className="text-[10px] text-text-muted">{v.totalBoxes} Boxes</span>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                            ₹{Math.round(v.netPayable || v.grossValue || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setViewInvoice(v)}
                              className="p-1.5 bg-orange-50 hover:bg-[#ea580c] text-[#ea580c] hover:text-white border border-orange-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                              title={t('View & Print Inward Invoice')}
                            >
                              <Printer size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: LIVE PROCUREMENT COMMAND & INSIGHTS (32% Width on Desktop) ── */}
        <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 flex flex-col gap-2.5 pb-6 lg:pb-0">

          {/* WIDGET 1: FINANCIAL PAYOUT HEALTH */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Wallet size={14} className="text-[#ea580c]" />
                <span className="font-black text-xs text-text-main">{t('Procurement & Payout Health')}</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-orange-800 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200 uppercase">
                {typeFilter}
              </span>
            </div>

            {/* Payout Progress Bar */}
            {(() => {
              const totalTurnover = (stats.totalPurchases || 0) + (stats.totalPayables || 0);
              const paidPct = totalTurnover > 0 ? Math.round((stats.totalPurchases / totalTurnover) * 100) : 100;
              const pendingPct = 100 - paidPct;
              return (
                <div>
                  <div className="flex justify-between text-[11px] font-bold mb-1">
                    <span className="text-emerald-700">{t('Paid Out')}: {paidPct}%</span>
                    <span className="text-rose-600">{t('Pending Khata')}: {pendingPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-rose-200 overflow-hidden flex">
                    <div className="bg-emerald-600 h-full transition-all duration-500" style={{ width: `${paidPct}%` }} />
                    <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${pendingPct}%` }} />
                  </div>
                </div>
              );
            })()}

            {/* Payout Modes Split */}
            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-mono">
              <div className="p-2 bg-background rounded-xl border border-border">
                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Cash Payouts')}</span>
                <span className="font-black text-text-main text-xs">₹{stats.cashPayouts.toLocaleString()}</span>
              </div>
              <div className="p-2 bg-background rounded-xl border border-border">
                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('UPI Payouts')}</span>
                <span className="font-black text-text-main text-xs">₹{stats.upiPayouts.toLocaleString()}</span>
              </div>
              <div className="p-2 bg-background rounded-xl border border-border">
                <span className="text-[9px] font-bold text-text-muted uppercase block">{t('Bank Transfers')}</span>
                <span className="font-black text-text-main text-xs">₹{stats.bankPayouts.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* WIDGET 2: SUPPLIER VOLUME LEADERBOARD */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Award size={14} className="text-amber-500" />
                <span className="font-black text-xs text-text-main">{t('Supplier Leaderboard')}</span>
              </div>
              <span className="text-[10px] text-text-muted">{topSuppliers.length} {t('Top Catch Partners')}</span>
            </div>

            {topSuppliers.length === 0 ? (
              <p className="py-4 text-center text-slate-400 text-xs italic">{t('No inward catches recorded yet')}</p>
            ) : (
              <div className="space-y-1.5">
                {topSuppliers.map((s, idx) => (
                  <div key={s._id} className="p-2 bg-background rounded-xl border border-border/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-900 font-black text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold text-text-main block truncate leading-tight">{s.name}</span>
                        <span className="text-[10px] text-text-muted font-mono">{s.deliveries || 0} {t('Catches')} • {s.harbor || 'Depot'}</span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-700 text-xs shrink-0">
                      {s.totalKg ? `${s.totalKg.toFixed(1)} Kg` : `₹${Math.round(s.totalPurchases || 0).toLocaleString()}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* WIDGET 3: 24/7 DUES DISPATCH & SETTLEMENT HUB */}
          <div className="bg-surface rounded-2xl border border-border p-3 shadow-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
              <div className="flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-600" />
                <span className="font-black text-xs text-text-main">{t('Depot Payout Reconciliation')}</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse" />
            </div>

            <div className="p-2.5 bg-background rounded-xl border border-border text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-text-muted font-bold text-[11px]">{t('Settlement Cadence')}:</span>
                <span className="font-black font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                  Daily Catch Settled
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-text-muted font-bold text-[11px]">{t('Pending Suppliers')}:</span>
                <span className="font-mono font-black text-rose-700 text-[11px]">
                  {khataSuppliers.length} Accounts
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('khata')}
              className="w-full py-1.5 px-2 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-1.5"
            >
              <CreditCard size={12} />
              <span>{t('Review All Supplier Payables')}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ── MODAL 1: ADD / EDIT SUPPLIER MODAL ── */}
      {supplierModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="px-4 py-3 bg-[#ea580c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} />
                <h3 className="font-black text-sm">
                  {supplierModal.isEdit ? t(`Edit ${personRole}`) : t(`Add New ${personRole}`)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModal({ isOpen: false, isEdit: false, id: null, loading: false })}
                className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSupplier} className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto text-xs">
              {/* Photo & Basic Details */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center relative overflow-hidden shrink-0">
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-orange-400" />
                  )}
                  <label className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload size={14} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileChange(e.target.files?.[0])}
                    />
                  </label>
                </div>
                <div className="flex-1 space-y-1">
                  <span className="font-bold text-text-main text-xs block">{t('Profile Photo')}</span>
                  <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-background hover:bg-surface-hover border border-border rounded-lg font-bold text-[11px] cursor-pointer text-text-muted hover:text-text-main">
                    <ImageIcon size={12} />
                    <span>{formData.profileImage ? t('Change Photo') : t('Upload Photo')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageFileChange(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('Full Name')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Prasad Reddy"
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('Phone Number (10 digits)')} *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="9848012345"
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
                  />
                </div>
              </div>

              {/* Company / Boat / Syndicate & Supplier Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('Firm / Boat / Syndicate Name')}</label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Sea King Syndicate"
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('Supplier Type')}</label>
                  <select
                    value={formData.supplierType}
                    onChange={(e) => setFormData({ ...formData, supplierType: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
                  >
                    <option value="Local">{t('Local Harbor Fishermen')}</option>
                    <option value="DAM">{t('Dam Reservoir Syndicate')}</option>
                    <option value="Consumables">{t('Packaging & Depot Supplies')}</option>
                  </select>
                </div>
              </div>

              {/* Harbor / Port & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('Harbor / Reservoir / Origin')}</label>
                  <input
                    type="text"
                    value={formData.harbor}
                    onChange={(e) => setFormData({ ...formData, harbor: e.target.value })}
                    placeholder="e.g. Mangalore Port, Srisailam Dam"
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('City / District')}</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Kadapa"
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
                  />
                </div>
              </div>

              {/* Assigned Vehicle */}
              <div>
                <label className="font-bold text-text-main block mb-1">{t('Assigned Fleet Vehicle')}</label>
                <SearchableDropdown
                  options={vehicleOptions}
                  value={formData.vehicleNumber}
                  onChange={(val) => setFormData({ ...formData, vehicleNumber: val })}
                  placeholder="Select vehicle from fleet (or type number)..."
                  customInputAllowed={true}
                />
              </div>

              {/* Bank Details */}
              <div className="p-3 bg-background rounded-xl border border-border space-y-2">
                <span className="font-bold text-text-main block text-[11px]">{t('Banking & Settlement Payout Info')}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Bank Name (e.g. SBI, HDFC)"
                    value={formData.bankDetails.bankName}
                    onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value } })}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={formData.bankDetails.accountNo}
                    onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountNo: e.target.value } })}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-bold font-mono"
                  />
                  <input
                    type="text"
                    placeholder="IFSC Code"
                    value={formData.bankDetails.ifsc}
                    onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, ifsc: e.target.value } })}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-bold uppercase font-mono"
                  />
                  <input
                    type="text"
                    placeholder="UPI ID (e.g. name@upi)"
                    value={formData.bankDetails.upiId}
                    onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, upiId: e.target.value } })}
                    className="w-full bg-surface border border-border rounded-lg px-2.5 py-1 text-xs font-bold font-mono"
                  />
                </div>
              </div>

              {/* Starting Balance (Khata Due) */}
              <div>
                <label className="font-bold text-text-main block mb-1">{t('Starting Khata Balance (₹ Payable)')}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold font-mono text-rose-600 focus:border-[#ea580c] focus:outline-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-text-main block mb-1">{t('Notes / Terms')}</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Payment settlement cadence, agreement terms..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-medium text-xs focus:border-[#ea580c] focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSupplierModal({ isOpen: false, isEdit: false, id: null, loading: false })}
                  className="px-3.5 py-1.5 rounded-xl border border-border font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={supplierModal.loading}
                  className="px-4 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {supplierModal.loading && <Loader2 size={13} className="animate-spin" />}
                  <span>{supplierModal.isEdit ? t('Update Record') : t('Save Supplier')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: SETTLEMENT / PAYOUT MODAL ── */}
      {settlementModal.isOpen && settlementModal.supplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={16} />
                <h3 className="font-black text-sm">{t('Record Supplier Payout')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlementModal({ isOpen: false, supplier: null, amount: '', paymentMode: 'Cash', refNo: '', notes: '', loading: false })}
                className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmSettlement} className="p-4 space-y-3 text-xs">
              {/* Supplier Info Banner */}
              <div className="p-3 bg-background rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="font-black text-text-main text-xs block">{settlementModal.supplier.name}</span>
                  <span className="text-[10px] text-text-muted">{settlementModal.supplier.harbor || settlementModal.supplier.phone}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] uppercase font-bold text-rose-600 block">{t('Current Khata')}</span>
                  <span className="text-sm font-mono font-black text-rose-600">
                    ₹{Number(settlementModal.supplier.balance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="font-bold text-text-main block mb-1">{t('Payout Amount (₹)')} *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={settlementModal.supplier.balance || 9999999}
                  value={settlementModal.amount}
                  onChange={(e) => setSettlementModal({ ...settlementModal, amount: e.target.value })}
                  placeholder="Enter amount paid"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 font-mono font-black text-base text-emerald-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Payment Mode Selector */}
              <div>
                <label className="font-bold text-text-main block mb-1">{t('Payment Method')}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['Cash', 'UPI', 'Bank Transfer', 'Cheque'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettlementModal({ ...settlementModal, paymentMode: m })}
                      className={`py-1.5 px-2 rounded-xl text-center font-bold text-[11px] border transition-all cursor-pointer ${
                        settlementModal.paymentMode === m
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-background border-border text-text-muted hover:text-text-main'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ref / UTR number */}
              {settlementModal.paymentMode !== 'Cash' && (
                <div>
                  <label className="font-bold text-text-main block mb-1">{t('Reference / UTR Number')}</label>
                  <input
                    type="text"
                    value={settlementModal.refNo}
                    onChange={(e) => setSettlementModal({ ...settlementModal, refNo: e.target.value })}
                    placeholder="e.g. UPI Ref / Cheque No / Bank UTR"
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 font-bold font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              {/* Settlement Notes */}
              <div>
                <label className="font-bold text-text-main block mb-1">{t('Notes')}</label>
                <input
                  type="text"
                  value={settlementModal.notes}
                  onChange={(e) => setSettlementModal({ ...settlementModal, notes: e.target.value })}
                  placeholder="e.g. Evening catch payout settled"
                  className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSettlementModal({ isOpen: false, supplier: null, amount: '', paymentMode: 'Cash', refNo: '', notes: '', loading: false })}
                  className="px-3.5 py-1.5 rounded-xl border border-border font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={settlementModal.loading}
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl font-black cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {settlementModal.loading && <Loader2 size={13} className="animate-spin" />}
                  <span>{t('Confirm Payout')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: SUPPLIER STATEMENT MODAL ── */}
      {statementSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 bg-[#ea580c] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={16} />
                <h3 className="font-black text-sm">{t('Supplier Ledger Statement')}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
                  title="Print Statement"
                >
                  <Printer size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setStatementSupplier(null)}
                  className="p-1 hover:bg-white/20 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto text-xs flex-1">
              {/* Supplier Header Box */}
              <div className="p-3 bg-background rounded-2xl border border-border flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-text-main m-0">{statementSupplier.name}</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {statementSupplier.companyName || statementSupplier.harbor || 'Supplier'} • Ph: {statementSupplier.phone}
                  </p>
                  {statementSupplier.vehicleNumber && (
                    <span className="inline-block mt-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      Vehicle: {statementSupplier.vehicleNumber}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-rose-600 block">{t('Current Khata Due')}</span>
                  <span className="text-lg font-mono font-black text-rose-600">
                    ₹{Number(statementSupplier.balance || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Inward Deliveries for this supplier */}
              {(() => {
                const suppKey = (statementSupplier.name || '').trim().toLowerCase();
                const metric = supplierMetricsMap[suppKey];
                const list = metric?.vouchers || [];

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-xs text-text-main">{t('Recorded Catch Deliveries & Stock Vouchers')}</span>
                      <span className="text-[11px] font-bold text-text-muted font-mono">{list.length} Vouchers</span>
                    </div>

                    {list.length === 0 ? (
                      <p className="py-6 text-center text-slate-400 italic bg-background rounded-xl border border-dashed border-border">
                        {t('No catch vouchers recorded yet for this supplier.')}
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-border">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-surface text-[9.5px] uppercase font-bold text-text-muted border-b border-border">
                              <th className="p-2">Voucher #</th>
                              <th className="p-2">Date</th>
                              <th className="p-2">Catch Items</th>
                              <th className="p-2 text-right">Kg</th>
                              <th className="p-2 text-right">Gross (₹)</th>
                              <th className="p-2 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60 bg-background font-mono">
                            {list.map(v => (
                              <tr key={v.id} className="hover:bg-surface-hover/70">
                                <td className="p-2 font-bold text-text-main">#{v.invoiceNo}</td>
                                <td className="p-2 text-text-muted">{v.date}</td>
                                <td className="p-2 font-sans truncate max-w-[150px]">
                                  {v.items?.map(it => it.name).join(', ') || '—'}
                                </td>
                                <td className="p-2 text-right text-amber-800">{v.totalKg.toFixed(1)}</td>
                                <td className="p-2 text-right font-black text-emerald-700">₹{Math.round(v.netPayable || v.grossValue || 0).toLocaleString()}</td>
                                <td className="p-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setViewInvoice(v)}
                                    className="p-1 text-[#ea580c] hover:bg-orange-50 rounded"
                                    title="View Inward Slip"
                                  >
                                    <Eye size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmModal.isOpen && deleteConfirmModal.supplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-4 space-y-3 text-xs">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
              <AlertTriangle size={20} />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-black text-text-main">{t('Deactivate Supplier?')}</h4>
              <p className="text-text-muted">
                Are you sure you want to remove <span className="font-bold text-text-main">"{deleteConfirmModal.supplier.name}"</span> from active directory?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal({ isOpen: false, supplier: null, loading: false })}
                className="flex-1 py-1.5 rounded-xl border border-border font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                disabled={deleteConfirmModal.loading}
                onClick={handleDeleteSupplier}
                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {deleteConfirmModal.loading && <Loader2 size={13} className="animate-spin" />}
                <span>{t('Confirm Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 5: PROFESSIONAL INWARD INVOICE VIEWER ── */}
      {viewInvoice && (
        <FishInwardInvoice
          data={viewInvoice}
          onClose={() => setViewInvoice(null)}
        />
      )}

      {/* ── MODAL 6: IMAGE CROPPER MODAL ── */}
      {isCropperOpen && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          imageSrc={cropperRawSrc}
          fileInfo={cropperPendingInfo}
          onClose={() => setIsCropperOpen(false)}
          onCropComplete={(croppedDataUrl) => {
            setFormData(prev => ({ ...prev, profileImage: croppedDataUrl }));
            setIsCropperOpen(false);
          }}
        />
      )}
    </div>
  );
}
