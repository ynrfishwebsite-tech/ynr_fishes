import express from "express";
import {
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getUsers,
  createUser,
  updateUser,
  resetUserPassword,
  toggleUserStatus,
  deleteUser,
  getAnalytics,
  getBroadcasts,
  createBroadcast,
  deleteBroadcast,
} from '../../controllers/system/superAdminController.js';
import {
  getTelemetryOverview,
  getStorageAndServices,
  getWhatsAppDataMatrix
} from '../../controllers/system/telemetryController.js';
import { protect, authorize } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Enforce Super-Admin authentication for all routes in this router
router.use(protect);
router.use(authorize("super-admin"));

// Branch Management
router.get("/branches", getBranches);
router.post("/branches", createBranch);
router.put("/branches/:id", updateBranch);
router.delete("/branches/:id", deleteBranch);

// Staff / User RBAC Management
router.get("/users", getUsers);
router.post("/users", createUser);
router.put("/users/:id", updateUser);
router.put("/users/:id/password", resetUserPassword);
router.put("/users/:id/toggle-status", toggleUserStatus);
router.delete("/users/:id", deleteUser);

// Analytics
router.get("/analytics", getAnalytics);

// Broadcasts / Notices
router.get("/broadcasts", getBroadcasts);
router.post("/broadcasts", createBroadcast);
router.delete("/broadcasts/:id", deleteBroadcast);

// Real-Time Telemetry & SaaS Health
router.get("/telemetry/overview", getTelemetryOverview);
router.get("/telemetry/storage-services", getStorageAndServices);
router.get("/telemetry/whatsapp-matrix", getWhatsAppDataMatrix);

export default router;

