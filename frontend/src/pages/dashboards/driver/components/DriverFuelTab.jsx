import React from 'react';
import { Fuel, Plus, Wrench } from 'lucide-react';

export default function DriverFuelTab({
  fuelLogs,
  maintLogs,
  assignedVehicle,
  onOpenLogFuel
}) {
  return (
    <div className="space-y-3 w-full">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs sm:text-sm font-black text-slate-800">
          Fuel & Maintenance Logs ({assignedVehicle?.vehicleNumber || 'Vehicle'})
        </h3>
        <button
          onClick={onOpenLogFuel}
          className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          <Plus size={13} />
          <span>+ Log Refill</span>
        </button>
      </div>

      {fuelLogs.length === 0 ? (
        <div className="py-8 text-center bg-white rounded-xl border border-[#E8DCCB] shadow-2xs w-full">
          <Fuel size={28} className="mx-auto text-slate-300 mb-1.5" />
          <h4 className="text-xs font-black text-slate-800">No Fuel Entries Logged</h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Record your diesel receipts and odometer readings to keep vehicle expense audits up to date.
          </p>
          <button
            onClick={onOpenLogFuel}
            className="mt-2.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <Plus size={12} />
            <span>Record First Refill</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E8DCCB] shadow-2xs overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF0E4] border-b border-[#E8DCCB] text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Odometer</th>
                  <th className="px-3 py-2">Quantity</th>
                  <th className="px-3 py-2">Rate / L</th>
                  <th className="px-3 py-2">Total Amount</th>
                  <th className="px-3 py-2">Fuel Station</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DCCB]/60 text-slate-700 font-medium">
                {fuelLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {new Date(log.date || log.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">
                      {log.odometerKm?.toLocaleString()} KM
                    </td>
                    <td className="px-3 py-2 font-bold text-[#ea580c]">
                      {log.litres} L
                    </td>
                    <td className="px-3 py-2 font-mono">
                      ₹{log.ratePerLitre || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900">
                      ₹{log.totalAmount?.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {log.fuelStation || 'Local Bunk'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

