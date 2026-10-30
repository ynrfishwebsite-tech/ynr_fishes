import express from 'express';
import { getCustomerInfo, getAllCustomers, createOrUpdateCustomer, updateCustomerType, searchCustomers } from '../../controllers/crm/customerController.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { authenticateToken as protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

// Get all customers (Admin/Manager/Cashier/Captain - CRM access)
router.get('/', protect, getAllCustomers);

// Create or update customer (Cashier/Admin CRM)
router.post('/', protect, createOrUpdateCustomer);

// Update customer order type directly from CRM
router.patch('/:phone/type', protect, updateCustomerType);
router.put('/:phone/type', protect, updateCustomerType);

// Search customers by phone (Cashier)
router.get('/search', protect, searchCustomers);

// Get customer info for CRM/Upsell
router.get('/:phone', protect, getCustomerInfo);

export default router;
