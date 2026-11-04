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
  Award
} from 'lucide-react';

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
  showImages = true,
  showAnimation = true,
  cart = [],
  cartTotal,
  onViewOrder
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

  // Popover menus
  const [showGradeMenu, setShowGradeMenu] = useState(false);
  const [showCutMenu, setShowCutMenu] = useState(false);

  // Dial rotation state & item cycling physics
  const [dialRingRotation, setDialRingRotation] = useState(0);
  const isDraggingDialRef = useRef(false);
  const lastAngleRef = useRef(0);
  const accumulatedAngleRef = useRef(0);
  const dialRef = useRef(null);
  const cardRef = useRef(null);
  const touchStartXRef = useRef(null);
  const touchStartYRef = useRef(null);
  const touchStartTimeRef = useRef(0);

  // Degrees of rotation required to switch to next/previous fish
  const ROTATION_STEP_DEG = 28;

  // Sync state when active item changes
  useEffect(() => {
    setGradeOverride('small');
    setWeightKg('1.000');
    setTareGrams(0);
    if (currentItem?.boxPackingKg) {
      setBoxWeightKg(String(currentItem.boxPackingKg));
    } else {
      setBoxWeightKg('1');
    }
  }, [currentItem?._id]);

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

  const totalAmount = parseFloat((netKg * activeRate).toFixed(2));
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

  const currentRateAmount = isBoxBasedMode ? boxRate : activeRate;
  const currentTotalAmount = isBoxBasedMode
    ? (boxFishMode === 'mixed' ? mixedItemTotal : totalBoxPrice)
    : totalAmount;

  // Cart total & item count for the unified bottom action dock
  const cartCount = cart && cart.length > 0
    ? cart.reduce((sum, item) => item.isCancelled ? sum : sum + (item.quantity || 1) - (item.cancelledQuantity || 0), 0)
    : 0;
  const computedCartTotal = cartTotal !== undefined
    ? cartTotal
    : (cart && cart.length > 0 ? cart.reduce((sum, item) => item.isCancelled ? sum : sum + (parseFloat(item.total) || 0), 0) : 0);

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

  // Dial touch rotation gesture - rotates dial AND cycles items like a digital crown
  const handleDialStart = (clientX, clientY, target) => {
    if (target && (target.closest('button') || target.closest('input') || target.closest('select'))) {
      return;
    }
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    lastAngleRef.current = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    isDraggingDialRef.current = true;
    accumulatedAngleRef.current = 0;
  };

  const handleDialMove = (clientX, clientY) => {
    if (!isDraggingDialRef.current || !dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    let delta = currentAngle - lastAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngleRef.current = currentAngle;

    // Rotate overall bezel ring smoothly with finger gesture!
    setDialRingRotation((prev) => prev + delta);

    // Accumulate angular delta to cycle items
    accumulatedAngleRef.current += delta;

    if (accumulatedAngleRef.current >= ROTATION_STEP_DEG) {
      if (items.length > 0) {
        setActiveIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      }
      accumulatedAngleRef.current = 0;
    } else if (accumulatedAngleRef.current <= -ROTATION_STEP_DEG) {
      if (items.length > 0) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      }
      accumulatedAngleRef.current = 0;
    }
  };

  const handleDialEnd = () => {
    isDraggingDialRef.current = false;
    accumulatedAngleRef.current = 0;
  };

  const handleDialTouchStart = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    handleDialStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
  };

  const handleDialTouchMove = (e) => {
    if (!isDraggingDialRef.current) return;
    if (e.cancelable) e.preventDefault();
    handleDialMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleDialMouseDown = (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    handleDialStart(e.clientX, e.clientY, e.target);
  };

  const handleDialMouseMove = (e) => {
    if (!isDraggingDialRef.current) return;
    e.preventDefault();
    handleDialMove(e.clientX, e.clientY);
  };

  useEffect(() => {
    const onGlobalEnd = () => {
      if (isDraggingDialRef.current) {
        handleDialEnd();
      }
    };
    window.addEventListener('mouseup', onGlobalEnd);
    window.addEventListener('touchend', onGlobalEnd);
    return () => {
      window.removeEventListener('mouseup', onGlobalEnd);
      window.removeEventListener('touchend', onGlobalEnd);
    };
  }, []);

  // Center Disc: Tap to Add & View Order, or Swipe horizontally to switch fish
  const handleCenterImageAddAndRedirect = (e) => {
    if (e) e.stopPropagation();
    const success = handleAddCurrentToBill();
    if (success && onViewOrder) {
      onViewOrder();
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

    // Horizontal swipe gesture (> 35px) cycles fish items & ring rotates
    if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
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
    const r = 134; // exact midpoint between rIn=110 and rOut=158
    const x = 170 + r * Math.cos(angleRad);
    const y = 170 + r * Math.sin(angleRad);
    return {
      position: 'absolute',
      left: `${((x / 340) * 100).toFixed(2)}%`,
      top: `${((y / 340) * 100).toFixed(2)}%`,
      transform: 'translate(-50%, -50%)',
      zIndex: 25
    };
  };

  // Add Item to Bill (returns true on success, false on validation error)
  const handleAddCurrentToBill = () => {
    if (!currentItem) return false;
    if (isLocked || (orderStatus === 'Billed' && !hasPendingChanges)) {
      if (showToast) showToast(t("Order is billed. Click EDIT to modify."), 'warning');
      return false;
    }

    if (isBoxBasedMode) {
      if (boxFishMode === 'mixed') {
        if (netKg <= 0) {
          if (showToast) showToast(`Please enter valid weight in Kg for Box #${activeBoxNumber}`, 'error');
          return false;
        }
        const itemPrice = mixedItemTotal;
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
          quantity: 1,
          weightKg: netKg,
          enteredWeight: netKg,
          grossWeightKg: netKg,
          netWeightKg: netKg,
          pricePerKg: boxRate,
          price: itemPrice,
          total: itemPrice,
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
        quantity: 1,
        weightKg: totalBoxWeightKg,
        enteredWeight: totalBoxWeightKg,
        grossWeightKg: totalBoxWeightKg,
        netWeightKg: totalBoxWeightKg,
        pricePerKg: boxRate,
        price: totalBoxPrice,
        total: totalBoxPrice,
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
    <div className="relative w-full h-full flex flex-col justify-around items-center select-none py-1 px-1 sm:px-2 overflow-x-hidden">
      {/* Popovers backdrop */}
      {(showGradeMenu || showCutMenu) && (
        <div
          className="fixed inset-0 z-40 bg-black/10 backdrop-blur-2xs"
          onClick={() => {
            setShowGradeMenu(false);
            setShowCutMenu(false);
          }}
        />
      )}

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
        className="relative w-[340px] sm:w-[380px] md:w-[440px] lg:w-[470px] xl:w-[490px] h-[340px] sm:h-[380px] md:h-[440px] lg:h-[470px] xl:h-[490px] max-w-[min(96vw,66vh)] max-h-[min(96vw,66vh)] aspect-square mx-auto shrink-0 select-none touch-none flex items-center justify-center my-auto cursor-grab active:cursor-grabbing rounded-full"
        style={{
          background: 'radial-gradient(circle at 50% 30%, #ffffff 0%, #faf6f0 55%, #f5eee3 85%, #ede2d3 100%)',
          boxShadow: '0 16px 42px -10px rgba(245, 158, 11, 0.3), inset 0 2px 10px rgba(255, 255, 255, 0.95), inset 0 -6px 14px rgba(217, 119, 6, 0.12)'
        }}
      >
        {/* Luminous Ambient Halo Bezel Ring & 5 Curved Sector Buttons */}
        <svg
          viewBox="0 0 340 340"
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

            {/* Gradients for the 5 Curved Sectors matching Image 1 */}
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
              LUMINOUS AMBIENT HALO BEZEL RING (Rotates with drag gesture)
              ======================================================== */}
          <g
            transform={`rotate(${dialRingRotation}, 170, 170)`}
            style={{
              transition: isDraggingDialRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
          >
            {/* Soft outer aura glow */}
            <circle
              cx="170"
              cy="170"
              r="161"
              fill="none"
              stroke="url(#haloGradient)"
              strokeWidth="8"
              filter="url(#haloGlow)"
              opacity="0.8"
            />

            {/* Crisp luminous ring */}
            <circle
              cx="170"
              cy="170"
              r="161"
              fill="none"
              stroke="url(#haloGradient)"
              strokeWidth="5"
            />

            {/* Delicate golden inner ring */}
            <circle
              cx="170"
              cy="170"
              r="154"
              fill="none"
              stroke="#fed7aa"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.85"
            />

            {/* Rotating bezel tick marks for authentic smartwatch dial feedback */}
            {Array.from({ length: 36 }).map((_, i) => {
              const a = (i * 360) / 36;
              const rad = ((a - 90) * Math.PI) / 180;
              const isMajor = i % 3 === 0;
              const r1 = isMajor ? 155 : 157;
              const r2 = 163;
              return (
                <line
                  key={i}
                  x1={170 + r1 * Math.cos(rad)}
                  y1={170 + r1 * Math.sin(rad)}
                  x2={170 + r2 * Math.cos(rad)}
                  y2={170 + r2 * Math.sin(rad)}
                  stroke={isMajor ? "#fed7aa" : "#ffffff"}
                  strokeWidth={isMajor ? "1.8" : "0.9"}
                  opacity={isMajor ? "0.95" : "0.6"}
                />
              );
            })}
          </g>

          {/* ========================================================
              5 CURVED SECTOR BUTTONS (Image 2 exact match - CONSTANT & STATIC)
              ======================================================== */}
          {/* 1. TOP SECTOR: WEIGHT STEPPER */}
          <path
            d={createRoundedAnnularSector(170, 170, 110, 158, 332, 28, 8)}
            fill="url(#gradWeight)"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
          />

          {/* 2. TOP-RIGHT SECTOR: RATE */}
          <path
            d={createRoundedAnnularSector(170, 170, 110, 158, 40, 92, 8)}
            fill="url(#gradRate)"
            stroke="#fb923c"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
          />

          {/* 3. BOTTOM-RIGHT SECTOR: TOTAL */}
          <path
            d={createRoundedAnnularSector(170, 170, 110, 158, 104, 152, 8)}
            fill="url(#gradTotal)"
            stroke="#4ade80"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
          />

          {/* 4. BOTTOM-LEFT SECTOR: CUTTING STYLE */}
          <path
            d={createRoundedAnnularSector(170, 170, 110, 158, 208, 256, 8)}
            fill="url(#gradCut)"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              if (!isBoxBasedMode) {
                setShowGradeMenu(false);
                setShowCutMenu((prev) => !prev);
              }
            }}
          />

          {/* 5. TOP-LEFT SECTOR: GRADE */}
          <path
            d={createRoundedAnnularSector(170, 170, 110, 158, 268, 320, 8)}
            fill="url(#gradGrade)"
            stroke="#c084fc"
            strokeWidth="2.5"
            strokeLinejoin="round"
            filter="url(#sectorShadow)"
            className="cursor-pointer pointer-events-auto hover:opacity-95 active:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              if (!isBoxBasedMode) {
                setShowCutMenu(false);
                setShowGradeMenu((prev) => !prev);
              }
            }}
          />
        </svg>

        {/* ========================================================
            NAVIGATION ARROWS (9 o'clock & 3 o'clock)
            Clean circular buttons with ONLY arrows (no text)
            ======================================================== */}
        <button
          type="button"
          disabled={safeActiveIndex === 0}
          onClick={(e) => {
            e.stopPropagation();
            setActiveIndex(Math.max(0, safeActiveIndex - 1));
            setDialRingRotation((prev) => prev - ROTATION_STEP_DEG);
          }}
          style={{
            position: 'absolute',
            left: '19%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 35
          }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-md border border-slate-200/90 flex items-center justify-center text-slate-800 hover:bg-amber-50 active:scale-90 disabled:opacity-20 cursor-pointer transition-all"
          title="Previous Fish"
        >
          <ChevronLeft size={18} className="text-slate-800 stroke-[2.5]" />
        </button>

        <button
          type="button"
          disabled={safeActiveIndex >= items.length - 1}
          onClick={(e) => {
            e.stopPropagation();
            setActiveIndex(Math.min(items.length - 1, safeActiveIndex + 1));
            setDialRingRotation((prev) => prev + ROTATION_STEP_DEG);
          }}
          style={{
            position: 'absolute',
            left: '81%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 35
          }}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white shadow-md border border-slate-200/90 flex items-center justify-center text-slate-800 hover:bg-amber-50 active:scale-90 disabled:opacity-20 cursor-pointer transition-all"
          title="Next Fish"
        >
          <ChevronRight size={18} className="text-slate-800 stroke-[2.5]" />
        </button>

        {/* ========================================================
            CENTER CIRCULAR CORE DISC (Click to Add & Open Order)
            ======================================================== */}
        <div
          ref={cardRef}
          onTouchStart={handleCenterTouchStart}
          onTouchEnd={handleCenterTouchEnd}
          onClick={handleCenterClick}
          className="relative w-[64%] h-[64%] rounded-full border-[3.5px] border-[#fdba74] shadow-xl overflow-hidden z-20 select-none cursor-pointer active:scale-95 transition-transform"
          style={{
            boxShadow: '0 8px 24px -2px rgba(245, 158, 11, 0.22), inset 0 2px 6px rgba(255, 255, 255, 0.95)'
          }}
        >
          {/* Fish Image fills full circle like a profile picture */}
          {showImages ? (
            <img
              src={formatImageUrl(currentItem.image)}
              alt={currentItem.name}
              className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none transition-transform duration-300"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-sky-50 to-amber-50 flex items-center justify-center">
              <Scale size={36} className="text-amber-700" />
            </div>
          )}

          {/* Fish Name Overlay: Centered clear-corridor badge (never overlaps petals or crops) */}
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 z-10 w-[84%] max-w-[130px] sm:max-w-[145px] flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="bg-white/94 backdrop-blur-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-xl shadow-xs border border-amber-200/80 max-w-full">
              <h3 className="text-[10px] sm:text-[11px] font-black text-slate-900 leading-tight text-center whitespace-normal break-words line-clamp-2">
                {(language !== 'en' && currentItem.nameTranslations?.[language]) || currentItem.name}
              </h3>
            </div>
          </div>
        </div>

        {/* ========================================================
            5 CURVED SECTOR BUTTON OVERLAYS (Image 2 exact match)
            ======================================================== */}

        {/* 1. TOP CURVED BUTTON (12 o'clock / 0°): WEIGHT STEPPER OR BOX COUNT */}
        <div
          style={getCurvedSectorCenterStyle(0)}
          className="pointer-events-auto select-none flex flex-col items-center justify-center text-center"
        >
          <ShoppingBag size={14} className="text-[#92400e] stroke-[2.5] mb-0.5" />
          {(!isBoxBasedMode || boxFishMode === 'mixed') ? (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 shrink-0"
            >
              <button
                type="button"
                onClick={handleDecreaseWeight}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
                title="Decrease weight (-0.5 Kg)"
              >
                <Minus size={11} className="stroke-[3]" />
              </button>

              <div className="flex items-center gap-0.5 px-0.5">
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                  className="text-xs sm:text-sm font-black text-slate-900 font-mono text-center bg-transparent border-0 outline-none shadow-none focus:outline-none focus:ring-0 w-11 sm:w-12 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] font-bold text-slate-700">Kg</span>
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
              className="flex items-center gap-1 shrink-0"
            >
              <button
                type="button"
                onClick={() => setBoxWeightKg((prev) => String(Math.max(1, (parseFloat(prev) || 1) - 1)))}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
                title="Decrease box weight (-1 Kg)"
              >
                <Minus size={11} className="stroke-[3]" />
              </button>

              <div className="flex items-center gap-0.5 px-0.5">
                <input
                  type="number"
                  min="1"
                  value={boxWeightKg}
                  onChange={(e) => setBoxWeightKg(e.target.value)}
                  style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                  className="text-xs sm:text-sm font-black text-slate-900 font-mono text-center bg-transparent border-0 outline-none shadow-none focus:outline-none focus:ring-0 w-10 sm:w-11 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-[10px] font-bold text-slate-700">Kg/Box</span>
              </div>

              <button
                type="button"
                onClick={() => setBoxWeightKg((prev) => String((parseFloat(prev) || 1) + 1))}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/95 hover:bg-white active:scale-90 text-amber-950 flex items-center justify-center font-black cursor-pointer border border-amber-300 shadow-2xs transition-transform"
                title="Increase box weight (+1 Kg)"
              >
                <Plus size={11} className="stroke-[3]" />
              </button>
            </div>
          )}
        </div>

        {/* 2. TOP-LEFT CURVED BUTTON (10 o'clock / 294°): GRADE BUTTON (No dropdown arrow) */}
        <div
          style={getCurvedSectorCenterStyle(294)}
          className="pointer-events-auto select-none flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[62px] overflow-hidden"
          onClick={(e) => {
            e.stopPropagation();
            setShowCutMenu(false);
            setShowGradeMenu((prev) => !prev);
          }}
          title="Change Grade"
        >
          <Award size={14} className="text-[#7e22ce] stroke-[2.5] mb-0.5" />
          <span className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-700 leading-none">Grade</span>
          <span className="text-[10px] sm:text-xs font-black text-slate-900 leading-tight capitalize mt-0.5 truncate max-w-[54px]">
            {activeGrade}
          </span>
        </div>

        {/* 3. TOP-RIGHT CURVED SECTOR (2 o'clock / 66°): RATE DISPLAY (Static Petal) */}
        <div
          style={getCurvedSectorCenterStyle(66)}
          className="pointer-events-none select-none flex flex-col items-center justify-center text-center max-w-[60px] overflow-hidden px-0.5"
        >
          <Tag size={13} className="text-[#c2410c] stroke-[2.5] mb-0.5 shrink-0" />
          <span className="text-[8px] sm:text-[9px] font-bold text-[#9a3412] leading-none whitespace-nowrap">Rate</span>
          <span className="text-[9.5px] sm:text-[10.5px] font-black text-[#c2410c] font-mono leading-tight mt-0.5 whitespace-nowrap tracking-tight">
            ₹{currentRateAmount}/Kg
          </span>
        </div>

        {/* 4. BOTTOM-LEFT CURVED BUTTON (8 o'clock / 232°): CUTTING STYLE BUTTON (No dropdown arrow) */}
        <div
          style={getCurvedSectorCenterStyle(232)}
          className="pointer-events-auto select-none flex flex-col items-center justify-center text-center cursor-pointer active:scale-95 transition-transform max-w-[64px] overflow-hidden"
          onClick={(e) => {
            e.stopPropagation();
            setShowGradeMenu(false);
            setShowCutMenu((prev) => !prev);
          }}
          title="Change Cutting Style"
        >
          <Scissors size={14} className="text-[#0369a1] stroke-[2.5] mb-0.5" />
          <span className="text-[8.5px] sm:text-[9.5px] font-bold text-slate-700 leading-none">Cut</span>
          <span className="text-[10px] sm:text-xs font-black text-slate-900 leading-tight mt-0.5 truncate max-w-[56px]">
            {selectedCutType}
          </span>
        </div>

        {/* 5. BOTTOM-RIGHT CURVED SECTOR (4 o'clock / 128°): LIVE TOTAL DISPLAY (Static Petal) */}
        <div
          style={getCurvedSectorCenterStyle(128)}
          className="pointer-events-none select-none flex flex-col items-center justify-center text-center max-w-[62px] overflow-hidden px-0.5"
        >
          <Layers size={13} className="text-[#15803d] stroke-[2.5] mb-0.5 shrink-0" />
          <span className="text-[8px] sm:text-[9px] font-bold text-[#166534] leading-none whitespace-nowrap">Total</span>
          <span className={`font-black text-[#15803d] font-mono leading-tight mt-0.5 whitespace-nowrap tracking-tight ${
            currentTotalAmount >= 10000 ? 'text-[9px] sm:text-[9.5px]' : 'text-[10px] sm:text-[10.5px]'
          }`}>
            ₹{currentTotalAmount >= 1000 ? Math.round(currentTotalAmount) : currentTotalAmount.toFixed(2)}
          </span>
        </div>

        {/* GRADE PICKER POPOVER */}
        {showGradeMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/98 backdrop-blur-md border-2 border-amber-400 rounded-2xl p-2.5 shadow-2xl w-56 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-amber-100">
              <span className="text-xs font-black text-slate-800">Select Size Grade</span>
              <button
                onClick={() => setShowGradeMenu(false)}
                className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="space-y-1">
              {[
                { key: 'small', label: 'Small', range: `0-${smallMax}k`, rate: currentItem?.sizeGrades?.small?.price || activeRate },
                { key: 'medium', label: 'Medium', range: `${smallMax}-${mediumMax}k`, rate: currentItem?.sizeGrades?.medium?.price || activeRate },
                { key: 'big', label: 'Big', range: `${mediumMax}+k`, rate: currentItem?.sizeGrades?.big?.price || activeRate }
              ].map((g) => {
                const isSelected = activeGrade === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => {
                      setGradeOverride(g.key);
                      setShowGradeMenu(false);
                    }}
                    className={`w-full py-1.5 px-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-amber-600 text-white font-black' : 'hover:bg-amber-50 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isSelected && <Check size={13} className="shrink-0" />}
                      <span>{g.label} ({g.range})</span>
                    </div>
                    <span className={`font-mono ${isSelected ? 'text-white' : 'text-emerald-700 font-black'}`}>₹{g.rate}/Kg</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CUTTING STYLE PICKER POPOVER */}
        {showCutMenu && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/98 backdrop-blur-md border-2 border-amber-400 rounded-2xl p-2.5 shadow-2xl w-56 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center pb-1.5 mb-1.5 border-b border-amber-100">
              <span className="text-xs font-black text-slate-800">Select Cutting Style</span>
              <button
                onClick={() => setShowCutMenu(false)}
                className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="space-y-1">
              {[
                { name: 'Whole', label: 'Whole (No Cut)' },
                { name: 'Cleaned', label: 'Cleaned Only' },
                { name: 'Curry Cut', label: 'Curry Cut Pieces' },
                { name: 'Fry Cut', label: 'Fry Cut Slices' },
                { name: 'Boneless Fillet', label: 'Boneless Fillet' }
              ].map((c) => {
                const isSelected = selectedCutType === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      setSelectedCutType(c.name);
                      setShowCutMenu(false);
                    }}
                    className={`w-full py-1.5 px-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-amber-800 text-white font-black' : 'hover:bg-amber-50 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isSelected && <Check size={13} className="shrink-0" />}
                      <span>{c.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          2. QUICK WEIGHT PRESETS ROW (Responsive for Phone & Tablet)
          ======================================================== */}
      {!isBoxBasedMode ? (
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mx-auto flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 px-1 py-1 shrink-0 my-1">
          {['1', '2', '5', '10'].map((kgVal) => {
            const isSelected = parseFloat(weightKg) === parseFloat(kgVal);
            return (
              <button
                key={kgVal}
                type="button"
                onClick={() => setWeightKg(parseFloat(kgVal).toFixed(3))}
                className={`px-2 sm:px-2.5 md:px-3.5 py-1 sm:py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#ea580c] text-white font-black shadow-xs scale-105'
                    : 'bg-white/95 text-slate-700 hover:bg-amber-50 border border-slate-200/90 shadow-2xs'
                }`}
              >
                {kgVal}k
              </button>
            );
          })}

          <div className="h-4 sm:h-5 w-px bg-slate-300 mx-0.5 shrink-0" />

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
              className="px-2 sm:px-2.5 md:px-3.5 py-1 sm:py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs sm:text-sm font-bold shrink-0 bg-white/95 text-slate-700 hover:bg-amber-50 border border-slate-200/90 shadow-2xs transition-all cursor-pointer"
            >
              {frac.label}
            </button>
          ))}

          <div className="h-4 sm:h-5 w-px bg-slate-300 mx-0.5 shrink-0" />

          {[0, 50].map((tg) => (
            <button
              key={tg}
              type="button"
              onClick={() => setTareGrams(tg)}
              className={`px-2 sm:px-2.5 md:px-3 py-1 sm:py-1.5 md:py-2 rounded-lg md:rounded-xl text-xs sm:text-sm font-bold shrink-0 cursor-pointer transition-colors ${
                tareGrams === tg && tg !== 0
                  ? 'bg-[#ea580c] text-white font-black shadow-xs scale-105'
                  : 'bg-white/95 text-slate-700 hover:bg-slate-100 border border-slate-200/90 shadow-2xs'
              }`}
            >
              {tg === 0 ? 'Tare 0' : '-50g'}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Quick Preset Buttons: Box Weight for Single mode, or Fish Weight for Mixed mode */}
          {boxFishMode === 'single' ? (
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 py-1 px-1 text-xs shrink-0 my-1">
              {['20', '30', '40', '50', '60'].map((wVal) => {
                const isSelected = parseFloat(boxWeightKg) === parseFloat(wVal);
                return (
                  <button
                    key={wVal}
                    type="button"
                    onClick={() => setBoxWeightKg(wVal)}
                    className={`px-2.5 sm:px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white font-black shadow-xs scale-105'
                        : 'bg-white/95 text-slate-700 hover:bg-sky-50 border border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    {wVal}k
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 md:gap-2 py-1 px-1 text-xs shrink-0 my-1">
              {['2', '5', '10', '20', '30', '50'].map((kgVal) => {
                const isSelected = parseFloat(weightKg) === parseFloat(kgVal);
                return (
                  <button
                    key={kgVal}
                    type="button"
                    onClick={() => setWeightKg(parseFloat(kgVal).toFixed(3))}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#ea580c] text-white font-black shadow-xs scale-105'
                        : 'bg-white/95 text-slate-700 hover:bg-amber-50 border border-slate-200/90 shadow-2xs'
                    }`}
                  >
                    {kgVal}k
                  </button>
                );
              })}
            </div>
          )}

          {/* Wholesale / Export Box Mode Selector & Interactive Box Packing Manager */}
          <div className="w-full max-w-sm sm:max-w-md mx-auto flex flex-col items-center gap-1 px-2 py-0.5 shrink-0">
            {/* Box Type Toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setBoxFishMode('single')}
                className={`px-2.5 py-0.5 rounded-lg text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer ${
                  boxFishMode === 'single'
                    ? 'bg-sky-600 text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🐟 1 Fish / Box
              </button>
              <button
                type="button"
                onClick={() => setBoxFishMode('mixed')}
                className={`px-2.5 py-0.5 rounded-lg text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer ${
                  boxFishMode === 'mixed'
                    ? 'bg-[#ea580c] text-white font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🐠 Mixed Fish Box
              </button>
            </div>

            {/* When Mixed Box is selected: Inline Box Picker & "+ New Box" Button */}
            {boxFishMode === 'mixed' && (
              <div className="w-full bg-amber-50/95 border border-amber-300/80 rounded-xl px-2 py-1 flex items-center justify-between gap-1 shadow-xs">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  <span className="text-[10px] font-black text-amber-900 shrink-0">Pack into:</span>
                  {allBoxesToList.map((bNum) => {
                    const bInfo = existingBoxes[bNum];
                    const isActive = activeBoxNumber === bNum;
                    return (
                      <button
                        key={bNum}
                        type="button"
                        onClick={() => setActiveBoxNumber(bNum)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black shrink-0 transition-all cursor-pointer flex items-center gap-0.5 ${
                          isActive
                            ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400'
                            : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <span>Box #{bNum}</span>
                        {bInfo && (
                          <span className={`text-[8.5px] px-1 rounded-full ${isActive ? 'bg-amber-800 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            {bInfo.itemsCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* + New Box button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = Math.max(...allBoxesToList, 0) + 1;
                    setActiveBoxNumber(nextNum);
                    if (showToast) showToast(`Started Box #${nextNum}`, 'info');
                  }}
                  className="px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-xs flex items-center gap-0.5 shrink-0 cursor-pointer"
                  title="Close this box and start next box"
                >
                  <Plus size={11} className="stroke-[3]" />
                  <span>New Box</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
