import { useLanguage } from "../../../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  Wallet,
  CreditCard,
  IndianRupee,
  PieChart,
  Loader2,
  BookOpen,
  Sparkles,
  Check,
  AlertCircle,
  Clock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../../api/system/axios';

const PaymentModal = ({
  total,
  billNumber,
  tableNo,
  customerPhone,
  customerName,
  isLoading,
  onClose,
  onComplete,
  hideUnpaid = false
}) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState('Cash');

  // Effective total to pay via payment mode
  const effectiveTotal = Math.max(0, Number(total.toFixed(2)));

  const [amountPaid, setAmountPaid] = useState(effectiveTotal);
  const [partialPaid, setPartialPaid] = useState(() => Math.round(effectiveTotal * 0.5));
  const [partialMethod, setPartialMethod] = useState('Cash');
  const [splitPayments, setSplitPayments] = useState({ cash: 0, upi: 0, card: 0 });
  const [upiApp, setUpiApp] = useState('PhonePe');
  const [enableQrPayment] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('restaurantSettings'));
      const hasValidUpi = s?.upiId && s.upiId.trim() !== '' && s.upiId.trim() !== 'msbillings@upi';
      return s?.enableQrPayment !== false && Boolean(hasValidUpi);
    } catch (e) {
      return false;
    }
  });

  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';
  const quickAmounts = currencySymbol === '$' ? [10, 50, 100] : [500, 1000, 2000];

  // Update amountPaid when mode or effectiveTotal changes
  useEffect(() => {
    if (mode !== 'Cash') {
      setAmountPaid(effectiveTotal);
    } else {
      setAmountPaid(prev => (prev < effectiveTotal ? effectiveTotal : prev));
    }
    if (effectiveTotal > 0 && (partialPaid === 0 || partialPaid > effectiveTotal)) {
      setPartialPaid(Math.round(effectiveTotal * 0.5));
    }
  }, [effectiveTotal, mode]);

  const balance = amountPaid - effectiveTotal;
  const partialDue = Math.max(0, Number((effectiveTotal - partialPaid).toFixed(2)));
  const mixedTotal = (splitPayments.cash || 0) + (splitPayments.upi || 0) + (splitPayments.card || 0);
  const isMixedValid = Math.abs(mixedTotal - effectiveTotal) < 0.01;
  const remainingMixed = Number((effectiveTotal - mixedTotal).toFixed(2));

  const getIcon = (m, isMobile = false) => {
    const sz = isMobile ? 15 : 18;
    switch (m) {
      case 'Cash': return <IndianRupee size={sz} />;
      case 'Card': return <CreditCard size={sz} />;
      case 'UPI': return <Wallet size={sz} />;
      case 'Mixed': return <PieChart size={sz} />;
      case 'Partial': return <Clock size={sz} className="text-amber-500" />;
      case 'Unpaid': return <BookOpen size={sz} />;
      default: return <IndianRupee size={sz} />;
    }
  };


  const paymentModes = ['Cash', 'UPI', 'Card', 'Mixed', 'Partial', 'Unpaid'].filter(
    (m) => !(hideUnpaid && (m === 'Unpaid' || m === 'Partial'))
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[99999] p-1.5 sm:p-4 overflow-y-auto">
      <div className="bg-surface w-full max-w-[350px] sm:max-w-md rounded-xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] my-auto">
        
        {/* Compact Header */}
        <div className="py-2 px-3 sm:p-4 border-b border-border flex justify-between items-center bg-gradient-to-r from-primary/5 to-accent/5 shrink-0">
          <h2 className="font-bold text-sm sm:text-base text-text-main flex items-center gap-1.5">
            <span>{t("Complete Payment")}</span>
          </h2>
          <button 
            onClick={onClose} 
            className="text-text-muted hover:text-text-main transition-colors p-1 rounded-lg hover:bg-surface-hover cursor-pointer"
            aria-label="Close"
          >
            <X size={17} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Body with Compact Padding */}
        <div className="p-2.5 sm:p-5 overflow-y-auto space-y-2.5 sm:space-y-4">
          
          {/* Amount Due Area */}
          <div className="text-center py-0.5 sm:py-1">
            <span className="text-text-muted text-[10px] sm:text-xs uppercase tracking-wider font-semibold">
              {t("Amount Due")}
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-primary leading-tight mt-0.5">
              {currencySymbol}{effectiveTotal.toFixed(2)}
            </div>
          </div>

          {/* Payment Mode Selection Badges (Fits on single row) */}
          <div>
            <label className="text-[11px] sm:text-xs font-semibold text-text-muted mb-1.5 block uppercase tracking-wider">
              {t("Select Payment Mode")}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-1.5">
              {paymentModes.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex flex-col items-center justify-center gap-1 py-1.5 px-0.5 sm:py-2.5 sm:px-1 rounded-lg sm:rounded-xl border transition-all cursor-pointer ${
                    mode === m
                      ? 'bg-primary/10 border-primary text-primary shadow-xs font-bold'
                      : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                  onClick={() => {
                    if ((m === 'Unpaid' || m === 'Partial') && (!customerPhone || !customerName)) {
                      alert(t("Customer Name and Phone are required for Unpaid/Partial (Khata) bills. Please close and link customer first."));
                      return;
                    }
                    setMode(m);
                    if (m === 'Partial') {
                      if (!partialPaid || partialPaid >= effectiveTotal) {
                        setPartialPaid(Math.round(effectiveTotal * 0.5));
                      }
                    } else if (m !== 'Cash') {
                      setAmountPaid(effectiveTotal);
                    }
                  }}>
                  {getIcon(m, true)}
                  <span className="text-[10px] sm:text-xs font-bold leading-none">{m}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CASH MODE SECTION */}
          {mode === 'Cash' && (
            <div className="space-y-2 sm:space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] sm:text-xs font-semibold text-text-muted">{t("Amount Received")}</label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-sm sm:text-base">{currencySymbol}</span>
                  <input
                    type="number"
                    min="0"
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    className="w-full bg-background border border-border rounded-lg sm:rounded-xl py-1.5 sm:py-2 pl-7 sm:pl-8 pr-3 text-base sm:text-lg font-bold text-text-main focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={amountPaid === 0 ? '' : amountPaid}
                    onChange={(e) => setAmountPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                    autoFocus
                  />
                </div>

                {/* Quick Cash Chips */}
                <div className="flex gap-1 sm:gap-1.5">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className="flex-1 py-1 sm:py-1.5 bg-surface border border-border rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer"
                      onClick={() => setAmountPaid(amt)}>
                      +{currencySymbol}{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="flex-1 py-1 sm:py-1.5 bg-primary/10 border border-primary/20 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                    onClick={() => setAmountPaid(effectiveTotal)}>
                    {t("Exact")}
                  </button>
                </div>
              </div>

              {/* Change to Return Pill */}
              <div className="py-1.5 px-2.5 sm:py-2 sm:px-3 bg-background border border-border rounded-lg sm:rounded-xl flex justify-between items-center">
                <span className="text-[11px] sm:text-xs font-semibold text-text-muted">{t("Change to Return")}</span>
                <span className={`text-sm sm:text-base font-extrabold ${balance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {currencySymbol}{Math.max(0, balance).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* UPI MODE SECTION */}
          {mode === 'UPI' && (
            <div className="space-y-2 sm:space-y-3 animate-in fade-in duration-200">
              {enableQrPayment ? (
                <div className="bg-background p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-primary/20 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                  <div className="bg-primary/10 py-0.5 px-2.5 rounded-full text-[10px] sm:text-xs font-bold text-primary tracking-wide uppercase mb-1.5">
                    {t("Scan & Pay with Any App")}
                  </div>

                  <div className="bg-white p-1.5 sm:p-2.5 rounded-xl shadow-xs border border-border/40 my-1 flex flex-col items-center">
                    <QRCodeSVG
                      value={(() => {
                        let pa = 'maheshsiva864@oksbi';
                        let pn = 'MS Billings';
                        try {
                          const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                          if (s?.upiId && s.upiId !== 'msbillings@upi') pa = s.upiId.trim();
                          if (s?.restaurantName) pn = s.restaurantName.trim();
                        } catch (e) {}
                        const am = Number(effectiveTotal || 0).toFixed(2);
                        const noteText = billNumber ? `Bill #${billNumber} - Rs ${am}` : tableNo ? `Counter ${tableNo} - Rs ${am}` : `Payment Rs ${am}`;
                        const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
                        const tr = `PAY${Date.now()}`;
                        return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                      })()}
                      size={110}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="mt-1.5 text-center text-[11px] sm:text-xs">
                    {t("Amount Due:")} <span className="text-primary font-bold">{currencySymbol}{effectiveTotal.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-background border border-border rounded-xl">
                  <Wallet size={32} className="text-text-muted mb-2 opacity-25" />
                  <div className="font-bold text-text-main text-xs sm:text-sm mb-0.5">{t("UPI Payment Due:")} {currencySymbol}{effectiveTotal.toFixed(2)}</div>
                  <div className="text-[11px] text-text-muted">{t("Waiting for customer payment...")}</div>
                </div>
              )}

              {/* UPI App Selection */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-semibold text-text-muted mb-1 block uppercase tracking-wider">{t("Record UPI App Used")}</label>
                <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
                  {['PhonePe', 'GPay', 'Paytm', 'Amazon Pay', 'BharatPe', 'Other'].map((app) => (
                    <button
                      key={app}
                      type="button"
                      className={`py-1 px-1 rounded-lg border text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                        upiApp === app
                          ? 'bg-primary/10 border-primary text-primary shadow-xs'
                          : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                      }`}
                      onClick={() => setUpiApp(app)}>
                      {app}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MIXED MODE SECTION */}
          {mode === 'Mixed' && (
            <div className="space-y-2 sm:space-y-3 animate-in fade-in duration-200">
              <div className={`p-2.5 rounded-lg sm:rounded-xl border flex flex-col gap-1.5 shadow-xs transition-all ${
                isMixedValid
                  ? 'bg-success/5 border-success/30'
                  : remainingMixed > 0
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-danger/10 border-danger/30'
              }`}>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                  <span className="font-bold text-text-main">{t("Allocated")}</span>
                  <span className={`font-extrabold ${isMixedValid ? 'text-success' : remainingMixed > 0 ? 'text-amber-600' : 'text-danger'}`}>
                    {currencySymbol}{mixedTotal.toFixed(2)} / {currencySymbol}{effectiveTotal.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-border/50 text-[10px] sm:text-xs">
                  <span className="font-semibold text-text-muted">
                    {isMixedValid ? t("Payment fully allocated") : remainingMixed > 0 ? t("Remaining") : t("Over allocated")}
                  </span>
                  <span className={`font-bold ${isMixedValid ? 'text-success' : 'text-text-muted'}`}>
                    {currencySymbol}{Math.abs(remainingMixed).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Split inputs */}
              <div className="space-y-1.5 sm:space-y-2">
                {['cash', 'upi', 'card'].map((method) => (
                  <div key={method} className="flex items-center gap-2">
                    <div className="w-14 sm:w-16 capitalize text-[11px] sm:text-xs font-bold text-text-muted">{t(method)}</div>
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs">{currencySymbol}</span>
                      <input
                        type="number"
                        min="0"
                        onWheel={(e) => e.target.blur()}
                        className="w-full bg-background border border-border rounded-lg py-1 pl-6 pr-2 text-xs sm:text-sm font-bold text-text-main focus:outline-none focus:border-primary"
                        value={splitPayments[method] === 0 ? '' : splitPayments[method]}
                        onChange={(e) => setSplitPayments({
                          ...splitPayments,
                          [method]: Math.max(0, parseFloat(e.target.value) || 0)
                        })}
                        placeholder={`0.00`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Dynamic QR Code for Mixed UPI */}
              {splitPayments.upi > 0 && enableQrPayment && (
                <div className="bg-background p-2.5 rounded-xl border border-primary/20 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                  <div className="bg-primary/10 py-0.5 px-2 rounded-full text-[10px] font-bold text-primary tracking-wide uppercase mb-1">
                    {t("Scan & Pay UPI Portion")} ({currencySymbol}{Number(splitPayments.upi).toFixed(2)})
                  </div>

                  <div className="bg-white p-1.5 rounded-xl shadow-xs border border-border/40 my-1 flex flex-col items-center">
                    <QRCodeSVG
                      value={(() => {
                        let pa = 'maheshsiva864@oksbi';
                        let pn = 'MS Billings';
                        try {
                          const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                          if (s?.upiId && s.upiId !== 'msbillings@upi') pa = s.upiId.trim();
                          if (s?.restaurantName) pn = s.restaurantName.trim();
                        } catch (e) {}
                        const am = Number(splitPayments.upi || 0).toFixed(2);
                        const noteText = billNumber ? `Bill #${billNumber} - Rs ${am}` : tableNo ? `Counter ${tableNo} - Rs ${am}` : `Payment Rs ${am}`;
                        const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
                        const tr = `PAY${Date.now()}`;
                        return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                      })()}
                      size={95}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PARTIAL PAYMENT MODE SECTION */}
          {mode === 'Partial' && (
            <div className="space-y-2.5 sm:space-y-3 animate-in fade-in duration-200">
              {(!customerPhone || !customerName) && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                  <AlertCircle size={14} className="shrink-0 text-amber-600" />
                  <span>{t("Customer linking is recommended so the remaining due can be recorded on Khata.")}</span>
                </div>
              )}

              {/* Paid vs Due Cards */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-background border border-border rounded-xl">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                  <div className="text-[10px] font-bold uppercase text-emerald-600 tracking-wider flex items-center justify-center gap-1">
                    <CheckCircle size={11} />
                    <span>{t("Paid Now")}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-emerald-600 mt-0.5">
                    {currencySymbol}{Number(partialPaid || 0).toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                  <div className="text-[10px] font-bold uppercase text-amber-600 tracking-wider flex items-center justify-center gap-1">
                    <BookOpen size={11} />
                    <span>{t("Khata Due")}</span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-amber-600 mt-0.5">
                    {currencySymbol}{Number(partialDue).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Paid Amount Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[11px] sm:text-xs font-semibold text-text-muted">
                  {t("Amount Paid Now by Customer")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-sm sm:text-base">{currencySymbol}</span>
                  <input
                    type="number"
                    min="1"
                    max={effectiveTotal}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    className="w-full bg-background border border-border rounded-lg sm:rounded-xl py-1.5 sm:py-2 pl-7 sm:pl-8 pr-3 text-base sm:text-lg font-bold text-text-main focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    value={partialPaid === 0 ? '' : partialPaid}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setPartialPaid(Math.min(effectiveTotal, Math.max(0, val)));
                    }}
                    autoFocus
                  />
                </div>

                {/* Quick Percentage Chips */}
                <div className="flex gap-1 sm:gap-1.5 mt-0.5">
                  {[
                    { label: '25%', f: 0.25 },
                    { label: '50%', f: 0.5 },
                    { label: '75%', f: 0.75 }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className="flex-1 py-1 bg-surface border border-border rounded-md text-[10px] sm:text-xs font-bold text-text-muted hover:text-text-main hover:bg-surface-hover transition-all cursor-pointer"
                      onClick={() => setPartialPaid(Math.round(effectiveTotal * chip.f))}>
                      {chip.label} ({currencySymbol}{Math.round(effectiveTotal * chip.f)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Method Selection for Paid Portion */}
              <div>
                <label className="text-[10px] sm:text-[11px] font-semibold text-text-muted mb-1 block uppercase tracking-wider">
                  {t("Method for Paid Portion")}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Cash', 'UPI', 'Card'].map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      className={`py-1.5 px-1 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                        partialMethod === pm
                          ? 'bg-primary/10 border-primary text-primary shadow-xs'
                          : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                      }`}
                      onClick={() => setPartialMethod(pm)}>
                      {getIcon(pm, true)}
                      <span>{pm}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* UPI Sub-app & QR if UPI is picked */}
              {partialMethod === 'UPI' && (
                <div className="space-y-2 pt-1">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-semibold text-text-muted mb-1 block uppercase tracking-wider">
                      {t("Record UPI App")}
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {['PhonePe', 'GPay', 'Paytm', 'Amazon Pay', 'BharatPe', 'Other'].map((app) => (
                        <button
                          key={app}
                          type="button"
                          className={`py-1 px-1 rounded-lg border text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                            upiApp === app
                              ? 'bg-primary/10 border-primary text-primary shadow-xs'
                              : 'bg-background border-border text-text-muted hover:bg-surface-hover hover:text-text-main'
                          }`}
                          onClick={() => setUpiApp(app)}>
                          {app}
                        </button>
                      ))}
                    </div>
                  </div>

                  {enableQrPayment && partialPaid > 0 && (
                    <div className="bg-background p-2 rounded-xl border border-primary/20 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                      <div className="bg-primary/10 py-0.5 px-2 rounded-full text-[10px] font-bold text-primary tracking-wide uppercase mb-1">
                        {t("Scan & Pay UPI Deposit")} ({currencySymbol}{Number(partialPaid).toFixed(2)})
                      </div>
                      <div className="bg-white p-1.5 rounded-xl shadow-xs border border-border/40 my-0.5 flex flex-col items-center">
                        <QRCodeSVG
                          value={(() => {
                            let pa = 'maheshsiva864@oksbi';
                            let pn = 'MS Billings';
                            try {
                              const s = JSON.parse(localStorage.getItem('restaurantSettings'));
                              if (s?.upiId && s.upiId !== 'msbillings@upi') pa = s.upiId.trim();
                              if (s?.restaurantName) pn = s.restaurantName.trim();
                            } catch (e) {}
                            const am = Number(partialPaid || 0).toFixed(2);
                            const noteText = billNumber ? `Bill #${billNumber} - Rs ${am}` : tableNo ? `Counter ${tableNo} - Rs ${am}` : `Payment Rs ${am}`;
                            const tn = noteText.replace(/[^a-zA-Z0-9 .#-]/g, '');
                            const tr = `PAY${Date.now()}`;
                            return `upi://pay?pa=${pa}&pn=${encodeURIComponent(pn)}&am=${am}&cu=INR&tn=${encodeURIComponent(tn)}&tr=${tr}`;
                          })()}
                          size={95}
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compact Action Footer */}
        <div className="p-2 sm:p-3 border-t border-border bg-surface shrink-0">
          <button
            className={`w-full py-2.5 sm:py-3 px-3 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
              isLoading
                ? 'bg-blue-600 text-white shadow-blue-500/20 cursor-not-allowed opacity-90'
                : (mode === 'Cash' && balance < 0) || (mode === 'Mixed' && !isMixedValid) || (mode === 'Partial' && (partialPaid <= 0 || partialPaid > effectiveTotal))
                ? 'bg-surface-hover text-slate-800 shadow-none cursor-not-allowed border border-border'
                : mode === 'Unpaid'
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20 hover:shadow-amber-600/40 active:scale-98'
                : mode === 'Partial'
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20 hover:shadow-amber-600/40 active:scale-98'
                : 'bg-success text-white hover:bg-green-600 shadow-success/20 hover:shadow-success/40 active:scale-98'
            }`}
            disabled={
              isLoading ||
              (mode === 'Cash' && balance < 0) ||
              (mode === 'Mixed' && !isMixedValid) ||
              (mode === 'Partial' && (partialPaid <= 0 || partialPaid > effectiveTotal))
            }
            onClick={() => onComplete({
              mode,
              amountPaid: mode === 'Partial' ? partialPaid : amountPaid,
              paidAmount: mode === 'Partial' ? partialPaid : (mode === 'Unpaid' ? 0 : amountPaid),
              dueAmount: mode === 'Partial' ? partialDue : (mode === 'Unpaid' ? effectiveTotal : 0),
              partialPayment: mode === 'Partial' ? {
                paidAmount: partialPaid,
                dueAmount: partialDue,
                method: partialMethod,
                upiApp: partialMethod === 'UPI' ? upiApp : undefined
              } : undefined,
              splitPayments,
              upiApp
            })}>
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>{t("Processing...")}</span>
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                <span>
                  {mode === 'Partial'
                    ? `${t("Save Partial Bill")} (Paid: ${currencySymbol}${Number(partialPaid).toLocaleString('en-IN')})`
                    : mode === 'Unpaid'
                    ? t("Save as Unpaid (Khata)")
                    : `${t("Complete")} ${t(mode)} ${t("Payment")}`}
                </span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default PaymentModal;
