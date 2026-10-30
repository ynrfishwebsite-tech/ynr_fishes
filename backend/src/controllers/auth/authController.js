import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from '../../models/auth/User.js';
import { Branch } from '../../models/auth/Branch.js';

// Helper: Generate JWT token with full branch and tenantDb isolation payload
const generateToken = (id, role, branch = null) => {
  const branchCode = branch?.code ? branch.code.toLowerCase() : null;
  const tenantDb = role === 'super-admin' ? 'fishes' : (branchCode || 'fishes');

  return jwt.sign(
    {
      id,
      role,
      tenantDb,
      db: tenantDb,
      branchCode: branchCode ? branchCode.toUpperCase() : null,
      branch: branch || null
    },
    process.env.JWT_SECRET || "ynr_fishes_super_secret_jwt_key_2026_enterprise",
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

const generateRefreshToken = (id, role, branch = null) => {
  const branchCode = branch?.code ? branch.code.toLowerCase() : null;
  const tenantDb = role === 'super-admin' ? 'fishes' : (branchCode || 'fishes');

  return jwt.sign(
    {
      id,
      role,
      tenantDb,
      db: tenantDb,
      branchCode: branchCode ? branchCode.toUpperCase() : null,
      branch: branch || null
    },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "ynr_fishes_super_secret_jwt_key_2026_enterprise",
    {
      expiresIn: "30d",
    }
  );
};

// @desc    Login user (Super-Admin, Admin, Manager, Worker)
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please enter your username/email and password",
      });
    }

    const cleanId = identifier.trim().toLowerCase();
    const isDbConnected = mongoose.connection.readyState === 1;

    if (!isDbConnected) {
      return res.status(503).json({
        success: false,
        message: "Database connection unavailable. Please ensure MongoDB is running.",
      });
    }

    let user = null;
    let foundInDb = 'fishes';

    // 1. Search primary database (fishes)
    user = await User.findOne({
      $or: [{ email: cleanId }, { username: cleanId }],
    })
      .select("+password")
      .populate("branch");

    // 2. If not found in primary DB, search across active branch databases (kdp, vzg, etc.)
    if (!user) {
      try {
        const branches = await Branch.find({ isActive: true }).lean();
        for (const b of branches) {
          const branchDbName = (b.code || '').toLowerCase();
          if (!branchDbName || branchDbName === 'fishes') continue;

          try {
            const tenantDbConn = mongoose.connection.useDb(branchDbName, { useCache: true });
            const TenantUser = tenantDbConn.models.User || tenantDbConn.model('User', User.schema);

            const tenantUser = await TenantUser.findOne({
              $or: [{ email: cleanId }, { username: cleanId }],
            }).select("+password");

            if (tenantUser) {
              user = tenantUser;
              foundInDb = branchDbName;
              if (!user.branch) {
                user.branch = b;
              } else if (typeof user.branch === 'object' && !user.branch.code) {
                user.branch = b;
              }
              break;
            }
          } catch (tenantErr) {
            // Continue searching next branch DB
          }
        }
      } catch (branchErr) {
        console.warn("[Auth Login] Error checking branch databases:", branchErr.message);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account has been deactivated. Please contact your Super-Admin.",
      });
    }

    // Update lastLogin if DB is connected and it's a Mongoose document
    if (isDbConnected && typeof user.save === "function") {
      user.lastLogin = new Date();
      await user.save({ validateBeforeSave: false });
    }

    // Ensure resolvedBranch has code and city
    let resolvedBranch = user.branch;
    if (user.role === 'super-admin') {
      foundInDb = 'fishes';
    } else {
      if (!resolvedBranch || !resolvedBranch.code) {
        if (user.branch) {
          const bDoc = await Branch.findById(user.branch).lean();
          if (bDoc) resolvedBranch = bDoc;
        }
      }
      if (!resolvedBranch && foundInDb && foundInDb !== 'fishes') {
        const bDoc = await Branch.findOne({ code: new RegExp(`^${foundInDb}$`, 'i') }).lean();
        if (bDoc) resolvedBranch = bDoc;
      }
      if (resolvedBranch?.code) {
        foundInDb = resolvedBranch.code.toLowerCase();
      }
    }

    const userId = user._id || user.id;
    const token = generateToken(userId, user.role, resolvedBranch);
    const refreshTokenValue = generateRefreshToken(userId, user.role, resolvedBranch);

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}! Logged in as ${user.role.toUpperCase()}`,
      token,
      accessToken: token,
      refreshToken: refreshTokenValue,
      tenantDb: foundInDb,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        permittedPages: user.permittedPages || [],
        branch: resolvedBranch || null,
        tenantDb: foundInDb,
        lastLogin: user.lastLogin || new Date(),
      },
    });
  } catch (error) {
    console.error("[Login Error]:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication",
      error: error.message,
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private (Bearer Token)
export const getMe = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: {
        id: req.user._id || req.user.id,
        name: req.user.name,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role,
        permittedPages: req.user.permittedPages || [],
        branch: req.user.branch || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Could not retrieve user session",
    });
  }
};

// @desc    Get all branches
// @route   GET /api/auth/branches
// @access  Public
export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find({ isActive: true }).sort({ name: 1 });
    return res.json({ success: true, branches });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message, branches: [] });
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
// @access  Public
export const refreshToken = async (req, res) => {
  const { refreshToken: token, token: legacyToken } = req.body || {};
  const tokenToVerify = token || legacyToken;

  if (!tokenToVerify) {
    return res.status(401).json({ success: false, message: 'Refresh token required' });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(
        tokenToVerify,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "ynr_fishes_super_secret_jwt_key_2026_enterprise"
      );
    } catch {
      decoded = jwt.verify(tokenToVerify, "ynr_fishes_secret_key");
    }

    const userId = decoded.id;
    const user = await User.findById(userId).populate('branch');

    if (!user) {
      return res.status(403).json({ success: false, message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const newAccessToken = generateToken(userId, user.role, user.branch);
    const newRefreshToken = generateRefreshToken(userId, user.role, user.branch);

    return res.json({
      success: true,
      accessToken: newAccessToken,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: userId,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        permittedPages: user.permittedPages || [],
        branch: user.branch || null,
      },
    });
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};
