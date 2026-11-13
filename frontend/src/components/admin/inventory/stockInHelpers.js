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

