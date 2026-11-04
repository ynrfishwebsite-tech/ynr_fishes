import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ShoppingCart, Minus, Plus, Scale, Package } from 'lucide-react';

export default function Fish3DRoller({
  items = [],
  activeIndex = 0,
  setActiveIndex,
  fishOrderMode = 'retail',
  getItemPricePerKg,
  detectItemSizeGrade,
  formatKgFraction,
  formatImageUrl,
  onSelectItem,
  onAddBox,
  triggerFlyAnimation,
  language = 'en',
  t = (s) => s,
  isLocked = false,
  orderStatus = '',
  hasPendingChanges = false,
  showToast,
  setShowBoxPacker,
  openBoxPackerModal,
  showImages = true,
  showAnimation = true
}) {
  // Always clamp activeIndex to valid bounds so filtering/searching never causes blank screen
  const safeActiveIndex = items && items.length > 0
    ? Math.max(0, Math.min(activeIndex, items.length - 1))
    : 0;

  // Auto-sync parent activeIndex if out of bounds after filtering/searching
  useEffect(() => {
    if (items && items.length > 0 && activeIndex >= items.length) {
      if (setActiveIndex) setActiveIndex(0);
    }
  }, [items, activeIndex, setActiveIndex]);

  const currentItem = items && items.length > 0 ? items[safeActiveIndex] : null;
  const prevItem = safeActiveIndex > 0 ? items[safeActiveIndex - 1] : null;
  const nextItem = items && safeActiveIndex < items.length - 1 ? items[safeActiveIndex + 1] : null;

  // Weight & Weighing States - Defaults to 1.000 Kg and Small Grade
  const [weightKg, setWeightKg] = useState('1.000');
  const [selectedCutType, setSelectedCutType] = useState('Whole');
  const [tareGrams, setTareGrams] = useState(0);
  const [gradeOverride, setGradeOverride] = useState('small');

  // Wholesale Box States
  const [boxCount, setBoxCount] = useState(1);
  const [boxWeightKg, setBoxWeightKg] = useState('50');

  const cardRef = useRef(null);
  const wheelLockRef = useRef(false);
  const touchStartXRef = useRef(null);

  // Sync state when active item changes - Default to 1.000 Kg & Small grade
  useEffect(() => {
    setGradeOverride('small');
    setWeightKg('1.000');
    setTareGrams(0);
    if (currentItem?.boxPackingKg) {
      setBoxWeightKg(String(currentItem.boxPackingKg));
    }
  }, [currentItem?._id]);

  const isBoxBasedMode = fishOrderMode === 'bulk' || fishOrderMode === 'export';

  // Calculations for Retail Weight & Tare
  const rawKg = parseFloat(weightKg) || 0;
  const grossGrams = Math.round(rawKg * 1000);
  const netGrams = Math.max(0, grossGrams - tareGrams);
  const netKg = netGrams / 1000;

  // Auto-detect grade & rate
  const autoGrade = currentItem && detectItemSizeGrade ? detectItemSizeGrade(currentItem, netKg) : 'small';
  const activeGrade = gradeOverride || autoGrade;

  const activeRate = currentItem && getItemPricePerKg
    ? getItemPricePerKg(currentItem, fishOrderMode, activeGrade)
    : (currentItem?.price || 0);

  const totalAmount = parseFloat((netKg * activeRate).toFixed(2));
  const fractionLabel = formatKgFraction ? formatKgFraction(netKg) : `${netKg.toFixed(3)} Kg`;

  // Calculations for Wholesale & Export Box Mode
  const boxRate = currentItem
    ? (fishOrderMode === 'export'
        ? (parseFloat(currentItem.exportPricePerKg) || parseFloat(currentItem.wholesalePricePerKg) || parseFloat(currentItem.price) || 0)
        : (parseFloat(currentItem.wholesalePricePerKg) || parseFloat(currentItem.price) || 0))
    : 0;
  const totalBoxWeightKg = boxCount * (parseFloat(boxWeightKg) || 0);
  const totalBoxPrice = parseFloat((totalBoxWeightKg * boxRate).toFixed(2));

  // Stepper Handlers
  const handleDecreaseWeight = () => {
    setWeightKg((prev) => {
      const val = parseFloat(prev) || 0;
      const next = Math.max(0.25, val - 0.5);
      return next.toFixed(3);
    });
  };

  const handleIncreaseWeight = () => {
    setWeightKg((prev) => {
      const val = parseFloat(prev) || 0;
      const next = val + 0.5;
      return next.toFixed(3);
    });
  };

  // Keyboard navigation & F2/Enter to add
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        if (safeActiveIndex < items.length - 1) setActiveIndex((prev) => Math.min(items.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (safeActiveIndex > 0) setActiveIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'F2' || e.key === 'Enter') {
        e.preventDefault();
        handleAddCurrentToBill();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeActiveIndex, items.length, netKg, activeRate, currentItem, boxCount, totalBoxWeightKg, totalBoxPrice]);

  // Horizontal Wheel / Trackpad swipe
  const handleWheel = (e) => {
    if (wheelLockRef.current) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 25) return;

    if (delta > 0 && safeActiveIndex < items.length - 1) {
      wheelLockRef.current = true;
      setActiveIndex((prev) => Math.min(items.length - 1, prev + 1));
      setTimeout(() => { wheelLockRef.current = false; }, 260);
    } else if (delta < 0 && safeActiveIndex > 0) {
      wheelLockRef.current = true;
      setActiveIndex((prev) => Math.max(0, prev - 1));
      setTimeout(() => { wheelLockRef.current = false; }, 260);
    }
  };

  // Touch Swipe for mobile/tablet
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (diff > 45 && safeActiveIndex < items.length - 1) {
      setActiveIndex((prev) => Math.min(items.length - 1, prev + 1));
    } else if (diff < -45 && safeActiveIndex > 0) {
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }
    touchStartXRef.current = null;
  };

  // Add Item to Order Cart
  const handleAddCurrentToBill = () => {
    if (!currentItem) return;
    if (isLocked || (orderStatus === 'Billed' && !hasPendingChanges)) {
      if (showToast) showToast(t("Order is billed. Click EDIT to modify."), 'warning');
      return;
    }

    if (isBoxBasedMode) {
      if (totalBoxWeightKg <= 0) {
        if (showToast) showToast('Please enter valid box count and weight', 'error');
        return;
      }
      const itemToAdd = {
        ...currentItem,
        itemKey: `${currentItem._id}_box_${boxCount}boxes_${fishOrderMode}_${Date.now()}`,
        menuItem: currentItem._id,
        originalId: currentItem._id,
        originalFishName: currentItem.name,
        name: `${currentItem.name} (${boxCount} Box${boxCount > 1 ? 'es' : ''} - ${totalBoxWeightKg} Kg)`,
        price: totalBoxPrice,
        total: totalBoxPrice,
        quantity: boxCount,
        sellingUnit: 'Box',
        boxCount: boxCount,
        enteredWeight: totalBoxWeightKg,
        netWeightKg: totalBoxWeightKg,
        grossWeightKg: totalBoxWeightKg,
        pricePerKg: boxRate,
        orderMode: fishOrderMode
      };

      if (triggerFlyAnimation && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        triggerFlyAnimation(
          rect.left + rect.width / 2,
          rect.top + 100,
          currentItem.name,
          formatImageUrl(currentItem.image)
        );
      }

      onSelectItem(itemToAdd);
      if (showToast) showToast(`Added ${boxCount} Box of ${currentItem.name}`, 'success');
      return;
    }

    if (netKg <= 0) {
      if (showToast) showToast('Please enter a valid weight in Kilograms', 'error');
      return;
    }

    const itemToAdd = {
      ...currentItem,
      itemKey: `${currentItem._id}_${selectedCutType}_${netGrams}g_${activeGrade}_${fishOrderMode}`,
      menuItem: currentItem._id,
      originalId: currentItem._id,
      originalFishName: currentItem.name,
      name: `${currentItem.name} (${selectedCutType} - ${fractionLabel})`,
      price: totalAmount,
      total: totalAmount,
      quantity: 1,
      sellingUnit: 'Kg',
      enteredWeight: netKg,
      netWeightKg: netKg,
      grossWeightKg: netKg,
      pricePerKg: activeRate,
      sizeGrade: activeGrade,
      orderMode: fishOrderMode,
      cutType: selectedCutType,
      yieldFactor: 1.0,
      tareWeightKg: (tareGrams / 1000)
    };

    if (triggerFlyAnimation && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      triggerFlyAnimation(
        rect.left + rect.width / 2,
        rect.top + 100,
        currentItem.name,
        formatImageUrl(currentItem.image)
      );
    }

    onSelectItem(itemToAdd);
  };

  if (!items || items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center my-auto min-h-[360px]">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-3 text-amber-800 shadow-inner">
          <Scale size={32} className="text-amber-700 animate-pulse" />
        </div>
        <h3 className="text-base font-black text-slate-800">No matching seafood items found</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          No items match your active search or filters. Try clearing your search or switching species / water type.
        </p>
      </div>
    );
  }

  // Pre-calculate grade thresholds
  const smallMax = parseFloat(currentItem?.sizeGrades?.small?.maxKg) || 1;
  const mediumMax = parseFloat(currentItem?.sizeGrades?.medium?.maxKg) || 4;

  return (
    <div
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full flex flex-col justify-between overflow-y-auto md:overflow-hidden py-1 sm:py-2 md:py-3 px-1 md:px-2 select-none ${showAnimation ? '' : 'transition-none'}`}
    >
      {/* 3D HORIZONTAL CAROUSEL VIEWPORT */}
      <div
        className="relative w-full flex-1 flex items-center justify-center min-h-0 md:min-h-[460px] px-1 sm:px-4 md:px-6"
        style={{ perspective: '1400px', transformStyle: 'preserve-3d' }}
      >
        {/* Left Circular Navigation Arrow */}
        <button
          type="button"
          disabled={safeActiveIndex === 0}
          onClick={() => setActiveIndex(Math.max(0, safeActiveIndex - 1))}
          className="absolute left-0.5 sm:left-2 md:left-3 z-30 w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-amber-800 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-all"
          title="Previous Item (Left Arrow)"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
        </button>

        {/* 1. LEFT PEEK ITEM (3D Tilted, Scaled Down & Soft Blurred) */}
        {prevItem && (
          <div
            onClick={() => setActiveIndex(safeActiveIndex - 1)}
            style={{
              transform: 'translateX(-52%) scale(0.80) rotateY(18deg)',
              transformOrigin: 'right center',
              filter: 'blur(2.5px)',
              opacity: 0.5,
              zIndex: 5
            }}
            className={`hidden md:flex absolute left-6 w-[300px] bg-white rounded-3xl p-4 border border-slate-200/80 shadow-md cursor-pointer hover:opacity-75 flex-col items-center text-center pointer-events-auto ${showAnimation ? 'transition-all duration-300' : 'transition-none'}`}
          >
            {showImages ? (
              <div className="relative w-full h-40 rounded-2xl bg-slate-100 overflow-hidden mb-2">
                <span className="absolute top-2 left-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/90 text-amber-800 shadow-xs border border-amber-200">
                  {isBoxBasedMode ? 'Box' : 'KG'}
                </span>
                <img
                  src={formatImageUrl(prevItem.image)}
                  alt={prevItem.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-20 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white text-amber-800 border border-amber-200">
                  {isBoxBasedMode ? 'Box' : 'KG'}
                </span>
              </div>
            )}
            <h4 className="text-sm font-black text-slate-800 line-clamp-1">{prevItem.name}</h4>
            {prevItem.scientificName && (
              <p className="text-[11px] text-slate-400 italic line-clamp-1">{prevItem.scientificName}</p>
            )}
          </div>
        )}

        {/* 2. CENTER ACTIVE SPOTLIGHT CARD (Sleek, Hero Photo, Compact Controls) */}
        {currentItem && (
          <div
            ref={cardRef}
            style={{
              transform: 'translateX(0) scale(1) rotateY(0deg)',
              zIndex: 20,
              boxShadow: '0 20px 50px -10px rgba(245, 158, 11, 0.22), 0 0 0 1.5px rgba(251, 191, 36, 0.45)'
            }}
            className={`relative w-full max-w-2xl sm:max-w-3xl bg-white rounded-2xl md:rounded-3xl p-2.5 sm:p-3 md:p-5 border border-amber-200/80 flex flex-col md:flex-row gap-2 sm:gap-3 md:gap-5 items-stretch ${showAnimation ? 'transition-all duration-300' : 'transition-none'}`}
          >
            {/* Left Column: Big Hero Fish Photo or Clean Specs Box */}
            {showImages ? (
              <div className="w-full md:w-72 flex flex-col justify-between shrink-0">
                <div className="relative w-full h-24 sm:h-36 md:h-64 rounded-xl md:rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 shadow-inner group">
                  <span className="absolute top-1.5 left-1.5 md:top-3 md:left-3 text-[9px] md:text-xs font-black uppercase px-1.5 py-0.5 md:px-2.5 md:py-1 rounded md:rounded-lg bg-white/95 text-amber-900 shadow-sm border border-amber-200 z-10">
                    {isBoxBasedMode ? 'Box' : 'KG'}
                  </span>

                  {currentItem.waterType && (
                    <span className="absolute top-1.5 right-1.5 md:top-3 md:right-3 text-[8px] md:text-[10px] font-black uppercase px-1.5 py-0.5 rounded md:rounded-lg bg-slate-900/80 text-white backdrop-blur-sm z-10">
                      {currentItem.waterType === 'fresh_water' ? 'Fresh Water' : 'Sea Water'}
                    </span>
                  )}

                  <img
                    src={formatImageUrl(currentItem.image)}
                    alt={currentItem.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Subtitle pill at bottom of photo */}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 md:bottom-2 md:left-2 md:right-2 flex items-center justify-between text-[9px] md:text-[11px]">
                    <span className="font-bold px-1.5 py-0.5 md:px-2 md:py-0.5 rounded bg-black/60 text-white backdrop-blur-md capitalize">
                      {isBoxBasedMode ? (fishOrderMode === 'export' ? 'Export Box' : 'Wholesale Box') : `Grade: ${activeGrade}`}
                    </span>
                    <span className="font-black px-1.5 py-0.5 md:px-2 md:py-0.5 rounded bg-emerald-600/90 text-white backdrop-blur-md font-mono">
                      ₹{isBoxBasedMode ? boxRate : activeRate}/Kg
                    </span>
                  </div>
                </div>

                {/* Net Scale Weight Pill right under the photo */}
                <div className="mt-1 md:mt-2 py-0.5 md:py-1.5 px-2 md:px-3 rounded-lg md:rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between text-[10px] md:text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <Scale size={12} className="text-amber-700 md:w-3.5 md:h-3.5" />
                    {isBoxBasedMode ? 'Total Weight:' : 'Net Weight:'}
                  </span>
                  <span className="font-black text-slate-900 font-mono">
                    {isBoxBasedMode ? `${totalBoxWeightKg} Kg (${boxCount} Box${boxCount > 1 ? 'es' : ''})` : `${fractionLabel} (${netKg.toFixed(3)} Kg)`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full md:w-56 flex flex-col justify-between shrink-0 bg-amber-50/50 border border-amber-200 rounded-xl md:rounded-2xl p-2 md:p-3 text-center">
                <div className="flex flex-col items-center justify-center flex-1 py-1.5 md:py-4">
                  <span className="text-[10px] md:text-xs font-black uppercase px-2 py-0.5 md:px-2.5 md:py-1 rounded-md md:rounded-lg bg-white text-amber-900 border border-amber-300 shadow-xs mb-1 md:mb-2">
                    {isBoxBasedMode ? 'Box Mode' : 'KG Mode'}
                  </span>
                  <Scale size={24} className="text-amber-700 my-1 md:my-2 md:w-9 md:h-9" />
                  <span className="text-[10px] md:text-xs font-bold text-slate-700 capitalize">
                    {isBoxBasedMode ? (fishOrderMode === 'export' ? 'Export Box' : 'Wholesale Box') : `Grade: ${activeGrade}`}
                  </span>
                  <span className="text-xs md:text-sm font-black text-emerald-800 font-mono mt-0.5 md:mt-1">
                    ₹{isBoxBasedMode ? boxRate : activeRate}/Kg
                  </span>
                  {currentItem.waterType && (
                    <span className="text-[8px] md:text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-900/80 text-white mt-1 md:mt-2">
                      {currentItem.waterType === 'fresh_water' ? 'Fresh Water' : 'Sea Water'}
                    </span>
                  )}
                </div>
                <div className="py-1 md:py-1.5 px-2 rounded-lg md:rounded-xl bg-white border border-amber-200 text-[10px] md:text-xs flex justify-between items-center font-bold">
                  <span>{isBoxBasedMode ? 'Total:' : 'Net:'}</span>
                  <span className="font-mono text-slate-900">
                    {isBoxBasedMode ? `${totalBoxWeightKg} Kg` : `${fractionLabel}`}
                  </span>
                </div>
              </div>
            )}

            {/* Right Column: Title, Sleek 1-Line Size Grades, Cuts, Stepper with Shortcuts & Add Button */}
            <div className="w-full flex-1 flex flex-col justify-between space-y-1.5 md:space-y-2">
              {/* Fish Title & Scientific Name */}
              <div>
                <h3 className="text-sm sm:text-base md:text-xl font-black text-slate-900 leading-tight">
                  {(language !== 'en' && currentItem.nameTranslations?.[language]) || currentItem.name}
                </h3>
                {currentItem.scientificName && (
                  <p className="text-[10px] md:text-xs text-slate-400 font-medium italic mt-0.5">
                    {currentItem.scientificName}
                  </p>
                )}
              </div>

              {/* RETAIL CONTROLS */}
              {!isBoxBasedMode ? (
                <>
                  {/* 1. Sleek 1-Line Segmented Size Grade Strip (Small, Medium, Big) */}
                  <div className="space-y-0.5 md:space-y-1">
                    <div className="flex justify-between items-center text-[10px] md:text-[11px] font-bold text-slate-600">
                      <span>Fish Size Grade</span>
                      <span className="text-amber-800 font-semibold capitalize">{activeGrade} (₹{activeRate}/Kg)</span>
                    </div>
                    {(() => {
                      const availableGrades = [
                        { key: 'small', label: 'Small', range: `0-${smallMax}k`, rate: currentItem?.sizeGrades?.small?.price || activeRate, enabled: currentItem?.sizeGrades?.small?.enabled !== false },
                        { key: 'medium', label: 'Medium', range: `${smallMax}-${mediumMax}k`, rate: currentItem?.sizeGrades?.medium?.price || activeRate, enabled: currentItem?.sizeGrades?.medium?.enabled !== false },
                        { key: 'big', label: 'Big', range: `${mediumMax}+k`, rate: currentItem?.sizeGrades?.big?.price || activeRate, enabled: currentItem?.sizeGrades?.big?.enabled !== false }
                      ].filter(g => g.enabled);

                      return (
                        <div className={`grid gap-1 bg-slate-100 p-0.5 rounded-lg md:rounded-xl border border-slate-200 ${
                          availableGrades.length === 1 ? 'grid-cols-1' : availableGrades.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                        }`}>
                          {availableGrades.map((grade) => {
                            const isSelected = activeGrade === grade.key;
                            return (
                              <button
                                key={grade.key}
                                type="button"
                                onClick={() => setGradeOverride(grade.key)}
                                className={`py-0.5 md:py-1 px-1 md:px-1.5 rounded-md md:rounded-lg text-center transition-all cursor-pointer flex items-center justify-center gap-0.5 md:gap-1 ${
                                  isSelected
                                    ? 'bg-amber-600 text-white shadow-xs font-black'
                                    : 'text-slate-700 hover:bg-white font-bold'
                                }`}
                              >
                                <span className="text-[10px] md:text-xs">{grade.label}</span>
                                <span className={`text-[8.5px] md:text-[10px] font-mono ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                                  ({grade.range})
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* 2. Cutting Style (High Contrast 1-Line Pills) */}
                  <div className="space-y-0.5 md:space-y-1">
                    <div className="flex justify-between items-center text-[10px] md:text-[11px] font-bold text-slate-600">
                      <span>Cutting Style</span>
                      <span className="text-amber-800 font-black">{selectedCutType}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-0.5 md:gap-1">
                      {[
                        { name: 'Whole', label: 'Whole' },
                        { name: 'Cleaned', label: 'Clean' },
                        { name: 'Curry Cut', label: 'Curry' },
                        { name: 'Fry Cut', label: 'Fry' },
                        { name: 'Boneless Fillet', label: 'Boneless' }
                      ].map((cut) => {
                        const isSelected = selectedCutType === cut.name;
                        return (
                          <button
                            key={cut.name}
                            type="button"
                            onClick={() => setSelectedCutType(cut.name)}
                            className={`py-0.5 md:py-1 px-0.5 md:px-1 rounded-md md:rounded-lg text-[10px] md:text-xs font-bold transition-all cursor-pointer text-center ${
                              isSelected
                                ? 'bg-amber-800 text-white font-black shadow-xs ring-1 md:ring-2 ring-amber-700/30'
                                : 'bg-white text-slate-700 border border-slate-300 hover:bg-amber-50'
                            }`}
                          >
                            {cut.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Weight Stepper with Direct Input */}
                  <div className="space-y-0.5 md:space-y-1">
                    <div className="flex items-center justify-between bg-[#fffbf2] border-2 border-amber-200 rounded-xl md:rounded-2xl p-0.5 md:p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={handleDecreaseWeight}
                        className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white hover:bg-amber-50 text-slate-700 font-bold text-sm md:text-lg flex items-center justify-center shadow-xs border border-amber-200 cursor-pointer transition-colors active:scale-95"
                      >
                        <Minus size={14} className="md:w-4 md:h-4" />
                      </button>

                      <div className="flex-1 flex items-center justify-center">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value)}
                          className="text-base sm:text-lg md:text-2xl font-black text-slate-900 font-mono tracking-wider text-center bg-transparent focus:outline-none w-24 sm:w-28 md:w-32"
                        />
                        <span className="text-[10px] md:text-xs font-bold text-slate-500">Kg</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleIncreaseWeight}
                        className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-white hover:bg-amber-50 text-slate-700 font-bold text-sm md:text-lg flex items-center justify-center shadow-xs border border-amber-200 cursor-pointer transition-colors active:scale-95"
                      >
                        <Plus size={14} className="md:w-4 md:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 4. Single Combined Shortcuts Row: Presets + Fractions + Tare */}
                  <div className="flex items-center gap-0.5 md:gap-1 overflow-x-auto pb-0.5 text-[10px] md:text-xs [&::-webkit-scrollbar]:hidden">
                    {/* Common Kg Presets */}
                    {['1', '2', '5', '10'].map((kgVal) => (
                      <button
                        key={kgVal}
                        type="button"
                        onClick={() => setWeightKg(parseFloat(kgVal).toFixed(3))}
                        className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                          parseFloat(weightKg) === parseFloat(kgVal)
                            ? 'bg-amber-700 text-white font-black shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-amber-100 border border-slate-200'
                        }`}
                      >
                        {kgVal}k
                      </button>
                    ))}

                    <div className="h-3 md:h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

                    {/* Fractions */}
                    {[
                      { g: 0.25, label: '+¼k' },
                      { g: 0.5, label: '+½k' }
                    ].map((frac) => (
                      <button
                        key={frac.label}
                        type="button"
                        onClick={() => {
                          const base = Math.floor(parseFloat(weightKg) || 0);
                          setWeightKg((base + frac.g).toFixed(3));
                        }}
                        className="px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg font-bold shrink-0 bg-slate-100 text-slate-700 hover:bg-amber-50 border border-slate-200 transition-all cursor-pointer"
                      >
                        {frac.label}
                      </button>
                    ))}

                    <div className="h-3 md:h-4 w-px bg-slate-300 mx-0.5 shrink-0" />

                    {/* Tare */}
                    {[0, 50].map((tg) => (
                      <button
                        key={tg}
                        type="button"
                        onClick={() => setTareGrams(tg)}
                        className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md md:rounded-lg font-bold shrink-0 cursor-pointer transition-colors ${
                          tareGrams === tg && tg !== 0
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {tg === 0 ? 'Tare 0' : '-50g'}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                /* WHOLESALE & EXPORT BOX PACKER CONTROLS */
                <div className="space-y-1 md:space-y-2 bg-[#fffbf2] border-2 border-amber-200 p-1.5 md:p-2.5 rounded-xl md:rounded-2xl">
                  <div className="flex justify-between items-center text-[10px] md:text-xs font-bold text-slate-700">
                    <span>{fishOrderMode === 'export' ? 'Export Boxes' : 'Wholesale Boxes'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (openBoxPackerModal) {
                          openBoxPackerModal(currentItem);
                        } else if (setShowBoxPacker) {
                          setShowBoxPacker(true);
                        }
                      }}
                      className="text-[10px] md:text-xs font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer flex items-center gap-1"
                    >
                      <Package size={12} className="md:w-3.5 md:h-3.5" />
                      <span>+ Multi-Fish Mixer</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                    <div className="space-y-0.5 md:space-y-1">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-600 block">Boxes</label>
                      <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg md:rounded-xl p-0.5 md:p-1">
                        <button
                          type="button"
                          onClick={() => setBoxCount((prev) => Math.max(1, prev - 1))}
                          className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-slate-100 hover:bg-amber-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Minus size={11} className="md:w-3.5 md:h-3.5" />
                        </button>
                        <span className="text-xs md:text-base font-black text-slate-900 font-mono">{boxCount} Box</span>
                        <button
                          type="button"
                          onClick={() => setBoxCount((prev) => prev + 1)}
                          className="w-6 h-6 md:w-7 md:h-7 rounded-md md:rounded-lg bg-slate-100 hover:bg-amber-100 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Plus size={11} className="md:w-3.5 md:h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-0.5 md:space-y-1">
                      <label className="text-[10px] md:text-[11px] font-bold text-slate-600 block">Kg / Box</label>
                      <input
                        type="number"
                        min="1"
                        value={boxWeightKg}
                        onChange={(e) => setBoxWeightKg(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg md:rounded-xl px-2 py-1 md:px-2.5 md:py-1.5 text-xs md:text-base font-black text-slate-900 font-mono focus:outline-none focus:border-amber-600"
                      />
                    </div>
                  </div>

                  <div className="p-1 md:p-1.5 bg-amber-100/70 rounded-lg md:rounded-xl text-[10px] md:text-xs flex justify-between items-center font-bold text-amber-950">
                    <span>Total Weight:</span>
                    <span className="font-mono text-xs md:text-sm">{totalBoxWeightKg} Kg</span>
                  </div>
                </div>
              )}

              {/* 5. Rate Display & Big Solid Emerald Green Add to Bill Button */}
              <div className="flex flex-row md:grid md:grid-cols-12 gap-1.5 md:gap-2 pt-0.5 md:pt-1 items-center">
                <div className="shrink-0 md:col-span-5 bg-[#f8fafc] border border-slate-200 rounded-xl md:rounded-2xl px-2 py-1 md:px-3 md:py-2 flex items-center gap-2.5 md:justify-between shadow-2xs">
                  <div>
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 block uppercase">Rate</span>
                    <span className="text-xs md:text-sm font-black text-slate-900 font-mono">
                      ₹{isBoxBasedMode ? boxRate.toFixed(2) : activeRate.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] md:text-[10px] font-bold text-emerald-700 block uppercase">Total</span>
                    <span className="text-xs md:text-base font-black text-emerald-700 font-mono">
                      ₹{isBoxBasedMode ? totalBoxPrice.toFixed(2) : totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="flex-1 md:col-span-7">
                  <button
                    type="button"
                    disabled={isBoxBasedMode ? totalBoxWeightKg <= 0 : netKg <= 0}
                    onClick={handleAddCurrentToBill}
                    className="w-full py-2 md:py-2.5 px-2.5 md:px-4 rounded-xl md:rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-xs md:text-base shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-1.5 md:gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart size={15} className="shrink-0 md:w-4 md:h-4" />
                    <span>+ Add to Bill</span>
                    <span className="font-mono bg-white/20 px-1.5 md:px-2 py-0.5 rounded md:rounded-lg text-[10px] md:text-xs font-bold">
                      ₹{isBoxBasedMode ? totalBoxPrice.toFixed(2) : totalAmount.toFixed(2)}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. RIGHT PEEK ITEM (3D Tilted, Scaled Down & Soft Blurred) */}
        {nextItem && (
          <div
            onClick={() => setActiveIndex(safeActiveIndex + 1)}
            style={{
              transform: 'translateX(52%) scale(0.80) rotateY(-18deg)',
              transformOrigin: 'left center',
              filter: 'blur(2.5px)',
              opacity: 0.5,
              zIndex: 5
            }}
            className={`hidden md:flex absolute right-6 w-[300px] bg-white rounded-3xl p-4 border border-slate-200/80 shadow-md cursor-pointer hover:opacity-75 flex-col items-center text-center pointer-events-auto ${showAnimation ? 'transition-all duration-300' : 'transition-none'}`}
          >
            {showImages ? (
              <div className="relative w-full h-40 rounded-2xl bg-slate-100 overflow-hidden mb-2">
                <span className="absolute top-2 left-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white/90 text-amber-800 shadow-xs border border-amber-200">
                  {isBoxBasedMode ? 'Box' : 'KG'}
                </span>
                <img
                  src={formatImageUrl(nextItem.image)}
                  alt={nextItem.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full h-20 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-white text-amber-800 border border-amber-200">
                  {isBoxBasedMode ? 'Box' : 'KG'}
                </span>
              </div>
            )}
            <h4 className="text-sm font-black text-slate-800 line-clamp-1">{nextItem.name}</h4>
            {nextItem.scientificName && (
              <p className="text-[11px] text-slate-400 italic line-clamp-1">{nextItem.scientificName}</p>
            )}
          </div>
        )}

        {/* Right Circular Navigation Arrow */}
        <button
          type="button"
          disabled={safeActiveIndex >= items.length - 1}
          onClick={() => setActiveIndex(Math.min(items.length - 1, safeActiveIndex + 1))}
          className="absolute right-0.5 sm:right-2 md:right-3 z-30 w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-full bg-white shadow-lg border border-slate-200 flex items-center justify-center text-slate-700 hover:text-amber-800 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-all"
          title="Next Item (Right Arrow)"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
        </button>
      </div>

      {/* Pagination Indicator Dots */}
      <div className="flex items-center justify-center gap-1.5 my-1 md:my-1.5">
        {items.slice(0, Math.min(items.length, 9)).map((_, idx) => {
          const isCurrent = idx === (safeActiveIndex % 9);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`rounded-full transition-all cursor-pointer ${
                isCurrent
                  ? 'w-3 md:w-4 h-2 md:h-2.5 bg-amber-500'
                  : 'w-2 md:w-2.5 h-2 md:h-2.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
