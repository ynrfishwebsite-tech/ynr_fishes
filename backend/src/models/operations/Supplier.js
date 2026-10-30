import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  phone: {
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

supplierSchema.index({ name: 'text', phone: 'text', harbor: 'text' });

export default mongoose.model('Supplier', supplierSchema);
