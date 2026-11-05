import mongoose from 'mongoose';

const supplyStockLogSchema = new mongoose.Schema({
  itemName: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    default: null
  },
  supplierName: {
    type: String,
    default: '',
    trim: true
  },
  supplierPhone: {
    type: String,
    default: '',
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    enum: ['Boxes', 'Rolls', 'Blocks', 'Tons', 'Pieces', 'Kg', 'Bags'],
    default: 'Boxes'
  },
  unitRate: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  balanceAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Bank Transfer', 'Credit', 'Cheque'],
    default: 'Cash'
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  performedBy: {
    type: String,
    default: 'Admin'
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

export default mongoose.model('SupplyStockLog', supplyStockLogSchema);

