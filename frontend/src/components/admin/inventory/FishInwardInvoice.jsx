import React, { useRef, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ArrowLeft, X } from 'lucide-react';
import ynrLogo from '../../../assets/ynr_logo.png';
import api from '../../../api/system/axios';

/**
 * Converts any positive number into Indian words without "Indian Rupees" prefix.
 * E.g., 288000 -> "Two Lakh Eighty-Eight Thousand Only"
 */
export function numberToIndianWords(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Zero Only';
  const n = Math.abs(Number(num));
  if (n === 0) return 'Zero Only';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty ', 'Thirty ', 'Forty ', 'Fifty ', 'Sixty ', 'Seventy ', 'Eighty ', 'Ninety '];

  const inWords = (val) => {
    let str = '';
    if (val > 19) {
      str += b[Math.floor(val / 10)] + a[val % 10];
    } else {
      str += a[val];
    }
    return str;
  };

  const whole = Math.floor(n);
  const fraction = Math.round((n - whole) * 100);

  let output = '';

  const crores = Math.floor(whole / 10000000);
  const lakhs = Math.floor((whole % 10000000) / 100000);
  const thousands = Math.floor((whole % 100000) / 1000);
  const hundreds = Math.floor((whole % 1000) / 100);
  const remainder = whole % 100;

  if (crores > 0) output += inWords(crores) + 'Crore ';
  if (lakhs > 0) output += inWords(lakhs) + 'Lakh ';
  if (thousands > 0) output += inWords(thousands) + 'Thousand ';
  if (hundreds > 0) output += inWords(hundreds) + 'Hundred ';
  if (remainder > 0) {
    if (output !== '') output += 'and ';
    output += inWords(remainder);
  }

  output = output.trim();
  if (!output) output = 'Zero';

  let result = `${output}`;
  if (fraction > 0) {
    result += ` and ${inWords(fraction).trim()} Paise`;
  }
  result += ' Only';
  return result;
}

/**
 * Helper to extract accurate fish size/grade label
 */
export function getGradeLabel(row) {
  if (!row) return '—';
  if (row.sizeBracket && row.weightOption) {
    return `${row.sizeBracket} (${row.weightOption})`;
  }
  if (row.grade && row.grade !== 'Standard') return row.grade;
  if (row.sizeBracket) return row.sizeBracket;
  if (row.weightOption) return row.weightOption;
  if (row.sizeGrade) return row.sizeGrade.charAt(0).toUpperCase() + row.sizeGrade.slice(1);
  if (row.grade) return row.grade;
  if (row.unit) return row.unit;
  return '—';
}

/**
 * Professional A4 Inward Commercial Invoice & Weighment Slip
 * Renders via React Portal with pure vector HTML, crisp black borders,
 * full mobile responsiveness with pure white background, and print isolation.
 */
export default function FishInwardInvoice({ data, onClose }) {
  const invoiceRef = useRef(null);
  if (!data) return null;

  // Mode: 'local' | 'dam' | 'supplies'
  const mode = data.mode || 'local';

  // Store profile dynamically loaded from backend database and settings
  const [storeProfile, setStoreProfile] = useState(() => {
    let initial = {
      name: '',
      tagline: '',
      address: '',
      phone: '',
      email: '',
      gstin: '',
      regNo: '',
      logo: ''
    };
    try {
      const saved = localStorage.getItem('restaurantSettings');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.restaurantName?.trim()) initial.name = p.restaurantName.trim().toUpperCase();
        if (p.restaurantType?.trim()) initial.tagline = p.restaurantType.trim();
        else if (p.tagline?.trim()) initial.tagline = p.tagline.trim();
        if (p.address?.trim()) initial.address = p.address.trim();
        if (p.phone?.trim()) initial.phone = p.phone.trim();
        if (p.email?.trim()) initial.email = p.email.trim();
        if (p.gstin?.trim()) initial.gstin = p.gstin.trim();
        if (p.fssai?.trim()) initial.regNo = `FSSAI: ${p.fssai.trim()}`;
        else if (p.regNo?.trim()) initial.regNo = p.regNo.trim();
        if (p.logo && p.logo !== '[logo_stored]') initial.logo = p.logo;
      }
    } catch (e) { }
    return initial;
  });

  // Always fetch real settings directly from backend database
  useEffect(() => {
    let isMounted = true;
    api.get('/config/info')
      .then((res) => {
        if (!isMounted) return;
        const data = res.data;
        const incoming = data?.restaurantSettings || data;
        if (incoming && typeof incoming === 'object') {
          setStoreProfile(prev => ({
            name: incoming.restaurantName?.trim() ? incoming.restaurantName.trim().toUpperCase() : prev.name,
            tagline: incoming.restaurantType?.trim() ? incoming.restaurantType.trim() : (incoming.tagline?.trim() ? incoming.tagline.trim() : ''),
            address: incoming.address?.trim() || '',
            phone: incoming.phone?.trim() || '',
            email: incoming.email?.trim() || '',
            gstin: incoming.gstin?.trim() || '',
            regNo: incoming.fssai?.trim() ? `FSSAI: ${incoming.fssai.trim()}` : (incoming.regNo?.trim() || ''),
            logo: (incoming.logo && incoming.logo !== '[logo_stored]') ? incoming.logo : prev.logo
          }));
          try {
            const local = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
            localStorage.setItem('restaurantSettings', JSON.stringify({ ...local, ...incoming }));
          } catch (_) { }
        }
      })
      .catch((err) => {
        console.warn('Failed to load real settings from backend:', err);
      });

    return () => { isMounted = false; };
  }, []);

  // Title & Reference
  const isLocal = mode === 'local';
  const isDam = mode === 'dam';
  const isSupplies = mode === 'supplies';

  const docTitle = isLocal
    ? 'LOCAL FISH CATCH & SETTLEMENT INVOICE'
    : isDam
    ? 'DAM CONSIGNMENT WEIGHMENT & SETTLEMENT VOUCHER'
    : 'DEPOT PACKAGING & SUPPLIES INWARD INVOICE';

  const shortDocTitle = isLocal
    ? 'Local Inward Invoice'
    : isDam
    ? 'Dam Consignment Voucher'
    : 'Supplies Inward Invoice';

  // Stable invoice number: memoized so it never changes randomly during preview
  const invoiceNo = useMemo(() => {
    if (data.invoiceNo) return data.invoiceNo;
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const prefix = isLocal ? 'GIN-LOC' : isDam ? 'GIN-DAM' : 'GIN-SUP';
    return `${prefix}-${dateStr}-${timeStr}`;
  }, [data.invoiceNo, isLocal, isDam]);

  const invoiceDate = data.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const invoiceTime = data.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Party info
  const partyName = data.supplierName || data.contractorName || 'Walk-in Supplier';
  const partyPhone = data.phone || data.supplierPhone || data.contractorPhone || '—';
  const firmOrBoat = data.companyName || data.boatName || data.syndicateName || '';
  // Vehicle number: exact string if provided, empty string '' if not provided
  const vehicleNumber = data.vehicleNumber ? String(data.vehicleNumber).trim() : '';
  const originLocation = data.harbor || data.damLocation || data.originPort || 'Harbor';

  // Items
  const items = data.items || [];

  // Totals & Settlement
  const totalBoxes = Number(data.totalBoxes || 0);
  const totalWeightKg = Number(data.totalKg || 0);
  const grossValue = Number(data.grossValue || data.catchTotal || data.totalValue || 0);
  const totalCr = Number(data.totalCr || 0);
  const totalDr = Number(data.totalDr || 0);
  const netPayable = Number(data.netPayable !== undefined ? data.netPayable : (data.netSettlement !== undefined ? data.netSettlement : grossValue));
  const paymentMode = data.paymentMode || 'Cash';
  const notes = data.notes || '';

  // Settlement itemized rows
  const settlementDetails = data.settlements || {};
  const customSettlements = data.customSettlements || [];

  const settlementList = [];
  if (isLocal) {
    const ice = settlementDetails.ice;
    const iceAmt = Number(ice?.amount !== undefined ? ice.amount : (ice || 0));
    if (iceAmt > 0) settlementList.push({ label: 'Ice Charges', type: ice?.type || 'Dr', amount: iceAmt });

    const bx = settlementDetails.boxes;
    const bxAmt = Number(bx?.amount !== undefined ? bx.amount : (bx || 0));
    if (bxAmt > 0) settlementList.push({ label: 'Boxes Charges', type: bx?.type || 'Dr', amount: bxAmt });

    const tp = settlementDetails.tape;
    const tpAmt = Number(tp?.amount !== undefined ? tp.amount : (tp || 0));
    if (tpAmt > 0) settlementList.push({ label: 'Tape Charges', type: tp?.type || 'Dr', amount: tpAmt });

    const adv = settlementDetails.advance;
    const advAmt = Number(adv?.amount !== undefined ? adv.amount : (adv || 0));
    if (advAmt > 0) settlementList.push({ label: 'Advance Deducted', type: adv?.type || 'Dr', amount: advAmt });
  } else if (isDam) {
    const adv = settlementDetails.advance;
    const advAmt = Number(adv?.amount !== undefined ? adv.amount : (adv || 0));
    if (advAmt > 0) settlementList.push({ label: '1) Advance Deducted', type: adv?.type || 'Dr', amount: advAmt });

    const kht = settlementDetails.khata;
    const khtAmt = Number(kht?.amount !== undefined ? kht.amount : (kht || 0));
    if (khtAmt > 0) settlementList.push({ label: '2) Khata Deducted', type: kht?.type || 'Dr', amount: khtAmt });

    const odTr = settlementDetails.od || settlementDetails.transport;
    const odAmt = Number(odTr?.amount !== undefined ? odTr.amount : (odTr || 0));
    if (odAmt > 0) settlementList.push({ label: '3) OD / Transport', type: odTr?.type || 'Dr', amount: odAmt });

    const depExp = settlementDetails.expense || settlementDetails.depotExpense;
    const depAmt = Number(depExp?.amount !== undefined ? depExp.amount : (depExp || 0));
    if (depAmt > 0) settlementList.push({ label: '4) Depot Expense', type: depExp?.type || 'Dr', amount: depAmt });

    const othExp = settlementDetails.festivalExpense || settlementDetails.otherExpense;
    const othAmt = Number(othExp?.amount !== undefined ? othExp.amount : (othExp || 0));
    if (othAmt > 0) settlementList.push({ label: '5) Other Expense', type: othExp?.type || 'Dr', amount: othAmt });
  }

  customSettlements.forEach(c => {
    if (c.label && c.amount) {
      settlementList.push({ label: c.label, type: c.type || 'Dr', amount: Number(c.amount) });
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const modalContent = (
    <div
      id="inward-invoice-modal-root"
      className="fixed inset-0 z-50 bg-white sm:bg-slate-100 flex flex-col overflow-y-auto"
    >
      {/* ── 1. SCREEN TOP CONTROLS (COMPLETELY HIDDEN IN PRINT) ── */}
      <div id="inward-invoice-controls" className="no-print print-hidden print:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-2.5 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-3 shadow-2xs shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide truncate">
              <span className="sm:hidden">{shortDocTitle}</span>
              <span className="hidden sm:inline">{docTitle}</span>
            </div>
            <div className="text-[9.5px] sm:text-[10px] text-slate-500 font-mono truncate">
              <span className="sm:hidden">Ref: {invoiceNo}</span>
              <span className="hidden sm:inline">Ref: {invoiceNo} • {invoiceDate}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-[#c2410c] text-white rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Print Invoice"
          >
            <Printer size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all cursor-pointer shrink-0"
            title="Close (ESC)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── 2. PRINT ISOLATION CSS ── */}
      <style>{`
        @media print {
          /* Hide the entire React application root so dashboard never leaks */
          #root {
            display: none !important;
          }
          /* Completely destroy screen toolbar so it never prints */
          #inward-invoice-controls,
          .no-print,
          .print-hidden,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            max-height: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            overflow: hidden !important;
          }
          @page {
            size: auto;
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 11px !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            width: 100% !important;
          }
          #inward-invoice-modal-root {
            position: static !important;
            display: block !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 100% !important;
          }
          .invoice-sheet-container {
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
            display: block !important;
            width: 100% !important;
          }
          .a4-print-sheet {
            box-shadow: none !important;
            border: 2px solid #000000 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            padding: 6mm 8mm !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          /* Enforce same-row header layout on system print */
          .print-header-row {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .print-company-info {
            flex: 1 1 auto !important;
            min-width: 0 !important;
          }
          .print-voucher-box {
            width: 270px !important;
            min-width: 270px !important;
            max-width: 270px !important;
            flex-shrink: 0 !important;
          }
          /* Enforce 2 columns for supplier & logistics on print */
          .print-party-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
          }
          /* Table full width edge-to-edge on print */
          .print-table-wrapper {
            width: 100% !important;
            overflow: visible !important;
          }
          .print-table-wrapper table {
            width: 100% !important;
            min-width: 100% !important;
            table-layout: auto !important;
          }
          /* Enforce 2 columns for settlements and totals on print */
          .print-settlement-grid {
            display: grid !important;
            grid-template-columns: 7fr 5fr !important;
            width: 100% !important;
          }
          /* Enforce 3 columns for signatures */
          .print-sign-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* ── 3. A4 INVOICE SHEET (RESPONSIVE ON SCREEN, RIGID ON PRINT) ── */}
      <div className="invoice-sheet-container flex-1 w-full flex justify-center p-2 sm:p-6 bg-white sm:bg-slate-100">
        <div
          ref={invoiceRef}
          className="a4-print-sheet bg-white text-slate-900 w-full max-w-4xl p-4 sm:p-7 border border-slate-900 sm:border-2 sm:border-black shadow-none sm:shadow-lg space-y-2.5 font-sans"
        >
          {/* Header Section with Official YNR Logo */}
          <div className="print-header-row border-b-2 border-slate-900 pb-2.5 flex flex-col md:flex-row md:items-start justify-between gap-2.5">
            <div className="print-company-info flex items-start gap-3 flex-1 min-w-0">
              <img
                src={storeProfile.logo || ynrLogo}
                alt="YNR Fishes Logo"
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-lg border border-slate-300 p-0.5 shrink-0 bg-white"
                onError={(e) => {
                  if (e.currentTarget.src !== ynrLogo) {
                    e.currentTarget.src = ynrLogo;
                  } else {
                    e.currentTarget.style.display = 'none';
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-slate-950 m-0 uppercase font-sans">
                  {storeProfile.name || 'YNR FISHES'}
                </h1>
                {storeProfile.tagline ? (
                  <p className="text-[11px] font-bold text-slate-700 m-0 mt-0.5 tracking-wide">
                    {storeProfile.tagline}
                  </p>
                ) : null}
                {storeProfile.address ? (
                  <p className="text-[10px] text-slate-600 m-0 mt-0.5 leading-snug">
                    {storeProfile.address}
                  </p>
                ) : null}
                <div className="flex items-center gap-2.5 text-[10px] text-slate-800 font-mono mt-1 font-semibold flex-wrap">
                  {storeProfile.phone && <span>Phone: <strong>{storeProfile.phone}</strong></span>}
                  {storeProfile.phone && storeProfile.email && <span>•</span>}
                  {storeProfile.email && <span>Email: <strong>{storeProfile.email}</strong></span>}
                  {(storeProfile.phone || storeProfile.email) && storeProfile.gstin && <span>•</span>}
                  {storeProfile.gstin && <span>GSTIN: <strong>{storeProfile.gstin}</strong></span>}
                  {(storeProfile.phone || storeProfile.email || storeProfile.gstin) && storeProfile.regNo && <span>•</span>}
                  {storeProfile.regNo && <span><strong>{storeProfile.regNo}</strong></span>}
                </div>
              </div>
            </div>

            {/* Document Classification Box (SAME ROW WITH COMPANY INFO ON PRINT) */}
            <div className="print-voucher-box border border-slate-900 sm:border-2 sm:border-black rounded-lg p-2 text-center bg-slate-50 shrink-0 w-full md:w-auto md:min-w-[260px]">
              <div className="text-[11px] font-black uppercase text-slate-950 tracking-wider">
                {docTitle}
              </div>
              <div className="text-[9px] text-slate-600 font-medium border-b border-slate-300 pb-1 mt-0.5">
                ORIGINAL GOODS INWARD & WEIGHMENT SLIP
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px] text-left mt-1.5 pt-0.5 font-mono">
                <span className="text-slate-500 font-bold">VOUCHER NO:</span>
                <span className="font-black text-slate-950 text-right">{invoiceNo}</span>
                <span className="text-slate-500 font-bold">DATE:</span>
                <span className="font-bold text-slate-950 text-right">{invoiceDate}</span>
                <span className="text-slate-500 font-bold">TIME:</span>
                <span className="font-bold text-slate-950 text-right">{invoiceTime}</span>
              </div>
            </div>
          </div>

          {/* Party & Logistics Details (Supplier Name, Company Name, Vehicle Number) */}
          <div className="print-party-grid grid grid-cols-1 sm:grid-cols-2 border border-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-900 text-[11px]">
            {/* Left: Supplier Details */}
            <div className="p-2 space-y-0.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5">
                {isLocal ? 'FISHERMAN / SUPPLIER DETAILS' : isDam ? 'CONTRACTOR / SYNDICATE DETAILS' : 'VENDOR / SUPPLIES PROVIDER'}
              </div>
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <span className="text-slate-500 font-bold">Supplier Name:</span>
                <span className="col-span-2 font-black text-slate-950 uppercase">{partyName}</span>
                <span className="text-slate-500 font-bold">Phone:</span>
                <span className="col-span-2 font-mono font-bold text-slate-900">{partyPhone}</span>
                <span className="text-slate-500 font-bold">Company Name:</span>
                <span className="col-span-2 font-bold text-slate-900">{firmOrBoat || '—'}</span>
              </div>
            </div>

            {/* Right: Logistics & Depot Weighbridge */}
            <div className="p-2 space-y-0.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5">
                LOGISTICS & WEIGHMENT DETAILS
              </div>
              <div className="grid grid-cols-3 gap-1 pt-0.5">
                <span className="text-slate-500 font-bold">Vehicle Number:</span>
                <span className="col-span-2 font-mono font-black text-slate-950 uppercase">{vehicleNumber || ''}</span>
                <span className="text-slate-500 font-bold">Origin / Port:</span>
                <span className="col-span-2 font-bold text-slate-900">{originLocation}</span>
                <span className="text-slate-500 font-bold">Channel:</span>
                <span className="col-span-2 font-bold text-slate-900">
                  {isLocal ? 'Local Coastal Harbor Catch' : isDam ? 'Inland Reservoir Consignment' : 'Depot Supplies & Packaging'}
                </span>
              </div>
            </div>
          </div>

          {/* Itemized Commodity & Weighment Table with Real Grade Value */}
          <div className="print-table-wrapper w-full overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse border border-slate-900 min-w-full">
              <thead>
                <tr className="bg-slate-100 text-slate-950 font-black border-b border-slate-900 uppercase text-[10px] tracking-wider">
                  <th className="border border-slate-900 p-1.5 text-center w-8">#</th>
                  <th className="border border-slate-900 p-1.5">Description / Species Variety</th>
                  <th className="border border-slate-900 p-1.5 text-center w-28">Grade / Size</th>
                  <th className="border border-slate-900 p-1.5 text-right w-16">Boxes</th>
                  <th className="border border-slate-900 p-1.5 text-right w-18">Kg / Box</th>
                  <th className="border border-slate-900 p-1.5 text-right w-24">Scale Wt (Kg)</th>
                  <th className="border border-slate-900 p-1.5 text-right w-20">Rate (₹)</th>
                  <th className="border border-slate-900 p-1.5 text-right w-24">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-slate-400 italic border border-slate-900">
                      No item rows recorded in this intake voucher.
                    </td>
                  </tr>
                ) : (
                  items.map((row, idx) => {
                    let rowKg = 0;
                    const b = Number(row.boxes || 0);
                    const kpb = Number(row.kgPerBox || 0);
                    if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                      rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
                    } else if (b > 0 && kpb > 0) {
                      rowKg = Number((b * kpb).toFixed(3));
                    } else if (Number(row.quantity || 0) > 0) {
                      rowKg = Number(row.quantity);
                    }

                    const rate = Number(row.rate || row.price || row.ratePerKg || row.unitRate || 0);
                    const rowTotal = Number((rowKg * rate).toFixed(2));
                    const gradeVal = getGradeLabel(row);

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border border-slate-900 p-1.5 text-center font-mono text-slate-600">{idx + 1}</td>
                        <td className="border border-slate-900 p-1.5 font-bold text-slate-950">
                          {row.itemName || row.variety || row.name || 'Fish Variety'}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-center font-semibold text-slate-800">
                          {gradeVal}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-right font-mono font-bold text-slate-900">
                          {row.boxes || '—'}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-right font-mono text-slate-600">
                          {row.kgPerBox ? `${Number(row.kgPerBox).toFixed(3)}` : '—'}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-right font-mono font-black text-slate-950">
                          {rowKg.toFixed(3)} {isSupplies ? (row.unit || 'Pcs') : 'Kg'}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-right font-mono text-slate-900">
                          ₹{rate.toFixed(2)}
                        </td>
                        <td className="border border-slate-900 p-1.5 text-right font-mono font-black text-slate-950">
                          ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* Total Row */}
                <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-[11px]">
                  <td colSpan={3} className="border border-slate-900 p-1.5 text-right uppercase tracking-wider">
                    TOTAL CONSIGNMENT INWARD:
                  </td>
                  <td className="border border-slate-900 p-1.5 text-right font-mono text-xs">
                    {totalBoxes > 0 ? `${totalBoxes} Boxes` : '—'}
                  </td>
                  <td className="border border-slate-900 p-1.5 text-right font-mono text-slate-400">—</td>
                  <td className="border border-slate-900 p-1.5 text-right font-mono text-xs text-slate-950">
                    {totalWeightKg.toFixed(3)} {isSupplies ? 'Units' : 'Kg'}
                  </td>
                  <td className="border border-slate-900 p-1.5 text-right font-mono text-slate-400">—</td>
                  <td className="border border-slate-900 p-1.5 text-right font-mono text-xs text-slate-950">
                    ₹{grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Financial Settlement & Net Payable Grid */}
          <div className="print-settlement-grid grid grid-cols-1 sm:grid-cols-12 border-2 border-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-900">
            {/* Left: Deductions & Additions Breakdown */}
            <div className="sm:col-span-7 p-2.5 space-y-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 flex items-center justify-between">
                <span>SETTLEMENT DEDUCTIONS & ADVANCE ADJUSTMENTS</span>
                <span className="text-[9px] text-slate-500 font-mono">(+Cr / -Dr Breakdown)</span>
              </div>

              {settlementList.length === 0 ? (
                <div className="text-[10px] text-slate-500 italic py-1.5">
                  No advance deductions or extra charges applied to this unloading lot.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {settlementList.map((st, sIdx) => {
                    const isCredit = st.type === 'Cr';
                    return (
                      <div key={sIdx} className="flex items-center justify-between text-[11px] font-mono border-b border-dashed border-slate-200 py-0.5">
                        <span className="text-slate-800 font-sans font-bold flex items-center gap-1">
                          <span className={`px-1 py-0.2 rounded text-[9px] font-black ${isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                            {isCredit ? '+ CR' : '- DR'}
                          </span>
                          <span>{st.label}</span>
                        </span>
                        <span className={`font-bold ${isCredit ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isCredit ? '+' : '-'} ₹{st.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {notes && (
                <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] text-slate-700">
                  <span className="font-bold text-slate-950">Intake Notes: </span>
                  <span>{notes}</span>
                </div>
              )}
            </div>

            {/* Right: Net Settlement Totals Box */}
            <div className="sm:col-span-5 p-2.5 bg-slate-50/70 flex flex-col justify-between space-y-2">
              <div className="space-y-0.5 text-[11px] font-mono">
                <div className="flex justify-between items-center text-slate-700">
                  <span>Gross Value:</span>
                  <span className="font-bold">₹{grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {totalCr > 0 && (
                  <div className="flex justify-between items-center text-emerald-700">
                    <span>Additions (+Cr):</span>
                    <span className="font-bold">+₹{totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {totalDr > 0 && (
                  <div className="flex justify-between items-center text-rose-700">
                    <span>Deductions (-Dr):</span>
                    <span className="font-bold">-₹{totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {isSupplies && data.paidAmount !== undefined && (
                  <>
                    <div className="flex justify-between items-center text-slate-700 border-t border-slate-300 pt-0.5">
                      <span>Paid Amount:</span>
                      <span className="font-bold">₹{Number(data.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-700">
                      <span>Balance Due:</span>
                      <span className="font-black">₹{Number(data.balanceDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Net Highlight Box with Status: Paid & PAY MODE */}
              <div className="border-2 border-slate-900 bg-white p-2.5 rounded text-center shadow-xs space-y-1">
                <div className="text-[9.5px] font-black text-slate-600 uppercase tracking-widest">
                  {netPayable >= 0 ? (isLocal ? 'NET PAYABLE TO FISHERMAN' : 'NET SETTLEMENT AMOUNT') : 'PARTY BALANCE DUE'}
                </div>
                <div className="text-xl sm:text-2xl font-black font-mono text-slate-950">
                  ₹{Math.abs(netPayable).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="flex items-center justify-center gap-3 text-[10px] font-bold text-slate-800 border-t border-dashed border-slate-300 pt-1 uppercase font-mono">
                  <span className="text-emerald-700 font-black">Status: <strong>Paid</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>PAY MODE: <strong className="text-slate-950">{paymentMode}</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Amount in Words Box without "Indian Rupees" */}
          <div className="border border-slate-900 bg-slate-50 p-2 text-[10px] font-sans">
            <span className="font-black uppercase tracking-wider text-slate-900 mr-1">
              Amount in Words:
            </span>
            <span className="font-bold text-slate-900 italic">
              {numberToIndianWords(Math.abs(netPayable))}
            </span>
          </div>

          {/* Official Terms & Declaration */}
          <div className="text-[9px] text-slate-600 leading-snug border-t border-b border-slate-300 py-1 font-sans">
            <strong>Declaration:</strong> Certified that the above consignment weighment was conducted on {storeProfile.name || 'YNR FISHES'} digital weighbridge in the presence of the supplier/agent. All species varieties, box counts, tare weights, and settlement deductions are accepted as correct and verified.
          </div>

          {/* Triple Signatory Blocks */}
          <div className="print-sign-grid grid grid-cols-3 border-2 border-slate-900 divide-x divide-slate-900 text-[10px] pt-1">
            <div className="p-1.5 flex flex-col justify-between h-16 sm:h-20 text-center">
              <span className="text-slate-500 uppercase font-bold text-[8.5px] sm:text-[9px]">Weighbridge Operator</span>
              <div className="border-t border-dashed border-slate-400 pt-0.5 font-bold text-slate-900 text-[9px] sm:text-[10px]">
                Prepared & Weighed By
              </div>
            </div>

            <div className="p-1.5 flex flex-col justify-between h-16 sm:h-20 text-center">
              <span className="text-slate-500 uppercase font-bold text-[8.5px] sm:text-[9px]">Party Representative</span>
              <div className="border-t border-dashed border-slate-400 pt-0.5 font-bold text-slate-900 text-[9px] sm:text-[10px]">
                Acceptance Signature
              </div>
            </div>

            <div className="p-1.5 flex flex-col justify-between h-16 sm:h-20 text-center bg-slate-50/50">
              <span className="text-slate-500 uppercase font-bold text-[8.5px] sm:text-[9px] truncate">{storeProfile.name || 'YNR FISHES'}</span>
              <div className="border-t border-dashed border-slate-400 pt-0.5 font-black text-slate-950 uppercase text-[9px] sm:text-[10px]">
                Authorized Signatory & Seal
              </div>
            </div>
          </div>

          {/* Footer watermark */}
          <div className="text-center text-[8px] text-slate-400 font-mono tracking-wider pt-0.5">
            Goods Inward Note (GIN) • {storeProfile.name || 'YNR FISHES'} Management System
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
