import UserDefault from '../../models/auth/User.js';
const Client = { findOne: async () => null, updateOne: async () => null };
import { getTenantModel, handleTenantError } from '../../utils/database/tenantHelper.js';

// Synchronize tenant users to SuperAdmin central staffAccounts
const syncStaffToSuperAdmin = async (req, UserModel) => {
  try {
    const tenantDb = req.user?.db || req.tenantDb || req.headers?.['x-tenant-db'];
    if (!tenantDb || tenantDb === 'default' || tenantDb === 'mscurechain') return;

    const allUsers = await UserModel.find({}, 'username role').lean();
    const clientDoc = await Client.findOne({ databaseName: tenantDb });
    if (!clientDoc) return;

    const existingPassMap = new Map();
    (clientDoc.staffAccounts || []).forEach(s => {
      if (s.username) existingPassMap.set(s.username.toLowerCase(), s.plainTextPassword);
    });

    const updatedStaff = allUsers.map(u => ({
      role: u.role,
      username: u.username,
      plainTextPassword: existingPassMap.get(u.username.toLowerCase()) || clientDoc.plainTextPassword || '123456'
    }));

    await Client.updateOne(
      { databaseName: tenantDb },
      { $set: { staffAccounts: updatedStaff, updatedAt: new Date() } }
    );
    console.log(`[AdminController] Synchronized ${updatedStaff.length} staff accounts to central SuperAdmin for ${tenantDb}`);
  } catch (err) {
    console.warn('[AdminController] syncStaffToSuperAdmin warning:', err.message);
  }
};

export const getRolesAndPages = async (req, res) => {
  try {
    const roles = [
      { id: 'cashier', label: 'Cashier (Billing & Printing)', defaultPages: ['billing', 'active-orders', 'bill-history'] },
      { id: 'worker', label: 'Worker / Operator (POS & Orders)', defaultPages: ['billing', 'active-orders', 'menu'] },
      { id: 'manager', label: 'Manager (Operations & Analytics)', defaultPages: ['dashboard', 'billing', 'active-orders', 'bill-history', 'menu', 'day-book', 'khata', 'expenses', 'analytics', 'operations'] },
      { id: 'admin', label: 'Admin (Full Branch Access)', defaultPages: ['dashboard', 'billing', 'active-orders', 'bill-history', 'edited-bills', 'menu', 'day-book', 'khata', 'expenses', 'analytics', 'crm', 'staff', 'printer', 'operations', 'discount', 'security', 'settings', 'notifications'] },
    ];

    const availablePages = [
      { id: 'dashboard', label: 'Dashboard', group: 'Analytics', description: 'Real-time sales, order trends, fish KPIs' },
      { id: 'billing', label: 'New Order / POS', group: 'Sales & Billing', description: 'Counter billing, cart, and bill print' },
      { id: 'active-orders', label: 'Active Orders', group: 'Sales & Billing', description: 'Live orders, status updates, KOTs' },
      { id: 'bill-history', label: 'Bill History', group: 'Sales & Billing', description: 'Past invoices, reprints, settlements' },
      { id: 'edited-bills', label: 'Edited Bills Audit', group: 'Sales & Billing', description: 'Audit trail for modified invoices' },
      { id: 'menu', label: 'Fish Registry', group: 'Catalog', description: 'Fish species, rates, stock status' },
      { id: 'day-book', label: 'Day Book', group: 'Finance', description: 'Daily cash in/out and till reconcile' },
      { id: 'khata', label: 'Khata Book', group: 'Finance', description: 'Customer credit ledger & balance' },
      { id: 'expenses', label: 'Expenses', group: 'Finance', description: 'Daily overheads, fuel, transport' },
      { id: 'analytics', label: 'Analytics', group: 'Analytics', description: 'Visual charts, revenue reports' },
      { id: 'crm', label: 'Customer CRM', group: 'Operations', description: 'Customer directory & purchase history' },
      { id: 'staff', label: 'Admin Control Panel', group: 'Management', description: 'Staff accounts & role permissions' },
      { id: 'printer', label: 'Printer Setup', group: 'Hardware', description: 'Thermal bill & KOT printers' },
      { id: 'operations', label: 'Extra Operations', group: 'Operations', description: 'Branch quick action hub' },
      { id: 'discount', label: 'Discount Config', group: 'Finance', description: 'Promotional rules & discounts' },
      { id: 'security', label: 'Security Settings', group: 'Management', description: 'PIN codes, audit logs & safety' },
      { id: 'settings', label: 'Store Settings', group: 'Management', description: 'GST, shop name, address details' },
      { id: 'notifications', label: 'Alerts & Messages', group: 'Operations', description: 'Low stock and order alerts' }
    ];

    res.json({
      success: true,
      roles,
      availablePages
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error retrieving roles and pages' });
  }
};

export const getUsers = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    let { username, password, role, permittedPages, name, phone } = req.body;
    
    // Strict Sanitization & Validation
    const cleanUsername = (username || '').trim();
    if (!cleanUsername || cleanUsername.length < 2) {
      return res.status(400).json({ message: 'Username must be at least 2 characters long' });
    }
    if (cleanUsername.length > 30) {
      return res.status(400).json({ message: 'Username cannot exceed 30 characters' });
    }

    const validRoles = ['admin', 'manager', 'cashier', 'worker'];
    const normalizedRole = (role || '').trim().toLowerCase();
    const assignedRole = validRoles.includes(normalizedRole) ? normalizedRole : 'cashier';

    // Strict Case-Insensitive Duplicate Check within this tenant database
    const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${escaped}$`, 'i') }
    });
    if (existingUser) {
      return res.status(400).json({ message: `Username "${cleanUsername}" is already taken in this branch` });
    }

    // Default pages based on assigned role if not specified
    let pagesToAssign = Array.isArray(permittedPages) && permittedPages.length > 0
      ? permittedPages
      : (assignedRole === 'admin' 
          ? ['dashboard', 'billing', 'active-orders', 'bill-history', 'edited-bills', 'menu', 'day-book', 'khata', 'expenses', 'analytics', 'crm', 'staff', 'printer', 'operations', 'discount', 'security', 'settings', 'notifications']
          : assignedRole === 'manager'
          ? ['dashboard', 'billing', 'active-orders', 'bill-history', 'menu', 'day-book', 'khata', 'expenses', 'analytics', 'operations']
          : ['billing', 'active-orders', 'bill-history']);

    const cleanEmail = (req.body.email && req.body.email.trim()) 
      ? req.body.email.trim().toLowerCase()
      : `${cleanUsername.replace(/[^a-zA-Z0-9._-]/g, '')}@branch.local`;

    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(400).json({ message: `Email "${cleanEmail}" is already registered` });
    }

    const newUser = new User({
      name: name ? name.trim() : cleanUsername,
      email: cleanEmail,
      username: cleanUsername,
      password, // Password will be hashed by the pre-save hook
      role: assignedRole,
      permittedPages: pagesToAssign,
      phone: phone || '',
      branch: req.user?.branch?._id || req.user?.branch || null
    });

    await newUser.save();
    
    // Synchronize to central staff registry if required
    await syncStaffToSuperAdmin(req, User);

    // Return user without password
    const userToReturn = newUser.toObject();
    delete userToReturn.password;
    
    res.status(201).json(userToReturn);
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    let { username, role, password, permittedPages, name, phone, isActive } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const validRoles = ['admin', 'manager', 'cashier', 'worker'];
    let assignedRole = user.role;
    if (role) {
      const normalizedRole = role.trim().toLowerCase();
      if (validRoles.includes(normalizedRole)) {
        assignedRole = normalizedRole;
      }
    }

    // Prevent demoting the last admin
    if (user.role === 'admin' && assignedRole !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot demote the last Admin account' });
      }
    }

    // Strict Case-Insensitive Duplicate Check if username is being changed
    if (username) {
      const cleanUsername = username.trim();
      if (!cleanUsername || cleanUsername.length < 2) {
        return res.status(400).json({ message: 'Username must be at least 2 characters long' });
      }
      const escaped = cleanUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingUser = await User.findOne({
        _id: { $ne: req.params.id },
        username: { $regex: new RegExp(`^${escaped}$`, 'i') }
      });
      if (existingUser) {
        return res.status(400).json({ message: `Username "${cleanUsername}" is already taken in this branch` });
      }
      user.username = cleanUsername;
    }

    user.role = assignedRole;
    if (req.body.email && req.body.email.trim()) {
      const cleanEmail = req.body.email.trim().toLowerCase();
      const existingEmail = await User.findOne({
        _id: { $ne: req.params.id },
        email: cleanEmail
      });
      if (existingEmail) {
        return res.status(400).json({ message: `Email "${cleanEmail}" is already registered` });
      }
      user.email = cleanEmail;
    }
    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (Array.isArray(permittedPages)) {
      user.permittedPages = permittedPages;
    }
    if (password && password.trim()) {
      user.password = password.trim();
    }

    await user.save();
    
    await syncStaffToSuperAdmin(req, User);

    const userToReturn = user.toObject();
    delete userToReturn.password;
    
    res.status(200).json(userToReturn);
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const User = getTenantModel(req, 'User', UserDefault);
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting yourself
    if (req.user?._id && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    
    // Prevent deleting the last admin
    if (user.role === 'Admin') {
      const adminCount = await User.countDocuments({ role: 'Admin' });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last Admin' });
      }
    }

    await User.findByIdAndDelete(req.params.id);

    // Synchronize to SuperAdmin central staffAccounts (removes deleted user)
    await syncStaffToSuperAdmin(req, User);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    if (error.code === 'TENANT_NOT_RESOLVED') return handleTenantError(error, res);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};
