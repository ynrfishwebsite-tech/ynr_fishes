import express from 'express';
import {
  getSupplyCategories,
  createSupplyCategory,
  recordSupplyStockIn,
  getSupplyLogs
} from '../../controllers/operations/supplyController.js';

const router = express.Router();

router.get('/categories', getSupplyCategories);
router.post('/categories', createSupplyCategory);
router.post('/stock-in', recordSupplyStockIn);
router.get('/logs', getSupplyLogs);

export default router;

