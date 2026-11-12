import CreditAccountDefault from '../../models/finance/CreditAccount.js';
import BillDefault from '../../models/billing/Bill.js';
import SettingDefault from '../../models/system/Setting.js';
import CustomerDefault from '../../models/crm/Customer.js';
import { getTenantModel } from '../../utils/database/tenantHelper.js';
import { getTenantModels } from '../../utils/database/tenantManager.js';
import { resolveTenantInfo } from "../communication/whatsappController.js";

// ─────────────────────────────────────────────────────
// LEGACY: Get all credit accounts (basic list, no pagination)
// ─────────────────────────────────────────────────────
export const getCreditAccounts = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const accounts = await CreditAccount.find().sort({ updatedAt: -1 });
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching credit accounts', error: error.message });
  }
};

// ─────────────────────────────────────────────────────
// LEGACY: Create a new credit account manually
// ─────────────────────────────────────────────────────
export const createCreditAccount = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const { customerName, phoneNumber, initialBalance = 0 } = req.body;

    const existingAccount = await CreditAccount.findOne({ phoneNumber });
    if (existingAccount) {
      return res.status(400).json({ message: 'Account already exists for this phone number' });
    }

    const newAccount = new CreditAccount({
      customerName,
      phoneNumber,
      balance: initialBalance,
      transactions: initialBalance > 0 ? [{ type: 'credit', amount: initialBalance, note: 'Initial Balance' }] : []
    });

    await newAccount.save();
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ message: 'Error creating credit account', error: error.message });
  }
};

// ─────────────────────────────────────────────────────
// LEGACY: Add a transaction (payment or new credit) by account _id
// ─────────────────────────────────────────────────────
export const addTransaction = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const { id } = req.params;
    const { type, amount, note, billId } = req.body;

    const account = await CreditAccount.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    account.transactions.push({ type, amount, note, billId });

    if (type === 'credit') {
      account.balance += amount;
    } else if (type === 'payment') {
      account.balance -= amount;
    }

    await account.save();
    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: 'Error adding transaction', error: error.message });
  }
};


// ═══════════════════════════════════════════════════════
// KHATA BOOK API (new, paginated, full-featured)
// ═══════════════════════════════════════════════════════

// GET /api/credit-accounts/khata
// Derives accounts directly from ALL Unpaid bills in the Bill collection.
// This means existing unpaid bills show up immediately — no CreditAccount entry needed.
// Payments recorded in CreditAccount are then merged to give the adjusted balance.
export const getKhataAccounts = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = (req.query.search || '').trim();
    const category = (req.query.category || req.query.salesCategory || '').trim();
    const skip = (page - 1) * limit;

    // Step 1: Aggregate all genuinely Unpaid and Partial Khata bills grouped by customerPhone
    const matchFilter = { status: { $in: ['Unpaid', 'Partial'] }, customerPhone: { $exists: true, $ne: null, $not: /^\s*$/ } };
    if (category && category !== 'All') {
      matchFilter.customerCategory = category;
    }
    if (search) {
      matchFilter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }

    const billGroups = await Bill.aggregate([
      { $match: matchFilter },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$customerPhone',
          customerName: { $last: '$customerName' },
          phoneNumber: { $last: '$customerPhone' },
          billTotal: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Partial'] },
                { $ifNull: ['$dueAmount', { $subtract: ['$total', { $ifNull: ['$paidAmount', 0] }] }] },
                '$total'
              ]
            }
          },
          billCount: { $sum: 1 },
          lastUpdate: { $max: '$updatedAt' },
          bills: { $push: { items: '$items', boxes: '$boxes' } }
        }
      },
      { $sort: { lastUpdate: -1 } }
    ]);

    // Cross-reference CRM Customer directory by phone number to guarantee latest full customer names
    const phones = billGroups.map(g => g._id).filter(Boolean);
    const cleanPhones = phones.map(p => String(p).replace(/\D/g, '').slice(-10));
    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    const crmCustomers = await Customer.find({
      $or: [
        { phone: { $in: phones } },
        { phone: { $in: cleanPhones } }
      ]
    }).select('name phone photo').lean();

    const crmMap = {};
    for (const c of crmCustomers) {
      const cp = String(c.phone || '').replace(/\D/g, '').slice(-10);
      crmMap[cp] = c;
    }

    // Step 2: Balance = sum of remaining Unpaid/Partial bills
    const merged = billGroups.map(group => {
      const cleanP = String(group.phoneNumber || group._id || '').replace(/\D/g, '').slice(-10);
      const crmCust = crmMap[cleanP];
      const resolvedName = crmCust?.name || group.customerName || 'Customer';

      // Compute total weight across unpaid/partial bills for this debtor
      let totalWeightKg = 0;
      for (const b of (group.bills || [])) {
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
        totalWeightKg += bw;
      }

      return {
        _id: group._id,
        customerName: resolvedName,
        phoneNumber: group.phoneNumber,
        balance: group.billTotal,
        billTotal: group.billTotal,
        billCount: group.billCount,
        totalWeightKg: Math.round(totalWeightKg * 10) / 10,
        updatedAt: group.lastUpdate
      };
    }).filter(a => a.balance > 0);

    // Step 4: Apply pagination manually (after merge)
    const totalDocs = merged.length;
    const paginated = merged.slice(skip, skip + limit);

    // Step 5: Compute total outstanding stats
    const totalOutstanding = merged.reduce((sum, a) => sum + a.balance, 0);
    const activeAccounts = merged.length;

    res.status(200).json({
      accounts: paginated,
      pagination: {
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit) || 1,
        currentPage: page,
        limit
      },
      stats: { totalOutstanding, activeAccounts }
    });
  } catch (error) {
    console.error('[Khata] Error fetching accounts:', error);
    res.status(500).json({ message: 'Error fetching Khata accounts', error: error.message });
  }
};


// GET /api/credit-accounts/khata/:phoneNumber/ledger
// Returns all unpaid bills for a customer by phone number
export const getKhataLedger = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);

    const { phoneNumber } = req.params;
    const category = (req.query.category || '').trim();
    const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);

    // Get all Unpaid and Partial Khata bills for this customer with complete itemized data
    const billQuery = {
      customerPhone: { $regex: cleanPhone, $options: 'i' },
      status: { $in: ['Unpaid', 'Partial'] }
    };
    if (category && category !== 'All') {
      billQuery.customerCategory = category;
    }
    const bills = await Bill.find(billQuery)
      .sort({ createdAt: -1 })
      .lean();

    // Determine the customer's actual latest bill for e-bill receipt generation
    let latestBill = bills.length > 0 ? bills[0] : null;
    if (!latestBill) {
      latestBill = await Bill.findOne({
        customerPhone: { $regex: cleanPhone, $options: 'i' }
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Balance = pure sum of remaining due across Unpaid & Partial bills (no CreditAccount deduction)
    // Bills are marked Paid in DB when settlement happens, so Unpaid/due sum is always accurate
    const balance = bills.reduce((sum, b) => {
      if (b.status === 'Partial') {
        return sum + (b.dueAmount ?? Math.max(0, (b.total || 0) - (b.paidAmount || b.amountPaid || 0)));
      }
      return sum + (b.total || 0);
    }, 0);

    // Get CreditAccount for payment history display only (not for balance calculation)
    const account = await CreditAccount.findOne({
      phoneNumber: { $regex: cleanPhone, $options: 'i' }
    }).lean();

    // Dynamically lookup CRM Customer for full real name
    const Customer = getTenantModel(req, 'Customer', CustomerDefault);
    const crmCust = await Customer.findOne({
      phone: { $regex: cleanPhone, $options: 'i' }
    }).select('name phone photo').lean();

    const resolvedCustomerName = crmCust?.name || latestBill?.customerName || bills[0]?.customerName || account?.customerName || 'Customer';

    // Attach computed weight in KGs to each bill in ledger
    const billsWithWeight = bills.map(b => {
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
      return {
        ...b,
        weightKg: Math.round(bw * 10) / 10
      };
    });

    res.status(200).json({
      account: {
        ...(account || {}),
        customerName: resolvedCustomerName,
        phoneNumber: cleanPhone,
        balance
      },
      bills: billsWithWeight,
      latestBill,
      transactions: account?.transactions?.sort((a, b) => new Date(b.date) - new Date(a.date)) || []
    });
  } catch (error) {
    console.error('[Khata] Error fetching ledger:', error);
    res.status(500).json({ message: 'Error fetching Khata ledger', error: error.message });
  }
};


// POST /api/credit-accounts/khata/settle
// Record a payment against a Khata account AND mark individual bills as Paid
// Body: { phoneNumber, amount, paymentMode, splitPayments, upiApp, note, targetBillId }
export const settleKhataPayment = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { phoneNumber, amount, paymentMode = 'Cash', splitPayments, upiApp, partialMethod = 'Cash', note, targetBillId, category } = req.body;

    if (!phoneNumber || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid phoneNumber and amount are required' });
    }

    const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
    const paidAmount = Number(amount);

    // ── Step 1: Fetch all genuine unpaid & partial Khata bills for this customer ──
    const unpaidFilter = {
      customerPhone: { $regex: cleanPhone, $options: 'i' },
      status: { $in: ['Unpaid', 'Partial'] }
    };
    if (category && category !== 'All') {
      unpaidFilter.customerCategory = category;
    }
    const unpaidBills = await Bill.find(unpaidFilter).sort({ createdAt: 1 }); // oldest first default

    const getBillDue = (b) => {
      if (b.status === 'Partial') {
        return b.dueAmount ?? Math.max(0, (b.total || 0) - (b.paidAmount || b.amountPaid || 0));
      }
      return b.total || 0;
    };

    // ── Step 2: Allocate payment bill by bill ──
    let remaining = paidAmount;
    let remCash = splitPayments?.cash || 0;
    let remUpi = splitPayments?.upi || 0;
    let remCard = splitPayments?.card || 0;
    
    const clearedBillIds = [];
    const now = new Date();
    const resolvedFinalMode = paymentMode === 'Partial' ? (partialMethod || 'Cash') : paymentMode;

    const applyPaymentToBill = (tBill) => {
      tBill.status = 'Paid';
      tBill.paymentMode = resolvedFinalMode;
      tBill.amountPaid = tBill.total;
      tBill.paidAmount = tBill.total;
      tBill.dueAmount = 0;
      tBill.clearedAt = now;
      if (upiApp) tBill.upiApp = upiApp;

      if (resolvedFinalMode === 'Mixed') {
        let bTotal = tBill.total;
        tBill.splitPayments = { cash: 0, upi: 0, card: 0 };
        
        const cTake = Math.min(bTotal, remCash);
        tBill.splitPayments.cash = cTake;
        remCash -= cTake;
        bTotal -= cTake;
        
        const uTake = Math.min(bTotal, remUpi);
        tBill.splitPayments.upi = uTake;
        remUpi -= uTake;
        bTotal -= uTake;
        
        const cdTake = Math.min(bTotal, remCard);
        tBill.splitPayments.card = cdTake;
        remCard -= cdTake;
      }
    };

    const applyPartialToBill = (tBill, payAmt) => {
      const prevPaid = tBill.status === 'Partial'
        ? Number(tBill.paidAmount ?? tBill.amountPaid ?? tBill.partialPayment?.paidAmount ?? 0)
        : 0;
      const newPaid = Math.min(Number(tBill.total || 0), Number((prevPaid + payAmt).toFixed(2)));
      const newDue = Math.max(0, Number(((tBill.total || 0) - newPaid).toFixed(2)));
      if (newDue <= 0.01) {
        applyPaymentToBill(tBill);
        clearedBillIds.push(tBill._id);
        return;
      }
      tBill.status = 'Partial';
      tBill.paymentMode = 'Partial';
      tBill.paidAmount = newPaid;
      tBill.amountPaid = newPaid;
      tBill.dueAmount = newDue;
      tBill.partialPayment = {
        paidAmount: newPaid,
        dueAmount: newDue,
        method: partialMethod || (paymentMode !== 'Partial' ? paymentMode : 'Cash'),
        upiApp: upiApp || tBill.partialPayment?.upiApp
      };
      if (upiApp) tBill.upiApp = upiApp;
    };

    // If a specific target bill was provided (Clear Due on single row), process that first
    if (targetBillId) {
      const targetBillIndex = unpaidBills.findIndex(b => b._id.toString() === targetBillId);
      if (targetBillIndex !== -1) {
        const tBill = unpaidBills[targetBillIndex];
        const bDue = getBillDue(tBill);
        if (bDue <= remaining) {
          applyPaymentToBill(tBill);
          await tBill.save();
          remaining -= bDue;
          clearedBillIds.push(tBill._id);
          unpaidBills.splice(targetBillIndex, 1); // Remove from list so we don't process it again
        } else if (remaining > 0) {
          applyPartialToBill(tBill, remaining);
          await tBill.save();
          remaining = 0;
          unpaidBills.splice(targetBillIndex, 1);
        }
      }
    }

    // Process remaining bills oldest-to-newest with any leftover amount
    for (const bill of unpaidBills) {
      if (remaining <= 0) break;
      const bDue = getBillDue(bill);
      if (bDue <= remaining) {
        applyPaymentToBill(bill);
        await bill.save();
        remaining -= bDue;
        clearedBillIds.push(bill._id);
      } else if (remaining > 0) {
        applyPartialToBill(bill, remaining);
        await bill.save();
        remaining = 0;
      }
    }

    // ── Step 3: Recalculate true outstanding balance from remaining Unpaid/Partial bills ──
    const remainingBillAgg = await Bill.aggregate([
      { $match: { customerPhone: { $regex: cleanPhone, $options: 'i' }, status: { $in: ['Unpaid', 'Partial'] } } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'Partial'] },
                { $ifNull: ['$dueAmount', { $subtract: ['$total', { $ifNull: ['$paidAmount', 0] }] }] },
                '$total'
              ]
            }
          }
        }
      }
    ]);
    const trueBalance = remainingBillAgg[0]?.total || 0;

    // ── Step 4: Upsert CreditAccount with correct balance and payment transaction ──
    let account = await CreditAccount.findOne({ phoneNumber: { $regex: cleanPhone, $options: 'i' } });
    const customerName = unpaidBills[0]?.customerName || account?.customerName || 'Unknown Customer';

    if (!account) {
      account = new CreditAccount({
        customerName,
        phoneNumber: cleanPhone,
        balance: trueBalance,
        transactions: [{
          type: 'payment',
          amount: paidAmount,
          note: note || `Cleared ${clearedBillIds.length} bill(s) via ${paymentMode}`,
          date: now
        }]
      });
      await account.save();
    } else {
      account.balance = trueBalance;
      account.transactions.push({
        type: 'payment',
        amount: paidAmount,
        note: note || `Cleared ${clearedBillIds.length} bill(s) via ${paymentMode}`,
        date: now
      });
      await account.save();
    }

    res.status(200).json({
      success: true,
      message: `Payment of ₹${paidAmount} recorded. ${clearedBillIds.length} bill(s) marked as Paid. Remaining due: ₹${trueBalance}`,
      clearedBills: clearedBillIds.length,
      account: {
        _id: account._id,
        customerName: account.customerName,
        phoneNumber: account.phoneNumber,
        balance: trueBalance,
        updatedAt: account.updatedAt
      }
    });
  } catch (error) {
    console.error('[Khata] Error settling payment:', error);
    res.status(500).json({ message: 'Error settling Khata payment', error: error.message });
  }
};

// POST /api/credit-accounts/khata/send-reminder
export const sendKhataReminder = async (req, res) => {
  try {
    const { phoneNumber, customerName, balance, billNumber, category, imageBase64, customMessage } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
    const amountStr = Number(balance || 0).toLocaleString('en-IN');
    const billRef = billNumber ? ` for Bill #${billNumber}` : '';
    const catLabel = category ? ` (${category})` : '';

    // Dynamically fetch depot & store settings directly from database (no code fallbacks)
    const Setting = getTenantModel(req, 'Setting', SettingDefault);
    const storeSettingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
    let storeSettings = storeSettingsDoc?.value;
    if (typeof storeSettings === 'string') {
      try { storeSettings = JSON.parse(storeSettings); } catch (e) { storeSettings = {}; }
    }
    if (!storeSettings || typeof storeSettings !== 'object') storeSettings = {};

    const shopName = (storeSettings.restaurantName || '').trim();
    const shopAddress = (storeSettings.address || '').replace(/\r?\n/g, ', ').trim();
    const shopPhone = (storeSettings.phone || '').trim();
    const footerMsg = (storeSettings.footerMessage || '').replace(/\*/g, '').trim();

    const headerTitle = shopName ? `*${shopName.toUpperCase()} - PAYMENT REMINDER*` : `*PAYMENT REMINDER*`;
    const fromLine = shopName ? `from ${shopName}.` : 'regarding your pending balance.';
    const addressBlock = shopAddress ? `*Depot Address:* ${shopAddress}\n` : '';
    const contactBlock = shopPhone ? `*Contact:* ${shopPhone}\n` : '';
    const footerBlock = footerMsg ? `${footerMsg}` : '';
    const footerSection = (addressBlock || contactBlock || footerBlock)
      ? `\n\n${addressBlock}${contactBlock}${footerBlock}`.trimEnd()
      : '';

    // Standard WhatsApp hidden delimiter to trigger collapsible "... Read more" in WhatsApp chat
    const READ_MORE = String.fromCharCode(8206).repeat(4001);

    const formatDateTime12 = (dateInput) => {
      if (!dateInput) return '';
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return '';
      const datePart = d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
      return `${datePart}, ${timePart}`;
    };

    const getDaysCompleted = (dateInput) => {
      if (!dateInput) return 0;
      const billedDate = new Date(dateInput);
      if (isNaN(billedDate.getTime())) return 0;
      const now = new Date();
      const diffMs = now.getTime() - billedDate.getTime();
      return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    };

    const formatDaysText = (days) => {
      if (days <= 0) return 'Today (0 days completed)';
      if (days === 1) return '1 day completed';
      return `${days} days completed`;
    };

    const calcBillWeight = (b) => {
      if (!b) return 0;
      if (Array.isArray(b.boxes) && b.boxes.length > 0) {
        const boxWeight = b.boxes.reduce((sum, bx) => {
          const bw = Number(bx.totalWeight || 0);
          if (bw > 0) return sum + bw;
          if (Array.isArray(bx.items)) {
            return sum + bx.items.reduce((s, i) => s + Number(i.weightKg || i.netWeightKg || i.enteredWeight || i.quantity || 0), 0);
          }
          return sum;
        }, 0);
        if (boxWeight > 0) return Math.round(boxWeight * 10) / 10;
      }
      if (Array.isArray(b.items)) {
        const w = b.items.reduce((sum, i) => {
          if (i.isCancelled) return sum;
          return sum + Number(i.netWeightKg || i.enteredWeight || i.weightKg || (i.sellingUnit === 'Kg' ? i.quantity : 0) || 0);
        }, 0);
        return Math.round(w * 10) / 10;
      }
      return 0;
    };

    let rawText = '';
    if (customMessage && typeof customMessage === 'string' && customMessage.trim()) {
      rawText = customMessage.trim();
    } else {
      const Bill = getTenantModel(req, 'Bill', BillDefault);
      const unpaidBills = await Bill.find({
        customerPhone: { $regex: cleanPhone, $options: 'i' },
        status: { $in: ['Unpaid', 'Partial'] }
      }).sort({ createdAt: 1 }).lean();

      if (unpaidBills.length > 1) {
        const oldestBill = unpaidBills[0];
        const latestBill = unpaidBills[unpaidBills.length - 1];

        const oldestDateStr = formatDateTime12(oldestBill?.billedAt || oldestBill?.createdAt);
        const oldestDays = getDaysCompleted(oldestBill?.billedAt || oldestBill?.createdAt);

        const latestDateStr = formatDateTime12(latestBill?.billedAt || latestBill?.createdAt);
        const latestDays = getDaysCompleted(latestBill?.billedAt || latestBill?.createdAt);

        const totalWeight = unpaidBills.reduce((sum, b) => sum + calcBillWeight(b), 0);
        const weightLine = totalWeight > 0 ? `\n• *Total Purchased Weight:* *${totalWeight.toFixed(1).replace(/\.0$/, '')} Kg*` : '';

        const breakdownLines = unpaidBills.map((b) => {
          const bDue = b.status === 'Partial'
            ? (b.dueAmount ?? Math.max(0, (b.total || 0) - (b.paidAmount || b.amountPaid || 0)))
            : (b.total || 0);
          const bDate = formatDateTime12(b.billedAt || b.createdAt);
          const bDays = getDaysCompleted(b.billedAt || b.createdAt);
          const daysStr = formatDaysText(bDays);
          const bWeight = calcBillWeight(b);
          const bWtStr = bWeight > 0 ? ` • ${bWeight} Kg` : '';
          return `• #${b.billNumber || 'Bill'} (${bDate}): ₹${Number(bDue).toLocaleString('en-IN')}${bWtStr} • ${daysStr}`;
        }).join('\n');

        rawText = `${headerTitle}\n\nNamaskaram *${customerName || 'Customer'}* garu,\n\nThis is a friendly reminder ${fromLine}\nYou have an outstanding Khata balance of *₹${amountStr}* across ${unpaidBills.length} pending bills${catLabel}.${weightLine}\n\n• *Oldest Pending Since:* ${oldestDateStr} (${formatDaysText(oldestDays)})\n• *Latest Bill Date:* ${latestDateStr} (${formatDaysText(latestDays)})\n\n*Pending Bills Breakdown:*\n${breakdownLines}\n\nKindly clear this pending amount at your earliest convenience via UPI or Cash.${footerSection}`;
      } else if (unpaidBills.length === 1) {
        const singleBill = unpaidBills[0];
        const billDateStr = formatDateTime12(singleBill?.billedAt || singleBill?.createdAt);
        const billDays = getDaysCompleted(singleBill?.billedAt || singleBill?.createdAt);
        const daysText = formatDaysText(billDays);
        const ref = singleBill.billNumber ? ` for Bill #${singleBill.billNumber}` : billRef;
        const sWeight = calcBillWeight(singleBill);
        const sWeightLine = sWeight > 0 ? `\n• *Total Purchased Weight:* *${sWeight.toFixed(1).replace(/\.0$/, '')} Kg*` : '';

        rawText = `${headerTitle}\n\nNamaskaram *${customerName || 'Customer'}* garu,\n\nThis is a friendly reminder ${fromLine}\nYou have an outstanding Khata balance of *₹${amountStr}*${ref}${catLabel}.\n\n• *Billed Date & Time:* ${billDateStr}${sWeightLine}\n• *Pending Duration:* ${daysText}\n\nKindly clear this pending amount at your earliest convenience via UPI or Cash.${footerSection}`;
      } else {
        rawText = `${headerTitle}\n\nNamaskaram *${customerName || 'Customer'}* garu,\n\nThis is a friendly reminder ${fromLine}\nYou have an outstanding Khata balance of *₹${amountStr}*${billRef}${catLabel}.\n\nKindly clear this pending amount at your earliest convenience via UPI or Cash.${footerSection}`;
      }
    }

    // Embed READ_MORE delimiter right after greeting for WhatsApp collapsible display
    let text = rawText;
    if (!text.includes(READ_MORE) && text.includes('garu,')) {
      text = text.replace('garu,', `garu,\n${READ_MORE}`);
    }

    const { tenantId, whatsappService } = await resolveTenantInfo(req);

    if (!whatsappService) {
      return res.status(200).json({
        success: false,
        isWhatsAppConnected: false,
        message: 'WhatsApp Service could not be resolved.',
        whatsappText: rawText,
        cleanPhone
      });
    }

    // 1. Actively ensure socket connection before checking status
    await whatsappService.ensureConnection().catch(() => {});

    let waStatus = whatsappService.getStatus();
    let isConnected = waStatus?.status === 'CONNECTED';

    // 2. Check DB persisted credentials & status if memory socket is warming up
    if (!isConnected && tenantId) {
      try {
        const models = req.models || (await getTenantModels(tenantId).catch(() => null));
        if (models?.Setting) {
          const dbStatusDoc = await models.Setting.findOne({ key: 'whatsapp_status' }).lean();
          const hasAuthCreds = models.WhatsAppAuth ? (await models.WhatsAppAuth.countDocuments({ id: 'creds' })) > 0 : false;
          if (dbStatusDoc?.value?.status === 'CONNECTED' && hasAuthCreds) {
            isConnected = true;
            // Force connection in background
            await whatsappService.ensureConnection(true).catch(() => {});
          }
        }
      } catch (dbErr) {
        console.warn('[sendKhataReminder] DB status check warning:', dbErr.message);
      }
    }

    if (!isConnected) {
      return res.status(200).json({
        success: false,
        isWhatsAppConnected: false,
        message: 'WhatsApp Bot is offline. Scan QR code in settings to send directly in background.',
        whatsappText: rawText,
        cleanPhone
      });
    }

    // 3. Attempt direct send with automatic retry on socket hiccup
    try {
      if (imageBase64) {
        console.log(`[sendKhataReminder] Sending media e-bill with reminder to ${cleanPhone}...`);
        await whatsappService.sendBillMedia(cleanPhone, {
          imageBase64,
          caption: text,
          fileName: `eBill_${billNumber || 'Khata_Due'}.jpg`
        });
      } else {
        console.log(`[sendKhataReminder] Sending text-only reminder to ${cleanPhone}...`);
        await whatsappService.sendMessage(cleanPhone, text);
      }

      return res.status(200).json({
        success: true,
        isWhatsAppConnected: true,
        message: `WhatsApp reminder ${imageBase64 ? 'with e-bill image ' : ''}sent directly to +91 ${cleanPhone}!`,
        cleanPhone
      });
    } catch (firstErr) {
      console.warn(`[sendKhataReminder] First attempt warning: ${firstErr.message}. Forcing reconnect and retrying...`);
      try {
        await whatsappService.ensureConnection(true);
        if (imageBase64) {
          await whatsappService.sendBillMedia(cleanPhone, {
            imageBase64,
            caption: text,
            fileName: `eBill_${billNumber || 'Khata_Due'}.jpg`
          });
        } else {
          await whatsappService.sendMessage(cleanPhone, text);
        }

        return res.status(200).json({
          success: true,
          isWhatsAppConnected: true,
          message: `WhatsApp reminder ${imageBase64 ? 'with e-bill image ' : ''}sent directly to +91 ${cleanPhone} (after auto-reconnect)!`,
          cleanPhone
        });
      } catch (retryErr) {
        console.error('[sendKhataReminder] Retry attempt failed:', retryErr.message);
        return res.status(200).json({
          success: false,
          isWhatsAppConnected: false,
          message: `Direct send failed: ${retryErr.message}. You can send via WhatsApp web.`,
          whatsappText: text,
          cleanPhone
        });
      }
    }
  } catch (err) {
    console.error('Error sending Khata reminder:', err);
    res.status(500).json({ message: err.message || 'Failed to send WhatsApp reminder' });
  }
};


