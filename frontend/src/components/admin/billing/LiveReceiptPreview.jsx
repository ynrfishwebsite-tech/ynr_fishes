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

  const sampleItems = (menuPreviewItems && menuPreviewItems.length > 0)
    ? menuPreviewItems.slice(0, 3).map((item, idx) => ({
        name: item.name,
        price: Number(item.price || (idx === 0 ? 390 : 650)),
        pricePerKg: Number(item.price || (idx === 0 ? 390 : 650)),
        quantity: idx === 0 ? 2 : (idx === 1 ? 1 : 1.5),
        weightKg: idx === 0 ? 2 : (idx === 1 ? 1 : 1.5),
        enteredWeight: idx === 0 ? 2 : (idx === 1 ? 1 : 1.5),
        sellingUnit: 'Kg',
        total: idx === 0 ? 780 : (idx === 1 ? 650 : 300)
      }))
    : [
        { name: 'Black Pomfret / నల్ల చందువ (Halva) (MEDIUM)', price: 390, pricePerKg: 390, quantity: 2, weightKg: 2, enteredWeight: 2, sellingUnit: 'Kg', total: 780 },
        { name: 'Tiger Prawns / పెద్ద రొయ్యలు (LARGE)', price: 650, pricePerKg: 650, quantity: 1, weightKg: 1, enteredWeight: 1, sellingUnit: 'Kg', total: 650 },
        { name: 'Wallago / వాలగ (ఆల) (SMALL)', price: 200, pricePerKg: 200, quantity: 1.5, weightKg: 1.5, enteredWeight: 1.5, sellingUnit: 'Kg', total: 300 }
      ];

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
            {previewTab === 'srm' ? 'SRM Inward Slip' : previewFont.shortName}
          </span>
          <span className="font-bold text-slate-800">{RECEIPT_FONT_SIZES.find(s => s.id === (settings.receiptFontSize || 'medium'))?.label || 'Medium'} ({previewMetrics.bodySize})</span>
        </div>

        {previewTab === 'srm' ? (
          /* SRM Goods Inward & Catch Weighment Slip */
          <div
            className="p-3 transition-all duration-150 text-black font-mono"
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
                Kadapa Seafood Depot • Port & Dam Landings
              </div>
              <div style={{ fontSize: previewMetrics.detailSize, marginTop: '2px', lineHeight: '1.25' }}>
                PH: {settings.phone || '8328470402'}
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0', width: '100%' }}></div>

            <div style={{ fontSize: previewMetrics.subHeadingSize, fontWeight: 'bold', textAlign: 'center', margin: '2px 0' }}>
              GOODS INWARD CATCH SLIP
            </div>
            <div style={{ fontSize: previewMetrics.detailSize, textAlign: 'center', color: '#444' }}>
              SRM Procurement & Weighment Voucher
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0', width: '100%' }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize }}>
              <span>Date: {new Date().toLocaleDateString('en-GB')}</span>
              <span style={{ fontWeight: 'bold' }}>{new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize }}>
              <span>Voucher:</span>
              <span style={{ fontWeight: 'bold' }}>#GIN-LOC-20261113-01</span>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '4px 6px', margin: '4px 0', borderRadius: '4px', fontSize: previewMetrics.detailSize, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 'bold' }}>Supplier:</span>
                <span style={{ fontWeight: 'bold' }}>Mangalore Supplier</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Vehicle:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>AP 04 BB 3821</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Origin:</span>
                <span>Mangalore Old Port / Bunder</span>
              </div>
            </div>

            <div style={{ height: '1px', borderTop: '1px dashed #000000', margin: '4px 0' }}></div>

            {/* Inward Items */}
            <div style={{ margin: '4px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: previewMetrics.detailSize, fontWeight: 'bold', borderBottom: '1px solid #000', paddingBottom: '2px' }}>
                <span>CATCH ITEM</span>
                <span style={{ textAlign: 'right' }}>WT / RATE / TOTAL</span>
              </div>
              <div style={{ padding: '3px 0', borderBottom: '1px solid #eee', fontSize: previewMetrics.detailSize }}>
                <div style={{ fontWeight: 'bold' }}>1. Wallago / వాలగ (Fresh)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#333' }}>
                  <span>40 Bx • 2400.0 Kg @ ₹150</span>
                  <span style={{ fontWeight: 'bold' }}>₹3,60,000</span>
                </div>
              </div>
              <div style={{ padding: '3px 0', borderBottom: '1px solid #eee', fontSize: previewMetrics.detailSize }}>
                <div style={{ fontWeight: 'bold' }}>2. Black Pomfret / చందువ</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#333' }}>
                  <span>14 Bx • 350.0 Kg @ ₹420</span>
                  <span style={{ fontWeight: 'bold' }}>₹1,47,000</span>
                </div>
              </div>
            </div>

            <div style={{ height: '1px', borderTop: '1px dashed #000000', margin: '4px 0' }}></div>

            {/* Totals & Deductions */}
            <div style={{ fontSize: previewMetrics.detailSize }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Catch Weight:</span>
                <span style={{ fontWeight: 'bold' }}>2,750.0 Kg (54 Bx)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Gross Catch Value:</span>
                <span style={{ fontWeight: 'bold' }}>₹5,07,000</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                <span>- Ice Charges (Dr):</span>
                <span>-₹2,500</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                <span>- Advance Deducted:</span>
                <span>-₹50,000</span>
              </div>
            </div>

            <div style={{ height: '1.5px', backgroundColor: '#000000', margin: '4px 0' }}></div>

            <div style={{ textAlign: 'center', padding: '4px', backgroundColor: '#f0fdf4', border: '1px solid #16a34a', borderRadius: '4px', margin: '4px 0' }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: '#166534' }}>
                NET DUE TO SUPPLIER
              </div>
              <div style={{ fontSize: previewMetrics.grandTotalSize, fontWeight: 'bold', color: '#000' }}>
                ₹4,54,500.00
              </div>
              <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#15803d' }}>
                Status: PAID • Mode: Cash
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold', marginTop: '6px' }}>
              *** WEIGHMENT VERIFIED & ACCEPTED ***
            </div>
            <div style={{ textAlign: 'center', fontSize: '8px', color: '#666' }}>
              Weighbridge Operator & Party Acceptance
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
