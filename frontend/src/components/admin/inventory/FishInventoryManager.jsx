import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';
import realtimeService from '../../../services/realtimeService';
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
  Filter
} from 'lucide-react';

export default function FishInventoryManager({ user }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'procurement' | 'shrinkage' | 'logs'
  const [fishList, setFishList] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

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
      const [invRes, logsRes] = await Promise.all([
        axios.get(`${getApiUrl()}/inventory`, { headers: getAuthHeader() }),
        axios.get(`${getApiUrl()}/inventory/logs`, { headers: getAuthHeader() })
      ]);

      if (Array.isArray(invRes.data)) setFishList(invRes.data);
      if (Array.isArray(logsRes.data)) setStockLogs(logsRes.data);
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

      {/* Feedback Message */}
      {message.text && (
        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border animate-in fade-in ${
          message.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
            : 'bg-red-950/80 border-red-500/50 text-red-300'
        }`}>
          {message.text}
        </div>
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
                        {fish.scientificName && (
                          <div className="text-[10px] text-sky-700 italic font-medium">{fish.scientificName}</div>
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

      {/* TAB 2: Procurement (Mandi / Harbor Stock-In) */}
      {activeTab === 'procurement' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-6 shadow-xs max-w-2xl mx-auto space-y-5">
          <div>
            <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2">
              <ArrowDownLeft className="text-sky-600" size={18} />
              <span>Record / Harbor Catch Received (Stock-In)</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              Directly adds gross raw weight in kilograms to cold-storage inventory.
            </p>
          </div>

          <form onSubmit={handleProcurementSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Fish Variety *</label>
              <select
                value={procurementForm.menuItemId}
                onChange={(e) => setProcurementForm({ ...procurementForm, menuItemId: e.target.value })}
                required
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-sky-500"
              >
                <option value="">-- Choose Fish Variety --</option>
                {fishList.map(f => (
                  <option key={f._id} value={f._id}>{f.name} (Current Stock: {f.stock || 0} kg)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gross Catch Received (Kg) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  required
                  value={procurementForm.grossKgAdded}
                  onChange={(e) => setProcurementForm({ ...procurementForm, grossKgAdded: e.target.value })}
                  placeholder="e.g. 85.5"
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Purchase Price (₹ / Kg)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={procurementForm.purchasePricePerKg}
                  onChange={(e) => setProcurementForm({ ...procurementForm, purchasePricePerKg: e.target.value })}
                  placeholder="e.g. 190"
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Harbor Supplier Name</label>
              <input
                type="text"
                value={procurementForm.supplierName}
                onChange={(e) => setProcurementForm({ ...procurementForm, supplierName: e.target.value })}
                placeholder="e.g. Mangalore Harbour / Local Supplier"
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Crate Reference</label>
              <input
                type="text"
                value={procurementForm.notes}
                onChange={(e) => setProcurementForm({ ...procurementForm, notes: e.target.value })}
                placeholder="e.g. 2 Crates received iced, size grade 1-2kg"
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs text-slate-800 font-medium placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Recording Stock-In...' : 'Confirm Stock-In Catch'}
            </button>
          </form>
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
                  <th className="p-3">Cut / Bill Ref</th>
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
                      <td className="p-3 text-slate-600 text-[11px]">
                        {log.cutType ? <span className="text-sky-800 font-bold">{log.cutType} </span> : null}
                        {log.billNumber ? `(Bill #${log.billNumber})` : log.notes || '-'}
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
