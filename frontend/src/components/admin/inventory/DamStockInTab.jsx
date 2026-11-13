import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Filter,
  Check,
  Search,
  X,
  CheckCircle,
  Trash2,
  User,
  Phone,
  Truck,
  Anchor,
  ChevronDown,
  ChevronUp,
  Plus,
  Lock,
  Unlock,
  Printer,
  Calculator,
  Calendar,
  CalendarPlus,
  ArrowRight,
  CreditCard,
  Landmark,
  FileText,
  PieChart,
  Clock,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import SearchableDropdown from '../../common/SearchableDropdown';
import FishIntakeOrbitalDial from './FishIntakeOrbitalDial';
import {
  splitKgPerBoxParts,
  buildUpdatedRowsWithKpb,
  getFishGradeOptions,
  calcItemWeightKg,
  formatDateGroupLabel,
  incrementIsoDay,
  groupStockInItemsByDate
} from './stockInHelpers';

const DamStockInTab = ({
  damStockInForm,
  setDamStockInForm,
  damTotals,
  submitting,
  handleDamStockInSubmit,
  handlePrintDamInvoice,
  handleAddDamCustomCategory,
  handleRemoveDamCustomCategory,
  masterFishList = [],
  fishList = [],
  fishOptions = [],
  registeredSuppliers = [],
  fleetVehicles = [],
  crmCustomers = [],
  damContractorOptions = [],
  damVehicleOptions = [],
  formatImageUrl = (url) => url,
  handleAddDamLotFromDial
}) => {
  const [damSelectorMode, setDamSelectorMode] = useState('ring');
  const [damSpeciesFilter, setDamSpeciesFilter] = useState('all');
  const [damWeighMode, setDamWeighMode] = useState('kg'); // 'box' | 'kg' (Default: kg)
  const [calcRowIdx, setCalcRowIdx] = useState(null);
  const [calcExpression, setCalcExpression] = useState('');
  const itemsTableRef = useRef(null);
  const prevItemsCountRef = useRef(damStockInForm.tallyItems.length);

  // Auto-scroll to newly added row on smaller screens
  useEffect(() => {
    if (damStockInForm.tallyItems.length > prevItemsCountRef.current) {
      if (typeof window !== 'undefined' && window.innerWidth < 1280) {
        setTimeout(() => {
          itemsTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 120);
      }
    }
    prevItemsCountRef.current = damStockInForm.tallyItems.length;
  }, [damStockInForm.tallyItems.length]);

  // Safe Calculator helper for Scale Weights (e.g. 16+5+10+15.5)
  const evaluateCalcSum = (expr) => {
    if (!expr || !expr.trim()) return null;
    const cleaned = expr.replace(/,/g, '+').replace(/\s+/g, '+').replace(/\++/g, '+');
    if (!/^[0-9.+\- ]+$/.test(cleaned)) return null;
    try {
      const parts = cleaned.split('+').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
      if (parts.length === 0) return null;
      const total = parts.reduce((a, b) => a + b, 0);
      if (isNaN(total) || total < 0) return null;
      const rounded = Number(total.toFixed(3));
      const wholeKg = Math.floor(rounded);
      const remGm = Math.round((rounded - wholeKg) * 1000);
      return { total: rounded, wholeKg, remGm };
    } catch (_) {
      return null;
    }
  };

  const handleApplyCalc = (idx) => {
    const parsed = evaluateCalcSum(calcExpression);
    if (parsed) {
      const updated = [...damStockInForm.tallyItems];
      updated[idx].kg = String(parsed.wholeKg);
      updated[idx].grams = parsed.remGm > 0 ? String(parsed.remGm) : '0';
      const curKpb = Number(updated[idx].kgPerBox || 1);
      if (parsed.total > 0 && (!updated[idx].boxes || updated[idx].boxes === '0')) {
        updated[idx].boxes = String(Math.round(parsed.total / curKpb));
      }
      setDamStockInForm({ ...damStockInForm, tallyItems: updated });
      setCalcRowIdx(null);
      setCalcExpression('');
    }
  };

  // Group items by date for multi-date / multi-item intake
  const dateGroups = useMemo(() => {
    return groupStockInItemsByDate(damStockInForm.tallyItems);
  }, [damStockInForm.tallyItems]);

  // Update date for all items in a date group
  const handleUpdateGroupDate = (oldDateKey, newDateVal) => {
    if (!newDateVal) return;
    const updated = damStockInForm.tallyItems.map(row => {
      const rowDate = row.date || new Date().toISOString().slice(0, 16);
      if (rowDate === oldDateKey) {
        return { ...row, date: newDateVal };
      }
      return row;
    });
    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
  };

  // Add a new fish row under a specific date
  const handleAddRowToDate = (dateKey) => {
    const newRow = {
      id: Date.now() + Math.random(),
      menuItemId: '',
      itemName: '',
      sizeGrade: 'medium',
      sizeBracket: 'Medium',
      weightOption: '1 - 4 Kg',
      boxes: '',
      kgPerBox: 1,
      kg: '',
      grams: '',
      price: '',
      date: dateKey,
      weighMode: damWeighMode
    };

    const items = [...damStockInForm.tallyItems];
    let insertIdx = -1;
    for (let i = items.length - 1; i >= 0; i--) {
      const rDate = items[i].date || new Date().toISOString().slice(0, 16);
      if (rDate === dateKey) {
        insertIdx = i + 1;
        break;
      }
    }
    if (insertIdx !== -1) {
      items.splice(insertIdx, 0, newRow);
    } else {
      items.push(newRow);
    }
    setDamStockInForm({ ...damStockInForm, tallyItems: items });
  };

  // Advance to Next Day: automatically increments date by +1 day (preserving AM/PM time) and adds a row
  const handleNextDay = () => {
    const lastItem = damStockInForm.tallyItems[damStockInForm.tallyItems.length - 1];
    const curDate = lastItem?.date || new Date().toISOString().slice(0, 16);
    const nextDate = incrementIsoDay(curDate);
    const newRow = {
      id: Date.now(),
      menuItemId: '',
      itemName: '',
      sizeGrade: 'medium',
      sizeBracket: 'Medium',
      weightOption: '1 - 4 Kg',
      boxes: '',
      kgPerBox: 1,
      kg: '',
      grams: '',
      price: '',
      date: nextDate,
      weighMode: damWeighMode
    };
    setDamStockInForm({
      ...damStockInForm,
      tallyItems: [...damStockInForm.tallyItems, newRow]
    });
  };

  // Preview label for the next day button
  const nextDayPreview = useMemo(() => {
    const lastItem = damStockInForm.tallyItems[damStockInForm.tallyItems.length - 1];
    const curDate = lastItem?.date || new Date().toISOString().slice(0, 16);
    const nextDate = incrementIsoDay(curDate);
    const lbl = formatDateGroupLabel(nextDate);
    return lbl.dateFormatted;
  }, [damStockInForm.tallyItems]);

  // Delete entire date group
  const handleDeleteDateGroup = (dateKey) => {
    const remaining = damStockInForm.tallyItems.filter(r => (r.date || new Date().toISOString().slice(0, 16)) !== dateKey);
    if (remaining.length === 0) {
      setDamStockInForm({
        ...damStockInForm,
        tallyItems: [{
          id: Date.now(),
          menuItemId: '',
          itemName: '',
          sizeGrade: 'medium',
          sizeBracket: 'Medium',
          weightOption: '1 - 4 Kg',
          boxes: '',
          kgPerBox: 1,
          kg: '',
          grams: '',
          price: '',
          date: new Date().toISOString().slice(0, 16),
          weighMode: damWeighMode
        }]
      });
    } else {
      setDamStockInForm({ ...damStockInForm, tallyItems: remaining });
    }
  };

  // Overall Grand Totals across all dates
  const grandTotals = useMemo(() => {
    let totalKg = 0;
    let totalBoxes = 0;
    let totalGross = 0;
    damStockInForm.tallyItems.forEach(r => {
      const w = calcItemWeightKg(r);
      const rate = Number(r.price || 0);
      totalKg += w;
      totalBoxes += Number(r.boxes || 0);
      totalGross += w * rate;
    });
    const totalKgInt = Math.floor(totalKg);
    const totalGmInt = Math.round((totalKg - totalKgInt) * 1000);
    return {
      totalKg: Number(totalKg.toFixed(3)),
      totalKgInt,
      totalGmInt,
      totalBoxes,
      totalGross: Number(totalGross.toFixed(2)),
      datesCount: dateGroups.length,
      itemsCount: damStockInForm.tallyItems.filter(r => r.itemName || r.menuItemId || r.kg).length || damStockInForm.tallyItems.length
    };
  }, [damStockInForm.tallyItems, dateGroups]);
  const [showDamSpeciesMenu, setShowDamSpeciesMenu] = useState(false);
  const [damSpeciesMenuCoords, setDamSpeciesMenuCoords] = useState({ top: 0, left: 0 });
  const damSpeciesBtnRef = useRef(null);
  const damSpeciesMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showDamSpeciesMenu &&
        damSpeciesMenuRef.current &&
        !damSpeciesMenuRef.current.contains(e.target) &&
        damSpeciesBtnRef.current &&
        !damSpeciesBtnRef.current.contains(e.target)
      ) {
        setShowDamSpeciesMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDamSpeciesMenu]);

  const handleToggleDamSpeciesMenu = () => {
    if (damSpeciesBtnRef.current) {
      const rect = damSpeciesBtnRef.current.getBoundingClientRect();
      setDamSpeciesMenuCoords({
        top: rect.bottom + window.scrollY + 4,
        left: Math.max(10, rect.right + window.scrollX - 160)
      });
    }
    setShowDamSpeciesMenu(prev => !prev);
  };

  const [damSupplierSearch, setDamSupplierSearch] = useState('');
  const [isDamManualDetailsOpen, setIsDamManualDetailsOpen] = useState(false);

  const filteredDamContractors = useMemo(() => {
    const query = damSupplierSearch.trim().toLowerCase();
    const damOnly = (registeredSuppliers || []).filter(s => {
      const type = (s.supplierType || '').toUpperCase();
      return type === 'DAM' || type === 'ALL';
    });
    const pool = damOnly.length > 0 ? damOnly : (registeredSuppliers || []);
    if (!query) return pool;
    return pool.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.companyName || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.vehicleNumber || '').toLowerCase().includes(query) ||
      (s.harbor || s.city || '').toLowerCase().includes(query)
    );
  }, [registeredSuppliers, damSupplierSearch]);

  const handleSelectDamContractorCard = (supp) => {
    const assignedVeh = (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supp._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supp.name?.toLowerCase()) ||
      (supp.vehicleNumber && v.vehicleNumber?.toUpperCase() === supp.vehicleNumber.toUpperCase())
    );
    setDamStockInForm(prev => ({
      ...prev,
      contractorId: supp._id,
      contractorName: supp.name || '',
      contractorPhone: supp.phone || assignedVeh?.driverPhone || prev.contractorPhone,
      companyName: supp.companyName || prev.companyName,
      vehicleNumber: supp.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
      harbor: supp.harbor || supp.city || prev.harbor,
      contractorCity: supp.city || prev.contractorCity
    }));
  };

  const handleClearDamContractor = () => {
    setDamStockInForm(prev => ({
      ...prev,
      contractorId: '',
      contractorName: '',
      contractorPhone: '',
      companyName: '',
      vehicleNumber: '',
      harbor: '',
      contractorCity: ''
    }));
  };

  return (
    <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl sm:rounded-2xl p-0.5 sm:p-1.5 md:p-2 shadow-2xs space-y-2 sm:space-y-2.5 w-full">
      <div className="flex items-center justify-between border-b border-[#fed7aa]/60 pb-1.5 px-0.5 xl:hidden">
        <div>
          <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide m-0">
            Dam Catch Unloading
          </h2>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 font-medium m-0 hidden sm:block">
            Record multi-variety fish shipments received from dam syndicates and reservoir contractors.
          </p>
        </div>
      </div>

      <form onSubmit={handleDamStockInSubmit} className="space-y-2 sm:space-y-3">
        {/* 1. Consignment Fish Varieties Section (3D Ring Selector + Lots Table) - DISPLAYED FIRST */}
        <div className="border border-[#fed7aa] rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="p-1.5 sm:p-2 xl:py-1 xl:px-2.5 bg-[#FAF0E4] border-b border-[#fed7aa] flex items-center justify-between gap-1 sm:gap-1.5 flex-nowrap">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wide truncate">
                <span className="sm:hidden">Fish ({damStockInForm.tallyItems.filter(it => it.itemName).length})</span>
                <span className="hidden sm:inline">Consignment Fish Varieties ({damStockInForm.tallyItems.filter(it => it.itemName).length})</span>
              </span>

              {/* View Mode Toggle: 3D vs Table */}
              <div className="inline-flex items-center p-0.5 bg-white rounded-md border border-[#fed7aa] shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => setDamSelectorMode('ring')}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    damSelectorMode === 'ring'
                      ? 'bg-blue-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  3D
                </button>
                <button
                  type="button"
                  onClick={() => setDamSelectorMode('table')}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    damSelectorMode === 'table'
                      ? 'bg-slate-800 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Table
                </button>
              </div>

              {/* Weigh Mode Toggle: Box-based vs KG-based */}
              <div className="inline-flex items-center p-0.5 bg-white rounded-md border border-[#fed7aa] shadow-2xs shrink-0" title="Weighing mode for new rows">
                <button
                  type="button"
                  onClick={() => setDamWeighMode('box')}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    damWeighMode === 'box'
                      ? 'bg-amber-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📦 Box
                </button>
                <button
                  type="button"
                  onClick={() => setDamWeighMode('kg')}
                  className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer ${
                    damWeighMode === 'kg'
                      ? 'bg-teal-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⚖️ KG
                </button>
              </div>

            </div>

            {/* Right: Species Filter Pill */}
            <div className="relative flex items-center shrink-0">
              <button
                ref={damSpeciesBtnRef}
                type="button"
                onClick={handleToggleDamSpeciesMenu}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  damSpeciesFilter !== 'all'
                    ? 'bg-blue-100 text-blue-700 border border-blue-500 ring-1 ring-blue-200 font-black'
                    : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-blue-50'
                }`}
                title="Filter by Species"
              >
                <span className="uppercase text-[9.5px] sm:text-[10px] font-black tracking-wider">
                  {damSpeciesFilter === 'all' ? 'Species' : damSpeciesFilter}
                </span>
                <Filter size={11} className="text-blue-600 stroke-[2.5]" />
              </button>

              {/* Species Popover Menu rendered via Portal */}
              {showDamSpeciesMenu && typeof document !== 'undefined' && createPortal(
                <div
                  ref={damSpeciesMenuRef}
                  style={{
                    position: 'fixed',
                    top: `${damSpeciesMenuCoords.top}px`,
                    left: `${damSpeciesMenuCoords.left}px`,
                    zIndex: 99999
                  }}
                  className="bg-white/98 backdrop-blur-md border border-blue-300 rounded-2xl shadow-2xl p-1.5 min-w-[145px] animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="text-[9.5px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider border-b border-blue-100 mb-1">
                    Select Species
                  </div>
                  {[
                    { key: 'all', label: 'All Species' },
                    { key: 'fish', label: 'Fish' },
                    { key: 'prawn', label: 'Prawns' },
                    { key: 'crab', label: 'Crabs' }
                  ].map((sp) => {
                    const isSelected = damSpeciesFilter === sp.key;
                    return (
                      <button
                        key={sp.key}
                        type="button"
                        onClick={() => {
                          setDamSpeciesFilter(sp.key);
                          setShowDamSpeciesMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white font-black shadow-xs'
                            : 'text-slate-700 hover:bg-blue-50'
                        }`}
                      >
                        <span>{sp.label}</span>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Desktop Split View: Ring LEFT + Table RIGHT | Mobile/Tablet: Stacked View */}
          <div className={damSelectorMode === 'ring' ? 'xl:flex xl:items-start xl:gap-0' : ''}>
            {/* 3D Ring Dial Mode for Dam Catch (LEFT on desktop) */}
            {damSelectorMode === 'ring' && (
              <div className="xl:w-[380px] 2xl:w-[410px] xl:shrink-0 xl:border-r border-b xl:border-b-0 border-[#fed7aa]/60 p-1.5 sm:p-2 bg-gradient-to-b from-blue-50/60 via-white to-indigo-50/30">
                <FishIntakeOrbitalDial
                  items={masterFishList.length > 0 ? masterFishList : fishList}
                  onAddFishLot={handleAddDamLotFromDial}
                  mode="dam"
                  speciesTypeFilter={damSpeciesFilter}
                  onSpeciesTypeFilterChange={setDamSpeciesFilter}
                />
              </div>
            )}

            {/* Table Area (RIGHT on desktop) */}
            <div ref={itemsTableRef} className="flex-1 min-w-0 p-1 sm:p-1.5 space-y-2">
              {dateGroups.map((group, gIdx) => {
                const dateKey = group.dateKey;
                const colSpanBoxes = damWeighMode === 'box' ? 2 : 0;

                return (
                  <div key={dateKey || gIdx} className="border border-blue-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    {/* ── Date Group Header Bar ── */}
                    <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-blue-50/80 border-b border-blue-200 px-2 py-1 flex flex-col gap-0.5">
                      {/* Single Row: Date Picker | Subtotal | +Add | Delete */}
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg px-1.5 py-0.5 shadow-2xs shrink-0">
                          <Calendar size={12} className="text-blue-600 shrink-0" />
                          <input
                            type="datetime-local"
                            value={dateKey}
                            onChange={(e) => handleUpdateGroupDate(dateKey, e.target.value)}
                            className="w-[148px] text-[11px] font-mono font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer tracking-tight shrink-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-calendar-picker-indicator]:ml-0.5"
                            title="Click to edit date and time"
                          />
                        </div>

                        {/* Subtotal badge */}
                        <div className="flex items-center gap-1 bg-blue-100/90 border border-blue-300 rounded-lg px-1.5 py-0.5 text-[11px] font-mono ml-auto shrink-0">
                          <span className="font-black text-blue-950">
                            {group.subtotalKgInt} Kg{group.subtotalGmInt > 0 ? ` ${group.subtotalGmInt} Gm` : ''}
                          </span>
                          <span className="text-blue-400">•</span>
                          <span className="font-bold text-emerald-800">₹{group.subtotalValue.toLocaleString('en-IN')}</span>
                        </div>

                        {/* + Add button */}
                        <button
                          type="button"
                          onClick={() => handleAddRowToDate(dateKey)}
                          className="h-6 w-6 bg-white hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
                          title="Add another fish variety for this date"
                        >
                          <Plus size={12} />
                        </button>

                        {dateGroups.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDateGroup(dateKey)}
                            className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Delete this entire date group"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>

                      {/* Second line: fullLabel + Items count — always visible */}
                      <div className="flex items-center gap-1.5 flex-nowrap">
                        <span className="text-[10px] font-bold text-slate-600 truncate flex-1">
                          {group.label.fullLabel}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className="text-[10px] font-bold text-slate-500">Items:</span>
                          <span className="font-mono font-black text-[10px] text-blue-900">{group.items.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* ── Mobile Layout (< md): 100% visible in single view with ZERO horizontal scroll ── */}
                    <div className="md:hidden divide-y divide-blue-100 p-1.5 space-y-1.5">
                      {group.items.map(({ item: row, originalIdx: idx }) => {
                        let rowKg = 0;
                        const b = Number(row.boxes || 0);
                        const kpb = Number(row.kgPerBox || 1);
                        if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                          rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
                        } else if (b > 0 && kpb > 0) {
                          rowKg = Number((b * kpb).toFixed(3));
                        }
                        const rowTotal = Number((rowKg * Number(row.price || 0)).toFixed(2));

                        const selFish = fishList.find(f => f._id === row.menuItemId);
                        const gradeOptions = getFishGradeOptions(selFish);
                        const activeGradeKey = row.sizeGrade || (row.sizeBracket ? row.sizeBracket.toLowerCase() : 'medium');
                        const currentGrade = gradeOptions.find(g => g.key === activeGradeKey) || gradeOptions[0];

                        return (
                          <div key={row.id || idx} className="p-1.5 bg-white border border-blue-100 rounded-xl space-y-1 shadow-2xs">
                            {/* Row 1: Index + Fish Variety (Full Width, No Truncation!) + Delete */}
                            <div className="flex items-center gap-1">
                              <span className="w-5 text-center font-mono font-bold text-slate-400 text-xs shrink-0">{idx + 1}</span>
                              <div className="flex-1 min-w-0">
                                <SearchableDropdown
                                  mode="select"
                                  value={row.menuItemId}
                                  onChange={(selId, selOption) => {
                                    const sel = selOption?.raw || fishList.find(f => f._id === selId);
                                    const gOpts = getFishGradeOptions(sel);
                                    const defG = gOpts.find(g => g.key === 'medium') || gOpts[0];
                                    const itemKpb = Number(sel?.boxPackingKg || 1);
                                    const updated = [...damStockInForm.tallyItems];
                                    const curBoxes = Number(updated[idx].boxes || 0);
                                    let autoKg = updated[idx].kg;
                                    let autoGm = updated[idx].grams;
                                    if (curBoxes > 0) {
                                      const tot = curBoxes * itemKpb;
                                      const wKg = Math.floor(tot);
                                      const remG = Math.round((tot - wKg) * 1000);
                                      autoKg = String(wKg);
                                      autoGm = remG > 0 ? String(remG) : '0';
                                    }
                                    updated[idx] = {
                                      ...updated[idx],
                                      menuItemId: selId,
                                      itemName: sel?.name || '',
                                      sizeGrade: defG?.key || 'medium',
                                      sizeBracket: defG?.label || 'Medium',
                                      weightOption: defG?.range || '1 - 4 Kg',
                                      price: defG?.rate ? String(defG.rate) : (sel?.purchasePrice ? String(sel.purchasePrice) : updated[idx].price),
                                      kgPerBox: itemKpb,
                                      kgPerBoxKg: undefined,
                                      kgPerBoxGrams: undefined,
                                      kg: autoKg,
                                      grams: autoGm
                                    };
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  options={fishOptions}
                                  placeholder="-- Variety / Species --"
                                  searchPlaceholder="Search fish species..."
                                  className="w-full"
                                  inputClassName="!h-8 !py-0 !rounded-lg !text-xs font-semibold flex items-center"
                                  minDropdownWidth={260}
                                  accentColor="blue"
                                  required
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  if (damStockInForm.tallyItems.length > 1) {
                                    setDamStockInForm({
                                      ...damStockInForm,
                                      tallyItems: damStockInForm.tallyItems.filter((_, i) => i !== idx)
                                    });
                                  } else {
                                    const now = new Date().toISOString().slice(0, 16);
                                    setDamStockInForm({
                                      ...damStockInForm,
                                      tallyItems: [{ id: Date.now(), menuItemId: '', itemName: '', sizeGrade: 'medium', sizeBracket: 'Medium', weightOption: '1 - 4 Kg', boxes: '', kgPerBox: 1, kg: '', grams: '', price: '', date: now, weighMode: damWeighMode }]
                                    });
                                  }
                                }}
                                className="h-8 w-7 flex items-center justify-center text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer transition-colors shrink-0"
                                title="Remove item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            {/* Row 2: Grade Dropdown (Generous Width!) + Weights + Rate + Row Total */}
                            <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-dashed border-blue-100 text-xs">
                              <div className="flex-1 min-w-[100px] max-w-[125px] shrink-0">
                                {!row.menuItemId ? (
                                  <div className="h-7.5 flex items-center px-2 border border-dashed border-blue-200 rounded-lg bg-slate-50 text-[10.5px] text-slate-400 italic">
                                    Grade
                                  </div>
                                ) : (
                                  <select
                                    value={currentGrade?.key || 'medium'}
                                    onChange={(e) => {
                                      const chosenGrade = gradeOptions.find(g => g.key === e.target.value);
                                      const updated = [...damStockInForm.tallyItems];
                                      updated[idx] = {
                                        ...updated[idx],
                                        sizeGrade: chosenGrade?.key || 'medium',
                                        sizeBracket: chosenGrade?.label || 'Medium',
                                        weightOption: chosenGrade?.range || '1 - 4 Kg',
                                        price: chosenGrade?.rate ? String(chosenGrade.rate) : updated[idx].price
                                      };
                                      setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                    }}
                                    className="w-full h-7.5 bg-blue-50/50 border border-blue-200 rounded-lg px-1.5 text-[10.5px] font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
                                  >
                                    {gradeOptions.map(g => (
                                      <option key={g.key} value={g.key}>
                                        {g.label} ({g.range})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              {/* Scale Wt inputs */}
                              <div className="flex items-center gap-0.5 bg-blue-50/40 p-0.5 rounded-lg border border-blue-200 shrink-0">
                                <span className="text-[9.5px] font-black text-blue-900 px-0.5 shrink-0">WT:</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="Kg"
                                  value={row.kg}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    const updated = [...damStockInForm.tallyItems];
                                    if (val.includes('.')) {
                                      const parts = val.split('.');
                                      updated[idx].kg = parts[0] || '0';
                                      const gStr = (parts[1] || '').padEnd(3, '0').slice(0, 3);
                                      updated[idx].grams = String(parseInt(gStr, 10) || 0);
                                    } else {
                                      updated[idx].kg = val;
                                    }
                                    const curKpb = Number(updated[idx].kgPerBox || 1);
                                    const totalWeight = Number(updated[idx].kg || 0) + (Number(updated[idx].grams || 0) / 1000);
                                    if (totalWeight > 0 && (!updated[idx].boxes || updated[idx].boxes === '0')) {
                                      updated[idx].boxes = String(Math.round(totalWeight / curKpb));
                                    }
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  className="w-10 sm:w-11 h-6.5 bg-white border border-blue-200 rounded text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-[10px] font-bold text-slate-400">+</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="999"
                                  placeholder="Gm"
                                  value={row.grams}
                                  onChange={(e) => {
                                    let val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val.length > 3) val = val.slice(0, 3);
                                    if (Number(val) > 999) val = '999';
                                    const updated = [...damStockInForm.tallyItems];
                                    updated[idx].grams = val;
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  className="w-9 h-6.5 bg-white border border-blue-200 rounded text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (calcRowIdx === idx) {
                                      setCalcRowIdx(null);
                                      setCalcExpression('');
                                    } else {
                                      setCalcRowIdx(idx);
                                      setCalcExpression(row.kg ? (Number(row.grams || 0) > 0 ? `${row.kg}.${String(row.grams).padStart(3, '0')}` : row.kg) : '');
                                    }
                                  }}
                                  className={`h-6.5 px-1.5 rounded border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                    calcRowIdx === idx
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-blue-700 border-blue-300'
                                  }`}
                                  title="Scale Weight Calculator"
                                >
                                  <Calculator size={11} />
                                </button>
                              </div>

                              {/* Rate */}
                              <div className="w-12 sm:w-14 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="₹/Kg"
                                  value={row.price}
                                  onChange={(e) => {
                                    const updated = [...damStockInForm.tallyItems];
                                    updated[idx].price = e.target.value;
                                    setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                  }}
                                  className="w-full h-7 bg-white border border-blue-200 rounded-lg px-1 text-xs text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                              </div>

                              {/* Total */}
                              <div className="w-14 sm:w-18 shrink-0 text-right font-mono font-black text-xs text-emerald-800 whitespace-nowrap">
                                ₹{rowTotal.toLocaleString('en-IN')}
                              </div>
                            </div>

                            {/* Mobile Calculator Drawer */}
                            {calcRowIdx === idx && (
                              <div className="p-2 bg-blue-50 border border-blue-300 rounded-xl space-y-1.5 animate-fadeIn">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase text-blue-900 flex items-center gap-1">
                                    <Calculator size={11} className="text-blue-600" />
                                    <span>Scale Calculator (e.g. 16 + 5 + 10 + 15)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => { setCalcRowIdx(null); setCalcExpression(''); }}
                                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={calcExpression}
                                    onChange={(e) => setCalcExpression(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleApplyCalc(idx);
                                      } else if (e.key === 'Escape') {
                                        setCalcRowIdx(null);
                                      }
                                    }}
                                    placeholder="16 + 5 + 10 + 15"
                                    className="flex-1 h-7.5 bg-white border border-blue-300 rounded-lg px-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleApplyCalc(idx)}
                                    className="h-7.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
                                  >
                                    <CheckCircle size={11} />
                                    <span>Apply</span>
                                  </button>
                                </div>
                                {evaluateCalcSum(calcExpression) && (
                                  <div className="text-[10px] font-mono text-blue-800 font-bold px-1">
                                    Sum: {evaluateCalcSum(calcExpression).wholeKg} Kg {evaluateCalcSum(calcExpression).remGm > 0 ? `${evaluateCalcSum(calcExpression).remGm} Gm` : ''} ({evaluateCalcSum(calcExpression).total} kg)
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* ── Desktop Table (>= md) ── */}
                    <div className="hidden md:block overflow-x-auto w-full">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#FDFBF7] text-slate-700 font-black border-b border-blue-100 text-[10px] sm:text-[11px] uppercase tracking-wider">
                          <tr>
                            <th className="py-2 px-1 text-center w-7">#</th>
                            <th className="py-2 px-1.5 min-w-[150px]">Fish Variety</th>
                            <th className="py-2 px-1 min-w-[100px] w-28">Grade</th>
                            {damWeighMode === 'box' && <th className="py-2 px-1 text-center w-14">Boxes</th>}
                            {damWeighMode === 'box' && <th className="py-2 px-1 text-center w-24">Kg / Box</th>}
                            <th className="py-2 px-1.5 text-center min-w-[150px] w-40">
                              <span className="inline-flex items-center gap-1">
                                Scale Wt (Kg) <Calculator size={10} className="text-blue-600" />
                              </span>
                            </th>
                            <th className="py-2 px-1 text-right w-18">Rate (₹)</th>
                            <th className="py-2 px-1.5 text-right w-20">Total (₹)</th>
                            <th className="py-2 px-1 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {group.items.map(({ item: row, originalIdx: idx }) => {
                            let rowKg = 0;
                            const b = Number(row.boxes || 0);
                            const kpb = Number(row.kgPerBox || 1);
                            if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
                              rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
                            } else if (b > 0 && kpb > 0) {
                              rowKg = Number((b * kpb).toFixed(3));
                            }
                            const rowTotal = Number((rowKg * Number(row.price || 0)).toFixed(2));

                            return (
                              <React.Fragment key={row.id || idx}>
                                <tr className="hover:bg-blue-50/20">
                                <td className="py-1.5 px-1 align-middle text-center font-mono text-slate-500 text-xs font-bold">
                                  {idx + 1}
                                </td>
                                <td className="py-1.5 px-1.5 align-middle">
                                  <SearchableDropdown
                                    mode="select"
                                    value={row.menuItemId}
                                    onChange={(selId, selOption) => {
                                      const sel = selOption?.raw || fishList.find(f => f._id === selId);
                                      const gradeOptions = getFishGradeOptions(sel);
                                      const defaultGrade = gradeOptions.find(g => g.key === 'medium') || gradeOptions[0];
                                      const itemKpb = Number(sel?.boxPackingKg || 1);
                                      const updated = [...damStockInForm.tallyItems];
                                      const curBoxes = Number(updated[idx].boxes || 0);
                                      let autoKg = updated[idx].kg;
                                      let autoGm = updated[idx].grams;
                                      if (curBoxes > 0) {
                                        const tot = curBoxes * itemKpb;
                                        const wKg = Math.floor(tot);
                                        const remG = Math.round((tot - wKg) * 1000);
                                        autoKg = String(wKg);
                                        autoGm = remG > 0 ? String(remG) : '0';
                                      }
                                      updated[idx] = {
                                        ...updated[idx],
                                        menuItemId: selId,
                                        itemName: sel?.name || '',
                                        sizeGrade: defaultGrade?.key || 'medium',
                                        sizeBracket: defaultGrade?.label || 'Medium',
                                        weightOption: defaultGrade?.range || '1 - 4 Kg',
                                        price: defaultGrade?.rate ? String(defaultGrade.rate) : (sel?.purchasePrice ? String(sel.purchasePrice) : updated[idx].price),
                                        kgPerBox: itemKpb,
                                        kgPerBoxKg: undefined,
                                        kgPerBoxGrams: undefined,
                                        kg: autoKg,
                                        grams: autoGm
                                      };
                                      setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                    }}
                                    options={fishOptions}
                                    placeholder="-- Variety --"
                                    searchPlaceholder="Search fish species..."
                                    className="w-full min-w-[140px]"
                                    inputClassName="!h-8 !py-0 !rounded-lg !text-[11px] flex items-center"
                                    minDropdownWidth={240}
                                    accentColor="blue"
                                    required
                                  />
                                </td>
                                <td className="py-1.5 px-1 align-middle">
                                  {(() => {
                                    const selFish = fishList.find(f => f._id === row.menuItemId);
                                    const gradeOptions = getFishGradeOptions(selFish);
                                    const activeGradeKey = row.sizeGrade || (row.sizeBracket ? row.sizeBracket.toLowerCase() : 'medium');
                                    const currentGrade = gradeOptions.find(g => g.key === activeGradeKey) || gradeOptions[0];

                                    return (
                                      <select
                                        value={currentGrade?.key || 'medium'}
                                        onChange={(e) => {
                                          const chosenGrade = gradeOptions.find(g => g.key === e.target.value);
                                          const updated = [...damStockInForm.tallyItems];
                                          updated[idx] = {
                                            ...updated[idx],
                                            sizeGrade: chosenGrade?.key || 'medium',
                                            sizeBracket: chosenGrade?.label || 'Medium',
                                            weightOption: chosenGrade?.range || '1 - 4 Kg',
                                            price: chosenGrade?.rate ? String(chosenGrade.rate) : updated[idx].price
                                          };
                                          setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                        }}
                                        className="w-full h-8 bg-white border border-blue-200 rounded-lg px-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                                      >
                                        {gradeOptions.map(g => (
                                          <option key={g.key} value={g.key}>
                                            {g.label} ({g.range})
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  })()}
                                </td>
                                {/* Boxes — hidden in KG-only mode */}
                                {(row.weighMode || damWeighMode) !== 'kg' && (
                                  <td className="py-1.5 px-1 align-middle">
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      placeholder="0"
                                      value={row.boxes}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        const updated = [...damStockInForm.tallyItems];
                                        const curKpb = Number(updated[idx].kgPerBox || 1);
                                        updated[idx].boxes = val;
                                        if (val !== '' && !isNaN(Number(val)) && Number(val) > 0) {
                                          const totalWeight = Number(val) * curKpb;
                                          const wholeKg = Math.floor(totalWeight);
                                          const remainderGrams = Math.round((totalWeight - wholeKg) * 1000);
                                          updated[idx].kg = String(wholeKg);
                                          updated[idx].grams = remainderGrams > 0 ? String(remainderGrams) : '0';
                                        } else if (val === '') {
                                          updated[idx].kg = '';
                                          updated[idx].grams = '';
                                        }
                                        setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                      }}
                                      className="w-full h-8 bg-white border border-blue-200 rounded-lg px-1 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                    />
                                  </td>
                                )}
                                {/* Kg/Box — hidden in KG-only mode */}
                                {(row.weighMode || damWeighMode) !== 'kg' && (
                                  <td className="py-1.5 px-1 align-middle">
                                    {(() => {
                                      const kpbParts = splitKgPerBoxParts(row);
                                      return (
                                        <div className="flex items-center justify-center gap-0.5 h-8">
                                          <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            placeholder="Kg"
                                            value={kpbParts.k}
                                            onChange={(e) => {
                                              const updated = buildUpdatedRowsWithKpb(
                                                damStockInForm.tallyItems,
                                                idx,
                                                e.target.value,
                                                kpbParts.g,
                                                true
                                              );
                                              setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                            }}
                                            className="w-11 h-8 bg-white border border-blue-200 rounded-lg px-1 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                          />
                                          <span className="text-[10px] font-bold text-slate-400">+</span>
                                          <input
                                            type="number"
                                            min="0"
                                            max="999"
                                            placeholder="Gm"
                                            value={kpbParts.g}
                                            onChange={(e) => {
                                              let gVal = e.target.value.replace(/[^0-9]/g, '');
                                              if (gVal.length > 3) gVal = gVal.slice(0, 3);
                                              if (Number(gVal) > 999) gVal = '999';
                                              const updated = buildUpdatedRowsWithKpb(
                                                damStockInForm.tallyItems,
                                                idx,
                                                kpbParts.k,
                                                gVal,
                                                false
                                              );
                                              setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                            }}
                                            className="w-10 h-8 bg-white border border-blue-200 rounded-lg px-0.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                          />
                                        </div>
                                      );
                                    })()}
                                  </td>
                                )}
                                {/* Scale Wt (Kg) with inline Calculator */}
                                <td className="py-1.5 px-1.5 align-middle">
                                  <div className="relative">
                                    <div className="flex items-center justify-center gap-0.5 h-8">
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        placeholder="Kg"
                                        value={row.kg}
                                        onChange={(e) => {
                                          let val = e.target.value;
                                          const updated = [...damStockInForm.tallyItems];
                                          if (val.includes('.')) {
                                            const parts = val.split('.');
                                            updated[idx].kg = parts[0] || '0';
                                            const gStr = (parts[1] || '').padEnd(3, '0').slice(0, 3);
                                            updated[idx].grams = String(parseInt(gStr, 10) || 0);
                                          } else {
                                            updated[idx].kg = val;
                                          }
                                          const curKpb = Number(updated[idx].kgPerBox || 1);
                                          const totalWeight = Number(updated[idx].kg || 0) + (Number(updated[idx].grams || 0) / 1000);
                                          if (totalWeight > 0 && (!updated[idx].boxes || updated[idx].boxes === '0')) {
                                            updated[idx].boxes = String(Math.round(totalWeight / curKpb));
                                          }
                                          setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                        }}
                                        className="w-13 sm:w-14 h-8 bg-white border border-blue-200 rounded-lg px-1 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                      />
                                      <span className="text-[10px] font-bold text-slate-400">+</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="999"
                                        placeholder="Gm"
                                        value={row.grams}
                                        onChange={(e) => {
                                          let val = e.target.value.replace(/[^0-9]/g, '');
                                          if (val.length > 3) val = val.slice(0, 3);
                                          if (Number(val) > 999) val = '999';
                                          const updated = [...damStockInForm.tallyItems];
                                          updated[idx].grams = val;
                                          setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                        }}
                                        className="w-11 sm:w-12 h-8 bg-white border border-blue-200 rounded-lg px-0.5 text-xs text-center font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (calcRowIdx === idx) {
                                            setCalcRowIdx(null);
                                            setCalcExpression('');
                                          } else {
                                            setCalcRowIdx(idx);
                                            setCalcExpression(row.kg ? (Number(row.grams || 0) > 0 ? `${row.kg}.${String(row.grams).padStart(3, '0')}` : row.kg) : '');
                                          }
                                        }}
                                        className={`h-8 w-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                                          calcRowIdx === idx
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                            : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                                        }`}
                                        title="Quick Scale Sum: e.g. 16+5+10+15"
                                      >
                                        <Calculator size={12} />
                                      </button>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-1.5 px-1 align-middle text-right">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="₹/Kg"
                                    value={row.price}
                                    onChange={(e) => {
                                      const updated = [...damStockInForm.tallyItems];
                                      updated[idx].price = e.target.value;
                                      setDamStockInForm({ ...damStockInForm, tallyItems: updated });
                                    }}
                                    className="w-16 h-8 bg-white border border-blue-200 rounded-lg px-1.5 text-xs text-right font-mono font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                                  />
                                </td>
                                <td className="py-1.5 px-1.5 align-middle text-right">
                                  <div className="h-8 flex items-center justify-end font-mono font-black text-xs sm:text-sm text-emerald-800">
                                    ₹{rowTotal.toLocaleString('en-IN')}
                                  </div>
                                </td>
                                <td className="py-1.5 px-1 align-middle text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (damStockInForm.tallyItems.length > 1) {
                                        setDamStockInForm({
                                          ...damStockInForm,
                                          tallyItems: damStockInForm.tallyItems.filter((_, i) => i !== idx)
                                        });
                                      } else {
                                        const now = new Date().toISOString().slice(0, 16);
                                        setDamStockInForm({
                                          ...damStockInForm,
                                          tallyItems: [{ id: Date.now(), menuItemId: '', itemName: '', sizeGrade: 'medium', sizeBracket: 'Medium', weightOption: '1 - 4 Kg', boxes: '', kgPerBox: 1, kg: '', grams: '', price: '', date: now, weighMode: damWeighMode }]
                                        });
                                      }
                                    }}
                                    className="h-8 w-8 flex items-center justify-center text-slate-300 hover:text-rose-600 rounded-lg cursor-pointer transition-colors mx-auto"
                                    title={damStockInForm.tallyItems.length > 1 ? 'Remove row' : 'Clear row'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>

                              {/* Desktop Inline Scale Calculator Sub-Row */}
                              {calcRowIdx === idx && (
                                <tr key={`calc-${idx}`} className="bg-blue-50/70 border-y-2 border-blue-400">
                                  <td colSpan={damWeighMode === 'box' ? 9 : 7} className="p-2 sm:p-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2 sm:p-2.5 rounded-xl border border-blue-300 shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                                          <Calculator size={14} />
                                        </div>
                                        <div>
                                          <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                                            <span>Scale Sum Calculator (Row #{idx + 1}{row.itemName ? ` • ${row.itemName}` : ''})</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 font-medium">
                                            Enter weights with <code className="bg-blue-100 text-blue-900 px-1 py-0.2 rounded font-mono font-bold">+</code>: e.g. <span className="font-mono text-slate-700">16 + 5 + 10 + 15</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={calcExpression}
                                          onChange={(e) => setCalcExpression(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleApplyCalc(idx);
                                            } else if (e.key === 'Escape') {
                                              setCalcRowIdx(null);
                                            }
                                          }}
                                          placeholder="16 + 5 + 10 + 15"
                                          className="w-48 sm:w-64 h-8 bg-blue-50/50 border border-blue-300 rounded-lg px-2.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleApplyCalc(idx)}
                                          className="h-8 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                                        >
                                          <CheckCircle size={12} />
                                          <span>Apply Sum</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setCalcRowIdx(null); setCalcExpression(''); }}
                                          className="h-8 px-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer flex items-center justify-center"
                                          title="Cancel"
                                        >
                                          <X size={15} />
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100/70 border border-blue-300/60 rounded-lg text-xs">
                                        <span className="text-[10.5px] font-bold text-blue-800 uppercase tracking-wide">Sum:</span>
                                        <span className="font-mono font-black text-blue-950">
                                          {(() => {
                                            const res = evaluateCalcSum(calcExpression);
                                            return res !== null ? `${res.wholeKg} Kg ${res.remGm > 0 ? `${res.remGm} Gm` : ''}` : '—';
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Date Group Subtotal Footer */}
                    <div className="bg-blue-50/70 px-2.5 py-1 sm:px-3 sm:py-1.5 border-t border-blue-200 flex items-center justify-between text-[10px] sm:text-xs">
                      <span className="font-bold text-slate-600 uppercase tracking-wider text-[9px] sm:text-[10px] truncate">
                        {group.label.dateFormatted} Subtotal:
                      </span>
                      <div className="flex items-center gap-1.5 sm:gap-2 font-mono shrink-0">
                        <span className="font-black text-blue-950 bg-blue-100 border border-blue-300 px-1.5 sm:px-2 py-0.5 rounded text-[9.5px] sm:text-[11px]">
                          {group.subtotalKgInt} Kg {group.subtotalGmInt > 0 ? `${group.subtotalGmInt} Gm` : ''}
                        </span>
                        <span className="font-black text-emerald-800 text-[10px] sm:text-xs">
                          ₹{group.subtotalValue.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── Table Action Buttons: Add Item, Next Day ── */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const lastItem = damStockInForm.tallyItems[damStockInForm.tallyItems.length - 1];
                    const curDate = lastItem?.date || new Date().toISOString().slice(0, 16);
                    handleAddRowToDate(curDate);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-dashed border-blue-500/60 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap min-w-0"
                >
                  <Plus size={12} className="shrink-0" />
                  <span className="truncate">Add Item <span className="hidden sm:inline">(Same Date)</span></span>
                </button>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white text-[10px] sm:text-xs font-black transition-all cursor-pointer shadow-md active:scale-95 whitespace-nowrap min-w-0"
                  title="Advance to next calendar day with same time"
                >
                  <CalendarPlus size={12} className="shrink-0" />
                  <span className="truncate">Next Day ({nextDayPreview})</span>
                </button>
              </div>

              {/* ── GRAND TOTAL FOOTER (ALL DATES COMBINED) ── */}
              <div className="bg-gradient-to-r from-blue-100/90 via-indigo-50 to-blue-100/90 border border-blue-400/50 rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 shadow-2xs flex items-center justify-between gap-1.5 sm:gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-600 shrink-0" />
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 min-w-0">
                    <span className="text-[10px] sm:text-xs font-black text-slate-900 uppercase tracking-wide truncate">
                      Grand Total:
                    </span>
                    <span className="text-[8.5px] sm:text-[10px] font-semibold text-slate-500 truncate">
                      {grandTotals.itemsCount} {grandTotals.itemsCount === 1 ? 'Variety' : 'Varieties'} • {grandTotals.datesCount} {grandTotals.datesCount === 1 ? 'Date' : 'Dates'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 font-mono shrink-0">
                  {grandTotals.totalBoxes > 0 && (
                    <span className="text-[9px] sm:text-xs font-bold text-slate-600">
                      {grandTotals.totalBoxes} <span className="hidden xs:inline">Boxes</span>
                    </span>
                  )}
                  <span className="bg-blue-600 text-white px-1.5 sm:px-2 py-0.5 rounded-md font-black text-[9.5px] sm:text-xs shadow-2xs whitespace-nowrap">
                    {grandTotals.totalKgInt} Kg{grandTotals.totalGmInt > 0 ? ` ${grandTotals.totalGmInt}g` : ''}
                  </span>
                  <span className="font-black text-emerald-800 text-[10.5px] sm:text-sm whitespace-nowrap">
                    ₹{grandTotals.totalGross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Dam Contractor / Syndicate Selection */}
        <div className="bg-[#FAF0E4]/60 p-2.5 sm:p-4 rounded-xl border border-[#fed7aa]/80 space-y-2.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#fed7aa]/60">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wide m-0">
                Dam Contractor / Syndicate Selection
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0 mt-0.5">
                Choose dam contractor card or search below ({filteredDamContractors.length} Available)
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative flex items-center w-full sm:w-64">
              <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search contractor, syndicate, phone..."
                value={damSupplierSearch}
                onChange={(e) => setDamSupplierSearch(e.target.value)}
                className="w-full pl-7 pr-7 py-1.5 bg-white border border-[#E8DCCB] rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
              />
              {damSupplierSearch && (
                <button
                  type="button"
                  onClick={() => setDamSupplierSearch('')}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Selected Contractor Badge Row */}
          {damStockInForm.contractorName && (
            <div className="flex items-center justify-between flex-wrap gap-2 p-2 sm:p-2.5 bg-blue-50 border border-blue-300 rounded-xl animate-fadeIn">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={15} className="text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-blue-950 truncate">
                  Selected: <span className="font-black text-blue-900">{damStockInForm.contractorName}</span>
                  {damStockInForm.companyName && <span className="text-slate-600 font-semibold"> ({damStockInForm.companyName})</span>}
                  {damStockInForm.contractorPhone && <span className="font-mono text-slate-700 font-bold"> • {damStockInForm.contractorPhone}</span>}
                  {damStockInForm.vehicleNumber && <span className="font-mono text-slate-700 font-bold"> • {damStockInForm.vehicleNumber}</span>}
                  {damStockInForm.harbor && <span className="text-slate-600"> • {damStockInForm.harbor}</span>}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearDamContractor}
                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all shrink-0 ml-auto"
                title="Clear selected contractor"
              >
                <Trash2 size={12} />
                <span>Clear Selection</span>
              </button>
            </div>
          )}

          {/* Grid of Contractor Cards */}
          {filteredDamContractors.length === 0 ? (
            <div className="p-4 rounded-xl bg-white border border-[#fed7aa] text-center text-xs text-slate-500">
              No matching dam contractors found. You can clear your search or enter custom consignment details below.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredDamContractors.map((supp) => {
                const isSelected = Boolean(
                  (supp._id && damStockInForm.contractorId === supp._id) ||
                  (supp.name && damStockInForm.contractorName && supp.name.toLowerCase() === damStockInForm.contractorName.toLowerCase())
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
                    onClick={() => handleSelectDamContractorCard(supp)}
                    className={`rounded-2xl p-3 sm:p-3.5 border-2 transition-all cursor-pointer relative flex flex-col justify-between group shadow-2xs hover:shadow-md active:scale-[0.99] ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/90 ring-4 ring-blue-300 shadow-md'
                        : 'border-[#E8DCCB] bg-white hover:border-blue-500 hover:bg-blue-50/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-start gap-2.5 sm:gap-3">
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-slate-50 border-2 border-[#E8DCCB] group-hover:border-blue-500 shrink-0 shadow-2xs flex items-center justify-center p-0.5">
                          {supp.profileImage ? (
                            <img
                              src={formatImageUrl(supp.profileImage)}
                              alt={supp.name}
                              className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white font-black text-xl rounded-xl">
                              {supp.name ? supp.name.charAt(0).toUpperCase() : <Anchor size={22} />}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate leading-snug m-0">
                              {supp.name}
                            </h4>
                            <span className="text-[8px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded-full border bg-blue-100 text-blue-900 border-blue-200 uppercase tracking-wider shrink-0">
                              {supp.supplierType || 'DAM'}
                            </span>
                          </div>
                          {supp.companyName ? (
                            <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold truncate m-0 mt-0.5">
                              {supp.companyName}
                            </p>
                          ) : (
                            <p className="text-[10px] sm:text-[11px] text-slate-400 italic m-0 mt-0.5">Dam Syndicate</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-1 bg-[#FAF0E4]/60 p-2 rounded-xl border border-[#fed7aa]/50 text-[10.5px] font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone size={11} className="text-blue-600 shrink-0" />
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
                            <Anchor size={11} className="text-blue-600 shrink-0" />
                            <span className="text-slate-400 font-normal">Location:</span>
                            <span className="text-slate-800 truncate">{supp.harbor || supp.city}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      {isSelected ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-blue-900 bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} /> Selected
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleClearDamContractor(); }}
                            className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[10.5px] font-black flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            title="Clear this contractor"
                          >
                            <Trash2 size={11} className="text-rose-600" />
                            <span>Clear</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-[10.5px] font-bold text-blue-700 group-hover:text-blue-900 flex items-center gap-1 ml-auto">
                          Select Contractor →
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
              onClick={() => setIsDamManualDetailsOpen(!isDamManualDetailsOpen)}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer select-none"
            >
              <span>{isDamManualDetailsOpen ? 'Hide Manual Details' : 'Edit / Enter Custom Contractor Details'}</span>
              {isDamManualDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isDamManualDetailsOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-[#fed7aa]/60 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 animate-fadeIn">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Contractor Name *
                  </label>
                  <SearchableDropdown
                    mode="combobox"
                    placeholder="e.g. Srisailam Fishery Syndicate"
                    value={damStockInForm.contractorName}
                    onChange={(val) => {
                      const regFound = registeredSuppliers.find(s =>
                        s.name?.toLowerCase() === val.toLowerCase() ||
                        s.companyName?.toLowerCase() === val.toLowerCase()
                      );
                      const crmFound = crmCustomers.find(c => c.name?.toLowerCase() === val.toLowerCase());
                      const assignedVeh = fleetVehicles.find(v =>
                        (v.assignedSupplierId && String(v.assignedSupplierId) === String(regFound?._id)) ||
                        (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === val.toLowerCase())
                      );
                      setDamStockInForm(prev => ({
                        ...prev,
                        contractorName: val,
                        contractorId: regFound?._id || crmFound?._id || prev.contractorId,
                        contractorPhone: regFound?.phone || crmFound?.phone || assignedVeh?.driverPhone || prev.contractorPhone,
                        companyName: regFound?.companyName || prev.companyName,
                        vehicleNumber: regFound?.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
                        harbor: regFound?.harbor || regFound?.city || crmFound?.address?.city || prev.harbor
                      }));
                    }}
                    onSelect={(raw) => {
                      if (!raw) return;
                      const assignedVeh = fleetVehicles.find(v =>
                        (v.assignedSupplierId && String(v.assignedSupplierId) === String(raw._id)) ||
                        (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === raw.name?.toLowerCase())
                      );
                      setDamStockInForm(prev => ({
                        ...prev,
                        contractorName: raw.name || prev.contractorName,
                        contractorId: raw._id || prev.contractorId,
                        contractorPhone: raw.phone || assignedVeh?.driverPhone || prev.contractorPhone,
                        companyName: raw.companyName || prev.companyName,
                        vehicleNumber: raw.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
                        harbor: raw.harbor || raw.city || raw.address?.city || prev.harbor
                      }));
                    }}
                    options={damContractorOptions}
                    accentColor="blue"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-700">Contact Phone</label>
                    {damStockInForm.contractorPhone && (
                      <span className={`text-[10px] font-mono font-bold ${
                        damStockInForm.contractorPhone.length === 10 ? 'text-emerald-600' : 'text-blue-600'
                      }`}>
                        {damStockInForm.contractorPhone.length}/10 digits
                      </span>
                    )}
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={damStockInForm.contractorPhone}
                    onChange={(e) => setDamStockInForm({ ...damStockInForm, contractorPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Syndicate / Firm Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Reservoir Syndicate"
                    value={damStockInForm.companyName}
                    onChange={(e) => setDamStockInForm({ ...damStockInForm, companyName: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Vehicle Number</label>
                  <SearchableDropdown
                    mode="combobox"
                    placeholder="e.g. AP 04 TX 4821"
                    value={damStockInForm.vehicleNumber}
                    onChange={(val) => {
                      const upper = (val || '').toUpperCase();
                      const matchOpt = damVehicleOptions.find(v => v.value.toUpperCase() === upper);
                      if (matchOpt?.raw) {
                        const r = matchOpt.raw;
                        setDamStockInForm(prev => ({
                          ...prev,
                          vehicleNumber: upper,
                          contractorName: r.contractorName || r.supplierName || prev.contractorName,
                          contractorPhone: r.driverPhone || r.supplierPhone || prev.contractorPhone,
                          companyName: r.companyName || r.vehicleName || prev.companyName,
                          harbor: r.harbor || prev.harbor
                        }));
                      } else {
                        setDamStockInForm(prev => ({ ...prev, vehicleNumber: upper }));
                      }
                    }}
                    onSelect={(raw) => {
                      if (!raw) return;
                      setDamStockInForm(prev => ({
                        ...prev,
                        vehicleNumber: raw.vehicleNumber || prev.vehicleNumber,
                        contractorName: raw.contractorName || raw.supplierName || prev.contractorName,
                        contractorPhone: raw.driverPhone || raw.supplierPhone || prev.contractorPhone,
                        companyName: raw.companyName || raw.vehicleName || prev.companyName,
                        harbor: raw.harbor || prev.harbor
                      }));
                    }}
                    options={damVehicleOptions}
                    accentColor="blue"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Dam / Reservoir Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Srisailam, Nagarjuna Sagar"
                    value={damStockInForm.harbor}
                    onChange={(e) => setDamStockInForm({ ...damStockInForm, harbor: e.target.value })}
                    className="w-full bg-white border border-[#E8DCCB] rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Settlement & Advance Deductions */}
        <div className="bg-[#FAF0E4]/60 p-3 sm:p-4 rounded-xl border border-[#fed7aa]/80 space-y-2.5 sm:space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="text-[11px] sm:text-xs font-bold text-slate-800 uppercase tracking-wide">
                Settlement & Advance Deductions
              </div>
              <button
                type="button"
                onClick={() => setDamStockInForm(prev => ({ ...prev, showSettlements: !prev.showSettlements }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  damStockInForm.showSettlements ? 'bg-blue-600' : 'bg-slate-300'
                }`}
                title={damStockInForm.showSettlements ? 'Deductions Section Enabled. Click to hide completely' : 'Deductions Section Hidden by default. Click to show'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    damStockInForm.showSettlements ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                damStockInForm.showSettlements ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {damStockInForm.showSettlements ? 'Enabled' : 'Hidden (Excluded)'}
              </span>
            </div>

            {damStockInForm.showSettlements && (
              <button
                type="button"
                onClick={handleAddDamCustomCategory}
                className="px-2 py-0.8 sm:px-2.5 sm:py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-[10.5px] sm:text-xs font-bold text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer transition-all hover:border-blue-400"
              >
                <Plus size={11} className="text-blue-600" />
                <span>Add Category</span>
              </button>
            )}
          </div>

          {damStockInForm.showSettlements && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
              {[
                { key: 'advance', label: '1) Advance' },
                { key: 'khata', label: '2) Khata' },
                { key: 'od', label: '3) OD / Transport' },
                { key: 'expense', label: '4) Depot Expense' },
                { key: 'festivalExpense', label: '5) Other Expense' }
              ].map(item => {
                const entry = damStockInForm.settlements?.[item.key] || { type: 'Dr', amount: '', isLocked: true };
                const isLocked = entry.isLocked !== false;
                const isCr = entry.type === 'Cr';

                return (
                  <div key={item.key} className={`p-2.5 rounded-xl border space-y-1.5 shadow-2xs transition-all ${
                    isLocked ? 'bg-slate-50/80 border-slate-200' : 'bg-white border-[#fed7aa]'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-slate-700 truncate">{item.label}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextLocked = !isLocked;
                          setDamStockInForm({
                            ...damStockInForm,
                            settlements: {
                              ...damStockInForm.settlements,
                              [item.key]: { ...entry, isLocked: nextLocked }
                            }
                          });
                        }}
                        className={`px-1.5 py-0.5 rounded cursor-pointer transition-all flex items-center gap-1 text-[9.5px] font-bold shrink-0 ${
                          isLocked
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                            : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300'
                        }`}
                        title={isLocked ? 'Locked: Cr/Dr disabled. Click to unlock' : 'Unlocked: Cr/Dr active. Click to lock'}
                      >
                        {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                        <span>{isLocked ? 'Lock' : 'Active'}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          setDamStockInForm({
                            ...damStockInForm,
                            settlements: { ...damStockInForm.settlements, [item.key]: { ...entry, type: 'Cr' } }
                          });
                        }}
                        className={`py-0.5 rounded text-[10px] font-black transition-all ${
                          isLocked
                            ? 'text-slate-400 cursor-not-allowed opacity-50'
                            : isCr
                            ? 'bg-emerald-600 text-white shadow-xs cursor-pointer'
                            : 'text-slate-500 hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        + Cr
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          setDamStockInForm({
                            ...damStockInForm,
                            settlements: { ...damStockInForm.settlements, [item.key]: { ...entry, type: 'Dr' } }
                          });
                        }}
                        className={`py-0.5 rounded text-[10px] font-black transition-all ${
                          isLocked
                            ? 'text-slate-400 cursor-not-allowed opacity-50'
                            : !isCr
                            ? 'bg-rose-600 text-white shadow-xs cursor-pointer'
                            : 'text-slate-500 hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        - Dr
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      disabled={isLocked}
                      placeholder={isLocked ? "Locked" : "0"}
                      value={entry.amount}
                      onChange={(e) => {
                        if (isLocked) return;
                        setDamStockInForm({
                          ...damStockInForm,
                          settlements: { ...damStockInForm.settlements, [item.key]: { ...entry, amount: e.target.value } }
                        });
                      }}
                      className={`w-full p-1 rounded-lg text-xs font-mono font-bold text-center transition-all ${
                        isLocked
                          ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                          : isCr
                          ? 'bg-slate-50 border border-emerald-300 text-emerald-800'
                          : 'bg-slate-50 border border-rose-300 text-rose-800'
                      }`}
                    />
                  </div>
                );
              })}

              {(damStockInForm.customSettlements || []).map((item, cIdx) => {
                const isLocked = item.isLocked !== false;
                const isCr = item.type === 'Cr';
                return (
                  <div key={item.id || cIdx} className={`p-2.5 rounded-xl border space-y-1.5 shadow-2xs relative transition-all ${
                    isLocked ? 'bg-slate-50/80 border-slate-200' : 'bg-white border-blue-300 bg-blue-50/20'
                  }`}>
                    <div className="flex items-center justify-between gap-1">
                      <input
                        type="text"
                        value={item.label}
                        disabled={isLocked}
                        placeholder="Category Name"
                        onChange={(e) => {
                          if (isLocked) return;
                          const updated = [...damStockInForm.customSettlements];
                          updated[cIdx].label = e.target.value;
                          setDamStockInForm({ ...damStockInForm, customSettlements: updated });
                        }}
                        className="w-full text-[11px] font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 py-0.5 disabled:opacity-50"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...damStockInForm.customSettlements];
                            updated[cIdx].isLocked = !isLocked;
                            setDamStockInForm({ ...damStockInForm, customSettlements: updated });
                          }}
                          className={`px-1.5 py-0.5 rounded cursor-pointer transition-all flex items-center gap-0.5 text-[9.5px] font-bold ${
                            isLocked
                              ? 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300'
                          }`}
                          title={isLocked ? 'Locked: Cr/Dr disabled. Click to unlock' : 'Unlocked: Cr/Dr active. Click to lock'}
                        >
                          {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveDamCustomCategory(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer shrink-0"
                          title="Remove category"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          const updated = [...damStockInForm.customSettlements];
                          updated[cIdx].type = 'Cr';
                          setDamStockInForm({ ...damStockInForm, customSettlements: updated });
                        }}
                        className={`py-0.5 rounded text-[10px] font-black transition-all ${
                          isLocked
                            ? 'text-slate-400 cursor-not-allowed opacity-50'
                            : isCr
                            ? 'bg-emerald-600 text-white shadow-xs cursor-pointer'
                            : 'text-slate-500 hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        + Cr
                      </button>
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => {
                          if (isLocked) return;
                          const updated = [...damStockInForm.customSettlements];
                          updated[cIdx].type = 'Dr';
                          setDamStockInForm({ ...damStockInForm, customSettlements: updated });
                        }}
                        className={`py-0.5 rounded text-[10px] font-black transition-all ${
                          isLocked
                            ? 'text-slate-400 cursor-not-allowed opacity-50'
                            : !isCr
                            ? 'bg-rose-600 text-white shadow-xs cursor-pointer'
                            : 'text-slate-500 hover:text-slate-900 cursor-pointer'
                        }`}
                      >
                        - Dr
                      </button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      disabled={isLocked}
                      placeholder={isLocked ? "Locked" : "0"}
                      value={item.amount}
                      onChange={(e) => {
                        if (isLocked) return;
                        const updated = [...damStockInForm.customSettlements];
                        updated[cIdx].amount = e.target.value;
                        setDamStockInForm({ ...damStockInForm, customSettlements: updated });
                      }}
                      className={`w-full p-1 rounded-lg text-xs font-mono font-bold text-center transition-all ${
                        isLocked
                          ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                          : isCr
                          ? 'bg-slate-50 border border-emerald-300 text-emerald-800'
                          : 'bg-slate-50 border border-rose-300 text-rose-800'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Notes & Payment Mode */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-end">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Catch Notes / Lot Reference</label>
            <input
              type="text"
              placeholder="e.g. Srisailam reservoir lot #A, weighed at depot platform"
              value={damStockInForm.notes}
              onChange={(e) => setDamStockInForm({ ...damStockInForm, notes: e.target.value })}
              className="w-full h-9 bg-white border border-[#E8DCCB] rounded-xl px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Payment Mode</label>
            <SearchableDropdown
              mode="select"
              searchable={false}
              value={damStockInForm.paymentMode || 'Cash'}
              onChange={(val) => {
                const net = Math.max(0, Number(damTotals.netSettlement || 0));
                setDamStockInForm(prev => {
                  let pPaid = prev.partialPaid;
                  let dAmt = 0;
                  if (val === 'Partial') {
                    pPaid = pPaid || Math.round(net * 0.5);
                    dAmt = Math.max(0, Number((net - pPaid).toFixed(2)));
                  } else if (val === 'Credit') {
                    dAmt = net;
                    pPaid = 0;
                  }
                  return {
                    ...prev,
                    paymentMode: val,
                    partialPaid: pPaid,
                    paidAmount: val === 'Partial' ? pPaid : (val === 'Credit' ? 0 : net),
                    dueAmount: dAmt
                  };
                });
              }}
              options={[
                { value: 'Cash', label: 'Cash' },
                { value: 'UPI', label: 'UPI / GPay' },
                { value: 'Bank Transfer', label: 'Bank Transfer' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'Credit', label: 'Credit (Pay Later / Khata)' },
                { value: 'Partial', label: 'Partial Payment' },
                { value: 'Mixed', label: 'Mixed / Split' }
              ]}
              accentColor="blue"
            />
          </div>
        </div>

        {/* 4a. Partial Payment Breakdown Panel */}
        {damStockInForm.paymentMode === 'Partial' && (
          <div className="p-3 bg-gradient-to-r from-blue-50/80 to-amber-50/80 rounded-xl border border-blue-200 space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-600" /> Partial Advance / Khata Settlement
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Net Consignment: <strong className="font-mono text-slate-800">₹{Math.max(0, Number(damTotals.netSettlement || 0)).toLocaleString()}</strong>
              </span>
            </div>

            {/* Row 1: Paid Now + Paid Via side-by-side in a single row */}
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <label className="block text-[10px] sm:text-[10.5px] font-bold text-slate-700 mb-1">Paid Now (₹)</label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, Number(damTotals.netSettlement || 0))}
                  placeholder="Amount paid now"
                  value={damStockInForm.partialPaid ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                    const net = Math.max(0, Number(damTotals.netSettlement || 0));
                    const due = Math.max(0, Number((net - (Number(val) || 0)).toFixed(2)));
                    setDamStockInForm(prev => ({
                      ...prev,
                      partialPaid: val,
                      paidAmount: Number(val) || 0,
                      dueAmount: due
                    }));
                  }}
                  className="w-full h-8 bg-white border border-blue-300 rounded-lg px-2.5 text-xs font-bold text-emerald-700 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-[10.5px] font-bold text-slate-700 mb-1">Paid Via</label>
                <select
                  value={damStockInForm.partialMethod || 'Cash'}
                  onChange={(e) => setDamStockInForm(prev => ({ ...prev, partialMethod: e.target.value }))}
                  className="w-full h-8 bg-white border border-blue-300 rounded-lg px-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Mixed">Mixed / Split</option>
                </select>
              </div>
            </div>

            {/* If Paid Via is Mixed in Partial Mode */}
            {damStockInForm.partialMethod === 'Mixed' && (() => {
              const targetPaid = Number(damStockInForm.partialPaid || 0);
              const sp = damStockInForm.splitPayments || {};
              const c = Number(sp.cash || 0);
              const u = Number(sp.upi || 0);
              const b = Number(sp.bank || 0);
              const ch = Number(sp.cheque || 0);
              const totalAllocated = Number((c + u + b + ch).toFixed(2));
              const rem = Number((targetPaid - totalAllocated).toFixed(2));
              const isFullyAllocated = Math.abs(rem) < 0.01;

              return (
                <div className="p-2.5 bg-white/90 rounded-xl border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-blue-900 flex items-center gap-1">
                      <PieChart size={12} className="text-indigo-600" /> Split Paid Amount (₹{targetPaid.toLocaleString()}):
                    </span>
                    <span className={`font-mono font-bold text-[10.5px] px-2 py-0.5 rounded-md ${
                      isFullyAllocated
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : rem > 0
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      ₹{totalAllocated.toLocaleString()} / ₹{targetPaid.toLocaleString()}
                      {!isFullyAllocated && ` (${rem > 0 ? `₹${rem} rem` : `₹${Math.abs(rem)} over`})`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { key: 'cash', label: 'Cash (₹)' },
                      { key: 'upi', label: 'UPI (₹)' },
                      { key: 'bank', label: 'Bank (₹)' },
                      { key: 'cheque', label: 'Cheque (₹)' }
                    ].map(field => (
                      <div key={field.key}>
                        <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">{field.label}</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={damStockInForm.splitPayments?.[field.key] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                            setDamStockInForm(prev => ({
                              ...prev,
                              splitPayments: {
                                ...(prev.splitPayments || {}),
                                [field.key]: val
                              }
                            }));
                          }}
                          className="w-full h-7 bg-white border border-blue-200 rounded-lg px-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* If Paid Via is Cheque in Partial Mode */}
            {damStockInForm.partialMethod === 'Cheque' && (
              <div className="p-2.5 bg-white/95 rounded-xl border border-blue-200 space-y-1.5 animate-in fade-in">
                <span className="text-[10.5px] font-bold text-blue-950 flex items-center gap-1">
                  <FileText size={12} className="text-blue-600" /> Cheque Information (Paid Now: ₹{Number(damStockInForm.partialPaid || 0).toLocaleString()}):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">Cheque Number</label>
                    <input
                      type="text"
                      placeholder="e.g. CHQ-482910"
                      value={damStockInForm.chequeDetails?.chequeNumber || ''}
                      onChange={(e) => setDamStockInForm(prev => ({
                        ...prev,
                        chequeDetails: { ...(prev.chequeDetails || {}), chequeNumber: e.target.value }
                      }))}
                      className="w-full h-7 bg-blue-50/40 border border-blue-200 rounded-lg px-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g. SBI, HDFC"
                      value={damStockInForm.chequeDetails?.bankName || ''}
                      onChange={(e) => setDamStockInForm(prev => ({
                        ...prev,
                        chequeDetails: { ...(prev.chequeDetails || {}), bankName: e.target.value }
                      }))}
                      className="w-full h-7 bg-blue-50/40 border border-blue-200 rounded-lg px-2 text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">Cheque Date</label>
                    <input
                      type="date"
                      value={damStockInForm.chequeDetails?.chequeDate || ''}
                      onChange={(e) => setDamStockInForm(prev => ({
                        ...prev,
                        chequeDetails: { ...(prev.chequeDetails || {}), chequeDate: e.target.value }
                      }))}
                      className="w-full h-7 bg-blue-50/40 border border-blue-200 rounded-lg px-2 text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Row 2: Remaining Khata Due Banner */}
            <div className="h-8 bg-white/95 border border-amber-300 rounded-lg px-3 flex items-center justify-between shadow-2xs">
              <span className="text-[10.5px] font-bold text-amber-800">Remaining Khata Due:</span>
              <span className="text-xs font-black font-mono text-rose-600">
                ₹{Math.max(0, Number((Math.max(0, Number(damTotals.netSettlement || 0)) - (Number(damStockInForm.partialPaid) || 0)).toFixed(2))).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* 4b. Mixed / Split Payment Breakdown Panel */}
        {damStockInForm.paymentMode === 'Mixed' && (() => {
          const net = Math.max(0, Number(damTotals.netSettlement || 0));
          const sp = damStockInForm.splitPayments || {};
          const c = Number(sp.cash || 0);
          const u = Number(sp.upi || 0);
          const b = Number(sp.bank || 0);
          const ch = Number(sp.cheque || 0);
          const totalAllocated = Number((c + u + b + ch).toFixed(2));
          const rem = Number((net - totalAllocated).toFixed(2));
          const isFullyAllocated = Math.abs(rem) < 0.01;

          return (
            <div className="p-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 rounded-xl border border-blue-200 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-900 flex items-center gap-1.5">
                  <PieChart size={13} className="text-indigo-600" /> Mixed Split Payments
                </span>
                <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-md ${
                  isFullyAllocated
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : rem > 0
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}>
                  Allocated: ₹{totalAllocated.toLocaleString()} / ₹{net.toLocaleString()}
                  {!isFullyAllocated && ` (${rem > 0 ? `₹${rem} remaining` : `₹${Math.abs(rem)} over`})`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'cash', label: 'Cash (₹)' },
                  { key: 'upi', label: 'UPI / GPay (₹)' },
                  { key: 'bank', label: 'Bank Transfer (₹)' },
                  { key: 'cheque', label: 'Cheque (₹)' }
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">{field.label}</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={damStockInForm.splitPayments?.[field.key] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                        setDamStockInForm(prev => {
                          const updated = {
                            ...(prev.splitPayments || {}),
                            [field.key]: val
                          };
                          const sum = Number((Number(updated.cash || 0) + Number(updated.upi || 0) + Number(updated.bank || 0) + Number(updated.cheque || 0)).toFixed(2));
                          const due = Math.max(0, Number((net - sum).toFixed(2)));
                          return {
                            ...prev,
                            splitPayments: updated,
                            paidAmount: sum,
                            dueAmount: due
                          };
                        });
                      }}
                      className="w-full h-8 bg-white border border-blue-200 rounded-lg px-2.5 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* 4c. Cheque Details Panel */}
        {damStockInForm.paymentMode === 'Cheque' && (
          <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 space-y-2 animate-in fade-in">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
              <FileText size={13} className="text-blue-600" /> Cheque Payment Details
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cheque Number</label>
                <input
                  type="text"
                  placeholder="e.g. CHQ-482910"
                  value={damStockInForm.chequeDetails?.chequeNumber || ''}
                  onChange={(e) => setDamStockInForm(prev => ({
                    ...prev,
                    chequeDetails: { ...(prev.chequeDetails || {}), chequeNumber: e.target.value }
                  }))}
                  className="w-full h-8 bg-white border border-blue-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Bank Name</label>
                <input
                  type="text"
                  placeholder="e.g. SBI, HDFC"
                  value={damStockInForm.chequeDetails?.bankName || ''}
                  onChange={(e) => setDamStockInForm(prev => ({
                    ...prev,
                    chequeDetails: { ...(prev.chequeDetails || {}), bankName: e.target.value }
                  }))}
                  className="w-full h-8 bg-white border border-blue-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">Cheque Date</label>
                <input
                  type="date"
                  value={damStockInForm.chequeDetails?.chequeDate || ''}
                  onChange={(e) => setDamStockInForm(prev => ({
                    ...prev,
                    chequeDetails: { ...(prev.chequeDetails || {}), chequeDate: e.target.value }
                  }))}
                  className="w-full h-8 bg-white border border-blue-200 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4d. Bank Transfer Details Panel */}
        {damStockInForm.paymentMode === 'Bank Transfer' && (
          <div className="p-2 sm:p-2.5 bg-blue-50/70 rounded-lg sm:rounded-xl border border-blue-200 space-y-1.5 animate-in fade-in">
            <span className="text-[10px] sm:text-xs font-bold text-blue-900 flex items-center gap-1">
              <Landmark size={11} className="text-blue-600 shrink-0" /> Bank Transfer / RTGS / NEFT Details
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">Transaction ID / UTR</label>
                <input
                  type="text"
                  placeholder="e.g. UTR49281039401"
                  value={damStockInForm.bankDetails?.transactionId || ''}
                  onChange={(e) => setDamStockInForm(prev => ({
                    ...prev,
                    bankDetails: { ...(prev.bankDetails || {}), transactionId: e.target.value }
                  }))}
                  className="w-full h-7 sm:h-8 bg-white border border-blue-200 rounded-lg px-2 text-[11px] sm:text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">Bank / Account</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC Current A/C"
                  value={damStockInForm.bankDetails?.bankName || ''}
                  onChange={(e) => setDamStockInForm(prev => ({
                    ...prev,
                    bankDetails: { ...(prev.bankDetails || {}), bankName: e.target.value }
                  }))}
                  className="w-full h-7 sm:h-8 bg-white border border-blue-200 rounded-lg px-2 text-[11px] sm:text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4e. Credit / Khata Note */}
        {damStockInForm.paymentMode === 'Credit' && (
          <div className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-rose-50/80 rounded-lg sm:rounded-xl border border-rose-200 flex items-center justify-between gap-1.5 text-[10px] sm:text-xs animate-in fade-in">
            <span className="font-bold text-rose-800 flex items-center gap-1 shrink-0">
              <BookOpen size={11} className="text-rose-600 shrink-0" /> Pay Later (Khata)
            </span>
            <span className="text-[9.5px] sm:text-[11px] text-rose-700 text-right truncate">
              <strong className="font-mono font-bold text-rose-900">₹{Math.max(0, Number(damTotals.netSettlement || 0)).toLocaleString()}</strong> logged as due in SRM
            </span>
          </div>
        )}

        {/* 5. Compact Dam Settlement Summary & Actions Strip */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-50 p-2.5 sm:px-4 sm:py-2 rounded-xl border border-blue-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="font-extrabold text-slate-800 uppercase tracking-wide text-[11px] mr-1">Dam Settlement:</span>
            <span className="text-slate-600">Weight: <strong className="font-mono text-slate-900 font-bold">{damTotals.totalKg} Kg</strong></span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">Catch: <strong className="font-mono text-slate-900 font-bold">₹{damTotals.catchTotal.toLocaleString('en-IN')}</strong></span>
            {damTotals.totalCr > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700">Cr: <strong className="font-mono font-bold">+₹{damTotals.totalCr.toLocaleString('en-IN')}</strong></span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="text-rose-700">Dr: <strong className="font-mono font-bold">-₹{damTotals.totalDr.toLocaleString('en-IN')}</strong></span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 shrink-0 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-blue-200/60 w-full sm:w-auto">
            <div className="text-left sm:text-right shrink-0">
              <div className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-none">
                {damTotals.netSettlement >= 0 ? 'Payable' : 'Due'}
              </div>
              <div className={`text-sm sm:text-base font-black font-mono leading-tight mt-0.5 ${damTotals.netSettlement >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                ₹{Math.abs(damTotals.netSettlement).toLocaleString('en-IN')}
              </div>

            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handlePrintDamInvoice}
                className="h-8 sm:h-9 w-8 sm:w-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                title="Print A4 Consignment Voucher"
              >
                <Printer size={14} />
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-[11px] sm:text-xs shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
              >
                <CheckCircle size={13} />
                <span className="sm:hidden">{submitting ? 'Recording...' : 'Confirm'}</span>
                <span className="hidden sm:inline">{submitting ? 'Recording...' : 'Confirm Consignment'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default DamStockInTab;

