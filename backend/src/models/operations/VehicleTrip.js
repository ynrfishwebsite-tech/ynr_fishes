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
    min: 0
  },
  endKm: {
    type: Number,
    required: true,
    min: 0
  },
  distanceKm: {
    type: Number,
    required: true,
    min: 0
  },
  purpose: {
    type: String,
    default: 'Fish Supply & Delivery'
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

export default mongoose.model('VehicleTrip', vehicleTripSchema);

