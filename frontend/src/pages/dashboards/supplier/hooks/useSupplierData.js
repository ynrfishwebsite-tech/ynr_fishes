import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSuppliers } from '../../../../api/operations/operations';
import { getVehicles } from '../../../../api/operations/vehicle';
import axios from 'axios';
import { getApiUrl } from '../../../../config.js';

export function useSupplierData(user) {
  const [supplierProfile, setSupplierProfile] = useState(null);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const supplierName = user?.name || user?.username || 'Catch Supplier';
  const supplierPhone = user?.phone || '';

  const loadSupplierData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

      const [suppliersList, vehiclesList, logsRes] = await Promise.all([
        getSuppliers().catch(() => []),
        getVehicles().catch(() => []),
        axios.get(`${getApiUrl()}/inventory/logs`, {
          headers: authHeader,
          params: { limit: 200, supplierName: supplierName }
        }).catch(() => ({ data: { data: [] } }))
      ]);

      setFleetVehicles(vehiclesList || []);

      // Match supplier: match by name, companyName, or phone
      const matched = (suppliersList || []).find(s => {
        const sName = (s.name || '').trim().toLowerCase();
        const sComp = (s.companyName || '').trim().toLowerCase();
        const uName = (supplierName || '').trim().toLowerCase();
        const sPhone = (s.phone || '').replace(/\D/g, '');
        const uPhone = (supplierPhone || '').replace(/\D/g, '');
        return (sName && uName && (sName.includes(uName) || uName.includes(sName))) ||
               (sComp && uName && (sComp.includes(uName) || uName.includes(sComp))) ||
               (sPhone && uPhone && sPhone === uPhone);
      }) || (suppliersList && suppliersList.length > 0 ? suppliersList[0] : null);

      setSupplierProfile(matched);

      // Extract inward stock logs
      const rawLogs = Array.isArray(logsRes.data)
        ? logsRes.data
        : (logsRes.data?.data || logsRes.data?.logs || []);

      const filteredLogs = rawLogs.filter(log => {
        const isStockIn = log.type === 'Stock-In' ||
                          log.type === 'Procurement (Stock-In)' ||
                          (log.type && log.type.includes('Stock-In')) ||
                          (log.type && log.type.includes('Procurement'));

        if (!isStockIn) return false;

        if (matched) {
          const lSupp = (log.supplierName || '').trim().toLowerCase();
          const lComp = (log.companyName || '').trim().toLowerCase();
          const mName = (matched.name || '').trim().toLowerCase();
          const mComp = (matched.companyName || '').trim().toLowerCase();
          const mPhone = (matched.phone || '').replace(/\D/g, '');
          const lPhone = (log.supplierPhone || '').replace(/\D/g, '');

          const nameMatch = (lSupp && mName && (lSupp.includes(mName) || mName.includes(lSupp))) ||
                            (lComp && mComp && (lComp.includes(mComp) || mComp.includes(lComp)));
          const phoneMatch = mPhone && lPhone && mPhone === lPhone;
          return nameMatch || phoneMatch;
        }

        return true;
      });

      setStockLogs(filteredLogs);
    } catch (err) {
      console.error('[useSupplierData] Error loading supplier data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supplierName, supplierPhone]);

  useEffect(() => {
    loadSupplierData();
  }, [loadSupplierData]);

  // Linked transport vehicle
  const linkedVehicle = useMemo(() => {
    if (!supplierProfile) return null;
    return (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supplierProfile._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supplierProfile.name?.toLowerCase()) ||
      (supplierProfile.vehicleNumber && v.vehicleNumber.toUpperCase() === supplierProfile.vehicleNumber.toUpperCase())
    ) || (supplierProfile.vehicleNumber ? { vehicleNumber: supplierProfile.vehicleNumber, modelName: 'Dedicated Logistics' } : null);
  }, [supplierProfile, fleetVehicles]);

  // Totals calculations
  const totalWeightKg = useMemo(() => {
    return stockLogs.reduce((sum, l) => sum + (Number(l.grossKgChange || l.quantityChange) || 0), 0);
  }, [stockLogs]);

  const totalGrossValue = useMemo(() => {
    return stockLogs.reduce((sum, l) => {
      if (l.grossValue) return sum + Number(l.grossValue);
      if (l.netPayable) return sum + Number(l.netPayable);
      const rate = Number(l.rate || l.price || 0);
      const weight = Number(l.grossKgChange || l.quantityChange || 0);
      return sum + (rate * weight);
    }, 0);
  }, [stockLogs]);

  const totalBoxesSupplied = useMemo(() => {
    return stockLogs.reduce((sum, l) => sum + (Number(l.totalBoxes || l.boxes || 0)), 0);
  }, [stockLogs]);

  const khataBalance = Number(supplierProfile?.balance || 0);
  const totalSettledAmount = Math.max(0, totalGrossValue - khataBalance);

  return {
    supplierProfile,
    fleetVehicles,
    linkedVehicle,
    stockLogs,
    totalWeightKg,
    totalGrossValue,
    totalBoxesSupplied,
    khataBalance,
    totalSettledAmount,
    loading,
    refreshing,
    refresh: () => loadSupplierData(true)
  };
}

