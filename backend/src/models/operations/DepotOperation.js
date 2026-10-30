import mongoose from 'mongoose';

const depotOperationSchema = new mongoose.Schema({
  operationType: {
    type: String,
    enum: [
      'Import',
      'Export',
      'Sales',
      'Expenses',
      'Purchase',
      'Purchase Return',
      'Sales Return',
      'Vehicle / Others'
    ],
    required: true,
    index: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  referenceNo: {
    type: String,
    default: ''
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
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
  harbor: {
    type: String,
    default: '',
    trim: true
  },
  customerName: {
    type: String,
    default: '',
    trim: true
  },
  customerPhone: {
    type: String,
    default: '',
    trim: true
  },
  destinationCity: {
    type: String,
    default: '',
    trim: true
  },
  vehicleNumber: {
    type: String,
    default: '',
    trim: true
  },
  driverName: {
    type: String,
    default: '',
    trim: true
  },
  fishName: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    default: ''
  },
  boxesCount: {
    type: Number,
    default: 0
  },
  grossWeightKg: {
    type: Number,
    default: 0
  },
  iceDeductionKg: {
    type: Number,
    default: 0
  },
  netWeightKg: {
    type: Number,
    default: 0
  },
  ratePerKg: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  balanceAmount: {
    type: Number,
    default: 0
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Khata / Credit', 'Bank Transfer'],
    default: 'Cash'
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'In-Transit', 'Cancelled'],
    default: 'Completed'
  },
  notes: {
    type: String,
    default: ''
  },
  performedBy: {
    type: String,
    default: 'Admin'
  }
}, {
  timestamps: true
});

depotOperationSchema.index({ operationType: 1, date: -1 });

export default mongoose.model('DepotOperation', depotOperationSchema);
