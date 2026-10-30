import mongoose from 'mongoose';

const vehicleFuelSchema = new mongoose.Schema({
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  vehicleNumber: {
    type: String,
    required: true,
    uppercase: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  odometerKm: {
    type: Number,
    required: true,
    min: 0
  },
  litres: {
    type: Number,
    required: true,
    min: 0.1
  },
  ratePerLitre: {
    type: Number,
    required: true,
    min: 1
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 1
  },
  fuelType: {
    type: String,
    default: 'Diesel'
  },
  fuelStation: {
    type: String,
    default: ''
  },
  paymentMode: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Credit / Khata'],
    default: 'Cash'
  },
  calculatedMileage: {
    type: Number,
    default: 0
  },
  syncedToExpenses: {
    type: Boolean,
    default: false
  },
  expenseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

vehicleFuelSchema.index({ vehicleId: 1, date: -1 });
vehicleFuelSchema.index({ date: -1 });

export default mongoose.model('VehicleFuel', vehicleFuelSchema);

