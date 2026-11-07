import express from 'express';
import { optionalAuthenticateToken } from '../../middleware/auth.js';
import {
  getOperationsSummary,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../../controllers/operations/depotOperationController.js';

const router = express.Router();

// Operations Summary for Second Dashboard
router.get('/summary', optionalAuthenticateToken, getOperationsSummary);

// Suppliers Endpoints
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

router.get('/', getSuppliers);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;
