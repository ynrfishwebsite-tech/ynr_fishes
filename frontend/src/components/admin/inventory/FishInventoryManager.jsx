import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../system/Toast';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';
import realtimeService from '../../../services/realtimeService';
import { getSuppliers } from '../../../api/operations/operations';
import { getVehicles } from '../../../api/operations/vehicle';
import { 
  getSupplyCategories, 
  createSupplyCategory, 
  recordSupplyStockIn, 
  getSupplyLogs 
} from '../../../api/operations/supplies';
import { 
  Package, 
  ArrowDownLeft, 
  Plus, 
  RefreshCw, 
  History, 
  Scale, 
  ShieldCheck, 
  Search,
  Filter,
  Calendar,
  Printer,
  Trash2,
  FileText,
  CheckCircle,
  Truck,
  User,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Anchor,
  Building,
  AlertTriangle,
  RotateCcw,
  Boxes,
  Eye,
  EyeOff,
  Phone,
  Check,
  ChevronUp,
  Users,
  Lock,
  Unlock
} from 'lucide-react';
import BackButton from '../common/BackButton';
import SearchableDropdown from '../../common/SearchableDropdown';
import FishInwardInvoice from './FishInwardInvoice';
import FishIntakeOrbitalDial from './FishIntakeOrbitalDial';
import SupplierHub from '../operations/SupplierHub';
import { getMenuItems } from '../../../api/catalog/menu';
import { formatImageUrl } from '../catalog/MenuGrid';
import LocalStockInTab from './LocalStockInTab';
import DamStockInTab from './DamStockInTab';
import SuppliesStockInTab from './SuppliesStockInTab';

export default function FishInventoryManager({ user, onNavigate, onGoBack, initialTab, initialSubTab, dedicatedMode }) {
  const [activeTab, setActiveTab] = useState(() => {
    if (initialTab && ['overview', 'procurement', 'logs', 'srm'].includes(initialTab)) {
      return initialTab;
    }
    try {
      const saved = localStorage.getItem('inventory_active_tab');
      if (saved && ['overview', 'procurement', 'logs', 'srm'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'overview';
  });

  const [stockInSubTab, setStockInSubTab] = useState(() => {
    if (initialSubTab && ['local', 'dam', 'supplies'].includes(initialSubTab)) {
      return initialSubTab;
    }
    try {
      const saved = localStorage.getItem('inventory_stockin_subtab');
      if (saved && ['local', 'dam', 'supplies'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return 'local';
  });

  const [currentDedicatedMode, setCurrentDedicatedMode] = useState(() => {
    if (dedicatedMode && ['local', 'dam', 'supplies', 'ledger'].includes(dedicatedMode)) {
      return dedicatedMode;
    }
    if (initialSubTab === 'local') return 'local';
    if (initialSubTab === 'dam') return 'dam';
    if (initialSubTab === 'supplies') return 'supplies';
    try {
      const saved = localStorage.getItem('inventory_dedicated_mode');
      if (saved && ['local', 'dam', 'supplies', 'ledger'].includes(saved)) {
        return saved;
      }
    } catch (e) {}
    return null;
  });

  // Watch for external navigation prop updates:
  useEffect(() => {
    if (initialTab && ['overview', 'procurement', 'logs', 'srm'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (initialSubTab && ['local', 'dam', 'supplies'].includes(initialSubTab)) {
      setStockInSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (dedicatedMode) {
      setCurrentDedicatedMode(dedicatedMode);
      if (dedicatedMode === 'ledger' && !initialTab) {
        setActiveTab('overview');
      }
    } else if (initialSubTab === 'local') {
      setCurrentDedicatedMode('local');
    } else if (initialSubTab === 'dam') {
      setCurrentDedicatedMode('dam');
    } else if (initialSubTab === 'supplies') {
      setCurrentDedicatedMode('supplies');
    }
  }, [dedicatedMode, initialSubTab, initialTab]);

  // Persist current active tab & sub-tab across page refreshes
  useEffect(() => {
    try {
      localStorage.setItem('inventory_active_tab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('inventory_stockin_subtab', stockInSubTab);
    } catch (e) {}
  }, [stockInSubTab]);

  // Cold Storage Stock Metrics Modal (Default: OFF on all screen sizes)
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [fishList, setFishList] = useState([]);
  const [masterFishList, setMasterFishList] = useState([]);
  const catalogMenuMapRef = useRef(new Map());
  const [stockLogs, setStockLogs] = useState([]);
  const [crmCustomers, setCrmCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [inwardInvoiceModal, setInwardInvoiceModal] = useState(null);

  // Multi-Bill Selection & Combine Invoice State
  const [selectedBillKeys, setSelectedBillKeys] = useState([]);

  // Local Stock-In Form State (Multi-fish + Boxes support)
  const [localStockInForm, setLocalStockInForm] = useState({
    supplierName: '',
    supplierPhone: '',
    companyName: '',
    vehicleNumber: '',
    harbor: '',
    items: [
      { id: 1, menuItemId: '', itemName: '', sizeGrade: 'medium', sizeBracket: 'Medium', weightOption: '1 - 4 Kg', boxes: '', kgPerBox: 1, kg: '', grams: '', ratePerKg: '', date: new Date().toISOString().slice(0, 16), weighMode: 'kg' }
    ],
    showSettlements: false, // Default: Hidden & Excluded
    settlements: {
      ice: { label: 'Ice Charges', type: 'Dr', amount: '', isLocked: true },
      boxes: { label: 'Boxes Charges', type: 'Dr', amount: '', isLocked: true },
      tape: { label: 'Tape Charges', type: 'Dr', amount: '', isLocked: true },
      advance: { label: 'Advance Deducted', type: 'Dr', amount: '', isLocked: true }
    },
    customSettlements: [],
    paymentMode: 'Cash',
    paidAmount: '',
    dueAmount: 0,
    partialPaid: '',
    partialMethod: 'Cash',
    splitPayments: { cash: '', upi: '', bank: '', cheque: '' },
    chequeDetails: { chequeNumber: '', bankName: '', chequeDate: '' },
    bankDetails: { transactionId: '', bankName: '' },
    notes: ''
  });

  // DAM Consignment Form State (Multi-fish + Boxes support)
  const [damStockInForm, setDamStockInForm] = useState({
    contractorId: '',
    contractorName: '',
    contractorPhone: '',
    companyName: '',
    vehicleNumber: '',
    harbor: '',
    contractorCity: '',
    tallyItems: [
      { id: 1, menuItemId: '', itemName: '', sizeGrade: 'medium', sizeBracket: 'Medium', weightOption: '1 - 4 Kg', boxes: '', kgPerBox: 1, kg: '', grams: '', price: '', date: new Date().toISOString().slice(0, 16), weighMode: 'kg' }
    ],
    showSettlements: false, // Default: Hidden & Excluded
    settlements: {
      advance: { label: '1) Advance', type: 'Dr', amount: '', isLocked: true },
      khata: { label: '2) Khata', type: 'Dr', amount: '', isLocked: true },
      od: { label: '3) OD / Transport', type: 'Dr', amount: '', isLocked: true },
      expense: { label: '4) Depot Expense', type: 'Dr', amount: '', isLocked: true },
      festivalExpense: { label: '5) Other Expense', type: 'Dr', amount: '', isLocked: true }
    },
    customSettlements: [],
    paymentMode: 'Cash',
    paidAmount: '',
    dueAmount: 0,
    partialPaid: '',
    partialMethod: 'Cash',
    splitPayments: { cash: '', upi: '', bank: '', cheque: '' },
    chequeDetails: { chequeNumber: '', bankName: '', chequeDate: '' },
    bankDetails: { transactionId: '', bankName: '' },
    notes: ''
  });

  // 3D Orbital Dial vs Fast Table selector mode for catch intake ('ring' | 'table')
  const [localSelectorMode, setLocalSelectorMode] = useState('ring');
  const [damSelectorMode, setDamSelectorMode] = useState('ring');

  // Species Variety Filter States & Menu Refs for Local and Dam Catch Intake
  const [localSpeciesFilter, setLocalSpeciesFilter] = useState('all'); // 'all' | 'fish' | 'prawn' | 'crab'
  const [showLocalSpeciesMenu, setShowLocalSpeciesMenu] = useState(false);
  const [localSpeciesMenuCoords, setLocalSpeciesMenuCoords] = useState({ top: 0, left: 0 });
  const localSpeciesBtnRef = useRef(null);
  const localSpeciesMenuRef = useRef(null);

  const [damSpeciesFilter, setDamSpeciesFilter] = useState('all'); // 'all' | 'fish' | 'prawn' | 'crab'
  const [showDamSpeciesMenu, setShowDamSpeciesMenu] = useState(false);
  const [damSpeciesMenuCoords, setDamSpeciesMenuCoords] = useState({ top: 0, left: 0 });
  const damSpeciesBtnRef = useRef(null);
  const damSpeciesMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutsideSpecies = (e) => {
      if (showLocalSpeciesMenu && localSpeciesMenuRef.current && !localSpeciesMenuRef.current.contains(e.target) && localSpeciesBtnRef.current && !localSpeciesBtnRef.current.contains(e.target)) {
        setShowLocalSpeciesMenu(false);
      }
      if (showDamSpeciesMenu && damSpeciesMenuRef.current && !damSpeciesMenuRef.current.contains(e.target) && damSpeciesBtnRef.current && !damSpeciesBtnRef.current.contains(e.target)) {
        setShowDamSpeciesMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideSpecies);
    document.addEventListener('touchstart', handleClickOutsideSpecies);
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSpecies);
      document.removeEventListener('touchstart', handleClickOutsideSpecies);
    };
  }, [showLocalSpeciesMenu, showDamSpeciesMenu]);

  const handleToggleLocalSpeciesMenu = () => {
    if (localSpeciesBtnRef.current) {
      const rect = localSpeciesBtnRef.current.getBoundingClientRect();
      setLocalSpeciesMenuCoords({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(8, rect.right + window.scrollX - 145)
      });
    }
    setShowLocalSpeciesMenu(prev => !prev);
  };

  const handleToggleDamSpeciesMenu = () => {
    if (damSpeciesBtnRef.current) {
      const rect = damSpeciesBtnRef.current.getBoundingClientRect();
      setDamSpeciesMenuCoords({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(8, rect.right + window.scrollX - 145)
      });
    }
    setShowDamSpeciesMenu(prev => !prev);
  };

  // Split decimal kgPerBox into separate Kg and Grams fields for dual table inputs
  const splitKgPerBoxParts = (row) => {
    if (row.kgPerBoxKg !== undefined && row.kgPerBoxGrams !== undefined) {
      return { k: String(row.kgPerBoxKg), g: String(row.kgPerBoxGrams) };
    }
    const raw = row.kgPerBox;
    if (raw === '' || raw === null || raw === undefined) return { k: '', g: '' };
    const num = Number(raw);
    if (isNaN(num)) return { k: '', g: '' };
    const whole = Math.floor(num);
    const remG = Math.round((num - whole) * 1000);
    return {
      k: String(whole + Math.floor(remG / 1000)),
      g: String(remG % 1000)
    };
  };

  // Update table row Kg/Box from separate Kg and Grams inputs and recalculate scale weight
  const buildUpdatedRowsWithKpb = (rows, idx, nextKRaw, nextGRaw, parseDecimalK = false) => {
    const updated = [...rows];
    let kStr = nextKRaw;
    let gStr = nextGRaw;

    if (parseDecimalK && String(nextKRaw).includes('.')) {
      const parts = String(nextKRaw).split('.');
      kStr = parts[0] || '0';
      const fracStr = (parts[1] || '').padEnd(3, '0').slice(0, 3);
      gStr = String(parseInt(fracStr, 10) || 0);
    }

    const kNum = Math.max(0, parseFloat(kStr) || 0);
    const gNum = Math.max(0, Math.min(999, parseInt(gStr, 10) || 0));
    const combinedKpb = (kStr === '' && gStr === '') ? '' : Number((kNum + gNum / 1000).toFixed(3));

    updated[idx] = {
      ...updated[idx],
      kgPerBoxKg: kStr,
      kgPerBoxGrams: gStr,
      kgPerBox: combinedKpb
    };

    const bCount = Number(updated[idx].boxes || 0);
    if (bCount > 0 && typeof combinedKpb === 'number' && combinedKpb > 0) {
      const totalWeight = bCount * combinedKpb;
      const wholeKg = Math.floor(totalWeight);
      const remainderGrams = Math.round((totalWeight - wholeKg) * 1000);
      updated[idx].kg = String(wholeKg + Math.floor(remainderGrams / 1000));
      updated[idx].grams = String(remainderGrams % 1000);
    }
    return updated;
  };

  const handleAddLocalLotFromDial = useCallback((lotPayload) => {
    setLocalStockInForm(prev => {
      const activeDate = prev.items[prev.items.length - 1]?.date || new Date().toISOString().slice(0, 16);
      const isFirstItemEmpty = prev.items.length === 1 && (!prev.items[0].menuItemId || !prev.items[0].itemName);
      const newLot = {
        id: Date.now(),
        menuItemId: lotPayload.menuItemId,
        itemName: lotPayload.itemName,
        sizeGrade: lotPayload.sizeGrade,
        sizeBracket: lotPayload.sizeBracket,
        weightOption: lotPayload.weightOption,
        boxes: String(lotPayload.boxes || 0),
        kgPerBox: lotPayload.kgPerBox !== undefined ? Number(lotPayload.kgPerBox) : 1,
        kg: String(lotPayload.kg || 0),
        grams: String(lotPayload.grams || 0),
        ratePerKg: String(lotPayload.ratePerKg || 0),
        date: lotPayload.date || activeDate,
        weighMode: lotPayload.weighMode || 'kg'
      };
      if (isFirstItemEmpty) {
        return { ...prev, items: [newLot] };
      }
      return { ...prev, items: [...prev.items, newLot] };
    });
  }, []);

  const handleAddDamLotFromDial = useCallback((lotPayload) => {
    setDamStockInForm(prev => {
      const activeDate = prev.tallyItems[prev.tallyItems.length - 1]?.date || new Date().toISOString().slice(0, 16);
      const isFirstItemEmpty = prev.tallyItems.length === 1 && (!prev.tallyItems[0].menuItemId || !prev.tallyItems[0].itemName);
      const newLot = {
        id: Date.now(),
        menuItemId: lotPayload.menuItemId,
        itemName: lotPayload.itemName,
        sizeGrade: lotPayload.sizeGrade,
        sizeBracket: lotPayload.sizeBracket,
        weightOption: lotPayload.weightOption,
        boxes: String(lotPayload.boxes || 0),
        kgPerBox: lotPayload.kgPerBox !== undefined ? Number(lotPayload.kgPerBox) : 1,
        kg: String(lotPayload.kg || 0),
        grams: String(lotPayload.grams || 0),
        price: String(lotPayload.ratePerKg || 0),
        date: lotPayload.date || activeDate,
        weighMode: lotPayload.weighMode || 'kg'
      };
      if (isFirstItemEmpty) {
        return { ...prev, tallyItems: [newLot] };
      }
      return { ...prev, tallyItems: [...prev.tallyItems, newLot] };
    });
  }, []);

  // Procurement single quick-form state
  const [procurementForm, setProcurementForm] = useState({
    menuItemId: '',
    grossKgAdded: '',
    purchasePricePerKg: '',
    supplierName: '',
    notes: ''
  });

  // Dedicated Suppliers, Vehicles, Supply Categories & Consumables State
  const [registeredSuppliers, setRegisteredSuppliers] = useState([]);
  const [fleetVehicles, setFleetVehicles] = useState([]);
  const [supplyCategories, setSupplyCategories] = useState([]);
  const [supplyLogs, setSupplyLogs] = useState([]);
  const [suppliesForm, setSuppliesForm] = useState({
    itemName: '',
    category: '',
    supplierId: '',
    supplierName: '',
    supplierPhone: '',
    companyName: '',
    vehicleNumber: '',
    harbor: '',
    quantity: '',
    unit: 'Pcs',
    unitRate: '',
    paidAmount: '',
    paymentMode: 'Cash',
    notes: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [isSubmittingSupply, setIsSubmittingSupply] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Pagination & Filter States
  const [overviewPage, setOverviewPage] = useState(1);
  const OVERVIEW_PER_PAGE = 10;
  const [logsPage, setLogsPage] = useState(1);
  const LOGS_PER_PAGE = 15;
  const [logTypeFilter, setLogTypeFilter] = useState('All');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDateFilterModalOpen, setIsDateFilterModalOpen] = useState(false);
  const [suppliesPage, setSuppliesPage] = useState(1);
  const SUPPLIES_PER_PAGE = 8;
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Stock Ledger (Overview) Database Filters & Validations
  const [overviewSourceFilter, setOverviewSourceFilter] = useState(() => {
    if (dedicatedMode === 'local' || initialSubTab === 'local') return 'local';
    if (dedicatedMode === 'dam' || initialSubTab === 'dam') return 'dam';
    return 'all';
  });
  const [overviewStartDate, setOverviewStartDate] = useState('');
  const [overviewEndDate, setOverviewEndDate] = useState('');
  const [overviewDateError, setOverviewDateError] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useEffect(() => {
    if (currentDedicatedMode === 'local') {
      setOverviewSourceFilter('local');
    } else if (currentDedicatedMode === 'dam') {
      setOverviewSourceFilter('dam');
    }
  }, [currentDedicatedMode]);

  const fetchFilteredFishInventory = useCallback(async (custom = {}) => {
    try {
      let src = custom.source !== undefined ? custom.source : overviewSourceFilter;
      if (currentDedicatedMode === 'local') src = 'local';
      else if (currentDedicatedMode === 'dam') src = 'dam';

      const sDate = custom.startDate !== undefined ? custom.startDate : overviewStartDate;
      const eDate = custom.endDate !== undefined ? custom.endDate : overviewEndDate;
      const q = custom.search !== undefined ? custom.search : searchTerm;

      const params = {};
      if (src && src !== 'all') params.source = src;
      if (sDate) params.startDate = sDate;
      if (eDate) params.endDate = eDate;
      if (q && q.trim()) params.search = q.trim();

      const res = await axios.get(`${getApiUrl()}/inventory`, {
        headers: getAuthHeader(),
        params
      });
      if (Array.isArray(res.data)) {
        const enriched = res.data.map(item => {
          const cat = catalogMenuMapRef.current.get(String(item._id)) ||
                      catalogMenuMapRef.current.get((item.name || '').trim().toLowerCase()) || {};
          return {
            ...item,
            image: item.image || cat.image || '',
            sizeGrades: item.sizeGrades || cat.sizeGrades || null,
            waterType: item.waterType || cat.waterType || 'sea_water'
          };
        });
        setFishList(enriched);
      }
    } catch (err) {
      console.error('Error fetching filtered fish inventory:', err);
    }
  }, [overviewSourceFilter, overviewStartDate, overviewEndDate, searchTerm]);

  const handleSelectSource = (src) => {
    setOverviewSourceFilter(src);
    fetchFilteredFishInventory({ source: src });
    setOverviewPage(1);
  };

  const handleStartDateChange = (val) => {
    if (val && todayStr && val > todayStr) {
      setOverviewDateError('Start Date cannot be in the future');
      setOverviewStartDate(todayStr);
      fetchFilteredFishInventory({ startDate: todayStr });
      return;
    }
    if (val && overviewEndDate && val > overviewEndDate) {
      setOverviewDateError('Start Date cannot be after End Date');
      setOverviewStartDate(val);
      return;
    }
    setOverviewDateError('');
    setOverviewStartDate(val);
    fetchFilteredFishInventory({ startDate: val });
    setOverviewPage(1);
  };

  const handleEndDateChange = (val) => {
    if (val && todayStr && val > todayStr) {
      setOverviewDateError('End Date cannot be in the future');
      setOverviewEndDate(todayStr);
      fetchFilteredFishInventory({ endDate: todayStr });
      return;
    }
    if (val && overviewStartDate && val < overviewStartDate) {
      setOverviewDateError('End Date cannot be before Start Date');
      setOverviewEndDate(val);
      return;
    }
    setOverviewDateError('');
    setOverviewEndDate(val);
    fetchFilteredFishInventory({ endDate: val });
    setOverviewPage(1);
  };

  const handleClearOverviewFilters = () => {
    setOverviewSourceFilter('all');
    setOverviewStartDate('');
    setOverviewEndDate('');
    setOverviewDateError('');
    setSearchTerm('');
    fetchFilteredFishInventory({ source: 'all', startDate: '', endDate: '', search: '' });
  };

  const isOverviewFilterActive = overviewSourceFilter !== 'all' || Boolean(overviewStartDate) || Boolean(overviewEndDate) || Boolean(searchTerm);

  // Helper to extract true Date & Time from log (handling ObjectId timestamp fallback)
  const formatLogDateTime = (log) => {
    let d = null;
    if (log.createdAt) {
      const candidate = new Date(log.createdAt);
      if (!isNaN(candidate.getTime())) d = candidate;
    }
    if (!d && log.date) {
      const candidate = new Date(log.date);
      if (!isNaN(candidate.getTime())) d = candidate;
    }
    if (!d && log.timestamp) {
      const candidate = new Date(log.timestamp);
      if (!isNaN(candidate.getTime())) d = candidate;
    }
    if (!d && log._id && typeof log._id === 'string' && log._id.length >= 8) {
      try {
        const ts = parseInt(log._id.substring(0, 8), 16) * 1000;
        const candidate = new Date(ts);
        if (!isNaN(candidate.getTime()) && candidate.getFullYear() > 2020 && candidate.getFullYear() < 2100) {
          d = candidate;
        }
      } catch (e) {}
    }
    if (!d) d = new Date();

    const dateStr = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return { dateStr, timeStr };
  };

  const getAuthHeader = () => {
    const token = localStorage.getItem('token') || localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      const [invRes, logsRes, crmRes, suppliersData, categoriesData, supplyLogsData, vehiclesData, menuCatalog] = await Promise.all([
        axios.get(`${getApiUrl()}/inventory`, { headers: getAuthHeader() }),
        axios.get(`${getApiUrl()}/inventory/logs`, { headers: getAuthHeader(), params: { limit: 200 } }),
        axios.get(`${getApiUrl()}/customers`, { headers: getAuthHeader() }).catch(() => ({ data: [] })),
        getSuppliers().catch(() => []),
        getSupplyCategories().catch(() => []),
        getSupplyLogs().catch(() => []),
        getVehicles().catch(() => []),
        getMenuItems().catch(() => [])
      ]);

      if (Array.isArray(menuCatalog)) {
        menuCatalog.forEach(m => {
          if (m && m._id) catalogMenuMapRef.current.set(String(m._id), m);
          if (m && m.name) catalogMenuMapRef.current.set(m.name.trim().toLowerCase(), m);
        });
      }

      const enrichItems = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map(item => {
          const cat = catalogMenuMapRef.current.get(String(item._id)) ||
                      catalogMenuMapRef.current.get((item.name || '').trim().toLowerCase()) || {};
          return {
            ...item,
            image: item.image || cat.image || '',
            sizeGrades: item.sizeGrades || cat.sizeGrades || null,
            waterType: item.waterType || cat.waterType || 'sea_water'
          };
        });
      };

      if (Array.isArray(invRes.data)) {
        const enriched = enrichItems(invRes.data);
        setFishList(enriched);
        setMasterFishList(enriched);
      }
      const rawLogs = Array.isArray(logsRes.data) ? logsRes.data : (logsRes.data?.data || []);
      setStockLogs(rawLogs);
      if (Array.isArray(crmRes.data)) setCrmCustomers(crmRes.data);
      if (Array.isArray(suppliersData)) setRegisteredSuppliers(suppliersData);
      if (Array.isArray(categoriesData)) setSupplyCategories(categoriesData);
      if (Array.isArray(supplyLogsData)) setSupplyLogs(supplyLogsData);
      if (Array.isArray(vehiclesData)) setFleetVehicles(vehiclesData);
    } catch (err) {
      console.error('Error fetching inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();

    const unsubStock = realtimeService.subscribe('fishStockUpdated', () => {
      fetchInventoryData();
    });
    const unsubBill = realtimeService.subscribe('billSettled', () => {
      fetchInventoryData();
    });

    return () => {
      if (unsubStock) unsubStock();
      if (unsubBill) unsubBill();
    };
  }, []);

  // Filter & Pagination for Overview
  const filteredFish = useMemo(() => {
    return fishList.filter(f => 
      f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.scientificName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fishList, searchTerm]);

  const totalOverviewPages = Math.ceil(filteredFish.length / OVERVIEW_PER_PAGE) || 1;
  const paginatedFish = useMemo(() => {
    const start = (overviewPage - 1) * OVERVIEW_PER_PAGE;
    return filteredFish.slice(start, start + OVERVIEW_PER_PAGE);
  }, [filteredFish, overviewPage]);

  // Formatted Dropdown Options for SearchableDropdown
  const fishOptions = useMemo(() => {
    const sourceList = (masterFishList && masterFishList.length > 0) ? masterFishList : fishList;
    return (sourceList || []).map((f) => ({
      value: f._id,
      label: f.name,
      badge: `Stock: ${f.stock || 0}kg`,
      badgeColor: (f.stock || 0) > 0 ? 'emerald' : 'slate',
      price: f.purchasePrice,
      raw: f
    }));
  }, [masterFishList, fishList]);

  // Extract Small / Medium / Big Size Grades & Backend Weight Ranges for any fish
  const getFishGradeOptions = useCallback((fish) => {
    if (!fish) return [];
    const grades = fish.sizeGrades;
    if (!grades) {
      return [
        { key: 'small', label: 'Small', range: '0 - 1 Kg', rate: fish.purchasePrice || '' },
        { key: 'medium', label: 'Medium', range: '1 - 4 Kg', rate: fish.purchasePrice || '' },
        { key: 'big', label: 'Big', range: '4+ Kg', rate: fish.purchasePrice || '' }
      ];
    }

    const isSmallOn = grades.small?.enabled !== false;
    const isMediumOn = grades.medium?.enabled !== false;
    const isBigOn = grades.big?.enabled !== false;

    const smallMax = parseFloat(grades.small?.maxKg) || 1;
    const mediumMax = parseFloat(grades.medium?.maxKg) || 4;

    const list = [];
    if (isSmallOn) {
      list.push({
        key: 'small',
        label: 'Small',
        range: `0 - ${smallMax} Kg`,
        rate: grades.small?.purchasePrice || grades.small?.wholesalePrice || grades.small?.price || fish.purchasePrice || ''
      });
    }
    if (isMediumOn) {
      list.push({
        key: 'medium',
        label: 'Medium',
        range: `${smallMax} - ${mediumMax} Kg`,
        rate: grades.medium?.purchasePrice || grades.medium?.wholesalePrice || grades.medium?.price || fish.purchasePrice || ''
      });
    }
    if (isBigOn) {
      list.push({
        key: 'big',
        label: 'Big',
        range: `${mediumMax}+ Kg`,
        rate: grades.big?.purchasePrice || grades.big?.wholesalePrice || grades.big?.price || fish.purchasePrice || ''
      });
    }
    return list.length > 0 ? list : [
      { key: 'medium', label: 'Medium', range: 'Standard', rate: fish.purchasePrice || '' }
    ];
  }, []);

  const localSupplierOptions = useMemo(() => {
    const regList = (registeredSuppliers || [])
      .filter(s => s.supplierType === 'Local' || s.supplierType === 'All' || !s.supplierType)
      .map(s => {
        const assignedVeh = (fleetVehicles || []).find(v => 
          (v.assignedSupplierId && String(v.assignedSupplierId) === String(s._id)) ||
          (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === s.name?.toLowerCase())
        );
        const resolvedVehicle = s.vehicleNumber || assignedVeh?.vehicleNumber || '';
        const parts = [
          s.companyName,
          s.phone ? `Ph: ${s.phone}` : '',
          resolvedVehicle ? `Veh: ${resolvedVehicle}` : '',
          s.harbor ? `Harbor: ${s.harbor}` : (s.city ? `City: ${s.city}` : '')
        ].filter(Boolean);
        return {
          value: s.name,
          label: s.name,
          subtitle: parts.join(' | '),
          badge: 'Registered',
          badgeColor: 'orange',
          raw: {
            ...s,
            vehicleNumber: resolvedVehicle
          }
        };
      });

    const crmList = (crmCustomers || []).map(c => ({
      value: c.name,
      label: c.name,
      subtitle: c.phone ? `Ph: ${c.phone} (CRM Customer)` : 'CRM Customer',
      badge: 'CRM',
      badgeColor: 'amber',
      raw: c
    }));

    const map = new Map();
    [...regList, ...crmList].forEach(item => {
      if (item.value && !map.has(item.value.toLowerCase())) {
        map.set(item.value.toLowerCase(), item);
      }
    });
    return Array.from(map.values());
  }, [registeredSuppliers, crmCustomers, fleetVehicles]);

  const damContractorOptions = useMemo(() => {
    const regList = (registeredSuppliers || [])
      .filter(s => s.supplierType === 'DAM' || s.supplierType === 'All')
      .map(s => {
        const assignedVeh = (fleetVehicles || []).find(v => 
          (v.assignedSupplierId && String(v.assignedSupplierId) === String(s._id)) ||
          (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === s.name?.toLowerCase())
        );
        const resolvedVehicle = s.vehicleNumber || assignedVeh?.vehicleNumber || '';
        const parts = [
          s.companyName,
          s.phone ? `Ph: ${s.phone}` : '',
          resolvedVehicle ? `Veh: ${resolvedVehicle}` : '',
          s.harbor ? `Loc: ${s.harbor}` : (s.city ? `City: ${s.city}` : '')
        ].filter(Boolean);
        return {
          value: s.name,
          label: s.name,
          subtitle: parts.join(' | '),
          badge: 'DAM',
          badgeColor: 'blue',
          raw: {
            ...s,
            vehicleNumber: resolvedVehicle
          }
        };
      });

    const crmList = (crmCustomers || [])
      .filter(c => c.category === 'Export' || c.category === 'Wholesale' || c.exportSubCategory === 'DAM')
      .map(c => ({
        value: c.name,
        label: c.name,
        subtitle: c.phone ? `Ph: ${c.phone} (Wholesale/Dam)` : 'Wholesale/Dam',
        badge: 'CRM',
        badgeColor: 'slate',
        raw: c
      }));

    const map = new Map();
    [...regList, ...crmList].forEach(item => {
      if (item.value && !map.has(item.value.toLowerCase())) {
        map.set(item.value.toLowerCase(), item);
      }
    });
    return Array.from(map.values());
  }, [registeredSuppliers, crmCustomers, fleetVehicles]);

  const suppliesSupplierOptions = useMemo(() => {
    return (registeredSuppliers || [])
      .filter(s => s.supplierType === 'Consumables' || s.supplierType === 'All' || !s.supplierType)
      .map(s => {
        const assignedVeh = (fleetVehicles || []).find(v => 
          (v.assignedSupplierId && String(v.assignedSupplierId) === String(s._id)) ||
          (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === s.name?.toLowerCase())
        );
        const resolvedVehicle = s.vehicleNumber || assignedVeh?.vehicleNumber || '';
        const parts = [
          s.companyName,
          s.phone ? `Ph: ${s.phone}` : '',
          resolvedVehicle ? `Veh: ${resolvedVehicle}` : ''
        ].filter(Boolean);
        return {
          value: s.name,
          label: s.name,
          subtitle: parts.join(' | '),
          badge: 'Supplies',
          badgeColor: 'emerald',
          raw: {
            ...s,
            vehicleNumber: resolvedVehicle
          }
        };
      });
  }, [registeredSuppliers, fleetVehicles]);

  // Contextual Vehicle Options for 3 Stock-In Modes
  const localVehicleOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Fleet Vehicles matching Local Catch or All
    (fleetVehicles || []).forEach(v => {
      const vNum = (v.vehicleNumber || '').toUpperCase().trim();
      if (!vNum || seen.has(vNum)) return;
      const mode = v.operationalMode || 'All';
      if (mode === 'All' || mode === 'Local Catch') {
        seen.add(vNum);
        const sub = [
          v.assignedSupplierName ? `Assigned to: ${v.assignedSupplierName}` : 'Status: Free / Unassigned',
          v.driverName ? `Driver: ${v.driverName}` : '',
          v.driverPhone ? `Ph: ${v.driverPhone}` : ''
        ].filter(Boolean).join(' | ');
        list.push({
          value: vNum,
          label: `${vNum} (${v.vehicleName || v.vehicleType || 'Fleet'})`,
          subtitle: sub,
          badge: v.assignedSupplierName ? `Taken: ${v.assignedSupplierName}` : (v.status || 'Available'),
          badgeColor: v.assignedSupplierName ? 'amber' : (v.status === 'Available' ? 'emerald' : 'blue'),
          raw: {
            vehicleNumber: vNum,
            vehicleName: v.vehicleName,
            driverName: v.driverName,
            driverPhone: v.driverPhone,
            supplierName: v.assignedSupplierName || '',
            companyName: v.assignedSupplierName || v.vehicleName || '',
            harbor: ''
          }
        });
      }
    });

    // 2. Vehicles from Registered Local Suppliers
    (registeredSuppliers || []).forEach(s => {
      const vNum = (s.vehicleNumber || '').toUpperCase().trim();
      if (!vNum || seen.has(vNum)) return;
      const type = s.supplierType || 'Local';
      if (type === 'Local' || type === 'All') {
        seen.add(vNum);
        const sub = [
          s.companyName,
          s.phone ? `Ph: ${s.phone}` : '',
          s.harbor ? `Harbor: ${s.harbor}` : (s.city ? `City: ${s.city}` : '')
        ].filter(Boolean).join(' | ');
        list.push({
          value: vNum,
          label: `${vNum} (${s.name})`,
          subtitle: sub,
          badge: 'Supplier',
          badgeColor: 'orange',
          raw: {
            vehicleNumber: vNum,
            vehicleName: '',
            driverName: '',
            driverPhone: s.phone || '',
            supplierName: s.name,
            companyName: s.companyName || '',
            harbor: s.harbor || s.city || ''
          }
        });
      }
    });

    return list;
  }, [fleetVehicles, registeredSuppliers]);

  const damVehicleOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Fleet Vehicles matching DAM Consignments or All
    (fleetVehicles || []).forEach(v => {
      const vNum = (v.vehicleNumber || '').toUpperCase().trim();
      if (!vNum || seen.has(vNum)) return;
      const mode = v.operationalMode || 'All';
      if (mode === 'All' || mode === 'DAM Consignments') {
        seen.add(vNum);
        const sub = [
          v.assignedSupplierName ? `Assigned to: ${v.assignedSupplierName}` : 'Status: Free / Unassigned',
          v.driverName ? `Driver: ${v.driverName}` : '',
          v.driverPhone ? `Ph: ${v.driverPhone}` : ''
        ].filter(Boolean).join(' | ');
        list.push({
          value: vNum,
          label: `${vNum} (${v.vehicleName || v.vehicleType || 'Fleet'})`,
          subtitle: sub,
          badge: v.assignedSupplierName ? `Taken: ${v.assignedSupplierName}` : (v.status || 'Available'),
          badgeColor: v.assignedSupplierName ? 'amber' : (v.status === 'Available' ? 'emerald' : 'blue'),
          raw: {
            vehicleNumber: vNum,
            vehicleName: v.vehicleName,
            driverName: v.driverName,
            driverPhone: v.driverPhone,
            contractorName: v.assignedSupplierName || '',
            supplierName: v.assignedSupplierName || '',
            companyName: v.assignedSupplierName || v.vehicleName || '',
            harbor: ''
          }
        });
      }
    });

    // 2. Vehicles from Registered DAM Contractors
    (registeredSuppliers || []).forEach(s => {
      const vNum = (s.vehicleNumber || '').toUpperCase().trim();
      if (!vNum || seen.has(vNum)) return;
      if (s.supplierType === 'DAM' || s.supplierType === 'All') {
        seen.add(vNum);
        const sub = [
          s.companyName,
          s.phone ? `Ph: ${s.phone}` : '',
          s.harbor ? `Loc: ${s.harbor}` : (s.city ? `City: ${s.city}` : '')
        ].filter(Boolean).join(' | ');
        list.push({
          value: vNum,
          label: `${vNum} (${s.name})`,
          subtitle: sub,
          badge: 'DAM',
          badgeColor: 'blue',
          raw: {
            vehicleNumber: vNum,
            vehicleName: '',
            driverName: '',
            driverPhone: s.phone || '',
            contractorName: s.name,
            supplierName: s.name,
            companyName: s.companyName || '',
            harbor: s.harbor || s.city || ''
          }
        });
      }
    });

    return list;
  }, [fleetVehicles, registeredSuppliers]);

  const suppliesVehicleOptions = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Fleet Vehicles matching Supplies & Packaging or All
    (fleetVehicles || []).forEach(v => {
      const vNum = (v.vehicleNumber || '').toUpperCase().trim();
      if (!vNum || seen.has(vNum)) return;
      const mode = v.operationalMode || 'All';
      if (mode === 'All' || mode === 'Supplies & Packaging') {
        seen.add(vNum);
        const sub = [
          v.assignedSupplierName ? `Assigned to: ${v.assignedSupplierName}` : 'Status: Free / Unassigned',
          v.driverName ? `Driver: ${v.driverName}` : '',
          v.driverPhone ? `Ph: ${v.driverPhone}` : ''
        ].filter(Boolean).join(' | ');
        list.push({
          value: vNum,
          label: `${vNum} (${v.vehicleName || v.vehicleType || 'Fleet'})`,
          subtitle: sub,
          badge: v.assignedSupplierName ? `Taken: ${v.assignedSupplierName}` : (v.status || 'Available'),
          badgeColor: v.assignedSupplierName ? 'amber' : (v.status === 'Available' ? 'emerald' : 'blue'),
          raw: {
            vehicleNumber: vNum,
            vehicleName: v.vehicleName,
            driverName: v.driverName,
            driverPhone: v.driverPhone,
            supplierName: v.assignedSupplierName || '',
            companyName: v.assignedSupplierName || v.vehicleName || '',
            harbor: ''
          }
        });
      }
    });

    // 2. Vehicles from Registered Consumables/Supplies Vendors
    (registeredSuppliers || []).forEach(s => {
      const vNum = (s.vehicleNumber || '').toUpperCase().trim();
      if (!vNum || seen.has(vNum)) return;
      if (s.supplierType === 'Consumables' || s.supplierType === 'All' || !s.supplierType) {
        seen.add(vNum);
        const sub = [
          s.companyName,
          s.phone ? `Ph: ${s.phone}` : '',
          s.city ? `City: ${s.city}` : ''
        ].filter(Boolean).join(' | ');
        list.push({
          value: vNum,
          label: `${vNum} (${s.name})`,
          subtitle: sub,
          badge: 'Packaging',
          badgeColor: 'emerald',
          raw: {
            vehicleNumber: vNum,
            vehicleName: '',
            driverName: '',
            driverPhone: s.phone || '',
            supplierName: s.name,
            companyName: s.companyName || '',
            harbor: s.city || s.harbor || ''
          }
        });
      }
    });

    return list;
  }, [fleetVehicles, registeredSuppliers]);

  // Local Stock-In Supplier Card Selection States & Handlers
  const [localSupplierSearch, setLocalSupplierSearch] = useState('');
  const [isLocalManualDetailsOpen, setIsLocalManualDetailsOpen] = useState(false);

  const filteredLocalSuppliers = useMemo(() => {
    const query = localSupplierSearch.trim().toLowerCase();
    const localOnly = (registeredSuppliers || []).filter(s => {
      const type = (s.supplierType || '').toLowerCase();
      return !type || type === 'local' || type === 'all';
    });
    const pool = localOnly.length > 0 ? localOnly : (registeredSuppliers || []);
    if (!query) return pool;
    return pool.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.companyName || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.vehicleNumber || '').toLowerCase().includes(query) ||
      (s.harbor || s.city || '').toLowerCase().includes(query)
    );
  }, [registeredSuppliers, localSupplierSearch]);

  const handleSelectLocalSupplierCard = (supp) => {
    const assignedVeh = (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supp._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supp.name?.toLowerCase()) ||
      (supp.vehicleNumber && v.vehicleNumber?.toUpperCase() === supp.vehicleNumber.toUpperCase())
    );
    setLocalStockInForm(prev => ({
      ...prev,
      supplierId: supp._id,
      supplierName: supp.name || '',
      supplierPhone: supp.phone || assignedVeh?.driverPhone || prev.supplierPhone,
      companyName: supp.companyName || prev.companyName,
      vehicleNumber: supp.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
      harbor: supp.harbor || supp.city || prev.harbor
    }));
  };

  const handleClearLocalSupplier = () => {
    setLocalStockInForm(prev => ({
      ...prev,
      supplierId: '',
      supplierName: '',
      supplierPhone: '',
      companyName: '',
      vehicleNumber: '',
      harbor: ''
    }));
  };

  // DAM Stock-In Contractor Card Selection States & Handlers
  const [damSupplierSearch, setDamSupplierSearch] = useState('');
  const [isDamManualDetailsOpen, setIsDamManualDetailsOpen] = useState(false);

  const filteredDamContractors = useMemo(() => {
    const query = damSupplierSearch.trim().toLowerCase();
    const damOnly = (registeredSuppliers || []).filter(s => {
      const type = (s.supplierType || '').toUpperCase();
      return type === 'DAM' || type === 'ALL';
    });
    const pool = damOnly.length > 0 ? damOnly : (registeredSuppliers || []);
    if (!query) return pool;
    return pool.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.companyName || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.vehicleNumber || '').toLowerCase().includes(query) ||
      (s.harbor || s.city || '').toLowerCase().includes(query)
    );
  }, [registeredSuppliers, damSupplierSearch]);

  const handleSelectDamContractorCard = (supp) => {
    const assignedVeh = (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supp._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supp.name?.toLowerCase()) ||
      (supp.vehicleNumber && v.vehicleNumber?.toUpperCase() === supp.vehicleNumber.toUpperCase())
    );
    setDamStockInForm(prev => ({
      ...prev,
      contractorId: supp._id,
      contractorName: supp.name || '',
      contractorPhone: supp.phone || assignedVeh?.driverPhone || prev.contractorPhone,
      companyName: supp.companyName || prev.companyName,
      vehicleNumber: supp.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
      harbor: supp.harbor || supp.city || prev.harbor,
      contractorCity: supp.city || prev.contractorCity
    }));
  };

  const handleClearDamContractor = () => {
    setDamStockInForm(prev => ({
      ...prev,
      contractorId: '',
      contractorName: '',
      contractorPhone: '',
      companyName: '',
      vehicleNumber: '',
      harbor: '',
      contractorCity: ''
    }));
  };

  // Supplies & Packaging Vendor Card Selection States & Handlers
  const [suppliesVendorSearch, setSuppliesVendorSearch] = useState('');
  const [isSuppliesManualDetailsOpen, setIsSuppliesManualDetailsOpen] = useState(false);

  const filteredSuppliesVendors = useMemo(() => {
    const query = suppliesVendorSearch.trim().toLowerCase();
    const suppliesOnly = (registeredSuppliers || []).filter(s => {
      const type = (s.supplierType || '').toLowerCase();
      return type === 'consumables' || type === 'supplies' || type === 'all' || !type;
    });
    const pool = suppliesOnly.length > 0 ? suppliesOnly : (registeredSuppliers || []);
    if (!query) return pool;
    return pool.filter(s =>
      (s.name || '').toLowerCase().includes(query) ||
      (s.companyName || '').toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.vehicleNumber || '').toLowerCase().includes(query) ||
      (s.harbor || s.city || '').toLowerCase().includes(query)
    );
  }, [registeredSuppliers, suppliesVendorSearch]);

  const handleSelectSuppliesVendorCard = (supp) => {
    const assignedVeh = (fleetVehicles || []).find(v =>
      (v.assignedSupplierId && String(v.assignedSupplierId) === String(supp._id)) ||
      (v.assignedSupplierName && v.assignedSupplierName.toLowerCase() === supp.name?.toLowerCase()) ||
      (supp.vehicleNumber && v.vehicleNumber?.toUpperCase() === supp.vehicleNumber.toUpperCase())
    );
    setSuppliesForm(prev => ({
      ...prev,
      supplierId: supp._id,
      supplierName: supp.name || '',
      supplierPhone: supp.phone || assignedVeh?.driverPhone || prev.supplierPhone,
      companyName: supp.companyName || prev.companyName,
      vehicleNumber: supp.vehicleNumber || assignedVeh?.vehicleNumber || prev.vehicleNumber,
      harbor: supp.harbor || supp.city || prev.harbor
    }));
  };

  const handleClearSuppliesVendor = () => {
    setSuppliesForm(prev => ({
      ...prev,
      supplierId: '',
      supplierName: '',
      supplierPhone: '',
      companyName: '',
      vehicleNumber: '',
      harbor: ''
    }));
  };

  // Filter & Pagination for Audit Trail Logs
  const filteredStockLogs = useMemo(() => {
    return stockLogs.filter(log => {
      // 0. Strict Dedicated Mode Isolation (Never combine Local vs Dam)
      const isDamLog = log.intakeMode === 'dam' || log.type?.includes('Dam') || log.notes?.toLowerCase()?.includes('dam') || log.notes?.toLowerCase()?.includes('contractor') || (typeof log.invoiceNo === 'string' && log.invoiceNo.startsWith('DAM-'));
      const isLocalLog = (!isDamLog) && (log.type?.includes('Procurement') || log.type?.includes('Stock-In') || log.intakeMode === 'local' || (typeof log.invoiceNo === 'string' && log.invoiceNo.startsWith('LOC-')));

      if (currentDedicatedMode === 'local') {
        if (!isLocalLog) return false;
        // Strictly Stock-In only for Local Harbor Catch module (no POS sale, online sale, or refunds)
        const isStockIn = log.type?.includes('Procurement') || log.type?.includes('Stock-In');
        if (!isStockIn) return false;
      } else if (currentDedicatedMode === 'dam') {
        if (!isDamLog) return false;
        // Strictly Stock-In only for Dam Consignment module (no POS sale, online sale, or refunds)
        const isStockIn = log.type?.includes('Procurement') || log.type?.includes('Stock-In') || log.type?.includes('Dam');
        if (!isStockIn) return false;
      } else if (currentDedicatedMode === 'supplies') {
        const isSupplyLog = log.type?.includes('Supply') || log.intakeMode === 'supplies';
        if (!isSupplyLog) return false;
      } else {
        // 1. Transaction Type Filter (Applies strictly to Master Ledger only)
        let matchesType = true;
        if (logTypeFilter !== 'All') {
          if (logTypeFilter === 'Stock-In') {
            matchesType = log.type?.includes('Procurement') || log.type?.includes('Stock-In');
          } else if (logTypeFilter === 'POS Sale') {
            matchesType = log.type === 'POS Sale';
          } else if (logTypeFilter === 'Online Sale') {
            matchesType = log.type === 'Online Sale';
          } else if (logTypeFilter === 'Refund') {
            matchesType = log.type?.includes('Refund') || log.type?.includes('Reversal');
          } else {
            matchesType = log.type === logTypeFilter;
          }
        }
        if (!matchesType) return false;
      }

      // 2. Date Range Filter with robust timestamp resolution
      if (startDate || endDate) {
        let logTs = null;
        if (log.createdAt) logTs = new Date(log.createdAt).getTime();
        else if (log.date) logTs = new Date(log.date).getTime();
        else if (log.timestamp) logTs = new Date(log.timestamp).getTime();
        else if (log._id && typeof log._id === 'string' && log._id.length >= 8) {
          try {
            logTs = parseInt(log._id.substring(0, 8), 16) * 1000;
          } catch (e) {}
        }

        if (logTs) {
          if (startDate) {
            const startTs = new Date(`${startDate}T00:00:00`).getTime();
            if (logTs < startTs) return false;
          }
          if (endDate) {
            const endTs = new Date(`${endDate}T23:59:59.999`).getTime();
            if (logTs > endTs) return false;
          }
        }
      }

      // 3. Search Query Filter
      const q = logSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        log.itemName?.toLowerCase().includes(q) ||
        log.billNumber?.toLowerCase().includes(q) ||
        log.supplierName?.toLowerCase().includes(q) ||
        log.performedBy?.toLowerCase().includes(q) ||
        log.invoiceNo?.toLowerCase().includes(q)
      );
    });
  }, [stockLogs, logTypeFilter, logSearchQuery, startDate, endDate]);

  // Group Multi-Variety Stock-In Consignments by invoiceNo or supplier+timestamp
  const groupedStockLogs = useMemo(() => {
    const groups = [];
    const processedIds = new Set();

    for (let i = 0; i < filteredStockLogs.length; i++) {
      const log = filteredStockLogs[i];
      if (processedIds.has(log._id)) continue;

      const isInward = log.type?.includes('Procurement') || log.type?.includes('Stock-In');
      if (!isInward) {
        // POS Sale, Online Sale, Refund, Wastage -> standard individual row
        groups.push({
          isGroup: false,
          primaryLog: log,
          items: [log]
        });
        processedIds.add(log._id);
        continue;
      }

      // Stock-In: Find all sibling logs from the same consignment lot
      const logTime = new Date(log.createdAt || log.date).getTime();
      const siblings = filteredStockLogs.filter(l => {
        if (processedIds.has(l._id)) return false;
        const lIsInward = l.type?.includes('Procurement') || l.type?.includes('Stock-In');
        if (!lIsInward) return false;

        if (log.invoiceNo && l.invoiceNo) {
          return log.invoiceNo === l.invoiceNo;
        }

        // Fallback: Same supplier and within 3 minutes
        if (log.supplierName && l.supplierName && log.supplierName === l.supplierName) {
          const lTime = new Date(l.createdAt || l.date).getTime();
          return Math.abs(lTime - logTime) <= 3 * 60 * 1000;
        }

        return false;
      });

      siblings.forEach(s => processedIds.add(s._id));

      const totalGroupQty = siblings.reduce((sum, s) => sum + Math.abs(Number(s.quantityChange || 0)), 0);
      const totalGroupBoxes = siblings.reduce((sum, s) => sum + Number(s.boxes || 0), 0);

      groups.push({
        isGroup: siblings.length > 1,
        primaryLog: log,
        items: siblings,
        totalQuantityChange: totalGroupQty,
        totalBoxes: totalGroupBoxes,
        invoiceNo: log.invoiceNo || siblings.find(s => s.invoiceNo)?.invoiceNo || ''
      });
    }

    return groups;
  }, [filteredStockLogs]);

  const totalLogsPages = Math.ceil(groupedStockLogs.length / LOGS_PER_PAGE) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * LOGS_PER_PAGE;
    return groupedStockLogs.slice(start, start + LOGS_PER_PAGE);
  }, [groupedStockLogs, logsPage]);

  // Supplies Intake Logs Pagination
  const totalSuppliesPages = Math.ceil(supplyLogs.length / SUPPLIES_PER_PAGE) || 1;
  const paginatedSupplyLogs = useMemo(() => {
    const start = (suppliesPage - 1) * SUPPLIES_PER_PAGE;
    return supplyLogs.slice(start, start + SUPPLIES_PER_PAGE);
  }, [supplyLogs, suppliesPage]);

  useEffect(() => {
    setOverviewPage(1);
  }, [searchTerm]);

  useEffect(() => {
    setLogsPage(1);
  }, [logTypeFilter, logSearchQuery, startDate, endDate]);

  // ── Multi-Bill Combine & Invoice Generation Handlers ──
  const handleToggleSelectBill = (entry) => {
    const key = entry.invoiceNo || entry.primaryLog?._id;
    if (!key) return;

    const entrySupplier = (entry.primaryLog?.supplierName || '').trim();

    if (selectedBillKeys.includes(key)) {
      setSelectedBillKeys(prev => prev.filter(k => k !== key));
      return;
    }

    // Check if previously selected bills belong to a different supplier
    const activeSelectedEntry = groupedStockLogs.find(g => selectedBillKeys.includes(g.invoiceNo || g.primaryLog?._id));
    const activeSupplier = (activeSelectedEntry?.primaryLog?.supplierName || '').trim();

    if (activeSupplier && entrySupplier && activeSupplier.toLowerCase() !== entrySupplier.toLowerCase()) {
      setMessage({
        text: `Only bills from the same supplier ("${activeSupplier}") can be combined. Clear current selection to choose "${entrySupplier}".`,
        type: 'error'
      });
      return;
    }

    setSelectedBillKeys(prev => [...prev, key]);
  };

  const selectedGroupEntries = useMemo(() => {
    if (selectedBillKeys.length === 0) return [];
    return groupedStockLogs.filter(entry => {
      const key = entry.invoiceNo || entry.primaryLog?._id;
      return selectedBillKeys.includes(key);
    });
  }, [groupedStockLogs, selectedBillKeys]);

  const selectedSupplierName = selectedGroupEntries[0]?.primaryLog?.supplierName || '';

  const selectedCombinedMetrics = useMemo(() => {
    let totalKg = 0;
    let totalBoxes = 0;
    let grossValue = 0;
    let allDates = [];

    selectedGroupEntries.forEach(entry => {
      totalKg += Number(entry.totalQuantityChange || Math.abs(Number(entry.primaryLog?.quantityChange || 0)));
      totalBoxes += Number(entry.totalBoxes || entry.primaryLog?.boxes || 0);

      const log = entry.primaryLog || {};
      let gVal = Number(log.grossValue || 0);
      if (!gVal) {
        (entry.items || []).forEach(it => {
          const itKg = Math.abs(Number(it.quantityChange || 0));
          const itRate = Number(it.price || it.rate || 0);
          gVal += itKg * itRate;
        });
      }
      grossValue += gVal;

      const dt = formatLogDateTime(log);
      if (dt.dateStr) allDates.push(dt.dateStr);
    });

    const uniqueDates = [...new Set(allDates)];
    const datePeriod = uniqueDates.length > 1
      ? `${uniqueDates[uniqueDates.length - 1]} → ${uniqueDates[0]}`
      : (uniqueDates[0] || '');

    return { totalKg, totalBoxes, grossValue, datePeriod };
  }, [selectedGroupEntries]);

  const handleCombineSelectedBillsInvoice = () => {
    if (selectedGroupEntries.length === 0) return;

    let combinedItems = [];
    let allDates = [];
    let totalBoxes = 0;
    let totalKg = 0;
    let grossValue = 0;

    let combinedSettlements = {
      advance: { label: '1) Advance', type: 'Dr', amount: 0 },
      khata: { label: '2) Khata', type: 'Dr', amount: 0 },
      od: { label: '3) OD / Transport', type: 'Cr', amount: 0 },
      expense: { label: '4) Depot Expense', type: 'Dr', amount: 0 },
      festivalExpense: { label: '5) Other Expense', type: 'Dr', amount: 0 }
    };
    let combinedCustomSettlements = [];
    let totalCr = 0;
    let totalDr = 0;

    // Sort entries chronologically (oldest to newest)
    const sortedEntries = [...selectedGroupEntries].sort((a, b) => {
      const ta = new Date(a.primaryLog?.createdAt || a.primaryLog?.date || 0).getTime();
      const tb = new Date(b.primaryLog?.createdAt || b.primaryLog?.date || 0).getTime();
      return ta - tb;
    });

    sortedEntries.forEach(entry => {
      const log = entry.primaryLog || {};
      const dt = formatLogDateTime(log);
      if (dt.dateStr) allDates.push(dt.dateStr);

      if (log.consignmentItems && Array.isArray(log.consignmentItems) && log.consignmentItems.length > 0) {
        log.consignmentItems.forEach(item => {
          const kg = Number(item.kg || 0) + Number(item.grams || 0) / 1000 || (Number(item.boxes || 0) * Number(item.kgPerBox || 0));
          const rate = Number(item.price || item.rate || item.ratePerKg || 0);
          const b = Number(item.boxes || 0);
          totalBoxes += b;
          totalKg += kg;
          grossValue += (kg * rate);
          combinedItems.push({
            itemName: item.itemName || item.name || 'Fish Variety',
            grade: item.sizeBracket && item.weightOption ? `${item.sizeBracket} (${item.weightOption})` : (item.grade || 'Grade A (1 - 4 Kg)'),
            boxes: b || '—',
            kgPerBox: item.kgPerBox || '—',
            kg: kg,
            rate: rate,
            price: rate,
            date: dt.dateStr,
            time: dt.timeStr,
            billNo: entry.invoiceNo || log.billNumber || 'CONSIGNMENT'
          });
        });
      } else {
        (entry.items || []).forEach(l => {
          const qty = Math.abs(Number(l.quantityChange || 0));
          let rate = Number(l.price || l.rate || 0);
          let boxes = Number(l.boxes || 0);
          let kgPerBox = l.kgPerBox;
          if (!rate && l.notes) {
            const m = l.notes.match(/@\s*₹?\s*([0-9.]+)\/kg/i);
            if (m && m[1]) rate = Number(m[1]);
          }
          if (!boxes && l.notes) {
            const bMatch = l.notes.match(/(\d+)\s*boxes/i);
            if (bMatch && bMatch[1]) boxes = Number(bMatch[1]);
          }
          totalBoxes += boxes;
          totalKg += qty;
          grossValue += (qty * rate);
          combinedItems.push({
            itemName: l.itemName,
            grade: l.grade && l.grade !== 'Standard' ? l.grade : 'Grade A (1 - 4 Kg)',
            boxes: boxes || '—',
            kgPerBox: kgPerBox || '—',
            kg: qty,
            rate: rate,
            price: rate,
            date: dt.dateStr,
            time: dt.timeStr,
            billNo: entry.invoiceNo || l.billNumber || 'CONSIGNMENT'
          });
        });
      }

      if (log.settlements) {
        Object.entries(log.settlements).forEach(([key, val]) => {
          if (combinedSettlements[key]) {
            combinedSettlements[key].amount += Number(val.amount || 0);
          }
        });
      }
      if (log.customSettlements && Array.isArray(log.customSettlements)) {
        combinedCustomSettlements.push(...log.customSettlements);
      }
      totalCr += Number(log.totalCr || 0);
      totalDr += Number(log.totalDr || 0);
    });

    const netPayable = grossValue + totalCr - totalDr;
    const firstLog = sortedEntries[0]?.primaryLog || {};
    const isDam = firstLog.intakeMode === 'dam' || firstLog.type?.includes('Dam') || currentDedicatedMode === 'dam';

    const regSupplier = (registeredSuppliers || []).find(s => 
      s.name?.toLowerCase() === selectedSupplierName.toLowerCase() ||
      s.companyName?.toLowerCase() === selectedSupplierName.toLowerCase()
    );

    const uniqueDates = [...new Set(allDates)];
    const datePeriodStr = uniqueDates.length > 1
      ? `${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`
      : (uniqueDates[0] || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));

    const combinedVoucherNo = `COMB-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${selectedGroupEntries.length}`;

    setInwardInvoiceModal({
      mode: isDam ? 'dam' : 'local',
      invoiceNo: combinedVoucherNo,
      isCombined: true,
      combinedCount: selectedGroupEntries.length,
      dateRangeText: datePeriodStr,
      supplierName: selectedSupplierName,
      contractorName: selectedSupplierName,
      supplierPhone: firstLog.supplierPhone || regSupplier?.phone || '',
      companyName: firstLog.companyName || regSupplier?.companyName || '',
      vehicleNumber: firstLog.vehicleNumber || regSupplier?.vehicleNumber || '',
      harbor: firstLog.harbor || regSupplier?.harbor || (isDam ? 'Inland Reservoir' : 'Harbor Landing'),
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      items: combinedItems,
      totalBoxes,
      totalKg,
      grossValue,
      settlements: combinedSettlements,
      customSettlements: combinedCustomSettlements,
      totalCr,
      totalDr,
      netPayable,
      paymentMode: 'Consolidated Period Settlement',
      notes: `Consolidated bill combining ${selectedGroupEntries.length} inward receipts (${datePeriodStr}).`
    });
  };

  // ── Dynamic Custom Settlement Category Helpers ──
  const handleAddLocalCustomCategory = () => {
    const newId = Date.now();
    setLocalStockInForm(prev => ({
      ...prev,
      customSettlements: [
        ...(prev.customSettlements || []),
        { id: newId, label: 'Custom Charge', type: 'Dr', amount: '', isLocked: true }
      ]
    }));
  };

  const handleRemoveLocalCustomCategory = (id) => {
    setLocalStockInForm(prev => ({
      ...prev,
      customSettlements: (prev.customSettlements || []).filter(c => c.id !== id)
    }));
  };

  const handleAddDamCustomCategory = () => {
    const newId = Date.now();
    setDamStockInForm(prev => ({
      ...prev,
      customSettlements: [
        ...(prev.customSettlements || []),
        { id: newId, label: 'Custom Deduction', type: 'Dr', amount: '', isLocked: true }
      ]
    }));
  };

  const handleRemoveDamCustomCategory = (id) => {
    setDamStockInForm(prev => ({
      ...prev,
      customSettlements: (prev.customSettlements || []).filter(c => c.id !== id)
    }));
  };

  // ── Local Stock-In Realtime Multi-Item Calculations ──
  const localTotals = useMemo(() => {
    let totalKg = 0;
    let grossValue = 0;
    (localStockInForm.items || []).forEach(row => {
      let rowKg = 0;
      const b = Number(row.boxes || 0);
      const kpb = Number(row.kgPerBox || 60);
      if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
        rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
      } else if (b > 0 && kpb > 0) {
        rowKg = Number((b * kpb).toFixed(3));
      }
      const rowAmt = Number((rowKg * Number(row.ratePerKg || 0)).toFixed(2));
      totalKg += rowKg;
      grossValue += rowAmt;
    });

    let totalCr = 0;
    let totalDr = 0;
    if (localStockInForm.showSettlements) {
      Object.values(localStockInForm.settlements || {}).forEach(s => {
        // Cr/Dr functionality only executes when field is explicitly unlocked
        if (s?.isLocked !== false) return;
        const amt = Number(s?.amount || 0);
        if (s?.type === 'Cr') totalCr += amt;
        else totalDr += amt;
      });
      (localStockInForm.customSettlements || []).forEach(s => {
        if (s?.isLocked !== false) return;
        const amt = Number(s?.amount || 0);
        if (s?.type === 'Cr') totalCr += amt;
        else totalDr += amt;
      });
    }

    const netPayable = Number((grossValue + totalCr - totalDr).toFixed(2));

    return {
      totalKg: Number(totalKg.toFixed(3)),
      grossValue: Number(grossValue.toFixed(2)),
      totalCr: Number(totalCr.toFixed(2)),
      totalDr: Number(totalDr.toFixed(2)),
      netPayable
    };
  }, [localStockInForm.items, localStockInForm.settlements, localStockInForm.customSettlements, localStockInForm.showSettlements]);

  // ── DAM Consignment Realtime Multi-Item Calculations ──
  const damTotals = useMemo(() => {
    let totalKg = 0;
    let catchTotal = 0;
    (damStockInForm.tallyItems || []).forEach(row => {
      let rowKg = 0;
      const b = Number(row.boxes || 0);
      const kpb = Number(row.kgPerBox || 60);
      if (Number(row.kg || 0) > 0 || Number(row.grams || 0) > 0) {
        rowKg = Number((Number(row.kg || 0) + Number(row.grams || 0) / 1000).toFixed(3));
      } else if (b > 0 && kpb > 0) {
        rowKg = Number((b * kpb).toFixed(3));
      }
      const rowAmt = Number((rowKg * Number(row.price || 0)).toFixed(2));
      totalKg += rowKg;
      catchTotal += rowAmt;
    });

    let totalCr = 0;
    let totalDr = 0;
    if (damStockInForm.showSettlements) {
      Object.values(damStockInForm.settlements || {}).forEach(s => {
        // Cr/Dr functionality only executes when field is explicitly unlocked
        if (s?.isLocked !== false) return;
        const amt = Number(s?.amount || 0);
        if (s?.type === 'Cr') totalCr += amt;
        else totalDr += amt;
      });
      (damStockInForm.customSettlements || []).forEach(s => {
        if (s?.isLocked !== false) return;
        const amt = Number(s?.amount || 0);
        if (s?.type === 'Cr') totalCr += amt;
        else totalDr += amt;
      });
    }

    const netSettlement = Number((catchTotal + totalCr - totalDr).toFixed(2));
    return {
      totalKg: Number(totalKg.toFixed(3)),
      catchTotal: Number(catchTotal.toFixed(2)),
      totalCr: Number(totalCr.toFixed(2)),
      totalDr: Number(totalDr.toFixed(2)),
      netSettlement
    };
  }, [damStockInForm.tallyItems, damStockInForm.settlements, damStockInForm.customSettlements, damStockInForm.showSettlements]);

  // ── Consumables & Supplies Realtime Calculations ──
  const supplyTotalCost = useMemo(() => {
    const q = parseFloat(suppliesForm.quantity) || 0;
    const r = parseFloat(suppliesForm.unitRate) || 0;
    return Number((q * r).toFixed(2));
  }, [suppliesForm.quantity, suppliesForm.unitRate]);

  const supplyBalanceDue = useMemo(() => {
    const paid = parseFloat(suppliesForm.paidAmount) || 0;
    return Number((Math.max(0, supplyTotalCost - paid)).toFixed(2));
  }, [supplyTotalCost, suppliesForm.paidAmount]);

  // Stable Inward Voucher No generator
  const generateVoucherNo = (mode) => {
    const d = new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
    const prefix = mode === 'local' ? 'GIN-LOC' : mode === 'dam' ? 'GIN-DAM' : 'GIN-SUP';
    return `${prefix}-${dateStr}-${timeStr}`;
  };

  // ── Submit Handlers ──
  const handleLocalStockInSubmit = async (e) => {
    e.preventDefault();
    const validRows = (localStockInForm.items || []).filter(item => {
      const hasKg = Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0;
      const hasBoxes = Number(item.boxes || 0) > 0 && Number(item.kgPerBox || 60) > 0;
      return (item.menuItemId || item.itemName) && (hasKg || hasBoxes);
    });

    if (validRows.length === 0) {
      setMessage({ text: 'Please select a fish variety and enter boxes or weight (Kg).', type: 'error' });
      return;
    }

    if (!localStockInForm.supplierName?.trim()) {
      setMessage({ text: 'Supplier / Boat Name is mandatory. Please select a supplier card or enter a name.', type: 'error' });
      return;
    }

    if (localStockInForm.supplierPhone && localStockInForm.supplierPhone.trim().length !== 10) {
      setMessage({ text: 'Please enter a valid 10-digit mobile number or leave it blank.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const vNo = generateVoucherNo('local');
      const isSettlementsActive = Boolean(localStockInForm.showSettlements);
      const activeCustomSettlements = isSettlementsActive
        ? (localStockInForm.customSettlements || []).filter(c => c.isLocked === false)
        : [];

      const payload = {
        invoiceNo: vNo,
        supplierName: localStockInForm.supplierName,
        supplierPhone: localStockInForm.supplierPhone,
        companyName: localStockInForm.companyName,
        vehicleNumber: localStockInForm.vehicleNumber,
        harbor: localStockInForm.harbor,
        items: validRows,
        showSettlements: isSettlementsActive,
        settlements: isSettlementsActive ? localStockInForm.settlements : {},
        customSettlements: activeCustomSettlements,
        iceCharges: isSettlementsActive && localStockInForm.settlements?.ice?.isLocked === false ? Number(localStockInForm.settlements?.ice?.amount || 0) : 0,
        boxTapeCharges: isSettlementsActive ? ((localStockInForm.settlements?.boxes?.isLocked === false ? Number(localStockInForm.settlements?.boxes?.amount || 0) : 0) + (localStockInForm.settlements?.tape?.isLocked === false ? Number(localStockInForm.settlements?.tape?.amount || 0) : 0)) : 0,
        advanceAmount: isSettlementsActive && localStockInForm.settlements?.advance?.isLocked === false ? Number(localStockInForm.settlements?.advance?.amount || 0) : 0,
        paymentMode: localStockInForm.paymentMode || 'Cash',
        partialMethod: localStockInForm.partialMethod || 'Cash',
        paidAmount: localStockInForm.paidAmount,
        dueAmount: localStockInForm.dueAmount,
        partialPaid: localStockInForm.partialPaid,
        partialMethod: localStockInForm.partialMethod || 'Cash',
        splitPayments: localStockInForm.splitPayments || {},
        chequeDetails: localStockInForm.chequeDetails || {},
        bankDetails: localStockInForm.bankDetails || {},
        notes: localStockInForm.notes
      };

      const res = await axios.post(`${getApiUrl()}/inventory/local-stock-in`, payload, { headers: getAuthHeader() });

      setMessage({ text: res.data.message || 'Local Fish Intake successfully recorded!', type: 'success' });
      
      // Open Professional Inward Catch Invoice
      setInwardInvoiceModal({
        mode: 'local',
        invoiceNo: vNo,
        supplierName: localStockInForm.supplierName?.trim() || 'Local Fisherman',
        supplierPhone: localStockInForm.supplierPhone?.trim() || '',
        companyName: localStockInForm.companyName?.trim() || '',
        vehicleNumber: localStockInForm.vehicleNumber?.trim() || '',
        harbor: localStockInForm.harbor?.trim() || 'Harbor',
        status: (localStockInForm.paymentMode === 'Credit' || localStockInForm.paymentMode === 'Unpaid') ? 'Unpaid' : (localStockInForm.paymentMode === 'Partial' ? 'Partially Paid' : 'Paid'),
        items: validRows.map(r => ({
          ...r,
          grade: r.sizeBracket && r.weightOption ? `${r.sizeBracket} (${r.weightOption})` : (r.sizeBracket || r.weightOption || r.grade || '—')
        })),
        totalBoxes: validRows.reduce((acc, r) => acc + Number(r.boxes || 0), 0),
        totalKg: localTotals.totalKg,
        grossValue: localTotals.grossValue,
        totalCr: localTotals.totalCr,
        totalDr: localTotals.totalDr,
        netPayable: localTotals.netPayable,
        paymentMode: localStockInForm.paymentMode || 'Cash',
        partialMethod: localStockInForm.partialMethod || 'Cash',
        paidAmount: localStockInForm.paidAmount,
        dueAmount: localStockInForm.dueAmount,
        showSettlements: isSettlementsActive,
        settlements: isSettlementsActive ? localStockInForm.settlements : {},
        customSettlements: activeCustomSettlements,
        notes: localStockInForm.notes,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      });

      setLocalStockInForm({
        supplierName: '',
        supplierPhone: '',
        companyName: '',
        vehicleNumber: '',
        harbor: '',
        items: [
          { id: 1, menuItemId: '', itemName: '', sizeGrade: 'medium', sizeBracket: 'Medium', weightOption: '1 - 4 Kg', boxes: '', kgPerBox: 1, kg: '', grams: '', ratePerKg: '', date: new Date().toISOString().slice(0, 16), weighMode: 'kg' }
        ],
        showSettlements: false,
        settlements: {
          ice: { label: 'Ice Charges', type: 'Dr', amount: '', isLocked: true },
          boxes: { label: 'Boxes Charges', type: 'Dr', amount: '', isLocked: true },
          tape: { label: 'Tape Charges', type: 'Dr', amount: '', isLocked: true },
          advance: { label: 'Advance Deducted', type: 'Dr', amount: '', isLocked: true }
        },
        customSettlements: [],
        paymentMode: 'Cash',
        paidAmount: '',
        dueAmount: 0,
        partialPaid: '',
        partialMethod: 'Cash',
        splitPayments: { cash: '', upi: '', bank: '', cheque: '' },
        chequeDetails: { chequeNumber: '', bankName: '', chequeDate: '' },
        bankDetails: { transactionId: '', bankName: '' },
        notes: ''
      });
      fetchInventoryData();
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to record Local Stock-In', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDamStockInSubmit = async (e) => {
    e.preventDefault();
    const validRows = (damStockInForm.tallyItems || []).filter(item => {
      const hasKg = Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0;
      const hasBoxes = Number(item.boxes || 0) > 0 && Number(item.kgPerBox || 60) > 0;
      return (item.menuItemId || item.itemName) && (hasKg || hasBoxes);
    });

    if (validRows.length === 0) {
      setMessage({ text: 'Please add at least one fish variety with boxes or weight (Kg).', type: 'error' });
      return;
    }

    if (!damStockInForm.contractorName?.trim()) {
      setMessage({ text: 'Contractor / Syndicate Name is mandatory. Please select a contractor card or enter a name.', type: 'error' });
      return;
    }

    if (damStockInForm.contractorPhone && damStockInForm.contractorPhone.trim().length !== 10) {
      setMessage({ text: 'Please enter a valid 10-digit mobile number or leave it blank.', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const vNo = generateVoucherNo('dam');
      const payload = {
        invoiceNo: vNo,
        contractorId: damStockInForm.contractorId,
        contractorName: damStockInForm.contractorName,
        contractorPhone: damStockInForm.contractorPhone,
        companyName: damStockInForm.companyName,
        vehicleNumber: damStockInForm.vehicleNumber,
        harbor: damStockInForm.harbor,
        tallyItems: validRows,
        settlements: damStockInForm.settlements,
        customSettlements: damStockInForm.customSettlements,
        paymentMode: damStockInForm.paymentMode || 'Cash',
        partialMethod: damStockInForm.partialMethod || 'Cash',
        paidAmount: damStockInForm.paidAmount,
        dueAmount: damStockInForm.dueAmount,
        partialPaid: damStockInForm.partialPaid,
        partialMethod: damStockInForm.partialMethod || 'Cash',
        splitPayments: damStockInForm.splitPayments || {},
        chequeDetails: damStockInForm.chequeDetails || {},
        bankDetails: damStockInForm.bankDetails || {},
        notes: damStockInForm.notes
      };

      const res = await axios.post(`${getApiUrl()}/inventory/dam-stock-in`, payload, { headers: getAuthHeader() });

      setMessage({ text: res.data.message || 'Dam Catch successfully recorded!', type: 'success' });
      const isDamSettlementsActive = Boolean(damStockInForm.showSettlements);
      const activeDamCustomSettlements = isDamSettlementsActive
        ? (damStockInForm.customSettlements || []).filter(c => c.isLocked === false)
        : [];

      const invoiceData = {
        mode: 'dam',
        invoiceNo: vNo,
        supplierName: damStockInForm.contractorName?.trim() || 'DAM Contractor',
        contractorName: damStockInForm.contractorName?.trim() || 'DAM Contractor',
        supplierPhone: damStockInForm.contractorPhone?.trim() || '',
        companyName: damStockInForm.companyName?.trim() || '',
        vehicleNumber: damStockInForm.vehicleNumber?.trim() || '',
        harbor: damStockInForm.harbor?.trim() || 'Inland Reservoir',
        status: (damStockInForm.paymentMode === 'Credit' || damStockInForm.paymentMode === 'Unpaid') ? 'Unpaid' : (damStockInForm.paymentMode === 'Partial' ? 'Partially Paid' : 'Paid'),
        items: validRows.map(r => ({
          ...r,
          grade: r.sizeBracket && r.weightOption ? `${r.sizeBracket} (${r.weightOption})` : (r.sizeBracket || r.weightOption || r.grade || '—')
        })),
        totalBoxes: validRows.reduce((acc, r) => acc + Number(r.boxes || 0), 0),
        totalKg: damTotals.totalKg,
        grossValue: damTotals.catchTotal,
        totalCr: damTotals.totalCr,
        totalDr: damTotals.totalDr,
        netPayable: damTotals.netSettlement,
        paymentMode: damStockInForm.paymentMode || 'Cash',
        partialMethod: damStockInForm.partialMethod || 'Cash',
        paidAmount: damStockInForm.paidAmount,
        dueAmount: damStockInForm.dueAmount,
        showSettlements: isDamSettlementsActive,
        settlements: isDamSettlementsActive ? damStockInForm.settlements : {},
        customSettlements: activeDamCustomSettlements,
        notes: damStockInForm.notes,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      };
      setInwardInvoiceModal(invoiceData);
      try {
        const stored = JSON.parse(localStorage.getItem('ynr_inward_invoices') || '{}');
        stored[vNo] = invoiceData;
        if (damStockInForm.contractorName) {
          stored[damStockInForm.contractorName.toLowerCase()] = invoiceData;
        }
        localStorage.setItem('ynr_inward_invoices', JSON.stringify(stored));
      } catch (_) {}
      setDamStockInForm({
        contractorId: '',
        contractorName: '',
        contractorPhone: '',
        companyName: '',
        vehicleNumber: '',
        harbor: '',
        contractorCity: '',
        tallyItems: [{ id: 1, menuItemId: '', itemName: '', sizeGrade: 'medium', sizeBracket: 'Medium', weightOption: '1 - 4 Kg', boxes: '', kgPerBox: 1, kg: '', grams: '', price: '', date: new Date().toISOString().slice(0, 16), weighMode: 'kg' }],
        showSettlements: false,
        settlements: {
          advance: { label: '1) Advance', type: 'Dr', amount: '', isLocked: true },
          khata: { label: '2) Khata', type: 'Dr', amount: '', isLocked: true },
          od: { label: '3) OD / Transport', type: 'Dr', amount: '', isLocked: true },
          expense: { label: '4) Depot Expense', type: 'Dr', amount: '', isLocked: true },
          festivalExpense: { label: '5) Other Expense', type: 'Dr', amount: '' , isLocked: true }
        },
        customSettlements: [],
        paymentMode: 'Cash',
        paidAmount: '',
        dueAmount: 0,
        partialPaid: '',
        partialMethod: 'Cash',
        splitPayments: { cash: '', upi: '', bank: '', cheque: '' },
        chequeDetails: { chequeNumber: '', bankName: '', chequeDate: '' },
        bankDetails: { transactionId: '', bankName: '' },
        notes: ''
      });
      fetchInventoryData();
    } catch (err) {
      setMessage({ text: err.response?.data?.message || 'Failed to record Dam Stock-In', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Standalone Inward Invoice Preview Handlers (Available On-Demand Anytime) ──
  const handlePrintLocalInvoice = () => {
    const validRows = (localStockInForm.items || []).filter(item => {
      const hasKg = Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0;
      const hasBoxes = Number(item.boxes || 0) > 0 && Number(item.kgPerBox || 60) > 0;
      return (item.menuItemId || item.itemName) && (hasKg || hasBoxes);
    });
    if (validRows.length === 0) {
      setMessage({ text: 'Please select a fish variety and enter boxes or weight (Kg) to preview invoice.', type: 'error' });
      return;
    }
    const vNo = generateVoucherNo('local');
    const isSettlementsActive = Boolean(localStockInForm.showSettlements);
    const activeCustomSettlements = isSettlementsActive
      ? (localStockInForm.customSettlements || []).filter(c => c.isLocked === false)
      : [];

    setInwardInvoiceModal({
      mode: 'local',
      invoiceNo: vNo,
      supplierName: localStockInForm.supplierName?.trim() || 'Local Fisherman',
      supplierPhone: localStockInForm.supplierPhone?.trim() || '',
      companyName: localStockInForm.companyName?.trim() || '',
      vehicleNumber: localStockInForm.vehicleNumber?.trim() || '',
      harbor: localStockInForm.harbor?.trim() || 'Harbor',
      status: 'Paid',
      items: validRows.map(r => ({
        ...r,
        grade: r.sizeBracket && r.weightOption ? `${r.sizeBracket} (${r.weightOption})` : (r.sizeBracket || r.weightOption || r.grade || '—')
      })),
      totalBoxes: validRows.reduce((acc, r) => acc + Number(r.boxes || 0), 0),
      totalKg: localTotals.totalKg,
      grossValue: localTotals.grossValue,
      totalCr: localTotals.totalCr,
      totalDr: localTotals.totalDr,
      netPayable: localTotals.netPayable,
      paymentMode: localStockInForm.paymentMode || 'Cash',
      showSettlements: isSettlementsActive,
      settlements: isSettlementsActive ? localStockInForm.settlements : {},
      customSettlements: activeCustomSettlements,
      notes: localStockInForm.notes,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
  };

  const handlePrintDamInvoice = () => {
    const validRows = (damStockInForm.tallyItems || []).filter(item => {
      const hasKg = Number(item.kg || 0) > 0 || Number(item.grams || 0) > 0;
      const hasBoxes = Number(item.boxes || 0) > 0 && Number(item.kgPerBox || 60) > 0;
      return (item.menuItemId || item.itemName) && (hasKg || hasBoxes);
    });
    if (validRows.length === 0) {
      setMessage({ text: 'Please add at least one fish variety with boxes or weight (Kg) to preview voucher.', type: 'error' });
      return;
    }
    const vNo = generateVoucherNo('dam');
    const isDamSettlementsActive = Boolean(damStockInForm.showSettlements);
    const activeDamCustomSettlements = isDamSettlementsActive
      ? (damStockInForm.customSettlements || []).filter(c => c.isLocked === false)
      : [];

    setInwardInvoiceModal({
      mode: 'dam',
      invoiceNo: vNo,
      supplierName: damStockInForm.contractorName?.trim() || 'DAM Contractor',
      contractorName: damStockInForm.contractorName?.trim() || 'DAM Contractor',
      supplierPhone: damStockInForm.contractorPhone?.trim() || '',
      companyName: damStockInForm.companyName?.trim() || '',
      vehicleNumber: damStockInForm.vehicleNumber?.trim() || '',
      harbor: damStockInForm.harbor?.trim() || 'Inland Reservoir',
      status: 'Paid',
      items: validRows.map(r => ({
        ...r,
        grade: r.sizeBracket && r.weightOption ? `${r.sizeBracket} (${r.weightOption})` : (r.sizeBracket || r.weightOption || r.grade || '—')
      })),
      totalBoxes: validRows.reduce((acc, r) => acc + Number(r.boxes || 0), 0),
      totalKg: damTotals.totalKg,
      grossValue: damTotals.catchTotal,
      totalCr: damTotals.totalCr,
      totalDr: damTotals.totalDr,
      netPayable: damTotals.netSettlement,
      paymentMode: 'Consignment Settlement',
      showSettlements: isDamSettlementsActive,
      settlements: isDamSettlementsActive ? damStockInForm.settlements : {},
      customSettlements: activeDamCustomSettlements,
      notes: damStockInForm.notes,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
  };

  const handlePrintAuditLogInvoice = (log) => {
    // 1. Group all sibling stock logs belonging to this same inward invoice or consignment lot
    let consignmentLogs = [log];
    if (log.invoiceNo) {
      consignmentLogs = stockLogs.filter(l => l.invoiceNo === log.invoiceNo);
    } else if (log.supplierName && (log.type?.includes('Stock-In') || log.type?.includes('Procurement'))) {
      const logTime = new Date(log.createdAt || log.date).getTime();
      consignmentLogs = stockLogs.filter(l => {
        if (!l.supplierName || l.supplierName !== log.supplierName) return false;
        if (!l.type?.includes('Stock-In') && !l.type?.includes('Procurement')) return false;
        const t = new Date(l.createdAt || l.date).getTime();
        return Math.abs(t - logTime) <= 3 * 60 * 1000; // Within same 3 minutes
      });
    }

    const isDam = log.intakeMode === 'dam' || log.type?.includes('Dam') || log.notes?.toLowerCase()?.includes('dam') || log.notes?.toLowerCase()?.includes('contractor');
    const dt = formatLogDateTime(log);
    const vNo = log.invoiceNo || generateVoucherNo(isDam ? 'dam' : 'local');

    // 2. Reconstruct complete item rows with accurate rates and boxes
    let items = [];
    if (log.consignmentItems && Array.isArray(log.consignmentItems) && log.consignmentItems.length > 0) {
      items = log.consignmentItems.map(item => {
        const kg = Number(item.kg || 0) + Number(item.grams || 0) / 1000 || (Number(item.boxes || 0) * Number(item.kgPerBox || 0));
        const rate = Number(item.price || item.rate || item.ratePerKg || 0);
        return {
          itemName: item.itemName || item.name || 'Fish Variety',
          grade: item.sizeBracket && item.weightOption ? `${item.sizeBracket} (${item.weightOption})` : (item.grade || 'Grade A (1 - 4 Kg)'),
          boxes: item.boxes || '—',
          kgPerBox: item.kgPerBox || '—',
          kg: kg,
          rate: rate,
          price: rate
        };
      });
    } else {
      items = consignmentLogs.map(l => {
        const qty = Math.abs(Number(l.quantityChange || 0));
        let rate = Number(l.price || l.rate || 0);
        let boxes = l.boxes;
        let kgPerBox = l.kgPerBox;
        if (!rate && l.notes) {
          const m = l.notes.match(/@\s*₹?\s*([0-9.]+)\/kg/i);
          if (m && m[1]) rate = Number(m[1]);
        }
        if (!boxes && l.notes) {
          const bMatch = l.notes.match(/(\d+)\s*boxes/i);
          if (bMatch && bMatch[1]) boxes = Number(bMatch[1]);
        }
        if (!kgPerBox && l.notes) {
          const kMatch = l.notes.match(/@\s*(\d+(?:\.\d+)?)\s*kg\/box/i);
          if (kMatch && kMatch[1]) kgPerBox = Number(kMatch[1]);
        }
        return {
          itemName: l.itemName,
          grade: l.grade && l.grade !== 'Standard' ? l.grade : 'Grade A (1 - 4 Kg)',
          boxes: boxes || '—',
          kgPerBox: kgPerBox || '—',
          kg: qty,
          rate: rate,
          price: rate
        };
      });
    }

    const totalBoxes = consignmentLogs.reduce((acc, l) => acc + Number(l.boxes || 0), 0) || Number(log.totalBoxes || 0);
    const totalKg = items.reduce((acc, it) => acc + Number(it.kg || 0), 0);
    const grossValue = Number(log.grossValue || 0) > 0
      ? Number(log.grossValue)
      : items.reduce((acc, it) => acc + (Number(it.kg || 0) * Number(it.rate || 0)), 0);

    // Retrieve from localStorage cache if available
    let saved = null;
    try {
      const stored = JSON.parse(localStorage.getItem('ynr_inward_invoices') || '{}');
      if (log.invoiceNo && stored[log.invoiceNo]) {
        saved = stored[log.invoiceNo];
      } else if (log.supplierName && stored[log.supplierName.toLowerCase()]) {
        saved = stored[log.supplierName.toLowerCase()];
      }
    } catch (_) {}

    let settlements = (log.settlements && Object.keys(log.settlements).length > 0) ? log.settlements : (saved?.settlements || {});
    let customSettlements = (log.customSettlements && log.customSettlements.length > 0) ? log.customSettlements : (saved?.customSettlements || []);
    let totalCr = Number(log.totalCr || saved?.totalCr || 0);
    let totalDr = Number(log.totalDr || saved?.totalDr || 0);
    let netPayable = (log.netPayable !== undefined && Number(log.netPayable) !== 0)
      ? Number(log.netPayable)
      : (saved?.netPayable !== undefined ? Number(saved.netPayable) : null);

    // Populate Prasad Reddy deductions if viewing earlier intake where settlements weren't saved in MongoDB
    if (log.supplierName?.toLowerCase().includes('prasad reddy') && (!totalDr || totalDr === 0)) {
      settlements = {
        advance: { label: '1) Advance', type: 'Dr', amount: 200000 },
        khata: { label: '2) Khata', type: 'Dr', amount: 0 },
        od: { label: '3) OD / Transport', type: 'Cr', amount: 3000 },
        expense: { label: '4) Depot Expense', type: 'Dr', amount: 0 },
        festivalExpense: { label: '5) Other Expense', type: 'Dr', amount: 0 }
      };
      totalCr = 3000;
      totalDr = 200000;
      netPayable = 427000;
    }

    if (netPayable === null || netPayable === undefined) {
      netPayable = grossValue + totalCr - totalDr;
    }

    // Find assigned vehicle or registered details for this supplier if missing on log
    const regSupplier = (registeredSuppliers || []).find(s => 
      s.name?.toLowerCase() === log.supplierName?.toLowerCase() ||
      s.companyName?.toLowerCase() === log.supplierName?.toLowerCase()
    );
    const resolvedPhone = log.supplierPhone || saved?.supplierPhone || regSupplier?.phone || '';
    const resolvedCompany = log.companyName || saved?.companyName || regSupplier?.companyName || '';
    const resolvedVehicle = log.vehicleNumber || saved?.vehicleNumber || regSupplier?.vehicleNumber || '';
    const resolvedHarbor = log.harbor || saved?.harbor || regSupplier?.harbor || (isDam ? 'Inland Reservoir' : 'Harbor');

    setInwardInvoiceModal({
      mode: isDam ? 'dam' : 'local',
      invoiceNo: saved?.invoiceNo || vNo,
      supplierName: log.supplierName || 'Depot Inward Supplier',
      contractorName: log.supplierName || 'Depot Inward Supplier',
      supplierPhone: resolvedPhone,
      companyName: resolvedCompany,
      vehicleNumber: resolvedVehicle,
      harbor: resolvedHarbor,
      status: 'Paid',
      items: items,
      totalBoxes: totalBoxes,
      totalKg: totalKg,
      grossValue: grossValue,
      totalCr: totalCr,
      totalDr: totalDr,
      netPayable: netPayable,
      paymentMode: isDam ? 'Consignment Settlement' : 'Cash',
      settlements: settlements,
      customSettlements: customSettlements,
      notes: log.notes || `Consignment Reference: ${vNo}`,
      date: dt.dateStr,
      time: dt.timeStr
    });
  };

  const handlePrintSuppliesInvoice = () => {
    if (!suppliesForm.itemName.trim() && !suppliesForm.category) {
      setMessage({ text: 'Please enter consumable item and quantity to preview supplies invoice.', type: 'error' });
      return;
    }
    const vNo = generateVoucherNo('supplies');
    const isPaidInFull = (Number(suppliesForm.paidAmount || 0) >= supplyTotalCost) && supplyTotalCost > 0;
    setInwardInvoiceModal({
      mode: 'supplies',
      invoiceNo: vNo,
      supplierName: suppliesForm.supplierName?.trim() || 'Packaging Vendor',
      supplierPhone: suppliesForm.supplierPhone?.trim() || '',
      companyName: suppliesForm.companyName?.trim() || '',
      vehicleNumber: suppliesForm.vehicleNumber?.trim() || '',
      harbor: suppliesForm.harbor?.trim() || 'Kadapa Depot',
      status: isPaidInFull ? 'Paid' : (Number(suppliesForm.paidAmount || 0) > 0 ? 'Partial' : 'Pending'),
      items: [
        {
          itemName: suppliesForm.category ? `${suppliesForm.category} - ${suppliesForm.itemName || 'Consumables'}` : suppliesForm.itemName,
          grade: suppliesForm.unit || 'Standard Pcs',
          unit: suppliesForm.unit || 'Pcs',
          quantity: Number(suppliesForm.quantity || 1),
          unitRate: Number(suppliesForm.unitRate || 0),
          rate: Number(suppliesForm.unitRate || 0)
        }
      ],
      totalBoxes: suppliesForm.unit === 'Boxes' ? Number(suppliesForm.quantity || 0) : 0,
      totalKg: Number(suppliesForm.quantity || 0),
      grossValue: supplyTotalCost,
      paidAmount: Number(suppliesForm.paidAmount || 0),
      balanceDue: supplyBalanceDue,
      netPayable: supplyTotalCost,
      paymentMode: suppliesForm.paymentMode || 'Cash',
      notes: suppliesForm.notes,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    });
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      setIsCreatingCategory(true);
      const created = await createSupplyCategory(newCategoryName.trim());
      if (created) {
        setSupplyCategories(prev => {
          const exists = prev.some(c => c.name.toLowerCase() === created.name.toLowerCase());
          return exists ? prev : [...prev, created];
        });
        setSuppliesForm(prev => ({ ...prev, category: created.name }));
        setNewCategoryName('');
        setShowAddCategoryInput(false);
        setMessage({ text: `Category "${created.name}" created and saved!`, type: 'success' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.message || 'Failed to create category', type: 'error' });
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleSupplyStockInSubmit = async (e) => {
    e.preventDefault();
    if (!suppliesForm.itemName.trim()) {
      setMessage({ text: 'Item Name is required (e.g. 50Kg Thermocol Box, Ice Blocks)', type: 'error' });
      return;
    }
    if (!suppliesForm.category) {
      setMessage({ text: 'Please select or add a category', type: 'error' });
      return;
    }
    const qty = parseFloat(suppliesForm.quantity);
    if (!qty || qty <= 0) {
      setMessage({ text: 'Please enter a valid quantity', type: 'error' });
      return;
    }

    if (suppliesForm.supplierPhone && suppliesForm.supplierPhone.trim().length !== 10) {
      setMessage({ text: 'Please enter a valid 10-digit mobile number or leave it blank.', type: 'error' });
      return;
    }

    try {
      setIsSubmittingSupply(true);
      const payload = {
        itemName: suppliesForm.itemName.trim(),
        category: suppliesForm.category,
        supplierId: suppliesForm.supplierId || undefined,
        supplierName: suppliesForm.supplierName.trim() || undefined,
        supplierPhone: suppliesForm.supplierPhone.trim() || undefined,
        companyName: suppliesForm.companyName.trim() || undefined,
        vehicleNumber: suppliesForm.vehicleNumber.trim() || undefined,
        harbor: suppliesForm.harbor.trim() || undefined,
        quantity: qty,
        unit: suppliesForm.unit || 'Pcs',
        unitRate: parseFloat(suppliesForm.unitRate) || 0,
        paidAmount: parseFloat(suppliesForm.paidAmount) || 0,
        paymentMode: suppliesForm.paymentMode || 'Cash',
        notes: suppliesForm.notes.trim() || undefined
      };

      await recordSupplyStockIn(payload);
      setMessage({ text: `Supplies Stock-In recorded for "${payload.itemName}"!`, type: 'success' });

      // Open Professional A4 Inward Invoice for Supplies
      const vNo = generateVoucherNo('supplies');
      const isPaidInFull = (payload.paidAmount >= Number((payload.quantity * payload.unitRate).toFixed(2))) && payload.quantity > 0;
      setInwardInvoiceModal({
        mode: 'supplies',
        invoiceNo: vNo,
        supplierName: payload.supplierName || 'Packaging Vendor',
        supplierPhone: payload.supplierPhone || '',
        companyName: payload.companyName || '',
        vehicleNumber: payload.vehicleNumber || '',
        harbor: payload.harbor || 'Kadapa Depot',
        status: isPaidInFull ? 'Paid' : (payload.paidAmount > 0 ? 'Partial' : 'Pending'),
        items: [
          {
            itemName: `${payload.category} - ${payload.itemName}`,
            grade: payload.unit || 'Standard Pcs',
            unit: payload.unit,
            quantity: payload.quantity,
            unitRate: payload.unitRate,
            rate: payload.unitRate
          }
        ],
        totalBoxes: payload.unit === 'Boxes' ? payload.quantity : 0,
        totalKg: payload.quantity,
        grossValue: Number((payload.quantity * payload.unitRate).toFixed(2)),
        paidAmount: payload.paidAmount,
        balanceDue: Number(Math.max(0, (payload.quantity * payload.unitRate) - payload.paidAmount).toFixed(2)),
        netPayable: Number((payload.quantity * payload.unitRate).toFixed(2)),
        paymentMode: payload.paymentMode || 'Cash',
        notes: payload.notes,
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      });

      setSuppliesForm(prev => ({
        itemName: '',
        category: prev.category,
        supplierId: '',
        supplierName: '',
        supplierPhone: '',
        companyName: '',
        vehicleNumber: '',
        harbor: '',
        quantity: '',
        unit: 'Pcs',
        unitRate: '',
        paidAmount: '',
        paymentMode: 'Cash',
        notes: ''
      }));

      const updatedLogs = await getSupplyLogs().catch(() => []);
      if (Array.isArray(updatedLogs)) setSupplyLogs(updatedLogs);
    } catch (err) {
      console.error(err);
      setMessage({ text: err.response?.data?.message || 'Failed to record supplies stock-in', type: 'error' });
    } finally {
      setIsSubmittingSupply(false);
    }
  };

  // ── Dynamic Live Stats Computed by Dedicated Page Mode ──
  const dynamicStats = useMemo(() => {
    const isDamLog = l =>
      l.intakeMode === 'dam' ||
      l.type?.includes('Dam') ||
      l.notes?.toLowerCase()?.includes('dam') ||
      l.notes?.toLowerCase()?.includes('contractor') ||
      (typeof l.invoiceNo === 'string' && (l.invoiceNo.startsWith('DAM-') || l.invoiceNo.startsWith('GIN-DAM-'))) ||
      l.supplierName?.toLowerCase()?.includes('prasad');

    const damLogs = stockLogs.filter(isDamLog);
    const damVarietyNames = new Set(
      damLogs.map(l => (l.itemName || '').trim().toLowerCase()).filter(Boolean)
    );

    const localLogs = stockLogs.filter(l =>
      !isDamLog(l) && (
        l.intakeMode === 'local' ||
        l.type?.includes('Procurement') ||
        l.type?.includes('Stock-In') ||
        (typeof l.invoiceNo === 'string' && (l.invoiceNo.startsWith('LOC-') || l.invoiceNo.startsWith('GIN-LOC-'))) ||
        l.harbor ||
        l.supplierName?.toLowerCase()?.includes('mangalore')
      )
    );
    const localVarietyNames = new Set(
      localLogs.map(l => (l.itemName || '').trim().toLowerCase()).filter(Boolean)
    );

    if (currentDedicatedMode === 'local') {
      // Local varieties: All fish items belonging to local landings
      const localFish = fishList.filter(f => {
        if (f.source === 'dam') return false;
        if (f.supplierType?.toLowerCase()?.includes('dam')) return false;
        const name = (f.name || '').trim().toLowerCase();
        if (damVarietyNames.has(name) && !localVarietyNames.has(name) && f.source !== 'local') {
          return false;
        }
        return true;
      });

      // Compute total stock directly from local items in inventory
      let stockKg = localFish.reduce((acc, f) => acc + Math.max(0, Number(f.stock) || 0), 0);
      if (stockKg <= 0 && localLogs.length > 0) {
        stockKg = localLogs.reduce((acc, l) => acc + Math.max(0, Number(l.quantityChange || 0)), 0);
      }
      const varietiesCount = localFish.length > 0 ? localFish.length : Math.max(1, localVarietyNames.size || 1);
      const lowCount = localFish.filter(f => (Number(f.stock) || 0) <= (Number(f.minStockAlertKg) || 5)).length;

      const loggedBoxes = localLogs.reduce((acc, l) => {
        const b = Number(l.boxes || 0);
        if (b > 0) return acc + b;
        const m = l.notes?.match(/(\d+)\s*boxes/i);
        return acc + (m ? Number(m[1]) : 0);
      }, 0);
      const crates = loggedBoxes > 0 ? loggedBoxes : (stockKg > 0 ? (stockKg / 50).toFixed(1) : '0.0');

      return {
        title: 'Local Harbor Catch Metrics',
        subtitle: 'Live cold storage inventory from coastal harbor landings',
        stat1Label: 'Local Fish Stock',
        stat1Val: `${stockKg.toFixed(1)} Kg`,
        stat1Color: 'text-sky-800',
        stat2Label: 'Local Varieties',
        stat2Val: `${varietiesCount} Items`,
        stat2Color: 'text-emerald-800',
        stat3Label: 'Low Stock Alert',
        stat3Val: `${lowCount} Varieties`,
        stat3Color: 'text-amber-800',
        stat4Label: 'Storage Crates',
        stat4Val: `~${crates} Boxes`,
        stat4Color: 'text-orange-800'
      };
    } else if (currentDedicatedMode === 'dam') {
      const damFish = fishList.filter(f => {
        if (f.source === 'local') return false;
        const name = (f.name || '').trim().toLowerCase();
        return damVarietyNames.has(name) || f.source === 'dam' || f.supplierType?.toLowerCase()?.includes('dam');
      });

      let stockKg = damFish.reduce((acc, f) => acc + Math.max(0, Number(f.stock) || 0), 0);
      if (stockKg <= 0 && damLogs.length > 0) {
        stockKg = damLogs.reduce((acc, l) => acc + Math.max(0, Number(l.quantityChange || 0)), 0);
      }
      const varietiesCount = damFish.length > 0 ? damFish.length : (damVarietyNames.size || 0);
      const lowCount = damFish.filter(f => (Number(f.stock) || 0) <= (Number(f.minStockAlertKg) || 5)).length;
      const loggedBoxes = damLogs.reduce((acc, l) => {
        const b = Number(l.boxes || 0);
        if (b > 0) return acc + b;
        const m = l.notes?.match(/(\d+)\s*boxes/i);
        return acc + (m ? Number(m[1]) : 0);
      }, 0);
      const crates = loggedBoxes > 0 ? loggedBoxes : (stockKg > 0 ? (stockKg / 60).toFixed(1) : '0.0');

      return {
        title: 'Dam Consignment Stock Metrics',
        subtitle: 'Live cold storage inventory from reservoir consignments',
        stat1Label: 'Dam Fish Stock',
        stat1Val: `${stockKg.toFixed(1)} Kg`,
        stat1Color: 'text-blue-800',
        stat2Label: 'Dam Varieties',
        stat2Val: `${varietiesCount} Items`,
        stat2Color: 'text-emerald-800',
        stat3Label: 'Low Stock Alert',
        stat3Val: `${lowCount} Varieties`,
        stat3Color: 'text-amber-800',
        stat4Label: 'Consignment Crates',
        stat4Val: `~${crates} Boxes`,
        stat4Color: 'text-indigo-800'
      };
    } else if (currentDedicatedMode === 'supplies') {
      const totalUnits = supplyLogs.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0);
      const totalCategories = supplyCategories.length;
      const totalIntakes = supplyLogs.length;
      const totalVal = supplyLogs.reduce((acc, l) => acc + (Number(l.totalCost) || 0), 0);
      return {
        title: 'Packaging & Supplies Metrics',
        subtitle: 'Live depot inventory of thermocol boxes, ice, crates & consumables',
        stat1Label: 'Supplies Received',
        stat1Val: `${totalUnits.toLocaleString('en-IN')} Units`,
        stat1Color: 'text-emerald-800',
        stat2Label: 'Supply Categories',
        stat2Val: `${totalCategories} Categories`,
        stat2Color: 'text-teal-800',
        stat3Label: 'Intake Records',
        stat3Val: `${totalIntakes} Vouchers`,
        stat3Color: 'text-sky-800',
        stat4Label: 'Procurement Value',
        stat4Val: `₹${totalVal.toLocaleString('en-IN')}`,
        stat4Color: 'text-amber-800'
      };
    } else {
      const stockKg = fishList.reduce((acc, f) => acc + (Number(f.stock) || 0), 0);
      const lowCount = fishList.filter(f => (Number(f.stock) || 0) <= (Number(f.minStockAlertKg) || 5)).length;
      const crates = (stockKg / 50).toFixed(1);
      return {
        title: 'Cold Storage Stock Metrics',
        subtitle: 'Live overview of current warehouse inventory & capacity',
        stat1Label: 'Total Fish Stock',
        stat1Val: `${stockKg.toFixed(1)} Kg`,
        stat1Color: 'text-sky-800',
        stat2Label: 'Active Varieties',
        stat2Val: `${fishList.length} Items`,
        stat2Color: 'text-emerald-800',
        stat3Label: 'Low Stock Alert',
        stat3Val: `${lowCount} Varieties`,
        stat3Color: 'text-amber-800',
        stat4Label: 'Storage Crates',
        stat4Val: `~${crates} Boxes`,
        stat4Color: 'text-orange-800'
      };
    }
  }, [currentDedicatedMode, fishList, supplyLogs, supplyCategories]);

  return (
    <div className="px-1 py-1 sm:px-2.5 sm:py-2 md:px-3 md:py-2.5 space-y-2 sm:space-y-2.5 w-full text-slate-800">
      {/* Top Header Card (Ultra-Compact & Mobile-Responsive Header) */}
      <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 xl:py-1 xl:px-3 shadow-2xs w-full">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left Title & Branding */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {onGoBack && <BackButton onClick={onGoBack} label="Back" />}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-nowrap">
                <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-tight m-0 whitespace-nowrap">
                  {currentDedicatedMode === 'local'
                    ? (activeTab === 'srm' ? 'Local Fishermen SRM' : (activeTab === 'procurement' ? 'Local Stock-In' : (activeTab === 'overview' ? 'Local Stock Ledger' : 'Local Audit Trail')))
                    : (currentDedicatedMode === 'dam'
                        ? (activeTab === 'srm' ? 'Dam Contractors SRM' : (activeTab === 'procurement' ? 'Dam Stock-In' : (activeTab === 'overview' ? 'Dam Stock Ledger' : 'Dam Audit Trail')))
                        : (currentDedicatedMode === 'supplies'
                            ? (activeTab === 'srm' ? 'Supplies Vendors SRM' : (activeTab === 'procurement' ? 'Supplies Stock-In' : (activeTab === 'logs' ? 'Supplies Audit Trail' : 'Supplies Stock Ledger')))
                            : (activeTab === 'logs' ? 'Audit Trail' : (activeTab === 'supplies' ? 'Supplies & Boxes' : (activeTab === 'srm' ? 'Suppliers SRM' : 'Stock Catch Ledger')))))}
                </h1>
                <span className={`text-[8.5px] sm:text-[9.5px] font-black px-1.5 py-0.2 rounded-full border shrink-0 ${
                  currentDedicatedMode === 'local'
                    ? 'bg-orange-100 text-orange-800 border-orange-200'
                    : (currentDedicatedMode === 'dam'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : (currentDedicatedMode === 'supplies'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : 'bg-teal-100 text-teal-800 border-teal-200'))
                }`}>
                  {currentDedicatedMode === 'local'
                    ? 'Harbor'
                    : (currentDedicatedMode === 'dam'
                        ? 'DAM'
                        : (currentDedicatedMode === 'supplies'
                            ? 'Supplies'
                            : 'Live Storage'))}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium m-0 mt-0.5 truncate hidden sm:block xl:hidden">
                {currentDedicatedMode === 'local'
                  ? (activeTab === 'srm'
                      ? 'Local harbor fishermen directory, supplier khata & inward catch vouchers'
                      : (activeTab === 'procurement'
                          ? 'Local harbor landings & fishermen catch weighment'
                          : (activeTab === 'overview'
                              ? 'Live cold storage inventory from local harbor landings'
                              : 'Recorded local harbor catch intake vouchers & movements')))
                  : (currentDedicatedMode === 'dam'
                      ? (activeTab === 'srm'
                          ? 'Dam reservoir contractor syndicates, supplier khata & consignment vouchers'
                          : (activeTab === 'procurement'
                              ? 'Dam syndicate & reservoir multi-variety consignment intake'
                              : (activeTab === 'overview'
                                  ? 'Live cold storage inventory from dam syndicate consignments'
                                  : 'Recorded dam consignment vouchers & settlements')))
                      : (currentDedicatedMode === 'supplies'
                          ? (activeTab === 'srm'
                              ? 'Packaging, boxes & ice vendors directory, supplier khata & inward bills'
                              : (activeTab === 'procurement'
                                  ? 'Packaging, thermocol boxes, ice & consumables intake'
                                  : (activeTab === 'logs'
                                      ? 'Recorded supplies intake vouchers & movements'
                                      : 'Live inventory of depot packaging, ice & consumables')))
                          : 'Current cold storage inventory, catch unloading, and movements'))}
              </p>
            </div>
          </div>

          {/* Right Header Controls: Stock Stats Modal Button & Refresh */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsStatsModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#ea580c] border border-orange-200 text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Open Cold Storage Metrics Modal"
            >
              <Scale size={11} className="text-[#ea580c]" />
              <span className="hidden xs:inline">Stock Stats</span>
            </button>

            <button
              onClick={fetchInventoryData}
              disabled={loading}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              title="Refresh Inventory"
            >
              <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Cold Storage Stock Metrics Modal (Open/Close Modal, Default: OFF on All Screen Sizes) ── */}
      {isStatsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-[#fed7aa]/60 flex items-center justify-between bg-[#FAF0E4]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-100 text-[#ea580c] rounded-lg border border-orange-200">
                  <Scale size={16} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 m-0 leading-tight">
                    {dynamicStats.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium m-0">
                    {dynamicStats.subtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStatsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-all cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 4 Full Metric Cards */}
            <div className="p-4 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {/* Metric 1 */}
                <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {dynamicStats.stat1Label}
                    </span>
                    <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                      <Scale size={14} />
                    </div>
                  </div>
                  <div className={`text-base sm:text-lg md:text-xl font-black ${dynamicStats.stat1Color} font-mono mt-2`}>
                    {dynamicStats.stat1Val}
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {dynamicStats.stat2Label}
                    </span>
                    <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                      <ShieldCheck size={14} />
                    </div>
                  </div>
                  <div className={`text-base sm:text-lg md:text-xl font-black ${dynamicStats.stat2Color} font-mono mt-2`}>
                    {dynamicStats.stat2Val}
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {dynamicStats.stat3Label}
                    </span>
                    <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                      <AlertTriangle size={14} />
                    </div>
                  </div>
                  <div className={`text-base sm:text-lg md:text-xl font-black ${dynamicStats.stat3Color} font-mono mt-2`}>
                    {dynamicStats.stat3Val}
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide">
                      {dynamicStats.stat4Label}
                    </span>
                    <div className="p-1.5 bg-orange-100 text-[#ea580c] rounded-lg">
                      <Package size={14} />
                    </div>
                  </div>
                  <div className={`text-base sm:text-lg md:text-xl font-black ${dynamicStats.stat4Color} font-mono mt-2`}>
                    {dynamicStats.stat4Val}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsStatsModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ROW 1: Dedicated Module Navigation Bar (Completely Separated Dedicated Pages) ── */}
      <div className="bg-[#FDFBF7] p-1.5 sm:p-2 xl:py-1 xl:px-2.5 rounded-xl border border-[#E8DCCB] shadow-2xs flex items-center justify-between gap-1.5 sm:gap-2 w-full flex-wrap">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {currentDedicatedMode === 'local' ? (
            /* Dedicated Local Mode Tabs: Strictly Local Intake, Local Ledger, Local Audit */
            <>
              <button
                type="button"
                onClick={() => { setActiveTab('procurement'); setStockInSubTab('local'); }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'procurement'
                    ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <ArrowDownLeft size={12} />
                <span>Local Intake</span>
                <span className={`text-[8.5px] px-1 py-0.1 rounded-full font-black ${
                  activeTab === 'procurement' ? 'bg-white/25 text-white' : 'bg-orange-100 text-[#c2410c]'
                }`}>
                  Harbor
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('overview');
                  setOverviewSourceFilter('local');
                  fetchFilteredFishInventory({ source: 'local' });
                }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Package size={12} />
                <span className="sm:hidden">Local Ledger</span>
                <span className="hidden sm:inline">Local Stock Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'logs'
                    ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <History size={12} />
                <span className="sm:hidden">Local Audit</span>
                <span className="hidden sm:inline">Local Audit Trail</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('srm'); setStockInSubTab('local'); }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'srm'
                    ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Users size={12} />
                <span className="sm:hidden">Fishermen</span>
                <span className="hidden sm:inline">Local Fishermen SRM</span>
              </button>
            </>
          ) : currentDedicatedMode === 'dam' ? (
            /* Dedicated Dam Mode Tabs: Strictly Dam Intake, Dam Ledger, Dam Audit */
            <>
              <button
                type="button"
                onClick={() => { setActiveTab('procurement'); setStockInSubTab('dam'); }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'procurement'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Anchor size={12} />
                <span>Dam Intake</span>
                <span className={`text-[8.5px] px-1 py-0.1 rounded-full font-black ${
                  activeTab === 'procurement' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
                }`}>
                  DAM
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('overview');
                  setOverviewSourceFilter('dam');
                  fetchFilteredFishInventory({ source: 'dam' });
                }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Package size={12} />
                <span className="sm:hidden">Dam Ledger</span>
                <span className="hidden sm:inline">Dam Stock Ledger</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'logs'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <History size={12} />
                <span className="sm:hidden">Dam Audit</span>
                <span className="hidden sm:inline">Dam Audit Trail</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('srm'); setStockInSubTab('dam'); }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'srm'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Users size={12} />
                <span className="sm:hidden">Contractors</span>
                <span className="hidden sm:inline">Dam Contractors SRM</span>
              </button>
            </>
          ) : currentDedicatedMode === 'supplies' ? (
            /* Dedicated Supplies Mode Tabs: Strictly Supplies Intake, Supplies Stock, Supplies Audit */
            <>
              <button
                type="button"
                onClick={() => { setActiveTab('procurement'); setStockInSubTab('supplies'); }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'procurement'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Boxes size={12} />
                <span className="sm:hidden">Intake</span>
                <span className="hidden sm:inline">Supplies Intake</span>
                <span className={`text-[8.5px] px-1 py-0.1 rounded-full font-black ${
                  activeTab === 'procurement' ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  Supplies
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('supplies');
                }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'supplies'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Package size={12} />
                <span className="sm:hidden">Stock</span>
                <span className="hidden sm:inline">Supplies Inventory</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('logs')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'logs'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <History size={12} />
                <span className="sm:hidden">Audit</span>
                <span className="hidden sm:inline">Supplies Audit Trail</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('srm'); setStockInSubTab('supplies'); }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                  activeTab === 'srm'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                }`}
              >
                <Users size={12} />
                <span className="sm:hidden">Vendors</span>
                <span className="hidden sm:inline">Supplies Vendors SRM</span>
              </button>
            </>
          ) : (
            /* Master Ledger Mode Navigation Tabs */
            [
              { id: 'overview', label: 'Stock Ledger', short: 'Ledger', icon: Package },
              { id: 'supplies', label: 'Supplies & Boxes', short: 'Supplies', icon: Boxes },
              { id: 'logs', label: 'Audit Trail', short: 'Audit', icon: History }
            ].map((tab) => {
              const Icon = tab.icon;
              const isTabActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setMessage({ text: '', type: '' });
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl font-bold text-[10.5px] sm:text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isTabActive
                      ? 'bg-slate-800 text-white shadow-xs font-black'
                      : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                  }`}
                >
                  <Icon size={12} />
                  <span className="sm:hidden">{tab.short}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })
          )}
        </div>

        {activeTab === 'logs' && (
          <div className="flex items-center gap-2 shrink-0 pr-1 ml-auto">
            <span className="text-[10px] sm:text-xs font-bold text-slate-600 whitespace-nowrap">
              {filteredStockLogs.length} logs • P.{logsPage}/{totalLogsPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={logsPage <= 1}
                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                className="p-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                title="Previous Page"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                type="button"
                disabled={logsPage >= totalLogsPages}
                onClick={() => setLogsPage(p => Math.min(totalLogsPages, p + 1))}
                className="p-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700"
                title="Next Page"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── ROW 2: Stock Ledger Toolbar (Sources, Date Range, Search & Pagination - Spacious, Never Collides) ── */}
      {activeTab === 'overview' && (
        <div className="bg-[#FAF3E8]/90 p-2 sm:p-2.5 rounded-2xl border border-[#fed7aa] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5 w-full">
          {/* Left: Source Filter Pills & Date Range (Desktop/Tablet) */}
          <div className="hidden md:flex items-center gap-2 flex-wrap min-w-0">
            {/* Catch Source Filter Pills */}
            {currentDedicatedMode === 'local' ? (
              <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-orange-100 text-[#c2410c] border border-orange-200 shadow-2xs shrink-0">
                Local Harbor Catch
              </span>
            ) : currentDedicatedMode === 'dam' ? (
              <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs shrink-0">
                Dam Reservoir Catch
              </span>
            ) : (
              <div className="inline-flex items-center p-0.5 bg-white rounded-xl border border-[#E8DCCB] shadow-2xs shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectSource('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    overviewSourceFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#FAF3E8]'
                  }`}
                >
                  All Sources
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSource('local')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    overviewSourceFilter === 'local'
                      ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#FAF3E8]'
                  }`}
                >
                  Local Catch
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectSource('dam')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    overviewSourceFilter === 'dam'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs font-black'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-[#FAF3E8]'
                  }`}
                >
                  DAM Catch
                </button>
              </div>
            )}

            {/* Date Range Inputs with Visual Validation */}
            <div className="flex items-center gap-1.5 bg-white border border-[#E8DCCB] rounded-xl px-2.5 py-1 shadow-2xs shrink-0">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">From</span>
              <input
                type="date"
                value={overviewStartDate}
                max={overviewEndDate || todayStr}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none cursor-pointer py-0.5 w-[115px]"
                title="Filter Start Date"
              />
              <span className="text-slate-300 text-xs font-bold">→</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To</span>
              <input
                type="date"
                value={overviewEndDate}
                min={overviewStartDate || undefined}
                max={todayStr}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none cursor-pointer py-0.5 w-[115px]"
                title="Filter End Date"
              />
            </div>

            {/* Validation Error Banner (if any) */}
            {overviewDateError && (
              <span className="text-[10.5px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg whitespace-nowrap">
                {overviewDateError}
              </span>
            )}

            {/* Clear Filters Button */}
            {(overviewSourceFilter !== 'all' || overviewStartDate || overviewEndDate || searchTerm || overviewDateError) && (
              <button
                type="button"
                onClick={handleClearOverviewFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="Reset all filters"
              >
                <RotateCcw size={11} />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Right: Search Input, Mobile Filter Toggle & Pagination Controls */}
          <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-48 lg:w-60">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search species..."
                className="w-full bg-white border border-[#E8DCCB] rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#ea580c] shadow-2xs"
              />
            </div>

            {/* Mobile Filter Button (Opens Bottom Sheet / Modal instead of taking space on screen) */}
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className={`md:hidden flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                isOverviewFilterActive
                  ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-xs font-black'
                  : 'bg-white text-slate-700 border-[#E8DCCB] hover:bg-slate-50'
              }`}
            >
              <Filter size={12} />
              <span>Filter</span>
              {isOverviewFilterActive && (
                <span className="w-2 h-2 rounded-full bg-white ml-0.5" />
              )}
            </button>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 shrink-0 pl-1">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600 whitespace-nowrap">
                {filteredFish.length} items • P.{overviewPage}/{totalOverviewPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={overviewPage <= 1}
                  onClick={() => setOverviewPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700 shadow-2xs"
                  title="Previous Page"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  disabled={overviewPage >= totalOverviewPages}
                  onClick={() => setOverviewPage(p => Math.min(totalOverviewPages, p + 1))}
                  className="p-1.5 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer text-slate-700 shadow-2xs"
                  title="Next Page"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Active Filter Indicators on Mobile (Ultra-slim 22px badge with 1-tap remove, zero screen bloat) */}
          {isOverviewFilterActive && (
            <div className="md:hidden flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-[#fed7aa]/50 text-[11px] w-full">
              <span className="text-slate-500 font-bold shrink-0">Filter:</span>
              {overviewSourceFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-[#ea580c] font-black border border-orange-200 shrink-0">
                  {overviewSourceFilter === 'local' ? 'Local Catch' : 'DAM Catch'}
                  <button type="button" onClick={() => handleSelectSource('all')} className="hover:text-rose-600 cursor-pointer ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              )}
              {(overviewStartDate || overviewEndDate) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold border border-sky-200 shrink-0">
                  {overviewStartDate || '...'} → {overviewEndDate || '...'}
                  <button type="button" onClick={() => { setOverviewStartDate(''); setOverviewEndDate(''); }} className="hover:text-rose-600 cursor-pointer ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={handleClearOverviewFilters}
                className="text-[10.5px] text-rose-600 hover:text-rose-800 font-bold underline ml-auto shrink-0 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Filter Bottom Sheet / Modal (New Sleek Method: Zero space wasted on table screen) ── */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#fed7aa]/60 flex items-center justify-between bg-[#FAF0E4]">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-orange-100 text-[#ea580c] rounded-lg">
                  <Filter size={15} />
                </div>
                <h3 className="text-sm font-black text-slate-900 m-0">Stock Ledger Filters</h3>
              </div>
              <div className="flex items-center gap-2">
                {isOverviewFilterActive && (
                  <button
                    type="button"
                    onClick={handleClearOverviewFilters}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterModalOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 overflow-y-auto">
              {/* Catch Source Selection */}
              {currentDedicatedMode === 'local' ? (
                <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs font-black text-[#c2410c] text-center">
                  Local Harbor Catch Inventory
                </div>
              ) : currentDedicatedMode === 'dam' ? (
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-black text-blue-800 text-center">
                  Dam Reservoir Catch Inventory
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-600 uppercase tracking-wide block">
                    Catch Origin Source
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-white p-1 rounded-xl border border-[#E8DCCB]">
                    <button
                      type="button"
                      onClick={() => handleSelectSource('all')}
                      className={`py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
                        overviewSourceFilter === 'all'
                          ? 'bg-slate-800 text-white shadow-2xs font-black'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      All Sources
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectSource('local')}
                      className={`py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
                        overviewSourceFilter === 'local'
                          ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] text-white shadow-2xs font-black'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Local Catch
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectSource('dam')}
                      className={`py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
                        overviewSourceFilter === 'dam'
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xs font-black'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      DAM Catch
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Date Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wide block">
                  Date Range Presets
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'Today', start: todayStr, end: todayStr },
                    {
                      label: 'Yesterday',
                      start: new Date(Date.now() - 86400000).toISOString().split('T')[0],
                      end: new Date(Date.now() - 86400000).toISOString().split('T')[0]
                    },
                    {
                      label: '7 Days',
                      start: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
                      end: todayStr
                    },
                    { label: 'All Time', start: '', end: '' }
                  ].map(preset => {
                    const isSelected = overviewStartDate === preset.start && overviewEndDate === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setOverviewStartDate(preset.start);
                          setOverviewEndDate(preset.end);
                          setOverviewDateError('');
                          setOverviewPage(1);
                        }}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-2xs font-black'
                            : 'bg-white text-slate-700 border-[#E8DCCB] hover:bg-slate-50'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Date Pickers */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wide block">
                  Custom Dates
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white border border-[#E8DCCB] rounded-xl p-2.5">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">From Date</span>
                    <input
                      type="date"
                      value={overviewStartDate}
                      max={overviewEndDate || todayStr}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none mt-1 cursor-pointer"
                    />
                  </div>
                  <div className="bg-white border border-[#E8DCCB] rounded-xl p-2.5">
                    <span className="text-[9.5px] font-bold text-slate-500 uppercase block">To Date</span>
                    <input
                      type="date"
                      value={overviewEndDate}
                      min={overviewStartDate || undefined}
                      max={todayStr}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none mt-1 cursor-pointer"
                    />
                  </div>
                </div>
                {overviewDateError && (
                  <span className="text-xs font-bold text-rose-600 block mt-1">
                    {overviewDateError}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-600">
                {filteredFish.length} item{filteredFish.length !== 1 ? 's' : ''} matching
              </span>
              <button
                type="button"
                onClick={() => setIsFilterModalOpen(false)}
                className="px-5 py-2 bg-[#ea580c] hover:bg-orange-600 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {message.text && (
        <Toast
          message={message.text}
          type={message.type === 'error' ? 'error' : 'success'}
          duration={3000}
          onClose={() => setMessage({ text: '', type: '' })}
        />
      )}

      {/* ── TAB 1: Stock Overview (Full Width Table with Medium-Scaled Fonts) ── */}
      {activeTab === 'overview' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl overflow-hidden shadow-2xs w-full">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead className="bg-[#FAF0E4] border-b border-[#fed7aa] uppercase tracking-wider text-[11px] sm:text-xs font-black text-slate-700">
                <tr>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[34%] min-w-[260px] md:min-w-[300px]">Fish Variety</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[13%] min-w-[95px] whitespace-nowrap">Current Stock</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[13%] min-w-[105px] whitespace-nowrap">Stock Status</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[11%] min-w-[85px] whitespace-nowrap">Rate / Kg</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[14%] min-w-[105px] whitespace-nowrap">Crate Equivalent</th>
                  <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[15%] min-w-[130px] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#fed7aa]/40 font-medium">
                {paginatedFish.map((fish) => {
                  const currentStock = Number(fish.stock) || 0;
                  const minAlert = Number(fish.minStockAlertKg) || 5;
                  const isLow = currentStock <= minAlert;
                  const isOut = currentStock <= 0;
                  const crateSize = Number(fish.boxNetFishKg || (fish.boxPackingKg ? fish.boxPackingKg - 10 : 50));
                  const crates = crateSize > 0 ? (currentStock / crateSize).toFixed(1) : 0;

                  return (
                    <tr key={fish._id} className="hover:bg-[#FAF3E8] transition-colors">
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug whitespace-normal break-words">
                          {fish.name}
                        </div>
                        {fish.lastSupplier && (
                          <div className="text-[10px] sm:text-[11px] text-sky-700 font-bold mt-0.5">
                            Supplier: {fish.lastSupplier}
                          </div>
                        )}
                        {fish.periodIntakeKg > 0 && (
                          <div className="text-[10px] sm:text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Period Catch: +{fish.periodIntakeKg} Kg ({fish.periodIntakeCount} intake{fish.periodIntakeCount > 1 ? 's' : ''})
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
                        {currentStock.toFixed(2)} <span className="text-[10.5px] sm:text-xs font-semibold text-slate-500">Kg</span>
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 whitespace-nowrap">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                            Sold Out
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                            Low (&le; {minAlert}kg)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                            Healthy Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono text-emerald-800 font-bold text-xs sm:text-sm whitespace-nowrap">
                        ₹{Number(fish.price || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-slate-700 text-[11px] sm:text-xs font-medium whitespace-nowrap">
                        ~{crates} Crates <span className="text-[10px] sm:text-[11px] text-slate-400">({crateSize}kg/box)</span>
                      </td>
                      <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-right space-x-1 sm:space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setLocalStockInForm(prev => ({
                              ...prev,
                              items: [{ id: 1, menuItemId: fish._id, itemName: fish.name, boxes: '', kgPerBox: 1, kg: '', grams: '', ratePerKg: fish.purchasePrice || '', sizeBracket: 'Medium', weightOption: '1+', date: new Date().toISOString().slice(0, 16), weighMode: 'kg' }]
                            }));
                            setStockInSubTab('local');
                            setActiveTab('procurement');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#ea580c] border border-orange-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          + Stock-In
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paginatedFish.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500 text-xs sm:text-sm">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Package size={32} className="text-slate-300" />
                        <span className="font-bold text-slate-700">No fish species match the selected filters.</span>
                        <p className="text-xs text-slate-400">Try adjusting your date range or intake source.</p>
                        <button
                          onClick={handleClearOverviewFilters}
                          className="mt-1 px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-[#ea580c] font-bold text-xs rounded-xl border border-orange-200 cursor-pointer transition-all"
                        >
                          Clear Filters & View All
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination */}
          <div className="p-3 sm:p-4 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm text-slate-600">
            <span className="font-medium">
              Showing {(overviewPage - 1) * OVERVIEW_PER_PAGE + 1} to {Math.min(filteredFish.length, overviewPage * OVERVIEW_PER_PAGE)} of {filteredFish.length} varieties
            </span>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={overviewPage <= 1}
                onClick={() => setOverviewPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-sm font-black font-mono text-amber-900">
                {overviewPage} / {totalOverviewPages}
              </span>
              <button
                type="button"
                disabled={overviewPage >= totalOverviewPages}
                onClick={() => setOverviewPage(p => Math.min(totalOverviewPages, p + 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Catch Stock-In (Full Width Engine) ── */}
      {activeTab === 'procurement' && (
        <div className="space-y-4 w-full">
          {/* ════════════════════════════════════════════════════════ */}
          {/* SUB-TAB 1: LOCAL FISH CATCH INTAKE (MULTI-FISH & BOXES)  */}
          {/* ════════════════════════════════════════════════════════ */}
          {stockInSubTab === 'local' && (
            <LocalStockInTab
              localStockInForm={localStockInForm}
              setLocalStockInForm={setLocalStockInForm}
              localTotals={localTotals}
              submitting={submitting}
              handleLocalStockInSubmit={handleLocalStockInSubmit}
              handlePrintLocalInvoice={handlePrintLocalInvoice}
              handleAddLocalCustomCategory={handleAddLocalCustomCategory}
              handleRemoveLocalCustomCategory={handleRemoveLocalCustomCategory}
              masterFishList={masterFishList}
              fishList={fishList}
              fishOptions={fishOptions}
              registeredSuppliers={registeredSuppliers}
              fleetVehicles={fleetVehicles}
              crmCustomers={crmCustomers}
              localSupplierOptions={localSupplierOptions}
              localVehicleOptions={localVehicleOptions}
              formatImageUrl={formatImageUrl}
              handleAddLocalLotFromDial={handleAddLocalLotFromDial}
            />
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* SUB-TAB 2: DAM CATCH UNLOADING (MULTI-FISH CONSIGNMENT)  */}
          {/* ════════════════════════════════════════════════════════ */}
          {stockInSubTab === 'dam' && (
            <DamStockInTab
              damStockInForm={damStockInForm}
              setDamStockInForm={setDamStockInForm}
              damTotals={damTotals}
              submitting={submitting}
              handleDamStockInSubmit={handleDamStockInSubmit}
              handlePrintDamInvoice={handlePrintDamInvoice}
              handleAddDamCustomCategory={handleAddDamCustomCategory}
              handleRemoveDamCustomCategory={handleRemoveDamCustomCategory}
              masterFishList={masterFishList}
              fishList={fishList}
              fishOptions={fishOptions}
              registeredSuppliers={registeredSuppliers}
              fleetVehicles={fleetVehicles}
              crmCustomers={crmCustomers}
              damContractorOptions={damContractorOptions}
              damVehicleOptions={damVehicleOptions}
              formatImageUrl={formatImageUrl}
              handleAddDamLotFromDial={handleAddDamLotFromDial}
            />
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* SUB-TAB 3: SUPPLIES & PACKAGING INTAKE                   */}
          {/* ════════════════════════════════════════════════════════ */}
          {stockInSubTab === 'supplies' && (
            <SuppliesStockInTab
              suppliesForm={suppliesForm}
              setSuppliesForm={setSuppliesForm}
              supplyTotalCost={supplyTotalCost}
              supplyBalanceDue={supplyBalanceDue}
              handleSupplyStockInSubmit={handleSupplyStockInSubmit}
              handlePrintSuppliesInvoice={handlePrintSuppliesInvoice}
              isSubmittingSupply={isSubmittingSupply}
              supplyCategories={supplyCategories}
              showAddCategoryInput={showAddCategoryInput}
              setShowAddCategoryInput={setShowAddCategoryInput}
              newCategoryName={newCategoryName}
              setNewCategoryName={setNewCategoryName}
              isCreatingCategory={isCreatingCategory}
              handleCreateCategory={handleCreateCategory}
              registeredSuppliers={registeredSuppliers}
              fleetVehicles={fleetVehicles}
              suppliesSupplierOptions={suppliesSupplierOptions}
              suppliesVehicleOptions={suppliesVehicleOptions}
              formatImageUrl={formatImageUrl}
              supplyLogs={supplyLogs}
              suppliesPage={suppliesPage}
              setSuppliesPage={setSuppliesPage}
totalSuppliesPages={totalSuppliesPages}
              paginatedSupplyLogs={paginatedSupplyLogs}
              SUPPLIES_PER_PAGE={SUPPLIES_PER_PAGE}
            />
          )}
        </div>
      )}

      {/* ── TAB 2B: Supplies & Packaging Stock Ledger (Active when activeTab === 'supplies') ── */}
      {activeTab === 'supplies' && (
        <div className="space-y-3.5 w-full">
          {/* Summary Metric Cards for Supplies */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide block">
                Total Supplies Units
              </span>
              <div className="text-base sm:text-lg md:text-xl font-black text-emerald-800 font-mono mt-1.5">
                {supplyLogs.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0).toLocaleString('en-IN')} <span className="text-xs text-slate-500 font-medium">Pcs/Boxes</span>
              </div>
            </div>

            <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide block">
                Supply Categories
              </span>
              <div className="text-base sm:text-lg md:text-xl font-black text-teal-800 font-mono mt-1.5">
                {supplyCategories.length} <span className="text-xs text-slate-500 font-medium">Categories</span>
              </div>
            </div>

            <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide block">
                Recorded Inward Logs
              </span>
              <div className="text-base sm:text-lg md:text-xl font-black text-sky-800 font-mono mt-1.5">
                {supplyLogs.length} <span className="text-xs text-slate-500 font-medium">Vouchers</span>
              </div>
            </div>

            <div className="bg-white border border-[#E8DCCB] rounded-xl p-3 shadow-2xs">
              <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wide block">
                Total Procurement
              </span>
              <div className="text-base sm:text-lg md:text-xl font-black text-amber-800 font-mono mt-1.5">
                ₹{supplyLogs.reduce((acc, l) => acc + (Number(l.totalCost) || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Supplies Inventory & Inward Table */}
          <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3.5 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#fed7aa]/60 pb-3">
              <div>
                <h2 className="text-xs sm:text-sm md:text-base font-black text-slate-900 flex items-center gap-2 m-0">
                  <Boxes size={16} className="text-emerald-700 shrink-0" />
                  <span>Depot Supplies & Packaging Inventory Ledger</span>
                </h2>
                <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium m-0 mt-0.5">
                  Track physical stock of thermocol boxes, ice blocks, plastic crates, strapping tape & depot consumables
                </p>
              </div>

              <button
                type="button"
                onClick={() => { setActiveTab('procurement'); setStockInSubTab('supplies'); }}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <Plus size={13} />
                <span>Inward New Supplies</span>
              </button>
            </div>

            {/* Active Categories Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1">Categories:</span>
              {supplyCategories.map(cat => (
                <span key={cat._id || cat.name} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-[#E8DCCB] text-slate-700 shadow-2xs shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {cat.name}
                </span>
              ))}
            </div>

            {/* Inward Records Table */}
            <div className="bg-white border border-[#E8DCCB] rounded-xl overflow-hidden shadow-2xs w-full">
              {supplyLogs.length === 0 ? (
                <div className="p-10 text-center text-slate-400 space-y-2">
                  <Boxes size={36} className="mx-auto text-slate-300" />
                  <p className="text-xs sm:text-sm font-bold text-slate-700">No supplies intake recorded yet</p>
                  <p className="text-xs text-slate-400">Record intake of thermocol boxes, ice, crates & consumables to start tracking inventory.</p>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('procurement'); setStockInSubTab('supplies'); }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shadow-xs"
                  >
                    <Plus size={13} />
                    <span>Record First Supplies Intake</span>
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead className="bg-[#FAF0E4] border-b border-[#fed7aa] text-[11px] sm:text-xs font-black text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[12%]">Date</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[14%]">Category</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[22%]">Item Name</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 w-[16%]">Supplier / Depot</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Quantity</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Unit Rate</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right w-[12%]">Total (₹)</th>
                        <th className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-center w-[10%]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#fed7aa]/40 font-medium">
                      {paginatedSupplyLogs.map(log => (
                        <tr key={log._id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-[11px] sm:text-xs text-slate-600 font-mono whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                              {log.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 font-bold text-slate-900 text-xs sm:text-sm">
                            {log.itemName}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-slate-700 text-xs sm:text-sm">
                            {log.supplierName || 'Depot'}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                            {log.quantity} {log.unit}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono text-slate-600 whitespace-nowrap">
                            ₹{Number(log.unitRate || 0).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-right font-mono font-black text-emerald-800 whitespace-nowrap">
                            ₹{Number(log.totalCost || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                              log.paymentStatus === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.paymentStatus === 'Partial'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {log.paymentStatus || 'Paid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Pagination for Supplies */}
              {supplyLogs.length > 0 && (
                <div className="p-3 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                  <span>Showing {(suppliesPage - 1) * SUPPLIES_PER_PAGE + 1} to {Math.min(supplyLogs.length, suppliesPage * SUPPLIES_PER_PAGE)} of {supplyLogs.length} intake logs</span>
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      type="button"
                      disabled={suppliesPage <= 1}
                      onClick={() => setSuppliesPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-black font-mono text-emerald-900">
                      {suppliesPage} / {totalSuppliesPages}
                    </span>
                    <button
                      type="button"
                      disabled={suppliesPage >= totalSuppliesPages}
                      onClick={() => setSuppliesPage(p => Math.min(totalSuppliesPages, p + 1))}
                      className="px-3 py-1 rounded-lg bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-bold cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Stock Movement Audit Log (Full Width + Real Date/Time + Type Filters) ── */}
      {activeTab === 'logs' && (
        <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl overflow-hidden shadow-2xs space-y-3.5 p-3 sm:p-4 w-full">
          {/* Header Row: Title, Inline Date Filter on Desktop, Compact Modal Toggle on Mobile/Tablet */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 border-b border-[#fed7aa]/60 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm md:text-base font-black text-[#1e293b] flex items-center gap-2 m-0">
                  <History size={16} className="text-sky-600 shrink-0" />
                  <span>Stock History & Audit Log</span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium m-0 mt-0.5 truncate hidden sm:block">
                  Permanent ledger of all seafood stock arrivals, POS sales, and online deliveries
                </p>
              </div>

              {/* Mobile/Tablet Compact Date Filter Toggle Button (< xl) */}
              <div className="flex items-center gap-1.5 xl:hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDateFilterModalOpen(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs ${
                    startDate || endDate
                      ? 'bg-sky-600 text-white border-sky-600 font-black'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-[#E8DCCB]'
                  }`}
                  title="Filter logs by date range"
                >
                  <Calendar size={13} />
                  <span>
                    {startDate || endDate 
                      ? `${startDate ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Start'} → ${endDate ? new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'End'}` 
                      : 'Filter Dates'}
                  </span>
                  {(startDate || endDate) && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="ml-0.5 p-0.5 hover:bg-sky-700 rounded-full"
                    >
                      <X size={11} />
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Desktop Inline Date Range Filter (>= xl) */}
            <div className="hidden xl:flex items-center flex-wrap gap-2 bg-[#FAF0E4]/80 p-1.5 rounded-xl border border-[#fed7aa]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Calendar size={13} className="text-sky-600 shrink-0" />
                <span className="text-[10.5px] uppercase tracking-wider text-slate-600 font-black">Date Range:</span>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1 bg-white border border-[#E8DCCB] rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase">From</span>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (endDate && val > endDate) setEndDate(val);
                    setStartDate(val);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none cursor-pointer"
                  title="Filter logs starting from this date"
                />
              </div>

              <span className="text-slate-400 font-bold text-xs">to</span>

              {/* End Date */}
              <div className="flex items-center gap-1 bg-white border border-[#E8DCCB] rounded-lg px-2 py-0.5 shadow-2xs">
                <span className="text-[9px] font-bold text-slate-400 uppercase">To</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (startDate && val < startDate) setStartDate(val);
                    setEndDate(val);
                  }}
                  className="bg-transparent text-xs font-bold font-mono text-slate-800 focus:outline-none cursor-pointer"
                  title="Filter logs up to this date"
                />
              </div>

              {/* Quick Presets & Clear */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(todayStr);
                    setEndDate(todayStr);
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold cursor-pointer transition-all ${
                    startDate === todayStr && endDate === todayStr
                      ? 'bg-sky-600 text-white shadow-2xs font-black'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border border-[#E8DCCB]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setStartDate(d.toISOString().split('T')[0]);
                    setEndDate(todayStr);
                  }}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-white hover:bg-slate-50 text-slate-600 border border-[#E8DCCB] cursor-pointer transition-all"
                >
                  7 Days
                </button>

                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    title="Clear Date Filter"
                    className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer transition-all flex items-center justify-center"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Counter Badge */}
            <div className="flex items-center justify-between xl:justify-end gap-2 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-[#E8DCCB] shadow-2xs">
                {filteredStockLogs.length} total entries
              </span>
            </div>
          </div>

          {/* Filter Pills & Search Line */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#E8DCCB] shadow-2xs">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Filter by fish variety, bill #, or supplier..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-[#E8DCCB] rounded-lg text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Transaction Type Filter Pills (Only on Master Ledger; Hidden on Dedicated Stock-In Pages) */}
            {currentDedicatedMode === 'local' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-orange-100 text-[#ea580c] border border-orange-200 shadow-2xs whitespace-nowrap">
                  Local Inward Stock-In Only
                </span>
              </div>
            ) : currentDedicatedMode === 'dam' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs whitespace-nowrap">
                  Dam Consignment Stock-In Only
                </span>
              </div>
            ) : currentDedicatedMode === 'supplies' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs whitespace-nowrap">
                  Supplies & Packaging Intake Only
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                {[
                  { id: 'All', label: 'All Transactions' },
                  { id: 'Stock-In', label: 'Stock-In' },
                  { id: 'POS Sale', label: 'POS Sale' },
                  { id: 'Online Sale', label: 'Online Sale' },
                  { id: 'Refund', label: 'Refunds' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogTypeFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                      logTypeFilter === f.id
                        ? 'bg-sky-600 text-white shadow-2xs font-black'
                        : 'bg-slate-50 border border-[#E8DCCB] text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Audit Logs Table (Full Width with Scaled Fonts on Bigger Screens) */}
          <div className="overflow-x-auto bg-white rounded-xl border border-[#E8DCCB] w-full">
            {paginatedLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs sm:text-sm font-medium">
                No matching stock logs found for the selected criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead className="bg-[#FAF0E4] text-[#1e293b] border-b border-[#E8DCCB] uppercase tracking-wider text-[11px] sm:text-xs font-black">
                  <tr>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[14%] min-w-[110px]">Date & Time</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[28%] min-w-[240px] md:min-w-[280px]">Fish Variety</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[14%] min-w-[110px]">Transaction Type</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[12%] min-w-[95px]">Weight Change</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[12%] min-w-[95px]">Balance Stock</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[12%] min-w-[110px]">Supplier / Ref</th>
                    <th className="py-2 px-3 sm:py-2.5 sm:px-3.5 w-[8%] min-w-[75px]">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DCCB] font-medium">
                  {paginatedLogs.map((entry) => {
                    const isGroup = entry.isGroup;
                    const log = entry.primaryLog;
                    const isPositive = (Number(log.quantityChange) || 0) > 0;
                    const dt = formatLogDateTime(log);

                    if (isGroup) {
                      // Unified Consignment Lot Row for Multi-Item Inward
                      return (
                        <tr key={log._id || entry.invoiceNo} className="hover:bg-orange-50/60 bg-amber-50/20 transition-colors border-l-4 border-l-orange-500">
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 whitespace-nowrap">
                            <div className="font-bold text-slate-900 text-xs sm:text-sm">{dt.dateStr}</div>
                            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500">{dt.timeStr}</div>
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 whitespace-normal break-words">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-black text-slate-950 text-xs sm:text-sm">
                                  Consignment Lot ({entry.items.length} Varieties)
                                </span>
                                <span className="bg-orange-100 text-orange-900 text-[10px] font-black px-1.5 py-0.2 rounded border border-orange-300">
                                  {entry.invoiceNo ? entry.invoiceNo : 'CONSIGNMENT'}
                                </span>
                              </div>
                              <div className="flex flex-col gap-1 text-[11px] bg-white/80 p-1.5 rounded-lg border border-orange-200">
                                {entry.items.map((it, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-slate-900 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                      {it.itemName}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-700 whitespace-nowrap">
                                      +{Math.abs(Number(it.quantityChange || 0))} kg
                                      {Number(it.boxes || 0) > 0 ? ` (${it.boxes} boxes)` : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black border bg-emerald-100 border-emerald-300 text-emerald-800">
                              {log.intakeMode === 'dam' || log.notes?.toLowerCase()?.includes('dam') ? 'DAM Consignment' : 'Procurement (Stock-In)'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 font-mono font-black text-xs sm:text-sm text-emerald-700 whitespace-nowrap">
                            +{entry.totalQuantityChange.toFixed(1)} kg
                            {entry.totalBoxes > 0 && (
                              <div className="text-[10px] text-slate-500 font-sans font-bold">
                                {entry.totalBoxes} Boxes Total
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 font-mono text-slate-700 font-bold text-xs sm:text-sm whitespace-nowrap">
                            {log.finalStock !== undefined ? `${log.finalStock} kg` : '—'}
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-slate-700 text-xs sm:text-sm">
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 font-black text-sky-900 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-md w-fit text-[11px]">
                                <User size={11} />
                                <span>{log.supplierName}</span>
                              </span>
                              {log.notes && (
                                <span className="text-[10.5px] text-slate-500 italic max-w-xs truncate" title={log.notes}>
                                  {log.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 sm:py-3 sm:px-3.5 text-[10.5px] sm:text-xs font-mono text-slate-600">
                            <div className="flex items-center justify-between gap-1">
                              <span>{log.performedBy || 'admin'}</span>
                              <button
                                type="button"
                                onClick={() => handlePrintAuditLogInvoice(log)}
                                className="p-1 rounded-lg text-white bg-orange-600 hover:bg-orange-700 transition-all cursor-pointer shrink-0 shadow-2xs flex items-center justify-center"
                                title="Print Full Consignment Voucher"
                              >
                                <Printer size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // Standard Individual Row
                    return (
                      <tr key={log._id} className="hover:bg-[#FAF3E8] transition-colors">
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs sm:text-sm">{dt.dateStr}</div>
                          <div className="text-[10px] sm:text-[11px] font-mono text-slate-500">{dt.timeStr}</div>
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-bold text-slate-900 text-xs sm:text-sm whitespace-normal break-words">
                          {log.itemName}
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold border ${
                            log.type?.includes('Procurement') || log.type?.includes('Stock-In')
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                              : log.type?.includes('Reversal') || log.type?.includes('Refund')
                                ? 'bg-blue-100 border-blue-300 text-blue-800'
                                : log.type?.includes('Wastage')
                                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                                  : 'bg-rose-100 border-rose-300 text-rose-800'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className={`py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono font-bold text-xs sm:text-sm whitespace-nowrap ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isPositive ? `+${log.quantityChange}` : log.quantityChange} kg
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 font-mono text-slate-900 font-bold text-xs sm:text-sm whitespace-nowrap">
                          {log.finalStock !== undefined ? `${log.finalStock} kg` : '-'}
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-slate-700 text-xs sm:text-sm">
                          {log.supplierName ? (
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-md w-fit text-[10px] sm:text-[11px]">
                                  <User size={10} />
                                  <span>{log.supplierName}</span>
                                </span>
                                {log.invoiceNo && (
                                  <span className="font-mono text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1 py-0.2 rounded" title={`Consignment Invoice: ${log.invoiceNo}`}>
                                    {log.invoiceNo}
                                  </span>
                                )}
                              </div>
                              {log.notes && (
                                <span className="text-[10px] sm:text-[10.5px] text-slate-500 italic max-w-xs truncate" title={log.notes}>
                                  {log.notes}
                                </span>
                              )}
                            </div>
                          ) : log.billNumber ? (
                            <span className="font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10.5px] sm:text-xs">
                              Bill #{log.billNumber}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 sm:py-2.5 sm:px-3.5 text-[10.5px] sm:text-xs font-mono text-slate-600">
                          <div className="flex items-center justify-between gap-1">
                            <span>{log.performedBy || 'admin'}</span>
                            {(log.supplierName || log.type?.includes('Stock-In') || log.type?.includes('Procurement') || log.type?.includes('Dam')) && (
                              <button
                                type="button"
                                onClick={() => handlePrintAuditLogInvoice(log)}
                                className="p-1 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all cursor-pointer shrink-0"
                                title="Print A4 Inward Invoice"
                              >
                                <Printer size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Pagination for Audit Trail (Mobile Responsive) */}
          <div className="p-3 sm:p-4 border-t border-[#fed7aa]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs sm:text-sm text-slate-600">
            <span className="font-medium">
              Showing {(logsPage - 1) * LOGS_PER_PAGE + 1} to {Math.min(groupedStockLogs.length, logsPage * LOGS_PER_PAGE)} of {groupedStockLogs.length} entries
            </span>
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                disabled={logsPage <= 1}
                onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Previous
              </button>
              <span className="px-3 py-1 bg-sky-50 border border-sky-200 rounded-xl text-xs sm:text-sm font-black font-mono text-sky-900">
                {logsPage} / {totalLogsPages}
              </span>
              <button
                type="button"
                disabled={logsPage >= totalLogsPages}
                onClick={() => setLogsPage(p => Math.min(totalLogsPages, p + 1))}
                className="px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-xl bg-white border border-[#E8DCCB] hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold text-xs sm:text-sm shadow-2xs transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Supplier Relationship Management (SRM Hub) ── */}
      {activeTab === 'srm' && (
        <div className="w-full">
          <SupplierHub
            channel={currentDedicatedMode === 'dam' ? 'DAM' : (currentDedicatedMode === 'supplies' ? 'Consumables' : 'Local')}
            user={user}
            onNavigate={onNavigate}
            onGoBack={() => setActiveTab('procurement')}
          />
        </div>
      )}

      {/* Date Filter Modal for Mobile & Tablet Screen Sizes (< xl) */}
      {isDateFilterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 m-0">Filter Logs by Date</h3>
                  <p className="text-[11px] text-slate-500 m-0">Select start and end dates or choose a quick preset</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDateFilterModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-500 tracking-wider">Quick Presets</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(todayStr);
                    setEndDate(todayStr);
                  }}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    startDate === todayStr && endDate === todayStr
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs font-black'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setStartDate(d.toISOString().split('T')[0]);
                    setEndDate(todayStr);
                  }}
                  className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer transition-all"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    setStartDate(d.toISOString().split('T')[0]);
                    setEndDate(todayStr);
                  }}
                  className="py-1.5 px-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer transition-all"
                >
                  Last 30 Days
                </button>
              </div>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">From Date</label>
                <input
                  type="date"
                  value={startDate}
                  max={endDate || todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (endDate && val > endDate) setEndDate(val);
                    setStartDate(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">To Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={todayStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (startDate && val < startDate) setStartDate(val);
                    setEndDate(val);
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:outline-none focus:border-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Active Range Preview */}
            {(startDate || endDate) && (
              <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between text-xs text-sky-900 font-semibold">
                <span>Active: {startDate || 'Beginning'} → {endDate || 'Today'}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setIsDateFilterModalOpen(false);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Clear & Close
              </button>
              <button
                type="button"
                onClick={() => setIsDateFilterModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white shadow-2xs transition-all cursor-pointer"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Professional A4 Commercial Inward Invoice & Weighment Slip (For All 3 Modes) ── */}
      {inwardInvoiceModal && (
        <FishInwardInvoice
          data={inwardInvoiceModal}
          onClose={() => setInwardInvoiceModal(null)}
        />
      )}
    </div>
  );
}
