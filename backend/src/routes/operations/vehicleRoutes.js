import express from 'express';
import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  getTrips,
  createTrip,
  deleteTrip,
  getFuelLogs,
  createFuelLog,
  deleteFuelLog,
  getMaintenanceLogs,
  createMaintenanceLog,
  deleteMaintenanceLog,
  getVehicleStats,
  updateLiveLocation,
  getLiveLocations,
  getDepotConfig,
  saveDepotConfig,
  resetFleetSimulation
} from '../../controllers/operations/vehicleController.js';

const router = express.Router();

// Depot Location Settings
router.get('/depot-config', getDepotConfig);
router.post('/depot-config', saveDepotConfig);
router.post('/reset-simulation', resetFleetSimulation);

// Vehicle Fleet Routes
router.get('/', getVehicles);
router.post('/', createVehicle);
router.put('/:id', updateVehicle);
router.delete('/:id', deleteVehicle);

// Fleet Analytics / Overview
router.get('/stats/summary', getVehicleStats);

// Real-Time GPS Tracking (Option 1 - Driver Phone GPS)
router.post('/live-location', updateLiveLocation);
router.get('/live-locations', getLiveLocations);

// Trips & KMs Routes
router.get('/trips/list', getTrips);
router.post('/trips/log', createTrip);
router.delete('/trips/:id', deleteTrip);

// Fuel Management Routes
router.get('/fuel/list', getFuelLogs);
router.post('/fuel/log', createFuelLog);
router.delete('/fuel/:id', deleteFuelLog);

// Maintenance & Repairs Routes
router.get('/maintenance/list', getMaintenanceLogs);
router.post('/maintenance/log', createMaintenanceLog);
router.delete('/maintenance/:id', deleteMaintenanceLog);

export default router;

