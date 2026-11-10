import express from 'express';
import { 
  getCustomerInfo, 
  getAllCustomers, 
  createOrUpdateCustomer, 
  updateCustomerType, 
  searchCustomers,
  deleteCustomer,
  markCustomerPresence
} from '../../controllers/crm/customerController.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { authenticateToken as protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

// Daily Presence / Attendance (Wholesale / Dealer)
router.post('/presence', protect, markCustomerPresence);
router.post('/:phone/presence', protect, markCustomerPresence);

// Get all customers with filters (Admin/Manager/Cashier - CRM access)
router.get('/', protect, getAllCustomers);

// Create or update customer (Cashier/Admin CRM)
router.post('/', protect, createOrUpdateCustomer);

// Update customer order type / category directly
router.patch('/:phone/type', protect, updateCustomerType);
router.put('/:phone/type', protect, updateCustomerType);

// Delete customer
router.delete('/:phone', protect, deleteCustomer);

// Search customers by phone / name / category
router.get('/search', protect, searchCustomers);

// Get customer info for CRM/Upsell
router.get('/:phone', protect, getCustomerInfo);

export default router;
