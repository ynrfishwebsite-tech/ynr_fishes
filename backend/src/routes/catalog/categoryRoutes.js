import express from 'express';
const router = express.Router();
import { getAllCategories, getAllCategoriesAdmin, createCategory, updateCategory, deleteCategory } from '../../controllers/catalog/categoryController.js';
import { authenticateToken, requireAdmin, optionalAuthenticateToken } from '../../middleware/auth.js';

// Get all categories - with tenant authentication
router.get('/', optionalAuthenticateToken, getAllCategories);

// Get all categories (admin view — read access for all authenticated roles)
router.get('/admin', authenticateToken, getAllCategoriesAdmin);

// Create category
router.post('/', authenticateToken, requireAdmin, createCategory);

// Update category
router.put('/:id', authenticateToken, requireAdmin, updateCategory);

// Delete category
router.delete('/:id', authenticateToken, requireAdmin, deleteCategory);

export default router;