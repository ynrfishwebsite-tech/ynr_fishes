import CustomerSchema from '../../models/crm/Customer.js';
import BillDefault from '../../models/billing/Bill.js';
import SettingDefault from '../../models/system/Setting.js';
import { getTenantModel } from '../../utils/database/tenantHelper.js';
import whatsappManager from '../../services/whatsappService.js';
import { resolveTenantInfo } from "../communication/whatsappController.js";

export const searchCustomers = async (req, res) => {
  try {
    const { q, category, exportSubCategory } = req.query;
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    const filter = {};
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (exportSubCategory && exportSubCategory !== 'All') {
      filter.exportSubCategory = exportSubCategory;
    }

    if (q && q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { phone: new RegExp(`^${escaped}|${escaped}`, 'i') },
        { name: regex },
        { businessName: regex }
      ];
    }

    const customers = await Customer.find(filter)
      .select('phone name businessName category exportSubCategory photo address lastOrderType totalVisits totalSpend')
      .sort({ lastVisit: -1 })
      .limit(30)
      .lean();

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCustomerInfo = async (req, res) => {
  try {
    const { phone } = req.params;
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      return res.status(200).json({ isNew: true });
    }

    // Determine smart upsell based on favorite items
    let upsellSuggestion = null;
    if (customer.favoriteItems && customer.favoriteItems.length > 0) {
      // Sort by count descending
      const topItem = customer.favoriteItems.sort((a, b) => b.count - a.count)[0];
      upsellSuggestion = `They usually order ${topItem.itemName}. Suggest it today?`;
    }

    res.status(200).json({
      isNew: false,
      customer,
      upsellSuggestion
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllCustomers = async (req, res) => {
  try {
    const { category, exportSubCategory, search } = req.query;
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const Bill = getTenantModel(req, 'Bill', BillDefault);

    const filter = {};
    if (category && category !== 'All') {
      filter.category = category;
    }
    if (exportSubCategory && exportSubCategory !== 'All') {
      filter.exportSubCategory = exportSubCategory;
    }
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { phone: regex },
        { name: regex },
        { businessName: regex },
        { 'address.city': regex },
        { 'address.district': regex }
      ];
    }

    const customers = await Customer.find(filter).sort({ lastVisit: -1 }).lean();

    // Fallback migration / mapping for legacy records without category
    const phonesToLookup = customers.filter(c => !c.lastOrderType || !c.category).map(c => c.phone);
    if (phonesToLookup.length > 0) {
      const recentBills = await Bill.find({
        customerPhone: { $in: phonesToLookup }
      }).select('customerPhone billType createdAt').sort({ createdAt: -1 }).lean();

      const phoneToBillType = {};
      recentBills.forEach(b => {
        if (b.customerPhone && !phoneToBillType[b.customerPhone]) {
          phoneToBillType[b.customerPhone] = b.billType || 'Retail';
        }
      });

      customers.forEach(c => {
        if (!c.lastOrderType) {
          c.lastOrderType = phoneToBillType[c.phone] || 'Retail';
        }
        if (!c.category) {
          if (c.lastOrderType === 'Wholesale') c.category = 'Wholesale';
          else if (c.lastOrderType === 'Export') {
            c.category = 'Export';
            if (!c.exportSubCategory) c.exportSubCategory = 'Local';
          } else {
            c.category = 'Retail';
          }
        }
      });
    }

    // Dynamically calculate lifetime total weight in Kgs across all bills for each customer
    const allPhones = customers.map(c => c.phone).filter(Boolean);
    if (allPhones.length > 0) {
      try {
        const cleanPhones = allPhones.map(p => String(p).replace(/\D/g, '').slice(-10));
        const billsForWeight = await Bill.find({
          $or: [
            { customerPhone: { $in: allPhones } },
            { customerPhone: { $in: cleanPhones } }
          ],
          status: { $nin: ['Cancelled', 'Deleted'] }
        }).select('customerPhone items boxes').lean();

        const weightMap = {};
        for (const b of billsForWeight) {
          const cp = String(b.customerPhone || '').replace(/\D/g, '').slice(-10);
          let bw = 0;
          if (Array.isArray(b.boxes) && b.boxes.length > 0) {
            bw = b.boxes.reduce((s, box) => s + (Number(box.totalWeight) || (box.items || []).reduce((sb, bi) => sb + Number(bi.weightKg || bi.netWeightKg || bi.quantity || 0), 0)), 0);
          }
          if (bw <= 0 && Array.isArray(b.items)) {
            for (const it of b.items) {
              if (it.isCancelled) continue;
              bw += Number(it.netWeightKg || it.enteredWeight || it.weightKg || (it.sellingUnit === 'Kg' ? it.quantity : 0) || 0);
            }
          }
          weightMap[cp] = (weightMap[cp] || 0) + bw;
        }

        customers.forEach(c => {
          const cp = String(c.phone || '').replace(/\D/g, '').slice(-10);
          c.totalWeightKg = Math.round((weightMap[cp] || 0) * 10) / 10;
        });
      } catch (weightErr) {
        console.warn('Could not compute customer total weights:', weightErr.message);
      }
    }

    // Determine real daily attendance / presence for today from database & active bills
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayStr = startOfToday.toISOString().split('T')[0];

      const todayBills = await Bill.find({
        createdAt: { $gte: startOfToday },
        status: { $nin: ['Cancelled', 'Deleted'] }
      }).select('customerPhone').lean();

      const todayActivePhoneSet = new Set(
        todayBills.map(b => String(b.customerPhone || '').replace(/\D/g, '').slice(-10)).filter(Boolean)
      );

      customers.forEach(c => {
        const cp = String(c.phone || '').replace(/\D/g, '').slice(-10);
        const hasTodayBill = todayActivePhoneSet.has(cp);
        const presenceRecord = Array.isArray(c.dailyPresence) ? c.dailyPresence.find(p => p.date === todayStr) : null;

        if (presenceRecord) {
          c.isPresentToday = presenceRecord.status === 'Present';
        } else if (hasTodayBill) {
          c.isPresentToday = true;
        } else {
          c.isPresentToday = false;
        }
      });
    } catch (presenceErr) {
      console.warn('Could not compute customer daily presence:', presenceErr.message);
    }

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Mark Dealer / Customer Daily Presence (Present vs Absent)
 * Stored persistently in MongoDB under customer.dailyPresence
 */
export const markCustomerPresence = async (req, res) => {
  try {
    const { customerId, phone, date, status } = req.body;
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    const targetDate = date || new Date().toISOString().split('T')[0];
    const targetStatus = status === 'Absent' ? 'Absent' : 'Present';

    let query = {};
    if (customerId) {
      query._id = customerId;
    } else if (phone || req.params.phone) {
      const p = (phone || req.params.phone).trim().replace(/\D/g, '').slice(-10);
      query.phone = new RegExp(p + '$');
    } else {
      return res.status(400).json({ message: 'customerId or phone is required' });
    }

    let customer = await Customer.findOne(query);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (!Array.isArray(customer.dailyPresence)) {
      customer.dailyPresence = [];
    }

    const existingIdx = customer.dailyPresence.findIndex(p => p.date === targetDate);
    if (existingIdx >= 0) {
      customer.dailyPresence[existingIdx].status = targetStatus;
      customer.dailyPresence[existingIdx].markedAt = new Date();
    } else {
      customer.dailyPresence.push({
        date: targetDate,
        status: targetStatus,
        markedAt: new Date()
      });
    }

    await customer.save();

    res.json({
      success: true,
      message: `Customer marked ${targetStatus} for ${targetDate}`,
      customerId: customer._id,
      phone: customer.phone,
      date: targetDate,
      status: targetStatus,
      isPresentToday: targetStatus === 'Present'
    });
  } catch (error) {
    console.error('Error marking customer presence:', error);
    res.status(500).json({ message: error.message });
  }
};

export const syncCustomer = async (req, phone, name, orderType = 'Retail', category = 'Retail', exportSubCategory = null) => {
  try {
    if (!phone) return;
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    let customer = await Customer.findOne({ phone: cleanPhone });
    
    const determinedCategory = ['Retail', 'Wholesale', 'Export'].includes(category) 
      ? category 
      : (['Wholesale', 'Export'].includes(orderType) ? orderType : 'Retail');

    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: name || 'Guest',
        lastOrderType: orderType || 'Retail',
        category: determinedCategory,
        exportSubCategory: determinedCategory === 'Export' ? (exportSubCategory || 'Local') : null
      });
      await customer.save();
    } else {
      if (name && (customer.name === 'Guest' || !customer.name)) {
        customer.name = name;
      }
      if (orderType) {
        customer.lastOrderType = orderType;
      }
      if (determinedCategory && (!customer.category || customer.category === 'Retail')) {
        customer.category = determinedCategory;
        if (determinedCategory === 'Export') {
          customer.exportSubCategory = exportSubCategory || customer.exportSubCategory || 'Local';
        }
      }

      // Auto-record presence for today
      const todayStr = new Date().toISOString().split('T')[0];
      if (!Array.isArray(customer.dailyPresence)) {
        customer.dailyPresence = [];
      }
      const pIdx = customer.dailyPresence.findIndex(p => p.date === todayStr);
      if (pIdx >= 0) {
        customer.dailyPresence[pIdx].status = 'Present';
        customer.dailyPresence[pIdx].markedAt = new Date();
      } else {
        customer.dailyPresence.push({
          date: todayStr,
          status: 'Present',
          markedAt: new Date()
        });
      }

      await customer.save();
    }
  } catch (error) {
    console.error('Error syncing customer CRM:', error);
  }
};

export const updateCustomerFromBill = async (req, bill) => {
  try {
    if (!bill.customerPhone) return;
    const cleanPhone = bill.customerPhone.trim().replace(/\D/g, '').slice(-10);

    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const Setting = getTenantModel(req, 'Setting', SettingDefault);

    let customer = await Customer.findOne({ phone: cleanPhone });

    const orderCategory = ['Wholesale', 'Export'].includes(bill.billType) ? bill.billType : 'Retail';
    const subCat = bill.exportSubCategory || (orderCategory === 'Export' ? 'Local' : null);

    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: bill.customerName || 'Guest',
        lastOrderType: bill.billType || 'Retail',
        category: orderCategory,
        exportSubCategory: subCat
      });
    } else {
      if (bill.customerName && (customer.name === 'Guest' || !customer.name)) {
        customer.name = bill.customerName;
      }
      if (bill.billType) {
        customer.lastOrderType = bill.billType;
      }
      if (orderCategory && (!customer.category || customer.category === 'Retail')) {
        customer.category = orderCategory;
        if (orderCategory === 'Export' && !customer.exportSubCategory) {
          customer.exportSubCategory = subCat;
        }
      }
    }

    customer.totalVisits += 1;
    customer.totalSpend += (Number(bill.total) || 0);
    customer.lastVisit = new Date();

    // Fetch dynamic VIP thresholds from settings
    const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    let settings = settingsDoc?.value || {};
    if (typeof settings === 'string') {
      try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
    }
    const visitLimit = (settings.vipVisitThreshold !== undefined && settings.vipVisitThreshold !== null && settings.vipVisitThreshold !== '')
      ? Number(settings.vipVisitThreshold)
      : 5;
    const spendLimit = (settings.vipSpendThreshold !== undefined && settings.vipSpendThreshold !== null && settings.vipSpendThreshold !== '')
      ? Number(settings.vipSpendThreshold)
      : 5000;

    if (customer.totalSpend >= spendLimit || customer.totalVisits >= visitLimit) {
      customer.isVIP = true;
    }

    // Update favorite items
    if (bill.items && Array.isArray(bill.items)) {
      for (const item of bill.items) {
        if (!item.name) continue;
        const existingItem = customer.favoriteItems.find(i => i.itemName === item.name);
        if (existingItem) {
          existingItem.count += (item.quantity || 1);
        } else {
          customer.favoriteItems.push({ itemName: item.name, count: (item.quantity || 1) });
        }
      }
    }

    // Keep top 20 favorites
    customer.favoriteItems.sort((a, b) => b.count - a.count);
    if (customer.favoriteItems.length > 20) {
      customer.favoriteItems = customer.favoriteItems.slice(0, 20);
    }

    // Auto-record presence for today
    const todayStr = new Date().toISOString().split('T')[0];
    if (!Array.isArray(customer.dailyPresence)) {
      customer.dailyPresence = [];
    }
    const existIdx = customer.dailyPresence.findIndex(p => p.date === todayStr);
    if (existIdx >= 0) {
      customer.dailyPresence[existIdx].status = 'Present';
      customer.dailyPresence[existIdx].markedAt = new Date();
    } else {
      customer.dailyPresence.push({
        date: todayStr,
        status: 'Present',
        markedAt: new Date()
      });
    }

    await customer.save();
  } catch (error) {
    console.error('Error updating customer CRM:', error);
  }
};

export const createOrUpdateCustomer = async (req, res) => {
  try {
    const {
      name,
      phone,
      businessName,
      category,
      exportSubCategory,
      address,
      photo,
      orderType
    } = req.body;

    const cleanName = name ? name.trim() : '';
    const cleanPhone = phone ? phone.trim().replace(/\D/g, '').slice(-10) : '';

    if (!cleanName && !cleanPhone) {
      return res.status(400).json({ message: 'Customer name is required' });
    }
    if (cleanPhone && cleanPhone.length !== 10) {
      return res.status(400).json({ message: 'Valid 10-digit phone number is required if provided' });
    }

    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    let customer = null;
    if (cleanPhone) {
      customer = await Customer.findOne({ phone: cleanPhone });
    } else if (cleanName) {
      customer = await Customer.findOne({ name: { $regex: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }

    const determinedCategory = ['Retail', 'Wholesale', 'Export'].includes(category)
      ? category
      : (['Wholesale', 'Export'].includes(orderType) ? orderType : 'Retail');

    const determinedSubCat = determinedCategory === 'Export'
      ? (exportSubCategory === 'DAM' ? 'DAM' : 'Local')
      : null;

    let addressObj = {};
    if (typeof address === 'string') {
      addressObj = { line1: address.trim(), fullAddress: address.trim() };
    } else if (address && typeof address === 'object') {
      addressObj = {
        line1: address.line1 || '',
        area: address.area || '',
        city: address.city || '',
        district: address.district || '',
        state: address.state || 'Andhra Pradesh',
        pincode: address.pincode || '',
        fullAddress: [address.line1, address.area, address.city, address.district, address.pincode].filter(Boolean).join(', ')
      };
    }

    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: (name || 'Guest').trim(),
        businessName: (businessName || '').trim(),
        category: determinedCategory,
        exportSubCategory: determinedSubCat,
        address: addressObj,
        photo: photo || '',
        lastOrderType: orderType || determinedCategory
      });
    } else {
      if (name !== undefined) customer.name = (name || '').trim();
      if (businessName !== undefined) customer.businessName = (businessName || '').trim();
      if (category !== undefined) customer.category = determinedCategory;
      if (exportSubCategory !== undefined || determinedCategory === 'Export') {
        customer.exportSubCategory = determinedSubCat;
      }
      if (address !== undefined) customer.address = addressObj;
      if (photo !== undefined) customer.photo = photo;
      if (orderType) customer.lastOrderType = orderType;
    }

    await customer.save();
    res.status(200).json({ success: true, customer });
  } catch (error) {
    console.error('Error creating/updating customer:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateCustomerType = async (req, res) => {
  try {
    const { phone } = req.params;
    const { orderType, category, exportSubCategory } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (orderType) customer.lastOrderType = orderType;
    if (category && ['Retail', 'Wholesale', 'Export'].includes(category)) {
      customer.category = category;
    }
    if (exportSubCategory !== undefined) {
      customer.exportSubCategory = exportSubCategory;
    }
    await customer.save();

    res.json({ success: true, customer });
  } catch (err) {
    console.error('Error updating customer type:', err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { phone } = req.params;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    const deleted = await Customer.findOneAndDelete({ phone: cleanPhone });
    if (!deleted) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer removed successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ message: err.message });
  }
};
