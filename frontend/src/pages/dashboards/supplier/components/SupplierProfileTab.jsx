import React, { useState } from 'react';
import { Building, Copy, Check } from 'lucide-react';

export default function SupplierProfileTab({
  supplierProfile,
  displayName,
  supplierPhone,
  linkedVehicle
}) {
  const [copiedUpi, setCopiedUpi] = useState(false);

  const handleCopyUpi = (upiId) => {
    if (!upiId) return;
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      <div className="bg-white rounded-2xl border border-[#E8DCCB] p-4 sm:p-5 shadow-xs space-y-3 w-full">
        <div className="flex items-center gap-2.5 border-b border-[#E8DCCB] pb-2.5">
          <Building size={18} className="text-sky-600" />
          <div>
            <h3 className="font-black text-xs sm:text-sm text-slate-900">
              Registered Supplier Business Profile
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Official enterprise credentials on file at Kadapa Central Depot
            </p>
          </div>
        </div>

        {/* Profile Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="bg-[#FAF0E4] p-2.5 rounded-xl border border-[#E8DCCB]">
            <div className="text-[9px] font-bold text-slate-500 uppercase">Company / Firm Name</div>
            <div className="font-bold text-slate-900 mt-0.5">{displayName}</div>
          </div>

          <div className="bg-[#FAF0E4] p-2.5 rounded-xl border border-[#E8DCCB]">
            <div className="text-[9px] font-bold text-slate-500 uppercase">Primary Contact Phone</div>
            <div className="font-bold text-slate-900 mt-0.5 font-mono">{supplierProfile?.phone || supplierPhone || '—'}</div>
          </div>

          <div className="bg-[#FAF0E4] p-2.5 rounded-xl border border-[#E8DCCB]">
            <div className="text-[9px] font-bold text-slate-500 uppercase">Harbor / Dock Origin</div>
            <div className="font-bold text-slate-900 mt-0.5">{supplierProfile?.harbor || 'Mangalore Harbor'}</div>
          </div>

          <div className="bg-[#FAF0E4] p-2.5 rounded-xl border border-[#E8DCCB]">
            <div className="text-[9px] font-bold text-slate-500 uppercase">Assigned Fleet Vehicle</div>
            <div className="font-bold text-slate-900 mt-0.5 font-mono">
              {linkedVehicle?.vehicleNumber || supplierProfile?.vehicleNumber || 'Unassigned'}
            </div>
          </div>
        </div>

        {/* Bank & Settlement Card */}
        <div className="pt-1">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
            Settlement & Banking Information
          </h4>
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2 text-xs text-sky-950">
            {supplierProfile?.bankDetails?.upiId ? (
              <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-sky-200">
                <div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Direct UPI ID</div>
                  <div className="font-mono font-bold text-sky-900 text-xs sm:text-sm mt-0.5">
                    {supplierProfile.bankDetails.upiId}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyUpi(supplierProfile.bankDetails.upiId)}
                  className="px-2 py-1 rounded-md bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                >
                  {copiedUpi ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy UPI'}</span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic">
                No direct UPI ID on file. Settlements are processed via Bank NEFT/RTGS.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">Account No:</span>{' '}
                <span className="font-mono font-bold">{supplierProfile?.bankDetails?.accountNo || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">IFSC Code:</span>{' '}
                <span className="font-mono font-bold">{supplierProfile?.bankDetails?.ifsc || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Bank Name:</span>{' '}
                <span className="font-bold">{supplierProfile?.bankDetails?.bankName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Status:</span>{' '}
                <span className="font-bold text-emerald-700">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

