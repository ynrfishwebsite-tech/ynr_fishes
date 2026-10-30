import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { getApiUrl } from '../../../config.js';
import { getCachedMenuItems } from '../../../db/offlineDb';
import { useLanguage } from '../../../context/LanguageContext';
import { Trash2, Plus, Minus, Search, User, Users, Clipboard, X, CheckCircle, UserCheck, ChevronUp, ChevronDown, PieChart, Loader2, Gift, Tags, Clock, AlertTriangle, Sparkles, CheckCircle2, Edit3, ShoppingBag } from 'lucide-react';
import { getOfferCategoryMeta, OFFER_CATEGORIES } from '../finance/DiscountConfig';

const BillSummary = ({
  orderId,
  cart,
  updateQuantity,
  updateItemNote,
  updateItemPrice,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  orderStatus,
  activeTable,
  onSaveOrder,
  onHoldOrder,
  onGenerateBill,
  onSettleBill,
  onPrintKOT,
  onPrintBill,
  onReopenOrder,
  onCancelOrder,
  onTransferTable,
  floors = [],
  onSelectTable,
  discount,
  setDiscount,
  walletRedemption,
  setWalletRedemption,
  taxRate,
  setTaxRate,
  billType,
  setBillType,
  loading,
  actionLoading,
  orderSource,
  setOrderSource,
  userRole = 'Admin',
  customerPhone,
  setCustomerPhone,
  customerName,
  setCustomerName,
  customerInfo,
  deliveryCharge,
  setDeliveryCharge,
  containerCharge,
  setContainerCharge,
  hasUnprintedItems = true,
  hasPendingChanges = false,
  openOrders = [],
  reservations = [],
  onOpenCustomerModal,
  onNavigate,
  onClearCart,
  showToast,
  autoWhatsappEnabled = false,
  onToggleAutoWhatsapp,
  isWhatsAppConnected = false,
  whatsappBillSentIds = new Set()
}) => {
  const { t, language } = useLanguage();
  const isBilledLocked = orderStatus === 'Billed' && !hasPendingChanges;
  const isLocked = orderStatus === 'Paid' || orderStatus === 'Cancelled' || isBilledLocked;
  const isCaptain = userRole === 'Captain';

  const cartEndRef = React.useRef(null);

  const [directPrintOnSave, setDirectPrintOnSave] = useState(() => {
    try {
      return localStorage.getItem('msbillings_direct_save') === 'true';
    } catch {
      return false;
    }
  });

  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showBilledEditModal, setShowBilledEditModal] = useState(false);

  useEffect(() => {
    const handleConfigChange = () => {
      try {
        setDirectPrintOnSave(localStorage.getItem('msbillings_direct_save') === 'true');
      } catch {}
    };
    window.addEventListener('printConfigChanged', handleConfigChange);
    return () => window.removeEventListener('printConfigChanged', handleConfigChange);
  }, []);

  const handleClearAllClick = () => {
    if (!cart || cart.length === 0) return;

    if (isBilledLocked) {
      if (showToast) {
        showToast(t("Order is saved & printed. Please click EDIT button to modify or clear items."), "warning");
      }
      setShowBilledEditModal(true);
      return;
    }

    if (orderStatus === 'Paid') {
      if (showToast) {
        showToast(t("Paid order cannot be modified or cleared."), "error");
      }
      return;
    }

    setShowClearConfirmModal(true);
  };

  const confirmClearAll = () => {
    setShowClearConfirmModal(false);
    if (setDiscount) {
      setDiscount({ type: 'flat', value: '', name: '' });
    }
    if (onClearCart) {
      onClearCart();
    } else if (cart && cart.length > 0) {
      cart.forEach((item) => {
        if (updateQuantity) {
          updateQuantity(item.itemKey || item._id || item.name, -item.quantity);
        }
      });
    }
  };

  // Keyboard Shortcuts F1 to F8 for POS
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          if (cart.length > 0 && orderStatus !== 'Paid' && !isBilledLocked && !(!!orderId && !hasPendingChanges) && actionLoading === null) {
            if (onSaveOrder) onSaveOrder();
          }
          break;
        case 'F2':
          e.preventDefault();
          if (cart.length > 0 && orderStatus !== 'Paid' && actionLoading === null) {
            if (onGenerateBill) onGenerateBill();
          }
          break;
        case 'F3':
          e.preventDefault();
          if (actionLoading === null && orderStatus !== 'Open' && (orderId || cart.length > 0)) {
            if (onReopenOrder) onReopenOrder();
          }
          break;
        case 'F4':
          e.preventDefault();
          if (actionLoading === null && orderStatus !== 'Paid' && (orderId || cart.length > 0)) {
            if (onCancelOrder) onCancelOrder();
          }
          break;
        case 'F5':
          e.preventDefault();
          if (cart.length > 0 && orderStatus !== 'Paid' && !loading && actionLoading === null) {
            setIsPaid(true);
            if (onSettleBill) onSettleBill();
          }
          break;
        case 'F6':
          e.preventDefault();
          if (!isLocked) {
            handleOpenOffersModal();
          }
          break;
        case 'F7':
          e.preventDefault();
          if (!isLocked) {
            if (discount?.type === 'complimentary') {
              setDiscount({ type: 'flat', value: '', name: '' });
            } else {
              setDiscount({ type: 'complimentary', value: '', name: 'Complimentary' });
            }
          }
          break;
        case 'F8':
          e.preventDefault();
          handleClearAllClick();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, orderStatus, isBilledLocked, isLocked, orderId, hasPendingChanges, actionLoading, loading, discount, onSaveOrder, onGenerateBill, onReopenOrder, onCancelOrder, onSettleBill]);

  useEffect(() => {
    if (cartEndRef.current) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cart.length]);

  const [isPaid, setIsPaid] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState('');
  const [useLoyalty, setUseLoyalty] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [showCharges, setShowCharges] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [isPrintConfigOpen, setIsPrintConfigOpen] = useState(false);

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [selectedCartItemForNote, setSelectedCartItemForNote] = useState(null);

  // Custom Delivery Platforms State (Full CRUD per shop)
  const [customPlatforms, setCustomPlatforms] = useState(() => {
    try {
      const saved = localStorage.getItem('msbillings_custom_delivery_platforms');
      return saved ? JSON.parse(saved) : ['Dunzo', 'Magicpin', 'Shadowfax'];
    } catch {
      return ['Dunzo', 'Magicpin', 'Shadowfax'];
    }
  });
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [loyaltyConfig, setLoyaltyConfig] = useState(null);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [loyaltyPointsDeducted, setLoyaltyPointsDeducted] = useState(0);
  const [newPlatformName, setNewPlatformName] = useState('');

  const handleAddPlatform = (e) => {
    if (e) e.preventDefault();
    const cleanName = (newPlatformName || '').trim();
    if (!cleanName) return;

    const allPlatforms = ['Direct', 'Swiggy', 'Zomato', ...customPlatforms];
    const exists = allPlatforms.some(p => p.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      alert(t('Platform already exists!'));
      return;
    }

    const updated = [...customPlatforms, cleanName];
    setCustomPlatforms(updated);
    localStorage.setItem('msbillings_custom_delivery_platforms', JSON.stringify(updated));
    setOrderSource(cleanName);
    setNewPlatformName('');
    setShowPlatformModal(false);
  };

  const handleDeletePlatform = (platformToDelete) => {
    const updated = customPlatforms.filter(p => p !== platformToDelete);
    setCustomPlatforms(updated);
    localStorage.setItem('msbillings_custom_delivery_platforms', JSON.stringify(updated));
    if (orderSource === platformToDelete) {
      setOrderSource('Direct');
    }
  };

  const [tenantDiscounts, setTenantDiscounts] = useState(() => {
    try {
      const cached = localStorage.getItem('resto_discounts_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [hasFetchedDiscounts, setHasFetchedDiscounts] = useState(() => {
    try {
      const cached = localStorage.getItem('resto_discounts_cache');
      return Boolean(cached && JSON.parse(cached).length > 0);
    } catch {
      return false;
    }
  });
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [offersModalCategoryFilter, setOffersModalCategoryFilter] = useState('All');
  const [cachedMenuMap, setCachedMenuMap] = useState({});

  useEffect(() => {
    getCachedMenuItems().then((items) => {
      if (items && Array.isArray(items)) {
        const map = {};
        items.forEach(i => {
          const catName = typeof i.category === 'object' && i.category !== null ? i.category.name : i.category;
          if (i.name) map[i.name.trim().toLowerCase()] = catName || '';
        });
        setCachedMenuMap(map);
      }
    }).catch(() => { });
  }, []);

  const checkCategoryMatch = (item, targetCategory) => {
    if (!targetCategory) return true;
    const targetNorm = String(targetCategory).trim().toLowerCase();

    // 1. Direct category on item (name or _id)
    let itemCat = '';
    if (item.category) {
      itemCat = typeof item.category === 'object' && item.category !== null ? (item.category.name || item.category._id) : item.category;
    }

    // 2. Cached menu lookup by item name (fallback for legacy order items)
    if (!itemCat && item.name && cachedMenuMap[item.name.trim().toLowerCase()]) {
      itemCat = cachedMenuMap[item.name.trim().toLowerCase()];
    }

    if (itemCat) {
      const itemCatNorm = String(itemCat).trim().toLowerCase();
      if (itemCatNorm === targetNorm || itemCatNorm.includes(targetNorm) || targetNorm.includes(itemCatNorm)) {
        return true;
      }
    }

    // 3. Fallback: check if item name contains the target category words (e.g., "Fish Fry Mandi (Full)" matches "Fish Mandi")
    if (item.name) {
      const itemNameNorm = item.name.toLowerCase();
      const targetWords = targetNorm.split(/\s+/).filter(w => w.length > 2);
      if (targetWords.length > 0 && targetWords.every(w => itemNameNorm.includes(w))) {
        return true;
      }
    }

    return false;
  };

  const isOfferValid = (d) => {
    if (!d || d.isActive === false) return false;
    if (d.hasTimeline && d.endDate) {
      try {
        const rawEnd = typeof d.endDate === 'string' ? d.endDate.split('T')[0] : new Date(d.endDate).toISOString().split('T')[0];
        const rawStart = d.startDate
          ? (typeof d.startDate === 'string' ? d.startDate.split('T')[0] : new Date(d.startDate).toISOString().split('T')[0])
          : rawEnd;
        const endStr = `${rawEnd}T${d.endTime || '23:59'}:59`;
        const startStr = `${rawStart}T${d.startTime || '00:00'}:00`;
        const now = new Date();
        const end = new Date(endStr);
        const start = new Date(startStr);
        if (now > end || now < start) return false;
      } catch {
        return true;
      }
    }
    return true;
  };

  const getOfferValidityStatus = (d) => {
    if (!d || d.isActive === false) return { label: 'Inactive', timeRemaining: '' };
    if (d.hasTimeline && d.endDate) {
      const endStr = `${d.endDate.split('T')[0]}T${d.endTime || '23:59'}:59`;
      const now = new Date();
      const end = new Date(endStr);
      if (now > end) {
        return { label: 'Expired', isExpired: true };
      }
      const diffMs = end - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        label: 'Active',
        timeRemaining: diffDays > 0 ? `${diffDays}d ${diffHours}h left` : `${diffHours}h left`
      };
    }
    return { label: 'Active', timeRemaining: 'Ongoing' };
  };

  const applyPresetOffer = (rule) => {
    if (!rule) return;
    if (!isOfferValid(rule)) {
      alert(t("This offer has expired or is not currently active."));
      return;
    }

    if (rule.type === 'bogo') {
      const buyQty = Math.max(1, Number(rule.buyQty) || 2);
      const getQty = Math.max(1, Number(rule.getQty) || 1);

      let bogoDiscount = 0;
      cart.forEach((item) => {
        const isCategoryMatch = rule.applicableTo === 'category'
          ? checkCategoryMatch(item, rule.targetCategory)
          : true;

        if (isCategoryMatch && item.quantity >= buyQty) {
          const freeSets = Math.floor(item.quantity / buyQty);
          const freeItems = freeSets * getQty;
          bogoDiscount += freeItems * (item.price || 0);
        }
      });

      if (bogoDiscount > 0) {
        setDiscount({
          type: 'flat',
          value: bogoDiscount,
          name: rule.name,
          offerName: rule.name,
          offerCategory: rule.offerCategory || 'Special offers',
          applicableTo: rule.applicableTo || 'all',
          targetCategory: rule.targetCategory || ''
        });
        setShowCharges(true);
        setShowOffersModal(false);
      } else {
        const catMsg = rule.applicableTo === 'category' ? ` on Category "${rule.targetCategory}"` : '';
        alert(`${t("No eligible items for")} "${rule.name}" (${t("Buy")} ${buyQty} ${t("Get")} ${getQty} ${t("Free")}${catMsg}). ${t("Add required quantities to cart.")}`);
      }
    } else {
      setDiscount({
        type: rule.type,
        value: rule.value,
        name: rule.name,
        offerName: rule.name,
        offerCategory: rule.offerCategory || 'Special offers',
        applicableTo: rule.applicableTo || 'all',
        targetCategory: rule.targetCategory || ''
      });
      setShowCharges(true);
      setShowOffersModal(false);
    }
  };

  const fetchTenantDiscounts = async (isManualRefresh = false) => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      if (!token) return;
      if (isManualRefresh || tenantDiscounts.length === 0) {
        setLoadingDiscounts(true);
      }
      const res = await axios.get(`${getApiUrl()}/discounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (Array.isArray(res.data)) {
        setTenantDiscounts(res.data);
        setHasFetchedDiscounts(true);
        try {
          localStorage.setItem('resto_discounts_cache', JSON.stringify(res.data));
        } catch { }
      }
    } catch (err) {
      console.error('Error loading tenant discounts in BillSummary:', err);
    } finally {
      setLoadingDiscounts(false);
      setHasFetchedDiscounts(true);
    }
  };

  useEffect(() => {
    fetchTenantDiscounts();

    // Listen for real-time discount updates dispatched from DiscountConfig or other tabs
    const handleDiscountsUpdated = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setTenantDiscounts(e.detail);
        setHasFetchedDiscounts(true);
      } else {
        fetchTenantDiscounts(false);
      }
    };
    window.addEventListener('resto_discounts_updated', handleDiscountsUpdated);

    const handleStorage = (e) => {
      if (e.key === 'resto_discounts_cache' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setTenantDiscounts(parsed);
            setHasFetchedDiscounts(true);
          }
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('resto_discounts_updated', handleDiscountsUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleOpenOffersModal = () => {
    // 1. Instantly sync latest cache from localStorage so newly saved offers appear with 0ms latency
    let cachedList = [];
    try {
      const cached = localStorage.getItem('resto_discounts_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          cachedList = parsed;
          setTenantDiscounts(parsed);
          setHasFetchedDiscounts(true);
        }
      }
    } catch { }

    setOffersModalCategoryFilter('All');
    setShowOffersModal(true);

    // If neither state nor localStorage has any discounts yet, show loader instead of false "No active offers"
    if (tenantDiscounts.length === 0 && cachedList.length === 0) {
      setLoadingDiscounts(true);
    }

    // Refresh discounts from backend
    fetchTenantDiscounts(true);
  };

  useEffect(() => {
    if (total > 0) {
      setSettlementAmount(total.toFixed(2));
    } else {
      setSettlementAmount('');
    }
  }, [total]);

  // Keep applied BOGO offer discount amount synchronized dynamically as cart items change
  useEffect(() => {
    if (discount?.name && tenantDiscounts && tenantDiscounts.length > 0 && cart && cart.length > 0) {
      const matchedBogo = tenantDiscounts.find(d => d.type === 'bogo' && d.name === discount.name && isOfferValid(d));
      if (matchedBogo) {
        const buyQty = Math.max(1, Number(matchedBogo.buyQty) || 2);
        const getQty = Math.max(1, Number(matchedBogo.getQty) || 1);
        let bogoDiscount = 0;
        cart.forEach((item) => {
          const isCategoryMatch = matchedBogo.applicableTo === 'category'
            ? checkCategoryMatch(item, matchedBogo.targetCategory)
            : true;

          if (isCategoryMatch && item.quantity >= buyQty) {
            const freeSets = Math.floor(item.quantity / buyQty);
            const freeItems = freeSets * getQty;
            bogoDiscount += freeItems * (item.price || 0);
          }
        });
        if (bogoDiscount !== discount.value) {
          setDiscount(prev => ({
            ...prev,
            type: 'flat',
            value: bogoDiscount,
            name: matchedBogo.name,
            offerName: matchedBogo.name,
            applicableTo: matchedBogo.applicableTo || 'all',
            targetCategory: matchedBogo.targetCategory || ''
          }));
        }
      }
    }
  }, [cart, tenantDiscounts]);

  const handleBogoOffer = () => {
    if (!cart || cart.length === 0) {
      alert(t("Cart is empty. Please add items to calculate BOGO offer."));
      return;
    }

    const activeBogoRules = (tenantDiscounts || []).filter(d => d.type === 'bogo' && isOfferValid(d));

    let bogoDiscount = 0;
    let appliedRuleNames = [];

    if (activeBogoRules.length > 0) {
      // Apply configured tenant BOGO rules
      activeBogoRules.forEach((rule) => {
        const buyQty = Math.max(1, Number(rule.buyQty) || 2);
        const getQty = Math.max(1, Number(rule.getQty) || 1);

        cart.forEach((item) => {
          const isCategoryMatch = rule.applicableTo === 'category'
            ? checkCategoryMatch(item, rule.targetCategory)
            : true;

          if (isCategoryMatch && item.quantity >= buyQty) {
            const freeSets = Math.floor(item.quantity / buyQty);
            const freeItems = freeSets * getQty;
            const itemDiscount = freeItems * (item.price || 0);
            bogoDiscount += itemDiscount;
            if (itemDiscount > 0 && !appliedRuleNames.includes(rule.name)) {
              appliedRuleNames.push(rule.name);
            }
          }
        });
      });
    } else {
      // Universal fallback: Buy 2 get 1 free on all items
      cart.forEach((item) => {
        if (item.quantity >= 2) {
          const freeItems = Math.floor(item.quantity / 2);
          bogoDiscount += freeItems * (item.price || 0);
        }
      });
      appliedRuleNames.push("Buy 2 Get 1 Free");
    }

    if (bogoDiscount > 0) {
      setDiscount({ type: 'flat', value: bogoDiscount, name: appliedRuleNames.join(', '), offerName: appliedRuleNames.join(', ') });
      setShowCharges(true);
      setShowDiscountInput(true);
    } else {
      if (activeBogoRules.length > 0) {
        const ruleDescriptions = activeBogoRules.map(r => `• ${r.name}: Buy ${r.buyQty} Get ${r.getQty} Free ${r.applicableTo === 'category' ? `(${r.targetCategory})` : '(All Items)'}`).join('\n');
        alert(`${t("No eligible items for active BOGO offer(s):")}\n${ruleDescriptions}`);
      } else {
        alert(t("No eligible items for BOGO. Add at least 2 quantities of the same item."));
      }
    }
  };

  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';





  const handleItemNoteClick = (item) => {
    setSelectedCartItemForNote(item);
    setNoteInput(item.specialNote || '');
    setShowNoteModal(true);
  };

  const handleNoteClick = () => {
    if (cart && cart.length > 0) {
      const target = cart[cart.length - 1];
      setSelectedCartItemForNote(target);
      setNoteInput(target.specialNote || '');
    } else {
      setSelectedCartItemForNote(null);
      setNoteInput('');
    }
    setShowNoteModal(true);
  };

  const submitNote = () => {
    if (selectedCartItemForNote) {
      updateItemNote(selectedCartItemForNote.name || selectedCartItemForNote._id, noteInput);
    } else if (cart && cart.length > 0) {
      updateItemNote(cart[0].name || cart[0]._id, noteInput);
    }
    setSelectedCartItemForNote(null);
    setShowNoteModal(false);
  };

  const handleTableClick = () => {
    if (billType === 'Delivery' || billType === 'Takeaway' || activeTable?.startsWith('DEL-') || activeTable?.startsWith('TAK-')) {
      return;
    }
    if (onTransferTable) {
      onTransferTable();
    }
  };


  return (
    <div className="counter-sale-cart flex flex-col h-full bg-[#FDFBF7] border-l border-[#E8DCCB] w-full max-w-full overflow-hidden text-slate-800">

      {/* Ocean Header / Counter Title */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#F7EFE2] border-b border-[#E8DCCB] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-extrabold text-xs text-[#0f2942] tracking-wide uppercase font-black">{t("Counter Sale / Direct Order")}
          </span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] font-bold">
          {activeTable ? `#${activeTable.replace(/^(TAK-|DEL-|ORD-)/i, '')}` : t("Active Cart")}
        </span>
      </div>

      {/* Info Bar - CRM & Notes */}
      <div className="flex items-center justify-between px-2.5 sm:px-3 py-1.5 border-b border-[#E8DCCB] bg-[#F7EFE2] overflow-x-auto no-scrollbar gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Customer CRM Badge */}
          <div
            onClick={onOpenCustomerModal}
            title={customerPhone || customerName ? `${customerName || 'Customer'} (${customerPhone || 'CRM'}) - ${t("Click to edit")}` : t("Customer CRM - Link Phone & Name")}
            className={`flex items-center justify-center gap-1 min-w-[32px] max-w-[120px] h-7 px-2 rounded-lg cursor-pointer transition-all active:scale-95 shrink-0 border ${customerPhone || customerName
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold'
              : 'bg-[#FDFBF7] hover:bg-[#F5E8D8] border-[#E8DCCB] text-[#334155]'
              }`}
          >
            <User size={12} className={`shrink-0 ${customerPhone || customerName ? 'text-amber-400' : 'text-sky-400'}`} />
            <span className="text-[10px] font-bold truncate">
              {customerName || customerPhone || t("CRM")}
            </span>
          </div>

          {/* Special Note Badge */}
          {(() => {
            const hasAnyNote = (cart || []).some(item => !!item.specialNote) || (selectedCartItemForNote && selectedCartItemForNote.specialNote);
            return (
              <div
                onClick={handleNoteClick}
                title={hasAnyNote ? t("Special Notes Active (Click to edit)") : t("Add Special Note")}
                className={`flex items-center justify-center gap-1 min-w-[30px] max-w-[75px] h-7 px-1.5 rounded-lg cursor-pointer shadow-2xs transition-all shrink-0 ${hasAnyNote
                  ? 'bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-[#FDFBF7] hover:bg-[#F5E8D8] border border-[#E8DCCB] text-[#334155]'
                  }`}
              >
                <Clipboard size={11} className="opacity-80 shrink-0" />
                <span className="text-[9px] font-bold truncate">{hasAnyNote ? `📝 ${t("Note")}` : t("Note")}</span>
              </div>
            );
          })()}

          {/* Instant Stat Badge */}
          {cart.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 border border-orange-200 rounded-md text-orange-700 text-[9px] font-bold shadow-2xs ml-0.5 shrink-0 animate-in fade-in duration-150">
              <span>{cart.length} {cart.length === 1 ? t("Item") : t("Items")}</span>
              <span className="text-orange-300 font-normal">|</span>
              <span>{cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0)} {t("Qty")}</span>
            </div>
          )}
          {orderStatus === 'Billed' && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded-md text-amber-800 text-[9px] font-black uppercase tracking-wider shadow-2xs ml-0.5 shrink-0 animate-in fade-in duration-150">
              <span>{t("BILLED")}</span>
            </div>
          )}
        </div>

        {/* Clear All Button with F8 shortcut */}
        {cart.length > 0 && (
          <button
            type="button"
            onClick={handleClearAllClick}
            title={isBilledLocked ? t("Order is saved & printed. Click EDIT to modify.") : t("Clear all items (F8)")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 shrink-0 shadow-2xs ${
              isBilledLocked
                ? 'bg-amber-100/80 hover:bg-amber-200 text-amber-900 border border-amber-300'
                : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
            }`}
          >
            <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black shadow-2xs">F8</kbd>
            <Trash2 size={11} className={isBilledLocked ? 'text-amber-700' : 'text-red-500'} />
            <span>{t("Clear All")}</span>
          </button>
        )}
      </div>

      {/* Table Headers */}
      <div id="cart-items-header" className="flex items-center px-2 py-1.5 bg-[#F7EFE2] border-b border-[#E8DCCB] text-[#475569] text-[9px] font-bold uppercase tracking-wider shrink-0">
        <div className="w-[44%] flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{t("Items")}</span>
          {cart.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-black bg-orange-100 text-orange-700 border border-orange-200 shadow-2xs truncate">
              {cart.length} ({cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0)} {t("Qty")})
            </span>
          )}
        </div>
        <div className="w-[14%] text-center hidden xl:block">{t("Check")}</div>
        <div className="w-[26%] text-center">{t("Qty.")}</div>
        <div className="w-[16%] text-right pr-1">{t("Price")}</div>
      </div>

      {/* Single scrollable area: Cart Items + Bottom charges/totals (action buttons pinned below) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#FDFBF7]">

        {/* Cart Items List */}
        <div id="cart-items-container" data-billing-cart="true" className="counter-sale-cart bill-cart-items bg-[#FDFBF7] p-0.5 relative">
          {loading && (orderId || orderStatus === 'Billed' || cart.length > 0) ? (
            <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
              {/* Dynamic Status Header */}
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  <span className="text-[11px] font-bold text-text-muted animate-pulse tracking-wide">
                    {t("Loading order items...")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>

              {/* Dynamic Shimmering Item Rows */}
              {[1, 2, 3].map((rowIdx) => (
                <div
                  key={rowIdx}
                  className="flex items-center justify-between py-2 px-2.5 rounded-xl bg-gradient-to-r from-gray-50 via-orange-50/20 to-gray-50 border border-border animate-pulse"
                  style={{ animationDelay: `${rowIdx * 120}ms` }}
                >
                  <div className="flex-1 min-w-0 pr-2 space-y-1.5">
                    <div
                      className="h-3.5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md"
                      style={{ width: rowIdx === 1 ? '70%' : rowIdx === 2 ? '50%' : '60%' }}
                    />
                    <div className="h-2 bg-gray-200/70 rounded-md w-1/3" />
                  </div>
                  <div className="w-12 h-5 bg-gray-200/80 rounded-lg mx-2 shrink-0" />
                  <div className="w-10 h-4 bg-gray-200 rounded shrink-0" />
                </div>
              ))}
            </div>
          ) : cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
              <div className="w-12 h-12 rounded-2xl bg-[#F7EFE2] border border-[#E8DCCB] flex items-center justify-center text-[#ea580c] mb-2.5 shadow-2xs">
                <ShoppingBag size={20} className="opacity-80" />
              </div>
              <p className="font-bold text-slate-800 text-xs sm:text-sm mb-0.5">{t("No items added")}</p>
              <p className="text-[10.5px] text-slate-500 max-w-[200px] leading-relaxed">
                {t("Tap items from the fish catalog on the left to add")}
              </p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={item._id || item.name || index} className={`flex items-start py-1.5 px-1.5 border-b border-[#f1f5f9] hover:bg-[#F5E8D8] transition-colors group ${item.isCancelled ? 'opacity-50' : ''}`}>
                {/* Delete Icon */}
                <button
                  onClick={() => updateQuantity(item.itemKey || item._id || item.name, -item.quantity)}
                  disabled={isLocked || item.isCancelled}
                  className="w-5 h-5 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center shrink-0 mt-0.5 mr-1 transition-all disabled:opacity-50">
                  <X size={12} strokeWidth={3} />
                </button>

                {/* Item Name */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`text-[11px] text-text-muted font-bold leading-tight ${item.isCancelled ? 'line-through' : ''}`}>
                      {(language !== 'en' && item.nameTranslations?.[language]) || item.name}
                      {item.sellingUnit && <span className="text-[10px] text-primary ml-1 font-semibold">({item.sellingUnit})</span>}
                    </span>
                    {(() => {
                      const rawQty = parseInt(item.quantity || 0, 10) || 0;
                      const cancelledQty = parseInt(item.cancelledQuantity || 0, 10) || 0;
                      const effectiveQty = Math.max(0, rawQty - cancelledQty);
                      const totalQty = Math.max(0, rawQty);

                      // Use only the first `effectiveQty` slots so cancelled units don't inflate status counts
                      const rawUnitStatuses = Array.isArray(item.unitStatuses) && item.unitStatuses.length === totalQty && totalQty > 0
                        ? item.unitStatuses
                        : Array.from({ length: totalQty }, () => item.status || 'Pending');
                      const unitStatuses = rawUnitStatuses.slice(0, effectiveQty);

                      const preparedCount = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
                      const preparingCount = unitStatuses.filter(s => s === 'Preparing').length;
                      const pendingCount = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

                      const hasMixedStatus = effectiveQty > 1 && (
                        (preparedCount > 0 && (preparingCount > 0 || pendingCount > 0)) ||
                        (preparingCount > 0 && pendingCount > 0)
                      );

                      // If item has zero effective quantity (cancelled or removed), show Cancelled — don't run status logic
                      if (effectiveQty === 0) {
                        return <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">{t("Cancelled")}</span>;
                      }

                      if (item.isCancelled) {
                        return <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">{t("Cancelled")}</span>;
                      }
                      if (item.cancellationRejected) {
                        return <span className="text-[9px] bg-gray-200 text-text-muted px-1 py-0.5 rounded font-bold">{t("Rejected")}</span>;
                      }
                      if (item.cancellationRequested) {
                        return <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">{t("Pending")}</span>;
                      }

                      const reducedBadge = (item.cancelledQuantity > 0 || item.reducedQuantity > 0) ? (
                        <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold whitespace-nowrap">
                          (-{item.cancelledQuantity || item.reducedQuantity})
                        </span>
                      ) : null;

                      let statusNode = null;

                      if (hasMixedStatus) {
                        statusNode = (
                          <span className="inline-flex items-center gap-1 flex-wrap">
                            {preparedCount > 0 && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 shadow-2xs inline-flex items-center gap-1">
                                <CheckCircle size={10} className="text-emerald-600 shrink-0" />
                                <span>{preparedCount}x {t("Prepared")}</span>
                              </span>
                            )}
                            {preparingCount > 0 && (
                              <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 shadow-2xs inline-flex items-center gap-1">
                                <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                                <span>{preparingCount}x 👨‍🍳 {t("Preparing")}</span>
                              </span>
                            )}
                            {pendingCount > 0 && (
                              <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                                <span>{pendingCount}x ⏳ {t("Pending")}</span>
                              </span>
                            )}
                          </span>
                        );
                      } else if (item.status === 'Preparing' || preparingCount > 0) {
                        statusNode = (
                          <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 shadow-2xs inline-flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                            <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}👨‍🍳 {t("Preparing")}</span>
                          </span>
                        );
                      } else if (effectiveQty > 0 && (item.status === 'Ready' || item.status === 'Prepared' || preparedCount === effectiveQty)) {
                        statusNode = (
                          <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 shadow-2xs inline-flex items-center gap-1">
                            <CheckCircle size={10} className="text-emerald-600 shrink-0" />
                            <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}✅ {t("Prepared")}</span>
                          </span>
                        );
                      } else if (item.status === 'Pending' || ((item.printedQuantity || 0) > 0 && !item.status)) {
                        statusNode = (
                          <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                            <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}⏳ {t("Pending")}</span>
                          </span>
                        );
                      }

                      if (statusNode || reducedBadge) {
                        return (
                          <span className="inline-flex items-center gap-1">
                            {statusNode}
                            {reducedBadge}
                          </span>
                        );
                      }

                      return null;
                    })()}
                    <button
                      onClick={() => handleItemNoteClick(item)}
                      disabled={isLocked || item.isCancelled}
                      className="text-gray-400 hover:text-orange-500 transition-colors p-0.5"
                      title={t("Add special note for this item")}
                    >
                      <Clipboard size={10} />
                    </button>
                  </div>
                  {(item.orderedAt || item.createdAt || item.time || item.addedAt) && (
                    <div className="text-[8.5px] text-gray-400 font-semibold mt-0.5 flex items-center gap-0.5">
                      <span>🕒 {(() => {
                        const d = new Date(item.orderedAt || item.createdAt || item.time || item.addedAt);
                        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                      })()}</span>
                    </div>
                  )}
                  {item.specialNote ? (
                    <div
                      onClick={() => handleItemNoteClick(item)}
                      className="text-[9px] text-amber-600 font-bold cursor-pointer hover:underline mt-0.5 flex items-center gap-0.5 truncate"
                    >
                      <span>📝 {item.specialNote}</span>
                    </div>
                  ) : null}
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-0 w-[78px] shrink-0 bg-[#F7EFE2] rounded-lg overflow-hidden border border-[#E8DCCB]">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.itemKey || item._id || item.name, -1)}
                    disabled={isLocked || item.isCancelled}
                    className="w-5 h-6 flex items-center justify-center text-[#64748b] hover:bg-[#F5E8D8] hover:text-red-500 disabled:opacity-50 transition-colors shrink-0">
                    <Minus size={11} />
                  </button>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    disabled={isLocked || item.isCancelled}
                    value={item.quantity - (item.cancelledQuantity || 0)}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => {
                      if (e.key === '-' || e.key === 'e' || e.key === '+') e.preventDefault();
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return;
                      const parsed = parseFloat(raw);
                      if (!isNaN(parsed) && parsed >= 0) {
                        const currentActive = item.quantity - (item.cancelledQuantity || 0);
                        const delta = parsed - currentActive;
                        if (delta !== 0) {
                          updateQuantity(item.itemKey || item._id || item.name, delta);
                        }
                      }
                    }}
                    className={`w-9 h-6 bg-[#FDFBF7] text-center font-bold text-[11px] text-[#1e293b] focus:outline-none border-x border-[#E8DCCB] p-0 ${item.isCancelled ? 'line-through text-slate-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.itemKey || item._id || item.name, 1)}
                    disabled={isLocked || item.isCancelled}
                    className="w-5 h-6 flex items-center justify-center text-[#64748b] hover:bg-[#F5E8D8] hover:text-emerald-600 disabled:opacity-50 transition-colors shrink-0">
                    <Plus size={11} />
                  </button>
                </div>

                {/* Price - editable on click */}
                <div className="w-[50px] shrink-0 text-right flex flex-col justify-center h-6 pr-1">
                  {editingPriceId === (item._id || item.name) ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      autoFocus
                      value={editingPriceValue}
                      onChange={(e) => setEditingPriceValue(e.target.value)}
                      onBlur={() => {
                        if (updateItemPrice) {
                          const effectiveQty = item.quantity - (item.cancelledQuantity || 0);
                          const newTotal = parseFloat(editingPriceValue);
                          if (!isNaN(newTotal) && effectiveQty > 0) {
                            updateItemPrice(item._id || item.name, newTotal / effectiveQty);
                          }
                        }
                        setEditingPriceId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.target.blur(); }
                        if (e.key === 'Escape') { setEditingPriceId(null); }
                      }}
                      className="w-full text-right text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 rounded px-1 py-0.5 focus:outline-none"
                    />
                  ) : (
                    <div
                      className={`text-[11px] font-bold text-text-muted cursor-pointer hover:text-primary hover:underline transition-colors ${item.isCancelled ? 'line-through text-gray-400' : ''}`}
                      title="Click to edit total price"
                      onClick={() => {
                        if (!isLocked && !item.isCancelled) {
                          setEditingPriceId(item._id || item.name);
                          const effectiveQty = item.quantity - (item.cancelledQuantity || 0);
                          setEditingPriceValue(String((item.price * effectiveQty).toFixed(0)));
                        }
                      }}
                    >
                      {(item.price * (item.quantity - (item.cancelledQuantity || 0))).toFixed(0)}
                      {!isLocked && !item.isCancelled && <Edit3 size={8} className="inline ml-0.5 opacity-40" />}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={cartEndRef} />
        </div>
        {/* END Cart Items */}

        {/* Bottom Action Area - inside the single scrollable wrapper */}
        <div className="flex flex-col w-full bg-[#F7EFE2] border-t border-[#E8DCCB] shadow-sm z-20">

          {/* Collapsible Charges Section - scrollable so buttons stay visible */}
          <div className="bg-[#F7EFE2] flex flex-col relative w-full border-b border-[#E8DCCB]">
            <button
              className="w-full h-6 bg-[#F7EFE2] hover:bg-[#F5E8D8] flex items-center justify-center text-slate-500 transition-colors border-t border-[#E8DCCB] cursor-pointer"
              onClick={() => setShowCharges(!showCharges)}>

              {showCharges ? <ChevronUp size={16} className="text-slate-500 stroke-[2.2]" /> : <ChevronDown size={16} className="text-slate-500 stroke-[2.2]" />}
            </button>

            {showCharges &&
              <div className="flex flex-col px-4 py-3 space-y-3 text-sm text-slate-700 overflow-y-auto max-h-[42vh] bg-[#F7EFE2]">
                <div className="flex items-center justify-between font-bold">
                  <span className="w-1/3">{t("Sub Total")}</span>
                  <span className="w-1/3 text-center">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
                  <span className="w-1/3 text-right">{subtotal.toFixed(2)}</span>
                </div>
                <div className={`flex items-center justify-between ${discountAmount > 0 ? 'font-black text-emerald-700 bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-200/60' : 'font-bold'}`}>
                  <span className="w-1/2 flex items-center gap-1 min-w-0">
                    <span className="truncate">
                      {t("Discount")}
                      {discount?.name ? (
                        <span className="inline-flex items-center gap-1 ml-1 flex-wrap">
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.5 rounded-md border border-emerald-300/70 inline-block truncate max-w-[140px]" title={discount.name}>
                            {discount.name}{discount.type === 'percentage' && discount.value ? ` (${discount.value}%)` : (discount.type === 'flat' && discount.value ? ` (${currencySymbol}${discount.value})` : '')}
                          </span>
                          {discount.offerCategory && (() => {
                            const catMeta = getOfferCategoryMeta(discount.offerCategory);
                            return (
                              <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${catMeta.badgeColor}`}>
                                <span>{catMeta.icon}</span>
                                <span>{catMeta.label}</span>
                              </span>
                            );
                          })()}
                        </span>
                      ) : (
                        discount?.type === 'percentage' && discount?.value ? ` (${discount.value}%)` : (discount?.type === 'complimentary' ? ' (100%)' : '')
                      )}
                    </span>
                    <button disabled={isLocked} className="text-primary underline text-[11px] ml-1 hover:text-red-700 font-bold disabled:opacity-50 cursor-pointer shrink-0" onClick={() => setShowDiscountInput(!showDiscountInput)}>{showDiscountInput ? t("Less") : t("More")}</button>
                    {discountAmount > 0 && !isLocked && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDiscount({ type: 'flat', value: '', name: '' });
                        }}
                        className="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-100 transition-colors ml-1 cursor-pointer shrink-0"
                        title={t("Remove Discount / Offer")}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                  <span className={`w-1/2 text-right ${discountAmount > 0 ? 'text-emerald-700 font-black text-sm' : 'text-green-600'}`}>
                    {discountAmount > 0 ? `-${currencySymbol}${discountAmount.toFixed(2)}` : `(${discountAmount.toFixed(2)})`}
                  </span>
                </div>
                {showDiscountInput &&
                  <div className="flex items-center justify-between bg-gray-200/50 p-2 rounded-lg gap-2 border border-border">
                    <select
                      disabled={isLocked}
                      className={`${discount?.type === 'complimentary' ? 'w-full' : 'w-1/2'} bg-white border border-gray-300 rounded text-[12px] h-7 outline-none focus:border-primary px-1 disabled:opacity-50`}
                      value={discount?.type || 'percentage'}
                      onChange={(e) => {
                        const selectedVal = e.target.value;
                        if (selectedVal.startsWith('preset_')) {
                          const presetId = selectedVal.replace('preset_', '');
                          const found = (tenantDiscounts || []).find(d => d._id === presetId);
                          if (found) {
                            applyPresetOffer(found);
                          }
                        } else {
                          let currentVal = discount?.value;
                          if (selectedVal === 'percentage' && Number(currentVal) > 100) {
                            currentVal = '';
                          }
                          setDiscount({ ...(discount || {}), type: selectedVal, value: currentVal, applicableTo: 'all', targetCategory: '', name: '' });
                        }
                      }}>

                      <option value="percentage">{t("% Percent")}</option>
                      <option value="flat">{currencySymbol}{t("Flat")}</option>
                      <option value="complimentary">{t("Complimentary")}</option>
                      {(tenantDiscounts || []).filter(d => isOfferValid(d)).length > 0 && (
                        <optgroup label={t("Active Store Offers")}>
                          {(tenantDiscounts || []).filter(d => isOfferValid(d)).map(d => {
                            const catLabel = d.applicableTo === 'category' && d.targetCategory ? ` on ${d.targetCategory}` : '';
                            const statusInfo = getOfferValidityStatus(d);
                            const timeStr = statusInfo.timeRemaining ? ` • ${statusInfo.timeRemaining}` : '';
                            const catName = d.offerCategory ? `[${d.offerCategory}] ` : '';
                            return (
                              <option key={d._id} value={`preset_${d._id}`}>
                                {catName}{d.name} ({d.type === 'percentage' ? `${d.value}%` : (d.type === 'bogo' ? 'BOGO' : `${currencySymbol}${d.value}`)}{catLabel}{timeStr})
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>
                    {discount?.type !== 'complimentary' && (
                      <input
                        type="number"
                        min="0"
                        max={discount?.type === 'percentage' ? '100' : undefined}
                        disabled={isLocked}
                        onWheel={(e) => e.target.blur()}
                        onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                        className="w-1/2 bg-[#FDFBF7] border border-[#E8DCCB] text-slate-900 text-right px-2 rounded h-7 outline-none focus:border-primary text-[12px] font-bold disabled:opacity-50"
                        placeholder={discount?.type === 'percentage' ? t('0-100%') : t('Value')}
                        value={discount?.value ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setDiscount({ ...(discount || {}), value: '' });
                            return;
                          }
                          let num = parseFloat(raw);
                          if (isNaN(num)) num = 0;
                          if (discount?.type === 'percentage') {
                            num = Math.min(100, Math.max(0, num));
                          } else {
                            num = Math.max(0, num);
                          }
                          setDiscount({ ...(discount || {}), value: num });
                        }} />
                    )}
                  </div>
                }
                <div className="flex items-center justify-between font-bold">
                  <span className="w-1/3">{t("GST")} {taxRate ? `(${taxRate}%)` : ''}</span>
                  <span className="w-1/3 text-center"></span>
                  <span className="w-1/3 text-right">{(taxAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className="w-2/3">{t("Delivery Charge")}</span>
                  <span className="w-1/3 text-right">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isLocked}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      value={deliveryCharge === '0' || deliveryCharge === 0 ? '' : deliveryCharge}
                      onChange={(e) => setDeliveryCharge && setDeliveryCharge(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-[80px] bg-[#F7EFE2] border border-[#E8DCCB] text-[#1e293b] text-right px-1 rounded h-7 outline-none focus:border-primary font-bold text-xs disabled:opacity-50" />
                  </span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span className="w-2/3 flex items-center gap-1"><span className="w-3 h-3 border border-gray-400 bg-gray-100 rounded-full inline-block"></span>{t("Container Charge")}</span>
                  <span className="w-1/3 text-right">
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isLocked}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      value={containerCharge === '0' || containerCharge === 0 ? '' : containerCharge}
                      onChange={(e) => setContainerCharge && setContainerCharge(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-[80px] bg-[#F7EFE2] border border-[#E8DCCB] text-[#1e293b] text-right px-1 rounded h-7 outline-none focus:border-primary font-bold text-xs disabled:opacity-50" />
                  </span>
                </div>
              </div>
            }
            {showCharges &&
              <div className="w-full h-3 bg-[#f7f1ea] flex items-center justify-center text-text-muted border-t border-border">
              </div>
            }
          </div>

          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border overflow-x-auto no-scrollbar w-full gap-1">
            <div className="flex items-center gap-1 shrink-0">
              <button
                disabled={isLocked}
                onClick={handleOpenOffersModal}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1 cursor-pointer ${discount?.name
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm hover:bg-emerald-500'
                  : 'bg-sky-500/15 text-[#ea580c] border-[#E8DCCB] hover:bg-sky-500/25'
                  }`}
                title={t("Browse & apply active discounts, percentage offers, and BOGO deals (F6)")}
              >
                <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black shadow-2xs">F6</kbd>
                <Tags size={12} />
                <span>{discount?.name ? `${discount.name}` : t("Offers")}</span>
              </button>

              <button
                disabled={isLocked}
                onClick={() => {
                  if (discount?.type === 'complimentary') {
                    setDiscount({ type: 'flat', value: '', name: '' });
                  } else {
                    setDiscount({ type: 'complimentary', value: '', name: 'Complimentary' });
                  }
                }}
                className={`${discount?.type === 'complimentary' ? 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500' : 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca] hover:bg-[#fee2e2]'} px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1`}
                title={t("100% Complimentary order (F7)")}
              >
                <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black shadow-2xs">F7</kbd>
                <span>{t("Complimentary")}</span>
              </button>

              {discount?.name && (
                <button
                  disabled={isLocked}
                  onClick={() => setDiscount && setDiscount({ type: 'flat', value: '', name: '' })}
                  className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors whitespace-nowrap flex items-center gap-1"
                  title="Clear applied offer"
                >
                  <X size={10} />
                  <span>Clear Offer</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <span className="text-text-muted text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">{t("Total")}</span>
              {loading && (orderId || orderStatus === 'Billed' || cart.length > 0) ? (
                <div className="h-5 w-14 bg-orange-100/80 rounded-md animate-pulse" />
              ) : (
                <span className="text-primary text-base sm:text-lg font-black">{currencySymbol}{total.toFixed(0)}</span>
              )}
            </div>
          </div>

          {/* Row 3: Settlement */}
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border overflow-x-auto no-scrollbar w-full gap-1">
            <div className="flex flex-col min-w-0">
              <span className="text-text-muted text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shrink-0">{t("Settlement Amount")}</span>
            </div>
            <div className="flex items-center gap-1.5 ml-1 shrink-0">
              <input
                type="number"
                min="0"
                onWheel={(e) => e.target.blur()}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                disabled={isLocked || cart.length === 0}
                className="w-[75px] sm:w-[85px] h-7 bg-[#F7EFE2] border border-[#E8DCCB] text-[#1e293b] text-right px-1.5 rounded-lg outline-none focus:border-[#ea580c] font-black font-mono text-xs sm:text-sm disabled:opacity-50" />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsPaid(true);
                  if (onSettleBill) onSettleBill();
                }}
                disabled={cart.length === 0 || orderStatus === 'Paid' || loading || actionLoading !== null}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm hover:shadow-md active:scale-95 transition-all whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer">
                {actionLoading === 'settle' ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    <span>{t("Settling...")}</span>
                  </>
                ) : (
                  <>
                    <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black shadow-2xs">F5</kbd>
                    <span>{t("Settle")}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Row 4: Checkboxes & WhatsApp Auto/Manual Toggle */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-white border-t border-b border-border w-full overflow-x-auto no-scrollbar gap-2">
            <label className="flex items-center gap-1.5 text-text-muted text-xs font-bold cursor-pointer select-none shrink-0">
              <div className={`w-3.5 h-3.5 flex items-center justify-center rounded border-2 transition-colors ${isPaid ? 'border-sky-400 bg-sky-500' : 'border-[#E8DCCB] bg-white'}`}>
                {isPaid && <CheckCircle size={9} className="text-white shrink-0" strokeWidth={3} />}
              </div>
              <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="hidden" />
              <span>{t("It's Paid")}</span>
            </label>

            {/* WhatsApp Mode Toggle: Automatic vs Manual */}
            {onToggleAutoWhatsapp && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleAutoWhatsapp(!autoWhatsappEnabled)}
                  title={
                    autoWhatsappEnabled
                      ? (!isWhatsAppConnected
                        ? t("WhatsApp is not connected in Settings. Auto-send will be skipped.")
                        : (!customerPhone)
                          ? t("Auto WhatsApp is ON, but customer Phone is required in CRM to auto-send.")
                          : t("Auto WhatsApp is ON — Bill will be sent automatically to customer on payment."))
                      : t("Manual WhatsApp — Click to switch to Auto WhatsApp on payment.")
                  }
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer select-none shadow-xs active:scale-95 ${autoWhatsappEnabled
                    ? isWhatsAppConnected && customerPhone
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-200'
                      : !isWhatsAppConnected
                        ? 'bg-amber-500 border-amber-600 text-white'
                        : 'bg-emerald-600/90 border-emerald-700 text-white'
                    : 'bg-[#FDFBF7] border-[#E8DCCB] text-slate-700 hover:bg-[#F5E8D8] hover:text-[#7c3f1d] hover:border-[#ea580c]'
                    }`}
                >
                  <span>{autoWhatsappEnabled ? (isWhatsAppConnected && customerPhone ? '⚡' : !isWhatsAppConnected ? '⚠️' : '📱') : '💬'}</span>
                  <span>
                    {autoWhatsappEnabled
                      ? !isWhatsAppConnected
                        ? 'Auto WA (Offline)'
                        : (!customerPhone)
                          ? 'Auto WA (+CRM)'
                          : 'WhatsApp: Auto'
                      : 'WhatsApp: Manual'}
                  </span>
                  {/* Visual toggle switch knob */}
                  <span className={`w-3.5 h-2 rounded-full flex items-center p-0.5 ml-0.5 transition-colors ${autoWhatsappEnabled ? 'bg-white/40 justify-end' : 'bg-gray-300 justify-start'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${autoWhatsappEnabled ? 'bg-white' : 'bg-slate-400'}`} />
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Dynamic WhatsApp Connection & CRM Status Message */}
          <div className="px-3 py-1.5 bg-[#F7EFE2] border-b border-border flex flex-col gap-1 text-[11px] animate-in fade-in duration-200">
            {/* Status Indicators */}
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              {customerPhone && (
                <button
                  type="button"
                  onClick={() => setShowLoyaltyModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95"
                >
                  <Sparkles size={12} className="shrink-0" />
                  Redeem Loyalty
                </button>
              )}
              {/* WhatsApp Status Badge */}
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isWhatsAppConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                : 'bg-red-50 text-red-600 border-red-200 shadow-2xs'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isWhatsAppConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                <span>{isWhatsAppConnected ? t("WhatsApp: Connected") : t("WhatsApp: Not Connected")}</span>
              </div>

              {/* CRM Status Badge */}
              <button
                type="button"
                onClick={onOpenCustomerModal}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 ${customerPhone
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 animate-pulse'
                  }`}
                title={customerPhone ? `${customerName ? `${customerName} • ` : ''}${customerPhone} (${t("Click to edit CRM")})` : t("Click to add Customer in CRM")}
              >
                <User size={10} className={customerPhone ? 'text-blue-600' : 'text-amber-600'} />
                <span>{customerPhone ? `${t("CRM")}: ${customerPhone}` : t("CRM: Not Entered (+)")}</span>
              </button>
            </div>

            {/* Dynamic User-Friendly Message */}
            <div className="text-[10px] leading-tight font-medium">
              {autoWhatsappEnabled ? (
                isWhatsAppConnected && customerPhone ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                    <span>{t("Auto WhatsApp Ready: Bill will be sent to")} <strong className="font-bold">{customerPhone}</strong> {t("on payment.")}</span>
                  </span>
                ) : !isWhatsAppConnected && !customerPhone ? (
                  <span className="text-red-700 flex items-center gap-1">
                    <AlertTriangle size={11} className="text-red-500 shrink-0" />
                    <span>{t("WhatsApp is not connected & CRM phone is missing.")}</span>
                  </span>
                ) : !isWhatsAppConnected ? (
                  <span className="text-amber-800 flex items-center gap-1">
                    <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                    <span>{t("WhatsApp not connected in Settings. Connect to auto-send bill.")}</span>
                  </span>
                ) : (
                  <span className="text-amber-800 flex items-center gap-1">
                    <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                    <span>
                      {t("WhatsApp is connected, but customer phone is required in CRM.")}{' '}
                      <button
                        type="button"
                        onClick={onOpenCustomerModal}
                        className="text-orange-600 font-bold underline hover:text-orange-700 cursor-pointer ml-0.5"
                      >
                        {t("+ Enter CRM")}
                      </button>
                    </span>
                  </span>
                )
              ) : (
                <span className="text-text-muted flex items-center gap-1">
                  <span>💬</span>
                  <span>
                    {isWhatsAppConnected ? t("WhatsApp is connected (Manual mode).") : t("WhatsApp is not connected.")}
                    {customerPhone ? ` ${t("CRM")}: ${customerPhone}.` : ` ${t("CRM not entered.")}`}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* User-friendly Unsaved Items & Navigation Reminder */}
          {isBilledLocked && (
            <div className="mx-2 my-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-800 text-[10px] sm:text-[11px] font-bold shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-600 font-bold text-xs">🔒</span>
                <span>{t("Billed order is locked. Click EDIT to modify.")}</span>
              </div>
              <button
                type="button"
                onClick={onReopenOrder}
                disabled={loading || actionLoading !== null}
                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-all shadow-2xs cursor-pointer ml-1.5"
              >
                {actionLoading === 'edit' ? t("Editing...") : t("EDIT")}
              </button>
            </div>
          )}
          {cart.length > 0 && !isLocked && (
            <div className="mx-2 my-1 px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-1.5 text-[10px] sm:text-[11px] text-amber-900 shadow-2xs">
              <span className="text-amber-700 font-bold shrink-0 text-[12px] leading-tight">⚠️</span>
              <span className="leading-tight font-bold text-amber-900">
                {t("Unsaved changes will be cleared if you navigate away before saving.")}
              </span>
            </div>
          )}
        </div>
        {/* END: Bottom action area + unified scrollable area */}
      </div>

      {/* Action Buttons - Pin at bottom */}
      <div className="grid grid-cols-2 gap-2 px-2.5 py-2.5 bg-[#F7EFE2] border-t border-[#E8DCCB] w-full shrink-0">
        <button
          onClick={() => onSaveOrder && onSaveOrder()}
          disabled={actionLoading !== null || cart.length === 0 || orderStatus === 'Paid' || isBilledLocked || (!!orderId && !hasPendingChanges)}
          className="col-span-1 bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl text-xs sm:text-sm font-black tracking-wide active:scale-95 transition-all shadow-md border border-slate-700 disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300 flex items-center justify-center gap-1.5">
          {actionLoading === 'save' ? (
            <>
              <Loader2 size={14} className="animate-spin text-white" />
              <span>{orderId ? t("Updating...") : t("Saving...")}</span>
            </>
          ) : (
            <>
              <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black mr-1 shadow-2xs">F1</kbd>
              <span>
                {orderId
                  ? (directPrintOnSave ? t("UPDATE & PRINT") : t("UPDATE"))
                  : (directPrintOnSave ? t("SAVE & PRINT") : t("SAVE"))}
              </span>
            </>
          )}
        </button>
        <button
          onClick={onGenerateBill}
          disabled={actionLoading !== null || cart.length === 0 || orderStatus === 'Paid'}
          className="col-span-1 bg-gradient-to-r from-emerald-600 to-teal-500 text-white py-2.5 rounded-xl text-xs sm:text-sm font-black tracking-wide hover:shadow-lg active:scale-95 transition-all shadow-md disabled:opacity-50 flex items-center justify-center text-center gap-1.5">
          {actionLoading === 'print' ? (
            <>
              <Loader2 size={14} className="animate-spin text-white" />
              <span>{t("Printing...")}</span>
            </>
          ) : (
            <>
              <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black mr-1 shadow-2xs">F2</kbd>
              {(orderStatus === 'Billed' && !hasPendingChanges)
                ? <><span>🧾</span><span>{t("PRINT BILL")}</span></>
                : <span>{t("SAVE & PRINT")}</span>}
            </>
          )}
        </button>
        <button
          onClick={onReopenOrder}
          disabled={actionLoading !== null || orderStatus === 'Open' || (!orderId && cart.length === 0)}
          className="col-span-1 bg-white text-slate-700 py-2 rounded-xl text-xs font-bold hover:bg-[#F5E8D8] border border-[#E8DCCB] active:scale-95 transition-all shadow-sm border border-[#E8DCCB] disabled:opacity-50 flex items-center justify-center gap-1">
          {actionLoading === 'edit' ? (
            <>
              <Loader2 size={14} className="animate-spin text-[#ea580c]" />
              <span>{t("Editing...")}</span>
            </>
          ) : (
            <>
              <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black mr-1 shadow-2xs">F3</kbd>
              <span>{t("EDIT")}</span>
            </>
          )}
        </button>
        <button
          onClick={onCancelOrder}
          disabled={actionLoading !== null || orderStatus === 'Paid' || (!orderId && cart.length === 0)}
          className="col-span-1 bg-[#fef2f2] text-[#dc2626] py-2 rounded-xl text-xs font-bold hover:bg-[#fee2e2] border border-[#fecaca] active:scale-95 transition-all shadow-sm border border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-1">
          {actionLoading === 'cancel' ? (
            <>
              <Loader2 size={14} className="animate-spin text-red-400" />
              <span>{t("Cancelling...")}</span>
            </>
          ) : (
            <>
              <kbd className="px-1.5 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-mono text-[9px] font-black mr-1 shadow-2xs">F4</kbd>
              <span>{t("CANCEL")}</span>
            </>
          )}
        </button>
      </div>

      {/* Direct Print Configuration Dropdown - Small Settings Gear */}
      <div className="px-2 py-1 bg-[#F7EFE2] border-t border-[#E8DCCB] flex justify-end">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPrintConfigOpen(!isPrintConfigOpen)}
            className="text-[10px] text-text-muted hover:text-text-main flex items-center gap-1 bg-white px-2 py-1 rounded border border-[#E8DCCB] cursor-pointer"
          >
            ⚙️ {t("Print Config")} <ChevronDown size={10} />
          </button>

          {/* Overlay to close dropdown when clicking outside on mobile */}
          {isPrintConfigOpen && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsPrintConfigOpen(false)}
            ></div>
          )}

          <div className={`absolute bottom-full right-0 mb-1 w-52 bg-white shadow-2xl border border-[#E8DCCB] rounded-xl p-2.5 z-50 animate-in slide-in-from-bottom-2 duration-200 backdrop-blur-md ${isPrintConfigOpen ? 'block' : 'hidden md:hidden md:group-hover:block'}`}>
            <div className="text-[10px] font-bold text-[#ea580c] uppercase tracking-wider mb-2 border-b border-[#E8DCCB] pb-1.5 flex items-center justify-between">
              <span>{t("Direct Print Settings")}</span>
              <span className="text-[9px] bg-[#FFF3E5] text-[#ea580c] border border-[#E8DCCB] px-1 py-0.2 rounded font-mono">POS</span>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer mb-2 hover:bg-[#F5E8D8] p-1.5 rounded-lg border border-transparent hover:border-[#E8DCCB] transition-colors">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-sky-500 cursor-pointer"
                defaultChecked={localStorage.getItem('msbillings_direct_save') === 'true'}
                onChange={(e) => {
                  localStorage.setItem('msbillings_direct_save', e.target.checked);
                  setDirectPrintOnSave(e.target.checked);
                  window.dispatchEvent(new CustomEvent('printConfigChanged'));
                }}
              />
              <span className="font-medium">{t("Direct Print on Save")}</span>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer hover:bg-[#F5E8D8] p-1.5 rounded-lg border border-transparent hover:border-[#E8DCCB] transition-colors">
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-sky-500 cursor-pointer"
                defaultChecked={localStorage.getItem('msbillings_direct_settle') === 'true'}
                onChange={(e) => {
                  localStorage.setItem('msbillings_direct_settle', e.target.checked);
                  window.dispatchEvent(new CustomEvent('printConfigChanged'));
                }}
              />
              <span className="font-medium">{t("Direct Print on Settle")}</span>
            </label>
            <div className="text-[9px] text-slate-500 mt-2 leading-tight px-1 border-t border-[#E8DCCB] pt-1.5">
              {t("If ON, prints silently in background. If OFF, shows preview modal.")}
            </div>
          </div>
        </div>
      </div>






      {showNoteModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowNoteModal(false);
          }}
        >
          <div
            className="bg-white border border-[#E8DCCB] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-slide-up text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-orange-100 border border-orange-200 text-[#ea580c] rounded-xl shadow-xs">
                  <Clipboard size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-800">
                    {selectedCartItemForNote
                      ? `${t("Note for")} ${selectedCartItemForNote.name}`
                      : t("Special Note for Kitchen")}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedCartItemForNote
                      ? t("Add cut, cleaning, or packing instructions")
                      : t("Special requests, cleaning, or cooking notes")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNoteModal(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  {t("Cooking / Cutting Instructions")}
                </label>
                <textarea
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  placeholder={t('e.g. Skin out, clean properly, slice into curry cut pieces...')}
                  className="w-full px-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-[#ea580c] focus:ring-2 focus:ring-[#ea580c]/20 transition-all resize-none min-h-[110px]"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNoteModal(false);
                  }}
                  className="flex-1 py-2.5 border border-[#E8DCCB] bg-[#F7EFE2] text-slate-700 rounded-xl font-bold text-xs hover:bg-[#F5E8D8] hover:text-slate-900 transition-colors cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    submitNote();
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#c2410c] hover:to-[#9a3412] text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>{t("Save Note")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delivery Platforms Manager Modal (Full CRUD) */}

      {/* Delivery Platforms Manager Modal (Full CRUD) */}
      {showPlatformModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setShowPlatformModal(false);
            setNewPlatformName('');
          }}
        >
          <div
            className="bg-white w-full max-w-sm rounded-2xl border border-[#E8DCCB] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2]">
              <div>
                <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                  <span>🛵</span> {t("Delivery Platforms")}
                </h3>
                <p className="text-[11px] text-text-muted">{t("Add, select, or delete custom delivery channels")}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlatformModal(false);
                  setNewPlatformName('');
                }}
                className="text-gray-400 hover:text-text-muted dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Add New Platform Form */}
              <form onSubmit={handleAddPlatform} className="space-y-2">
                <label className="block text-xs font-bold text-text-muted dark:text-gray-300 uppercase tracking-wider">
                  {t("Add New Platform Name")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Dunzo, Magicpin, UberEats"
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    autoFocus
                    className="flex-1 px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c] focus:ring-1 focus:ring-[#ea580c]/20"
                  />
                  <button
                    type="submit"
                    disabled={!newPlatformName.trim()}
                    className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus size={14} />
                    <span>{t("Add")}</span>
                  </button>
                </div>
              </form>

              {/* List of Platforms with Delete buttons */}
              <div>
                <label className="block text-[11px] font-bold text-text-muted dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t("Active Platforms")}
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {/* Built-in Platforms */}
                  {['Direct Delivery', 'Swiggy', 'Zomato'].map((name) => {
                    const rawVal = name.startsWith('Direct') ? 'Direct' : name;
                    const isSelected = orderSource === rawVal;
                    return (
                      <div
                        key={name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderSource(rawVal);
                          setShowPlatformModal(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${isSelected
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : 'bg-white hover:bg-gray-100/80 border-border text-text-muted'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>{t(name)}</span>
                          <span className="text-[9px] text-gray-400 font-normal">({t("Default")})</span>
                        </div>
                        {isSelected && <span className="text-[10px] text-orange-600 font-bold">✓ {t("Active")}</span>}
                      </div>
                    );
                  })}

                  {/* Custom Added Platforms with Delete button */}
                  {customPlatforms.map((p) => {
                    const isSelected = orderSource === p;
                    return (
                      <div
                        key={p}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all ${isSelected
                          ? 'bg-orange-50 border-orange-200 text-orange-700'
                          : 'bg-white hover:bg-[#F5E8D8] border-border text-text-main'
                          }`}
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderSource(p);
                            setShowPlatformModal(false);
                          }}
                          className="flex-1 flex items-center gap-2 cursor-pointer truncate mr-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                          <span className="truncate">{p}</span>
                          {isSelected && <span className="text-[10px] text-orange-600 font-bold">✓ {t("Active")}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`${t("Delete custom platform")} "${p}"?`)) {
                              handleDeletePlatform(p);
                            }
                          }}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0"
                          title={t("Delete Platform")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Available Offers & Discounts Modal */}
      {showOffersModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#FDFBF7] border border-[#E8DCCB] shadow-2xl rounded-2xl text-slate-800 w-full max-w-md overflow-hidden animate-slide-up flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2] shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-orange-100 border border-orange-200 text-[#ea580c] rounded-xl shadow-xs">
                    <Tags size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800">{t("Available Offers & Discounts")}</h2>
                    <p className="text-[11px] text-slate-500">{t("Select an active store offer to apply to this bill")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOffersModal(false)}
                  className="text-slate-500 hover:text-slate-900 p-1.5 rounded-lg hover:bg-[#F5E8D8] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1 bg-white">
                {/* Occasion / Category Filter Pills */}
                {tenantDiscounts.filter(d => isOfferValid(d)).length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-1 shrink-0 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => setOffersModalCategoryFilter('All')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${offersModalCategoryFilter === 'All'
                        ? 'bg-sky-500 text-white shadow-xs'
                        : 'bg-[#F7EFE2] hover:bg-[#F5E8D8] text-slate-700 border border-[#E8DCCB]'
                        }`}
                    >
                      {t("All")} ({tenantDiscounts.filter(d => isOfferValid(d)).length})
                    </button>
                    {OFFER_CATEGORIES.map(cat => {
                      const count = tenantDiscounts.filter(d => isOfferValid(d) && (d.offerCategory || 'Special offers').toLowerCase() === cat.label.toLowerCase()).length;
                      if (count === 0 && offersModalCategoryFilter !== cat.label) return null;
                      const isSel = offersModalCategoryFilter === cat.label;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setOffersModalCategoryFilter(cat.label)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap border transition-all cursor-pointer flex items-center gap-1 ${isSel
                            ? 'bg-sky-500 text-white border-sky-400 shadow-xs'
                            : 'bg-[#F7EFE2] hover:bg-[#F5E8D8] text-slate-700 border-[#E8DCCB]'
                            }`}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                          <span className={`text-[9px] px-1 rounded-full ${isSel ? 'bg-white/20' : 'bg-[#FFF3E5] text-[#ea580c]'}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {(loadingDiscounts || !hasFetchedDiscounts) && tenantDiscounts.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 flex flex-col items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-sky-400 mb-2" />
                    <p className="font-bold text-xs text-slate-700">{t("Checking available offers...")}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{t("Fetching discounts from store configuration")}</p>
                  </div>
                ) : tenantDiscounts.filter(d => isOfferValid(d)).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <Tags size={32} className="mx-auto mb-2 text-slate-500" />
                    <p className="font-bold text-sm text-slate-700">{t("No active offers available")}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t("Configure discounts and BOGO rules in the Discounts & Offers page.")}</p>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOffersModal(false);
                          onNavigate('discount');
                        }}
                        className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-[#ea580c] border border-sky-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <Tags size={14} />
                        {t("Go to Discounts & Offers")}
                      </button>
                    )}
                  </div>
                ) : (() => {
                  const filteredOffers = tenantDiscounts
                    .filter(d => isOfferValid(d))
                    .filter(d => {
                      if (offersModalCategoryFilter === 'All') return true;
                      return (d.offerCategory || 'Special offers').toLowerCase() === offersModalCategoryFilter.toLowerCase();
                    });

                  if (filteredOffers.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-500 border border-dashed border-[#E8DCCB] rounded-xl p-4">
                        <p className="font-bold text-xs text-slate-700">
                          {t("No active offers found under")} "{offersModalCategoryFilter}"
                        </p>
                        <button
                          type="button"
                          onClick={() => setOffersModalCategoryFilter('All')}
                          className="mt-2 text-xs font-bold text-sky-400 hover:underline cursor-pointer"
                        >
                          {t("Show All Offers")} ({tenantDiscounts.filter(d => isOfferValid(d)).length})
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {filteredOffers.map((offer) => {
                        const isCurrent = discount?.name === offer.name;
                        const statusInfo = getOfferValidityStatus(offer);
                        const catMeta = getOfferCategoryMeta(offer.offerCategory);
                        return (
                          <div
                            key={offer._id}
                            className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${isCurrent
                              ? 'bg-[#FFF3E5] border-sky-400 shadow-sm'
                              : 'bg-[#F7EFE2] hover:bg-[#F5E8D8] border-[#E8DCCB]'
                              }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${offer.type === 'bogo'
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                                : offer.type === 'percentage'
                                  ? 'bg-[#FFF3E5] text-[#ea580c] border border-[#E8DCCB]'
                                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                }`}>
                                {offer.type === 'bogo' ? <Gift size={16} /> : <Tags size={16} />}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-sm text-slate-800 truncate">{offer.name}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.badgeColor}`}>
                                    <span>{catMeta.icon}</span>
                                    <span>{catMeta.label}</span>
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${offer.type === 'bogo'
                                    ? 'bg-amber-950 text-amber-300 border-amber-500/30'
                                    : offer.type === 'percentage'
                                      ? 'bg-[#FFF3E5] text-[#ea580c] border-[#E8DCCB]'
                                      : 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                    }`}>
                                    {offer.type === 'bogo'
                                      ? `Buy ${offer.buyQty || 2} Get ${offer.getQty || 1} Free`
                                      : offer.type === 'percentage'
                                        ? `${offer.value}% Off`
                                        : `${currencySymbol}${offer.value} Flat`}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                                  <span className="font-medium text-slate-700">
                                    {offer.applicableTo === 'category'
                                      ? `${t("Applies to")}: ${typeof offer.targetCategory === 'object' && offer.targetCategory !== null ? offer.targetCategory.name : (offer.targetCategory || t("Category"))}`
                                      : `${t("Applies to")}: ${t("All Menu Items")}`}
                                  </span>
                                  {statusInfo.timeRemaining && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-[#ea580c] bg-[#FFF3E5] px-1.5 py-0.5 rounded border border-[#E8DCCB] font-bold">
                                      <Clock size={10} />
                                      {statusInfo.timeRemaining}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => applyPresetOffer(offer)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${isCurrent
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-sky-500 hover:bg-sky-400 text-white shadow-xs'
                                }`}
                            >
                              {isCurrent ? t("Applied ✓") : t("Apply")}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Expired Offers List */}
                {tenantDiscounts.filter(d => !isOfferValid(d) && d.hasTimeline).length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      {t("Expired / Scheduled Offers (Not Currently Applicable)")}
                    </span>
                    <div className="space-y-1.5">
                      {tenantDiscounts.filter(d => !isOfferValid(d) && d.hasTimeline).map((expired) => {
                        const expCat = getOfferCategoryMeta(expired.offerCategory);
                        return (
                          <div key={expired._id} className="p-2 rounded-lg bg-[#f7f1ea] border border-border/60 flex items-center justify-between opacity-60">
                            <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                              <AlertTriangle size={13} className="text-red-400" />
                              <span className="font-medium line-through">{expired.name}</span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold border ${expCat.badgeColor}`}>
                                <span>{expCat.icon}</span>
                                <span>{expCat.label}</span>
                              </span>
                              <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 rounded">
                                {t("Expired")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 border-t border-[#E8DCCB] bg-[#F7EFE2] flex items-center justify-between gap-2 shrink-0">
                {discount?.name || discountAmount > 0 ? (
                  <button
                    onClick={() => {
                      setDiscount({ type: 'flat', value: '', name: '' });
                      setShowOffersModal(false);
                    }}
                    className="text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/60 border border-red-500/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
                  >
                    {t("Remove Applied Offer")}
                  </button>
                ) : <div />}
                <button
                  onClick={() => setShowOffersModal(false)}
                  className="px-4 py-2 bg-[#FDFBF7] hover:bg-[#F5E8D8] border border-[#E8DCCB] text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      {/* Safety Modal: Billed & Printed Order Warning */}
      {showBilledEditModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-fade-in"
          onClick={() => setShowBilledEditModal(false)}
        >
          <div
            className="bg-white border border-[#E8DCCB] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-5 text-center animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-2xl text-amber-600">
              🔒
            </div>
            <h3 className="font-black text-base text-slate-800 mb-1.5">
              {t("Order is Saved & Printed")}
            </h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              {t("This order is billed and locked for integrity. Click EDIT button to unlock before clearing or modifying items.")}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowBilledEditModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                {t("Close")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBilledEditModal(false);
                  if (onReopenOrder) onReopenOrder();
                }}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>✏️</span>
                <span>{t("Click EDIT Now (F3)")}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal: Clear All Order Items */}
      {showClearConfirmModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-fade-in"
          onClick={() => setShowClearConfirmModal(false)}
        >
          <div
            className="bg-white border border-[#E8DCCB] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-5 text-center animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-2xl text-rose-600">
              🗑️
            </div>
            <h3 className="font-black text-base text-slate-800 mb-1.5">
              {t("Clear All Order Items?")}
            </h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              {t("Are you sure you want to remove all items and applied discounts from the current counter order?")}
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
              >
                {t("Keep Order")}
              </button>
              <button
                type="button"
                onClick={confirmClearAll}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>🗑️</span>
                <span>{t("Yes, Clear All (F8)")}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default BillSummary;
