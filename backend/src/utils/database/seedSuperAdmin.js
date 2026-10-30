import { User } from '../../models/auth/User.js';

/**
 * Ensures that one resilient, powerful Super-Admin account always exists in the database.
 * Runs on backend startup; does not create dummy branches, demo workers, or menu data.
 */
export const ensureSuperAdmin = async () => {
  try {
    const superAdminName = process.env.SUPER_ADMIN_NAME || "YNR Super Administrator";
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@ynrfishes.com";
    const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || "superadmin";
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@2026";
    const superAdminPhone = process.env.SUPER_ADMIN_PHONE || "+91 98493 13889";

    const existingSuperAdmin = await User.findOne({
      $or: [
        { role: "super-admin" },
        { email: superAdminEmail },
        { username: superAdminUsername },
      ],
    });

    if (!existingSuperAdmin) {
      console.log("[Auth Seed] No Super-Admin found. Initializing primary Super-Admin...");
      await User.create({
        name: superAdminName,
        email: superAdminEmail,
        username: superAdminUsername,
        password: superAdminPassword,
        role: "super-admin",
        phone: superAdminPhone,
        isActive: true,
        permittedPages: [
          "billing",
          "active-orders",
          "bill-history",
          "superadmin",
          "branches",
          "staff",
          "reports",
          "telemetry",
          "broadcasts",
          "settings",
          "categories",
          "menu",
        ],
      });
      console.log(`[Auth Seed] ✅ Super-Admin created: ${superAdminEmail} (${superAdminUsername})`);
    } else {
      // Ensure super-admin role and active status are preserved
      let modified = false;
      if (existingSuperAdmin.role !== "super-admin") {
        existingSuperAdmin.role = "super-admin";
        modified = true;
      }
      if (!existingSuperAdmin.isActive) {
        existingSuperAdmin.isActive = true;
        modified = true;
      }
      if (modified) {
        await existingSuperAdmin.save({ validateBeforeSave: false });
        console.log(`[Auth Seed] ✅ Verified and restored Super-Admin permissions: ${existingSuperAdmin.email}`);
      } else {
        console.log(`[Auth Seed] Super-Admin verified: ${existingSuperAdmin.email}`);
      }
    }
  } catch (error) {
    console.error("[Auth Seed Error]: Failed to ensure Super-Admin:", error.message);
  }
};
