import { getApiUrl } from "../../../config.js";
import { useLanguage } from "../../../context/LanguageContext";
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ArrowLeft, Printer, Save, CheckCircle, Network, Usb, Bluetooth,
  ReceiptText, ChefHat, Plus, Trash2, Edit, X, Search, Check,
  AlertTriangle, Layers, Utensils, MapPin, ChevronDown, ChevronUp, RefreshCw, Loader2, Battery
} from 'lucide-react';
import BackButton from '../common/BackButton';
import LiveReceiptPreview from '../billing/LiveReceiptPreview';

const PrinterConfig = ({ onNavigate, onGoBack, user }) => {
  const savedSettings = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const { t } = useLanguage();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState(null);

  // Connectivity Status Map
  const [connectionStatuses, setConnectionStatuses] = useState({});

  // Categories & Menu Items & Floors from DB
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [floors, setFloors] = useState([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Bluetooth device discovery
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [btAvailable, setBtAvailable] = useState(null); // null=unchecked, true=available, false=unavailable

  // Network status
  const [networkStatus, setNetworkStatus] = useState(null); // null=unchecked, {connected,interfaces}

  // USB Port Auto-Detector discovery
  const [usbPorts, setUsbPorts] = useState([]);
  const [isScanningUsb, setIsScanningUsb] = useState(false);

  // Network Printer Auto-Detector discovery
  const [networkPrinters, setNetworkPrinters] = useState([]);
  const [isScanningNetwork, setIsScanningNetwork] = useState(false);

  const scanUsbPorts = async () => {
    setIsScanningUsb(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await axios.get(`${getApiUrl()}/printer-configs/usb-ports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.success && Array.isArray(res.data.ports)) {
        setUsbPorts(res.data.ports);
        if (res.data.ports.length > 0) {
          // Auto-select recommended thermal port if none chosen or if previously chosen port is disconnected
          setFormData(prev => {
            const recommended = res.data.ports.find(p => p.isThermalLikely) || res.data.ports[0];
            if (!prev.usbPort) {
              return {
                ...prev,
                usbPort: recommended.port,
                deviceName: recommended.description || recommended.printerName || prev.deviceName
              };
            }
            // Also: if the previously selected port no longer appears in the live scan, switch to recommended
            const stillConnected = res.data.ports.some(p => p.port === prev.usbPort);
            if (!stillConnected && recommended) {
              return {
                ...prev,
                usbPort: recommended.port,
                deviceName: recommended.description || recommended.printerName || prev.deviceName
              };
            }
            return prev;
          });
        } else {
          // No ports found — clear stale selection
          setUsbPorts([]);
          setFormData(prev => ({ ...prev, usbPort: '', deviceName: '' }));
        }
      }
    } catch (err) {
      console.warn('Could not scan USB ports:', err);
    } finally {
      setIsScanningUsb(false);
    }

  };

  const scanNetworkPrinters = async () => {
    setIsScanningNetwork(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Step 1: Check if network is physically connected first
      try {
        const statusRes = await axios.get(`${getApiUrl()}/printer-configs/network-status`, { headers });
        if (statusRes.data) {
          setNetworkStatus({ connected: statusRes.data.connected, interfaces: statusRes.data.interfaces || [] });
          if (!statusRes.data.connected) {
            // No LAN/WiFi — stop here, show warning
            setNetworkPrinters([]);
            return;
          }
        }
      } catch (_) { }

      // Step 2: Scan subnet for thermal printers on port 9100
      const res = await axios.get(`${getApiUrl()}/printer-configs/network-printers`, { headers });
      if (res.data && res.data.success && Array.isArray(res.data.printers)) {
        setNetworkPrinters(res.data.printers);
        setNetworkStatus(prev => prev ? { ...prev, _scanned: true } : { connected: true, interfaces: [], _scanned: true });
        // Auto-select if exactly one printer is found
        if (res.data.printers.length === 1) {
          const found = res.data.printers[0];
          setFormData(prev => ({
            ...prev,
            ipAddress: found.ip,
            port: found.port
          }));
        }
      }
    } catch (err) {
      console.warn('Could not scan network printers:', err);
    } finally {
      setIsScanningNetwork(false);
    }
  };

  const loadBluetoothDevices = async () => {
    setIsScanningBluetooth(true);
    try {
      // On Android WebView app: use the native bridge
      if (typeof window !== 'undefined' && window.AndroidBluetooth?.getPairedDevices) {
        if (typeof window.AndroidBluetooth.requestPermissions === 'function') {
          window.AndroidBluetooth.requestPermissions();
        }
        await new Promise(r => setTimeout(r, 600));
        const res = JSON.parse(window.AndroidBluetooth.getPairedDevices() || '{}');
        if (res && res.success && Array.isArray(res.devices)) {
          setBluetoothDevices(res.devices);
          setBtAvailable(true);
        }
        return;
      }

      // On desktop (Windows / Linux): call backend scanner
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await axios.get(`${getApiUrl()}/printer-configs/bluetooth-devices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setBtAvailable(res.data.btAvailable !== false);
        if (Array.isArray(res.data.devices)) {
          setBluetoothDevices(res.data.devices);
        }
      }
    } catch (err) {
      console.warn('Could not scan Bluetooth devices:', err);
      setBtAvailable(false);
    } finally {
      setIsScanningBluetooth(false);
    }
  };

  // Live battery checking state
  const [liveBatteryLevel, setLiveBatteryLevel] = useState(null);
  const [isCheckingBattery, setIsCheckingBattery] = useState(false);

  const checkPrinterBattery = async () => {
    if (!formData.bluetoothAddress) return;
    setIsCheckingBattery(true);
    setLiveBatteryLevel(null);
    try {
      if (typeof window !== 'undefined' && window.AndroidBluetooth?.getBatteryLevel) {
        const resStr = window.AndroidBluetooth.getBatteryLevel(formData.bluetoothAddress);
        const res = JSON.parse(resStr || '{}');
        if (res.success && res.batteryLevel !== undefined && res.batteryLevel !== null) {
          setLiveBatteryLevel(res.batteryLevel);
        } else {
          alert(res.error || t('Battery level not supported by this printer.'));
        }
      } else {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const res = await axios.get(`${getApiUrl()}/printer-configs/bluetooth-battery/${encodeURIComponent(formData.bluetoothAddress)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data && res.data.success && res.data.batteryLevel !== undefined && res.data.batteryLevel !== null) {
          setLiveBatteryLevel(res.data.batteryLevel);
        } else {
          alert(res.data?.message || res.data?.error || t('Battery polling not supported on this platform/printer.'));
        }
      }
    } catch (err) {
      alert(t('Failed to check battery status.'));
    } finally {
      setIsCheckingBattery(false);
    }
  };

  // Search & Filter state inside modal
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'kot',
    assignTo: '',
    location: '',
    assignmentMode: 'category', // 'category' | 'item' | 'itemType'
    assignedCategories: [],
    assignedItems: [],
    assignedItemTypes: [],
    ipAddress: '',
    bluetoothAddress: '',
    deviceName: '',
    usbPort: '',
    port: 9100,
    connectionType: 'network',
    paperWidth: '80mm',
    numberOfCopies: 1,
    isActive: true,
    autoPrintKOT: true,
    printHeader: '',
    printFooter: ''
  });

  const fetchConfigs = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/printer-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const configsList = response.data || [];
      setConfigs(configsList);
      checkAllConnections(configsList);
    } catch (error) {
      console.error('Error fetching printer configs', error);
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async (id) => {
    setConnectionStatuses(prev => ({ ...prev, [id]: { status: 'checking' } }));
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await axios.get(`${getApiUrl()}/printer-configs/${id}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConnectionStatuses(prev => ({
        ...prev,
        [id]: { status: res.data.connected ? 'connected' : 'disconnected' }
      }));
    } catch (err) {
      setConnectionStatuses(prev => ({ ...prev, [id]: { status: 'disconnected' } }));
    }
  };

  const checkAllConnections = async (configsList) => {
    configsList.forEach(c => checkConnectionStatus(c._id));
  };

  const fetchMenuData = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [catRes, menuRes] = await Promise.allSettled([
        axios.get(`${getApiUrl()}/categories`, { headers }),
        axios.get(`${getApiUrl()}/menu`, { headers })
      ]);

      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value.data)) {
        setCategories(catRes.value.data);
      }
      if (menuRes.status === 'fulfilled' && Array.isArray(menuRes.value.data)) {
        setMenuItems(menuRes.value.data);
      }
      const savedSpaces = localStorage.getItem('msbillings_spaces');
      if (savedSpaces) {
        try {
          const parsed = JSON.parse(savedSpaces);
          if (Array.isArray(parsed)) setFloors(parsed);
        } catch (_) { }
      }
    } catch (e) {
      console.warn('Could not fetch categories or menus:', e);
    }
  };

  useEffect(() => {
    fetchConfigs();
    fetchMenuData();
    loadBluetoothDevices();
    scanUsbPorts();

    // Auto-detect USB hot-plugging using WebUSB
    if (navigator.usb) {
      navigator.usb.addEventListener('connect', scanUsbPorts);
      navigator.usb.addEventListener('disconnect', scanUsbPorts);
      return () => {
        navigator.usb.removeEventListener('connect', scanUsbPorts);
        navigator.usb.removeEventListener('disconnect', scanUsbPorts);
      };
    }
  }, []);

  // Map other printers' assignments to identify duplicates
  const existingAssignments = useMemo(() => {
    const catMap = {}; // categoryName (lowercase) -> printer label
    const itemMap = {}; // itemName (lowercase) -> printer label
    const itemTypeMap = {}; // type (lowercase) -> printer label

    configs.forEach(cfg => {
      // Exclude current printer being edited
      if (editingConfig && cfg._id === editingConfig._id) return;
      if (!cfg.isActive) return;

      const printerLabel = `${cfg.name || 'Kitchen'}${cfg.location ? ` (${cfg.location})` : ''}`;

      if (cfg.assignmentMode === 'item' && Array.isArray(cfg.assignedItems)) {
        cfg.assignedItems.forEach(it => {
          if (it) itemMap[it.trim().toLowerCase()] = printerLabel;
        });
      } else if (cfg.assignmentMode === 'itemType' && Array.isArray(cfg.assignedItemTypes)) {
        cfg.assignedItemTypes.forEach(type => {
          if (type) itemTypeMap[type.trim().toLowerCase()] = printerLabel;
        });
      } else if (Array.isArray(cfg.assignedCategories) && cfg.assignedCategories.length > 0) {
        cfg.assignedCategories.forEach(cat => {
          if (cat) catMap[cat.trim().toLowerCase()] = printerLabel;
        });
      } else if (cfg.assignTo && cfg.assignTo !== 'All') {
        catMap[cfg.assignTo.trim().toLowerCase()] = printerLabel;
      }
    });

    return { catMap, itemMap, itemTypeMap };
  }, [configs, editingConfig]);

  // Group menu items by category for Item-Based mode
  const itemsByCategory = useMemo(() => {
    const grouped = {};
    menuItems.forEach(item => {
      const catName = (item.category?.name || item.category || 'Uncategorized').trim();
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(item);
    });
    return grouped;
  }, [menuItems]);

  const openAddModal = () => {
    loadBluetoothDevices();
    scanUsbPorts();
    setFormData({
      name: '',
      type: 'kot',
      assignTo: '',
      location: '',
      assignmentMode: 'category',
      assignedCategories: [],
      assignedItems: [],
      assignedItemTypes: [],
      ipAddress: '',
      bluetoothAddress: '',
      deviceName: '',
      usbPort: '',
      port: 9100,
      connectionType: 'network',
      paperWidth: '80mm',
      numberOfCopies: 1,
      isActive: true,
      silentPrinting: true,
      autoPrintKOT: true,
      printHeader: '',
      printFooter: ''
    });
    setAssignmentSearch('');
    setCollapsedCategories({});
    setEditingConfig(null);
    setIsModalOpen(true);
  };

  const openEditModal = (config) => {
    loadBluetoothDevices();
    scanUsbPorts();
    setFormData({
      name: config.name || '',
      type: config.type || 'kot',
      assignTo: config.name || config.assignTo || '',
      location: config.location || '',
      assignmentMode: config.assignmentMode || (config.assignedItems?.length > 0 ? 'item' : (config.assignedItemTypes?.length > 0 ? 'itemType' : 'category')),
      assignedCategories: config.assignedCategories || [],
      assignedItems: config.assignedItems || [],
      assignedItemTypes: config.assignedItemTypes || [],
      ipAddress: config.ipAddress || '',
      bluetoothAddress: config.bluetoothAddress || (config.ipAddress && config.ipAddress.includes(':') ? config.ipAddress : ''),
      deviceName: config.deviceName || '',
      usbPort: config.usbPort || '',
      port: config.port || 9100,
      connectionType: config.connectionType || 'network',
      paperWidth: config.paperWidth || '80mm',
      numberOfCopies: config.numberOfCopies || 1,
      isActive: config.isActive !== false,
      silentPrinting: config.silentPrinting !== false,
      autoPrintKOT: config.autoPrintKOT !== false,
      printHeader: config.printHeader || '',
      printFooter: config.printFooter || ''
    });
    setAssignmentSearch('');
    setCollapsedCategories({});
    setEditingConfig(config);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingConfig(null);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (name === 'connectionType' && value === 'usb') {
      scanUsbPorts();
    }
  };

  // Toggle Category Selection
  const toggleCategory = (catName) => {
    setFormData(prev => {
      const exists = prev.assignedCategories.includes(catName);
      const newCats = exists
        ? prev.assignedCategories.filter(c => c !== catName)
        : [...prev.assignedCategories, catName];
      return {
        ...prev,
        assignedCategories: newCats,
        assignTo: prev.name || prev.assignTo || 'Kitchen'
      };
    });
  };

  // Toggle Individual Item Selection
  const toggleItem = (itemName) => {
    setFormData(prev => {
      const exists = prev.assignedItems.includes(itemName);
      const newItems = exists
        ? prev.assignedItems.filter(i => i !== itemName)
        : [...prev.assignedItems, itemName];
      return {
        ...prev,
        assignedItems: newItems
      };
    });
  };

  // Select / Deselect All Items in a Category
  const toggleSelectAllCategoryItems = (catName, itemsInCat) => {
    const itemNames = itemsInCat.map(i => i.name);
    const allSelected = itemNames.every(name => formData.assignedItems.includes(name));

    setFormData(prev => {
      let newItems;
      if (allSelected) {
        newItems = prev.assignedItems.filter(i => !itemNames.includes(i));
      } else {
        const toAdd = itemNames.filter(name => !prev.assignedItems.includes(name));
        newItems = [...prev.assignedItems, ...toAdd];
      }
      return { ...prev, assignedItems: newItems };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Prevent duplicate routing assignments
    if (formData.type === 'kot' || formData.type === 'both') {
      if (formData.assignmentMode === 'category') {
        const dup = formData.assignedCategories.find(c => existingAssignments.catMap[c.toLowerCase()]);
        if (dup) return alert(`Category "${dup}" is already assigned to ${existingAssignments.catMap[dup.toLowerCase()]}. Please remove it first.`);
      } else if (formData.assignmentMode === 'item') {
        const dup = formData.assignedItems.find(i => existingAssignments.itemMap[i.toLowerCase()]);
        if (dup) return alert(`Item "${dup}" is already assigned to ${existingAssignments.itemMap[dup.toLowerCase()]}. Please remove it first.`);
      } else if (formData.assignmentMode === 'itemType') {
        const dup = formData.assignedItemTypes.find(type => existingAssignments.itemTypeMap[type.toLowerCase()]);
        if (dup) return alert(`Item type "${dup === 'veg' ? 'Veg' : 'Non-Veg'}" is already assigned to ${existingAssignments.itemTypeMap[dup.toLowerCase()]}. Please remove it first.`);
      }
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const stationName = (formData.name || '').trim();
      const payload = {
        ...formData,
        name: stationName,
        assignTo: stationName || formData.assignTo || 'Kitchen'
      };

      if (editingConfig) {
        await axios.put(`${getApiUrl()}/printer-configs/${editingConfig._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/printer-configs`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      closeModal();
      fetchConfigs();
    } catch (error) {
      console.error('Error saving config', error);
      alert(t('Failed to save printer configuration: ') + (error.response?.data?.message || error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this printer?')) {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        await axios.delete(`${getApiUrl()}/printer-configs/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchConfigs();
      } catch (error) {
        console.error('Error deleting printer', error);
        alert('Failed to delete printer');
      }
    }
  };

  const handleTestPrint = async (id) => {
    setTestingId(id);
    const config = configs.find(c => c._id === id);
    if (config && config.connectionType === 'bluetooth') {
      const mac = config.bluetoothAddress || (config.name && config.name.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/)?.[0]);
      if (typeof window !== 'undefined' && window.AndroidBluetooth?.testPrint) {
        if (!mac) {
          alert(t("No Bluetooth address linked. Please click Edit and select your paired Bluetooth printer."));
          setTestingId(null);
          return;
        }
        try {
          const resStr = window.AndroidBluetooth.testPrint(mac);
          const res = JSON.parse(resStr || '{}');
          if (res.success) {
            alert(t("Test receipt printed to Bluetooth printer successfully!"));
          } else {
            alert(t("Bluetooth test print failed: ") + (res.error || res.message));
          }
          setTestingId(null);
          return;
        } catch (e) {
          alert(t("Bluetooth print error: ") + e.message);
          setTestingId(null);
          return;
        }
      } else if (typeof window !== 'undefined' && window.electronAPI?.silentPrint) {
        window.electronAPI.silentPrint('<html><body style="font-family:monospace;padding:10px;"><h2>Fish Market YNR</h2><p>Bluetooth Thermal Test OK</p></body></html>', config.name || '', false);
        alert(t("Test print sent successfully!"));
        setTestingId(null);
        return;
      }
    }

    // Direct backend printing (Network, USB, or Windows Bluetooth serial)
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await axios.post(`${getApiUrl()}/printer-configs/${id}/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data?.message || t("Test print sent successfully!"));
    } catch (error) {
      console.error('Error testing printer', error);
      const errMsg = error.response?.data?.message || error.message || t("Failed to connect to printer");
      alert(t("Print Error: ") + errMsg);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="min-h-full flex-1 flex flex-col bg-[#f7f1ea] p-2 sm:p-3 md:p-4 overflow-y-auto overscroll-y-auto font-sans touch-pan-y">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 sm:mb-4 gap-3 bg-[#FDFBF7] p-3 sm:p-4 rounded-xl border border-sky-500/25 shadow-lg shadow-black/30">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <Printer className="text-sky-400" size={20} />
              <span>{t("Thermal & Slip Printer Stations")}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
              {t("Configure thermal and receipt printers for billing counters and order slips")}
            </p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md shadow-sky-950/50 active:scale-95 cursor-pointer">
          <Plus size={18} />
          <span>{t("Add Printer Station")}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="bg-[#FDFBF7] border border-sky-500/20 shadow-2xl rounded-xl text-slate-100 overflow-hidden">
          {/* Desktop Table View (lg and above - 1024px+) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[880px]">
              <thead>
                <tr className="bg-[#F7EFE2] border-b border-sky-500/20">
                  <th className="px-5 py-3.5 text-xs font-bold text-sky-300 uppercase tracking-wider">{t("Printer Station")}</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-sky-300 uppercase tracking-wider">{t("Type")}</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-sky-300 uppercase tracking-wider">{t("Connection")}</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-sky-300 uppercase tracking-wider">{t("Assigned Items / Categories")}</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-sky-300 uppercase tracking-wider text-center">{t("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-500/15">
                {configs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                      <Printer className="mx-auto text-sky-400/60 mb-2" size={36} />
                      <p className="font-semibold text-slate-200">{t("No printers configured yet.")}</p>
                      <p className="text-xs text-slate-400 mt-1">{t("Click \"Add Printer Station\" to configure thermal printing.")}</p>
                    </td>
                  </tr>
                ) : (
                  configs.map((config) => {
                    const isKot = config.type === 'kot';
                    const isBoth = config.type === 'both';
                    const isItemMode = config.assignmentMode === 'item';
                    const isItemTypeMode = config.assignmentMode === 'itemType';
                    const cats = config.assignedCategories || [];
                    const items = config.assignedItems || [];
                    const itemTypes = config.assignedItemTypes || [];

                    return (
                      <tr key={config._id} className="hover:bg-[#f7f1ea]/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.isActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-rose-500'}`}></span>
                            <div>
                              <div className="font-bold text-sm text-text-main flex items-center gap-2 whitespace-nowrap">
                                <span>{config.name}</span>
                                {config.location && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 text-[11px] font-bold rounded-md border border-amber-200 shrink-0">
                                    <MapPin size={10} />
                                    {config.location}
                                  </span>
                                )}
                                {connectionStatuses[config._id]?.status === 'checking' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-text-muted text-[10px] font-bold rounded-md border border-border shrink-0">
                                    <Loader2 size={10} className="animate-spin" /> Checking
                                  </span>
                                )}
                                {connectionStatuses[config._id]?.status === 'connected' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200 shrink-0">
                                    <CheckCircle size={10} /> Online
                                  </span>
                                )}
                                {connectionStatuses[config._id]?.status === 'disconnected' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-md border border-rose-200 shrink-0">
                                    <AlertTriangle size={10} /> Offline
                                  </span>
                                )}
                              </div>
                              {config.assignTo && config.assignTo !== config.name && (
                                <div className="text-xs text-text-muted font-medium">
                                  Dept: {config.assignTo}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-lg border ${config.type === 'both'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : config.type === 'kot'
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : config.type === 'receipt'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-text-muted border-border'
                            }`}>
                            {config.type === 'both' ? 'Both (Bill & Butcher Slip)' : config.type === 'receipt' ? 'Receipt (Bill)' : config.type === 'kot' ? 'KOT (Kitchen)' : 'General'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-text-main uppercase flex items-center gap-1.5">
                              {config.connectionType === 'network' && <Network size={12} className="text-blue-600" />}
                              {config.connectionType === 'usb' && <Usb size={12} className="text-emerald-600" />}
                              {config.connectionType === 'bluetooth' && <Bluetooth size={12} className="text-indigo-600" />}
                              {config.connectionType}
                            </span>
                            {config.connectionType === 'network' && (
                              <span className="text-[11px] font-mono text-text-muted">{config.ipAddress}:{config.port || 9100}</span>
                            )}
                            {config.connectionType === 'usb' && (
                              <span className="text-[11px] font-mono text-emerald-600 font-semibold">{config.usbPort || config.deviceName || 'USB Port'}</span>
                            )}
                            {config.connectionType === 'bluetooth' && config.bluetoothAddress && (
                              <span className="text-[11px] font-mono text-indigo-600 truncate max-w-[160px]">{config.bluetoothAddress}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 min-w-[240px]">
                          {config.type === 'receipt' ? (
                            <span className="text-xs text-gray-400 font-medium">All Bills & Receipts</span>
                          ) : isItemMode && items.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 max-w-md">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md border border-sky-500/20 text-sky-200 shrink-0">
                                <Utensils size={11} />
                                {items.length} {items.length === 1 ? 'Item' : 'Items'}
                              </span>
                              <div className="text-[11px] text-text-muted truncate max-w-[280px]" title={items.join(', ')}>
                                {items.slice(0, 3).join(', ')}{items.length > 3 ? ` +${items.length - 3} more` : ''}
                              </div>
                            </div>
                          ) : isItemTypeMode && itemTypes.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-md">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-bold rounded-md border border-green-200 mr-1 shrink-0">
                                <Layers size={11} />
                                {itemTypes.length} {itemTypes.length === 1 ? 'Type' : 'Types'}
                              </span>
                              {itemTypes.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-text-muted text-[11px] font-semibold rounded border border-border whitespace-nowrap">
                                  {c === 'veg' ? 'Veg' : 'Non-Veg'}
                                </span>
                              ))}
                            </div>
                          ) : cats.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-md">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-md border border-purple-200 mr-1 shrink-0">
                                <Layers size={11} />
                                {cats.length} {cats.length === 1 ? 'Cat' : 'Cats'}
                              </span>
                              {cats.slice(0, 4).map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-gray-100 text-text-muted text-[11px] font-semibold rounded border border-border whitespace-nowrap">
                                  {c}
                                </span>
                              ))}
                              {cats.length > 4 && (
                                <span className="text-[11px] text-text-muted font-bold">+{cats.length - 4} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-text-muted text-xs font-medium rounded border border-border">
                              {isBoth ? 'All Bills & Cutting Items' : (config.assignTo || 'All Cutting Items')}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => checkConnectionStatus(config._id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                              title={t("Check Connectivity")}>
                              <RefreshCw size={16} className={connectionStatuses[config._id]?.status === 'checking' ? 'animate-spin' : ''} />
                            </button>
                            <button
                              onClick={() => handleTestPrint(config._id)}
                              disabled={testingId === config._id}
                              className={`p-1.5 rounded-lg transition-all ${testingId === config._id ? 'text-blue-600 bg-blue-50 opacity-70 cursor-not-allowed' : 'text-text-muted hover:text-blue-600 hover:bg-blue-50 cursor-pointer'}`}
                              title={t("Send Test Receipt")}>
                              {testingId === config._id ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                            </button>
                            <button
                              onClick={() => openEditModal(config)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-amber-600 hover:bg-amber-50 transition-all cursor-pointer"
                              title={t("Edit Configuration")}>
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(config._id)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                              title={t("Delete")}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Tablet & Mobile Responsive Cards Grid (Screens below lg / 1024px) */}
          <div className="lg:hidden p-3 sm:p-4">
            {configs.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <Printer className="mx-auto text-sky-400/60 mb-2" size={36} />
                <p className="font-semibold text-slate-200 text-sm">{t("No printers configured yet.")}</p>
                <p className="text-xs text-slate-400 mt-1">{t("Click \"Add Printer Station\" to configure thermal printing.")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {configs.map((config) => {
                  const isKot = config.type === 'kot';
                  const isBoth = config.type === 'both';
                  const isItemMode = config.assignmentMode === 'item';
                  const isItemTypeMode = config.assignmentMode === 'itemType';
                  const cats = config.assignedCategories || [];
                  const items = config.assignedItems || [];
                  const itemTypes = config.assignedItemTypes || [];

                  return (
                    <div key={config._id} className="bg-[#FDFBF7] border border-sky-500/25 shadow-xl rounded-2xl text-slate-100 p-4 space-y-3.5 flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* Card Header: Name, Location, Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.isActive ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-rose-500'}`}></span>
                            <div>
                              <h3 className="font-bold text-sm sm:text-base text-text-main leading-tight whitespace-nowrap">{config.name}</h3>
                              {config.assignTo && config.assignTo !== config.name && (
                                <p className="text-[11px] text-text-muted font-medium">{t("Dept")}: {config.assignTo}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                            {config.location && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] sm:text-[11px] font-bold rounded-md border border-amber-200">
                                <MapPin size={10} />
                                {config.location}
                              </span>
                            )}
                            {connectionStatuses[config._id]?.status === 'checking' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-text-muted text-[10px] font-bold rounded-md border border-border shrink-0">
                                <Loader2 size={10} className="animate-spin" /> Checking
                              </span>
                            )}
                            {connectionStatuses[config._id]?.status === 'connected' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200 shrink-0">
                                <CheckCircle size={10} /> Online
                              </span>
                            )}
                            {connectionStatuses[config._id]?.status === 'disconnected' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded-md border border-rose-200 shrink-0">
                                <AlertTriangle size={10} /> Offline
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] sm:text-[11px] font-bold rounded-md border ${config.type === 'both'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : config.type === 'kot'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : config.type === 'receipt'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-gray-100 text-text-muted border-border'
                              }`}>
                              {config.type === 'both' ? 'Both (Bill & Butcher Slip)' : config.type === 'receipt' ? 'Receipt' : config.type === 'kot' ? 'KOT' : 'General'}
                            </span>
                          </div>
                        </div>

                        {/* Connection Info */}
                        <div className="flex items-center justify-between text-xs bg-[#f7f1ea] p-2.5 rounded-xl border border-gray-150">
                          <div className="flex items-center gap-1.5 text-text-muted font-semibold uppercase text-[11px]">
                            {config.connectionType === 'network' && <Network size={13} className="text-blue-600" />}
                            {config.connectionType === 'usb' && <Usb size={13} className="text-emerald-600" />}
                            {config.connectionType === 'bluetooth' && <Bluetooth size={13} className="text-indigo-600" />}
                            <span>{config.connectionType}</span>
                          </div>
                          {config.connectionType === 'network' && (
                            <span className="font-mono text-text-muted font-medium text-[11px] sm:text-xs">{config.ipAddress}:{config.port || 9100}</span>
                          )}
                          {config.connectionType === 'usb' && (
                            <span className="font-mono text-emerald-700 font-bold text-[11px] sm:text-xs">{config.usbPort || config.deviceName || 'USB'}</span>
                          )}
                          {config.connectionType === 'bluetooth' && config.bluetoothAddress && (
                            <span className="font-mono text-indigo-700 font-medium text-[11px] sm:text-xs">{config.bluetoothAddress}</span>
                          )}
                          {config.paperWidth && (
                            <span className="text-[10px] text-gray-400 font-mono">{config.paperWidth}</span>
                          )}
                        </div>

                        {/* Routing Details */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-text-muted uppercase tracking-wider">
                            <span>{t("Assigned Routing")}:</span>
                            {(isKot || isBoth) && (
                              <span className="font-bold text-text-muted normal-case">
                                {isItemMode ? t("Item-Based") : isItemTypeMode ? t("Item Type-Based") : t("Category-Based")}
                              </span>
                            )}
                          </div>

                          {config.type === 'receipt' ? (
                            <span className="text-xs text-gray-400 font-medium">{t("All Bills & Receipts")}</span>
                          ) : isItemMode && items.length > 0 ? (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-sky-500/20 text-sky-200">
                                <Utensils size={10} />
                                {items.length} {items.length === 1 ? 'Item' : 'Items'} assigned
                              </span>
                              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                {items.slice(0, 10).map((itm, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-text-muted border border-border text-[10px]">
                                    {itm}
                                  </span>
                                ))}
                                {items.length > 10 && (
                                  <span className="text-[10px] text-text-muted font-bold self-center">+{items.length - 10} more</span>
                                )}
                              </div>
                            </div>
                          ) : isItemTypeMode && itemTypes.length > 0 ? (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded-md border border-green-200">
                                <Layers size={10} />
                                {itemTypes.length} {itemTypes.length === 1 ? 'Type' : 'Types'} assigned
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {itemTypes.map((c, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-text-muted text-[10px] sm:text-[11px] font-semibold rounded border border-border whitespace-nowrap">
                                    {c === 'veg' ? 'Veg' : 'Non-Veg'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : cats.length > 0 ? (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-md border border-purple-200">
                                <Layers size={10} />
                                {cats.length} {cats.length === 1 ? 'Category' : 'Categories'} assigned
                              </span>
                              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                {cats.map((c, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-gray-100 text-text-muted text-[10px] sm:text-[11px] font-semibold rounded border border-border whitespace-nowrap">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-text-muted text-[10px] font-medium rounded border border-border">
                              {isBoth ? t("All Bills & Cutting Items") : (config.assignTo || t("All Cutting Items"))}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions Footer */}
                      <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <button
                          onClick={() => handleTestPrint(config._id)}
                          disabled={testingId === config._id}
                          className={`flex-1 py-2 px-2.5 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors ${testingId === config._id ? 'bg-blue-100 text-blue-800 opacity-70 cursor-not-allowed' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer active:scale-95'}`}
                        >
                          {testingId === config._id ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                          <span>{testingId === config._id ? t("Testing...") : t("Test Print")}</span>
                        </button>
                        <button
                          onClick={() => openEditModal(config)}
                          className="flex-1 py-2 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        >
                          <Edit size={14} />
                          <span>{t("Edit")}</span>
                        </button>
                        <button
                          onClick={() => checkConnectionStatus(config._id)}
                          className="py-2 px-2.5 bg-[#f7f1ea] hover:bg-gray-100 text-text-muted font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shrink-0"
                          title="Check Status"
                        >
                          <RefreshCw size={14} className={connectionStatuses[config._id]?.status === 'checking' ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => handleDelete(config._id)}
                          className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs rounded-xl flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                          title={t("Delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-2 sm:p-4 overflow-y-auto overscroll-contain touch-pan-y animate-in fade-in duration-150">
          <div className="bg-surface border border-border shadow-2xl rounded-2xl text-text-main shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh] border border-border my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border bg-[#f7f1ea]/80 shrink-0">
              <div>
                <h2 className="text-sm sm:text-lg font-black text-text-main flex items-center gap-1.5 sm:gap-2">
                  <Printer className="text-sky-400 shrink-0" size={18} />
                  <span>{editingConfig ? t('Edit Printer Station') : t('Add New Thermal / Printer Station')}</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-text-muted">
                  {t('Configure physical thermal printing and routing for this billing station')}
                </p>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-text-muted p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body with 2-Column Layout */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden touch-pan-y bg-[#f7f1ea] flex flex-col lg:flex-row">
              {/* Left Column - Form */}
              <div className="w-full lg:flex-1 p-3.5 sm:p-6 bg-[#FDFBF7] lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-sky-500/20 shrink-0 text-text-main">
                <form id="printer-form" onSubmit={handleSave} className="space-y-5">
                  {/* Station Name */}
                  <div>
                    <label className="block text-xs font-bold text-sky-300 uppercase tracking-wide mb-1.5">
                      {t("Station / Printer Name *")}
                    </label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder={t("e.g. Main Cashier Counter, Fish Weighing Scale, Packing Counter")}
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#F7EFE2] text-slate-900 placeholder:text-slate-400 font-bold border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none font-medium"
                    />
                  </div>

                  {/* Printer Type & Connection */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-sky-300/80 uppercase tracking-wide mb-1.5">
                        {t("Printer Purpose *")}
                      </label>
                      <select
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-sm border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none font-medium bg-[#FAF0E4] text-slate-900 font-bold border-[#E8DCCB] cursor-pointer">
                        <option value="receipt">{t("Receipt (Cashier Bill & Token)")}</option>
                        <option value="both">{t("Counter Slip & Summary")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-sky-300/80 uppercase tracking-wide mb-1.5">
                        {t("Connection Type")}
                      </label>
                      <select
                        name="connectionType"
                        value={formData.connectionType}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-sm border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none font-medium bg-[#FAF0E4] text-slate-900 font-bold border-[#E8DCCB] cursor-pointer">
                        <option value="network">{t("LAN / WiFi (Network IP) — Mobile & Desktop")}</option>
                        <option value="bluetooth">{t("Bluetooth — Mobile & Desktop")}</option>
                        <option value="usb">{t("USB Thermal Printer — Desktop Only")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-sky-300/80 uppercase tracking-wide mb-1.5">
                        {t("Paper Width")}
                      </label>
                      <select
                        name="paperWidth"
                        value={formData.paperWidth}
                        onChange={handleInputChange}
                        className="w-full px-3.5 py-2.5 text-sm border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none font-medium bg-[#FAF0E4] text-slate-900 font-bold border-[#E8DCCB] cursor-pointer">
                        <option value="80mm">{t("80mm (Standard 3-Inch)")}</option>
                        <option value="58mm">{t("58mm (Small 2-Inch)")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-sky-300/80 uppercase tracking-wide mb-1.5">
                        {t("Copies")}
                      </label>
                      <select
                        name="numberOfCopies"
                        value={formData.numberOfCopies}
                        onChange={(e) => setFormData(prev => ({ ...prev, numberOfCopies: Number(e.target.value) }))}
                        className="w-full px-3.5 py-2.5 text-sm border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none font-medium bg-[#FAF0E4] text-slate-900 font-bold border-[#E8DCCB] cursor-pointer">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <option key={num} value={num}>{num}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Network IP & Port */}
                  {formData.connectionType === 'network' && (
                    <div className="bg-[#F7EFE2] p-4 rounded-xl border border-sky-500/25 space-y-3">
                      {/* Scan header */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                          <Network size={14} className="text-sky-400" />
                          <span>{t("Auto-Detected Network / WiFi Printer IP")}</span>
                        </label>
                        <button
                          type="button"
                          onClick={scanNetworkPrinters}
                          disabled={isScanningNetwork}
                          className="text-xs font-bold text-sky-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-sky-500/20 hover:bg-sky-500/30 px-3 py-1.5 rounded-lg border border-sky-500/40 shadow-xs transition-all">
                          <RefreshCw size={12} className={isScanningNetwork ? "animate-spin text-sky-400" : "text-sky-400"} />
                          <span>{isScanningNetwork ? t("Scanning Network...") : t("Scan Network Printers")}</span>
                        </button>
                      </div>

                      {/* Discovered printers dropdown */}
                      {networkStatus && !networkStatus.connected && !isScanningNetwork && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-500/30 bg-red-950/40 text-[12px] text-red-300 font-semibold">
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                          <span>{t("Network not connected. No active LAN or WiFi interface detected on this machine. Please connect a network cable or join a WiFi network.")}</span>
                        </div>
                      )}

                      {networkStatus && networkStatus.connected && !isScanningNetwork && networkPrinters.length === 0 && networkStatus._scanned && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-[12px] text-amber-950 font-bold">
                          <AlertTriangle size={14} className="text-amber-700 shrink-0" />
                          <span>{t("Network connected but no thermal printer found on port 9100. Make sure printer is ON, on same network, and check its IP settings.")}</span>
                        </div>
                      )}

                      {(networkPrinters.length > 0 || isScanningNetwork) && (
                        <div className="relative">
                          <select
                            value={formData.ipAddress}
                            onChange={(e) => {
                              const selected = networkPrinters.find(p => p.ip === e.target.value);
                              setFormData(prev => ({
                                ...prev,
                                ipAddress: e.target.value,
                                port: selected?.port
                              }));
                            }}
                            className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-sky-500/30 rounded-xl bg-[#FDFBF7] text-white font-mono font-medium focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none appearance-none pr-9 cursor-pointer">
                            <option value="">{t("-- Select Detected Printer IP --")}</option>
                            {networkPrinters.map((p, i) => (
                              <option key={i} value={p.ip}>
                                {p.ip}:{p.port} — Thermal Printer Detected
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={15} className="absolute right-3 top-2.5 text-sky-400 pointer-events-none" />
                        </div>
                      )}

                      {networkPrinters.length === 1 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                          <CheckCircle size={13} className="text-emerald-400" />
                          {t("1 printer auto-detected and selected: ")} <span className="font-mono text-white">{networkPrinters[0].ip}</span>
                        </div>
                      )}

                      {/* Manual IP + Port row */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-sky-300/80 uppercase tracking-wide mb-1">
                            {t("IP Address")}
                          </label>
                          <input
                            type="text"
                            name="ipAddress"
                            placeholder="e.g. 192.168.1.100"
                            value={formData.ipAddress}
                            onChange={handleInputChange}
                            className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] text-slate-900 placeholder:text-slate-400 font-bold border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-sky-300/80 uppercase tracking-wide mb-1">
                            {t("Port")}
                          </label>
                          <input
                            type="number"
                            name="port"
                            value={formData.port}
                            onChange={handleInputChange}
                            className="w-full px-3.5 py-2 text-sm bg-[#FDFBF7] text-slate-900 placeholder:text-slate-400 font-bold border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none font-mono font-medium"
                          />
                        </div>
                      </div>

                      {networkStatus && networkStatus.connected && networkStatus.interfaces && networkStatus.interfaces.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {networkStatus.interfaces.map((iface, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-950/50 text-emerald-300 text-[10px] font-mono font-bold rounded-md border border-emerald-500/30">
                              <CheckCircle size={10} className="text-emerald-400" />
                              {iface.name}: {iface.address}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-[11px] text-sky-950 font-medium flex items-start gap-2.5">
                        <CheckCircle size={14} className="text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          {t("LAN / WiFi (Network IP): Fully supported on both Mobile and Desktop. Print jobs fired by Captains or Cashiers from their phones on your restaurant Wi-Fi will automatically print to this station.")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* USB Port Auto-Detector & Selector */}
                  {formData.connectionType === 'usb' && (
                    <div className="bg-[#F7EFE2] p-4 rounded-xl border border-sky-500/25 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="block text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                          <Usb size={14} className="text-sky-400" />
                          <span>{t("Auto-Detected USB / Virtual COM Port")}</span>
                        </label>
                        <button
                          type="button"
                          onClick={scanUsbPorts}
                          disabled={isScanningUsb}
                          className="text-xs font-bold text-sky-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-sky-500/20 hover:bg-sky-500/30 px-3 py-1.5 rounded-lg border border-sky-500/40 shadow-xs transition-all">
                          <RefreshCw size={12} className={isScanningUsb ? "animate-spin text-sky-400" : "text-sky-400"} />
                          <span>{isScanningUsb ? t("Scanning Ports...") : t("Scan USB Ports")}</span>
                        </button>
                      </div>

                      {/* USB port dropdown — only shown when live ports are available */}
                      {usbPorts.length > 0 ? (
                        <select
                          name="usbPort"
                          value={formData.usbPort || ''}
                          onChange={(e) => {
                            const selectedPort = e.target.value;
                            const matched = usbPorts.find(p => p.port === selectedPort);
                            setFormData(prev => ({
                              ...prev,
                              usbPort: selectedPort,
                              deviceName: matched?.description || matched?.printerName || prev.deviceName
                            }));
                          }}
                          className="w-full min-w-0 truncate px-3.5 py-2.5 text-xs sm:text-sm border border-sky-500/30 rounded-xl bg-[#FDFBF7] text-white font-medium focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none font-mono cursor-pointer">
                          <option value="">{t("-- Select Attached USB / Virtual COM Port --")}</option>
                          {usbPorts.map(p => (
                            <option key={p.port} value={p.port}>
                              {p.displayName || p.port} {p.isThermalLikely ? `★ [Thermal Printer]` : ''}
                            </option>
                          ))}
                        </select>
                      ) : !isScanningUsb && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-[12px] text-amber-950 font-bold">
                          <AlertTriangle size={14} className="text-amber-700 shrink-0" />
                          <span>{t("No USB printer currently connected. Please plug in your USB cable and click Scan USB Ports.")}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          name="usbPort"
                          placeholder={t("Or enter port manually (e.g. USB001, USB009, COM3)")}
                          value={formData.usbPort || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-xs font-mono border border-sky-500/30 rounded-lg bg-[#FDFBF7] text-slate-900 placeholder:text-slate-400 font-bold focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-[11px] text-amber-950 font-medium flex items-start gap-2.5">
                        <AlertTriangle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                        <span>
                          {t("Desktop Only: Physical USB printers are for the main computer. Mobile phones (Captain / Cashier) cannot use USB cables and will print via LAN / WiFi or Bluetooth.")}
                        </span>
                      </div>

                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-[11px] text-sky-950 font-medium flex items-start gap-2.5">
                        <CheckCircle size={14} className="text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          {t("Driverless Plug & Play: MS Billings automatically detects your printer hardware (e.g. KPC307, Epson, POS80) and streams raw ESC/POS binary directly to the USB cable without needing Windows or Mac drivers installed.")}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Bluetooth Device Selection */}
                  {formData.connectionType === 'bluetooth' && (
                    <div className="bg-[#F7EFE2] p-4 rounded-xl border border-sky-500/25 text-sky-200 space-y-3">
                      {/* Header + Scan button */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <label className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
                          <Bluetooth size={14} className="text-sky-400" />
                          <span>{t("Auto-Detected Bluetooth Thermal Printer")}</span>
                        </label>
                        <button
                          type="button"
                          onClick={loadBluetoothDevices}
                          disabled={isScanningBluetooth}
                          className="text-xs font-bold text-sky-300 hover:text-white flex items-center gap-1.5 cursor-pointer bg-sky-500/20 hover:bg-sky-500/30 px-3 py-1.5 rounded-lg border border-sky-500/40 shadow-xs transition-all">
                          <RefreshCw size={12} className={isScanningBluetooth ? "animate-spin text-sky-400" : "text-sky-400"} />
                          <span>{isScanningBluetooth ? t("Scanning Bluetooth...") : t("Scan Bluetooth Devices")}</span>
                        </button>
                      </div>

                      {/* Bluetooth not available */}
                      {btAvailable === false && !isScanningBluetooth && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-500/30 bg-red-950/40 text-[12px] text-red-300 font-semibold">
                          <AlertTriangle size={14} className="text-red-400 shrink-0" />
                          <span>{t("Bluetooth is not available or not enabled on this device. Please turn ON Bluetooth and try again.")}</span>
                        </div>
                      )}

                      {/* Bluetooth available but no paired devices */}
                      {btAvailable === true && !isScanningBluetooth && bluetoothDevices.length === 0 && (
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-[12px] text-amber-950 font-bold">
                          <AlertTriangle size={14} className="text-amber-700 shrink-0" />
                          <span>{t("Bluetooth is available but no paired devices were found. Please pair your thermal printer in your system Bluetooth settings first, then scan again.")}</span>
                        </div>
                      )}

                      {/* Devices dropdown — shown only when devices are available */}
                      {bluetoothDevices.length > 0 && (
                        <div className="relative">
                          <select
                            name="bluetoothAddress"
                            value={formData.bluetoothAddress || ''}
                            onChange={(e) => {
                              const selectedAddr = e.target.value;
                              const found = bluetoothDevices.find(d => d.address === selectedAddr);
                              setFormData(prev => ({
                                ...prev,
                                bluetoothAddress: selectedAddr,
                                deviceName: found ? found.name : prev.deviceName
                              }));
                            }}
                            className="w-full min-w-0 truncate px-3.5 py-2.5 text-xs sm:text-sm border border-sky-500/30 rounded-xl bg-[#FDFBF7] text-white font-medium focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none appearance-none pr-9 cursor-pointer">
                            <option value="">{t("-- Select Paired Bluetooth Printer --")}</option>
                            {/* Thermal printers first */}
                            {bluetoothDevices.filter(d => d.isThermal).map(d => (
                              <option key={d.address || d.name} value={d.address}>
                                ★ {d.name}{d.address ? ` (${d.address})` : ''} {d.batteryLevel !== undefined ? `— 🔋 ${d.batteryLevel}%` : ''} — Thermal Printer
                              </option>
                            ))}
                            {bluetoothDevices.filter(d => !d.isThermal).map(d => (
                              <option key={d.address || d.name} value={d.address}>
                                {d.name}{d.address ? ` (${d.address})` : ''} {d.batteryLevel !== undefined ? `— 🔋 ${d.batteryLevel}%` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={15} className="absolute right-3 top-2.5 text-sky-400 pointer-events-none" />
                        </div>
                      )}

                      {/* Show selected device battery if available */}
                      {formData.bluetoothAddress && (
                        <div className="flex items-center gap-3 mt-2">
                          {/* Auto-detected battery level from getPairedDevices */}
                          {bluetoothDevices.find(d => d.address === formData.bluetoothAddress)?.batteryLevel !== undefined && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/50 border border-emerald-500/30 rounded-lg text-emerald-300 text-[11px] font-bold">
                              <Battery size={14} className="text-emerald-400" />
                              <span>{t("Initial Battery:")} {bluetoothDevices.find(d => d.address === formData.bluetoothAddress).batteryLevel}%</span>
                            </div>
                          )}

                          {/* Live polled battery level */}
                          {liveBatteryLevel !== null && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-sky-950/50 border border-sky-500/30 rounded-lg text-sky-300 text-[11px] font-bold">
                              <Battery size={14} className="text-sky-400" />
                              <span>{t("Live Battery:")} {liveBatteryLevel}%</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={checkPrinterBattery}
                            disabled={isCheckingBattery}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] border border-sky-500/30 rounded-lg text-xs font-semibold text-slate-700 hover:bg-[#FAF0E4] hover:text-[#7c3f1d] border-[#E8DCCB] transition-colors"
                          >
                            {isCheckingBattery ? <RefreshCw size={12} className="animate-spin text-sky-400" /> : <Battery size={12} className="text-sky-400" />}
                            {isCheckingBattery ? t("Checking...") : t("Check Battery")}
                          </button>
                        </div>
                      )}

                      {/* LIVE BLUETOOTH STATUS PANEL */}
                      {formData.bluetoothAddress && (
                        <div className="bg-[#FDFBF7] p-3.5 rounded-xl border border-sky-500/25 space-y-3 mt-3">
                          <h4 className="text-[11px] font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
                            <Bluetooth size={12} className={isScanningBluetooth ? "animate-pulse" : ""} />
                            {t("Live Bluetooth Status")}
                          </h4>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {/* 1. Bluetooth ON/OFF */}
                            <div className="flex items-center justify-between p-2.5 bg-[#F7EFE2] rounded-lg border border-sky-500/20">
                              <span className="text-slate-300 font-medium">{t("Bluetooth Radio")}</span>
                              {btAvailable === true ? (
                                <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold rounded text-[10px] uppercase">ON</span>
                              ) : btAvailable === false ? (
                                <span className="px-2 py-0.5 bg-red-950/60 text-red-400 border border-red-500/30 font-bold rounded text-[10px] uppercase">OFF / UNAVAILABLE</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-300 font-bold rounded text-[10px] uppercase">CHECKING...</span>
                              )}
                            </div>

                            {/* 2. Paired Status */}
                            <div className="flex items-center justify-between p-2.5 bg-[#F7EFE2] rounded-lg border border-sky-500/20">
                              <span className="text-slate-300 font-medium">{t("Pairing Status")}</span>
                              {bluetoothDevices.some(d => d.address === formData.bluetoothAddress) ? (
                                <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold rounded text-[10px] uppercase">PAIRED</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-500/30 font-bold rounded text-[10px] uppercase">NOT PAIRED</span>
                              )}
                            </div>

                            {/* 3. Connected Status */}
                            <div className="flex items-center justify-between p-2.5 bg-[#F7EFE2] rounded-lg border border-sky-500/20">
                              <span className="text-slate-300 font-medium">{t("Connection")}</span>
                              {bluetoothDevices.some(d => d.address === formData.bluetoothAddress && d.connected) ? (
                                <span className="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold rounded text-[10px] uppercase flex items-center gap-1"><CheckCircle size={10} /> CONNECTED</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 font-bold rounded text-[10px] uppercase">DISCONNECTED</span>
                              )}
                            </div>

                            {/* 4. Connection Limit */}
                            <div className="flex items-center justify-between p-2.5 bg-[#F7EFE2] rounded-lg border border-sky-500/20">
                              <span className="text-slate-300 font-medium">{t("Device Limit")}</span>
                              {bluetoothDevices.some(d => d.address === formData.bluetoothAddress && d.connected) ? (
                                <span className="px-2 py-0.5 bg-sky-950/60 text-sky-400 border border-sky-500/30 font-bold rounded text-[10px] uppercase">1/1 (MAX REACHED)</span>
                              ) : (
                                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 font-bold rounded text-[10px] uppercase">AVAILABLE (0/1)</span>
                              )}
                            </div>
                          </div>

                          {/* 5. Error Reporting */}
                          {(!btAvailable || !bluetoothDevices.some(d => d.address === formData.bluetoothAddress)) && (
                            <div className="p-2.5 bg-red-950/40 border border-red-500/30 rounded-lg flex items-start gap-2 text-[11px] text-red-300 mt-2">
                              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-400" />
                              <span className="font-medium">
                                {!btAvailable
                                  ? t("Error: Bluetooth adapter is turned off or not found on this system. Please enable it.")
                                  : t("Error: This device is not currently paired. Please pair it in your system Bluetooth settings first and click Scan.")}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Manual MAC input */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          name="bluetoothAddress"
                          placeholder={t("Or enter Bluetooth MAC manually (e.g. 66:22:BB:11:AA:00)")}
                          value={formData.bluetoothAddress || ''}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 text-xs font-mono border border-sky-500/30 text-slate-900 placeholder:text-slate-400 font-bold rounded-lg bg-[#FDFBF7] focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-sky-950 text-[11px] font-medium flex items-start gap-2.5">
                        <Bluetooth size={14} className="text-sky-400 shrink-0 mt-0.5" />
                        <span>
                          {t("Windows/Linux: Scans currently paired Bluetooth devices from system hardware. Android App: Scans paired devices from Android Bluetooth settings. Make sure printer is ON and paired before scanning.")}
                        </span>
                      </div>
                    </div>
                  )}


                  {/* ITEM & CATEGORY ROUTING CONFIGURATION */}
                  {(formData.type === 'kot' || formData.type === 'both' || formData.type === 'receipt') && (
                    <div className="p-4 bg-[#FDFBF7] border border-sky-500/20 rounded-xl border border-border space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
                        <div>
                          <div className="font-bold text-sm text-text-main flex items-center gap-2">
                            <Layers size={16} className="text-sky-400" />
                            <span>{t("Fish Items & Category Routing")}</span>
                          </div>
                          <p className="text-xs text-text-muted mt-0.5">
                            {t("Choose whether this station prints tickets for entire fish categories or specific items")}
                          </p>
                        </div>

                        {/* MODE TOGGLE: Category-Based vs Item-Based */}
                        <div className="inline-flex p-1 bg-[#F7EFE2] rounded-xl border border-sky-500/20 w-full sm:w-auto justify-center flex-wrap sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, assignmentMode: 'category' }))}
                            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${formData.assignmentMode === 'category'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm'
                                : 'text-sky-300/70 hover:text-white hover:bg-sky-500/10'
                              }`}>
                            <Layers size={13} />
                            <span>{t("Category")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, assignmentMode: 'item' }))}
                            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${formData.assignmentMode === 'item'
                                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm'
                                : 'text-sky-300/70 hover:text-white hover:bg-sky-500/10'
                              }`}>
                            <Utensils size={13} />
                            <span>{t("Item")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Search Bar for Categories/Items */}
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-sky-400/60" size={15} />
                        <input
                          type="text"
                          placeholder={
                            formData.assignmentMode === 'category'
                              ? t("Search fish categories...")
                              : t("Search fish items...")
                          }
                          value={assignmentSearch}
                          onChange={(e) => setAssignmentSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[#F7EFE2] text-slate-900 placeholder:text-slate-400 font-bold border border-sky-500/30 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none"
                        />
                      </div>

                      {/* VIEW 1: CATEGORY-BASED SELECTOR */}
                      {formData.assignmentMode === 'category' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-text-muted font-medium px-1">
                            <span>
                              {t("Select categories assigned to this station")} ({formData.assignedCategories.length} {t("selected")})
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const allNames = categories.map(c => c.name);
                                  setFormData(prev => ({ ...prev, assignedCategories: allNames }));
                                }}
                                className="text-xs font-bold text-sky-400 hover:underline cursor-pointer">
                                {t("Select All")}
                              </button>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, assignedCategories: [] }))}
                                className="text-xs font-bold text-slate-400 hover:underline cursor-pointer">
                                {t("Clear All")}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
                            {categories.length === 0 ? (
                              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                                {t("No categories found. Please add categories in Menu Management.")}
                              </div>
                            ) : (
                              categories
                                .filter(c => !assignmentSearch || c.name.toLowerCase().includes(assignmentSearch.toLowerCase()))
                                .map(cat => {
                                  const isSelected = formData.assignedCategories.includes(cat.name);
                                  const assignedOther = existingAssignments.catMap[cat.name.toLowerCase()];

                                  return (
                                    <div
                                      key={cat._id || cat.name}
                                      onClick={() => toggleCategory(cat.name)}
                                      className={`relative p-3 rounded-xl border text-xs font-bold flex flex-col justify-between transition-all cursor-pointer select-none ${isSelected
                                          ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-md shadow-sky-500/10'
                                          : assignedOther
                                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                            : 'bg-[#F7EFE2] border-sky-500/25 text-slate-200 hover:border-sky-500/40 hover:bg-sky-500/10'
                                        }`}>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="truncate">{cat.name}</span>
                                        <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? 'bg-sky-500 border-sky-500 text-white' : 'border-sky-500/40 bg-[#FDFBF7]'
                                          }`}>
                                          {isSelected && <Check size={11} strokeWidth={3} />}
                                        </div>
                                      </div>

                                      {/* Duplicate Prevention Badge */}
                                      {assignedOther && (
                                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                          <AlertTriangle size={10} className="shrink-0 text-amber-600" />
                                          <span className="truncate">Assigned: {assignedOther}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}

                      {/* VIEW 2: ITEM-BASED BULK SELECTOR */}
                      {formData.assignmentMode === 'item' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-text-muted font-medium px-1">
                            <span>
                              {t("Select individual menu items")} ({formData.assignedItems.length} {t("selected")})
                            </span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, assignedItems: [] }))}
                              className="text-xs font-bold text-text-muted hover:underline cursor-pointer">
                              {t("Clear All Selected")}
                            </button>
                          </div>

                          <div className="space-y-2.5 max-h-64 overflow-y-auto p-1">
                            {Object.keys(itemsByCategory).length === 0 ? (
                              <div className="py-6 text-center text-xs text-gray-400">
                                {t("No menu items found. Please add menu items in Menu Management.")}
                              </div>
                            ) : (
                              Object.entries(itemsByCategory).map(([catName, items]) => {
                                const matchingItems = items.filter(i =>
                                  !assignmentSearch ||
                                  i.name.toLowerCase().includes(assignmentSearch.toLowerCase()) ||
                                  catName.toLowerCase().includes(assignmentSearch.toLowerCase())
                                );

                                if (matchingItems.length === 0) return null;

                                const isCollapsed = collapsedCategories[catName];
                                const selectedInCat = matchingItems.filter(i => formData.assignedItems.includes(i.name)).length;
                                const isCatAssignedOther = existingAssignments.catMap[catName.toLowerCase()];

                                return (
                                  <div key={catName} className="border border-sky-500/25 rounded-xl overflow-hidden bg-[#F7EFE2]">
                                    {/* Category Group Header */}
                                    <div className="flex items-center justify-between px-3.5 py-2 bg-[#FDFBF7] border-b border-sky-500/20">
                                      <div
                                        onClick={() => setCollapsedCategories(prev => ({ ...prev, [catName]: !prev[catName] }))}
                                        className="flex items-center gap-2 cursor-pointer select-none">
                                        {isCollapsed ? <ChevronDown size={14} className="text-sky-400" /> : <ChevronUp size={14} className="text-sky-400" />}
                                        <span className="font-bold text-xs text-slate-100">{catName}</span>
                                        <span className="text-[11px] font-semibold text-slate-400">({matchingItems.length})</span>
                                        {selectedInCat > 0 && (
                                          <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded text-[10px] font-bold">
                                            {selectedInCat} selected
                                          </span>
                                        )}
                                        {isCatAssignedOther && (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded">
                                            <AlertTriangle size={9} />
                                            Category mapped to {isCatAssignedOther}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => toggleSelectAllCategoryItems(catName, matchingItems)}
                                        className="text-xs font-bold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer">
                                        {selectedInCat === matchingItems.length ? t("Deselect All") : t("Select All")}
                                      </button>
                                    </div>

                                    {/* Items inside Category */}
                                    {!isCollapsed && (
                                      <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {matchingItems.map(item => {
                                          const isSelected = formData.assignedItems.includes(item.name);
                                          const assignedOther = existingAssignments.itemMap[item.name.toLowerCase()] || existingAssignments.catMap[catName.toLowerCase()];

                                          return (
                                            <div
                                              key={item._id || item.name}
                                              onClick={() => toggleItem(item.name)}
                                              className={`p-2 rounded-lg border text-xs flex items-center justify-between transition-all cursor-pointer select-none ${isSelected
                                                  ? 'bg-sky-500/25 border-sky-400 font-bold text-sky-200'
                                                  : assignedOther
                                                    ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                                                    : 'bg-[#FDFBF7] border-sky-500/20 hover:bg-[#fff7ed] text-slate-200'
                                                }`}>
                                              <div className="flex flex-col truncate pr-2">
                                                <span className="truncate">{item.name}</span>
                                                {assignedOther && (
                                                  <span className="text-[10px] text-amber-400 font-bold truncate">
                                                    Assigned: {assignedOther}
                                                  </span>
                                                )}
                                              </div>
                                              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${isSelected ? 'bg-sky-500 border-sky-400 text-white' : 'border-sky-500/40 bg-[#F7EFE2]'
                                                }`}>
                                                {isSelected && <Check size={10} strokeWidth={3} />}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  )}


                  {/* Active Checkbox */}
                  <div className="flex items-center gap-6 pt-1">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="isActive"
                        name="isActive"
                        checked={formData.isActive}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                      />
                      <label htmlFor="isActive" className="text-xs sm:text-sm font-bold text-text-main cursor-pointer">
                        {t("Station is Active")}
                      </label>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id="silentPrinting"
                        name="silentPrinting"
                        checked={formData.silentPrinting}
                        onChange={handleInputChange}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="silentPrinting" className="text-xs sm:text-sm font-bold text-text-main cursor-pointer flex items-center gap-1">
                        {t("Silent Printing (Direct)")}
                      </label>
                    </div>
                  </div>
                </form>
              </div>

              {/* Right Column - Live Preview */}
              <div className="w-full lg:w-[400px] bg-[#f7f1ea] p-4 flex flex-col items-center justify-start lg:overflow-y-auto shrink-0 border-sky-500/20">
                <div className="text-center mb-4">
                  <h3 className="text-sm font-bold text-text-main">{t("Live Receipt Preview")}</h3>
                  <p className="text-[10px] text-text-muted">{t("Preview updates dynamically as you change settings")}</p>
                </div>
                <LiveReceiptPreview
                  settings={{
                    printFormat: formData.paperWidth,
                    receiptFontFamily: 'arial',
                    receiptFontSize: 'medium',
                    restaurantName: 'YNR FISHES',
                    logo: '/assets/ynr_logo_hd.jpg',
                    upiId: 'ynrfishes@upi'
                  }}
                  previewTab="receipt"
                  t={t}
                  user={{ username: 'admin' }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-sky-500/20 bg-[#f7f1ea] flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 bg-white border border-[#E8DCCB] rounded-xl hover:bg-[#FAF0E4] transition-colors cursor-pointer text-center">
                {t("Cancel")}
              </button>
              <button
                type="submit"
                form="printer-form"
                disabled={isSaving}
                className="w-full sm:w-auto px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#d94e08] hover:to-[#9a3412] text-white font-bold disabled:opacity-60 rounded-xl transition-all shadow-md cursor-pointer text-center flex items-center justify-center gap-2">
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-white" />
                    <span>{editingConfig ? t('Saving Changes...') : t('Creating Station...')}</span>
                  </>
                ) : (
                  <span>{editingConfig ? t('Save Changes') : t('Create Station')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrinterConfig;