import CustomerSchema from '../../models/crm/Customer.js';
import BillDefault from '../../models/billing/Bill.js';
import SettingDefault from '../../models/system/Setting.js';
import { getTenantModel } from '../../utils/database/tenantHelper.js';
import whatsappManager from '../../services/whatsappService.js';
import { resolveTenantInfo } from "../communication/whatsappController.js";

export const searchCustomers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const customers = await Customer.find({ phone: new RegExp(`^${q}`, 'i') }).select('phone name lastOrderType').limit(10).lean();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getCustomerInfo = async (req, res) => {
  try {
    const { phone } = req.params;
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    const customer = await Customer.findOne({ phone });
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
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const customers = await Customer.find({}).sort({ lastVisit: -1 }).lean();

    // If some customers don't have lastOrderType set yet, lookup their latest bill
    const phonesToLookup = customers.filter(c => !c.lastOrderType).map(c => c.phone);
    if (phonesToLookup.length > 0) {
      const recentBills = await Bill.find({
        customerPhone: { $in: phonesToLookup }
      }).select('customerPhone billType createdAt').sort({ createdAt: -1 }).lean();

      const phoneToBillType = {};
      recentBills.forEach(b => {
        if (b.customerPhone && !phoneToBillType[b.customerPhone]) {
          phoneToBillType[b.customerPhone] = b.billType || 'Dine-In';
        }
      });

      customers.forEach(c => {
        if (!c.lastOrderType) {
          c.lastOrderType = phoneToBillType[c.phone] || 'Dine-In';
        }
      });
    }

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const syncCustomer = async (req, phone, name, orderType = 'Dine-In') => {
  try {
    if (!phone) return;
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);
    let customer = await Customer.findOne({ phone: cleanPhone });
    
    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: name || 'Guest',
        lastOrderType: orderType || 'Dine-In'
      });
      await customer.save();
    } else {
      if (name && (customer.name === 'Guest' || !customer.name)) {
        customer.name = name;
      }
      if (orderType) {
        customer.lastOrderType = orderType;
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
    const isFirstVisit = !customer;

    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: bill.customerName || 'Guest',
        lastOrderType: bill.billType || 'Dine-In'
      });
    } else {
      if (bill.customerName && (customer.name === 'Guest' || !customer.name)) {
        customer.name = bill.customerName;
      }
      if (bill.billType) {
        customer.lastOrderType = bill.billType;
      }
    }

    customer.totalVisits += 1;
    customer.totalSpend += bill.total;
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

    await customer.save();
  } catch (error) {
    console.error('Error updating customer CRM:', error);
  }
};

export const createOrUpdateCustomer = async (req, res) => {
  try {
    const { name, phone, orderType } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      customer = new Customer({
        phone: cleanPhone,
        name: (name || 'Guest').trim(),
        lastOrderType: orderType || 'Dine-In'
      });
    } else {
      if (name && name.trim()) {
        customer.name = name.trim();
      }
      if (orderType) {
        customer.lastOrderType = orderType;
      }
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
    const { orderType } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone is required' });

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const Customer = getTenantModel(req, 'Customer', CustomerSchema);

    let customer = await Customer.findOne({ phone: cleanPhone });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.lastOrderType = orderType;
    await customer.save();

    res.json({ success: true, customer });
  } catch (err) {
    console.error('Error updating customer type:', err);
    res.status(500).json({ message: err.message });
  }
};

