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
  supplierName: {
    type: String,
    default: '',
    index: true
  },
  companyName: {
    type: String,
    default: ''
  },
  vehicleNumber: {
    type: String,
    default: ''
  },
  harbor: {
    type: String,
    default: ''
  },
  invoiceNo: {
    type: String,
    default: '',
    index: true
  },
  supplierPhone: {
    type: String,
    default: ''
  },
  rate: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    default: 0
  },
  intakeMode: {
    type: String,
    default: 'local'
  },
  paymentMode: {
    type: String,
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Partially Paid', 'Unpaid', 'Credit', 'Settled'],
    default: 'Paid'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  paymentBreakdown: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  chequeDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  bankDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  grossValue: {
    type: Number,
    default: 0
  },
  netPayable: {
    type: Number,
    default: 0
  },
  totalCr: {
    type: Number,
    default: 0
  },
  totalDr: {
    type: Number,
    default: 0
  },
  totalBoxes: {
    type: Number,
    default: 0
  },
  settlements: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  customSettlements: {
    type: Array,
    default: []
  },
  consignmentItems: {
    type: Array,
    default: []
  },
  boxes: {
    type: Number,
    default: 0
  },
  kgPerBox: {
    type: Number,
    default: 0
  },
  crateReference: {
    type: String,
    default: ''
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
stockLogSchema.index({ type: 1, createdAt: -1 });

export default mongoose.model('StockLog', stockLogSchema);
