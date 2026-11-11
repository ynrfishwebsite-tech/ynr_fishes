import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Calendar,
  IndianRupee,
  Gauge,
  Fuel,
  Wrench,
  Navigation,
  Clock,
  Phone,
  User,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Edit2,
  X,
  Car,
  ShieldCheck,
  ChevronRight,
  Calculator,
  Radio,
  Building,
  Upload,
  Image as ImageIcon,
  Crop
} from 'lucide-react';
import BackButton from '../common/BackButton';
import Toast from '../system/Toast';
import ImageCropperModal from '../crm/ImageCropperModal';
import {
  getVehicles,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  getTrips,
  logTrip,
  deleteTrip,
  getFuelLogs,
  logFuel,
  deleteFuelLog,
  getMaintenanceLogs,
  logMaintenance,
  deleteMaintenanceLog,
  getVehicleStats
} from '../../../api/operations/vehicle';
import { getSuppliers } from '../../../api/operations/operations';
import LiveFleetMap from './LiveFleetMap';
import io from 'socket.io-client';
import { getSocketUrl } from '../../../config';

const VEHICLE_TYPES = [
  'Pickup Truck',
  'Delivery Van',
  'Three Wheeler Auto',
  'Mini Truck',
  'Reefer Truck',
  'Two-Wheeler',
  'Other'
];

const FUEL_TYPES = ['Diesel', 'Petrol', 'CNG', 'Electric'];
const VEHICLE_STATUSES = ['Available', 'On Trip', 'In Maintenance', 'Idle', 'Out of Service'];
const SERVICE_TYPES = [
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
];

export default function VehicleManagement({ onNavigate, onGoBack }) {
  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' | 'trips' | 'fuel' | 'maintenance' | 'calculator'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('all');
  const [tripChannelFilter, setTripChannelFilter] = useState('ALL'); // 'ALL' | 'LOCAL' | 'DAM'

  // Fleet Filters Modal State (Compact Modal)
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterVehicleType, setFilterVehicleType] = useState('ALL');
  const [filterFuelType, setFilterFuelType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Main Data States
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [suppliersList, setSuppliersList] = useState([]);

  // Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [preselectedTripVehicle, setPreselectedTripVehicle] = useState(null);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [preselectedFuelVehicle, setPreselectedFuelVehicle] = useState(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [preselectedMaintVehicle, setPreselectedMaintVehicle] = useState(null);

  // Image Cropper State for Driver
  const [uploadFileInfo, setUploadFileInfo] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperRawSrc, setCropperRawSrc] = useState(null);
  const [cropperPendingInfo, setCropperPendingInfo] = useState(null);

  // Form States
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    modelName: '',
    vehicleType: 'Pickup Truck',
    driverName: '',
    driverPhone: '',
    driverPhoto: '',
    assignedSupplierId: '',
    assignedSupplierName: '',
    operationalMode: 'All',
    currentKm: '',
    fuelType: 'Diesel',
    status: 'Available',
    tankCapacity: '45',
    insuranceExpiry: '',
    fitnessExpiry: '',
    pollutionExpiry: '',
    nextServiceDueKm: '',
    notes: ''
  });

  const [tripForm, setTripForm] = useState({
    vehicleId: '',
    driverName: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    startKm: '',
    endKm: '',
    purpose: 'Fish Supply & Market Distribution',
    routeFrom: 'Kadapa City Depot',
    routeTo: '',
    tollCharges: '0',
    exportType: 'Local',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    boxesCount: '0',
    totalWeightKg: '0',
    status: 'Assigned',
    updateStatus: 'Available',
    notes: ''
  });

  const [fuelForm, setFuelForm] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    odometerKm: '',
    litres: '',
    ratePerLitre: '98',
    totalAmount: '',
    fuelType: 'Diesel',
    fuelStation: 'Local Fuel Station',
    paymentMode: 'Cash',
    syncToExpense: true,
    notes: ''
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    odometerKm: '',
    serviceType: 'General Service & Wash',
    garageName: '',
    invoiceNumber: '',
    totalCost: '',
    partsReplaced: '',
    nextServiceDueKm: '',
    nextServiceDueDate: '',
    syncToExpense: true,
    notes: ''
  });

  // Interactive Quick Calculator State
  const [calcStartKm, setCalcStartKm] = useState('12450');
  const [calcEndKm, setCalcEndKm] = useState('12630');
  const [calcFuelLitres, setCalcFuelLitres] = useState('18');
  const [calcFuelRate, setCalcFuelRate] = useState('98');

  // Load All Data
  const loadData = async () => {
    try {
      setLoading(true);
      const [vList, tList, fList, mList, sData, supList] = await Promise.all([
        getVehicles(),
        getTrips(),
        getFuelLogs(),
        getMaintenanceLogs(),
        getVehicleStats(),
        getSuppliers().catch(() => [])
      ]);
      setVehicles(vList || []);
      setTrips(tList || []);
      setFuelLogs(fList || []);
      setMaintenanceLogs(mList || []);
      setStats(sData);
      if (Array.isArray(supList)) setSuppliersList(supList);
    } catch (err) {
      console.error('[VehicleManagement] Load error:', err);
      setToast({ type: 'error', message: 'Failed to load vehicle records.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time WebSocket synchronization with live driver GPS broadcasts
  useEffect(() => {
    let socket = null;
    try {
      socket = io(getSocketUrl(), {
        transports: ['websocket', 'polling'],
        reconnection: true
      });

      socket.on('vehicle:location_stream', (data) => {
        if (!data || !data.vehicleNumber) return;
        setVehicles((prev) =>
          prev.map((v) => {
            if (v.vehicleNumber?.toUpperCase() === data.vehicleNumber?.toUpperCase()) {
              const newStatus = data.status || (data.isTrackingActive ? 'On Trip' : 'Available');
              return {
                ...v,
                status: newStatus,
                lastKnownLocation: {
                  ...(v.lastKnownLocation || {}),
                  lat: data.lat,
                  lng: data.lng,
                  speed: data.speed !== undefined ? data.speed : (v.lastKnownLocation?.speed || 0),
                  heading: data.heading !== undefined ? data.heading : (v.lastKnownLocation?.heading || 0),
                  accuracy: data.accuracy !== undefined ? data.accuracy : (v.lastKnownLocation?.accuracy || 0),
                  isTrackingActive: Boolean(data.isTrackingActive),
                  updatedAt: new Date()
                }
              };
            }
            return v;
          })
        );
      });
    } catch (e) {
      console.warn('[VehicleManagement] Live fleet socket sync warning:', e.message);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Active Filters Count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterChannel !== 'ALL') count++;
    if (filterSupplier !== 'ALL') count++;
    if (filterVehicleType !== 'ALL') count++;
    if (filterFuelType !== 'ALL') count++;
    if (filterStatus !== 'ALL') count++;
    return count;
  }, [filterChannel, filterSupplier, filterVehicleType, filterFuelType, filterStatus]);

  const handleResetFilters = () => {
    setFilterChannel('ALL');
    setFilterSupplier('ALL');
    setFilterVehicleType('ALL');
    setFilterFuelType('ALL');
    setFilterStatus('ALL');
  };

  const uniqueSuppliersList = useMemo(() => {
    const set = new Set();
    (vehicles || []).forEach(v => {
      if (v.assignedSupplierName && v.assignedSupplierName.trim()) {
        set.add(v.assignedSupplierName.trim());
      }
    });
    (suppliersList || []).forEach(s => {
      if (s.name && s.name.trim()) set.add(s.name.trim());
    });
    return Array.from(set).sort();
  }, [vehicles, suppliersList]);

  // Filtered Lists
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchSearch =
        v.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.modelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.assignedSupplierName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchChannel = filterChannel === 'ALL' || 
        v.operationalMode === filterChannel ||
        (filterChannel === 'All' && v.operationalMode === 'All');

      const matchSupplier = filterSupplier === 'ALL' ||
        (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === filterSupplier.toLowerCase());

      const matchType = filterVehicleType === 'ALL' || v.vehicleType === filterVehicleType;

      const matchFuel = filterFuelType === 'ALL' || v.fuelType === filterFuelType;

      const matchStatus = filterStatus === 'ALL' || v.status === filterStatus;

      return matchSearch && matchChannel && matchSupplier && matchType && matchFuel && matchStatus;
    });
  }, [vehicles, searchQuery, filterChannel, filterSupplier, filterVehicleType, filterFuelType, filterStatus]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const matchVehicle = selectedVehicleFilter === 'all' || t.vehicleId === selectedVehicleFilter;
      const matchChannel =
        tripChannelFilter === 'ALL'
          ? true
          : tripChannelFilter === 'LOCAL'
          ? (t.exportType === 'Local' || t.purpose?.toLowerCase().includes('local'))
          : (t.exportType === 'DAM' || t.purpose?.toLowerCase().includes('dam'));

      const matchSearch =
        t.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.customerPhone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.routeTo?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchVehicle && matchChannel && matchSearch;
    });
  }, [trips, selectedVehicleFilter, tripChannelFilter, searchQuery]);

  const filteredFuelLogs = useMemo(() => {
    return fuelLogs.filter((f) => {
      const matchVehicle = selectedVehicleFilter === 'all' || f.vehicleId === selectedVehicleFilter;
      const matchSearch =
        f.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.fuelStation?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchVehicle && matchSearch;
    });
  }, [fuelLogs, selectedVehicleFilter, searchQuery]);

  const filteredMaintenanceLogs = useMemo(() => {
    return maintenanceLogs.filter((m) => {
      const matchVehicle = selectedVehicleFilter === 'all' || m.vehicleId === selectedVehicleFilter;
      const matchSearch =
        m.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.serviceType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.garageName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchVehicle && matchSearch;
    });
  }, [maintenanceLogs, selectedVehicleFilter, searchQuery]);

  // Handlers - Vehicle CRUD
  const handleOpenAddVehicle = () => {
    setEditingVehicle(null);
    setUploadFileInfo(null);
    setVehicleForm({
      vehicleNumber: '',
      modelName: '',
      vehicleType: 'Pickup Truck',
      driverName: '',
      driverPhone: '',
      driverPhoto: '',
      assignedSupplierId: '',
      assignedSupplierName: '',
      operationalMode: 'All',
      currentKm: '0',
      fuelType: 'Diesel',
      status: 'Available',
      tankCapacity: '45',
      insuranceExpiry: '',
      fitnessExpiry: '',
      pollutionExpiry: '',
      nextServiceDueKm: '',
      notes: ''
    });
    setShowVehicleModal(true);
  };

  const handleOpenEditVehicle = (veh) => {
    setEditingVehicle(veh);
    setUploadFileInfo(veh.driverPhoto ? { name: `${veh.driverName || 'Driver'} Photo`, extension: 'img', size: 'Saved' } : null);
    setVehicleForm({
      vehicleNumber: veh.vehicleNumber || '',
      modelName: veh.modelName || '',
      vehicleType: veh.vehicleType || 'Pickup Truck',
      driverName: veh.driverName || '',
      driverPhone: veh.driverPhone || '',
      driverPhoto: veh.driverPhoto || '',
      assignedSupplierId: veh.assignedSupplierId || '',
      assignedSupplierName: veh.assignedSupplierName || '',
      operationalMode: veh.operationalMode || 'All',
      currentKm: String(veh.currentKm || 0),
      fuelType: veh.fuelType || 'Diesel',
      status: veh.status || 'Available',
      tankCapacity: String(veh.tankCapacity || 45),
      insuranceExpiry: veh.insuranceExpiry ? veh.insuranceExpiry.split('T')[0] : '',
      fitnessExpiry: veh.fitnessExpiry ? veh.fitnessExpiry.split('T')[0] : '',
      pollutionExpiry: veh.pollutionExpiry ? veh.pollutionExpiry.split('T')[0] : '',
      nextServiceDueKm: String(veh.nextServiceDueKm || ''),
      notes: veh.notes || ''
    });
    setShowVehicleModal(true);
  };

  // Image Upload with <= 5MB validation & Image Cropper trigger
  const handleImageUpload = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Image size must be less than or equal to 5MB', type: 'error' });
      return;
    }
    const extension = file.name.split('.').pop() || 'jpg';
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    const fileInfo = {
      name: file.name,
      extension: extension,
      size: `${sizeInMb} MB`
    };

    const reader = new FileReader();
    reader.onloadend = (event) => {
      setCropperRawSrc(event.target.result);
      setCropperPendingInfo(fileInfo);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    try {
      const vNum = (vehicleForm.vehicleNumber || '').trim().toUpperCase();
      if (!vNum) {
        setToast({ type: 'error', message: 'Vehicle registration number is required (e.g. AP 04 TX 4589)' });
        return;
      }
      if (!vehicleForm.modelName?.trim()) {
        setToast({ type: 'error', message: 'Model / Vehicle Name is required (e.g. Mahindra Bolero Pickup)' });
        return;
      }

      // Strict 10-Digit Phone Validation
      const rawPhone = (vehicleForm.driverPhone || '').replace(/\D/g, '');
      if (rawPhone && rawPhone.length !== 10) {
        setToast({ type: 'error', message: `Driver mobile must be exactly 10 digits (${rawPhone.length}/10 entered)` });
        return;
      }
      if (rawPhone && !/^[6-9]/.test(rawPhone)) {
        setToast({ type: 'error', message: 'Driver mobile must start with 6, 7, 8, or 9' });
        return;
      }

      const km = parseFloat(vehicleForm.currentKm) || 0;
      if (km < 0) {
        setToast({ type: 'error', message: 'Current Odometer cannot be negative' });
        return;
      }
      const capacity = parseFloat(vehicleForm.tankCapacity) || 0;
      if (capacity <= 0) {
        setToast({ type: 'error', message: 'Tank capacity must be greater than 0 Litres' });
        return;
      }

      const payload = {
        ...vehicleForm,
        vehicleNumber: vNum,
        driverPhone: rawPhone,
        currentKm: km,
        tankCapacity: capacity,
        assignedSupplierId: vehicleForm.assignedSupplierId || undefined,
        assignedSupplierName: vehicleForm.assignedSupplierName || undefined,
        operationalMode: vehicleForm.operationalMode || 'All'
      };

      if (editingVehicle) {
        await updateVehicle(editingVehicle._id, payload);
        setToast({ type: 'success', message: 'Vehicle updated successfully!' });
      } else {
        await addVehicle(payload);
        setToast({ type: 'success', message: 'Vehicle registered and added to fleet!' });
      }
      setShowVehicleModal(false);
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to save vehicle' });
    }
  };

  const handleDeleteVehicle = async (id, num) => {
    if (!window.confirm(`Are you sure you want to remove vehicle ${num} from the active fleet?`)) return;
    try {
      await deleteVehicle(id);
      setToast({ type: 'success', message: `Vehicle ${num} removed.` });
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Handlers - Trips
  const handleOpenAddTrip = (veh = null) => {
    const targetVeh = veh || vehicles[0];
    setPreselectedTripVehicle(targetVeh);
    setTripForm({
      vehicleId: targetVeh ? targetVeh._id : '',
      driverName: targetVeh ? targetVeh.driverName : '',
      date: new Date().toISOString().split('T')[0],
      startTime: '',
      endTime: '',
      startKm: targetVeh ? String(targetVeh.currentKm || 0) : '0',
      endKm: targetVeh ? String((targetVeh.currentKm || 0) + 45) : '',
      purpose: tripChannelFilter === 'DAM' ? 'Inter-District Bulk Consignment' : 'Local Fish Supply & Distribution',
      routeFrom: 'Kadapa City Depot',
      routeTo: tripChannelFilter === 'DAM' ? 'Hyderabad Central Market' : 'Kadapa Local Market',
      tollCharges: '0',
      exportType: tripChannelFilter === 'DAM' ? 'DAM' : 'Local',
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      boxesCount: '0',
      totalWeightKg: '0',
      status: 'Assigned',
      updateStatus: 'Available',
      notes: ''
    });
    setShowTripModal(true);
  };

  const handleSaveTrip = async (e) => {
    e.preventDefault();
    try {
      if (!tripForm.vehicleId || !tripForm.startKm || !tripForm.endKm) {
        setToast({ type: 'error', message: 'Vehicle, Start KM, and End KM are required.' });
        return;
      }
      const res = await logTrip(tripForm);
      setToast({ type: 'success', message: res.message || 'Trip logged successfully!' });
      setShowTripModal(false);
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || err.message });
    }
  };

  const handleDeleteTrip = async (id) => {
    if (!window.confirm('Delete this trip record?')) return;
    try {
      await deleteTrip(id);
      setToast({ type: 'success', message: 'Trip log deleted.' });
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Handlers - Fuel
  const handleOpenAddFuel = (veh = null) => {
    const targetVeh = veh || vehicles[0];
    setPreselectedFuelVehicle(targetVeh);
    setFuelForm({
      vehicleId: targetVeh ? targetVeh._id : '',
      date: new Date().toISOString().split('T')[0],
      odometerKm: targetVeh ? String(targetVeh.currentKm || '') : '',
      litres: '35',
      ratePerLitre: '98',
      totalAmount: String(35 * 98),
      fuelType: targetVeh ? targetVeh.fuelType : 'Diesel',
      fuelStation: 'Indian Oil / HP Kadapa',
      paymentMode: 'Cash',
      syncToExpense: true,
      notes: ''
    });
    setShowFuelModal(true);
  };

  const handleFuelLitresRateChange = (litresVal, rateVal) => {
    const l = parseFloat(litresVal) || 0;
    const r = parseFloat(rateVal) || 0;
    setFuelForm((prev) => ({
      ...prev,
      litres: litresVal,
      ratePerLitre: rateVal,
      totalAmount: String(Math.round(l * r))
    }));
  };

  const handleSaveFuel = async (e) => {
    e.preventDefault();
    try {
      if (!fuelForm.vehicleId || !fuelForm.litres || !fuelForm.odometerKm) {
        setToast({ type: 'error', message: 'Vehicle, Odometer KM, and Litres are required.' });
        return;
      }
      const res = await logFuel(fuelForm);
      setToast({ type: 'success', message: res.message || 'Fuel logged successfully!' });
      setShowFuelModal(false);
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || err.message });
    }
  };

  const handleDeleteFuel = async (id) => {
    if (!window.confirm('Delete this fuel log?')) return;
    try {
      await deleteFuelLog(id);
      setToast({ type: 'success', message: 'Fuel record deleted.' });
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Handlers - Maintenance
  const handleOpenAddMaintenance = (veh = null) => {
    const targetVeh = veh || vehicles[0];
    setPreselectedMaintVehicle(targetVeh);
    setMaintenanceForm({
      vehicleId: targetVeh ? targetVeh._id : '',
      date: new Date().toISOString().split('T')[0],
      odometerKm: targetVeh ? String(targetVeh.currentKm || '') : '',
      serviceType: 'Engine Oil & Filter Change',
      garageName: 'Sri Balaji Auto Garage, Kadapa',
      invoiceNumber: '',
      totalCost: '3500',
      partsReplaced: '15W40 Engine Oil 7.5L, Oil Filter, Fuel Filter',
      nextServiceDueKm: targetVeh ? String((targetVeh.currentKm || 0) + 10000) : '',
      nextServiceDueDate: '',
      syncToExpense: true,
      notes: ''
    });
    setShowMaintenanceModal(true);
  };

  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    try {
      if (!maintenanceForm.vehicleId || !maintenanceForm.totalCost) {
        setToast({ type: 'error', message: 'Vehicle and Total Cost are required.' });
        return;
      }
      const res = await logMaintenance(maintenanceForm);
      setToast({ type: 'success', message: res.message || 'Maintenance logged successfully!' });
      setShowMaintenanceModal(false);
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || err.message });
    }
  };

  const handleDeleteMaintenance = async (id) => {
    if (!window.confirm('Delete this maintenance record?')) return;
    try {
      await deleteMaintenanceLog(id);
      setToast({ type: 'success', message: 'Maintenance record deleted.' });
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'On Trip':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">On Trip</span>;
      case 'Available':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Available</span>;
      case 'In Maintenance':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Maintenance</span>;
      case 'Out of Service':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Out of Service</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800 border border-gray-200">{status || 'Idle'}</span>;
    }
  };

  // Interactive Calculator Computed Values
  const calcTotalDist = Math.max(0, (parseFloat(calcEndKm) || 0) - (parseFloat(calcStartKm) || 0));
  const calcMileage = (parseFloat(calcFuelLitres) || 0) > 0 ? (calcTotalDist / parseFloat(calcFuelLitres)).toFixed(1) : 0;
  const calcFuelCost = Math.round((parseFloat(calcFuelLitres) || 0) * (parseFloat(calcFuelRate) || 0));
  const calcCostPerKm = calcTotalDist > 0 ? (calcFuelCost / calcTotalDist).toFixed(2) : 0;

  return (
    <div className="min-h-screen bg-[#FAF0E4] p-2.5 sm:p-4 lg:p-6 font-sans text-slate-800">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ======================================================== */}
      {/* UNIFIED COMPACT STRUCTURED & BORDERED HEADER CARD        */}
      {/* ======================================================== */}
      <div className="bg-white rounded-2xl border border-[#FED7AA] p-2 sm:p-3 shadow-xs space-y-2 mb-3">
        {/* Row 1: Back + Title + Action Buttons */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
          {/* Left: Back + Title + Depot Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <BackButton onClick={onGoBack || (() => onNavigate('dashboard'))} className="shrink-0" />
            <div className="p-1.5 sm:p-2 bg-[#ea580c] text-white rounded-xl shadow-xs shrink-0 flex items-center justify-center">
              <Truck size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <h1 className="text-sm sm:text-base lg:text-lg font-black text-[#7c3f1d] leading-none m-0">Vehicle & Fleet</h1>
              <span className="text-[9.5px] sm:text-[10px] px-2 py-0.5 rounded-full bg-[#ffedd5] text-[#c2410c] font-bold border border-[#fdba74]">
                Kadapa Depot
              </span>
            </div>
          </div>

          {/* Right: Quick Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              onClick={() => handleOpenAddTrip()}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-[#7c3f1d] hover:bg-orange-50 border border-[#FED7AA] hover:border-[#ea580c] rounded-xl text-xs font-bold shadow-2xs transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-95"
            >
              <Navigation size={12} className="text-[#ea580c]" />
              <span>Log Trip</span>
            </button>
            <button
              onClick={() => handleOpenAddFuel()}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-[#7c3f1d] hover:bg-orange-50 border border-[#FED7AA] hover:border-[#ea580c] rounded-xl text-xs font-bold shadow-2xs transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-95"
            >
              <Fuel size={12} className="text-[#ea580c]" />
              <span>Add Fuel</span>
            </button>
            <button
              onClick={() => handleOpenAddMaintenance()}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white text-[#7c3f1d] hover:bg-orange-50 border border-[#FED7AA] hover:border-[#ea580c] rounded-xl text-xs font-bold shadow-2xs transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-95"
            >
              <Wrench size={12} className="text-[#ea580c]" />
              <span>Service</span>
            </button>
            <button
              onClick={handleOpenAddVehicle}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-black shadow-xs hover:shadow transition-all whitespace-nowrap shrink-0 cursor-pointer active:scale-95"
            >
              <Plus size={13} />
              <span>New Vehicle</span>
            </button>
            <button
              onClick={loadData}
              title="Refresh Data"
              className="p-1.5 bg-white text-slate-700 hover:text-[#ea580c] border border-[#FED7AA] rounded-xl shadow-2xs hover:shadow transition-all shrink-0 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Row 2: Executive KPI Strip - 4 evenly balanced structured tiles */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-0.5">
          {/* Tile 1: Fleet Overview */}
          <div className="bg-gradient-to-r from-orange-50/90 via-amber-50/60 to-white rounded-xl border border-[#fed7aa] p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs hover:border-orange-300 transition-all">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ea580c] to-[#c2410c] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Truck size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">Total Fleet</div>
              <div className="text-xs sm:text-sm font-black text-[#7c3f1d] font-mono leading-tight flex items-center gap-1.5 mt-0.5">
                <span>{vehicles.length} Vehicles</span>
                <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.2 rounded-md border border-emerald-300">
                  {vehicles.filter(v => v.status === 'Available').length} Avail
                </span>
              </div>
            </div>
          </div>

          {/* Tile 2: Monthly KMs */}
          <div className="bg-gradient-to-r from-blue-50/90 via-cyan-50/50 to-white rounded-xl border border-blue-200/80 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs hover:border-blue-300 transition-all">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Gauge size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">Monthly Distance</div>
              <div className="text-xs sm:text-sm font-black text-blue-950 font-mono leading-tight mt-0.5">
                {stats?.monthlyTotalKm ? stats.monthlyTotalKm.toLocaleString('en-IN') : '0'} <span className="text-[10px] font-medium text-slate-500">KM Run</span>
              </div>
            </div>
          </div>

          {/* Tile 3: Fuel Cost */}
          <div className="bg-gradient-to-r from-amber-50/90 via-yellow-50/50 to-white rounded-xl border border-amber-200/80 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs hover:border-amber-300 transition-all">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Fuel size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">Fuel Expense</div>
              <div className="text-xs sm:text-sm font-black text-amber-950 font-mono leading-tight flex items-center gap-1.5 mt-0.5">
                <span>₹{stats?.monthlyFuelCost ? stats.monthlyFuelCost.toLocaleString('en-IN') : '0'}</span>
                {stats?.monthlyFuelLitres > 0 && <span className="text-[9.5px] text-slate-500 font-normal">({stats.monthlyFuelLitres}L)</span>}
              </div>
            </div>
          </div>

          {/* Tile 4: Maintenance & Repairs */}
          <div className="bg-gradient-to-r from-rose-50/90 via-pink-50/50 to-white rounded-xl border border-rose-200/80 p-2 sm:p-2.5 flex items-center gap-2.5 shadow-2xs hover:border-rose-300 transition-all">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Wrench size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">Upkeep & Repairs</div>
              <div className="text-xs sm:text-sm font-black text-rose-950 font-mono leading-tight mt-0.5">
                ₹{stats?.monthlyMaintCost ? stats.monthlyMaintCost.toLocaleString('en-IN') : '0'}
              </div>
            </div>
          </div>
        </div>

        {/* Row 3: Tabs Navigation + Search + Filter Modal Button */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-[#FED7AA]/50">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'fleet'
                  ? 'bg-[#7c3f1d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
              }`}
            >
              <Truck size={13} />
              <span>Vehicles Fleet ({vehicles.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('trips')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'trips'
                  ? 'bg-[#7c3f1d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
              }`}
            >
              <Navigation size={13} />
              <span>Trips & KM Logs ({trips.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('fuel')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'fuel'
                  ? 'bg-[#7c3f1d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
              }`}
            >
              <Fuel size={13} />
              <span>Fuel Management ({fuelLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('maintenance')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'maintenance'
                  ? 'bg-[#7c3f1d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
              }`}
            >
              <Wrench size={13} />
              <span>Service & Repairs ({maintenanceLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-[#7c3f1d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
              }`}
            >
              <Radio size={13} className="text-emerald-500 animate-pulse" />
              <span>Live Map Tracking</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            </button>

            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                activeTab === 'calculator'
                  ? 'bg-[#7c3f1d] text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
              }`}
            >
              <Calculator size={13} />
              <span>KM Calculator</span>
            </button>
          </div>

          {/* Search & Filter Trigger */}
          {!['calculator', 'map'].includes(activeTab) && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search number, driver, route..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Compact Modal Filter Button for Fleet Tab */}
              {activeTab === 'fleet' && (
                <button
                  type="button"
                  onClick={() => setShowFilterModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                    activeFilterCount > 0
                      ? 'bg-[#ea580c] text-white border-[#c2410c] shadow-sm'
                      : 'bg-white text-slate-700 hover:bg-orange-50 border-[#fed7aa]'
                  }`}
                  title="Open Fleet Filters Modal"
                >
                  <Filter size={13} className={activeFilterCount > 0 ? 'text-white' : 'text-[#ea580c]'} />
                  <span>Filters</span>
                  {activeFilterCount > 0 ? (
                    <span className="w-4 h-4 rounded-full bg-amber-300 text-slate-900 text-[10px] font-black flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-500 uppercase">
                      OFF
                    </span>
                  )}
                </button>
              )}

              {['trips', 'fuel', 'maintenance'].includes(activeTab) && (
                <select
                  value={selectedVehicleFilter}
                  onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#fed7aa] rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  <option value="all">All Vehicles</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.vehicleNumber} ({v.modelName})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Compact Active Filter Chips Row (Only when filters are active) */}
        {activeTab === 'fleet' && activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#fed7aa]/50 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Filters:</span>
            {filterChannel !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10.5px] border border-blue-200">
                Channel: {filterChannel}
                <button type="button" onClick={() => setFilterChannel('ALL')} className="hover:text-red-600 cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterSupplier !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10.5px] border border-emerald-200">
                Supplier: {filterSupplier}
                <button type="button" onClick={() => setFilterSupplier('ALL')} className="hover:text-red-600 cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterVehicleType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold text-[10.5px] border border-amber-200">
                Type: {filterVehicleType}
                <button type="button" onClick={() => setFilterVehicleType('ALL')} className="hover:text-red-600 cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterFuelType !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10.5px] border border-rose-200">
                Fuel: {filterFuelType}
                <button type="button" onClick={() => setFilterFuelType('ALL')} className="hover:text-red-600 cursor-pointer"><X size={11} /></button>
              </span>
            )}
            {filterStatus !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold text-[10.5px] border border-purple-200">
                Status: {filterStatus}
                <button type="button" onClick={() => setFilterStatus('ALL')} className="hover:text-red-600 cursor-pointer"><X size={11} /></button>
              </span>
            )}
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer ml-1"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: FLEET OVERVIEW GRID                                */}
      {/* ======================================================== */}
      {activeTab === 'fleet' && (
        <div>
          {filteredVehicles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#FED7AA] p-12 text-center my-6">
              <Truck size={48} className="mx-auto text-slate-300 mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No Vehicles Registered</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Add your fish delivery vans, Tata Ace, autos, or pickup trucks to monitor trip distances and fuel economy.
              </p>
              <button
                onClick={handleOpenAddVehicle}
                className="mt-4 px-4 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-sm font-bold shadow transition-all inline-flex items-center gap-1.5"
              >
                <Plus size={16} /> Add First Vehicle
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredVehicles.map((veh) => (
                <div
                  key={veh._id}
                  className="bg-white rounded-2xl border border-[#FED7AA] p-3.5 sm:p-4 shadow-2xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Top Row: Plate & Status */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-1 bg-amber-400 text-slate-900 font-mono font-black text-xs rounded-md border-[1.5px] border-slate-900 shadow-2xs tracking-wide">
                          {veh.vehicleNumber}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          {veh.vehicleType}
                        </span>
                      </div>
                      {getStatusBadge(veh.status)}
                    </div>

                    {/* Model Name */}
                    <h3 className="text-base font-black text-[#7c3f1d] leading-snug truncate">
                      {veh.modelName}
                    </h3>

                    {/* Dedicated Driver Profile Cardlet */}
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-white border border-[#fed7aa]/90 flex items-center justify-between gap-2.5 shadow-2xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Driver Photo 56x56 */}
                        <div className="relative shrink-0">
                          {veh.driverPhoto ? (
                            <img
                              src={veh.driverPhoto}
                              alt={veh.driverName || 'Driver'}
                              className="w-14 h-14 rounded-xl object-cover border-2 border-orange-400 shadow-xs"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200 text-[#ea580c] font-black text-xl flex items-center justify-center border-2 border-orange-300 shadow-2xs">
                              {(veh.driverName || 'D').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                              veh.status === 'Available' ? 'bg-emerald-500' : veh.status === 'On Road' ? 'bg-blue-500' : 'bg-slate-400'
                            }`}
                            title={`Driver Status: ${veh.status}`}
                          />
                        </div>

                        <div className="min-w-0">
                          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 block leading-tight">
                            Assigned Driver
                          </span>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800 truncate leading-tight mt-0.5">
                            {veh.driverName || 'No Driver Assigned'}
                          </h4>
                          {veh.driverPhone ? (
                            <a
                              href={`tel:${veh.driverPhone}`}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#ea580c] hover:underline"
                            >
                              <Phone size={10} />
                              <span>{veh.driverPhone}</span>
                            </a>
                          ) : (
                            <span className="text-[10.5px] text-slate-400 italic">No phone linked</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Call Action Button */}
                      {veh.driverPhone && (
                        <a
                          href={`tel:${veh.driverPhone}`}
                          title={`Call ${veh.driverName || 'Driver'}`}
                          className="p-2 rounded-xl bg-white border border-[#fed7aa] text-[#ea580c] hover:bg-[#ea580c] hover:text-white transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95"
                        >
                          <Phone size={14} />
                        </a>
                      )}
                    </div>

                    {/* Logistics & Route Details Cardlet */}
                    <div className="space-y-2 text-xs bg-[#FAF0E4]/60 p-2.5 rounded-xl border border-[#fed7aa]/70">
                      {/* Row 1: Supplier & Channel */}
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Supplier / Syndicate</span>
                          <span className="font-extrabold text-emerald-800 truncate block mt-0.5" title={veh.assignedSupplierName || 'Kadapa Depot Direct'}>
                            {veh.assignedSupplierName || 'Kadapa Depot Direct'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Intake Channel</span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md font-bold text-[10.5px] bg-amber-100/90 text-amber-900 border border-amber-300">
                            {veh.operationalMode || 'All Channels'}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Odometer & Fuel */}
                      <div className="pt-1.5 border-t border-[#fed7aa]/60 grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Odometer</span>
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-[13px] block mt-0.5">
                            {veh.currentKm ? veh.currentKm.toLocaleString('en-IN') : 0} <span className="text-[10px] font-normal text-slate-500">KM</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Fuel & Mileage</span>
                          <span className="font-bold text-slate-800 block mt-0.5">
                            {veh.fuelType} {veh.averageMileage ? `• ${veh.averageMileage} km/l` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Telemetry Summary */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-gradient-to-b from-orange-50 to-orange-100/60 rounded-xl p-1.5 border border-orange-200 shadow-2xs">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Month Run</div>
                        <div className="text-xs font-black text-[#c2410c] font-mono mt-0.5">
                          {veh.stats?.monthlyKm ? `${veh.stats.monthlyKm} KM` : '0 KM'}
                        </div>
                      </div>
                      <div className="bg-gradient-to-b from-blue-50 to-blue-100/60 rounded-xl p-1.5 border border-blue-200 shadow-2xs">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Fuel Spend</div>
                        <div className="text-xs font-black text-blue-900 font-mono mt-0.5">
                          ₹{veh.stats?.monthlyFuelCost ? veh.stats.monthlyFuelCost.toLocaleString('en-IN') : '0'}
                        </div>
                      </div>
                      <div className="bg-gradient-to-b from-rose-50 to-rose-100/60 rounded-xl p-1.5 border border-rose-200 shadow-2xs">
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Repairs</div>
                        <div className="text-xs font-black text-rose-900 font-mono mt-0.5">
                          ₹{veh.stats?.monthlyMaintCost ? veh.stats.monthlyMaintCost.toLocaleString('en-IN') : '0'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-[#fed7aa]/50">
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                      <button
                        onClick={() => handleOpenAddTrip(veh)}
                        className="px-2.5 py-1.5 bg-orange-100 hover:bg-[#ea580c] hover:text-white text-[#7c3f1d] rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="Log a delivery trip"
                      >
                        <Navigation size={12} /> <span>Trip</span>
                      </button>
                      <button
                        onClick={() => handleOpenAddFuel(veh)}
                        className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="Log fuel refill"
                      >
                        <Fuel size={12} /> <span>Fuel</span>
                      </button>
                      <button
                        onClick={() => handleOpenAddMaintenance(veh)}
                        className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-600 hover:text-white text-rose-900 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="Log repair or maintenance"
                      >
                        <Wrench size={12} /> <span>Service</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('map')}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-800 border border-emerald-200 hover:border-emerald-600 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                        title="View live position on map"
                      >
                        <Radio size={12} className="text-emerald-600 group-hover:text-white animate-pulse" /> <span>Map</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEditVehicle(veh)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Edit vehicle details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(veh._id, veh.vehicleNumber)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="Remove vehicle"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: REAL-TIME LIVE FLEET MAP (OPTION 1)                 */}
      {/* ======================================================== */}
      {activeTab === 'map' && (
        <div className="mb-6">
          <LiveFleetMap vehicles={vehicles} onRefresh={loadData} />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TRIPS & KM TRACKING TABLE                          */}
      {/* ======================================================== */}
      {activeTab === 'trips' && (
        <div className="bg-white rounded-2xl border border-[#FED7AA] shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 bg-[#fffaf5] border-b border-[#fed7aa] flex items-center justify-between gap-2">
            <h3 className="font-bold text-[#7c3f1d] text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
              <Navigation size={18} className="text-[#ea580c] shrink-0" />
              <span>Trip Distance & KM Logs</span>
            </h3>
            <button
              onClick={() => handleOpenAddTrip()}
              className="px-3 sm:px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1 shrink-0"
            >
              <Plus size={14} /> <span>Log Trip</span>
            </button>
          </div>

          {/* Consignment Channel Filter Pills */}
          <div className="px-3 sm:px-4 py-2 bg-[#FAF0E4]/60 border-b border-[#FED7AA]/60 flex items-center gap-1.5 sm:gap-2 overflow-x-auto">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider shrink-0 mr-1">
              Consignment Channel:
            </span>
            {[
              { id: 'ALL', label: 'All Trips', count: trips.length },
              { id: 'LOCAL', label: 'Export - Local', count: trips.filter(t => t.exportType === 'Local' || t.purpose?.toLowerCase().includes('local')).length },
              { id: 'DAM', label: 'Export - DAM Bulk', count: trips.filter(t => t.exportType === 'DAM' || t.purpose?.toLowerCase().includes('dam')).length }
            ].map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setTripChannelFilter(pill.id)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  tripChannelFilter === pill.id
                    ? 'bg-[#ea580c] text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-orange-50 border border-[#FED7AA]'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  tripChannelFilter === pill.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {pill.count}
                </span>
              </button>
            ))}
          </div>

          {/* Dynamic Mobile Cards (sm:hidden) */}
          <div className="block sm:hidden p-3 space-y-3 bg-[#fffdfa]">
            {filteredTrips.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs px-4">
                No trip records found. Tap "Log Trip" to register trip distance.
              </div>
            ) : (
              filteredTrips.map((t) => (
                <div key={t._id} className="bg-white rounded-xl p-3 border border-[#FED7AA] shadow-xs space-y-2.5">
                  {/* Top: Plate + Date + Run + Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold bg-amber-400 text-slate-900 px-2 py-0.5 rounded border border-slate-900 text-xs shadow-xs">
                        {t.vehicleNumber}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(t.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-full font-mono text-xs">
                        +{t.distanceKm} KM
                      </span>
                      <button
                        onClick={() => handleDeleteTrip(t._id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete trip log"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Route & Purpose Box */}
                  <div className="bg-[#FAF0E4]/40 p-2.5 rounded-lg border border-[#FED7AA]/60 space-y-1.5">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{t.routeFrom || 'Kadapa City Depot'}</span>
                        <ArrowRight size={12} className="text-[#ea580c] shrink-0" />
                        <span className="text-[#ea580c]">{t.routeTo || 'Local Market'}</span>
                      </div>
                      {t.exportType && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          t.exportType === 'DAM' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          {t.exportType === 'DAM' ? 'Export (DAM)' : 'Export (Local)'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-700 font-medium">
                        <User size={12} className="text-slate-400" /> {t.driverName || 'Driver Not Assigned'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-[#c2410c] font-semibold">
                        {t.purpose}
                      </span>
                    </div>

                    {/* Consignment Dealer & Boxes info */}
                    {t.customerName && (
                      <div className="pt-1.5 mt-1 border-t border-[#fed7aa]/60 flex items-center justify-between text-[11px] flex-wrap gap-1">
                        <div className="font-bold text-slate-800">
                          Dealer: <span className="text-[#c2410c]">{t.customerName}</span>
                          {t.customerPhone && <span className="text-slate-500 font-normal"> ({t.customerPhone})</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          {t.boxesCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 font-extrabold rounded text-[10px]">
                              {t.boxesCount} Boxes
                            </span>
                          )}
                          <span className={`px-1.5 py-0.2 rounded font-black text-[10px] uppercase ${
                            t.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {t.status || 'Assigned'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metrics Odometer Row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">Start KM</div>
                      <div className="font-mono font-bold text-slate-800">{t.startKm?.toLocaleString('en-IN') || 0}</div>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-medium">End KM</div>
                      <div className="font-mono font-bold text-slate-800">{t.endKm?.toLocaleString('en-IN') || 0}</div>
                    </div>
                    <div className="bg-orange-50/70 p-1.5 rounded-lg border border-orange-200/60">
                      <div className="text-[10px] text-[#c2410c] font-medium">Toll Fee</div>
                      <div className="font-mono font-bold text-slate-800">₹{t.tollCharges || 0}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF0E4] text-[#7c3f1d] font-bold border-b border-[#fed7aa]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Route & Purpose</th>
                  <th className="py-3 px-4 text-right">Start KM</th>
                  <th className="py-3 px-4 text-right">End KM</th>
                  <th className="py-3 px-4 text-right">Distance Run</th>
                  <th className="py-3 px-4 text-right">Toll (₹)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No trip records found. Click "Log New Trip" to register trip distance.
                    </td>
                  </tr>
                ) : (
                  filteredTrips.map((t) => (
                    <tr key={t._id} className="hover:bg-orange-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {new Date(t.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold bg-amber-100 text-slate-900 px-2 py-0.5 rounded border border-amber-300 text-xs">
                          {t.vehicleNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{t.driverName || '—'}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900">{t.purpose}</span>
                          {t.exportType && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider ${
                              t.exportType === 'DAM' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {t.exportType}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {t.routeFrom} → {t.routeTo || 'Local Market'}
                        </div>
                        {t.customerName && (
                          <div className="text-[11px] font-bold text-amber-900 mt-0.5 flex items-center gap-1.5">
                            <span>Dealer: {t.customerName}</span>
                            {t.boxesCount > 0 && <span className="bg-amber-100 text-amber-800 px-1 rounded text-[10px]">{t.boxesCount} Boxes</span>}
                            <span className={`text-[10px] uppercase font-black ${t.status === 'Delivered' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              • {t.status || 'Assigned'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {t.startKm?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {t.endKm?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full font-mono text-xs">
                          +{t.distanceKm} KM
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-600">
                        ₹{t.tollCharges || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteTrip(t._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete trip log"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: FUEL MANAGEMENT TABLE                             */}
      {/* ======================================================== */}
      {activeTab === 'fuel' && (
        <div className="bg-white rounded-2xl border border-[#FED7AA] shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 bg-[#fffaf5] border-b border-[#fed7aa] flex items-center justify-between gap-2">
            <h3 className="font-bold text-[#7c3f1d] text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
              <Fuel size={18} className="text-[#ea580c] shrink-0" />
              <span>Fuel Refill & Mileage Logs</span>
            </h3>
            <button
              onClick={() => handleOpenAddFuel()}
              className="px-3 sm:px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1 shrink-0"
            >
              <Plus size={14} /> <span>Add Fuel</span>
            </button>
          </div>

          {/* Dynamic Mobile Cards (sm:hidden) */}
          <div className="block sm:hidden p-3 space-y-3 bg-[#fffdfa]">
            {filteredFuelLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs px-4">
                No fuel logs recorded yet. Tap "Add Fuel" to log diesel/petrol fill-ups.
              </div>
            ) : (
              filteredFuelLogs.map((f) => (
                <div key={f._id} className="bg-white rounded-xl p-3 border border-[#FED7AA] shadow-xs space-y-2.5">
                  {/* Top: Plate + Date + Mileage + Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold bg-amber-400 text-slate-900 px-2 py-0.5 rounded border border-slate-900 text-xs shadow-xs">
                        {f.vehicleNumber}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(f.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {f.calculatedMileage > 0 ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold rounded-full text-xs">
                          {f.calculatedMileage} KM/L
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                      <button
                        onClick={() => handleDeleteFuel(f._id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete fuel log"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Amount & Volume Details */}
                  <div className="bg-[#FAF0E4]/40 p-2.5 rounded-lg border border-[#FED7AA]/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Total Cost</div>
                      <div className="text-lg font-black text-[#7c3f1d]">₹{f.totalAmount?.toLocaleString('en-IN')}</div>
                      <div className="text-[11px] text-slate-600 font-medium">
                        {f.litres} L @ ₹{f.ratePerLitre}/L
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Odometer</div>
                      <div className="font-mono font-bold text-slate-800 text-sm">
                        {f.odometerKm?.toLocaleString('en-IN')} KM
                      </div>
                    </div>
                  </div>

                  {/* Station & Payment Row */}
                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 px-1">
                    <span className="font-medium text-slate-800 truncate">{f.fuelStation || 'Local Fuel Station'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                      {f.paymentMode} {f.syncedToExpenses && '• Synced'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF0E4] text-[#7c3f1d] font-bold border-b border-[#fed7aa]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4 text-right">Odometer (KM)</th>
                  <th className="py-3 px-4 text-right">Litres</th>
                  <th className="py-3 px-4 text-right">Rate/L</th>
                  <th className="py-3 px-4 text-right">Total (₹)</th>
                  <th className="py-3 px-4 text-center">Economy / Mileage</th>
                  <th className="py-3 px-4">Station & Mode</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFuelLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No fuel logs recorded yet. Click "Add Fuel Entry" to log diesel/petrol fill-ups.
                    </td>
                  </tr>
                ) : (
                  filteredFuelLogs.map((f) => (
                    <tr key={f._id} className="hover:bg-orange-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {new Date(f.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold bg-amber-100 text-slate-900 px-2 py-0.5 rounded border border-amber-300 text-xs">
                          {f.vehicleNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                        {f.odometerKm?.toLocaleString('en-IN')} KM
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{f.litres} L</td>
                      <td className="py-3 px-4 text-right text-slate-600">₹{f.ratePerLitre}</td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#7c3f1d]">
                        ₹{f.totalAmount?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {f.calculatedMileage > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs">
                            {f.calculatedMileage} KM/L
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">{f.fuelStation || 'Petrol Pump'}</div>
                        <div className="text-[11px] text-slate-500">
                          {f.paymentMode} {f.syncedToExpenses && '• Synced to Day Book'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteFuel(f._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete fuel log"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: REPAIRS & MAINTENANCE TABLE                       */}
      {/* ======================================================== */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-2xl border border-[#FED7AA] shadow-sm overflow-hidden">
          <div className="p-3 sm:p-4 bg-[#fffaf5] border-b border-[#fed7aa] flex items-center justify-between gap-2">
            <h3 className="font-bold text-[#7c3f1d] text-sm sm:text-base flex items-center gap-1.5 sm:gap-2">
              <Wrench size={18} className="text-[#ea580c] shrink-0" />
              <span>Vehicle Repairs & Upkeep</span>
            </h3>
            <button
              onClick={() => handleOpenAddMaintenance()}
              className="px-3 sm:px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1 shrink-0"
            >
              <Plus size={14} /> <span>Log Service</span>
            </button>
          </div>

          {/* Dynamic Mobile Cards (sm:hidden) */}
          <div className="block sm:hidden p-3 space-y-3 bg-[#fffdfa]">
            {filteredMaintenanceLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs px-4">
                No repair or maintenance logs found. Tap "Log Service" to record vehicle upkeep.
              </div>
            ) : (
              filteredMaintenanceLogs.map((m) => (
                <div key={m._id} className="bg-white rounded-xl p-3 border border-[#FED7AA] shadow-xs space-y-2.5">
                  {/* Top: Plate + Date + Cost + Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold bg-amber-400 text-slate-900 px-2 py-0.5 rounded border border-slate-900 text-xs shadow-xs">
                        {m.vehicleNumber}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {new Date(m.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-rose-800 text-sm">
                        ₹{m.totalCost?.toLocaleString('en-IN')}
                      </span>
                      <button
                        onClick={() => handleDeleteMaintenance(m._id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete service record"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Service Details Box */}
                  <div className="bg-[#FAF0E4]/40 p-2.5 rounded-lg border border-[#FED7AA]/60 space-y-1">
                    <div className="text-xs font-bold text-slate-900">{m.serviceType}</div>
                    {m.partsReplaced && (
                      <div className="text-[11px] text-slate-600 italic">Parts: {m.partsReplaced}</div>
                    )}
                    <div className="text-[11px] text-slate-700 font-medium pt-0.5">
                      {m.garageName || 'Local Garage'} {m.invoiceNumber && `• Inv #${m.invoiceNumber}`}
                    </div>
                  </div>

                  {/* Odometer & Next Alert */}
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600 px-1">
                    <span className="font-mono text-[11px]">
                      Odo: {m.odometerKm ? `${m.odometerKm.toLocaleString('en-IN')} KM` : '—'}
                    </span>
                    {m.nextServiceDueKm ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-mono font-semibold text-[10px] border border-blue-200">
                        Due @ {m.nextServiceDueKm.toLocaleString('en-IN')} KM
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">No next alert</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[850px] text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF0E4] text-[#7c3f1d] font-bold border-b border-[#fed7aa]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Service Type</th>
                  <th className="py-3 px-4">Garage & Invoice</th>
                  <th className="py-3 px-4 text-right">Odometer</th>
                  <th className="py-3 px-4 text-right">Cost (₹)</th>
                  <th className="py-3 px-4">Next Service Alert</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMaintenanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No repair or maintenance logs found. Click "Log Maintenance" to record vehicle services.
                    </td>
                  </tr>
                ) : (
                  filteredMaintenanceLogs.map((m) => (
                    <tr key={m._id} className="hover:bg-orange-50/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-600">
                        {new Date(m.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold bg-amber-100 text-slate-900 px-2 py-0.5 rounded border border-amber-300 text-xs">
                          {m.vehicleNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{m.serviceType}</div>
                        {m.partsReplaced && (
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">{m.partsReplaced}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{m.garageName || 'Local Garage'}</div>
                        {m.invoiceNumber && (
                          <div className="text-[11px] text-slate-500 font-mono">Inv: #{m.invoiceNumber}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {m.odometerKm ? `${m.odometerKm.toLocaleString('en-IN')} KM` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-rose-800 text-sm">
                        ₹{m.totalCost?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        {m.nextServiceDueKm ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 rounded font-mono font-semibold text-xs border border-blue-200">
                            Due @ {m.nextServiceDueKm.toLocaleString('en-IN')} KM
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleDeleteMaintenance(m._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete service record"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: KM & MILEAGE ECONOMY CALCULATOR                   */}
      {/* ======================================================== */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
          {/* Inputs Card */}
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-3.5 sm:p-5 shadow-xs">
            <h3 className="text-sm sm:text-base font-bold text-[#7c3f1d] mb-1 flex items-center gap-2">
              <Calculator size={18} className="text-[#ea580c]" />
              Quick Trip & Fuel Calculator
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 mb-3 sm:mb-4">
              Calculate running kilometers, trip cost, and fuel efficiency before or after a fish delivery run.
            </p>

            <div className="space-y-2.5 sm:space-y-3.5">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">Start Odometer (KM)</label>
                  <input
                    type="number"
                    value={calcStartKm}
                    onChange={(e) => setCalcStartKm(e.target.value)}
                    className="w-full p-2 sm:p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 12400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">End Odometer (KM)</label>
                  <input
                    type="number"
                    value={calcEndKm}
                    onChange={(e) => setCalcEndKm(e.target.value)}
                    className="w-full p-2 sm:p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 12580"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">Fuel Filled (Litres)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcFuelLitres}
                    onChange={(e) => setCalcFuelLitres(e.target.value)}
                    className="w-full p-2 sm:p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 15"
                  />
                </div>
                <div>
                  <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">Fuel Price (₹ / Litre)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcFuelRate}
                    onChange={(e) => setCalcFuelRate(e.target.value)}
                    className="w-full p-2 sm:p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 98"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="bg-[#7c3f1d] text-white rounded-2xl p-3.5 sm:p-5 shadow-md flex flex-col justify-between">
            <div>
              <span className="text-[10.5px] sm:text-xs font-bold uppercase tracking-wider text-orange-200">
                Calculated Trip Metrics
              </span>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-2.5 sm:mt-4">
                <div className="bg-white/10 p-2 sm:p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-[10px] sm:text-xs text-orange-200 leading-tight">Total Distance Covered</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-white mt-1 font-mono">
                    {calcTotalDist} <span className="text-xs sm:text-sm font-normal">KM</span>
                  </div>
                </div>

                <div className="bg-white/10 p-2 sm:p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-[10px] sm:text-xs text-orange-200 leading-tight">Calculated Mileage</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                    {calcMileage} <span className="text-xs sm:text-sm font-normal">KM/L</span>
                  </div>
                </div>

                <div className="bg-white/10 p-2 sm:p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-[10px] sm:text-xs text-orange-200 leading-tight">Total Fuel Cost</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-white mt-1 font-mono">
                    ₹{calcFuelCost}
                  </div>
                </div>

                <div className="bg-white/10 p-2 sm:p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-[10px] sm:text-xs text-orange-200 leading-tight">Running Cost / KM</div>
                  <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-amber-300 mt-1 font-mono">
                    ₹{calcCostPerKm} <span className="text-[9.5px] sm:text-xs font-normal">/ KM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-white/20 text-xs text-orange-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10.5px] sm:text-xs">Efficiency: <strong className="text-emerald-300">Good</strong></span>
              <button
                onClick={() => {
                  handleOpenAddTrip();
                  setTripForm((prev) => ({
                    ...prev,
                    startKm: calcStartKm,
                    endKm: calcEndKm
                  }));
                }}
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-lg transition-colors flex items-center gap-1 text-[11px] sm:text-xs shadow-xs active:scale-95 cursor-pointer"
              >
                <span>Use in Log Trip</span> <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT VEHICLE                              */}
      {/* ======================================================== */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#FED7AA] max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#7c3f1d] flex items-center gap-2">
                <Truck size={20} className="text-[#ea580c]" />
                {editingVehicle ? 'Edit Vehicle Details' : 'Register New Fleet Vehicle'}
              </h3>
              <button onClick={() => setShowVehicleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vehicle Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AP 04 TX 4589"
                    value={vehicleForm.vehicleNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Model / Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mahindra Bolero Pickup"
                    value={vehicleForm.modelName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, modelName: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Type</label>
                  <select
                    value={vehicleForm.vehicleType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, vehicleType: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fuel Type</label>
                  <select
                    value={vehicleForm.fuelType}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, fuelType: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Reddy"
                    value={vehicleForm.driverName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">Driver Mobile</label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {vehicleForm.driverPhone ? `${vehicleForm.driverPhone.length}/10` : '10 digits'}
                    </span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="e.g. 9849313889"
                    value={vehicleForm.driverPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setVehicleForm({ ...vehicleForm, driverPhone: digits });
                    }}
                    className={`w-full p-2.5 bg-[#fffaf5] border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 ${
                      vehicleForm.driverPhone && vehicleForm.driverPhone.length !== 10
                        ? 'border-rose-400 focus:ring-rose-400'
                        : 'border-[#fed7aa] focus:ring-[#ea580c]'
                    }`}
                  />
                  {vehicleForm.driverPhone && vehicleForm.driverPhone.length !== 10 && (
                    <span className="text-[10px] font-semibold text-rose-600 block mt-0.5">
                      Must be exactly 10 digits ({10 - vehicleForm.driverPhone.length} remaining)
                    </span>
                  )}
                </div>
              </div>

              {/* Driver Profile Photo with <= 5MB validation & Image Cropper */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Driver Profile Photo (Optional)</label>
                  <span className="text-[10.5px] text-slate-500 font-medium">Max 5MB • JPG, PNG, WEBP</span>
                </div>
                {!vehicleForm.driverPhoto ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value=""
                      readOnly
                      className="flex-1 p-2 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs text-slate-400 focus:outline-none"
                      placeholder="Upload driver profile photo..."
                    />
                    <label className="bg-orange-50 hover:bg-orange-100 text-[#ea580c] px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs border border-orange-200 shrink-0 font-bold transition-all shadow-2xs">
                      <Upload size={13} />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) handleImageUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2 bg-orange-50/60 border border-orange-200 rounded-xl gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={vehicleForm.driverPhoto}
                        alt="Driver Preview"
                        onClick={() => {
                          setCropperRawSrc(vehicleForm.driverPhoto);
                          setIsCropperOpen(true);
                        }}
                        title="Click to crop photo"
                        className="w-10 h-10 rounded-full object-cover border border-orange-300 shrink-0 shadow-2xs cursor-pointer hover:opacity-85 transition-opacity"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-800 truncate block">
                          {uploadFileInfo?.name || (vehicleForm.driverName ? `${vehicleForm.driverName}'s Photo` : 'Driver Profile Photo')}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {uploadFileInfo ? `.${uploadFileInfo.extension} • ${uploadFileInfo.size}` : 'Uploaded'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {vehicleForm.driverPhoto && (
                        <button
                          type="button"
                          onClick={() => {
                            setCropperRawSrc(vehicleForm.driverPhoto);
                            setIsCropperOpen(true);
                          }}
                          title="Crop current driver photo"
                          className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-[#ea580c] border border-orange-300 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                        >
                          <Crop size={11} />
                          <span>Crop</span>
                        </button>
                      )}
                      <label className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors shadow-2xs">
                        <span>Change</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) handleImageUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFileInfo(null);
                          setVehicleForm({ ...vehicleForm, driverPhoto: '' });
                        }}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier & Operational Channel Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Linked Supplier / Syndicate (Optional)
                  </label>
                  <select
                    value={vehicleForm.assignedSupplierId || ''}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const selSup = suppliersList.find(s => s._id === selId);
                      setVehicleForm({
                        ...vehicleForm,
                        assignedSupplierId: selId,
                        assignedSupplierName: selSup?.name || ''
                      });
                    }}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    <option value="">-- Direct Depot Fleet (No Supplier) --</option>
                    {suppliersList.map(s => {
                      const alreadyVeh = vehicles.find(v => 
                        (!editingVehicle || v._id !== editingVehicle._id) && (
                          (v.assignedSupplierId && String(v.assignedSupplierId) === String(s._id)) ||
                          (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === s.name.toLowerCase()) ||
                          (s.vehicleNumber && v.vehicleNumber?.toUpperCase() === s.vehicleNumber.toUpperCase())
                        )
                      );
                      const isAssigned = Boolean(alreadyVeh);
                      const statusTag = isAssigned 
                        ? `[Already Assigned: ${alreadyVeh.vehicleNumber}]` 
                        : `[Available]`;

                      return (
                        <option 
                          key={s._id} 
                          value={s._id}
                          className={isAssigned ? 'text-amber-800 bg-amber-50 font-semibold' : ''}
                        >
                          {isAssigned ? '⚠️ ' : ''}{s.name} {s.companyName ? `(${s.companyName})` : ''} — {statusTag}
                        </option>
                      );
                    })}
                  </select>
                  {(() => {
                    const selSup = suppliersList.find(s => s._id === vehicleForm.assignedSupplierId);
                    if (selSup) {
                      const alreadyVeh = vehicles.find(v => 
                        (!editingVehicle || v._id !== editingVehicle._id) && (
                          (v.assignedSupplierId && String(v.assignedSupplierId) === String(selSup._id)) ||
                          (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === selSup.name.toLowerCase()) ||
                          (selSup.vehicleNumber && v.vehicleNumber?.toUpperCase() === selSup.vehicleNumber.toUpperCase())
                        )
                      );
                      if (alreadyVeh) {
                        return (
                          <div className="mt-1.5 flex items-start gap-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10.5px] font-semibold leading-tight">
                            <span className="shrink-0 text-amber-600 font-bold">⚠️</span>
                            <span><strong>{selSup.name}</strong> is currently assigned to vehicle <strong>{alreadyVeh.vehicleNumber}</strong> ({alreadyVeh.modelName || alreadyVeh.vehicleType}). Saving will reassign this supplier to this new vehicle.</span>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Operational Intake Channel
                  </label>
                  <select
                    value={vehicleForm.operationalMode || 'All'}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, operationalMode: e.target.value })}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    <option value="All">All Operations / General Fleet</option>
                    <option value="Local Catch">Local Harbor Catch Intake</option>
                    <option value="DAM Consignments">DAM Reservoir Consignments</option>
                    <option value="Supplies & Packaging">Packaging & Consumables Vendor</option>
                    <option value="Depot Distribution">Customer / Market Distribution</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Odometer (KM)</label>
                  <input
                    type="number"
                    min="0"
                    value={vehicleForm.currentKm}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, currentKm: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={vehicleForm.status}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, status: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    {VEHICLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tank Capacity (L)</label>
                  <input
                    type="number"
                    min="1"
                    value={vehicleForm.tankCapacity}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, tankCapacity: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="45"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Insurance Expiry</label>
                  <input
                    type="date"
                    value={vehicleForm.insuranceExpiry}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiry: e.target.value })}
                    className="w-full p-2 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Service Due (KM)</label>
                  <input
                    type="number"
                    placeholder="e.g. 20000"
                    value={vehicleForm.nextServiceDueKm}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, nextServiceDueKm: e.target.value })}
                    className="w-full p-2 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Notes / Permit</label>
                <textarea
                  rows="2"
                  value={vehicleForm.notes}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })}
                  placeholder="e.g. Fitted with 500KG PUF insulated cold-storage ice fish container"
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(vehicleForm.driverPhone && vehicleForm.driverPhone.length !== 10)}
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  {editingVehicle ? 'Update Vehicle' : 'Register Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: LOG TRIP                                        */}
      {/* ======================================================== */}
      {showTripModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#FED7AA] max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#7c3f1d] flex items-center gap-2">
                <Navigation size={20} className="text-[#ea580c]" />
                Log Delivery Trip / Kilometers
              </h3>
              <button onClick={() => setShowTripModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTrip} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Vehicle <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={tripForm.vehicleId}
                  onChange={(e) => {
                    const sel = vehicles.find((v) => v._id === e.target.value);
                    setTripForm({
                      ...tripForm,
                      vehicleId: e.target.value,
                      driverName: sel ? sel.driverName : tripForm.driverName,
                      startKm: sel ? String(sel.currentKm || 0) : tripForm.startKm
                    });
                  }}
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.vehicleNumber} ({v.modelName}) • Odo: {v.currentKm} KM
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={tripForm.driverName}
                    onChange={(e) => setTripForm({ ...tripForm, driverName: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trip Date</label>
                  <input
                    type="date"
                    value={tripForm.date}
                    onChange={(e) => setTripForm({ ...tripForm, date: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              {/* Odometer KM Calculation Section */}
              <div className="bg-[#FAF0E4] p-3.5 rounded-xl border border-[#FED7AA]">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start KM *</label>
                    <input
                      type="number"
                      required
                      value={tripForm.startKm}
                      onChange={(e) => setTripForm({ ...tripForm, startKm: e.target.value })}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">End KM *</label>
                    <input
                      type="number"
                      required
                      value={tripForm.endKm}
                      onChange={(e) => setTripForm({ ...tripForm, endKm: e.target.value })}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Calculated Run</label>
                    <div className="p-2 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-mono font-extrabold text-sm text-center">
                      {Math.max(0, (Number(tripForm.endKm) || 0) - (Number(tripForm.startKm) || 0))} KM
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">From Location</label>
                  <input
                    type="text"
                    value={tripForm.routeFrom}
                    onChange={(e) => setTripForm({ ...tripForm, routeFrom: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">To Destination</label>
                  <input
                    type="text"
                    placeholder="e.g. Nellore Harbour / Utukuru"
                    value={tripForm.routeTo}
                    onChange={(e) => setTripForm({ ...tripForm, routeTo: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Trip Purpose</label>
                  <input
                    type="text"
                    value={tripForm.purpose}
                    onChange={(e) => setTripForm({ ...tripForm, purpose: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Toll Charges (₹)</label>
                  <input
                    type="number"
                    value={tripForm.tollCharges}
                    onChange={(e) => setTripForm({ ...tripForm, tollCharges: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              {/* Consignment Channel & Dealer Integration */}
              <div className="bg-[#fffaf5] p-3 rounded-xl border border-[#fed7aa] space-y-3">
                <div className="text-xs font-bold text-[#c2410c] uppercase tracking-wide">
                  📦 Consignment & Dealer Link
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Consignment Channel</label>
                    <select
                      value={tripForm.exportType}
                      onChange={(e) => setTripForm({ ...tripForm, exportType: e.target.value })}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="Local">Export - Local Transport</option>
                      <option value="DAM">Export - DAM Consignment</option>
                      <option value="General">General / Depot Run</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dealer / Supplier / Customer</label>
                    <input
                      type="text"
                      list="trip-party-suggestions"
                      placeholder="e.g. Ramesh Reddy (DAM)"
                      value={tripForm.customerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = suppliersList.find(s => s.name?.toLowerCase() === val.toLowerCase() || s.companyName?.toLowerCase() === val.toLowerCase());
                        setTripForm({
                          ...tripForm,
                          customerName: val,
                          customerPhone: match?.phone || tripForm.customerPhone
                        });
                      }}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#ea580c]"
                    />
                    <datalist id="trip-party-suggestions">
                      {suppliersList
                        .filter(s => {
                          if (tripForm.exportType === 'Local') return s.supplierType === 'Local' || s.supplierType === 'All';
                          if (tripForm.exportType === 'DAM') return s.supplierType === 'DAM' || s.supplierType === 'All';
                          return true;
                        })
                        .map(s => (
                          <option key={s._id} value={s.name}>
                            {s.companyName ? `${s.companyName} • ` : ''}Ph: {s.phone || '—'}
                          </option>
                        ))}
                    </datalist>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700">Phone</label>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {tripForm.customerPhone ? `${tripForm.customerPhone.length}/10` : '10 digits'}
                      </span>
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit phone"
                      value={tripForm.customerPhone}
                      onChange={(e) => setTripForm({ ...tripForm, customerPhone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Boxes Count</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={tripForm.boxesCount}
                      onChange={(e) => setTripForm({ ...tripForm, boxesCount: e.target.value })}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Weight (Kg)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={tripForm.totalWeightKg}
                      onChange={(e) => setTripForm({ ...tripForm, totalWeightKg: e.target.value })}
                      className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTripModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Save Trip Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ADD FUEL LOG                                    */}
      {/* ======================================================== */}
      {showFuelModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#FED7AA] max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#7c3f1d] flex items-center gap-2">
                <Fuel size={20} className="text-[#ea580c]" />
                Record Fuel Refill & Mileage
              </h3>
              <button onClick={() => setShowFuelModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveFuel} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Vehicle <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={fuelForm.vehicleId}
                  onChange={(e) => {
                    const sel = vehicles.find((v) => v._id === e.target.value);
                    setFuelForm({
                      ...fuelForm,
                      vehicleId: e.target.value,
                      fuelType: sel ? sel.fuelType : fuelForm.fuelType,
                      odometerKm: sel ? String(sel.currentKm || '') : fuelForm.odometerKm
                    });
                  }}
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.vehicleNumber} ({v.modelName}) • Current: {v.currentKm} KM
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Refuel Date</label>
                  <input
                    type="date"
                    value={fuelForm.date}
                    onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Odometer (KM) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    value={fuelForm.odometerKm}
                    onChange={(e) => setFuelForm({ ...fuelForm, odometerKm: e.target.value })}
                    placeholder="e.g. 15420"
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-[#FAF0E4] p-3 rounded-xl border border-[#FED7AA]">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Litres Filled *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.litres}
                    onChange={(e) => handleFuelLitresRateChange(e.target.value, fuelForm.ratePerLitre)}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rate / L (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fuelForm.ratePerLitre}
                    onChange={(e) => handleFuelLitresRateChange(fuelForm.litres, e.target.value)}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Bill (₹)</label>
                  <input
                    type="number"
                    required
                    value={fuelForm.totalAmount}
                    onChange={(e) => setFuelForm({ ...fuelForm, totalAmount: e.target.value })}
                    className="w-full p-2 bg-white border border-[#fed7aa] rounded-xl font-mono font-bold text-sm text-[#7c3f1d] focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fuel Station</label>
                  <input
                    type="text"
                    value={fuelForm.fuelStation}
                    onChange={(e) => setFuelForm({ ...fuelForm, fuelStation: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={fuelForm.paymentMode}
                    onChange={(e) => setFuelForm({ ...fuelForm, paymentMode: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay</option>
                    <option value="Card">Card</option>
                    <option value="Credit / Khata">Credit / Khata</option>
                  </select>
                </div>
              </div>

              {/* Sync to Expenses Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                <input
                  type="checkbox"
                  id="syncFuelExpense"
                  checked={fuelForm.syncToExpense}
                  onChange={(e) => setFuelForm({ ...fuelForm, syncToExpense: e.target.checked })}
                  className="w-4 h-4 text-[#ea580c] rounded focus:ring-orange-500"
                />
                <label htmlFor="syncFuelExpense" className="text-xs font-medium text-slate-800 cursor-pointer">
                  Sync automatically into <strong>Finance Expenses & Day Book</strong> under Maintenance
                </label>
              </div>


              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFuelModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Save Fuel Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: LOG MAINTENANCE / REPAIR                        */}
      {/* ======================================================== */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#FED7AA] max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-[#7c3f1d] flex items-center gap-2">
                <Wrench size={20} className="text-[#ea580c]" />
                Record Vehicle Repair / Servicing
              </h3>
              <button onClick={() => setShowMaintenanceModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Vehicle <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={maintenanceForm.vehicleId}
                  onChange={(e) => {
                    const sel = vehicles.find((v) => v._id === e.target.value);
                    setMaintenanceForm({
                      ...maintenanceForm,
                      vehicleId: e.target.value,
                      odometerKm: sel ? String(sel.currentKm || '') : maintenanceForm.odometerKm
                    });
                  }}
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.vehicleNumber} ({v.modelName}) • Current: {v.currentKm} KM
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Service Date</label>
                  <input
                    type="date"
                    value={maintenanceForm.date}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, date: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Odometer Reading (KM)</label>
                  <input
                    type="number"
                    value={maintenanceForm.odometerKm}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, odometerKm: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 16500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service / Repair Type</label>
                <select
                  value={maintenanceForm.serviceType}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, serviceType: e.target.value })}
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  {SERVICE_TYPES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Garage / Mechanic</label>
                  <input
                    type="text"
                    placeholder="e.g. Balaji Motors Kadapa"
                    value={maintenanceForm.garageName}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, garageName: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Service Bill (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 4500"
                    value={maintenanceForm.totalCost}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, totalCost: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono font-bold text-sm text-rose-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bill / Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-8841"
                    value={maintenanceForm.invoiceNumber}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, invoiceNumber: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Next Service Due (KM)</label>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    value={maintenanceForm.nextServiceDueKm}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextServiceDueKm: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Replaced Parts / Work Summary</label>
                <textarea
                  rows="2"
                  value={maintenanceForm.partsReplaced}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, partsReplaced: e.target.value })}
                  placeholder="e.g. Replaced front brake liners, Mobil Super oil 7L, ice seal insulation rubber"
                  className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                />
              </div>

              {/* Sync to Expenses Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                <input
                  type="checkbox"
                  id="syncMaintExpense"
                  checked={maintenanceForm.syncToExpense}
                  onChange={(e) => setMaintenanceForm({ ...maintenanceForm, syncToExpense: e.target.checked })}
                  className="w-4 h-4 text-[#ea580c] rounded focus:ring-orange-500"
                />
                <label htmlFor="syncMaintExpense" className="text-xs font-medium text-slate-800 cursor-pointer">
                  Sync repair bill automatically into <strong>Finance Expenses & Day Book</strong>
                </label>
              </div>


              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Record Service
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* COMPACT FLEET FILTERS MODAL DIALOG                        */}
      {/* ======================================================== */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#FED7AA] shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#FAF0E4] via-orange-50 to-white px-4 py-3.5 border-b border-[#FED7AA] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-100 border border-orange-300 text-[#ea580c] flex items-center justify-center shadow-2xs">
                  <Filter size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-[#7c3f1d] leading-tight">Fleet Vehicle Filters</h3>
                    {activeFilterCount > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                        {activeFilterCount} active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">Refine fleet dispatches by channel, supplier, vehicle, fuel & status</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-white/80 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body with 5 Filters */}
            <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto">
              {/* Filter 1: Operational Intake Channel */}
              <div className="bg-[#FAF0E4]/40 p-2.5 rounded-xl border border-[#fed7aa]/70 space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Navigation size={13} className="text-blue-600" />
                  <span>1. Operational Intake Channel</span>
                </label>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  <option value="ALL">All Channels</option>
                  <option value="Local Catch">Local Catch</option>
                  <option value="DAM Consignments">DAM Consignments</option>
                  <option value="Supplies & Packaging">Supplies & Packaging</option>
                  <option value="Depot Distribution">Depot Distribution</option>
                </select>
              </div>

              {/* Filter 2: Linked Supplier / Syndicate */}
              <div className="bg-[#FAF0E4]/40 p-2.5 rounded-xl border border-[#fed7aa]/70 space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building size={13} className="text-emerald-600" />
                  <span>2. Linked Supplier / Syndicate</span>
                </label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#fed7aa] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                >
                  <option value="ALL">All Suppliers & Syndicates</option>
                  {uniqueSuppliersList.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Filters 3, 4, 5 in structured grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Filter 3: Vehicle Type */}
                <div className="bg-[#FAF0E4]/40 p-2.5 rounded-xl border border-[#fed7aa]/70 space-y-1">
                  <label className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1">
                    <Truck size={12} className="text-amber-600" />
                    <span>3. Vehicle Type</span>
                  </label>
                  <select
                    value={filterVehicleType}
                    onChange={(e) => setFilterVehicleType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#fed7aa] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    <option value="ALL">All Types</option>
                    {VEHICLE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Filter 4: Fuel Type */}
                <div className="bg-[#FAF0E4]/40 p-2.5 rounded-xl border border-[#fed7aa]/70 space-y-1">
                  <label className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1">
                    <Fuel size={12} className="text-rose-600" />
                    <span>4. Fuel Type</span>
                  </label>
                  <select
                    value={filterFuelType}
                    onChange={(e) => setFilterFuelType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#fed7aa] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    <option value="ALL">All Fuels</option>
                    {FUEL_TYPES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Filter 5: Operational Status */}
                <div className="bg-[#FAF0E4]/40 p-2.5 rounded-xl border border-[#fed7aa]/70 space-y-1">
                  <label className="text-[11.5px] font-bold text-slate-700 flex items-center gap-1">
                    <Gauge size={12} className="text-purple-600" />
                    <span>5. Status</span>
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#fed7aa] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  >
                    <option value="ALL">All Statuses</option>
                    {VEHICLE_STATUSES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer with Reset All & Apply */}
            <div className="px-4 py-3 bg-slate-50 border-t border-[#FED7AA]/70 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-black rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
              >
                Apply Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal for Driver Photo */}
      {isCropperOpen && (
        <ImageCropperModal
          title="Crop Driver Profile Photo"
          imageSrc={cropperRawSrc}
          onCropComplete={(croppedDataUrl) => {
            setVehicleForm(prev => ({ ...prev, driverPhoto: croppedDataUrl }));
            if (cropperPendingInfo) {
              setUploadFileInfo(cropperPendingInfo);
            }
            setIsCropperOpen(false);
            setToast({ message: 'Driver photo cropped successfully!', type: 'success' });
          }}
          onClose={() => setIsCropperOpen(false)}
        />
      )}
    </div>
  );
}

