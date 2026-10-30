import express from 'express';
import { getCashLogs, createCashLog, deleteCashLog } from '../../controllers/finance/cashLogController.js';
import { authenticateToken as protect, requireAdmin as admin, requireStaff as staff } from '../../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(protect, staff, getCashLogs)
  .post(protect, staff, createCashLog);

router.route('/:id')
  .delete(protect, admin, deleteCashLog);

export default router;
