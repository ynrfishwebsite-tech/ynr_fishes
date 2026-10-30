import mongoose from 'mongoose';

const stockLogSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryItem'
  },
  fishItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu'
  },
  itemName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: [
      'Stock-In',
      'POS Deduction',
      'POS Sale',
      'Online Sale',
      'Procurement (Stock-In)',
      'Wastage/Adjustment',
      'Cutting Wastage',
      'Daily Shrinkage / Drip Loss',
      'Sale Reversal (Refund)',
      'Audit',
      'Initial Stock',
      'Staff Withdrawal'
    ],
    required: true
  },
  quantityChange: {
    type: Number,
    required: true
  },
  finalStock: {
    type: Number,
    required: true
  },
  grossKgChange: {
    type: Number,
    default: 0
  },
  balanceGrossKg: {
    type: Number,
    default: 0
  },
  cutType: {
    type: String,
    default: ''
  },
  billNumber: {
    type: String,
    default: ''
  },
  orderChannel: {
    type: String,
    default: 'Counter-Retail'
  },
  unit: {
    type: String,
    default: 'kg'
  },
  notes: {
    type: String,
    default: ''
  },
  performedBy: {
    type: String,
    default: 'System / Admin'
  }
}, {
  timestamps: true
});

stockLogSchema.index({ createdAt: -1 });
stockLogSchema.index({ item: 1, createdAt: -1 });

export default mongoose.model('StockLog', stockLogSchema);
