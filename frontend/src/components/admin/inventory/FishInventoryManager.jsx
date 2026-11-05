import React, { useState, useEffect, useMemo } from 'react';
import Toast from '../system/Toast';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';
import realtimeService from '../../../services/realtimeService';
import { getSuppliers } from '../../../api/operations/operations';
import { 
  getSupplyCategories, 
  createSupplyCategory, 
  recordSupplyStockIn, 
  getSupplyLogs 
} from '../../../api/operations/supplies';
import { 
  Package, 
  ArrowDownLeft, 
  TrendingDown, 
  Plus, 
  RefreshCw, 
  History, 
  Scale, 
  ShieldCheck, 
  Search,
  Filter,
  Calendar,
  Printer,
  Trash2,
  FileText,
  CheckCircle,
  Truck,
  User,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Anchor,
  Building,
  AlertTriangle
} from 'lucide-react';
import BackButton from '../common/BackButton';

export default function FishInventoryManager({ user, onNavigate, onGoBack }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'procurement' | 'shrinkage' | 'logs'
  const [stockInSubTab, setStockInSubTab] = useState('local'); // 'local' | 'dam' | 'supplies'
  const [fishList, setFishList] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [crmCustomers, setCrmCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [damPrintVoucher, setDamPrintVoucher] = useState(null);

  // Local Stock-In Form State (Multi-fish + Boxes support)
  const [localStockInForm, setLocalStockInForm] = useState({
    supplierName: '',
    supplierPhone: '',
    companyName: '',
    vehicleNumber: '',
    harbor: '',
    items: [
      { id: 1, menuItemId: '', itemName: '', boxes: '', kgPerBox: 60, kg: '', grams: '', ratePerKg: '', sizeBracket: 'Medium', weightOption: '1+' }
    ],
    iceCharges: '',
    boxTapeCharges: '',
    advanceAmount: '',
    paymentMode: 'Cash',
    notes: ''
  });

  // DAM Consignment Form State (Multi-fish + Boxes support)
  const [damStockInForm, setDamStockInForm] = useState({
    contractorId: '',
    contractorName: '',
    contractorPhone: '',
    companyName: '',
    vehicleNumber: '',
    harbor: '',
    contractorCity: '',
    tallyItems: [
      { id: 1, menuItemId: '', itemName: '', boxes: '', kgPerBox: 60, kg: '', grams: '', price: '' }
    ],
    settlements: {
      advance: { type: 'Dr', amount: '' },
      khata: { type: 'Dr', amount: '' },
      od: { type: 'Dr', amount: '' },
      expense: { type: 'Dr', amount: '' },
      festivalExpense: { type: 'Dr', amount: '' }
    },
    notes: ''
  });

  // Procurement single quick-form state
  const [procurementForm, setProcurementForm] = useState({
    menuItemId: '',
    grossKgAdded: '',
    purchasePricePerKg: '',
    supplierName: '',
    notes: ''
  });

  // Shrinkage form state
  const [shrinkageForm, setShrinkageForm] = useState({
    menuItemId: '',
    grossKgLost: '',
    reason: 'Ice Melt / Natural Drip Loss',
    notes: ''
  });

  // Dedicated Suppliers, Supply Categories & Consumables State
  const [registeredSuppliers, setRegisteredSuppliers] = useState([]);
  const [supplyCategories, setSupplyCategories] = useState([]);
  const [supplyLogs, setSupplyLogs] = useState([]);
  const [suppliesForm, setSuppliesForm] = useState({
    itemName: '',
    category: '',
    supplierId: '',
    supplierName: '',
    supplierPhone: '',
    companyName: '',
    vehicleNumber: '',
    harbor: '',
    quantity: '',
    unit: 'Pcs',
    unitRate: '',
    paidAmount: '',
    paymentMode: 'Cash',
    notes: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [isSubmittingSupply, setIsSubmittingSupply] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Pagination & Filter States
  const [overviewPage, setOverviewPage] = useState(1);
  const OVERVIEW_PER_PAGE = 10;
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 15;
  const [logTypeFilter, setLogTypeFilter] = useState('All');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
  const [suppliesPage, setSuppliesPage] = useState(1);
  const SUPPLIES_PER_PAGE = 8;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Helper to extract true Date & Time from log (handling ObjectId timestamp fallback)
  const formatLogDateTime = (log) => {
    let d = null;
    if (log.createdAt) {
      const candidate = new Date(log.createdAt);
      if (!isNaN(candidate.getTime())) d = candidate;
    }
    if (!d && log.date) {
      const candidate = new Date(log.date);
      if (!isNaN(candidate.getTime())) d = candidate;
    }
    if (!d && log.timestamp) {
      const candidate = new Date(log.timestamp);
      if (!isNaN(candidate.getTime())) d = candidate;
    }
    if (!d && log._id && typeof log._id === 'string' && log._id.length >= 8) {
      try {
        const ts = parseInt(log._id.substring(0, 8), 16) * 1000;
        const candidate = new Date(ts);
        if (!isNaN(candidate.getTime()) && candidate.getFullYear() > 2020 && candidate.getFullYear() < 2100) {
          d = candidate;
        }
      } catch (e) {}
    }
    if (!d) d = new Date();

    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return { dateStr, timeStr };
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const [invRes, logsRes, crmRes, suppliersData, categoriesData, supplyLogsData] = await Promise.all([
        axios.get(`${getApiUrl()}/inventory`, { headers: getAuthHeader() }),
        axios.get(`${getApiUrl()}/inventory/logs`, { headers: getAuthHeader(), params: { limit: 200 } }),
        axios.get(`${getApiUrl()}/crm/customers`, { headers: getAuthHeader() }).catch(() => ({ data: [] })),
        getSuppliers().catch(() => []),
        getSupplyCategories().catch(() => []),
        getSupplyLogs().catch(() => [])
      ]);

      if (Array.isArray(invRes.data)) setFishList(invRes.data);
      const rawLogs = Array.isArray(logsRes.data) ? logsRes.data : (logsRes.data?.data || []);
      setStockLogs(rawLogs);
      if (Array.isArray(crmRes.data)) setCrmCustomers(crmRes.data);
      if (Array.isArray(suppliersData)) setRegisteredSuppliers(suppliersData);
      if (Array.isArray(categoriesData)) setSupplyCategories(categoriesData);
      if (Array.isArray(supplyLogsData)) setSupplyLogs(supplyLogsData);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();

    const unsubStock = realtimeService.subscribe('fishStockUpdated', () => {
      fetchInventoryData();
    });
    const unsubBill = realtimeService.subscribe('billSettled', () => {
      fetchInventoryData();
    });

    return () => {
      if (unsubStock) unsubStock();
      if (unsubBill) unsubBill();
    };
  }, []);

  // Filter & Pagination for Overview
  const filteredFish = useMemo(() => {
    return fishList.filter(f => 
      f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.scientificName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fishList, searchTerm]);

  const totalOverviewPages = Math.ceil(filteredFish.length / OVERVIEW_PER_PAGE) || 1;
  const paginatedFish = useMemo(() => {
    const start = (overviewPage - 1) * OVERVIEW_PER_PAGE;
    return filteredFish.slice(start, start + OVERVIEW_PER_PAGE);
  }, [filteredFish, overviewPage]);

  // Filter & Pagination for Audit Trail Logs
  const filteredStockLogs = useMemo(() => {
    return stockLogs.filter(log => {
      // 1. Transaction Type Filter
      let matchesType = true;
      if (logTypeFilter !== 'All') {
        if (logTypeFilter === 'Stock-In') {
          matchesType = log.type?.includes('Procurement') || log.type?.includes('Stock-In');
        } else if (logTypeFilter === 'Shrinkage') {
          matchesType = log.type?.includes('Shrinkage') || log.type?.includes('Wastage');
        } else if (logTypeFilter === 'POS Sale') {
          matchesType = log.type === 'POS Sale';
        } else if (logTypeFilter === 'Online Sale') {
          matchesType = log.type === 'Online Sale';
        } else if (logTypeFilter === 'Refund') {
          matchesType = log.type?.includes('Refund') || log.type?.includes('Reversal');
        } else {
          matchesType = log.type === logTypeFilter;
        }
      }
      if (!matchesType) return false;

      // 2. Date Range Filter with robust timestamp resolution
      if (startDate || endDate) {
        let logTs = null;
        if (log.createdAt) logTs = new Date(log.createdAt).getTime();
        else if (log.date) logTs = new Date(log.date).getTime();
        else if (log.timestamp) logTs = new Date(log.timestamp).getTime();
        else if (log._id && typeof log._id === 'string' && log._id.length >= 8) {
          try {
            logTs = parseInt(log._id.substring(0, 8), 16) * 1000;
          } catch (e) {}
        }

        if (logTs) {
          if (startDate) {
            const startTs = new Date(`${startDate}T00:00:00`).getTime();
            if (logTs < startTs) return false;
          }
          if (endDate) {
            const endTs = new Date(`${endDate}T23:59:59.999`).getTime();
            if (logTs > endTs) return false;
          }
        }
      }

      // 3. Search Query Filter
      const q = logSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        log.itemName?.toLowerCase().includes(q) ||
        log.billNumber?.toLowerCase().includes(q) ||
        log.supplierName?.toLowerCase().includes(q) ||
        log.performedBy?.toLowerCase().includes(q)
      );
    });
  }, [stockLogs, logTypeFilter, logSearchQuery, startDate, endDate]);

  const totalLogsPages = Math.ceil(filteredStockLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * LOGS_PER_PAGE;
    return filteredStockLogs.slice(start, start + LOGS_PER_PAGE);
  }, [filteredStockLogs, logsPage]);

  // Supplies Intake Logs Pagination
  const totalSuppliesPages = Math.ceil(supplyLogs.length / SUPPLIES_PER_PAGE) || 1;
  const paginatedSupplyLogs = useMemo(() => {
    const start = (suppliesPage - 1) * SUPPLIES_PER_PAGE;
    return supplyLogs.slice(start, start + SUPPLIES_PER_PAGE);
  }, [supplyLogs, suppliesPage]);

  useEffect(() => {
    setOverviewPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setLogsPage(1);
  }, [logTypeFilter, logSearchQuery, startDate, endDate]);

  // ── Local Stock-In Realtime Multi-Item Calculations ──
  const localTotals = useMemo(() => {
    let totalKg = 0;
    let grossValue = 0;
    (localStockInForm.items || []).forEach(row => {
      let rowKg = 0;
      const b = Number(row.boxes || 0);
      const kpb = Number(row.kgPerBox || 0);
      if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
        rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
      } else if (b > 0 && kpb > 0) {
        rowKg = Number((b * kpb).toFixed(3));
      }
      const rowAmt = Number((rowKg * Number(row.ratePerKg || 0)).toFixed(2));
      totalKg += rowKg;
      grossValue += rowAmt;
    });

    const subtotal = Number((grossValue - Number(localStockInForm.iceCharges || 0) + Number(localStockInForm.boxTapeCharges || 0)).toFixed(2));
    const netPayable = Number((subtotal - Number(localStockInForm.advanceAmount || 0)).toFixed(2));

    return {
      totalKg: Number(totalKg.toFixed(3)),
      grossValue: Number(grossValue.toFixed(2)),
      subtotal,
      netPayable
    };
  }, [localStockInForm.items, localStockInForm.iceCharges, localStockInForm.boxTapeCharges, localStockInForm.advanceAmount]);

  // ── DAM Consignment Realtime Multi-Item Calculations ──
  const damTotals = useMemo(() => {
    let totalKg = 0;
    let catchTotal = 0;
    (damStockInForm.tallyItems || []).forEach(row => {
      let rowKg = 0;
      const b = Number(row.boxes || 0);
      const kpb = Number(row.kgPerBox || 0);
      if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
        rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
      } else if (b > 0 && kpb > 0) {
        rowKg = Number((b * kpb).toFixed(3));
      }
      const rowAmt = Number((rowKg * Number(row.price || 0)).toFixed(2));
      totalKg += rowKg;
      catchTotal += rowAmt;
    });

    let totalCr = 0;
    let totalDr = 0;
    Object.entries(damStockInForm.settlements).forEach(([key, s]) => {
      const amt = Number(s.amount || 0);
      if (s.type === 'Cr') totalCr += amt;
      else totalDr += amt;
    });

    const netSettlement = Number((catchTotal + totalCr - totalDr).toFixed(2));
    return {
      totalKg: Number(totalKg.toFixed(3)),
      catchTotal: Number(catchTotal.toFixed(2)),
      totalCr: Number(totalCr.toFixed(2)),
      totalDr: Number(totalDr.toFixed(2)),
      netSettlement
    };
  }, [damStockInForm.tallyItems, damStockInForm.settlements]);

  // ── Consumables & Supplies Realtime Calculations ──
  const supplyTotalCost = useMemo(() => {
    const q = parseFloat(suppliesForm.quantity) || 0;
    const r = parseFloat(suppliesForm.unitRate) || 0;
    return Number((q * r).toFixed(2));
  }, [suppliesForm.quantity, suppliesForm.unitRate]);

  const supplyBalanceDue = useMemo(() => {
    const paid = parseFloat(suppliesForm.paidAmount) || 0;
    return Number((Math.max(0, supplyTotalCost - paid)).toFixed(2));
  }, [supplyTotalCost, suppliesForm.paidAmount]);

  // ── Submit Handlers ──
  const handleLocalStockInSubmit = async (e) => {
    e.preventDefault();
    const validRows = (localStockInForm.items || []).filter(item => {
      const hasKg = Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0;
      const hasBoxes = Number(item.boxes || 0) > 0 && Number(item.kgPerBox || 0) > 0;
      return (item.menuItemId || item.itemName) && (hasKg || hasBoxes);
    });

    if (validRows.length === 0) {
      setMessage({ text: 'Please select a fish variety and enter boxes or weight (Kg).', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        supplierName: localStockInForm.supplierName,
        supplierPhone: localStockInForm.supplierPhone,
        companyName: localStockInForm.companyName,
        vehicleNumber: localStockInForm.vehicleNumber,
        harbor: localStockInForm.harbor,
        items: validRows,
        iceCharges: Number(localStockInForm.iceCharges || 0),
        boxTapeCharges: Number(localStockInForm.boxTapeCharges || 0),
        advanceAmount: Number(localStockInForm.advanceAmount || 0),
        notes: localStockInForm.notes
      };

      const res = await axios.post(`${getApiUrl()}/inventory/local-stock-in`, payload, { headers: getAuthHeader() });

      setMessage({ text: res.data.message || 'Local Fish Intake successfully recorded!', type: 'success' });
      setLocalStockInForm({
        supplierName: '',
        supplierPhone: '',
        companyName: '',
        vehicleNumber: '',
        harbor: '',
        items: [
          { id: 1, menuItemId: '', itemName: '', boxes: '', kgPerBox: 60, kg: '', grams: '', ratePerKg: '', sizeBracket: 'Medium', weightOption: '1+' }
        ],
        iceCharges: '',
        boxTapeCharges: '',
        advanceAmount: '',
        paymentMode: 'Cash',
        notes: ''
      });
      fetchInventoryData();
      setTimeout(() => setActiveTab('overview'), 1500);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to record Local Stock-In', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDamStockInSubmit = async (e) => {
    e.preventDefault();
    const validRows = (damStockInForm.tallyItems || []).filter(item => {
      const hasKg = Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0;
      const hasBoxes = Number(item.boxes || 0) > 0 && Number(item.kgPerBox || 0) > 0;
      return (item.menuItemId || item.itemName) && (hasKg || hasBoxes);
    });

    if (validRows.length === 0) {
      setMessage({ text: 'Please add at least one fish variety with boxes or weight (Kg).', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        contractorId: damStockInForm.contractorId,
        contractorName: damStockInForm.contractorName,
        contractorPhone: damStockInForm.contractorPhone,
        companyName: damStockInForm.companyName,
        vehicleNumber: damStockInForm.vehicleNumber,
        harbor: damStockInForm.harbor,
        tallyItems: validRows,
        settlements: damStockInForm.settlements,
        notes: damStockInForm.notes
      };

      const res = await axios.post(`${getApiUrl()}/inventory/dam-stock-in`, payload, { headers: getAuthHeader() });

      setMessage({ text: res.data.message || 'Dam Catch successfully recorded!', type: 'success' });
      setDamPrintVoucher({
        ...res.data.consignmentSummary,
        tallyItems: validRows,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      });
      setDamStockInForm({
        contractorId: '',
        contractorName: '',
        contractorPhone: '',
        companyName: '',
        vehicleNumber: '',
        harbor: '',
        contractorCity: '',
        tallyItems: [{ id: 1, menuItemId: '', itemName: '', boxes: '', kgPerBox: 60, kg: '', grams: '', price: '' }],
        settlements: {
          advance: { type: 'Dr', amount: '' },
          khata: { type: 'Dr', amount: '' },
          od: { type: 'Dr', amount: '' },
          expense: { type: 'Dr', amount: '' },
          festivalExpense: { type: 'Dr', amount: '' }
        },
        notes: ''
      });
      fetchInventoryData();
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to record Dam Stock-In', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      setIsCreatingCategory(true);
      const created = await createSupplyCategory(newCategoryName.trim());
      if (created) {
        setSupplyCategories(prev => {
          const exists = prev.some(c => c.name.toLowerCase() === created.name.toLowerCase());
          return exists ? prev : [...prev, created];
        });
        setSuppliesForm(prev => ({ ...prev, category: created.name }));
        setNewCategoryName('');
        setShowAddCategoryInput(false);
        setMessage({ text: `Category "${created.name}" created and saved!`, type: 'success' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.message || 'Failed to create category', type: 'error' });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSupplyStockInSubmit = async (e) => {
    e.preventDefault();
    if (!suppliesForm.itemName.trim()) {
      setMessage({ text: 'Item Name is required (e.g. 50Kg Thermocol Box, Ice Blocks)', type: 'error' });
      return;
    }
    if (!suppliesForm.category) {
      setMessage({ text: 'Please select or add a category', type: 'error' });
      return;
    }
    const qty = parseFloat(suppliesForm.quantity);
    if (!qty || qty <= 0) {
      setMessage({ text: 'Please enter a valid quantity', type: 'error' });
      return;
    }

    try {
      setIsSubmittingSupply(true);
      const payload = {
        itemName: suppliesForm.itemName.trim(),
        category: suppliesForm.category,
        supplierId: suppliesForm.supplierId || undefined,
        supplierName: suppliesForm.supplierName.trim() || undefined,
        supplierPhone: suppliesForm.supplierPhone.trim() || undefined,
        companyName: suppliesForm.companyName.trim() || undefined,
        vehicleNumber: suppliesForm.vehicleNumber.trim() || undefined,
        harbor: suppliesForm.harbor.trim() || undefined,
        quantity: qty,
        unit: suppliesForm.unit || 'Pcs',
        unitRate: parseFloat(suppliesForm.unitRate) || 0,
        paidAmount: parseFloat(suppliesForm.paidAmount) || 0,
        paymentMode: suppliesForm.paymentMode || 'Cash',
        notes: suppliesForm.notes.trim() || undefined
      };

      await recordSupplyStockIn(payload);
      setMessage({ text: `Supplies Stock-In recorded for "${payload.itemName}"!`, type: 'success' });

      setSuppliesForm(prev => ({
        itemName: '',
        category: prev.category,
        supplierId: '',
        supplierName: '',
        supplierPhone: '',
        companyName: '',
        vehicleNumber: '',
        harbor: '',
        quantity: '',
        unit: 'Pcs',
        unitRate: '',
        paidAmount: '',
        paymentMode: 'Cash',
        notes: ''
      }));

      const updatedLogs = await getSupplyLogs().catch(() => []);
      if (Array.isArray(updatedLogs)) setSupplyLogs(updatedLogs);
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.message || 'Failed to record supplies stock-in', type: 'error' });
    } finally {
      setIsSubmittingSupply(false);
    }
  };

  const handleShrinkageSubmit = async (e) => {
    e.preventDefault();
    if (!shrinkageForm.menuItemId || !shrinkageForm.grossKgLost) {
      setMessage({ text: 'Please select a fish and enter shrinkage weight.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(`${getApiUrl()}/inventory/shrinkage`, shrinkageForm, {
        headers: getAuthHeader()
      });

      setMessage({ text: 'Shrinkage adjustment successfully recorded', type: 'success' });
      setShrinkageForm({
        menuItemId: '',
        grossKgLost: '',
        reason: 'Ice Melt / Natural Drip Loss',
        notes: ''
      });
      fetchInventoryData();
      setTimeout(() => setActiveTab('overview'), 1200);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to record shrinkage', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const totalStockKg = fishList.reduce((acc, f) => acc + (Number(f.stock) || 0), 0);
  const lowStockCount = fishList.filter(f => (Number(f.stock) || 0) <= (Number(f.minStockAlertKg) || 5)).length;
  const totalCratesEqv = (totalStockKg / 50).toFixed(1);

  return (
    <div className="p-2 sm:p-3 md:p-4 space-y-3 w-full text-slate-800">
      {/* Top Header Card (Compact & Mobile-Responsive Header) */}
      <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl p-2.5 sm:px-3.5 sm:py-2.5 shadow-2xs w-full">
        <div className="flex items-center justify-between gap-2">
          {/* Left Title & Branding */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            {onGoBack && <BackButton onClick={onGoBack} label="Back" />}
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-100 text-[#ea580c] border border-orange-200 flex items-center justify-center shrink-0 shadow-xs">
              <Package size={15} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight leading-tight m-0 truncate">
                  Fish Inventory & Catch Ledger
                </h1>
                <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                  Live Cold Storage
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium m-0 mt-0.5 truncate hidden sm:block">
                Current storage inventory, catch unloading, and stock movements
              </p>
            </div>
          </div>

          {/* Right Refresh Action */}
          <button
            onClick={fetchInventoryData}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
            title="Refresh Inventory"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span className="hidden xs:inline sm:inline">Refresh</span>
          </button>
        </div>

        {/* Mobile subtitle row */}
        <p className="text-[10px] text-slate-500 font-medium m-0 mt-1.5 sm:hidden border-t border-[#fed7aa]/30 pt-1">
          Current storage inventory, catch unloading, and stock movements
        </p>
      </div>

      {/* KPI Cards Strip (Two cards per row on mobile, 4 on desktop, Medium Density) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3 w-full">
        {/* Card 1: Total Fish Stock */}
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl p-2.5 sm:px-3 sm:py-2.5 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate block">Total Fish Stock</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-sky-800 font-mono leading-tight mt-0.5 truncate">
              {totalStockKg.toFixed(1)} <span className="text-[10px] sm:text-xs font-semibold text-slate-500">Kg</span>
            </div>
          </div>
          <div className="p-1.5 sm:p-2 bg-sky-100 text-sky-700 rounded-lg border border-sky-200 shrink-0 ml-1.5">
            <Scale size={15} />
          </div>
        </div>

        {/* Card 2: Active Varieties */}
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl p-2.5 sm:px-3 sm:py-2.5 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate block">Active Varieties</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-emerald-800 font-mono leading-tight mt-0.5 truncate">
              {fishList.length} <span className="text-[10px] sm:text-xs font-semibold text-slate-500">Items</span>
            </div>
          </div>
          <div className="p-1.5 sm:p-2 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 shrink-0 ml-1.5">
            <ShieldCheck size={15} />
          </div>
        </div>

        {/* Card 3: Low Stock Alert */}
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl p-2.5 sm:px-3 sm:py-2.5 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate block">Low Stock Alert</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-amber-800 font-mono leading-tight mt-0.5 truncate">
              {lowStockCount} <span className="text-[10px] sm:text-xs font-semibold text-slate-500">Varieties</span>
            </div>
          </div>
          <div className="p-1.5 sm:p-2 bg-amber-100 text-amber-700 rounded-lg border border-amber-200 shrink-0 ml-1.5">
            <AlertTriangle size={15} />
          </div>
        </div>

        {/* Card 4: Cold Storage Crates */}
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl p-2.5 sm:px-3 sm:py-2.5 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate block">Storage Crates</span>
            <div className="text-sm sm:text-base md:text-lg font-black text-orange-800 font-mono leading-tight mt-0.5 truncate">
              ~{totalCratesEqv} <span className="text-[10px] sm:text-xs font-semibold text-slate-500">Boxes</span>
            </div>
          </div>
          <div className="p-1.5 sm:p-2 bg-orange-100 text-[#ea580c] rounded-lg border border-orange-200 shrink-0 ml-1.5">
            <Package size={15} />
          </div>
        </div>
      </div>

      {/* Tabs & Top-Right Pagination Bar (Same Line on Desktop, Clean 2-Row on Tablet/Mobile) */}
      <div className="bg-[#FDFBF7] p-2 sm:p-2.5 rounded-2xl border border-[#E8DCCB] shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 sm:gap-3 w-full">
        {/* Left: Tab Buttons */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none shrink-0">
          {[
            { id: 'overview', label: 'Stock Ledger', icon: Package },
            { id: 'procurement', label: 'Catch Stock-In', icon: ArrowDownLeft },
            { id: 'shrinkage', label: 'Log Shrinkage', icon: TrendingDown },
            { id: 'logs', label: 'Audit Trail', icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMessage({ text: '', type: '' }); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Corner: Controls on the exact same line as tabs on XL, stacked cleanly on Tab/Mobile */}
        {activeTab === 'overview' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-end gap-2 w-full xl:w-auto border-t xl:border-t-0 pt-2 xl:pt-0 border-[#fed7aa]/40">
            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fish species..."
                className="w-full bg-white border border-[#E8DCCB] rounded-xl pl-7 pr-2.5 py-1.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
              />
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 whitespace-nowrap">
                {filteredFish.length} items • Page {overviewPage} of {totalOverviewPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={overviewPage <= 1}
                  onClick={() => setOverviewPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  disabled={overviewPage >= totalOverviewPages}
                  onClick={() => setOverviewPage(p => Math.min(totalOverviewPages, p + 1))}
                  className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex items-center justify-between xl:justify-end gap-2 w-full xl:w-auto border-t xl:border-t-0 pt-2 xl:pt-0 border-[#fed7aa]/40">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 whitespace-nowrap">
              {filteredStockLogs.length} logs • Page {logsPage} of {totalLogsPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={logsPage <= 1}
                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={logsPage >= totalLogsPages}
                onClick={() => setLogsPage(p => Math.min(totalLogsPages, p + 1))}
                className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {activeTab === 'procurement' && (
          <div className="flex items-center justify-between xl:justify-end gap-2 w-full xl:w-auto border-t xl:border-t-0 pt-2 xl:pt-0 border-[#fed7aa]/40">
            <span className="text-[11px] text-slate-500 font-bold">Unloading Mode:</span>
            <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-[#ea580c] border border-orange-200 uppercase text-[10px] font-black">
              {stockInSubTab === 'local' ? 'Local Catch' : stockInSubTab === 'dam' ? 'Dam Catch' : 'Packaging & Supplies'}
            </span>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {message.text && (
        <Toast
          message={message.text}
          type={message.type === 'error' ? 'error' : 'success'}
          duration={3000}
          onClose={() => setMessage({ text: '', type: '' })}
        />
      )}

      {/* ── TAB 1: Stock Overview (Full Width Table with Medium-Scaled Fonts) ── */}
      {activeTab === 'overview' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl overflow-hidden shadow-2xs w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-[#FAF0E4] border-b border-[#fed7aa] uppercase tracking-wider text-[11px] sm:text-xs font-black text-slate-700">
                <tr>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[34%] min-w-[260px] md:min-w-[300px]">Fish Variety</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[13%] min-w-[95px] whitespace-nowrap">Current Stock</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[13%] min-w-[105px] whitespace-nowrap">Stock Status</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[11%] min-w-[85px] whitespace-nowrap">Rate / Kg</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[14%] min-w-[105px] whitespace-nowrap">Crate Equivalent</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[15%] min-w-[130px] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#fed7aa]/40 font-medium">
                {paginatedFish.map((fish) => {
                  const currentStock = Number(fish.stock) || 0;
                  const minAlert = Number(fish.minStockAlertKg) || 5;
                  const isLow = currentStock <= minAlert;
                  const isOut = currentStock <= 0;
                  const crateSize = Number(fish.boxNetFishKg || (fish.boxPackingKg ? fish.boxPackingKg - 10 : 50));
                  const crates = crateSize > 0 ? (currentStock / crateSize).toFixed(1) : 0;

                  return (
                    <tr key={fish._id} className="hover:bg-[#FAF3E8] transition-colors">
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug whitespace-normal break-words">
                          {fish.name}
                        </div>
                        {fish.lastSupplier && (
                          <div className="text-[10px] sm:text-[11px] text-sky-700 font-bold mt-0.5">
                            Supplier: {fish.lastSupplier}
                          </div>
                        )}
                        {fish.scientificName && (
                          <div className="text-[10px] sm:text-[11px] text-slate-500 italic font-medium">
                            {fish.scientificName}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
                        {currentStock.toFixed(2)} <span className="text-[10.5px] sm:text-xs font-semibold text-slate-500">Kg</span>
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 whitespace-nowrap">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                            Sold Out
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                            Low (&le; {minAlert}kg)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                            Healthy Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono text-emerald-800 font-bold text-xs sm:text-sm whitespace-nowrap">
                        ₹{Number(fish.price || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-slate-700 text-[11px] sm:text-xs font-medium whitespace-nowrap">
                        ~{crates} Crates <span className="text-[10px] sm:text-[11px] text-slate-400">({crateSize}kg/box)</span>
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-right space-x-1 sm:space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setLocalStockInForm(prev => ({
                              ...prev,
                              items: [{ id: 1, menuItemId: fish._id, itemName: fish.name, boxes: '', kgPerBox: 60, kg: '', grams: '', ratePerKg: fish.purchasePrice || '', sizeBracket: 'Medium', weightOption: '1+' }]
                            }));
                            setStockInSubTab('local');
                            setActiveTab('procurement');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#ea580c] border border-orange-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          + Stock-In
                        </button>
                        <button
                          onClick={() => {
                            setShrinkageForm(prev => ({ ...prev, menuItemId: fish._id }));
                            setActiveTab('shrinkage');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          - Shrinkage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination */}
          <div className="p-3 sm:p-4 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm text-slate-600">
            <span className="font-medium">
              Showing {(overviewPage - 1) * OVERVIEW_PER_PAGE + 1} to {Math.min(filteredFish.length, overviewPage * OVERVIEW_PER_PAGE)} of {filteredFish.length} varieties
            </span>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={overviewPage <= 1}
                onClick={() => setOverviewPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm font-black font-mono text-amber-900">
                {overviewPage} / {totalOverviewPages}
              </span>
              <button
                type="button"
                disabled={overviewPage >= totalOverviewPages}
                onClick={() => setOverviewPage(p => Math.min(totalOverviewPages, p + 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Catch Stock-In (Full Width Engine) ── */}
      {activeTab === 'procurement' && (
        <div className="space-y-4 w-full">
          {/* Sub-channel Toggle: Clean Buttons */}
          <div className="bg-[#FAF0E4] p-1.5 rounded-2xl border border-[#fed7aa] flex items-center gap-2 max-w-xl mx-auto shadow-xs">
            <button
              type="button"
              onClick={() => setStockInSubTab('local')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                stockInSubTab === 'local'
                  ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>📍 Local Catch</span>
            </button>
            <button
              type="button"
              onClick={() => setStockInSubTab('dam')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                stockInSubTab === 'dam'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>🌊 Dam Catch</span>
            </button>
            <button
              type="button"
              onClick={() => setStockInSubTab('supplies')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                stockInSubTab === 'supplies'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>📦 Supplies & Boxes</span>
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════ */}
          {/* SUB-TAB 1: LOCAL FISH CATCH INTAKE (MULTI-FISH & BOXES)  */}
          {/* ════════════════════════════════════════════════════════ */}
          {stockInSubTab === 'local' && (
            <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5 w-full">
              <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2 m-0">
                    <span className="p-1.5 bg-orange-100 text-[#ea580c] rounded-lg">📍</span>
                    <span>Local Fish Intake / Weighment</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium m-0">
                    Record multiple fish varieties, boxes, and scale weights received from local harbor landings or fishermen.
                  </p>
                </div>
              </div>

              <form onSubmit={handleLocalStockInSubmit} className="space-y-4">
                {/* 1. Supplier Details (5 Fields with Autocomplete) */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="text-xs font-black text-[#c2410c] uppercase tracking-wide flex items-center gap-1.5">
                    <User size={14} />
                    <span>Local Fisherman / Landing Supplier Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Supplier / Boat Name *
                      </label>
                      <input
                        type="text"
                        list="local-suppliers-list"
                        placeholder="e.g. Anand Fishermen"
                        value={localStockInForm.supplierName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const regFound = registeredSuppliers.find(s =>
                            s.name?.toLowerCase() === val.toLowerCase() ||
                            s.companyName?.toLowerCase() === val.toLowerCase()
                          );
                          const crmFound = crmCustomers.find(c => c.name?.toLowerCase() === val.toLowerCase());
                          setLocalStockInForm(prev => ({
                            ...prev,
                            supplierName: val,
                            supplierPhone: regFound?.phone || crmFound?.phone || prev.supplierPhone,
                            companyName: regFound?.companyName || prev.companyName,
                            vehicleNumber: regFound?.vehicleNumber || prev.vehicleNumber,
                            harbor: regFound?.harbor || regFound?.city || prev.harbor
                          }));
                        }}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
                      />
                      <datalist id="local-suppliers-list">
                        {registeredSuppliers.filter(s => s.supplierType === 'Local' || s.supplierType === 'All' || !s.supplierType).map(s => (
                          <option key={s._id} value={s.name}>
                            {s.companyName ? `${s.companyName} | ` : ''}{s.phone ? `Ph: ${s.phone}` : ''}{s.vehicleNumber ? ` | Veh: ${s.vehicleNumber}` : ''}{s.harbor ? ` | Harbor: ${s.harbor}` : ''}
                          </option>
                        ))}
                        {crmCustomers.map(c => (
                          <option key={c._id} value={c.name}>{c.phone ? `(${c.phone})` : ''}</option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={localStockInForm.supplierPhone}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, supplierPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Company / Boat Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Boat #4 Sea Hunter"
                        value={localStockInForm.companyName}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, companyName: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Vehicle Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AP 04 TX 4821"
                        value={localStockInForm.vehicleNumber}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, vehicleNumber: e.target.value.toUpperCase() })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c] uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Harbor / Origin Port
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mangalore Port"
                        value={localStockInForm.harbor}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, harbor: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Multi-Fish Intake Table with Boxes */}
                <div className="border border-[#fed7aa] rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="p-3 bg-[#FAF0E4] border-b border-[#fed7aa] flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Scale size={14} className="text-[#ea580c]" />
                      <span>Fish Items Unloaded ({localStockInForm.items.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalStockInForm(prev => ({
                          ...prev,
                          items: [
                            ...prev.items,
                            { id: Date.now(), menuItemId: '', itemName: '', boxes: '', kgPerBox: 60, kg: '', grams: '', ratePerKg: '', sizeBracket: 'Medium', weightOption: '1+' }
                          ]
                        }));
                      }}
                      className="px-3 py-1 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={13} />
                      <span>Add Fish Item</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead className="bg-[#FDFBF7] text-slate-700 font-black border-b border-[#fed7aa]/50 text-[11px] sm:text-xs uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Fish Species Variety *</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px]">Boxes</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px]">Kg / Box</th>
                          <th className="py-2.5 px-3 text-center min-w-[120px]">Scale Weight (Kg + Gm)</th>
                          <th className="py-2.5 px-3 text-right min-w-[100px]">Rate (₹/Kg)</th>
                          <th className="py-2.5 px-3 text-right min-w-[100px]">Total (₹)</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#fed7aa]/30">
                        {localStockInForm.items.map((row, idx) => {
                          let rowKg = 0;
                          const b = Number(row.boxes || 0);
                          const kpb = Number(row.kgPerBox || 0);
                          if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                            rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
                          } else if (b > 0 && kpb > 0) {
                            rowKg = Number((b * kpb).toFixed(3));
                          }
                          const rowTotal = Number((rowKg * Number(row.ratePerKg || 0)).toFixed(2));

                          return (
                            <tr key={row.id || idx} className="hover:bg-amber-50/30">
                              <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <select
                                  value={row.menuItemId}
                                  onChange={(e) => {
                                    const selId = e.target.value;
                                    const sel = fishList.find(f => f._id === selId);
                                    const updated = [...localStockInForm.items];
                                    updated[idx] = {
                                      ...updated[idx],
                                      menuItemId: selId,
                                      itemName: sel?.name || '',
                                      ratePerKg: sel?.purchasePrice ? String(sel.purchasePrice) : updated[idx].ratePerKg,
                                      kgPerBox: sel?.boxPackingKg || 60
                                    };
                                    setLocalStockInForm({ ...localStockInForm, items: updated });
                                  }}
                                  required
                                  className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                                >
                                  <option value="">-- Choose Fish Variety --</option>
                                  {fishList.map(f => (
                                    <option key={f._id} value={f._id}>{f.name} (Stock: {f.stock || 0}kg)</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={row.boxes}
                                  onChange={(e) => {
                                    const updated = [...localStockInForm.items];
                                    updated[idx].boxes = e.target.value;
                                    setLocalStockInForm({ ...localStockInForm, items: updated });
                                  }}
                                  className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  placeholder="60"
                                  value={row.kgPerBox}
                                  onChange={(e) => {
                                    const updated = [...localStockInForm.items];
                                    updated[idx].kgPerBox = e.target.value;
                                    setLocalStockInForm({ ...localStockInForm, items: updated });
                                  }}
                                  className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="Kg"
                                    value={row.kg}
                                    onChange={(e) => {
                                      const updated = [...localStockInForm.items];
                                      updated[idx].kg = e.target.value;
                                      setLocalStockInForm({ ...localStockInForm, items: updated });
                                    }}
                                    className="w-16 bg-white border border-[#E8DCCB] rounded-lg px-1.5 py-1.5 text-xs text-center font-mono font-bold text-slate-800"
                                  />
                                  <span className="text-[10px] text-slate-400">+</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="999"
                                    placeholder="Gm"
                                    value={row.grams}
                                    onChange={(e) => {
                                      const updated = [...localStockInForm.items];
                                      updated[idx].grams = e.target.value;
                                      setLocalStockInForm({ ...localStockInForm, items: updated });
                                    }}
                                    className="w-14 bg-white border border-[#E8DCCB] rounded-lg px-1 py-1.5 text-xs text-center font-mono font-bold text-slate-800"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="₹/Kg"
                                  value={row.ratePerKg}
                                  onChange={(e) => {
                                    const updated = [...localStockInForm.items];
                                    updated[idx].ratePerKg = e.target.value;
                                    setLocalStockInForm({ ...localStockInForm, items: updated });
                                  }}
                                  className="w-20 bg-white border border-[#E8DCCB] rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black text-emerald-800">
                                ₹{rowTotal.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {localStockInForm.items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLocalStockInForm({
                                        ...localStockInForm,
                                        items: localStockInForm.items.filter((_, i) => i !== idx)
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Deductions & Net Settlement Summary */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Ice Charges (-) ₹</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={localStockInForm.iceCharges}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, iceCharges: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Box & Tape Charges (+/-) ₹</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={localStockInForm.boxTapeCharges}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, boxTapeCharges: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Advance Deducted (-) ₹</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={localStockInForm.advanceAmount}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, advanceAmount: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                      <select
                        value={localStockInForm.paymentMode}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, paymentMode: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI / GPay</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Credit">Credit (Pay Later)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 p-4 rounded-xl border border-orange-200 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-900 uppercase tracking-wide">
                        Local Catch Settlement Summary
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>Total Weight: <strong className="font-mono text-slate-800">{localTotals.totalKg} Kg</strong></span>
                        <span>• Gross: <strong className="font-mono text-slate-800">₹{localTotals.grossValue.toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-500">Net Payable to Fisherman</div>
                      <div className="text-2xl font-black font-mono text-[#c2410c]">
                        ₹{localTotals.netPayable.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Catch Notes / Landing Details</label>
                  <input
                    type="text"
                    placeholder="e.g. Morning fresh boat catch, landing lot #12"
                    value={localStockInForm.notes}
                    onChange={(e) => setLocalStockInForm({ ...localStockInForm, notes: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-[#c2410c] text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  <span>{submitting ? 'Recording Catch...' : 'Confirm & Record Local Fish Stock-In'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* SUB-TAB 2: DAM CATCH UNLOADING (MULTI-FISH CONSIGNMENT)  */}
          {/* ════════════════════════════════════════════════════════ */}
          {stockInSubTab === 'dam' && (
            <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5 w-full">
              <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2 m-0">
                    <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">🌊</span>
                    <span>Dam Catch Unloading</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium m-0">
                    Record multi-variety fish shipments received from dam syndicates and reservoir contractors.
                  </p>
                </div>
              </div>

              <form onSubmit={handleDamStockInSubmit} className="space-y-4">
                {/* 1. Contractor Details (5 Fields with Autocomplete) */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                    <User size={14} />
                    <span>Dam Contractor / Syndicate Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Contractor Name *
                      </label>
                      <input
                        type="text"
                        list="dam-contractors-list"
                        placeholder="e.g. Srisailam Fishery Syndicate"
                        value={damStockInForm.contractorName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const regFound = registeredSuppliers.find(s =>
                            s.name?.toLowerCase() === val.toLowerCase() ||
                            s.companyName?.toLowerCase() === val.toLowerCase()
                          );
                          const crmFound = crmCustomers.find(c => c.name?.toLowerCase() === val.toLowerCase());
                          setDamStockInForm(prev => ({
                            ...prev,
                            contractorName: val,
                            contractorId: regFound?._id || crmFound?._id || prev.contractorId,
                            contractorPhone: regFound?.phone || crmFound?.phone || prev.contractorPhone,
                            companyName: regFound?.companyName || prev.companyName,
                            vehicleNumber: regFound?.vehicleNumber || prev.vehicleNumber,
                            harbor: regFound?.harbor || regFound?.city || crmFound?.address?.city || prev.harbor
                          }));
                        }}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                      <datalist id="dam-contractors-list">
                        {registeredSuppliers.filter(s => s.supplierType === 'DAM' || s.supplierType === 'All').map(s => (
                          <option key={s._id} value={s.name}>
                            {s.companyName ? `${s.companyName} | ` : ''}{s.phone ? `Ph: ${s.phone}` : ''}{s.vehicleNumber ? ` | Veh: ${s.vehicleNumber}` : ''}{s.harbor ? ` | Loc: ${s.harbor}` : ''}
                          </option>
                        ))}
                        {crmCustomers.filter(c => c.category === 'Export' || c.category === 'Wholesale' || c.exportSubCategory === 'DAM').map(c => (
                          <option key={c._id} value={c.name}>{c.phone ? `(${c.phone})` : ''}</option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Contact Phone</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={damStockInForm.contractorPhone}
                        onChange={(e) => setDamStockInForm({ ...damStockInForm, contractorPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Syndicate / Firm Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Reservoir Syndicate"
                        value={damStockInForm.companyName}
                        onChange={(e) => setDamStockInForm({ ...damStockInForm, companyName: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Number</label>
                      <input
                        type="text"
                        placeholder="e.g. AP 04 TX 4821"
                        value={damStockInForm.vehicleNumber}
                        onChange={(e) => setDamStockInForm({ ...damStockInForm, vehicleNumber: e.target.value.toUpperCase() })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500 uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Dam / Reservoir Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Srisailam, Nagarjuna Sagar"
                        value={damStockInForm.harbor}
                        onChange={(e) => setDamStockInForm({ ...damStockInForm, harbor: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Multi-Fish Tally Table with Boxes */}
                <div className="border border-[#fed7aa] rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="p-3 bg-[#FAF0E4] border-b border-[#fed7aa] flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Scale size={14} className="text-blue-700" />
                      <span>Consignment Fish Varieties ({damStockInForm.tallyItems.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDamStockInForm(prev => ({
                          ...prev,
                          tallyItems: [
                            ...prev.tallyItems,
                            { id: Date.now(), menuItemId: '', itemName: '', boxes: '', kgPerBox: 60, kg: '', grams: '', price: '' }
                          ]
                        }));
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus size={13} />
                      <span>Add Fish Lot Row</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead className="bg-[#FDFBF7] text-slate-700 font-black border-b border-[#fed7aa]/50 text-[11px] sm:text-xs uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Fish Species Variety *</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px]">Boxes</th>
                          <th className="py-2.5 px-3 text-center min-w-[90px]">Kg / Box</th>
                          <th className="py-2.5 px-3 text-center min-w-[120px]">Scale Weight (Kg + Gm)</th>
                          <th className="py-2.5 px-3 text-right min-w-[100px]">Rate (₹/Kg)</th>
                          <th className="py-2.5 px-3 text-right min-w-[100px]">Total (₹)</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#fed7aa]/30">
                        {damStockInForm.tallyItems.map((row, idx) => {
                          let rowKg = 0;
                          const b = Number(row.boxes || 0);
                          const kpb = Number(row.kgPerBox || 0);
                          if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                            rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
                          } else if (b > 0 && kpb > 0) {
                            rowKg = Number((b * kpb).toFixed(3));
                          }
                          const rowTotal = Number((rowKg * Number(row.price || 0)).toFixed(2));

                          return (
                            <tr key={row.id || idx} className="hover:bg-blue-50/20">
                              <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <select
                                  value={row.menuItemId}
                                  onChange={(e) => {
                                    const selId = e.target.value;
                                    const sel = fishList.find(f => f._id === selId);
                                    const updated = [...damStockInForm.tallyItems];
                                    updated[idx] = {
                                      ...updated[idx],
                                      menuItemId: selId,
                                      itemName: sel?.name || '',
                                      price: sel?.purchasePrice ? String(sel.purchasePrice) : updated[idx].price,
                                      kgPerBox: sel?.boxPackingKg || 60
                                    };
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  required
                                  className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                >
                                  <option value="">-- Choose Fish Variety --</option>
                                  {fishList.map(f => (
                                    <option key={f._id} value={f._id}>{f.name} (Stock: {f.stock || 0}kg)</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={row.boxes}
                                  onChange={(e) => {
                                    const updated = [...damStockInForm.tallyItems];
                                    updated[idx].boxes = e.target.value;
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  placeholder="60"
                                  value={row.kgPerBox}
                                  onChange={(e) => {
                                    const updated = [...damStockInForm.tallyItems];
                                    updated[idx].kgPerBox = e.target.value;
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2 py-1.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="Kg"
                                    value={row.kg}
                                    onChange={(e) => {
                                      const updated = [...damStockInForm.tallyItems];
                                      updated[idx].kg = e.target.value;
                                      setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                    }}
                                    className="w-16 bg-white border border-[#E8DCCB] rounded-lg px-1.5 py-1.5 text-xs text-center font-mono font-bold text-slate-800"
                                  />
                                  <span className="text-[10px] text-slate-400">+</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="999"
                                    placeholder="Gm"
                                    value={row.grams}
                                    onChange={(e) => {
                                      const updated = [...damStockInForm.tallyItems];
                                      updated[idx].grams = e.target.value;
                                      setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                    }}
                                    className="w-14 bg-white border border-[#E8DCCB] rounded-lg px-1 py-1.5 text-xs text-center font-mono font-bold text-slate-800"
                                  />
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="₹/Kg"
                                  value={row.price}
                                  onChange={(e) => {
                                    const updated = [...damStockInForm.tallyItems];
                                    updated[idx].price = e.target.value;
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  className="w-20 bg-white border border-[#E8DCCB] rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-black text-blue-800">
                                ₹{rowTotal.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {damStockInForm.tallyItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDamStockInForm({
                                        ...damStockInForm,
                                        tallyItems: damStockInForm.tallyItems.filter((_, i) => i !== idx)
                                      });
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Deductions & Account Settlements */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wide">
                    Settlement & Advance Deductions
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { key: 'advance', label: '1) Advance' },
                      { key: 'khata', label: '2) Khata' },
                      { key: 'od', label: '3) OD / Transport' },
                      { key: 'expense', label: '4) Depot Expense' },
                      { key: 'festivalExpense', label: '5) Other Expense' }
                    ].map(item => {
                      const entry = damStockInForm.settlements[item.key] || { type: 'Dr', amount: '' };
                      const isCr = entry.type === 'Cr';

                      return (
                        <div key={item.key} className="bg-white p-2.5 rounded-xl border border-[#fed7aa] space-y-1.5 shadow-2xs">
                          <div className="text-[11px] font-bold text-slate-700 truncate">{item.label}</div>
                          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setDamStockInForm({
                                  ...damStockInForm,
                                  settlements: { ...damStockInForm.settlements, [item.key]: { ...entry, type: 'Cr' } }
                                });
                              }}
                              className={`py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                isCr ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              + Cr
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDamStockInForm({
                                  ...damStockInForm,
                                  settlements: { ...damStockInForm.settlements, [item.key]: { ...entry, type: 'Dr' } }
                                });
                              }}
                              className={`py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                !isCr ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              - Dr
                            </button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={entry.amount}
                            onChange={(e) => {
                              setDamStockInForm({
                                ...damStockInForm,
                                settlements: { ...damStockInForm.settlements, [item.key]: { ...entry, amount: e.target.value } }
                              });
                            }}
                            className={`w-full p-1 bg-slate-50 border rounded-lg text-xs font-mono font-bold text-center ${
                              isCr ? 'border-emerald-300 text-emerald-800' : 'border-rose-300 text-rose-800'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-4 rounded-xl border border-blue-200 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-800 uppercase tracking-wide">
                        Dam Consignment Net Settlement
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span>Total Weight: <strong className="font-mono text-slate-800">{damTotals.totalKg} Kg</strong></span>
                        <span>• Catch: <strong className="font-mono text-slate-800">₹{damTotals.catchTotal.toLocaleString('en-IN')}</strong></span>
                        <span>• Deductions: <strong className="font-mono text-rose-700">-₹{damTotals.totalDr.toLocaleString('en-IN')}</strong></span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-500">
                        {damTotals.netSettlement >= 0 ? 'Payable to Contractor' : 'Contractor Balance Due'}
                      </div>
                      <div className={`text-2xl font-black font-mono ${damTotals.netSettlement >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                        ₹{Math.abs(damTotals.netSettlement).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Catch Notes / Lot Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Srisailam reservoir lot #A, weighed at depot platform"
                    value={damStockInForm.notes}
                    onChange={(e) => setDamStockInForm({ ...damStockInForm, notes: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    <span>{submitting ? 'Recording Consignment...' : 'Confirm & Record Dam Stock-In'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const validRows = (damStockInForm.tallyItems || []).filter(
                        r => (Number(r.kg || 0) + Number(r.grams || 0)) > 0 || (Number(r.boxes || 0) > 0 && Number(r.kgPerBox || 0) > 0)
                      );
                      setDamPrintVoucher({
                        contractorName: damStockInForm.contractorName || 'DAM Contractor',
                        contractorPhone: damStockInForm.contractorPhone,
                        companyName: damStockInForm.companyName,
                        vehicleNumber: damStockInForm.vehicleNumber,
                        harbor: damStockInForm.harbor,
                        totalGrossKg: damTotals.totalKg,
                        catchTotalValue: damTotals.catchTotal,
                        totalCredits: damTotals.totalCr,
                        totalDebits: damTotals.totalDr,
                        netConsignmentSettlement: damTotals.netSettlement,
                        settlementDetails: damStockInForm.settlements,
                        tallyItems: validRows,
                        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                      });
                    }}
                    className="px-4 py-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Print Catch Receipt"
                  >
                    <Printer size={15} />
                    <span className="hidden sm:inline">Print Voucher</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* SUB-TAB 3: SUPPLIES & PACKAGING INTAKE                   */}
          {/* ════════════════════════════════════════════════════════ */}
          {stockInSubTab === 'supplies' && (
            <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5 w-full">
              <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2 m-0">
                    <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">📦</span>
                    <span>Packaging & Depot Supplies Intake</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium m-0">
                    Record intake of thermocol boxes, ice blocks, tapes, crates, and depot packaging materials.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSupplyStockInSubmit} className="space-y-4">
                {/* 1. Category Hybrid Select & Item Name */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Package size={14} />
                      <span>Consumable Category *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAddCategoryInput(!showAddCategoryInput)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                    >
                      {showAddCategoryInput ? 'Cancel' : '+ Add New Category'}
                    </button>
                  </div>

                  {showAddCategoryInput && (
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-300">
                      <input
                        type="text"
                        placeholder="e.g. Foam Sheets, Strapping Rolls, Salt Bags"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="flex-1 bg-white border border-emerald-400 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isCreatingCategory || !newCategoryName.trim()}
                        onClick={handleCreateCategory}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isCreatingCategory ? 'Saving...' : 'Save Category'}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <select
                        value={suppliesForm.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'ADD_NEW') {
                            setShowAddCategoryInput(true);
                          } else {
                            setSuppliesForm({ ...suppliesForm, category: val });
                          }
                        }}
                        required
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">-- Choose Category --</option>
                        {supplyCategories.map(cat => (
                          <option key={cat._id || cat.name} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                        <option value="ADD_NEW" className="font-bold text-emerald-700">
                          ➕ + Add Custom Category...
                        </option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Item Name (e.g. 50Kg Thermocol Box, 100Kg Ice Blocks)"
                        value={suppliesForm.itemName}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, itemName: e.target.value })}
                        required
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Supplier Details (5 Fields with Autocomplete) */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <User size={14} />
                    <span>Packaging / Consumables Supplier Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Supplier / Shop Name
                      </label>
                      <input
                        type="text"
                        list="supplies-suppliers-list"
                        placeholder="e.g. Sri Balaji Ice Factory"
                        value={suppliesForm.supplierName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const regFound = registeredSuppliers.find(s =>
                            s.name?.toLowerCase() === val.toLowerCase() ||
                            s.companyName?.toLowerCase() === val.toLowerCase()
                          );
                          setSuppliesForm(prev => ({
                            ...prev,
                            supplierName: val,
                            supplierId: regFound?._id || '',
                            supplierPhone: regFound?.phone || prev.supplierPhone,
                            companyName: regFound?.companyName || prev.companyName,
                            vehicleNumber: regFound?.vehicleNumber || prev.vehicleNumber,
                            harbor: regFound?.harbor || regFound?.city || prev.harbor
                          }));
                        }}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                      <datalist id="supplies-suppliers-list">
                        {registeredSuppliers.filter(s => s.supplierType === 'Consumables' || s.supplierType === 'All' || !s.supplierType).map(s => (
                          <option key={s._id} value={s.name}>
                            {s.companyName ? `${s.companyName} | ` : ''}{s.phone ? `Ph: ${s.phone}` : ''}{s.vehicleNumber ? ` | Veh: ${s.vehicleNumber}` : ''}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={suppliesForm.supplierPhone}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, supplierPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Company / Shop Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Kadapa Packaging"
                        value={suppliesForm.companyName}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, companyName: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Number</label>
                      <input
                        type="text"
                        placeholder="e.g. AP 04 TX 4821"
                        value={suppliesForm.vehicleNumber}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, vehicleNumber: e.target.value.toUpperCase() })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 uppercase focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">City / Origin Location</label>
                      <input
                        type="text"
                        placeholder="e.g. Kadapa Depot"
                        value={suppliesForm.harbor}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, harbor: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Quantity, Units & Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity Received *</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="e.g. 50"
                      value={suppliesForm.quantity}
                      onChange={(e) => setSuppliesForm({ ...suppliesForm, quantity: e.target.value })}
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Packaging Unit</label>
                    <select
                      value={suppliesForm.unit}
                      onChange={(e) => setSuppliesForm({ ...suppliesForm, unit: e.target.value })}
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Pcs">Pcs (Pieces)</option>
                      <option value="Boxes">Boxes</option>
                      <option value="Rolls">Rolls (Tape / Straps)</option>
                      <option value="Kg">Kg (Kilograms)</option>
                      <option value="Blocks">Blocks (Ice)</option>
                      <option value="Bags">Bags (Salt / Chemicals)</option>
                      <option value="Bundles">Bundles</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit Rate (₹ per Unit)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 250"
                      value={suppliesForm.unitRate}
                      onChange={(e) => setSuppliesForm({ ...suppliesForm, unitRate: e.target.value })}
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Value (₹)</label>
                    <div className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-emerald-800 flex items-center justify-between">
                      <span>Total:</span>
                      <span>₹{supplyTotalCost.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Payment Settlement & Notes */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Paid Amount (₹)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0"
                        value={suppliesForm.paidAmount}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, paidAmount: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Balance Due</label>
                      <div className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold border ${supplyBalanceDue > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                        ₹{supplyBalanceDue.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
                      <select
                        value={suppliesForm.paymentMode}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, paymentMode: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI / GPay / PhonePe</option>
                        <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                        <option value="Credit">Credit (Pay Later)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Bill / Invoice Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. Bill #4812, DC-90"
                        value={suppliesForm.notes}
                        onChange={(e) => setSuppliesForm({ ...suppliesForm, notes: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingSupply}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle size={16} />
                  <span>{isSubmittingSupply ? 'Recording Supplies Intake...' : 'Confirm & Record Supplies Stock-In'}</span>
                </button>
              </form>

              {/* 5. Recent Consumables Stock-In Logs Table (Full Width with Pagination) */}
              <div className="border-t border-[#fed7aa]/60 pt-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
                    <History size={15} className="text-emerald-700" />
                    <span>Recent Supplies & Packaging Intake Logs ({supplyLogs.length})</span>
                  </h3>
                  {supplyLogs.length > 0 && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-[11px] sm:text-xs font-bold text-slate-600">
                        Page {suppliesPage} of {totalSuppliesPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={suppliesPage <= 1}
                          onClick={() => setSuppliesPage(p => Math.max(1, p - 1))}
                          className="p-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-700"
                          title="Previous Page"
                        >
                          <ChevronLeft size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={suppliesPage >= totalSuppliesPages}
                          onClick={() => setSuppliesPage(p => Math.min(totalSuppliesPages, p + 1))}
                          className="p-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-700"
                          title="Next Page"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-[#E8DCCB] rounded-xl overflow-hidden shadow-2xs w-full">
                  {supplyLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      No packaging intake records logged yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-xs sm:text-sm border-collapse">
                        <thead className="bg-[#FAF0E4] border-b border-[#fed7aa] text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[12%]">Date</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[14%]">Category</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[20%]">Item Name</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[16%]">Supplier</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Quantity</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Unit Rate</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[14%]">Total</th>
                            <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-center w-[10%]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#fed7aa]/40 font-medium">
                          {paginatedSupplyLogs.map(log => (
                            <tr key={log._id} className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-[11px] sm:text-xs text-slate-600 font-mono whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                  {log.category}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 font-bold text-slate-900 text-xs sm:text-sm">
                                {log.itemName}
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-slate-700 text-xs sm:text-sm">
                                {log.supplierName || '—'}
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                {log.quantity} {log.unit}
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                                ₹{log.unitRate?.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                                ₹{log.totalCost?.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                                  log.paymentStatus === 'Paid'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : log.paymentStatus === 'Partial'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {log.paymentStatus || 'Paid'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Bottom Pagination for Supplies */}
                  {supplyLogs.length > 0 && (
                    <div className="p-3 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                      <span>Showing {(suppliesPage - 1) * SUPPLIES_PER_PAGE + 1} to {Math.min(supplyLogs.length, suppliesPage * SUPPLIES_PER_PAGE)} of {supplyLogs.length} intake logs</span>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                          type="button"
                          disabled={suppliesPage <= 1}
                          onClick={() => setSuppliesPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                        >
                          Previous
                        </button>
                        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black font-mono text-emerald-900">
                          {suppliesPage} / {totalSuppliesPages}
                        </span>
                        <button
                          type="button"
                          disabled={suppliesPage >= totalSuppliesPages}
                          onClick={() => setSuppliesPage(p => Math.min(totalSuppliesPages, p + 1))}
                          className="px-3 py-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Log Shrinkage (Full Width) ── */}
      {activeTab === 'shrinkage' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-6 shadow-2xs w-full space-y-5">
          <div className="border-b border-[#fed7aa]/60 pb-3">
            <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2 m-0">
              <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">📉</span>
              <span>Record Weight Loss & Ice Shrinkage</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium m-0">
              Record normal melting or cutting shrinkage to keep current inventory accurate.
            </p>
          </div>

          <form onSubmit={handleShrinkageSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Fish Variety *</label>
              <select
                value={shrinkageForm.menuItemId}
                onChange={(e) => setShrinkageForm({ ...shrinkageForm, menuItemId: e.target.value })}
                required
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
              >
                <option value="">-- Choose Fish Variety --</option>
                {fishList.map(f => (
                  <option key={f._id} value={f._id}>{f.name} (Current Stock: {f.stock || 0} kg)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shrinkage Weight (Kg) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="e.g. 2.4"
                  value={shrinkageForm.grossKgLost}
                  onChange={(e) => setShrinkageForm({ ...shrinkageForm, grossKgLost: e.target.value })}
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shrinkage Reason *</label>
                <select
                  value={shrinkageForm.reason}
                  onChange={(e) => setShrinkageForm({ ...shrinkageForm, reason: e.target.value })}
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                >
                  <option value="Ice Melt / Natural Drip Loss">Ice Melt / Natural Drip Loss</option>
                  <option value="Cutting / Cleaning Wastage">Cutting / Cleaning Wastage</option>
                  <option value="Spoilage / Quality Rejection">Spoilage / Quality Rejection</option>
                  <option value="Stock Audit Adjustment">Stock Audit Adjustment</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspector Notes</label>
              <input
                type="text"
                placeholder="e.g. End of day crate re-weighing variance"
                value={shrinkageForm.notes}
                onChange={(e) => setShrinkageForm({ ...shrinkageForm, notes: e.target.value })}
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              <span>{submitting ? 'Recording Adjustment...' : 'Record Shrinkage Adjustment'}</span>
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 4: Stock Movement Audit Log (Full Width + Real Date/Time + Type Filters) ── */}
      {activeTab === 'logs' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl overflow-hidden shadow-2xs space-y-3.5 p-3 sm:p-4 w-full">
          {/* Header Row: Title, Inline Date Filter on Desktop, Compact Modal Toggle on Mobile/Tablet */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 border-b border-[#fed7aa]/60 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm md:text-base font-black text-[#1e293b] flex items-center gap-2 m-0">
                  <History size={16} className="text-sky-600 shrink-0" />
                  <span>Stock History & Audit Log</span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0 mt-0.5 truncate hidden sm:block">
                  Permanent ledger of all seafood stock arrivals, POS sales, online deliveries, and shrinkage
                </p>
              </div>

              {/* Mobile/Tablet Compact Date Filter Toggle Button (< xl) */}
              <div className="flex items-center gap-1.5 xl:hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDateFilterModalOpen(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                    startDate || endDate
                      ? 'bg-sky-600 text-white border-sky-600 font-black'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-[#E8DCCB]'
                  }`}
                  title="Filter logs by date range"
                >
                  <Calendar size={13} />
                  <span>
                    {startDate || endDate 
                      ? `${startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} → ${endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}` 
                      : 'Filter Dates'}
                  </span>
                  {(startDate || endDate) && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="ml-0.5 p-0.5 hover:bg-sky-700 rounded-full"
                    >
                      <X size={11} />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Desktop Inline Date Range Filter (>= xl) */}
            <div className="hidden xl:flex items-center flex-wrap gap-2 bg-[#FAF0E4]/80 p-1.5 rounded-xl border border-[#fed7aa]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar size={13} className="text-sky-600 shrink-0" />
                <span className="text-[10.5px] uppercase tracking-wider text-slate-600 font-black">Date Range:</span>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1 bg-white border border-[#E8DCCB] rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase">From</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (endDate && val > endDate) setEndDate(val);
                    setStartDate(val);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none cursor-pointer"
                  title="Filter logs starting from this date"
                />
              </div>

              <span className="text-slate-400 font-bold text-xs">to</span>

              {/* End Date */}
              <div className="flex items-center gap-1 bg-white border border-[#E8DCCB] rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase">To</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (startDate && val < startDate) setStartDate(val);
                    setEndDate(val);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none cursor-pointer"
                  title="Filter logs up to this date"
                />
              </div>

              {/* Quick Presets & Clear */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(todayStr);
                    setEndDate(todayStr);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all ${
                    startDate === todayStr && endDate === todayStr
                      ? 'bg-sky-600 text-white shadow-2xs font-black'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-[#E8DCCB]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setStartDate(d.toISOString().split('T')[0]);
                    setEndDate(todayStr);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-white hover:bg-slate-50 text-slate-600 border border-[#E8DCCB] cursor-pointer transition-all"
                >
                  7 Days
                </button>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    title="Clear Date Filter"
                    className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer transition-all flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Counter Badge */}
            <div className="flex items-center justify-between xl:justify-end gap-2 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-[#E8DCCB] shadow-2xs">
                {filteredStockLogs.length} total entries
              </span>
            </div>
          </div>

          {/* Filter Pills & Search Line */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E8DCCB] shadow-2xs">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Filter by fish variety, bill #, or supplier..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-[#E8DCCB] rounded-lg text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Transaction Type Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
              {[
                { id: 'All', label: 'All Transactions' },
                { id: 'Stock-In', label: 'Stock-In' },
                { id: 'POS Sale', label: 'POS Sale' },
                { id: 'Daily Shrinkage / Drip Loss', label: 'Shrinkage' },
                { id: 'Online Sale', label: 'Online Sale' },
                { id: 'Refund', label: 'Refunds' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLogTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                    logTypeFilter === f.id
                      ? 'bg-sky-600 text-white shadow-2xs font-black'
                      : 'bg-slate-50 border border-[#E8DCCB] text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Logs Table (Full Width with Scaled Fonts on Bigger Screens) */}
          <div className="overflow-x-auto bg-white rounded-xl border border-[#E8DCCB] w-full">
            {paginatedLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs sm:text-sm font-medium">
                No matching stock logs found for the selected criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-[#FAF0E4] text-[#1e293b] border-b border-[#E8DCCB] uppercase tracking-wider text-[11px] sm:text-xs font-black">
                  <tr>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[14%] min-w-[110px]">Date & Time</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[28%] min-w-[240px] md:min-w-[280px]">Fish Variety</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[14%] min-w-[110px]">Transaction Type</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[12%] min-w-[95px]">Weight Change</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[12%] min-w-[95px]">Balance Stock</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[12%] min-w-[110px]">Supplier / Ref</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[8%] min-w-[75px]">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DCCB] font-medium">
                  {paginatedLogs.map((log) => {
                    const isPositive = (Number(log.quantityChange) || 0) > 0;
                    const dt = formatLogDateTime(log);

                    return (
                      <tr key={log._id} className="hover:bg-[#FAF3E8] transition-colors">
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">{dt.dateStr}</div>
                          <div className="text-[10px] sm:text-[11px] font-mono text-slate-500">{dt.timeStr}</div>
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-bold text-slate-900 text-xs sm:text-sm whitespace-normal break-words">
                          {log.itemName}
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${
                            log.type?.includes('Procurement') || log.type?.includes('Stock-In')
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : log.type?.includes('Reversal') || log.type?.includes('Refund')
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : log.type?.includes('Shrinkage') || log.type?.includes('Wastage')
                                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                                  : 'bg-rose-100 border-rose-300 text-rose-800'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className={`py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono font-bold text-xs sm:text-sm whitespace-nowrap ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isPositive ? `+${log.quantityChange}` : log.quantityChange} kg
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono text-slate-900 font-bold text-xs sm:text-sm whitespace-nowrap">
                          {log.finalStock !== undefined ? `${log.finalStock} kg` : '-'}
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-slate-700 text-xs sm:text-sm">
                          {log.supplierName ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md w-fit text-[10px] sm:text-[11px]">
                                <User size={10} />
                                <span>{log.supplierName}</span>
                              </span>
                              {log.notes && (
                                <span className="text-[10px] sm:text-[10.5px] text-slate-500 italic max-w-xs truncate" title={log.notes}>
                                  {log.notes}
                                </span>
                              )}
                            </div>
                          ) : log.billNumber ? (
                            <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10.5px] sm:text-xs">
                              Bill #{log.billNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-[10.5px] sm:text-xs font-mono text-slate-600">
                          {log.performedBy || 'admin'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Pagination for Audit Trail (Mobile Responsive) */}
          <div className="p-3 sm:p-4 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm text-slate-600">
            <span className="font-medium">
              Showing {(logsPage - 1) * LOGS_PER_PAGE + 1} to {Math.min(filteredStockLogs.length, logsPage * LOGS_PER_PAGE)} of {filteredStockLogs.length} logs
            </span>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={logsPage <= 1}
                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-sky-50 border border-sky-200 rounded-xl text-xs sm:text-sm font-black font-mono text-sky-900">
                {logsPage} / {totalLogsPages}
              </span>
              <button
                type="button"
                disabled={logsPage >= totalLogsPages}
                onClick={() => setLogsPage(p => Math.min(totalLogsPages, p + 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Filter Modal for Mobile & Tablet Screen Sizes (< xl) */}
      {isDateFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 m-0">Filter Logs by Date</h3>
                  <p className="text-[11px] text-slate-500 m-0">Select start and end dates or choose a quick preset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDateFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Quick Presets</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(todayStr);
                    setEndDate(todayStr);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    startDate === todayStr && endDate === todayStr
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs font-black'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setStartDate(d.toISOString().split('T')[0]);
                    setEndDate(todayStr);
                  }}
                  className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer transition-all"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    setStartDate(d.toISOString().split('T')[0]);
                    setEndDate(todayStr);
                  }}
                  className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer transition-all"
                >
                  Last 30 Days
                </button>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (endDate && val > endDate) setEndDate(val);
                    setStartDate(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (startDate && val < startDate) setStartDate(val);
                    setEndDate(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Active Range Preview */}
            {(startDate || endDate) && (
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between text-xs text-sky-900 font-semibold">
                <span>Active: {startDate || 'Beginning'} → {endDate || 'Today'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setIsDateFilterModalOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Clear & Close
              </button>
              <button
                type="button"
                onClick={() => setIsDateFilterModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-2xs transition-all cursor-pointer"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Voucher Modal */}
      {damPrintVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Printer size={15} />
                <span>Fish Catch Intake Voucher Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <Printer size={13} />
                  <span>Print Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDamPrintVoucher(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-slate-800 font-sans print:p-0">
              <div className="text-center border-b pb-3">
                <h1 className="text-lg font-black tracking-tight text-slate-900 m-0">YNR FISHES & SEAFOOD DEPOT</h1>
                <p className="text-xs text-slate-500 m-0 mt-0.5">Kadapa City Depot • Catch Unloading & Weighment Slip</p>
                <div className="text-[11px] text-slate-400 mt-1 font-mono">Date: {damPrintVoucher.date}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Party / Contractor</span>
                  <span className="font-bold text-slate-900">{damPrintVoucher.contractorName}</span>
                  {damPrintVoucher.companyName && <div className="text-[11px] text-slate-600">{damPrintVoucher.companyName}</div>}
                  {damPrintVoucher.contractorPhone && <div className="text-[11px] text-slate-600">Ph: {damPrintVoucher.contractorPhone}</div>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Logistics / Vehicle</span>
                  <span className="font-mono font-bold text-slate-900">{damPrintVoucher.vehicleNumber || 'Direct Depot Delivery'}</span>
                  {damPrintVoucher.harbor && <div className="text-[11px] text-slate-600">Location: {damPrintVoucher.harbor}</div>}
                </div>
              </div>

              <div>
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">Fish Variety</th>
                      <th className="p-2 text-right">Boxes</th>
                      <th className="p-2 text-right">Weight (Kg)</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {damPrintVoucher.tallyItems.map((r, i) => {
                      let itemKg = 0;
                      const b = Number(r.boxes || 0);
                      const kpb = Number(r.kgPerBox || 0);
                      if (Number(r.kg || 0) > 0 || Number(r.grams || 0) > 0) {
                        itemKg = Number((Number(r.kg || 0) + Number(r.grams || 0) / 1000).toFixed(3));
                      } else if (b > 0 && kpb > 0) {
                        itemKg = Number((b * kpb).toFixed(3));
                      }
                      const rate = Number(r.price || r.rate || r.ratePerKg || 0);
                      const total = Number((itemKg * rate).toFixed(2));

                      return (
                        <tr key={i}>
                          <td className="p-2 text-slate-400">{i + 1}</td>
                          <td className="p-2 font-bold">{r.itemName}</td>
                          <td className="p-2 text-right font-mono">{r.boxes || '—'}</td>
                          <td className="p-2 text-right font-mono font-bold">{itemKg.toFixed(2)} kg</td>
                          <td className="p-2 text-right font-mono">₹{rate.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold">₹{total.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Gross Consignment</span>
                  <span className="font-bold">{damPrintVoucher.totalGrossKg} Kg Total</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Net Settlement Amount</span>
                  <span className="text-base font-black font-mono text-blue-700">₹{Math.abs(damPrintVoucher.netConsignmentSettlement).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
