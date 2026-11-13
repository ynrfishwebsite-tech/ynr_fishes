import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { resolveItemQtyAndRate, formatReceiptItemName } from '../../../utils/formatters/billItemFormatters';
import { findReceiptFont, getReceiptFontMetrics, RECEIPT_FONT_SIZES } from '../../../utils/formatters/receiptFonts';

const LiveReceiptPreview = ({ settings, previewTab, t, user, menuPreviewItems, onChangeFormat }) => {
  const previewFont = findReceiptFont(settings.receiptFontFamily);
  const previewMetrics = getReceiptFontMetrics(settings.receiptFontSize || 'medium', settings.printFormat || '80mm');
  const fmt = settings.printFormat || '80mm';
  const langPref = settings.receiptItemLanguage || localStorage.getItem('receiptItemLanguage') || 'both';
  
  const paperWidth = fmt === '58mm' ? 210 : fmt === 'A4' ? 360 : 280;
  const previewLabel = fmt === '58mm' ? '58mm Thermal' : fmt === 'A4' ? 'A4 / Full Page' : '80mm Thermal';

  const sampleItems = (() => {
    if (menuPreviewItems && menuPreviewItems.length > 0) {
      const teluguItems = menuPreviewItems.filter(i => /[\u0C00-\u0C7F]/.test(i?.name || ''));
      const otherItems = menuPreviewItems.filter(i => !/[\u0C00-\u0C7F]/.test(i?.name || ''));
      const chosen = [...teluguItems, ...otherItems].slice(0, 3);
      return chosen.map((item, idx) => ({
        name: item.name,
        price: Number(item.price || (idx === 0 ? 390 : (idx === 1 ? 650 : 200))),
        pricePerKg: Number(item.price || (idx === 0 ? 390 : (idx === 1 ? 650 : 200))),
        quantity: idx === 0 ? 2 : (idx === 1 ? 1 : 1.5),
        weightKg: idx === 0 ? 2 : (idx === 1 ? 1 : 1.5),
        enteredWeight: idx === 0 ? 2 : (idx === 1 ? 1 : 1.5),
        sellingUnit: 'Kg',
        total: idx === 0 ? 780 : (idx === 1 ? 650 : 300)
      }));
    }
    return [
      { name: 'Black Pomfret / నల్ల చందువ (Halva) (MEDIUM)', price: 390, pricePerKg: 390, quantity: 2, weightKg: 2, enteredWeight: 2, sellingUnit: 'Kg', total: 780 },
      { name: 'Tiger Prawns / పెద్ద రొయ్యలు (LARGE)', price: 650, pricePerKg: 650, quantity: 1, weightKg: 1, enteredWeight: 1, sellingUnit: 'Kg', total: 650 },
      { name: 'Wallago / వాలగ (ఆల) (SMALL)', price: 200, pricePerKg: 200, quantity: 1.5, weightKg: 1.5, enteredWeight: 1.5, sellingUnit: 'Kg', total: 300 }
    ];
  })();

  const totalWeightKg = sampleItems.reduce((sum, it) => sum + (it.weightKg || it.quantity || 1), 0);
  const totalQty = `${totalWeightKg.toFixed(1).replace(/\.0$/, '')} Kg`;
  const subTotal = sampleItems.reduce((sum, it) => sum + (it.total || (it.price * (it.quantity || 1))), 0);
  const cgstAmt = settings.enableCgst !== false ? (subTotal * Number(settings.cgstRate !== undefined ? settings.cgstRate : 2.5)) / 100 : 0;
  const sgstAmt = settings.enableSgst !== false ? (subTotal * Number(settings.sgstRate !== undefined ? settings.sgstRate : 2.5)) / 100 : 0;
  const gstAmt = settings.enableGst === true ? (subTotal * Number(settings.gstRate !== undefined ? settings.gstRate : 5)) / 100 : 0;
  const grandTotal = Math.round(subTotal + cgstAmt + sgstAmt + gstAmt);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Format selector chips */}
      {onChangeFormat && (
        <div className="flex items-center gap-1.5 w-full justify-center flex-wrap">
          {['58mm', '80mm', 'A4'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => onChangeFormat('printFormat', f)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                fmt === f
                  ? 'bg-red-600 text-white border-red-600 shadow-sm'
                  : 'bg-white text-text-muted border-border hover:border-red-600 hover:text-red-600'
              }`}>
              {f === 'A4' ? 'A4' : f === '58mm' ? '58mm' : '80mm'}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 font-medium ml-1">{previewLabel}</span>
        </div>
      )}

      {/* Paper Container */}
      <div
        className="bg-white border border-border rounded-lg shadow-sm transition-all duration-200 overflow-hidden"
        style={{ width: paperWidth, minWidth: paperWidth, maxWidth: paperWidth, margin: '0 auto' }}>
        {/* Paper top edge indicator */}
        <div className="h-1 w-full" style={{
          background: previewTab === 'srm' ? '#059669' : previewTab === 'kot' ? '#ef4444' : (fmt === '58mm' ? '#f97316' : fmt === 'A4' ? '#6366f1' : '#10b981')
        }} />

        {/* Info bar at top of preview */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#FAF0E4] border-b border-[#E8DCCB] text-[10px] text-slate-800 font-sans select-none">
          <span className="font-bold text-slate-900 truncate max-w-[55%]">
            {previewTab === 'local' ? 'Local Catch Slip' : previewTab === 'dam' ? 'Dam Catch Slip' : previewTab === 'supplies' ? 'Supplies Inward' : (previewTab === 'srm' ? 'SRM Inward Slip' : previewFont.shortName)}
          </span>
          <span className="font-bold text-slate-800">{RECEIPT_FONT_SIZES.find(s => s.id === (settings.receiptFontSize || 'medium'))?.label || 'Medium'} ({previewMetrics.bodySize})</span>
        </div>

        {(previewTab === 'srm' || previewTab === 'local' || previewTab === 'dam' || previewTab === 'supplies') ? (
          /* SRM Goods Inward & Catch Weighment Slip (Matching Real UI Inward Slip Exactly) */
          <div
            className="p-3 transition-all duration-150 text-black"
            style={{
              fontFamily: previewFont.value,
              ...(previewFont.previewStyle || {}),
              fontSize: previewMetrics.bodySize,
              lineHeight: previewMetrics.lineHeight,
              color: '#000000',
              backgroundColor: '#ffffff'
            }}
          >
            {/* Logo */}
            {Boolean(settings.logo && settings.logo !== '[logo_stored]' && settings.showLogo !== false && fmt !== '58mm') && (
              <div className="flex justify-center mb-1">
                <img
                  src={settings.logo}
                  alt="Logo Preview"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="object-contain"
                  style={{ maxHeight: fmt === '58mm' ? 38 : 48, maxWidth: fmt === '58mm' ? 100 : 120 }}
                />
              </div>
            )}
            <div className="text-center" style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: previewMetrics.headingSize, fontWeight: 'bold', lineHeight: '1.15', textTransform: 'uppercase' }}>
                {settings.restaurantName || 'YNR FISHES'}
              </div>
              <div style={{ fontSize: previewMetrics.detailSize, marginTop: '2px', lineHeight: '1.2' }}>
                {(settings.address || 'Chemmumiahpet, Ravindra Nagar, Utukuru, Andhra Pradesh 516004').split('\n')[0]}
              </div>
              <div style={{ fontSize: previewMetrics.detailSize, marginTop: '2px', lineHeight: '1.25' }}>
                Ph: {settings.phone || '9849313889'}{settings.gstin ? ` • GST: ${settings.gstin}` : ' • GST: 37AAACI1681G2ZN'}
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0', width: '100%' }}></div>

            {/* Document Titles */}
            <div style={{ textAlign: 'center', margin: '2px 0' }}>
              <div style={{ fontSize: previewMetrics.subHeadingSize, fontWeight: 'bold', textTransform: 'uppercase' }}>
                {previewTab === 'dam' ? 'DAM CATCH SLIP' : previewTab === 'supplies' ? 'SUPPLIES STOCK-IN SLIP' : 'LOCAL CATCH SLIP'}
              </div>
              <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase' }}>
                {previewTab === 'supplies' ? 'GOODS INWARD & PROCUREMENT SLIP' : 'GOODS INWARD & WEIGHMENT SLIP'}
              </div>
              <div style={{ fontWeight: 'bold', fontSize: previewMetrics.detailSize, marginTop: '1px' }}>
                {previewTab === 'dam' ? '#GIN-DAM-20261109-011857' : previewTab === 'supplies' ? '#GIN-SUP-20261109-011857' : '#GIN-LOC-20261109-011857'}
              </div>
              <div style={{ fontSize: '9.5px', color: '#475569' }}>
                09 Nov 2026 • 01:18 am
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0', width: '100%' }}></div>

            {/* Party & Logistics Details (Strict: Only present fields are shown, no dummy fallbacks) */}
            {(() => {
              const party = previewTab === 'dam'
                ? {
                    supplier: 'SRI KRISHNA SYNDICATE',
                    firm: 'Dam Landings Unit #3',
                    phone: '9849313889',
                    vehicle: 'AP 04 TT 5521',
                    origin: 'Somasila Reservoir Landing'
                  }
                : previewTab === 'supplies'
                ? {
                    supplier: 'BALAJI ICE & PACKAGING',
                    firm: 'Depot Bulk Crates',
                    phone: '9440123456',
                    vehicle: 'AP 04 X 8812',
                    origin: 'Industrial Area, Kadapa'
                  }
                : {
                    supplier: 'MANGALORE SUPPLIER',
                    firm: 'Sea King Syndicate',
                    phone: '8489484844',
                    vehicle: 'AP 04 BB 3821',
                    origin: 'Mangalore Old Port / Bunder H...'
                  };

              return (
                <div style={{ backgroundColor: '#f8fafc', padding: '5px 7px', margin: '4px 0', borderRadius: '4px', fontSize: previewMetrics.detailSize, border: '1px solid #cbd5e1' }}>
                  {party.supplier && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#475569', fontWeight: 'bold' }}>Supplier:</span>
                      <span style={{ fontWeight: '900', textTransform: 'uppercase' }}>{party.supplier}</span>
                    </div>
                  )}
                  {party.firm && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#475569', fontWeight: 'bold' }}>Firm/Boat:</span>
                      <span style={{ fontWeight: 600 }}>{party.firm}</span>
                    </div>
                  )}
                  {party.phone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#475569', fontWeight: 'bold' }}>Phone:</span>
                      <span style={{ fontWeight: 'bold' }}>{party.phone}</span>
                    </div>
                  )}
                  {party.vehicle && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#475569', fontWeight: 'bold' }}>Vehicle:</span>
                      <span style={{ fontWeight: '900', backgroundColor: '#e2e8f0', padding: '0 4px', borderRadius: '2px' }}>{party.vehicle}</span>
                    </div>
                  )}
                  {party.origin && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#475569', fontWeight: 'bold' }}>Origin / Port:</span>
                      <span style={{ fontWeight: 600, maxWidth: '65%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{party.origin}</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0', width: '100%' }}></div>

            {/* Inward Items Table (Matching Reference Exactly) */}
            <div style={{ margin: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, fontWeight: '900', borderBottom: '1px solid #000', paddingBottom: '3px', textTransform: 'uppercase' }}>
                <span style={{ flex: '1 1 0%' }}>VARIETY / GRADE</span>
                <span style={{ width: '80px', textAlign: 'right', flexShrink: 0 }}>WT / BOX</span>
                <span style={{ width: '85px', textAlign: 'right', flexShrink: 0 }}>AMOUNT</span>
              </div>

              {/* Sample Catch Items */}
              {(() => {
                const srmItems = previewTab === 'supplies'
                  ? [
                      { name: 'Crushed Ice (Block) / మంచు', grade: 'Grade: Industrial (Pure)', rate: 2.5, wt: '1200.0 Kg', boxes: '20 Blk', total: '3,000.00' },
                      { name: 'Plastic Fish Crates (Red) / క్రేట్స్', grade: 'Grade: 60 Kg Capacity', rate: 450, wt: '50 Pcs', boxes: '50 Pcs', total: '22,500.00' }
                    ]
                  : [
                      { name: 'Wallago / వాలగ (ఆల)', grade: 'Grade: Medium (1+)', rate: 150, wt: '2400.0 Kg', boxes: '40 Bx', total: '3,60,000.00' }
                    ];

                return srmItems.map((it, idx) => {
                  const { itemTitle } = formatReceiptItemName(it.name, langPref);
                  return (
                    <div key={idx} style={{ padding: '3px 0', borderBottom: idx < srmItems.length - 1 ? '1px dashed #cbd5e1' : 'none', fontSize: previewMetrics.detailSize }}>
                      <div style={{ fontWeight: 'bold', fontSize: previewMetrics.detailSize }}>
                        {idx + 1}. {itemTitle}
                      </div>
                      <div style={{ fontSize: '9px', color: '#475569', marginLeft: '12px' }}>
                        {it.grade}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1px' }}>
                        <span style={{ color: '#1e293b', fontSize: '9.5px', marginLeft: '12px' }}>
                          {it.boxes} • {it.wt} @ ₹{it.rate}/kg
                        </span>
                        <span style={{ fontWeight: 'bold', fontSize: previewMetrics.detailSize }}>
                          ₹{it.total}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ borderTop: '1px dashed #000000', margin: '4px 0' }}></div>

            {/* Totals Section */}
            <div style={{ fontSize: previewMetrics.detailSize, lineHeight: '1.4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Net Weight:</span>
                <span style={{ fontWeight: 'bold' }}>2400.0 Kg</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Boxes / Crates:</span>
                <span style={{ fontWeight: 'bold' }}>40 Boxes</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Gross Catch Value:</span>
                <span style={{ fontWeight: 'bold' }}>₹3,60,000.00</span>
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0', width: '100%' }}></div>

            {/* NET PAYABLE BOX (Matching User Screenshot with Bold 2px border) */}
            <div style={{ textAlign: 'center', padding: '6px 4px', border: '2px solid #000000', borderRadius: '4px', margin: '5px 0' }}>
              <div style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {previewTab === 'dam' ? 'NET PAYABLE TO CONTRACTOR' : previewTab === 'supplies' ? 'NET PAYABLE TO SUPPLIER' : 'NET PAYABLE TO FISHERMAN'}
              </div>
              <div style={{ fontSize: previewMetrics.grandTotalSize, fontWeight: '900', color: '#000000', margin: '2px 0' }}>
                ₹3,60,000.00
              </div>
              <div style={{ borderTop: '1px dashed #000000', margin: '4px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', padding: '0 4px' }}>
                <span>STATUS: PAID</span>
                <span>MODE: Cash</span>
              </div>
            </div>

            <div style={{ fontSize: '9.5px', fontStyle: 'italic', color: '#334155', margin: '4px 0' }}>
              In Words: Three Lakh Sixty Thousand Only
            </div>

            <div style={{ borderTop: '1px dashed #000000', margin: '6px 0 10px 0' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 'bold', textAlign: 'center', padding: '0 4px' }}>
              <div>
                <div style={{ borderTop: '1px dashed #666', width: '85px', marginBottom: '2px' }}></div>
                <span>Supplier Signature</span>
              </div>
              <div>
                <div style={{ borderTop: '1px dashed #666', width: '85px', marginBottom: '2px' }}></div>
                <span>Weighbridge Officer</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: '900', marginTop: '8px', letterSpacing: '0.5px' }}>
              *** GOODS RECEIVED & WEIGHED ***
            </div>
          </div>
        ) : (
          /* Tax Invoice / Receipt Preview */
          <div
            className="p-3 transition-all duration-150 text-black"
            style={{
              fontFamily: previewFont.value,
              ...(previewFont.previewStyle || {}),
              fontSize: previewMetrics.bodySize,
              lineHeight: previewMetrics.lineHeight,
              color: '#000000',
              backgroundColor: '#ffffff'
            }}>
            {/* Logo */}
            {Boolean(settings.logo && settings.logo !== '[logo_stored]' && settings.showLogo !== false && fmt !== '58mm') && (
              <div className="flex justify-center mb-1">
                <img
                  src={settings.logo}
                  alt="Logo Preview"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="object-contain"
                  style={{ maxHeight: fmt === '58mm' ? 38 : 48, maxWidth: fmt === '58mm' ? 100 : 120 }}
                />
              </div>
            )}

            {/* Restaurant Header */}
            <div className="text-center" style={{ textAlign: 'center', marginBottom: '4px' }}>
              <div style={{ fontSize: previewMetrics.headingSize, fontWeight: 'bold', lineHeight: '1.15', textTransform: 'uppercase' }}>
                {settings.restaurantName || 'YNR FISHES'}
              </div>
              {settings.restaurantType && (
                <div style={{ fontSize: previewMetrics.detailSize, fontWeight: 600, marginTop: '2px', lineHeight: '1.2' }}>
                  {settings.restaurantType}
                </div>
              )}
              <div style={{ fontSize: previewMetrics.detailSize, marginTop: '2px', lineHeight: '1.25', color: '#000000' }}>
                {(settings.address || 'Fishing Harbor Main Road, Visakhapatnam, Andhra Pradesh 530001').split('\n').map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {settings.gstin && <div>GSTIN: {settings.gstin}</div>}
                <div>PH: {settings.phone || '8328470402'}</div>
                {settings.fssai && <div>FSSAI: {settings.fssai}</div>}
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ fontSize: previewMetrics.subHeadingSize, fontWeight: 'bold', textAlign: 'center', margin: '3px 0' }}>
              {t("Tax Invoice")}
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: previewMetrics.bodySize, marginBottom: '2px' }}>
              {t("Direct Counter Sale")}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, marginBottom: '2px' }}>
              <span>{t("Date:")} {new Date().toLocaleDateString('en-GB')}</span>
              <span style={{ fontWeight: 'bold' }}>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, marginBottom: '2px' }}>
              <span>{t("Cashier:")} {user?.username || 'admin'}</span>
              <span style={{ fontWeight: 'bold' }}>{t("Bill No.:")} MS0575</span>
            </div>

            {/* Customer Details Live Preview (Sample) */}
            {(() => {
              const custConfig = settings?.receiptCustomerDisplay || {
                retail: { enabled: true, showName: true, showPhone: true, showAddress: false, showShopName: false }
              };
              const cfg = custConfig.retail || custConfig.wholesale || { enabled: true, showName: true, showPhone: true };
              if (!cfg.enabled) return null;

              const hasAny = cfg.showName || cfg.showPhone || cfg.showShopName || cfg.showAddress;
              if (!hasAny) return null;

              return (
                <div style={{ borderTop: '1px dashed #444', borderBottom: '1px dashed #444', padding: '3px 0', margin: '3px 0', fontSize: previewMetrics.detailSize }}>
                  <div style={{ fontWeight: 'bold', fontSize: previewMetrics.detailSize, textTransform: 'uppercase', marginBottom: '1px' }}>
                    {t("Customer Details:")}
                  </div>
                  {cfg.showName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Name:</span>
                      <span style={{ fontWeight: 'bold' }}>Preethi</span>
                    </div>
                  )}
                  {cfg.showShopName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Shop:</span>
                      <span style={{ fontWeight: 'bold' }}>Haritha Fish Mart</span>
                    </div>
                  )}
                  {cfg.showPhone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Phone:</span>
                      <span style={{ fontWeight: 'bold' }}>9392376374</span>
                    </div>
                  )}
                  {cfg.showAddress && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span>Address:</span>
                      <span style={{ textAlign: 'right', maxWidth: '65%', fontWeight: 'normal' }}>Harbor Road, Kadapa</span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            {fmt === '58mm' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: previewMetrics.detailSize, paddingBottom: '2px' }}>
                <span>{t("ITEM")}</span>
                <span>{t("AMT")}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', width: '100%', alignItems: 'center', fontSize: previewMetrics.detailSize, fontWeight: 700, paddingBottom: '2px' }}>
                <div style={{ flex: '1 1 0%', textAlign: 'left' }}>{t("Item")}</div>
                <div style={{ width: '48px', textAlign: 'center', flexShrink: 0 }}>{t("Qty(Kg)")}</div>
                <div style={{ width: '52px', textAlign: 'right', flexShrink: 0 }}>{t("Price")}</div>
                <div style={{ width: '64px', textAlign: 'right', flexShrink: 0 }}>{t("Amount")}</div>
              </div>
            )}

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '3px 0 5px 0', width: '100%' }}></div>

            <div style={{ marginBottom: '4px' }}>
              {sampleItems.map((item, idx) => {
                const { itemTitle, subDetail } = formatReceiptItemName(item.name, langPref);
                const qData = resolveItemQtyAndRate(item);
                const rawWeightVal = item.weightKg !== undefined ? item.weightKg : (item.enteredWeight !== undefined ? item.enteredWeight : item.quantity);
                const numQtyDisplay = qData.isKg ? Number(rawWeightVal || 0).toFixed(1).replace(/\.0$/, '') : qData.qtyDisplay;

                return fmt === '58mm' ? (
                  <div key={idx} style={{ marginBottom: '4px', paddingBottom: '2px', borderBottom: '1px dashed #e0e0e0' }}>
                    <div style={{ fontWeight: 700, fontSize: previewMetrics.detailSize, textAlign: 'left', lineHeight: '1.2', color: '#000000' }}>
                      {itemTitle}
                    </div>
                    {subDetail && (
                      <div style={{ fontSize: '9px', fontWeight: 600, color: '#4b5563', marginTop: '1px' }}>
                        {subDetail}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: previewMetrics.detailSize, marginTop: '1.5px' }}>
                      <span style={{ color: '#444', fontSize: '10px' }}>{numQtyDisplay}kg × {qData.rateDisplay}</span>
                      <span style={{ fontWeight: 700 }}>{qData.amountDisplay}</span>
                    </div>
                  </div>
                ) : (
                  <div key={idx} style={{ display: 'flex', width: '100%', alignItems: 'flex-start', padding: '2px 0 3px 0', borderBottom: '1px dashed #e5e5e5', fontSize: previewMetrics.detailSize, lineHeight: '1.25' }}>
                    <div style={{ flex: '1 1 0%', textAlign: 'left', paddingRight: '4px' }}>
                      <div style={{ fontWeight: 700, color: '#000000', fontSize: previewMetrics.detailSize }}>
                        {itemTitle}
                      </div>
                      {subDetail && (
                        <div style={{ fontSize: '9px', fontWeight: 600, color: '#4b5563', marginTop: '1px' }}>
                          {subDetail}
                        </div>
                      )}
                    </div>
                    <div style={{ width: '48px', textAlign: 'center', flexShrink: 0, fontWeight: 700, fontSize: previewMetrics.detailSize }}>
                      {numQtyDisplay}
                    </div>
                    <div style={{ width: '52px', textAlign: 'right', flexShrink: 0, fontWeight: 600, fontSize: previewMetrics.detailSize }}>
                      {qData.rateDisplay}
                    </div>
                    <div style={{ width: '64px', textAlign: 'right', flexShrink: 0, fontWeight: 700, fontSize: previewMetrics.detailSize }}>
                      {qData.amountDisplay}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
              <span>{t("Total Qty:")} {totalQty}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span>{t("Sub Total:")}</span>
                <span style={{ fontWeight: 'bold' }}>{subTotal.toFixed(2)}</span>
              </div>
            </div>

            {settings.enableCgst !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
                <span>CGST ({settings.cgstRate !== undefined ? settings.cgstRate : 2.5}%)</span>
                <span>{cgstAmt.toFixed(2)}</span>
              </div>
            )}
            {settings.enableSgst !== false && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
                <span>SGST ({settings.sgstRate !== undefined ? settings.sgstRate : 2.5}%)</span>
                <span>{sgstAmt.toFixed(2)}</span>
              </div>
            )}
            {settings.enableGst === true && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, padding: '1px 0' }}>
                <span>GST ({settings.gstRate !== undefined ? settings.gstRate : 5}%)</span>
                <span>{gstAmt.toFixed(2)}</span>
              </div>
            )}

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: previewMetrics.grandTotalSize, fontWeight: 'bold', margin: '3px 0' }}>
              <span>{t("Grand Total")}</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '5px 0', width: '100%' }}></div>

            <div style={{ textAlign: 'center', fontSize: previewMetrics.bodySize, fontWeight: 'bold', margin: '3px 0' }}>
              {t("Paid via Cash")}
            </div>

            {settings.enableQrPayment !== false && (settings.upiId || '').trim() && fmt !== '58mm' && (
              <div style={{ textAlign: 'center', margin: '5px 0' }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px' }}>
                  {t("SCAN TO PAY VIA UPI")}
                </div>
                <div style={{ margin: '3px auto', display: 'inline-block' }}>
                  <QRCodeCanvas
                    value={`upi://pay?pa=${settings.upiId.trim()}&pn=${encodeURIComponent(settings.restaurantName || 'Restaurant')}&am=${grandTotal}&cu=INR`}
                    size={fmt === '58mm' ? 130 : 140}
                    level="L"
                    includeMargin={false}
                  />
                </div>
                <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>
                  {t("UPI ID:")} {settings.upiId.trim()}
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 'bold', marginTop: '6px', lineHeight: '1.3' }}>
              {settings.footerMessage || t("*** THANK YOU! VISIT AGAIN ***")}
            </div>
          </div>
        )}

        <div className="h-4 w-full flex items-center justify-center gap-0.5 opacity-30">
          {Array.from({ length: Math.floor(paperWidth / 8) }).map((_, i) => (
            <div key={i} className="w-1 h-3 bg-gray-400 rounded-b-full" />
          ))}
        </div>
      </div>

      <p className="text-[9px] text-gray-400 text-center">
        {t("Live preview reflects your selected font, size, and layout settings.")}
      </p>
    </div>
  );
};

export default LiveReceiptPreview;
