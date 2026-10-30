import Vehicle from '../../models/operations/Vehicle.js';
import VehicleTrip from '../../models/operations/VehicleTrip.js';
import VehicleFuel from '../../models/operations/VehicleFuel.js';
import VehicleMaintenance from '../../models/operations/VehicleMaintenance.js';
import Expense from '../../models/finance/Expense.js';
import Setting from '../../models/system/Setting.js';

// ==========================================
// VEHICLE CRUD
// ==========================================

export const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isActive: true }).sort({ createdAt: -1 });

    // Aggregate monthly statistics per vehicle
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const enrichedVehicles = await Promise.all(
      vehicles.map(async (v) => {
        const vObj = v.toObject();

        // Monthly trips and KMs
        const monthlyTrips = await VehicleTrip.find({
          vehicleId: v._id,
          date: { $gte: startOfMonth }
        });
        const monthlyKm = monthlyTrips.reduce((acc, t) => acc + (t.distanceKm || 0), 0);

        // Monthly fuel cost
        const monthlyFuel = await VehicleFuel.find({
          vehicleId: v._id,
          date: { $gte: startOfMonth }
        });
        const monthlyFuelCost = monthlyFuel.reduce((acc, f) => acc + (f.totalAmount || 0), 0);
        const monthlyFuelLitres = monthlyFuel.reduce((acc, f) => acc + (f.litres || 0), 0);

        // Monthly maintenance cost
        const monthlyMaint = await VehicleMaintenance.find({
          vehicleId: v._id,
          date: { $gte: startOfMonth }
        });
        const monthlyMaintCost = monthlyMaint.reduce((acc, m) => acc + (m.totalCost || 0), 0);

        vObj.stats = {
          monthlyKm,
          monthlyFuelCost,
          monthlyFuelLitres,
          monthlyMaintCost,
          tripCount: monthlyTrips.length
        };

        return vObj;
      })
    );

    res.json({ success: true, data: enrichedVehicles });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getVehicles:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicles', error: err.message });
  }
};

export const createVehicle = async (req, res) => {
  try {
    const {
      vehicleNumber,
      modelName,
      vehicleType,
      driverName,
      driverPhone,
      currentKm,
      fuelType,
      status,
      tankCapacity,
      insuranceExpiry,
      fitnessExpiry,
      pollutionExpiry,
      nextServiceDueKm,
      notes
    } = req.body;

    if (!vehicleNumber || !modelName) {
      return res.status(400).json({ success: false, message: 'Vehicle number and model name are required' });
    }

    const cleanNumber = vehicleNumber.trim().toUpperCase();
    const existing = await Vehicle.findOne({ vehicleNumber: cleanNumber, isActive: true });
    if (existing) {
      return res.status(400).json({ success: false, message: `Vehicle ${cleanNumber} is already registered` });
    }

    const newVehicle = new Vehicle({
      vehicleNumber: cleanNumber,
      modelName: modelName.trim(),
      vehicleType: vehicleType || 'Pickup Truck',
      driverName: (driverName || '').trim(),
      driverPhone: (driverPhone || '').trim(),
      currentKm: Number(currentKm) || 0,
      fuelType: fuelType || 'Diesel',
      status: status || 'Available',
      tankCapacity: Number(tankCapacity) || 45,
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : undefined,
      fitnessExpiry: fitnessExpiry ? new Date(fitnessExpiry) : undefined,
      pollutionExpiry: pollutionExpiry ? new Date(pollutionExpiry) : undefined,
      nextServiceDueKm: Number(nextServiceDueKm) || 0,
      notes: notes || ''
    });

    await newVehicle.save();
    res.status(201).json({ success: true, data: newVehicle, message: 'Vehicle registered successfully' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in createVehicle:', err);
    res.status(500).json({ success: false, message: 'Failed to create vehicle', error: err.message });
  }
};

export const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.vehicleNumber) {
      updateData.vehicleNumber = updateData.vehicleNumber.trim().toUpperCase();
    }

    const updated = await Vehicle.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    res.json({ success: true, data: updated, message: 'Vehicle updated successfully' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in updateVehicle:', err);
    res.status(500).json({ success: false, message: 'Failed to update vehicle', error: err.message });
  }
};

export const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Vehicle.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.json({ success: true, message: 'Vehicle removed from fleet' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in deleteVehicle:', err);
    res.status(500).json({ success: false, message: 'Failed to delete vehicle', error: err.message });
  }
};

// ==========================================
// TRIP & KM TRACKING
// ==========================================

export const getTrips = async (req, res) => {
  try {
    const { vehicleId, startDate, endDate } = req.query;
    const query = {};

    if (vehicleId) query.vehicleId = vehicleId;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const trips = await VehicleTrip.find(query).sort({ date: -1, createdAt: -1 }).limit(200);
    res.json({ success: true, data: trips });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getTrips:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch trips', error: err.message });
  }
};

export const createTrip = async (req, res) => {
  try {
    const {
      vehicleId,
      driverName,
      date,
      startTime,
      endTime,
      startKm,
      endKm,
      purpose,
      routeFrom,
      routeTo,
      tollCharges,
      notes,
      updateStatus
    } = req.body;

    const startNum = Number(startKm);
    const endNum = Number(endKm);

    if (isNaN(startNum) || isNaN(endNum)) {
      return res.status(400).json({ success: false, message: 'Start and End KMs must be valid numbers' });
    }

    if (endNum < startNum) {
      return res.status(400).json({ success: false, message: 'End KM cannot be less than Start KM' });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const distanceKm = endNum - startNum;

    const trip = new VehicleTrip({
      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      driverName: driverName || vehicle.driverName || '',
      date: date ? new Date(date) : new Date(),
      startTime: startTime || '',
      endTime: endTime || '',
      startKm: startNum,
      endKm: endNum,
      distanceKm,
      purpose: purpose || 'Fish Delivery & Supply',
      routeFrom: routeFrom || 'Kadapa Depot',
      routeTo: routeTo || '',
      tollCharges: Number(tollCharges) || 0,
      notes: notes || ''
    });

    await trip.save();

    // Auto-update vehicle current odometer reading
    if (endNum > vehicle.currentKm) {
      vehicle.currentKm = endNum;
    }
    if (updateStatus) {
      vehicle.status = updateStatus;
    }
    await vehicle.save();

    res.status(201).json({ success: true, data: trip, message: `Trip logged successfully (+${distanceKm} KM)` });
  } catch (err) {
    console.error('[Vehicle Controller] Error in createTrip:', err);
    res.status(500).json({ success: false, message: 'Failed to log trip', error: err.message });
  }
};

export const deleteTrip = async (req, res) => {
  try {
    const { id } = req.params;
    await VehicleTrip.findByIdAndDelete(id);
    res.json({ success: true, message: 'Trip log deleted' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in deleteTrip:', err);
    res.status(500).json({ success: false, message: 'Failed to delete trip', error: err.message });
  }
};

// ==========================================
// FUEL MANAGEMENT
// ==========================================

export const getFuelLogs = async (req, res) => {
  try {
    const { vehicleId } = req.query;
    const query = vehicleId ? { vehicleId } : {};
    const fuels = await VehicleFuel.find(query).sort({ date: -1, createdAt: -1 }).limit(200);
    res.json({ success: true, data: fuels });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getFuelLogs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch fuel logs', error: err.message });
  }
};

export const createFuelLog = async (req, res) => {
  try {
    const {
      vehicleId,
      date,
      odometerKm,
      litres,
      ratePerLitre,
      totalAmount,
      fuelType,
      fuelStation,
      paymentMode,
      syncToExpense,
      notes
    } = req.body;

    const odoNum = Number(odometerKm);
    const ltrNum = Number(litres);
    const rateNum = Number(ratePerLitre);
    const amountNum = totalAmount ? Number(totalAmount) : (ltrNum * rateNum);

    if (!vehicleId || isNaN(odoNum) || isNaN(ltrNum) || isNaN(amountNum)) {
      return res.status(400).json({ success: false, message: 'Vehicle, Odometer KM, Litres, and Amount are required' });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // Calculate Mileage based on previous fuel log
    const lastFuel = await VehicleFuel.findOne({ vehicleId, odometerKm: { $lt: odoNum } }).sort({ odometerKm: -1 });
    let calculatedMileage = 0;
    if (lastFuel && ltrNum > 0) {
      const distanceCovered = odoNum - lastFuel.odometerKm;
      calculatedMileage = Math.round((distanceCovered / ltrNum) * 10) / 10;
    }

    let linkedExpenseId = null;
    let didSync = false;

    // Sync to Finance Expenses if requested
    if (syncToExpense) {
      try {
        const exp = new Expense({
          amount: amountNum,
          description: `Fuel (${ltrNum}L @ ₹${rateNum}) - ${vehicle.vehicleNumber} [${fuelStation || 'Petrol Pump'}]`,
          category: 'Maintenance',
          paymentMode: ['Cash', 'UPI', 'Card'].includes(paymentMode) ? paymentMode : 'Cash',
          date: date ? new Date(date) : new Date()
        });
        await exp.save();
        linkedExpenseId = exp._id;
        didSync = true;
      } catch (expErr) {
        console.warn('[Vehicle Controller] Expense sync warning:', expErr.message);
      }
    }

    const fuelLog = new VehicleFuel({
      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      date: date ? new Date(date) : new Date(),
      odometerKm: odoNum,
      litres: ltrNum,
      ratePerLitre: rateNum,
      totalAmount: amountNum,
      fuelType: fuelType || vehicle.fuelType || 'Diesel',
      fuelStation: fuelStation || 'Local Fuel Pump',
      paymentMode: paymentMode || 'Cash',
      calculatedMileage,
      syncedToExpenses: didSync,
      expenseId: linkedExpenseId,
      notes: notes || ''
    });

    await fuelLog.save();

    // Update vehicle's odometer and average mileage
    if (odoNum > vehicle.currentKm) {
      vehicle.currentKm = odoNum;
    }
    if (calculatedMileage > 0) {
      vehicle.averageMileage = calculatedMileage;
    }
    await vehicle.save();

    res.status(201).json({
      success: true,
      data: fuelLog,
      message: `Fuel recorded: ${ltrNum}L (₹${amountNum})${calculatedMileage ? ` • Mileage: ${calculatedMileage} KM/L` : ''}`
    });
  } catch (err) {
    console.error('[Vehicle Controller] Error in createFuelLog:', err);
    res.status(500).json({ success: false, message: 'Failed to record fuel log', error: err.message });
  }
};

export const deleteFuelLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await VehicleFuel.findById(id);
    if (log && log.expenseId) {
      await Expense.findByIdAndDelete(log.expenseId).catch(() => {});
    }
    await VehicleFuel.findByIdAndDelete(id);
    res.json({ success: true, message: 'Fuel record deleted' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in deleteFuelLog:', err);
    res.status(500).json({ success: false, message: 'Failed to delete fuel record', error: err.message });
  }
};

// ==========================================
// REPAIRS & MAINTENANCE
// ==========================================

export const getMaintenanceLogs = async (req, res) => {
  try {
    const { vehicleId } = req.query;
    const query = vehicleId ? { vehicleId } : {};
    const logs = await VehicleMaintenance.find(query).sort({ date: -1, createdAt: -1 }).limit(200);
    res.json({ success: true, data: logs });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getMaintenanceLogs:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch maintenance logs', error: err.message });
  }
};

export const createMaintenanceLog = async (req, res) => {
  try {
    const {
      vehicleId,
      date,
      odometerKm,
      serviceType,
      garageName,
      invoiceNumber,
      totalCost,
      partsReplaced,
      nextServiceDueKm,
      nextServiceDueDate,
      syncToExpense,
      notes
    } = req.body;

    const costNum = Number(totalCost);
    if (!vehicleId || isNaN(costNum)) {
      return res.status(400).json({ success: false, message: 'Vehicle and Total Cost are required' });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    let linkedExpenseId = null;
    let didSync = false;

    // Sync to Finance Expenses if requested
    if (syncToExpense && costNum > 0) {
      try {
        const exp = new Expense({
          amount: costNum,
          description: `Vehicle Repair: ${serviceType || 'Maintenance'} - ${vehicle.vehicleNumber} [${garageName || 'Garage'}]`,
          category: 'Maintenance',
          paymentMode: 'Cash',
          date: date ? new Date(date) : new Date()
        });
        await exp.save();
        linkedExpenseId = exp._id;
        didSync = true;
      } catch (expErr) {
        console.warn('[Vehicle Controller] Maintenance expense sync warning:', expErr.message);
      }
    }

    const maintLog = new VehicleMaintenance({
      vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      date: date ? new Date(date) : new Date(),
      odometerKm: Number(odometerKm) || vehicle.currentKm,
      serviceType: serviceType || 'General Service & Wash',
      garageName: garageName || '',
      invoiceNumber: invoiceNumber || '',
      totalCost: costNum,
      partsReplaced: partsReplaced || '',
      nextServiceDueKm: Number(nextServiceDueKm) || 0,
      nextServiceDueDate: nextServiceDueDate ? new Date(nextServiceDueDate) : undefined,
      syncedToExpenses: didSync,
      expenseId: linkedExpenseId,
      notes: notes || ''
    });

    await maintLog.save();

    // Update vehicle service milestones
    vehicle.lastServiceDate = date ? new Date(date) : new Date();
    if (odometerKm && Number(odometerKm) > vehicle.currentKm) {
      vehicle.currentKm = Number(odometerKm);
    }
    vehicle.lastServiceKm = Number(odometerKm) || vehicle.currentKm;
    if (nextServiceDueKm) {
      vehicle.nextServiceDueKm = Number(nextServiceDueKm);
    }
    await vehicle.save();

    res.status(201).json({
      success: true,
      data: maintLog,
      message: `Maintenance logged successfully (₹${costNum})`
    });
  } catch (err) {
    console.error('[Vehicle Controller] Error in createMaintenanceLog:', err);
    res.status(500).json({ success: false, message: 'Failed to record maintenance', error: err.message });
  }
};

export const deleteMaintenanceLog = async (req, res) => {
  try {
    const { id } = req.params;
    const log = await VehicleMaintenance.findById(id);
    if (log && log.expenseId) {
      await Expense.findByIdAndDelete(log.expenseId).catch(() => {});
    }
    await VehicleMaintenance.findByIdAndDelete(id);
    res.json({ success: true, message: 'Maintenance record deleted' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in deleteMaintenanceLog:', err);
    res.status(500).json({ success: false, message: 'Failed to delete maintenance record', error: err.message });
  }
};

// ==========================================
// OVERALL FLEET STATS
// ==========================================

export const getVehicleStats = async (req, res) => {
  try {
    const totalVehicles = await Vehicle.countDocuments({ isActive: true });
    const onTripCount = await Vehicle.countDocuments({ isActive: true, status: 'On Trip' });
    const inMaintenanceCount = await Vehicle.countDocuments({ isActive: true, status: 'In Maintenance' });
    const availableCount = await Vehicle.countDocuments({ isActive: true, status: 'Available' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyTrips = await VehicleTrip.find({ date: { $gte: startOfMonth } });
    const monthlyTotalKm = monthlyTrips.reduce((acc, t) => acc + (t.distanceKm || 0), 0);

    const monthlyFuels = await VehicleFuel.find({ date: { $gte: startOfMonth } });
    const monthlyFuelCost = monthlyFuels.reduce((acc, f) => acc + (f.totalAmount || 0), 0);
    const monthlyFuelLitres = monthlyFuels.reduce((acc, f) => acc + (f.litres || 0), 0);

    const monthlyMaints = await VehicleMaintenance.find({ date: { $gte: startOfMonth } });
    const monthlyMaintCost = monthlyMaints.reduce((acc, m) => acc + (m.totalCost || 0), 0);

    const avgMileage = monthlyFuelLitres > 0 && monthlyTotalKm > 0
      ? Math.round((monthlyTotalKm / monthlyFuelLitres) * 10) / 10
      : 0;

    res.json({
      success: true,
      data: {
        totalVehicles,
        availableCount,
        onTripCount,
        inMaintenanceCount,
        monthlyTotalKm,
        monthlyFuelCost,
        monthlyFuelLitres,
        monthlyMaintCost,
        avgMileage,
        totalFleetCost: monthlyFuelCost + monthlyMaintCost
      }
    });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getVehicleStats:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch vehicle stats', error: err.message });
  }
};

// ==========================================
// REAL-TIME GPS TRACKING (OPTION 1)
// ==========================================

export const updateLiveLocation = async (req, res) => {
  try {
    const { vehicleNumber, lat, lng, speed, heading, accuracy, isTrackingActive } = req.body;
    if (!vehicleNumber || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Vehicle number, lat and lng are required' });
    }

    const cleanNumber = vehicleNumber.trim().toUpperCase();
    const vehicle = await Vehicle.findOne({ vehicleNumber: cleanNumber, isActive: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: `Vehicle ${cleanNumber} not found` });
    }

    vehicle.lastKnownLocation = {
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed) || 0,
      heading: Number(heading) || 0,
      accuracy: Number(accuracy) || 0,
      isTrackingActive: isTrackingActive !== undefined ? Boolean(isTrackingActive) : true,
      updatedAt: new Date()
    };

    if (isTrackingActive) {
      vehicle.status = 'On Trip';
    } else if (vehicle.status === 'On Trip') {
      vehicle.status = 'Available';
    }

    await vehicle.save();

    // Broadcast via Socket.IO to connected admin monitors
    const io = req.app.locals.io;
    if (io) {
      io.emit('vehicle:location_stream', {
        vehicleId: vehicle._id,
        vehicleNumber: cleanNumber,
        modelName: vehicle.modelName,
        driverName: vehicle.driverName,
        driverPhone: vehicle.driverPhone,
        status: vehicle.status,
        ...vehicle.lastKnownLocation.toObject()
      });
    }

    res.json({ success: true, message: 'Live GPS location received', data: vehicle.lastKnownLocation });
  } catch (err) {
    console.error('[Vehicle Controller] Error in updateLiveLocation:', err);
    res.status(500).json({ success: false, message: 'Failed to update location', error: err.message });
  }
};

export const getLiveLocations = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ isActive: true }).select('vehicleNumber modelName vehicleType driverName driverPhone status currentKm lastKnownLocation');
    res.json({ success: true, data: vehicles });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getLiveLocations:', err);
    res.status(500).json({ success: false, message: 'Failed to get live locations', error: err.message });
  }
};

// ==========================================
// STORE / DEPOT CONFIGURATION
// ==========================================

export const getDepotConfig = async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: 'fleet_depot_location' });
    if (setting && setting.value) {
      return res.json({ success: true, data: setting.value });
    }
    // Default YNR Fishes Kadapa Hub
    const defaultDepot = {
      name: 'YNR Fishes — Kadapa Central Depot',
      address: 'Chemmumiahpet, Ravindra Nagar, Utukuru, Kadapa, AP 516004',
      phone: '+91 98493 13889',
      lat: 14.4628,
      lng: 78.8119,
      zoom: 15
    };
    res.json({ success: true, data: defaultDepot });
  } catch (err) {
    console.error('[Vehicle Controller] Error in getDepotConfig:', err);
    res.status(500).json({ success: false, message: 'Failed to get depot config', error: err.message });
  }
};

export const saveDepotConfig = async (req, res) => {
  try {
    const { lat, lng, name, address, phone, zoom } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and Longitude are required' });
    }

    const depotData = {
      name: name || 'YNR Fishes — Kadapa Central Depot',
      address: address || 'Chemmumiahpet, Ravindra Nagar, Utukuru, Kadapa, AP 516004',
      phone: phone || '+91 98493 13889',
      lat: Number(lat),
      lng: Number(lng),
      zoom: Number(zoom) || 15,
      updatedAt: new Date()
    };

    await Setting.findOneAndUpdate(
      { key: 'fleet_depot_location' },
      { key: 'fleet_depot_location', value: depotData },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Depot location saved successfully', data: depotData });
  } catch (err) {
    console.error('[Vehicle Controller] Error in saveDepotConfig:', err);
    res.status(500).json({ success: false, message: 'Failed to save depot config', error: err.message });
  }
};

export const resetFleetSimulation = async (req, res) => {
  try {
    const depotSetting = await Setting.findOne({ key: 'fleet_depot_location' });
    const depotLat = depotSetting?.value?.lat || 14.4628;
    const depotLng = depotSetting?.value?.lng || 78.8119;

    await Vehicle.updateMany(
      {},
      {
        $set: {
          status: 'Available',
          'lastKnownLocation.lat': depotLat,
          'lastKnownLocation.lng': depotLng,
          'lastKnownLocation.speed': 0,
          'lastKnownLocation.heading': 0,
          'lastKnownLocation.accuracy': 10,
          'lastKnownLocation.isTrackingActive': false,
          'lastKnownLocation.updatedAt': new Date()
        }
      }
    );

    // Broadcast reset to all map screens
    const io = req.app.locals.io;
    if (io) {
      io.emit('vehicle:reset_all', { message: 'All vehicles parked at depot' });
    }

    res.json({ success: true, message: 'All vehicles reset to Depot parking' });
  } catch (err) {
    console.error('[Vehicle Controller] Error in resetFleetSimulation:', err);
    res.status(500).json({ success: false, message: 'Failed to reset fleet', error: err.message });
  }
};


