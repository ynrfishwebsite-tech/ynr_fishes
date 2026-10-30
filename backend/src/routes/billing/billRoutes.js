import express from 'express';
const router = express.Router();

import { 
  getActiveOrder, saveOrder, generateBill, settleBill, getOpenOrders, reopenOrder, cancelOrder, refundOrder, updateBillCustomer, clearUnpaidBill
} from '../../controllers/billing/orderController.js';
import { 
  getBills, getBillById, deleteBill, getEditedBills 
} from '../../controllers/billing/billHistoryController.js';
import { 
  getDailyStats 
} from '../../controllers/billing/billStatsController.js';
import { 
  getActiveNotifications, deleteNotification, deleteAllNotifications 
} from '../../controllers/communication/notificationController.js';

import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

// GET routes - authenticated users only
// Order matters: specific routes before parameterized routes
router.get('/active-notifications', authenticateToken, getActiveNotifications);
router.get('/active/:tableNo', authenticateToken, getActiveOrder);
router.get('/open', authenticateToken, getOpenOrders);
router.get('/edited', authenticateToken, getEditedBills);
router.get('/stats', authenticateToken, getDailyStats);
router.get('/', authenticateToken, getBills);
router.get('/:id', authenticateToken, getBillById);

// POST routes - authenticated users only
router.post('/save', authenticateToken, saveOrder);
router.post('/generate/:id', authenticateToken, generateBill);
router.post('/reopen/:id', authenticateToken, reopenOrder);
router.post('/cancel/:id', authenticateToken, cancelOrder);
router.post('/settle/:id', authenticateToken, settleBill);
router.post('/clear-unpaid/:id', authenticateToken, clearUnpaidBill);
router.post('/refund/:id', authenticateToken, refundOrder);
router.patch('/:id/customer', authenticateToken, updateBillCustomer);
router.put('/:id/customer', authenticateToken, updateBillCustomer);

// DELETE notification routes - authenticated users
router.delete('/notifications/all', authenticateToken, deleteAllNotifications);
router.delete('/notifications/:id', authenticateToken, deleteNotification);

// DELETE - Requires password verification in controller
router.delete('/:id', authenticateToken, deleteBill);

export default router;
