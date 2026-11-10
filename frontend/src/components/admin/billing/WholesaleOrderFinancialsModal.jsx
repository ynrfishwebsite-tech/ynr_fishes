import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Scale, 
  FileText, 
  CheckCircle, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  User, 
  Phone, 
  Building, 
  History, 
  AlertCircle,
  Truck,
  Plus,
  Clock
} from 'lucide-react';
import api from '../../../api/system/axios';

/**
 * Wholesale / Export Financials & Ledger Adjustment Modal
 * Handles:
 * 1. Debit (Dr) & Credit (Cr) adjustments
 * 2. Additional bill charges (Ice, Box, Transport)
 * 3. Partial Payment recording & Balance remaining
 * 4. Previous Bills history & Outstanding Khata Ledger
 */
export default function WholesaleOrderFinancialsModal({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
  showToast
}) {
  if (!isOpen || !order) return null;

  const [activeSubTab, setActiveSubTab] = useState('adjustments'); // 'adjustments' | 'partial_pay' | 'ledger'
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);

  // Form states: Dr / Cr Adjustment
  const [adjustmentType, setAdjustmentType] = useState('Dr'); // 'Dr' (Add charge) | 'Cr' (Concession / Credit)
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // Form states: Extra Bill Charges
  const [iceCharges, setIceCharges] = useState(String(order.iceCharges || 0));
  const [boxCharges, setBoxCharges] = useState(String(order.boxCharges || 0));
  const [transportCharges, setTransportCharges] = useState(String(order.transportCharges || order.deliveryCharge || 0));

  // Form states: Partial Payment
  const [partialPayAmount, setPartialPayAmount] = useState('');
  const [partialPayMode, setPartialPayMode] = useState('Cash'); // 'Cash' | 'UPI' | 'Bank Transfer'
  const [partialPayNote, setPartialPayNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const cleanPhone = (order.customerPhone || '').replace(/\D/g, '').slice(-10);
  const orderTotal = Number(order.total || 0);

  // Fetch Khata ledger on mount if phone is present
  useEffect(() => {
    if (!cleanPhone) return;
    const fetchLedger = async () => {
      try {
        setLoadingLedger(true);
        const res = await api.get(`/credit-accounts/khata/${cleanPhone}/ledger`);
        setLedgerData(res.data);
      } catch (err) {
        console.warn('Could not fetch khata ledger:', err);
      } finally {
        setLoadingLedger(false);
      }
    };
    fetchLedger();
  }, [cleanPhone]);

  // Handle Dr / Cr Adjustment submission
  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(adjustmentAmount);
    if (!amt || amt <= 0) {
      if (showToast) showToast('Please enter a valid adjustment amount', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      // Update order's charges / discounts in DB
      const currentCharges = order.customSettlements || [];
      const newCharge = {
        label: adjustmentReason.trim() || (adjustmentType === 'Dr' ? 'Extra Debit Adjustment' : 'Credit Concession'),
        type: adjustmentType,
        amount: amt,
        createdAt: new Date()
      };

      const updatedSettlements = [...currentCharges, newCharge];
      
      // Calculate net change to order total
      let netAdj = (order.netAdjustment || 0) + (adjustmentType === 'Dr' ? amt : -amt);
      const updatedTotal = Math.max(0, orderTotal + (adjustmentType === 'Dr' ? amt : -amt));

      await api.post('/bills/save', {
        id: order._id,
        tableNo: order.tableNo,
        items: order.items,
        total: updatedTotal,
        netAdjustment: netAdj,
        customSettlements: updatedSettlements,
        skipNotification: true
      });

      if (showToast) showToast(`Recorded ${adjustmentType} of ₹${amt.toFixed(2)} successfully!`, 'success');
      if (onOrderUpdated) onOrderUpdated();
      onClose();
    } catch (err) {
      console.error('Error saving adjustment:', err);
      if (showToast) showToast('Failed to save adjustment: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Bill Charges (Ice, Box, Transport) update
  const handleUpdateCharges = async () => {
    try {
      setIsSubmitting(true);
      const ice = parseFloat(iceCharges) || 0;
      const box = parseFloat(boxCharges) || 0;
      const trans = parseFloat(transportCharges) || 0;

      await api.post('/bills/save', {
        id: order._id,
        tableNo: order.tableNo,
        items: order.items,
        iceCharges: ice,
        boxCharges: box,
        transportCharges: trans,
        deliveryCharge: trans,
        skipNotification: true
      });

      if (showToast) showToast('Bill charges updated successfully!', 'success');
      if (onOrderUpdated) onOrderUpdated();
      onClose();
    } catch (err) {
      console.error('Error updating charges:', err);
      if (showToast) showToast('Failed to update charges', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Partial Payment submission
  const handleSavePartialPayment = async (e) => {
    e.preventDefault();
    const paid = parseFloat(partialPayAmount);
    if (!paid || paid <= 0) {
      if (showToast) showToast('Please enter a valid partial payment amount', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const remainingDue = Math.max(0, orderTotal - paid);

      // Record in Khata settle API
      if (cleanPhone) {
        await api.post('/credit-accounts/khata/settle', {
          phoneNumber: cleanPhone,
          amount: paid,
          paymentMode: partialPayMode,
          note: `Partial payment for order #${order.billNumber || order.tableNo}: ₹${paid} (Remaining Due: ₹${remainingDue}). ${partialPayNote}`
        }).catch(err => console.warn('Khata auto-record note:', err));
      }

      // Record partial payment on order
      await api.post('/bills/save', {
        id: order._id,
        tableNo: order.tableNo,
        items: order.items,
        paidAmount: (order.paidAmount || 0) + paid,
        dueAmount: remainingDue,
        partialPaymentHistory: [
          ...(order.partialPaymentHistory || []),
          { amount: paid, mode: partialPayMode, note: partialPayNote, date: new Date() }
        ],
        skipNotification: true
      });

      if (showToast) showToast(`Recorded partial payment of ₹${paid.toFixed(2)}! Remaining Due: ₹${remainingDue.toFixed(2)}`, 'success');
      if (onOrderUpdated) onOrderUpdated();
      onClose();
    } catch (err) {
      console.error('Error recording partial payment:', err);
      if (showToast) showToast('Failed to record partial payment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-[#FDFBF7] w-full max-w-2xl rounded-3xl border-2 border-[#E8DCCB] shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FAF0E4] border-b border-[#fed7aa] p-3.5 sm:px-5 sm:py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-[#ea580c] border border-amber-300">
              <Scale size={18} />
            </span>
            <div>
              <h3 className="font-black text-base text-slate-900 leading-tight">
                Wholesale Financials & Dealer Ledger
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Order <strong>#{order.billNumber || order.tableNo}</strong> • {order.customerName || 'Wholesale Dealer'} ({order.customerPhone || 'N/A'})
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-900 border border-[#E8DCCB] transition-all cursor-pointer shadow-2xs"
          >
            <X size={16} />
          </button>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center gap-1.5 p-2.5 bg-white border-b border-[#E8DCCB] overflow-x-auto">
          {[
            { id: 'adjustments', label: 'Dr / Cr Adjustments', icon: ArrowUpRight },
            { id: 'charges', label: 'Bill Charges (Ice/Box)', icon: Truck },
            { id: 'partial_pay', label: 'Partial Payment', icon: DollarSign },
            { id: 'ledger', label: 'Previous Bills & Ledger', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#ea580c] text-white shadow-2xs font-black'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[68vh] space-y-4">
          {/* Order Summary Pill */}
          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Active Bill Amount</span>
              <span className="text-lg font-mono font-black text-slate-900">₹{orderTotal.toFixed(2)}</span>
            </div>
            {order.paidAmount > 0 && (
              <div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Already Paid</span>
                <span className="text-sm font-mono font-bold text-emerald-700">₹{order.paidAmount.toFixed(2)}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold text-rose-600 uppercase block">Remaining Due</span>
              <span className="text-lg font-mono font-black text-rose-700">
                ₹{Math.max(0, orderTotal - (order.paidAmount || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          {/* TAB 1: Dr / Cr Adjustments */}
          {activeSubTab === 'adjustments' && (
            <form onSubmit={handleSaveAdjustment} className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Record Debit (Dr) or Credit (Cr) Adjustment:
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType('Dr')}
                  className={`py-2 px-3 rounded-xl border-2 font-black text-xs text-center transition-all cursor-pointer ${
                    adjustmentType === 'Dr'
                      ? 'border-rose-500 bg-rose-50 text-rose-800 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  ➕ Debit (Dr) - Add Charge to Bill
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType('Cr')}
                  className={`py-2 px-3 rounded-xl border-2 font-black text-xs text-center transition-all cursor-pointer ${
                    adjustmentType === 'Cr'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  ➖ Credit (Cr) - Deduct / Concession
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Adjustment Amount (₹) *</label>
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  placeholder="e.g. 500"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Reason / Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Extra crate ice charge, Dealer discount, Wastage allowance"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Recording Adjustment...' : `Save ${adjustmentType} Adjustment`}
              </button>
            </form>
          )}

          {/* TAB 2: Bill Charges */}
          {activeSubTab === 'charges' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Update Bill Specific Lot Charges:
              </span>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DCCB]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ice Charges (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={iceCharges}
                    onChange={(e) => setIceCharges(e.target.value)}
                    className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-lg px-2 py-1 text-sm font-black font-mono"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DCCB]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Box / Crate Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={boxCharges}
                    onChange={(e) => setBoxCharges(e.target.value)}
                    className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-lg px-2 py-1 text-sm font-black font-mono"
                  />
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-[#E8DCCB]">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Transport Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={transportCharges}
                    onChange={(e) => setTransportCharges(e.target.value)}
                    className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-lg px-2 py-1 text-sm font-black font-mono"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUpdateCharges}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Updating Charges...' : 'Save Bill Charges'}
              </button>
            </div>
          )}

          {/* TAB 3: Partial Payment */}
          {activeSubTab === 'partial_pay' && (
            <form onSubmit={handleSavePartialPayment} className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Record Partial Payment Received:
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Payment Amount (₹) *</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={orderTotal}
                    required
                    placeholder={`Max ₹${orderTotal}`}
                    value={partialPayAmount}
                    onChange={(e) => setPartialPayAmount(e.target.value)}
                    className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl px-3 py-2 text-sm font-black font-mono text-emerald-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Payment Mode</label>
                  <select
                    value={partialPayMode}
                    onChange={(e) => setPartialPayMode(e.target.value)}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {partialPayAmount && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex justify-between items-center text-xs text-emerald-900 font-bold">
                  <span>Balance Remaining after payment:</span>
                  <span className="font-mono text-sm">
                    ₹{Math.max(0, orderTotal - (parseFloat(partialPayAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Receipt Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Advance paid at mandi counter"
                  value={partialPayNote}
                  onChange={(e) => setPartialPayNote(e.target.value)}
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Recording Partial Payment...' : 'Record Payment & Update Bill'}
              </button>
            </form>
          )}

          {/* TAB 4: Previous Bills & Dealer Ledger */}
          {activeSubTab === 'ledger' && (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">
                Dealer Khata Ledger & Previous Transactions:
              </span>

              {loadingLedger ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">
                  Loading dealer khata ledger...
                </div>
              ) : ledgerData ? (
                <div className="space-y-3">
                  {/* Ledger Balance Card */}
                  <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Khata Balance Due</span>
                      <span className="text-xl font-mono font-black text-amber-400">₹{(ledgerData.balance || 0).toFixed(2)}</span>
                    </div>
                    <span className="text-xs font-bold bg-white/10 px-2.5 py-1 rounded-xl">
                      {ledgerData.account?.phoneNumber || cleanPhone}
                    </span>
                  </div>

                  {/* Previous Transactions List */}
                  <div className="border border-[#E8DCCB] rounded-2xl overflow-hidden bg-white max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {(ledgerData.transactions || []).map((tx, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded font-black text-[9.5px] uppercase ${
                              tx.type === 'credit' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {tx.type === 'credit' ? 'Due' : 'Paid'}
                            </span>
                            <span>{tx.note || 'Transaction'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {new Date(tx.date || tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <span className={`font-mono font-black text-sm ${
                          tx.type === 'credit' ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          {tx.type === 'credit' ? '+' : '-'} ₹{Number(tx.amount || 0).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {(!ledgerData.transactions || ledgerData.transactions.length === 0) && (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        No previous ledger transactions found for this dealer.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No Khata credit account found for phone {cleanPhone || 'N/A'}.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

