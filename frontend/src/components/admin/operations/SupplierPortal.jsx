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
  const [activeTab, setActiveTab] = useState('catch'); // 'catch' | 'khata'

  const supplierDisplayName = user?.name || user?.username || 'Catch Supplier';

  const fetchSupplierData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const res = await axios.get(`${getApiUrl()}/inventory/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && Array.isArray(res.data.logs)) {
        // Filter logs where supplier matches or catch procurement
        const supplierLogs = res.data.logs.filter(l => 
          l.type === 'Stock-In' || l.type === 'Procurement (Stock-In)'
        );
        setLogs(supplierLogs);
      }
    } catch (err) {
      console.error('Failed to load supplier logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierData();
  }, []);

  // Compute summary stats
  const totalCatchKg = logs.reduce((sum, l) => sum + (Number(l.grossKgChange || l.quantityChange) || 0), 0);
  const totalSupplyCount = logs.length;

  return (
    <div className="h-full flex flex-col bg-[#F7EFE2] text-slate-800 overflow-y-auto">
      {/* Header Bar */}
      <div className="p-4 border-b border-[#E8DCCB] bg-[#FDFBF7] sticky top-0 z-10 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onGoBack && <BackButton onClick={onGoBack} />}
          <div className="w-10 h-10 rounded-2xl bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center shadow-xs">
            <Scale size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>{t("Supplier Catch & Khata Passbook")}</span>
              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full border border-blue-200">
                {t("View-Only")}
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {t("Harbor & Dam Party:")} <strong className="text-slate-800">{supplierDisplayName}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={fetchSupplierData}
          className="p-2 rounded-xl bg-[#FAF0E4] border border-[#E8DCCB] text-[#7c3f1d] hover:bg-[#FDFBF7] transition-all cursor-pointer shadow-xs"
          title={t("Refresh")}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Main Container */}
      <div className="p-3 sm:p-5 max-w-3xl mx-auto w-full space-y-3.5">
        {/* Read-Only Notice */}
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 flex items-start gap-2.5 text-sky-900 shadow-2xs">
          <ShieldCheck size={18} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block font-bold">{t("Supplier Read-Only Passbook")}</strong>
            <p className="text-[11px] text-sky-700 mt-0.5">
              {t("You can inspect your confirmed catch weighment sheets, rates, and credit balance. All transactions are digitally verified by Kadapa Depot Admin.")}
            </p>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-[#E8DCCB] p-3 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Total Catch Supplied")}</div>
            <div className="text-lg font-black text-slate-800 font-mono mt-0.5">
              {totalCatchKg.toFixed(1)} <span className="text-xs text-slate-500 font-sans">Kg</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8DCCB] p-3 shadow-2xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t("Confirmed Landings")}</div>
            <div className="text-lg font-black text-sky-700 font-mono mt-0.5">
              {totalSupplyCount} <span className="text-xs text-slate-500 font-sans">{t("Lots")}</span>
            </div>
          </div>
        </div>

        {/* Landings Feed */}
        <div className="bg-white rounded-3xl border border-[#E8DCCB] overflow-hidden shadow-xs">
          <div className="p-3.5 bg-[#FAF0E4] border-b border-[#E8DCCB] flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
              <ArrowDownLeft size={16} className="text-sky-600" />
              <span>{t("Catch Stock-In Vouchers")}</span>
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500">{logs.length} records</span>
          </div>

          <div className="p-3 divide-y divide-[#E8DCCB]/60">
            {loading && logs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto text-sky-600 mb-2" />
                <p className="text-xs font-bold">{t("Fetching catch passbook...")}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Package size={32} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold">{t("No catch landings recorded yet.")}</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{log.itemName}</span>
                      {log.crateReference && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                          {log.crateReference}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar size={11} />
                      <span>{new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      {log.notes && <span>&bull; {log.notes}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-emerald-700 font-mono">
                      +{log.grossKgChange || log.quantityChange} Kg
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {t("Verified Received")}
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

