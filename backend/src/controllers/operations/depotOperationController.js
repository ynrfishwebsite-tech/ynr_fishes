import mongoose from 'mongoose';
import DepotOperationDefault from '../../models/operations/DepotOperation.js';
import SupplierDefault from '../../models/operations/Supplier.js';
import VehicleDefault from '../../models/operations/Vehicle.js';
import BillDefault from '../../models/billing/Bill.js';
import ExpenseDefault from '../../models/finance/Expense.js';
import StockLogDefault from '../../models/inventory/StockLog.js';
import { getTenantModel } from '../../utils/database/tenantHelper.js';
import { resolveISTDateRange } from '../../utils/helpers/timezoneHelper.js';

// Get Operations Summary for Frontpage Dashboard
export const getOperationsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Resolve dynamic tenant models with safe fallback to active depot DB 'kdp'
    let StockLog = getTenantModel(req, 'StockLog', StockLogDefault);
    let DepotOperation = getTenantModel(req, 'DepotOperation', DepotOperationDefault);
    let Bill = getTenantModel(req, 'Bill', BillDefault);
    let Expense = getTenantModel(req, 'Expense', ExpenseDefault);

    if (mongoose.connection.readyState === 1) {
      try {
        const targetDbName = req.tenantDb && req.tenantDb !== 'fishes' ? req.tenantDb : 'kdp';
        const tenantDb = mongoose.connection.useDb(targetDbName, { useCache: true });
        StockLog = tenantDb.model('StockLog', StockLogDefault.schema);
        DepotOperation = tenantDb.model('DepotOperation', DepotOperationDefault.schema);
        Bill = tenantDb.model('Bill', BillDefault.schema);
        Expense = tenantDb.model('Expense', ExpenseDefault.schema);
      } catch (err) {
        console.warn('[DepotOperations] Fallback useDb error:', err.message);
      }
    }

    // Always use strict Indian Standard Time (IST, UTC+5:30) date boundaries
    const { startDate: start, endDate: end } = resolveISTDateRange(startDate, endDate);

    const opMatch = {
      $or: [
        { date: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } }
      ]
    };

    // Fetch aggregate operations
    const opAgg = await DepotOperation.aggregate([
      { $match: opMatch },
      {
        $group: {
          _id: '$operationType',
          totalAmount: { $sum: '$totalAmount' },
          totalNetKg: { $sum: '$netWeightKg' },
          totalGrossKg: { $sum: '$grossWeightKg' },
          totalBoxes: { $sum: '$boxesCount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summaryMap = {};
    opAgg.forEach(item => {
      summaryMap[item._id] = item;
    });

    // 1. Sync live Import (Harbor / DAM Consignment) & Purchase (Local / Farm) directly from StockLog model
    const allProcurementLogs = await StockLog.find({
      type: { $regex: 'Procurement|Stock-In|Inward', $options: 'i' }
    }).lean();

    // Support both explicit timestamps and ObjectId-derived timestamps
    const stockLogs = allProcurementLogs.filter(log => {
      const logDate = log.createdAt ? new Date(log.createdAt) : (log.date ? new Date(log.date) : (log._id ? new Date(parseInt(String(log._id).substring(0, 8), 16) * 1000) : null));
      if (!logDate) return false;
      return logDate >= start && logDate <= end;
    });

    let damImportKg = 0;
    let damImportAmount = 0;
    let damImportBoxes = 0;
    const damSuppliers = new Set();
    const damLots = new Set();

    let harborImportKg = 0;
    let harborImportAmount = 0;
    let harborImportBoxes = 0;
    const harborSuppliers = new Set();
    const harborLots = new Set();

    let localPurchaseKg = 0;
    let localPurchaseAmount = 0;
    let localPurchaseBoxes = 0;
    const localSuppliers = new Set();
    const localLots = new Set();

    stockLogs.forEach(log => {
      const kg = Math.abs(Number(log.quantityChange || 0));
      const boxes = Number(log.boxes || 0);
      let amount = 0;

      if (Number(log.price || log.rate || 0) > 0) {
        amount = Number((kg * Number(log.price || log.rate)).toFixed(2));
      } else if (log.notes) {
        const totalMatch = log.notes.match(/Total:\s*₹?\s*([0-9.]+)/i);
        const rateMatch = log.notes.match(/@\s*₹?\s*([0-9.]+)\/kg/i);
        if (totalMatch && totalMatch[1]) {
          amount = Number(totalMatch[1]);
        } else if (rateMatch && rateMatch[1]) {
          amount = Number((kg * Number(rateMatch[1])).toFixed(2));
        }
      }

      const logText = `${log.notes || ''} ${log.harbor || ''} ${log.supplierName || ''} ${log.intakeMode || ''}`.toLowerCase();
      const isLocalCatch = log.intakeMode === 'local' || logText.includes('local catch') || logText.includes('farm');
      const isDamCatch = logText.includes('dam');
      const lotKey = log.invoiceNo || (log.supplierName ? `${log.supplierName}_${new Date(log.createdAt || log.date || Date.now()).toISOString().slice(0, 16)}` : String(log._id));
      const suppName = log.supplierName || (log.notes?.match(/from\s+([^,()]+)/i)?.[1]?.trim()) || '';

      if (isLocalCatch) {
        localPurchaseKg += kg;
        localPurchaseAmount += amount;
        localPurchaseBoxes += boxes;
        if (suppName) localSuppliers.add(suppName);
        localLots.add(lotKey);
      } else if (isDamCatch) {
        damImportKg += kg;
        damImportAmount += amount;
        damImportBoxes += boxes;
        if (suppName) damSuppliers.add(suppName);
        damLots.add(lotKey);
      } else {
        harborImportKg += kg;
        harborImportAmount += amount;
        harborImportBoxes += boxes;
        if (suppName) harborSuppliers.add(suppName);
        harborLots.add(lotKey);
      }
    });

    const totalInwardAmount = damImportAmount + harborImportAmount + localPurchaseAmount;
    const totalInwardKg = damImportKg + harborImportKg + localPurchaseKg;
    const totalInwardBoxes = damImportBoxes + harborImportBoxes + localPurchaseBoxes;
    const totalInwardLots = damLots.size + harborLots.size + localLots.size;
    const allSuppliers = Array.from(new Set([...damSuppliers, ...harborSuppliers, ...localSuppliers])).filter(Boolean);

    // 2. Strict Segregation: Live Sales (Retail POS Only) vs Export (Wholesale Box Dispatches Only)
    const billMatch = {
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { clearedAt: { $gte: start, $lte: end } },
        { billedAt: { $gte: start, $lte: end } }
      ],
      status: { $in: ['Paid', 'Unpaid', 'Billed'] }
    };
    const bills = await Bill.find(billMatch).lean();

    let retailSalesAmount = 0;
    let retailSalesInvoices = 0;
    let retailSalesBoxes = 0;
    let retailSalesNetKg = 0;

    let wholesaleExportAmount = 0;
    let wholesaleExportBoxes = 0;
    let wholesaleExportNetKg = 0;
    let wholesaleExportBills = 0;

    bills.forEach(b => {
      const bTotal = Number(b.total || 0);
      const bBoxes = Number(b.totalBoxes || (b.boxes?.length) || 0);
      let bNetKg = 0;
      (b.items || []).forEach(it => {
        bNetKg += Number(it.netWeightKg || it.enteredWeight || it.weightKg || (it.boxes?.length ? it.boxes.reduce((s, bx) => s + (bx.totalWeightKg || 0), 0) : 0) || (it.sellingUnit === 'Kg' ? it.quantity : 0) || 0);
      });

      // Strict categorization: Wholesale/Export bills vs Retail bills
      const isWholesale = (b.billNumber && /^WS-/i.test(b.billNumber)) ||
                          (b.orderChannel && /Wholesale|Export/i.test(b.orderChannel)) ||
                          b.customerCategory === 'Wholesale';

      if (isWholesale) {
        wholesaleExportAmount += bTotal;
        wholesaleExportBoxes += bBoxes;
        wholesaleExportNetKg += bNetKg;
        wholesaleExportBills += 1;
      } else {
        retailSalesAmount += bTotal;
        retailSalesInvoices += 1;
        retailSalesBoxes += bBoxes;
        retailSalesNetKg += bNetKg;
      }
    });

    // 3. Sync live Expenses & Vehicle/Fleet directly from Expense model & DepotOperation
    const expMatch = {
      $or: [
        { date: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } }
      ]
    };

    let allExpenses = [];
    try {
      const tenantExps = await Expense.find(expMatch).lean();
      allExpenses.push(...tenantExps);
    } catch (_) {}

    // Include primary database expenses (fishes) if recorded there (de-duplicated by _id)
    try {
      if (mongoose.connection.readyState === 1) {
        const primaryDb = mongoose.connection.useDb('fishes', { useCache: true });
        const PrimaryExpense = primaryDb.model('Expense', ExpenseDefault.schema);
        const primaryExps = await PrimaryExpense.find(expMatch).lean();
        const seenIds = new Set(allExpenses.map(e => String(e._id)));
        for (const pe of primaryExps) {
          if (!seenIds.has(String(pe._id))) {
            allExpenses.push(pe);
          }
        }
      }
    } catch (_) {}

    let generalOpExAmount = 0;
    let generalOpExCount = 0;
    let vehicleExpenseAmount = 0;
    let vehicleExpenseCount = 0;

    const isVehicleExpense = (e) => {
      const text = `${e.category || ''} ${e.description || ''} ${e.title || ''}`.toLowerCase();
      const vehicleRegex = /fuel|diesel|petrol|transport|vehicle|fleet|driver|toll|fastag|mileage|mechanic|truck|tempo|auto|lorry|[a-z]{2}\s*\d{2}\s*[a-z]{1,2}\s*\d{4}/i;
      return vehicleRegex.test(text);
    };

    allExpenses.forEach(e => {
      const amt = Number(e.amount || 0);
      if (isVehicleExpense(e)) {
        vehicleExpenseAmount += amt;
        vehicleExpenseCount += 1;
      } else {
        generalOpExAmount += amt;
        generalOpExCount += 1;
      }
    });

    const firstGeneral = allExpenses.find(e => !isVehicleExpense(e));
    const firstVehicle = allExpenses.find(isVehicleExpense);

    const getFactor = (type) => summaryMap[type] || { totalAmount: 0, totalNetKg: 0, totalBoxes: 0, count: 0 };

    res.status(200).json({
      success: true,
      data: {
        import: {
          totalAmount: Number((getFactor('Import').totalAmount + totalInwardAmount).toFixed(2)),
          totalNetKg: Number((getFactor('Import').totalNetKg + totalInwardKg).toFixed(1)),
          totalBoxes: getFactor('Import').totalBoxes + totalInwardBoxes,
          count: getFactor('Import').count + totalInwardLots,
          damKg: Number(damImportKg.toFixed(1)),
          damAmount: Number(damImportAmount.toFixed(2)),
          damBoxes: damImportBoxes,
          harborKg: Number(harborImportKg.toFixed(1)),
          harborAmount: Number(harborImportAmount.toFixed(2)),
          harborBoxes: harborImportBoxes,
          localKg: Number(localPurchaseKg.toFixed(1)),
          localAmount: Number(localPurchaseAmount.toFixed(2)),
          localBoxes: localPurchaseBoxes,
          suppliersCount: allSuppliers.length,
          supplierNames: allSuppliers
        },
        export: {
          totalAmount: Number((getFactor('Export').totalAmount + wholesaleExportAmount).toFixed(2)),
          totalNetKg: Number((getFactor('Export').totalNetKg + wholesaleExportNetKg).toFixed(1)),
          totalBoxes: getFactor('Export').totalBoxes + wholesaleExportBoxes,
          totalBills: wholesaleExportBills,
          count: getFactor('Export').count + wholesaleExportBills
        },
        sales: {
          totalAmount: Number(((summaryMap['Sales']?.totalAmount || 0) + retailSalesAmount).toFixed(2)),
          totalNetKg: Number(((summaryMap['Sales']?.totalNetKg || 0) + retailSalesNetKg).toFixed(1)),
          totalInvoices: (summaryMap['Sales']?.count || 0) + retailSalesInvoices,
          totalBoxes: (summaryMap['Sales']?.totalBoxes || 0) + retailSalesBoxes
        },
        expenses: {
          totalAmount: Number(((summaryMap['Expenses']?.totalAmount || 0) + generalOpExAmount).toFixed(2)),
          count: (summaryMap['Expenses']?.count || 0) + generalOpExCount,
          subLabel: firstGeneral ? (firstGeneral.category || firstGeneral.description || 'Salary & OpEx') : 'Ice / Labor / Stall'
        },
        purchase: {
          totalAmount: Number((getFactor('Purchase').totalAmount + localPurchaseAmount).toFixed(2)),
          totalNetKg: Number((getFactor('Purchase').totalNetKg + localPurchaseKg).toFixed(1)),
          totalBoxes: getFactor('Purchase').totalBoxes + localPurchaseBoxes,
          count: getFactor('Purchase').count + localLots.size,
          suppliersCount: localSuppliers.size,
          supplierNames: Array.from(localSuppliers)
        },
        purchaseReturn: {
          totalAmount: getFactor('Purchase Return').totalAmount,
          totalNetKg: getFactor('Purchase Return').totalNetKg,
          count: getFactor('Purchase Return').count
        },
        salesReturn: {
          totalAmount: getFactor('Sales Return').totalAmount,
          totalNetKg: getFactor('Sales Return').totalNetKg,
          count: getFactor('Sales Return').count
        },
        vehicleOthers: {
          totalAmount: Number(((summaryMap['Vehicle / Others']?.totalAmount || 0) + vehicleExpenseAmount).toFixed(2)),
          count: (summaryMap['Vehicle / Others']?.count || 0) + vehicleExpenseCount,
          subLabel: firstVehicle ? (firstVehicle.description?.match(/[A-Z]{2}\s*\d{2}\s*[A-Z]{1,2}\s*\d{4}/i)?.[0] || 'Fleet Fuel & Diesel') : 'Diesel & Transport'
        }
      }
    });
  } catch (error) {
    console.error('getOperationsSummary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to resolve Tenant-aware Supplier and Vehicle models
const getSupplierModel = (req) => {
  let Supplier = getTenantModel(req, 'Supplier', SupplierDefault);
  if (mongoose.connection.readyState === 1) {
    try {
      const targetDbName = req.tenantDb && req.tenantDb !== 'fishes' ? req.tenantDb : 'kdp';
      const tenantDb = mongoose.connection.useDb(targetDbName, { useCache: true });
      Supplier = tenantDb.model('Supplier', SupplierDefault.schema);
    } catch (err) {
      console.warn('[Supplier] useDb error:', err.message);
    }
  }
  return Supplier;
};

const getVehicleModel = (req) => {
  let Vehicle = getTenantModel(req, 'Vehicle', VehicleDefault);
  if (mongoose.connection.readyState === 1) {
    try {
      const targetDbName = req.tenantDb && req.tenantDb !== 'fishes' ? req.tenantDb : 'kdp';
      const tenantDb = mongoose.connection.useDb(targetDbName, { useCache: true });
      Vehicle = tenantDb.model('Vehicle', VehicleDefault.schema);
    } catch (err) {
      console.warn('[Vehicle] useDb error:', err.message);
    }
  }
  return Vehicle;
};

// Suppliers CRUD with Strict Deduplication Enforcement
export const getSuppliers = async (req, res) => {
  try {
    const Supplier = getSupplierModel(req);
    const { search = '', type = '' } = req.query;
    const filter = { status: 'Active' };

    if (type && type !== 'All') {
      filter.$or = [{ supplierType: type }, { supplierType: 'All' }];
    }

    if (search.trim()) {
      const s = search.trim();
      const searchConditions = [
        { name: { $regex: s, $options: 'i' } },
        { companyName: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { harbor: { $regex: s, $options: 'i' } },
        { vehicleNumber: { $regex: s, $options: 'i' } },
        { city: { $regex: s, $options: 'i' } }
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    let suppliers = await Supplier.find(filter).sort({ name: 1 }).limit(300);

    // Fallback: If 0 suppliers in tenant DB, check fishes master DB
    if ((!suppliers || suppliers.length === 0) && mongoose.connection.readyState === 1) {
      try {
        const fallbackDb = mongoose.connection.useDb('fishes', { useCache: true });
        const FallbackSupplier = fallbackDb.model('Supplier', SupplierDefault.schema);
        const fallbackList = await FallbackSupplier.find(filter).sort({ name: 1 }).limit(300);
        if (fallbackList && fallbackList.length > 0) {
          suppliers = fallbackList;
        }
      } catch (fbErr) {
        // Ignore fallback error
      }
    }

    // In-memory deduplication by trimmed, lowercased name to ensure clean UI lists
    const seen = new Set();
    const uniqueSuppliers = [];
    for (const s of suppliers) {
      const key = (s.name || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueSuppliers.push(s);
      }
    }

    const pageNum = parseInt(req.query.page);
    const limitNum = parseInt(req.query.limit);
    if (pageNum && limitNum) {
      const skip = (pageNum - 1) * limitNum;
      const paginated = uniqueSuppliers.slice(skip, skip + limitNum);
      return res.status(200).json({
        success: true,
        data: paginated,
        total: uniqueSuppliers.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(uniqueSuppliers.length / limitNum) || 1
      });
    }

    res.status(200).json({ success: true, data: uniqueSuppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const Supplier = getSupplierModel(req);
    const {
      profileImage = '',
      name,
      companyName = '',
      phone,
      supplierType = 'Local',
      vehicleNumber = '',
      harbor = '',
      city = '',
      address = '',
      contactPerson = '',
      bankDetails = {},
      notes = ''
    } = req.body;

    const cleanName = name ? name.trim() : '';
    const cleanPhone = phone ? phone.trim() : '';

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    // Strict duplicate check: match existing supplier by exact case-insensitive name or phone
    const escapedName = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = {
      $or: [
        { name: { $regex: new RegExp(`^${escapedName}$`, 'i') } }
      ]
    };
    if (cleanPhone) {
      query.$or.push({ phone: cleanPhone });
    }

    let existing = await Supplier.findOne(query);
    if (existing) {
      // Update any missing details without creating a duplicate record
      let updated = false;
      if (profileImage && !existing.profileImage) { existing.profileImage = profileImage; updated = true; }
      if (companyName && !existing.companyName) { existing.companyName = companyName.trim(); updated = true; }
      if (!existing.phone && cleanPhone) { existing.phone = cleanPhone; updated = true; }
      if (vehicleNumber && !existing.vehicleNumber) { existing.vehicleNumber = vehicleNumber.trim(); updated = true; }
      if (!existing.harbor && harbor) { existing.harbor = harbor.trim(); updated = true; }
      if (!existing.city && city) { existing.city = city.trim(); updated = true; }
      if (!existing.address && address) { existing.address = address.trim(); updated = true; }
      if (!existing.contactPerson && contactPerson) { existing.contactPerson = contactPerson.trim(); updated = true; }
      if (supplierType && existing.supplierType !== supplierType) { existing.supplierType = supplierType; updated = true; }
      if (notes && !existing.notes) { existing.notes = notes.trim(); updated = true; }
      if (bankDetails && typeof bankDetails === 'object') {
        existing.bankDetails = { ...existing.bankDetails, ...bankDetails };
        updated = true;
      }
      if (updated) await existing.save();

      return res.status(200).json({
        success: true,
        data: existing,
        message: 'Existing supplier updated (duplicate prevented)'
      });
    }

    const supplier = await Supplier.create({
      profileImage,
      name: cleanName,
      companyName: companyName ? companyName.trim() : '',
      phone: cleanPhone,
      supplierType: supplierType || 'Local',
      vehicleNumber: vehicleNumber ? vehicleNumber.trim() : '',
      harbor: harbor ? harbor.trim() : '',
      city: city ? city.trim() : '',
      address: address ? address.trim() : '',
      contactPerson: contactPerson ? contactPerson.trim() : '',
      bankDetails: bankDetails || {},
      notes: notes ? notes.trim() : ''
    });

    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const Supplier = getSupplierModel(req);
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.name) updateData.name = updateData.name.trim();
    if (updateData.phone) updateData.phone = updateData.phone.trim();
    if (updateData.companyName) updateData.companyName = updateData.companyName.trim();
    if (updateData.vehicleNumber) updateData.vehicleNumber = updateData.vehicleNumber.trim();
    if (updateData.harbor) updateData.harbor = updateData.harbor.trim();
    if (updateData.address) updateData.address = updateData.address.trim();

    const updated = await Supplier.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json({ success: true, data: updated, message: 'Supplier updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const Supplier = getSupplierModel(req);
    const Vehicle = getVehicleModel(req);
    const { id } = req.params;
    const updated = await Supplier.findByIdAndUpdate(id, { status: 'Inactive' }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Automatically release and unlink any vehicles assigned to this supplier
    await Vehicle.updateMany(
      { $or: [{ assignedSupplierId: id }, { assignedSupplierName: updated.name }] },
      { $set: { assignedSupplierId: null, assignedSupplierName: '' } }
    );

    res.status(200).json({ success: true, message: 'Supplier set to inactive and attached vehicles released successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
