import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  profileImage: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  companyName: {
    type: String,
    default: '',
    trim: true
  },
  phone: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  supplierType: {
    type: String,
    enum: ['Local', 'DAM', 'Consumables', 'All'],
    default: 'Local',
    index: true
  },
  vehicleNumber: {
    type: String,
    default: '',
    trim: true
  },
  harbor: {
    type: String,
    default: '',
    trim: true
  },
  city: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: '',
    trim: true
  },
  contactPerson: {
    type: String,
    default: '',
    trim: true
  },
  balance: {
    type: Number,
    default: 0
  },
  bankDetails: {
    accountNo: { type: String, default: '' },
    bankName: { type: String, default: '' },
    ifsc: { type: String, default: '' },
    upiId: { type: String, default: '' }
  },
  notes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  }
}, {
  timestamps: true
});

supplierSchema.index({ name: 'text', companyName: 'text', phone: 'text', harbor: 'text', vehicleNumber: 'text' });

export default mongoose.model('Supplier', supplierSchema);
