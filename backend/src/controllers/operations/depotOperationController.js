import DepotOperation from '../../models/operations/DepotOperation.js';
import Supplier from '../../models/operations/Supplier.js';
import Bill from '../../models/billing/Bill.js';
import Expense from '../../models/finance/Expense.js';

// Get Operations Summary for Frontpage Dashboard
export const getOperationsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Default to Today in local day boundary
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const opMatch = { date: { $gte: start, $lte: end } };

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

    // Sync live Sales directly from Bill model
    const billMatch = {
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['Paid', 'Unpaid', 'Billed'] }
    };
    const billAgg = await Bill.aggregate([
      { $match: billMatch },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$total' },
          totalInvoices: { $sum: 1 },
          totalBoxes: { $sum: { $ifNull: ['$totalBoxes', 0] } }
        }
      }
    ]);
    const billStats = billAgg[0] || { totalSales: 0, totalInvoices: 0, totalBoxes: 0 };

    // Sync live Expenses directly from Expense model
    const expMatch = { date: { $gte: start, $lte: end } };
    const expAgg = await Expense.aggregate([
      { $match: expMatch },
      {
        $group: {
          _id: null,
          totalExpense: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    const expStats = expAgg[0] || { totalExpense: 0, count: 0 };

    const getFactor = (type) => summaryMap[type] || { totalAmount: 0, totalNetKg: 0, totalBoxes: 0, count: 0 };

    res.status(200).json({
      success: true,
      data: {
        import: {
          totalAmount: getFactor('Import').totalAmount,
          totalNetKg: getFactor('Import').totalNetKg,
          count: getFactor('Import').count
        },
        export: {
          totalAmount: getFactor('Export').totalAmount,
          totalNetKg: getFactor('Export').totalNetKg,
          totalBoxes: getFactor('Export').totalBoxes,
          count: getFactor('Export').count
        },
        sales: {
          totalAmount: (summaryMap['Sales']?.totalAmount || 0) + billStats.totalSales,
          totalInvoices: (summaryMap['Sales']?.count || 0) + billStats.totalInvoices,
          totalBoxes: (summaryMap['Sales']?.totalBoxes || 0) + billStats.totalBoxes
        },
        expenses: {
          totalAmount: (summaryMap['Expenses']?.totalAmount || 0) + expStats.totalExpense,
          count: (summaryMap['Expenses']?.count || 0) + expStats.count
        },
        purchase: {
          totalAmount: getFactor('Purchase').totalAmount,
          totalNetKg: getFactor('Purchase').totalNetKg,
          count: getFactor('Purchase').count
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
          totalAmount: getFactor('Vehicle / Others').totalAmount,
          count: getFactor('Vehicle / Others').count
        }
      }
    });
  } catch (error) {
    console.error('getOperationsSummary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get List of Operations
export const getOperationsList = async (req, res) => {
  try {
    const { operationType, limit = 50 } = req.query;
    const query = {};
    if (operationType && operationType !== 'All') {
      query.operationType = operationType;
    }
    const operations = await DepotOperation.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
      .populate('supplier', 'name phone harbor');

    res.status(200).json({ success: true, data: operations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Operation Entry with Strict Calculation Enforcement
export const createOperationEntry = async (req, res) => {
  try {
    const {
      operationType,
      supplier,
      supplierName,
      supplierPhone,
      harbor,
      customerName,
      customerPhone,
      destinationCity,
      vehicleNumber,
      driverName,
      fishName,
      category,
      boxesCount = 0,
      grossWeightKg = 0,
      iceDeductionKg = 0,
      ratePerKg = 0,
      paidAmount = 0,
      paymentMode = 'Cash',
      notes = '',
      performedBy = 'Admin'
    } = req.body;

    if (!operationType) {
      return res.status(400).json({ success: false, message: 'Operation type is required' });
    }

    // Precise math validation
    const grossKg = Math.max(0, Number(grossWeightKg) || 0);
    const iceKg = Math.max(0, Number(iceDeductionKg) || 0);
    const netKg = Math.max(0, Math.round((grossKg - iceKg) * 100) / 100);
    const rate = Math.max(0, Number(ratePerKg) || 0);

    let total = Number(req.body.totalAmount) || 0;
    if (!total && netKg > 0 && rate > 0) {
      total = Math.round(netKg * rate * 100) / 100;
    } else if (!total && Number(boxesCount) > 0 && rate > 0) {
      total = Math.round(Number(boxesCount) * rate * 100) / 100;
    }

    const paid = Math.max(0, Number(paidAmount) || 0);
    const balance = Math.max(0, Math.round((total - paid) * 100) / 100);

    // Auto-generate reference number
    const prefix = operationType.substring(0, 3).toUpperCase();
    const count = await DepotOperation.countDocuments({ operationType });
    const referenceNo = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    // Create or Link Supplier if name provided
    let supplierId = supplier;
    let sName = supplierName;
    let sPhone = supplierPhone;
    let sHarbor = harbor;

    if (supplier) {
      const existingSupp = await Supplier.findById(supplier);
      if (existingSupp) {
        sName = existingSupp.name;
        sPhone = existingSupp.phone || sPhone;
        sHarbor = existingSupp.harbor || sHarbor;
      }
    } else if (sName && sName.trim()) {
      let supp = await Supplier.findOne({ name: { $regex: new RegExp(`^${sName.trim()}$`, 'i') } });
      if (!supp) {
        supp = await Supplier.create({
          name: sName.trim(),
          phone: sPhone || '',
          harbor: sHarbor || ''
        });
      }
      supplierId = supp._id;
    }

    const newOp = await DepotOperation.create({
      operationType,
      referenceNo,
      supplier: supplierId,
      supplierName: sName,
      supplierPhone: sPhone,
      harbor: sHarbor,
      customerName,
      customerPhone,
      destinationCity,
      vehicleNumber,
      driverName,
      fishName,
      category,
      boxesCount: Number(boxesCount) || 0,
      grossWeightKg: grossKg,
      iceDeductionKg: iceKg,
      netWeightKg: netKg,
      ratePerKg: rate,
      totalAmount: total,
      paidAmount: paid,
      balanceAmount: balance,
      paymentMode,
      notes,
      performedBy
    });

    res.status(201).json({ success: true, data: newOp });
  } catch (error) {
    console.error('createOperationEntry error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Suppliers CRUD
export const getSuppliers = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const filter = { status: 'Active' };
    if (search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { phone: { $regex: search.trim(), $options: 'i' } },
        { harbor: { $regex: search.trim(), $options: 'i' } }
      ];
    }
    const suppliers = await Supplier.find(filter).sort({ name: 1 }).limit(100);
    res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const { name, phone, harbor, city, contactPerson, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }
    const supplier = await Supplier.create({
      name: name.trim(),
      phone: phone || '',
      harbor: harbor || '',
      city: city || '',
      contactPerson: contactPerson || '',
      notes: notes || ''
    });
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
