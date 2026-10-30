import express from "express";
import { login, getMe, getBranches, refreshToken } from '../../controllers/auth/authController.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post("/login", login);
router.post("/refresh", refreshToken);
router.get("/branches", getBranches);

// Protected routes
router.get("/me", protect, getMe);

export default router;
