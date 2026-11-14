import mongoose from 'mongoose';
import BillDefault from '../../models/billing/Bill.js';
import UserDefault from '../../models/auth/User.js';
import SettingDefault from '../../models/system/Setting.js';
import cache from '../../utils/helpers/cache.js';
import { deductStockForBillItems, restoreStockForBillItems } from "../inventory/inventoryController.js";
const updateTableStatusHelper = async () => true;
import { getTenantModel, handleTenantError } from '../../utils/database/tenantHelper.js';
import { updateCustomerFromBill, syncCustomer } from "../crm/customerController.js";
import { emitNotification, emitDismissNotification } from '../../utils/communication/notificationHelper.js';
import { emitSocketEvent } from '../../utils/communication/socket.js';
import { printKOTToPrinters } from '../../services/printerService.js';
import { getTableMatchCondition, getDynamicTaxRate, getTenantShopName } from '../../utils/helpers/billHelpers.js';
import { getISTDayRange } from '../../utils/helpers/timezoneHelper.js';
const syncOrderKotsWithItems = () => {};
import CreditAccountDefault from '../../models/finance/CreditAccount.js';
import CustomerDefault from '../../models/crm/Customer.js';

import { asyncHandler } from '../../utils/helpers/asyncHandler.js';
import { AppError } from '../../utils/helpers/AppError.js';

// ⚡ Module-level snapshot cache: stores the fully-constructed restaurant details object
// per tenant for 5 minutes. Eliminates repeated DB queries AND repeated object construction
// on every save / KOT / generateBill / settle call.
const SNAPSHOT_FULL_CACHE = new Map(); // tenantDb → { snapshot, expiry }
const SNAPSHOT_FULL_TTL = 5 * 60 * 1000; // 5 minutes

// Call this whenever restaurant settings are updated so stale snapshots are evicted immediately.
export const invalidateSnapshotCache = (tenantDb) => {
  if (tenantDb) {
    SNAPSHOT_FULL_CACHE.delete(tenantDb);
  } else {
    SNAPSHOT_FULL_CACHE.clear();
  }
};

const toValidObjectId = (val) => {
  if (!val) return undefined;
  const s = String(val).trim();
  if (mongoose.Types.ObjectId.isValid(s) && s.length === 24 && /^[0-9a-fA-F]{24}$/.test(s)) {
    return s;
  }
  return undefined;
};

// Helper to calculate wholesale boxes summary from bill items
export function computeBoxesSummary(items) {
  const boxMap = new Map();
  (items || []).forEach(item => {
    if (item.isWholesaleBox || item.boxNumber) {
      const bNum = Number(item.boxNumber || 1);
      const bLabel = item.boxLabel || `Box #${bNum}`;
      if (!boxMap.has(bNum)) {
        boxMap.set(bNum, {
          boxNumber: bNum,
          boxLabel: bLabel,
          totalWeightKg: 0,
          totalPrice: 0,
          itemCount: 0,
          items: []
        });
      }
      const b = boxMap.get(bNum);
      const wt = Number(item.weightKg || item.netWeightKg || item.enteredWeight || 0);
      const pr = Number(item.total !== undefined ? item.total : (Number(item.price || 0) * (item.quantity || 1)));
      b.totalWeightKg = Number((b.totalWeightKg + wt).toFixed(3));
      b.totalPrice = Number((b.totalPrice + pr).toFixed(2));
      b.itemCount += 1;
      b.items.push({
        name: item.name,
        weightKg: wt,
        pricePerKg: Number(item.pricePerKg || item.price || 0),
        total: pr
      });
    }
  });
  const boxes = Array.from(boxMap.values()).sort((a, b) => a.boxNumber - b.boxNumber);
  return { boxes, totalBoxes: boxes.length };
}

export const getBillPrefixForCategory = (categoryOrOrder) => {
  if (!categoryOrOrder) return 'RET-';
  if (typeof categoryOrOrder === 'object') {
    const o = categoryOrOrder;
    if (
      String(o.customerCategory || '').toLowerCase().includes('export') ||
      String(o.orderChannel || '').toLowerCase().includes('export') ||
      String(o.billType || '').toLowerCase().includes('export')
    ) {
      return 'EXP-';
    }
    if (
      Number(o.totalBoxes || 0) > 0 ||
      (Array.isArray(o.boxes) && o.boxes.length > 0) ||
      (Array.isArray(o.items) && o.items.some(i => i.isWholesaleBox || Number(i.boxNumber || 0) > 0)) ||
      String(o.customerCategory || '').toLowerCase().includes('wholesale') ||
      String(o.orderChannel || '').toLowerCase().includes('wholesale') ||
      String(o.billType || '').toLowerCase().includes('wholesale')
    ) {
      return 'WS-';
    }
    return 'RET-';
  }
  const str = String(categoryOrOrder).toLowerCase();
  if (str.includes('export')) return 'EXP-';
  if (str.includes('whole')) return 'WS-';
  return 'RET-';
};

export const generateUniqueBillNumber = async (BillModel, categoryOrOrder = 'Retail') => {
  const prefix = getBillPrefixForCategory(categoryOrOrder);
  const regex = new RegExp(`^${prefix}\\d+$`, 'i');

  try {
    const agg = BillModel.aggregate([
      { $match: { billNumber: regex } },
      { 
        $project: { 
          billNumber: 1,
          strLen: { $strLenCP: "$billNumber" }
        } 
      },
      // Sort by length first (MS1000 > MS999 / RET-10000 > RET-9999), then lexically for ties
      { $sort: { strLen: -1, billNumber: -1 } },
      { $limit: 1 }
    ]);

    let result;
    if (typeof agg.allowDiskUse === 'function') {
      result = await agg.allowDiskUse(true);
    } else if (typeof agg.toArray === 'function') {
      result = await agg.toArray();
    } else {
      result = await agg;
    }

    let maxNum = 0n; // Use BigInt to support infinite digits (e.g., 20+ digits)
    if (result && result.length > 0 && result[0].billNumber) {
      const digits = String(result[0].billNumber).replace(/\D/g, '');
      if (digits) {
        maxNum = BigInt(digits);
      }
    }
    
    const nextNum = maxNum + 1n;
    const numStr = nextNum.toString();
    const formattedDigits = numStr.length < 4 ? numStr.padStart(4, '0') : numStr;
    return `${prefix}${formattedDigits}`;
  } catch (err) {
    console.error('Error in generateUniqueBillNumber aggregation:', err);
    try {
      // Fallback: fetch all matching bills and find max in memory using BigInt
      const candidateBills = await BillModel.find(
        { billNumber: regex },
        { billNumber: 1 }
      ).lean();
      
      let maxNum = 0n;
      for (const b of candidateBills) {
        if (b && b.billNumber) {
          const digits = String(b.billNumber).replace(/\D/g, '');
          if (digits) {
            const num = BigInt(digits);
            if (num > maxNum) {
              maxNum = num;
            }
          }
        }
      }
      const nextNum = maxNum + 1n;
      const numStr = nextNum.toString();
      const formattedDigits = numStr.length < 4 ? numStr.padStart(4, '0') : numStr;
      return `${prefix}${formattedDigits}`;
    } catch (fallbackErr) {
      console.error('Fallback generation failed:', fallbackErr);
      return `${prefix}${Date.now().toString().slice(-4)}`;
    }
  }
};

/**
 * Generates an isolated sequential daily order number for a specific category in IST.
 * Formats: RET-001, WS-001, EXP-001, DEL-001. Resets each calendar day in IST.
 */
export const generateDailyOrderNumber = async (BillModel, categoryOrOrder = 'Retail') => {
  let prefix = 'RET-';
  const catStr = typeof categoryOrOrder === 'object'
    ? String(categoryOrOrder.customerCategory || categoryOrOrder.orderMode || categoryOrOrder.billType || categoryOrOrder.orderChannel || '').toLowerCase()
    : String(categoryOrOrder || '').toLowerCase();

  if (catStr.includes('export')) {
    prefix = 'EXP-';
  } else if (catStr.includes('whole') || catStr.includes('bulk')) {
    prefix = 'WS-';
  } else if (catStr.includes('deliv')) {
    prefix = 'DEL-';
  } else {
    prefix = 'RET-';
  }

  const { startDate, endDate } = getISTDayRange();
  const prefixRegex = new RegExp(`^${prefix}(\\d+)`, 'i');

  try {
    const todayBills = await BillModel.find({
      $or: [
        { createdAt: { $gte: startDate, $lte: endDate } },
        { billedAt: { $gte: startDate, $lte: endDate } },
        { clearedAt: { $gte: startDate, $lte: endDate } },
        { status: { $in: ['Open', 'Billed'] } }
      ],
      tableNo: prefixRegex
    }).select('tableNo createdAt').lean();

    let maxNum = 0;
    for (const b of todayBills) {
      if (b && b.tableNo) {
        const match = String(b.tableNo).trim().match(prefixRegex);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum && num < 100000) {
            maxNum = num;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  } catch (err) {
    console.error('[generateDailyOrderNumber] Error:', err);
    return `${prefix}001`;
  }
};

export const getNextDailyOrderNo = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const category = req.query.category || req.query.mode || 'Retail';
    const orderNo = await generateDailyOrderNumber(Bill, category);
    res.json({ success: true, orderNo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getRestaurantSnapshot = async (req, clientDetails) => {
  try {
    const tenantDb = req?.tenantDb || req?.headers?.['x-tenant-db'] || req?.headers?.['X-Tenant-DB'] || req?.user?.db || 'default';

    // ⚡ FAST PATH: If the caller did NOT pass overriding clientDetails, return cached full snapshot
    // clientDetails overrides (from the request body) must bypass the cache because they carry
    // per-bill customisations (logo, UPI, etc.) that differ from stored settings.
    const hasClientOverrides = clientDetails && typeof clientDetails === 'object' && Object.keys(clientDetails).length > 0;
    if (!hasClientOverrides) {
      const cached = SNAPSHOT_FULL_CACHE.get(tenantDb);
      if (cached && Date.now() < cached.expiry) {
        return cached.snapshot; // ← 0ms memory lookup, skips ALL DB access
      }
    }

    // CACHE MISS: Fetch raw settings from DB (uses existing 30s cache.get layer first)
    let settings = null;
    const cacheKey = cache.getCacheKey('restaurantSettings', tenantDb);
    settings = cache.get(cacheKey);

    if (!settings) {
      const Setting = getTenantModel(req, 'Setting', SettingDefault);
      if (Setting) {
        const doc = await Setting.findOne({ key: 'restaurantSettings' }).maxTimeMS(300).lean().catch(() => null);
        if (doc && doc.value) {
          settings = typeof doc.value === 'string' ? JSON.parse(doc.value) : doc.value;
          cache.set(cacheKey, settings, 5 * 60 * 1000); // Cache raw settings for 5 minutes
        }
      }
    }

    const c = (clientDetails && typeof clientDetails === 'object') ? clientDetails : {};
    const s = (settings && typeof settings === 'object') ? settings : {};

    const name = (c.restaurantName || s.restaurantName || '').trim();
    const type = (c.restaurantType || s.restaurantType || '').trim();
    const addr = (c.address !== undefined ? c.address : (s.address || '')).trim();
    const ph = (c.phone !== undefined ? c.phone : (s.phone || '')).trim();
    const em = (c.email !== undefined ? c.email : (s.email || '')).trim();
    const gst = (c.gstin !== undefined ? c.gstin : (s.gstin || '')).trim();
    const fss = (c.fssai !== undefined ? c.fssai : (s.fssai || '')).trim();
    const rawLogo = c.logo !== undefined ? c.logo : (s.logo || '');
    const logo = rawLogo === '[logo_stored]' ? '' : rawLogo;
    const upi = (c.upiId !== undefined ? c.upiId : (s.upiId || '')).trim();
    const enableQr = c.enableQrPayment !== undefined ? c.enableQrPayment : (s.enableQrPayment !== undefined ? s.enableQrPayment : true);
    const footer = (c.footerMessage !== undefined ? c.footerMessage : (s.footerMessage || '')).trim();
    const tag = (c.tagline !== undefined ? c.tagline : (s.tagline || '')).trim();
    const printFmt = c.printFormat || s.printFormat || '80mm';
    const taxSet = {
      enableCgst: c.enableCgst !== undefined ? c.enableCgst : (s.enableCgst !== undefined ? s.enableCgst : true),
      enableSgst: c.enableSgst !== undefined ? c.enableSgst : (s.enableSgst !== undefined ? s.enableSgst : true),
      enableGst: c.enableGst !== undefined ? c.enableGst : (s.enableGst !== undefined ? s.enableGst : false),
      cgstRate: c.cgstRate !== undefined ? Number(c.cgstRate) : (s.cgstRate !== undefined ? Number(s.cgstRate) : 2.5),
      sgstRate: c.sgstRate !== undefined ? Number(c.sgstRate) : (s.sgstRate !== undefined ? Number(s.sgstRate) : 2.5),
      gstRate: c.gstRate !== undefined ? Number(c.gstRate) : (s.gstRate !== undefined ? Number(s.gstRate) : 5)
    };

    const snapshot = {
      restaurantName: name,
      restaurantType: type,
      address: addr,
      phone: ph,
      email: em,
      gstin: gst,
      fssai: fss,
      logo: (logo && logo.length > 500) ? '[logo_stored]' : logo,
      upiId: upi,
      enableQrPayment: enableQr,
      footerMessage: footer,
      tagline: tag,
      printFormat: printFmt,
      taxSettings: taxSet
    };

    // Store the fully-constructed snapshot in the module-level cache (5 min TTL)
    // Only cache when there are no per-request client overrides (those are bill-specific)
    if (!hasClientOverrides) {
      SNAPSHOT_FULL_CACHE.set(tenantDb, { snapshot, expiry: Date.now() + SNAPSHOT_FULL_TTL });
    }

    return snapshot;
  } catch (err) {
    console.error('[getRestaurantSnapshot] Error capturing snapshot:', err);
    return clientDetails || {};
  }
};

export const getActiveOrder = asyncHandler(async (req, res, next) => {
  const Bill = getTenantModel(req, 'Bill', BillDefault);
  const { tableNo } = req.params;
  let order = await Bill.findOne({
    tableNo: getTableMatchCondition(tableNo),
    status: { $in: ['Open', 'Billed'] }
  }).sort({ updatedAt: -1, createdAt: -1 }).lean();

  if (order) {
    const hasValidItems = order.items && order.items.length > 0 && order.items.some(i => (Number(i.quantity || 0) > 0 || (i.printedQuantity || 0) > 0));
    if (!hasValidItems) {
      return res.json(null);
    }

    if (order.kots && Array.isArray(order.kots)) {
      const kotStatusMap = {};
      order.kots.forEach(kot => {
        (kot.items || []).forEach(kItem => {
          if (kItem.name) {
            kotStatusMap[kItem.name] = kItem.status;
            if (kItem._id) kotStatusMap[kItem._id.toString()] = kItem.status;
          }
        });
      });

      if (order.items && Array.isArray(order.items)) {
        order.items = order.items.map(item => {
          const matchedStatus = kotStatusMap[item._id?.toString()] || kotStatusMap[item.name] || item.status;
          return {
            ...item,
            status: matchedStatus || item.status || 'Pending'
          };
        });
      }
    }

    if (order.status === 'Open') {
      const dynamicTaxRate = await getDynamicTaxRate(req);
      const subtotal = order.subtotal || (order.items || []).reduce((acc, i) => acc + (i.isCancelled ? 0 : (i.price * (i.quantity - (i.cancelledQuantity || 0)))), 0);
      const dVal = order.discountValue || 0;
      let calculatedDiscount = 0;
      if (order.discountType === 'percentage') {
        if (order.applicableTo === 'category' && order.targetCategory) {
          const targetCat = String(order.targetCategory).trim().toLowerCase();
          const eligibleSubtotal = (order.items || []).reduce((acc, i) => {
            if (i.isCancelled) return acc;
            const itemCat = typeof i.category === 'object' && i.category !== null ? i.category.name : i.category;
            if (itemCat && String(itemCat).trim().toLowerCase() === targetCat) {
              const activeQty = Math.max(0, Number(i.quantity || 0) - (i.cancelledQuantity || 0));
              return acc + (Number(i.price || 0) * activeQty);
            }
            return acc;
          }, 0);
          calculatedDiscount = (eligibleSubtotal * dVal) / 100;
        } else {
          calculatedDiscount = (subtotal * dVal) / 100;
        }
      } else if (order.discountType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dVal;
      }
      const taxable = Math.max(0, subtotal - calculatedDiscount);
      const taxRate = dynamicTaxRate;
      const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
      const dCharge = Number(order.deliveryCharge) || 0;
      const cCharge = Number(order.containerCharge) || 0;
      const cutCharge = Number(order.cuttingCharge) || 0;
      const iceCharge = Number(order.iceCharges) || 0;
      const boxCharge = Number(order.boxCharges) || 0;
      const transCharge = Number(order.transportCharges) || 0;
      const netAddCharges = (Array.isArray(order.additionalCharges) ? order.additionalCharges : []).reduce((sum, c) => {
        const amt = Number(c?.amount || 0);
        return c?.type === 'Dr' ? sum - amt : sum + amt;
      }, 0);
      order.tax = taxRate;
      const boxSummary = computeBoxesSummary(order.items);
      order.boxes = boxSummary.boxes;
      order.totalBoxes = boxSummary.totalBoxes;
      order.markModified('boxes');

      order.subtotal = subtotal;
      order.discount = calculatedDiscount;
      order.deliveryCharge = dCharge;
      order.containerCharge = cCharge;
      order.cuttingCharge = cutCharge;
      order.total = Math.round(taxable + taxAmount + dCharge + cCharge + cutCharge + iceCharge + boxCharge + transCharge + netAddCharges);
    }
  }

  res.json(order || null);
});

// Helper to keep KOTs and order.items unit statuses / quantities in 100% sync


export const saveOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const {
      tableNo,
      items,
      customerName,
      customerPhone,
      customerCategory,
      exportSubCategory,
      customerPhoto,
      customerAddress,
      isOrderLocked,
      orderLockedAt,
      orderDateFormatted,
      orderTimeFormatted,
      kitchenNotes,
      billType,
      orderSource,
      id,
      discount,
      discountType,
      discountValue,
      discountName,
      applicableTo,
      targetCategory,
      tax,
      deliveryCharge,
      containerCharge,
      cuttingCharge,
      restaurantDetails,
      showLogo
    } = req.body;

    // Safely resolve customer address to string even if an object is sent
    const resolvedCustomerAddress = typeof customerAddress === 'object' && customerAddress !== null
      ? (customerAddress.fullAddress || [customerAddress.line1, customerAddress.area, customerAddress.city, customerAddress.district, customerAddress.state, customerAddress.pincode].filter(Boolean).join(', ') || '')
      : (typeof customerAddress === 'string' ? customerAddress : '');

    // Authoritatively resolve customer identity against MongoDB CRM Customer collection by phone number
    let resolvedCustomerName = customerName;
    let resolvedCustomerPhoto = customerPhoto;
    if (customerPhone) {
      const cleanP = String(customerPhone).trim().replace(/\D/g, '').slice(-10);
      if (cleanP) {
        try {
          const Customer = getTenantModel(req, 'Customer', CustomerDefault);
          const existingCust = await Customer.findOne({
            $or: [{ phone: customerPhone }, { phone: cleanP }]
          }).select('name photo businessName').lean();
          if (existingCust?.name && existingCust.name !== 'Guest' && existingCust.name.trim() !== '') {
            resolvedCustomerName = existingCust.name;
          }
          if (existingCust?.photo && !resolvedCustomerPhoto) {
            resolvedCustomerPhoto = existingCust.photo;
          }
        } catch (crmLookupErr) {}
      }
    }

    // Assign default daily counter order number in IST if no tableNo provided
    let effectiveTableNo = tableNo || req.body.orderNo;
    if (!effectiveTableNo || effectiveTableNo === 'NEW_ORDER' || effectiveTableNo === 'DEL-NEW' || effectiveTableNo === 'TAK-NEW') {
      effectiveTableNo = await generateDailyOrderNumber(Bill, req.body);
    }
    req.body.tableNo = effectiveTableNo;

    // ⚡⚡ OPTIMISTIC INSTANT NOTIFICATION — fires the moment Save is pressed, before any DB work.
    // Gives 0ms perceived latency on other screens. The confirmed notification follows after save completes.
    if (!req.body.skipNotification) {
      setImmediate(() => {
        const isUpdate = !!(id && !String(id).startsWith('offline_'));
        emitNotification(
          req,
          isUpdate ? 'Order Updated' : 'New Order Placed',
          isUpdate ? `Order for ${tableNo} was updated` : `New order placed for ${tableNo}`,
          isUpdate ? 'info' : 'success',
          ['Manager', 'Admin', 'Captain', 'Cashier'],
          { tableNo, type: isUpdate ? 'order_updated' : 'new_order', optimistic: true }
        );
      });
    }

    // Handle empty items array or removing all items from a table:
    if (!items || !Array.isArray(items) || items.length === 0) {
      let existingOrder = null;
      if (id) {
        existingOrder = await Bill.findById(id);
      } else if (tableNo) {
        existingOrder = await Bill.findOne({
          tableNo: getTableMatchCondition(tableNo),
          status: { $in: ['Open', 'Billed'] }
        });
      }

      if (existingOrder) {
        if (existingOrder.status === 'Paid') {
          return res.status(400).json({ message: 'Audit Security: Cannot modify an already paid and settled bill' });
        }
        const hasPrintedKots = existingOrder.kots && existingOrder.kots.length > 0;
        const hasPrintedItems = (existingOrder.items || []).some(i => (i.printedQuantity || 0) > 0);

        if (!hasPrintedKots && !hasPrintedItems) {
          // Unprinted draft order: Cancel/delete it and release table
          existingOrder.status = 'Cancelled';
          existingOrder.cancelReason = 'All unprinted items removed from table';
          existingOrder.items = [];
          existingOrder.subtotal = 0;
          existingOrder.total = 0;
          await existingOrder.save();

          cache.clear('dailyStats');
          cache.clear('openOrders');

          emitSocketEvent(req, 'orderUpdated', { tableNo: existingOrder.tableNo, status: 'Cancelled', orderId: existingOrder._id });

          if (existingOrder.billType === 'Dine-In') {
            updateTableStatusHelper(req, existingOrder.tableNo, 'Available', null).catch(() => { });
          }

          return res.status(200).json({
            _id: existingOrder._id,
            tableNo: existingOrder.tableNo,
            status: 'Cancelled',
            items: [],
            total: 0
          });
        }
      }

      return res.status(400).json({ message: 'Items array is required and must not be empty' });
    }

    // Sanitize items and calculate item totals - preserve all seafood weighing & catalog linkage
    const sanitizedItems = items
      .filter(item => (Number(item.quantity || 0) > 0 || (item.printedQuantity || 0) > 0 || item.isCancelled))
      .map(item => {
        const isCancelled = item.isCancelled || false;
        const cancelledQty = item.cancelledQuantity || 0;
        const activeQty = isCancelled ? 0 : Math.max(0, Number(item.quantity || 0) - cancelledQty);
        const validId = toValidObjectId(item._id);
        const resolvedMenuItem = toValidObjectId(item.menuItem?._id || item.menuItem || item.originalId || item.id) || validId;

        // Weight resolution: if grossWeightKg/enteredWeight/netWeightKg provided, use them; else parse or fallback
        const enteredWeight = Number(item.enteredWeight || item.grossWeightKg || item.netWeightKg || 0);
        const grossWeightKg = Number(item.grossWeightKg || item.enteredWeight || item.netWeightKg || 0);
        const netWeightKg = Number(item.netWeightKg || item.enteredWeight || item.grossWeightKg || 0);

        return {
          ...(validId && { _id: validId }),
          ...(resolvedMenuItem && { menuItem: resolvedMenuItem }),
          originalId: item.originalId || (resolvedMenuItem ? resolvedMenuItem.toString() : undefined),
          originalFishName: item.originalFishName || (item.name ? item.name.split('(')[0].trim() : undefined),
          name: item.name,
          category: item.category,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          sellingUnit: item.sellingUnit || 'Kg',
          enteredWeight,
          grossWeightKg,
          netWeightKg,
          cutType: item.cutType || 'Whole',
          yieldFactor: Number(item.yieldFactor || 1.0),
          tareWeightKg: Number(item.tareWeightKg || 0),
          boxCount: Number(item.boxCount || 0),
          boxNumber: Number(item.boxNumber || 0),
          boxLabel: item.boxLabel || (item.boxNumber ? `Box #${item.boxNumber}` : ''),
          isWholesaleBox: Boolean(item.isWholesaleBox || item.boxNumber),
          pricePerKg: Number(item.pricePerKg || item.price || 0),
          weightKg: Number(item.weightKg || netWeightKg || enteredWeight || 0),
          iceCharges: Number(item.iceCharges || 0),
          boxCharges: Number(item.boxCharges || 0),
          transportCharges: Number(item.transportCharges || 0),
          additionalCharges: Array.isArray(item.additionalCharges)
            ? item.additionalCharges
                .filter(c => Number(c?.amount) > 0)
                .map(c => ({
                  name: String(c.name || '').trim(),
                  amount: Number(c.amount) || 0,
                  type: c.type === 'Dr' ? 'Dr' : 'Cr'
                }))
            : [],
          total: Number(item.total !== undefined ? item.total : (Number(item.price || 0) * activeQty)),
          specialNote: item.specialNote !== undefined ? item.specialNote : undefined,
          status: item.status || 'Pending',
          isCancelled: isCancelled,
          cancelledQuantity: cancelledQty,
          cancellationRequested: item.cancellationRequested || false,
          cancellationRequestedQty: item.cancellationRequestedQty || 0,
          cancellationRejected: item.cancellationRejected || false
        };
      });

    if (sanitizedItems.length === 0) {
      let existingOrder = null;
      if (id) {
        existingOrder = await Bill.findById(id);
      } else if (tableNo) {
        existingOrder = await Bill.findOne({
          tableNo: getTableMatchCondition(tableNo),
          status: { $in: ['Open', 'Billed'] }
        });
      }

      if (existingOrder) {
        existingOrder.status = 'Cancelled';
        existingOrder.cancelReason = 'All unprinted items removed from table';
        existingOrder.items = [];
        existingOrder.subtotal = 0;
        existingOrder.total = 0;
        await existingOrder.save();

        cache.clear('dailyStats');
        cache.clear('openOrders');

        emitSocketEvent(req, 'orderUpdated', { tableNo: existingOrder.tableNo, status: 'Cancelled', orderId: existingOrder._id });

        if (existingOrder.billType === 'Dine-In') {
          updateTableStatusHelper(req, existingOrder.tableNo, 'Available', null).catch(() => { });
        }

        return res.status(200).json({
          _id: existingOrder._id,
          tableNo: existingOrder.tableNo,
          status: 'Cancelled',
          items: [],
          total: 0
        });
      }

      return res.status(400).json({ message: 'Items array is required and must not be empty' });
    }

    let order;
    if (id) {
      order = await Bill.findById(id);
    } else {
      order = await Bill.findOne({
        tableNo: getTableMatchCondition(tableNo),
        status: { $in: ['Open', 'Billed'] }
      });
    }

    if (order) {
      if (order.status === 'Paid') {
        return res.status(400).json({ message: 'Audit Security: Cannot modify an already paid and settled bill' });
      }

      if (!order.restaurantDetails || !order.restaurantDetails.restaurantName) {
        order.restaurantDetails = await getRestaurantSnapshot(req, restaurantDetails);
      }
      if (showLogo !== undefined) {
        order.showLogo = showLogo;
      }

      // Preserve printedQuantity and cancellation status for existing items
      const updatedItems = sanitizedItems.map(newItem => {
        const existingItem = order.items.find(i =>
          (newItem._id && i._id && String(i._id) === String(newItem._id)) ||
          (i.name && newItem.name && i.name.trim().toLowerCase() === newItem.name.trim().toLowerCase())
        );
        if (existingItem) {
          const isCancelled = existingItem.isCancelled || newItem.isCancelled || false;
          const cancelledQty = Math.max(existingItem.cancelledQuantity || 0, newItem.cancelledQuantity || 0);
          const activeQty = isCancelled ? 0 : Math.max(0, Number(newItem.quantity || 0) - cancelledQty);
          const resolvedNote = (newItem.specialNote !== undefined && newItem.specialNote !== null)
            ? newItem.specialNote
            : (existingItem.specialNote || '');

          const validResolvedId = toValidObjectId(existingItem._id) || toValidObjectId(newItem._id);

          return {
            ...(validResolvedId && { _id: validResolvedId }),
            ...newItem,
            printedQuantity: existingItem.printedQuantity !== undefined ? existingItem.printedQuantity : newItem.printedQuantity,
            specialNote: resolvedNote,
            lastPrintedNote: existingItem.lastPrintedNote || '',
            status: newItem.status || existingItem.status || 'Pending',
            isCancelled,
            cancelledQuantity: cancelledQty,
            total: Number(newItem.price || 0) * activeQty,
            cancellationRequested: newItem.cancellationRequested !== undefined ? newItem.cancellationRequested : (existingItem.cancellationRequested || false),
            cancellationRequestedQty: newItem.cancellationRequestedQty !== undefined ? newItem.cancellationRequestedQty : (existingItem.cancellationRequestedQty || 0),
            cancellationRejected: newItem.cancellationRejected !== undefined ? newItem.cancellationRejected : (existingItem.cancellationRejected || false)
          };
        }
        return newItem;
      });

      // Preserve items that were already printed or cancelled for KOT tracking
      order.items.forEach(oldItem => {
        if ((oldItem.printedQuantity || 0) > 0 || oldItem.isCancelled) {
          const stillExists = updatedItems.find(i =>
            (oldItem._id && i._id && String(i._id) === String(oldItem._id)) ||
            (i.name && oldItem.name && i.name.trim().toLowerCase() === oldItem.name.trim().toLowerCase())
          );
          if (!stillExists) {
            updatedItems.push({
              _id: oldItem._id,
              name: oldItem.name,
              price: oldItem.price,
              quantity: 0,
              total: 0,
              printedQuantity: oldItem.printedQuantity || 0,
              specialNote: oldItem.specialNote || '',
              lastPrintedNote: oldItem.lastPrintedNote || '',
              status: 'Cancelled',
              isCancelled: true,
              cancelledQuantity: oldItem.printedQuantity || oldItem.quantity || 0
            });
          }
        }
      });

      const subtotal = updatedItems.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
        return sum + (Number(item.price || 0) * activeQty);
      }, 0);

      const dType = discountType || order.discountType || 'flat';
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : (order.discountValue || 0);
      const dName = discountName !== undefined ? discountName : (order.discountName || '');
      const dApplicableTo = applicableTo || order.applicableTo || 'all';
      const dTargetCategory = targetCategory !== undefined ? targetCategory : (order.targetCategory || '');

      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        if (dApplicableTo === 'category' && dTargetCategory) {
          const targetCat = String(dTargetCategory).trim().toLowerCase();
          const eligibleSubtotal = updatedItems.reduce((sum, item) => {
            if (item.isCancelled) return sum;
            const itemCat = typeof item.category === 'object' && item.category !== null ? item.category.name : item.category;
            if (itemCat && String(itemCat).trim().toLowerCase() === targetCat) {
              const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
              return sum + (Number(item.price || 0) * activeQty);
            }
            return sum;
          }, 0);
          calculatedDiscount = (eligibleSubtotal * dValue) / 100;
        } else {
          calculatedDiscount = (subtotal * dValue) / 100;
        }
      } else if (dType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
      const tRate = (tax !== undefined && tax !== null && Number(tax) >= 0)
        ? Number(tax)
        : (order.status === 'Billed' && order.tax !== undefined && order.tax !== null ? Number(order.tax) : await getDynamicTaxRate(req));
      const calculatedTax = (taxableAmount * tRate) / 100;
      const dCharge = deliveryCharge !== undefined ? (Number(deliveryCharge) || 0) : (Number(order.deliveryCharge) || 0);
      const cCharge = containerCharge !== undefined ? (Number(containerCharge) || 0) : (Number(order.containerCharge) || 0);
      const cutCharge = cuttingCharge !== undefined ? (Number(cuttingCharge) || 0) : (Number(order.cuttingCharge) || 0);
      const iceCharge = req.body.iceCharges !== undefined ? (Number(req.body.iceCharges) || 0) : (Number(order.iceCharges) || 0);
      const boxCharge = req.body.boxCharges !== undefined ? (Number(req.body.boxCharges) || 0) : (Number(order.boxCharges) || 0);
      const transCharge = req.body.transportCharges !== undefined ? (Number(req.body.transportCharges) || 0) : (Number(order.transportCharges) || 0);
      const addChargesArr = req.body.additionalCharges !== undefined 
        ? (Array.isArray(req.body.additionalCharges) ? req.body.additionalCharges : [])
        : (Array.isArray(order.additionalCharges) ? order.additionalCharges : []);
      const netAddCharges = addChargesArr.reduce((sum, c) => {
        const amt = Number(c?.amount || 0);
        return c?.type === 'Dr' ? sum - amt : sum + amt;
      }, 0);
      const calculatedTotal = Math.round(taxableAmount + calculatedTax + dCharge + cCharge + cutCharge + iceCharge + boxCharge + transCharge + netAddCharges);

      // Check if actual items, quantities, or prices changed compared to the previous state
      const cleanOldItems = (order.items || [])
        .filter(i => !i.isCancelled && Number(i.quantity || 0) > 0)
        .map(i => ({ name: (i.name || '').trim(), quantity: Number(i.quantity || 0), price: Number(i.price || 0) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const cleanNewItems = (updatedItems || [])
        .filter(i => !i.isCancelled && Number(i.quantity || 0) > 0)
        .map(i => ({ name: (i.name || '').trim(), quantity: Number(i.quantity || 0), price: Number(i.price || 0) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const itemsActuallyChanged = JSON.stringify(cleanOldItems) !== JSON.stringify(cleanNewItems);
      const isAlreadyBilled = !!(order.billNumber || order.status === 'Billed' || order.status === 'Paid');
      const amountActuallyChanged = Math.abs((order.total || 0) - calculatedTotal) > 0.01 ||
        Math.abs((order.deliveryCharge || 0) - dCharge) > 0.01 ||
        Math.abs((order.containerCharge || 0) - cCharge) > 0.01 ||
        Math.abs((order.cuttingCharge || 0) - cutCharge) > 0.01 ||
        Math.abs((order.boxCharges || 0) - boxCharge) > 0.01 ||
        Math.abs((order.iceCharges || 0) - iceCharge) > 0.01 ||
        Math.abs((order.transportCharges || 0) - transCharge) > 0.01 ||
        Math.abs((order.discount || 0) - calculatedDiscount) > 0.01;

      // An order is recorded in editHistory if it was ALREADY BILLED (locked) AND items OR charges/discounts changed!
      if (isAlreadyBilled && (itemsActuallyChanged || amountActuallyChanged)) {
        const previousState = {
          items: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: order.subtotal || 0,
          totalDiscount: order.discount || 0,
          totalTax: ((Math.max(0, (order.subtotal || 0) - (order.discount || 0))) * (order.tax || 0)) / 100,
          deliveryCharge: order.deliveryCharge || 0,
          containerCharge: order.containerCharge || 0,
          cuttingCharge: order.cuttingCharge || 0,
          iceCharges: order.iceCharges || 0,
          boxCharges: order.boxCharges || 0,
          transportCharges: order.transportCharges || 0,
          additionalCharges: order.additionalCharges || [],
          total: order.total || 0,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        };

        const newState = {
          items: updatedItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: subtotal,
          totalDiscount: calculatedDiscount,
          totalTax: calculatedTax,
          deliveryCharge: dCharge,
          containerCharge: cCharge,
          cuttingCharge: cutCharge,
          iceCharges: iceCharge,
          boxCharges: boxCharge,
          transportCharges: transCharge,
          additionalCharges: addChargesArr,
          total: calculatedTotal,
          discountType: dType,
          discountValue: dValue
        };

        order.editHistory = order.editHistory || [];
        order.editHistory.push({
          editedAt: new Date(),
          previousState,
          newState
        });
        order.isEdited = true;
      }

      order.items = updatedItems;
      if (customerName !== undefined || resolvedCustomerName) order.customerName = resolvedCustomerName || customerName;
      if (customerPhone !== undefined) order.customerPhone = customerPhone;
      if (customerCategory) order.customerCategory = customerCategory;
      if (exportSubCategory !== undefined) order.exportSubCategory = exportSubCategory;
      if (customerPhoto !== undefined || resolvedCustomerPhoto) order.customerPhoto = resolvedCustomerPhoto || customerPhoto;
      if (customerAddress !== undefined) order.customerAddress = resolvedCustomerAddress;
      if (isOrderLocked !== undefined) order.isOrderLocked = isOrderLocked;
      if (orderLockedAt !== undefined) order.orderLockedAt = orderLockedAt;
      if (orderDateFormatted) order.orderDateFormatted = orderDateFormatted;
      if (orderTimeFormatted) order.orderTimeFormatted = orderTimeFormatted;

      if (order.customerPhone) {
        syncCustomer(req, order.customerPhone, order.customerName, billType || order.billType, customerCategory, exportSubCategory).catch(() => { });
      }
      order.kitchenNotes = kitchenNotes;
      order.billType = billType || order.billType;
      order.discountType = dType;
      order.discountValue = dValue;
      order.discountName = dName;
      order.applicableTo = dApplicableTo;
      order.targetCategory = dTargetCategory;
      order.discount = calculatedDiscount;
      order.deliveryCharge = dCharge;
      order.containerCharge = cCharge;

      if (!order.queueNumber) {
        try {
          const activeCount = await Bill.countDocuments({ 
            status: { $in: ['Open', 'Billed'] },
            'kots.0': { $exists: true }
          });
          const qNo = activeCount + 1;
          order.queueNumber = qNo;
          order.tokenNo = qNo;
        } catch (e) { }
      }

      // Update delivery fields if delivery order
      if (billType === 'Delivery') {
        order.orderSource = orderSource || 'Direct';
        order.deliveryStatus = 'Pending';
      } else {
        // Remove orderSource for Dine-In and Takeaway orders
        order.orderSource = undefined;
        order.deliveryStatus = undefined;
      }

      syncOrderKotsWithItems(order);

      if (req.body.iceCharges !== undefined) order.iceCharges = Number(req.body.iceCharges) || 0;
      if (req.body.boxCharges !== undefined) order.boxCharges = Number(req.body.boxCharges) || 0;
      if (req.body.transportCharges !== undefined) order.transportCharges = Number(req.body.transportCharges) || 0;
      if (req.body.additionalCharges !== undefined) {
        order.additionalCharges = Array.isArray(req.body.additionalCharges)
          ? req.body.additionalCharges.filter(c => Number(c?.amount) > 0)
          : [];
        order.markModified('additionalCharges');
      }
      if (req.body.netAdjustment !== undefined) order.netAdjustment = Number(req.body.netAdjustment) || 0;
      if (req.body.customSettlements !== undefined) {
        order.customSettlements = req.body.customSettlements;
        order.markModified('customSettlements');
      }
      if (req.body.partialPaymentHistory !== undefined) {
        order.partialPaymentHistory = req.body.partialPaymentHistory;
        order.markModified('partialPaymentHistory');
      }
      if (req.body.paidAmount !== undefined) order.paidAmount = Number(req.body.paidAmount) || 0;
      if (req.body.dueAmount !== undefined) order.dueAmount = Number(req.body.dueAmount) || 0;
      const boxSummary = computeBoxesSummary(updatedItems);
      order.boxes = boxSummary.boxes;
      order.totalBoxes = boxSummary.totalBoxes;
      order.markModified('boxes');

      order.subtotal = subtotal;
      order.tax = tRate;
      order.taxBreakdown = {
        cgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
        sgst: Number(((subtotal * (tRate / 2)) / 100).toFixed(2)),
        igst: 0
      };
      // Keep total accurate with taxable + tax + delivery + container + cutting + ice + box + transport + additional charges
      if (req.body.total !== undefined && Number(req.body.total) >= calculatedTotal && Number(req.body.total) > 0) {
        order.total = Number(req.body.total);
      } else {
        order.total = calculatedTotal;
      }
      if (order.status !== 'Billed' && order.status !== 'Paid') {
        order.status = 'Open';
      }
      order.markModified('items');
      order.markModified('kots');
      try {
        await order.save();
      } catch (saveErr) {
        if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
          console.warn('[saveOrder] VersionError caught, fetching fresh document from DB...');
          const freshOrder = await Bill.findById(order._id);
          if (freshOrder) {
            freshOrder.items = updatedItems;
            if (customerName !== undefined) freshOrder.customerName = customerName;
            if (customerPhone !== undefined) freshOrder.customerPhone = customerPhone;
            freshOrder.kitchenNotes = kitchenNotes;
            freshOrder.billType = billType || freshOrder.billType;
            freshOrder.discountType = dType;
            freshOrder.discountValue = dValue;
            freshOrder.discount = calculatedDiscount;
            freshOrder.subtotal = subtotal;
            freshOrder.tax = tRate;
            freshOrder.taxBreakdown = order.taxBreakdown;
            freshOrder.deliveryCharge = dCharge;
            freshOrder.containerCharge = cCharge;
            freshOrder.cuttingCharge = cutCharge;
            if (req.body.iceCharges !== undefined) freshOrder.iceCharges = Number(req.body.iceCharges) || 0;
            if (req.body.boxCharges !== undefined) freshOrder.boxCharges = Number(req.body.boxCharges) || 0;
            if (req.body.transportCharges !== undefined) freshOrder.transportCharges = Number(req.body.transportCharges) || 0;
            if (req.body.additionalCharges !== undefined) {
              freshOrder.additionalCharges = Array.isArray(req.body.additionalCharges)
                ? req.body.additionalCharges.filter(c => Number(c?.amount) > 0)
                : [];
              freshOrder.markModified('additionalCharges');
            }
            if (req.body.netAdjustment !== undefined) freshOrder.netAdjustment = Number(req.body.netAdjustment) || 0;
            if (req.body.customSettlements !== undefined) freshOrder.customSettlements = req.body.customSettlements;
            if (req.body.partialPaymentHistory !== undefined) freshOrder.partialPaymentHistory = req.body.partialPaymentHistory;
            if (req.body.paidAmount !== undefined) freshOrder.paidAmount = Number(req.body.paidAmount) || 0;
            if (req.body.dueAmount !== undefined) freshOrder.dueAmount = Number(req.body.dueAmount) || 0;
            freshOrder.total = req.body.total !== undefined ? Number(req.body.total) : calculatedTotal;
            if (freshOrder.status !== 'Billed' && freshOrder.status !== 'Paid') {
              freshOrder.status = 'Open';
            }
            await freshOrder.save();
            order = freshOrder;
          } else {
            const newOrderData = {
              tableNo,
              items: updatedItems,
              customerName: resolvedCustomerName || customerName,
              customerPhone,
              customerPhoto: resolvedCustomerPhoto || customerPhoto || '',
              kitchenNotes,
              billType: billType || 'Dine-In',
              discountType: dType,
              discountValue: dValue,
              discount: calculatedDiscount,
              subtotal,
              tax: tRate,
              taxBreakdown: order.taxBreakdown,
              deliveryCharge: dCharge,
              containerCharge: cCharge,
              cuttingCharge: cutCharge,
              iceCharges: iceCharge,
              boxCharges: boxCharge,
              transportCharges: transCharge,
              additionalCharges: addChargesArr,
              total: calculatedTotal,
              status: 'Open'
            };
            order = await Bill.create(newOrderData);
          }
        } else {
          throw saveErr;
        }
      }
    } else {
      // Create new order
      const subtotal = sanitizedItems.reduce((sum, item) => {
        if (item.isCancelled) return sum;
        const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
        return sum + (Number(item.price || 0) * activeQty);
      }, 0);

      const dType = discountType || 'flat';
      const dValue = discountValue !== undefined ? (Number(discountValue) || 0) : 0;
      const dName = discountName || '';
      const dApplicableTo = applicableTo || 'all';
      const dTargetCategory = targetCategory || '';

      let calculatedDiscount = 0;
      if (dType === 'percentage') {
        if (dApplicableTo === 'category' && dTargetCategory) {
          const targetCat = String(dTargetCategory).trim().toLowerCase();
          const eligibleSubtotal = sanitizedItems.reduce((sum, item) => {
            if (item.isCancelled) return sum;
            const itemCat = typeof item.category === 'object' && item.category !== null ? item.category.name : item.category;
            if (itemCat && String(itemCat).trim().toLowerCase() === targetCat) {
              const activeQty = Math.max(0, Number(item.quantity || 0) - (item.cancelledQuantity || 0));
              return sum + (Number(item.price || 0) * activeQty);
            }
            return sum;
          }, 0);
          calculatedDiscount = (eligibleSubtotal * dValue) / 100;
        } else {
          calculatedDiscount = (subtotal * dValue) / 100;
        }
      } else if (dType === 'complimentary') {
        calculatedDiscount = subtotal;
      } else {
        calculatedDiscount = dValue;
      }

      const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
      const tRate = tax !== undefined ? Number(tax) : 0;
      const calculatedTax = (taxableAmount * tRate) / 100;
      const dChargeNew = Number(deliveryCharge) || 0;
      const cChargeNew = Number(containerCharge) || 0;
      const cutChargeNew = Number(cuttingCharge) || 0;
      const iceChargeNew = Number(req.body.iceCharges) || 0;
      const boxChargeNew = Number(req.body.boxCharges) || 0;
      const transChargeNew = Number(req.body.transportCharges) || 0;
      const addChargesNew = Array.isArray(req.body.additionalCharges) ? req.body.additionalCharges : [];
      const netAddChargesNew = addChargesNew.reduce((sum, c) => {
        const amt = Number(c?.amount || 0);
        return c?.type === 'Dr' ? sum - amt : sum + amt;
      }, 0);
      const calculatedTotal = Math.round(taxableAmount + calculatedTax + dChargeNew + cChargeNew + cutChargeNew + iceChargeNew + boxChargeNew + transChargeNew + netAddChargesNew);

      let nextQueueNo = 1;
      try {
        const activeCount = await Bill.countDocuments({ status: { $in: ['Open', 'Billed'] } }).maxTimeMS(200).catch(() => 0);
        nextQueueNo = activeCount + 1;
      } catch (e) { }

      const restSnapshot = await getRestaurantSnapshot(req, restaurantDetails);
      const newBoxSummary = computeBoxesSummary(sanitizedItems);
      const orderData = {
        tableNo,
        items: sanitizedItems,
        boxes: newBoxSummary.boxes,
        totalBoxes: newBoxSummary.totalBoxes,
        restaurantDetails: restSnapshot,
        showLogo: showLogo !== undefined ? showLogo : true,
        subtotal,
        discount: calculatedDiscount,
        discountType: dType,
        discountValue: dValue,
        discountName: dName,
        applicableTo: dApplicableTo,
        targetCategory: dTargetCategory,
        tax: tRate,
        deliveryCharge: dChargeNew,
        containerCharge: cChargeNew,
        cuttingCharge: cutChargeNew,
        iceCharges: iceChargeNew,
        boxCharges: boxChargeNew,
        transportCharges: transChargeNew,
        additionalCharges: Array.isArray(req.body.additionalCharges)
          ? req.body.additionalCharges.filter(c => Number(c?.amount) > 0)
          : [],
        netAdjustment: Number(req.body.netAdjustment) || 0,
        customSettlements: req.body.customSettlements || [],
        partialPaymentHistory: req.body.partialPaymentHistory || [],
        paidAmount: Number(req.body.paidAmount) || 0,
        dueAmount: Number(req.body.dueAmount) || 0,
        total: (req.body.total !== undefined && Number(req.body.total) >= calculatedTotal && Number(req.body.total) > 0) ? Number(req.body.total) : calculatedTotal,
        status: 'Open',
        billType: billType || 'Retail',
        customerName: resolvedCustomerName || customerName,
        customerPhone,
        customerCategory: customerCategory || (billType === 'Wholesale' ? 'Wholesale' : (billType === 'Export' ? 'Export' : 'Retail')),
        exportSubCategory: exportSubCategory || null,
        customerPhoto: resolvedCustomerPhoto || customerPhoto || '',
        customerAddress: resolvedCustomerAddress,
        isOrderLocked: isOrderLocked || false,
        orderLockedAt: orderLockedAt || (isOrderLocked ? new Date() : null),
        orderDateFormatted: orderDateFormatted || '',
        orderTimeFormatted: orderTimeFormatted || '',
        kitchenNotes,
        queueNumber: nextQueueNo,
        tokenNo: nextQueueNo
      };

      // Add delivery fields only if delivery order
      if (billType === 'Delivery') {
        orderData.orderSource = orderSource || 'Direct';
        orderData.deliveryStatus = 'Pending';
      }
      // For Dine-In and Takeaway, orderSource should not be set (undefined)

      order = await Bill.create(orderData);
    }

    // Clear cache when order is updated
    cache.clear('dailyStats');
    cache.clear('openOrders');

    emitSocketEvent(req, 'orderUpdated', { tableNo, status: order.status, order });

    if (!req.body.skipNotification) {
      let itemNames = '';
      if (order.items && order.items.length > 0) {
        itemNames = ' (' + order.items.map(i => `${i.quantity}x ${i.name}`).join(', ') + ')';
        if (itemNames.length > 80) itemNames = itemNames.substring(0, 77) + '...)';
      }

      if (id) {
        emitNotification(req, 'Order Updated', `Order for ${tableNo} was updated${itemNames}`, 'info', ['Manager', 'Admin', 'Captain', 'Cashier'], { orderId: order._id, tableNo, type: 'order_updated' });
      } else {
        emitNotification(req, 'New Order Placed', `New order placed for ${tableNo}${itemNames}`, 'success', ['Manager', 'Admin', 'Captain', 'Cashier'], { orderId: order._id, tableNo, type:'new_order' });
      }
    }

    // Update Floor/Table status in DB in background
    if (order.status === 'Open' && order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Occupied', order._id).catch(err => console.error('Table status update error:', err));
    }
    // Immediate CRM update in background
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType, order.customerCategory, order.exportSubCategory).catch(err => console.error('Immediate CRM sync error:', err));
    }

    res.status(200).json(order);
  } catch (error) {
    console.error('Error in saveOrder:', error);
    res.status(400).json({ message: error.message, details: error.errors });
  }
};

// Generate Bill (Lock Order)


export const generateBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { items, discount, discountType, discountValue, discountName, applicableTo, targetCategory, tax, taxBreakdown, orderSource, customerName, customerPhone, deliveryCharge, containerCharge, cuttingCharge, restaurantDetails, billType, showLogo } = req.body;

    // ⚡⚡ OPTIMISTIC INSTANT NOTIFICATION — emit immediately before any DB work so the UI shows the toast the moment the user clicks Save & Print.
    // If the save somehow fails later, the toast has already shown (tradeoff: very rare, acceptable).
    const earlyTableNo = req.body.tableNo || req.query.tableNo || 'Table';
    const earlyBillNum = req.body.billNumber || '';
    setImmediate(() => {
      emitNotification(
        req,
        earlyBillNum ? `Bill #${earlyBillNum} Saved & Printed` : 'Bill Saved & Printed',
        earlyBillNum
          ? `Bill #${earlyBillNum} saved and printed for ${earlyTableNo}`
          : `Bill saved and printed for ${earlyTableNo}`,
        'success',
        ['Chef', 'Manager', 'Admin', 'Captain', 'Cashier'],
        { tableNo: earlyTableNo, type: 'bill_printed', optimistic: true }
      );
    });

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order && (req.body.tableNo || req.query.tableNo)) {
      const tableNo = req.body.tableNo || req.query.tableNo;
      order = await Bill.findOne({
        tableNo: getTableMatchCondition(tableNo),
        status: { $in: ['Open', 'Billed'] }
      });
    }

    // Single-shot flow: If order doesn't exist yet in DB, create it directly in generateBill!
    if (!order) {
      const targetTable = req.body.tableNo || req.query.tableNo;
      if (!targetTable) return res.status(404).json({ message: 'Order not found' });
      const restSnapshot = await getRestaurantSnapshot(req, restaurantDetails);
      order = new Bill({
        tableNo: targetTable,
        items: items || [],
        billType: billType || 'Dine-In',
        restaurantDetails: restSnapshot,
        showLogo: showLogo !== undefined ? showLogo : true,
        status: 'Open'
      });
    }

    if (order.status === 'Paid') return res.status(400).json({ message: 'Audit Security: Cannot modify an already paid and settled bill' });

    // Update items directly if sent in request (avoids redundant saveOrder round-trip!)
    if (items && Array.isArray(items) && items.length > 0) {
      order.items = items;
      const genBoxSummary = computeBoxesSummary(items);
      order.boxes = genBoxSummary.boxes;
      order.totalBoxes = genBoxSummary.totalBoxes;
      order.markModified('items');
      order.markModified('boxes');
    }

    if (!order.billedAt) {
      order.billedAt = new Date();
    }
    if (!order.restaurantDetails || !order.restaurantDetails.restaurantName) {
      order.restaurantDetails = await getRestaurantSnapshot(req, restaurantDetails);
    }
    if (showLogo !== undefined) {
      order.showLogo = showLogo;
    }
    const isExistingBilled = !!(order.billNumber || order.status === 'Billed');
    const prevSubtotal = order.subtotal || 0;
    const prevTotal = order.total || 0;
    const prevDiscount = order.discount || 0;
    const prevDeliveryCharge = order.deliveryCharge || 0;
    const prevContainerCharge = order.containerCharge || 0;
    const prevCuttingCharge = order.cuttingCharge || 0;
    const prevItems = (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total }));

    if (deliveryCharge !== undefined) order.deliveryCharge = Number(deliveryCharge) || 0;
    if (containerCharge !== undefined) order.containerCharge = Number(containerCharge) || 0;
    if (cuttingCharge !== undefined) order.cuttingCharge = Number(cuttingCharge) || 0;
    if (cuttingCharge !== undefined) order.cuttingCharge = Number(cuttingCharge) || 0;
    if (orderSource) order.orderSource = orderSource;
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType).catch(() => { });
    }
    if (discount !== undefined) order.discount = Number(discount) || 0;
    if (discountType) order.discountType = discountType;
    if (discountValue !== undefined) order.discountValue = Number(discountValue) || 0;
    if (discountName !== undefined) order.discountName = discountName;
    if (applicableTo !== undefined) order.applicableTo = applicableTo;
    if (targetCategory !== undefined) order.targetCategory = targetCategory;
    if (tax !== undefined) order.tax = Number(tax) || 0;
    if (taxBreakdown) {
      order.taxBreakdown = taxBreakdown;
    }

    // Ensure subtotal is valid and recomputed from active items if missing/0
    if (!order.subtotal || order.subtotal <= 0) {
      order.subtotal = (order.items || []).reduce((acc, i) =>
        acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
    }

    // Calculate final total with delivery, container, cutting, ice, box, transport, and additional charges
    const taxableAmount = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
    const taxAmount = (taxableAmount * (order.tax || 0)) / 100;
    const iceChargeBill = Number(order.iceCharges || 0);
    const boxChargeBill = Number(order.boxCharges || 0);
    const transChargeBill = Number(order.transportCharges || 0);
    const netAddChargesBill = (Array.isArray(order.additionalCharges) ? order.additionalCharges : []).reduce((sum, c) => {
      const amt = Number(c?.amount || 0);
      return c?.type === 'Dr' ? sum - amt : sum + amt;
    }, 0);
    const computedTotal = Math.round(taxableAmount + taxAmount + (Number(order.deliveryCharge) || 0) + (Number(order.containerCharge) || 0) + (Number(order.cuttingCharge) || 0) + iceChargeBill + boxChargeBill + transChargeBill + netAddChargesBill);
    order.total = (req.body.total !== undefined && Number(req.body.total) >= computedTotal && Number(req.body.total) > 0) ? Number(req.body.total) : computedTotal;

    const amountChanged = Math.abs(prevTotal - order.total) > 0.01 ||
      Math.abs(prevDeliveryCharge - (Number(order.deliveryCharge) || 0)) > 0.01 ||
      Math.abs(prevContainerCharge - (Number(order.containerCharge) || 0)) > 0.01 ||
      Math.abs(prevCuttingCharge - (Number(order.cuttingCharge) || 0)) > 0.01 ||
      Math.abs(prevDiscount - (Number(order.discount) || 0)) > 0.01;

    let billNumber = order.billNumber;
    if (!billNumber) {
      billNumber = await generateUniqueBillNumber(Bill, order);
    }

    if (isExistingBilled && amountChanged && billNumber) {
      order.editHistory = order.editHistory || [];
      order.editHistory.push({
        editedAt: new Date(),
        previousState: {
          items: prevItems,
          subtotal: prevSubtotal,
          totalDiscount: prevDiscount,
          totalTax: ((Math.max(0, prevSubtotal - prevDiscount)) * (order.tax || 0)) / 100,
          deliveryCharge: prevDeliveryCharge,
          containerCharge: prevContainerCharge,
          cuttingCharge: prevCuttingCharge,
          total: prevTotal,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        },
        newState: {
          items: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity, price: i.price, total: i.total })),
          subtotal: order.subtotal,
          totalDiscount: order.discount,
          totalTax: taxAmount,
          deliveryCharge: order.deliveryCharge || 0,
          containerCharge: order.containerCharge || 0,
          cuttingCharge: order.cuttingCharge || 0,
          total: order.total,
          discountType: order.discountType || 'flat',
          discountValue: order.discountValue || 0
        }
      });
      order.isEdited = true;
    }

    order.status = 'Billed';
    order.billNumber = billNumber;

    let saveSuccess = false;
    let attempts = 0;
    while (!saveSuccess && attempts < 15) {
      attempts++;
      try {
        await order.save();
        saveSuccess = true;
      } catch (saveErr) {
        const isDupKey = saveErr.code === 11000 || saveErr.message?.includes('E11000') || saveErr.message?.includes('duplicate key');
        if (isDupKey && attempts < 15) {
          console.warn(`[generateBill] Duplicate billNumber ${order.billNumber} detected (attempt ${attempts}), regenerating...`);
          const numMatch = (order.billNumber || '').match(/^MS(\d+)$/i);
          if (numMatch) {
             const nextNum = parseInt(numMatch[1], 10) + 1;
             billNumber = `MS${nextNum.toString().padStart(4, '0')}`;
          } else {
             billNumber = `MS${Date.now().toString().slice(-6)}`;
          }
          order.billNumber = billNumber;
          continue;
        }

        if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
          console.warn('[generateBill] VersionError caught, re-fetching fresh document...');
          const freshOrder = await Bill.findById(order._id);
          if (!freshOrder) return res.status(404).json({ message: 'Order not found after retry' });
          freshOrder.status = 'Billed';
          freshOrder.billNumber = billNumber;
          freshOrder.discount = order.discount;
          freshOrder.discountType = order.discountType;
          freshOrder.discountValue = order.discountValue;
          freshOrder.tax = order.tax;
          freshOrder.deliveryCharge = order.deliveryCharge;
          freshOrder.containerCharge = order.containerCharge;
          if (taxBreakdown) freshOrder.taxBreakdown = taxBreakdown;
          freshOrder.total = order.total;
          if (order.restaurantDetails && !freshOrder.restaurantDetails) {
            freshOrder.restaurantDetails = order.restaurantDetails;
          }
          if (order.billedAt && !freshOrder.billedAt) {
            freshOrder.billedAt = order.billedAt;
          }
          try {
            await freshOrder.save();
            order = freshOrder;
            saveSuccess = true;
          } catch (freshSaveErr) {
            const freshDup = freshSaveErr.code === 11000 || freshSaveErr.message?.includes('E11000') || freshSaveErr.message?.includes('duplicate key');
            if (freshDup && attempts < 15) {
              console.warn(`[generateBill] Duplicate billNumber on retry ${freshOrder.billNumber}, regenerating...`);
              const numMatch = (freshOrder.billNumber || '').match(/^MS(\d+)$/i);
              if (numMatch) {
                 const nextNum = parseInt(numMatch[1], 10) + 1;
                 billNumber = `MS${nextNum.toString().padStart(4, '0')}`;
              } else {
                 billNumber = `MS${Date.now().toString().slice(-6)}`;
              }
              order.billNumber = billNumber;
              continue;
            }
            throw freshSaveErr;
          }
        } else {
          throw saveErr;
        }
      }
    }

    // Clear cache when bill is generated
    cache.clear('dailyStats');
    cache.clear('openOrders');

    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Billed', order });
    if (!isExistingBilled) {
      // Final confirmed notification with actual bill number (replaces the optimistic one)
      emitNotification(req, `Bill #${billNumber} Saved & Printed`, `Bill #${billNumber} saved and printed for ${order.tableNo}`, 'success', ['Chef', 'Manager', 'Admin', 'Captain', 'Cashier'], { orderId: order._id, billNumber, tableNo: order.tableNo, type: 'bill_printed' });
    }

    // Update Floor/Table status in DB in background
    if (order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Billed', order._id).catch(err => console.error('Table status error:', err));
    }

    return res.json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Transfer Bill to a new Table


export const settleBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { paymentMode, splitPayments, upiApp, amountPaid, changeAmount, discount, discountType, discountValue, discountName, applicableTo, targetCategory, tax, taxBreakdown, total, subtotal, orderSource, customerName, customerPhone, deliveryCharge, containerCharge, cuttingCharge, restaurantDetails, showLogo, walletRedemption } = req.body;

    let order = null;
    if (id && id !== 'new' && mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order && id && id !== 'new') {
      order = await Bill.findOne({
        $or: [
          { billNumber: id },
          { tableNo: getTableMatchCondition(id), status: { $in: ['Open', 'Billed'] } }
        ]
      }).sort({ updatedAt: -1, createdAt: -1 });
    }
    if (!order) {
      // Direct settlement support: if order does not exist yet, create and settle in one atomic step
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        const tableNoToUse = req.body.tableNo || (id && id !== 'new' ? id : 'Walk-In');
        const restSnapshot = await getRestaurantSnapshot(req, restaurantDetails);
        order = new Bill({
          tableNo: tableNoToUse,
          items: req.body.items,
          billType: req.body.billType || 'Takeaway',
          status: 'Open',
          restaurantDetails: restSnapshot,
          showLogo: showLogo !== undefined ? showLogo : true,
          billedAt: new Date(),
          settledAt: new Date()
        });
      } else {
        return res.status(404).json({ message: 'Order not found' });
      }
    }

    if (order.status === 'Paid') {
      return res.json(order);
    }

    if (!order.settledAt) {
      order.settledAt = new Date();
    }
    if (!order.billedAt) {
      order.billedAt = order.createdAt || new Date();
    }
    if (!order.restaurantDetails || !order.restaurantDetails.restaurantName) {
      order.restaurantDetails = await getRestaurantSnapshot(req, restaurantDetails);
    }

    if (req.body.items && Array.isArray(req.body.items) && (!order.items || order.items.length === 0)) {
      order.items = req.body.items;
    }
    if (req.body.billType) {
      order.billType = req.body.billType;
    }

    if (orderSource) order.orderSource = orderSource;
    if (customerName) order.customerName = customerName;
    if (customerPhone) order.customerPhone = customerPhone;
    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType).catch(() => { });
    }

    if (deliveryCharge !== undefined) order.deliveryCharge = Number(deliveryCharge) || 0;
    if (containerCharge !== undefined) order.containerCharge = Number(containerCharge) || 0;
    if (showLogo !== undefined) order.showLogo = showLogo;
    if (walletRedemption !== undefined) order.walletRedemption = Math.max(0, Number(walletRedemption) || 0);

    // Apply optional pricing/discount adjustments if sent directly
    if (discount !== undefined) order.discount = Number(discount) || 0;
    if (discountType) order.discountType = discountType;
    if (discountValue !== undefined) order.discountValue = Number(discountValue) || 0;
    if (discountName !== undefined) order.discountName = discountName;
    if (applicableTo !== undefined) order.applicableTo = applicableTo;
    if (targetCategory !== undefined) order.targetCategory = targetCategory;
    if (tax !== undefined) order.tax = Number(tax) || 0;
    if (taxBreakdown) order.taxBreakdown = taxBreakdown;
    if (total !== undefined && Number(total) > 0) order.total = Number(total);
    if (subtotal !== undefined && Number(subtotal) > 0) order.subtotal = Number(subtotal);

    if ((paymentMode === 'Unpaid' || paymentMode === 'Partial') && !customerPhone && !order.customerPhone) {
      return res.status(400).json({ message: 'Customer Phone Number is mandatory for Unpaid and Partial (Khata) bills.' });
    }

    // Safeguard against zero total/subtotal
    if (!order.subtotal || order.subtotal <= 0) {
      order.subtotal = (order.items || []).reduce((acc, i) =>
        acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
    }
    const taxable = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
    const taxAmt = (taxable * (order.tax || 0)) / 100;
    const iceChargePay = Number(order.iceCharges || 0);
    const boxChargePay = Number(order.boxCharges || 0);
    const transChargePay = Number(order.transportCharges || 0);
    const netAddChargesPay = (Array.isArray(order.additionalCharges) ? order.additionalCharges : []).reduce((sum, c) => {
      const amt = Number(c?.amount || 0);
      return c?.type === 'Dr' ? sum - amt : sum + amt;
    }, 0);
    const computedExpectedTotal = Math.round(taxable + taxAmt + (Number(order.deliveryCharge) || 0) + (Number(order.containerCharge) || 0) + (Number(order.cuttingCharge) || 0) + iceChargePay + boxChargePay + transChargePay + netAddChargesPay);

    if (!order.total || order.total <= 0 || (computedExpectedTotal > 0 && order.total < computedExpectedTotal)) {
      order.total = computedExpectedTotal;
    }

    // Set status to 'Paid', 'Unpaid', or 'Partial' - this makes it appear in billing history
    if (paymentMode === 'Partial') {
      order.status = 'Partial';
      order.paymentMode = 'Partial';
      const paidPortion = Number(req.body.partialPayment?.paidAmount ?? amountPaid ?? 0);
      order.paidAmount = paidPortion;
      order.amountPaid = paidPortion;
      order.dueAmount = Math.max(0, (Number(order.total) || 0) - paidPortion);
      order.partialPayment = {
        paidAmount: order.paidAmount,
        dueAmount: order.dueAmount,
        method: req.body.partialPayment?.method || 'Cash',
        upiApp: req.body.partialPayment?.upiApp || upiApp
      };
      if (req.body.partialPayment?.upiApp || upiApp) {
        order.upiApp = req.body.partialPayment?.upiApp || upiApp;
      }
    } else {
      order.status = paymentMode === 'Unpaid' ? 'Unpaid' : 'Paid';
      order.paymentMode = paymentMode === 'Unpaid' ? undefined : paymentMode;
      order.paidAmount = paymentMode === 'Unpaid' ? 0 : (order.total || 0);
      order.dueAmount = paymentMode === 'Unpaid' ? (order.total || 0) : 0;
      if (upiApp) {
        order.upiApp = upiApp;
      }
      if (amountPaid !== undefined) {
        order.amountPaid = Number(amountPaid) || 0;
        order.changeAmount = changeAmount !== undefined ? Number(changeAmount) || 0 : Math.max(0, (Number(amountPaid) || 0) - (order.total || 0));
      }
    }

    if (paymentMode === 'Mixed' && splitPayments) {
      order.splitPayments = {
        cash: Number(splitPayments.cash) || 0,
        upi: Number(splitPayments.upi) || 0,
        card: Number(splitPayments.card) || 0
      };
    }

    // Explicitly update the updatedAt timestamp to ensure latest bills show first
    order.updatedAt = new Date();

    // Ensure billNumber exists if not previously generated (Ultra-fast indexed lookup)
    if (!order.billNumber) {
      order.billNumber = await generateUniqueBillNumber(Bill, order);
    }

    // Save the bill with version retry protection & duplicate key retry protection
    let saveSuccess = false;
    let attempts = 0;
    while (!saveSuccess && attempts < 15) { // Increased max attempts to 15
      attempts++;
      try {
        await order.save();
        saveSuccess = true;
      } catch (saveErr) {
        const isDupKey = saveErr.code === 11000 || saveErr.message?.includes('E11000') || saveErr.message?.includes('duplicate key');
        if (isDupKey && attempts < 15) { // Increased attempts to handle multiple skips
          console.warn(`[settleBill] Duplicate billNumber ${order.billNumber} detected (attempt ${attempts}), regenerating...`);
          order.billNumber = await generateUniqueBillNumber(Bill, order);
          continue;
        }

        if (saveErr.name === 'VersionError' || saveErr.message?.includes('No matching document found')) {
          console.warn('[settleBill] VersionError caught, retrying on fresh document...');
          const freshOrder = await Bill.findById(order._id);
          if (freshOrder) {
            freshOrder.status = order.status;
            freshOrder.paymentMode = order.paymentMode;
            if (upiApp) freshOrder.upiApp = upiApp;
            if (amountPaid !== undefined) {
              freshOrder.amountPaid = Number(amountPaid) || 0;
              freshOrder.changeAmount = changeAmount !== undefined ? Number(changeAmount) || 0 : Math.max(0, (Number(amountPaid) || 0) - (freshOrder.total || 0));
            }
            if (order.paidAmount !== undefined) freshOrder.paidAmount = order.paidAmount;
            if (order.dueAmount !== undefined) freshOrder.dueAmount = order.dueAmount;
            if (order.partialPayment) freshOrder.partialPayment = order.partialPayment;
            if (paymentMode === 'Mixed' && splitPayments) {
              freshOrder.splitPayments = {
                cash: Number(splitPayments.cash) || 0,
                upi: Number(splitPayments.upi) || 0,
                card: Number(splitPayments.card) || 0
              };
            }
            if (walletRedemption !== undefined) {
              freshOrder.walletRedemption = Math.max(0, Number(walletRedemption) || 0);
            }
            freshOrder.updatedAt = new Date();
            if (!freshOrder.billNumber) freshOrder.billNumber = order.billNumber;
            if (order.restaurantDetails && !freshOrder.restaurantDetails) {
              freshOrder.restaurantDetails = order.restaurantDetails;
            }
            if (order.settledAt && !freshOrder.settledAt) {
              freshOrder.settledAt = order.settledAt;
            }
            if (order.billedAt && !freshOrder.billedAt) {
              freshOrder.billedAt = order.billedAt;
            }
            try {
              await freshOrder.save();
              order = freshOrder;
              saveSuccess = true;
            } catch (freshSaveErr) {
              const freshDup = freshSaveErr.code === 11000 || freshSaveErr.message?.includes('E11000') || freshSaveErr.message?.includes('duplicate key');
              if (freshDup && attempts < 15) { // Increased attempts
                console.warn(`[settleBill] Duplicate billNumber on retry ${freshOrder.billNumber}, regenerating...`);
                const numMatch = (freshOrder.billNumber || '').match(/^MS(\d+)$/i);
                if (numMatch) {
                   const nextNum = parseInt(numMatch[1], 10) + 1;
                   order.billNumber = `MS${nextNum.toString().padStart(4, '0')}`;
                } else {
                   order.billNumber = `MS${Date.now().toString().slice(-6)}`;
                }
                continue;
              }
              throw freshSaveErr;
            }
          }
        } else {
          throw saveErr;
        }
      }
    }

    // ---- KHATA (CREDIT) LOGIC ----
    if ((paymentMode === 'Unpaid' || paymentMode === 'Partial') && saveSuccess) {
      try {
        const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
        const finalPhone = order.customerPhone || customerPhone;
        const finalName = order.customerName || customerName || 'Unknown Customer';
        
        let account = await CreditAccount.findOne({ phoneNumber: finalPhone });
        
        if (!account) {
          account = new CreditAccount({
            customerName: finalName,
            phoneNumber: finalPhone,
            balance: 0,
            transactions: []
          });
        }

        const khataAmount = paymentMode === 'Partial'
          ? (Number(order.dueAmount) || Math.max(0, (order.total || 0) - (order.paidAmount || 0)))
          : (order.total || 0);

        const noteText = paymentMode === 'Partial'
          ? `Partial Bill #${order.billNumber || ''} (Paid ₹${order.paidAmount || 0}, Due ₹${khataAmount})`
          : `Unpaid Bill #${order.billNumber || ''}`;
        
        account.transactions.push({
          type: 'credit',
          amount: khataAmount,
          billId: order._id,
          note: noteText
        });
        
        account.balance += khataAmount;
        await account.save();
        console.log(`[Khata] Added ₹${khataAmount} due to ${finalPhone}'s account for ${paymentMode} bill.`);
      } catch (err) {
        console.error('[Khata] Error updating Credit Account:', err);
      }
    }
    // ------------------------------

    // Clear cache when bill is settled (most important for dashboard)
    cache.clear('dailyStats');
    cache.clear('openOrders');

    // ⚡ INSTANT NOTIFICATION & SOCKET BROADCAST (0ms delay)
    emitSocketEvent(req, 'billSettled', { tableNo: order.tableNo, billNumber: order.billNumber, order, bill: order });
    emitSocketEvent(req, 'orderUpdated', { tableNo: order.tableNo, status: 'Paid', order });

    const cleanTable = (order.tableNo || '').replace(/^Table\s*/i, '');
    const billNumDisplay = order.billNumber ? `#${order.billNumber}` : '';
    const notifTitle = `Bill ${billNumDisplay} Settled`.trim();
    const notifMessage = order.billType === 'Dine-In'
      ? `Bill ${billNumDisplay} of ₹${order.total || 0} for Table ${cleanTable} settled via ${order.paymentMode || 'Cash'}`
      : `Bill ${billNumDisplay} of ₹${order.total || 0} settled via ${order.paymentMode || 'Cash'} (${order.billType || 'Takeaway'})`;

    emitNotification(
      req,
      notifTitle,
      notifMessage,
      'success',
      ['Admin', 'Manager', 'Cashier', 'Captain', 'Chef'],
      {
        orderId: order._id,
        billNumber: order.billNumber,
        type: 'bill_settled',
        tableNo: order.tableNo,
        total: order.total,
        paymentMode: order.paymentMode,
        billType: order.billType
      }
    );

    // Automatically deduct inventory stock & update CRM in background
    deductStockForBillItems(req, order.items, req.user?.username || 'POS Billing Counter', {
      billNumber: order.billNumber,
      orderChannel: order.orderChannel || order.billType || 'Counter-Retail'
    }).catch(err => console.error('Auto stock deduction error:', err));
    updateCustomerFromBill(req, order).catch(err => console.error('Customer CRM update error:', err));

    // Free up the table in DB in background
    if (order.billType === 'Dine-In') {
      updateTableStatusHelper(req, order.tableNo, 'Available', null).catch(err => console.error('Table status error:', err));
    }

    // Return the saved bill with all details immediately
    res.json(order);
  } catch (error) {
    console.error('Error settling bill:', error);
    res.status(400).json({ message: error.message });
  }
};

// Get all bills (for history) with pagination support - Optimized for 150+ orders/day
// Get all bills (for history, delivery, pickup) with pagination support - Optimized for high performance


export const getOpenOrders = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const tenantDb = req.tenantDb || req.headers?.['x-tenant-db'] || 'default';
    const cacheKey = `openOrders_${tenantDb}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const orders = await Bill.find({
      status: { $in: ['Open', 'Billed'] }
    })
      .select('tableNo orderNo items total subtotal tax discount discountType discountValue discountName applicableTo targetCategory customerCategory orderMode orderChannel exportSubCategory totalBoxes boxes deliveryCharge containerCharge cuttingCharge iceCharges boxCharges transportCharges netAdjustment customSettlements partialPaymentHistory paidAmount dueAmount customerName customerPhone customerPhoto customerAddress isOrderLocked orderLockedAt orderDateFormatted orderTimeFormatted status billNumber billType orderSource queueNumber tokenNo createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Zero-item bills are filtered out below in formattedOrders and cleaned up during save/cancel operations


    const dynamicTaxRate = await getDynamicTaxRate(req);

    const formattedOrders = orders
      .filter(order => {
        const validItems = (order.items || []).filter(i => (Number(i.quantity || 0) > 0 || (i.printedQuantity || 0) > 0));
        return validItems.length > 0;
      })
      .map(order => {
        const subtotal = (order.items || []).reduce((acc, i) => acc + (i.isCancelled ? 0 : (Number(i.price || 0) * Math.max(0, Number(i.quantity || 0) - Number(i.cancelledQuantity || 0)))), 0);
        const disc = Number(order.discount) || 0;
        const taxable = Math.max(0, subtotal - disc);
        const taxRate = order.status === 'Open' ? dynamicTaxRate : ((order.tax !== undefined && order.tax !== null) ? Number(order.tax) : dynamicTaxRate);
        const taxAmount = Number(((taxable * taxRate) / 100).toFixed(2));
        const dCharge = Number(order.deliveryCharge) || 0;
        const cCharge = Number(order.containerCharge) || 0;
        const cutCharge = Number(order.cuttingCharge) || 0;
        const computedTotal = Math.round(taxable + taxAmount + dCharge + cCharge + cutCharge);
        const finalTotal = (order.total !== undefined && Number(order.total) > 0) ? Number(order.total) : computedTotal;
        return {
          ...order,
          subtotal,
          tax: taxRate,
          deliveryCharge: dCharge,
          containerCharge: cCharge,
          cuttingCharge: cutCharge,
          total: finalTotal
        };
      });

    // Cross-reference CRM Customer directory by phone number to ensure customerName, customerPhoto & businessName are authoritative
    const phones = formattedOrders.map(o => o.customerPhone).filter(Boolean);
    const cleanPhones = phones.map(p => String(p).replace(/\D/g, '').slice(-10)).filter(Boolean);
    if (cleanPhones.length > 0) {
      try {
        const Customer = getTenantModel(req, 'Customer', CustomerDefault);
        const crmCustomers = await Customer.find({
          $or: [
            { phone: { $in: phones } },
            { phone: { $in: cleanPhones } }
          ]
        }).select('name phone photo businessName').lean();

        const crmMap = {};
        crmCustomers.forEach(c => {
          const cp = String(c.phone || '').replace(/\D/g, '').slice(-10);
          if (cp) crmMap[cp] = c;
          if (c.phone) crmMap[c.phone] = c;
        });

        formattedOrders.forEach(o => {
          if (o.customerPhone) {
            const cp = String(o.customerPhone).replace(/\D/g, '').slice(-10);
            const c = crmMap[cp] || crmMap[o.customerPhone];
            if (c?.name && c.name !== 'Guest' && c.name.trim() !== '') {
              if (o.customerName !== c.name) {
                // Background self-healing in MongoDB so the order document is permanently corrected
                Bill.updateOne({ _id: o._id }, { customerName: c.name }).catch(() => {});
              }
              o.customerName = c.name;
            }
            if (c?.photo && !o.customerPhoto) {
              o.customerPhoto = c.photo;
            }
            if (c?.businessName && !o.businessName) {
              o.businessName = c.businessName;
            }
          }
        });
      } catch (crmErr) {
        console.warn('[getOpenOrders] CRM lookup warning:', crmErr.message);
      }
    }

    cache.set(`openOrders_${req.tenantDb || req.headers?.['x-tenant-db'] || 'default'}`, formattedOrders, 3); // 3s short TTL to absorb burst calls
    res.json(formattedOrders);
  } catch (error) {
    console.error('Error fetching open orders:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get daily statistics - Optimized with parallel aggregation for sub-50ms execution


export const cancelOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { cancelReason } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (bill.status === 'Paid') {
      return res.status(400).json({ message: 'Cannot cancel an order that is already paid. Please process a refund instead.' });
    }

    if (bill.status === 'Cancelled') {
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    // Generate a cancellation KOT if any items were already printed to the kitchen
    const kotItems = [];
    for (const item of bill.items) {
      if (item.printedQuantity > 0) {
        kotItems.push({
          name: item.name,
          quantity: -(item.printedQuantity) // Negative quantity signals kitchen to stop cooking
        });
        item.printedQuantity = 0; // Reset printed quantity
      }
    }

    let newKOT = null;
    if (kotItems.length > 0) {
      newKOT = {
        kotNumber: `CANCEL-${(bill.kots ? bill.kots.length : 0) + 1}`,
        items: kotItems,
        createdAt: new Date()
      };
      bill.kots.push(newKOT);
    }

    bill.status = 'Cancelled';
    if (cancelReason) {
      bill.cancelReason = cancelReason;
    }
    await bill.save();

    cache.clear('dailyStats');
    cache.clear('openOrders');

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: 'Cancelled', order: bill });
    emitNotification(
      req,
      'Order Cancelled',
      `Order for Table ${bill.tableNo} was cancelled${cancelReason ? `: ${cancelReason}` : ''}`,
      'error',
      ['Admin', 'Manager', 'Cashier', 'Captain', 'Chef'],
      { orderId: bill._id, tableNo: bill.tableNo, type: 'order_cancelled', cancelReason }
    );

    // Free up the table in DB in background
    if (bill.billType === 'Dine-In') {
      updateTableStatusHelper(req, bill.tableNo, 'Available', null).catch(err => console.error('Table status error:', err));
    }

    res.status(200).json({
      message: 'Order cancelled successfully',
      kot: newKOT
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ message: 'Error cancelling order', error: error.message });
  }
};



export const refundOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { refundReason } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.status !== 'Paid') return res.status(400).json({ message: 'Only paid bills can be refunded' });

    bill.status = 'Refunded';
    bill.cancelReason = refundReason || 'Customer requested refund';
    await bill.save();

    // Automatically restore deducted fish stock back to inventory ledger
    restoreStockForBillItems(req, bill.items, refundReason || 'Customer Refund', req.user?.username || 'Admin', {
      billNumber: bill.billNumber,
      orderChannel: bill.orderChannel || bill.billType
    }).catch(err => console.error('Error restoring stock on refund:', err));

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: 'Refunded' });

    res.status(200).json({ message: 'Order refunded successfully', bill });
  } catch (error) {
    console.error('Error refunding order:', error);
    res.status(500).json({ message: 'Error refunding order', error: error.message });
  }
};

// =======================
// KDS Controller Methods
// =======================



export const reopenOrder = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (bill.status === 'Paid') {
      return res.status(400).json({ message: 'Cannot reopen a paid order. Create a new bill instead.' });
    }

    bill.status = 'Open';
    // Clear the bill number so it's regenerated when they finalize? 
    // No, standard POS practice is to keep the same bill number and just update the amount.

    await bill.save();

    emitSocketEvent(req, 'orderUpdated', { tableNo: bill.tableNo, status: 'Open' });

    // Update Floor/Table status in DB in background
    if (bill.billType === 'Dine-In') {
      updateTableStatusHelper(req, bill.tableNo, 'Occupied', bill._id).catch(err => console.error('Table status error:', err));
    }

    res.status(200).json({
      message: 'Order reopened successfully',
      bill
    });
  } catch (error) {
    console.error('Error reopening order:', error);
    res.status(500).json({ message: 'Error reopening order', error: error.message });
  }
};

// Update customer details directly on a bill/order
export const updateBillCustomer = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { customerName, customerPhone, billType } = req.body;

    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Bill.findById(id);
    }
    if (!order) {
      order = await Bill.findOne({
        tableNo: getTableMatchCondition(id),
        status: { $in: ['Open', 'Billed'] }
      });
    }

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.customerName = customerName || 'Guest';
    order.customerPhone = customerPhone || '';
    await order.save();

    cache.clear('dailyStats');
    cache.clear('openOrders');

    if (order.customerPhone) {
      syncCustomer(req, order.customerPhone, order.customerName, order.billType || billType).catch(() => { });
    }

    emitSocketEvent(req, 'orderUpdated', {
      tableNo: order.tableNo,
      orderId: order._id,
      customerName: order.customerName,
      customerPhone: order.customerPhone
    });

    res.json({ success: true, order });
  } catch (err) {
    console.error('Error updating bill customer:', err);
    res.status(500).json({ message: err.message });
  }
};

export const clearUnpaidBill = async (req, res) => {
  try {
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { id } = req.params;
    const { paymentMode, splitPayments, upiApp, amountPaid, changeAmount } = req.body;
    
    if (!paymentMode) {
      return res.status(400).json({ message: 'Payment mode is required to clear an unpaid bill.' });
    }

    let order = await Bill.findById(id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'Unpaid' && order.status !== 'Partial') {
      return res.status(400).json({ message: 'Only Unpaid or Partial bills can be cleared.' });
    }

    const previousDue = order.status === 'Partial'
      ? (Number(order.dueAmount) || Math.max(0, (order.total || 0) - (order.paidAmount || 0)))
      : (order.total || 0);

    order.status = 'Paid';
    order.paymentMode = paymentMode;
    if (splitPayments) order.splitPayments = splitPayments;
    if (upiApp) order.upiApp = upiApp;
    order.paidAmount = order.total || 0;
    order.dueAmount = 0;
    order.amountPaid = order.total || 0;
    if (changeAmount !== undefined) order.changeAmount = changeAmount;
    
    order.clearedAt = new Date();
    order.updatedAt = new Date();

    await order.save();

    // Khata sync: deduct the cleared due amount from customer's CreditAccount
    try {
      const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
      const finalPhone = order.customerPhone;
      if (finalPhone) {
        let account = await CreditAccount.findOne({ phoneNumber: finalPhone });
        if (account) {
          account.transactions.push({
            type: 'payment',
            amount: previousDue,
            billId: order._id,
            note: `Cleared due for Bill #${order.billNumber || ''} via ${paymentMode}`
          });
          account.balance = Math.max(0, account.balance - previousDue);
          await account.save();
          console.log(`[Khata] Cleared ₹${previousDue} due from ${finalPhone}'s account.`);
        }
      }
    } catch (kErr) {
      console.warn('[clearUnpaidBill] Khata balance adjustment failed:', kErr);
    }

    // Bypass Mongoose timestamps immutability to force update createdAt
    // This ensures the bill counts towards TODAY's DayBook and analytics!
    const newDate = new Date();
    await Bill.updateOne({ _id: order._id }, { $set: { createdAt: newDate } });
    order.createdAt = newDate;

    cache.clear('dailyStats');
    cache.clear('openOrders');

    emitSocketEvent(req, 'billSettled', order);

    res.json({ success: true, order, message: 'Bill cleared successfully.' });
  } catch (err) {
    console.error('Error clearing unpaid bill:', err);
    res.status(500).json({ message: err.message });
  }
};
