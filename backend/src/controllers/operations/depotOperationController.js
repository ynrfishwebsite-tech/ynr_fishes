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

// Suppliers CRUD with Strict Deduplication Enforcement
export const getSuppliers = async (req, res) => {
  try {
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

    const suppliers = await Supplier.find(filter).sort({ name: 1 }).limit(300);

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
    const { id } = req.params;
    const updated = await Supplier.findByIdAndUpdate(id, { status: 'Inactive' }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.status(200).json({ success: true, message: 'Supplier set to inactive successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
