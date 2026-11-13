// Shared Helper Utilities for Local and Dam Stock-In Forms

/**
 * Split decimal kgPerBox into separate Kg and Grams fields for dual table inputs
 */
export const splitKgPerBoxParts = (row) => {
  if (!row) return { k: '', g: '' };
  if (row.kgPerBoxKg !== undefined && row.kgPerBoxGrams !== undefined) {
    return { k: String(row.kgPerBoxKg), g: String(row.kgPerBoxGrams) };
  }
  const raw = row.kgPerBox;
  if (raw === '' || raw === null || raw === undefined) return { k: '', g: '' };
  const num = Number(raw);
  if (isNaN(num)) return { k: '', g: '' };
  const whole = Math.floor(num);
  const remG = Math.round((num - whole) * 1000);
  return {
    k: String(whole + Math.floor(remG / 1000)),
    g: String(remG % 1000)
  };
};

/**
 * Update table row Kg/Box from separate Kg and Grams inputs and recalculate scale weight
 */
export const buildUpdatedRowsWithKpb = (rows, idx, nextKRaw, nextGRaw, parseDecimalK = false) => {
  const updated = [...rows];
  let kStr = nextKRaw;
  let gStr = nextGRaw;

  if (parseDecimalK && String(nextKRaw).includes('.')) {
    const parts = String(nextKRaw).split('.');
    kStr = parts[0] || '0';
    const fracStr = (parts[1] || '').padEnd(3, '0').slice(0, 3);
    gStr = String(parseInt(fracStr, 10) || 0);
  }

  const kNum = Math.max(0, parseFloat(kStr) || 0);
  const gNum = Math.max(0, Math.min(999, parseInt(gStr, 10) || 0));
  const combinedKpb = (kStr === '' && gStr === '') ? '' : Number((kNum + gNum / 1000).toFixed(3));

  updated[idx] = {
    ...updated[idx],
    kgPerBoxKg: kStr,
    kgPerBoxGrams: gStr,
    kgPerBox: combinedKpb
  };

  const bCount = Number(updated[idx].boxes || 0);
  if (bCount > 0 && typeof combinedKpb === 'number' && combinedKpb > 0) {
    const totalWeight = bCount * combinedKpb;
    const wholeKg = Math.floor(totalWeight);
    const remainderGrams = Math.round((totalWeight - wholeKg) * 1000);
    updated[idx].kg = String(wholeKg + Math.floor(remainderGrams / 1000));
    updated[idx].grams = String(remainderGrams % 1000);
  }
  return updated;
};

/**
 * Extract Small / Medium / Big Size Grades & Backend Weight Ranges for any fish
 */
export const getFishGradeOptions = (fish) => {
  if (!fish) return [];
  const grades = fish.sizeGrades;
  if (!grades) {
    return [
      { key: 'small', label: 'Small', range: '0 - 1 Kg', rate: fish.purchasePrice || '' },
      { key: 'medium', label: 'Medium', range: '1 - 4 Kg', rate: fish.purchasePrice || '' },
      { key: 'big', label: 'Big', range: '4+ Kg', rate: fish.purchasePrice || '' }
    ];
  }

  const isSmallOn = grades.small?.enabled !== false;
  const isMediumOn = grades.medium?.enabled !== false;
  const isBigOn = grades.big?.enabled !== false;

  const smallMax = parseFloat(grades.small?.maxKg) || 1;
  const mediumMax = parseFloat(grades.medium?.maxKg) || 4;

  const list = [];
  if (isSmallOn) {
    list.push({
      key: 'small',
      label: 'Small',
      range: `0 - ${smallMax} Kg`,
      rate: grades.small?.purchasePrice || grades.small?.wholesalePrice || grades.small?.price || fish.purchasePrice || ''
    });
  }
  if (isMediumOn) {
    list.push({
      key: 'medium',
      label: 'Medium',
      range: `${smallMax} - ${mediumMax} Kg`,
      rate: grades.medium?.purchasePrice || grades.medium?.wholesalePrice || grades.medium?.price || fish.purchasePrice || ''
    });
  }
  if (isBigOn) {
    list.push({
      key: 'big',
      label: 'Big',
      range: `${mediumMax}+ Kg`,
      rate: grades.big?.purchasePrice || grades.big?.wholesalePrice || grades.big?.price || fish.purchasePrice || ''
    });
  }
  return list.length > 0 ? list : [
    { key: 'medium', label: 'Medium', range: 'Standard Grade', rate: fish.purchasePrice || '' }
  ];
};

/**
 * Calculate net scale weight in decimal Kg for a stock-in row
 */
export const calcItemWeightKg = (row) => {
  if (!row) return 0;
  const rKg = Number(row.kg || 0);
  const rGm = Number(row.grams || 0);
  const b = Number(row.boxes || 0);
  const kpb = Number(row.kgPerBox || 1);
  if (rKg > 0 || rGm > 0) {
    return Number((rKg + rGm / 1000).toFixed(3));
  }
  if (b > 0 && kpb > 0) {
    return Number((b * kpb).toFixed(3));
  }
  return 0;
};

/**
 * Format ISO datetime-local string to readable label
 */
export const formatDateGroupLabel = (isoStr) => {
  if (!isoStr) {
    const now = new Date();
    return {
      dateFormatted: now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeFormatted: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      dayName: now.toLocaleDateString('en-IN', { weekday: 'short' }),
      fullLabel: now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    };
  }
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) throw new Error();
    return {
      dateFormatted: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeFormatted: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      dayName: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      fullLabel: `${d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
    };
  } catch (_) {
    return {
      dateFormatted: isoStr,
      timeFormatted: '',
      dayName: '',
      fullLabel: isoStr
    };
  }
};

/**
 * Increment ISO date string by 1 calendar day while preserving exact same time (AM/PM)
 */
export const incrementIsoDay = (isoStr) => {
  const base = isoStr ? new Date(isoStr) : new Date();
  if (isNaN(base.getTime())) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  }
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  const h = String(next.getHours()).padStart(2, '0');
  const min = String(next.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
};

/**
 * Group stock-in items array by dateKey and compute subtotal weights & values
 */
export const groupStockInItemsByDate = (items = []) => {
  const groupsMap = new Map();
  const order = [];

  items.forEach((item, originalIdx) => {
    const rawDate = item.date || new Date().toISOString().slice(0, 16);
    const groupKey = rawDate;

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        dateKey: groupKey,
        label: formatDateGroupLabel(groupKey),
        items: []
      });
      order.push(groupKey);
    }
    groupsMap.get(groupKey).items.push({ item, originalIdx });
  });

  return order.map(k => {
    const g = groupsMap.get(k);
    let subtotalKg = 0;
    let subtotalBoxes = 0;
    let subtotalValue = 0;

    g.items.forEach(({ item }) => {
      const w = calcItemWeightKg(item);
      const rate = Number(item.ratePerKg || item.price || 0);
      subtotalKg += w;
      subtotalBoxes += Number(item.boxes || 0);
      subtotalValue += Number((w * rate).toFixed(2));
    });

    const subtotalKgInt = Math.floor(subtotalKg);
    const subtotalGmInt = Math.round((subtotalKg - subtotalKgInt) * 1000);

    return {
      dateKey: g.dateKey,
      label: g.label,
      items: g.items,
      subtotalKg: Number(subtotalKg.toFixed(3)),
      subtotalKgInt,
      subtotalGmInt,
      subtotalBoxes,
      subtotalValue: Number(subtotalValue.toFixed(2))
    };
  });
};

