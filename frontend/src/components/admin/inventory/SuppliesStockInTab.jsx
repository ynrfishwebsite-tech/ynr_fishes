import React, { useState, useMemo } from 'react';
import {
  Plus,
  Boxes,
  Package,
  Search,
  X,
  CheckCircle,
  Trash2,
  Phone,
  Truck,
  User,
  MapPin,
  ChevronDown,
  ChevronUp,
  Printer,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import SearchableDropdown from '../../common/SearchableDropdown';
import FlashSupplierModal from '../operations/FlashSupplierModal';

const SuppliesStockInTab = ({
  suppliesForm,
  setSuppliesForm,
  supplyTotalCost,
  supplyBalanceDue,
  handleSupplyStockInSubmit,
  handlePrintSuppliesInvoice,
  isSubmittingSupply,
  supplyCategories = [],
  showAddCategoryInput,
  setShowAddCategoryInput,
  newCategoryName,
  setNewCategoryName,
  isCreatingCategory,
  handleCreateCategory,
  registeredSuppliers = [],
  setRegisteredSuppliers,
  fleetVehicles = [],
  suppliesSupplierOptions = [],
  suppliesVehicleOptions = [],
  formatImageUrl = (url) => url,
  supplyLogs = [],
  suppliesPage,
  setSuppliesPage,
  totalSuppliesPages,
  paginatedSupplyLogs = [],
  SUPPLIES_PER_PAGE = 8
}) => {
  const [suppliesVendorSearch, setSuppliesVendorSearch] = useState('');
  const [isSuppliesManualDetailsOpen, setIsSuppliesManualDetailsOpen] = useState(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);

  const filteredSuppliesVendors = useMemo(() => {
    const query = suppliesVendorSearch.trim().toLowerCase();
    const suppliesOnly = (registeredSuppliers || []).filter(s => {
      const type = (s.supplierType || '').toLowerCase();
      return type === 'consumables' || type === 'supplies' || type === 'all' || !type;
    });
    const pool = suppliesOnly.length > 0 ? suppliesOnly : (registeredSuppliers || []);
    if (!query) return pool;
    return pool.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.companyName || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.vehicleNumber || '').toLowerCase().includes(query) ||
      (s.harbor || s.city || '').toLowerCase().includes(query)
    );
  }, [registeredSuppliers, suppliesVendorSearch]);

  const handleSelectSuppliesVendorCard = (supp) => {
    const assignedVeh = (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supp._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supp.name?.toLowerCase()) ||
      (supp.vehicleNumber && v.vehicleNumber?.toUpperCase() === supp.vehicleNumber.toUpperCase())
    );
    setSuppliesForm(prev => ({
      ...prev,
      supplierId: supp._id,
      supplierName: supp.name || '',
      supplierPhone: supp.phone || assignedVeh?.driverPhone || prev.supplierPhone,
      companyName: supp.companyName || prev.companyName,
      vehicleNumber: supp.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
      harbor: supp.harbor || supp.city || prev.harbor
    }));
  };

  const handleClearSuppliesVendor = () => {
    setSuppliesForm(prev => ({
      ...prev,
      supplierId: '',
      supplierName: '',
      supplierPhone: '',
      companyName: '',
      vehicleNumber: '',
      harbor: ''
    }));
  };

  return (
    <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl px-1.5 py-3.5 sm:p-6 shadow-2xs space-y-4 sm:space-y-5 w-full">
      <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-3 flex-wrap gap-2 px-1 sm:px-0">
        <div>
          <h2 className="text-base font-extrabold text-[#1e293b] flex items-center gap-2 m-0">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center">
              <Boxes size={16} />
            </span>
            <span>Packaging & Depot Supplies Intake</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium m-0">
            Record intake of thermocol boxes, ice blocks, tapes, crates, and depot packaging materials.
          </p>
        </div>
      </div>

      <form onSubmit={handleSupplyStockInSubmit} className="space-y-4">
        {/* 1. Category Hybrid Select & Item Name */}
        <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
              <Package size={14} />
              <span>Consumable Category *</span>
            </label>
            <button
              type="button"
              onClick={() => setShowAddCategoryInput(!showAddCategoryInput)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
            >
              {showAddCategoryInput ? 'Cancel' : '+ Add New Category'}
            </button>
          </div>

          {showAddCategoryInput && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 rounded-xl border border-emerald-300">
              <input
                type="text"
                placeholder="e.g. Foam Sheets, Strapping Rolls, Salt Bags"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 bg-white border border-emerald-400 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                disabled={isCreatingCategory || !newCategoryName.trim()}
                onClick={handleCreateCategory}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isCreatingCategory ? 'Saving...' : 'Save Category'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <SearchableDropdown
                mode="select"
                value={suppliesForm.category}
                onChange={(val) => {
                  if (val === 'ADD_NEW') {
                    setShowAddCategoryInput(true);
                  } else {
                    setSuppliesForm({ ...suppliesForm, category: val });
                  }
                }}
                options={[
                  ...supplyCategories.map(cat => ({ value: cat.name, label: cat.name })),
                  { value: 'ADD_NEW', label: '+ Add Custom Category...', isSpecial: true }
                ]}
                placeholder="-- Choose Category --"
                searchPlaceholder="Search category..."
                accentColor="emerald"
                required
              />
            </div>

            <div>
              <input
                type="text"
                placeholder="Item Name (e.g. 50Kg Thermocol Box, 100Kg Ice Blocks)"
                value={suppliesForm.itemName}
                onChange={(e) => setSuppliesForm({ ...suppliesForm, itemName: e.target.value })}
                required
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Registered Vendor Selection Cards Grid & Search */}
        <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide m-0">
                Packaging & Supplies Vendor Selection
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0 mt-0.5">
                Choose packaging vendor card or search below ({filteredSuppliesVendors.length} Available)
              </p>
            </div>

            {/* Search Bar & Flash Add Vendor Button */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex items-center w-full sm:w-64">
                <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search vendor, shop name, phone..."
                  value={suppliesVendorSearch}
                  onChange={(e) => setSuppliesVendorSearch(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 bg-white border border-[#E8DCCB] rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
                />
                {suppliesVendorSearch && (
                  <button
                    type="button"
                    onClick={() => setSuppliesVendorSearch('')}
                    className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsAddSupplierOpen(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-95"
                title="Add New Packaging & Supplies Vendor"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Add Vendor</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Selected Vendor Badge Row */}
          {suppliesForm.supplierName && (
            <div className="flex items-center justify-between flex-wrap gap-2 p-2 sm:p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-950 truncate">
                  Selected: <span className="font-black text-emerald-900">{suppliesForm.supplierName}</span>
                  {suppliesForm.companyName && <span className="text-slate-600 font-semibold"> ({suppliesForm.companyName})</span>}
                  {suppliesForm.supplierPhone && <span className="font-mono text-slate-700 font-bold"> • {suppliesForm.supplierPhone}</span>}
                  {suppliesForm.vehicleNumber && <span className="font-mono text-slate-700 font-bold"> • {suppliesForm.vehicleNumber}</span>}
                  {suppliesForm.harbor && <span className="text-slate-600"> • {suppliesForm.harbor}</span>}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearSuppliesVendor}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0 ml-auto"
                title="Clear selected vendor"
              >
                <Trash2 size={12} />
                <span>Clear Selection</span>
              </button>
            </div>
          )}

          {/* Grid of Supplies Vendor Cards */}
          {filteredSuppliesVendors.length === 0 ? (
            <div className="p-4 rounded-xl bg-white border border-[#fed7aa] text-center text-xs text-slate-500">
              No matching supplies vendors found. You can clear your search or enter custom vendor details below.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredSuppliesVendors.map((supp) => {
                const isSelected = Boolean(
                  (supp._id && suppliesForm.supplierId === supp._id) ||
                  (supp.name && suppliesForm.supplierName && supp.name.toLowerCase() === suppliesForm.supplierName.toLowerCase())
                );

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
                  <div
                    key={supp._id || supp.name}
                    onClick={() => handleSelectSuppliesVendorCard(supp)}
                    className={`rounded-2xl p-3 sm:p-3.5 border-2 transition-all cursor-pointer relative flex flex-col justify-between group shadow-2xs hover:shadow-md active:scale-[0.99] ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/90 ring-4 ring-emerald-300 shadow-md'
                        : 'border-[#E8DCCB] bg-white hover:border-emerald-500 hover:bg-emerald-50/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-slate-50 border-2 border-[#E8DCCB] group-hover:border-emerald-500 shrink-0 shadow-2xs flex items-center justify-center p-0.5">
                          {supp.profileImage ? (
                            <img
                              src={formatImageUrl(supp.profileImage)}
                              alt={supp.name}
                              className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xl rounded-xl">
                              {supp.name ? supp.name.charAt(0).toUpperCase() : <Boxes size={22} />}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate leading-snug m-0">
                              {supp.name}
                            </h4>
                            <span className="text-[8px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-900 border-emerald-200 uppercase tracking-wider shrink-0">
                              {supp.supplierType || 'Supplies'}
                            </span>
                          </div>
                          {supp.companyName ? (
                            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate m-0 mt-0.5">
                              {supp.companyName}
                            </p>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] text-slate-400 italic m-0 mt-0.5">Packaging Vendor</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-1 bg-[#FAF0E4]/60 p-2 rounded-xl border border-[#fed7aa]/50 text-[10.5px] font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone size={11} className="text-emerald-600 shrink-0" />
                          <span className="text-slate-400 font-normal">Phone:</span>
                          <span className="font-mono font-bold text-slate-800 truncate">{supp.phone || 'No phone'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Truck size={11} className="text-blue-600 shrink-0" />
                          <span className="text-slate-400 font-normal">Vehicle:</span>
                          <span className="font-mono font-bold text-slate-800">{effectiveVeh || 'No vehicle'}</span>
                          {vehDesc && <span className="text-[9.5px] text-slate-500 font-medium">({vehDesc})</span>}
                          {linkedVeh && (
                            <span className="text-[8px] bg-blue-50 text-blue-700 font-bold px-1 py-0.2 rounded border border-blue-200">
                              Fleet Linked
                            </span>
                          )}
                        </div>
                        {(driverName || driverPhone) && (
                          <div className="flex items-center gap-1.5 text-slate-700 flex-wrap text-[10px]">
                            <User size={11} className="text-emerald-600 shrink-0" />
                            <span className="text-slate-400 font-normal">Driver:</span>
                            <span className="font-bold text-slate-800">{driverName || 'Assigned Driver'}</span>
                            {driverPhone && <span className="font-mono text-emerald-700 font-bold">({driverPhone})</span>}
                          </div>
                        )}
                        {(supp.harbor || supp.city) && (
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin size={11} className="text-[#ea580c] shrink-0" />
                            <span className="text-slate-400 font-normal">City/Location:</span>
                            <span className="text-slate-800 truncate">{supp.harbor || supp.city}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      {isSelected ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} /> Selected
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleClearSuppliesVendor(); }}
                            className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[10.5px] font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            title="Clear this vendor"
                          >
                            <Trash2 size={11} className="text-rose-600" />
                            <span>Clear</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-[10.5px] font-bold text-emerald-700 group-hover:text-emerald-900 flex items-center gap-1 ml-auto">
                          Select Vendor →
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible toggle for custom details */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsSuppliesManualDetailsOpen(!isSuppliesManualDetailsOpen)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer select-none"
            >
              <span>{isSuppliesManualDetailsOpen ? 'Hide Manual Details' : 'Edit / Enter Custom Vendor Details'}</span>
              {isSuppliesManualDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isSuppliesManualDetailsOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-[#fed7aa]/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Supplier / Shop Name *
                  </label>
                  <SearchableDropdown
                    mode="combobox"
                    placeholder="e.g. Sri Balaji Ice Factory"
                    value={suppliesForm.supplierName}
                    onChange={(val) => {
                      const regFound = registeredSuppliers.find(s =>
                        s.name?.toLowerCase() === val.toLowerCase() ||
                        s.companyName?.toLowerCase() === val.toLowerCase()
                      );
                      const assignedVeh = fleetVehicles.find(v =>
                        (v.assignedSupplierId && String(v.assignedSupplierId) === String(regFound?._id)) ||
                        (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === val.toLowerCase())
                      );
                      setSuppliesForm(prev => ({
                        ...prev,
                        supplierName: val,
                        supplierId: regFound?._id || '',
                        supplierPhone: regFound?.phone || assignedVeh?.driverPhone || prev.supplierPhone,
                        companyName: regFound?.companyName || prev.companyName,
                        vehicleNumber: regFound?.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
                        harbor: regFound?.harbor || regFound?.city || prev.harbor
                      }));
                    }}
                    onSelect={(raw) => {
                      if (!raw) return;
                      const assignedVeh = fleetVehicles.find(v =>
                        (v.assignedSupplierId && String(v.assignedSupplierId) === String(raw._id)) ||
                        (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === raw.name?.toLowerCase())
                      );
                      setSuppliesForm(prev => ({
                        ...prev,
                        supplierName: raw.name || prev.supplierName,
                        supplierId: raw._id || prev.supplierId,
                        supplierPhone: raw.phone || assignedVeh?.driverPhone || prev.supplierPhone,
                        companyName: raw.companyName || prev.companyName,
                        vehicleNumber: raw.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
                        harbor: raw.harbor || raw.city || prev.harbor
                      }));
                    }}
                    options={suppliesSupplierOptions}
                    accentColor="emerald"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">Phone Number</label>
                    {suppliesForm.supplierPhone && (
                      <span className={`text-[10px] font-mono font-bold ${
                        suppliesForm.supplierPhone.length === 10 ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {suppliesForm.supplierPhone.length}/10 digits
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={suppliesForm.supplierPhone}
                    onChange={(e) => setSuppliesForm({ ...suppliesForm, supplierPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  {suppliesForm.supplierPhone && suppliesForm.supplierPhone.length > 0 && suppliesForm.supplierPhone.length < 10 && (
                    <p className="text-[10px] text-amber-600 mt-1 font-semibold">Enter 10-digit mobile number</p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Company / Shop Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Kadapa Packaging"
                    value={suppliesForm.companyName}
                    onChange={(e) => setSuppliesForm({ ...suppliesForm, companyName: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Number</label>
                  <SearchableDropdown
                    mode="combobox"
                    placeholder="e.g. AP 04 TX 4821"
                    value={suppliesForm.vehicleNumber}
                    onChange={(val) => {
                      const upper = (val || '').toUpperCase();
                      const matchOpt = suppliesVehicleOptions.find(v => v.value.toUpperCase() === upper);
                      if (matchOpt?.raw) {
                        const r = matchOpt.raw;
                        setSuppliesForm(prev => ({
                          ...prev,
                          vehicleNumber: upper,
                          supplierName: r.supplierName || prev.supplierName,
                          supplierPhone: r.driverPhone || r.supplierPhone || prev.supplierPhone,
                          companyName: r.companyName || r.vehicleName || prev.companyName,
                          harbor: r.harbor || prev.harbor
                        }));
                      } else {
                        setSuppliesForm(prev => ({ ...prev, vehicleNumber: upper }));
                      }
                    }}
                    onSelect={(raw) => {
                      if (!raw) return;
                      setSuppliesForm(prev => ({
                        ...prev,
                        vehicleNumber: raw.vehicleNumber || prev.vehicleNumber,
                        supplierName: raw.supplierName || prev.supplierName,
                        supplierPhone: raw.driverPhone || raw.supplierPhone || prev.supplierPhone,
                        companyName: raw.companyName || raw.vehicleName || prev.companyName,
                        harbor: raw.harbor || prev.harbor
                      }));
                    }}
                    options={suppliesVehicleOptions}
                    accentColor="emerald"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">City / Origin Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Kadapa Depot"
                    value={suppliesForm.harbor}
                    onChange={(e) => setSuppliesForm({ ...suppliesForm, harbor: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Quantity, Units & Pricing */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Quantity Received *</label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              placeholder="e.g. 50"
              value={suppliesForm.quantity}
              onChange={(e) => setSuppliesForm({ ...suppliesForm, quantity: e.target.value })}
              className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Packaging Unit</label>
            <SearchableDropdown
              mode="select"
              searchable={false}
              value={suppliesForm.unit}
              onChange={(val) => setSuppliesForm({ ...suppliesForm, unit: val })}
              options={[
                { value: 'Pcs', label: 'Pcs (Pieces)' },
                { value: 'Boxes', label: 'Boxes' },
                { value: 'Rolls', label: 'Rolls (Tape / Straps)' },
                { value: 'Kg', label: 'Kg (Kilograms)' },
                { value: 'Blocks', label: 'Blocks (Ice)' },
                { value: 'Bags', label: 'Bags (Salt / Chemicals)' },
                { value: 'Bundles', label: 'Bundles' }
              ]}
              accentColor="emerald"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Unit Rate (₹ per Unit)</label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 250"
              value={suppliesForm.unitRate}
              onChange={(e) => setSuppliesForm({ ...suppliesForm, unitRate: e.target.value })}
              className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Value (₹)</label>
            <div className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-emerald-800 flex items-center justify-between">
              <span>Total:</span>
              <span>₹{supplyTotalCost.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* 4. Payment Settlement & Notes */}
        <div className="bg-[#FAF0E4]/60 p-4 rounded-xl border border-[#fed7aa]/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Paid Amount (₹)</label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                value={suppliesForm.paidAmount}
                onChange={(e) => setSuppliesForm({ ...suppliesForm, paidAmount: e.target.value })}
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Balance Due</label>
              <div className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold border ${supplyBalanceDue > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                ₹{supplyBalanceDue.toLocaleString('en-IN')}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
              <SearchableDropdown
                mode="select"
                searchable={false}
                value={suppliesForm.paymentMode}
                onChange={(val) => setSuppliesForm({ ...suppliesForm, paymentMode: val })}
                options={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'UPI', label: 'UPI / GPay / PhonePe' },
                  { value: 'Bank Transfer', label: 'Bank Transfer (NEFT/RTGS)' },
                  { value: 'Credit', label: 'Credit (Pay Later)' }
                ]}
                accentColor="emerald"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Bill / Invoice Reference</label>
              <input
                type="text"
                placeholder="e.g. Bill #4812, DC-90"
                value={suppliesForm.notes}
                onChange={(e) => setSuppliesForm({ ...suppliesForm, notes: e.target.value })}
                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={handlePrintSuppliesInvoice}
            className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Print A4 Supplies Inward Invoice"
          >
            <Printer size={14} />
          </button>

          <button
            type="submit"
            disabled={isSubmittingSupply}
            className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle size={14} />
            <span>{isSubmittingSupply ? 'Recording...' : 'Confirm Supplies Stock-In'}</span>
          </button>
        </div>
      </form>

      {/* 5. Recent Consumables Stock-In Logs Table */}
      <div className="border-t border-[#fed7aa]/60 pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5 m-0">
            <History size={15} className="text-emerald-700" />
            <span>Recent Supplies & Packaging Intake Logs ({supplyLogs.length})</span>
          </h3>
          {supplyLogs.length > 0 && (
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600">
                Page {suppliesPage} of {totalSuppliesPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={suppliesPage <= 1}
                  onClick={() => setSuppliesPage(p => Math.max(1, p - 1))}
                  className="p-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-700"
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  disabled={suppliesPage >= totalSuppliesPages}
                  onClick={() => setSuppliesPage(p => Math.min(totalSuppliesPages, p + 1))}
                  className="p-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-700"
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#E8DCCB] rounded-xl overflow-hidden shadow-2xs w-full">
          {supplyLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No packaging intake records logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-[#FAF0E4] border-b border-[#fed7aa] text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[12%]">Date</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[14%]">Category</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[20%]">Item Name</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[16%]">Supplier</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Quantity</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Unit Rate</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[14%]">Total</th>
                    <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-center w-[10%]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#fed7aa]/40 font-medium">
                  {paginatedSupplyLogs.map(log => (
                    <tr key={log._id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-[11px] sm:text-xs text-slate-600 font-mono whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 font-bold text-slate-900 text-xs sm:text-sm">
                        {log.itemName}
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-slate-700 text-xs sm:text-sm">
                        {log.supplierName || '—'}
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {log.quantity} {log.unit}
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                        ₹{log.unitRate?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                        ₹{log.totalCost?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                          log.paymentStatus === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.paymentStatus === 'Partial'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {log.paymentStatus || 'Paid'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {supplyLogs.length > 0 && (
            <div className="p-3 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <span>Showing {(suppliesPage - 1) * SUPPLIES_PER_PAGE + 1} to {Math.min(supplyLogs.length, suppliesPage * SUPPLIES_PER_PAGE)} of {supplyLogs.length} intake logs</span>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={suppliesPage <= 1}
                  onClick={() => setSuppliesPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                >
                  Previous
                </button>
                <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black font-mono text-emerald-900">
                  {suppliesPage} / {totalSuppliesPages}
                </span>
                <button
                  type="button"
                  disabled={suppliesPage >= totalSuppliesPages}
                  onClick={() => setSuppliesPage(p => Math.min(totalSuppliesPages, p + 1))}
                  className="px-3 py-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Flash Vendor Add Modal */}
      <FlashSupplierModal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        supplierType="Consumables"
        fleetVehicles={fleetVehicles}
        onSupplierCreated={(newSupp) => {
          setRegisteredSuppliers?.(prev => [newSupp, ...(prev || [])]);
          handleSelectSuppliesVendorCard(newSupp);
          setIsAddSupplierOpen(false);
        }}
      />
    </div>
  );
};

export default SuppliesStockInTab;

