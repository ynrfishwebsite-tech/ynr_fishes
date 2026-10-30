import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Check, Loader2, Truck, Ship, Package, IndianRupee, Wallet, RotateCcw, ArrowDownLeft, FileText, User, MapPin } from 'lucide-react';
import { getOperationsList, createOperationEntry, getSuppliers, createSupplier } from '../../../api/operations/operations';

const OperationModal = ({ isOpen, onClose, operationType, onSaved, menuCatalog = [] }) => {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'history'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({ name: '', phone: '', harbor: '' });

  // Form State
  const [formData, setFormData] = useState({
    supplier: '',
    supplierName: '',
    supplierPhone: '',
    harbor: '',
    customerName: '',
    customerPhone: '',
    destinationCity: '',
    vehicleNumber: '',
    driverName: '',
    fishName: '',
    category: '',
    boxesCount: '',
    grossWeightKg: '',
    iceDeductionKg: '',
    netWeightKg: '',
    ratePerKg: '',
    totalAmount: '',
    paidAmount: '',
    balanceAmount: '',
    paymentMode: 'Cash',
    notes: ''
  });

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOperationsList(operationType);
      setHistoryList(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [operationType]);

  // Load suppliers and history on open
  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      loadHistory();
    }
  }, [isOpen, loadSuppliers, loadHistory]);

  // Supplier selection: Auto-fill supplier details
  const handleSelectSupplier = (supplierId) => {
    const found = suppliers.find(s => s._id === supplierId);
    if (found) {
      setFormData(prev => ({
        ...prev,
        supplier: found._id,
        supplierName: found.name,
        supplierPhone: found.phone || prev.supplierPhone,
        harbor: found.harbor || prev.harbor
      }));
    } else {
      setFormData(prev => ({ ...prev, supplier: '', supplierName: '' }));
    }
  };

  // Live Auto-Calculations
  const updateGrossWeight = (gross) => {
    const g = parseFloat(gross) || 0;
    const ice = parseFloat(formData.iceDeductionKg) || 0;
    const net = Math.max(0, Math.round((g - ice) * 100) / 100);
    const rate = parseFloat(formData.ratePerKg) || 0;
    const total = Math.round(net * rate * 100) / 100;
    const paid = parseFloat(formData.paidAmount) || 0;
    const bal = Math.max(0, Math.round((total - paid) * 100) / 100);
    setFormData(prev => ({
      ...prev,
      grossWeightKg: gross,
      netWeightKg: net > 0 ? String(net) : '',
      totalAmount: total > 0 ? String(total) : prev.totalAmount,
      balanceAmount: bal > 0 ? String(bal) : '0'
    }));
  };

  const updateIceDeduction = (ice) => {
    const g = parseFloat(formData.grossWeightKg) || 0;
    const i = parseFloat(ice) || 0;
    const net = Math.max(0, Math.round((g - i) * 100) / 100);
    const rate = parseFloat(formData.ratePerKg) || 0;
    const total = Math.round(net * rate * 100) / 100;
    const paid = parseFloat(formData.paidAmount) || 0;
    const bal = Math.max(0, Math.round((total - paid) * 100) / 100);
    setFormData(prev => ({
      ...prev,
      iceDeductionKg: ice,
      netWeightKg: net > 0 ? String(net) : '',
      totalAmount: total > 0 ? String(total) : prev.totalAmount,
      balanceAmount: bal > 0 ? String(bal) : '0'
    }));
  };

  const updateRate = (rate) => {
    const r = parseFloat(rate) || 0;
    const net = parseFloat(formData.netWeightKg) || (parseFloat(formData.grossWeightKg) || 0);
    const boxes = parseFloat(formData.boxesCount) || 0;
    let total = 0;
    if (operationType === 'Export' && boxes > 0 && !net) {
      total = Math.round(boxes * r * 100) / 100;
    } else {
      total = Math.round(net * r * 100) / 100;
    }
    const paid = parseFloat(formData.paidAmount) || 0;
    const bal = Math.max(0, Math.round((total - paid) * 100) / 100);
    setFormData(prev => ({
      ...prev,
      ratePerKg: rate,
      totalAmount: total > 0 ? String(total) : prev.totalAmount,
      balanceAmount: bal > 0 ? String(bal) : '0'
    }));
  };

  const updatePaid = (paid) => {
    const p = parseFloat(paid) || 0;
    const total = parseFloat(formData.totalAmount) || 0;
    const bal = Math.max(0, Math.round((total - p) * 100) / 100);
    setFormData(prev => ({
      ...prev,
      paidAmount: paid,
      balanceAmount: bal > 0 ? String(bal) : '0'
    }));
  };

  // Handle Quick Add Supplier
  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierData.name.trim()) return;
    try {
      const created = await createSupplier(newSupplierData);
      if (created) {
        setSuppliers(prev => [created, ...prev]);
        setFormData(prev => ({
          ...prev,
          supplier: created._id,
          supplierName: created.name,
          supplierPhone: created.phone || '',
          harbor: created.harbor || ''
        }));
        setShowAddSupplierModal(false);
        setNewSupplierData({ name: '', phone: '', harbor: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Operation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        operationType,
        grossWeightKg: Number(formData.grossWeightKg) || 0,
        iceDeductionKg: Number(formData.iceDeductionKg) || 0,
        netWeightKg: Number(formData.netWeightKg) || (Number(formData.grossWeightKg) || 0),
        boxesCount: Number(formData.boxesCount) || 0,
        ratePerKg: Number(formData.ratePerKg) || 0,
        totalAmount: Number(formData.totalAmount) || 0,
        paidAmount: Number(formData.paidAmount) || 0,
        balanceAmount: Number(formData.balanceAmount) || 0
      };
      await createOperationEntry(payload);
      if (onSaved) onSaved();
      loadHistory();
      setActiveTab('history');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const getIcon = () => {
    switch (operationType) {
      case 'Import': return <Ship className="text-sky-600" size={20} />;
      case 'Export': return <Package className="text-amber-600" size={20} />;
      case 'Sales': return <IndianRupee className="text-emerald-600" size={20} strokeWidth={2.5} />;
      case 'Expenses': return <Wallet className="text-rose-600" size={20} />;
      case 'Purchase': return <ArrowDownLeft className="text-blue-600" size={20} />;
      case 'Purchase Return': return <RotateCcw className="text-amber-700" size={20} />;
      case 'Sales Return': return <RotateCcw className="text-orange-600" size={20} />;
      case 'Vehicle / Others': return <Truck className="text-purple-600" size={20} />;
      default: return <FileText className="text-slate-600" size={20} />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-[#FFFDF9] border border-[#E8DCCB] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#FDE8D0] via-[#FCE1BE] to-[#F7EFE2] border-b border-[#E8DCCB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/80 border border-amber-300 flex items-center justify-center shadow-xs">
              {getIcon()}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-wide uppercase">
                {operationType} Management
              </h2>
              <p className="text-[10px] text-amber-900 font-bold">Depot Operation Registry & Accounting</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/70 p-0.5 rounded-xl border border-amber-300">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${activeTab === 'create' ? 'bg-[#994d1c] text-white shadow-xs' : 'text-slate-700 hover:text-black'}`}
              >
                + New Entry
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${activeTab === 'history' ? 'bg-[#994d1c] text-white shadow-xs' : 'text-slate-700 hover:text-black'}`}
              >
                Recent Log ({historyList.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/80 hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-slate-500 transition-colors ml-2"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Supplier Section (For Import, Purchase, Purchase Return) */}
              {(operationType === 'Import' || operationType === 'Purchase' || operationType === 'Purchase Return') && (
                <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                      <User size={13} className="text-amber-800" />
                      Supplier & Harbor Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddSupplierModal(true)}
                      className="text-[10px] font-black text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus size={11} /> Add New Supplier
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Supplier Auto-select Dropdown */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Select Supplier *</label>
                      <select
                        value={formData.supplier}
                        onChange={(e) => handleSelectSupplier(e.target.value)}
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-600"
                        required={operationType !== 'Purchase Return'}
                      >
                        <option value="">-- Choose Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s._id} value={s._id}>
                            {s.name} {s.harbor ? `(${s.harbor})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Auto-filled Phone */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Supplier Mobile</label>
                      <input
                        type="text"
                        value={formData.supplierPhone}
                        onChange={(e) => setFormData({ ...formData, supplierPhone: e.target.value })}
                        placeholder="e.g. 9849313889"
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                      />
                    </div>

                    {/* Auto-filled Harbor / Port */}
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Origin Harbor / Port</label>
                      <input
                        type="text"
                        value={formData.harbor}
                        onChange={(e) => setFormData({ ...formData, harbor: e.target.value })}
                        placeholder="e.g. Mangalore / Vizag"
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Customer / Destination Section (For Export, Sales, Sales Return) */}
              {(operationType === 'Export' || operationType === 'Sales Return') && (
                <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                    <MapPin size={13} className="text-blue-800" />
                    Customer & Destination
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Customer / Buyer Name *</label>
                      <input
                        type="text"
                        value={formData.customerName}
                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                        placeholder="e.g. Hyderabad Wholesale Dealer"
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Customer Phone</label>
                      <input
                        type="text"
                        value={formData.customerPhone}
                        onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                        placeholder="e.g. 9849313889"
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Destination City</label>
                      <input
                        type="text"
                        value={formData.destinationCity}
                        onChange={(e) => setFormData({ ...formData, destinationCity: e.target.value })}
                        placeholder="e.g. Hyderabad / Bangalore"
                        className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Fish Variety & Quantity Details */}
              <div className="p-3.5 bg-[#FFFDF9] border border-[#E8DCCB] rounded-xl space-y-3 shadow-2xs">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                  <Package size={13} className="text-amber-800" />
                  Fish Varieties & Weight Breakdown
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Fish Variety */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Fish Variety</label>
                    <select
                      value={formData.fishName}
                      onChange={(e) => setFormData({ ...formData, fishName: e.target.value })}
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="">-- Select Fish Item --</option>
                      {menuCatalog.map(m => (
                        <option key={m._id} value={m.name}>{m.name}</option>
                      ))}
                      <option value="Mixed Wholesale Boxes">Mixed Wholesale Boxes</option>
                      <option value="General Seafood Consignment">General Seafood Consignment</option>
                    </select>
                  </div>

                  {/* Boxes Count */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Total Boxes (Qty)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.boxesCount}
                      onChange={(e) => setFormData({ ...formData, boxesCount: e.target.value })}
                      placeholder="e.g. 5"
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>

                  {/* Vehicle Number */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Vehicle / Transport #</label>
                    <input
                      type="text"
                      value={formData.vehicleNumber}
                      onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
                      placeholder="e.g. AP 04 TX 1234"
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Weight Breakdown Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Gross Weight (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.grossWeightKg}
                      onChange={(e) => updateGrossWeight(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Ice / Tare Deduction (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.iceDeductionKg}
                      onChange={(e) => updateIceDeduction(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-amber-700 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-emerald-800 mb-1">Net Weight (Kg) ✓</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.netWeightKg}
                      onChange={(e) => setFormData({ ...formData, netWeightKg: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-black text-emerald-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Rate (₹ / Kg or Box)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.ratePerKg}
                      onChange={(e) => updateRate(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Financials & Settlement */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50/70 to-orange-50/50 border border-amber-300 rounded-xl space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1.5">
                  <IndianRupee size={13} className="text-amber-800" strokeWidth={2.5} />
                  Exact Billing & Payment Breakdown
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Total Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-white border border-amber-400 rounded-xl px-3 py-2 text-sm font-black text-amber-950 focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Paid Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.paidAmount}
                      onChange={(e) => updatePaid(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-rose-800 mb-1">Balance Due (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      readOnly
                      value={formData.balanceAmount}
                      placeholder="0.00"
                      className="w-full bg-rose-50 border border-rose-300 rounded-xl px-3 py-2 text-xs font-black text-rose-900 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Payment Mode</label>
                    <select
                      value={formData.paymentMode}
                      onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                      className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Khata / Credit">Khata / Credit</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#994d1c] to-[#7c3f1d] hover:from-[#884318] hover:to-[#6c3618] text-white shadow-md active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Save {operationType} Entry</span>
                </button>
              </div>
            </form>
          ) : (
            /* History Table */
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 text-center text-slate-400">Loading records...</div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold">No {operationType} records found.</div>
              ) : (
                <div className="overflow-x-auto border border-[#E8DCCB] rounded-xl">
                  <table className="w-full text-left text-[11px] text-slate-700">
                    <thead className="bg-[#F7EFE2] border-b border-[#E8DCCB] font-bold text-slate-800 uppercase text-[9.5px]">
                      <tr>
                        <th className="p-2.5">Ref #</th>
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Party / Harbor</th>
                        <th className="p-2.5">Variety / Details</th>
                        <th className="p-2.5 text-right">Net Kg</th>
                        <th className="p-2.5 text-right">Rate</th>
                        <th className="p-2.5 text-right">Total (₹)</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8DCCB]/60">
                      {historyList.map(item => (
                        <tr key={item._id} className="hover:bg-amber-50/40">
                          <td className="p-2.5 font-mono font-bold text-amber-900">{item.referenceNo || '---'}</td>
                          <td className="p-2.5">{new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                          <td className="p-2.5 font-bold">
                            {item.supplierName || item.customerName || item.vehicleNumber || '---'}
                            {item.harbor && <span className="block text-[9.5px] text-slate-400 font-normal">📍 {item.harbor}</span>}
                          </td>
                          <td className="p-2.5">{item.fishName || (item.boxesCount ? `${item.boxesCount} Boxes` : '---')}</td>
                          <td className="p-2.5 text-right font-mono font-bold">{item.netWeightKg > 0 ? `${item.netWeightKg} Kg` : '---'}</td>
                          <td className="p-2.5 text-right font-mono">₹{item.ratePerKg || 0}</td>
                          <td className="p-2.5 text-right font-mono font-black text-amber-950">₹{Number(item.totalAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              {item.status}
                            </span>
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
      </div>

      {/* Add Supplier Modal Popup */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-[100000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl border border-amber-300 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
              <h3 className="text-sm font-black text-slate-800 uppercase">+ Add New Supplier</h3>
              <button onClick={() => setShowAddSupplierModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier / Firm Name *</label>
                <input
                  type="text"
                  required
                  value={newSupplierData.name}
                  onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                  placeholder="e.g. Mangalore Coastal Fish Traders"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newSupplierData.phone}
                  onChange={(e) => setNewSupplierData({ ...newSupplierData, phone: e.target.value })}
                  placeholder="e.g. 9849313889"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Harbor / Port Source</label>
                <input
                  type="text"
                  value={newSupplierData.harbor}
                  onChange={(e) => setNewSupplierData({ ...newSupplierData, harbor: e.target.value })}
                  placeholder="e.g. Mangalore Harbor"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#994d1c] text-white rounded-xl text-xs font-black"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationModal;
