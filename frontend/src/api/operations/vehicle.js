import api from '../system/axios';

// ==========================================
// VEHICLES
// ==========================================

export const getVehicles = async () => {
  try {
    const response = await api.get('/vehicles');
    if (response.data?.success) {
      localStorage.setItem('cached_vehicles', JSON.stringify(response.data.data));
      return response.data.data;
    }
    return [];
  } catch (err) {
    console.warn('[Vehicle API] Offline fallback for getVehicles:', err.message);
    const cached = localStorage.getItem('cached_vehicles');
    return cached ? JSON.parse(cached) : [];
  }
};

export const addVehicle = async (vehicleData) => {
  const response = await api.post('/vehicles', vehicleData);
  return response.data;
};

export const updateVehicle = async (id, vehicleData) => {
  const response = await api.put(`/vehicles/${id}`, vehicleData);
  return response.data;
};

export const deleteVehicle = async (id) => {
  const response = await api.delete(`/vehicles/${id}`);
  return response.data;
};

// ==========================================
// TRIPS & KMS
// ==========================================

export const getTrips = async (params = {}) => {
  try {
    const response = await api.get('/vehicles/trips/list', { params });
    if (response.data?.success) {
      localStorage.setItem('cached_trips', JSON.stringify(response.data.data));
      return response.data.data;
    }
    return [];
  } catch (err) {
    console.warn('[Vehicle API] Offline fallback for getTrips:', err.message);
    const cached = localStorage.getItem('cached_trips');
    return cached ? JSON.parse(cached) : [];
  }
};

export const logTrip = async (tripData) => {
  const response = await api.post('/vehicles/trips/log', tripData);
  return response.data;
};

export const deleteTrip = async (id) => {
  const response = await api.delete(`/vehicles/trips/${id}`);
  return response.data;
};

// ==========================================
// FUEL LOGS
// ==========================================

export const getFuelLogs = async (params = {}) => {
  try {
    const response = await api.get('/vehicles/fuel/list', { params });
    if (response.data?.success) {
      localStorage.setItem('cached_fuel_logs', JSON.stringify(response.data.data));
      return response.data.data;
    }
    return [];
  } catch (err) {
    console.warn('[Vehicle API] Offline fallback for getFuelLogs:', err.message);
    const cached = localStorage.getItem('cached_fuel_logs');
    return cached ? JSON.parse(cached) : [];
  }
};

export const logFuel = async (fuelData) => {
  const response = await api.post('/vehicles/fuel/log', fuelData);
  return response.data;
};

export const deleteFuelLog = async (id) => {
  const response = await api.delete(`/vehicles/fuel/${id}`);
  return response.data;
};

// ==========================================
// MAINTENANCE & REPAIRS
// ==========================================

export const getMaintenanceLogs = async (params = {}) => {
  try {
    const response = await api.get('/vehicles/maintenance/list', { params });
    if (response.data?.success) {
      localStorage.setItem('cached_maint_logs', JSON.stringify(response.data.data));
      return response.data.data;
    }
    return [];
  } catch (err) {
    console.warn('[Vehicle API] Offline fallback for getMaintenanceLogs:', err.message);
    const cached = localStorage.getItem('cached_maint_logs');
    return cached ? JSON.parse(cached) : [];
  }
};

export const logMaintenance = async (maintData) => {
  const response = await api.post('/vehicles/maintenance/log', maintData);
  return response.data;
};

export const deleteMaintenanceLog = async (id) => {
  const response = await api.delete(`/vehicles/maintenance/${id}`);
  return response.data;
};

// ==========================================
// FLEET STATS
// ==========================================

export const getVehicleStats = async () => {
  try {
    const response = await api.get('/vehicles/stats/summary');
    return response.data?.data || null;
  } catch (err) {
    console.warn('[Vehicle API] Offline fallback for stats:', err.message);
    return null;
  }
};

// ==========================================
// REAL-TIME GPS (OPTION 1)
// ==========================================

export const sendLiveLocation = async (locationData) => {
  const response = await api.post('/vehicles/live-location', locationData);
  return response.data;
};

export const getLiveLocations = async () => {
  try {
    const response = await api.get('/vehicles/live-locations');
    return response.data?.data || [];
  } catch (err) {
    console.warn('[Vehicle API] Error fetching live locations:', err.message);
    return [];
  }
};

// ==========================================
// STORE / DEPOT CONFIGURATION
// ==========================================

export const getDepotConfig = async () => {
  try {
    const response = await api.get('/vehicles/depot-config');
    if (response.data?.success) {
      localStorage.setItem('cached_depot_config', JSON.stringify(response.data.data));
      return response.data.data;
    }
  } catch (err) {
    console.warn('[Vehicle API] Fallback to cached depot config:', err.message);
  }
  const cached = localStorage.getItem('cached_depot_config');
  return cached ? JSON.parse(cached) : {
    name: 'YNR Fishes — Kadapa Central Depot',
    address: 'Chemmumiahpet, Ravindra Nagar, Utukuru, Kadapa, AP 516004',
    phone: '+91 98493 13889',
    lat: 14.4628,
    lng: 78.8119,
    zoom: 15
  };
};

export const saveDepotConfig = async (depotData) => {
  const response = await api.post('/vehicles/depot-config', depotData);
  if (response.data?.success) {
    localStorage.setItem('cached_depot_config', JSON.stringify(response.data.data));
  }
  return response.data;
};

export const resetFleetSimulation = async () => {
  const response = await api.post('/vehicles/reset-simulation');
  return response.data;
};

