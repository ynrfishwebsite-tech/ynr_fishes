import React from 'react';
import { Printer } from 'lucide-react';

export default function SupplierKhataTab({
  displayName,
  stockLogs,
  totalGrossValue,
  totalSettledAmount,
  khataBalance
}) {
  return (
    <div className="space-y-2.5 w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-xs sm:text-sm font-black text-slate-800">
            Khata Statement of Accounts — {displayName}
          </h3>
          <p className="text-[10px] sm:text-[11px] text-slate-500">
            Certified digital passbook of catch supply credits and depot disbursements.
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-2.5 py-1 rounded-lg bg-white border border-[#E8DCCB] text-slate-700 hover:bg-[#FAF0E4] text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
        >
          <Printer size={12} />
          <span>Print Statement</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-[#E8DCCB] shadow-2xs overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF0E4] border-b border-[#E8DCCB] text-slate-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Voucher / Invoice</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Credit (+₹)</th>
                <th className="px-3 py-2 text-right">Debit (-₹)</th>
                <th className="px-3 py-2 text-right">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DCCB]/60 text-slate-700 font-medium">
              {stockLogs.map((log, idx) => {
                const weightKg = Number(log.grossKgChange || log.quantityChange || 0);
                const rate = Number(log.rate || log.price || 0);
                const credit = Number(log.netPayable || log.grossValue || (rate * weightKg));
                const inv = log.invoiceNo || `GIN-LOC-${new Date(log.createdAt).getTime().toString().slice(-6)}`;

                return (
                  <tr key={log._id || idx} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">
                      #{inv}
                    </td>
                    <td className="px-3 py-2">
                      {log.itemName} ({weightKg.toFixed(1)} KG @ ₹{rate}/KG)
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-right">
                      +₹{credit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-400 text-right">
                      —
                    </td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 text-right">
                      ₹{credit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-[#FAF0E4] border-t-2 border-[#E8DCCB] font-bold text-xs">
              <tr>
                <td colSpan={3} className="px-3 py-2.5 text-slate-800 uppercase font-black text-[11px]">
                  Total Ledger Summary
                </td>
                <td className="px-3 py-2.5 font-mono font-black text-emerald-800 text-right">
                  +₹{totalGrossValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2.5 font-mono font-bold text-slate-600 text-right">
                  -₹{totalSettledAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2.5 font-mono font-black text-[#ea580c] text-right text-xs sm:text-sm">
                  ₹{khataBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

