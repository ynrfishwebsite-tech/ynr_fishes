import express from 'express';
import {
  getCalculationHistory,
  saveCalculation,
  clearCalculationHistory,
  deleteSingleCalculation
} from '../../controllers/finance/calculatorController.js';
import { optionalAuthenticateToken } from '../../middleware/auth.js';

const router = express.Router();

router.get('/history', optionalAuthenticateToken, getCalculationHistory);
router.post('/history', optionalAuthenticateToken, saveCalculation);
router.delete('/history', optionalAuthenticateToken, clearCalculationHistory);
router.delete('/history/:id', optionalAuthenticateToken, deleteSingleCalculation);

export default router;
