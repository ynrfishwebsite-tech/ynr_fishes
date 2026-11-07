import React from 'react';
import { Scale, IndianRupee, CheckCircle2, CreditCard } from 'lucide-react';

export default function SupplierMetricsGrid({
  totalWeightKg,
  totalGrossValue,
  totalSettledAmount,
  khataBalance,
  totalBoxesSupplied,
  verifiedLotsCount,
  harborName
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
      {/* 1. Total Catch Supplied */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Total Catch Supplied
          </span>
          <Scale size={14} className="text-sky-600" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
            {totalWeightKg.toFixed(1)} <span className="text-xs font-sans font-bold text-slate-500">KG</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            {totalBoxesSupplied > 0 ? `${totalBoxesSupplied} Boxes Inward` : `${verifiedLotsCount} Consignment Batches`}
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
            Origin: {harborName || 'Mangalore Harbor'}
          </span>
        </div>
      </div>

      {/* 2. Gross Consignment Value */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Gross Billing Value
          </span>
          <IndianRupee size={14} className="text-amber-500" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
            ₹{totalGrossValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            Total seafood value delivered
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
            {verifiedLotsCount} Verified Lots
          </span>
        </div>
      </div>

      {/* 3. Paid / Disbursed */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Paid / Disbursed
          </span>
          <CheckCircle2 size={14} className="text-emerald-500" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-emerald-700">
            ₹{totalSettledAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            Bank & UPI disbursements
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
            Verified by Accounts
          </span>
        </div>
      </div>

      {/* 4. Khata Balance */}
      <div className="bg-white rounded-xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            Khata Balance
          </span>
          <CreditCard size={14} className="text-purple-500" />
        </div>
        <div className="my-1">
          <div className="font-mono font-black text-lg sm:text-xl text-slate-900">
            ₹{khataBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
            {khataBalance > 0 ? 'Pending payout balance' : 'Accounts settled in full'}
          </div>
        </div>
        <div className="pt-1 border-t border-[#E8DCCB]/60">
          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md border ${
            khataBalance > 0
              ? 'bg-purple-50 text-purple-700 border-purple-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {khataBalance > 0 ? 'Pending Payout' : 'Zero Balance (Clear)'}
          </span>
        </div>
      </div>
    </div>
  );
}

