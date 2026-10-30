import express from 'express';
const router = express.Router();
import { 
  getFishInventory, 
  recordProcurement, 
  recordShrinkage, 
  getLogs, 
  getRestockPredictions
} from '../../controllers/inventory/inventoryController.js';
import { authenticateToken, optionalAuthenticateToken } from '../../middleware/auth.js';

// Seafood Inventory & Stock Endpoints
router.get('/', optionalAuthenticateToken, getFishInventory);

// Mandi/Harbor Procurement & Daily Shrinkage
router.post('/procurement', authenticateToken, recordProcurement);
router.post('/restock', authenticateToken, recordProcurement);
router.post('/shrinkage', authenticateToken, recordShrinkage);

// Audit Ledger & AI Restock Predictions
router.get('/logs', optionalAuthenticateToken, getLogs);
router.get('/predictions', authenticateToken, getRestockPredictions);

export default router;
