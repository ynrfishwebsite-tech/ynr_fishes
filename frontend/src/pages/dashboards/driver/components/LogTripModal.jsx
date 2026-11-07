import React, { useState } from 'react';
import { Truck, X } from 'lucide-react';
import { logTrip } from '../../../../api/operations/vehicle';

export default function LogTripModal({
  isOpen,
  onClose,
  assignedVehicle,
  driverName,
  driverPhone,
  onTripCreated
}) {
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    routeTo: '',
    boxesCount: '',
    totalWeightKg: '',
    exportType: 'Local',
    startKm: assignedVehicle?.currentKm || '',
    purpose: 'Fish Supply & Delivery'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!assignedVehicle) return;
    try {
      setIsSubmitting(true);
      const startNum = formData.startKm ? Number(formData.startKm) : (assignedVehicle.currentKm || 0);
      const payload = {
        vehicleId: assignedVehicle._id,
        driverName: driverName,
        driverPhone: driverPhone || assignedVehicle.driverPhone || '',
        customerName: formData.customerName || 'Direct Delivery',
        customerPhone: formData.customerPhone || '',
        customerAddress: formData.customerAddress || '',
        routeFrom: 'Kadapa City Depot',
        routeTo: formData.routeTo || formData.customerAddress || 'Kadapa Local Route',
        boxesCount: Number(formData.boxesCount) || 0,
        totalWeightKg: Number(formData.totalWeightKg) || 0,
        exportType: formData.exportType || 'Local',
        startKm: startNum,
        endKm: startNum,
        status: 'On-Road',
        purpose: formData.purpose || 'Fish Delivery & Supply'
      };

      const res = await logTrip(payload);
      if (res?.success) {
        onTripCreated(res.data);
        onClose();
      }
    } catch (err) {
      console.error('Failed to log new trip:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl border border-[#E8DCCB] shadow-2xl max-w-lg w-full p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E8DCCB] pb-2.5">
          <div className="flex items-center gap-1.5">
            <Truck size={18} className="text-[#ea580c]" />
            <h3 className="font-black text-xs sm:text-sm text-slate-900">Log New Delivery Trip</h3>
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
                Customer / Destination *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hyderabad Seafood Hub"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Contact Phone
              </label>
              <input
                type="tel"
                placeholder="9849313889"
                value={formData.customerPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
              Destination Address
            </label>
            <input
              type="text"
              placeholder="e.g. Market Yard Road, Begumpet"
              value={formData.customerAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
              className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Consignment Type
              </label>
              <select
                value={formData.exportType}
                onChange={(e) => setFormData(prev => ({ ...prev, exportType: e.target.value }))}
                className="w-full px-2 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              >
                <option value="Local">Local Catch</option>
                <option value="DAM">DAM Export</option>
                <option value="General Delivery">General Delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Cargo Boxes
              </label>
              <input
                type="number"
                placeholder="12"
                value={formData.boxesCount}
                onChange={(e) => setFormData(prev => ({ ...prev, boxesCount: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                Start KM
              </label>
              <input
                type="number"
                placeholder="KM"
                value={formData.startKm}
                onChange={(e) => setFormData(prev => ({ ...prev, startKm: e.target.value }))}
                className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-orange-500"
              />
            </div>
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
              {isSubmitting ? 'Saving...' : 'Start Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

