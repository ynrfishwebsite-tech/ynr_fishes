import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Scale,
  Package,
  Boxes,
  Award,
  Tag,
  Calculator,
  X,
  Check,
  CheckCircle,
  Sparkles,
  Lock,
  Unlock,
  Fish
} from 'lucide-react';
import { getItemWaterType, getItemSpeciesType } from '../catalog/MenuGrid';

// Robust seafood photo URL resolver
export const formatImageUrl = (url) => {
  if (!url) return '';
  let trimmed = String(url).trim();
  if (!trimmed || trimmed === '""' || trimmed === "''" || trimmed === 'null' || trimmed === 'undefined') return '';

  if (trimmed.includes('google.com/imgres') || trimmed.includes('imgurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('imgurl');
      if (extracted) trimmed = extracted;
    } catch (e) {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) trimmed = decodeURIComponent(match[1]);
    }
  } else if (trimmed.includes('mediaurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('mediaurl');
      if (extracted) trimmed = extracted;
    } catch (e) { }
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]{30,}$/.test(trimmed) || trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('R0lGOD') || trimmed.startsWith('UklGR')) {
    let mime = 'jpeg';
    if (trimmed.startsWith('iVBOR')) mime = 'png';
    else if (trimmed.startsWith('R0lGOD')) mime = 'gif';
    else if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

export default function FishIntakeOrbitalDial({
  items = [],
  onAddFishLot,
  mode = 'local', // 'local' | 'dam'
  initialSelectedIndex = 0,
  speciesTypeFilter: propSpeciesFilter,
  onSpeciesTypeFilterChange
}) {
  // Water Filter State (All, Sea, Fresh placed around the dial circle corners)
  const [waterTypeFilter, setWaterTypeFilter] = useState('all'); // 'all' | 'sea_water' | 'fresh_water'
  
  // Species Filter (Controlled externally from section header or fallback to internal)
  const [internalSpeciesFilter, setInternalSpeciesFilter] = useState('all');
  const speciesTypeFilter = propSpeciesFilter !== undefined ? propSpeciesFilter : internalSpeciesFilter;
  const setSpeciesTypeFilter = onSpeciesTypeFilterChange || setInternalSpeciesFilter;

  // Live item counts for Water Environment pills (All, Sea, Fresh)
  const waterTypeCounts = useMemo(() => {
    let all = 0;
    let sea_water = 0;
    let fresh_water = 0;
    (items || []).forEach((item) => {
      all++;
      const wt = getItemWaterType(item);
      if (wt === 'sea_water') sea_water++;
      else if (wt === 'fresh_water') fresh_water++;
    });
    return { all, sea_water, fresh_water };
  }, [items]);

  // Filtered items based on Water Environment & Species
  const filteredItems = useMemo(() => {
    return (items || []).filter((item) => {
      const matchesWater = waterTypeFilter === 'all' || getItemWaterType(item) === waterTypeFilter;
      const matchesSpecies = speciesTypeFilter === 'all' || getItemSpeciesType(item) === speciesTypeFilter;
      return matchesWater && matchesSpecies;
    });
  }, [items, waterTypeFilter, speciesTypeFilter]);

  const [activeIndex, setActiveIndex] = useState(() => {
    return items && items.length > 0
      ? Math.max(0, Math.min(initialSelectedIndex, items.length - 1))
      : 0;
  });

  // Auto-reset active index to 0 whenever filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [waterTypeFilter, speciesTypeFilter]);

  const safeActiveIndex = filteredItems && filteredItems.length > 0
    ? Math.max(0, Math.min(activeIndex, filteredItems.length - 1))
    : 0;

  const currentFish = filteredItems && filteredItems.length > 0 ? filteredItems[safeActiveIndex] : null;

  // Dial Lock State
  const [isDialLocked, setIsDialLocked] = useState(false);
  const isDialLockedRef = useRef(false);
  useEffect(() => {
    isDialLockedRef.current = isDialLocked;
  }, [isDialLocked]);

  // Center Disc Click Feedback
  const [justAddedPulse, setJustAddedPulse] = useState(false);

  // 6 Fields State for Currently Selected Fish
  const [sizeGrade, setSizeGrade] = useState('medium');
  const [sizeBracket, setSizeBracket] = useState('Medium');
  const [weightOption, setWeightOption] = useState('1 - 4 Kg');
  const [boxes, setBoxes] = useState('1');
  const [kgPerBox, setKgPerBox] = useState(60);
  const [scaleKg, setScaleKg] = useState('60');
  const [scaleGrams, setScaleGrams] = useState('0');
  const [modalKgVal, setModalKgVal] = useState('60');
  const [modalGramsVal, setModalGramsVal] = useState('0');
  const [ratePerKg, setRatePerKg] = useState('150');
  const [editModalField, setEditModalField] = useState(null); // 'boxes' | 'kgPerBox' | 'scaleKg' | 'rate' | 'total'
  const [editInputVal, setEditInputVal] = useState('');
  const [addedSuccessToast, setAddedSuccessToast] = useState(false);

  // Helper: Extract Grade Options for current fish
  const gradeOptions = useMemo(() => {
    if (!currentFish) return [];
    const grades = currentFish.sizeGrades;
    if (!grades) {
      return [
        { key: 'small', label: 'Small', range: '0 - 1 Kg', rate: currentFish.purchasePrice || currentFish.price || 120 },
        { key: 'medium', label: 'Medium', range: '1 - 4 Kg', rate: currentFish.purchasePrice || currentFish.price || 150 },
        { key: 'big', label: 'Big', range: '4+ Kg', rate: currentFish.purchasePrice || currentFish.price || 180 }
      ];
    }
    const list = [];
    if (grades.small?.enabled !== false) {
      const sMax = grades.small?.maxKg || 1;
      list.push({
        key: 'small',
        label: 'Small',
        range: `0 - ${sMax} Kg`,
        rate: grades.small?.purchasePrice || grades.small?.wholesalePrice || grades.small?.price || currentFish.purchasePrice || 120
      });
    }
    if (grades.medium?.enabled !== false) {
      const sMax = grades.small?.maxKg || 1;
      const mMax = grades.medium?.maxKg || 4;
      list.push({
        key: 'medium',
        label: 'Medium',
        range: `${sMax} - ${mMax} Kg`,
        rate: grades.medium?.purchasePrice || grades.medium?.wholesalePrice || grades.medium?.price || currentFish.purchasePrice || 150
      });
    }
    if (grades.big?.enabled !== false) {
      const mMax = grades.medium?.maxKg || 4;
      list.push({
        key: 'big',
        label: 'Big',
        range: `${mMax}+ Kg`,
        rate: grades.big?.purchasePrice || grades.big?.wholesalePrice || grades.big?.price || currentFish.purchasePrice || 180
      });
    }
    return list.length > 0 ? list : [
      { key: 'medium', label: 'Medium', range: '1 - 4 Kg', rate: currentFish.purchasePrice || currentFish.price || 150 }
    ];
  }, [currentFish]);

  // When active fish changes, update default parameters
  useEffect(() => {
    if (!currentFish) return;
    const defaultKpb = Number(currentFish.boxPackingKg || 60);
    setKgPerBox(defaultKpb);

    const defaultG = gradeOptions.find(g => g.key === 'medium') || gradeOptions[0];
    if (defaultG) {
      setSizeGrade(defaultG.key);
      setSizeBracket(defaultG.label);
      setWeightOption(defaultG.range);
      if (defaultG.rate) setRatePerKg(String(defaultG.rate));
    } else {
      if (currentFish.purchasePrice || currentFish.price) {
        setRatePerKg(String(currentFish.purchasePrice || currentFish.price));
      }
    }

    const b = Number(boxes || 1);
    const totKg = b * defaultKpb;
    setScaleKg(String(Math.floor(totKg)));
    setScaleGrams(String(Math.round((totKg - Math.floor(totKg)) * 1000)));
  }, [currentFish]);

  // Sync scale weight whenever boxes or kgPerBox change
  const handleBoxesChange = (newBoxes) => {
    const b = Math.max(0, Number(newBoxes));
    setBoxes(String(b));
    const totKg = b * Number(kgPerBox || 60);
    setScaleKg(String(Math.floor(totKg)));
    setScaleGrams(String(Math.round((totKg - Math.floor(totKg)) * 1000)));
  };

  const handleKgPerBoxChange = (newKpb) => {
    const parsed = Number(newKpb);
    const kpb = !isNaN(parsed) && parsed > 0 ? Number(parsed.toFixed(3)) : 0;
    setKgPerBox(kpb);
    const b = Number(boxes || 0);
    if (b > 0) {
      const totKg = b * kpb;
      const whole = Math.floor(totKg);
      const remG = Math.round((totKg - whole) * 1000);
      setScaleKg(String(whole + Math.floor(remG / 1000)));
      setScaleGrams(String(remG % 1000));
    }
  };

  // Helper to open dual Kg + Grams weight modal for Scale Weight or Kg / Box
  const handleOpenDualWeightModal = (field, currentValKg, currentValGrams = 0) => {
    if (field === 'kgPerBox') {
      const raw = Number(kgPerBox) || 0;
      const whole = Math.floor(raw);
      const fracG = Math.round((raw - whole) * 1000);
      setModalKgVal(String(whole));
      setModalGramsVal(String(fracG));
    } else {
      setModalKgVal(String(currentValKg ?? scaleKg ?? '0'));
      setModalGramsVal(String(currentValGrams ?? scaleGrams ?? '0'));
    }
    setEditModalField(field);
  };

  // Cycle Grade on Petal 1 Tap
  const handleCycleGrade = (e) => {
    if (e) e.stopPropagation();
    if (!gradeOptions || gradeOptions.length === 0) return;
    const currIdx = gradeOptions.findIndex(g => g.key === sizeGrade);
    const nextIdx = (currIdx + 1) % gradeOptions.length;
    const nextG = gradeOptions[nextIdx];
    setSizeGrade(nextG.key);
    setSizeBracket(nextG.label);
    setWeightOption(nextG.range);
    if (nextG.rate) {
      setRatePerKg(String(nextG.rate));
    }
  };

  // Calculate Net Weight & Total Amount
  const netWeightKg = useMemo(() => {
    const k = Number(scaleKg || 0);
    const g = Number(scaleGrams || 0) / 1000;
    const total = k + g;
    if (total > 0) return total;
    const b = Number(boxes || 0);
    const kpb = Number(kgPerBox || 60);
    return b * kpb;
  }, [scaleKg, scaleGrams, boxes, kgPerBox]);

  const totalAmount = useMemo(() => {
    const r = Number(ratePerKg || 0);
    return Number((netWeightKg * r).toFixed(2));
  }, [netWeightKg, ratePerKg]);

  // Touch & Dial Rotation Gestures (Digital Crown)
  const ROTATION_STEP_DEG = filteredItems && filteredItems.length > 0 ? Math.max(12, Math.min(30, Math.round(360 / filteredItems.length))) : 20;
  const [dialRingRotation, setDialRingRotation] = useState(0);
  const dialRef = useRef(null);
  const isDraggingDialRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartPosRef = useRef(null);
  const lastAngleRef = useRef(0);
  const accumulatedAngleRef = useRef(0);
  const wasDraggingRef = useRef(false);

  const handleDialStart = (clientX, clientY, target) => {
    if (isDialLocked || isDialLockedRef.current) return;
    if (target && (target.closest('input') || target.closest('select') || target.closest('.no-dial-drag'))) {
      return;
    }
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngleRef.current = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    dragStartPosRef.current = { x: clientX, y: clientY };
    hasMovedRef.current = false;
    isDraggingDialRef.current = false;
    accumulatedAngleRef.current = 0;
  };

  const handleDialMove = (clientX, clientY) => {
    if (!dialRef.current || isDialLocked || isDialLockedRef.current || !dragStartPosRef.current) return;
    const dist = Math.hypot(clientX - dragStartPosRef.current.x, clientY - dragStartPosRef.current.y);
    if (!hasMovedRef.current) {
      if (dist < 8) return;
      hasMovedRef.current = true;
      isDraggingDialRef.current = true;
    }

    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    let delta = currentAngle - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngleRef.current = currentAngle;

    setDialRingRotation(prev => prev + delta);
    accumulatedAngleRef.current += delta;

    if (accumulatedAngleRef.current >= ROTATION_STEP_DEG) {
      if (filteredItems && filteredItems.length > 0) {
        setActiveIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      }
      accumulatedAngleRef.current -= ROTATION_STEP_DEG;
    } else if (accumulatedAngleRef.current <= -ROTATION_STEP_DEG) {
      if (filteredItems && filteredItems.length > 0) {
        setActiveIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      }
      accumulatedAngleRef.current += ROTATION_STEP_DEG;
    }
  };

  const handleDialEnd = () => {
    if (hasMovedRef.current) {
      wasDraggingRef.current = true;
      setTimeout(() => { wasDraggingRef.current = false; }, 120);
    } else {
      wasDraggingRef.current = false;
    }
    isDraggingDialRef.current = false;
    hasMovedRef.current = false;
    dragStartPosRef.current = null;
    accumulatedAngleRef.current = 0;
  };

  // Concentric Annular Sector Geometry from Smartwatch Dial
  const polarToCartesian = (cx, cy, r, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: Number((cx + r * Math.cos(angleInRadians)).toFixed(2)),
      y: Number((cy + r * Math.sin(angleInRadians)).toFixed(2))
    };
  };

  const createRoundedAnnularSector = (cx, cy, rIn, rOut, startAngle, endAngle, cornerRadius = 8) => {
    let angleDiff = endAngle - startAngle;
    if (angleDiff < 0) angleDiff += 360;

    const dAngleOut = (cornerRadius / rOut) * (180 / Math.PI);
    const dAngleIn = (cornerRadius / rIn) * (180 / Math.PI);

    const aStartOut = startAngle + dAngleOut;
    const aEndOut = endAngle - dAngleOut;
    const aStartIn = startAngle + dAngleIn;
    const aEndIn = endAngle - dAngleIn;

    const p1 = polarToCartesian(cx, cy, rOut, aStartOut);
    const p2 = polarToCartesian(cx, cy, rOut, aEndOut);
    const p2_c = polarToCartesian(cx, cy, rOut - cornerRadius, endAngle);
    const p3_c = polarToCartesian(cx, cy, rIn + cornerRadius, endAngle);
    const p3 = polarToCartesian(cx, cy, rIn, aEndIn);
    const p4 = polarToCartesian(cx, cy, rIn, aStartIn);
    const p4_c = polarToCartesian(cx, cy, rIn + cornerRadius, startAngle);
    const p1_c = polarToCartesian(cx, cy, rOut - cornerRadius, startAngle);

    let outDiff = aEndOut - aStartOut;
    if (outDiff < 0) outDiff += 360;
    const largeArcOut = outDiff > 180 ? 1 : 0;

    let inDiff = aEndIn - aStartIn;
    if (inDiff < 0) inDiff += 360;
    const largeArcIn = inDiff > 180 ? 1 : 0;

    return [
      'M', p1.x, p1.y,
      'A', rOut, rOut, 0, largeArcOut, 1, p2.x, p2.y,
      'A', cornerRadius, cornerRadius, 0, 0, 1, p2_c.x, p2_c.y,
      'L', p3_c.x, p3_c.y,
      'A', cornerRadius, cornerRadius, 0, 0, 1, p3.x, p3.y,
      'A', rIn, rIn, 0, largeArcIn, 0, p4.x, p4.y,
      'A', cornerRadius, cornerRadius, 0, 0, 1, p4_c.x, p4_c.y,
      'L', p1_c.x, p1_c.y,
      'A', cornerRadius, cornerRadius, 0, 0, 1, p1.x, p1.y,
      'Z'
    ].join(' ');
  };

  const getCurvedSectorCenterStyle = (angleDeg) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    const r = 124; // midpoint between rIn=92 and rOut=156
    const x = 220 + r * Math.cos(angleRad);
    const y = 220 + r * Math.sin(angleRad);
    return {
      position: 'absolute',
      left: `${((x / 440) * 100).toFixed(2)}%`,
      top: `${((y / 440) * 100).toFixed(2)}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: 25
    };
  };

  // Submit Current Fish Lot to Consignment
  const handleAddCurrentLot = () => {
    if (!currentFish) return;
    const lotPayload = {
      menuItemId: currentFish._id,
      itemName: currentFish.name,
      sizeGrade,
      sizeBracket,
      weightOption,
      boxes: String(boxes),
      kgPerBox,
      kg: String(scaleKg),
      grams: String(scaleGrams),
      ratePerKg: String(ratePerKg),
      total: totalAmount
    };

    if (onAddFishLot) {
      onAddFishLot(lotPayload);
      setAddedSuccessToast(true);
      setTimeout(() => setAddedSuccessToast(false), 2000);
    }
  };

  // Quick edit modal save
  const handleSaveModalValue = () => {
    if (editModalField === 'scaleKg') {
      const k = Math.max(0, parseInt(modalKgVal, 10) || 0);
      const g = Math.max(0, Math.min(999, parseInt(modalGramsVal, 10) || 0));
      setScaleKg(String(k));
      setScaleGrams(String(g));
      setEditModalField(null);
      return;
    }

    if (editModalField === 'kgPerBox') {
      const k = Math.max(0, parseInt(modalKgVal, 10) || 0);
      const g = Math.max(0, Math.min(999, parseInt(modalGramsVal, 10) || 0));
      handleKgPerBoxChange(k + (g / 1000));
      setEditModalField(null);
      return;
    }

    const val = editInputVal.trim();
    if (editModalField === 'boxes') {
      handleBoxesChange(val);
    } else if (editModalField === 'rate') {
      setRatePerKg(val);
    } else if (editModalField === 'total') {
      const tot = parseFloat(val);
      if (!isNaN(tot) && tot >= 0 && netWeightKg > 0) {
        const calcRate = (tot / netWeightKg).toFixed(2);
        setRatePerKg(String(calcRate));
      }
    }
    setEditModalField(null);
  };

  if (!items || items.length === 0) {
    return (
      <div className="bg-[#FAF3E8] p-6 rounded-2xl border border-[#fed7aa] text-center text-slate-600">
        <Scale size={32} className="mx-auto text-amber-600 mb-2" />
        <p className="font-bold text-sm">No Fish Species catalog available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto select-none space-y-2">
      {/* Top Header Pill: Active Species Variety Name & Rate */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 border border-[#fed7aa] shadow-2xs text-xs font-black text-slate-800">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="text-slate-900 truncate max-w-[200px] sm:max-w-[300px]">
          {currentFish?.name || 'Choose Fish'}
        </span>
        <span className="text-slate-300">•</span>
        <span className="text-[#ea580c] font-mono">₹{ratePerKg || 0}/Kg</span>
        {isDialLocked && (
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-300 flex items-center gap-0.5">
            <Lock size={10} /> Locked
          </span>
        )}
      </div>

      {/* ── THE 3D ORBITAL DIAL CONTAINER (Scales smoothly to screen width) ── */}
      <div
        ref={dialRef}
        onTouchStart={(e) => handleDialStart(e.touches[0].clientX, e.touches[0].clientY, e.target)}
        onTouchMove={(e) => {
          handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
          if (hasMovedRef.current && e.cancelable) e.preventDefault();
        }}
        onTouchEnd={handleDialEnd}
        onTouchCancel={handleDialEnd}
        onMouseDown={(e) => { if (e.button === 0) handleDialStart(e.clientX, e.clientY, e.target); }}
        onMouseMove={(e) => {
          handleDialMove(e.clientX, e.clientY);
          if (hasMovedRef.current) e.preventDefault();
        }}
        onMouseUp={handleDialEnd}
        onMouseLeave={handleDialEnd}
        className="relative w-full max-w-[380px] sm:max-w-[420px] md:max-w-[440px] aspect-square rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none my-1"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #faf6f0 55%, #f5eee3 85%, #ede2d3 100%)',
          boxShadow: '0 16px 42px -10px rgba(245, 158, 11, 0.3), inset 0 2px 10px rgba(255, 255, 255, 0.95), inset 0 -6px 14px rgba(217, 119, 6, 0.12)'
        }}
      >
        {/* ── 1. LOCK / UNLOCK TOGGLE BUTTON (Top-Left Corner of Dial) ── */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDialLocked(!isDialLocked);
          }}
          className={`no-dial-drag absolute top-2 left-2 sm:top-3 sm:left-3 z-40 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all shadow-md border cursor-pointer pointer-events-auto active:scale-95 ${
            isDialLocked
              ? 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-300 scale-105'
              : 'bg-white/95 text-slate-700 border-amber-300 hover:bg-amber-50'
          }`}
          title={isDialLocked ? 'Dial is locked. Tap to unlock' : 'Dial is unlocked. Tap to lock'}
        >
          {isDialLocked ? (
            <Lock size={15} className="stroke-[2.5]" />
          ) : (
            <Unlock size={15} className="stroke-[2.2]" />
          )}
        </button>

        {/* ── 2. FRESH WATER FILTER BUTTON (Top-Right Corner of Dial) ── */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWaterTypeFilter(prev => prev === 'fresh_water' ? 'all' : 'fresh_water');
          }}
          className={`no-dial-drag absolute top-2 right-2 sm:top-3 sm:right-3 z-40 px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1 transition-all shadow-md border cursor-pointer pointer-events-auto active:scale-95 ${
            waterTypeFilter === 'fresh_water'
              ? 'bg-[#ea580c] text-white border-orange-600 ring-2 ring-orange-300 font-black shadow-xs'
              : 'bg-white/95 text-slate-700 border-amber-300 hover:bg-amber-50'
          }`}
          title="Fresh Water Catch"
        >
          <span className="text-[10px] sm:text-xs font-bold">Fresh</span>
          <span className={`px-1 rounded-full text-[9px] sm:text-[10px] font-mono font-black ${
            waterTypeFilter === 'fresh_water' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {waterTypeCounts.fresh_water}
          </span>
        </button>

        {/* ── 3. SEA WATER FILTER BUTTON (Bottom-Right Corner of Dial) ── */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWaterTypeFilter(prev => prev === 'sea_water' ? 'all' : 'sea_water');
          }}
          className={`no-dial-drag absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-40 px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1 transition-all shadow-md border cursor-pointer pointer-events-auto active:scale-95 ${
            waterTypeFilter === 'sea_water'
              ? 'bg-[#ea580c] text-white border-orange-600 ring-2 ring-orange-300 font-black shadow-xs'
              : 'bg-white/95 text-slate-700 border-amber-300 hover:bg-amber-50'
          }`}
          title="Sea Water Catch"
        >
          <span className="text-[10px] sm:text-xs font-bold">Sea</span>
          <span className={`px-1 rounded-full text-[9px] sm:text-[10px] font-mono font-black ${
            waterTypeFilter === 'sea_water' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {waterTypeCounts.sea_water}
          </span>
        </button>

        {/* ── 4. ALL WATERS FILTER BUTTON (Bottom-Left Corner of Dial) ── */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setWaterTypeFilter('all');
          }}
          className={`no-dial-drag absolute bottom-2 left-2 sm:bottom-3 sm:left-3 z-40 px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1 transition-all shadow-md border cursor-pointer pointer-events-auto active:scale-95 ${
            waterTypeFilter === 'all'
              ? 'bg-[#ea580c] text-white border-orange-600 ring-2 ring-orange-300 font-black shadow-xs'
              : 'bg-white/95 text-slate-700 border-amber-300 hover:bg-amber-50'
          }`}
          title="Show All Waters"
        >
          <span className="text-[10px] sm:text-xs font-bold">All</span>
          <span className={`px-1 rounded-full text-[9px] sm:text-[10px] font-mono font-black ${
            waterTypeFilter === 'all' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {waterTypeCounts.all}
          </span>
        </button>
        {/* SVG Canvas for Track, Halo Bezel and Exactly 6 Petals */}
        <svg viewBox="0 0 440 440" className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="intakeHaloGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="35%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#ea580c" />
            </linearGradient>
            <filter id="intakeHaloGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Orbit Track Gradient */}
            <linearGradient id="intakeOrbitTrack" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#ffedd5" stopOpacity="0.85" />
            </linearGradient>

            {/* 6 Petal Gradients */}
            {/* Petal 1: Grade (Violet) */}
            <linearGradient id="gradGradeIntake" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#faf5ff" />
              <stop offset="100%" stopColor="#e9d5ff" />
            </linearGradient>

            {/* Petal 2: Kg / Box (Sky Blue) */}
            <linearGradient id="gradKpbIntake" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0f9ff" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>

            {/* Petal 3: Boxes (Warm Orange) */}
            <linearGradient id="gradBoxesIntake" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="100%" stopColor="#fed7aa" />
            </linearGradient>

            {/* Petal 4: Scale Weight (Amber / Gold) */}
            <linearGradient id="gradScaleIntake" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>

            {/* Petal 5: Rate (Coral / Rose) */}
            <linearGradient id="gradRateIntake" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff1f2" />
              <stop offset="100%" stopColor="#fecdd3" />
            </linearGradient>

            {/* Petal 6: Total (Emerald Green) */}
            <linearGradient id="gradTotalIntake" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#bbf7d0" />
            </linearGradient>

            <filter id="intakePetalShadow" x="-10%" y="-10%" width="125%" height="125%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#78350f" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* 1. Orbit Track Background (rIn=158, rOut=214) */}
          <path
            d={createRoundedAnnularSector(220, 220, 158, 214, 0, 359.99, 0)}
            fill="url(#intakeOrbitTrack)"
            stroke="#fed7aa"
            strokeWidth="1"
          />

          {/* 2. Inner boundary dashed line */}
          <circle
            cx="220"
            cy="220"
            r="158"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />

          {/* 3. Outer Glowing Border */}
          <circle
            cx="220"
            cy="220"
            r="214"
            fill="none"
            stroke="url(#intakeHaloGradient)"
            strokeWidth="4"
            filter="url(#intakeHaloGlow)"
            opacity="0.85"
          />
          <circle
            cx="220"
            cy="220"
            r="214"
            fill="none"
            stroke="url(#intakeHaloGradient)"
            strokeWidth="2.5"
          />

          {/* 4. Luxury Bezel Ticks */}
          <g
            transform={`rotate(${dialRingRotation}, 220, 220)`}
            style={{
              transition: isDraggingDialRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            {Array.from({ length: 48 }).map((_, i) => {
              const a = (i * 360) / 48;
              const rad = ((a - 90) * Math.PI) / 180;
              const isMajor = i % 4 === 0;
              const r1 = isMajor ? 208 : 211;
              const r2 = 217;
              return (
                <line
                  key={i}
                  x1={220 + r1 * Math.cos(rad)}
                  y1={220 + r1 * Math.sin(rad)}
                  x2={220 + r2 * Math.cos(rad)}
                  y2={220 + r2 * Math.sin(rad)}
                  stroke={isMajor ? "#f59e0b" : "#fed7aa"}
                  strokeWidth={isMajor ? "1.8" : "1"}
                  opacity={isMajor ? "0.95" : "0.7"}
                />
              );
            })}
          </g>

          {/* ── 6 CURVED SECTOR PETALS (rIn=92, rOut=156) ── */}

          {/* PETAL 1: Top (12 o'clock / 0°) - Grade */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 331, 29, 8)}
            fill="url(#gradGradeIntake)"
            stroke="#c084fc"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#intakePetalShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={handleCycleGrade}
          />

          {/* PETAL 2: Top-Right (2 o'clock / 60°) - Kg / Box */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 36, 84, 8)}
            fill="url(#gradKpbIntake)"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#intakePetalShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDualWeightModal('kgPerBox');
            }}
          />

          {/* PETAL 3: Bottom-Right (4 o'clock / 120°) - Boxes */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 96, 144, 8)}
            fill="url(#gradBoxesIntake)"
            stroke="#f97316"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#intakePetalShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={() => {
              setEditModalField('boxes');
              setEditInputVal(String(boxes));
            }}
          />

          {/* PETAL 4: Bottom (6 o'clock / 180°) - Scale Weight */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 151, 209, 8)}
            fill="url(#gradScaleIntake)"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#intakePetalShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDualWeightModal('scaleKg');
            }}
          />

          {/* PETAL 5: Bottom-Left (8 o'clock / 240°) - Rate (₹/Kg) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 216, 264, 8)}
            fill="url(#gradRateIntake)"
            stroke="#f43f5e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#intakePetalShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={() => {
              setEditModalField('rate');
              setEditInputVal(String(ratePerKg));
            }}
          />

          {/* PETAL 6: Top-Left (10 o'clock / 300°) - Total (₹) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 276, 324, 8)}
            fill="url(#gradTotalIntake)"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#intakePetalShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={() => {
              setEditModalField('total');
              setEditInputVal(String(Math.round(totalAmount)));
            }}
          />
        </svg>

        {/* ── FISH IMAGES ROTATING ON THE OUTER ORBITAL TRACK (r=186) ── */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none z-30"
          style={{
            transform: `rotate(${dialRingRotation}deg)`,
            transformOrigin: '50% 50%',
            transition: isDraggingDialRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
        >
          {filteredItems.map((item, idx) => {
            const N = filteredItems.length;
            const baseAngle = idx * (360 / Math.max(1, N));
            const rad = ((baseAngle - 90) * Math.PI) / 180;
            const r = 186; // Centered inside orbit ring
            const x = 220 + r * Math.cos(rad);
            const y = 220 + r * Math.sin(rad);
            const isSelected = idx === safeActiveIndex;
            const imgUrl = formatImageUrl(item.image);

            return (
              <button
                key={item._id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isDialLocked || isDialLockedRef.current) return;
                  if (wasDraggingRef.current || hasMovedRef.current) return;
                  setActiveIndex(idx);
                }}
                style={{
                  position: 'absolute',
                  left: `${((x / 440) * 100).toFixed(2)}%`,
                  top: `${((y / 440) * 100).toFixed(2)}%`,
                  transform: `translate(-50%, -50%) rotate(${-dialRingRotation}deg)`,
                  transition: isDraggingDialRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  pointerEvents: 'auto'
                }}
                className={`overflow-hidden flex items-center justify-center rounded-full transition-all relative ${
                  isDialLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-full ring-2 ring-amber-500 border-2 border-amber-600 shadow-xl scale-110 z-40'
                    : 'w-9 h-9 sm:w-11 sm:h-11 bg-white/95 rounded-full border border-amber-300 shadow-2xs hover:scale-115 hover:border-amber-500 z-30'
                }`}
                aria-label={item.name}
              >
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={item.name}
                    className="w-full h-full object-contain p-0.5 rounded-full pointer-events-none"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.fish-dial-thumb-fallback');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="fish-dial-thumb-fallback w-full h-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800 rounded-full font-bold select-none pointer-events-none"
                  style={{ display: imgUrl ? 'none' : 'flex' }}
                >
                  <Fish size={16} className="text-amber-700" />
                </div>
              </button>
            );
          })}
        </div>

        {/* ── NAVIGATION ARROWS (9 o'clock & 3 o'clock) ── */}
        <button
          type="button"
          disabled={safeActiveIndex === 0 || isDialLocked}
          onClick={(e) => {
            e.stopPropagation();
            if (isDialLocked || isDialLockedRef.current) return;
            setActiveIndex(Math.max(0, safeActiveIndex - 1));
            setDialRingRotation(prev => prev - ROTATION_STEP_DEG);
          }}
          style={{ position: 'absolute', left: '21%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 35 }}
          className={`no-dial-drag w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-800 transition-all ${
            isDialLocked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-amber-50 active:scale-90 disabled:opacity-20 cursor-pointer pointer-events-auto'
          }`}
          title={isDialLocked ? "Dial is locked" : "Previous Fish"}
        >
          <ChevronLeft size={16} className="stroke-[2.5]" />
        </button>

        <button
          type="button"
          disabled={safeActiveIndex >= filteredItems.length - 1 || isDialLocked}
          onClick={(e) => {
            e.stopPropagation();
            if (isDialLocked || isDialLockedRef.current) return;
            setActiveIndex(Math.min(filteredItems.length - 1, safeActiveIndex + 1));
            setDialRingRotation(prev => prev + ROTATION_STEP_DEG);
          }}
          style={{ position: 'absolute', left: '79%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 35 }}
          className={`no-dial-drag w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-slate-800 transition-all ${
            isDialLocked ? 'opacity-30 cursor-not-allowed' : 'hover:bg-amber-50 active:scale-90 disabled:opacity-20 cursor-pointer pointer-events-auto'
          }`}
          title={isDialLocked ? "Dial is locked" : "Next Fish"}
        >
          <ChevronRight size={16} className="stroke-[2.5]" />
        </button>

        {/* ── CENTER CIRCULAR PHOTO DISC (Click to Add Lot) ── */}
        <div
          onClick={handleAddCurrentLot}
          className={`no-dial-drag relative w-[38%] h-[38%] rounded-full border-[3px] shadow-lg overflow-hidden z-20 cursor-pointer active:scale-95 transition-all bg-white flex flex-col items-center justify-center p-2 group ${
            justAddedPulse
              ? 'border-emerald-500 ring-4 ring-emerald-300 scale-95'
              : 'border-[#fdba74] hover:border-orange-500'
          }`}
          style={{
            boxShadow: justAddedPulse
              ? '0 0 24px rgba(16, 185, 129, 0.45), inset 0 2px 6px rgba(255, 255, 255, 0.95)'
              : '0 6px 20px -2px rgba(245, 158, 11, 0.22), inset 0 2px 6px rgba(255, 255, 255, 0.95)'
          }}
          title={`Click to Add ${currentFish?.name || 'Fish'} Lot`}
        >
          {justAddedPulse ? (
            <div className="flex flex-col items-center justify-center animate-in zoom-in-75 duration-200 text-center">
              <CheckCircle size={34} className="text-emerald-600 drop-shadow-sm" />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider mt-1">
                Added!
              </span>
            </div>
          ) : (
            <>
              {(() => {
                const centerImgUrl = formatImageUrl(currentFish?.image);
                return (
                  <>
                    {centerImgUrl ? (
                      <img
                        src={centerImgUrl}
                        alt={currentFish?.name || 'Fish'}
                        className="max-w-[88%] max-h-[88%] object-contain pointer-events-none transition-transform duration-300 drop-shadow-md select-none group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.parentElement?.querySelector('.center-disc-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className="center-disc-fallback flex flex-col items-center justify-center pointer-events-none select-none text-center"
                      style={{ display: centerImgUrl ? 'none' : 'flex' }}
                    >
                      <Fish size={36} className="text-amber-700 drop-shadow-sm" />
                      <span className="text-[10px] sm:text-[11px] font-black text-amber-900/90 tracking-wide mt-1 max-w-[85px] truncate">
                        {currentFish?.name?.split('/')[0]?.trim() || 'Lot'}
                      </span>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>

        {/* ── 6 CURVED PETAL CONTENT OVERLAYS ── */}

        {/* PETAL 1: Top (12 o'clock / 0°) - Grade */}
        <div
          style={getCurvedSectorCenterStyle(0)}
          onClick={handleCycleGrade}
          className="no-dial-drag pointer-events-auto flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[80px] sm:max-w-[95px]"
          title="Grade"
        >
          <div className="flex items-center gap-0.5 text-purple-900 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide">
            <Award size={10} className="text-purple-700" />
            <span>Grade</span>
          </div>
          <div className="text-[11px] sm:text-xs font-black text-purple-950 font-mono leading-tight">
            {sizeBracket}
          </div>
          <div className="text-[8.5px] sm:text-[9px] text-purple-800/80 font-bold leading-tight">
            {weightOption}
          </div>
        </div>

        {/* PETAL 2: Top-Right (2 o'clock / 60°) - Kg / Box */}
        <div
          style={getCurvedSectorCenterStyle(60)}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDualWeightModal('kgPerBox');
          }}
          className="no-dial-drag pointer-events-auto flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[80px] sm:max-w-[95px]"
          title="Kg / Box (Click to enter Kg & Grams)"
        >
          <div className="flex items-center gap-0.5 text-sky-900 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide">
            <Package size={10} className="text-sky-700" />
            <span>Kg / Box</span>
          </div>
          <div className="text-[11px] sm:text-xs font-black text-sky-950 font-mono leading-tight">
            {(() => {
              const raw = Number(kgPerBox) || 0;
              const whole = Math.floor(raw);
              const g = Math.round((raw - whole) * 1000);
              return (
                <>
                  {whole} <span className="text-[9px] font-semibold">Kg</span>
                  {g > 0 && <span className="text-[9.5px] text-sky-800 ml-0.5">{g}g</span>}
                </>
              );
            })()}
          </div>
        </div>

        {/* PETAL 3: Bottom-Right (4 o'clock / 120°) - Boxes */}
        <div
          style={getCurvedSectorCenterStyle(120)}
          className="no-dial-drag pointer-events-auto flex flex-col items-center justify-center text-center max-w-[80px] sm:max-w-[95px]"
          title="Boxes"
        >
          <div className="flex items-center gap-0.5 text-orange-900 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide">
            <Boxes size={10} className="text-orange-700" />
            <span>Boxes</span>
          </div>
          <div className="flex items-center gap-1 my-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleBoxesChange(Math.max(0, Number(boxes) - 1)); }}
              className="w-4 h-4 rounded-full bg-white/90 text-orange-800 font-black flex items-center justify-center shadow-2xs hover:bg-orange-100 cursor-pointer text-xs"
            >
              -
            </button>
            <span
              onClick={() => { setEditModalField('boxes'); setEditInputVal(String(boxes)); }}
              className="text-xs sm:text-sm font-black text-orange-950 font-mono px-1 bg-white/60 rounded cursor-pointer"
            >
              {boxes}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleBoxesChange(Number(boxes) + 1); }}
              className="w-4 h-4 rounded-full bg-white/90 text-orange-800 font-black flex items-center justify-center shadow-2xs hover:bg-orange-100 cursor-pointer text-xs"
            >
              +
            </button>
          </div>
        </div>

        {/* PETAL 4: Bottom (6 o'clock / 180°) - Scale Weight */}
        <div
          style={getCurvedSectorCenterStyle(180)}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenDualWeightModal('scaleKg');
          }}
          className="no-dial-drag pointer-events-auto flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[85px] sm:max-w-[105px]"
          title="Scale Weight (Click to enter Kg & Grams)"
        >
          <div className="flex items-center gap-0.5 text-amber-900 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide">
            <Scale size={10} className="text-amber-700" />
            <span>Scale Wt</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-amber-950 font-mono leading-tight">
            {Number(scaleKg) || 0} <span className="text-[9px] font-semibold">Kg</span>
            {Number(scaleGrams) > 0 && <span className="text-[10px] text-amber-800 ml-0.5">{Number(scaleGrams)}g</span>}
          </div>
        </div>

        {/* PETAL 5: Bottom-Left (8 o'clock / 240°) - Rate (₹/Kg) */}
        <div
          style={getCurvedSectorCenterStyle(240)}
          onClick={() => { setEditModalField('rate'); setEditInputVal(String(ratePerKg)); }}
          className="no-dial-drag pointer-events-auto flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[80px] sm:max-w-[95px]"
          title="Rate (Click to edit rate)"
        >
          <div className="flex items-center gap-0.5 text-rose-900 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide">
            <Tag size={10} className="text-rose-700" />
            <span>Rate</span>
          </div>
          <div className="text-[11px] sm:text-xs font-black text-rose-950 font-mono leading-tight">
            ₹{ratePerKg}
          </div>
        </div>

        {/* PETAL 6: Top-Left (10 o'clock / 300°) - Total (₹) */}
        <div
          style={getCurvedSectorCenterStyle(300)}
          onClick={() => {
            setEditModalField('total');
            setEditInputVal(String(Math.round(totalAmount)));
          }}
          className="no-dial-drag pointer-events-auto flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[85px] sm:max-w-[105px]"
          title="Total (Click to enter total)"
        >
          <div className="flex items-center gap-0.5 text-emerald-900 font-bold text-[8px] sm:text-[9px] uppercase tracking-wide">
            <Calculator size={10} className="text-emerald-700" />
            <span>Total</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-emerald-950 font-mono leading-tight truncate max-w-full">
            ₹{Math.round(totalAmount).toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Added success banner */}
      {addedSuccessToast && (
        <div className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full flex items-center gap-1.5 animate-in fade-in duration-150">
          <CheckCircle size={13} className="text-emerald-600" />
          <span>Added {currentFish?.name?.split('/')[0]?.trim() || 'Lot'} ({boxes} Bx • {netWeightKg.toFixed(1)} Kg)</span>
        </div>
      )}

      {/* ── QUICK NUMERIC / DUAL-INPUT MODAL FOR PETALS ── */}
      {editModalField && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150"
          onClick={() => setEditModalField(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-4 w-full max-w-xs shadow-2xl border-2 border-amber-300 space-y-3.5 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-amber-100 pb-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                {editModalField === 'boxes' && <><Boxes size={14} className="text-orange-600" /> Enter Boxes / Crates</>}
                {editModalField === 'kgPerBox' && <><Package size={14} className="text-sky-600" /> Kg / Box (Kg + Gm)</>}
                {editModalField === 'scaleKg' && <><Scale size={14} className="text-amber-600" /> Scale Weight (Kg + Gm)</>}
                {editModalField === 'rate' && <><Tag size={14} className="text-rose-600" /> Enter Rate (₹/Kg)</>}
                {editModalField === 'total' && <><Calculator size={14} className="text-emerald-600" /> Negotiate / Total (₹)</>}
              </span>
              <button
                type="button"
                onClick={() => setEditModalField(null)}
                className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Dual-Input Weight Mode (Kg + Grams) for both Scale Weight & Kg / Box */}
            {(editModalField === 'scaleKg' || editModalField === 'kgPerBox') ? (
              <div className="space-y-3">
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 truncate max-w-[170px]">{currentFish?.name}</span>
                  <span className="font-black text-amber-900 font-mono">₹{ratePerKg}/Kg</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Weight (Kg)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      autoFocus
                      value={modalKgVal}
                      onChange={(e) => setModalKgVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveModalValue();
                        if (e.key === 'Escape') setEditModalField(null);
                      }}
                      className="w-full text-lg sm:text-xl font-black font-mono text-center p-2 bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                      Grams (Optional)
                    </label>
                    <input
                      type="number"
                      step="10"
                      min="0"
                      max="999"
                      value={modalGramsVal}
                      onChange={(e) => setModalGramsVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveModalValue();
                        if (e.key === 'Escape') setEditModalField(null);
                      }}
                      className="w-full text-lg sm:text-xl font-black font-mono text-center p-2 bg-slate-50 border-2 border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl focus:outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Quick Weight Presets</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[10, 20, 40, 50, 60, 70, 100].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setModalKgVal(String(val));
                          setModalGramsVal('0');
                        }}
                        className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer active:scale-95 transition-all"
                      >
                        {val} Kg
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setModalKgVal('0'); setModalGramsVal('0'); }}
                      className="px-2 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer ml-auto active:scale-95 transition-all"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Single Input Mode for Boxes, KgPerBox, Rate, Total */
              <div className="space-y-2">
                <input
                  type="number"
                  step={editModalField === 'rate' || editModalField === 'total' ? 'any' : '1'}
                  autoFocus
                  value={editInputVal}
                  onChange={(e) => setEditInputVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveModalValue();
                    if (e.key === 'Escape') setEditModalField(null);
                  }}
                  className="w-full text-lg sm:text-xl font-black font-mono text-center p-2 bg-slate-50 border-2 border-slate-200 focus:border-[#ea580c] focus:bg-white rounded-xl focus:outline-none transition-all"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditModalField(null)}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer text-center transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalValue}
                className="flex-1 py-2 rounded-xl bg-[#ea580c] hover:bg-orange-600 active:scale-95 text-white text-xs font-black shadow-md cursor-pointer text-center transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

