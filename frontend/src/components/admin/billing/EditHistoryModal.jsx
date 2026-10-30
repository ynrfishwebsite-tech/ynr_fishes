import React from 'react';
import { X, Clock } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

const EditHistoryModal = ({ bill, onClose }) => {
  const { t } = useLanguage();

  if (!bill || !bill.editHistory || bill.editHistory.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-[99999] p-3 sm:p-6">
      <div className="bg-[#FAF0E4] border border-[#E8DCCB] shadow-2xl rounded-2xl text-slate-800 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#E8DCCB] bg-[#F7EFE2] shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              {t("Edit History")}
              <span className="text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded text-xs sm:text-sm font-mono font-bold">
                {bill.billNumber || 'Unbilled'}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
              {t("Reference / Order")}: <span className="font-bold text-slate-800">{bill.tableNo || 'POS'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#ebdcc7] rounded-full transition-colors text-slate-600 hover:text-slate-900 touch-target"
            title={t("Close")}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-[#FDFBF7] custom-scrollbar">
          <div className="space-y-6 sm:space-y-8">
            {bill.editHistory.map((edit, index) => (
              <div key={index} className="bg-white border border-[#E8DCCB] rounded-2xl overflow-hidden shadow-sm">
                
                {/* Edit Header */}
                <div className="bg-[#FAF0E4] px-4 sm:px-5 py-2.5 sm:py-3 border-b border-[#E8DCCB] flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
                  <Clock size={16} className="text-[#ea580c] shrink-0" />
                  <span>{t("Edit")} #{index + 1} - {new Date(edit.editedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium', timeStyle: 'short'
                  })}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E8DCCB]">
                  
                  {/* Before */}
                  <div className="p-4 sm:p-5">
                    <h4 className="text-xs font-black mb-3 sm:mb-4 uppercase tracking-wider bg-[#FAF0E4] border border-[#E8DCCB] text-[#7c3f1d] inline-block px-2.5 py-1 rounded-md">
                      {t("Before Edit")}
                    </h4>
                    
                    <div className="space-y-2.5">
                      {edit.previousState?.items?.map((item, i) => (
                        <div key={i} className="flex justify-between items-start text-xs sm:text-sm border-b border-slate-100 pb-2">
                          <div className="font-medium text-slate-700">
                            {item.name} <span className="text-slate-500 font-mono">x{item.quantity}</span>
                          </div>
                          <div className="font-bold text-slate-800">₹{item.total}</div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-[#E8DCCB] space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>{t("Subtotal")}</span>
                        <span>₹{edit.previousState?.subtotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>{t("Tax")}</span>
                        <span>₹{edit.previousState?.totalTax || 0}</span>
                      </div>
                      {(Number(edit.previousState?.totalDiscount || 0) > 0 || Number(edit.newState?.totalDiscount || 0) > 0) && (
                        <div className="flex justify-between text-xs text-slate-600 font-medium">
                          <span>{t("Discount")}</span>
                          <span>₹{edit.previousState?.totalDiscount || 0}</span>
                        </div>
                      )}
                      {(Number(edit.previousState?.deliveryCharge || 0) > 0 || Number(edit.newState?.deliveryCharge || 0) > 0) && (
                        <div className="flex justify-between text-xs text-slate-600 font-medium">
                          <span>{t("Delivery Charge")}</span>
                          <span>₹{edit.previousState?.deliveryCharge || 0}</span>
                        </div>
                      )}
                      {(Number(edit.previousState?.containerCharge || 0) > 0 || Number(edit.newState?.containerCharge || 0) > 0) && (
                        <div className="flex justify-between text-xs text-slate-600 font-medium">
                          <span>{t("Container Charge")}</span>
                          <span>₹{edit.previousState?.containerCharge || 0}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-slate-900 mt-2 text-sm sm:text-base pt-2 border-t border-[#E8DCCB]">
                        <span>{t("Total")}</span>
                        <span>₹{edit.previousState?.total || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* After */}
                  <div className="p-4 sm:p-5 bg-[#FAF0E4]/40">
                    <h4 className="text-xs font-black mb-3 sm:mb-4 uppercase tracking-wider bg-sky-100 border border-sky-300 text-sky-900 inline-block px-2.5 py-1 rounded-md flex items-center gap-2 w-max">
                      {t("After Edit")}
                    </h4>

                    <div className="space-y-2.5">
                      {edit.newState?.items?.map((item, i) => {
                        const prevItem = edit.previousState?.items?.find(p => p.name === item.name);
                        const isNew = !prevItem;
                        const qtyChanged = prevItem && prevItem.quantity !== item.quantity;
                        
                        return (
                          <div
                            key={i}
                            className={`flex justify-between items-start text-xs sm:text-sm border-b border-[#E8DCCB] pb-2 ${
                              isNew || qtyChanged
                                ? 'bg-[#FFF3E0] -mx-2 px-2.5 py-1.5 rounded-lg border-l-4 border-l-[#ea580c]'
                                : ''
                            }`}
                          >
                            <div className={`font-medium ${isNew || qtyChanged ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                              {item.name} <span className="text-slate-600 font-mono font-bold">x{item.quantity}</span>
                              {qtyChanged && (
                                <span className="text-[10px] ml-1.5 text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md font-bold">
                                  (was {prevItem.quantity})
                                </span>
                              )}
                              {isNew && (
                                <span className="text-[10px] ml-1.5 text-emerald-900 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md font-bold">
                                  {t("NEW")}
                                </span>
                              )}
                            </div>
                            <div className="font-black text-slate-900">₹{item.total}</div>
                          </div>
                        );
                      })}
                      
                      {/* Check for removed items */}
                      {edit.previousState?.items?.map((pItem, i) => {
                        const exists = edit.newState?.items?.find(n => n.name === pItem.name);
                        if (!exists) {
                          return (
                            <div
                              key={`rem-${i}`}
                              className="flex justify-between items-start text-xs sm:text-sm border-b border-red-200 pb-2 bg-red-50 -mx-2 px-2.5 py-1.5 rounded-lg border-l-4 border-l-red-500"
                            >
                              <div className="font-medium text-red-700 line-through">
                                {pItem.name} <span>x{pItem.quantity}</span>
                              </div>
                              <div className="font-bold text-red-700 line-through">₹{pItem.total}</div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E8DCCB] space-y-1">
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>{t("Subtotal")}</span>
                        <span>₹{edit.newState?.subtotal || 0}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600 font-medium">
                        <span>{t("Tax")}</span>
                        <span>₹{edit.newState?.totalTax || 0}</span>
                      </div>
                      {(Number(edit.previousState?.totalDiscount || 0) > 0 || Number(edit.newState?.totalDiscount || 0) > 0) && (
                        <div className="flex justify-between text-xs text-slate-600 font-medium">
                          <span>{t("Discount")}</span>
                          <span>₹{edit.newState?.totalDiscount || 0}</span>
                        </div>
                      )}
                      {(Number(edit.previousState?.deliveryCharge || 0) > 0 || Number(edit.newState?.deliveryCharge || 0) > 0) && (
                        <div className="flex justify-between text-xs text-slate-600 font-medium">
                          <span>{t("Delivery Charge")}</span>
                          <span>₹{edit.newState?.deliveryCharge || 0}</span>
                        </div>
                      )}
                      {(Number(edit.previousState?.containerCharge || 0) > 0 || Number(edit.newState?.containerCharge || 0) > 0) && (
                        <div className="flex justify-between text-xs text-slate-600 font-medium">
                          <span>{t("Container Charge")}</span>
                          <span>₹{edit.newState?.containerCharge || 0}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-black text-slate-900 mt-2 text-sm sm:text-base pt-2 border-t border-[#E8DCCB]">
                        <span>{t("Total")}</span>
                        <div className="flex items-center gap-2">
                          {edit.newState?.total !== edit.previousState?.total && (
                            <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded font-bold ${
                              (edit.newState?.total || 0) > (edit.previousState?.total || 0)
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-black'
                                : 'bg-red-100 text-red-800 border border-red-300 font-black'
                            }`}>
                              {(edit.newState?.total || 0) > (edit.previousState?.total || 0) ? '+' : ''}
                              {((edit.newState?.total || 0) - (edit.previousState?.total || 0)).toFixed(2)}
                            </span>
                          )}
                          <span className="text-emerald-700 font-black">₹{edit.newState?.total || 0}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditHistoryModal;
