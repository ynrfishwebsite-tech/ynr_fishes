import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./src/config/db.js";
import apiRoutes from './src/routes/system/api.js';
import authRoutes from './src/routes/auth/authRoutes.js';
import superAdminRoutes from './src/routes/system/superAdminRoutes.js';
import menuRoutes from './src/routes/catalog/menuRoutes.js';
import categoryRoutes from './src/routes/catalog/categoryRoutes.js';
import billRoutes from './src/routes/billing/billRoutes.js';
import expenseRoutes from './src/routes/finance/expenseRoutes.js';
import cashLogRoutes from './src/routes/finance/cashLogRoutes.js';
import creditAccountRoutes from './src/routes/finance/creditAccountRoutes.js';
import customerRoutes from './src/routes/crm/customerRoutes.js';
import staffRoutes from './src/routes/operations/staffRoutes.js';
import printerConfigRoutes from './src/routes/operations/printerConfigRoutes.js';
import whatsappRoutes from './src/routes/communication/whatsappRoutes.js';
import analyticsRoutes from './src/routes/analytics/analyticsRoutes.js';
import configRoutes from './src/routes/system/configRoutes.js';
import adminRoutes from './src/routes/system/adminRoutes.js';
import inventoryRoutes from './src/routes/inventory/inventoryRoutes.js';
import calculatorRoutes from './src/routes/finance/calculatorRoutes.js';
import vehicleRoutes from './src/routes/operations/vehicleRoutes.js';
import depotOperationRoutes from './src/routes/operations/depotOperationRoutes.js';
import { ensureSuperAdmin } from './src/utils/database/seedSuperAdmin.js';

import http from "http";
import { Server } from "socket.io";

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  },
});

app.locals.io = io;

io.on("connection", (socket) => {
  socket.on("joinTenant", (data) => {
    const room = typeof data === "object" ? data?.tenantDb : data;
    if (room) {
      socket.join(room);
    }
  });

  socket.on("clientNotification", (notif) => {
    if (notif) {
      socket.broadcast.emit("new_notification", notif);
    }
  });

  // Real-time Vehicle Tracking GPS (Option 1)
  socket.on("vehicle:send_location", (locationData) => {
    if (locationData && locationData.vehicleNumber) {
      io.emit("vehicle:location_stream", locationData);
    }
  });
});

import { telemetryMiddleware } from './src/middleware/telemetryMiddleware.js';

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(telemetryMiddleware);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Core System & Portal Routes
app.use("/api", apiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/superadmin", superAdminRoutes);

// Enterprise Billing & Operations Modules
app.use("/api/menu", menuRoutes);
app.use("/api/catalog/menu", menuRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/catalog/category", categoryRoutes);
app.use("/api/catalog/categories", categoryRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/cash-log", cashLogRoutes);
app.use("/api/credit-accounts", creditAccountRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/operations", depotOperationRoutes);
app.use("/api/suppliers", depotOperationRoutes);
app.use("/api/printer-config", printerConfigRoutes);
app.use("/api/printer-configs", printerConfigRoutes);
app.get("/api/discounts", (req, res) => res.json([]));
app.use("/api/inventory", inventoryRoutes);
app.use("/api/calculator", calculatorRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/config", configRoutes);


// Root route
app.get("/", (req, res) => {
  res.json({
    name: "YNR Fishes Enterprise Billing & Management API",
    status: "online",
    roles: ["super-admin", "admin", "manager", "worker"],
    endpoints: {
      health: "/api/health",
      authLogin: "POST /api/auth/login",
      authMe: "GET /api/auth/me",
      branches: "GET /api/auth/branches",
      imagekitAuth: "GET /api/imagekit/auth",
    },
  });
});

// Start Server and Connect DB
const startServer = async () => {
  try {
    const conn = await connectDB();
    if (conn) {
      await ensureSuperAdmin();
    }
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Server] Port ${PORT} is busy/in-use, retrying in 2s...`);
        setTimeout(() => {
          server.close(() => {});
          server.listen(PORT, "0.0.0.0");
        }, 2000);
      } else {
        console.error('[Server] Server error:', err);
      }
    });
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[Server] YNR Fishes API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("[Server] Startup failed:", err);
  }
};

startServer();

