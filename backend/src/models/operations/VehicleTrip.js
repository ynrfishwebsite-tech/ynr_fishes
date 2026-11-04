import mongoose from 'mongoose';

const vehicleTripSchema = new mongoose.Schema({
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
  driverName: {
    type: String,
    default: ''
  },
  driverPhone: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  },
  startTime: {
    type: String,
    default: ''
  },
  endTime: {
    type: String,
    default: ''
  },
  startKm: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  endKm: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  purpose: {
    type: String,
    default: 'Fish Supply & Delivery'
  },
  exportType: {
    type: String,
    enum: ['Local', 'DAM', 'General Delivery', 'Procurement', ''],
    default: 'Local',
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    default: null
  },
  orderTableNo: {
    type: String,
    default: ''
  },
  customerName: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    default: ''
  },
  customerAddress: {
    type: String,
    default: ''
  },
  boxesCount: {
    type: Number,
    default: 0
  },
  totalWeightKg: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Scheduled', 'On-Road', 'Delivered', 'Completed'],
    default: 'On-Road',
    index: true
  },
  routeFrom: {
    type: String,
    default: 'Kadapa City Depot'
  },
  routeTo: {
    type: String,
    default: ''
  },
  tollCharges: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

vehicleTripSchema.index({ vehicleId: 1, date: -1 });
vehicleTripSchema.index({ date: -1 });
vehicleTripSchema.index({ exportType: 1, date: -1 });
vehicleTripSchema.index({ driverName: 1 });

export default mongoose.model('VehicleTrip', vehicleTripSchema);
