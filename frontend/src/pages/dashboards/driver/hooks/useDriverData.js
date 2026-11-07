import { useState, useEffect, useCallback } from 'react';
import {
  getVehicles,
  getTrips,
  getFuelLogs,
  getMaintenanceLogs
} from '../../../../api/operations/vehicle';

export function useDriverData(user) {
  const [vehicles, setVehicles] = useState([]);
  const [assignedVehicle, setAssignedVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintLogs, setMaintLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const driverName = user?.name || user?.username || 'Fleet Driver';
  const driverPhone = user?.phone || '';

  const loadDriverData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [allVehicles, allTrips, allFuels, allMaint] = await Promise.all([
        getVehicles().catch(() => []),
        getTrips().catch(() => []),
        getFuelLogs().catch(() => []),
        getMaintenanceLogs().catch(() => [])
      ]);

      setVehicles(allVehicles || []);

      // Match assigned vehicle: prioritize driverName match, then driverPhone, then first
      const matchedVeh = (allVehicles || []).find(v => {
        const vDriver = (v.driverName || '').trim().toLowerCase();
        const uName = (driverName || '').trim().toLowerCase();
        const vPhone = (v.driverPhone || '').replace(/\D/g, '');
        const uPhone = (driverPhone || '').replace(/\D/g, '');
        return (vDriver && uName && (vDriver.includes(uName) || uName.includes(vDriver))) ||
               (vPhone && uPhone && vPhone === uPhone);
      }) || (allVehicles && allVehicles.length > 0 ? allVehicles[0] : null);

      setAssignedVehicle(matchedVeh);

      // Filter trips for this driver or vehicle
      const driverTrips = (allTrips || []).filter(t => {
        if (!matchedVeh && !driverName) return true;
        const tripDriver = (t.driverName || '').trim().toLowerCase();
        const uName = (driverName || '').trim().toLowerCase();
        const isDriverMatch = tripDriver && uName && (tripDriver.includes(uName) || uName.includes(tripDriver));
        const isVehMatch = matchedVeh && (
          t.vehicleId === matchedVeh._id ||
          (t.vehicleNumber && t.vehicleNumber.toUpperCase() === matchedVeh.vehicleNumber.toUpperCase())
        );
        return isDriverMatch || isVehMatch;
      });
      setTrips(driverTrips);

      // Filter fuel & maintenance logs
      if (matchedVeh) {
        const vFuels = (allFuels || []).filter(f => f.vehicleId === matchedVeh._id);
        const vMaint = (allMaint || []).filter(m => m.vehicleId === matchedVeh._id);
        setFuelLogs(vFuels);
        setMaintLogs(vMaint);
      } else {
        setFuelLogs(allFuels || []);
        setMaintLogs(allMaint || []);
      }
    } catch (err) {
      console.error('[useDriverData] Error fetching driver data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverName, driverPhone]);

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  return {
    vehicles,
    assignedVehicle,
    setAssignedVehicle,
    trips,
    setTrips,
    fuelLogs,
    setFuelLogs,
    maintLogs,
    loading,
    refreshing,
    refresh: () => loadDriverData(true)
  };
}

