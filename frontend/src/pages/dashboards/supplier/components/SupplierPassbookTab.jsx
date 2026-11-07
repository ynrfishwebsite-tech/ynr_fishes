import React, { useState, useMemo } from 'react';
import { Package, Search, FileText, RefreshCw } from 'lucide-react';

export default function SupplierPassbookTab({
  stockLogs,
  loading,
  onOpenInvoice
}) {
  const [filterMode, setFilterMode] = useState('All'); // 'All' | 'Local' | 'DAM'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLots = useMemo(() => {
    return stockLogs.filter(lot => {
      if (filterMode === 'Local' && lot.intakeMode === 'dam') return false;
      if (filterMode === 'DAM' && lot.intakeMode !== 'dam') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const species = (lot.itemName || '').toLowerCase();
        const inv = (lot.invoiceNo || '').toLowerCase();
        const veh = (lot.vehicleNumber || '').toLowerCase();
        return species.includes(q) || inv.includes(q) || veh.includes(q);
      }
      return true;
    });
  }, [stockLogs, filterMode, searchQuery]);

  return (
    <div className="space-y-2.5 w-full">
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap w-full">
        <div className="flex items-center gap-1">
          {['All', 'Local', 'DAM'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterMode(f)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === f
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              {f === 'All' ? 'All Inward Lots' : f === 'Local' ? 'Local Catch' : 'DAM Consignments'}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[180px] flex-1 sm:flex-initial">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search species, invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Lots Feed */}
      {loading && stockLogs.length === 0 ? (
        <div className="py-12 text-center text-slate-400 w-full">
          <RefreshCw size={22} className="animate-spin mx-auto text-sky-600 mb-2" />
          <p className="text-xs font-bold">Loading catch inward passbook...</p>
        </div>
      ) : filteredLots.length === 0 ? (
        <div className="py-8 px-4 text-center bg-white rounded-xl border border-[#E8DCCB] shadow-2xs w-full">
          <Package size={28} className="mx-auto text-slate-300 mb-1.5" />
          <h3 className="text-xs sm:text-sm font-black text-slate-800">No Inward Catch Lots Found</h3>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
            {searchQuery || filterMode !== 'All'
              ? 'No catch lots matched your active filter or search criteria.'
              : 'When fresh catch consignments are inwarded and weighed at Kadapa Depot, verified slips will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
          {filteredLots.map((lot) => {
            const isDam = lot.intakeMode === 'dam';
            const weightKg = Number(lot.grossKgChange || lot.quantityChange || 0);
            const rate = Number(lot.rate || lot.price || 0);
            const payable = Number(lot.netPayable || lot.grossValue || (rate * weightKg));
            const invNo = lot.invoiceNo || `GIN-${isDam ? 'DAM' : 'LOC'}-${new Date(lot.createdAt).getTime().toString().slice(-6)}`;

            return (
              <div
                key={lot._id}
                className="bg-white rounded-xl border border-[#E8DCCB] p-3 shadow-2xs space-y-2.5 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="font-mono font-black text-[10px] bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                      #{invNo}
                    </span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                      isDam ? 'bg-sky-100 text-sky-800 border-sky-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {isDam ? 'DAM Consignment' : 'Local Catch'}
                    </span>
                  </div>

                  {/* Variety & Weight Cardlet */}
                  <div className="bg-[#FAF0E4] p-2.5 rounded-lg border border-[#E8DCCB] space-y-1.5 mt-2">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          Fish Variety / Species
                        </div>
                        <div className="text-xs sm:text-sm font-black text-slate-900 leading-snug truncate">
                          {lot.itemName || 'Fresh Seafood Catch'}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-[9px] font-bold text-slate-500 uppercase">Weight</div>
                        <div className="text-xs sm:text-sm font-black font-mono text-slate-900">
                          {weightKg.toFixed(1)} <span className="text-[10px] font-sans">KG</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E8DCCB]/60 text-slate-600">
                      <span>
                        {lot.totalBoxes || lot.boxes ? `${lot.totalBoxes || lot.boxes} Boxes` : 'Loose Batch'}
                      </span>
                      {rate > 0 && (
                        <span className="font-mono font-bold text-slate-800">
                          Rate: ₹{rate}/KG
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E8DCCB]/60 text-xs font-black">
                      <span className="text-slate-600 text-[10px] uppercase font-bold">Payable Amount</span>
                      <span className="text-[#ea580c] font-mono text-xs sm:text-sm">
                        ₹{payable.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1.5">
                    <span>{new Date(lot.createdAt).toLocaleDateString()} {new Date(lot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {lot.vehicleNumber && <span>Veh: {lot.vehicleNumber}</span>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenInvoice(lot)}
                  className="w-full py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                >
                  <FileText size={13} />
                  <span>View / Print Weighment Slip</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

