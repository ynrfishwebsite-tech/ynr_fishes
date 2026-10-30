import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  modelName: {
    type: String,
    required: true,
    trim: true
  },
  vehicleType: {
    type: String,
    enum: ['Pickup Truck', 'Delivery Van', 'Three Wheeler Auto', 'Mini Truck', 'Reefer Truck', 'Two-Wheeler', 'Other'],
    default: 'Pickup Truck'
  },
  driverName: {
    type: String,
    trim: true,
    default: ''
  },
  driverPhone: {
    type: String,
    trim: true,
    default: ''
  },
  currentKm: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  fuelType: {
    type: String,
    enum: ['Diesel', 'Petrol', 'CNG', 'Electric'],
    default: 'Diesel'
  },
  status: {
    type: String,
    enum: ['Available', 'On Trip', 'In Maintenance', 'Idle', 'Out of Service'],
    default: 'Available'
  },
  tankCapacity: {
    type: Number,
    default: 45
  },
  averageMileage: {
    type: Number,
    default: 0
  },
  insuranceExpiry: {
    type: Date
  },
  fitnessExpiry: {
    type: Date
  },
  pollutionExpiry: {
    type: Date
  },
  lastServiceDate: {
    type: Date
  },
  lastServiceKm: {
    type: Number,
    default: 0
  },
  nextServiceDueKm: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  },
  lastKnownLocation: {
    lat: { type: Number, default: 14.4628 }, // Default to Chemmumiahpet, Ravindra Nagar, Kadapa
    lng: { type: Number, default: 78.8119 },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    isTrackingActive: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

vehicleSchema.index({ status: 1 });
vehicleSchema.index({ isActive: 1 });

export default mongoose.model('Vehicle', vehicleSchema);
