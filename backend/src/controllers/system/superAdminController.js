import mongoose from 'mongoose';
import { Branch } from '../../models/auth/Branch.js';
import { User } from '../../models/auth/User.js';
import { Broadcast } from '../../models/communication/Broadcast.js';
import bcrypt from "bcryptjs";

// ================= BRANCH MANAGEMENT =================

export const getBranches = async (req, res) => {
  try {
    const branches = await Branch.find().sort({ createdAt: -1 });
    const userCounts = await User.aggregate([
      { $group: { _id: "$branch", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    userCounts.forEach((uc) => {
      if (uc._id) countMap[uc._id.toString()] = uc.count;
    });

    const branchesWithCounts = branches.map((b) => ({
      ...b.toObject(),
      staffCount: countMap[b._id.toString()] || 0,
    }));

    res.json({ success: true, branches: branchesWithCounts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBranch = async (req, res) => {
  try {
    const { name, code, city, state, address, phone } = req.body;
    if (!name || !code || !city) {
      return res.status(400).json({
        success: false,
        message: "Branch Name, Code and City are required",
      });
    }

    const existingCode = await Branch.findOne({ code: code.trim().toUpperCase() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Branch with code '${code}' already exists`,
      });
    }

    const branch = await Branch.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      city: city.trim(),
      state: state || "Andhra Pradesh",
      address: address || "",
      phone: phone || "",
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: `Branch '${branch.name}' created successfully`,
      branch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, city, state, address, phone, isActive } = req.body;

    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    if (name) branch.name = name.trim();
    if (code) branch.code = code.trim().toUpperCase();
    if (city) branch.city = city.trim();
    if (state !== undefined) branch.state = state;
    if (address !== undefined) branch.address = address;
    if (phone !== undefined) branch.phone = phone;
    if (isActive !== undefined) branch.isActive = isActive;

    await branch.save();
    res.json({ success: true, message: "Branch updated successfully", branch });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findById(id);
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    // Check if staff are assigned to this branch
    const assignedStaff = await User.countDocuments({ branch: id });
    if (assignedStaff > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete branch: ${assignedStaff} staff member(s) are assigned to it. Please reassign them first or deactivate the branch.`,
      });
    }

    await Branch.findByIdAndDelete(id);
    res.json({ success: true, message: `Branch '${branch.name}' deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= STAFF / USER MANAGEMENT =================

export const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate("branch", "name code city")
      .sort({ createdAt: -1 });

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, username, password, role, branch, phone } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and role are required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username ? username.trim().toLowerCase() : cleanEmail.split("@")[0];

    // Check existing
    const existing = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A staff account with this email or username already exists",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      username: cleanUsername,
      password: password, // Pre-save hook hashes it
      role: role,
      branch: branch || null,
      phone: phone || "",
      isActive: true,
    });

    const populatedUser = await User.findById(user._id).populate("branch", "name code city");

    // Sync to branch's isolated tenant database (Option A)
    if (populatedUser?.branch?.code) {
      try {
        const branchDbName = populatedUser.branch.code.toLowerCase();
        const tenantConn = mongoose.connection.useDb(branchDbName, { useCache: true });
        await tenantConn.collection('users').replaceOne(
          { _id: user._id },
          user.toObject(),
          { upsert: true }
        );
      } catch (err) {
        console.warn(`[superAdmin] Warning syncing user to branch DB:`, err.message);
      }
    }

    res.status(201).json({
      success: true,
      message: `Staff member '${populatedUser.name}' (${populatedUser.role.toUpperCase()}) created successfully`,
      user: populatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, username, role, branch, phone, isActive, password } = req.body;

    const user = await User.findById(id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const previousBranchId = user.branch ? user.branch.toString() : null;

    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (username) user.username = username.trim().toLowerCase();
    if (role) user.role = role;
    if (branch !== undefined) user.branch = branch || null;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;

    if (password && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }
      user.password = password.trim(); // UserSchema.pre("save") hashes it automatically
    }

    await user.save();
    const updated = await User.findById(id).populate("branch", "name code city");

    // Clean up from previous branch DB if branch assignment changed
    const newBranchId = updated?.branch?._id ? updated.branch._id.toString() : (updated?.branch ? updated.branch.toString() : null);
    if (previousBranchId && previousBranchId !== newBranchId) {
      try {
        const prevBranch = await Branch.findById(previousBranchId);
        if (prevBranch?.code) {
          const prevDbName = prevBranch.code.toLowerCase();
          const prevConn = mongoose.connection.useDb(prevDbName, { useCache: true });
          await prevConn.collection('users').deleteOne({ _id: user._id });
        }
      } catch (err) {
        console.warn(`[superAdmin] Warning removing user from old branch DB:`, err.message);
      }
    }

    // Sync to branch's isolated tenant database (Option A)
    if (updated?.branch?.code) {
      try {
        const branchDbName = updated.branch.code.toLowerCase();
        const tenantConn = mongoose.connection.useDb(branchDbName, { useCache: true });
        const userObj = user.toObject();
        await tenantConn.collection('users').replaceOne(
          { _id: user._id },
          userObj,
          { upsert: true }
        );
      } catch (err) {
        console.warn(`[superAdmin] Warning syncing user to branch DB:`, err.message);
      }
    }

    res.json({ success: true, message: "Staff user updated successfully", user: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword, password } = req.body;
    const passToUse = newPassword || password;

    if (!passToUse || passToUse.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      });
    }

    const user = await User.findById(id).select("+password").populate("branch", "code");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Assign plain password; UserSchema.pre("save") hook performs the bcrypt salt & hash once.
    // Do NOT manually call bcrypt.hash here as it causes double-hashing on pre-save!
    user.password = passToUse.trim();
    await user.save();

    // Sync to branch's isolated tenant database (Option A)
    if (user?.branch?.code) {
      try {
        const branchDbName = user.branch.code.toLowerCase();
        const tenantConn = mongoose.connection.useDb(branchDbName, { useCache: true });
        await tenantConn.collection('users').updateOne(
          { _id: user._id },
          { $set: { password: user.password } }
        );
      } catch (err) {
        console.warn(`[superAdmin] Warning syncing password to branch DB:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `Password reset successfully for '${user.name}'`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate("branch", "code");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    // Sync to branch's isolated tenant database (Option A)
    if (user?.branch?.code) {
      try {
        const branchDbName = user.branch.code.toLowerCase();
        const tenantConn = mongoose.connection.useDb(branchDbName, { useCache: true });
        await tenantConn.collection('users').updateOne(
          { _id: user._id },
          { $set: { isActive: user.isActive } }
        );
      } catch (err) {
        console.warn(`[superAdmin] Warning syncing status to branch DB:`, err.message);
      }
    }

    res.json({
      success: true,
      message: `User '${user.name}' is now ${user.isActive ? "ACTIVE" : "DEACTIVATED"}`,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate("branch", "code");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role === "super-admin") {
      const superAdminCount = await User.countDocuments({ role: "super-admin" });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot delete the sole Super-Admin account",
        });
      }
    }

    // Remove from branch's isolated tenant database (Option A)
    if (user?.branch?.code) {
      try {
        const branchDbName = user.branch.code.toLowerCase();
        const tenantConn = mongoose.connection.useDb(branchDbName, { useCache: true });
        await tenantConn.collection('users').deleteOne({ _id: user._id });
      } catch (err) {
        console.warn(`[superAdmin] Warning deleting user from branch DB:`, err.message);
      }
    }

    await User.findByIdAndDelete(id);
    res.json({ success: true, message: `User '${user.name}' deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ANALYTICS =================

export const getAnalytics = async (req, res) => {
  try {
    const totalBranches = await Branch.countDocuments();
    const activeBranches = await Branch.countDocuments({ isActive: true });
    const totalStaff = await User.countDocuments();
    const activeStaff = await User.countDocuments({ isActive: true });

    const roleCounts = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]);

    const rolesMap = {
      "super-admin": 0,
      admin: 0,
      manager: 0,
      worker: 0,
    };
    roleCounts.forEach((r) => {
      rolesMap[r._id] = r.count;
    });

    res.json({
      success: true,
      analytics: {
        totalBranches,
        activeBranches,
        totalStaff,
        activeStaff,
        rolesMap,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= ANNOUNCEMENTS / BROADCASTS =================

export const getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate("targetBranch", "name code city")
      .sort({ createdAt: -1 });

    res.json({ success: true, broadcasts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBroadcast = async (req, res) => {
  try {
    const { title, message, priority, targetBranch } = req.body;
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: "Title and message are required",
      });
    }

    const broadcast = await Broadcast.create({
      title: title.trim(),
      message: message.trim(),
      priority: priority || "info",
      targetBranch: targetBranch || null,
      createdBy: req.user?.name || "Super-Admin",
    });

    const populated = await Broadcast.findById(broadcast._id).populate(
      "targetBranch",
      "name code city"
    );

    res.status(201).json({
      success: true,
      message: "Announcement broadcasted successfully",
      broadcast: populated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    await Broadcast.findByIdAndDelete(id);
    res.json({ success: true, message: "Announcement deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
