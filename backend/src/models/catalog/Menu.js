import mongoose from 'mongoose';

const menuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  scientificName: {
    type: String,
    trim: true,
    default: ''
  },
  sellingUnit: {
    type: String,
    enum: ['Kg', 'Grams', 'Box', 'Piece'],
    default: 'Kg'
  },
  pricingType: {
    type: String,
    enum: ['per_kg', 'per_piece', 'per_box'],
    default: 'per_kg'
  },
  allowVariableWeight: {
    type: Boolean,
    default: true
  },
  cuts: [{
    cutName: { type: String, required: true }, // e.g., 'Whole', 'Whole Cleaned', 'Curry Cut', 'Boneless Fillet'
    yieldFactor: { type: Number, default: 0.75, min: 0.1, max: 1.0 }, // e.g., 0.50 means 50% yield
    priceMarkupPercent: { type: Number, default: 0 },
    pricePerKg: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true }
  }],
  purchasePrice: {
    type: Number,
    default: 0,
    min: 0
  },
  lastSupplier: {
    type: String,
    default: ''
  },
  lastProcurementDate: {
    type: Date
  },
  openingStock: {
    type: Number,
    default: 0,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  minStockAlertKg: {
    type: Number,
    default: 5,
    min: 0
  },
  boxPackingKg: {
    type: Number,
    default: 60,
    min: 0
  },
  boxTareWeightKg: {
    type: Number,
    default: 10,
    min: 0
  },
  boxNetFishKg: {
    type: Number,
    default: 50,
    min: 0
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    default: null
  },
  price: {
    type: Number,
    default: 0,
    min: [0, 'Price cannot be negative']
  },
  boxPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  wholesalePricePerKg: {
    type: Number,
    default: 0,
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  type: {
    type: String,
    enum: ['non-veg', 'veg', 'fish', 'seafood'],
    default: 'non-veg'
  },
  description: {
    type: String,
    trim: true
  },
  nameTranslations: {
    hi: { type: String, default: '' },
    te: { type: String, default: '' },
    ta: { type: String, default: '' },
    kn: { type: String, default: '' },
    ml: { type: String, default: '' },
    mr: { type: String, default: '' },
    bn: { type: String, default: '' },
    gu: { type: String, default: '' }
  },
  descriptionTranslations: {
    hi: { type: String, default: '' },
    te: { type: String, default: '' },
    ta: { type: String, default: '' },
    kn: { type: String, default: '' },
    ml: { type: String, default: '' },
    mr: { type: String, default: '' },
    bn: { type: String, default: '' },
    gu: { type: String, default: '' }
  },
  image: {
    type: String,
    trim: true,
    default: ''
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  taxRate: {
    type: Number,
    default: 0,
    min: 0
  },
  hsnCode: {
    type: String,
    trim: true,
    default: ''
  },
  variants: [{
    name: String, // e.g. "Small", "Medium", "Large"
    price: Number
  }]
}, {
  timestamps: true
});

// Add indexes for better performance
menuSchema.index({ isAvailable: 1 });
menuSchema.index({ category: 1 });
menuSchema.index({ name: 1 });
menuSchema.index({ isAvailable: 1, category: 1 });

export default mongoose.model('Menu', menuSchema);
