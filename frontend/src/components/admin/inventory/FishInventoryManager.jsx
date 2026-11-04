import React, { useState, useEffect, useMemo, useRef } from 'react';
import Toast from '../system/Toast';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';
import realtimeService from '../../../services/realtimeService';
import { getSuppliers } from '../../../api/operations/operations';
import { 
  Package, 
  ArrowDownLeft, 
  ArrowUpRight, 
  AlertTriangle, 
  TrendingDown, 
  Plus, 
  RefreshCw, 
  History, 
  Scale, 
  ShieldCheck, 
  Search,
  Filter,
  Printer,
  Trash2,
  FileText,
  CheckCircle,
  Truck,
  User,
  MapPin,
  X,
  DollarSign,
  Receipt
} from 'lucide-react';
import BackButton from '../common/BackButton';

export default function FishInventoryManager({ user, onNavigate, onGoBack }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'procurement' | 'shrinkage' | 'logs'
  const [stockInSubTab, setStockInSubTab] = useState('local'); // 'local' | 'dam'
  const [fishList, setFishList] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [crmCustomers, setCrmCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [damPrintVoucher, setDamPrintVoucher] = useState(null);

  // Local Stock-In Form State (Handwritten Note ①)
  const [localStockInForm, setLocalStockInForm] = useState({
    supplierName: '',
    supplierPhone: '',
    menuItemId: '',
    sizeBracket: 'Medium', // 'Big' | 'Medium' | 'Small'
    weightOption: '1+',    // '1+' | '0-1'
    kg: '',
    grams: '',
    ratePerKg: '',
    iceCharges: '',
    boxTapeCharges: '',
    advanceAmount: '',
    notes: ''
  });

  // DAM Consignment Form State (Handwritten Note ② - A4 Pattern & 5-Point Cr/Dr)
  const [damStockInForm, setDamStockInForm] = useState({
    contractorId: '',
    contractorName: '',
    contractorPhone: '',
    contractorCity: '',
    tallyItems: [
      { id: 1, menuItemId: '', itemName: '', kg: '', grams: '', price: '' }
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

  // Procurement form state
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
    reason: 'Ice Melt / Drip Loss',
    notes: ''
  });

  const getAuthHeader = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const [invRes, logsRes, crmRes] = await Promise.all([
        axios.get(`${getApiUrl()}/inventory`, { headers: getAuthHeader() }),
        axios.get(`${getApiUrl()}/inventory/logs`, { headers: getAuthHeader() }),
        axios.get(`${getApiUrl()}/crm/customers`, { headers: getAuthHeader() }).catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(invRes.data)) setFishList(invRes.data);
      if (Array.isArray(logsRes.data)) setStockLogs(logsRes.data);
      if (Array.isArray(crmRes.data)) setCrmCustomers(crmRes.data);
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

  // Local Stock-In Realtime Calculations
  const localTotalWeightKg = useMemo(() => {
    return Number((Number(localStockInForm.kg || 0) + Number(localStockInForm.grams || 0) / 1000).toFixed(3));
  }, [localStockInForm.kg, localStockInForm.grams]);

  const localBaseAmount = useMemo(() => {
    return Number((localTotalWeightKg * Number(localStockInForm.ratePerKg || 0)).toFixed(2));
  }, [localTotalWeightKg, localStockInForm.ratePerKg]);

  const localSubtotal = useMemo(() => {
    return Number((localBaseAmount - Number(localStockInForm.iceCharges || 0) + Number(localStockInForm.boxTapeCharges || 0)).toFixed(2));
  }, [localBaseAmount, localStockInForm.iceCharges, localStockInForm.boxTapeCharges]);

  const localNetPayable = useMemo(() => {
    return Number((localSubtotal - Number(localStockInForm.advanceAmount || 0)).toFixed(2));
  }, [localSubtotal, localStockInForm.advanceAmount]);

  // DAM Consignment Realtime Calculations
  const damTotals = useMemo(() => {
    let totalKg = 0;
    let catchTotal = 0;
    (damStockInForm.tallyItems || []).forEach(row => {
      const rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
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

  const handleLocalStockInSubmit = async (e) => {
    e.preventDefault();
    if (!localStockInForm.menuItemId || localTotalWeightKg <= 0) {
      setMessage({ text: 'Please select a fish variety and enter weight (Kg/Grams).', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${getApiUrl()}/inventory/local-stock-in`, {
        ...localStockInForm,
        kg: Number(localStockInForm.kg || 0),
        grams: Number(localStockInForm.grams || 0),
        ratePerKg: Number(localStockInForm.ratePerKg || 0),
        iceCharges: Number(localStockInForm.iceCharges || 0),
        boxTapeCharges: Number(localStockInForm.boxTapeCharges || 0),
        advanceAmount: Number(localStockInForm.advanceAmount || 0)
      }, { headers: getAuthHeader() });

      setMessage({ text: res.data.message || 'Local Stock-In successfully recorded!', type: 'success' });
      setLocalStockInForm({
        supplierName: '',
        supplierPhone: '',
        menuItemId: '',
        sizeBracket: 'Medium',
        weightOption: '1+',
        kg: '',
        grams: '',
        ratePerKg: '',
        iceCharges: '',
        boxTapeCharges: '',
        advanceAmount: '',
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
    const validRows = (damStockInForm.tallyItems || []).filter(
      r => (Number(r.kg || 0) + Number(r.grams || 0)) > 0 && (r.menuItemId || r.itemName)
    );
    if (validRows.length === 0) {
      setMessage({ text: 'Please add at least one valid fish tally row with weight.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${getApiUrl()}/inventory/dam-stock-in`, {
        contractorId: damStockInForm.contractorId,
        contractorName: damStockInForm.contractorName,
        contractorPhone: damStockInForm.contractorPhone,
        tallyItems: validRows,
        settlements: damStockInForm.settlements,
        notes: damStockInForm.notes
      }, { headers: getAuthHeader() });

      setMessage({ text: res.data.message || 'DAM Consignment successfully recorded!', type: 'success' });
      setDamPrintVoucher({
        ...res.data.consignmentSummary,
        tallyItems: validRows,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      });
      setDamStockInForm({
        contractorId: '',
        contractorName: '',
        contractorPhone: '',
        contractorCity: '',
        tallyItems: [{ id: 1, menuItemId: '', itemName: '', kg: '', grams: '', price: '' }],
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
      setMessage({ text: err.response?.data?.message || 'Failed to record DAM Stock-In', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcurementSubmit = async (e) => {
    e.preventDefault();
    if (!procurementForm.menuItemId || !procurementForm.grossKgAdded) {
      setMessage({ text: 'Please select a fish and enter weight received.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${getApiUrl()}/inventory/procurement`, procurementForm, {
        headers: getAuthHeader()
      });

      setMessage({ text: res.data.message || 'Procurement recorded successfully!', type: 'success' });
      setProcurementForm({
        menuItemId: '',
        grossKgAdded: '',
        purchasePricePerKg: '',
        supplierName: '',
        notes: ''
      });
      fetchInventoryData();
      setTimeout(() => setActiveTab('overview'), 1200);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to record procurement', type: 'error' });
    } finally {
      setSubmitting(false);
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
      const res = await axios.post(`${getApiUrl()}/inventory/shrinkage`, shrinkageForm, {
        headers: getAuthHeader()
      });

      setMessage({ text: res.data.message || 'Shrinkage recorded successfully!', type: 'success' });
      setShrinkageForm({
        menuItemId: '',
        grossKgLost: '',
        reason: 'Ice Melt / Drip Loss',
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

  const filteredFish = fishList.filter(f => 
    f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.scientificName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-2.5 sm:p-3.5 space-y-2.5 w-full text-slate-800">
      {/* Compact Top Header & KPI Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-[#FDFBF7] border border-sky-500/25 rounded-xl px-3.5 py-2.5 shadow-md">
        <div className="flex items-center gap-2.5">
          {onGoBack && (
            <BackButton onClick={onGoBack} label="Back" />
          )}
          <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30 shrink-0">
            <Package size={17} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-slate-800">Seafood Stock & Catch Ledger</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-bold hidden sm:inline">
                Live Cold Storage
              </span>
            </div>
            <p className="text-[10px] text-slate-600 font-medium">
              Gross Catch Weight &bull; Cut Yield &bull; Stock-Ins &bull; Ice Shrinkage
            </p>
          </div>
        </div>

        <button
          onClick={fetchInventoryData}
          disabled={loading}
          className="self-end md:self-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Compact KPI Cards (Slim Strip) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl px-3 py-2 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Total Raw Fish Stock</span>
            <div className="text-lg font-black text-sky-800 font-mono leading-tight mt-0.5">
              {totalStockKg.toFixed(2)} <span className="text-xs font-semibold text-slate-500">Kg</span>
            </div>
          </div>
          <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg border border-sky-200">
            <Scale size={18} />
          </div>
        </div>

        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl px-3 py-2 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Low Stock Alert</span>
            <div className="text-lg font-black text-amber-800 font-mono leading-tight mt-0.5">
              {lowStockCount} <span className="text-xs font-semibold text-slate-500">Varieties</span>
            </div>
          </div>
          <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg border border-amber-200">
            <AlertTriangle size={18} />
          </div>
        </div>

        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl px-3 py-2 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">Active Fish Varieties</span>
            <div className="text-lg font-black text-emerald-800 font-mono leading-tight mt-0.5">
              {fishList.length} <span className="text-xs font-semibold text-slate-500">Items</span>
            </div>
          </div>
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
            <ShieldCheck size={18} />
          </div>
        </div>
      </div>

      {/* Compact Tabs & Search Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E8DCCB] pb-1.5">
        <div className="flex gap-1.5 overflow-x-auto">
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#ea580c] text-white shadow-xs font-bold'
                    : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'overview' && (
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search size={13} className="absolute left-2.5 top-2 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fish species..."
                className="w-full bg-white border border-[#E8DCCB] rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
              />
            </div>
            <span className="text-[11px] text-slate-600 shrink-0 font-bold">{filteredFish.length} items</span>
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

      {/* TAB 1: Stock Overview (Compact Table) */}
      {activeTab === 'overview' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF0E4] text-[#1e293b] border-b border-[#E8DCCB] uppercase tracking-wider text-[10px] font-black">
                <tr>
                  <th className="py-2 px-3">Fish Variety</th>
                  <th className="py-2 px-3">Gross Stock (Kg)</th>
                  <th className="py-2 px-3">Stock Status</th>
                  <th className="py-2 px-3">Rate / Kg</th>
                  <th className="py-2 px-3">Wholesale Crate Eqv</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DCCB] font-medium">
                {filteredFish.map((fish) => {
                  const currentStock = Number(fish.stock) || 0;
                  const minAlert = Number(fish.minStockAlertKg) || 5;
                  const isLow = currentStock <= minAlert;
                  const isOut = currentStock <= 0;
                  const crateSize = Number(fish.boxNetFishKg || (fish.boxPackingKg ? fish.boxPackingKg - 10 : 50));
                  const crates = crateSize > 0 ? (currentStock / crateSize).toFixed(1) : 0;

                  return (
                    <tr key={fish._id} className="hover:bg-[#FAF3E8] transition-colors">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800 text-xs">{fish.name}</div>
                        {fish.lastSupplier && (
                          <div className="text-[10px] text-sky-700 font-bold">Supplier: {fish.lastSupplier}</div>
                        )}
                        {fish.scientificName && (
                          <div className="text-[10px] text-slate-500 italic font-medium">{fish.scientificName}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs font-black text-slate-800">
                        {currentStock.toFixed(2)} Kg
                      </td>
                      <td className="py-2 px-3">
                        {isOut ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-[9px] font-bold">
                            Sold Out
                          </span>
                        ) : isLow ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-bold">
                            Low (&le; {minAlert}kg)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[9px] font-bold">
                            Healthy Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-emerald-800 font-bold text-xs">
                        ₹{Number(fish.price || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-slate-600 text-[10px] font-medium">
                        ~{crates} Crates ({crateSize}kg/box)
                      </td>
                      <td className="py-2 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setProcurementForm(prev => ({ ...prev, menuItemId: fish._id }));
                            setActiveTab('procurement');
                          }}
                          className="px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/30 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          + Stock-In
                        </button>
                        <button
                          onClick={() => {
                            setShrinkageForm(prev => ({ ...prev, menuItemId: fish._id }));
                            setActiveTab('shrinkage');
                          }}
                          className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold transition-all cursor-pointer shadow-xs"
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
        </div>
      )}

      {/* TAB 2: Dual-Engine Catch Stock-In (Local & DAM) */}
      {activeTab === 'procurement' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Sub-channel Toggle: Local vs DAM */}
          <div className="bg-[#FAF0E4] p-1.5 rounded-2xl border border-[#fed7aa] flex items-center gap-2 max-w-md mx-auto shadow-xs">
            <button
              type="button"
              onClick={() => setStockInSubTab('local')}
              className={`flex-1 py-2 px-3 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                stockInSubTab === 'local'
                  ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>📍 (i) Local Stock-In</span>
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
              <span>🌊 (ii) DAM Consignment</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* SUB-TAB 1: LOCAL STOCK-IN (RETAIL / HARBOR PATTERN)      */}
          {/* ======================================================== */}
          {stockInSubTab === 'local' && (
            <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-3">
                <div>
                  <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2">
                    <span className="p-1.5 bg-orange-100 text-[#ea580c] rounded-lg">📍</span>
                    <span>Local Catch Stock-In (Retail Fisherman / Market)</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Handwritten blueprint: (1+) vs (0-1) grading, Big/Medium/Small sizing, Ice & Box charges, and Advance settlement.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-orange-100 text-[#c2410c] font-black rounded-full text-[11px] uppercase tracking-wider">
                  Pattern ①
                </span>
              </div>

              <form onSubmit={handleLocalStockInSubmit} className="space-y-4">
                {/* 1. Seller / Supplier Details */}
                <div className="bg-[#FAF0E4]/50 p-3.5 rounded-xl border border-[#fed7aa]/70 space-y-3">
                  <div className="text-xs font-black text-[#c2410c] uppercase tracking-wide flex items-center gap-1.5">
                    <User size={14} />
                    <span>Seller / Supplier Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Select Predefined Supplier (or Type New)
                      </label>
                      <input
                        type="text"
                        list="local-suppliers-list"
                        placeholder="e.g. Anand Fishermen / Harbour Boat #4"
                        value={localStockInForm.supplierName}
                        onChange={(e) => {
                          const val = e.target.value;
                          const found = crmCustomers.find(c => c.name === val || c.phone === val);
                          setLocalStockInForm(prev => ({
                            ...prev,
                            supplierName: val,
                            supplierPhone: found ? (found.phone || prev.supplierPhone) : prev.supplierPhone
                          }));
                        }}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
                      />
                      <datalist id="local-suppliers-list">
                        {crmCustomers.map(c => (
                          <option key={c._id} value={c.name}>{c.phone ? `(${c.phone}) - ${c.category || 'Customer'}` : ''}</option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Supplier Contact Phone
                      </label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile number"
                        value={localStockInForm.supplierPhone}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, supplierPhone: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Fish Species & Grading Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Fish Species Variety *
                    </label>
                    <select
                      value={localStockInForm.menuItemId}
                      onChange={(e) => {
                        const sel = fishList.find(f => f._id === e.target.value);
                        setLocalStockInForm({
                          ...localStockInForm,
                          menuItemId: e.target.value,
                          ratePerKg: sel?.purchasePrice ? String(sel.purchasePrice) : localStockInForm.ratePerKg
                        });
                      }}
                      required
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#ea580c]"
                    >
                      <option value="">-- Choose Fish Species --</option>
                      {fishList.map(f => (
                        <option key={f._id} value={f._id}>{f.name} (Stock: {f.stock || 0} kg)</option>
                      ))}
                    </select>
                  </div>

                  {/* Size Option: Big, Medium, Small */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Fish Size Classification
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-xl border border-[#E8DCCB]">
                      {['Big', 'Medium', 'Small'].map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setLocalStockInForm({ ...localStockInForm, sizeBracket: size })}
                          className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            localStockInForm.sizeBracket === size
                              ? 'bg-[#ea580c] text-white shadow-xs'
                              : 'text-slate-600 hover:bg-orange-50'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weight Option: (1+) vs (0-1) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Grading Weight Bracket
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xl border border-[#E8DCCB]">
                      <button
                        type="button"
                        onClick={() => setLocalStockInForm({ ...localStockInForm, weightOption: '1+' })}
                        className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          localStockInForm.weightOption === '1+'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-emerald-50'
                        }`}
                        title="Fishes weighing 1 Kg and above each"
                      >
                        <span>(1+)</span> <span className="text-[10px]">&ge; 1Kg</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLocalStockInForm({ ...localStockInForm, weightOption: '0-1' })}
                        className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          localStockInForm.weightOption === '0-1'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-blue-50'
                        }`}
                        title="Fishes weighing below 1 Kg (0 to 1 Kg range)"
                      >
                        <span>(0-1)</span> <span className="text-[10px]">&lt; 1Kg</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Weight Precision (Kg + Grams) & Rate */}
                <div className="bg-[#FAF0E4]/40 p-3.5 rounded-xl border border-[#fed7aa] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Weight (Kilograms) *</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="e.g. 45"
                        value={localStockInForm.kg}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, kg: e.target.value })}
                        className="w-full bg-white border border-[#fed7aa] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Precision (Grams)</label>
                      <input
                        type="number"
                        min="0"
                        max="999"
                        placeholder="e.g. 650"
                        value={localStockInForm.grams}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, grams: e.target.value })}
                        className="w-full bg-white border border-[#fed7aa] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Purchase Rate (₹ / Kg) *</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="e.g. 220"
                        value={localStockInForm.ratePerKg}
                        onChange={(e) => setLocalStockInForm({ ...localStockInForm, ratePerKg: e.target.value })}
                        className="w-full bg-white border border-[#fed7aa] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Gross Fish Value</label>
                      <div className="p-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-mono font-extrabold text-sm text-center">
                        ₹{localBaseAmount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Charges, Advance & Net Settlement (Handwritten Details) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FAF0E4]/30 p-3 rounded-xl border border-[#fed7aa]">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Ice Charges (-) ₹
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={localStockInForm.iceCharges}
                      onChange={(e) => setLocalStockInForm({ ...localStockInForm, iceCharges: e.target.value })}
                      className="w-full bg-white border border-[#fed7aa] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-rose-600 focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Box & Tape (+) ₹
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={localStockInForm.boxTapeCharges}
                      onChange={(e) => setLocalStockInForm({ ...localStockInForm, boxTapeCharges: e.target.value })}
                      className="w-full bg-white border border-[#fed7aa] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-blue-600 focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sub Total ₹
                    </label>
                    <div className="p-1.5 bg-white border border-slate-300 rounded-xl font-mono font-extrabold text-xs text-slate-800 text-center">
                      ₹{localSubtotal.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Advance Given (-) ₹
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={localStockInForm.advanceAmount}
                      onChange={(e) => setLocalStockInForm({ ...localStockInForm, advanceAmount: e.target.value })}
                      className="w-full bg-white border border-[#fed7aa] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-amber-700 focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>
                </div>

                {/* Final Net Payable Card */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3.5 rounded-xl border border-amber-300 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Net Payable to Supplier / Fisherman
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Weight: <span className="font-mono font-bold">{localTotalWeightKg} Kg</span> ({localStockInForm.weightOption}, {localStockInForm.sizeBracket})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black font-mono text-[#ea580c]">
                      ₹{localNetPayable.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Notes / Landing Boat Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. Morning fresh catch, boat #12, iced crates"
                    value={localStockInForm.notes}
                    onChange={(e) => setLocalStockInForm({ ...localStockInForm, notes: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || localTotalWeightKg <= 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  <span>{submitting ? 'Confirming Stock-In...' : 'Confirm & Record Local Stock-In'}</span>
                </button>
              </form>
            </div>
          )}

          {/* ======================================================== */}
          {/* SUB-TAB 2: DAM STOCK-IN (A4 MULTI-FISH TALLY PATTERN)    */}
          {/* ======================================================== */}
          {stockInSubTab === 'dam' && (
            <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2">
                    <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">🌊</span>
                    <span>DAM Consignment Stock-In (CRM Reservoir Catch Pattern)</span>
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Handwritten note ②: A4 sheet multi-fish individual tally list with 5-Point Cr/Dr accounting ledger (Advance, Khata, OD, Expense, Festival Expense).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-black rounded-full text-[11px] uppercase tracking-wider">
                    Pattern ② (A4)
                  </span>
                </div>
              </div>

              <form onSubmit={handleDamStockInSubmit} className="space-y-5">
                {/* 1. CRM Contractor Link */}
                <div className="bg-[#FAF0E4]/50 p-3.5 rounded-xl border border-[#fed7aa]/70 space-y-3">
                  <div className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                    <User size={14} />
                    <span>CRM Dam Contractor / Consignment Supplier</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Select DAM Contractor from CRM *
                      </label>
                      <select
                        value={damStockInForm.contractorId}
                        onChange={(e) => {
                          const selId = e.target.value;
                          const cust = crmCustomers.find(c => c._id === selId);
                          setDamStockInForm({
                            ...damStockInForm,
                            contractorId: selId,
                            contractorName: cust ? cust.name : damStockInForm.contractorName,
                            contractorPhone: cust ? cust.phone : damStockInForm.contractorPhone,
                            contractorCity: cust ? (cust.address?.city || cust.businessName || '') : ''
                          });
                        }}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Choose DAM Contractor --</option>
                        {crmCustomers.filter(c => c.category === 'Export' || c.category === 'Wholesale' || c.exportSubCategory === 'DAM').map(c => (
                          <option key={c._id} value={c._id}>
                            {c.name} ({c.exportSubCategory || c.category}) {c.phone ? `• ${c.phone}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Contractor / Firm Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Srisailam Dam Fishery Syndicate"
                        value={damStockInForm.contractorName}
                        onChange={(e) => setDamStockInForm({ ...damStockInForm, contractorName: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone & Location</label>
                      <input
                        type="text"
                        placeholder="e.g. 9848012345 (Nagarjuna Sagar)"
                        value={damStockInForm.contractorPhone}
                        onChange={(e) => setDamStockInForm({ ...damStockInForm, contractorPhone: e.target.value })}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Number of Individual Fishes List (A4 Pattern) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <FileText size={15} className="text-blue-600" />
                      <span>Number of Individual Fishes List (A4 Pattern Tally)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDamStockInForm(prev => ({
                          ...prev,
                          tallyItems: [
                            ...prev.tallyItems,
                            { id: Date.now(), menuItemId: '', itemName: '', kg: '', grams: '', price: '' }
                          ]
                        }));
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Fish Lot Row</span>
                    </button>
                  </div>

                  {/* Dynamic Multi-Row Table */}
                  <div className="border border-[#fed7aa] rounded-xl overflow-hidden bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#FAF0E4] text-slate-700 border-b border-[#fed7aa] font-black text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-2.5 w-8 text-center">#</th>
                          <th className="py-2 px-2.5">Fish Species Item Name</th>
                          <th className="py-2 px-2.5 w-24">Kg</th>
                          <th className="py-2 px-2.5 w-24">Grams</th>
                          <th className="py-2 px-2.5 w-28">Price (₹/Kg)</th>
                          <th className="py-2 px-2.5 w-28 text-right">Row Total (₹)</th>
                          <th className="py-2 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {damStockInForm.tallyItems.map((row, idx) => {
                          const rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
                          const rowTotal = Number((rowKg * Number(row.price || 0)).toFixed(2));

                          return (
                            <tr key={row.id || idx} className="hover:bg-blue-50/30">
                              <td className="py-2 px-2.5 text-center font-mono text-slate-400 font-bold">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-2.5">
                                <select
                                  value={row.menuItemId}
                                  onChange={(e) => {
                                    const sel = fishList.find(f => f._id === e.target.value);
                                    const next = [...damStockInForm.tallyItems];
                                    next[idx] = {
                                      ...next[idx],
                                      menuItemId: e.target.value,
                                      itemName: sel ? sel.name : '',
                                      price: sel?.purchasePrice ? String(sel.purchasePrice) : next[idx].price
                                    };
                                    setDamStockInForm({ ...damStockInForm, tallyItems: next });
                                  }}
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                >
                                  <option value="">-- Choose Fish --</option>
                                  {fishList.map(f => (
                                    <option key={f._id} value={f._id}>{f.name}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-2.5">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="0"
                                  value={row.kg}
                                  onChange={(e) => {
                                    const next = [...damStockInForm.tallyItems];
                                    next[idx] = { ...next[idx], kg: e.target.value };
                                    setDamStockInForm({ ...damStockInForm, tallyItems: next });
                                  }}
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 text-center"
                                />
                              </td>
                              <td className="py-2 px-2.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="999"
                                  placeholder="0"
                                  value={row.grams}
                                  onChange={(e) => {
                                    const next = [...damStockInForm.tallyItems];
                                    next[idx] = { ...next[idx], grams: e.target.value };
                                    setDamStockInForm({ ...damStockInForm, tallyItems: next });
                                  }}
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 text-center"
                                />
                              </td>
                              <td className="py-2 px-2.5">
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="₹"
                                  value={row.price}
                                  onChange={(e) => {
                                    const next = [...damStockInForm.tallyItems];
                                    next[idx] = { ...next[idx], price: e.target.value };
                                    setDamStockInForm({ ...damStockInForm, tallyItems: next });
                                  }}
                                  className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 text-right"
                                />
                              </td>
                              <td className="py-2 px-2.5 text-right font-mono font-black text-slate-800">
                                ₹{rowTotal.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {damStockInForm.tallyItems.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = damStockInForm.tallyItems.filter((_, i) => i !== idx);
                                      setDamStockInForm({ ...damStockInForm, tallyItems: next });
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                    title="Delete row"
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

                  {/* Consignment Metrics Tally Bar */}
                  <div className="bg-[#FAF0E4] p-3 rounded-xl border border-[#fed7aa] flex items-center justify-between text-xs font-bold">
                    <div className="text-slate-600">
                      Total Lots: <span className="font-mono text-slate-900 font-black">{damStockInForm.tallyItems.length}</span>
                    </div>
                    <div className="text-slate-600">
                      Consignment Weight: <span className="font-mono text-blue-700 font-black">{damTotals.totalKg} Kg</span>
                    </div>
                    <div className="text-slate-700">
                      Gross Catch Total: <span className="font-mono text-emerald-800 text-sm font-black">₹{damTotals.catchTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* 3. 5-Point Cr / Dr Settlement Ledger (Handwritten Details) */}
                <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa] space-y-3">
                  <div className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center justify-between">
                    <span>5-Point Cr / Dr Accounting Settlement Ledger</span>
                    <span className="text-[10px] text-slate-500 font-semibold lowercase">
                      (cr = depot credit / we pay • dr = contractor debit / deducted)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {[
                      { key: 'advance', label: '1) Advance' },
                      { key: 'khata', label: '2) Khata' },
                      { key: 'od', label: '3) OD (Overdraft)' },
                      { key: 'expense', label: '4) Expense' },
                      { key: 'festivalExpense', label: '5) Festival Exp' }
                    ].map(item => {
                      const entry = damStockInForm.settlements[item.key] || { type: 'Dr', amount: '' };
                      const isCr = entry.type === 'Cr';

                      return (
                        <div key={item.key} className="bg-white p-2.5 rounded-xl border border-[#fed7aa] space-y-1.5 shadow-2xs">
                          <div className="text-[11px] font-bold text-slate-700 truncate">
                            {item.label}
                          </div>
                          {/* Cr / Dr Toggle Switch */}
                          <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setDamStockInForm({
                                  ...damStockInForm,
                                  settlements: {
                                    ...damStockInForm.settlements,
                                    [item.key]: { ...entry, type: 'Cr' }
                                  }
                                });
                              }}
                              className={`py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                isCr ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              Cr
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDamStockInForm({
                                  ...damStockInForm,
                                  settlements: {
                                    ...damStockInForm.settlements,
                                    [item.key]: { ...entry, type: 'Dr' }
                                  }
                                });
                              }}
                              className={`py-0.5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                !isCr ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                              }`}
                            >
                              Dr
                            </button>
                          </div>
                          {/* Amount Input */}
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={entry.amount}
                            onChange={(e) => {
                              setDamStockInForm({
                                ...damStockInForm,
                                settlements: {
                                  ...damStockInForm.settlements,
                                  [item.key]: { ...entry, amount: e.target.value }
                                }
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
                </div>

                {/* 4. Net Settlement Breakdown Summary */}
                <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 p-4 rounded-xl border border-blue-200 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      DAM Consignment Final Settlement
                    </div>
                    <div className="text-[11px] text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                      <span>Catch: <strong className="font-mono text-slate-800">₹{damTotals.catchTotal.toLocaleString('en-IN')}</strong></span>
                      <span>+ Credits: <strong className="font-mono text-emerald-700">₹{damTotals.totalCr.toLocaleString('en-IN')}</strong></span>
                      <span>- Debits: <strong className="font-mono text-rose-700">₹{damTotals.totalDr.toLocaleString('en-IN')}</strong></span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-500">
                      {damTotals.netSettlement >= 0 ? 'Depot Payable to Contractor' : 'Contractor Balance Due'}
                    </div>
                    <div className={`text-2xl font-black font-mono ${damTotals.netSettlement >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                      ₹{Math.abs(damTotals.netSettlement).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">DAM Consignment Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Srisailam reservoir catch lot #A, weighed at depot platform"
                    value={damStockInForm.notes}
                    onChange={(e) => setDamStockInForm({ ...damStockInForm, notes: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={submitting || damTotals.totalKg <= 0}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    <span>{submitting ? 'Recording Consignment...' : 'Confirm & Record DAM Stock-In'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const validRows = (damStockInForm.tallyItems || []).filter(
                        r => (Number(r.kg || 0) + Number(r.grams || 0)) > 0
                      );
                      setDamPrintVoucher({
                        contractorName: damStockInForm.contractorName || 'DAM Contractor',
                        contractorPhone: damStockInForm.contractorPhone,
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
                    className="px-4 py-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Preview A4 Sheet Pattern"
                  >
                    <Printer size={15} />
                    <span className="hidden sm:inline">Preview A4 Voucher</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* A4 Pattern Printable Consignment Voucher Modal */}
      {damPrintVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Bar */}
            <div className="p-3 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Printer size={15} />
                <span>A4 Pattern DAM Catch Voucher Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  <Printer size={13} /> <span>Print Statement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDamPrintVoucher(null)}
                  className="p-1 text-slate-300 hover:text-white rounded-full cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* A4 Sheet Body */}
            <div className="p-6 overflow-y-auto space-y-4 font-sans text-slate-800 text-xs">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-3 text-center">
                <h1 className="text-xl font-black tracking-tight text-slate-900">YNR FISHES — NATURE'S SUPER FOOD</h1>
                <p className="text-[11px] text-slate-600 font-semibold">Kadapa City Central Depot • DAM Catch Procurement Consignment Voucher</p>
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
                  <span>Contractor: <strong>{damPrintVoucher.contractorName}</strong> ({damPrintVoucher.contractorPhone || 'N/A'})</span>
                  <span>Date: <strong>{damPrintVoucher.date}</strong></span>
                </div>
              </div>

              {/* Tally Table */}
              <div>
                <div className="font-bold text-[11px] text-slate-700 mb-1">INDIVIDUAL FISHES TALLY LIST</div>
                <table className="w-full border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                      <th className="border border-slate-300 p-1.5 text-center w-8">#</th>
                      <th className="border border-slate-300 p-1.5">Fish Item</th>
                      <th className="border border-slate-300 p-1.5 text-center">Weight</th>
                      <th className="border border-slate-300 p-1.5 text-right">Price (₹/Kg)</th>
                      <th className="border border-slate-300 p-1.5 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(damPrintVoucher.tallyItems || []).map((row, i) => {
                      const kg = Number((Number(row.kg || 0) + Number(row.grams || 0)/1000).toFixed(3));
                      const tot = Number((kg * Number(row.price || 0)).toFixed(2));
                      return (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{i + 1}</td>
                          <td className="border border-slate-300 p-1.5 font-bold">{row.itemName || 'Fish Variety'}</td>
                          <td className="border border-slate-300 p-1.5 text-center font-mono">{kg} Kg ({row.kg || 0}kg {row.grams || 0}g)</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono">₹{row.price}</td>
                          <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">₹{tot.toLocaleString('en-IN')}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-50 font-bold border-t-2 border-slate-400">
                      <td colSpan={2} className="border border-slate-300 p-1.5 text-right">GROSS CATCH TOTAL:</td>
                      <td className="border border-slate-300 p-1.5 text-center font-mono">{damPrintVoucher.totalGrossKg} Kg</td>
                      <td className="border border-slate-300 p-1.5"></td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-black text-sm">
                        ₹{damPrintVoucher.catchTotalValue?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 5-Point Settlement Breakdown */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-2">
                <div className="font-bold text-[11px] text-slate-800">5-POINT CR / DR SETTLEMENT LEDGER</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div>1. Advance: <strong className="font-mono">{damPrintVoucher.settlementDetails?.advance?.type} ₹{damPrintVoucher.settlementDetails?.advance?.amount || 0}</strong></div>
                    <div>2. Khata: <strong className="font-mono">{damPrintVoucher.settlementDetails?.khata?.type} ₹{damPrintVoucher.settlementDetails?.khata?.amount || 0}</strong></div>
                    <div>3. OD (Overdraft): <strong className="font-mono">{damPrintVoucher.settlementDetails?.od?.type} ₹{damPrintVoucher.settlementDetails?.od?.amount || 0}</strong></div>
                  </div>
                  <div>
                    <div>4. Expense: <strong className="font-mono">{damPrintVoucher.settlementDetails?.expense?.type} ₹{damPrintVoucher.settlementDetails?.expense?.amount || 0}</strong></div>
                    <div>5. Festival Exp: <strong className="font-mono">{damPrintVoucher.settlementDetails?.festivalExpense?.type} ₹{damPrintVoucher.settlementDetails?.festivalExpense?.amount || 0}</strong></div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline font-bold">
                  <span>NET PAYABLE SETTLEMENT:</span>
                  <span className="font-mono font-black text-base text-slate-900">
                    ₹{damPrintVoucher.netConsignmentSettlement?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-8 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
                <div>Contractor Signature: __________________</div>
                <div>Depot Manager Signature: __________________</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Shrinkage / Drip Loss */}
      {activeTab === 'shrinkage' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-6 shadow-xs max-w-2xl mx-auto space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2">
              <TrendingDown className="text-amber-600" size={18} />
              <span>Record Seafood Moisture Loss & Ice Melt Shrinkage</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Seafood stored on crushed ice naturally loses 2-4% moisture per day. Record shrinkage to keep book stock matching physical scale weight.
            </p>
          </div>

          <form onSubmit={handleShrinkageSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Fish Variety *</label>
              <select
                value={shrinkageForm.menuItemId}
                onChange={(e) => setShrinkageForm({ ...shrinkageForm, menuItemId: e.target.value })}
                required
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Choose Fish Variety --</option>
                {fishList.map(f => (
                  <option key={f._id} value={f._id}>{f.name} (Current Stock: {f.stock || 0} kg)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shrinkage Weight (Kg) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.05"
                  required
                  value={shrinkageForm.grossKgLost}
                  onChange={(e) => setShrinkageForm({ ...shrinkageForm, grossKgLost: e.target.value })}
                  placeholder="e.g. 2.4"
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Shrinkage Reason *</label>
                <select
                  value={shrinkageForm.reason}
                  onChange={(e) => setShrinkageForm({ ...shrinkageForm, reason: e.target.value })}
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-amber-500"
                >
                  <option value="Ice Melt / Drip Loss">Ice Melt / Natural Drip Loss</option>
                  <option value="Spoilage / Damaged">Spoiled / Damaged in Cold Chain</option>
                  <option value="Cutting Trimming Wastage">Extra Cutting & Trimming Wastage</option>
                  <option value="Scale Calibration Discrepancy">End of Day Physical Scale Audit Variance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Inspector Notes</label>
              <input
                type="text"
                value={shrinkageForm.notes}
                onChange={(e) => setShrinkageForm({ ...shrinkageForm, notes: e.target.value })}
                placeholder="e.g. End of day crate re-weighing variance"
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Recording Shrinkage...' : 'Record Shrinkage Adjustment'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: Stock Movement Audit Log */}
      {activeTab === 'logs' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl overflow-hidden shadow-xs space-y-4 p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-extrabold text-[#1e293b] flex items-center gap-2">
              <History size={16} className="text-sky-600" />
              <span>Permanent Seafood Stock Audit Trail (Last 200 Logs)</span>
            </h2>
            <span className="text-xs text-slate-600 font-bold">{stockLogs.length} entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF0E4] text-[#1e293b] border-b border-[#E8DCCB] uppercase tracking-wider text-[11px] font-black">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Fish Variety</th>
                  <th className="p-3">Transaction Type</th>
                  <th className="p-3">Weight Change (Kg)</th>
                  <th className="p-3">Balance Stock (Kg)</th>
                  <th className="p-3">Supplier / Ref</th>
                  <th className="p-3">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DCCB] font-medium">
                {stockLogs.map((log) => {
                  const isPositive = (Number(log.quantityChange) || 0) > 0;
                  const d = new Date(log.createdAt);
                  const timeFormatted = isNaN(d.getTime()) ? '' : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <tr key={log._id} className="hover:bg-[#FAF3E8] transition-colors">
                      <td className="p-3 text-[11px] text-slate-600 whitespace-nowrap">
                        {timeFormatted}
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {log.itemName}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.type.includes('Procurement') || log.type.includes('Stock-In')
                            ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                            : log.type.includes('Reversal') || log.type.includes('Refund')
                              ? 'bg-blue-100 border-blue-300 text-blue-800'
                              : log.type.includes('Shrinkage') || log.type.includes('Wastage')
                                ? 'bg-amber-100 border-amber-300 text-amber-900'
                                : 'bg-rose-100 border-rose-300 text-rose-800'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className={`p-3 font-mono font-bold ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isPositive ? `+${log.quantityChange}` : log.quantityChange} kg
                      </td>
                      <td className="p-3 font-mono text-slate-800 font-bold">
                        {log.finalStock !== undefined ? `${log.finalStock} kg` : '-'}
                      </td>
                      <td className="p-3 text-slate-700 text-[11px]">
                        {log.supplierName ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md w-fit text-[10px]">
                              {log.supplierName}
                            </span>
                            {log.crateReference ? (
                              <span className="text-[10px] text-slate-500 font-medium">{log.crateReference}</span>
                            ) : null}
                          </div>
                        ) : log.cutType ? (
                          <span className="text-sky-800 font-bold">{log.cutType} </span>
                        ) : log.billNumber ? (
                          <span className="font-mono text-slate-800 font-bold">Bill #{log.billNumber}</span>
                        ) : (
                          <span className="text-slate-600">{log.notes || '-'}</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-[11px]">
                        {log.performedBy || 'System'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
