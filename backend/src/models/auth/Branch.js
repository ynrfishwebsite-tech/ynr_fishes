import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Branch name is required"],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: [true, "Branch code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      default: "Andhra Pradesh",
    },
    address: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Branch = mongoose.models.Branch || mongoose.model("Branch", branchSchema);
export default Branch;
