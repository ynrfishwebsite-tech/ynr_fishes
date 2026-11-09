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
  let wt = Number(item.weightKg || item.enteredWeight || item.netWeightKg || 0);

  // If sellingUnit is Kg and quantity was entered as the weight in kg
  if (wt <= 0 && isKg && Number(item.quantity || 0) > 0) {
    wt = Number(item.quantity);
  }

  // Fallback: extract weight from item name like "(Whole - 3 Kg)" or "(3 Kg)"
  if (wt <= 0) {
    const m = (item.name || '').match(/(\d+(?:\.\d+)?)\s*kg/i);
    if (m) wt = parseFloat(m[1]);
  }

  const activeQty = Math.max(0, (Number(item.quantity) || 1) - (Number(item.cancelledQuantity) || 0));

  // Determine total line amount
  let totalAmt = 0;
  if (item.total !== undefined && item.total !== null && Number(item.total) > 0) {
    totalAmt = Number(item.total);
  } else if (item.price && wt > 0 && isKg && item.pricePerKg && Number(item.price) === Number(item.pricePerKg)) {
    totalAmt = wt * Number(item.pricePerKg);
  } else if (item.price) {
    totalAmt = Number(item.price) * (activeQty > 0 ? activeQty : 1);
  }

  if (isKg && wt > 0) {
    let unitRate = Number(item.pricePerKg || 0);
    if (unitRate <= 0 && totalAmt > 0 && wt > 0) {
      unitRate = totalAmt / wt;
    } else if (unitRate <= 0 && Number(item.price || 0) > 0) {
      unitRate = Number(item.price);
    }

    const cleanWt = wt % 1 === 0 ? wt.toFixed(0) : (wt.toFixed(2).replace(/\.?0+$/, ''));
    return {
      qtyDisplay: `${cleanWt} Kg`,
      qtyNum: wt,
      rateDisplay: unitRate.toFixed(2),
      rateNum: unitRate,
      amountDisplay: totalAmt.toFixed(2),
      amountNum: totalAmt,
      isKg: true
    };
  }

  // Non-kg or piece item
  let unitRate = Number(item.price || 0);
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

