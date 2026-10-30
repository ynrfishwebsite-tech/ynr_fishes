import express from 'express';
import { getStaff, addStaff, updateStaff, deleteStaff, clockInOut, getPublicStaff } from '../../controllers/operations/staffController.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { authenticateToken as protect, requireStaff } from '../../middleware/auth.js';

const router = express.Router();

router.use(tenantMiddleware);

router.get('/', protect, requireStaff, getStaff);
router.post('/', protect, requireStaff, addStaff);
router.put('/:id', protect, requireStaff, updateStaff);
router.delete('/:id', protect, requireStaff, deleteStaff);

// Publicly accessible within the tenant context (for the PIN screen and AI Clock-In)
router.get('/public-faces', getPublicStaff);
router.post('/attendance', clockInOut);

export default router;
