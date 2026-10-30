import Menu from '../models/catalog/Menu.js';
import Category from '../models/catalog/Category.js';
import Bill from '../models/billing/Bill.js';
import Expense from '../models/finance/Expense.js';
import CashLog from '../models/finance/CashLog.js';
import CreditAccount from '../models/finance/CreditAccount.js';
import Customer from '../models/crm/Customer.js';
import Staff from '../models/operations/Staff.js';
import PrinterConfig from '../models/operations/PrinterConfig.js';
import WhatsAppAuth from '../models/communication/WhatsAppAuth.js';
import Setting from '../models/system/Setting.js';
import { User } from '../models/auth/User.js';

export const globalModels = {
  Menu,
  Category,
  Bill,
  Expense,
  CashLog,
  CreditAccount,
  Customer,
  Staff,
  PrinterConfig,
  WhatsAppAuth,
  Setting,
  User
};

export const tenantMiddleware = (req, res, next) => {
  req.models = globalModels;
  next();
};

export default tenantMiddleware;
