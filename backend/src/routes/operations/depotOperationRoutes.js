import express from 'express';
import {
  getOperationsSummary,
  getOperationsList,
  createOperationEntry,
  getSuppliers,
  createSupplier
} from '../../controllers/operations/depotOperationController.js';

const router = express.Router();

// Operations Endpoints
router.get('/summary', getOperationsSummary);
router.get('/list', getOperationsList);
router.post('/entry', createOperationEntry);

// Suppliers Endpoints
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);

export default router;
