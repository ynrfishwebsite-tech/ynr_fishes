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

// Proxy external image to bypass CORS and prevent tainted canvas
router.get("/proxy-image", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return res.status(400).json({ success: false, message: "Valid image URL required" });
    }
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: "Failed to fetch image" });
    }
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to proxy image",
      error: error.message,
    });
  }
});

export default router;
