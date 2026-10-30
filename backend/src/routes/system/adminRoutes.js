import express from 'express';
import { getUsers, createUser, updateUser, deleteUser, getRolesAndPages } from '../../controllers/system/adminController.js';
import { authenticateToken, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();

router.get('/roles-and-pages', authenticateToken, requireAdmin, getRolesAndPages);

router.route('/users')
  .get(authenticateToken, requireAdmin, getUsers)
  .post(authenticateToken, requireAdmin, createUser);

router.route('/users/:id')
  .put(authenticateToken, requireAdmin, updateUser)
  .delete(authenticateToken, requireAdmin, deleteUser);

export default router;
