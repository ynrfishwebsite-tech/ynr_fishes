import React, { useState, useMemo } from 'react';
import { X, User, Upload, ImageIcon, Loader2 } from 'lucide-react';
import SearchableDropdown from '../../common/SearchableDropdown';
import { createSupplier } from '../../../api/operations/operations';

export default function FlashSupplierModal({
  isOpen,
  onClose,
  supplierType = 'Local', // 'Local' | 'DAM' | 'Consumables'
  fleetVehicles = [],
  onSupplierCreated
}) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    companyName: '',
    supplierType: supplierType || 'Local',
    harbor: '',
    city: 'Kadapa',
    address: '',
    contactPerson: '',
    vehicleNumber: '',
    balance: '',
    bankDetails: {
      accountNo: '',
      bankName: '',
      ifsc: '',
      upiId: ''
    },
    notes: '',
    profileImage: ''
  });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync supplierType when modal opens or prop changes
  React.useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        supplierType: supplierType || 'Local'
      }));
      setErrorMsg('');
    }
  }, [isOpen, supplierType]);

  const personRole = useMemo(() => {
    if (formData.supplierType === 'DAM') return 'Contractor / Syndicate';
    if (formData.supplierType === 'Consumables') return 'Supplies Vendor';
    return 'Fisherman / Landing Partner';
  }, [formData.supplierType]);

  const vehicleOptions = useMemo(() => {
    const list = [{ label: '-- None / Type Manually --', value: '' }];
    (fleetVehicles || []).forEach(v => {
      const vNum = (v.vehicleNumber || '').toUpperCase().trim();
      if (!vNum) return;
      const sub = [v.model, v.driverName ? `Driver: ${v.driverName}` : ''].filter(Boolean).join(' • ');
      list.push({
        label: `${vNum}${sub ? ` (${sub})` : ''}`,
        value: vNum,
        raw: v
      });
    });
    return list;
  }, [fleetVehicles]);

  const handleImageFileChange = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = (event) => {
      setFormData(prev => ({ ...prev, profileImage: event.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Full name is required');
      return;
    }

    const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '') : '';
    if (cleanPhone && cleanPhone.length !== 10) {
      setErrorMsg('Phone number must be exactly 10 digits if provided');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        name: formData.name.trim(),
        phone: cleanPhone,
        companyName: formData.companyName.trim(),
        harbor: formData.harbor.trim(),
        city: formData.city.trim(),
        vehicleNumber: (formData.vehicleNumber || '').toUpperCase().trim(),
        balance: Number(formData.balance || 0),
        notes: formData.notes.trim()
      };

      const res = await createSupplier(payload);
      const createdSupplier = res?.data || res || { ...payload, _id: Date.now().toString() };

      if (onSupplierCreated) {
        onSupplierCreated(createdSupplier);
      }

      onClose();
    } catch (err) {
      console.error('Failed to create supplier:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error saving supplier');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 z-[9999] animate-fade-in overflow-y-auto">
      <div className="bg-white border border-[#E8DCCB] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 bg-[#ea580c] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <User size={18} />
            <h3 className="font-black text-sm tracking-wide">
              Add New {personRole}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto text-xs">
          {/* Photo & Basic Details */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center relative overflow-hidden shrink-0 shadow-2xs">
              {formData.profileImage ? (
                <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={24} className="text-orange-400" />
              )}
              <label className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <Upload size={14} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFileChange(e.target.files?.[0])}
                />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <span className="font-bold text-slate-800 text-xs block">Profile Photo</span>
              <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-[11px] cursor-pointer text-slate-700">
                <ImageIcon size={12} />
                <span>{formData.profileImage ? 'Change Photo' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFileChange(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {/* Name & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-800 block mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Prasad Reddy"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 block mb-1">Phone Number (10 digits)</label>
              <input
                type="tel"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                placeholder="9848012345 (Optional)"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
              />
            </div>
          </div>

          {/* Company / Boat / Syndicate & Supplier Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-800 block mb-1">Firm / Boat / Syndicate Name</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="e.g. Sea King Syndicate"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 block mb-1">Supplier Type</label>
              <select
                value={formData.supplierType}
                onChange={(e) => setFormData({ ...formData, supplierType: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none cursor-pointer"
              >
                <option value="Local">Local Harbor Fishermen</option>
                <option value="DAM">Dam Reservoir Syndicate</option>
                <option value="Consumables">Packaging & Depot Supplies</option>
              </select>
            </div>
          </div>

          {/* Harbor / Port & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="font-bold text-slate-800 block mb-1">Harbor / Reservoir / Origin</label>
              <input
                type="text"
                value={formData.harbor}
                onChange={(e) => setFormData({ ...formData, harbor: e.target.value })}
                placeholder="e.g. Mangalore Port, Srisailam Dam"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-800 block mb-1">City / District</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Kadapa"
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold focus:border-[#ea580c] focus:outline-none"
              />
            </div>
          </div>

          {/* Assigned Vehicle */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">Assigned Fleet Vehicle</label>
            <SearchableDropdown
              options={vehicleOptions}
              value={formData.vehicleNumber}
              onChange={(val) => setFormData({ ...formData, vehicleNumber: val })}
              placeholder="Select vehicle from fleet (or type number)..."
              customInputAllowed={true}
            />
          </div>

          {/* Bank Details */}
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
              Banking & Settlement Payout Info
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Bank Name (e.g. SBI, HDFC)"
                value={formData.bankDetails.bankName}
                onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value } })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold"
              />
              <input
                type="text"
                placeholder="Account Number"
                value={formData.bankDetails.accountNo}
                onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountNo: e.target.value } })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono"
              />
              <input
                type="text"
                placeholder="IFSC Code"
                value={formData.bankDetails.ifsc}
                onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, ifsc: e.target.value } })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold uppercase font-mono"
              />
              <input
                type="text"
                placeholder="UPI ID (e.g. name@upi)"
                value={formData.bankDetails.upiId}
                onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, upiId: e.target.value } })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold font-mono"
              />
            </div>
          </div>

          {/* Starting Balance */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">Starting Khata Balance (₹ Payable)</label>
            <input
              type="number"
              min="0"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              placeholder="0"
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 font-bold font-mono text-rose-600 focus:border-[#ea580c] focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">Notes / Terms</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Payment settlement cadence, agreement terms..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:border-[#ea580c] focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-[#c2410c] text-white rounded-xl font-black cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              <span>Save & Select</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
