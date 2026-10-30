import mongoose from 'mongoose';

const vehicleMaintenanceSchema = new mongoose.Schema({
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
  serviceType: {
    type: String,
    required: true,
    enum: [
      'Engine Oil & Filter Change',
      'Tyre Replacement / Rotation',
      'Brake Pad Servicing',
      'Reefer Chiller Box Repair',
      'Clutch / Gearbox Overhaul',
      'General Service & Wash',
      'Battery Replacement',
      'Wheel Alignment',
      'Coolant & Fluid Topup',
      'Electrical & Lighting',
      'Bodywork & Painting',
      'Other Repair'
    ],
    default: 'General Service & Wash'
  },
  garageName: {
    type: String,
    default: ''
  },
  invoiceNumber: {
    type: String,
    default: ''
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0
  },
  partsReplaced: {
    type: String,
    default: ''
  },
  nextServiceDueKm: {
    type: Number,
    default: 0
  },
  nextServiceDueDate: {
    type: Date
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

vehicleMaintenanceSchema.index({ vehicleId: 1, date: -1 });
vehicleMaintenanceSchema.index({ date: -1 });

export default mongoose.model('VehicleMaintenance', vehicleMaintenanceSchema);

