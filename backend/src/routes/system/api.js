import express from "express";
import mongoose from "mongoose";
import { getImageKitAuth } from '../../config/imagekit.js';

const router = express.Router();

// Health check endpoint
router.get("/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const statusMap = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };

  res.json({
    success: true,
    message: "Fish Website Backend is running smoothly",
    database: statusMap[dbState] || "Unknown",
    timestamp: new Date().toISOString(),
  });
});

// ImageKit client-side upload authentication endpoint
router.get("/imagekit/auth", (req, res) => {
  try {
    const authParams = getImageKitAuth();
    res.json(authParams);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate ImageKit authentication parameters",
      error: error.message,
    });
  }
});

export default router;
