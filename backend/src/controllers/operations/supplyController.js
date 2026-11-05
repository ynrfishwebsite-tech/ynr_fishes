import SupplyCategory from '../../models/operations/SupplyCategory.js';
import SupplyStockLog from '../../models/operations/SupplyStockLog.js';
import Supplier from '../../models/operations/Supplier.js';

const PREDEFINED_CATEGORIES = [
  'Thermocol Boxes',
  'Ice Blocks',
  'Crushed Ice',
  'Packing Tapes & Straps',
  'Plastic Crates',
  'Salts & Chemicals'
];

// Get Supply Categories (Auto-seed if empty)
export const getSupplyCategories = async (req, res) => {
  try {
    let categories = await SupplyCategory.find({}).sort({ name: 1 });

    if (!categories || categories.length === 0) {
      const seedOps = PREDEFINED_CATEGORIES.map(name => ({
        name,
        description: `Standard depot packaging & consumables category`,
        isPredefined: true
      }));
      await SupplyCategory.insertMany(seedOps);
      categories = await SupplyCategory.find({}).sort({ name: 1 });
    }

    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('getSupplyCategories error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a new custom supply category on the fly
export const createSupplyCategory = async (req, res) => {
  try {
    const { name, description = '' } = req.body;
    const cleanName = (name || '').trim();

    if (!cleanName) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    // Check duplicate case-insensitively
    const escaped = cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let existing = await SupplyCategory.findOne({ name: { $regex: new RegExp(`^${escaped}$`, 'i') } });

    if (existing) {
      return res.status(200).json({
        success: true,
        data: existing,
        message: 'Existing category returned (duplicate prevented)'
      });
    }

    const created = await SupplyCategory.create({
      name: cleanName,
      description: description.trim(),
      isPredefined: false
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('createSupplyCategory error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Record Consumables & Supplies Stock-In
export const recordSupplyStockIn = async (req, res) => {
  try {
    const {
      itemName,
      category,
      supplierId,
      supplierName = '',
      supplierPhone = '',
      quantity = 0,
      unit = 'Boxes',
      unitRate = 0,
      paidAmount = 0,
      paymentMode = 'Cash',
      notes = ''
    } = req.body;

    const cleanItemName = (itemName || '').trim();
    const cleanCategory = (category || '').trim();
    const qty = Math.max(0, Number(quantity) || 0);

    if (!cleanItemName) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }
    if (!cleanCategory) {
      return res.status(400).json({ success: false, message: 'Category is required' });
    }
    if (qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
    }

    const rate = Math.max(0, Number(unitRate) || 0);
    const totalAmount = Number((qty * rate).toFixed(2));
    const paid = Math.max(0, Number(paidAmount) || 0);
    const balanceAmount = Number((totalAmount - paid).toFixed(2));

    // Ensure category is registered in SupplyCategory table
    const escapedCat = cleanCategory.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let existingCat = await SupplyCategory.findOne({ name: { $regex: new RegExp(`^${escapedCat}$`, 'i') } });
    if (!existingCat) {
      existingCat = await SupplyCategory.create({ name: cleanCategory, isPredefined: false });
    }

    // Link or find supplier
    let linkedSupplierId = supplierId || null;
    let sName = supplierName.trim();
    let sPhone = supplierPhone.trim();

    if (linkedSupplierId) {
      const sDoc = await Supplier.findById(linkedSupplierId);
      if (sDoc) {
        sName = sDoc.name;
        sPhone = sDoc.phone || sPhone;
      }
    } else if (sName) {
      const escapedSupp = sName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let sDoc = await Supplier.findOne({ name: { $regex: new RegExp(`^${escapedSupp}$`, 'i') } });
      if (!sDoc) {
        sDoc = await Supplier.create({
          name: sName,
          phone: sPhone,
          supplierType: 'Consumables'
        });
      }
      linkedSupplierId = sDoc._id;
    }

    const newLog = await SupplyStockLog.create({
      itemName: cleanItemName,
      category: existingCat.name,
      supplier: linkedSupplierId,
      supplierName: sName,
      supplierPhone: sPhone,
      quantity: qty,
      unit,
      unitRate: rate,
      totalAmount,
      paidAmount: paid,
      balanceAmount,
      paymentMode,
      notes: notes.trim(),
      performedBy: req.user?.username || req.user?.name || 'Admin',
      date: new Date()
    });

    res.status(201).json({
      success: true,
      data: newLog,
      message: `Successfully stocked-in ${qty} ${unit} of "${cleanItemName}"`
    });
  } catch (error) {
    console.error('recordSupplyStockIn error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Supply Stock-In Logs History
export const getSupplyLogs = async (req, res) => {
  try {
    const { limit = 50, category = '' } = req.query;
    const filter = {};
    if (category && category !== 'All') {
      filter.category = category;
    }

    const logs = await SupplyStockLog.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
      .populate('supplier', 'name phone companyName harbor');

    res.status(200).json({ success: true, data: logs });
  } catch (error) {
    console.error('getSupplyLogs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

