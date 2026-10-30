import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/auth/User.js';
import { Branch } from '../models/auth/Branch.js';
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

// Global single-cluster models for all controllers
const globalModels = {
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

import { getTenantModels } from '../utils/database/tenantManager.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token || token === 'undefined' || token === 'null') {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'ynr_fishes_super_secret_jwt_key_2026_enterprise');
    } catch {
      decoded = jwt.verify(token, 'ynr_fishes_secret_key');
    }
    let user = null;

    if (mongoose.connection.readyState === 1 && decoded.id) {
      try {
        user = await User.findById(decoded.id).populate('branch');
      } catch (err) {
        user = await User.findOne({ username: decoded.username }).populate('branch');
      }

      // If not found in primary DB and decoded token has branchCode/tenantDb, check tenant DB
      if (!user && (decoded.tenantDb || decoded.branchCode)) {
        const targetDbName = (decoded.tenantDb || decoded.branchCode).toLowerCase();
        if (targetDbName && targetDbName !== 'fishes') {
          try {
            const tenantConn = mongoose.connection.useDb(targetDbName, { useCache: true });
            const TenantUser = tenantConn.models.User || tenantConn.model('User', User.schema);
            user = await TenantUser.findById(decoded.id);
            if (!user && decoded.username) {
              user = await TenantUser.findOne({ username: decoded.username });
            }
            if (user && decoded.branch) {
              user.branch = decoded.branch;
            }
          } catch (tenantErr) {
            // Ignore
          }
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'User account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'User account has been deactivated' });
    }

    req.user = user;

    // OPTION A: Multi-Database Isolation Resolution
    // Resolve target database: e.g. 'kdp' or 'vzg' for branch staff, 'fishes' for super-admin
    const explicitDb = req.headers['x-tenant-db'] || req.headers['x-branch-code'] || req.headers['x-branch'];
    let targetDb = null;

    if (user.role === 'super-admin') {
      targetDb = explicitDb ? explicitDb.toLowerCase() : 'fishes';
    } else {
      const branchCode = user.branch?.code || decoded.branchCode || decoded.tenantDb || explicitDb;
      targetDb = branchCode ? branchCode.toLowerCase() : 'fishes';
    }

    req.tenantDb = targetDb;

    try {
      req.models = await getTenantModels(targetDb);
    } catch (e) {
      console.warn(`[authenticateToken] Tenant model binding fallback to global for ${targetDb}:`, e.message);
      req.models = globalModels;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', expired: true });
    }
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  let targetDb = (req.headers['x-tenant-db'] || req.headers['x-branch-code'] || req.headers['x-branch'] || 'kdp').toLowerCase();
  if (targetDb === 'fishes') {
    targetDb = 'kdp'; // Always showcase live fish inventory from Kadapa depot (kdp) for YNR Fishes
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ynr_fishes_secret_key');
      let user = null;
      if (mongoose.connection.readyState === 1 && decoded.id) {
        user = await User.findById(decoded.id).populate('branch');
      }
      if (user) {
        req.user = user;
        if (user.role !== 'super-admin' && (user.branch?.code || decoded.branchCode)) {
          targetDb = (user.branch?.code || decoded.branchCode).toLowerCase();
        }
      }
    } catch {
      // Ignore error in optional auth
    }
  }

  req.tenantDb = targetDb;
  try {
    req.models = await getTenantModels(targetDb);
  } catch {
    req.models = globalModels;
  }
  next();
};

export const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'super-admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

export const requireStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

export default {
  authenticateToken,
  optionalAuthenticateToken,
  requireAdmin,
  requireStaff
};
