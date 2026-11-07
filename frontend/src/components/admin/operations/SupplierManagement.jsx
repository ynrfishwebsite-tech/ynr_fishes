import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Search, Plus, Phone, Truck, Anchor, MapPin, Building,
  CreditCard, FileText, Edit2, Trash2, X, Check, Loader2, MessageSquare,
  RefreshCw, ChevronLeft, ChevronRight, Upload, Image as ImageIcon,
  Crop, User
} from 'lucide-react';
import BackButton from '../common/BackButton';
import SearchableDropdown from '../../common/SearchableDropdown';
import { useLanguage } from '../../../context/LanguageContext';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../../api/operations/operations';
import { getVehicles, updateVehicle } from '../../../api/operations/vehicle';
import Toast from '../system/Toast';
import ImageCropperModal from '../crm/ImageCropperModal';

export default function SupplierManagement({ onGoBack }) {
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState([]);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('All'); // 'All' | 'Local' | 'DAM' | 'Consumables'
  const [toast, setToast] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadFileInfo, setUploadFileInfo] = useState(null);

  // Image Cropper State
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperRawSrc, setCropperRawSrc] = useState(null);
  const [cropperPendingInfo, setCropperPendingInfo] = useState(null);

  const initialFormState = {
    profileImage: '',
    name: '',
    companyName: '',
    phone: '',
    supplierType: 'Local',
    vehicleNumber: '',
    harbor: '',
    city: '',
    address: '',
    contactPerson: '',
    bankDetails: {
      accountNo: '',
      bankName: '',
      ifsc: '',
      upiId: ''
    },
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchSuppliersList = useCallback(async () => {
    try {
      setLoading(true);
      const [data, vehData] = await Promise.all([
        getSuppliers(),
        getVehicles().catch(() => [])
      ]);
      setSuppliers(data || []);
      setFleetVehicles(vehData || []);
    } catch (err) {
      console.error('Failed to load suppliers or vehicles:', err);
      setToast({ message: 'Failed to fetch suppliers directory', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliersList();
  }, [fetchSuppliersList]);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedTypeFilter]);

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormData(initialFormState);
    setUploadFileInfo(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (supplier) => {
    setEditingSupplier(supplier);

    // Auto-fetch and pre-select assigned vehicle from fleetVehicles if not already on supplier
    const linkedVeh = (fleetVehicles || []).find(v => 
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supplier._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supplier.name?.toLowerCase()) ||
      (supplier.vehicleNumber && v.vehicleNumber?.toUpperCase() === supplier.vehicleNumber.toUpperCase())
    );
    const resolvedVehicle = supplier.vehicleNumber || linkedVeh?.vehicleNumber || '';

    setFormData({
      profileImage: supplier.profileImage || '',
      name: supplier.name || '',
      companyName: supplier.companyName || '',
      phone: supplier.phone || '',
      supplierType: supplier.supplierType || 'Local',
      vehicleNumber: resolvedVehicle,
      harbor: supplier.harbor || '',
      city: supplier.city || '',
      address: supplier.address || '',
      contactPerson: supplier.contactPerson || '',
      bankDetails: {
        accountNo: supplier.bankDetails?.accountNo || '',
        bankName: supplier.bankDetails?.bankName || '',
        ifsc: supplier.bankDetails?.ifsc || '',
        upiId: supplier.bankDetails?.upiId || ''
      },
      notes: supplier.notes || ''
    });
    setUploadFileInfo(supplier.profileImage ? { name: 'Profile Photo', extension: 'img', size: 'Saved' } : null);
    setIsModalOpen(true);
  };

  // Image Upload with 5MB validation & Image Cropper trigger
  const handleImageUpload = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image size must be less than or equal to 5MB', type: 'error' });
      return;
    }
    const extension = file.name.split('.').pop();
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    const fileInfo = {
      name: file.name,
      extension: extension,
      size: `${sizeInMb} MB`
    };

    const reader = new FileReader();
    reader.onloadend = (event) => {
      setCropperRawSrc(event.target.result);
      setCropperPendingInfo(fileInfo);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSupplier = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: 'Supplier name is required', type: 'error' });
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      setToast({ message: 'Phone number must be exactly 10 digits (e.g. 9848012345)', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        phone: cleanPhone
      };

      let savedSupplier = null;
      if (editingSupplier) {
        const res = await updateSupplier(editingSupplier._id, payload);
        savedSupplier = res?.data || { _id: editingSupplier._id };
        setToast({ message: `Supplier "${formData.name}" updated successfully!`, type: 'success' });
      } else {
        const res = await createSupplier(payload);
        savedSupplier = res?.data || null;
        setToast({ message: `Supplier "${formData.name}" added successfully!`, type: 'success' });
      }

      // Sync vehicle assignment in fleet if a vehicleNumber was chosen
      const upperVeh = (formData.vehicleNumber || '').trim().toUpperCase();
      if (upperVeh && fleetVehicles.length > 0) {
        const matchedVeh = fleetVehicles.find(v => (v.vehicleNumber || '').toUpperCase() === upperVeh);
        if (matchedVeh) {
          await updateVehicle(matchedVeh._id, {
            assignedSupplierId: savedSupplier?._id || editingSupplier?._id || null,
            assignedSupplierName: formData.name.trim()
          }).catch(e => console.warn('Vehicle sync warning:', e.message));
        }
      }

      setIsModalOpen(false);
      fetchSuppliersList();
    } catch (err) {
      console.error('Error saving supplier:', err);
      setToast({ message: err.response?.data?.message || 'Error saving supplier record', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate supplier "${name}"?`)) return;
    try {
      await deleteSupplier(id);
      setToast({ message: `Supplier "${name}" deactivated successfully`, type: 'success' });
      fetchSuppliersList();
    } catch (err) {
      setToast({ message: 'Failed to deactivate supplier', type: 'error' });
    }
  };

  // Filtered Suppliers List
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const matchesType = selectedTypeFilter === 'All' || s.supplierType === selectedTypeFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesType;
      return matchesType && (
        s.name?.toLowerCase().includes(q) ||
        s.companyName?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.harbor?.toLowerCase().includes(q) ||
        s.vehicleNumber?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q)
      );
    });
  }, [suppliers, searchQuery, selectedTypeFilter]);

  // Paginated Suppliers List
  const totalPages = Math.ceil(filteredSuppliers.length / PER_PAGE) || 1;
  const paginatedSuppliers = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filteredSuppliers.slice(start, start + PER_PAGE);
  }, [filteredSuppliers, currentPage]);

  const vehicleOptions = useMemo(() => {
    return (fleetVehicles || []).map(v => {
      const vNum = (v.vehicleNumber || '').toUpperCase().trim();
      const isAssigned = Boolean(v.assignedSupplierName || v.assignedSupplierId);
      const isCurrentSupplier = editingSupplier && (
        (v.assignedSupplierId && String(v.assignedSupplierId) === String(editingSupplier._id)) ||
        (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === editingSupplier.name?.toLowerCase())
      );

      let badgeText = 'Available';
      let badgeColor = 'emerald';

      if (isAssigned) {
        if (isCurrentSupplier) {
          badgeText = 'Assigned (This Supplier)';
          badgeColor = 'blue';
        } else {
          badgeText = `Taken: ${v.assignedSupplierName || 'Supplier'}`;
          badgeColor = 'amber';
        }
      } else if (v.status && v.status !== 'Available') {
        badgeText = v.status;
        badgeColor = 'slate';
      }

      const sub = [
        isAssigned ? `Assigned to: ${v.assignedSupplierName}` : 'Status: Free / Unassigned',
        v.driverName ? `Driver: ${v.driverName}` : '',
        v.driverPhone ? `Ph: ${v.driverPhone}` : '',
        v.operationalMode ? `Channel: ${v.operationalMode}` : ''
      ].filter(Boolean).join(' | ');

      return {
        value: vNum,
        label: `${vNum} (${v.vehicleName || v.vehicleType || 'Fleet'})`,
        subtitle: sub,
        badge: badgeText,
        badgeColor: badgeColor,
        raw: v,
        isAssigned,
        assignedSupplierName: v.assignedSupplierName
      };
    });
  }, [fleetVehicles, editingSupplier]);

  const typePills = [
    { id: 'All', label: 'All Suppliers', count: suppliers.length },
    { id: 'Local', label: 'Local Suppliers', count: suppliers.filter(s => s.supplierType === 'Local').length },
    { id: 'DAM', label: 'Dam Suppliers', count: suppliers.filter(s => s.supplierType === 'DAM').length },
    { id: 'Consumables', label: 'Packaging & Supplies', count: suppliers.filter(s => s.supplierType === 'Consumables').length }
  ];

  return (
    <div className="w-full min-h-full flex flex-col bg-[#F7EFE2] text-slate-800 pb-20">
      {/* Top Header Bar */}
      <div className="bg-[#FDFBF7] border-b border-[#E8DCCB] px-3 py-2.5 sm:px-4 sm:py-3 shadow-2xs flex items-center justify-between gap-2 sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          {onGoBack && <BackButton onClick={onGoBack} label={t("Back")} />}
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-orange-100 text-[#ea580c] border border-orange-200 flex items-center justify-center shrink-0 shadow-xs">
            <Users size={17} strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-black text-slate-900 tracking-tight leading-none m-0 truncate">
                {t("Supplier Directory")}
              </h1>
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                {suppliers.length} Active
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0 mt-0.5 truncate hidden sm:block">
              Manage fish catch suppliers, dam syndicates, and packaging vendors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={fetchSuppliersList}
            className="p-1.5 sm:p-2 bg-white border border-[#E8DCCB] hover:border-slate-300 rounded-xl text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            title="Refresh List"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1 bg-[#ea580c] hover:bg-[#c2410c] text-white px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus size={14} strokeWidth={2.8} />
            <span className="hidden sm:inline">{t("Add Supplier")}</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Main Content Area - Full Width */}
      <div className="px-1.5 py-3 sm:p-5 w-full space-y-4">
        {/* Search, Filter & Top-Right Pagination Row */}
        <div className="bg-[#FDFBF7] p-3 rounded-2xl border border-[#E8DCCB] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by supplier name, company, phone, harbor, or vehicle..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#E8DCCB] rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500 shadow-2xs"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {typePills.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedTypeFilter(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  selectedTypeFilter === p.id
                    ? 'bg-[#ea580c] text-white shadow-xs'
                    : 'bg-white border border-[#E8DCCB] text-slate-600 hover:border-slate-300'
                }`}
              >
                {p.label} {p.count > 0 && <span className="text-[10px] opacity-80">({p.count})</span>}
              </button>
            ))}
          </div>

          {/* Top-Right Pagination Controls */}
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-[#fed7aa]/40">
            <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
              {filteredSuppliers.length} suppliers • Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Suppliers Grid - Full Width Responsive Grid */}
        {loading && suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <Loader2 size={28} className="animate-spin text-[#ea580c] mb-2" />
            <span className="text-xs font-bold">Loading suppliers directory...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-10 text-center flex flex-col items-center justify-center">
            <Users size={36} className="text-slate-300 mb-2" />
            <h3 className="text-sm font-black text-slate-800 m-0">No suppliers found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {searchQuery ? 'Try matching another name, phone, or harbor.' : 'Add your first Local, Dam, or Packaging supplier.'}
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-3.5 inline-flex items-center gap-1.5 bg-[#ea580c] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
            >
              <Plus size={14} />
              <span>Add New Supplier</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {paginatedSuppliers.map((supp) => {
              const typeColor =
                supp.supplierType === 'DAM' ? 'bg-blue-100 text-blue-900 border-blue-200' :
                supp.supplierType === 'Consumables' ? 'bg-purple-100 text-purple-900 border-purple-200' :
                'bg-emerald-100 text-emerald-900 border-emerald-200';

              return (
                <div
                  key={supp._id}
                  className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-3 sm:p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group w-full"
                >
                  <div className="space-y-2.5 sm:space-y-3">
                    {/* Header: Avatar, Name & Type Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {supp.profileImage ? (
                          <img
                            src={supp.profileImage}
                            alt={supp.name}
                            className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-cover border border-[#E8DCCB] shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-orange-100 text-[#ea580c] font-black text-xs sm:text-sm flex items-center justify-center shrink-0 border border-orange-200">
                            {supp.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate leading-snug m-0">
                            {supp.name}
                          </h3>
                          {supp.companyName ? (
                            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate m-0">
                              {supp.companyName}
                            </p>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] text-slate-400 italic m-0">Independent</p>
                          )}
                        </div>
                      </div>

                      <span className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 sm:px-2 py-0.5 rounded-full border ${typeColor} uppercase tracking-wider shrink-0`}>
                        {supp.supplierType || 'Local'}
                      </span>
                    </div>

                    {/* Quick Badges: Phone, Vehicle, Driver, Harbor, Address */}
                    <div className="grid grid-cols-1 gap-2 text-[10.5px] sm:text-[11px] font-semibold text-slate-600 bg-[#FAF0E4]/60 p-2.5 sm:p-3 rounded-xl border border-[#fed7aa]/50">
                      <div className="flex items-center gap-1.5 truncate">
                        <Phone size={12} className="text-[#ea580c] shrink-0" />
                        <span className="text-slate-400 font-normal">Phone:</span>
                        <a href={`tel:${supp.phone}`} className="hover:underline font-mono font-bold text-slate-800 truncate">
                          {supp.phone || 'No phone'}
                        </a>
                      </div>

                      {(() => {
                        const linkedVeh = (fleetVehicles || []).find(v => 
                          (v.assignedSupplierId && String(v.assignedSupplierId) === String(supp._id)) ||
                          (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supp.name?.toLowerCase()) ||
                          (supp.vehicleNumber && v.vehicleNumber?.toUpperCase() === supp.vehicleNumber.toUpperCase())
                        );
                        const effectiveVeh = supp.vehicleNumber || linkedVeh?.vehicleNumber;
                        const vehDesc = linkedVeh?.modelName || linkedVeh?.vehicleName || linkedVeh?.vehicleType;
                        const driverName = linkedVeh?.driverName;
                        const driverPhone = linkedVeh?.driverPhone;

                        return (
                          <>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Truck size={12} className={`shrink-0 ${effectiveVeh ? 'text-blue-600' : 'text-slate-400'}`} />
                              <span className="text-slate-400 font-normal">Vehicle:</span>
                              <span className={`font-mono ${effectiveVeh ? 'text-slate-800 font-bold' : 'text-slate-400'}`}>
                                {effectiveVeh || 'No vehicle'}
                              </span>
                              {vehDesc && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  ({vehDesc})
                                </span>
                              )}
                              {linkedVeh && (
                                <span className="text-[8.5px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">
                                  Fleet Linked
                                </span>
                              )}
                            </div>

                            {(driverName || driverPhone) && (
                              <div className="flex items-center gap-1.5 text-slate-700 flex-wrap">
                                <User size={12} className="text-emerald-600 shrink-0" />
                                <span className="text-slate-400 font-normal">Driver:</span>
                                <span className="font-bold text-slate-800">
                                  {driverName || 'Assigned Driver'}
                                </span>
                                {driverPhone && (
                                  <a href={`tel:${driverPhone}`} className="text-[10px] font-mono text-emerald-700 font-bold hover:underline bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    {driverPhone}
                                  </a>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      <div className="flex items-center gap-1.5 truncate">
                        <Anchor size={12} className="text-sky-600 shrink-0" />
                        <span className="text-slate-400 font-normal">Port/Dam:</span>
                        <span className="truncate text-slate-800 font-medium">
                          {supp.harbor || supp.city || 'Depot Direct'}
                        </span>
                      </div>

                      {supp.address && (
                        <div className="flex items-center gap-1.5 truncate text-slate-500 text-[10px] sm:text-[10.5px]">
                          <MapPin size={11} className="text-slate-400 shrink-0" />
                          <span className="truncate">{supp.address}</span>
                        </div>
                      )}
                    </div>

                    {/* Bank / UPI / Notes Info */}
                    {(supp.bankDetails?.accountNo || supp.bankDetails?.upiId || supp.bankDetails?.bankName || supp.notes) && (
                      <div className="text-[9.5px] sm:text-[10.5px] space-y-1 text-slate-500 pt-1 border-t border-[#fed7aa]/30">
                        {supp.bankDetails?.bankName && (
                          <div className="flex items-center gap-1 font-semibold text-slate-700 truncate">
                            <Building size={10} className="text-slate-400 shrink-0" />
                            <span className="truncate">{supp.bankDetails.bankName} {supp.bankDetails.accountNo ? `• ${supp.bankDetails.accountNo}` : ''}</span>
                          </div>
                        )}
                        {supp.bankDetails?.upiId && (
                          <div className="flex items-center gap-1 font-mono text-emerald-700 font-bold truncate">
                            <CreditCard size={10} className="shrink-0" />
                            <span className="truncate">UPI: {supp.bankDetails.upiId}</span>
                          </div>
                        )}
                        {supp.notes && (
                          <p className="line-clamp-2 text-slate-600 italic m-0 pt-0.5 text-[9.5px] sm:text-[10.5px]">
                            "{supp.notes}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="border-t border-[#E8DCCB] pt-2 mt-2 sm:mt-3 flex items-center justify-between gap-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      {supp.phone && (
                        <>
                          <a
                            href={`https://wa.me/91${supp.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[9.5px] sm:text-[10.5px] font-bold transition-colors cursor-pointer"
                          >
                            <MessageSquare size={10} />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </a>
                          <a
                            href={`tel:${supp.phone}`}
                            className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-[9.5px] sm:text-[10.5px] font-bold transition-colors cursor-pointer"
                          >
                            <Phone size={10} />
                            <span className="hidden sm:inline">Call</span>
                          </a>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(supp)}
                        className="p-1 sm:p-1.5 hover:bg-amber-100 text-amber-800 rounded-lg transition-colors cursor-pointer"
                        title="Edit Supplier"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(supp._id, supp.name)}
                        className="p-1 sm:p-1.5 hover:bg-rose-100 text-rose-700 rounded-lg transition-colors cursor-pointer"
                        title="Deactivate Supplier"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supplier Add / Edit Modal (Capped Height & Non-Overflowing Mobile Layout) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden">
            {/* Fixed Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-3.5 shrink-0 bg-white">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 m-0">
                  {editingSupplier ? 'Edit Supplier Profile' : 'Add New Supplier'}
                </h2>
                <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium m-0 mt-0.5">
                  Supplier contact details, transport vehicle, and settlement accounts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form id="supplier-form" onSubmit={handleSaveSupplier} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Row 1: Name, Company, Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Supplier Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Fisherman"
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Company / Firm Name
                  </label>
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="e.g. Sea King Syndicate"
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Supplier Type *
                  </label>
                  <SearchableDropdown
                    mode="select"
                    searchable={false}
                    value={formData.supplierType}
                    onChange={(val) => setFormData({ ...formData, supplierType: val })}
                    options={[
                      { value: 'Local', label: 'Local Supplier (Harbor Catch)' },
                      { value: 'DAM', label: 'Dam Supplier (Reservoir Catch)' },
                      { value: 'Consumables', label: 'Packaging & Supplies (Boxes / Ice / Tape)' },
                      { value: 'All', label: 'All Operations' }
                    ]}
                    accentColor="orange"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Phone (10 digits validation), Vehicle Number, Harbor */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-800 block">
                      Phone Number *
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formData.phone ? `${formData.phone.length}/10` : '10 digits'}
                    </span>
                  </div>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: digits });
                    }}
                    placeholder="10-digit mobile number"
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  {formData.phone && formData.phone.length !== 10 && (
                    <span className="text-[10px] font-semibold text-rose-600 block">
                      Must be exactly 10 digits ({10 - formData.phone.length} remaining)
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Vehicle Number (Optional)
                  </label>
                  <SearchableDropdown
                    mode="combobox"
                    value={formData.vehicleNumber}
                    onChange={(val) => setFormData({ ...formData, vehicleNumber: (val || '').toUpperCase() })}
                    onSelect={(raw) => {
                      if (!raw) return;
                      setFormData(prev => ({
                        ...prev,
                        vehicleNumber: (raw.vehicleNumber || '').toUpperCase()
                      }));
                    }}
                    options={vehicleOptions}
                    placeholder="e.g. AP 04 TX 4821"
                    accentColor="orange"
                  />
                  {(() => {
                    const matchedVeh = (fleetVehicles || []).find(v => v.vehicleNumber?.toUpperCase() === (formData.vehicleNumber || '').trim().toUpperCase());
                    if (matchedVeh && (matchedVeh.assignedSupplierName || matchedVeh.assignedSupplierId)) {
                      const isCurrent = editingSupplier && (
                        (matchedVeh.assignedSupplierId && String(matchedVeh.assignedSupplierId) === String(editingSupplier._id)) ||
                        (matchedVeh.assignedSupplierName && matchedVeh.assignedSupplierName.toLowerCase() === editingSupplier.name?.toLowerCase())
                      );
                      if (!isCurrent) {
                        return (
                          <div className="mt-1 flex items-start gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px] font-semibold leading-tight">
                            <span className="shrink-0 text-amber-600 font-bold">⚠️</span>
                            <span>Currently assigned to <strong>{matchedVeh.assignedSupplierName}</strong>. Saving will reassign this vehicle to this supplier.</span>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Harbor / Dam Location
                  </label>
                  <input
                    type="text"
                    value={formData.harbor}
                    onChange={(e) => setFormData({ ...formData, harbor: e.target.value })}
                    placeholder="e.g. Mangalore Port, Srisailam"
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Row 3: Profile Image with Upload & 5MB Validation + Full Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Profile Image / Logo (Max 5MB)
                  </label>
                  {!uploadFileInfo && !formData.profileImage ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.profileImage}
                        onChange={(e) => setFormData({ ...formData, profileImage: e.target.value })}
                        className="flex-1 bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500"
                        placeholder="Paste image URL or upload..."
                      />
                      <label className="bg-orange-50 hover:bg-orange-100 text-[#ea580c] px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs border border-orange-200 shrink-0 font-bold transition-all shadow-2xs">
                        <Upload size={13} />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) handleImageUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 bg-orange-50/60 border border-orange-200 rounded-xl gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {formData.profileImage ? (
                          <img src={formData.profileImage} alt="Preview" className="w-9 h-9 rounded-lg object-cover border border-orange-300 shrink-0" />
                        ) : null}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 truncate block">
                            {uploadFileInfo?.name || 'Supplier Image'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {uploadFileInfo ? `.${uploadFileInfo.extension} • ${uploadFileInfo.size}` : 'Uploaded'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                       
                        <label className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors">
                          <span>Change</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) handleImageUpload(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadFileInfo(null);
                            setFormData({ ...formData, profileImage: '' });
                          }}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-800 block">
                    Full Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Street, City, District"
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Row 4: Bank Details Accordion / Sub-card */}
              <div className="bg-[#FAF0E4]/60 p-3 rounded-xl border border-[#fed7aa]/60 space-y-2">
                <span className="text-[11px] font-black uppercase text-amber-900 block tracking-wide">
                  Bank Settlement Details (Optional)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bankDetails.bankName}
                      onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, bankName: e.target.value } })}
                      placeholder="e.g. SBI"
                      className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">Account Number</label>
                    <input
                      type="text"
                      value={formData.bankDetails.accountNo}
                      onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, accountNo: e.target.value } })}
                      placeholder="Account No"
                      className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">IFSC Code</label>
                    <input
                      type="text"
                      value={formData.bankDetails.ifsc}
                      onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, ifsc: e.target.value.toUpperCase() } })}
                      placeholder="IFSC"
                      className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-800 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-600 block mb-0.5">UPI ID</label>
                    <input
                      type="text"
                      value={formData.bankDetails.upiId}
                      onChange={(e) => setFormData({ ...formData, bankDetails: { ...formData.bankDetails, upiId: e.target.value } })}
                      placeholder="name@upi"
                      className="w-full bg-white border border-[#E8DCCB] rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-800"
                    />
                  </div>
                </div>
              </div>

              {/* Row 5: Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800 block">
                  Notes / Payment Terms
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Delivers every Monday & Thursday morning catch; Net payment on delivery."
                  className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
            </form>

            {/* Fixed Footer */}
            <div className="flex items-center justify-end gap-2.5 px-4 py-3 sm:px-6 sm:py-3 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="supplier-form"
                disabled={isSubmitting || (formData.phone && formData.phone.length !== 10)}
                className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingSupplier ? 'Save Changes' : 'Create Supplier'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal (Reusing Shared CRM ImageCropperModal) */}
      {isCropperOpen && (
        <ImageCropperModal
          title={t('Crop Supplier Photo / Logo')}
          imageSrc={cropperRawSrc}
          onCropComplete={(croppedDataUrl) => {
            setFormData(prev => ({ ...prev, profileImage: croppedDataUrl }));
            if (cropperPendingInfo) {
              setUploadFileInfo(cropperPendingInfo);
            }
            setIsCropperOpen(false);
            setToast({ message: 'Profile photo cropped successfully!', type: 'success' });
          }}
          onClose={() => setIsCropperOpen(false)}
        />
      )}

      {/* Toast Alert */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
