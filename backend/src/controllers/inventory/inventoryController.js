import mongoose from 'mongoose';
import StockLogDefault from '../../models/inventory/StockLog.js';
import MenuDefault from '../../models/catalog/Menu.js';
import SupplierDefault from '../../models/operations/Supplier.js';
import { getTenantModel } from '../../utils/database/tenantHelper.js';
import { emitNotification } from '../../utils/communication/notificationHelper.js';
import { emitSocketEvent } from '../../utils/communication/socket.js';

// Helper to get models from request (for multi-tenancy)
const getModels = (req) => ({
  StockLog: getTenantModel(req, 'StockLog', StockLogDefault),
  Menu: getTenantModel(req, 'Menu', MenuDefault),
  Supplier: getTenantModel(req, 'Supplier', SupplierDefault)
});

// 10. Get Stock Logs (Audit Trail with Backend Pagination & Filters)
export const getLogs = async (req, res) => {
  try {
    const { StockLog } = getModels(req);
    const { page = 1, limit = 15, type = 'All', search = '', startDate, endDate, supplierName } = req.query;

    const query = {};

    // Filter by Transaction Type
    if (type && type !== 'All') {
      if (type.includes('Procurement') || type.includes('Stock-In')) {
        query.type = { $regex: 'Procurement|Stock-In', $options: 'i' };
      } else if (type.includes('POS')) {
        query.type = { $regex: 'POS Sale', $options: 'i' };
      } else if (type.includes('Online')) {
        query.type = { $regex: 'Online Sale', $options: 'i' };
      } else if (type.includes('Refund') || type.includes('Reversal')) {
        query.type = { $regex: 'Refund|Reversal', $options: 'i' };
      } else {
        query.type = type;
      }
    }

    // Filter by supplier if logged in supplier or query parameter supplied
    const targetSupplier = (req.user?.role === 'supplier' ? (req.user.name || req.user.username) : null) || supplierName;
    if (targetSupplier && targetSupplier.trim() && targetSupplier !== 'All') {
      const suppRegex = new RegExp(targetSupplier.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { supplierName: suppRegex },
          { companyName: suppRegex }
        ]
      });
    }

    // Search by itemName, billNumber, supplierName, performedBy
    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { itemName: { $regex: q, $options: 'i' } },
        { billNumber: { $regex: q, $options: 'i' } },
        { supplierName: { $regex: q, $options: 'i' } },
        { performedBy: { $regex: q, $options: 'i' } }
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 15;
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      StockLog.countDocuments(query),
      StockLog.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitNum)
    ]);

    // Backward compatibility for callers expecting array directly
    if (req.query.legacy === 'true') {
      return res.status(200).json(logs);
    }

    res.status(200).json({
      success: true,
      data: logs,
      logs: logs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error fetching stock logs' });
  }
};

// 11. Helper: Automatically deduct fish stock when a bill is created / settled
export const deductStockForBillItems = async (req, billItems, performedBy = 'POS Billing Counter', billMeta = {}) => {
  try {
    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) return;
    const { Menu, InventoryItem, StockLog } = getModels(req);

    for (const item of billItems) {
      const menuItemId = item.menuItem?._id || item.menuItem || item.originalId || item._id || item.id;
      const orderQty = Number(item.quantity || 1);

      let menuDoc = null;
      if (menuItemId && mongoose.Types.ObjectId.isValid(menuItemId)) {
        menuDoc = await Menu.findById(menuItemId);
      }

      // Robust fallback: If not found by ID or ID is subdoc ID, find by base fish name
      if (!menuDoc && item.name) {
        const baseName = (item.originalFishName || item.name.replace(/\s*\([^)]*\)\s*$/, '')).trim();
        if (baseName) {
          menuDoc = await Menu.findOne({
            $or: [
              { name: baseName },
              { name: new RegExp('^' + baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
              { name: new RegExp('^' + baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
            ]
          });
        }
      }

      if (!menuDoc) {
        console.warn(`[Inventory] Fish not found for stock deduction: "${item.name}" (ID: ${menuItemId})`);
        continue;
      }

      // 🐟 1. Determine Cut Type & Yield Factor
      const cutType = item.cutType || (item.name && item.name.includes('Fillet') ? 'Boneless Fillet' : (item.name && item.name.includes('Curry') ? 'Curry Cut' : 'Whole Cleaned'));
      let yieldFactor = 1.0;

      if (Array.isArray(menuDoc.cuts) && menuDoc.cuts.length > 0) {
        const match = menuDoc.cuts.find(c => c.cutName && c.cutName.toLowerCase() === cutType.toLowerCase());
        if (match && Number(match.yieldFactor) > 0) {
          yieldFactor = Number(match.yieldFactor);
        }
      }

      if (yieldFactor === 1.0 && item.yieldFactor && Number(item.yieldFactor) > 0 && Number(item.yieldFactor) <= 1.0) {
        yieldFactor = Number(item.yieldFactor);
      } else if (yieldFactor === 1.0) {
        const lowerCut = cutType.toLowerCase();
        if (lowerCut.includes('boneless') || lowerCut.includes('fillet')) yieldFactor = 0.50;
        else if (lowerCut.includes('curry') || lowerCut.includes('steak')) yieldFactor = 0.75;
        else if (lowerCut.includes('clean') || lowerCut.includes('gut')) yieldFactor = 0.85;
        else yieldFactor = 1.0;
      }
      yieldFactor = Math.min(1.0, Math.max(0.1, yieldFactor));

      // 🐟 2. Calculate Net Weight Sold and Gross Raw Weight to Deduct (1:1 Exact Scale Match)
      const isBox = item.sellingUnit === 'Box' || (item.name && item.name.includes('Box'));
      let netKgSold = 0;
      let grossKgToDeduct = 0;

      if (isBox) {
        const boxes = Number(item.boxCount || orderQty || 1);
        if (item.grossWeightKg && Number(item.grossWeightKg) > 0) {
          grossKgToDeduct = Number(item.grossWeightKg);
          netKgSold = Number(item.netWeightKg || item.enteredWeight || grossKgToDeduct);
        } else if (item.enteredWeight && Number(item.enteredWeight) > 0) {
          grossKgToDeduct = Number(item.enteredWeight);
          netKgSold = grossKgToDeduct;
        } else {
          const perBox = Number(menuDoc.boxPackingKg || 0);
          grossKgToDeduct = boxes * perBox;
          netKgSold = grossKgToDeduct;
        }
      } else {
        if (item.grossWeightKg && Number(item.grossWeightKg) > 0) {
          grossKgToDeduct = Number(item.grossWeightKg);
          netKgSold = Number(item.enteredWeight || item.netWeightKg || grossKgToDeduct);
        } else if (item.enteredWeight && Number(item.enteredWeight) > 0) {
          const ew = Number(item.enteredWeight);
          grossKgToDeduct = (orderQty > 1 && Math.abs(orderQty - ew) > 0.001) ? (ew * orderQty) : ew;
          netKgSold = grossKgToDeduct;
        } else if (item.netWeightKg && Number(item.netWeightKg) > 0) {
          grossKgToDeduct = Number(item.netWeightKg);
          netKgSold = grossKgToDeduct;
        } else if (item.sellingUnit === 'Grams') {
          grossKgToDeduct = (orderQty / 1000);
          netKgSold = grossKgToDeduct;
        } else {
          // Fallback parsing: check weight label in name, e.g. "(Whole - 1 Kg)" or "(Curry - 500g)"
          const nameWeightMatch = item.name && item.name.match(/-\s*(\d+(?:\.\d+)?)\s*(kg|g)/i);
          if (nameWeightMatch) {
            const val = parseFloat(nameWeightMatch[1]);
            const unit = nameWeightMatch[2].toLowerCase();
            grossKgToDeduct = unit === 'g' ? (val / 1000) : val;
            netKgSold = grossKgToDeduct;
          } else if (menuDoc.price && Number(menuDoc.price) > 0 && Number(item.price) > 0) {
            // Reverse-calculate weight from total / rate per kg: e.g. ₹200 / ₹200 = 1.0 Kg
            grossKgToDeduct = parseFloat((Number(item.price) / Number(menuDoc.price)).toFixed(3));
            netKgSold = grossKgToDeduct;
          } else {
            grossKgToDeduct = orderQty;
            netKgSold = orderQty;
          }
        }
      }

      // 🐟 3. Deduct from Menu Raw Fish Stock (1:1 Exact Scale Weight Match)
      const prevStock = Number(menuDoc.stock ?? menuDoc.openingStock ?? 0);
      const newStock = Math.max(0, Number((prevStock - grossKgToDeduct).toFixed(3)));
      menuDoc.stock = newStock;
      await menuDoc.save();

      // 🐟 4. Mandatory StockLog for Fish Inventory Audit
      await StockLog.create({
        fishItem: menuDoc._id,
        itemName: menuDoc.name,
        type: billMeta.orderChannel === 'Online-Delivery' ? 'Online Sale' : 'POS Sale',
        quantityChange: -grossKgToDeduct,
        grossKgChange: -grossKgToDeduct,
        finalStock: newStock,
        balanceGrossKg: newStock,
        unit: 'kg',
        cutType,
        billNumber: billMeta.billNumber || '',
        orderChannel: billMeta.orderChannel || 'Counter-Retail',
        notes: `Sold ${netKgSold}kg (${cutType}) - Exact Scale Deduction: -${grossKgToDeduct}kg on Bill #${billMeta.billNumber || 'Counter'}`,
        performedBy
      });

      // Low stock notification
      const minAlert = Number(menuDoc.minStockAlertKg || 5);
      if (newStock <= minAlert && prevStock > minAlert) {
        emitNotification(
          req,
          'Low Fish Stock Alert',
          `${menuDoc.name} stock has reached ${newStock} kg (Below threshold: ${minAlert} kg). Restock from Mandi/Harbor soon.`,
          'warning',
          ['Admin', 'Manager', 'Cashier']
        );
      }

      emitSocketEvent(req, 'fishStockUpdated', {
        menuItemId: menuDoc._id,
        name: menuDoc.name,
        previousStock: prevStock,
        newStock,
        grossDeducted: grossKgToDeduct
      });
    }
  } catch (err) {
    console.error('[InventoryController] Error in deductStockForBillItems:', err);
  }
};

// 11b. Helper: Restore fish stock on Bill Cancellation / Refund / Deletion
export const restoreStockForBillItems = async (req, billItems, reason = 'Sale Reversal (Refund)', performedBy = 'System / Admin', billMeta = {}) => {
  try {
    if (!billItems || !Array.isArray(billItems) || billItems.length === 0) return;
    const { Menu, StockLog } = getModels(req);

    for (const item of billItems) {
      const menuItemId = item.menuItem?._id || item.menuItem || item.originalId || item._id || item.id;
      if (!menuItemId) continue;

      const menuDoc = await Menu.findById(menuItemId);
      if (!menuDoc) continue;

      const isBox = item.sellingUnit === 'Box' || (item.name && item.name.includes('Box'));
      const cutType = item.cutType || 'Whole';
      let yieldFactor = Number(item.yieldFactor || 1.0);
      if (yieldFactor <= 0 || yieldFactor > 1) yieldFactor = 1.0;

      let grossKgToRestore = 0;

      if (isBox) {
        const boxes = Number(item.boxCount || item.quantity || 1);
        const netPerBox = Number(menuDoc.boxNetFishKg || (menuDoc.boxPackingKg ? menuDoc.boxPackingKg - (menuDoc.boxTareWeightKg || 10) : 50));
        grossKgToRestore = boxes * netPerBox;
      } else {
        if (item.grossWeightKg && Number(item.grossWeightKg) > 0) {
          grossKgToRestore = Number(item.grossWeightKg);
        } else if (item.enteredWeight && Number(item.enteredWeight) > 0) {
          const netKg = Number(item.enteredWeight) * (item.quantity && item.quantity > 1 ? Number(item.quantity) : 1);
          grossKgToRestore = Number((netKg / yieldFactor).toFixed(3));
        } else {
          const netKg = Number(item.quantity || 1);
          grossKgToRestore = Number((netKg / yieldFactor).toFixed(3));
        }
      }

      const prevStock = Number(menuDoc.stock ?? menuDoc.openingStock ?? 0);
      const newStock = Number((prevStock + grossKgToRestore).toFixed(3));
      menuDoc.stock = newStock;
      await menuDoc.save();

      await StockLog.create({
        fishItem: menuDoc._id,
        itemName: menuDoc.name,
        type: 'Sale Reversal (Refund)',
        quantityChange: grossKgToRestore,
        grossKgChange: grossKgToRestore,
        finalStock: newStock,
        balanceGrossKg: newStock,
        unit: 'kg',
        cutType,
        billNumber: billMeta.billNumber || '',
        orderChannel: billMeta.orderChannel || 'Counter-Retail',
        notes: `Stock restored: +${grossKgToRestore}kg gross for ${item.name || menuDoc.name} (${reason})`,
        performedBy
      });

      emitSocketEvent(req, 'fishStockUpdated', {
        menuItemId: menuDoc._id,
        name: menuDoc.name,
        previousStock: prevStock,
        newStock,
        grossRestored: grossKgToRestore
      });
    }
  } catch (err) {
    console.error('[InventoryController] Error in restoreStockForBillItems:', err);
  }
};

// 12. AI Restock Prediction — Analyze last 7 days of deductions & predict tomorrow's needs
export const getRestockPredictions = async (req, res) => {
  try {
    const { StockLog, InventoryItem } = getModels(req);

    // Get all POS deductions from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const deductions = await StockLog.find({
      type: 'POS Deduction',
      createdAt: { $gte: sevenDaysAgo }
    }).lean();

    // Group deductions by ingredient
    const usageMap = {};
    for (const log of deductions) {
      const key = log.item?.toString() || log.itemName;
      if (!usageMap[key]) {
        usageMap[key] = {
          itemId: log.item,
          itemName: log.itemName,
          unit: log.unit || 'units',
          dailyUsage: {},
          totalUsed: 0
        };
      }
      const dayKey = new Date(log.createdAt).toISOString().split('T')[0];
      usageMap[key].dailyUsage[dayKey] = (usageMap[key].dailyUsage[dayKey] || 0) + Math.abs(log.quantityChange);
      usageMap[key].totalUsed += Math.abs(log.quantityChange);
    }

    // Calculate predictions
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = tomorrow.getDay(); // 0=Sun, 5=Fri, 6=Sat
    const isWeekend = tomorrowDay === 0 || tomorrowDay === 5 || tomorrowDay === 6;
    const weekendMultiplier = isWeekend ? 1.35 : 1.0; // 35% surge on weekends

    const allItems = await InventoryItem.find().lean();
    const itemStockMap = {};
    allItems.forEach(item => {
      itemStockMap[item._id.toString()] = item;
    });

    const predictions = [];
    for (const [key, usage] of Object.entries(usageMap)) {
      const daysWithData = Object.keys(usage.dailyUsage).length || 1;
      const avgDaily = usage.totalUsed / Math.max(daysWithData, 1);
      const predicted = Math.ceil(avgDaily * weekendMultiplier * 10) / 10;

      const currentItem = itemStockMap[key];
      const currentStock = currentItem?.currentStock || 0;
      const deficit = predicted - currentStock;

      let urgency = 'ok';
      if (currentStock <= 0) urgency = 'critical';
      else if (deficit > 0) urgency = 'low';
      else if (currentStock < predicted * 2) urgency = 'medium';

      predictions.push({
        itemId: usage.itemId,
        itemName: usage.itemName,
        unit: usage.unit,
        avgDailyUsage: Math.round(avgDaily * 10) / 10,
        predictedTomorrow: predicted,
        currentStock,
        deficit: Math.max(0, Math.round(deficit * 10) / 10),
        urgency,
        isWeekendSurge: isWeekend,
        daysOfData: daysWithData
      });
    }

    // Sort by urgency: critical > low > medium > ok
    const urgencyOrder = { critical: 0, low: 1, medium: 2, ok: 3 };
    predictions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    res.status(200).json({
      predictions,
      meta: {
        analyzedDays: 7,
        tomorrowDate: tomorrow.toISOString().split('T')[0],
        isWeekend,
        weekendMultiplier
      }
    });
  } catch (error) {
    console.error('[InventoryController] Prediction error:', error);
    res.status(500).json({ message: error.message || 'Error generating predictions' });
  }
};

// 13. Mandi / Harbor Catch Procurement (Stock-In)
export const recordProcurement = async (req, res) => {
  try {
    const { Menu, StockLog } = getModels(req);
    const { menuItemId, grossKgAdded, purchasePricePerKg, supplierName, notes } = req.body;

    const added = parseFloat(grossKgAdded);
    if (!menuItemId || isNaN(added) || added <= 0) {
      return res.status(400).json({ message: 'Valid menuItemId and grossKgAdded are required' });
    }

    const fishDoc = await Menu.findById(menuItemId);
    if (!fishDoc) {
      return res.status(404).json({ message: 'Fish item not found' });
    }

    const prevStock = Number(fishDoc.stock ?? fishDoc.openingStock ?? 0);
    const newStock = Number((prevStock + added).toFixed(3));
    fishDoc.stock = newStock;
    if (purchasePricePerKg && Number(purchasePricePerKg) > 0) {
      fishDoc.purchasePrice = Number(purchasePricePerKg);
    }
    if (supplierName && supplierName.trim()) {
      fishDoc.lastSupplier = supplierName.trim();
    }
    fishDoc.lastProcurementDate = new Date();
    await fishDoc.save();

    const log = await StockLog.create({
      fishItem: fishDoc._id,
      itemName: fishDoc.name,
      type: 'Procurement (Stock-In)',
      quantityChange: added,
      grossKgChange: added,
      finalStock: newStock,
      balanceGrossKg: newStock,
      unit: 'kg',
      supplierName: supplierName ? supplierName.trim() : '',
      crateReference: notes ? notes.trim() : '',
      notes: `Mandi/Harbor Catch Received: +${added}kg${supplierName ? ` from ${supplierName.trim()}` : ''}${notes ? ` (${notes.trim()})` : ''}`,
      performedBy: req.user?.username || 'Procurement Manager'
    });

    emitSocketEvent(req, 'fishStockUpdated', {
      menuItemId: fishDoc._id,
      name: fishDoc.name,
      previousStock: prevStock,
      newStock,
      grossAdded: added
    });

    res.status(200).json({ success: true, message: `Successfully added ${added}kg of ${fishDoc.name}`, stock: newStock, log });
  } catch (error) {
    console.error('[InventoryController] Procurement error:', error);
    res.status(500).json({ message: error.message || 'Error recording procurement' });
  }
};

// 15. Real-time Fish Stock Overview (Supports Date Range & Catch Source Filtering from Database)
export const getFishInventory = async (req, res) => {
  try {
    const { Menu, StockLog } = getModels(req);
    const { startDate, endDate, source = 'all', search = '' } = req.query;

    const baseMenuQuery = { isAvailable: true };

    if (search && search.trim()) {
      const q = search.trim();
      baseMenuQuery.$or = [
        { name: { $regex: q, $options: 'i' } },
        { scientificName: { $regex: q, $options: 'i' } }
      ];
    }

    const hasSourceFilter = source && source !== 'all' && source !== 'All';
    const hasDateFilter = Boolean(startDate || endDate);

    // If Date or Source filters are applied, query StockLog records from database
    if (hasSourceFilter || hasDateFilter) {
      const logMatch = {
        $or: [
          { type: { $regex: 'Stock-In|Procurement|Consignment', $options: 'i' } },
          { quantityChange: { $gt: 0 } }
        ]
      };

      if (hasSourceFilter) {
        const srcLower = source.toLowerCase();
        if (srcLower === 'local') {
          logMatch.$and = logMatch.$and || [];
          logMatch.$and.push({
            $or: [
              { intakeMode: 'local' },
              { notes: { $regex: 'Local', $options: 'i' } },
              { invoiceNo: { $regex: 'LOC', $options: 'i' } }
            ]
          });
        } else if (srcLower === 'dam') {
          logMatch.$and = logMatch.$and || [];
          logMatch.$and.push({
            $or: [
              { intakeMode: 'dam' },
              { notes: { $regex: 'DAM', $options: 'i' } },
              { invoiceNo: { $regex: 'DAM', $options: 'i' } }
            ]
          });
        }
      }

      if (startDate || endDate) {
        const dateCond = {};
        if (startDate) {
          const s = new Date(startDate);
          s.setHours(0, 0, 0, 0);
          dateCond.$gte = s;
        }
        if (endDate) {
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          dateCond.$lte = e;
        }
        logMatch.createdAt = dateCond;
      }

      const matchingLogs = await StockLog.find(logMatch)
        .select('fishItem itemName intakeMode quantityChange createdAt supplierName')
        .lean();

      if (!matchingLogs || matchingLogs.length === 0) {
        return res.status(200).json([]);
      }

      const matchedFishIds = new Set();
      const matchedNames = new Set();
      const intakeSummaryByFish = {};

      matchingLogs.forEach(log => {
        if (log.fishItem) matchedFishIds.add(log.fishItem.toString());
        if (log.itemName) matchedNames.add(log.itemName.trim().toLowerCase());

        const key = log.fishItem ? log.fishItem.toString() : (log.itemName ? log.itemName.trim().toLowerCase() : null);
        if (key) {
          if (!intakeSummaryByFish[key]) {
            intakeSummaryByFish[key] = {
              totalIntakeKg: 0,
              intakeCount: 0,
              lastIntakeDate: log.createdAt,
              lastSupplier: log.supplierName || ''
            };
          }
          intakeSummaryByFish[key].totalIntakeKg += Number(log.quantityChange || 0);
          intakeSummaryByFish[key].intakeCount += 1;
        }
      });

      const orConditions = [];
      if (matchedFishIds.size > 0) {
        orConditions.push({ _id: { $in: Array.from(matchedFishIds) } });
      }
      if (matchedNames.size > 0) {
        orConditions.push({ name: { $in: Array.from(matchedNames).map(n => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) } });
      }

      if (orConditions.length === 0) {
        return res.status(200).json([]);
      }

      baseMenuQuery.$and = baseMenuQuery.$and || [];
      baseMenuQuery.$and.push({ $or: orConditions });

      const fishItems = await Menu.find(baseMenuQuery)
        .select('name scientificName category price boxPrice wholesalePricePerKg exportPricePerKg purchasePrice stock openingStock boxPackingKg boxTareWeightKg boxNetFishKg minStockAlertKg cuts image sizeGrades waterType speciesType nameTranslations description')
        .populate('category', 'name')
        .sort({ name: 1 })
        .lean();

      const enrichedItems = fishItems.map(item => {
        const stats = intakeSummaryByFish[item._id.toString()] || intakeSummaryByFish[item.name.trim().toLowerCase()] || {};
        return {
          ...item,
          periodIntakeKg: stats.totalIntakeKg ? Number(stats.totalIntakeKg.toFixed(2)) : 0,
          periodIntakeCount: stats.intakeCount || 0,
          lastSupplier: stats.lastSupplier || item.lastSupplier || ''
        };
      });

      return res.status(200).json(enrichedItems);
    }

    const fishItems = await Menu.find(baseMenuQuery)
      .select('name scientificName category price boxPrice wholesalePricePerKg exportPricePerKg purchasePrice stock openingStock boxPackingKg boxTareWeightKg boxNetFishKg minStockAlertKg cuts image sizeGrades waterType speciesType nameTranslations description')
      .populate('category', 'name')
      .sort({ name: 1 })
      .lean();

    res.status(200).json(fishItems);
  } catch (error) {
    console.error('[InventoryController] getFishInventory error:', error);
    res.status(500).json({ message: error.message || 'Error fetching fish inventory' });
  }
};

// 16. Local Stock-In (Fishermen / Local Market Catch with Multi-Fish & Box support)
export const recordLocalStockIn = async (req, res) => {
  try {
    const { Menu, StockLog, Supplier } = getModels(req);
    const {
      supplierName,
      supplierPhone,
      companyName = '',
      vehicleNumber = '',
      harbor = '',
      items = [], // Multi-fish intake array
      menuItemId, // Single item fallback
      kg = 0,
      grams = 0,
      boxes = 0,
      kgPerBox = 0,
      ratePerKg = 0,
      sizeBracket = 'Medium',
      weightOption = '1+',
      iceCharges = 0,
      boxTapeCharges = 0,
      advanceAmount = 0,
      settlements = null,
      customSettlements = [],
      paymentMode = 'Cash',
      paymentStatus: clientPaymentStatus,
      paidAmount: clientPaidAmount,
      dueAmount: clientDueAmount,
      partialPaid,
      partialMethod = 'Cash',
      splitPayments = {},
      chequeDetails = {},
      bankDetails = {},
      notes = ''
    } = req.body;

    const intakeItems = Array.isArray(items) && items.length > 0 ? items : [
      {
        menuItemId,
        kg,
        grams,
        boxes,
        kgPerBox,
        ratePerKg,
        sizeBracket,
        weightOption,
        notes
      }
    ];

    const generatedInvoiceNo = req.body.invoiceNo || `GIN-LOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    let totalCredits = 0;
    let totalDebits = 0;
    const settlementSummary = [];

    if (settlements && typeof settlements === 'object') {
      Object.entries(settlements).forEach(([key, s]) => {
        const amt = Number(s?.amount || 0);
        if (amt > 0) {
          settlementSummary.push({ key, label: s.label || key, type: s.type || 'Dr', amount: amt });
          if (s.type === 'Cr') totalCredits += amt;
          else totalDebits += amt;
        }
      });
    }

    if (Array.isArray(customSettlements)) {
      customSettlements.forEach((s, idx) => {
        const amt = Number(s?.amount || 0);
        if (amt > 0) {
          settlementSummary.push({ key: `custom_${idx}`, label: s.label || 'Custom', type: s.type || 'Dr', amount: amt });
          if (s.type === 'Cr') totalCredits += amt;
          else totalDebits += amt;
        }
      });
    }

    let totalGrossKg = 0;
    let totalBaseAmount = 0;
    let totalConsignmentBoxes = 0;
    const updatedFishes = [];

    for (const item of intakeItems) {
      let itemWeightKg = 0;
      const numBoxes = Number(item.boxes || 0);
      const perBoxKg = Number(item.kgPerBox || 0);
      totalConsignmentBoxes += numBoxes;

      if (Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0) {
        itemWeightKg = Number((Number(item.kg || 0) + Number(item.grams || 0) / 1000).toFixed(3));
      } else if (numBoxes > 0 && perBoxKg > 0) {
        itemWeightKg = Number((numBoxes * perBoxKg).toFixed(3));
      }

      if (!item.menuItemId || itemWeightKg <= 0) continue;

      const fishDoc = await Menu.findById(item.menuItemId);
      if (!fishDoc) continue;

      const rate = Number(item.ratePerKg || item.rate || item.purchaseRate || 0);
      const rowBase = Number((itemWeightKg * rate).toFixed(2));
      totalGrossKg += itemWeightKg;
      totalBaseAmount += rowBase;

      const prevStock = Number(fishDoc.stock ?? fishDoc.openingStock ?? 0);
      const newStock = Number((prevStock + itemWeightKg).toFixed(3));
      fishDoc.stock = newStock;
      if (rate > 0) fishDoc.purchasePrice = rate;
      if (supplierName) fishDoc.lastSupplier = supplierName.trim();
      fishDoc.lastProcurementDate = new Date();
      await fishDoc.save();

      const logNotes = `Local Catch (${item.weightOption || '1+'}, ${item.sizeBracket || 'Medium'}): +${itemWeightKg}kg${numBoxes > 0 ? ` (${numBoxes} boxes @ ${perBoxKg}kg/box)` : ''} @ ₹${rate}/kg. Base: ₹${rowBase}.${notes ? ' Note: ' + notes : ''}`;

      await StockLog.create({
        fishItem: fishDoc._id,
        itemName: fishDoc.name,
        type: 'Procurement (Stock-In)',
        quantityChange: itemWeightKg,
        grossKgChange: itemWeightKg,
        finalStock: newStock,
        balanceGrossKg: newStock,
        unit: 'kg',
        invoiceNo: generatedInvoiceNo,
        supplierName: supplierName ? supplierName.trim() : 'Local Fisherman',
        supplierPhone: supplierPhone ? supplierPhone.trim() : '',
        companyName: companyName ? companyName.trim() : '',
        vehicleNumber: vehicleNumber ? vehicleNumber.trim() : '',
        harbor: harbor ? harbor.trim() : '',
        boxes: numBoxes,
        kgPerBox: perBoxKg,
        rate: rate,
        price: rate,
        intakeMode: 'local',
        totalBoxes: totalConsignmentBoxes,
        settlements: settlements || {},
        customSettlements: customSettlements || [],
        consignmentItems: intakeItems,
        notes: logNotes,
        performedBy: req.user?.username || req.user?.name || 'Local Incharge',
        createdAt: new Date()
      });

      emitSocketEvent(req, 'fishStockUpdated', {
        menuItemId: fishDoc._id,
        name: fishDoc.name,
        previousStock: prevStock,
        newStock,
        grossAdded: itemWeightKg
      });

      updatedFishes.push({ name: fishDoc.name, addedKg: itemWeightKg, newStock });
    }

    if (totalGrossKg <= 0) {
      return res.status(400).json({ message: 'Please select a fish variety and enter valid weight or boxes' });
    }

    let netPayable;
    let subtotal;
    if (settlementSummary.length > 0 || settlements) {
      subtotal = totalBaseAmount;
      netPayable = Number((totalBaseAmount + totalCredits - totalDebits).toFixed(2));
    } else {
      subtotal = Number((totalBaseAmount - Number(iceCharges || 0) + Number(boxTapeCharges || 0)).toFixed(2));
      netPayable = Number((subtotal - Number(advanceAmount || 0)).toFixed(2));
    }

    // Calculate Payment Details & Balance Dues
    const mode = paymentMode || 'Cash';
    let computedPaymentStatus = 'Paid';
    let computedPaidAmount = 0;
    let computedDueAmount = 0;

    if (mode === 'Unpaid' || mode === 'Credit') {
      computedPaymentStatus = 'Unpaid';
      computedPaidAmount = 0;
      computedDueAmount = Math.max(0, netPayable);
    } else if (mode === 'Partial') {
      const pPaid = clientPaidAmount !== undefined ? Number(clientPaidAmount) : (partialPaid !== undefined ? Number(partialPaid) : 0);
      computedPaidAmount = Math.min(netPayable, Math.max(0, pPaid));
      computedDueAmount = Math.max(0, Number((netPayable - computedPaidAmount).toFixed(2)));
      computedPaymentStatus = computedDueAmount > 0 ? (computedPaidAmount > 0 ? 'Partially Paid' : 'Unpaid') : 'Paid';
    } else if (mode === 'Mixed') {
      const sp = splitPayments || {};
      const mixedSum = Number((Number(sp.cash || 0) + Number(sp.upi || 0) + Number(sp.bank || 0) + Number(sp.cheque || 0) + Number(sp.card || 0)).toFixed(2));
      computedPaidAmount = mixedSum;
      computedDueAmount = Math.max(0, Number((netPayable - computedPaidAmount).toFixed(2)));
      computedPaymentStatus = computedDueAmount > 0 ? 'Partially Paid' : 'Paid';
    } else {
      // Full payment (Cash, UPI, Bank Transfer, Cheque)
      computedPaymentStatus = 'Paid';
      computedPaidAmount = netPayable;
      computedDueAmount = 0;
    }

    // Update netPayable, grossValue & payment details on created logs
    await StockLog.updateMany(
      { invoiceNo: generatedInvoiceNo },
      {
        grossValue: totalBaseAmount,
        netPayable: netPayable,
        totalCr: totalCredits,
        totalDr: totalDebits,
        totalBoxes: totalConsignmentBoxes,
        paymentMode: mode,
        paymentStatus: computedPaymentStatus,
        paidAmount: computedPaidAmount,
        dueAmount: computedDueAmount,
        paymentBreakdown: splitPayments || {},
        chequeDetails: chequeDetails || {},
        bankDetails: bankDetails || {}
      }
    );

    // Update Supplier Balance in Khata (SRM) if dueAmount > 0
    if (supplierName && supplierName.trim() && computedDueAmount > 0) {
      try {
        const cleanName = supplierName.trim();
        const suppRegex = new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        let supplierDoc = await Supplier.findOne({
          $or: [
            { name: suppRegex },
            { companyName: suppRegex },
            ...(supplierPhone ? [{ phone: supplierPhone.trim() }] : [])
          ]
        });

        if (!supplierDoc && mongoose.connection.readyState === 1) {
          const fallbackDb = mongoose.connection.useDb('fishes', { useCache: true });
          const FallbackSupplier = fallbackDb.model('Supplier', SupplierDefault.schema);
          supplierDoc = await FallbackSupplier.findOne({
            $or: [
              { name: suppRegex },
              { companyName: suppRegex },
              ...(supplierPhone ? [{ phone: supplierPhone.trim() }] : [])
            ]
          });
        }

        if (supplierDoc) {
          supplierDoc.balance = Number(((Number(supplierDoc.balance) || 0) + computedDueAmount).toFixed(2));
          const auditNote = `[${new Date().toLocaleDateString('en-IN')}] Local Catch #${generatedInvoiceNo}: Net ₹${netPayable}, Paid ₹${computedPaidAmount} (${mode}), Due ₹${computedDueAmount} added to Khata.`;
          supplierDoc.notes = supplierDoc.notes ? `${supplierDoc.notes}\n${auditNote}` : auditNote;
          await supplierDoc.save();
        }
      } catch (suppErr) {
        console.error('[InventoryController] Error updating supplier balance:', suppErr);
      }
    }

    res.status(200).json({
      success: true,
      message: `Local Catch recorded: ${updatedFishes.length} varieties, +${totalGrossKg.toFixed(2)}kg (Net ₹${netPayable})`,
      updatedFishes,
      calculation: {
        totalGrossKg: Number(totalGrossKg.toFixed(3)),
        totalBaseAmount: Number(totalBaseAmount.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        totalDebits: Number(totalDebits.toFixed(2)),
        subtotal,
        netPayable
      }
    });
  } catch (error) {
    console.error('[InventoryController] Local Stock-In error:', error);
    res.status(500).json({ message: error.message || 'Error recording local stock-in' });
  }
};

// 17. DAM Consignment Stock-In (Multi-Fish Consignment & Settlements)
export const recordDamStockIn = async (req, res) => {
  try {
    const { Menu, StockLog, Supplier } = getModels(req);
    const {
      contractorId,
      contractorName,
      contractorPhone,
      companyName = '',
      vehicleNumber = '',
      harbor = '',
      tallyItems = [],
      settlements = {
        advance: { type: 'Dr', amount: 0 },
        khata: { type: 'Dr', amount: 0 },
        od: { type: 'Dr', amount: 0 },
        expense: { type: 'Dr', amount: 0 },
        festivalExpense: { type: 'Dr', amount: 0 }
      },
      paymentMode = 'Cash',
      paymentStatus: clientPaymentStatus,
      paidAmount: clientPaidAmount,
      dueAmount: clientDueAmount,
      partialPaid,
      partialMethod = 'Cash',
      splitPayments = {},
      chequeDetails = {},
      bankDetails = {},
      notes = ''
    } = req.body;

    if (!Array.isArray(tallyItems) || tallyItems.length === 0) {
      return res.status(400).json({ message: 'At least one fish variety is required for DAM Stock-In' });
    }

    const generatedInvoiceNo = req.body.invoiceNo || `GIN-DAM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    let totalGrossKg = 0;
    let catchTotalValue = 0;
    let totalConsignmentBoxes = 0;
    const updatedFishes = [];

    // Pre-calculate settlement totals
    let totalCredits = 0;
    let totalDebits = 0;
    const settlementDetails = {};

    if (settlements && typeof settlements === 'object') {
      Object.entries(settlements).forEach(([key, entry]) => {
        const amt = Number(entry?.amount || 0);
        const type = entry?.type || 'Dr';
        settlementDetails[key] = { label: entry?.label || key, type, amount: amt };
        if (type === 'Cr') {
          totalCredits += amt;
        } else {
          totalDebits += amt;
        }
      });
    }

    if (Array.isArray(req.body.customSettlements)) {
      req.body.customSettlements.forEach((entry, idx) => {
        const amt = Number(entry?.amount || 0);
        const type = entry?.type || 'Dr';
        const key = `custom_${idx}_${(entry?.label || 'item').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        settlementDetails[key] = { label: entry?.label || 'Custom', type, amount: amt };
        if (type === 'Cr') {
          totalCredits += amt;
        } else {
          totalDebits += amt;
        }
      });
    }

    for (const item of tallyItems) {
      let itemKg = 0;
      const numBoxes = Number(item.boxes || 0);
      const perBoxKg = Number(item.kgPerBox || 0);
      totalConsignmentBoxes += numBoxes;

      if (Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0) {
        itemKg = Number((Number(item.kg || 0) + Number(item.grams || 0) / 1000).toFixed(3));
      } else if (numBoxes > 0 && perBoxKg > 0) {
        itemKg = Number((numBoxes * perBoxKg).toFixed(3));
      }

      if (itemKg <= 0) continue;

      const rate = Number(item.price || item.rate || 0);
      const rowTotal = Number((itemKg * rate).toFixed(2));
      totalGrossKg += itemKg;
      catchTotalValue += rowTotal;

      let fishDoc = null;
      if (item.menuItemId && mongoose.Types.ObjectId.isValid(item.menuItemId)) {
        fishDoc = await Menu.findById(item.menuItemId);
      } else if (item.itemName) {
        fishDoc = await Menu.findOne({ name: new RegExp('^' + item.itemName.trim() + '$', 'i') });
      }

      if (fishDoc) {
        const prevStock = Number(fishDoc.stock ?? fishDoc.openingStock ?? 0);
        const newStock = Number((prevStock + itemKg).toFixed(3));
        fishDoc.stock = newStock;
        if (rate > 0) fishDoc.purchasePrice = rate;
        fishDoc.lastSupplier = contractorName ? contractorName.trim() : 'DAM Contractor';
        fishDoc.lastProcurementDate = new Date();
        await fishDoc.save();

        await StockLog.create({
          fishItem: fishDoc._id,
          itemName: fishDoc.name,
          type: 'Procurement (Stock-In)',
          quantityChange: itemKg,
          grossKgChange: itemKg,
          finalStock: newStock,
          balanceGrossKg: newStock,
          unit: 'kg',
          invoiceNo: generatedInvoiceNo,
          supplierName: contractorName ? contractorName.trim() : 'DAM Contractor',
          supplierPhone: contractorPhone ? contractorPhone.trim() : '',
          companyName: companyName ? companyName.trim() : '',
          vehicleNumber: vehicleNumber ? vehicleNumber.trim() : '',
          harbor: harbor ? harbor.trim() : '',
          boxes: numBoxes,
          kgPerBox: perBoxKg,
          rate: rate,
          price: rate,
          intakeMode: 'dam',
          totalBoxes: totalConsignmentBoxes,
          settlements: settlements,
          customSettlements: req.body.customSettlements || [],
          consignmentItems: tallyItems,
          notes: `DAM Catch: +${itemKg}kg${numBoxes > 0 ? ` (${numBoxes} boxes @ ${perBoxKg}kg/box)` : ''} @ ₹${rate}/kg. Total: ₹${rowTotal} (Contractor: ${contractorName || 'DAM Syndicate'})`,
          performedBy: req.user?.username || req.user?.name || 'Dam Incharge',
          createdAt: new Date()
        });

        emitSocketEvent(req, 'fishStockUpdated', {
          menuItemId: fishDoc._id,
          name: fishDoc.name,
          previousStock: prevStock,
          newStock,
          grossAdded: itemKg
        });

        updatedFishes.push({ name: fishDoc.name, addedKg: itemKg, newStock });
      }
    }

    if (totalGrossKg <= 0) {
      return res.status(400).json({ message: 'Please enter valid weight or box details for at least one fish variety' });
    }

    const netConsignmentSettlement = Number((catchTotalValue + totalCredits - totalDebits).toFixed(2));

    // Calculate Payment Details & Balance Dues
    const mode = paymentMode || 'Cash';
    let computedPaymentStatus = 'Paid';
    let computedPaidAmount = 0;
    let computedDueAmount = 0;

    if (mode === 'Unpaid' || mode === 'Credit') {
      computedPaymentStatus = 'Unpaid';
      computedPaidAmount = 0;
      computedDueAmount = Math.max(0, netConsignmentSettlement);
    } else if (mode === 'Partial') {
      const pPaid = clientPaidAmount !== undefined ? Number(clientPaidAmount) : (partialPaid !== undefined ? Number(partialPaid) : 0);
      computedPaidAmount = Math.min(netConsignmentSettlement, Math.max(0, pPaid));
      computedDueAmount = Math.max(0, Number((netConsignmentSettlement - computedPaidAmount).toFixed(2)));
      computedPaymentStatus = computedDueAmount > 0 ? (computedPaidAmount > 0 ? 'Partially Paid' : 'Unpaid') : 'Paid';
    } else if (mode === 'Mixed') {
      const sp = splitPayments || {};
      const mixedSum = Number((Number(sp.cash || 0) + Number(sp.upi || 0) + Number(sp.bank || 0) + Number(sp.cheque || 0) + Number(sp.card || 0)).toFixed(2));
      computedPaidAmount = mixedSum;
      computedDueAmount = Math.max(0, Number((netConsignmentSettlement - computedPaidAmount).toFixed(2)));
      computedPaymentStatus = computedDueAmount > 0 ? 'Partially Paid' : 'Paid';
    } else {
      // Full payment (Cash, UPI, Bank Transfer, Cheque)
      computedPaymentStatus = 'Paid';
      computedPaidAmount = netConsignmentSettlement;
      computedDueAmount = 0;
    }

    // Update netPayable, grossValue & payment details on created logs
    await StockLog.updateMany(
      { invoiceNo: generatedInvoiceNo },
      {
        grossValue: catchTotalValue,
        netPayable: netConsignmentSettlement,
        totalCr: totalCredits,
        totalDr: totalDebits,
        totalBoxes: totalConsignmentBoxes,
        paymentMode: mode,
        paymentStatus: computedPaymentStatus,
        paidAmount: computedPaidAmount,
        dueAmount: computedDueAmount,
        paymentBreakdown: splitPayments || {},
        chequeDetails: chequeDetails || {},
        bankDetails: bankDetails || {}
      }
    );

    // Update Contractor Balance in Khata (SRM) if dueAmount > 0
    const suppName = contractorName || companyName;
    if (suppName && suppName.trim() && computedDueAmount > 0) {
      try {
        const cleanName = suppName.trim();
        const suppRegex = new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        let supplierDoc = await Supplier.findOne({
          $or: [
            { name: suppRegex },
            { companyName: suppRegex },
            ...(contractorPhone ? [{ phone: contractorPhone.trim() }] : [])
          ]
        });

        if (!supplierDoc && mongoose.connection.readyState === 1) {
          const fallbackDb = mongoose.connection.useDb('fishes', { useCache: true });
          const FallbackSupplier = fallbackDb.model('Supplier', SupplierDefault.schema);
          supplierDoc = await FallbackSupplier.findOne({
            $or: [
              { name: suppRegex },
              { companyName: suppRegex },
              ...(contractorPhone ? [{ phone: contractorPhone.trim() }] : [])
            ]
          });
        }

        if (supplierDoc) {
          supplierDoc.balance = Number(((Number(supplierDoc.balance) || 0) + computedDueAmount).toFixed(2));
          const auditNote = `[${new Date().toLocaleDateString('en-IN')}] DAM Catch #${generatedInvoiceNo}: Net ₹${netConsignmentSettlement}, Paid ₹${computedPaidAmount} (${mode}), Due ₹${computedDueAmount} added to Khata.`;
          supplierDoc.notes = supplierDoc.notes ? `${supplierDoc.notes}\n${auditNote}` : auditNote;
          await supplierDoc.save();
        }
      } catch (suppErr) {
        console.error('[InventoryController] Error updating DAM contractor balance:', suppErr);
      }
    }

    res.status(200).json({
      success: true,
      message: `DAM Catch registered: ${totalGrossKg.toFixed(2)} Kg across ${updatedFishes.length} varieties. Net Settlement: ₹${netConsignmentSettlement}`,
      consignmentSummary: {
        contractorName: contractorName || 'DAM Contractor',
        contractorPhone: contractorPhone || '',
        companyName,
        vehicleNumber,
        harbor,
        totalGrossKg: Number(totalGrossKg.toFixed(3)),
        catchTotalValue: Number(catchTotalValue.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        totalDebits: Number(totalDebits.toFixed(2)),
        netConsignmentSettlement,
        settlementDetails,
        updatedFishes
      }
    });
  } catch (error) {
    console.error('[InventoryController] DAM Stock-In error:', error);
    res.status(500).json({ message: error.message || 'Error recording DAM stock-in' });
  }
};
