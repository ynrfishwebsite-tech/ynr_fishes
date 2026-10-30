import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from '../models/auth/User.js';

// Protect routes: verify JWT Bearer token
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "ynr_fishes_secret_key"
      );

      let user = null;
      if (mongoose.connection.readyState === 1 && decoded.id) {
        user = await User.findById(decoded.id).populate("branch");
        if (!user && (decoded.tenantDb || decoded.branchCode)) {
          const targetDbName = (decoded.tenantDb || decoded.branchCode).toLowerCase();
          if (targetDbName && targetDbName !== 'fishes') {
            try {
              const tenantConn = mongoose.connection.useDb(targetDbName, { useCache: true });
              const TenantUser = tenantConn.models.User || tenantConn.model('User', User.schema);
              user = await TenantUser.findById(decoded.id);
              if (!user && decoded.username) {
                user = await TenantUser.findOne({ username: decoded.username });
              }
              if (user && decoded.branch) {
                user.branch = decoded.branch;
              }
            } catch (e) {}
          }
        }
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User account no longer exists",
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account has been deactivated. Please contact Super-Admin.",
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error("[Auth] Token verification error:", error.message);
      return res.status(401).json({
        success: false,
        message: "Not authorized or token expired",
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }
};

// Authorize roles: check if user's role is permitted
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: role '${req.user?.role}' is not authorized to access this resource`,
      });
    }
    next();
  };
};
