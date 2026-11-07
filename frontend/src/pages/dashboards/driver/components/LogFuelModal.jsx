import React, { useState } from 'react';
import { Fuel, X } from 'lucide-react';
import { logFuel } from '../../../../api/operations/vehicle';

export default function LogFuelModal({
  isOpen,
  onClose,
  assignedVehicle,
  onFuelLogged
}) {
  const [formData, setFormData] = useState({
    odometerKm: assignedVehicle?.currentKm || '',
    litres: '',
    ratePerLitre: '',
    totalAmount: '',
    fuelStation: '',
    paymentMode: 'Cash'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignedVehicle) return;
    try {
      setIsSubmitting(true);
      const odoNum = Number(formData.odometerKm) || assignedVehicle.currentKm || 0;
      const ltrNum = Number(formData.litres) || 0;
      const rateNum = Number(formData.ratePerLitre) || 0;
      const totNum = formData.totalAmount ? Number(formData.totalAmount) : (ltrNum * rateNum);

      const payload = {
        vehicleId: assignedVehicle._id,
        odometerKm: odoNum,
        litres: ltrNum,
        ratePerLitre: rateNum,
        totalAmount: totNum,
        fuelStation: formData.fuelStation || 'Local Bunk',
        paymentMode: formData.paymentMode || 'Cash',
        fuelType: assignedVehicle.fuelType || 'Diesel'
      };

      const res = await logFuel(payload);
      if (res?.success) {
        onFuelLogged(res.data, odoNum);
        onClose();
      }
    } catch (err) {
      console.error('Failed to log fuel:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl border border-[#E8DCCB] shadow-2xl max-w-md w-full p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#E8DCCB] pb-2.5">
          <div className="flex items-center gap-1.5">
            <Fuel size={18} className="text-[#ea580c]" />
            <h3 className="font-black text-xs sm:text-sm text-slate-900">Record Fuel Refill</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Odometer (KM) *
              </label>
              <input
                type="number"
                required
                placeholder="62450"
                value={formData.odometerKm}
                onChange={(e) => setFormData(prev => ({ ...prev, odometerKm: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Litres Filled *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="35.5"
                value={formData.litres}
                onChange={(e) => setFormData(prev => ({ ...prev, litres: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Rate / Litre (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="98.50"
                value={formData.ratePerLitre}
                onChange={(e) => setFormData(prev => ({ ...prev, ratePerLitre: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Total Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="3500"
                value={formData.totalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
              Fuel Station / Bunk Name
            </label>
            <input
              type="text"
              placeholder="e.g. HP Petrol Bunk, Kadapa Bypass"
              value={formData.fuelStation}
              onChange={(e) => setFormData(prev => ({ ...prev, fuelStation: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8DCCB]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#E8DCCB] text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Record Refill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

