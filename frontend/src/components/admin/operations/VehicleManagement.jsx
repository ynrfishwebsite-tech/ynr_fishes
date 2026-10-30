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
  Radio
} from 'lucide-react';
import BackButton from '../common/BackButton';
import Toast from '../system/Toast';
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
import LiveFleetMap from './LiveFleetMap';

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

  // Main Data States
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [fuelLogs, setFuelLogs] = useState([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [stats, setStats] = useState(null);

  // Modals
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showTripModal, setShowTripModal] = useState(false);
  const [preselectedTripVehicle, setPreselectedTripVehicle] = useState(null);
  const [showFuelModal, setShowFuelModal] = useState(false);
  const [preselectedFuelVehicle, setPreselectedFuelVehicle] = useState(null);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [preselectedMaintVehicle, setPreselectedMaintVehicle] = useState(null);

  // Form States
  const [vehicleForm, setVehicleForm] = useState({
    vehicleNumber: '',
    modelName: '',
    vehicleType: 'Pickup Truck',
    driverName: '',
    driverPhone: '',
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
      const [vList, tList, fList, mList, sData] = await Promise.all([
        getVehicles(),
        getTrips(),
        getFuelLogs(),
        getMaintenanceLogs(),
        getVehicleStats()
      ]);
      setVehicles(vList || []);
      setTrips(tList || []);
      setFuelLogs(fList || []);
      setMaintenanceLogs(mList || []);
      setStats(sData);
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

  // Filtered Lists
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchSearch =
        v.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.modelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.driverName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [vehicles, searchQuery]);

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
      const matchVehicle = selectedVehicleFilter === 'all' || t.vehicleId === selectedVehicleFilter;
      const matchSearch =
        t.vehicleNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.driverName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.routeTo?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchVehicle && matchSearch;
    });
  }, [trips, selectedVehicleFilter, searchQuery]);

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
    setVehicleForm({
      vehicleNumber: '',
      modelName: '',
      vehicleType: 'Pickup Truck',
      driverName: '',
      driverPhone: '',
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
    setVehicleForm({
      vehicleNumber: veh.vehicleNumber || '',
      modelName: veh.modelName || '',
      vehicleType: veh.vehicleType || 'Pickup Truck',
      driverName: veh.driverName || '',
      driverPhone: veh.driverPhone || '',
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

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    try {
      if (!vehicleForm.vehicleNumber || !vehicleForm.modelName) {
        setToast({ type: 'error', message: 'Vehicle number and model are required' });
        return;
      }
      if (editingVehicle) {
        await updateVehicle(editingVehicle._id, vehicleForm);
        setToast({ type: 'success', message: 'Vehicle updated successfully!' });
      } else {
        await addVehicle(vehicleForm);
        setToast({ type: 'success', message: 'Vehicle added to fleet!' });
      }
      setShowVehicleModal(false);
      loadData();
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.message || err.message });
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
      purpose: 'Fish Supply & Market Distribution',
      routeFrom: 'Kadapa City Depot',
      routeTo: 'Nellore Coastal Harbour',
      tollCharges: '0',
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
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">On Trip</span>;
      case 'Available':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Available</span>;
      case 'In Maintenance':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Maintenance</span>;
      case 'Out of Service':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Out of Service</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">{status || 'Idle'}</span>;
    }
  };

  // Interactive Calculator Computed Values
  const calcTotalDist = Math.max(0, (parseFloat(calcEndKm) || 0) - (parseFloat(calcStartKm) || 0));
  const calcMileage = (parseFloat(calcFuelLitres) || 0) > 0 ? (calcTotalDist / parseFloat(calcFuelLitres)).toFixed(1) : 0;
  const calcFuelCost = Math.round((parseFloat(calcFuelLitres) || 0) * (parseFloat(calcFuelRate) || 0));
  const calcCostPerKm = calcTotalDist > 0 ? (calcFuelCost / calcTotalDist).toFixed(2) : 0;

  return (
    <div className="min-h-screen bg-[#FAF0E4] p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#FED7AA]">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack || (() => onNavigate('dashboard'))} />
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#ea580c] text-white rounded-xl shadow-md">
                <Truck size={22} />
              </div>
              <h1 className="text-2xl font-bold text-[#7c3f1d]">Vehicle & Fleet Management</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#ffedd5] text-[#c2410c] font-medium border border-[#fdba74]">
                Kadapa Depot Fleet
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Live trip logs, kilometer calculations, diesel fuel economy & maintenance servicing
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadData}
            title="Refresh Data"
            className="p-2.5 bg-white text-slate-700 hover:text-[#ea580c] border border-[#FED7AA] rounded-xl shadow-sm hover:shadow transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => handleOpenAddTrip()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-[#7c3f1d] hover:bg-orange-50 border border-[#ea580c] rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Navigation size={16} />
            <span>+ Log Trip</span>
          </button>
          <button
            onClick={() => handleOpenAddFuel()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-[#7c3f1d] hover:bg-orange-50 border border-[#ea580c] rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Fuel size={16} />
            <span>+ Add Fuel</span>
          </button>
          <button
            onClick={() => handleOpenAddMaintenance()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white text-[#7c3f1d] hover:bg-orange-50 border border-[#ea580c] rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <Wrench size={16} />
            <span>+ Service</span>
          </button>
          <button
            onClick={handleOpenAddVehicle}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={18} />
            <span>+ New Vehicle</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 my-6">
        {/* Card 1: Fleet Count */}
        <div className="bg-white rounded-2xl p-4 border border-[#FED7AA] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Fleet Vehicles</span>
            <div className="p-2 rounded-lg bg-orange-100 text-[#ea580c]">
              <Truck size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#7c3f1d]">{vehicles.length}</div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-emerald-700 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {vehicles.filter((v) => v.status === 'Available').length} Available
            </span>
            <span className="text-blue-700 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {vehicles.filter((v) => v.status === 'On Trip').length} On Road
            </span>
          </div>
        </div>

        {/* Card 2: Monthly Distance */}
        <div className="bg-white rounded-2xl p-4 border border-[#FED7AA] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly KMs Run</span>
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Gauge size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-blue-900">
            {stats?.monthlyTotalKm ? stats.monthlyTotalKm.toLocaleString('en-IN') : '0'}{' '}
            <span className="text-sm font-semibold text-slate-500">KM</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Active supply and distribution routes</p>
        </div>

        {/* Card 3: Fuel Expense */}
        <div className="bg-white rounded-2xl p-4 border border-[#FED7AA] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly Fuel Cost</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <Fuel size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-900">
            ₹{stats?.monthlyFuelCost ? stats.monthlyFuelCost.toLocaleString('en-IN') : '0'}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
            <span>{stats?.monthlyFuelLitres || 0} Litres</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Avg {stats?.avgMileage || 0} KM/L
            </span>
          </div>
        </div>

        {/* Card 4: Maintenance Expense */}
        <div className="bg-white rounded-2xl p-4 border border-[#FED7AA] shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Service & Repairs</span>
            <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
              <Wrench size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-900">
            ₹{stats?.monthlyMaintCost ? stats.monthlyMaintCost.toLocaleString('en-IN') : '0'}
          </div>
          <p className="text-xs text-slate-500 mt-2">Reefer box & mechanical upkeep</p>
        </div>
      </div>

      {/* Tabs Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5 border-b border-[#fed7aa] pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'fleet'
                ? 'bg-[#7c3f1d] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
            }`}
          >
            <Truck size={17} />
            <span>Vehicles Fleet ({vehicles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('trips')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'trips'
                ? 'bg-[#7c3f1d] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
            }`}
          >
            <Navigation size={17} />
            <span>Trips & KM Logs ({trips.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('fuel')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'fuel'
                ? 'bg-[#7c3f1d] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
            }`}
          >
            <Fuel size={17} />
            <span>Fuel Management ({fuelLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'maintenance'
                ? 'bg-[#7c3f1d] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
            }`}
          >
            <Wrench size={17} />
            <span>Service & Repairs ({maintenanceLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'map'
                ? 'bg-[#7c3f1d] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
            }`}
          >
            <Radio size={17} className="text-emerald-500 animate-pulse" />
            <span>Live Map Tracking</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </button>

          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'calculator'
                ? 'bg-[#7c3f1d] text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-orange-50 border border-[#fed7aa]'
            }`}
          >
            <Calculator size={17} />
            <span>KM & Mileage Calculator</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        {!['calculator', 'map'].includes(activeTab) && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search number, driver, route..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#fed7aa] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {['trips', 'fuel', 'maintenance'].includes(activeTab) && (
              <select
                value={selectedVehicleFilter}
                onChange={(e) => setSelectedVehicleFilter(e.target.value)}
                className="px-3 py-2 bg-white border border-[#fed7aa] rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVehicles.map((veh) => (
                <div
                  key={veh._id}
                  className="bg-white rounded-2xl border border-[#FED7AA] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Plate & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-amber-400 text-slate-900 font-mono font-extrabold text-sm rounded-lg border-2 border-slate-900 shadow-sm tracking-wide">
                          {veh.vehicleNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">{veh.vehicleType}</span>
                      </div>
                      {getStatusBadge(veh.status)}
                    </div>

                    {/* Model & Driver */}
                    <h3 className="text-base font-bold text-[#7c3f1d]">{veh.modelName}</h3>
                    <div className="mt-3 space-y-1.5 text-xs text-slate-600 bg-[#FAF0E4] p-3 rounded-xl border border-[#fed7aa]">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <User size={13} /> Driver
                        </span>
                        <span className="font-semibold text-slate-800">{veh.driverName || 'Not Assigned'}</span>
                      </div>
                      {veh.driverPhone && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <Phone size={13} /> Phone
                          </span>
                          <a href={`tel:${veh.driverPhone}`} className="font-medium text-[#ea580c] hover:underline">
                            {veh.driverPhone}
                          </a>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-orange-200">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Gauge size={13} /> Odometer
                        </span>
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {veh.currentKm ? veh.currentKm.toLocaleString('en-IN') : 0} KM
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Fuel size={13} /> Fuel / Economy
                        </span>
                        <span className="font-semibold text-slate-800">
                          {veh.fuelType} {veh.averageMileage ? `• ${veh.averageMileage} KM/L` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Monthly Summary Badges */}
                    {veh.stats && (
                      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                        <div className="bg-orange-50 rounded-lg p-2 border border-orange-100">
                          <div className="text-[10px] text-slate-500 font-medium">Month Run</div>
                          <div className="text-xs font-bold text-[#c2410c]">{veh.stats.monthlyKm} KM</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                          <div className="text-[10px] text-slate-500 font-medium">Fuel Spend</div>
                          <div className="text-xs font-bold text-blue-800">₹{veh.stats.monthlyFuelCost}</div>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-2 border border-rose-100">
                          <div className="text-[10px] text-slate-500 font-medium">Repairs</div>
                          <div className="text-xs font-bold text-rose-800">₹{veh.stats.monthlyMaintCost}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-1.5 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenAddTrip(veh)}
                        className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 text-[#7c3f1d] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Log a delivery trip"
                      >
                        <Navigation size={12} /> Trip
                      </button>
                      <button
                        onClick={() => handleOpenAddFuel(veh)}
                        className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Log fuel refill"
                      >
                        <Fuel size={12} /> Fuel
                      </button>
                      <button
                        onClick={() => handleOpenAddMaintenance(veh)}
                        className="px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Log repair or maintenance"
                      >
                        <Wrench size={12} /> Service
                      </button>
                      <button
                        onClick={() => setActiveTab('map')}
                        className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="View live position on map"
                      >
                        <Radio size={12} className="text-emerald-600 animate-pulse" /> Map
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditVehicle(veh)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit vehicle details"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(veh._id, veh.vehicleNumber)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remove vehicle"
                      >
                        <Trash2 size={15} />
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
          <div className="p-4 bg-[#fffaf5] border-b border-[#fed7aa] flex items-center justify-between">
            <h3 className="font-bold text-[#7c3f1d] text-base flex items-center gap-2">
              <Navigation size={18} className="text-[#ea580c]" />
              Trip Distance & Kilometer Logs
            </h3>
            <button
              onClick={() => handleOpenAddTrip()}
              className="px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1"
            >
              <Plus size={14} /> Log New Trip
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
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
                      No trip records found. Click "+ Log New Trip" to register trip distance.
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
                        <div className="font-semibold text-slate-900">{t.purpose}</div>
                        <div className="text-[11px] text-slate-500">
                          {t.routeFrom} → {t.routeTo || 'Local Market'}
                        </div>
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
          <div className="p-4 bg-[#fffaf5] border-b border-[#fed7aa] flex items-center justify-between">
            <h3 className="font-bold text-[#7c3f1d] text-base flex items-center gap-2">
              <Fuel size={18} className="text-[#ea580c]" />
              Fuel Refill & Mileage Economy Logs
            </h3>
            <button
              onClick={() => handleOpenAddFuel()}
              className="px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1"
            >
              <Plus size={14} /> Add Fuel Entry
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
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
                      No fuel logs recorded yet. Click "+ Add Fuel Entry" to log diesel/petrol fill-ups.
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
          <div className="p-4 bg-[#fffaf5] border-b border-[#fed7aa] flex items-center justify-between">
            <h3 className="font-bold text-[#7c3f1d] text-base flex items-center gap-2">
              <Wrench size={18} className="text-[#ea580c]" />
              Vehicle Repairs, Servicing & Upkeep
            </h3>
            <button
              onClick={() => handleOpenAddMaintenance()}
              className="px-3.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1"
            >
              <Plus size={14} /> Log Maintenance
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
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
                      No repair or maintenance logs found. Click "+ Log Maintenance" to record vehicle services.
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inputs Card */}
          <div className="bg-white rounded-2xl border border-[#FED7AA] p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#7c3f1d] mb-1 flex items-center gap-2">
              <Calculator size={20} className="text-[#ea580c]" />
              Quick Trip & Fuel Calculator
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Calculate running kilometers, trip cost, and fuel efficiency before or after a fish delivery run.
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Odometer (KM)</label>
                  <input
                    type="number"
                    value={calcStartKm}
                    onChange={(e) => setCalcStartKm(e.target.value)}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 12400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">End Odometer (KM)</label>
                  <input
                    type="number"
                    value={calcEndKm}
                    onChange={(e) => setCalcEndKm(e.target.value)}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 12580"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fuel Filled (Litres)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcFuelLitres}
                    onChange={(e) => setCalcFuelLitres(e.target.value)}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 15"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fuel Price (₹ / Litre)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={calcFuelRate}
                    onChange={(e) => setCalcFuelRate(e.target.value)}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                    placeholder="e.g. 98"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="bg-[#7c3f1d] text-white rounded-2xl p-6 shadow-md flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-200">
                Calculated Trip Metrics
              </span>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-xs text-orange-200">Total Distance Covered</div>
                  <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                    {calcTotalDist} <span className="text-base font-normal">KM</span>
                  </div>
                </div>

                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-xs text-orange-200">Calculated Mileage</div>
                  <div className="text-3xl font-extrabold text-emerald-300 mt-1 font-mono">
                    {calcMileage} <span className="text-base font-normal">KM/L</span>
                  </div>
                </div>

                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-xs text-orange-200">Total Fuel Cost</div>
                  <div className="text-3xl font-extrabold text-white mt-1 font-mono">
                    ₹{calcFuelCost}
                  </div>
                </div>

                <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-xs text-orange-200">Running Cost / KM</div>
                  <div className="text-3xl font-extrabold text-amber-300 mt-1 font-mono">
                    ₹{calcCostPerKm} <span className="text-xs font-normal">/ KM</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/20 text-xs text-orange-100 flex items-center justify-between">
              <span>Delivery Cost Efficiency: <strong>Good</strong></span>
              <button
                onClick={() => {
                  handleOpenAddTrip();
                  setTripForm((prev) => ({
                    ...prev,
                    startKm: calcStartKm,
                    endKm: calcEndKm
                  }));
                }}
                className="px-3 py-1.5 bg-[#ea580c] hover:bg-orange-600 text-white font-bold rounded-lg transition-colors flex items-center gap-1"
              >
                Use in Log Trip <ArrowRight size={13} />
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#FED7AA] max-h-[90vh] overflow-y-auto">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Mobile</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9849313889"
                    value={vehicleForm.driverPhone}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, driverPhone: e.target.value })}
                    className="w-full p-2.5 bg-[#fffaf5] border border-[#fed7aa] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ea580c]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Odometer (KM)</label>
                  <input
                    type="number"
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
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-md transition-all"
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#FED7AA]">
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#FED7AA]">
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#FED7AA] max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}

