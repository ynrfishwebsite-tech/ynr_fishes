import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Minus,
  Plus,
  Scale,
  ChevronDown,
  Check,
  ShoppingBag,
  Tag,
  Layers,
  Scissors,
  Award,
  X,
  Lock,
  Unlock,
  User,
  Building2,
  Globe,
  Search,
  Percent,
  Edit3,
  Calculator
} from 'lucide-react';
import CalculatorModal from '../system/CalculatorModal';

export default function FishSmartwatchDial({
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
  getGradeAverageKg,
  showImages = true,
  showAnimation = true,
  cart = [],
  cartTotal,
  onViewOrder,
  customerName = '',
  setCustomerName,
  customerPhone = '',
  setCustomerPhone,
  customerPhoto = '',
  customerCategory = '',
  exportSubCategory = null,
  onCustomerSelect,
  onOpenCustomerModal,
  predefinedCustomers = [],
  handleSelectCustomer,
  handleClearCustomer,
  discount,
  setDiscount
}) {
  // Clamp activeIndex safely
  const safeActiveIndex = items && items.length > 0
    ? Math.max(0, Math.min(activeIndex, items.length - 1))
    : 0;

  useEffect(() => {
    if (items && items.length > 0 && activeIndex >= items.length) {
      if (setActiveIndex) setActiveIndex(0);
    }
  }, [items, activeIndex, setActiveIndex]);

  const currentItem = items && items.length > 0 ? items[safeActiveIndex] : null;

  // Weight & Weighing States - Defaults to 1.000 Kg and Small Grade
  const [weightKg, setWeightKg] = useState('1.000');
  const [selectedCutType, setSelectedCutType] = useState('Whole');
  const [tareGrams, setTareGrams] = useState(0);
  const [gradeOverride, setGradeOverride] = useState('small');

  // Wholesale Box States
  const [boxCount, setBoxCount] = useState(1);
  const [boxWeightKg, setBoxWeightKg] = useState('1');
  // 'single' = one fish type per box; 'mixed' = multiple species per box
  const [boxFishMode, setBoxFishMode] = useState('single');
  const [activeBoxNumber, setActiveBoxNumber] = useState(1);

  // Group existing boxes from cart
  const existingBoxes = useMemo(() => {
    const map = {};
    (cart || []).forEach((item) => {
      if (item.boxNumber) {
        const bNum = Number(item.boxNumber);
        if (!map[bNum]) {
          map[bNum] = { boxNumber: bNum, itemsCount: 0, totalWeightKg: 0, totalPrice: 0 };
        }
        map[bNum].itemsCount += 1;
        map[bNum].totalWeightKg += Number(item.weightKg) || 0;
        map[bNum].totalPrice += Number(item.total || item.price) || 0;
      }
    });
    return map;
  }, [cart]);

  const allBoxesToList = useMemo(() => {
    const set = new Set(Object.keys(existingBoxes).map(Number));
    set.add(activeBoxNumber);
    return Array.from(set).sort((a, b) => a - b);
  }, [existingBoxes, activeBoxNumber]);

  // CRM Popover & Search
  const [showCrmPicker, setShowCrmPicker] = useState(false);
  const [crmSearch, setCrmSearch] = useState('');
  const [isCrmBlinking, setIsCrmBlinking] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  // Long-press Rate Edit states
  const [customRate, setCustomRate] = useState(null);
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [tempRateInput, setTempRateInput] = useState('');
  const ratePressTimerRef = useRef(null);

  // Long-press Total Edit & Auto-Discount states
  const [customTotal, setCustomTotal] = useState(null);
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [tempTotalInput, setTempTotalInput] = useState('');
  const totalPressTimerRef = useRef(null);

  // Dial rotation state & drag physics
  const [dialRingRotation, setDialRingRotation] = useState(0);
  const [isDialLocked, setIsDialLocked] = useState(false);
  const isDialLockedRef = useRef(false);

  const setDialLock = (locked) => {
    isDialLockedRef.current = locked;
    setIsDialLocked(locked);
  };

  useEffect(() => {
    isDialLockedRef.current = isDialLocked;
  }, [isDialLocked]);

  const isDraggingDialRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartPosRef = useRef(null);
  const lastAngleRef = useRef(0);
  const accumulatedAngleRef = useRef(0);
  const wasDraggingRef = useRef(false);
  const containerRef = useRef(null);
  const dialRef = useRef(null);
  const cardRef = useRef(null);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const touchStartTimeRef = useRef(0);

  // Degrees of rotation required to switch to next/previous fish (matches item spacing)
  const ROTATION_STEP_DEG = items && items.length > 0 ? Math.max(12, Math.min(30, Math.round(360 / items.length))) : 24;

  // Sync state when active item changes
  useEffect(() => {
    const initialGrade = currentItem?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : currentItem?.sizeGrades?.small?.enabled !== false ? 'small'
      : currentItem?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    setGradeOverride(initialGrade);
    setWeightKg('1.000');
    setTareGrams(0);
    // Predefined default weight value is 1 across all modes (Retail, Wholesale, Export)
    setBoxWeightKg('1');
    // Reset custom rate & custom total when switching fish
    setCustomRate(null);
    setIsEditingRate(false);
    setCustomTotal(null);
    setIsEditingTotal(false);
  }, [currentItem?._id]);

  // Reset custom total when weight changes
  useEffect(() => {
    setCustomTotal(null);
    setIsEditingTotal(false);
  }, [weightKg]);

  const isBoxBasedMode = fishOrderMode === 'bulk' || fishOrderMode === 'export';

  // Retail calculations
  const rawKg = parseFloat(weightKg) || 0;
  const grossGrams = Math.round(rawKg * 1000);
  const netGrams = Math.max(0, grossGrams - tareGrams);
  const netKg = netGrams / 1000;

  const autoGrade = currentItem && detectItemSizeGrade ? detectItemSizeGrade(currentItem, netKg) : 'small';
  const activeGrade = gradeOverride || autoGrade;

  const activeRate = currentItem && getItemPricePerKg
    ? getItemPricePerKg(currentItem, fishOrderMode, activeGrade)
    : (currentItem?.price || 0);

  const fractionLabel = formatKgFraction ? formatKgFraction(netKg) : `${netKg.toFixed(3)} Kg`;

  // Wholesale / Export Box Mode calculations
  const boxRate = currentItem
    ? (fishOrderMode === 'export'
        ? (parseFloat(currentItem.exportPricePerKg) || parseFloat(currentItem.wholesalePricePerKg) || parseFloat(currentItem.price) || 0)
        : (parseFloat(currentItem.wholesalePricePerKg) || parseFloat(currentItem.price) || 0))
    : 0;
  // In 1 Fish / Box mode, each addition is 1 box of boxWeightKg
  const totalBoxWeightKg = parseFloat(boxWeightKg) || 0;
  const totalBoxPrice = parseFloat((totalBoxWeightKg * boxRate).toFixed(2));
  const mixedItemTotal = parseFloat((netKg * boxRate).toFixed(2));

  // Next sequential box number for 1 Fish / Box additions
  const nextSingleBoxNum = useMemo(() => {
    return (cart || []).reduce((max, it) => Math.max(max, Number(it.boxNumber || 0)), 0) + 1;
  }, [cart]);

  // Base rate before manual edit
  const baseRate = isBoxBasedMode ? boxRate : activeRate;
  // Effective rate (custom rate if long-press edited, else base rate)
  const effectiveRate = customRate !== null && !isNaN(parseFloat(customRate)) && parseFloat(customRate) > 0
    ? parseFloat(customRate)
    : baseRate;

  // Standard total before manual discount
  const standardTotal = isBoxBasedMode
    ? (boxFishMode === 'mixed' ? parseFloat((netKg * effectiveRate).toFixed(2)) : parseFloat((totalBoxWeightKg * effectiveRate).toFixed(2)))
    : parseFloat((netKg * effectiveRate).toFixed(2));

  // Effective total (either negotiated total or standard total)
  const effectiveTotal = customTotal !== null && !isNaN(parseFloat(customTotal)) && parseFloat(customTotal) >= 0
    ? parseFloat(customTotal)
    : standardTotal;

  // Auto-calculated discount difference
  const calculatedDiscount = (customTotal !== null && standardTotal > effectiveTotal)
    ? parseFloat((standardTotal - effectiveTotal).toFixed(2))
    : 0;

  const currentRateAmount = effectiveRate;
  const currentTotalAmount = effectiveTotal;

  // Cart total & item count for the unified bottom action dock
  const cartCount = cart && cart.length > 0
    ? cart.reduce((sum, item) => item.isCancelled ? sum : sum + (item.quantity || 1) - (item.cancelledQuantity || 0), 0)
    : 0;

  // Format cart count to at most 2 decimal places to prevent floating point artifacts (e.g. 3.099999999999996 -> 3.10)
  const formattedCartCount = (() => {
    const num = Number(cartCount) || 0;
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(2);
  })();

  const computedCartTotal = cartTotal !== undefined
    ? cartTotal
    : (cart && cart.length > 0 ? cart.reduce((sum, item) => item.isCancelled ? sum : sum + (parseFloat(item.total) || 0), 0) : 0);

  // Phase-by-phase handler for Enter key on mobile weight input:
  // Phase 1: Adds item to bill with typed weight
  // Phase 2: Blinks to CRM and scrolls to customer picker
  const handleWeightEnterSubmit = (enteredVal) => {
    let finalWeight = parseFloat(enteredVal);
    if (isNaN(finalWeight) || finalWeight <= 0) {
      finalWeight = parseFloat(weightKg) || 1.0;
    }
    const finalWeightStr = finalWeight.toFixed(3);
    setWeightKg(finalWeightStr);

    setTimeout(() => {
      const success = handleAddCurrentToBill();
      if (success) {
        setIsDialLocked(false);
        setTimeout(() => {
          setIsCrmBlinking(true);
          window.dispatchEvent(new CustomEvent('trigger-crm-blink', {
            detail: { mode: fishOrderMode }
          }));

          const crmEl = document.getElementById('crm-customer-bar-container') ||
                        document.querySelector('[data-crm-customer-bar]') ||
                        document.querySelector('#crm-customer-bar-wrapper');
          if (crmEl) {
            crmEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            setShowCrmPicker(true);
          }

          if (showToast) {
            showToast('Fish item added! Please select Customer', 'info');
          }

          setTimeout(() => setIsCrmBlinking(false), 4000);
        }, 180);
      }
    }, 50);
  };

  // Stepper Handlers
  const handleDecreaseWeight = (e) => {
    if (e) e.stopPropagation();
    setWeightKg((prev) => {
      const val = parseFloat(prev) || 0;
      const next = Math.max(0.25, val - 0.5);
      return next.toFixed(3);
    });
  };

  const handleIncreaseWeight = (e) => {
    if (e) e.stopPropagation();
    setWeightKg((prev) => {
      const val = parseFloat(prev) || 0;
      const next = val + 0.5;
      return next.toFixed(3);
    });
  };

  // Dial mouse & touch rotation gesture - rotates dial AND cycles items like a digital crown
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
    isDraggingDialRef.current = false; // Never drag on pure click/tap
    accumulatedAngleRef.current = 0;
  };

  const handleDialMove = (clientX, clientY) => {
    if (!dialRef.current || isDialLocked || isDialLockedRef.current || !dragStartPosRef.current) return;

    const dist = Math.hypot(clientX - dragStartPosRef.current.x, clientY - dragStartPosRef.current.y);
    // Ignore micro-movements under 8px so clicks on fish badges register cleanly
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

    // Rotate bezel ring smoothly
    setDialRingRotation((prev) => prev + delta);

    // Accumulate angular delta to cycle items
    accumulatedAngleRef.current += delta;

    if (accumulatedAngleRef.current >= ROTATION_STEP_DEG) {
      if (items && items.length > 0) {
        setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      }
      accumulatedAngleRef.current -= ROTATION_STEP_DEG;
    } else if (accumulatedAngleRef.current <= -ROTATION_STEP_DEG) {
      if (items && items.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      }
      accumulatedAngleRef.current += ROTATION_STEP_DEG;
    }
  };

  const handleDialEnd = () => {
    if (hasMovedRef.current) {
      wasDraggingRef.current = true;
      setTimeout(() => {
        wasDraggingRef.current = false;
      }, 120);
    } else {
      wasDraggingRef.current = false;
    }
    isDraggingDialRef.current = false;
    hasMovedRef.current = false;
    dragStartPosRef.current = null;
    accumulatedAngleRef.current = 0;
  };

  const handleDialTouchStart = (e) => {
    if (isDialLocked || isDialLockedRef.current) return;
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('.no-dial-drag')) {
      return;
    }
    handleDialStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  const handleDialTouchMove = (e) => {
    if (isDialLocked || isDialLockedRef.current || !dragStartPosRef.current) return;
    handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
    if (hasMovedRef.current && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleDialMouseDown = (e) => {
    if (isDialLocked || isDialLockedRef.current || e.button !== 0) return;
    if (e.target.closest('input') || e.target.closest('select') || e.target.closest('.no-dial-drag')) {
      return;
    }
    handleDialStart(e.clientX, e.clientY, e.target);
  };

  const handleDialMouseMove = (e) => {
    if (isDialLocked || isDialLockedRef.current || !dragStartPosRef.current) return;
    handleDialMove(e.clientX, e.clientY);
    if (hasMovedRef.current) {
      e.preventDefault();
    }
  };

  useEffect(() => {
    const onGlobalEnd = () => {
      if (isDraggingDialRef.current) {
        handleDialEnd();
      }
    };
    window.addEventListener('mouseup', onGlobalEnd);
    window.addEventListener('touchend', onGlobalEnd);
    window.addEventListener('touchcancel', onGlobalEnd);
    return () => {
      window.removeEventListener('mouseup', onGlobalEnd);
      window.removeEventListener('touchend', onGlobalEnd);
      window.removeEventListener('touchcancel', onGlobalEnd);
    };
  }, []);

  // Center Disc: Tap to Add to Bill, or Swipe horizontally to switch fish
  const handleCenterImageAddAndRedirect = (e) => {
    if (e) e.stopPropagation();
    const success = handleAddCurrentToBill();
    if (success) {
      setIsDialLocked(false);
    }
  };

  const handleCenterTouchStart = (e) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartTimeRef.current = Date.now();
  };

  const handleCenterTouchEnd = (e) => {
    if (touchStartXRef.current === null) return;
    const diffX = touchStartXRef.current - e.changedTouches[0].clientX;
    const diffY = (touchStartYRef.current || e.changedTouches[0].clientY) - e.changedTouches[0].clientY;
    const elapsed = Date.now() - touchStartTimeRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Horizontal swipe gesture (> 35px) cycles fish items & ring rotates (disabled when dial is locked)
    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
      if (isDialLocked || isDialLockedRef.current) {
        return;
      }
      if (diffX > 35 && safeActiveIndex < items.length - 1) {
        setActiveIndex((prev) => Math.min(items.length - 1, prev + 1));
        setDialRingRotation((prev) => prev + ROTATION_STEP_DEG);
      } else if (diffX < -35 && safeActiveIndex > 0) {
        setActiveIndex((prev) => Math.max(0, prev - 1));
        setDialRingRotation((prev) => prev - ROTATION_STEP_DEG);
      }
      return;
    }

    // Quick tap (< 15px movement, < 450ms) adds item to cart & redirects to Current Order!
    if (Math.hypot(diffX, diffY) < 15 && elapsed < 450) {
      handleCenterImageAddAndRedirect(e);
    }
  };

  const handleCenterClick = (e) => {
    if (Date.now() - touchStartTimeRef.current < 600) return;
    handleCenterImageAddAndRedirect(e);
  };

  // Polar to Cartesian helper (0 deg = 12 o'clock, clockwise)
  const polarToCartesian = (cx, cy, r, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: Number((cx + r * Math.cos(angleInRadians)).toFixed(2)),
      y: Number((cy + r * Math.sin(angleInRadians)).toFixed(2))
    };
  };

  // Generates a true concentric annular sector path with smooth 4-corner fillets (pill/stadium petals)
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

  // Center position of each curved sector for icon & label overlay
  const getCurvedSectorCenterStyle = (angleDeg) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    const r = 124; // exact midpoint between rIn=92 and rOut=156
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

  // 1-Tap Grade Cycle (No Popups!)
  const handleCycleGrade = (e) => {
    if (e) e.stopPropagation();
    const availableGrades = ['small', 'medium', 'big'].filter(
      (g) => currentItem?.sizeGrades?.[g]?.enabled !== false
    );
    const gradesToUse = availableGrades.length > 0 ? availableGrades : ['small', 'medium', 'big'];
    const currIdx = gradesToUse.indexOf(activeGrade);
    const nextGrade = gradesToUse[(currIdx + 1) % gradesToUse.length];

    setGradeOverride(nextGrade);
    setWeightKg('1.000');
    setCustomTotal(null);
    if (showToast) {
      const gRate = currentItem?.sizeGrades?.[nextGrade]?.price || (currentItem && getItemPricePerKg ? getItemPricePerKg(currentItem, fishOrderMode, nextGrade) : currentItem?.price || 0);
      showToast(`Grade: ${nextGrade.toUpperCase()} (₹${gRate}/Kg)`, 'info');
    }
  };

  // 1-Tap Cut Style Cycle (No Popups!)
  const CUT_OPTIONS = ['Whole', 'Cleaned', 'Curry Cut', 'Fry Cut', 'Boneless Fillet'];
  const handleCycleCut = (e) => {
    if (e) e.stopPropagation();
    const currIdx = CUT_OPTIONS.indexOf(selectedCutType);
    const nextCut = CUT_OPTIONS[(currIdx + 1) % CUT_OPTIONS.length];
    setSelectedCutType(nextCut);
    if (showToast) {
      showToast(`Cut: ${nextCut}`, 'info');
    }
  };

  // Long-press Rate Handlers (> 500ms)
  const startRateLongPress = (e) => {
    e.stopPropagation();
    ratePressTimerRef.current = setTimeout(() => {
      setIsEditingRate(true);
      setTempRateInput(String(effectiveRate));
      if (showToast) showToast('Edit Rate Price (₹/Kg)', 'info');
    }, 500);
  };

  const cancelRateLongPress = () => {
    if (ratePressTimerRef.current) {
      clearTimeout(ratePressTimerRef.current);
      ratePressTimerRef.current = null;
    }
  };

  const handleSaveRate = () => {
    const parsed = parseFloat(tempRateInput);
    if (!isNaN(parsed) && parsed > 0) {
      setCustomRate(parsed);
      setCustomTotal(null); // Recalculate total with custom rate
      if (showToast) showToast(`Custom Rate set: ₹${parsed}/Kg`, 'success');
    }
    setIsEditingRate(false);
  };

  // Long-press Total Handlers (> 500ms) with Auto-Discount
  const startTotalLongPress = (e) => {
    e.stopPropagation();
    totalPressTimerRef.current = setTimeout(() => {
      setIsEditingTotal(true);
      setTempTotalInput(String(Math.round(standardTotal)));
      if (showToast) showToast('Enter Negotiated Total (Auto-Calculates Discount)', 'info');
    }, 500);
  };

  const cancelTotalLongPress = () => {
    if (totalPressTimerRef.current) {
      clearTimeout(totalPressTimerRef.current);
      totalPressTimerRef.current = null;
    }
  };

  const handleSaveTotal = () => {
    const entered = parseFloat(tempTotalInput);
    if (!isNaN(entered) && entered >= 0) {
      setCustomTotal(entered);
      const diff = Math.max(0, standardTotal - entered);
      if (diff > 0) {
        if (setDiscount) {
          setDiscount({ type: 'flat', value: diff, name: 'Discount' });
        }
        if (showToast) showToast(`Negotiated Total: ₹${entered} (₹${diff.toFixed(0)} Discount applied)`, 'success');
      }
    }
    setIsEditingTotal(false);
  };

  // Add Item to Bill (returns true on success, false on validation error)
  const handleAddCurrentToBill = () => {
    if (!currentItem) return false;
    if (isLocked || (orderStatus === 'Billed' && !hasPendingChanges)) {
      if (showToast) showToast(t("Order is billed. Click EDIT to modify."), 'warning');
      return false;
    }

    const finalPricePerKg = effectiveRate;
    const finalItemTotal = effectiveTotal;
    const finalDiscount = calculatedDiscount;

    if (finalDiscount > 0 && setDiscount) {
      setDiscount({ type: 'flat', value: finalDiscount, name: 'Negotiated Discount' });
    }

    if (isBoxBasedMode) {
      if (openBoxPackerModal) {
        const passedWeight = parseFloat(boxWeightKg) || (netGrams / 1000) || 1;
        openBoxPackerModal(currentItem, activeGrade, passedWeight);
        return true;
      }
      if (boxFishMode === 'mixed') {
        if (netKg <= 0) {
          if (showToast) showToast(`Please enter valid weight in Kg for Box #${activeBoxNumber}`, 'error');
          return false;
        }
        const itemPrice = finalItemTotal;
        const itemToAdd = {
          ...currentItem,
          _id: currentItem._id,
          menuItem: currentItem._id,
          originalId: currentItem._id,
          originalFishName: currentItem.name,
          name: `${currentItem.name}`,
          boxNumber: activeBoxNumber,
          boxLabel: `Box #${activeBoxNumber}`,
          isWholesaleBox: true,
          sellingUnit: 'Kg',
          quantity: netKg,
          weightKg: netKg,
          enteredWeight: netKg,
          grossWeightKg: netKg,
          netWeightKg: netKg,
          pricePerKg: finalPricePerKg,
          price: finalPricePerKg,
          total: itemPrice,
          standardTotal: standardTotal,
          originalTotal: standardTotal,
          discount: finalDiscount,
          discountAmount: finalDiscount,
          itemDiscount: finalDiscount,
          sizeGrade: activeGrade,
          cutType: selectedCutType,
          orderMode: fishOrderMode,
          boxFishMode: 'mixed',
          itemKey: `${currentItem._id}_box${activeBoxNumber}_slot${Date.now()}`
        };

        if (triggerFlyAnimation && cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          triggerFlyAnimation(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            currentItem.name,
            formatImageUrl(currentItem.image)
          );
        }

        onSelectItem(itemToAdd);
        if (showToast) showToast(`Added ${currentItem.name} (${netKg} Kg) into Box #${activeBoxNumber}!`, 'success');
        return true;
      }

      // 1 Fish / Box mode: Packs 1 dedicated box for this fish and cleanly separates as Box #N in cart
      if (totalBoxWeightKg <= 0) {
        if (showToast) showToast('Please enter valid box weight in Kg', 'error');
        return false;
      }
      const itemToAdd = {
        ...currentItem,
        _id: currentItem._id,
        menuItem: currentItem._id,
        originalId: currentItem._id,
        originalFishName: currentItem.name,
        name: `${currentItem.name}`,
        boxNumber: nextSingleBoxNum,
        boxLabel: `Box #${nextSingleBoxNum}`,
        isWholesaleBox: true,
        sellingUnit: 'Kg',
        quantity: totalBoxWeightKg,
        weightKg: totalBoxWeightKg,
        enteredWeight: totalBoxWeightKg,
        grossWeightKg: totalBoxWeightKg,
        netWeightKg: totalBoxWeightKg,
        pricePerKg: finalPricePerKg,
        price: finalPricePerKg,
        total: finalItemTotal,
        standardTotal: standardTotal,
        originalTotal: standardTotal,
        discount: finalDiscount,
        discountAmount: finalDiscount,
        itemDiscount: finalDiscount,
        sizeGrade: activeGrade,
        cutType: selectedCutType,
        orderMode: fishOrderMode,
        boxFishMode: 'single',
        itemKey: `${currentItem._id}_box${nextSingleBoxNum}_slot${Date.now()}`
      };

      if (triggerFlyAnimation && cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        triggerFlyAnimation(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          currentItem.name,
          formatImageUrl(currentItem.image)
        );
      }

      onSelectItem(itemToAdd);
      if (showToast) showToast(`Added Box #${nextSingleBoxNum}: ${currentItem.name} (${totalBoxWeightKg} Kg)`, 'success');
      return true;
    }

    if (netKg <= 0) {
      if (showToast) showToast('Please enter a valid weight in Kilograms', 'error');
      return false;
    }

    const itemToAdd = {
      ...currentItem,
      speciesType: currentItem.speciesType || 'fish',
      customCuttingChargeEnabled: currentItem.customCuttingChargeEnabled,
      cuttingCharge: currentItem.cuttingCharge,
      sizeGrades: currentItem.sizeGrades,
      itemKey: `${currentItem._id}_${selectedCutType}_${netGrams}g_${activeGrade}_${fishOrderMode}_${Date.now()}`,
      menuItem: currentItem._id,
      originalId: currentItem._id,
      originalFishName: currentItem.name,
      name: `${currentItem.name} (${selectedCutType} - ${fractionLabel})`,
      price: customTotal !== null && netKg > 0 ? parseFloat((finalItemTotal / netKg).toFixed(2)) : finalPricePerKg,
      ratePerKg: finalPricePerKg,
      quantity: netKg,
      total: finalItemTotal,
      standardTotal: standardTotal,
      originalTotal: standardTotal,
      discount: finalDiscount,
      discountAmount: finalDiscount,
      itemDiscount: finalDiscount,
      sellingUnit: 'Kg',
      enteredWeight: netKg,
      netWeightKg: netKg,
      grossWeightKg: netKg,
      pricePerKg: finalPricePerKg,
      sizeGrade: activeGrade,
      orderMode: fishOrderMode,
      cutType: selectedCutType,
      yieldFactor: 1.0,
      tareWeightKg: (tareGrams / 1000),
      specialNote: finalDiscount > 0 ? `₹${finalDiscount.toFixed(0)} Discount applied` : ''
    };

    if (triggerFlyAnimation && cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      triggerFlyAnimation(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        currentItem.name,
        formatImageUrl(currentItem.image)
      );
    }

    onSelectItem(itemToAdd);
    return true;
  };

  if (!items || items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center my-auto min-h-[300px]">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-2.5 text-amber-800 shadow-inner">
          <Scale size={28} className="text-amber-700 animate-pulse" />
        </div>
        <h3 className="text-sm font-black text-slate-800">No matching seafood items</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Try clearing your search or switching species / water type filter.
        </p>
      </div>
    );
  }

  const smallMax = parseFloat(currentItem?.sizeGrades?.small?.maxKg) || 1;
  const mediumMax = parseFloat(currentItem?.sizeGrades?.medium?.maxKg) || 4;

  return (
    <div
      ref={containerRef}
      className="relative w-full flex-1 flex flex-col justify-center items-center select-none py-1 px-1 sm:px-2 overflow-x-hidden my-auto"
    >
      {/* Scoped CSS for Dynamic Responsive Tablet & Mobile Dial Sizing */}
      <style>{`
        /* Base / Mobile & Tablet: Dial expands to fill 98% of the aspect-square bounding frame */
        .fish-smartwatch-dial-element {
          width: 98% !important;
          height: 98% !important;
          max-width: 98% !important;
          max-height: 98% !important;
        }
        @media (min-width: 768px) and (max-width: 1279px) {
          .fish-smartwatch-outer-thumb {
            width: 3.8rem !important;
            height: 3.8rem !important;
          }
          .fish-smartwatch-outer-thumb.is-selected {
            width: 4.8rem !important;
            height: 4.8rem !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1279px) and (min-height: 1050px) {
          .fish-smartwatch-outer-thumb {
            width: 4.4rem !important;
            height: 4.4rem !important;
          }
          .fish-smartwatch-outer-thumb.is-selected {
            width: 5.6rem !important;
            height: 5.6rem !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1279px) and (min-height: 1250px) {
          .fish-smartwatch-outer-thumb {
            width: 5rem !important;
            height: 5rem !important;
          }
          .fish-smartwatch-outer-thumb.is-selected {
            width: 6.4rem !important;
            height: 6.4rem !important;
          }
        }
        @media (min-width: 1280px) {
          .fish-smartwatch-dial-element {
            width: 98% !important;
            height: 98% !important;
            max-width: 98% !important;
            max-height: 98% !important;
          }
        }
      `}</style>

      {/* Popovers backdrop */}
      {(showCrmPicker || isEditingRate || isEditingTotal) && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-2xs"
          onClick={() => {
            setShowCrmPicker(false);
            setIsEditingRate(false);
            setIsEditingTotal(false);
          }}
        />
      )}

      {/* Top Section Header: Selected Fish Name (Centered in empty space above dial, NO black color) */}
      <div className="w-full max-w-[min(99vw,calc(100dvh-110px),480px)] md:max-w-[min(94vw,calc(100dvh-130px),760px)] lg:max-w-[min(92vw,calc(100dvh-120px),860px)] xl:max-w-[500px] flex items-center justify-center my-1 sm:my-2 px-2 z-20 shrink-0">
        <div className="bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-full shadow-sm border-2 border-amber-300 flex items-center gap-2.5 max-w-full">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs"></span>
          <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-wide truncate max-w-[220px] sm:max-w-[320px]">
            {(language !== 'en' && currentItem.nameTranslations?.[language]) || currentItem.name}
          </h2>
          <span className="text-[10px] sm:text-xs font-black text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full border border-amber-300/80 shadow-2xs">
            ₹{currentItem.price || 0}/Kg
          </span>
        </div>
      </div>

      {/* Dial Wrapper bounding Dial and the 4 Mathematical Curved Outer Sector Spandrels */}
      <div className="relative w-full max-w-[min(99vw,calc(100dvh-110px),480px)] md:max-w-[min(94vw,calc(100dvh-130px),760px)] lg:max-w-[min(92vw,calc(100dvh-120px),860px)] xl:max-w-[500px] aspect-square flex items-center justify-center my-auto min-h-0 select-none">

        {/* ========================================================
            SVG BACKDROP: 4 TRUE CURVED CORNER SPANDRELS (Carved from square around circle)
            ======================================================== */}
        <svg viewBox="0 0 500 500" className="absolute inset-0 w-full h-full pointer-events-none z-10">
          <defs>
            <linearGradient id="spandrelGradTL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="60%" stopColor="#fffbeb" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="spandrelGradLocked" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.98" />
              <stop offset="60%" stopColor="#ea580c" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#c2410c" stopOpacity="0.95" />
            </linearGradient>
            <linearGradient id="spandrelGradTR" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="60%" stopColor="#fffbeb" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="spandrelGradBL" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="60%" stopColor="#fffbeb" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="spandrelGradBR" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
              <stop offset="60%" stopColor="#fffbeb" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#fef3c7" stopOpacity="0.85" />
            </linearGradient>
            <filter id="spandrelGlow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#f59e0b" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* 1. Top-Left Curved Corner Sector: Entire shape IS the Lock/Unlock button */}
          <path
            d="M 8 8 L 195 8 A 248 248 0 0 0 8 195 Z"
            fill={isDialLocked ? "url(#spandrelGradLocked)" : "url(#spandrelGradTL)"}
            stroke={isDialLocked ? "#ea580c" : "#f59e0b"}
            strokeWidth={isDialLocked ? "3" : "2.2"}
            strokeLinejoin="round"
            filter="url(#spandrelGlow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90 transition-all"
            onClick={() => setDialLock(!isDialLocked)}
          />

          {/* 2. Top-Right Curved Corner Sector: Entire shape IS the Calculator button */}
          <path
            d="M 492 8 L 305 8 A 248 248 0 0 1 492 195 Z"
            fill="url(#spandrelGradTR)"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeLinejoin="round"
            filter="url(#spandrelGlow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90 transition-all"
            onClick={() => setShowCalculator(true)}
          />

          {/* 3. Bottom-Left Curved Corner Sector: Exact concave arc matching other corners */}
          <path
            d="M 8 492 L 8 305 A 248 248 0 0 0 195 492 Z"
            fill="url(#spandrelGradBL)"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeLinejoin="round"
            filter="url(#spandrelGlow)"
          />

          {/* 4. Bottom-Right Curved Corner Sector */}
          <path
            d="M 492 492 L 305 492 A 248 248 0 0 0 492 305 Z"
            fill="url(#spandrelGradBR)"
            stroke="#f59e0b"
            strokeWidth="2.2"
            strokeLinejoin="round"
            filter="url(#spandrelGlow)"
          />
        </svg>

        {/* ========================================================
            4 CURVED OUTER SECTOR SHORTCUT CONTROLS
            ======================================================== */}

        {/* CORNER 1: TOP-LEFT SECTOR -> BIG PROMINENT LOCK/UNLOCK SYMBOL ONLY (Centered in Spandrel) */}
        <div
          onClick={() => setDialLock(!isDialLocked)}
          className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 md:top-[3.5%] md:left-[3.5%] lg:top-[4%] lg:left-[4%] z-30 cursor-pointer pointer-events-auto select-none flex items-center justify-center p-1 active:scale-90 transition-transform"
          title={isDialLocked ? "Dial is locked. Tap sector to unlock" : "Dial is unlocked. Tap sector to lock"}
        >
          {isDialLocked ? (
            <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-white text-orange-600 shadow-md md:shadow-lg border-2 md:border-3 border-orange-300 hover:scale-105 transition-all">
              <Lock className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 lg:w-11 lg:h-11 stroke-[2.8] text-orange-600 animate-in zoom-in-75 duration-200" />
            </div>
          ) : (
            <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-amber-50/95 text-amber-900 shadow-sm md:shadow-md border-2 md:border-3 border-amber-300 hover:bg-amber-100 hover:scale-105 transition-all">
              <Unlock className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 lg:w-11 lg:h-11 stroke-[2.6] text-amber-900" />
            </div>
          )}
        </div>

        {/* CORNER 2: TOP-RIGHT SECTOR -> BIG PROMINENT CALCULATOR BUTTON (Centered in Spandrel) */}
        <div
          onClick={() => setShowCalculator(true)}
          className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 md:top-[3.5%] md:right-[3.5%] lg:top-[4%] lg:right-[4%] z-30 cursor-pointer pointer-events-auto select-none flex items-center justify-center p-1 active:scale-90 transition-transform"
          title="Open Calculator"
        >
          <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-16 md:h-16 lg:w-20 lg:h-20 rounded-full flex items-center justify-center bg-amber-50/95 text-amber-900 shadow-sm md:shadow-md border-2 md:border-3 border-amber-300 hover:bg-amber-100 hover:scale-105 transition-all">
            <Calculator className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 lg:w-11 lg:h-11 stroke-[2.4] text-amber-900" />
          </div>
        </div>

        {/* CORNER 3: BOTTOM-LEFT SECTOR -> WEIGHT PRESETS (Organic 2D Scatter Layout, Zero Waste, Zero Collision) */}
        <div className="absolute bottom-0 left-0 w-[38%] h-[38%] pointer-events-none z-30">
          {!isBoxBasedMode ? (
            /* Retail Mode Weight Presets (Constellation scatter: mobile 6 presets, tablet 11 presets) */
            <>
              {[
                { val: '1', x: 11, y: 64, mobile: true },
                { val: '2', x: 25, y: 43, mobile: true },
                { val: '3', x: 11, y: 38, mobile: true },
                { val: '5', x: 43, y: 20, mobile: true },
                { val: '10', x: 11, y: 12, mobile: true },
                { val: '20', x: 62, y: 10, mobile: true },
                // Tablet extra values filling pockets
                { val: '4', x: 11, y: 51, mobile: false },
                { val: '7', x: 25, y: 26, mobile: false },
                { val: '15', x: 11, y: 25, mobile: false },
                { val: '25', x: 34, y: 10, mobile: false },
                { val: '30', x: 74, y: 9, mobile: false },
              ].map(({ val, x, y, mobile }) => {
                const isSelected = parseFloat(weightKg) === parseFloat(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setDialLock(false);
                      setWeightKg(parseFloat(val).toFixed(3));
                    }}
                    style={{ left: `${x}%`, bottom: `${y}%` }}
                    className={`absolute pointer-events-auto transform -translate-x-1/2 translate-y-1/2 rounded-full font-black transition-all cursor-pointer active:scale-90 shadow-2xs backdrop-blur-2xs
                      px-2 py-0.5 text-[10px] sm:text-[11px] md:px-2.5 md:py-1 md:text-xs lg:px-3 lg:py-1.5 lg:text-sm
                      ${!mobile ? 'hidden md:inline-flex' : 'inline-flex'}
                      ${
                        isSelected
                          ? 'bg-[#ea580c] text-white shadow-xs ring-2 ring-orange-300 scale-105 z-30'
                          : 'bg-white/95 text-slate-800 hover:bg-amber-50 border border-amber-200/90 hover:scale-105'
                      }`}
                  >
                    {val}k
                  </button>
                );
              })}
            </>
          ) : (
            /* Wholesale Mode Box Weight Presets */
            <>
              {[
                { val: '1', x: 11, y: 64, mobile: true },
                { val: '2', x: 25, y: 43, mobile: true },
                { val: '5', x: 11, y: 38, mobile: true },
                { val: '10', x: 43, y: 20, mobile: true },
                { val: '20', x: 11, y: 12, mobile: true },
                { val: '50', x: 62, y: 10, mobile: true },
                // Tablet extra values filling pockets
                { val: '3', x: 11, y: 51, mobile: false },
                { val: '7', x: 25, y: 26, mobile: false },
                { val: '15', x: 11, y: 25, mobile: false },
                { val: '25', x: 34, y: 10, mobile: false },
                { val: '30', x: 74, y: 9, mobile: false },
              ].map(({ val, x, y, mobile }) => {
                const isSelected = parseFloat(boxWeightKg) === parseFloat(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setDialLock(false);
                      setBoxWeightKg(val);
                    }}
                    style={{ left: `${x}%`, bottom: `${y}%` }}
                    className={`absolute pointer-events-auto transform -translate-x-1/2 translate-y-1/2 rounded-full font-black transition-all cursor-pointer active:scale-90 shadow-2xs backdrop-blur-2xs
                      px-2 py-0.5 text-[10px] sm:text-[11px] md:px-2.5 md:py-1 md:text-xs lg:px-3 lg:py-1.5 lg:text-sm
                      ${!mobile ? 'hidden md:inline-flex' : 'inline-flex'}
                      ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300 scale-105 z-30'
                          : 'bg-white/95 text-slate-800 hover:bg-sky-50 border border-sky-200/90 hover:scale-105'
                      }`}
                  >
                    {val}k
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* CORNER 4: BOTTOM-RIGHT SECTOR -> TARE VALUES (Organic 2D Scatter Layout, Zero Waste, Zero Collision) */}
        <div className="absolute bottom-0 right-0 w-[38%] h-[38%] pointer-events-none z-30">
          {!isBoxBasedMode ? (
            /* Retail Tare Presets (Constellation scatter: mobile 5 presets, tablet 9 presets) */
            <>
              {[
                { tg: 0, label: '0', x: 16, y: 58, mobile: true, isZero: true },
                { tg: 20, label: '-20g', x: 34, y: 26, mobile: true },
                { tg: 50, label: '-50g', x: 18, y: 38, mobile: true },
                { tg: 100, label: '-100g', x: 56, y: 11, mobile: true },
                { tg: 200, label: '-200g', x: 18, y: 14, mobile: true },
                // Tablet extra values filling pockets
                { tg: 30, label: '-30g', x: 16, y: 48, mobile: false },
                { tg: 150, label: '-150g', x: 34, y: 12, mobile: false },
                { tg: 250, label: '-250g', x: 50, y: 22, mobile: false },
                { tg: 500, label: '-500g', x: 72, y: 9, mobile: false },
              ].map(({ tg, label, x, y, mobile, isZero }) => {
                const isSelected = tareGrams === tg;
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => setTareGrams(tg)}
                    style={{ right: `${x}%`, bottom: `${y}%` }}
                    className={`absolute pointer-events-auto transform translate-x-1/2 translate-y-1/2 rounded-full font-black transition-all cursor-pointer active:scale-90 shadow-2xs backdrop-blur-2xs
                      px-2 py-0.5 text-[10px] sm:text-[11px] md:px-2.5 md:py-1 md:text-xs lg:px-3 lg:py-1.5 lg:text-sm
                      ${!mobile ? 'hidden md:inline-flex' : 'inline-flex'}
                      ${
                        isSelected
                          ? 'bg-[#ea580c] text-white shadow-xs ring-2 ring-orange-300 scale-105 z-30'
                          : isZero
                          ? 'bg-amber-100/95 text-amber-900 border border-amber-300 hover:bg-amber-200 hover:scale-105'
                          : 'bg-white/95 text-slate-700 hover:bg-slate-100 border border-slate-200/90 hover:scale-105'
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </>
          ) : (
            /* Wholesale Bulk Weight Presets */
            <>
              {[
                { val: '20', x: 16, y: 58, mobile: true },
                { val: '30', x: 34, y: 26, mobile: true },
                { val: '50', x: 18, y: 38, mobile: true },
                { val: '70', x: 56, y: 11, mobile: true },
                { val: '100', x: 18, y: 14, mobile: true },
                // Tablet extra values filling pockets
                { val: '25', x: 16, y: 48, mobile: false },
                { val: '40', x: 34, y: 12, mobile: false },
                { val: '60', x: 50, y: 22, mobile: false },
                { val: '80', x: 72, y: 9, mobile: false },
              ].map(({ val, x, y, mobile }) => {
                const isSelected = parseFloat(boxWeightKg) === parseFloat(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      setDialLock(false);
                      setBoxWeightKg(val);
                    }}
                    style={{ right: `${x}%`, bottom: `${y}%` }}
                    className={`absolute pointer-events-auto transform translate-x-1/2 translate-y-1/2 rounded-full font-black transition-all cursor-pointer active:scale-90 shadow-2xs backdrop-blur-2xs
                      px-2 py-0.5 text-[10px] sm:text-[11px] md:px-2.5 md:py-1 md:text-xs lg:px-3 lg:py-1.5 lg:text-sm
                      ${!mobile ? 'hidden md:inline-flex' : 'inline-flex'}
                      ${
                        isSelected
                          ? 'bg-sky-600 text-white shadow-xs ring-2 ring-sky-300 scale-105 z-30'
                          : 'bg-white/95 text-slate-800 hover:bg-sky-50 border border-sky-200/90 hover:scale-105'
                      }`}
                  >
                    {val}k
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* ========================================================
            1. SMARTWATCH ROUND DIAL (Scales Responsively on Phone & Tablet)
            ======================================================== */}
        <div
          ref={dialRef}
          onTouchStart={handleDialTouchStart}
          onTouchMove={handleDialTouchMove}
          onTouchEnd={handleDialEnd}
          onTouchCancel={handleDialEnd}
          onMouseDown={handleDialMouseDown}
          onMouseMove={handleDialMouseMove}
          onMouseUp={handleDialEnd}
          onMouseLeave={handleDialEnd}
          className="fish-smartwatch-dial-element relative aspect-square mx-auto shrink-0 select-none touch-none flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing my-auto"
          style={{
            background: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #faf6f0 55%, #f5eee3 85%, #ede2d3 100%)',
            boxShadow: '0 16px 42px -10px rgba(245, 158, 11, 0.3), inset 0 2px 10px rgba(255, 255, 255, 0.95), inset 0 -6px 14px rgba(217, 119, 6, 0.12)'
          }}
        >
        {/* Luminous Ambient Halo Bezel Ring, Dedicated Outer Orbit Ring & 6 Curved Sector Buttons */}
        <svg
          viewBox="0 0 440 440"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <defs>
            <linearGradient id="haloGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="25%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="80%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <filter id="haloGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Dedicated Outer Orbit Ring Track Gradient */}
            <linearGradient id="orbitTrackGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#fef3c7" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#ffedd5" stopOpacity="0.85" />
            </linearGradient>

            {/* Gradients for the 6 Curved Sectors */}
            <linearGradient id="gradCRM" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#fed7aa" />
            </linearGradient>

            <linearGradient id="gradWeight" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>

            <linearGradient id="gradRate" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="100%" stopColor="#fed7aa" />
            </linearGradient>

            <linearGradient id="gradTotal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f0fdf4" />
              <stop offset="100%" stopColor="#bbf7d0" />
            </linearGradient>

            <linearGradient id="gradCut" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f0f9ff" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>

            <linearGradient id="gradGrade" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#faf5ff" />
              <stop offset="100%" stopColor="#e9d5ff" />
            </linearGradient>

            <filter id="sectorShadow" x="-10%" y="-10%" width="125%" height="125%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#78350f" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* ========================================================
              DEDICATED OUTER ORBIT RING (Outer border on outside, images on inner track)
              ======================================================== */}
          {/* 1. Orbit Track Background (rIn=158, rOut=214) */}
          <path
            d={createRoundedAnnularSector(220, 220, 158, 214, 0, 359.99, 0)}
            fill="url(#orbitTrackGradient)"
            stroke="#fed7aa"
            strokeWidth="1"
          />

          {/* 2. Inner boundary dashed line separating Orbit Ring from Petals */}
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

          {/* 3. Outer Glowing Border (Outerside of dedicated ring) */}
          <circle
            cx="220"
            cy="220"
            r="214"
            fill="none"
            stroke="url(#haloGradient)"
            strokeWidth="5"
            filter="url(#haloGlow)"
            opacity="0.85"
          />
          <circle
            cx="220"
            cy="220"
            r="214"
            fill="none"
            stroke="url(#haloGradient)"
            strokeWidth="3"
          />

          {/* 4. Luxury watch bezel tick marks along the outer border */}
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

          {/* ========================================================
              6 CURVED SECTOR BUTTONS (Middle Zone: rIn=92, rOut=156)
              ======================================================== */}
          {/* 1. TOP SECTOR (12 o'clock / 0°): CRM (Customer / Dealer / Client) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 331, 29, 8)}
            fill="url(#gradCRM)"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              setShowCrmPicker((prev) => !prev);
            }}
          />

          {/* 2. TOP-RIGHT SECTOR (2 o'clock / 60°): RATE (Long-press to edit) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 36, 84, 8)}
            fill="url(#gradRate)"
            stroke="#fb923c"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onMouseDown={startRateLongPress}
            onMouseUp={cancelRateLongPress}
            onMouseLeave={cancelRateLongPress}
            onTouchStart={startRateLongPress}
            onTouchEnd={cancelRateLongPress}
            onTouchCancel={cancelRateLongPress}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditingRate && showToast) {
                showToast('Hold (long-press) to edit rate price', 'info');
              }
            }}
          />

          {/* 3. BOTTOM-RIGHT SECTOR (4 o'clock / 120°): TOTAL (Long-press to edit total & apply discount) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 96, 144, 8)}
            fill="url(#gradTotal)"
            stroke="#4ade80"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onMouseDown={startTotalLongPress}
            onMouseUp={cancelTotalLongPress}
            onMouseLeave={cancelTotalLongPress}
            onTouchStart={startTotalLongPress}
            onTouchEnd={cancelTotalLongPress}
            onTouchCancel={cancelTotalLongPress}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditingTotal && showToast) {
                showToast('Hold (long-press) to enter negotiated total & apply discount', 'info');
              }
            }}
          />

          {/* 4. BOTTOM SECTOR (6 o'clock / 180°): WEIGHT STEPPER PETAL */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 151, 209, 8)}
            fill="url(#gradWeight)"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
          />

          {/* 5. BOTTOM-LEFT SECTOR (8 o'clock / 240°): CUTTING STYLE (1-Tap Cycle) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 216, 264, 8)}
            fill="url(#gradCut)"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={handleCycleCut}
          />

          {/* 6. TOP-LEFT SECTOR (10 o'clock / 300°): GRADE (1-Tap Cycle) */}
          <path
            d={createRoundedAnnularSector(220, 220, 92, 156, 276, 324, 8)}
            fill="url(#gradGrade)"
            stroke="#c084fc"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={handleCycleGrade}
          />
        </svg>

        {/* ========================================================
            DEDICATED OUTER ORBIT: ALL MATCHING FISH IMAGES (Locked on Orbit, Never Drift To Center)
            ======================================================== */}
        {items && items.length > 0 && (
          <div
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            style={{
              transform: `rotate(${dialRingRotation}deg)`,
              transformOrigin: '50% 50%',
              transition: isDraggingDialRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            {items.map((item, idx) => {
              const N = items.length;
              const baseAngle = idx * (360 / Math.max(1, N));
              const rad = ((baseAngle - 90) * Math.PI) / 180;
              const r = 186; // Cleanly centered inside the dedicated orbit ring (between r=158 and r=214)
              const x = 220 + r * Math.cos(rad);
              const y = 220 + r * Math.sin(rad);
              const isSelected = idx === safeActiveIndex;

              return (
                <button
                  key={item._id || idx}
                  type="button"
                  onPointerUp={(e) => {
                    if (isDialLocked || isDialLockedRef.current) return;
                    if (wasDraggingRef.current || hasMovedRef.current) return;
                    e.stopPropagation();
                    setActiveIndex(idx);
                  }}
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
                  className={`overflow-hidden flex items-center justify-center rounded-full fish-smartwatch-outer-thumb ${
                    isDialLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'is-selected w-13 h-13 xs:w-14 xs:h-14 sm:w-15 sm:h-15 xl:w-14 xl:h-14 bg-white rounded-full ring-2 ring-amber-500 border-2 border-amber-600 shadow-xl scale-110 z-40'
                      : 'w-10 h-10 xs:w-11 xs:h-11 sm:w-12 sm:h-12 xl:w-11 xl:h-11 bg-white/95 rounded-full border border-amber-300 shadow-xs hover:scale-120 hover:border-amber-500 hover:shadow-md z-30'
                  }`}
                  title={isDialLocked ? "Dial is locked. Tap Unlock to change fish" : `${item.name} (₹${item.price || 0}/Kg)`}
                >
                  <img
                    src={formatImageUrl(item.image)}
                    alt={item.name}
                    className="w-full h-full object-contain p-1 rounded-full pointer-events-none"
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* ========================================================
            NAVIGATION ARROWS (9 o'clock & 3 o'clock)
            Clean circular buttons with ONLY arrows (no text)
            ======================================================== */}
        <button
          type="button"
          disabled={safeActiveIndex === 0 || isDialLocked || isDialLockedRef.current}
          onClick={(e) => {
            e.stopPropagation();
            if (isDialLocked || isDialLockedRef.current) return;
            setActiveIndex(Math.max(0, safeActiveIndex - 1));
            setDialRingRotation((prev) => prev - ROTATION_STEP_DEG);
          }}
          style={{
            position: 'absolute',
            left: '21%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 35
          }}
          className={`no-dial-drag w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-md border border-slate-200/90 flex items-center justify-center text-slate-800 hover:bg-amber-50 active:scale-90 transition-all ${
            (isDialLocked || isDialLockedRef.current) ? 'opacity-30 cursor-not-allowed' : 'disabled:opacity-20 cursor-pointer'
          }`}
          title={(isDialLocked || isDialLockedRef.current) ? "Dial is locked" : "Previous Fish"}
        >
          <ChevronLeft size={16} className="text-slate-800 stroke-[2.5]" />
        </button>

        <button
          type="button"
          disabled={safeActiveIndex >= items.length - 1 || isDialLocked || isDialLockedRef.current}
          onClick={(e) => {
            e.stopPropagation();
            if (isDialLocked || isDialLockedRef.current) return;
            setActiveIndex(Math.min(items.length - 1, safeActiveIndex + 1));
            setDialRingRotation((prev) => prev + ROTATION_STEP_DEG);
          }}
          style={{
            position: 'absolute',
            left: '79%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 35
          }}
          className={`no-dial-drag w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white shadow-md border border-slate-200/90 flex items-center justify-center text-slate-800 hover:bg-amber-50 active:scale-90 transition-all ${
            (isDialLocked || isDialLockedRef.current) ? 'opacity-30 cursor-not-allowed' : 'disabled:opacity-20 cursor-pointer'
          }`}
          title={(isDialLocked || isDialLockedRef.current) ? "Dial is locked" : "Next Fish"}
        >
          <ChevronRight size={16} className="text-slate-800 stroke-[2.5]" />
        </button>

        {/* ========================================================
            CENTER CIRCULAR CORE DISC (Click to Add & Open Order)
            ======================================================== */}
        <div
          ref={cardRef}
          onTouchStart={handleCenterTouchStart}
          onTouchEnd={handleCenterTouchEnd}
          onClick={handleCenterClick}
          className="no-dial-drag relative w-[40%] h-[40%] rounded-full border-[3px] border-[#fdba74] shadow-lg overflow-hidden z-20 select-none cursor-pointer active:scale-95 transition-transform bg-white flex items-center justify-center p-2 sm:p-2.5"
          style={{
            boxShadow: '0 6px 20px -2px rgba(245, 158, 11, 0.22), inset 0 2px 6px rgba(255, 255, 255, 0.95)'
          }}
          title={`Tap to Add ${currentItem.name} to Cart`}
        >
          {/* Fish Image: Displays ENTIRE fish cleanly centered without text overlay */}
          {showImages ? (
            <img
              src={formatImageUrl(currentItem.image)}
              alt={currentItem.name}
              className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-300 drop-shadow-md select-none"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-sky-50 to-amber-50 flex items-center justify-center">
              <Scale size={36} className="text-amber-700" />
            </div>
          )}
        </div>

        {/* ========================================================
            6 CURVED SECTOR BUTTON OVERLAYS (Symmetrically positioned)
            ======================================================== */}

        {/* 1. TOP CURVED BUTTON (12 o'clock / 0°): CRM PETAL */}
        <div
          style={getCurvedSectorCenterStyle(0)}
          onClick={(e) => {
            e.stopPropagation();
            setShowCrmPicker((prev) => !prev);
          }}
          className={`no-dial-drag relative pointer-events-auto select-none flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[84px] md:max-w-[115px] lg:max-w-[135px] overflow-visible ${
            isCrmBlinking ? 'ring-4 ring-amber-400 bg-amber-300/80 rounded-2xl animate-pulse scale-105 shadow-lg' : ''
          }`}
          title="Customer CRM (Tap to select or change)"
        >
          {/* Direct Deselect / Clear Button on Petal */}
          {Boolean(customerName || customerPhone) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (handleClearCustomer) handleClearCustomer();
                if (setCustomerName) setCustomerName('');
                if (setCustomerPhone) setCustomerPhone('');
                if (onCustomerSelect) onCustomerSelect(null);
                if (showToast) showToast('Customer cleared / deselected', 'info');
              }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 md:w-5 md:h-5 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-90 text-white flex items-center justify-center shadow-md cursor-pointer z-40 transition-transform border border-white"
              title="Clear / Deselect Customer"
            >
              <X size={10} className="stroke-[3] md:w-3 md:h-3" />
            </button>
          )}

          <div className="flex items-center gap-1 mb-0.5">
            {customerPhoto ? (
              <img
                src={customerPhoto}
                alt={customerName || 'Customer'}
                className="w-4 h-4 md:w-5 md:h-5 rounded-full object-cover border border-amber-500 shrink-0"
              />
            ) : fishOrderMode === 'bulk' ? (
              <Building2 size={12} className="text-amber-800 stroke-[2.5] md:w-4.5 md:h-4.5" />
            ) : fishOrderMode === 'export' ? (
              <Globe size={12} className="text-indigo-800 stroke-[2.5] md:w-4.5 md:h-4.5" />
            ) : (
              <User size={12} className="text-amber-800 stroke-[2.5] md:w-4.5 md:h-4.5" />
            )}
          </div>
          <span className="text-[7.5px] sm:text-[8.5px] md:text-[10.5px] lg:text-xs font-bold text-amber-900 leading-none whitespace-nowrap">
            {fishOrderMode === 'bulk' ? 'Dealer' : fishOrderMode === 'export' ? 'Client' : 'Customer'}
          </span>
          <span className="text-[9px] sm:text-[10px] md:text-[12px] lg:text-sm font-black text-slate-900 font-mono leading-tight mt-0.5 truncate max-w-[74px] md:max-w-[105px] lg:max-w-[125px]">
            {customerName || customerPhone ? (
              <span>{customerName || customerPhone}</span>
            ) : (
              <span className="text-amber-700/80 text-[8px] md:text-[10px] font-bold underline decoration-dotted">Select</span>
            )}
          </span>
        </div>

        {/* 2. TOP-LEFT CURVED BUTTON (10 o'clock / 300°): GRADE BUTTON (1-Tap Cycle, No Popups) */}
        <div
          style={getCurvedSectorCenterStyle(300)}
          className="no-dial-drag pointer-events-auto select-none flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[62px] md:max-w-[88px] lg:max-w-[105px] overflow-hidden"
          onClick={handleCycleGrade}
          title="Tap to cycle Grade (Small -> Medium -> Big)"
        >
          <Award size={13} className="text-[#7e22ce] stroke-[2.5] mb-0.5 md:w-4.5 md:h-4.5" />
          <span className="text-[8px] sm:text-[9px] md:text-[10.5px] lg:text-xs font-bold text-slate-700 leading-none">Grade</span>
          <span className="text-[9.5px] sm:text-[10.5px] md:text-sm lg:text-base font-black text-slate-900 leading-tight capitalize mt-0.5 truncate max-w-[54px] md:max-w-[80px] lg:max-w-[95px]">
            {activeGrade}
          </span>
        </div>

        {/* 3. TOP-RIGHT CURVED SECTOR (2 o'clock / 60°): RATE DISPLAY (Long-press to Edit) */}
        <div
          style={getCurvedSectorCenterStyle(60)}
          onMouseDown={startRateLongPress}
          onMouseUp={cancelRateLongPress}
          onMouseLeave={cancelRateLongPress}
          onTouchStart={startRateLongPress}
          onTouchEnd={cancelRateLongPress}
          onTouchCancel={cancelRateLongPress}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditingRate && showToast) {
              showToast('Hold (long press) to edit rate price', 'info');
            }
          }}
          className="no-dial-drag pointer-events-auto select-none flex flex-col items-center justify-center text-center max-w-[64px] md:max-w-[90px] lg:max-w-[105px] overflow-hidden px-0.5 cursor-pointer active:scale-95 transition-transform"
          title="Long-press to edit rate"
        >
          <Tag size={12} className="text-[#c2410c] stroke-[2.5] mb-0.5 shrink-0 md:w-4.5 md:h-4.5" />
          <span className="text-[7.5px] sm:text-[8.5px] md:text-[10.5px] lg:text-xs font-bold text-[#9a3412] leading-none whitespace-nowrap">
            Rate {customRate !== null && <span className="text-emerald-700 font-black">*</span>}
          </span>
          <span className="text-[9px] sm:text-[10px] md:text-[12px] lg:text-sm font-black text-[#c2410c] font-mono leading-tight mt-0.5 whitespace-nowrap tracking-tight">
            ₹{currentRateAmount}/Kg
          </span>
        </div>

        {/* 4. BOTTOM-LEFT CURVED BUTTON (8 o'clock / 240°): CUTTING STYLE BUTTON (1-Tap Cycle, No Popups) */}
        <div
          style={getCurvedSectorCenterStyle(240)}
          className="no-dial-drag pointer-events-auto select-none flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[62px] md:max-w-[88px] lg:max-w-[105px] overflow-hidden"
          onClick={handleCycleCut}
          title="Tap to cycle Cutting Style"
        >
          <Scissors size={13} className="text-[#0369a1] stroke-[2.5] mb-0.5 md:w-4.5 md:h-4.5" />
          <span className="text-[8px] sm:text-[9px] md:text-[10.5px] lg:text-xs font-bold text-slate-700 leading-none">Cut</span>
          <span className="text-[9.5px] sm:text-[10.5px] md:text-sm lg:text-base font-black text-slate-900 leading-tight mt-0.5 truncate max-w-[54px] md:max-w-[80px] lg:max-w-[95px]">
            {selectedCutType}
          </span>
        </div>

        {/* 5. BOTTOM-RIGHT CURVED SECTOR (4 o'clock / 120°): LIVE TOTAL DISPLAY (Long-press to Edit & Auto-Discount) */}
        <div
          style={getCurvedSectorCenterStyle(120)}
          onMouseDown={startTotalLongPress}
          onMouseUp={cancelTotalLongPress}
          onMouseLeave={cancelTotalLongPress}
          onTouchStart={startTotalLongPress}
          onTouchEnd={cancelTotalLongPress}
          onTouchCancel={cancelTotalLongPress}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditingTotal && showToast) {
              showToast('Hold (long press) to enter negotiated total & apply discount', 'info');
            }
          }}
          className="no-dial-drag pointer-events-auto select-none flex flex-col items-center justify-center text-center max-w-[64px] md:max-w-[90px] lg:max-w-[105px] overflow-hidden px-0.5 cursor-pointer active:scale-95 transition-transform"
          title="Long-press to enter negotiated total"
        >
          <Layers size={12} className="text-[#15803d] stroke-[2.5] mb-0.5 shrink-0 md:w-4.5 md:h-4.5" />
          <span className="text-[7.5px] sm:text-[8.5px] md:text-[10.5px] lg:text-xs font-bold text-[#166534] leading-none whitespace-nowrap">
            Total {calculatedDiscount > 0 && <span className="text-rose-600 font-black">(-₹{calculatedDiscount.toFixed(0)})</span>}
          </span>
          <span className={`font-black text-[#15803d] font-mono leading-tight mt-0.5 whitespace-nowrap tracking-tight ${
            currentTotalAmount >= 10000 ? 'text-[8.5px] sm:text-[9.5px] md:text-[11.5px] lg:text-[12.5px]' : 'text-[9.5px] sm:text-[10px] md:text-[12px] lg:text-sm'
          }`}>
            ₹{currentTotalAmount >= 1000 ? Math.round(currentTotalAmount) : currentTotalAmount.toFixed(2)}
          </span>
        </div>

        {/* 6. BOTTOM CURVED SECTOR (6 o'clock / 180°): WEIGHT STEPPER PETAL */}
        <div
          style={getCurvedSectorCenterStyle(180)}
          className="no-dial-drag pointer-events-auto select-none flex flex-col items-center justify-center text-center max-w-[110px] sm:max-w-[125px] md:max-w-[160px] lg:max-w-[185px] overflow-hidden px-0.5"
          title="Weight Stepper (Tap - / + or enter weight)"
        >
          <div className="flex items-center gap-1 mb-0.5">
            <ShoppingBag size={11} className="text-[#92400e] stroke-[2.5] md:w-4 md:h-4" />
            <span className="text-[7.5px] sm:text-[8.5px] md:text-[10.5px] lg:text-xs font-bold text-[#92400e] leading-none whitespace-nowrap">
              {isBoxBasedMode && boxFishMode === 'single' ? 'Box Wt' : 'Weight'}
            </span>
          </div>

          {(!isBoxBasedMode || boxFishMode === 'mixed') ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 sm:gap-1 shrink-0"
            >
              <button
                type="button"
                onClick={handleDecreaseWeight}
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
                title="Decrease weight (-0.5 Kg)"
              >
                <Minus size={11} className="stroke-[3] md:w-3.5 md:h-3.5" />
              </button>

              <div className="flex items-center gap-0.5 px-0.5">
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  enterKeyHint="done"
                  value={weightKg === '0' || weightKg === 0 ? '' : weightKg}
                  onFocus={(e) => {
                    e.target.select();
                    setDialLock(true);
                    setWeightKg('');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialLock(true);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDialLock(true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setDialLock(true);
                  }}
                  onBlur={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (!e.target.value || isNaN(parsed) || parsed <= 0) {
                      setWeightKg('1.000');
                    }
                  }}
                  onChange={(e) => {
                    setDialLock(true);
                    setWeightKg(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      const parsed = parseFloat(e.target.value);
                      if (!e.target.value || isNaN(parsed) || parsed <= 0) {
                        setWeightKg('1.000');
                      } else {
                        setWeightKg(parsed.toFixed(3));
                      }
                      e.target.blur();
                    }
                  }}
                  placeholder=""
                  style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                  className="text-xs sm:text-sm font-black text-slate-900 font-mono text-center bg-transparent border-0 outline-none shadow-none focus:outline-none focus:ring-0 w-11 sm:w-13 leading-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[9px] sm:text-[10px] font-black text-slate-800">Kg</span>
              </div>

              <button
                type="button"
                onClick={handleIncreaseWeight}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
                title="Increase weight (+0.5 Kg)"
              >
                <Plus size={11} className="stroke-[3]" />
              </button>
            </div>
          ) : (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 sm:gap-1 shrink-0"
            >
              <button
                type="button"
                onClick={() => setBoxWeightKg((prev) => String(Math.max(1, (parseFloat(prev) || 1) - 1)))}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
              >
                <Minus size={11} className="stroke-[3]" />
              </button>

              <div className="flex items-center gap-0.5 px-0.5">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={boxWeightKg === '0' || boxWeightKg === 0 ? '' : boxWeightKg}
                  onFocus={(e) => {
                    e.target.select();
                    setDialLock(true);
                    setBoxWeightKg('');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialLock(true);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setDialLock(true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setDialLock(true);
                  }}
                  onBlur={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (!e.target.value || isNaN(parsed) || parsed <= 0) {
                      setBoxWeightKg('1');
                    }
                  }}
                  onChange={(e) => {
                    setDialLock(true);
                    setBoxWeightKg(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.target.blur();
                      const enteredVal = parseFloat(e.target.value) || parseFloat(boxWeightKg) || 1;
                      setBoxWeightKg(String(enteredVal));
                      if (openBoxPackerModal) {
                        openBoxPackerModal(currentItem, activeGrade, enteredVal);
                      }
                    }
                  }}
                  className="text-xs sm:text-sm font-black text-slate-900 font-mono text-center bg-transparent border-0 outline-none w-10 sm:w-12 leading-none p-0"
                />
                <span className="text-[9px] sm:text-[10px] font-black text-slate-800">Kg</span>
              </div>

              <button
                type="button"
                onClick={() => setBoxWeightKg((prev) => String((parseFloat(prev) || 1) + 1))}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
              >
                <Plus size={11} className="stroke-[3]" />
              </button>
            </div>
          )}
        </div>

        {/* ========================================================
            CRM CUSTOMER / DEALER SELECTION POPOVER
            ======================================================== */}
        {showCrmPicker && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="no-dial-drag absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/98 backdrop-blur-md border-2 border-amber-400 rounded-2xl p-3 shadow-2xl w-72 sm:w-80 max-w-[94vw] animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center pb-2 mb-2 border-b border-amber-100">
              <div className="flex items-center gap-1.5">
                <User size={15} className="text-amber-700" />
                <span className="text-xs font-black text-slate-800">
                  {fishOrderMode === 'bulk' ? 'Select Dealer' : fishOrderMode === 'export' ? 'Select Client' : 'Select Customer'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCrmPicker(false)}
                className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Currently Selected Customer Banner with Clear / Deselect Button */}
            {(customerName || customerPhone) && (
              <div className="mb-2 p-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  {customerPhoto ? (
                    <img
                      src={customerPhoto}
                      alt={customerName || 'Customer'}
                      className="w-10 h-10 rounded-full object-cover border-2 border-amber-500 shrink-0 shadow-xs"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {(customerName || customerPhone || 'C').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 truncate">
                    <div className="text-[9px] uppercase font-bold tracking-wider text-amber-700">Active Customer</div>
                    <div className="text-xs font-black text-slate-900 truncate">{customerName || 'Customer'}</div>
                    {customerPhone && <div className="text-[10px] font-mono text-slate-600 truncate">{customerPhone}</div>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (handleClearCustomer) handleClearCustomer();
                    if (setCustomerName) setCustomerName('');
                    if (setCustomerPhone) setCustomerPhone('');
                    if (onCustomerSelect) onCustomerSelect(null);
                    setShowCrmPicker(false);
                    if (showToast) showToast('Customer cleared / deselected', 'info');
                  }}
                  className="px-2 py-1 text-[11px] font-black text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-lg cursor-pointer transition-all shrink-0 flex items-center gap-1 shadow-2xs"
                  title="Deselect Customer"
                >
                  <X size={11} className="stroke-[3]" />
                  <span>Clear</span>
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={crmSearch}
                onChange={(e) => setCrmSearch(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Predefined Customers List with BIG Images */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
              {(predefinedCustomers || [])
                .filter((c) => {
                  if (!c) return false;
                  if (!crmSearch) return true;
                  const s = crmSearch.toLowerCase();
                  return (
                    (c.name && c.name.toLowerCase().includes(s)) ||
                    (c.phone && c.phone.includes(s)) ||
                    (c.businessName && c.businessName.toLowerCase().includes(s))
                  );
                })
                .slice(0, 10)
                .map((c, i) => {
                  const photoUrl = c.photo || c.image || c.avatar;
                  const isCurSelected = (customerPhone && c.phone === customerPhone) || (customerName && c.name === customerName);
                  return (
                    <button
                      key={c._id || i}
                      type="button"
                      onClick={() => {
                        if (isCurSelected) {
                          if (handleClearCustomer) handleClearCustomer();
                          if (setCustomerName) setCustomerName('');
                          if (setCustomerPhone) setCustomerPhone('');
                          if (onCustomerSelect) onCustomerSelect(null);
                          if (showToast) showToast('Customer deselected', 'info');
                        } else {
                          if (handleSelectCustomer) handleSelectCustomer(c);
                          else if (onCustomerSelect) onCustomerSelect(c);
                          if (showToast) showToast(`Selected ${c.name || 'Customer'}`, 'success');
                        }
                        setShowCrmPicker(false);
                      }}
                      className={`w-full p-1.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                        isCurSelected
                          ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400 font-bold'
                          : 'hover:bg-amber-50/90 text-slate-800 border border-slate-100 hover:border-amber-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Big Customer Photo / Avatar */}
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={c.name || 'Customer'}
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full object-cover shrink-0 shadow-sm ${
                              isCurSelected ? 'border-2 border-white ring-2 ring-amber-300' : 'border-2 border-amber-300'
                            }`}
                          />
                        ) : (
                          <div
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full font-black text-sm flex items-center justify-center shrink-0 shadow-sm ${
                              isCurSelected
                                ? 'bg-white text-amber-700'
                                : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                            }`}
                          >
                            {(c.name || c.phone || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 truncate">
                          <div className={`font-black text-xs sm:text-[13px] truncate ${isCurSelected ? 'text-white' : 'text-slate-900'}`}>
                            {c.name || 'Unnamed'}
                          </div>
                          <div className={`text-[10px] sm:text-[11px] font-mono truncate mt-0.5 ${isCurSelected ? 'text-amber-100' : 'text-slate-500'}`}>
                            {c.phone || c.businessName || ''}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCurSelected && (
                          <div className="w-5 h-5 rounded-full bg-white text-amber-700 flex items-center justify-center shadow-xs">
                            <Check size={13} className="stroke-[3]" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Bottom Actions: Clear Selection or Open Full Customer Modal */}
            <div className="pt-2 mt-2 border-t border-amber-100 flex items-center justify-between gap-1">
              {(customerName || customerPhone) && (
                <button
                  type="button"
                  onClick={() => {
                    if (handleClearCustomer) handleClearCustomer();
                    if (setCustomerName) setCustomerName('');
                    if (setCustomerPhone) setCustomerPhone('');
                    if (onCustomerSelect) onCustomerSelect(null);
                    setShowCrmPicker(false);
                    if (showToast) showToast('Customer cleared / deselected', 'info');
                  }}
                  className="px-2.5 py-1 text-[11px] font-black text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                >
                  Clear Selection
                </button>
              )}
              {onOpenCustomerModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowCrmPicker(false);
                    onOpenCustomerModal();
                  }}
                  className="ml-auto px-2.5 py-1 text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  + Add / Full CRM
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            INLINE RATE EDIT POPOVER (Long-press triggered)
            ======================================================== */}
        {isEditingRate && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="no-dial-drag absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/98 backdrop-blur-md border-2 border-orange-400 rounded-2xl p-3 shadow-2xl w-56 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center pb-1.5 mb-2 border-b border-orange-100">
              <span className="text-xs font-black text-slate-800">Edit Rate Price (₹/Kg)</span>
              <button
                type="button"
                onClick={() => setIsEditingRate(false)}
                className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-1.5 bg-orange-50/80 border border-orange-300 rounded-xl px-2.5 py-1 mb-2.5">
              <span className="text-sm font-black text-orange-900 font-mono">₹</span>
              <input
                type="number"
                step="any"
                autoFocus
                value={tempRateInput}
                onChange={(e) => setTempRateInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRate();
                  if (e.key === 'Escape') setIsEditingRate(false);
                }}
                className="w-full text-base font-black font-mono text-slate-900 bg-transparent border-0 outline-none focus:outline-none"
                placeholder="Rate/Kg"
              />
              <span className="text-[10px] font-bold text-slate-600">/Kg</span>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCustomRate(null);
                  setIsEditingRate(false);
                  if (showToast) showToast('Reset to catalog rate', 'info');
                }}
                className="flex-1 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSaveRate}
                className="flex-1 py-1 text-[11px] font-black bg-orange-600 hover:bg-orange-700 text-white rounded-lg cursor-pointer transition-colors"
              >
                Save Rate
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            INLINE NEGOTIATED TOTAL POPOVER (Long-press triggered)
            ======================================================== */}
        {isEditingTotal && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="no-dial-drag absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/98 backdrop-blur-md border-2 border-emerald-400 rounded-2xl p-3 shadow-2xl w-60 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-emerald-100">
              <span className="text-xs font-black text-slate-800">Negotiated Total Amount</span>
              <button
                type="button"
                onClick={() => setIsEditingTotal(false)}
                className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="text-[11px] text-slate-500 mb-1 flex justify-between">
              <span>Standard Total:</span>
              <span className="font-bold font-mono text-slate-700">₹{standardTotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50/80 border border-emerald-300 rounded-xl px-2.5 py-1 mb-2">
              <span className="text-sm font-black text-emerald-900 font-mono">₹</span>
              <input
                type="number"
                step="any"
                autoFocus
                value={tempTotalInput}
                onChange={(e) => setTempTotalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveTotal();
                  if (e.key === 'Escape') setIsEditingTotal(false);
                }}
                className="w-full text-base font-black font-mono text-slate-900 bg-transparent border-0 outline-none focus:outline-none"
                placeholder="Total ₹"
              />
            </div>
            {/* Live Discount Difference Preview */}
            {(() => {
              const entered = parseFloat(tempTotalInput);
              const previewDiff = !isNaN(entered) && standardTotal > entered ? standardTotal - entered : 0;
              return previewDiff > 0 ? (
                <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 rounded-lg px-2 py-0.5 mb-2 text-center">
                  Auto-Discount: -₹{previewDiff.toFixed(2)}
                </div>
              ) : null;
            })()}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCustomTotal(null);
                  setIsEditingTotal(false);
                  if (showToast) showToast('Reset to standard calculated total', 'info');
                }}
                className="flex-1 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSaveTotal}
                className="flex-1 py-1 text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors"
              >
                Apply Total
              </button>
            </div>
          </div>
        )}

        {/* System AI & Voice Seafood Calculator Modal */}
        {showCalculator && (
          <CalculatorModal
            isOpen={showCalculator}
            onClose={() => setShowCalculator(false)}
          />
        )}
        </div>
      </div>
    </div>
  );
}
