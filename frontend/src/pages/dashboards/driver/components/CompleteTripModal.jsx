import React, { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { updateTripStatus } from '../../../../api/operations/vehicle';

export default function CompleteTripModal({
  trip,
  onClose,
  assignedVehicle,
  onTripCompleted
}) {
  const [endKm, setEndKm] = useState(assignedVehicle?.currentKm || trip?.startKm || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!trip) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const endKmNum = endKm ? Number(endKm) : (trip.startKm || 0);
      const res = await updateTripStatus(trip._id, {
        status: 'Delivered',
        endKm: endKmNum,
        notes: notes || trip.notes || ''
      });

      if (res?.success) {
        onTripCompleted(res.data, endKmNum);
        onClose();
      }
    } catch (err) {
      console.error('Failed to complete trip:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl border border-[#E8DCCB] shadow-2xl max-w-md w-full p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[#E8DCCB] pb-2.5">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h3 className="font-black text-xs sm:text-sm text-slate-900">Confirm Delivery</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="bg-[#FAF0E4] p-2.5 rounded-lg border border-[#E8DCCB] text-xs space-y-1">
            <div><strong>Destination:</strong> {trip.customerName || trip.routeTo}</div>
            <div><strong>Start KM:</strong> {trip.startKm} KM</div>
            {trip.boxesCount > 0 && <div><strong>Cargo:</strong> {trip.boxesCount} Boxes</div>}
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
              End Odometer Reading (KM) *
            </label>
            <input
              type="number"
              required
              min={trip.startKm || 0}
              placeholder={`Current KM (e.g. ${(trip.startKm || 0) + 15})`}
              value={endKm}
              onChange={(e) => setEndKm(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
              Delivery Notes / Receiver Name
            </label>
            <input
              type="text"
              placeholder="e.g. Handed over to Mr. Rao at dock"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#E8DCCB] rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
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
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              {isSubmitting ? 'Updating...' : 'Confirm Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

