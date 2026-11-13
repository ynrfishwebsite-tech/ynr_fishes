// Helper for formatting bill items with exact Weight (Kg), Rate/Kg, and Amount
export const resolveItemQtyAndRate = (item) => {
  if (!item) {
    return {
      qtyDisplay: '1',
      qtyNum: 1,
      rateDisplay: '0.00',
      rateNum: 0,
      amountDisplay: '0.00',
      amountNum: 0,
      isKg: false
    };
  }

  const isKg = !item.sellingUnit || item.sellingUnit.toLowerCase() === 'kg';
  const activeQty = Math.max(0, (Number(item.quantity) || 1) - (Number(item.cancelledQuantity) || 0));

  // Determine unit rate (price per Kg or price per piece)
  let unitRate = Number(item.pricePerKg || item.price || 0);

  // Determine line total amount matching bill subtotal: price * activeQty
  let totalAmt = 0;
  if (Number(item.price || 0) > 0 && activeQty > 0) {
    totalAmt = Number(item.price) * activeQty;
  } else if (item.total !== undefined && item.total !== null && Number(item.total) > 0) {
    totalAmt = Number(item.total);
  }

  if (isKg) {
    let wt = 0;
    const storedWt = Number(item.netWeightKg || item.enteredWeight || item.weightKg || 0);

    if (storedWt > 0) {
      // If storedWt was per-unit (e.g. 1 Kg) and activeQty was increased to 2, line weight is 2 Kg!
      if (activeQty > 1 && storedWt <= 1) {
        wt = storedWt * activeQty;
      } else if (storedWt === activeQty) {
        wt = activeQty;
      } else if (unitRate > 0 && totalAmt > 0 && Math.abs((totalAmt / unitRate) - activeQty) < 0.05) {
        wt = activeQty;
      } else {
        wt = storedWt;
      }
    } else if (activeQty > 0) {
      wt = activeQty;
    } else if (unitRate > 0 && totalAmt > 0) {
      wt = totalAmt / unitRate;
    }

    // Fallback: extract weight from item name like "(Whole - 1 Kg)" or "(1 Kg)"
    if (wt <= 0) {
      const m = (item.name || '').match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (m) {
        const parsedNameWt = parseFloat(m[1]);
        wt = parsedNameWt * (activeQty > 1 && parsedNameWt <= 1 ? activeQty : 1);
      }
    }

    const finalWt = wt > 0 ? wt : (activeQty > 0 ? activeQty : 1);
    if (unitRate <= 0 && totalAmt > 0 && finalWt > 0) {
      unitRate = totalAmt / finalWt;
    }

    const cleanWt = finalWt % 1 === 0 ? finalWt.toFixed(0) : (finalWt.toFixed(2).replace(/\.?0+$/, ''));
    return {
      qtyDisplay: `${cleanWt} Kg`,
      qtyNum: finalWt,
      rateDisplay: unitRate.toFixed(2),
      rateNum: unitRate,
      amountDisplay: totalAmt.toFixed(2),
      amountNum: totalAmt,
      isKg: true
    };
  }

  // Non-kg or piece item
  if (unitRate <= 0 && totalAmt > 0 && activeQty > 0) {
    unitRate = totalAmt / activeQty;
  }
  return {
    qtyDisplay: String(activeQty),
    qtyNum: activeQty,
    rateDisplay: unitRate.toFixed(2),
    rateNum: unitRate,
    amountDisplay: totalAmt.toFixed(2),
    amountNum: totalAmt,
    isKg: false
  };
};

/**
 * Format receipt item name with dynamic language support (Telugu, English, Both)
 * and extract Grade to be placed neatly at the bottom section.
 */
export const formatReceiptItemName = (rawName = '', languagePreference = 'both') => {
  if (!rawName) return { itemTitle: 'Item', subDetail: '', engName: 'Item', telugu: '', grade: '', cut: '' };

  let cut = '';
  // Check for cut pattern
  const parenCut = rawName.match(/\((Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\s*-\s*[^)]+\)/i)
    || rawName.match(/\b(Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\b/i);
  if (parenCut) {
    const cLower = parenCut[1].toLowerCase();
    if (cLower.includes('curry')) cut = 'Curry Cut';
    else if (cLower.includes('fry')) cut = 'Fry Cut';
    else if (cLower.includes('bone')) cut = 'Boneless';
    else if (cLower.includes('clean')) cut = 'Cleaned';
    else if (cLower.includes('whole')) cut = 'Whole';
  }

  // Extract Telugu script (Unicode range \u0C00-\u0C7F)
  let telugu = '';
  const teluguMatch = rawName.match(/[\(\[]?([\u0C00-\u0C7F\s]+)[\)\]]?/);
  if (teluguMatch && teluguMatch[1].trim()) {
    telugu = teluguMatch[1].trim();
  }

  // Extract Grade e.g. (SMALL), (MEDIUM), (LARGE), (XL)
  let grade = '';
  const gradeMatch = rawName.match(/\((SMALL|MEDIUM|LARGE|BIG|EXTRA LARGE|XL|S|M|L)\)/i);
  if (gradeMatch) {
    const g = gradeMatch[1].toUpperCase();
    grade = g === 'MEDIUM' ? 'Medium' : g === 'SMALL' ? 'Small' : g === 'LARGE' ? 'Large' : g;
  }

  // Extract clean English name
  let engName = rawName
    .replace(/\s*\([\u0C00-\u0C7F\s]+\)/g, '')
    .replace(/[\u0C00-\u0C7F]+/g, '')
    .replace(/\s*\((?:Whole|Cleaned|Curry Cut|Fry Cut|Boneless|Curry|Fry)\s*-\s*[^)]+\)/i, '')
    .replace(/\s*\((?:SMALL|MEDIUM|LARGE|BIG|EXTRA LARGE|XL|S|M|L)\)/i, '')
    .trim();

  if (engName.includes('/')) {
    engName = engName.split('/')[0].trim();
  }
  engName = engName.replace(/\s+/g, ' ').trim() || 'Item';

  // Dynamic language routing:
  let itemTitle = engName;
  const pref = (languagePreference || 'both').toLowerCase();
  if (pref === 'telugu') {
    // If Telugu name is available, reflect only in Telugu; otherwise fallback to English
    itemTitle = telugu || engName;
  } else if (pref === 'english') {
    // Reflect only in English
    itemTitle = engName;
  } else {
    // 'both' (default)
    itemTitle = telugu ? `${engName} (${telugu})` : engName;
  }

  // SubDetail: Grade at bottom + Cut if custom
  let subDetail = '';
  if (grade) subDetail = `Grade: ${grade}`;
  if (cut && cut.toLowerCase() !== 'whole') {
    subDetail = subDetail ? `${subDetail} • Cut: ${cut}` : `Cut: ${cut}`;
  }

  return {
    itemTitle,
    subDetail,
    engName,
    telugu,
    grade,
    cut
  };
};


