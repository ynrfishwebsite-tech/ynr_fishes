import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Package, 
  User, 
  Phone, 
  Building, 
  MapPin, 
  Search, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  Plus, 
  Minus, 
  Scale, 
  Truck, 
  DollarSign, 
  FileText, 
  Check, 
  X, 
  Sparkles,
  Layers,
  AlertCircle,
  Clock,
  Calendar,
  History,
  Trash2
} from 'lucide-react';
import { getItemPricePerKg, getItemSizeGrades, formatImageUrl, getItemWaterType } from '../catalog/MenuGrid';
import api from '../../../api/system/axios';

/**
 * Safely format customer address object or string to string to prevent React child crash
 */
export const formatAddress = (addr) => {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (typeof addr === 'object') {
    return addr.fullAddress || [addr.line1, addr.area, addr.city, addr.district, addr.state, addr.pincode].filter(Boolean).join(', ') || '';
  }
  return '';
};

/**
 * Wholesale & Export 3-Step Order Wizard Page
 * 
 * Step 1: All Menu Items / Fish Selection & Weight Details
 * Step 2: Customer Selection (Card Page with Big Photos, Attendance, Clear option for each dealer)
 * Step 3: Overall Preview Detail (Big Fish Photo + Big Customer Photo, Net Amount, Grouping Strategy)
 * 
 * Strict Constraint: Only active in Wholesale ('bulk') or Export ('export') modes.
 * Does NOT affect or disturb Retail mode in any way.
 */
export default function WholesaleOrderWizardModal({
  isOpen = true,
  onClose,
  fishOrderMode = 'bulk', // 'bulk' | 'export'
  initialFish = null,
  initialCustomer = null,
  availableFishList = [],
  customersList = [],
  openOrdersList = [],
  onSaveItemToCustomerOrder, // (itemPayload, customerObj) => Promise<boolean>
  onClearCustomerOrder = null, // (customerObj) => Promise<boolean>
  showToast
}) {
  if (isOpen === false) return null;

  const isExport = fishOrderMode === 'export';
  const modeTitle = isExport ? 'Export' : 'Wholesale';
  const modeBadgeColor = isExport 
    ? 'bg-blue-600 text-white' 
    : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white';

  // ── LocalStorage State Persistence: Survives full browser refresh across all 3 steps ──
  const STORAGE_KEY = `wholesale_wizard_data_${fishOrderMode || 'bulk'}`;

  const savedWizardData = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [STORAGE_KEY]);

  // ── Step State: 1 = Fish & Weight, 2 = Customer Cards, 3 = Overall Preview ──
  const [currentStep, setCurrentStep] = useState(() => savedWizardData?.currentStep || 1);

  // ── Step 1: Selected Fish & Weights ──
  const [selectedFish, setSelectedFish] = useState(() => savedWizardData?.selectedFish || initialFish || availableFishList[0] || null);
  const [sizeGrade, setSizeGrade] = useState(() => savedWizardData?.sizeGrade || 'medium');
  const [weightKg, setWeightKg] = useState(() => savedWizardData?.weightKg ?? '1'); // Initial weight default is 1 Kg
  const [weightGrams, setWeightGrams] = useState(() => savedWizardData?.weightGrams ?? '');
  const [boxesCount, setBoxesCount] = useState(() => savedWizardData?.boxesCount ?? '1');
  const [ratePerKg, setRatePerKg] = useState(() => savedWizardData?.ratePerKg ?? '');
  // ── Flexible Lot Charges with Cr. / Dr. and Custom Category Support ──
  const [lotCharges, setLotCharges] = useState(() => savedWizardData?.lotCharges || [
    { id: 'ice', name: 'Ice', amount: '', type: 'Cr', isCustom: false },
    { id: 'box', name: 'Boxes', amount: '', type: 'Cr', isCustom: false },
    { id: 'trans', name: 'Trans', amount: '', type: 'Cr', isCustom: false }
  ]);
  const [showAddChargeInput, setShowAddChargeInput] = useState(false);
  const [newCustomChargeName, setNewCustomChargeName] = useState('');
  const [notes, setNotes] = useState(() => savedWizardData?.notes ?? '');

  // ── Step 3: Rate, Discount & Total Handlers ──
  const [discountType, setDiscountType] = useState(() => savedWizardData?.discountType || 'flat'); // 'flat' (₹) | 'percentage' (%)
  const [discountValue, setDiscountValue] = useState(() => savedWizardData?.discountValue ?? '');
  const [editableTotal, setEditableTotal] = useState(() => savedWizardData?.editableTotal ?? '');
  const step2ContainerRef = useRef(null);

  // Number input focus helper: if value is '0' or '0.00', clear to empty string immediately; otherwise select text
  const handleNumberInputFocus = (e, val, setter) => {
    if (val === '0' || val === 0 || val === '0.00') {
      setter('');
    } else {
      e.target.select();
    }
  };

  const handleUpdateChargeAmount = (id, val) => {
    setLotCharges(prev => prev.map(c => c.id === id ? { ...c, amount: val } : c));
  };

  const handleToggleChargeType = (id) => {
    setLotCharges(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, type: c.type === 'Dr' ? 'Cr' : 'Dr' };
      }
      return c;
    }));
  };

  const handleAddCategoryCharge = (chargeName, defaultType = 'Cr') => {
    const trimmed = (chargeName || '').trim();
    if (!trimmed) return;
    const exists = lotCharges.some(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      if (showToast) showToast(`Charge category "${trimmed}" already exists`, 'info');
      return;
    }
    const newCharge = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: trimmed,
      amount: '0',
      type: defaultType,
      isCustom: true
    };
    setLotCharges(prev => [...prev, newCharge]);
    setNewCustomChargeName('');
    setShowAddChargeInput(false);
  };

  const handleRemoveCategoryCharge = (id) => {
    setLotCharges(prev => prev.filter(c => c.id !== id));
  };

  // ── Step 2: Customer Card Selection & Search ──
  const [selectedCustomer, setSelectedCustomer] = useState(() => savedWizardData?.selectedCustomer || initialCustomer || null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [exportSubFilter, setExportSubFilter] = useState('All');
  // Local presence overrides map: phone or ID -> 'Present' | 'Absent'
  const [localPresenceMap, setLocalPresenceMap] = useState({});

  // Sync initialCustomer from dial CRM popup into selectedCustomer
  useEffect(() => {
    if (initialCustomer && !selectedCustomer) {
      const fullMatch = (customersList || []).find(c =>
        (initialCustomer._id && (c._id === initialCustomer._id || c.id === initialCustomer._id)) ||
        (initialCustomer.phone && c.phone && c.phone.replace(/\D/g, '').slice(-10) === initialCustomer.phone.replace(/\D/g, '').slice(-10)) ||
        (initialCustomer.name && c.name && c.name.trim().toLowerCase() === initialCustomer.name.trim().toLowerCase())
      );
      setSelectedCustomer(fullMatch || initialCustomer);
    }
  }, [initialCustomer, customersList]);

  // ── Step 3: Saved Confirmation Dialog ──
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [lastSavedSummary, setLastSavedSummary] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-save wizard state to localStorage across all steps so browser reload never erases entered data
  useEffect(() => {
    try {
      const dataToSave = {
        currentStep,
        selectedFish,
        sizeGrade,
        weightKg,
        weightGrams,
        boxesCount,
        ratePerKg,
        lotCharges,
        notes,
        selectedCustomer,
        discountType,
        discountValue,
        editableTotal,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {}
  }, [
    STORAGE_KEY,
    currentStep,
    selectedFish,
    sizeGrade,
    weightKg,
    weightGrams,
    boxesCount,
    ratePerKg,
    lotCharges,
    notes,
    selectedCustomer,
    discountType,
    discountValue,
    editableTotal,
  ]);

  const handleCloseWizard = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('billing_show_wholesale_wizard');
      localStorage.removeItem('billing_wholesale_wizard_fish');
      localStorage.removeItem('billing_wholesale_available_fish');
    } catch (e) {}
    if (onClose) onClose();
  };

  // Sync initial fish if prop changes
  useEffect(() => {
    if (initialFish && (!selectedFish || initialFish._id !== selectedFish._id)) {
      setSelectedFish(initialFish);
    }
  }, [initialFish]);

  // Real size grades from Menu Management configuration
  const availableGrades = useMemo(() => {
    const list = getItemSizeGrades(selectedFish, fishOrderMode);
    if (list && list.length > 0) return list;
    return [
      { key: 'small', label: 'Small', price: getItemPricePerKg(selectedFish, fishOrderMode, 'small') },
      { key: 'medium', label: 'Medium', price: getItemPricePerKg(selectedFish, fishOrderMode, 'medium') },
      { key: 'big', label: 'Big', price: getItemPricePerKg(selectedFish, fishOrderMode, 'big') }
    ];
  }, [selectedFish, fishOrderMode]);

  // Sync size grades & default rate whenever selected fish or grade changes
  useEffect(() => {
    if (!selectedFish) return;
    const grades = getItemSizeGrades(selectedFish, fishOrderMode);
    const validGrade = grades.some(g => g.key === sizeGrade) ? sizeGrade : (grades[0]?.key || 'medium');
    const autoRate = getItemPricePerKg(selectedFish, fishOrderMode, validGrade);
    setSizeGrade(validGrade);
    setRatePerKg(String(autoRate || selectedFish.price || 0));
  }, [selectedFish, fishOrderMode]);

  // Handle grade change
  const handleGradeChange = (gradeKey) => {
    setSizeGrade(gradeKey);
    const autoRate = getItemPricePerKg(selectedFish, fishOrderMode, gradeKey);
    setRatePerKg(String(autoRate || selectedFish.price || 0));
  };

  // Calculations
  const totalNetKg = useMemo(() => {
    const kg = parseFloat(weightKg) || 0;
    const g = (parseFloat(weightGrams) || 0) / 1000;
    return Math.max(0, kg + g);
  }, [weightKg, weightGrams]);

  const baseItemAmount = useMemo(() => {
    const rate = parseFloat(ratePerKg) || 0;
    return totalNetKg * rate;
  }, [totalNetKg, ratePerKg]);

  // Assigned charges: only charges with amount > 0
  const assignedCharges = useMemo(() => {
    return lotCharges.filter(c => (parseFloat(c.amount) || 0) > 0);
  }, [lotCharges]);

  // Net Other Charges: Cr. adds (+), Dr. deducts (-)
  const netOtherCharges = useMemo(() => {
    return assignedCharges.reduce((acc, c) => {
      const val = parseFloat(c.amount) || 0;
      return c.type === 'Dr' ? acc - val : acc + val;
    }, 0);
  }, [assignedCharges]);

  // Original calculated total before discount
  const originalCalculatedTotal = useMemo(() => {
    return Math.max(0, baseItemAmount + netOtherCharges);
  }, [baseItemAmount, netOtherCharges]);

  // Calculate effective discount in flat rupees
  const effectiveDiscountInRupees = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0 || originalCalculatedTotal <= 0) return 0;
    if (discountType === 'percentage') {
      const pct = Math.min(100, Math.max(0, val));
      return (originalCalculatedTotal * pct) / 100;
    }
    return val;
  }, [discountValue, discountType, originalCalculatedTotal]);

  // Keep editableTotal in sync when original total or effective discount changes
  useEffect(() => {
    const finalTot = Math.max(0, originalCalculatedTotal - effectiveDiscountInRupees);
    setEditableTotal(finalTot > 0 ? String(finalTot.toFixed(2)) : '');
  }, [originalCalculatedTotal, effectiveDiscountInRupees]);

  // Toggle between flat rupees (₹) and percentage (%) with auto adjustment
  const handleToggleDiscountType = (targetType) => {
    if (targetType === discountType) return;
    const currentRupees = effectiveDiscountInRupees;
    if (targetType === 'percentage') {
      // Auto-adjust flat rupees into percentage
      if (currentRupees > 0 && originalCalculatedTotal > 0) {
        const pct = (currentRupees / originalCalculatedTotal) * 100;
        setDiscountValue(String(parseFloat(pct.toFixed(2))));
      }
      setDiscountType('percentage');
    } else {
      // Auto-adjust percentage into flat rupees
      if (currentRupees > 0) {
        setDiscountValue(String(parseFloat(currentRupees.toFixed(2))));
      }
      setDiscountType('flat');
    }
  };

  // When user enters discount in Step 3
  const handleDiscountValueChange = (val) => {
    setDiscountValue(val);
    const num = parseFloat(val) || 0;
    let eff = 0;
    if (num > 0 && originalCalculatedTotal > 0) {
      eff = discountType === 'percentage' ? (originalCalculatedTotal * Math.min(100, num)) / 100 : num;
    }
    const newTot = Math.max(0, originalCalculatedTotal - eff);
    setEditableTotal(newTot > 0 ? String(newTot.toFixed(2)) : '0');
  };

  // When user directly enters/edits Total Payable Amount in Step 3:
  // "if I entered the total amout is less than original amount it should be automatically take discount"
  const handleTotalAmountChange = (val) => {
    setEditableTotal(val);
    if (val === '') {
      setDiscountValue('');
      return;
    }
    const enteredTot = parseFloat(val) || 0;
    if (enteredTot < originalCalculatedTotal) {
      const autoRupees = originalCalculatedTotal - enteredTot;
      if (discountType === 'percentage') {
        const pct = (autoRupees / originalCalculatedTotal) * 100;
        setDiscountValue(pct.toFixed(2));
      } else {
        setDiscountValue(autoRupees.toFixed(2));
      }
    } else {
      setDiscountValue('');
    }
  };

  // Grand item total taking discount and editableTotal into account
  const grandItemTotal = useMemo(() => {
    if (editableTotal !== '' && !isNaN(parseFloat(editableTotal))) {
      return Math.max(0, parseFloat(editableTotal));
    }
    return Math.max(0, originalCalculatedTotal - effectiveDiscountInRupees);
  }, [originalCalculatedTotal, effectiveDiscountInRupees, editableTotal]);

  // Dynamic Bracket Title for Other Charges: e.g. "Other Charges (Ice + Box + Trans):"
  const dynamicOtherChargesBracketText = useMemo(() => {
    if (assignedCharges.length === 0) return 'Other Charges:';
    return `Other Charges (${assignedCharges.map(c => c.name).join(' + ')}):`;
  }, [assignedCharges]);

  // ── Build Map of Today's Active Orders by Customer ──
  // Determines attendance ("Present" vs "Absent") and if customer already has a bill ("Already Selected")
  const customerTodayOrdersMap = useMemo(() => {
    const map = {}; // phone or name -> { orderId, tableNo, itemsCount, totalWeight, totalAmount }
    const todayStr = new Date().toISOString().split('T')[0];

    (openOrdersList || []).forEach(order => {
      if (!order) return;
      // Filter for this mode
      const isExp = order.customerCategory === 'Export' || order.orderMode === 'export' || String(order.tableNo || '').startsWith('EXP-');
      const isWs = !isExp && (order.customerCategory === 'Wholesale' || order.orderMode === 'bulk' || String(order.tableNo || '').startsWith('WS-'));

      if (isExport && !isExp) return;
      if (!isExport && !isWs) return;

      const key = (order.customerPhone || order.customerName || '').trim().toLowerCase();
      if (!key) return;

      const items = Array.isArray(order.items) ? order.items : [];
      const nonCancelledItems = items.filter(i => !i.isCancelled);
      const totalAmount = nonCancelledItems.reduce((sum, it) => sum + (Number(it.total) || (Number(it.price || 0) * Number(it.quantity || 1))), 0);
      const totalWt = nonCancelledItems.reduce((sum, it) => sum + (Number(it.enteredWeight || it.netWeightKg || it.weight || 0)), 0);

      map[key] = {
        orderId: order._id,
        tableNo: order.tableNo,
        itemsCount: nonCancelledItems.length,
        totalWeight: totalWt,
        totalAmount: totalAmount,
        orderDate: order.createdAt
      };
    });

    return map;
  }, [openOrdersList, isExport]);

  // Filter customers for Step 2
  const filteredCustomers = useMemo(() => {
    const targetCategory = isExport ? 'Export' : 'Wholesale';
    const q = customerSearch.trim().toLowerCase();

    return (customersList || [])
      .filter(c => {
        if (!c) return false;
        // Match category
        const cat = c.category || (c.lastOrderType === 'Export' ? 'Export' : 'Wholesale');
        if (isExport && cat !== 'Export') return false;
        if (!isExport && cat !== 'Wholesale' && cat !== 'Dealer') return false;

        if (isExport && exportSubFilter !== 'All') {
          if (c.exportSubCategory !== exportSubFilter) return false;
        }

        if (!q) return true;
        const addrStr = formatAddress(c.address).toLowerCase();
        return (
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.businessName && typeof c.businessName === 'string' && c.businessName.toLowerCase().includes(q)) ||
          addrStr.includes(q)
        );
      })
      .sort((a, b) => {
        // Priority 1: SELECTED customer ALWAYS comes first (#1 at top of list)!
        const aSelected = selectedCustomer && (selectedCustomer._id === a._id || (selectedCustomer.phone && selectedCustomer.phone === a.phone));
        const bSelected = selectedCustomer && (selectedCustomer._id === b._id || (selectedCustomer.phone && selectedCustomer.phone === b.phone));
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;

        // Priority 2: Customers who are already present / have orders today come next
        const aPres = (localPresenceMap[(a.phone || a.name || '').trim().toLowerCase()] === 'Present') || 
                      Boolean(customerTodayOrdersMap[(a.phone || a.name || '').trim().toLowerCase()]) || 
                      Boolean(a.isPresentToday);
        const bPres = (localPresenceMap[(b.phone || b.name || '').trim().toLowerCase()] === 'Present') || 
                      Boolean(customerTodayOrdersMap[(b.phone || b.name || '').trim().toLowerCase()]) || 
                      Boolean(b.isPresentToday);
        if (aPres && !bPres) return -1;
        if (!aPres && bPres) return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [customersList, isExport, exportSubFilter, customerSearch, customerTodayOrdersMap, localPresenceMap, selectedCustomer]);

  // ── Helper to evaluate presence from local state, active bills, or database ──
  const getCustomerPresence = (cust) => {
    if (!cust) return false;
    const custKey = (cust.phone || cust.name || '').trim().toLowerCase();
    
    // 1. Session override
    if (localPresenceMap[custKey] !== undefined) {
      return localPresenceMap[custKey] === 'Present';
    }
    // 2. Active orders today
    if (customerTodayOrdersMap[custKey]) {
      return true;
    }
    // 3. Stored from backend MongoDB (isPresentToday flag)
    if (cust.isPresentToday !== undefined) {
      return Boolean(cust.isPresentToday);
    }
    // 4. Stored in dailyPresence array from MongoDB
    const todayStr = new Date().toISOString().split('T')[0];
    if (Array.isArray(cust.dailyPresence)) {
      const rec = cust.dailyPresence.find(p => p.date === todayStr);
      if (rec) return rec.status === 'Present';
    }
    return false;
  };

  // Dealer Stats (Present vs Absent)
  const dealerStats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    filteredCustomers.forEach(c => {
      if (getCustomerPresence(c)) presentCount++;
      else absentCount++;
    });
    return {
      total: filteredCustomers.length,
      present: presentCount,
      absent: absentCount
    };
  }, [filteredCustomers, localPresenceMap, customerTodayOrdersMap]);

  // ── Navigation Handlers ──
  const handleProceedToCustomerSelect = () => {
    if (!selectedFish) {
      if (showToast) showToast('Please select a fish item', 'error');
      return;
    }
    if (totalNetKg <= 0) {
      if (showToast) showToast('Please enter a valid weight in Kg', 'error');
      return;
    }
    const rate = parseFloat(ratePerKg) || 0;
    if (rate <= 0) {
      if (showToast) showToast('Please enter a valid rate per Kg', 'error');
      return;
    }
    setCurrentStep(2);
  };

  // Select Customer Card: marks selected, marks Present in local state and DB, DOES NOT advance page
  const handleSelectCustomerCard = async (customer) => {
    setSelectedCustomer(customer);

    // Automatically scroll Step 2 container up to the top so selected member at #1 is in full view!
    if (step2ContainerRef.current) {
      step2ContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const custKey = (customer.phone || customer.name || '').trim().toLowerCase();

    // Mark as Present immediately in local state
    setLocalPresenceMap(prev => ({
      ...prev,
      [custKey]: 'Present'
    }));

    // Persist to MongoDB backend database!
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await api.post('/customers/presence', {
        customerId: customer._id,
        phone: customer.phone,
        date: todayStr,
        status: 'Present'
      });
      customer.isPresentToday = true;
    } catch (err) {
      console.warn('Could not persist customer presence to backend:', err.message);
    }

    // DO NOT NAVIGATE TO STEP 3! Stays on Step 2 so user can verify selection and change if needed!
  };

  // Toggle Customer Attendance (Present vs Absent) directly and persist to DB
  const handleToggleCustomerPresence = async (e, customer) => {
    e.stopPropagation();
    const currentIsPresent = getCustomerPresence(customer);
    const newStatus = currentIsPresent ? 'Absent' : 'Present';
    const custKey = (customer.phone || customer.name || '').trim().toLowerCase();

    setLocalPresenceMap(prev => ({
      ...prev,
      [custKey]: newStatus
    }));

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await api.post('/customers/presence', {
        customerId: customer._id,
        phone: customer.phone,
        date: todayStr,
        status: newStatus
      });
      customer.isPresentToday = (newStatus === 'Present');
      if (showToast) {
        showToast(`${customer.name} marked ${newStatus} for today in database`, 'info');
      }
    } catch (err) {
      console.warn('Could not toggle customer presence in database:', err.message);
    }
  };

  const handleBackToStep2 = () => {
    // "after clicked back -> same previous item selected with same weight but with different customer selection"
    // Preserves selectedFish, weightKg, weightGrams, sizeGrade, ratePerKg!
    setCurrentStep(2);
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
  };

  const handleClearCustomerBill = async (customer) => {
    if (onClearCustomerOrder) {
      const ok = await onClearCustomerOrder(customer);
      if (ok && selectedCustomer && (selectedCustomer._id === customer._id || selectedCustomer.phone === customer.phone)) {
        setSelectedCustomer(null);
      }
    }
  };

  // ── Save to Consolidated Bill ──
  const handleConfirmSave = async () => {
    if (!selectedFish || !selectedCustomer || totalNetKg <= 0) {
      if (showToast) showToast('Invalid item or customer selection', 'error');
      return;
    }

    try {
      setIsSaving(true);

      const customerKey = (selectedCustomer.phone || selectedCustomer.name || '').trim().toLowerCase();
      const existingOrderInfo = customerTodayOrdersMap[customerKey];

      // ONLY assigned charges (amount > 0) are stored in the database!
      const assignedChargesToSave = assignedCharges.map(c => ({
        name: c.name,
        amount: parseFloat(c.amount) || 0,
        type: c.type === 'Dr' ? 'Dr' : 'Cr'
      }));

      const iceVal = assignedChargesToSave.find(c => c.name.toLowerCase() === 'ice')?.amount || 0;
      const boxVal = assignedChargesToSave.find(c => c.name.toLowerCase().startsWith('box'))?.amount || 0;
      const transVal = assignedChargesToSave.find(c => c.name.toLowerCase().startsWith('trans'))?.amount || 0;

      const itemPayload = {
        menuItem: selectedFish._id,
        originalId: selectedFish._id,
        name: `${selectedFish.name} (${sizeGrade.toUpperCase()})`,
        price: parseFloat(ratePerKg) || selectedFish.price || 0,
        pricePerKg: parseFloat(ratePerKg) || selectedFish.price || 0,
        quantity: totalNetKg,
        enteredWeight: totalNetKg,
        netWeightKg: totalNetKg,
        grossWeightKg: totalNetKg,
        sellingUnit: 'Kg',
        total: grandItemTotal,
        sizeGrade: sizeGrade,
        boxesCount: parseInt(boxesCount) || 1,
        // Only assigned custom & standard charges are saved in DB:
        additionalCharges: assignedChargesToSave,
        iceCharges: iceVal,
        boxCharges: boxVal,
        transportCharges: transVal,
        orderMode: fishOrderMode,
        pricingTier: isExport ? 'export' : 'wholesale',
        isWholesaleBox: true,
        discount: effectiveDiscountInRupees,
        discountType: discountType,
        discountValue: parseFloat(discountValue) || 0,
        notes: notes || '',
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerCategory: isExport ? 'Export' : 'Wholesale'
      };

      if (onSaveItemToCustomerOrder) {
        await onSaveItemToCustomerOrder(itemPayload, selectedCustomer, existingOrderInfo);
      }

      const savedCustName = selectedCustomer.name;
      const savedFishName = selectedFish?.name || 'Seafood';
      const savedWeight = totalNetKg;

      setLastSavedSummary({
        fishName: savedFishName,
        customerName: savedCustName,
        customerPhone: selectedCustomer.phone,
        weightKg: savedWeight,
        grandTotal: grandItemTotal,
        discount: effectiveDiscountInRupees,
        discountType: discountType,
        isGrouped: Boolean(existingOrderInfo),
        previousItemsCount: existingOrderInfo?.itemsCount || 0
      });

      // Clear customer-specific fields for the next dealer
      setSelectedCustomer(null);
      setDiscountValue('');
      setEditableTotal('');

      // Option 1: Directly navigate to Step 2 (Dealer Cards) with exact same fish, weight, rate, size grade, and extra charges preserved!
      setCurrentStep(2);

      if (showToast) {
        showToast(`✅ Saved to ${savedCustName}'s bill! Pick next dealer for ${savedFishName} (${savedWeight.toFixed(2)} Kg)`, 'success');
      }
    } catch (err) {
      console.error('Error saving wholesale item:', err);
      if (showToast) showToast('Failed to save order item: ' + (err.message || 'Server error'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── "Circle Rotates" Flow Options After Save ──
  // Option A: Assign Next Customer for Same Fish & Same Weight (returns to Step 2)
  const handleAssignNextCustomerSameFish = () => {
    setShowSuccessDialog(false);
    setSelectedCustomer(null);
    setCurrentStep(2); // Keep same fish and same weight, pick next customer!
  };

  // Option B: Select Another Fish (returns to Step 1 / All Menu Items)
  const handleSelectAnotherFish = () => {
    setShowSuccessDialog(false);
    setSelectedCustomer(null);
    setCurrentStep(1); // Return to first step!
  };

  return (
    <div 
      className="w-full h-full flex-1 flex flex-col bg-[#FDFBF7] text-slate-800 overflow-hidden min-h-0 max-h-full relative"
      style={{ height: '100%', maxHeight: '100%', minHeight: 0 }}
    >
      {/* ── Direct Page Header & Breadcrumb Tracker ── */}
      <div className="bg-[#FAF0E4] border-b border-[#fed7aa] px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between shrink-0 sticky top-0 z-20 shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-lg text-[10.5px] sm:text-xs font-black uppercase tracking-wider shadow-2xs ${modeBadgeColor}`}>
            {modeTitle}
          </span>
          <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`hover:underline cursor-pointer ${currentStep === 1 ? 'text-[#ea580c] font-black underline underline-offset-4' : 'text-slate-600'}`}
            >
              1. Seafood
            </button>
            <span>➔</span>
            <button
              type="button"
              onClick={() => totalNetKg > 0 && setCurrentStep(2)}
              className={`hover:underline cursor-pointer ${currentStep === 2 ? 'text-[#ea580c] font-black underline underline-offset-4' : 'text-slate-600'}`}
            >
              2. Dealer Cards
            </button>
            <span>➔</span>
            <button
              type="button"
              onClick={() => selectedCustomer && setCurrentStep(3)}
              className={`hover:underline cursor-pointer ${currentStep === 3 ? 'text-[#ea580c] font-black underline underline-offset-4' : 'text-slate-600'}`}
            >
              3. Preview
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="sm:hidden text-[10.5px] font-black text-orange-900 bg-orange-100/90 px-2 py-0.5 rounded-md border border-orange-200">
            Step {currentStep} of 3
          </span>
          <button
            type="button"
            onClick={handleCloseWizard}
            className="p-1 rounded-lg bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-900 border border-[#E8DCCB] transition-all cursor-pointer shadow-2xs"
            title="Exit Wholesale Order Page"
          >
            <X size={14} />
          </button>
        </div>
      </div>

        {/* ── Step 1: All Menu Items / Fish Selection & Weight Details ── */}
        {currentStep === 1 && (
          <div 
            className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 sm:space-y-3 min-h-0 touch-pan-y overscroll-contain pb-6 sm:pb-8"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            {/* Top: Big Fish Photo Hero Banner (Entire Image Without Cropping, Badges Below Information) */}
            <div className="bg-white rounded-2xl border border-[#E8DCCB] shadow-2xs overflow-hidden">
              <div className="w-full h-32 sm:h-44 md:h-52 bg-slate-50 flex items-center justify-center p-2 overflow-hidden">
                {selectedFish?.image ? (
                  <img 
                    src={formatImageUrl(selectedFish.image)} 
                    alt={selectedFish.name} 
                    className="max-w-full max-h-full object-contain" 
                  />
                ) : (
                  <span className="text-6xl">🐟</span>
                )}
              </div>

              {/* Fish Big Name, Scientific Details & Badges BELOW the Image in Information Section */}
              <div className="p-3 sm:p-4 border-t border-[#E8DCCB] bg-[#FAF0E4]/30 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-center sm:text-left">
                  <div>
                    <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                      {selectedFish?.name || 'Seafood Catch'}
                    </h2>
                    {selectedFish?.scientificName && (
                      <p className="text-xs text-slate-500 italic font-medium mt-0.5">
                        {selectedFish.scientificName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges placed below the information section, NOT on the image */}
                <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start pt-1.5 border-t border-amber-200/50">
                  <span className="text-[10.5px] sm:text-xs font-black uppercase px-2.5 py-1 rounded-full bg-white text-emerald-800 border border-emerald-300 shadow-2xs">
                    {getItemWaterType(selectedFish) === 'sea_water' ? 'Sea Water' : 'Fresh Water'}
                  </span>
                  <span className="text-[10.5px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-white text-slate-700 border border-slate-300 shadow-2xs">
                    Current Stock: <strong className="text-slate-900 font-mono">{selectedFish?.stock || 0} Kg</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Size Grade Selection from Real Menu Management */}
            <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-[#E8DCCB] shadow-2xs space-y-1.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide block">
                Select Catch Size Grade:
              </span>
              <div className={`grid gap-1.5 sm:gap-2 ${
                availableGrades.length === 1 ? 'grid-cols-1' : availableGrades.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
              }`}>
                {availableGrades.map((gradeObj) => {
                  const grade = gradeObj.key;
                  const isSelected = sizeGrade === grade;
                  const gradeRate = gradeObj.price || getItemPricePerKg(selectedFish, fishOrderMode, grade);
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => handleGradeChange(grade)}
                      className={`p-1.5 sm:p-2 rounded-xl border-2 transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'border-[#ea580c] bg-orange-50/80 shadow-xs'
                          : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10.5px] sm:text-xs font-black uppercase block text-slate-800">
                        {gradeObj.label || grade} Grade
                      </span>
                      {gradeObj.range && (
                        <span className="text-[9px] text-slate-500 font-mono block">
                          {gradeObj.range}
                        </span>
                      )}
                      <span className="text-xs sm:text-sm font-mono font-black text-emerald-700 block mt-0.5">
                        ₹{gradeRate} <span className="text-[9.5px] font-sans font-medium text-slate-500">/Kg</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Form: Entered Weight & Charges */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Weight Inputs */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#E8DCCB] shadow-2xs space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Scale size={14} className="text-[#ea580c]" />
                  Enter Lot / Box Weight
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Weight (KG)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      onFocus={(e) => handleNumberInputFocus(e, weightKg, setWeightKg)}
                      onClick={(e) => { if (weightKg === '0' || weightKg === 0) setWeightKg(''); e.target.select(); }}
                      placeholder="0"
                      className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl px-3 py-2 text-base font-black font-mono text-slate-900 focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Grams (Optional)</label>
                    <input
                      type="number"
                      step="50"
                      min="0"
                      max="999"
                      value={weightGrams}
                      onChange={(e) => setWeightGrams(e.target.value)}
                      onFocus={(e) => handleNumberInputFocus(e, weightGrams, setWeightGrams)}
                      onClick={(e) => { if (weightGrams === '0' || weightGrams === 0) setWeightGrams(''); e.target.select(); }}
                      placeholder="0"
                      className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl px-3 py-2 text-base font-black font-mono text-slate-900 focus:outline-none focus:border-[#ea580c]"
                    />
                  </div>
                </div>

                {/* Quick Add Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 5, 10, 20, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => { setWeightKg(String(preset)); setWeightGrams(''); }}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-all cursor-pointer"
                    >
                      {preset} Kg
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setWeightKg(''); setWeightGrams(''); }}
                    className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all cursor-pointer flex items-center gap-0.5 ml-auto"
                    title="Clear weight fields"
                  >
                    <X size={11} />
                    <span>Clear</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Number of Boxes</label>
                    <input
                      type="number"
                      min="1"
                      value={boxesCount}
                      onChange={(e) => setBoxesCount(e.target.value)}
                      onFocus={(e) => handleNumberInputFocus(e, boxesCount, setBoxesCount)}
                      onClick={(e) => { if (boxesCount === '0' || boxesCount === 0) setBoxesCount(''); e.target.select(); }}
                      placeholder="1"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Rate / Kg (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={ratePerKg}
                      onChange={(e) => setRatePerKg(e.target.value)}
                      onFocus={(e) => handleNumberInputFocus(e, ratePerKg, setRatePerKg)}
                      onClick={(e) => { if (ratePerKg === '0' || ratePerKg === 0 || ratePerKg === '0.00') setRatePerKg(''); e.target.select(); }}
                      placeholder="0"
                      className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-2.5 py-1.5 text-xs font-bold font-mono text-emerald-900 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Other Charges & Live Total */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#E8DCCB] shadow-2xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                      <Truck size={14} className="text-sky-600" />
                      Additional Lot Charges
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddChargeInput(prev => !prev)}
                      className="px-2 py-0.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#ea580c] text-[10.5px] font-black border border-orange-200 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                      title="Add extra custom category charge"
                    >
                      <Plus size={12} />
                      <span>{showAddChargeInput ? 'Close' : 'Add Charge'}</span>
                    </button>
                  </div>

                  {/* Quick Preset Buttons / Custom Category Input */}
                  {showAddChargeInput && (
                    <div className="mb-2.5 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-in fade-in">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        Quick Add Extra Category:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { name: 'Hamali', type: 'Cr' },
                          { name: 'Loading', type: 'Cr' },
                          { name: 'Commission', type: 'Cr' },
                          { name: 'Cutting', type: 'Cr' },
                          { name: 'Packaging', type: 'Cr' },
                          { name: 'Rebate', type: 'Dr' }
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => handleAddCategoryCharge(preset.name, preset.type)}
                            className="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold border border-slate-300 shadow-2xs cursor-pointer active:scale-95 transition-all"
                          >
                            + {preset.name} {preset.type === 'Dr' ? '(Dr)' : ''}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Or type custom category name..."
                          value={newCustomChargeName}
                          onChange={(e) => setNewCustomChargeName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCategoryCharge(newCustomChargeName);
                            }
                          }}
                          className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCategoryCharge(newCustomChargeName)}
                          className="px-3 py-1 bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowAddChargeInput(false); setNewCustomChargeName(''); }}
                          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Category Charges Grid with Cr. / Dr. Toggle */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {lotCharges.map((charge) => {
                      const isDr = charge.type === 'Dr';
                      const amtVal = parseFloat(charge.amount) || 0;
                      return (
                        <div
                          key={charge.id}
                          className={`p-2 rounded-xl border transition-all ${
                            amtVal > 0
                              ? isDr
                                ? 'bg-rose-50/70 border-rose-300 shadow-2xs'
                                : 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1 gap-1">
                            <span 
                              className="text-[10px] font-black uppercase text-slate-700 truncate" 
                              title={charge.name}
                            >
                              {charge.name}
                            </span>
                            
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Cr. / Dr. Toggle Pill */}
                              <button
                                type="button"
                                onClick={() => handleToggleChargeType(charge.id)}
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95 ${
                                  isDr
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-2xs'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                }`}
                                title={isDr ? 'Debit / Deduction (-)' : 'Credit / Addition (+)'}
                              >
                                {isDr ? 'Dr. (-)' : 'Cr. (+)'}
                              </button>

                              {/* Remove custom charge */}
                              {charge.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCategoryCharge(charge.id)}
                                  className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer rounded"
                                  title="Delete category"
                                >
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Amount Input */}
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                              ₹
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={charge.amount}
                              onChange={(e) => handleUpdateChargeAmount(charge.id, e.target.value)}
                              onFocus={(e) => handleNumberInputFocus(e, charge.amount, (v) => handleUpdateChargeAmount(charge.id, v))}
                              onClick={(e) => { if (charge.amount === '0' || charge.amount === 0) handleUpdateChargeAmount(charge.id, ''); e.target.select(); }}
                              placeholder="0"
                              className={`w-full bg-white border rounded-lg pl-5 pr-2 py-1 text-xs font-bold font-mono focus:outline-none ${
                                amtVal > 0
                                  ? isDr
                                    ? 'border-rose-400 text-rose-900 focus:border-rose-600'
                                    : 'border-emerald-400 text-emerald-900 focus:border-emerald-600'
                                  : 'border-slate-300 text-slate-800 focus:border-[#ea580c]'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Amount Box */}
                <div className="bg-[#FAF0E4] p-3 rounded-xl border border-amber-300 space-y-1">
                  <div className="flex justify-between text-xs text-slate-600 font-medium">
                    <span>Base Fish Amount ({totalNetKg.toFixed(2)} Kg @ ₹{ratePerKg}):</span>
                    <span className="font-mono font-bold text-slate-800">₹{baseItemAmount.toFixed(2)}</span>
                  </div>

                  {assignedCharges.length > 0 && (
                    <div className={`flex justify-between text-xs font-semibold ${netOtherCharges < 0 ? 'text-rose-700' : 'text-sky-800'}`}>
                      <span className="truncate mr-2">
                        {dynamicOtherChargesBracketText}
                      </span>
                      <span className="font-mono font-bold shrink-0">
                        {netOtherCharges >= 0 ? `+ ₹${netOtherCharges.toFixed(2)}` : `- ₹${Math.abs(netOtherCharges).toFixed(2)}`}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1 border-t border-amber-300 text-sm font-black text-slate-900">
                    <span>Calculated Total:</span>
                    <span className="text-lg font-mono text-[#ea580c]">₹{grandItemTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Customer Details Card Modal Type (Cards Grid, NOT Dropdown) ── */}
        {currentStep === 2 && (
          <div 
            ref={step2ContainerRef} 
            className="flex-1 overflow-y-auto p-2.5 sm:p-4 flex flex-col space-y-2 sm:space-y-2.5 min-h-0 touch-pan-y overscroll-contain pb-6 sm:pb-8"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            {/* Top Toolbar: Search & Attendance Counters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-2 sm:p-2.5 rounded-xl border border-[#E8DCCB] shadow-2xs shrink-0">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dealer by name, mobile, shop, or location..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-lg pl-8 pr-7 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                />
                {customerSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700 bg-slate-200 rounded-full cursor-pointer transition-all"
                    title="Clear search"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>

              {/* Attendance Counts */}
              <div className="flex items-center gap-1 shrink-0 text-[11px] font-bold flex-wrap">
                <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  Total: {dealerStats.total}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Present: {dealerStats.present}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300">
                  Absent: {dealerStats.absent}
                </span>
              </div>
            </div>

            {/* Saved Notification Banner (Option 1 Flow) */}
            {lastSavedSummary && (
              <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-2 sm:px-3 sm:py-2 flex items-center justify-between gap-2 text-xs text-emerald-950 font-bold shrink-0 shadow-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <span>
                    Saved to <strong>{lastSavedSummary.customerName}</strong>'s bill (₹{lastSavedSummary.grandTotal?.toFixed(2)})!
                    {lastSavedSummary.isGrouped && (
                      <span className="text-emerald-700 ml-1 font-semibold">
                        (Grouped)
                      </span>
                    )}
                    <span className="text-emerald-800 ml-1">Tap next dealer below:</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setLastSavedSummary(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
                  title="Dismiss notification"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* Preserved Fish Banner reminder - Clean 2-Row Layout */}
            <div className="bg-amber-50/95 px-2.5 sm:px-3 py-1.5 rounded-xl border border-amber-300 flex flex-col gap-1 text-[11px] sm:text-xs text-amber-950 font-bold shrink-0 shadow-2xs">
              {/* Row 1: Assigning fish info and total price */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[9px] sm:text-[9.5px] px-1.5 py-0.2 rounded bg-amber-200/90 text-amber-900 font-black uppercase shrink-0">Assigning</span>
                  <span className="truncate text-slate-900 font-black text-[11px] sm:text-xs">
                    {selectedFish?.name} • <span className="font-mono text-emerald-800">{totalNetKg.toFixed(2)} Kg</span>
                    <span className="text-slate-500 font-medium ml-1">({sizeGrade} @ ₹{ratePerKg})</span>
                  </span>
                </div>
                <div className="font-mono font-black text-[#ea580c] shrink-0 text-xs sm:text-sm">
                  ₹{grandItemTotal.toFixed(0)}
                </div>
              </div>

              {/* Row 2: Selected Dealer Badge (Single Clear ✕ Button, no extra Clear link) */}
              {selectedCustomer && (
                <div className="flex items-center gap-1.5 pt-0.5 border-t border-amber-200/60">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-950 font-black border border-emerald-300 text-xs shadow-2xs">
                    <span>Dealer: <strong className="text-emerald-900">{selectedCustomer.name}</strong></span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedCustomer(null); }}
                      className="text-emerald-700 hover:text-red-600 hover:bg-emerald-200/80 rounded-full p-0.5 transition-colors cursor-pointer ml-0.5"
                      title="Clear selected dealer"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                </div>
              )}
            </div>

            {/* Grid of Customer Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5 flex-1 pr-1">
              {filteredCustomers.map((cust) => {
                const custKey = (cust.phone || cust.name || '').trim().toLowerCase();
                const existingOrder = customerTodayOrdersMap[custKey];
                const isPresent = getCustomerPresence(cust);
                const isSelected = selectedCustomer?._id === cust._id || selectedCustomer?.phone === cust.phone;

                return (
                  <div
                    key={cust._id || cust.phone}
                    onClick={() => handleSelectCustomerCard(cust)}
                    className={`rounded-2xl p-3.5 sm:p-4 border-2 transition-all cursor-pointer relative flex flex-col justify-between group shadow-xs hover:shadow-md active:scale-[0.99] ${
                      isSelected
                        ? 'border-[#ea580c] bg-orange-50/90 ring-4 ring-orange-300 shadow-md'
                        : isPresent
                        ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/60'
                        : 'border-[#E8DCCB] bg-white hover:border-[#ea580c] hover:bg-[#FAF0E4]/60'
                    }`}
                  >
                    {/* Top Row: Big Customer Photo + Attendance Badge */}
                    <div className="flex items-start gap-3.5 sm:gap-4">
                      {/* Big Customer Photo (Avatar) */}
                      <div className="w-22 h-22 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-slate-50 border-2 border-[#E8DCCB] group-hover:border-[#ea580c] shrink-0 shadow-sm flex items-center justify-center p-1">
                        {cust.photo ? (
                          <img 
                            src={formatImageUrl(cust.photo)} 
                            alt={cust.name} 
                            className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform" 
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-4xl rounded-xl">
                            {cust.name ? cust.name.charAt(0).toUpperCase() : <User size={36} />}
                          </div>
                        )}
                      </div>

                      {/* Customer Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-black text-base sm:text-xl text-slate-900 truncate block leading-snug">
                            {cust.name}
                          </h3>
                        </div>

                        {/* Interactive Attendance Badge: Present vs Absent (Persisted to Database) */}
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={(e) => handleToggleCustomerPresence(e, cust)}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-2xs transition-all cursor-pointer active:scale-95 ${
                              isPresent
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Click to toggle Present/Absent in database"
                          >
                            <span className={`w-2 h-2 rounded-full ${isPresent ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`}></span>
                            <span>{isPresent ? 'Present (Today)' : 'Absent (No Orders)'}</span>
                          </button>
                        </div>

                        {/* Phone Number */}
                        <div className="text-sm font-mono font-black text-slate-800 flex items-center gap-1 mt-1.5 truncate">
                          <Phone size={13} className="text-[#ea580c] shrink-0" />
                          <span>{cust.phone}</span>
                        </div>

                        {/* Shop / Business Name */}
                        {cust.businessName && (
                          <div className="text-xs font-bold text-slate-500 flex items-center gap-1 truncate mt-0.5">
                            <Building size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{typeof cust.businessName === 'string' ? cust.businessName : ''}</span>
                          </div>
                        )}

                        {/* Safely formatted address */}
                        {formatAddress(cust.address) && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                            <MapPin size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{formatAddress(cust.address)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Status / Selection Bar */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold gap-2">
                      {isSelected ? (
                        <span className="text-[#ea580c] font-black flex items-center gap-1">
                          <CheckCircle size={14} className="text-[#ea580c]" />
                          <span>Selected Dealer</span>
                        </span>
                      ) : existingOrder ? (
                        <span className="text-emerald-800 font-extrabold flex items-center gap-1">
                          <span>✓ In Bill: {existingOrder.itemsCount} items ({existingOrder.totalWeight?.toFixed(1) || 0} Kg)</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium">Daily Mandi Account</span>
                      )}

                      <div className="flex items-center gap-1.5 ml-auto">
                        {existingOrder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearCustomerBill(cust);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[10.5px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                            title="Clear today's active bill for this dealer"
                          >
                            <Trash2 size={11} className="text-rose-600 shrink-0" />
                            <span>Clear</span>
                          </button>
                        )}
                        <span className={`text-xs font-black transition-all ${
                          isSelected ? 'text-[#ea580c] underline' : 'text-slate-600 group-hover:text-[#ea580c]'
                        }`}>
                          {isSelected ? 'Selected ✓' : 'Select Dealer ➔'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Combined View in Table Format (Single Overview Page on Mobile) ── */}
        {currentStep === 3 && (
          <div 
            className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5 min-h-0 touch-pan-y overscroll-contain pb-6 sm:pb-8"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          >
            {/* Top Cards: BIG Images & BIG Names for Customer & Seafood Catch (Entire Images Uncropped, Badges Below Information) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              {/* Left: Dealer Customer with Entire Uncropped Image, Info & Badges Below */}
              <div className="bg-white rounded-2xl border-2 border-emerald-400 shadow-2xs overflow-hidden flex flex-col justify-between">
                {/* Entire Image Container (No Cropping, No Badges On Top of Image) */}
                <div className="w-full h-36 sm:h-48 bg-slate-50 border-b border-emerald-100 flex items-center justify-center p-1.5 sm:p-2 overflow-hidden">
                  {selectedCustomer?.photo ? (
                    <img 
                      src={formatImageUrl(selectedCustomer.photo)} 
                      alt={selectedCustomer.name} 
                      className="max-w-full max-h-full object-contain" 
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-4xl sm:text-5xl shadow-xs">
                      {selectedCustomer?.name ? selectedCustomer.name.charAt(0).toUpperCase() : <User size={44} />}
                    </div>
                  )}
                </div>

                {/* Information Section */}
                <div className="p-2.5 sm:p-3 text-center flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-sm sm:text-lg text-slate-900 leading-snug truncate w-full">
                      {selectedCustomer?.name}
                    </h3>
                    <div className="text-xs sm:text-sm font-mono font-black text-slate-700 flex items-center justify-center gap-1 mt-1 truncate">
                      <Phone size={11} className="text-[#ea580c] shrink-0" />
                      <span>{selectedCustomer?.phone}</span>
                    </div>
                    {selectedCustomer?.businessName && (
                      <div className="text-[10px] sm:text-xs font-semibold text-slate-400 truncate w-full mt-0.5">
                        {typeof selectedCustomer.businessName === 'string' ? selectedCustomer.businessName : ''}
                      </div>
                    )}
                  </div>

                  {/* Badge Placed BELOW Information Section, Not on Image */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                      {customerTodayOrdersMap[(selectedCustomer?.phone || selectedCustomer?.name || '').trim().toLowerCase()] || getCustomerPresence(selectedCustomer) ? '🟢 PRESENT' : 'DEALER'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Seafood Catch Item with Entire Uncropped Image, Info & Badges Below */}
              <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-2xs overflow-hidden flex flex-col justify-between">
                {/* Entire Image Container (No Cropping, No Badges On Top of Image) */}
                <div className="w-full h-36 sm:h-48 bg-slate-50 border-b border-amber-100 flex items-center justify-center p-1.5 sm:p-2 overflow-hidden">
                  {selectedFish?.image ? (
                    <img 
                      src={formatImageUrl(selectedFish.image)} 
                      alt={selectedFish.name} 
                      className="max-w-full max-h-full object-contain" 
                    />
                  ) : (
                    <span className="text-5xl sm:text-6xl">🐟</span>
                  )}
                </div>

                {/* Information Section */}
                <div className="p-2.5 sm:p-3 text-center flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-black text-sm sm:text-lg text-slate-900 leading-snug truncate w-full">
                      {selectedFish?.name}
                    </h3>
                    <div className="text-xs sm:text-sm font-mono font-black text-emerald-700 mt-1">
                      @ ₹{ratePerKg} <span className="text-[10px] font-sans font-medium text-slate-500">/Kg</span>
                    </div>
                    {selectedFish?.scientificName && (
                      <div className="text-[10px] sm:text-xs italic text-slate-400 truncate w-full mt-0.5">
                        {selectedFish.scientificName}
                      </div>
                    )}
                  </div>

                  {/* Badge Placed BELOW Information Section, Not on Image */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-orange-100 text-[#ea580c] border border-orange-300 shadow-2xs">
                      {sizeGrade} GRADE
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Breakdown Table (Weight, Rates & Net Payable - NO DUPLICATES) */}
            <div className="bg-white rounded-2xl border border-[#E8DCCB] shadow-2xs overflow-hidden">
              <div className="bg-[#FAF0E4] px-3 py-1.5 border-b border-[#E8DCCB] flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-amber-950 flex items-center gap-1">
                  <span>⚖️ Weight & Price Breakdown</span>
                </span>
                <span className="text-[10.5px] font-mono font-bold text-[#ea580c]">
                  {totalNetKg.toFixed(2)} Kg Lot
                </span>
              </div>

              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 font-semibold text-slate-500 text-xs w-1/2">Net Weight</td>
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                        {totalNetKg.toFixed(2)} Kg
                        {parseInt(boxesCount) > 1 && (
                          <span className="text-[10px] text-slate-500 font-normal ml-1">
                            ({boxesCount} Boxes)
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Editable Rate / Kg */}
                    <tr className="border-b border-slate-100 bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors">
                      <td className="py-1.5 px-3 font-semibold text-slate-700 text-xs">
                        Rate / Kg
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center gap-0.5 bg-white border border-emerald-300 rounded-lg px-2 py-0.5 shadow-2xs">
                          <span className="text-xs font-mono font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={ratePerKg}
                            onChange={(e) => setRatePerKg(e.target.value)}
                            onFocus={(e) => handleNumberInputFocus(e, ratePerKg, setRatePerKg)}
                            onClick={(e) => { if (ratePerKg === '0' || ratePerKg === 0 || ratePerKg === '0.00') setRatePerKg(''); e.target.select(); }}
                            placeholder="0"
                            className="w-16 sm:w-20 text-right font-mono font-black text-xs sm:text-sm text-emerald-900 focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400 font-medium">/Kg</span>
                        </div>
                      </td>
                    </tr>

                    {/* Base Fish Price */}
                    <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-1.5 px-3 font-semibold text-slate-500 text-xs">Base Price</td>
                      <td className="py-1.5 px-3 text-right font-mono font-black text-slate-900 text-xs">
                        ₹{baseItemAmount.toFixed(2)}
                      </td>
                    </tr>

                    {/* Assigned Additional Charges Breakdown */}
                    {assignedCharges.map((charge) => {
                      const isDr = charge.type === 'Dr';
                      const val = parseFloat(charge.amount) || 0;
                      return (
                        <tr key={charge.id} className={`border-b border-slate-100 ${isDr ? 'bg-rose-50/40' : 'bg-sky-50/40'}`}>
                          <td className="py-1.5 px-3 font-medium text-xs flex items-center gap-1">
                            <span className={isDr ? 'text-rose-800' : 'text-sky-800'}>
                              {charge.name}
                            </span>
                            <span className={`text-[9px] font-black px-1 rounded ${
                              isDr 
                                ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                              {isDr ? 'Dr' : 'Cr'}
                            </span>
                          </td>
                          <td className={`py-1.5 px-3 text-right font-mono font-bold text-xs ${isDr ? 'text-rose-700' : 'text-sky-900'}`}>
                            {isDr ? `-₹${val.toFixed(2)}` : `+₹${val.toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Consolidated Line with Dynamic Brackets: ONLY show when multiple charges to prevent duplicate single charge line! */}
                    {assignedCharges.length > 1 && (
                      <tr className="border-b border-slate-200 bg-slate-50/80 font-bold text-slate-700">
                        <td className="py-1 px-3 text-[10.5px] truncate max-w-[150px]">
                          {dynamicOtherChargesBracketText}
                        </td>
                        <td className={`py-1 px-3 text-right font-mono text-[10.5px] font-black ${netOtherCharges < 0 ? 'text-rose-700' : 'text-sky-900'}`}>
                          {netOtherCharges >= 0 ? `+ ₹${netOtherCharges.toFixed(2)}` : `- ₹${Math.abs(netOtherCharges).toFixed(2)}`}
                        </td>
                      </tr>
                    )}

                    {/* Discount Field with ₹ / % Toggle */}
                    <tr className="border-b border-slate-100 bg-amber-50/30 hover:bg-amber-50/50 transition-colors">
                      <td className="py-1.5 px-3 font-semibold text-amber-900 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>Discount</span>
                          {/* Toggle Button: Flat (₹) vs Percentage (%) */}
                          <div className="inline-flex rounded-md bg-amber-100/90 p-0.5 border border-amber-300">
                            <button
                              type="button"
                              onClick={() => handleToggleDiscountType('flat')}
                              className={`px-1.5 py-0.2 rounded text-[10px] font-black cursor-pointer transition-all active:scale-95 ${
                                discountType === 'flat'
                                  ? 'bg-[#ea580c] text-white shadow-2xs'
                                  : 'text-amber-800 hover:text-amber-950'
                              }`}
                              title="Flat Rupees Discount (₹)"
                            >
                              ₹
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleDiscountType('percentage')}
                              className={`px-1.5 py-0.2 rounded text-[10px] font-black cursor-pointer transition-all active:scale-95 ${
                                discountType === 'percentage'
                                  ? 'bg-[#ea580c] text-white shadow-2xs'
                                  : 'text-amber-800 hover:text-amber-950'
                              }`}
                              title="Percentage Discount (%)"
                            >
                              %
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center gap-0.5 bg-white border border-amber-300 rounded-lg px-2 py-0.5 shadow-2xs">
                          <span className="text-xs font-mono font-bold text-amber-600">
                            {discountType === 'flat' ? '-₹' : '-'}
                          </span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={discountType === 'percentage' ? 100 : undefined}
                            value={discountValue}
                            onChange={(e) => handleDiscountValueChange(e.target.value)}
                            onFocus={(e) => handleNumberInputFocus(e, discountValue, setDiscountValue)}
                            onClick={(e) => { if (discountValue === '0' || discountValue === 0 || discountValue === '0.00') setDiscountValue(''); e.target.select(); }}
                            placeholder="0"
                            className="w-16 sm:w-20 text-right font-mono font-black text-xs sm:text-sm text-amber-900 focus:outline-none"
                          />
                          {discountType === 'percentage' && (
                            <span className="text-[10px] font-bold text-amber-700 ml-0.5">%</span>
                          )}
                        </div>
                        {discountType === 'percentage' && effectiveDiscountInRupees > 0 && (
                          <div className="text-[9.5px] font-mono text-amber-700 mt-0.5">
                            (-₹{effectiveDiscountInRupees.toFixed(2)})
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Total Amount (Editable: Entering lower total automatically calculates Discount) */}
                    <tr className="bg-[#FAF0E4]/90 border-t-2 border-[#fed7aa]">
                      <td className="py-1.5 px-3 font-black text-slate-900 text-xs sm:text-sm">
                        <span>Total Amount</span>
                        {effectiveDiscountInRupees > 0 && (
                          <div className="text-[9.5px] font-normal text-slate-500">
                            Orig: ₹{originalCalculatedTotal.toFixed(0)}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right">
                        <div className="inline-flex items-center gap-0.5 bg-white border-2 border-[#ea580c] rounded-xl px-2 py-0.5 shadow-2xs">
                          <span className="text-xs sm:text-sm font-mono font-bold text-[#ea580c]">₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={editableTotal}
                            onChange={(e) => handleTotalAmountChange(e.target.value)}
                            onFocus={(e) => handleNumberInputFocus(e, editableTotal, setEditableTotal)}
                            onClick={(e) => { if (editableTotal === '0' || editableTotal === 0 || editableTotal === '0.00') setEditableTotal(''); e.target.select(); }}
                            placeholder="0.00"
                            className="w-20 sm:w-24 text-right font-mono font-black text-sm sm:text-base text-[#ea580c] focus:outline-none"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Page Footer with Responsive Compact Action Buttons (Always Docked at Bottom with Safe-Area) ── */}
        <div 
          className="bg-[#FAF0E4] border-t border-[#fed7aa] px-3 sm:px-5 py-2 sm:py-2.5 flex items-center justify-between shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] z-40 sticky bottom-0 gap-2"
          style={{ paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0.65rem))' }}
        >
          {/* Back button */}
          {currentStep === 1 ? (
            <button
              type="button"
              onClick={handleCloseWizard}
              className="min-h-[38px] px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black bg-white text-slate-700 hover:bg-slate-100 border border-[#E8DCCB] transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap flex items-center justify-center"
            >
              Cancel
            </button>
          ) : currentStep === 2 ? (
            <button
              type="button"
              onClick={handleBackToStep1}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black bg-white text-slate-700 hover:bg-slate-100 border border-[#E8DCCB] transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
            >
              <ArrowLeft size={14} />
              <span className="sm:hidden">Back</span>
              <span className="hidden sm:inline">Back to Weight</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleBackToStep2}
                className="min-h-[38px] inline-flex items-center gap-1 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-black bg-white text-slate-700 hover:bg-slate-100 border border-[#E8DCCB] transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                title="Return to Customer Selection"
              >
                <ArrowLeft size={14} />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setDiscountValue('');
                  setDiscountType('flat');
                  setEditableTotal('');
                  setCurrentStep(2);
                }}
                className="min-h-[38px] inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-black bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-xs active:scale-95 whitespace-nowrap"
                title="Clear selected dealer"
              >
                <X size={13} />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* Forward / Save action button */}
          {currentStep === 1 ? (
            <button
              type="button"
              onClick={handleProceedToCustomerSelect}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-orange-700 text-white shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="sm:hidden">Next: Dealer</span>
              <span className="hidden sm:inline">Next: Select Dealer</span>
              <ArrowRight size={14} />
            </button>
          ) : currentStep === 2 ? (
            <button
              type="button"
              disabled={!selectedCustomer}
              onClick={() => {
                if (!selectedCustomer) {
                  if (showToast) showToast('Please select a dealer card first', 'info');
                  return;
                }
                setCurrentStep(3);
              }}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap ${
                selectedCustomer
                  ? 'bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-orange-700 text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <span className="sm:hidden">Next: Preview</span>
              <span className="hidden sm:inline">Next: Preview (Step 3)</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmSave}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <CheckCircle size={15} />
              <span className="sm:hidden">{isSaving ? 'Saving...' : 'Confirm & Save'}</span>
              <span className="hidden sm:inline">{isSaving ? 'Saving Lot...' : 'Confirm & Save to Bill'}</span>
            </button>
          )}
        </div>

        {/* ── Success Dialog: "Circle Rotates" to Next Customer or First Step ── */}
        {showSuccessDialog && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 border-2 border-emerald-400 shadow-2xl text-center space-y-3.5 animate-in zoom-in-95 duration-150">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                <Check size={32} strokeWidth={3} />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Lot Saved Successfully!
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  <strong>{lastSavedSummary?.weightKg} Kg</strong> of <strong>{lastSavedSummary?.fishName}</strong> (₹{lastSavedSummary?.grandTotal.toFixed(2)}) has been added to <strong>{lastSavedSummary?.customerName}</strong>'s bill.
                </p>
                {lastSavedSummary?.isGrouped && (
                  <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 rounded-lg p-1 mt-1 border border-emerald-200">
                    Grouped with {lastSavedSummary.previousItemsCount} previous item(s) in single bill!
                  </p>
                )}
              </div>

              {/* Action Buttons: 2 clear directions from the handwritten notes */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleAssignNextCustomerSameFish}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-500 to-[#ea580c] hover:from-orange-600 hover:to-orange-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Assign Next Dealer (Same Fish & Weight)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectAnotherFish}
                  className="w-full py-2.5 px-4 bg-[#FAF0E4] hover:bg-[#F5E8D8] text-amber-900 border border-amber-300 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Package size={14} />
                  <span>Select Another Fish (First Step)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseWizard}
                  className="w-full py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  Close Wizard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
