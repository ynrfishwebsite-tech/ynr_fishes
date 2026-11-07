import React, { useState, useEffect } from 'react';
import { 
  Scale, Calendar, FileText, ArrowDownLeft, ShieldCheck, 
  RefreshCw, IndianRupee, Package, CheckCircle2, Building 
} from 'lucide-react';
import BackButton from '../common/BackButton';
import { useLanguage } from '../../../context/LanguageContext';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';

export default function SupplierPortal({ user, onGoBack }) {
  const { t } = useLanguage();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const supplierDisplayName = user?.name || user?.username || 'Catch Supplier';

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const res = await axios.get(`${getApiUrl()}/inventory/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rawLogs = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.logs || []);
      const supplierLogs = rawLogs.filter(l => 
        l.type === 'Stock-In' || l.type === 'Procurement (Stock-In)' ||
        (l.type && (l.type.includes('Stock-In') || l.type.includes('Procurement')))
      );
      setLogs(supplierLogs);
    } catch (err) {
      console.error('Failed to load supplier logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierData();
  }, []);

  const totalCatchKg = logs.reduce((sum, l) => sum + (Number(l.grossKgChange || l.quantityChange) || 0), 0);
  const totalSupplyCount = logs.length;

  return (
    <div className="w-full min-h-full shrink-0 flex flex-col bg-[#F7EFE2] text-slate-800 pb-24 touch-pan-y">
      {/* Compact Responsive Supplier Header */}
      <div className="py-2.5 px-3 sm:py-3.5 sm:px-5 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-10 shadow-xs flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onGoBack && <BackButton onClick={onGoBack} className="px-2.5 py-1 text-xs shrink-0 rounded-lg sm:rounded-xl" />}
          
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center shadow-xs shrink-0">
            <Scale size={17} className="sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-xs sm:text-base font-black text-slate-900 flex items-center gap-1.5 flex-wrap leading-tight">
              <span>{t("Supplier Catch & Khata Passbook")}</span>
              <span className="text-[9px] font-extrabold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full border border-blue-200">
                {t("View-Only")}
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-none mt-0.5">
              {t("Party:")} <strong className="text-slate-800">{supplierDisplayName}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={fetchSupplierData}
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-[#FAF0E4] border border-[#E8DCCB] text-[#7c3f1d] hover:bg-[#FDFBF7] transition-all cursor-pointer shadow-xs shrink-0"
          title={t("Refresh")}
        >
          <RefreshCw size={14} className={`sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Container (Full Screen Width, Compact Responsive) */}
      <div className="p-2.5 sm:p-6 w-full space-y-2.5 sm:space-y-4">
        {/* Compact Read-Only Notice */}
        <div className="bg-sky-50 border border-sky-200 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex items-start gap-2 text-sky-900 shadow-2xs text-[11px] sm:text-xs">
          <ShieldCheck size={16} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="font-bold">{t("Supplier Read-Only Passbook")}</strong>
            <p className="text-[10px] sm:text-[11px] text-sky-700 mt-0.5">
              {t("You can inspect your confirmed catch weighment sheets, rates, and credit balance. All transactions are digitally verified by Kadapa Depot Admin.")}
            </p>
          </div>
        </div>

        {/* Compact Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-white rounded-xl sm:rounded-2xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Total Catch Supplied")}</div>
            <div className="text-base sm:text-lg font-black text-slate-800 font-mono mt-0.5">
              {totalCatchKg.toFixed(1)} <span className="text-[10px] sm:text-xs text-slate-500 font-sans">Kg</span>
            </div>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs">
            <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Confirmed Landings")}</div>
            <div className="text-base sm:text-lg font-black text-sky-700 font-mono mt-0.5">
              {totalSupplyCount} <span className="text-[10px] sm:text-xs text-slate-500 font-sans">{t("Lots")}</span>
            </div>
          </div>
        </div>

        {/* Landings Feed Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E8DCCB] overflow-hidden shadow-xs w-full">
          <div className="py-2.5 px-3 sm:p-3.5 bg-[#FAF0E4] border-b border-[#E8DCCB] flex items-center justify-between">
            <h3 className="font-extrabold text-xs sm:text-sm text-slate-800 flex items-center gap-1 sm:gap-1.5">
              <ArrowDownLeft size={14} className="text-sky-600 sm:w-4 sm:h-4" />
              <span>{t("Catch Stock-In Vouchers")}</span>
            </h3>
            <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-500">{logs.length} records</span>
          </div>

          <div className="p-2 sm:p-3 divide-y divide-[#E8DCCB]/60">
            {loading && logs.length === 0 ? (
              <div className="py-8 sm:py-12 text-center text-slate-400">
                <RefreshCw size={20} className="animate-spin mx-auto text-sky-600 mb-1.5 sm:w-6 sm:h-6" />
                <p className="text-xs font-bold">{t("Fetching catch passbook...")}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-8 px-4 sm:py-12 sm:px-6 text-center text-slate-400">
                <Package size={26} className="mx-auto text-slate-300 mb-1.5 sm:w-8 sm:h-8" />
                <p className="text-xs font-bold text-slate-600">{t("No catch landings recorded yet.")}</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="py-2 sm:py-3 flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">{log.itemName}</span>
                      {log.crateReference && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.1 rounded font-mono shrink-0">
                          {log.crateReference}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Calendar size={10} />
                      <span>{new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {log.notes && <span className="truncate">&bull; {log.notes}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm font-black text-emerald-700 font-mono">
                      +{log.grossKgChange || log.quantityChange} Kg
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                      {t("Verified")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
