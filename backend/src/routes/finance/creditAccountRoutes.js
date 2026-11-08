import express from 'express';
import {
  getCreditAccounts,
  createCreditAccount,
  addTransaction,
  getKhataAccounts,
  getKhataLedger,
  settleKhataPayment,
  sendKhataReminder
} from '../../controllers/finance/creditAccountController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../../middleware/auth.js';

const router = express.Router();

// ─── LEGACY routes ──────────────────────────────────
router.route('/')
  .get(protect, getCreditAccounts)
  .post(protect, admin, createCreditAccount);

router.route('/:id/transactions')
  .post(protect, admin, addTransaction);

// ─── KHATA BOOK routes ───────────────────────────────
// GET  /api/credit-accounts/khata              → paginated accounts list + stats
// GET  /api/credit-accounts/khata/:phone/ledger → ledger (unpaid bills + payment history)
// POST /api/credit-accounts/khata/settle        → record a payment settlement
// POST /api/credit-accounts/khata/send-reminder → send instant WhatsApp balance reminder

router.get('/khata', protect, getKhataAccounts);
router.get('/khata/:phoneNumber/ledger', protect, getKhataLedger);
router.post('/khata/settle', protect, settleKhataPayment);
router.post('/khata/send-reminder', protect, sendKhataReminder);

export default router;
