import React, { useRef, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ArrowLeft, X, Check, MessageCircle, Loader2 } from 'lucide-react';
import ynrLogo from '../../../assets/ynr_logo.png';
import api from '../../../api/system/axios';
import { renderElementToPNGBase64, renderElementToESCPOSRaster } from '../../../utils/formatters/escposRaster';
import { sendWhatsAppBill } from '../../../api/communication/whatsapp';
import { getReceiptFontMetrics, findReceiptFont } from '../../../utils/formatters/receiptFonts';
import { formatReceiptItemName } from '../../../utils/formatters/billItemFormatters';
import html2canvas from 'html2canvas-pro';

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
 * Professional Multi-Format Inward Catch Commercial Invoice & Thermal Receipt
 * Supports 58mm Thermal (2"), 80mm Thermal (3"), and A4 Full Sheet.
 * Renders via React Portal with print isolation.
 */
export default function FishInwardInvoice({ data, onClose }) {
  const invoiceRef = useRef(null);
  if (!data) return null;

  // Mode: 'local' | 'dam' | 'supplies'
  const mode = data.mode || (data.intakeMode || 'local');

  // Format State: '58mm' | '80mm' | 'A4'
  const [printFormat, setPrintFormat] = useState(() => {
    try {
      const savedFormat = localStorage.getItem('inward_print_format');
      if (savedFormat && ['58mm', '80mm', 'A4'].includes(savedFormat)) {
        return savedFormat;
      }
      const savedSettings = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      if (savedSettings.printFormat && ['58mm', '80mm', 'A4'].includes(savedSettings.printFormat)) {
        return savedSettings.printFormat;
      }
      if (savedSettings.paperWidth && ['58mm', '80mm'].includes(savedSettings.paperWidth)) {
        return savedSettings.paperWidth;
      }
    } catch (e) {}
    return '80mm';
  });

  const handleFormatChange = (newFormat) => {
    setPrintFormat(newFormat);
    try {
      localStorage.setItem('inward_print_format', newFormat);
    } catch (e) {}
  };

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

  const [activeSettings, setActiveSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('restaurantSettings');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Realtime settings listener for font, font size, language
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e?.detail) {
        setActiveSettings(e.detail);
      } else {
        try {
          const saved = localStorage.getItem('restaurantSettings');
          if (saved) setActiveSettings(JSON.parse(saved));
        } catch (_) {}
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    window.addEventListener('storage', handleSettingsUpdated);
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdated);
      window.removeEventListener('storage', handleSettingsUpdated);
    };
  }, []);

  // Always fetch real settings directly from backend database
  useEffect(() => {
    let isMounted = true;
    api.get('/config/info')
      .then((res) => {
        if (!isMounted) return;
        const respData = res.data;
        const incoming = respData?.restaurantSettings || respData;
        if (incoming && typeof incoming === 'object') {
          setActiveSettings(incoming);
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
            localStorage.setItem('restaurantSettings', JSON.stringify(incoming));
          } catch (e) { }
        }
      })
      .catch((err) => {
        console.warn('Could not fetch store profile info:', err?.message);
      });
    return () => { isMounted = false; };
  }, []);

  // Calibrated Font Metrics matching user's selected receipt font & size
  const activeFontFamilyVal = activeSettings.receiptFontFamily || 'Arial, Helvetica, sans-serif';
  const matchedFontObj = findReceiptFont(activeFontFamilyVal);
  const receiptFont = matchedFontObj.value;
  const activeFontSize = activeSettings.receiptFontSize || 'medium';
  const fontMetrics = getReceiptFontMetrics(activeFontSize, printFormat);
  const langPref = activeSettings.receiptItemLanguage || localStorage.getItem('receiptItemLanguage') || 'telugu';

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
    ? 'Local Catch Slip'
    : isDam
    ? 'Dam Consignment Voucher'
    : 'Supplies Inward Slip';

  // Stable invoice number
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

  // Party info (Strict: NO dummy fallbacks, only real present values)
  const partyName = (data.supplierName || data.contractorName || '').trim();
  const rawPhone = (data.phone || data.supplierPhone || data.contractorPhone || '').trim();
  const partyPhone = (rawPhone && rawPhone !== '—' && rawPhone !== '-' && rawPhone !== 'undefined' && rawPhone !== 'null') ? rawPhone : '';
  const firmOrBoat = (data.companyName || data.boatName || data.syndicateName || '').trim();
  const vehicleNumber = (data.vehicleNumber && String(data.vehicleNumber).trim() !== '—' && String(data.vehicleNumber).trim() !== '-') ? String(data.vehicleNumber).trim() : '';
  const originLocation = (data.harbor || data.damLocation || data.originPort || '').trim();
  const hasPartyInfo = Boolean(partyName || firmOrBoat || partyPhone || vehicleNumber || originLocation);

  // Items
  const items = data.items || [];

  // Totals & Settlement
  const totalBoxes = Number(data.totalBoxes || 0);
  const totalWeightKg = Number(data.totalKg || data.totalWeightKg || 0);
  const grossValue = Number(data.grossValue || data.catchTotal || data.totalValue || 0);
  const totalCr = Number(data.totalCr || 0);
  const totalDr = Number(data.totalDr || 0);
  const netPayable = Number(data.netPayable !== undefined ? data.netPayable : (data.netSettlement !== undefined ? data.netSettlement : grossValue));
  const paymentMode = data.paymentMode || 'Cash';
  const notes = data.notes || '';

  // Settlement itemized rows (Strict: only populated if settlements are enabled and not hidden)
  const settlementDetails = data.settlements || {};
  const customSettlements = data.customSettlements || [];

  const settlementList = [];
  const areSettlementsEnabled = data.showSettlements !== false && (data.showSettlements === true || (data.showSettlements === undefined && (totalCr > 0 || totalDr > 0)));

  if (areSettlementsEnabled) {
    if (isLocal) {
      const ice = settlementDetails.ice;
      const iceAmt = Number(ice?.amount !== undefined ? ice.amount : (ice || 0));
      if (iceAmt > 0 && ice?.isLocked !== true) settlementList.push({ label: 'Ice Charges', type: ice?.type || 'Dr', amount: iceAmt });

      const bx = settlementDetails.boxes;
      const bxAmt = Number(bx?.amount !== undefined ? bx.amount : (bx || 0));
      if (bxAmt > 0 && bx?.isLocked !== true) settlementList.push({ label: 'Boxes Charges', type: bx?.type || 'Dr', amount: bxAmt });

      const tp = settlementDetails.tape;
      const tpAmt = Number(tp?.amount !== undefined ? tp.amount : (tp || 0));
      if (tpAmt > 0 && tp?.isLocked !== true) settlementList.push({ label: 'Tape Charges', type: tp?.type || 'Dr', amount: tpAmt });

      const adv = settlementDetails.advance;
      const advAmt = Number(adv?.amount !== undefined ? adv.amount : (adv || 0));
      if (advAmt > 0 && adv?.isLocked !== true) settlementList.push({ label: 'Advance Deducted', type: adv?.type || 'Dr', amount: advAmt });
    } else if (isDam) {
      const adv = settlementDetails.advance;
      const advAmt = Number(adv?.amount !== undefined ? adv.amount : (adv || 0));
      if (advAmt > 0 && adv?.isLocked !== true) settlementList.push({ label: '1) Advance Deducted', type: adv?.type || 'Dr', amount: advAmt });

      const kht = settlementDetails.khata;
      const khtAmt = Number(kht?.amount !== undefined ? kht.amount : (kht || 0));
      if (khtAmt > 0 && kht?.isLocked !== true) settlementList.push({ label: '2) Khata Deducted', type: kht?.type || 'Dr', amount: khtAmt });

      const odTr = settlementDetails.od || settlementDetails.transport;
      const odAmt = Number(odTr?.amount !== undefined ? odTr.amount : (odTr || 0));
      if (odAmt > 0 && odTr?.isLocked !== true) settlementList.push({ label: '3) OD / Transport', type: odTr?.type || 'Dr', amount: odAmt });

      const depExp = settlementDetails.expense || settlementDetails.depotExpense;
      const depAmt = Number(depExp?.amount !== undefined ? depExp.amount : (depExp || 0));
      if (depAmt > 0 && depExp?.isLocked !== true) settlementList.push({ label: '4) Depot Expense', type: depExp?.type || 'Dr', amount: depAmt });

      const othExp = settlementDetails.festivalExpense || settlementDetails.otherExpense;
      const othAmt = Number(othExp?.amount !== undefined ? othExp.amount : (othExp || 0));
      if (othAmt > 0 && othExp?.isLocked !== true) settlementList.push({ label: '5) Other Expense', type: othExp?.type || 'Dr', amount: othAmt });
    }

    customSettlements.forEach(c => {
      if (c.label && c.amount && c.isLocked !== true) {
        settlementList.push({ label: c.label, type: c.type || 'Dr', amount: Number(c.amount) });
      }
    });
  }

    // Printer Configurations loaded from backend
  const [printerConfigs, setPrinterConfigs] = useState([]);
  useEffect(() => {
    api.get('/printer-configs')
      .then(res => {
        if (Array.isArray(res.data)) setPrinterConfigs(res.data);
      })
      .catch(() => {});
  }, []);

  // Find active printer specifically mapped for SRM Bills or Both (no fallback to CRM printers)
  const activeSRMPrinter = useMemo(() => {
    const list = Array.isArray(printerConfigs) ? printerConfigs : [];
    const p = list.find(c => c.isActive && (c.type === 'srm' || c.type === 'both') && (
      (c.connectionType === 'usb' && (c.usbPort || c.deviceName || c.name)) ||
      (c.connectionType === 'network' && c.ipAddress) ||
      (c.connectionType === 'bluetooth' && (c.bluetoothAddress || c.deviceName || c.name))
    ));
    return p || null;
  }, [printerConfigs]);

  const [printToast, setPrintToast] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  const handlePrint = async (forceBrowserPrint = false) => {
    // Standard browser print (Save as PDF) requested explicitly via PDF button
    if (forceBrowserPrint === true) {
      window.print();
      return;
    }

    // Guard: Check if printer is only assigned to CRM
    if (!activeSRMPrinter) {
      const crmOnly = (printerConfigs || []).filter(c => c.isActive && (c.type === 'crm' || c.type === 'receipt'));
      if (crmOnly.length > 0) {
        setPrintToast({
          message: `The printer "${crmOnly[0].name}" is not assigned for this bill! It is configured for CRM Bills only. Please assign a printer for SRM Bills in Printer Stations.`,
          type: 'warning'
        });
        setTimeout(() => setPrintToast(null), 5000);
        return;
      }
      setPrintToast({
        message: 'No printer assigned for SRM Bills. Please configure an SRM printer in Printer Stations or click PDF to download.',
        type: 'warning'
      });
      setTimeout(() => setPrintToast(null), 5000);
      return;
    }

    // Direct thermal print to the configured SRM printer
    setIsPrinting(true);
    try {
      const receiptNode = printFormat === '58mm'
        ? (document.querySelector('.receipt-thermal-58mm') || document.querySelector('.receipt-thermal-80mm') || document.querySelector('.a4-print-sheet'))
        : (printFormat === 'A4'
          ? (document.querySelector('.a4-print-sheet') || document.querySelector('.receipt-thermal-80mm'))
          : (document.querySelector('.receipt-thermal-80mm') || document.querySelector('.receipt-thermal-58mm')));

      const dots = printFormat === '58mm' ? 384 : 576;

      // 1. Android Bluetooth direct printing (Raster Image)
      if (activeSRMPrinter.connectionType === 'bluetooth' && window.AndroidBluetooth?.printImage) {
        if (receiptNode) {
          const pngBase64 = await renderElementToPNGBase64(receiptNode, dots);
          const resStr = window.AndroidBluetooth.printImage(activeSRMPrinter.bluetoothAddress, pngBase64, dots);
          const res = JSON.parse(resStr || '{}');
          if (res.success) {
            setPrintToast({ message: `Inward Catch Voucher printed to ${activeSRMPrinter.name}!`, type: 'success' });
            setTimeout(() => setPrintToast(null), 3500);
            return;
          }
        }
      }

      // 2. USB Thermal, LAN / Network or Desktop printing:
      // Generate EXACT ESC/POS Raster from rendered DOM node matching UI format, fonts, Telugu script and sizes
      let rasterData = null;
      if (receiptNode) {
        try {
          rasterData = await renderElementToESCPOSRaster(receiptNode, dots);
        } catch (rasterErr) {
          console.warn('Failed to generate ESCPOS raster for inward voucher:', rasterErr);
        }
      }

      const voucherPayload = {
        ...data,
        invoiceNo,
        voucherNo: invoiceNo,
        isSRM: true,
        isInward: true,
        restaurantDetails: storeProfile,
        items: items.map(r => ({
          name: r.itemName || r.variety || r.name,
          quantity: r.boxes || 1,
          weightKg: r.kg || 0,
          rate: r.rate || 0,
          total: Number((r.kg * r.rate).toFixed(2))
        }))
      };

      const res = await api.post('/printer-configs/print-bill', {
        bill: voucherPayload,
        printerId: activeSRMPrinter._id,
        rasterBufferBase64: rasterData
      });

      if (res.data?.success || res.data?.relayed) {
        setPrintToast({ message: `Inward Catch Voucher printed to ${activeSRMPrinter.name}!`, type: 'success' });
        setTimeout(() => setPrintToast(null), 3500);
      } else {
        throw new Error(res.data?.message || 'Print failed');
      }
    } catch (err) {
      console.warn('Direct print error:', err);
      setPrintToast({ message: `Direct print failed: ${err.message || 'Error'}. Opening system print dialog.`, type: 'warning' });
      setTimeout(() => setPrintToast(null), 4000);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    let cleanPhone = (partyPhone || '').replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setPrintToast({ message: 'No valid phone number found for this supplier/contractor to send WhatsApp.', type: 'warning' });
      setTimeout(() => setPrintToast(null), 3500);
      return;
    }
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    setIsSendingWhatsApp(true);
    try {
      const receiptElement = document.querySelector('.receipt-thermal-80mm') || document.querySelector('.receipt-thermal-58mm') || document.querySelector('.a4-print-sheet');
      let imageBase64 = null;
      if (receiptElement) {
        try {
          const canvas = await html2canvas(receiptElement, {
            scale: 1.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
          });
          imageBase64 = canvas.toDataURL('image/png');
        } catch (imgErr) {
          console.warn('html2canvas capture warning:', imgErr);
        }
      }

      const slipType = isLocal ? 'LOCAL CATCH SLIP' : isDam ? 'DAM CATCH SLIP' : 'SUPPLIES STOCK-IN SLIP';
      const msg = `📦 *${storeProfile?.name || 'YNR FISHES'} - ${slipType}*\n\n` +
        `*Voucher No:* #${invoiceNo}\n` +
        `*Date:* ${invoiceDate} • ${invoiceTime}\n` +
        (partyName ? `*Supplier / Party:* ${partyName}\n` : '') +
        (firmOrBoat ? `*Firm / Boat:* ${firmOrBoat}\n` : '') +
        (vehicleNumber ? `*Vehicle:* ${vehicleNumber}\n` : '') +
        (originLocation ? `*Origin / Port:* ${originLocation}\n` : '') +
        `--------------------------\n` +
        `*Total Net Weight:* ${totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg (${totalBoxes} Boxes)\n` +
        `*Gross Catch Value:* ₹${grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `*Net Payable:* ₹${netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
        `*Status:* ${data.status || 'PAID'} • *Mode:* ${paymentMode}\n\n` +
        `_Goods Received & Weighed at ${storeProfile?.name || 'YNR FISHES'}_`;

      try {
        const res = await sendWhatsAppBill(cleanPhone, { billNumber: invoiceNo, total: netPayable }, imageBase64, msg);
        if (res?.success) {
          setPrintToast({ message: `Voucher sent via WhatsApp to ${cleanPhone}!`, type: 'success' });
          setTimeout(() => setPrintToast(null), 3500);
          return;
        }
      } catch (apiErr) {
        console.warn('Automated WhatsApp dispatch notice:', apiErr);
      }

      // Fallback: Direct chat URL
      const encodedMsg = encodeURIComponent(msg);
      window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
      setPrintToast({ message: `Opening WhatsApp chat with ${cleanPhone}...`, type: 'success' });
      setTimeout(() => setPrintToast(null), 3500);
    } catch (err) {
      console.error('WhatsApp send error:', err);
      setPrintToast({ message: `Failed to send WhatsApp: ${err.message || 'Error'}`, type: 'error' });
      setTimeout(() => setPrintToast(null), 4000);
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const modalContent = (
    <div
      id="inward-invoice-modal-root"
      className="fixed inset-0 z-50 bg-white sm:bg-slate-100 flex flex-col overflow-y-auto"
    >
      {/* SRM Print Notification Toast */}
      {printToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[99999] px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl animate-in fade-in slide-in-from-top-2 flex items-center gap-2 bg-amber-600 text-white border border-amber-400 select-none">
          <span className="text-base">⚠️</span>
          <span>{printToast.message}</span>
        </div>
      )}

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
              <span>#{invoiceNo} • {invoiceDate}</span>
            </div>
          </div>
        </div>

        {/* Center: Printer Size Configuration Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
          {[
            { id: '58mm', label: '58mm', short: '58mm', desc: '2" Thermal' },
            { id: '80mm', label: '80mm', short: '80mm', desc: '3" Thermal' },
            { id: 'A4', label: 'A4', short: 'A4', desc: 'Full Page' }
          ].map(fmt => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => handleFormatChange(fmt.id)}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                printFormat === fmt.id
                  ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
              title={`Switch layout to ${fmt.desc}`}
            >
              <span>{fmt.label}</span>
              <span className="text-[9px] opacity-80 hidden md:inline">({fmt.desc})</span>
            </button>
          ))}
        </div>

        {/* Right Print & WhatsApp & Close Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {partyPhone && (
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 active:scale-95 disabled:opacity-50"
              title={`Send Inward Catch Slip to ${partyPhone} via WhatsApp`}
            >
              {isSendingWhatsApp ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          )}

          <div className="flex items-center bg-[#FDFBF7] border border-slate-300 shadow-xs rounded-xl overflow-hidden shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-[#c2410c] text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0 active:scale-95"
              title={activeSRMPrinter ? `Print via ${activeSRMPrinter.name} (${activeSRMPrinter.type.toUpperCase()})` : `Print Receipt (${printFormat})`}
            >
              <Printer size={15} />
              <span className="hidden sm:inline">
                {activeSRMPrinter ? `Print (${activeSRMPrinter.name})` : `Print ${printFormat}`}
              </span>
            </button>
            {activeSRMPrinter && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-2.5 py-2 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border-l border-slate-200 transition-colors cursor-pointer text-xs font-black shrink-0"
                title="Open standard browser print dialog (PDF / System Printer)"
              >
                PDF
              </button>
            )}
          </div>
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

      {/* ── 2. DYNAMIC PRINT ISOLATION CSS ── */}
      <style>{`
        @media print {
          #root,
          #inward-invoice-controls,
          .no-print,
          .print-hidden,
          .print\\:hidden {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: ${printFormat === '58mm' ? '58mm auto' : printFormat === '80mm' ? '80mm auto' : 'auto'};
            margin: 0mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
          .receipt-thermal-58mm {
            width: 58mm !important;
            max-width: 58mm !important;
            margin: 0 auto !important;
            padding: 1mm 2mm !important;
            border: none !important;
            box-shadow: none !important;
          }
          .receipt-thermal-80mm {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 2mm 3mm !important;
            border: none !important;
            box-shadow: none !important;
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
          .print-party-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
          }
          .print-table-wrapper {
            width: 100% !important;
            overflow: visible !important;
          }
          .print-table-wrapper table {
            width: 100% !important;
            min-width: 100% !important;
            table-layout: auto !important;
          }
          .print-settlement-grid {
            display: grid !important;
            grid-template-columns: 7fr 5fr !important;
            width: 100% !important;
          }
          .print-sign-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* ── 3. SHEET / RECEIPT CONTAINER BASED ON SELECTED FORMAT ── */}
      <div className="invoice-sheet-container flex-1 w-full flex justify-center p-2 sm:p-6 bg-white sm:bg-slate-100">

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* FORMAT A: 58MM COMPACT THERMAL RECEIPT (2-INCH ROLL)                        */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {printFormat === '58mm' && (
          <div
            ref={invoiceRef}
            className="receipt-thermal-58mm bg-white text-black p-2.5 w-[210px] max-w-[210px] mx-auto border border-dashed border-slate-300 sm:shadow-lg space-y-1.5"
            style={{
              fontFamily: receiptFont,
              ...(matchedFontObj.previewStyle || {}),
              fontSize: fontMetrics.bodySize,
              lineHeight: fontMetrics.lineHeight,
              color: '#000000',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Store Header */}
            <div className="text-center space-y-0.5">
              <h1 className="font-black uppercase tracking-tight m-0 text-black" style={{ fontSize: fontMetrics.headingSize }}>
                {storeProfile.name || 'YNR FISHES'}
              </h1>
              {storeProfile.tagline && <p className="m-0 text-slate-700" style={{ fontSize: fontMetrics.detailSize }}>{storeProfile.tagline}</p>}
              {storeProfile.address && <p className="m-0 text-slate-600 line-clamp-2" style={{ fontSize: fontMetrics.detailSize }}>{storeProfile.address}</p>}
              {storeProfile.phone && <p className="font-bold m-0" style={{ fontSize: fontMetrics.detailSize }}>Tel: {storeProfile.phone}</p>}
              {storeProfile.gstin && <p className="m-0" style={{ fontSize: fontMetrics.detailSize }}>GSTIN: {storeProfile.gstin}</p>}
            </div>

            <div className="border-t border-dashed border-black my-1" />

            {/* Document & Voucher Info */}
            <div className="text-center space-y-0.5">
              <div className="font-black uppercase tracking-wider" style={{ fontSize: fontMetrics.subHeadingSize }}>{shortDocTitle}</div>
              <div className="font-bold" style={{ fontSize: fontMetrics.detailSize }}>{invoiceNo}</div>
              <div className="text-slate-600" style={{ fontSize: fontMetrics.detailSize }}>{invoiceDate} • {invoiceTime}</div>
            </div>

            <div className="border-t border-black my-1" />

            {/* Supplier & Logistics (Strict: Only show existing non-empty rows) */}
            {hasPartyInfo && (
              <div className="space-y-0.5" style={{ fontSize: fontMetrics.detailSize }}>
                {partyName && (
                  <div className="flex justify-between">
                    <span className="font-bold">Supp:</span>
                    <span className="font-black truncate max-w-[140px] uppercase">{partyName}</span>
                  </div>
                )}
                {firmOrBoat && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Firm:</span>
                    <span className="font-semibold truncate max-w-[140px]">{firmOrBoat}</span>
                  </div>
                )}
                {partyPhone && (
                  <div className="flex justify-between">
                    <span className="font-bold">Phone:</span>
                    <span>{partyPhone}</span>
                  </div>
                )}
                {vehicleNumber && (
                  <div className="flex justify-between">
                    <span className="font-bold">Veh:</span>
                    <span className="font-black">{vehicleNumber}</span>
                  </div>
                )}
                {originLocation && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Origin:</span>
                    <span className="truncate max-w-[140px]">{originLocation}</span>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-black my-1" />

            {/* Catch Items */}
            <div className="space-y-1">
              <div className="flex justify-between font-black uppercase border-b border-dashed border-black pb-0.5" style={{ fontSize: fontMetrics.detailSize }}>
                <span>ITEM / VARIETY</span>
                <span>QTY/AMT</span>
              </div>

              {items.map((row, idx) => {
                let rowKg = 0;
                const b = Number(row.boxes || 0);
                const kpb = Number(row.kgPerBox || 0);
                if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                  rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(2));
                } else if (b > 0 && kpb > 0) {
                  rowKg = Number((b * kpb).toFixed(2));
                } else if (Number(row.quantity || 0) > 0) {
                  rowKg = Number(row.quantity);
                }
                const rate = Number(row.rate || row.price || row.ratePerKg || row.unitRate || 0);
                const rowTotal = Number((rowKg * rate).toFixed(2));
                const { itemTitle } = formatReceiptItemName(row.itemName || row.variety || row.name, langPref);

                return (
                  <div key={idx} className="space-y-0.2 py-0.5 border-b border-slate-100" style={{ fontSize: fontMetrics.detailSize }}>
                    <div className="font-bold text-black truncate" style={{ fontSize: fontMetrics.itemSize }}>
                      {idx + 1}. {itemTitle || 'Catch Item'}
                    </div>
                    <div className="flex justify-between text-slate-700" style={{ fontSize: fontMetrics.detailSize }}>
                      <span>
                        {row.boxes ? `${row.boxes}Bx • ` : ''}{rowKg.toFixed(1)}kg @ ₹{rate}
                      </span>
                      <span className="font-black text-black">₹{Math.round(rowTotal).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed border-black my-1" />

            {/* Totals & Deductions */}
            <div className="space-y-0.5" style={{ fontSize: fontMetrics.detailSize }}>
              <div className="flex justify-between">
                <span>Total Weight:</span>
                <span className="font-bold">{totalWeightKg.toFixed(1)} Kg {totalBoxes > 0 ? `(${totalBoxes} Bx)` : ''}</span>
              </div>
              <div className="flex justify-between">
                <span>Gross Value:</span>
                <span className="font-bold">₹{grossValue.toLocaleString()}</span>
              </div>

              {settlementList.length > 0 && (
                <div className="pt-0.5 space-y-0.2">
                  {settlementList.map((st, i) => (
                    <div key={i} className="flex justify-between text-slate-700" style={{ fontSize: fontMetrics.detailSize }}>
                      <span>- {st.label}:</span>
                      <span>-₹{st.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t-2 border-black my-1" />

            {/* Net Amount Due */}
            <div className="text-center py-1 bg-slate-50 border border-black rounded space-y-0.5">
              <span className="font-black uppercase tracking-wider block" style={{ fontSize: fontMetrics.detailSize }}>
                {isLocal ? 'NET DUE TO FISHERMAN' : 'NET SETTLEMENT'}
              </span>
              <span className="font-black text-black block" style={{ fontSize: fontMetrics.grandTotalSize }}>
                ₹{Math.abs(netPayable).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
              <span className="font-bold uppercase text-slate-700 block" style={{ fontSize: fontMetrics.detailSize }}>
                Status: PAID • Mode: {paymentMode}
              </span>
            </div>

            <div className="border-t border-dashed border-black my-1" />

            {/* Thermal Footer */}
            <div className="text-center text-slate-600 space-y-0.5 pt-0.5" style={{ fontSize: fontMetrics.detailSize }}>
              <p className="font-bold uppercase m-0">*** WEIGHMENT VERIFIED ***</p>
              <p className="m-0">Kadapa Seafood Depot</p>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* FORMAT B: 80MM STANDARD THERMAL RECEIPT (3-INCH ROLL)                       */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {printFormat === '80mm' && (
          <div
            ref={invoiceRef}
            className="receipt-thermal-80mm bg-white text-black p-3.5 w-[285px] max-w-[285px] mx-auto border border-dashed border-slate-300 sm:shadow-lg space-y-2"
            style={{
              fontFamily: receiptFont,
              ...(matchedFontObj.previewStyle || {}),
              fontSize: fontMetrics.bodySize,
              lineHeight: fontMetrics.lineHeight,
              color: '#000000',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Header with Logo */}
            <div className="text-center space-y-1">
              <img
                src={storeProfile.logo || ynrLogo}
                alt="Logo"
                className="h-10 w-10 mx-auto object-contain rounded border border-slate-300 p-0.5"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
              <h1 className="font-black uppercase tracking-tight m-0 text-black" style={{ fontSize: fontMetrics.headingSize }}>
                {storeProfile.name || 'YNR FISHES'}
              </h1>
              {storeProfile.tagline && <p className="m-0 text-slate-700 font-semibold" style={{ fontSize: fontMetrics.detailSize }}>{storeProfile.tagline}</p>}
              {storeProfile.address && <p className="m-0 text-slate-600 line-clamp-2" style={{ fontSize: fontMetrics.detailSize }}>{storeProfile.address}</p>}
              <div className="text-slate-800 font-bold space-x-1" style={{ fontSize: fontMetrics.detailSize }}>
                {storeProfile.phone && <span>Ph: {storeProfile.phone}</span>}
                {storeProfile.gstin && <span>• GST: {storeProfile.gstin}</span>}
              </div>
            </div>

            <div className="border-t-2 border-black my-1.5" />

            {/* Document Title */}
            <div className="text-center space-y-0.5">
              <div className="font-black uppercase tracking-wider text-black" style={{ fontSize: fontMetrics.subHeadingSize }}>
                {shortDocTitle.toUpperCase()}
              </div>
              <div className="text-slate-500" style={{ fontSize: fontMetrics.detailSize }}>GOODS INWARD & WEIGHMENT SLIP</div>
              <div className="font-bold text-black" style={{ fontSize: fontMetrics.detailSize }}>#{invoiceNo}</div>
              <div className="text-slate-600" style={{ fontSize: fontMetrics.detailSize }}>{invoiceDate} • {invoiceTime}</div>
            </div>

            <div className="border-t border-black my-1" />

            {/* Party & Logistics Grid (Strict: Only show existing non-empty rows) */}
            {hasPartyInfo && (
              <div className="space-y-1 bg-slate-50 p-2 rounded border border-slate-200" style={{ fontSize: fontMetrics.detailSize }}>
                {partyName && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Supplier:</span>
                    <span className="font-black uppercase text-black text-right truncate max-w-[180px]">{partyName}</span>
                  </div>
                )}
                {firmOrBoat && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Firm/Boat:</span>
                    <span className="font-semibold text-right truncate max-w-[180px]">{firmOrBoat}</span>
                  </div>
                )}
                {partyPhone && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Phone:</span>
                    <span className="font-bold text-right">{partyPhone}</span>
                  </div>
                )}
                {vehicleNumber && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Vehicle:</span>
                    <span className="font-black text-right bg-slate-200 px-1 rounded">{vehicleNumber}</span>
                  </div>
                )}
                {originLocation && (
                  <div className="flex justify-between">
                    <span className="font-bold text-slate-600">Origin / Port:</span>
                    <span className="font-semibold text-right truncate max-w-[180px]">{originLocation}</span>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-black my-1.5" />

            {/* Items Table */}
            <div className="space-y-1">
              <div className="grid grid-cols-12 font-black uppercase border-b border-black pb-1" style={{ fontSize: fontMetrics.detailSize }}>
                <span className="col-span-6">VARIETY / GRADE</span>
                <span className="col-span-3 text-right">WT / BOX</span>
                <span className="col-span-3 text-right">AMOUNT</span>
              </div>

              {items.map((row, idx) => {
                let rowKg = 0;
                const b = Number(row.boxes || 0);
                const kpb = Number(row.kgPerBox || 0);
                if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                  rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(2));
                } else if (b > 0 && kpb > 0) {
                  rowKg = Number((b * kpb).toFixed(2));
                } else if (Number(row.quantity || 0) > 0) {
                  rowKg = Number(row.quantity);
                }
                const rate = Number(row.rate || row.price || row.ratePerKg || row.unitRate || 0);
                const rowTotal = Number((rowKg * rate).toFixed(2));
                const gradeVal = getGradeLabel(row);
                const { itemTitle } = formatReceiptItemName(row.itemName || row.variety || row.name, langPref);

                return (
                  <div key={idx} className="py-1 border-b border-slate-100" style={{ fontSize: fontMetrics.detailSize }}>
                    <div className="font-black text-black" style={{ fontSize: fontMetrics.itemSize }}>
                      {idx + 1}. {itemTitle || 'Catch Variety'}
                    </div>
                    {gradeVal && gradeVal !== '—' && (
                      <div className="text-slate-600 pl-3" style={{ fontSize: fontMetrics.detailSize }}>Grade: {gradeVal}</div>
                    )}
                    <div className="flex justify-between items-center pl-3 text-slate-700" style={{ fontSize: fontMetrics.detailSize }}>
                      <span>{row.boxes ? `${row.boxes} Bx • ` : ''}{rowKg.toFixed(1)} Kg @ ₹{rate}/kg</span>
                      <span className="font-black text-black">
                        ₹{rowTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-dashed border-black my-1" />

            {/* Totals & Deductions */}
            <div className="space-y-1" style={{ fontSize: fontMetrics.detailSize }}>
              <div className="flex justify-between">
                <span>Total Net Weight:</span>
                <span className="font-bold">{totalWeightKg.toFixed(1)} Kg</span>
              </div>
              {totalBoxes > 0 && (
                <div className="flex justify-between">
                  <span>Total Boxes / Crates:</span>
                  <span className="font-bold">{totalBoxes} Boxes</span>
                </div>
              )}
              <div className="flex justify-between pt-0.5">
                <span>Gross Catch Value:</span>
                <span className="font-bold">₹{grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              {settlementList.length > 0 && (
                <div className="pt-1 space-y-0.5 border-t border-slate-200">
                  <div className="font-bold text-slate-600 uppercase" style={{ fontSize: fontMetrics.detailSize }}>Settlement Deductions:</div>
                  {settlementList.map((st, i) => (
                    <div key={i} className="flex justify-between text-rose-700" style={{ fontSize: fontMetrics.detailSize }}>
                      <span>- {st.label}</span>
                      <span>-₹{st.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t-2 border-black my-1.5" />

            {/* Net Amount Box */}
            <div className="p-2 bg-slate-50 border-2 border-black rounded text-center space-y-1">
              <span className="font-black uppercase tracking-wider block text-slate-700" style={{ fontSize: fontMetrics.detailSize }}>
                {isLocal ? 'NET PAYABLE TO FISHERMAN' : 'NET SETTLEMENT AMOUNT'}
              </span>
              <span className="font-black text-black block" style={{ fontSize: fontMetrics.grandTotalSize }}>
                ₹{Math.abs(netPayable).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <div className="font-bold text-slate-700 border-t border-dashed border-slate-300 pt-1 flex justify-between" style={{ fontSize: fontMetrics.detailSize }}>
                <span>STATUS: PAID</span>
                <span>MODE: {paymentMode}</span>
              </div>
            </div>

            {/* Amount in words */}
            <div className="text-slate-700 italic border-b border-dashed border-slate-300 pb-1" style={{ fontSize: fontMetrics.detailSize }}>
              <strong>In Words:</strong> {numberToIndianWords(Math.abs(netPayable))}
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-2 pt-2 text-center" style={{ fontSize: fontMetrics.detailSize }}>
              <div className="border-t border-dashed border-black pt-1">
                <span>Supplier Signature</span>
              </div>
              <div className="border-t border-dashed border-black pt-1">
                <span>Weighbridge Officer</span>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="text-center text-slate-600 pt-1 space-y-0.5" style={{ fontSize: fontMetrics.detailSize }}>
              <p className="font-bold uppercase m-0">*** GOODS RECEIVED & WEIGHED ***</p>
              <p className="m-0">Kadapa Central Seafood Depot</p>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* FORMAT C: A4 OFFICIAL COMMERCIAL INVOICE & WEIGHMENT SHEET                  */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {printFormat === 'A4' && (
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

              {/* Document Classification Box */}
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

            {/* Party & Logistics Details (Strict: Only show existing non-empty rows) */}
            {hasPartyInfo && (
              <div className="print-party-grid grid grid-cols-1 sm:grid-cols-2 border border-slate-900 divide-y sm:divide-y-0 sm:divide-x divide-slate-900 text-[11px]">
                {/* Left: Supplier Details */}
                <div className="p-2 space-y-0.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5">
                    {isLocal ? 'FISHERMAN / SUPPLIER DETAILS' : isDam ? 'CONTRACTOR / SYNDICATE DETAILS' : 'VENDOR / SUPPLIES PROVIDER'}
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    {partyName && (
                      <>
                        <span className="text-slate-500 font-bold">Supplier Name:</span>
                        <span className="col-span-2 font-black text-slate-950 uppercase">{partyName}</span>
                      </>
                    )}
                    {partyPhone && (
                      <>
                        <span className="text-slate-500 font-bold">Phone:</span>
                        <span className="col-span-2 font-mono font-bold text-slate-900">{partyPhone}</span>
                      </>
                    )}
                    {firmOrBoat && (
                      <>
                        <span className="text-slate-500 font-bold">Company / Boat:</span>
                        <span className="col-span-2 font-bold text-slate-900">{firmOrBoat}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Logistics & Depot Weighbridge */}
                <div className="p-2 space-y-0.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-0.5">
                    LOGISTICS & WEIGHMENT DETAILS
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    {vehicleNumber && (
                      <>
                        <span className="text-slate-500 font-bold">Vehicle Number:</span>
                        <span className="col-span-2 font-mono font-black text-slate-950 uppercase">{vehicleNumber}</span>
                      </>
                    )}
                    {originLocation && (
                      <>
                        <span className="text-slate-500 font-bold">Origin / Port:</span>
                        <span className="col-span-2 font-bold text-slate-900">{originLocation}</span>
                      </>
                    )}
                    <span className="text-slate-500 font-bold">Channel:</span>
                    <span className="col-span-2 font-bold text-slate-900">
                      {isLocal ? 'Local Coastal Harbor Catch' : isDam ? 'Inland Reservoir Consignment' : 'Depot Supplies & Packaging'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Itemized Commodity & Weighment Table */}
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

                      const { itemTitle } = formatReceiptItemName(row.itemName || row.variety || row.name, langPref);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border border-slate-900 p-1.5 text-center font-mono text-slate-600">{idx + 1}</td>
                          <td className="border border-slate-900 p-1.5 font-bold text-slate-950">
                            {itemTitle || 'Fish Variety'}
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
              {/* Left: Deductions & Additions Breakdown (Only rendered when deductions exist) */}
              {settlementList.length > 0 ? (
                <div className="sm:col-span-7 p-2.5 space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 flex items-center justify-between">
                    <span>SETTLEMENT DEDUCTIONS & ADVANCE ADJUSTMENTS</span>
                    <span className="text-[9px] text-slate-500 font-mono">(+Cr / -Dr Breakdown)</span>
                  </div>

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

                  {notes && (
                    <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] text-slate-700">
                      <span className="font-bold text-slate-950">Intake Notes: </span>
                      <span>{notes}</span>
                    </div>
                  )}
                </div>
              ) : (
                notes ? (
                  <div className="sm:col-span-7 p-2.5 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5">
                      INTAKE NOTES / REMARKS
                    </div>
                    <div className="text-[11px] text-slate-700 py-1">
                      {notes}
                    </div>
                  </div>
                ) : null
              )}

              {/* Right: Net Settlement Totals Box */}
              <div className={`${settlementList.length > 0 || notes ? 'sm:col-span-5' : 'sm:col-span-12'} p-2.5 bg-slate-50/70 flex flex-col justify-between space-y-2`}>
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
        )}

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
