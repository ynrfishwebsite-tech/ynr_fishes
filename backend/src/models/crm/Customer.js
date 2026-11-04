import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: ''
  },
  businessName: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    enum: ['Retail', 'Wholesale', 'Export'],
    default: 'Retail',
    index: true
  },
  exportSubCategory: {
    type: String,
    enum: ['Local', 'DAM', null, ''],
    default: null,
    index: true
  },
  address: {
    line1: { type: String, default: '' },
    area: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: 'Andhra Pradesh' },
    pincode: { type: String, default: '' },
    fullAddress: { type: String, default: '' }
  },
  photo: {
    type: String,
    default: ''
  },
  totalVisits: {
    type: Number,
    default: 0
  },
  totalSpend: {
    type: Number,
    default: 0
  },
  lastVisit: {
    type: Date,
    default: Date.now
  },
  isVIP: {
    type: Boolean,
    default: false
  },
  favoriteItems: [{
    itemName: String,
    count: Number
  }],
  points: {
    type: Number,
    default: 0
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  lastOrderType: {
    type: String,
    enum: ['Dine-In', 'Delivery', 'Takeaway', 'Pick Up', 'Retail', 'Wholesale', 'Export', ''],
    default: 'Retail'
  },
  tier: {
    type: String,
    enum: ['Silver', 'Gold', 'Platinum VIP'],
    default: 'Silver'
  },
  pointsExpiryDate: {
    type: Date,
    default: null
  },
  expiryWarningSent: {
    type: Boolean,
    default: false
  },
  feedbackWhatsAppSent: {
    type: Boolean,
    default: false
  },
  lastWinbackSentDate: {
    type: Date,
    default: null
  },
  redemptionOtp: {
    type: String,
    default: null
  },
  redemptionOtpExpiry: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for fast customer search, leaderboards, and category lookups
customerSchema.index({ lastVisit: -1 });
customerSchema.index({ totalSpend: -1 });
customerSchema.index({ category: 1, exportSubCategory: 1 });
customerSchema.index({ phone: 1, name: 1 });

export default mongoose.model('Customer', customerSchema);
