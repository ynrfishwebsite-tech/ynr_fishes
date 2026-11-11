import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Star, X, ChevronDown, Image as ImageIcon,
  Fish, Waves, Anchor, Droplets, Box, Package, Flame, Gift, Menu as MenuIcon,
  Plus, Minus, Loader2, RefreshCw, Sparkles, Scale, UtensilsCrossed, Filter, Check,
  LayoutGrid, CircleDot, User, Users, Phone, Building, Save, Printer, Lock, Unlock, ArrowRight
} from 'lucide-react';
import api from '../../../api/system/axios';
import { getMenuItems, updateMenuItem } from '../../../api/catalog/menu';
import { getCategories } from '../../../api/catalog/category';
import { getCachedMenuItems, getCachedCategories } from '../../../db/offlineDb';
import { getCachedCustomers, fetchPredefinedCustomers } from '../../../api/crm/customerApi';
import realtimeService from '../../../services/realtimeService';
import Fish3DRoller from './Fish3DRoller';
import FishSmartwatchDial from './FishSmartwatchDial';
import SearchableDropdown from '../../common/SearchableDropdown';

const getCategoryIcon = (catName, isSelected = false) => {
  const name = catName.toLowerCase();
  const baseColor = isSelected ? 'text-white' : 'text-text-muted';
  if (name === 'all') return <MenuIcon size={20} className={`shrink-0 ${baseColor}`} />;
  if (catName === '⭐ Favourites' || name.includes('favorite')) return <Star size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-yellow-500'}`} />;

  // 🐟 Real Seafood Market Categories
  if (name.includes('sea') || name.includes('marine') || name.includes('ocean')) return <Waves size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-cyan-400'}`} />;
  if (name.includes('fresh') || name.includes('river') || name.includes('lake') || name.includes('pond')) return <Droplets size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-emerald-400'}`} />;
  if (name.includes('crab') || name.includes('prawn') || name.includes('shrimp') || name.includes('shell')) return <Anchor size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-rose-400'}`} />;
  if (name.includes('box') || name.includes('wholesale') || name.includes('crate') || name.includes('mandi')) return <Box size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-amber-400'}`} />;
  if (name.includes('fillet') || name.includes('boneless') || name.includes('cut')) return <Fish size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-sky-400'}`} />;
  if (name.includes('dry') || name.includes('cured')) return <Package size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-yellow-600'}`} />;
  if (name.includes('offer') || name.includes('special')) return <Gift size={20} className={`shrink-0 ${isSelected ? 'text-white' : 'text-purple-400'}`} />;

  // Fallback seafood icons
  const icons = [Fish, Waves, Anchor, Droplets, Box, Package, Sparkles, Star];
  const colors = ['text-cyan-400', 'text-sky-400', 'text-blue-400', 'text-emerald-400', 'text-teal-400', 'text-amber-400'];

  let hash = 0;
  for (let i = 0; i < catName.length; i++) {
    hash = catName.charCodeAt(i) + ((hash << 5) - hash);
  }

  const IconComponent = icons[Math.abs(hash) % icons.length];
  const colorClass = colors[Math.abs(hash) % colors.length];

  return <IconComponent size={20} className={`shrink-0 ${isSelected ? 'text-white' : colorClass}`} />;
};

export const formatImageUrl = (url) => {
  if (!url) return '';
  let trimmed = url.trim();

  if (trimmed.includes('google.com/imgres') || trimmed.includes('imgurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('imgurl');
      if (extracted) trimmed = extracted;
    } catch (e) {
      const match = trimmed.match(/[?&]imgurl=([^&]+)/);
      if (match && match[1]) trimmed = decodeURIComponent(match[1]);
    }
  } else if (trimmed.includes('mediaurl=')) {
    try {
      const urlObj = new URL(trimmed);
      const extracted = urlObj.searchParams.get('mediaurl');
      if (extracted) trimmed = extracted;
    } catch (e) { }
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]{30,}$/.test(trimmed) || trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('R0lGOD') || trimmed.startsWith('UklGR')) {
    let mime = 'jpeg';
    if (trimmed.startsWith('iVBOR')) mime = 'png'; else
      if (trimmed.startsWith('R0lGOD')) mime = 'gif'; else
        if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

// In-memory set of already loaded/cached image URLs to render instantly with 0ms delay
const loadedImageCache = new Set();

// ─── Real-World Commercial Seafood Helper Functions ─────────────────────────
export const formatKgFraction = (totalKg) => {
  if (!totalKg || isNaN(totalKg) || totalKg <= 0) return '0 Kg';
  const num = parseFloat(totalKg);
  const whole = Math.floor(num);
  const frac = Math.round((num - whole) * 1000) / 1000;
  let fracSymbol = '';
  if (Math.abs(frac - 0.25) < 0.02) fracSymbol = '¼';
  else if (Math.abs(frac - 0.5) < 0.02) fracSymbol = '½';
  else if (Math.abs(frac - 0.75) < 0.02) fracSymbol = '¾';

  if (fracSymbol) {
    return whole > 0 ? `${whole} ${fracSymbol} Kg` : `${fracSymbol} Kg`;
  }
  return `${num.toFixed(num % 1 === 0 ? 0 : (num * 10) % 1 === 0 ? 1 : 2)} Kg`;
};

export const getItemWaterType = (item) => {
  if (item && item.waterType && ['sea_water', 'fresh_water'].includes(item.waterType)) {
    return item.waterType;
  }
  const catName = String(item?.category?.name || item?.category || '').toLowerCase();
  const itemName = String(item?.name || '').toLowerCase();
  const sciName = String(item?.scientificName || '').toLowerCase();

  if (
    catName.includes('fresh') || catName.includes('river') || catName.includes('sweet') || catName.includes('lake') || catName.includes('pond') ||
    itemName.includes('rohu') || itemName.includes('katla') || itemName.includes('catla') || itemName.includes('బొచ్చె') || itemName.includes('కాట్లా') ||
    itemName.includes('tilapia') || itemName.includes('తిలాపియా') ||
    itemName.includes('korramenu') || itemName.includes('murrel') || itemName.includes('కొర్రమీను') ||
    itemName.includes('common fish') || itemName.includes('కామన్') || itemName.includes('carp') ||
    itemName.includes('mattu') || itemName.includes('మట్టు') ||
    itemName.includes('karimeen') || itemName.includes('కరీమీన్') ||
    itemName.includes('sheelavathi') || itemName.includes('సీలావతి') ||
    itemName.includes('mirayal') || itemName.includes('mrigal') || itemName.includes('మిరాయల్') ||
    itemName.includes('bangaru theega') || itemName.includes('golden fish') ||
    itemName.includes('pothi gini') || itemName.includes('చిన్న చేపలు') ||
    itemName.includes('wallago') || itemName.includes('వాలగ') ||
    sciName.includes('labeo') || sciName.includes('catla') || sciName.includes('cirrhinus') || sciName.includes('channa') || sciName.includes('oreochromis') || sciName.includes('cyprinus') || sciName.includes('wallago') || sciName.includes('puntius')
  ) {
    return 'fresh_water';
  }
  return 'sea_water';
};

export const getItemSpeciesType = (item) => {
  if (item && item.speciesType && ['fish', 'prawn', 'crab'].includes(item.speciesType)) {
    return item.speciesType;
  }
  const catName = String(item?.category?.name || item?.category || '').toLowerCase();
  const itemName = String(item?.name || '').toLowerCase();
  if (catName.includes('prawn') || itemName.includes('prawn') || itemName.includes('shrimp') || catName.includes('shrimp')) {
    return 'prawn';
  }
  if (catName.includes('crab') || itemName.includes('crab') || itemName.includes('shell') || catName.includes('shell')) {
    return 'crab';
  }
  return 'fish';
};

export const detectItemSizeGrade = (item, netKg) => {
  if (!item) return 'medium';
  const grades = item.sizeGrades;
  const isSmallOn = grades?.small?.enabled !== false;
  const isMediumOn = grades?.medium?.enabled !== false;
  const isBigOn = grades?.big?.enabled !== false;

  const smallUnit = grades?.small?.unit || 'kg';
  const smallRawMax = parseFloat(grades?.small?.maxKg) || 1;
  const smallMax = smallUnit === 'g' ? smallRawMax / 1000 : smallRawMax;

  const mediumUnit = grades?.medium?.unit || 'kg';
  const mediumRawMax = parseFloat(grades?.medium?.maxKg) || 4;
  const mediumMax = mediumUnit === 'g' ? mediumRawMax / 1000 : mediumRawMax;

  let candidate = 'small';
  if (netKg <= smallMax) candidate = 'small';
  else if (netKg <= mediumMax) candidate = 'medium';
  else candidate = 'big';

  // If candidate is ON, use it
  if (candidate === 'small' && isSmallOn) return 'small';
  if (candidate === 'medium' && isMediumOn) return 'medium';
  if (candidate === 'big' && isBigOn) return 'big';

  // Fallback to first available ON size
  if (isMediumOn) return 'medium';
  if (isSmallOn) return 'small';
  if (isBigOn) return 'big';

  return candidate;
};

export const getItemPricePerKg = (item, mode = 'individual', sizeGrade = null) => {
  if (!item) return 0;
  const grades = item.sizeGrades;
  if (grades && sizeGrade && grades[sizeGrade]) {
    const gradeObj = grades[sizeGrade];
    if (mode === 'bulk') {
      const p = parseFloat(gradeObj.wholesalePrice);
      if (p && p > 0) return p;
    } else if (mode === 'export') {
      const p = parseFloat(gradeObj.exportPrice || gradeObj.wholesalePrice);
      if (p && p > 0) return p;
    } else {
      const p = parseFloat(gradeObj.price);
      if (p && p > 0) return p;
    }
  }

  if (mode === 'bulk') {
    return parseFloat(item.wholesalePricePerKg) || parseFloat(item.price) || 0;
  }
  if (mode === 'export') {
    return parseFloat(item.exportPricePerKg) || parseFloat(item.wholesalePricePerKg) || parseFloat(item.price) || 0;
  }
  return parseFloat(item.price) || 0;
};

export const getGradeAverageKg = (item, gradeKey = 'medium') => {
  return 1;
};

export const getItemSizeGrades = (item, mode = 'individual') => {
  if (!item) return [];
  const grades = item.sizeGrades;
  const isSmallOn = grades?.small?.enabled !== false;
  const isMediumOn = grades?.medium?.enabled !== false;
  const isBigOn = grades?.big?.enabled !== false;

  const smallUnit = grades?.small?.unit || 'kg';
  const smallMin = parseFloat(grades?.small?.minKg) || 0;
  const smallMax = parseFloat(grades?.small?.maxKg) || 1;

  const mediumUnit = grades?.medium?.unit || 'kg';
  const mediumMin = parseFloat(grades?.medium?.minKg) || (smallUnit === 'g' ? smallMax : smallMax);
  const mediumMax = parseFloat(grades?.medium?.maxKg) || (mediumUnit === 'g' ? 4000 : 4);

  const bigUnit = grades?.big?.unit || 'kg';
  const bigMin = parseFloat(grades?.big?.minKg) || (mediumUnit === 'g' ? mediumMax : mediumMax);
  const bigMax = parseFloat(grades?.big?.maxKg) || (bigUnit === 'g' ? 99000 : 99);

  const list = [
    {
      key: 'small',
      label: 'Small',
      minKg: smallMin,
      maxKg: smallMax,
      range: `${smallMin} to ${smallMax} ${smallUnit === 'g' ? 'g' : 'Kg'}`,
      enabled: isSmallOn,
      price: getItemPricePerKg(item, mode, 'small')
    },
    {
      key: 'medium',
      label: 'Medium',
      minKg: mediumMin,
      maxKg: mediumMax,
      range: `${mediumMin} to ${mediumMax} ${mediumUnit === 'g' ? 'g' : 'Kg'}`,
      enabled: isMediumOn,
      price: getItemPricePerKg(item, mode, 'medium')
    },
    {
      key: 'big',
      label: 'Big',
      minKg: bigMin,
      maxKg: bigMax,
      range: bigMax >= 50 && bigUnit !== 'g' ? `${bigMin}+ Kg` : `${bigMin} to ${bigMax} ${bigUnit === 'g' ? 'g' : 'Kg'}`,
      enabled: isBigOn,
      price: getItemPricePerKg(item, mode, 'big')
    }
  ];

  return list.filter(g => g.enabled);
};

const getFoodCategoryVisual = (name = '', cat = '') => {
  const lower = (name + ' ' + cat).toLowerCase();
  if (lower.includes('prawn') || lower.includes('shrimp')) {
    return { icon: '🦐', label: 'Prawns', cardBg: 'from-orange-500/20 to-rose-500/10', textAccent: 'text-orange-700' };
  }
  if (lower.includes('crab')) {
    return { icon: '🦀', label: 'Crab', cardBg: 'from-red-500/20 to-orange-500/10', textAccent: 'text-red-700' };
  }
  if (lower.includes('pomfret') || lower.includes('vavval')) {
    return { icon: '🐟', label: 'Pomfret', cardBg: 'from-blue-500/20 to-cyan-500/10', textAccent: 'text-blue-700' };
  }
  if (lower.includes('dry') || lower.includes('karuvadu')) {
    return { icon: '📦', label: 'Dry Fish', cardBg: 'from-amber-500/20 to-yellow-500/10', textAccent: 'text-amber-800' };
  }
  return { icon: '🐟', label: 'Seafood', cardBg: 'from-sky-500/20 to-teal-500/10', textAccent: 'text-sky-800' };
};

// Instant & Lazy Menu Image Component with zero-delay cached display & complete check
const LazyMenuImage = ({ src, alt, className, index = 999 }) => {
  const isCached = Boolean(src && loadedImageCache.has(src));
  const [loaded, setLoaded] = useState(isCached);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);
  // Only the first 6 images on screen get high-priority eager loading;
  // the rest use native lazy loading to avoid saturating the network.
  const isAboveFold = index < 6;

  useEffect(() => {
    if (!src) return;
    if (loadedImageCache.has(src)) {
      setLoaded(true);
      setError(false);
      return;
    }
    // Check if the DOM image is already complete in browser cache
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true);
        loadedImageCache.add(src);
      } else {
        setError(true);
      }
    }
  }, [src]);

  if (!src || error) {
    const visual = getFoodCategoryVisual(alt || '', '');
    return (
      <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#f7f1ea] border-b border-white/5 select-none">
        <div className={`absolute inset-0 bg-gradient-to-t ${visual.cardBg} opacity-90 pointer-events-none`} />
        <div className="text-3xl filter drop-shadow-md mb-0.5 relative z-10 transition-transform group-hover:scale-110 duration-300">
          {visual.icon}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${visual.textAccent} opacity-85 relative z-10 font-mono`}>
          {visual.label}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-gray-100">
      {/* Animated shimmer skeleton only while initial loading */}
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse flex items-center justify-center">
          <UtensilsCrossed size={16} className="text-gray-300 animate-spin" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={isAboveFold ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={isAboveFold ? 'high' : 'low'}
        onLoad={() => {
          setLoaded(true);
          loadedImageCache.add(src);
        }}
        onError={() => setError(true)}
        className={`w-full h-full object-cover transition-opacity duration-150 ease-out ${loaded ? 'opacity-100 scale-100 filter-none' : 'opacity-0 scale-95 blur-xs'
          } ${className || ''}`}
      />
    </div>
  );
};

import { useLanguage } from "../../../context/LanguageContext";
import useDebounce from "../../../hooks/useDebounce";

const MenuGrid = ({
  onSelectItem,
  activeTable,
  billType = 'Dine-In',
  searchTerm = '',
  onSearchChange,
  isLayoutLocked = false,
  onNavigate,
  userRole = 'Admin',
  foodTypeFilter: externalFoodTypeFilter,
  onFoodTypeFilterChange,
  fishOrderMode = 'individual',
  onFilterCounts,
  isLocked = false,
  orderStatus = '',
  hasPendingChanges = false,
  showToast,
  cart = [],
  cartTotal,
  onViewOrder,
  onAddBox,
  customerName = '',
  setCustomerName,
  customerPhone = '',
  setCustomerPhone,
  customerPhoto = '',
  customerCategory = '',
  exportSubCategory = null,
  isOrderLocked = false,
  setIsOrderLocked,
  lockedTimestamp = '',
  setLockedTimestamp,
  onCustomerSelect,
  onOpenCustomerModal,
  discount,
  setDiscount,
  onSaveOrder,
  onGenerateBill,
  actionLoading = null,
  onOpenWholesaleWizard = null
}) => {
  const { t, language } = useLanguage();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [selectedItemVariants, setSelectedItemVariants] = useState(null);
  const [activeDescCard, setActiveDescCard] = useState(null);
  const [descFilter, setDescFilter] = useState('all');
  const [selectedFishItem, setSelectedFishItem] = useState(null);
  const [fishWeightGrams, setFishWeightGrams] = useState('1000');
  const [inputKg, setInputKg] = useState('1');
  const [inputGrams, setInputGrams] = useState('0');
  const [selectedGradeOverride, setSelectedGradeOverride] = useState(null);
  const [selectedCutType, setSelectedCutType] = useState('Whole');
  const [tareGrams, setTareGrams] = useState(0);
  const [boxCountInput, setBoxCountInput] = useState('1');

  // Two-Level Filter: Water Environment & Species Sub-Filter
  const [waterTypeFilter, setWaterTypeFilter] = useState('all'); // 'all' | 'sea_water' | 'fresh_water'
  const [speciesTypeFilter, setSpeciesTypeFilter] = useState('all'); // 'all' | 'fish' | 'prawn' | 'crab'
  const [showSpeciesMenu, setShowSpeciesMenu] = useState(false);
  const speciesMenuRef = useRef(null);
  const speciesBtnRef = useRef(null);
  const [speciesMenuCoords, setSpeciesMenuCoords] = useState({ top: 0, left: 0 });
  const [showAdminCompactControls, setShowAdminCompactControls] = useState(false);

  const handleToggleSpeciesMenu = (e) => {
    e.stopPropagation();
    if (!showSpeciesMenu && speciesBtnRef.current) {
      const rect = speciesBtnRef.current.getBoundingClientRect();
      const menuWidth = 150;
      let left = rect.left;
      if (left + menuWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuWidth - 8);
      }
      if (left < 8) left = 8;
      setSpeciesMenuCoords({
        top: rect.bottom + 6,
        left
      });
    }
    setShowSpeciesMenu((prev) => !prev);
  };

  // Close species menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        speciesMenuRef.current &&
        !speciesMenuRef.current.contains(e.target) &&
        speciesBtnRef.current &&
        !speciesBtnRef.current.contains(e.target)
      ) {
        setShowSpeciesMenu(false);
      }
    };
    if (showSpeciesMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSpeciesMenu]);

  // Wholesale Multi-Item Box Builder State
  const [showBoxPacker, setShowBoxPacker] = useState(false);
  const [activeBoxFish, setActiveBoxFish] = useState(null);
  const [boxSlotCount, setBoxSlotCount] = useState(1);
  const [boxSlots, setBoxSlots] = useState([]);
  const [showWholesaleFishPicker, setShowWholesaleFishPicker] = useState(false);
  const [wholesaleFishSearch, setWholesaleFishSearch] = useState('');
  const [slotIndexToChange, setSlotIndexToChange] = useState(null);

  // Retail Multi-Item Order State
  const [retailSlots, setRetailSlots] = useState([]);
  const [activeRetailSlotIndex, setActiveRetailSlotIndex] = useState(0);
  const [showAddFishPicker, setShowAddFishPicker] = useState(false);
  const [addFishSearch, setAddFishSearch] = useState('');

  // Predefined Customer State & Cache Integration for Wholesale & Export
  const [predefinedCustomers, setPredefinedCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);

  const targetCategory = fishOrderMode === 'bulk' ? 'Wholesale' : (fishOrderMode === 'export' ? 'Export' : 'Retail');

  const loadPredefinedCustomers = useCallback(() => {
    const cached = getCachedCustomers(targetCategory);
    if (cached && cached.length > 0) {
      setPredefinedCustomers(cached);
    }
    fetchPredefinedCustomers(targetCategory, 'All', true).then(data => {
      if (Array.isArray(data)) {
        setPredefinedCustomers(data);
      }
    }).catch(() => {});
  }, [targetCategory]);

  useEffect(() => {
    loadPredefinedCustomers();
    const handleUpdate = (e) => {
      if (e?.detail) {
        const newC = e.detail;
        const cleanP = String(newC.phone || '').replace(/\D/g, '');
        setPredefinedCustomers(prev => {
          const filtered = prev.filter(c => String(c.phone || '').replace(/\D/g, '') !== cleanP);
          return [newC, ...filtered];
        });
      }
      loadPredefinedCustomers();
    };
    window.addEventListener('customersUpdated', handleUpdate);
    return () => window.removeEventListener('customersUpdated', handleUpdate);
  }, [loadPredefinedCustomers]);

  // Sync selected customer object with props
  useEffect(() => {
    if (customerPhone) {
      const cleanPhone = String(customerPhone).replace(/\D/g, '').slice(-10);
      const match = predefinedCustomers.find(c => {
        const p = String(c.phone || '').replace(/\D/g, '').slice(-10);
        return p === cleanPhone;
      });
      if (match) {
        setSelectedCustomerObj(match);
      } else {
        setSelectedCustomerObj({
          name: customerName || (fishOrderMode === 'bulk' ? 'Wholesale Dealer' : 'Export Client'),
          phone: customerPhone,
          category: targetCategory,
          photo: customerPhoto,
          exportSubCategory: exportSubCategory
        });
      }
    } else {
      setSelectedCustomerObj(null);
    }
  }, [customerPhone, customerName, customerPhoto, exportSubCategory, predefinedCustomers, fishOrderMode, targetCategory]);

  const filteredPredefinedCustomers = useMemo(() => {
    const s = customerSearch.toLowerCase().trim();
    return predefinedCustomers.filter(c => {
      if (!c) return false;
      const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
      if (fishOrderMode === 'bulk' && cat !== 'Wholesale') return false;
      if (fishOrderMode === 'export' && cat !== 'Export') return false;
      if (fishOrderMode !== 'bulk' && fishOrderMode !== 'export' && (cat === 'Wholesale' || cat === 'Export')) return false;
      if (!s) return true;
      const addrStr = typeof c.address === 'string' ? c.address : `${c.address?.line1 || ''} ${c.address?.city || ''}`;
      return (
        (c.name && c.name.toLowerCase().includes(s)) ||
        (c.phone && c.phone.includes(s)) ||
        (c.businessName && c.businessName.toLowerCase().includes(s)) ||
        addrStr.toLowerCase().includes(s)
      );
    });
  }, [predefinedCustomers, fishOrderMode, customerSearch]);

  const handleSelectCustomer = (cust) => {
    if (!cust) return;
    setSelectedCustomerObj(cust);
    if (onCustomerSelect) {
      onCustomerSelect(cust);
    } else {
      if (setCustomerName) setCustomerName(cust.name || 'Guest');
      if (setCustomerPhone) setCustomerPhone(cust.phone || '');
      if (setIsOrderLocked) setIsOrderLocked(true);
      const now = new Date();
      const dateFormatted = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeFormatted = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (setLockedTimestamp) setLockedTimestamp(`${dateFormatted}, ${timeFormatted}`);
    }
    setIsCustomerDropdownOpen(false);
    if (showToast) showToast(`Selected ${cust.name || cust.phone}`, 'success');
  };

  const handleClearCustomer = () => {
    setSelectedCustomerObj(null);
    if (setCustomerName) setCustomerName('');
    if (setCustomerPhone) setCustomerPhone('');
    if (onCustomerSelect) onCustomerSelect(null);
    if (setIsOrderLocked) setIsOrderLocked(false);
    if (setLockedTimestamp) setLockedTimestamp('');
    if (showToast) showToast('Customer selection cleared', 'info');
  };

  // Calculate current box number (Box #1, Box #2, etc.) based on existing boxes in cart
  const currentBoxNumber = useMemo(() => {
    const maxNum = (cart || []).reduce((max, it) => Math.max(max, Number(it.boxNumber || 0)), 0);
    return maxNum + 1;
  }, [cart]);

  // Formatted fish species dropdown options for SearchableDropdown in Wholesale & Export Box Packer
  const fishBoxOptions = useMemo(() => {
    return (items || []).map(fish => {
      const fishRate = fishOrderMode === 'export'
        ? (parseFloat(fish.exportPricePerKg) || parseFloat(fish.wholesalePricePerKg) || parseFloat(fish.price) || 0)
        : (parseFloat(fish.wholesalePricePerKg) || parseFloat(fish.price) || 0);
      const stockKg = Number(fish.stock ?? fish.inventoryStock ?? fish.currentStock ?? 0);
      return {
        value: fish._id,
        label: fish.name,
        badge: `Stock: ${stockKg}kg`,
        badgeColor: stockKg > 0 ? 'emerald' : 'slate',
        subtitle: `₹${fishRate}/Kg (${fishOrderMode === 'export' ? 'Export' : 'Wholesale'})`,
        price: fishRate,
        raw: fish
      };
    });
  }, [items, fishOrderMode]);

  // Open the Wholesale Box Builder / Wholesale Wizard
  const openBoxPackerModal = useCallback((initialFish = null, initialGradeOverride = null, initialWeightKg = null, wizardDraftOptions = null) => {
    if (onOpenWholesaleWizard && (fishOrderMode === 'bulk' || fishOrderMode === 'export')) {
      const mergedDraft = {
        ...(wizardDraftOptions || {}),
        customer: wizardDraftOptions?.customer || selectedCustomerObj || null
      };
      onOpenWholesaleWizard(initialFish, items, initialGradeOverride, initialWeightKg, mergedDraft);
      return;
    }
    setBoxSlotCount(1);
    const availableFishes = items.filter(it => it.isAvailable !== false);
    const chosenFish = initialFish || availableFishes[0] || items[0] || null;
    setActiveBoxFish(chosenFish);

    const initialEnabledGrade = chosenFish?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : chosenFish?.sizeGrades?.small?.enabled !== false ? 'small'
      : chosenFish?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    const chosenGrade = initialGradeOverride || chosenFish?.defaultSizeGrade || initialEnabledGrade;
    const defaultRate = getItemPricePerKg(chosenFish, fishOrderMode, chosenGrade);
    
    // Auto-split entered decimal weight (e.g. 20.5 Kg -> 20 Kg and 500 Grams)
    let slotKg = '1';
    let slotGrams = '';
    if (initialWeightKg !== null && initialWeightKg !== undefined) {
      const numWeight = parseFloat(initialWeightKg);
      if (!isNaN(numWeight) && numWeight > 0) {
        const wholeKg = Math.floor(numWeight);
        const fracGrams = Math.round((numWeight - wholeKg) * 1000);
        slotKg = String(wholeKg);
        slotGrams = fracGrams > 0 ? String(fracGrams) : '';
      }
    }

    const initialSlots = [{
      id: `slot_0_${Date.now()}_${Math.random()}`,
      fishId: chosenFish?._id || '',
      fish: chosenFish,
      sizeGrade: chosenGrade,
      weightKg: slotKg,
      weightGrams: slotGrams,
      pricePerKg: String(defaultRate)
    }];
    setBoxSlots(initialSlots);
    setShowBoxPacker(true);
  }, [items, fishOrderMode, onOpenWholesaleWizard, selectedCustomerObj]);

  // Handle changing the number of items in this box (1 to 10)
  const handleSlotCountChange = (newCount) => {
    const clamped = Math.max(1, Math.min(10, parseInt(newCount, 10) || 1));
    setBoxSlotCount(clamped);
    setBoxSlots(prevSlots => {
      const updated = [...prevSlots];
      const availableFishes = items.filter(it => it.isAvailable !== false);
      if (clamped > updated.length) {
        for (let i = updated.length; i < clamped; i++) {
          const chosen = availableFishes[i] || items[i % (items.length || 1)] || null;
          const initialEnabledGrade = chosen?.sizeGrades?.medium?.enabled !== false ? 'medium'
            : chosen?.sizeGrades?.small?.enabled !== false ? 'small'
            : chosen?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
          const chosenGrade = chosen?.defaultSizeGrade || initialEnabledGrade;
          const avgKg = getGradeAverageKg(chosen, chosenGrade);
          const defaultRate = getItemPricePerKg(chosen, fishOrderMode, chosenGrade);
          updated.push({
            id: `slot_${i}_${Date.now()}_${Math.random()}`,
            fishId: chosen?._id || '',
            fish: chosen,
            sizeGrade: chosenGrade,
            weightKg: String(avgKg),
            weightGrams: '',
            pricePerKg: String(defaultRate)
          });
        }
      } else if (clamped < updated.length) {
        return updated.slice(0, clamped);
      }
      return updated;
    });
  };

  const handleSlotFishChange = (index, selectedFishId) => {
    const chosen = items.find(it => String(it._id) === String(selectedFishId));
    if (index === 0 && chosen) {
      setActiveBoxFish(chosen);
    }
    const initialEnabledGrade = chosen?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : chosen?.sizeGrades?.small?.enabled !== false ? 'small'
      : chosen?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    const chosenGrade = chosen?.defaultSizeGrade || initialEnabledGrade;
    const avgKg = getGradeAverageKg(chosen, chosenGrade);
    const chosenRate = getItemPricePerKg(chosen, fishOrderMode, chosenGrade);

    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      return {
        ...slot,
        fishId: selectedFishId,
        fish: chosen || null,
        sizeGrade: chosenGrade,
        weightKg: String(avgKg),
        weightGrams: '',
        pricePerKg: String(chosenRate)
      };
    }));
  };

  const handleSlotGradeChange = (index, newGradeKey) => {
    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      const targetFish = slot.fish;
      const avgKg = getGradeAverageKg(targetFish, newGradeKey);
      const newRate = getItemPricePerKg(targetFish, fishOrderMode, newGradeKey);
      return {
        ...slot,
        sizeGrade: newGradeKey,
        weightKg: String(avgKg),
        weightGrams: '',
        pricePerKg: String(newRate)
      };
    }));
  };

  const handleSlotWeightKgChange = (index, weightVal) => {
    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      // If user enters a decimal in the KG field (e.g. 20.5), split into 20 Kg and 500 Grams
      if (weightVal && String(weightVal).includes('.')) {
        const parts = String(weightVal).split('.');
        const wholeKg = parts[0] || '0';
        const fracStr = (parts[1] || '').slice(0, 3);
        const fracGrams = fracStr ? Math.round(parseFloat(`0.${fracStr}`) * 1000) : 0;
        return {
          ...slot,
          weightKg: wholeKg,
          weightGrams: fracGrams > 0 ? String(fracGrams) : ''
        };
      }
      return { ...slot, weightKg: weightVal };
    }));
  };

  const handleSlotWeightGramsChange = (index, gramsVal) => {
    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      return { ...slot, weightGrams: gramsVal };
    }));
  };

  const handleSlotPriceChange = (index, priceVal) => {
    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      return { ...slot, pricePerKg: priceVal };
    }));
  };

  const handleRemoveSlot = (index) => {
    if (boxSlots.length <= 1) return;
    setBoxSlots(prev => prev.filter((_, idx) => idx !== index));
    setBoxSlotCount(prev => Math.max(1, prev - 1));
  };

  const handleAddSlot = () => {
    if (boxSlots.length >= 10) return;
    const nextIdx = boxSlots.length;
    const availableFishes = items.filter(it => it.isAvailable !== false);
    const chosen = availableFishes[nextIdx] || items[nextIdx % (items.length || 1)] || null;
    const initialEnabledGrade = chosen?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : chosen?.sizeGrades?.small?.enabled !== false ? 'small'
      : chosen?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    const chosenGrade = chosen?.defaultSizeGrade || initialEnabledGrade;
    const avgKg = getGradeAverageKg(chosen, chosenGrade);
    const chosenRate = getItemPricePerKg(chosen, fishOrderMode, chosenGrade);

    setBoxSlots(prev => [
      ...prev,
      {
        id: `slot_${nextIdx}_${Date.now()}_${Math.random()}`,
        fishId: chosen?._id || '',
        fish: chosen,
        sizeGrade: chosenGrade,
        weightKg: String(avgKg),
        weightGrams: '',
        pricePerKg: String(chosenRate)
      }
    ]);
    setBoxSlotCount(prev => prev + 1);
  };

  const handlePickWholesaleFishToAdd = (chosen) => {
    if (!chosen || boxSlots.length >= 10) return;
    const nextIdx = boxSlots.length;
    const initialEnabledGrade = chosen?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : chosen?.sizeGrades?.small?.enabled !== false ? 'small'
      : chosen?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    const chosenGrade = chosen?.defaultSizeGrade || initialEnabledGrade;
    const avgKg = getGradeAverageKg(chosen, chosenGrade);
    const chosenRate = getItemPricePerKg(chosen, fishOrderMode, chosenGrade);

    setBoxSlots(prev => [
      ...prev,
      {
        id: `slot_${nextIdx}_${Date.now()}_${Math.random()}`,
        fishId: chosen?._id || '',
        fish: chosen,
        sizeGrade: chosenGrade,
        weightKg: String(avgKg),
        weightGrams: '',
        pricePerKg: String(chosenRate)
      }
    ]);
    setBoxSlotCount(prev => prev + 1);
    setShowWholesaleFishPicker(false);
    setWholesaleFishSearch('');
    setSlotIndexToChange(null);
  };

  const handleAddBoxToOrder = (callbackAfterAdd) => {
    const validSlots = boxSlots.filter(s => {
      const wt = (parseFloat(s.weightKg) || 0) + ((parseFloat(s.weightGrams) || 0) / 1000);
      return s.fish && wt > 0;
    });
    if (validSlots.length === 0) {
      if (showToast) showToast('Please select at least one fish with valid weight', 'error');
      return false;
    }
    const boxItems = validSlots.map((slot, idx) => {
      const wt = Number(((parseFloat(slot.weightKg) || 0) + ((parseFloat(slot.weightGrams) || 0) / 1000)).toFixed(3));
      const rate = parseFloat(slot.pricePerKg) || 0;
      const totalAmount = parseFloat((wt * rate).toFixed(2));
      return {
        ...slot.fish,
        _id: slot.fish._id,
        menuItem: slot.fish._id,
        originalId: slot.fish._id,
        originalFishName: slot.fish.name,
        name: `${slot.fish.name}`,
        boxNumber: currentBoxNumber,
        boxLabel: `Box #${currentBoxNumber}`,
        isWholesaleBox: true,
        orderMode: fishOrderMode,
        sizeGrade: slot.sizeGrade || 'medium',
        sellingUnit: 'Kg',
        quantity: wt,
        weightKg: wt,
        enteredWeight: wt,
        grossWeightKg: wt,
        netWeightKg: wt,
        pricePerKg: rate,
        price: rate,
        total: totalAmount,
        itemKey: `${slot.fish._id}_box${currentBoxNumber}_slot${idx}_${Date.now()}`
      };
    });

    if (onAddBox) {
      onAddBox(boxItems);
    } else {
      boxItems.forEach(it => onSelectItem(it));
    }
    if (callbackAfterAdd) {
      callbackAfterAdd(boxItems);
    } else {
      setShowBoxPacker(false);
      if (showToast) showToast(`Added Box #${currentBoxNumber} to order`, 'success');
    }
    return true;
  };

  const handleModalSave = (isPrint = false) => {
    if (!customerPhone && !selectedCustomerObj?.phone) {
      if (showToast) showToast(`Please select a ${fishOrderMode === 'export' ? 'Export Client' : 'Wholesale Dealer'} first`, 'warning');
      setIsCustomerDropdownOpen(true);
      return;
    }

    const validSlots = boxSlots.filter(s => {
      const wt = (parseFloat(s.weightKg) || 0) + ((parseFloat(s.weightGrams) || 0) / 1000);
      return s.fish && wt > 0;
    });

    if (validSlots.length > 0) {
      handleAddBoxToOrder((newBoxItems) => {
        setShowBoxPacker(false);
        const fullCart = [...(cart || []), ...(newBoxItems || [])];
        if (isPrint) {
          if (onGenerateBill) onGenerateBill(fullCart);
          else if (onSaveOrder) onSaveOrder(fullCart);
        } else {
          if (onSaveOrder) onSaveOrder(fullCart);
        }
      });
    } else if (cart && cart.length > 0) {
      setShowBoxPacker(false);
      if (isPrint) {
        if (onGenerateBill) onGenerateBill(cart);
        else if (onSaveOrder) onSaveOrder(cart);
      } else {
        if (onSaveOrder) onSaveOrder(cart);
      }
    } else {
      if (showToast) showToast('Please enter weight for this box before saving', 'warning');
    }
  };

  // Retail Multi-Fish Slot Management
  const handlePickFishToAdd = (chosen) => {
    if (!chosen || retailSlots.length >= 10) return;
    const nextIdx = retailSlots.length;
    const initialEnabledGrade = chosen?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : chosen?.sizeGrades?.small?.enabled !== false ? 'small'
      : chosen?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    const chosenGrade = chosen?.defaultSizeGrade || initialEnabledGrade;
    const avgKg = getGradeAverageKg(chosen, chosenGrade);
    const chosenRate = getItemPricePerKg(chosen, 'retail', chosenGrade);

    setRetailSlots(prev => [
      ...prev,
      {
        id: `retail_${nextIdx}_${Date.now()}_${Math.random()}`,
        fishId: chosen._id,
        fish: chosen,
        cutType: 'Whole',
        sizeGrade: chosenGrade,
        inputKg: String(avgKg),
        inputGrams: '0',
        fishWeightGrams: String(avgKg * 1000),
        tareGrams: 0,
        pricePerKg: chosenRate
      }
    ]);
    setActiveRetailSlotIndex(nextIdx);
    setShowAddFishPicker(false);
    setAddFishSearch('');
  };

  const handleAddRetailSlot = () => {
    setShowAddFishPicker(true);
  };

  const handleRemoveRetailSlot = (index) => {
    if (retailSlots.length <= 1) return;
    setRetailSlots(prev => prev.filter((_, idx) => idx !== index));
    setActiveRetailSlotIndex(prev => Math.max(0, prev >= index ? prev - 1 : prev));
  };

  const handleRetailSlotFishChange = (index, selectedFishId) => {
    const chosen = items.find(it => String(it._id) === String(selectedFishId));
    if (!chosen) return;
    const initialEnabledGrade = chosen?.sizeGrades?.medium?.enabled !== false ? 'medium'
      : chosen?.sizeGrades?.small?.enabled !== false ? 'small'
      : chosen?.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
    const chosenGrade = chosen?.defaultSizeGrade || initialEnabledGrade;
    const avgKg = getGradeAverageKg(chosen, chosenGrade);
    const chosenRate = getItemPricePerKg(chosen, 'retail', chosenGrade);

    setRetailSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      return {
        ...slot,
        fishId: selectedFishId,
        fish: chosen,
        sizeGrade: chosenGrade,
        inputKg: String(avgKg),
        inputGrams: '0',
        fishWeightGrams: String(avgKg * 1000),
        pricePerKg: chosenRate
      };
    }));
  };

  const handleRetailSlotCutChange = (index, cut) => {
    setRetailSlots(prev => prev.map((slot, idx) => (idx === index ? { ...slot, cutType: cut } : slot)));
  };

  const handleRetailSlotGradeChange = (index, gradeKey) => {
    setRetailSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      const targetFish = slot.fish;
      const avgKg = getGradeAverageKg(targetFish, gradeKey);
      const newRate = getItemPricePerKg(targetFish, 'retail', gradeKey);
      return {
        ...slot,
        sizeGrade: gradeKey,
        inputKg: String(avgKg),
        inputGrams: '0',
        fishWeightGrams: String(avgKg * 1000),
        pricePerKg: newRate
      };
    }));
  };

  const handleRetailSlotKgChange = (index, kgPreset) => {
    setRetailSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      const sanitized = String(kgPreset).replace(/[^0-9]/g, '');
      const kgVal = parseInt(sanitized, 10) || 0;
      const gVal = parseInt(slot.inputGrams, 10) || 0;
      const currentNet = (kgVal * 1000 + gVal) / 1000;
      const detected = detectItemSizeGrade(slot.fish, currentNet);
      const newRate = getItemPricePerKg(slot.fish, 'retail', detected);
      return {
        ...slot,
        inputKg: sanitized,
        sizeGrade: detected,
        pricePerKg: newRate,
        fishWeightGrams: String(kgVal * 1000 + gVal)
      };
    }));
  };

  const handleRetailSlotGramsChange = (index, gPreset) => {
    setRetailSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      const kgVal = parseInt(slot.inputKg, 10) || 0;
      const gVal = parseInt(gPreset, 10) || 0;
      const currentNet = (kgVal * 1000 + gVal) / 1000;
      const detected = detectItemSizeGrade(slot.fish, currentNet);
      const newRate = getItemPricePerKg(slot.fish, 'retail', detected);
      return {
        ...slot,
        inputGrams: String(gPreset),
        sizeGrade: detected,
        pricePerKg: newRate,
        fishWeightGrams: String(kgVal * 1000 + gVal)
      };
    }));
  };

  const handleRetailSlotTareChange = (index, tVal) => {
    setRetailSlots(prev => prev.map((slot, idx) => (idx === index ? { ...slot, tareGrams: tVal } : slot)));
  };

  const handleRetailSlotScaleGramsChange = (index, sanitized) => {
    setRetailSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      const total = parseFloat(sanitized) || 0;
      const k = Math.floor(total / 1000);
      const g = total % 1000;
      const currentNet = Math.max(0, total - (slot.tareGrams || 0)) / 1000;
      const detected = detectItemSizeGrade(slot.fish, currentNet);
      const newRate = getItemPricePerKg(slot.fish, 'retail', detected);
      return {
        ...slot,
        fishWeightGrams: sanitized,
        inputKg: String(k),
        inputGrams: String(g),
        sizeGrade: detected,
        pricePerKg: newRate
      };
    }));
  };

  const handleRetailSave = (isPrint = false) => {
    const validSlots = retailSlots.filter(s => {
      const g = parseFloat(s.fishWeightGrams) || 0;
      return s.fish && g > 0;
    });

    if (validSlots.length === 0) {
      if (showToast) showToast('Please enter weight for at least one fish before saving', 'warning');
      return;
    }

    const itemsToAdd = validSlots.map(slot => {
      const scaleGrams = parseFloat(slot.fishWeightGrams) || 1000;
      const netGrams = Math.max(0, scaleGrams - (slot.tareGrams || 0));
      const netKg = netGrams / 1000;
      const activeGrade = slot.sizeGrade || slot.fish?.defaultSizeGrade || 'small';
      const activeRate = getItemPricePerKg(slot.fish, 'retail', activeGrade);
      const calculatedPrice = parseFloat((netKg * activeRate).toFixed(2));
      const fractionLabel = formatKgFraction(netKg);

      return {
        ...slot.fish,
        itemKey: `${slot.fish._id}_${slot.cutType}_${netGrams}g_${activeGrade}_retail`,
        menuItem: slot.fish._id,
        originalId: slot.fish._id,
        originalFishName: slot.fish.name,
        name: `${slot.fish.name} (${slot.cutType} - ${fractionLabel})`,
        price: activeRate,
        quantity: netKg,
        total: calculatedPrice,
        sellingUnit: 'Kg',
        enteredWeight: netKg,
        netWeightKg: netKg,
        grossWeightKg: netKg, // 1:1 exact raw catch deduction
        pricePerKg: activeRate,
        sizeGrade: activeGrade,
        orderMode: 'retail',
        cutType: slot.cutType,
        yieldFactor: 1.0,
        tareWeightKg: ((slot.tareGrams || 0) / 1000),
        customCuttingChargeEnabled: slot.fish?.customCuttingChargeEnabled ?? false,
        cuttingCharge: slot.fish?.cuttingCharge ?? 0,
        sizeGrades: slot.fish?.sizeGrades
      };
    });

    itemsToAdd.forEach(it => onSelectItem(it));

    const fullCart = [...(cart || []), ...itemsToAdd];
    setSelectedFishItem(null);

    // Immediately open Invoice Receipt Preview on the spot!
    if (isPrint) {
      if (onGenerateBill) {
        onGenerateBill(fullCart);
      } else if (onSaveOrder) {
        onSaveOrder(fullCart);
      }
    } else {
      if (onSaveOrder) {
        onSaveOrder(fullCart);
      }
    }
  };
  const [displayMode, setDisplayMode] = useState(() => {
    try {
      const resto = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
      if (resto.defaultBillingLayout) return resto.defaultBillingLayout;
    } catch (e) {}
    const saved = localStorage.getItem('menuGrid_displayMode');
    if (saved && saved !== '3d_roller') return saved;
    // Default to 'grid' across all screen sizes (mobile, tab, desktop)
    return 'grid';
  });
  const [activeRollerIndex, setActiveRollerIndex] = useState(0);

  // Sync when store settings update (e.g. from Settings page toggle)
  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      const updated = e.detail;
      if (updated?.defaultBillingLayout) {
        setDisplayMode(updated.defaultBillingLayout);
        try { localStorage.setItem('menuGrid_displayMode', updated.defaultBillingLayout); } catch (err) {}
      }
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdated);
  }, []);

  const handleSetDisplayMode = (mode) => {
    setDisplayMode(mode);
    try { localStorage.setItem('menuGrid_displayMode', mode); } catch (e) {}
  };

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Auto-reset 3D Roller index to 0 whenever search query or any filter changes
  useEffect(() => {
    setActiveRollerIndex(0);
  }, [searchTerm, debouncedSearchTerm, speciesTypeFilter, waterTypeFilter, category, sortBy, descFilter]);
  const gridContainerRef = useRef(null);
  const [showImages, setShowImages] = useState(() => {
    const saved = localStorage.getItem('menuGrid_showImages');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showAnimation, setShowAnimation] = useState(() => {
    const saved = localStorage.getItem('menuGrid_showAnimation');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [flyingItems, setFlyingItems] = useState([]);
  const scrollContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const lastClickedCardPos = useRef(null);

  const triggerFlyAnimation = (sourceX, sourceY, name, image) => {
    if (!showAnimation) return;
    if (isLocked || (orderStatus === 'Billed' && !hasPendingChanges)) return;
    const id = Date.now() + Math.random();

    let targetX = window.innerWidth - 180;
    let targetY = 180;

    const isSmallerScreen = typeof window !== 'undefined' && window.innerWidth < 1280;

    if (isSmallerScreen) {
      // 1. Smaller Screens (Mobile & Tablet): Item flies DOWNWARDS towards the bottom cart / bill bar!
      const bottomBar = document.getElementById('mobile-bottom-order-bar') ||
                        document.querySelector('[data-mobile-bottom-bar="true"]');
      const bottomCartBtn = document.querySelector('button[title="Scroll down to Current Order"]') ||
                            document.querySelector('button[title="View Current Order"]');
      if (bottomBar && bottomBar.offsetParent !== null) {
        const bRect = bottomBar.getBoundingClientRect();
        targetX = bRect.left + bRect.width / 2;
        targetY = bRect.top + bRect.height / 2;
      } else if (bottomCartBtn && bottomCartBtn.offsetParent !== null) {
        const cRect = bottomCartBtn.getBoundingClientRect();
        targetX = cRect.left + cRect.width / 2;
        targetY = cRect.top + cRect.height / 2;
      } else {
        targetX = window.innerWidth / 2;
        targetY = window.innerHeight - 35;
      }
    } else {
      // 2. Desktop Mode (>= 1280px): Target the exact newly added item spot at top of the items list
      const cartItemsContainer = document.getElementById('cart-items-container') || document.querySelector('.bill-cart-items, [data-billing-cart="true"]');
      const cartHeader = document.getElementById('cart-items-header');
      if (cartItemsContainer && cartItemsContainer.offsetParent !== null) {
        const cRect = cartItemsContainer.getBoundingClientRect();
        targetX = cRect.left + cRect.width / 2;
        // Exact top of cart items list under the table headers
        targetY = cRect.top + 32;
      } else if (cartHeader && cartHeader.offsetParent !== null) {
        const hRect = cartHeader.getBoundingClientRect();
        targetX = hRect.left + hRect.width / 2;
        targetY = hRect.bottom + 22;
      } else {
        const panel = document.querySelector('.bill-summary-container');
        if (panel && panel.offsetParent !== null) {
          const pRect = panel.getBoundingClientRect();
          targetX = pRect.left + pRect.width / 2;
          targetY = pRect.top + 160;
        }
      }
    }

    const newItem = {
      id,
      startX: sourceX || window.innerWidth / 2,
      startY: sourceY || window.innerHeight / 2,
      targetX,
      targetY,
      name,
      image
    };

    setFlyingItems((prev) => [...prev, newItem]);
    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    }, 850);
  };

  // ── Mobile Infinite Scroll ──────────────────────────────────────────────
  const MOBILE_BATCH_SIZE = 20;
  const [mobileLoadedCount, setMobileLoadedCount] = useState(MOBILE_BATCH_SIZE);
  const [isMobileLoadingMore, setIsMobileLoadingMore] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const sentinelRef = useRef(null);

  // Track viewport size
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);


  const [leftSidebarWidth, setLeftSidebarWidth] = useState(260);
  const isResizingLeft = useRef(false);

  const [isCategorySidebarCollapsed, setIsCategorySidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('resto_category_sidebar_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleCategorySidebar = useCallback(() => {
    setIsCategorySidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('resto_category_sidebar_collapsed', String(next));
      } catch (e) { }
      return next;
    });
  }, []);

  const startResizingLeft = React.useCallback((e) => {
    isResizingLeft.current = true;
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
  }, []);

  const stopResizingLeft = React.useCallback(() => {
    if (isResizingLeft.current) {
      isResizingLeft.current = false;
      document.body.style.cursor = 'default';
    }
  }, []);

  const resizeLeft = React.useCallback((e) => {
    if (isResizingLeft.current) {
      // MenuGrid is probably offset from left side (e.g. main nav), 
      // but usually the mouse clientX correlates well enough for width if it starts at 0,
      // but it doesn't. We should calculate width using getBoundingClientRect if needed,
      // but clientX is usually okay if MenuGrid is full width. Wait, there is a leftmost main menu nav!
      // The main nav is usually 60-80px. Let's just use movementX or calculate absolute.
      // e.movementX works, but let's just use setLeftSidebarWidth(prev => prev + e.movementX)
      // to avoid absolute positioning issues!
      setLeftSidebarWidth((prev) => {
        const newWidth = prev + e.movementX;
        if (newWidth > 150 && newWidth < 500) return newWidth;
        return prev;
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resizeLeft);
    window.addEventListener('mouseup', stopResizingLeft);
    return () => {
      window.removeEventListener('mousemove', resizeLeft);
      window.removeEventListener('mouseup', stopResizingLeft);
    };
  }, [resizeLeft, stopResizingLeft]);

  useEffect(() => {
    localStorage.setItem('menuGrid_showImages', JSON.stringify(showImages));
  }, [showImages]);

  useEffect(() => {
    localStorage.setItem('menuGrid_showAnimation', JSON.stringify(showAnimation));
  }, [showAnimation]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore if user is already typing in an input or textarea
      if (
        document.activeElement && (
          document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      // Auto-focus search if a regular character is typed (length === 1) without modifier keys
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleToggleFavorite = async (e, item) => {
    e.stopPropagation();
    const newIsFavorite = !item.isFavorite;

    // Optimistic update
    setItems(items.map((i) => i._id === item._id ? { ...i, isFavorite: newIsFavorite } : i));

    try {
      if (updateMenuItem) {
        await updateMenuItem(item._id, { isFavorite: newIsFavorite });
      }
    } catch (error) {
      console.error('Failed to update favorite status', error);
      // Revert on error
      setItems(items.map((i) => i._id === item._id ? { ...i, isFavorite: !newIsFavorite } : i));
    }
  };



  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchItems = async (isBackground = false) => {
    if (!isBackground && items.length === 0) {
      setLoading(true);
    }
    try {
      const data = await getMenuItems(true);
      setItems(data);
    } catch (error) {
      console.error('Error fetching menu:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay) on mount
    getCachedMenuItems().then((cachedItems) => {
      if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
        setItems(cachedItems);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    getCachedCategories().then((cachedCats) => {
      if (cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0) {
        setCategories(cachedCats);
      }
    }).catch(() => { });

    // 2. Background Revalidation with fresh data
    fetchCategories();
    fetchItems(true);


    // 3. Real-time menu synchronization (when items are added, updated, or imported)
    const handleMenuUpdated = () => {
      console.log('[MenuGrid] Realtime menuUpdated event caught, refreshing dishes...');
      fetchItems(true);
      fetchCategories();
    };
    const unsubMenu = realtimeService.subscribe('menuUpdated', handleMenuUpdated);

    return () => {
      unsubMenu();
    };
  }, []);

  // Proactively preload images in staggered batches to avoid saturating the network
  useEffect(() => {
    if (items && items.length > 0 && showImages) {
      const urls = items
        .map((i) => formatImageUrl(i.image))
        .filter((url) => url && !loadedImageCache.has(url));

      // Batch 1: first 6 images (above the fold) — immediate, high priority
      const aboveFoldBatch = urls.slice(0, 6);
      // Batch 2: rest of page 1 (up to 30 items) — after 800ms
      const page1Rest = urls.slice(6, 30);
      // Batch 3+: remaining pages — staggered every 2s
      const remaining = urls.slice(30);

      const preload = (url) => {
        if (!url || typeof url !== 'string' || loadedImageCache.has(url)) return;
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
        img.onload = () => loadedImageCache.add(url);
        img.onerror = () => loadedImageCache.add(url); // Cache failures so broken URLs do not lock TCP sockets
      };

      aboveFoldBatch.forEach(preload);

      const timers = [];

      if (page1Rest.length > 0) {
        timers.push(setTimeout(() => page1Rest.forEach(preload), 800));
      }

      // Load subsequent pages in batches of 30 with 2s spacing
      for (let i = 0; i < remaining.length; i += 30) {
        const batch = remaining.slice(i, i + 30);
        const delay = 2000 + Math.floor(i / 30) * 2000;
        timers.push(setTimeout(() => batch.forEach(preload), delay));
      }

      return () => timers.forEach(clearTimeout);
    }
  }, [items, showImages]);

  // ─── Per-category counts for mobile tab badges (respects foodType + descFilter, ignores category) ─
  const categoryItemCounts = React.useMemo(() => {
    const term = (debouncedSearchTerm || '').trim().toLowerCase();
    const counts = {};
    // Count for 'All'
    counts['All'] = items.filter(item => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term));
      const matchesDesc = descFilter === 'all' || (descFilter === 'hasDesc' && item.description && item.description.trim() !== '') || (descFilter === 'noDesc' && (!item.description || item.description.trim() === ''));
      return matchesSearch && matchesDesc;
    }).length;
    // Count per named category
    categories.forEach(cat => {
      counts[cat.name] = items.filter(item => {
        const itemCatName = item.category?.name || (typeof item.category === 'string' ? item.category : '');
        const itemCatId = item.category?._id || item.category;
        const matchedCat = cat;
        const matchesCategory = itemCatName === cat.name || (matchedCat && (itemCatId === matchedCat._id || itemCatName === matchedCat.name));
        const matchesSearch = !term || item.name.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term));
        const matchesDesc = descFilter === 'all' || (descFilter === 'hasDesc' && item.description && item.description.trim() !== '') || (descFilter === 'noDesc' && (!item.description || item.description.trim() === ''));
        return matchesCategory && matchesSearch && matchesDesc;
      }).length;
    });
    return counts;
  }, [items, debouncedSearchTerm, descFilter, categories]);

  const validCategories = categories.filter((cat) => {
    if (items.length === 0) return true;
    return categoryItemCounts[cat.name] > 0;
  });
  const categoryOptions = ['All', '⭐ Favourites', ...(validCategories.length > 0 ? validCategories : categories.filter((cat) => categoryItemCounts[cat.name] > 0)).map((cat) => cat.name)];

  const filteredItems = React.useMemo(() => {
    const term = (debouncedSearchTerm || '').trim().toLowerCase();
    const isSearching = term.length > 0;

    return items.filter((item) => {
      let matchesCategory = false;
      // If user is searching, find all matching items across the whole restaurant catalog!
      if (isSearching) {
        matchesCategory = true;
      } else if (category === 'All') {
        matchesCategory = true;
      } else if (category === '⭐ Favourites') {
        matchesCategory = item.isFavorite === true;
      } else {
        const itemCatName = item.category?.name || (typeof item.category === 'string' ? item.category : '');
        const itemCatId = item.category?._id || item.category;
        const matchedCat = categories.find(c => c.name === category);
        matchesCategory = itemCatName === category || (matchedCat && (itemCatId === matchedCat._id || itemCatName === matchedCat.name));
      }

      const matchesSearch = !isSearching ||
        item.name.toLowerCase().includes(term) ||
        (item.code && item.code.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.category?.name && item.category.name.toLowerCase().includes(term));

      const matchesDescFilter =
        descFilter === 'all' ||
        (descFilter === 'hasDesc' && item.description && item.description.trim() !== '') ||
        (descFilter === 'noDesc' && (!item.description || item.description.trim() === ''));

      // Water Type filter (Sea Water / Fresh Water)
      const matchesWaterType = waterTypeFilter === 'all' || getItemWaterType(item) === waterTypeFilter;

      // Species Type filter (Fish / Prawns / Crabs)
      const matchesSpeciesType = speciesTypeFilter === 'all' || getItemSpeciesType(item) === speciesTypeFilter;

      return matchesCategory && matchesSearch && matchesDescFilter && matchesWaterType && matchesSpeciesType;
    }).sort((a, b) => {
      switch (sortBy) {
        case 'latest':
          return new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0);
        case 'oldest':
          return new Date(a.createdAt || a.updatedAt || 0) - new Date(b.createdAt || b.updatedAt || 0);
        case 'alphaAsc':
          return a.name.localeCompare(b.name);
        case 'alphaDesc':
          return b.name.localeCompare(a.name);
        case 'priceAsc':
          return a.price - b.price;
        case 'priceDesc':
          return b.price - a.price;
        default:
          return 0;
      }
    });
  }, [items, category, debouncedSearchTerm, sortBy, categories, descFilter, waterTypeFilter, speciesTypeFilter]);

  // categoryItemCounts has been moved above to calculate validCategories

  // ─── Per-foodType counts for BillingPage mobile Veg/Non-Veg badge counts ─────────────
  const filterTypeCounts = React.useMemo(() => {
    const term = (debouncedSearchTerm || '').trim().toLowerCase();
    const base = items.filter(item => {
      const itemCatName = item.category?.name || (typeof item.category === 'string' ? item.category : '');
      const itemCatId = item.category?._id || item.category;

      let matchesCategory = true;
      if (category === '⭐ Favourites') {
        matchesCategory = item.isFavorite === true;
      } else if (category !== 'All') {
        const matchedCat = categories.find(c => c.name === category);
        matchesCategory = itemCatName === category || (matchedCat && (itemCatId === matchedCat._id || itemCatName === matchedCat.name));
      }

      const matchesSearch = !term || item.name.toLowerCase().includes(term) || (item.description && item.description.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });

    const getType = item => (item.type || item.foodType || (item.isVeg === true ? 'veg' : item.isVeg === false ? 'non-veg' : '')).toLowerCase();
    return {
      all: base.length,
      hasDesc: base.filter(i => i.description && i.description.trim() !== '').length,
      noDesc: base.filter(i => !i.description || i.description.trim() === '').length
    };
  }, [items, debouncedSearchTerm, category, categories]);

  // Live item counts for Water Environment pills (All Waters, Sea Water, Fresh Water)
  const waterTypeCounts = React.useMemo(() => {
    const term = (debouncedSearchTerm || '').trim().toLowerCase();
    const isSearching = term.length > 0;

    let allCount = 0;
    let seaCount = 0;
    let freshCount = 0;

    (items || []).forEach((item) => {
      let matchesCategory = true;
      if (category === '⭐ Favourites') {
        matchesCategory = item.isFavorite === true;
      } else if (category !== 'All') {
        const itemCatName = item.category?.name || (typeof item.category === 'string' ? item.category : '');
        const itemCatId = item.category?._id || item.category;
        const matchedCat = categories.find((c) => c.name === category);
        matchesCategory = itemCatName === category || (matchedCat && (itemCatId === matchedCat._id || itemCatName === matchedCat.name));
      }

      const matchesSearch = !isSearching ||
        item.name.toLowerCase().includes(term) ||
        (item.code && item.code.toLowerCase().includes(term)) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        (item.category?.name && item.category.name.toLowerCase().includes(term));

      const matchesDescFilter =
        descFilter === 'all' ||
        (descFilter === 'hasDesc' && item.description && item.description.trim() !== '') ||
        (descFilter === 'noDesc' && (!item.description || item.description.trim() === ''));

      const matchesSpecies = speciesTypeFilter === 'all' || getItemSpeciesType(item) === speciesTypeFilter;

      if (matchesCategory && matchesSearch && matchesDescFilter && matchesSpecies) {
        allCount++;
        const wt = getItemWaterType(item);
        if (wt === 'sea_water') seaCount++;
        else if (wt === 'fresh_water') freshCount++;
      }
    });

    return { all: allCount, sea_water: seaCount, fresh_water: freshCount };
  }, [items, category, categories, debouncedSearchTerm, descFilter, speciesTypeFilter]);

  useEffect(() => {
    if (onFilterCounts) onFilterCounts(filterTypeCounts);
  }, [filterTypeCounts, onFilterCounts]);

  // IntersectionObserver for mobile sentinel (placed AFTER filteredItems is defined)
  useEffect(() => {
    if (!isMobile) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && mobileLoadedCount < filteredItems.length) {
          setIsMobileLoadingMore(true);
          // Slight delay for smooth UX
          setTimeout(() => {
            setMobileLoadedCount((prev) => Math.min(prev + MOBILE_BATCH_SIZE, filteredItems.length));
            setIsMobileLoadingMore(false);
          }, 400);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isMobile, mobileLoadedCount, filteredItems.length]);

  useEffect(() => {
    setCurrentPage(1);
    setMobileLoadedCount(MOBILE_BATCH_SIZE);
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [category, descFilter, debouncedSearchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / (itemsPerPage === 'all' ? (filteredItems.length || 1) : itemsPerPage)));

  const paginatedItems = React.useMemo(() => {
    if (itemsPerPage === 'all') return filteredItems;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      if (gridContainerRef.current) {
        gridContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full bg-[#F7EFE2] overflow-hidden w-full">
      <style>{`
        @keyframes menuCardCascade {
          0% {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes fishFloatShimmer {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        @keyframes flyToCartAnim {
          0% {
            opacity: 0;
            transform: translate3d(var(--start-x), var(--start-y), 0) translate(-50%, -50%) scale(0.6) perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          14% {
            opacity: 1;
            transform: translate3d(var(--start-x), var(--start-y), 50px) translate(-50%, -50%) scale(1.1) perspective(1000px) rotateX(10deg) rotateY(-12deg) rotateZ(4deg);
          }
          48% {
            opacity: 1;
            transform: translate3d(calc(var(--start-x) + (var(--target-x) - var(--start-x)) * 0.52), calc(var(--start-y) + (var(--target-y) - var(--start-y)) * 0.48), 65px) translate(-50%, -50%) scale(0.95) perspective(1000px) rotateX(12deg) rotateY(-15deg) rotateZ(8deg);
          }
          80% {
            opacity: 0.95;
            transform: translate3d(calc(var(--target-x) - 10px), calc(var(--target-y) - 10px), 25px) translate(-50%, -50%) scale(0.65) perspective(1000px) rotateX(6deg) rotateY(-8deg) rotateZ(-4deg);
          }
          94% {
            opacity: 0.8;
            transform: translate3d(var(--target-x), var(--target-y), 0) translate(-50%, -50%) scale(0.25) perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--target-x), var(--target-y), 0) translate(-50%, -50%) scale(0.05) perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
        }
        .menu-card-anim-enabled {
          animation: menuCardCascade 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .menu-card-anim-enabled:hover img {
          transform: scale(1.08) rotate(1deg);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .flying-cart-fish {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 999999;
          pointer-events: none;
          animation: flyToCartAnim 0.82s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: center center;
          will-change: transform, opacity;
        }
      `}</style>
      {/* Mobile Category Scrollbar hidden for compact cashier view */}

      {/* Desktop Left Sidebar: Categories (Visible on large screens >= 1024px) */}
      {false && !isCategorySidebarCollapsed && (
        <div
          style={{ width: leftSidebarWidth }}
          className="hidden lg:flex flex-col bg-[#FDFBF7] shrink-0 h-full overflow-y-auto overflow-x-hidden hide-scrollbar py-3 border-r border-sky-500/20">
          <div className="flex flex-col w-full gap-1">
            {categoryOptions.map((cat) => {
              const isSelected = category === cat;
              const isAll = cat.toLowerCase() === 'all';
              const bgClass = isSelected
                ? 'bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-md rounded-xl mx-2 font-bold'
                : 'bg-transparent text-text-muted hover:bg-orange-50 hover:text-orange-800 text-slate-600 rounded-xl mx-2 font-bold';
              return (
                <button
                  key={cat}
                  className={`w-full text-left px-4 py-3 text-[15px] transition-all flex items-center justify-between group ${bgClass}`}
                  onClick={() => { setCategory(cat); if (onSearchChange) onSearchChange(''); }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-1 truncate">
                    {getCategoryIcon(cat, isSelected)}
                    <span className="truncate font-medium">{cat === '⭐ Favourites' ? t('Favorite Items') : t(cat.replace('⭐ ', ''))}</span>
                  </div>

                  {/* Collapse trigger right arrow on the All category row & selected categories */}
                  {isAll ? (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCategorySidebar();
                      }}
                      className={`p-1 rounded-lg transition-all ml-1 shrink-0 flex items-center justify-center cursor-pointer hover:scale-110 ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-text-muted'
                        }`}
                      title={t("Close Categories Sidebar")}>
                      <ChevronRight size={18} />
                    </span>
                  ) : (
                    isSelected && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategorySidebar();
                        }}
                        className="p-1 rounded-lg hover:bg-white/20 text-white transition-all ml-1 shrink-0 flex items-center justify-center cursor-pointer hover:scale-110"
                        title={t("Close Categories Sidebar")}>
                        <ChevronRight size={18} />
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Left Sidebar Drag Handle (Desktop only when not collapsed) */}
      {!isLayoutLocked && !isCategorySidebarCollapsed && (
        <div
          onMouseDown={startResizingLeft}
          className="hidden lg:block w-1.5 cursor-col-resize hover:bg-primary/50 bg-transparent shrink-0 z-40 transition-colors border-r border-border hover:border-transparent relative" />
      )}

      {/* Items Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f1ea] relative">

        {/* Floating Re-Open Button when category sidebar is collapsed */}
        {isCategorySidebarCollapsed && (
          <button
            type="button"
            onClick={toggleCategorySidebar}
            className="hidden lg:flex absolute top-1/2 -translate-y-1/2 left-0 z-30 bg-white/95 text-slate-700 hover:text-[#8b4513] hover:bg-[#FAF0E4] shadow-md rounded-r-xl py-2.5 px-1.5 transition-all items-center border-y border-r border-[#E8DCCB] cursor-pointer group"
            title={t("Open Categories Sidebar")}>
            <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* 🌊 Single Compact Filter Bar: Water & Species + View Mode Toggle (3D Roller vs Grid) */}
        <div className="relative bg-[#FAF0E4] border-b border-[#E8DCCB] px-1.5 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between gap-1 sm:gap-2 shrink-0 shadow-2xs">
          {/* Left: Water Environment & Species Filters (Single row on all screens) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
            {/* Water Type Filter Pills with Live Item Counts */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-nowrap">
              <button
                type="button"
                onClick={() => setWaterTypeFilter('all')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  waterTypeFilter === 'all'
                    ? 'bg-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-amber-50 shadow-2xs'
                }`}
              >
                <span>All</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono font-black leading-tight ${
                  waterTypeFilter === 'all' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {waterTypeCounts.all}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWaterTypeFilter('sea_water')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  waterTypeFilter === 'sea_water'
                    ? 'bg-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-amber-50 shadow-2xs'
                }`}
              >
                <span>Sea</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono font-black leading-tight ${
                  waterTypeFilter === 'sea_water' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {waterTypeCounts.sea_water}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWaterTypeFilter('fresh_water')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  waterTypeFilter === 'fresh_water'
                    ? 'bg-[#ea580c] text-white shadow-xs font-black'
                    : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-amber-50 shadow-2xs'
                }`}
              >
                <span>Fresh</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-mono font-black leading-tight ${
                  waterTypeFilter === 'fresh_water' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {waterTypeCounts.fresh_water}
                </span>
              </button>
            </div>

            {/* Subtle Divider */}
            <div className="h-3.5 sm:h-4 w-px bg-amber-400/80 mx-0.5 sm:mx-1 shrink-0" />

            {/* Species Filter Pill Button */}
            <div className="relative flex items-center shrink-0">
              <button
                ref={speciesBtnRef}
                type="button"
                onClick={handleToggleSpeciesMenu}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  speciesTypeFilter !== 'all'
                    ? 'bg-amber-100 text-[#ea580c] border border-[#ea580c] ring-1 ring-orange-200 font-black'
                    : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-amber-50 shadow-2xs'
                }`}
                title="Filter by Species"
              >
                <span className="uppercase text-[9px] sm:text-[10px] font-black tracking-wider">
                  {speciesTypeFilter === 'all' ? 'Species' : speciesTypeFilter}
                </span>
                <Filter size={10} className="text-[#ea580c] stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Species Popover Menu rendered via Portal to prevent any clipping */}
          {showSpeciesMenu && typeof document !== 'undefined' && createPortal(
            <div
              ref={speciesMenuRef}
              style={{
                position: 'fixed',
                top: `${speciesMenuCoords.top}px`,
                left: `${speciesMenuCoords.left}px`,
                zIndex: 99999
              }}
              className="bg-white/98 backdrop-blur-md border border-amber-300 rounded-2xl shadow-2xl p-1.5 min-w-[145px] animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="text-[9.5px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider border-b border-amber-100 mb-1">
                Select Species
              </div>
              {[
                { key: 'all', label: 'All Species' },
                { key: 'fish', label: 'Fish' },
                { key: 'prawn', label: 'Prawns' },
                { key: 'crab', label: 'Crabs' }
              ].map((sp) => {
                const isSelected = speciesTypeFilter === sp.key;
                return (
                  <button
                    key={sp.key}
                    type="button"
                    onClick={() => {
                      setSpeciesTypeFilter(sp.key);
                      setShowSpeciesMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#ea580c] text-white font-black shadow-xs'
                        : 'text-slate-700 hover:bg-amber-50'
                    }`}
                  >
                    <span>{sp.label}</span>
                    {isSelected && <Check size={12} className="stroke-[3]" />}
                  </button>
                );
              })}
            </div>,
            document.body
          )}

          {/* Right: View Mode Switcher for All Screens (Mobile, Tablet, Desktop) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
            {/* Mobile View: Very small compact toggle button */}
            <button
              type="button"
              onClick={() => handleSetDisplayMode(displayMode === '3d_roller' ? 'grid' : '3d_roller')}
              className="sm:hidden flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-amber-300/80 bg-white hover:bg-amber-50 shadow-2xs active:scale-95 transition-all cursor-pointer text-slate-800"
              title={displayMode === '3d_roller' ? "Switch to Grid View" : "Switch to 3D Roller View"}
            >
              {displayMode === '3d_roller' ? (
                <>
                  <LayoutGrid size={11} className="text-[#994d1c]" />
                  <span className="text-[10px] font-black text-[#994d1c]">Grid</span>
                </>
              ) : (
                <>
                  <CircleDot size={11} className="text-[#ea580c]" />
                  <span className="text-[10px] font-black text-[#ea580c]">3D</span>
                </>
              )}
            </button>

            {/* Tablet & Desktop: Dual View Mode Switcher (3D Roller vs Grid) */}
            <div className="hidden sm:flex items-center gap-1 bg-white/90 p-0.5 rounded-lg border border-slate-300 shrink-0">
              <button
                type="button"
                onClick={() => handleSetDisplayMode('3d_roller')}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === '3d_roller'
                    ? 'bg-[#994d1c] text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CircleDot size={12} className={displayMode === '3d_roller' ? 'text-amber-200' : 'text-slate-500'} />
                <span>3D Roller</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetDisplayMode('grid')}
                className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  displayMode === 'grid'
                    ? 'bg-[#994d1c] text-white shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutGrid size={12} className={displayMode === 'grid' ? 'text-amber-200' : 'text-slate-500'} />
                <span>Grid</span>
              </button>
            </div>

            {/* Discreet Admin Options Toggle (Desktop >= xl) */}
            <button
              type="button"
              onClick={() => setShowAdminCompactControls(!showAdminCompactControls)}
              className={`hidden xl:inline-block px-2 py-0.5 rounded text-[11px] font-bold transition-all border cursor-pointer ${
                showAdminCompactControls ? 'bg-amber-200 border-amber-400 text-amber-950 font-black' : 'bg-white/80 border-slate-300 text-slate-600 hover:bg-white'
              }`}
              title="Toggle Sorting & Display Options"
            >
              {showAdminCompactControls ? 'Hide Options' : 'Options'}
            </button>
          </div>
        </div>

        {/* Collapsible Admin Options (Latest, Add Item, Image toggle, Anim toggle - Hidden by default) */}
        {showAdminCompactControls && (
          <div className="bg-[#f0e4d2] border-b border-[#E8DCCB] px-3 py-1.5 flex items-center justify-end gap-2 text-xs flex-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-7 px-2 border border-slate-300 rounded bg-white text-slate-800 text-xs font-bold"
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="alphaAsc">A-Z</option>
              <option value="alphaDesc">Z-A</option>
              <option value="priceAsc">Price: Low-High</option>
              <option value="priceDesc">Price: High-Low</option>
            </select>

            {userRole === 'Admin' && (
              <button
                onClick={() => onNavigate && onNavigate('menu')}
                className="h-7 px-2.5 rounded bg-red-600 text-white font-bold text-xs hover:bg-red-700"
              >
                + Add Item
              </button>
            )}

            <button
              onClick={() => setShowImages(!showImages)}
              className={`h-7 px-2 rounded border font-bold text-xs ${showImages ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-200 text-slate-600'}`}
            >
              Images: {showImages ? 'On' : 'Off'}
            </button>

            <button
              onClick={() => setShowAnimation(!showAnimation)}
              className={`h-7 px-2 rounded border font-bold text-xs ${showAnimation ? 'bg-white text-slate-800 border-slate-300' : 'bg-slate-200 text-slate-600'}`}
            >
              Anim: {showAnimation ? 'On' : 'Off'}
            </button>
          </div>
        )}

        {/* Scrollable Items Grid */}
        <div ref={gridContainerRef} className={`flex-1 overflow-y-auto relative bg-[#f7f1ea] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${displayMode === '3d_roller' ? 'p-0 sm:p-1 md:p-2' : 'p-1 sm:p-3 md:p-4'}`}>
          {displayMode === '3d_roller' ? (
            <>
              {/* Mobile & Tablet View: Dedicated Smartwatch Round Dial UI */}
              <div className="xl:hidden w-full flex-1 flex flex-col items-center justify-center min-h-[460px] sm:min-h-full">
                <FishSmartwatchDial
                  items={filteredItems}
                  activeIndex={activeRollerIndex}
                  setActiveIndex={setActiveRollerIndex}
                  fishOrderMode={fishOrderMode}
                  getItemPricePerKg={getItemPricePerKg}
                  detectItemSizeGrade={detectItemSizeGrade}
                  formatKgFraction={formatKgFraction}
                  formatImageUrl={formatImageUrl}
                  onSelectItem={onSelectItem}
                  onAddBox={onAddBox}
                  triggerFlyAnimation={triggerFlyAnimation}
                  language={language}
                  t={t}
                  isLocked={isLocked}
                  orderStatus={orderStatus}
                  hasPendingChanges={hasPendingChanges}
                  showToast={showToast}
                  setShowBoxPacker={setShowBoxPacker}
                  openBoxPackerModal={openBoxPackerModal}
                  getGradeAverageKg={getGradeAverageKg}
                  showImages={showImages}
                  showAnimation={showAnimation}
                  cart={cart}
                  cartTotal={cartTotal}
                  onViewOrder={onViewOrder}
                  customerName={customerName}
                  setCustomerName={setCustomerName}
                  customerPhone={customerPhone}
                  setCustomerPhone={setCustomerPhone}
                  customerPhoto={customerPhoto}
                  customerCategory={customerCategory}
                  exportSubCategory={exportSubCategory}
                  onCustomerSelect={onCustomerSelect}
                  onOpenCustomerModal={onOpenCustomerModal}
                  predefinedCustomers={predefinedCustomers}
                  handleSelectCustomer={handleSelectCustomer}
                  handleClearCustomer={handleClearCustomer}
                  discount={discount}
                  setDiscount={setDiscount}
                />
              </div>

              {/* Desktop View (>= xl): 3D Horizontal Carousel (Untouched) */}
              <div className="hidden xl:block w-full h-full">
                <Fish3DRoller
                  items={filteredItems}
                  activeIndex={activeRollerIndex}
                  setActiveIndex={setActiveRollerIndex}
                  fishOrderMode={fishOrderMode}
                  getItemPricePerKg={getItemPricePerKg}
                  detectItemSizeGrade={detectItemSizeGrade}
                  getGradeAverageKg={getGradeAverageKg}
                  formatKgFraction={formatKgFraction}
                  formatImageUrl={formatImageUrl}
                  onSelectItem={onSelectItem}
                  onAddBox={onAddBox}
                  triggerFlyAnimation={triggerFlyAnimation}
                  language={language}
                  t={t}
                  isLocked={isLocked}
                  orderStatus={orderStatus}
                  hasPendingChanges={hasPendingChanges}
                  showToast={showToast}
                  setShowBoxPacker={setShowBoxPacker}
                  openBoxPackerModal={openBoxPackerModal}
                  showImages={showImages}
                  showAnimation={showAnimation}
                />
              </div>
            </>
          ) : (
            <>


          {/* Dynamic Loading State with Animated Spinner & Pulse Skeletons */}
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[360px] w-full">
              <div className="flex flex-col items-center justify-center p-6 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-red-100 mb-8 animate-pulse">
                <div className="relative flex items-center justify-center mb-3">
                  <div className="w-12 h-12 rounded-full border-4 border-red-100 border-t-red-600 animate-spin"></div>
                  <UtensilsCrossed size={20} className="text-red-600 absolute" />
                </div>
                <h4 className="font-bold text-text-main text-sm tracking-wide">{t("Loading Menu Items...")}</h4>
                <p className="text-xs text-gray-400 mt-1">{t("Fetching live dishes & prices")}</p>
              </div>

              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 sm:gap-4 w-full opacity-60">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="bg-surface border border-border shadow-2xl rounded-2xl text-text-main p-4 border border-border shadow-sm animate-pulse flex flex-col justify-between h-36">
                    <div className="flex justify-between items-center mb-2">
                      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                      <div className="w-4 h-4 bg-gray-200 rounded-full"></div>
                    </div>
                    <div className="w-3/4 h-4 bg-gray-200 rounded-md mb-2"></div>
                    <div className="w-1/2 h-3 bg-gray-100 rounded-md mb-4"></div>
                    <div className="flex justify-center">
                      <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(155px,1fr))] gap-3 sm:gap-4">
              {/* Mobile: show progressively loaded items; Desktop: show paginated items */}
              {(isMobile ? filteredItems.slice(0, mobileLoadedCount) : paginatedItems).map((item, idx) => {
                const isAvailable = item.isAvailable !== false; // default to true if undefined
                const dotColor = item.type === 'veg' ? 'bg-green-500 shadow-sm border border-green-200' : item.type === 'non-veg' ? 'bg-red-500 shadow-sm border border-red-200' : 'bg-gray-300';
                const stockKg = Number(item.stock ?? item.inventoryStock ?? item.currentStock ?? 0);

                return (
                  <div
                    key={item._id}
                    data-fish-card-id={item._id}
                    style={{ animationDelay: showAnimation ? `${Math.min(idx * 30, 400)}ms` : '0ms' }}
                    className={`menu-card-item ${showAnimation ? 'menu-card-anim-enabled' : ''} bg-[#FDFBF7] transition-all border flex flex-col justify-between overflow-hidden relative rounded-2xl ${isAvailable ? 'cursor-pointer hover:shadow-lg hover:border-orange-300 hover:shadow-orange-500/10 hover:-translate-y-1 border-orange-100 shadow-md' : 'cursor-not-allowed opacity-50 bg-[#F7EFE2] border-orange-100'} ${showImages ? 'min-h-48 sm:min-h-52' : 'min-h-[142px] sm:min-h-[148px] p-2.5 sm:p-3'}`}
                    onClick={(e) => {
                      if (!isAvailable) return;
                      if (isLocked || (orderStatus === 'Billed' && !hasPendingChanges)) {
                        if (showToast) {
                          showToast(t("Order is billed. Click EDIT to modify."), 'warning');
                        }
                        return;
                      }
                      const rect = e.currentTarget.getBoundingClientRect();
                      lastClickedCardPos.current = {
                        cardId: item._id,
                        x: rect.left + rect.width / 2,
                        y: rect.top + (showImages ? 65 : rect.height / 2)
                      };

                      // In Wholesale (Boxes) or Export (Bulk) mode, open the Bulk / Box Packer Modal
                      if (fishOrderMode === 'bulk' || fishOrderMode === 'export') {
                        openBoxPackerModal(item, null, inputKg || 1, selectedCustomerObj ? { customer: selectedCustomerObj } : null);
                        return;
                      }

                      // Retail Mode: Open Fish Weight selection modal with active sale mode pricing
                      const initialEnabledGrade = item.sizeGrades?.medium?.enabled !== false ? 'medium'
                        : item.sizeGrades?.small?.enabled !== false ? 'small'
                        : item.sizeGrades?.big?.enabled !== false ? 'big' : 'medium';
                      const initialGrade = item.defaultSizeGrade || initialEnabledGrade;
                      const initialAvgKg = getGradeAverageKg(item, initialGrade);
                      const initialRate = getItemPricePerKg(item, 'retail', initialGrade);

                      setRetailSlots([
                        {
                          id: `retail_0_${Date.now()}_${Math.random()}`,
                          fishId: item._id,
                          fish: item,
                          cutType: 'Whole',
                          sizeGrade: initialGrade,
                          inputKg: String(initialAvgKg),
                          inputGrams: '0',
                          fishWeightGrams: String(initialAvgKg * 1000),
                          tareGrams: 0,
                          pricePerKg: initialRate
                        }
                      ]);
                      setActiveRetailSlotIndex(0);
                      setShowAddFishPicker(false);
                      setAddFishSearch('');
                      setSelectedFishItem(item);
                    }}>

                    {/* When Images are ON: Floating badge over image banner */}
                    {showImages ? (
                      <>
                        <div className="flex items-start justify-between w-full h-4 z-[2] absolute top-2.5 left-0 px-2.5">
                          <div className="flex gap-1 items-center">
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                              KG
                            </span>
                          </div>

                          <div className="flex gap-1.5 items-center">
                            {(() => {
                              const isSea = getItemWaterType(item) === 'sea_water';
                              return (
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap shadow-2xs ${
                                  isSea
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSea ? 'bg-sky-500' : 'bg-emerald-500'}`}></span>
                                  <span>{isSea ? t('Sea Water') : t('Fresh Water')}</span>
                                </span>
                              );
                            })()}
                            {!isAvailable && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shadow-sm text-white bg-red-500/90 backdrop-blur-sm">{t("Out of Stock")}</span>}
                          </div>
                        </div>

                        <div className="w-full h-28 sm:h-30 shrink-0 bg-gray-100 relative overflow-hidden">
                          <LazyMenuImage src={formatImageUrl(item.image)} alt={item.name} index={idx} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                        </div>

                        <div className="flex-1 flex flex-col justify-between p-2.5">
                          <div className={`flex-1 flex flex-col items-center justify-center text-center mt-1 text-[13px] sm:text-[14px] leading-tight ${isAvailable ? 'font-bold text-slate-800' : 'font-medium text-slate-500 line-through'}`}>
                            <span className="line-clamp-2 leading-snug">{(language !== 'en' && item.nameTranslations?.[language]) || item.name}</span>
                            {item.scientificName && (
                              <span className="text-[11px] text-slate-600 font-medium italic line-clamp-1 mt-0.5">{item.scientificName}</span>
                            )}
                          </div>

                          <div className="flex flex-col items-center gap-1 w-full mt-1.5">
                            {(() => {
                              const ratePerKg = getItemPricePerKg(item, fishOrderMode);
                              if (fishOrderMode === 'export') {
                                return (
                                  <span className="text-[12px] sm:text-[13px] font-black px-2.5 py-0.5 rounded-full shadow-xs border bg-indigo-50 text-indigo-900 border-indigo-300 font-mono">
                                    ₹{ratePerKg.toFixed(2)}
                                    <span className="text-[10px] text-indigo-700 font-bold ml-0.5">/Kg (Export)</span>
                                  </span>
                                );
                              }
                              if (fishOrderMode === 'bulk') {
                                return (
                                  <span className="text-[12px] sm:text-[13px] font-black px-2.5 py-0.5 rounded-full shadow-xs border bg-amber-50 text-amber-900 border-amber-300 font-mono">
                                    ₹{ratePerKg.toFixed(2)}
                                    <span className="text-[10px] text-amber-700 font-bold ml-0.5">/Kg (Wholesale)</span>
                                  </span>
                                );
                              }
                              return (
                                <span className="text-[12px] sm:text-[13px] font-black px-2.5 py-0.5 rounded-full shadow-xs border bg-emerald-50 text-emerald-800 border-emerald-300 font-mono font-black">
                                  ₹{ratePerKg.toFixed(2)}
                                  <span className="text-[10px] text-emerald-700 font-semibold ml-0.5">/Kg (Retail)</span>
                                </span>
                              );
                            })()}

                            {/* Stock below the image section */}
                            <span className={`text-[9.5px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              stockKg > 0
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              Stock: <strong className="font-mono text-slate-900">{stockKg} Kg</strong>
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* When Images are OFF: Clean, Non-Overlapping Layout (Zero Text Cropping!) */
                      <div className="flex-1 flex flex-col justify-between w-full h-full">
                        {/* Top Inline Header Row: Unit Badge + Stock / Water Info */}
                        <div className="flex items-center justify-between w-full pb-1 border-b border-orange-100/70 mb-1 shrink-0">
                          <div className="flex items-center gap-1">
                            <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider ${
                              fishOrderMode === 'export'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : fishOrderMode === 'bulk'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              KG
                            </span>
                            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                              stockKg > 0
                                ? 'bg-slate-100 text-slate-800 border-slate-300'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              Stock: {stockKg} Kg
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {(() => {
                              const isSea = getItemWaterType(item) === 'sea_water';
                              return (
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap shadow-2xs ${
                                  isSea
                                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isSea ? 'bg-sky-500' : 'bg-emerald-500'}`}></span>
                                  <span>{isSea ? t('Sea Water') : t('Fresh Water')}</span>
                                </span>
                              );
                            })()}
                            {!isAvailable && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-red-600 bg-red-50 border border-red-200">
                                {t("Out of Stock")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle: Clean Uncropped Fish Name + Scientific Name (Full Width) */}
                        <div className="flex-1 flex flex-col items-center justify-center text-center my-auto px-0.5">
                          <span className="text-[13px] sm:text-[14px] font-bold text-slate-800 leading-snug line-clamp-2">
                            {(language !== 'en' && item.nameTranslations?.[language]) || item.name}
                          </span>
                          {item.scientificName && (
                            <span className="text-[10.5px] text-slate-500 italic font-medium line-clamp-1 mt-0.5">
                              {item.scientificName}
                            </span>
                          )}
                        </div>

                        {/* Bottom: Professional Clean Price Tag */}
                        <div className="flex justify-center w-full mt-1.5 shrink-0">
                          {(() => {
                            const ratePerKg = getItemPricePerKg(item, fishOrderMode);
                            const modeLabel = fishOrderMode === 'export' ? 'Export' : fishOrderMode === 'bulk' ? 'Wholesale' : 'Retail';
                            const themeBadge = fishOrderMode === 'export'
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : fishOrderMode === 'bulk'
                                ? 'bg-amber-50 text-amber-900 border-amber-200'
                                : 'bg-emerald-50 text-emerald-900 border-emerald-200';

                            return (
                              <span className={`inline-flex items-center gap-1 text-[12px] sm:text-[13px] font-mono font-black px-2.5 py-0.5 rounded-full border shadow-2xs ${themeBadge}`}>
                                <span>₹{ratePerKg.toFixed(2)}</span>
                                <span className="text-[10px] font-sans font-medium opacity-80">/Kg</span>
                                <span className="text-[9px] font-sans font-semibold opacity-75 ml-0.5">({modeLabel})</span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty Category State */}
              {!loading && filteredItems.length === 0 && category !== '⭐ Favourites' && (
                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-surface border border-border shadow-2xl rounded-3xl text-text-main border border-dashed border-border shadow-xs p-8">
                  <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3 shadow-inner">
                    <UtensilsCrossed size={28} />
                  </div>
                  <h3 className="text-base font-bold text-text-main mb-1">{t("No Items Found")}</h3>
                  <p className="text-xs text-gray-400 max-w-xs">{t("No dishes available in this category. Click below to reload menu data.")}</p>
                  <button
                    onClick={() => fetchItems(false)}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    <span>{t("Reload Menu")}</span>
                  </button>
                </div>
              )}

              {/* Empty Favourites State */}
              {category === '⭐ Favourites' && filteredItems.length === 0 && (
                <div className="col-span-full py-16 text-center flex flex-col items-center justify-center bg-surface border border-border shadow-2xl rounded-3xl text-text-main border border-dashed border-yellow-200 shadow-xs p-8">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
                    <Star size={32} className="fill-amber-500/20" />
                  </div>
                  <h3 className="text-lg font-bold text-text-main mb-1">{t("No Favourites Added Yet")}</h3>
                  <p className="text-text-muted text-xs max-w-md">{t("Hover over any menu item under \"All\" or other categories and click the")}
                    <Star size={14} className="inline text-amber-500 fill-amber-500 mx-0.5" />{t("star icon in the top right corner to add it right here for instant billing!")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Mobile Infinite Scroll Sentinel & Loader ── */}
          {isMobile && filteredItems.length > 0 && (
            <>
              {/* Sentinel: observed to trigger next batch load */}
              <div ref={sentinelRef} className="h-4 w-full" />

              {/* Spinner while loading next batch */}
              {isMobileLoadingMore && (
                <div className="flex items-center justify-center py-4 gap-2">
                  <Loader2 size={20} className="animate-spin text-red-500" />
                  <span className="text-xs text-text-muted font-medium">{t("Loading more...")}</span>
                </div>
              )}

              {/* End-of-list message */}
              {!isMobileLoadingMore && mobileLoadedCount >= filteredItems.length && filteredItems.length > MOBILE_BATCH_SIZE && (
                <div className="flex items-center justify-center py-4">
                  <span className="text-[11px] text-gray-400 font-medium px-4 py-1.5 bg-gray-100 rounded-full">
                    ✓ {t("All")} {filteredItems.length} {t("items loaded")}
                  </span>
                </div>
              )}
            </>
          )}
            </>
          )}
        </div>

        {/* Pagination Navigation Footer Bar — Desktop only (hidden on mobile) */}
        {displayMode !== '3d_roller' && filteredItems.length > 0 && (
          <div className="hidden lg:flex flex-col sm:flex-row items-center justify-between bg-[#FDFBF7] border-t border-sky-500/20 py-2.5 px-4 gap-2.5 shrink-0 shadow-md">
            {/* Item Count Display */}
            <div className="text-xs text-slate-400 font-medium">
              {itemsPerPage === 'all' ? (
                <span>{t("Showing all")} <strong className="text-slate-100 font-bold">{filteredItems.length}</strong> {t("items")}</span>
              ) : (
                <span>
                  {t("Showing")}{" "}
                  <strong className="text-slate-100 font-bold">
                    {Math.min(filteredItems.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredItems.length, currentPage * itemsPerPage)}
                  </strong>{" "}
                  {t("of")}{" "}
                  <strong className="text-slate-100 font-bold">{filteredItems.length}</strong> {t("items")}
                </span>
              )}
            </div>

            {/* Page Navigation Controls */}
            {itemsPerPage !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-sky-500/30 text-slate-300 hover:bg-sky-500/20 bg-[#F7EFE2] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title={t("Previous Page")}
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) => {
                    if (p === '...') {
                      return <span key={`ellipsis-${idx}`} className="px-1 text-xs text-sky-400/50 font-bold">...</span>;
                    }
                    const isActive = currentPage === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${isActive
                          ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs'
                          : 'bg-[#F7EFE2] text-slate-300 hover:bg-sky-500/20 border border-sky-500/30'
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-sky-500/30 text-slate-300 hover:bg-sky-500/20 bg-[#F7EFE2] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
                  title={t("Next Page")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Items Per Page Selector */}
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="hidden sm:inline font-medium">{t("Per Page:")}</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                  setItemsPerPage(val);
                  setCurrentPage(1);
                }}
                className="h-8 px-2 border border-border rounded-lg bg-[#f7f1ea] text-text-muted text-xs font-bold focus:outline-none focus:border-red-500 transition-all cursor-pointer shadow-2xs"
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
                <option value="all">{t("All")}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Variant Selection Modal */}
      {selectedItemVariants && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItemVariants(null);
          }}
        >
          <div
            className="bg-surface w-full max-w-sm rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-5 border-b border-border bg-linear-to-r from-primary/5 to-transparent">
              <h2 className="text-xl font-bold text-text-main pr-4 leading-tight">{t("Select Size")}<br /><span className="text-sm font-normal text-text-muted">{selectedItemVariants.name}</span></h2>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedItemVariants(null);
                }}
                className="text-text-muted hover:text-text-main hover:bg-surface-hover rounded-full p-2 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
              {selectedItemVariants.variants.map((variant, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const isDineInWithoutTable = (billType === 'Dine-In' || !billType) && !activeTable;

                    const itemToAdd = {
                      ...selectedItemVariants,
                      _id: `${selectedItemVariants._id}-${variant.name}`,
                      originalId: selectedItemVariants._id,
                      name: `${selectedItemVariants.name} (${variant.name})`,
                      price: variant.price
                    };

                    // 1. Add variant to cart immediately (instant 0ms response)
                    onSelectItem(itemToAdd);

                    // 2. Play 3D flying animation simultaneously as visual feedback
                    if (!isDineInWithoutTable && !isLocked) {
                      const btnRect = e.currentTarget.getBoundingClientRect();
                      triggerFlyAnimation(
                        btnRect.left + btnRect.width / 2,
                        btnRect.top + btnRect.height / 2,
                        itemToAdd.name,
                        formatImageUrl(selectedItemVariants.image),
                        `₹${itemToAdd.price}`
                      );
                    }
                    setSelectedItemVariants(null);
                  }}
                  className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group shadow-sm hover:shadow-md cursor-pointer"
                >
                  <span className="font-bold text-lg text-text-main group-hover:text-primary transition-colors">{variant.name}</span>
                  <span className="font-black text-xl text-text-main bg-background px-3 py-1 rounded-lg border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">₹{variant.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Fish Weight / Box Selection Modal (Individual Retail & Wholesale Boxes) */}
      {selectedFishItem && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-1.5 sm:p-3 md:p-4 animate-in fade-in duration-200 overflow-hidden"
          onClick={() => setSelectedFishItem(null)}
        >
          <div
            data-fish-modal="true"
            className="bg-[#FDFBF7] w-full max-w-[560px] h-[92dvh] max-h-[92dvh] sm:h-auto sm:max-h-[88vh] rounded-2xl md:rounded-3xl shadow-2xl border-2 border-[#E8DCCB] flex flex-col overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Mode Badge and Close Button */}
            {(() => {
              let modeBadge = { label: 'Retail Sale (Kg & Grams)', bg: 'bg-[#FFF3E0] text-[#c2410c] border-[#ffcc80]' };
              if (fishOrderMode === 'export') {
                modeBadge = { label: 'Export (Bulk) Sale (Kg & Grams)', bg: 'bg-indigo-50 text-indigo-900 border-indigo-200' };
              } else if (fishOrderMode === 'bulk') {
                modeBadge = { label: 'Wholesale Sale (Kg & Grams)', bg: 'bg-amber-50 text-amber-900 border-amber-200' };
              }

              return (
                <div className="flex justify-between items-center px-3 sm:px-4 py-2 border-b border-[#E8DCCB] bg-[#FAF0E4] shrink-0">
                  <span className={`text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${modeBadge.bg}`}>
                    {modeBadge.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedFishItem(null)}
                    className="text-slate-500 hover:text-slate-800 bg-white hover:bg-[#F5E8D8] border border-[#E8DCCB] rounded-full p-1.5 transition-all cursor-pointer shadow-xs"
                  >
                    <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                </div>
              );
            })()}

            <div className="p-2 sm:p-2.5 md:p-3 space-y-2 sm:space-y-2.5 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {/* 1. RETAIL CUSTOMER SELECTOR (OPTIONAL) */}
              <div className="bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <User size={13} className="text-amber-700" />
                    <span>Select Retail Customer:</span>
                  </span>
                  <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded">
                    Optional (Walk-in)
                  </span>
                </div>

                {selectedCustomerObj ? (
                  <div className="bg-white border-2 border-amber-400/80 rounded-xl p-2 sm:p-2.5 shadow-sm space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        {selectedCustomerObj.photo ? (
                          <img
                            src={selectedCustomerObj.photo}
                            alt={selectedCustomerObj.name}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-amber-500 shadow-xs ring-2 ring-amber-300 ring-offset-1 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs ring-2 ring-amber-300 ring-offset-1 shrink-0">
                            {(selectedCustomerObj.name || 'C').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {selectedCustomerObj.name || 'Walk-in Customer'}
                            </span>
                            <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 px-1.5 py-0.2 rounded shrink-0">
                              Retail
                            </span>
                          </div>
                          {selectedCustomerObj.phone && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono font-bold mt-0.5">
                              <Phone size={11} className="text-slate-400 shrink-0" />
                              <span>{selectedCustomerObj.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={handleClearCustomer}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-0.5"
                          title="Clear customer"
                        >
                          <X size={11} />
                          <span>Clear</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                        >
                          {isCustomerDropdownOpen ? 'Close' : 'Change'}
                        </button>
                      </div>
                    </div>

                    {Boolean(selectedCustomerObj.businessName && String(selectedCustomerObj.businessName).trim()) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold bg-[#FAF0E4] px-2 py-1 rounded-lg border border-[#E8DCCB]">
                        <Building size={13} className="text-amber-700 shrink-0" />
                        <span className="text-slate-500 font-medium">Shop Name:</span>
                        <span className="text-slate-900 font-black">{String(selectedCustomerObj.businessName).trim()}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => setIsCustomerDropdownOpen(true)}
                    className="bg-white border-2 border-dashed border-amber-400 hover:border-amber-500 rounded-xl p-2.5 text-center cursor-pointer active:scale-98 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-xs">
                      <User size={15} className="text-amber-600 group-hover:scale-110 transition-transform" />
                      <span>Tap here to select Retail Customer (Optional)</span>
                      <ChevronDown size={14} className="text-amber-600" />
                    </div>
                  </div>
                )}

                {/* Dropdown Customer Search Menu */}
                {isCustomerDropdownOpen && (
                  <div className="bg-white border border-[#E8DCCB] rounded-xl shadow-xl p-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search customer by name or phone..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#FAF0E4] border border-[#E8DCCB] rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-[#E8DCCB]/40">
                      {filteredPredefinedCustomers.length > 0 ? (
                        filteredPredefinedCustomers.map((c) => (
                          <div
                            key={c._id || c.phone}
                            onClick={() => handleSelectCustomer(c)}
                            className="pt-1.5 first:pt-0 p-1.5 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 active:scale-98"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {c.photo ? (
                                <img src={c.photo} alt={c.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                  {(c.name || 'C').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 truncate">{c.name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{c.phone}</div>
                              </div>
                            </div>
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                              Select
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-2 text-xs text-slate-500">
                          No matching retail customers found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. FISHES IN THIS BILL - VISUAL TABS & "+ ADD ANOTHER FISH" BUTTON */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[10.5px] sm:text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Scale size={13} className="text-amber-700" />
                    <span>Fishes in this Bill ({retailSlots.length}):</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.2 rounded-full">
                    Tap to Switch Fish
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {retailSlots.map((slot, sIdx) => {
                    const scaleGrams = parseFloat(slot.fishWeightGrams) || 0;
                    const netGrams = Math.max(0, scaleGrams - (slot.tareGrams || 0));
                    const netKg = netGrams / 1000;
                    const isCurrentActive = activeRetailSlotIndex === sIdx && !showAddFishPicker;
                    return (
                      <button
                        key={slot.id || sIdx}
                        type="button"
                        onClick={() => { setActiveRetailSlotIndex(sIdx); setShowAddFishPicker(false); }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer shrink-0 ${
                          isCurrentActive
                            ? 'bg-amber-600 text-white border-amber-700 shadow-sm font-black'
                            : 'bg-white text-slate-800 border-[#E8DCCB] hover:bg-amber-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                          {slot.fish?.image ? (
                            <img src={formatImageUrl(slot.fish.image)} alt={slot.fish.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[11px]">🐟</span>
                          )}
                        </div>
                        <span className="truncate max-w-[85px] sm:max-w-[110px]">{slot.fish?.name || `Fish #${sIdx + 1}`}</span>
                        <span className={`text-[10px] font-mono ${isCurrentActive ? 'text-amber-100' : 'text-slate-500'}`}>
                          {netKg.toFixed(1)}kg
                        </span>
                        {retailSlots.length > 1 && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveRetailSlot(sIdx);
                            }}
                            className={`ml-0.5 rounded px-1 py-0.2 text-[10px] font-black cursor-pointer ${
                              isCurrentActive
                                ? 'bg-amber-700 hover:bg-amber-800 text-white'
                                : 'text-red-500 hover:bg-red-50'
                            }`}
                            title="Remove fish"
                          >
                            ✕
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {retailSlots.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAddFishPicker(true)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs border ${
                        showAddFishPicker
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-[#FAF0E4] hover:bg-[#F5E8D8] text-amber-900 border-amber-300'
                      }`}
                    >
                      <Plus size={14} strokeWidth={3} />
                      <span>Add Another Fish</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3. CONDITIONAL: VISUAL PHOTO-GRID FISH PICKER OR ACTIVE FISH CALCULATOR */}
              {showAddFishPicker ? (
                /* Visual Fish Picker with Big Photos & Telugu Names */
                <div className="bg-white border-2 border-amber-400 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                      <span>🐟 Tap Any Fish Photo to Add to Bill:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddFishPicker(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Close ✕
                    </button>
                  </div>

                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type name or search fish (English / తెలుగు)..."
                      value={addFishSearch}
                      onChange={(e) => setAddFishSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto pr-0.5">
                    {items
                      .filter(it => it.isAvailable !== false)
                      .filter(it => {
                        if (!addFishSearch) return true;
                        const s = addFishSearch.toLowerCase();
                        return (it.name && it.name.toLowerCase().includes(s)) ||
                          (it.nameTranslations && Object.values(it.nameTranslations).some(v => String(v).toLowerCase().includes(s))) ||
                          (it.scientificName && it.scientificName.toLowerCase().includes(s));
                      })
                      .map(f => {
                        const fRate = getItemPricePerKg(f, 'retail');
                        const fStock = Number(f.stock ?? f.inventoryStock ?? f.currentStock ?? 0);
                        const fIsSea = getItemWaterType(f) === 'sea_water';
                        return (
                          <div
                            key={f._id}
                            onClick={() => handlePickFishToAdd(f)}
                            className="bg-[#FAF0E4]/60 hover:bg-amber-100/90 border-2 border-[#E8DCCB] hover:border-amber-500 rounded-xl p-2 cursor-pointer transition-all active:scale-95 shadow-2xs flex flex-col items-center text-center group"
                          >
                            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg overflow-hidden bg-white border border-[#E8DCCB] mb-1.5 flex items-center justify-center shrink-0 shadow-xs">
                              {f.image ? (
                                <img src={formatImageUrl(f.image)} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              ) : (
                                <span className="text-2xl">🐟</span>
                              )}
                            </div>
                            <span className="text-xs font-black text-slate-900 leading-tight line-clamp-1">
                              {(language !== 'en' && f.nameTranslations?.[language]) || f.name}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`text-[8px] font-bold px-1 rounded ${fIsSea ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {fIsSea ? 'Sea' : 'Fresh'}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500">Stock: {fStock}k</span>
                            </div>
                            <span className="text-xs font-black text-emerald-800 font-mono mt-1">₹{fRate.toFixed(0)}/Kg</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                /* Active Fish Editor */
                (() => {
                  const currentSlot = retailSlots[activeRetailSlotIndex] || retailSlots[0];
                  if (!currentSlot) return null;
                  const currentFish = currentSlot.fish || selectedFishItem;
                  const activeGrade = currentSlot.sizeGrade || currentFish?.defaultSizeGrade || 'small';
                  const activeRate = getItemPricePerKg(currentFish, 'retail', activeGrade);
                  const stockKg = Number(currentFish?.stock ?? currentFish?.inventoryStock ?? currentFish?.currentStock ?? 0);
                  const isSea = getItemWaterType(currentFish) === 'sea_water';

                  const currentScaleGrams = parseFloat(currentSlot.fishWeightGrams) || 0;
                  const currentNetGrams = Math.max(0, currentScaleGrams - (currentSlot.tareGrams || 0));
                  const currentNetKg = currentNetGrams / 1000;
                  const currentSlotTotal = currentNetKg * activeRate;
                  const fractionLabel = formatKgFraction(currentNetKg);

                  const smallMax = parseFloat(currentFish?.sizeGrades?.small?.maxKg) || 1;
                  const mediumMax = parseFloat(currentFish?.sizeGrades?.medium?.maxKg) || 4;
                  const allGrades = [
                    { key: 'small', label: 'Small', range: `0-${smallMax}Kg`, enabled: currentFish?.sizeGrades?.small?.enabled !== false },
                    { key: 'medium', label: 'Medium', range: `${smallMax}-${mediumMax}Kg`, enabled: currentFish?.sizeGrades?.medium?.enabled !== false },
                    { key: 'big', label: 'Big', range: `${mediumMax}+Kg`, enabled: currentFish?.sizeGrades?.big?.enabled !== false }
                  ].filter(g => g.enabled);

                  return (
                    <div className="bg-white border-2 border-[#E8DCCB] rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-xs space-y-2.5">
                      {/* Active Fish Big Header Card */}
                      <div className="bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl p-2 sm:p-2.5 flex items-center gap-2.5 sm:gap-3">
                        <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-white border border-[#E8DCCB] shrink-0 relative flex items-center justify-center shadow-xs">
                          {currentFish.image ? (
                            <img
                              src={formatImageUrl(currentFish.image)}
                              alt={currentFish.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-3xl">🐟</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full border whitespace-nowrap shadow-2xs ${
                              isSea
                                ? 'bg-sky-50 text-sky-800 border-sky-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isSea ? 'bg-sky-500' : 'bg-emerald-500'}`}></span>
                              <span>{isSea ? t('Sea Water') : t('Fresh Water')}</span>
                            </span>
                            <span className="text-[9.5px] font-bold text-slate-600 bg-white border border-slate-300 px-1.5 py-0.2 rounded">
                              Stock: <strong className="text-slate-900 font-mono">{stockKg} Kg</strong>
                            </span>
                          </div>

                          <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                            {(language !== 'en' && currentFish.nameTranslations?.[language]) || currentFish.name}
                          </h3>

                          {currentFish.scientificName && (
                            <p className="text-[10px] sm:text-[11px] text-slate-500 italic truncate">
                              {currentFish.scientificName}
                            </p>
                          )}

                          <div className="flex items-center gap-2 pt-0.5 text-[10.5px] sm:text-xs flex-wrap">
                            <span className="text-slate-700 font-bold flex items-center gap-1">
                              <span>Rate:</span>
                              <strong className="text-emerald-800 font-black font-mono text-xs sm:text-sm">
                                ₹{activeRate.toFixed(2)}
                              </strong>
                              <span className="text-[10px] text-slate-500">/Kg</span>
                              {activeGrade && (
                                <span className="text-[9px] text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-extrabold capitalize ml-0.5">
                                  {activeGrade}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cutting Style / Preparation */}
                      <div className="bg-[#FAF0E4] border border-sky-500/30 rounded-lg p-1.5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <span>Cutting Style / Preparation</span>
                          <span className="text-[9px] text-slate-400">Butcher instruction</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {[
                            { name: 'Whole', label: 'Whole' },
                            { name: 'Cleaned', label: 'Cleaned' },
                            { name: 'Curry Cut', label: 'Curry' },
                            { name: 'Fry Cut', label: 'Fry' },
                            { name: 'Boneless Fillet', label: 'Boneless' }
                          ].map(cut => (
                            <button
                              key={cut.name}
                              type="button"
                              onClick={() => handleRetailSlotCutChange(activeRetailSlotIndex, cut.name)}
                              className={`h-7 rounded text-[9.5px] font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                                currentSlot.cutType === cut.name
                                  ? 'bg-[#994d1c] text-white border-[#994d1c] shadow-xs font-black'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-sky-50'
                              }`}
                            >
                              {cut.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fish Size Grade */}
                      {allGrades.length > 0 && (
                        <div className="grid grid-cols-3 gap-1">
                          {allGrades.map(g => {
                            const isSelected = activeGrade === g.key;
                            const gradeRate = getItemPricePerKg(currentFish, 'retail', g.key);
                            return (
                              <button
                                key={g.key}
                                type="button"
                                onClick={() => handleRetailSlotGradeChange(activeRetailSlotIndex, g.key)}
                                className={`py-1.5 px-1 rounded-md text-center border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-black'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                                }`}
                              >
                                <div className="text-[10px] font-bold">{g.label}</div>
                                <div className={`text-[9px] font-mono font-bold ${isSelected ? 'text-white' : 'text-emerald-700'}`}>₹{gradeRate}/Kg</div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Kilograms (Kg) Presets */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <span>1. Select Kilograms (Kg)</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-500">Custom Kg:</span>
                            <input
                              type="number"
                              min="0"
                              value={currentSlot.inputKg === '0' || currentSlot.inputKg === 0 ? '' : (currentSlot.inputKg ?? '')}
                              onFocus={(e) => {
                                e.target.select();
                                handleRetailSlotKgChange(activeRetailSlotIndex, '');
                              }}
                              onBlur={(e) => {
                                if (!e.target.value) handleRetailSlotKgChange(activeRetailSlotIndex, '0');
                              }}
                              onChange={(e) => handleRetailSlotKgChange(activeRetailSlotIndex, e.target.value)}
                              placeholder=""
                              className="w-14 bg-white border border-slate-300 rounded px-1 py-0.2 text-center font-mono font-bold text-xs"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {['0', '1', '2', '3', '4', '5', '10', '15', '20', '25'].map(kgPreset => (
                            <button
                              key={kgPreset}
                              type="button"
                              onClick={() => handleRetailSlotKgChange(activeRetailSlotIndex, kgPreset)}
                              className={`h-7 rounded text-[10px] font-bold border transition-colors cursor-pointer flex items-center justify-center ${
                                currentSlot.inputKg === kgPreset
                                  ? 'bg-amber-700 text-white border-amber-800 font-black shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                              }`}
                            >
                              {kgPreset} Kg
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Sub-grams & Tare */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <span>2. Select Sub-Grams / Fractions</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-slate-500">Tare:</span>
                            {[0, 20, 50, 100].map(tVal => (
                              <button
                                key={tVal}
                                type="button"
                                onClick={() => handleRetailSlotTareChange(activeRetailSlotIndex, tVal)}
                                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${
                                  (currentSlot.tareGrams || 0) === tVal
                                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                                    : 'bg-white text-slate-600 border-slate-300'
                                }`}
                              >
                                {tVal === 0 ? 'Zero' : `-${tVal}g`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { label: '0g (Zero)', val: '0' },
                            { label: '250g (¼ Kg)', val: '250' },
                            { label: '500g (½ Kg)', val: '500' },
                            { label: '750g (¾ Kg)', val: '750' }
                          ].map(gPreset => (
                            <button
                              key={gPreset.val}
                              type="button"
                              onClick={() => handleRetailSlotGramsChange(activeRetailSlotIndex, gPreset.val)}
                              className={`h-7 rounded text-[10px] font-bold border cursor-pointer flex items-center justify-center ${
                                currentSlot.inputGrams === gPreset.val
                                  ? 'bg-amber-700 text-white border-amber-800 font-black'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                              }`}
                            >
                              {gPreset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Scale Input & Slot Price Breakdown */}
                      <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <Scale size={16} className="text-slate-500 shrink-0" />
                          <input
                            type="number"
                            min="0"
                            value={currentSlot.fishWeightGrams === '0' || currentSlot.fishWeightGrams === 0 ? '' : (currentSlot.fishWeightGrams ?? '')}
                            onFocus={(e) => {
                              e.target.select();
                              handleRetailSlotScaleGramsChange(activeRetailSlotIndex, '');
                            }}
                            onBlur={(e) => {
                              if (!e.target.value) handleRetailSlotScaleGramsChange(activeRetailSlotIndex, '1000');
                            }}
                            onChange={(e) => handleRetailSlotScaleGramsChange(activeRetailSlotIndex, e.target.value)}
                            placeholder=""
                            className="w-28 bg-white border border-slate-300 rounded px-2 py-1 font-mono font-black text-sm text-slate-900"
                          />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Scale Grams</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10.5px] text-slate-600 font-bold block">{currentNetKg.toFixed(3)} Kg ({fractionLabel})</span>
                          <span className="text-sm sm:text-base font-black text-emerald-800 font-mono">₹{currentSlotTotal.toFixed(2)}</span>
                        </div>
                      </div>


                    </div>
                  );
                })()
              )}

              {/* 4. RETAIL ORDER SUMMARY & LIST OF ADDED FISHES WITH IMAGES */}
              {(() => {
                const totalKg = retailSlots.reduce((acc, s) => {
                  const scaleGrams = parseFloat(s.fishWeightGrams) || 0;
                  const netGrams = Math.max(0, scaleGrams - (s.tareGrams || 0));
                  return acc + (netGrams / 1000);
                }, 0);
                const totalAmt = retailSlots.reduce((acc, s) => {
                  const scaleGrams = parseFloat(s.fishWeightGrams) || 0;
                  const netGrams = Math.max(0, scaleGrams - (s.tareGrams || 0));
                  const netKg = netGrams / 1000;
                  const activeGrade = s.sizeGrade || s.fish?.defaultSizeGrade || 'small';
                  const activeRate = getItemPricePerKg(s.fish, 'retail', activeGrade);
                  return acc + (netKg * activeRate);
                }, 0);
                const validCount = retailSlots.filter(s => s.fish && (parseFloat(s.fishWeightGrams) || 0) > 0).length;

                return (
                  <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-500/50 rounded-xl sm:rounded-2xl p-2.5 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-amber-950 uppercase tracking-wider block">
                          Retail Order Summary
                        </span>
                        <span className="text-[11px] text-amber-800 font-bold">
                          {validCount} Varieties &bull; Total Weight: <strong className="font-mono text-slate-900">{totalKg.toFixed(3)} Kg</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Billed</span>
                        <span className="text-base sm:text-xl font-black text-emerald-800 font-mono">
                          ₹{totalAmt.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* List of Added Fishes with Images */}
                    {retailSlots.filter(s => s.fish).length > 0 && (
                      <div className="pt-1.5 border-t border-amber-500/30">
                        <span className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                          Added Fish Items:
                        </span>
                        <div className="flex gap-2 overflow-x-auto py-0.5 no-scrollbar">
                          {retailSlots.filter(s => s.fish).map((slot, sIdx) => {
                            const scaleGrams = parseFloat(slot.fishWeightGrams) || 0;
                            const netGrams = Math.max(0, scaleGrams - (slot.tareGrams || 0));
                            const netKg = netGrams / 1000;
                            const activeGrade = slot.sizeGrade || slot.fish?.defaultSizeGrade || 'small';
                            const activeRate = getItemPricePerKg(slot.fish, 'retail', activeGrade);
                            const itemAmt = netKg * activeRate;
                            return (
                              <div
                                key={slot.id || sIdx}
                                onClick={() => { setActiveRetailSlotIndex(sIdx); setShowAddFishPicker(false); }}
                                className={`flex items-center gap-2 border rounded-xl p-1.5 shrink-0 shadow-2xs cursor-pointer transition-all ${
                                  activeRetailSlotIndex === sIdx
                                    ? 'bg-amber-100/90 border-amber-500 ring-1 ring-amber-400'
                                    : 'bg-white/95 border-amber-300 hover:bg-amber-50'
                                }`}
                              >
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                                  {slot.fish?.image ? (
                                    <img src={formatImageUrl(slot.fish.image)} alt={slot.fish.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm">🐟</span>
                                  )}
                                </div>
                                <div className="text-[10.5px] leading-tight min-w-[70px]">
                                  <div className="font-black text-slate-800 truncate max-w-[110px]">{slot.fish.name}</div>
                                  <div className="text-amber-900 font-bold font-mono text-[9.5px]">
                                    {netKg.toFixed(2)} Kg &bull; {slot.cutType} &bull; ₹{itemAmt.toFixed(0)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons: Cancel, SAVE (KHATA), SAVE & PRINT */}
              <div className="space-y-1.5 pt-1">
                <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFishItem(null)}
                    className="col-span-3 py-2 px-1 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() => handleRetailSave(false)}
                    className="col-span-4 py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] sm:text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {actionLoading === 'save' ? (
                      <Loader2 size={13} className="animate-spin text-white" />
                    ) : (
                      <Save size={13} />
                    )}
                    <span>SAVE (KHATA)</span>
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() => handleRetailSave(true)}
                    className="col-span-5 py-2 sm:py-2.5 px-1.5 sm:px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-black text-[11px] sm:text-xs shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {actionLoading === 'print' ? (
                      <Loader2 size={13} className="animate-spin text-white" />
                    ) : (
                      <Printer size={13} />
                    )}
                    <span>SAVE & PRINT</span>
                  </button>
                </div>

                {/* Secondary Button: Add to Fish Order (Keep Shopping) */}
                <button
                  type="button"
                  onClick={() => {
                    const validSlots = retailSlots.filter(s => s.fish && (parseFloat(s.fishWeightGrams) || 0) > 0);
                    if (validSlots.length === 0) {
                      if (showToast) showToast('Please enter weight before adding', 'warning');
                      return;
                    }
                    validSlots.forEach(slot => {
                      const scaleGrams = parseFloat(slot.fishWeightGrams) || 1000;
                      const netGrams = Math.max(0, scaleGrams - (slot.tareGrams || 0));
                      const netKg = netGrams / 1000;
                      const activeGrade = slot.sizeGrade || slot.fish?.defaultSizeGrade || 'small';
                      const activeRate = getItemPricePerKg(slot.fish, 'retail', activeGrade);
                      const calculatedPrice = parseFloat((netKg * activeRate).toFixed(2));
                      const fractionLabel = formatKgFraction(netKg);

                      const itemToAdd = {
                        ...slot.fish,
                        itemKey: `${slot.fish._id}_${slot.cutType}_${netGrams}g_${activeGrade}_retail`,
                        menuItem: slot.fish._id,
                        originalId: slot.fish._id,
                        originalFishName: slot.fish.name,
                        name: `${slot.fish.name} (${slot.cutType} - ${fractionLabel})`,
                        price: calculatedPrice,
                        quantity: 1,
                        sellingUnit: 'Kg',
                        enteredWeight: netKg,
                        netWeightKg: netKg,
                        grossWeightKg: netKg,
                        pricePerKg: activeRate,
                        sizeGrade: activeGrade,
                        orderMode: 'retail',
                        cutType: slot.cutType,
                        yieldFactor: 1.0,
                        tareWeightKg: ((slot.tareGrams || 0) / 1000),
                        customCuttingChargeEnabled: slot.fish?.customCuttingChargeEnabled ?? false,
                        cuttingCharge: slot.fish?.cuttingCharge ?? 0,
                        sizeGrades: slot.fish?.sizeGrades
                      };

                      onSelectItem(itemToAdd);
                    });
                    setSelectedFishItem(null);
                  }}
                  className="w-full bg-[#FAF0E4] hover:bg-[#F5E8D8] text-amber-900 border border-[#E8DCCB] font-bold py-1.5 rounded-lg cursor-pointer transition-all active:scale-[0.98] text-[11px] sm:text-xs flex items-center justify-center gap-1"
                >
                  <span>+ Add to Order (Keep Shopping)</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Wholesale Multi-Item Box Builder Modal */}
      {showBoxPacker && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-1.5 sm:p-3 md:p-4 animate-in fade-in duration-200 overflow-hidden"
          onClick={() => setShowBoxPacker(false)}
        >
          <div
            data-box-packer-modal="true"
            className="bg-[#FDFBF7] w-full max-w-[580px] h-[92dvh] max-h-[92dvh] sm:h-auto sm:max-h-[88vh] rounded-2xl md:rounded-3xl shadow-2xl border-2 border-[#E8DCCB] flex flex-col overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-2.5 sm:px-4 md:px-5 py-1.5 sm:py-2 border-b border-[#E8DCCB] bg-gradient-to-r from-[#FAF0E4] via-[#FFF8EE] to-[#FAF0E4] shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-[9px] sm:text-xs uppercase tracking-wider shadow-sm border border-amber-400 shrink-0">
                  Box
                </div>
                <div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.2 rounded-full border border-amber-300">
                      {fishOrderMode === 'export' ? 'EXPORT BOX PACKER' : 'WHOLESALE BOX PACKER'}
                    </span>
                    <span className="text-[11px] sm:text-xs font-black text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded-md">
                      Box #{currentBoxNumber}
                    </span>
                  </div>
                  <h2 className="text-xs sm:text-base font-black text-slate-900 mt-0.5">
                    Packing {fishOrderMode === 'export' ? 'Export' : 'Wholesale'} Box #{currentBoxNumber}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBoxPacker(false)}
                className="text-slate-500 hover:text-slate-800 bg-white hover:bg-[#F5E8D8] border border-[#E8DCCB] rounded-full p-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-2 sm:p-2.5 md:p-3 space-y-2 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {/* 1. COMPACT UNCROPPED FISH IMAGE & DETAILS */}
              {activeBoxFish && (
                <div className="bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center gap-2.5 sm:gap-3.5 relative overflow-hidden transition-all duration-300">
                  <div className="w-16 h-14 sm:w-28 sm:h-20 md:w-36 md:h-24 bg-white rounded-lg sm:rounded-xl border border-[#E8DCCB] overflow-hidden flex items-center justify-center p-1 shadow-inner shrink-0 group">
                    {activeBoxFish.image ? (
                      <img
                        src={formatImageUrl(activeBoxFish.image)}
                        alt={activeBoxFish.name}
                        className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Fish size={24} className="text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8.5px] sm:text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500 text-white shadow-2xs">
                        {fishOrderMode === 'export' ? 'Export Variety' : 'Wholesale Variety'}
                      </span>
                      {activeBoxFish.waterType && (
                        <span className="text-[8.5px] sm:text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-800 text-white">
                          {activeBoxFish.waterType === 'fresh_water' ? 'Fresh Water' : 'Sea Water'}
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm md:text-base font-black text-slate-900 leading-tight truncate">
                      {activeBoxFish.name}
                    </h3>

                    {activeBoxFish.scientificName && (
                      <p className="text-[10px] text-slate-500 italic truncate hidden sm:block">
                        {activeBoxFish.scientificName}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-0.5 text-[10px] sm:text-xs flex-wrap">
                      <span className="text-slate-600 font-bold flex items-center gap-1">
                        <span>Rate:</span>
                        <strong className="text-emerald-700 font-black font-mono">
                          ₹{boxSlots[0]?.pricePerKg || (fishOrderMode === 'export' ? (activeBoxFish.exportPricePerKg || activeBoxFish.wholesalePricePerKg || activeBoxFish.price || 0) : (activeBoxFish.wholesalePricePerKg || activeBoxFish.price || 0))}/Kg
                        </strong>
                        {boxSlots[0]?.sizeGrade && (
                          <span className="text-[9px] text-amber-900 bg-amber-200/80 px-1 py-0.2 rounded font-extrabold capitalize border border-amber-300">
                            {boxSlots[0].sizeGrade}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-slate-600 font-bold">
                        Stock: <strong className="text-slate-900 font-mono">{activeBoxFish.stock ?? activeBoxFish.inventoryStock ?? 0} Kg</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. PREDEFINED CUSTOMER / DEALER SELECTOR */}
              <div className="bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <User size={13} className="text-amber-700" />
                    <span>{fishOrderMode === 'export' ? 'Predefined Export Client:' : 'Predefined Wholesale Dealer:'}</span>
                  </span>
                </div>

                {selectedCustomerObj ? (
                  <div className="bg-white border-2 border-amber-400/80 rounded-xl p-2 sm:p-2.5 shadow-sm space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                        {selectedCustomerObj.photo ? (
                          <img
                            src={selectedCustomerObj.photo}
                            alt={selectedCustomerObj.name}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-amber-500 shadow-xs ring-2 ring-amber-300 ring-offset-1 shrink-0 transition-transform duration-200 hover:scale-105"
                          />
                        ) : (
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs ring-2 ring-amber-300 ring-offset-1 shrink-0">
                            {(selectedCustomerObj.name || 'D').charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {selectedCustomerObj.name || 'Guest Dealer'}
                            </span>
                            <span className="text-[9px] font-extrabold bg-amber-500/20 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                              {fishOrderMode === 'export' ? (selectedCustomerObj.exportSubCategory === 'DAM' ? 'DAM Export' : 'Local Export') : 'Wholesale'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 font-mono font-bold mt-0.5">
                            <Phone size={11} className="text-slate-400 shrink-0" />
                            <span>{selectedCustomerObj.phone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={handleClearCustomer}
                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-0.5"
                          title="Clear customer"
                        >
                          <X size={11} />
                          <span>Clear</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer active:scale-95"
                        >
                          {isCustomerDropdownOpen ? 'Close' : 'Change'}
                        </button>
                      </div>
                    </div>

                    {/* Conditional Shop Name: ONLY shown if businessName exists and is not empty */}
                    {Boolean(selectedCustomerObj.businessName && String(selectedCustomerObj.businessName).trim()) && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-bold bg-[#FAF0E4] px-2 py-1 rounded-lg border border-[#E8DCCB]">
                        <Building size={13} className="text-amber-700 shrink-0" />
                        <span className="text-slate-500 font-medium">Shop Name:</span>
                        <span className="text-slate-900 font-black">{String(selectedCustomerObj.businessName).trim()}</span>
                      </div>
                    )}

                    {/* Detailed Locked Timestamp */}
                    {isOrderLocked && lockedTimestamp && (
                      <div className="flex items-center gap-1.5 text-[10.5px] text-emerald-800 font-bold pt-1 border-t border-amber-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span>Locked At:</span>
                        <span className="font-mono text-emerald-900 font-black">{lockedTimestamp}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => setIsCustomerDropdownOpen(true)}
                    className="bg-white border-2 border-dashed border-amber-400 hover:border-amber-500 rounded-xl p-3 text-center cursor-pointer active:scale-98 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-xs">
                      <User size={16} className="text-amber-600 group-hover:scale-110 transition-transform" />
                      <span>Tap here to select {fishOrderMode === 'export' ? 'Export Client' : 'Wholesale Dealer'}</span>
                      <ChevronDown size={14} className="text-amber-600" />
                    </div>
                  </div>
                )}

                {/* Predefined Dealer Dropdown Search Menu */}
                {isCustomerDropdownOpen && (
                  <div className="bg-white border border-[#E8DCCB] rounded-xl shadow-xl p-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by name, phone or shop..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#FAF0E4] border border-[#E8DCCB] rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-[#E8DCCB]/40">
                      {filteredPredefinedCustomers.length > 0 ? (
                        filteredPredefinedCustomers.map((c) => (
                          <div
                            key={c._id || c.phone}
                            onClick={() => handleSelectCustomer(c)}
                            className="pt-1.5 first:pt-0 p-1.5 hover:bg-amber-50 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 active:scale-98"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {c.photo ? (
                                <img src={c.photo} alt={c.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                                  {(c.name || 'D').charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-slate-900 block truncate">{c.name}</span>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span className="font-mono">{c.phone}</span>
                                  {c.businessName && <span className="truncate">&bull; {c.businessName}</span>}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-black text-amber-600 shrink-0">Select &rarr;</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-2 text-xs text-slate-400">
                          No matching {fishOrderMode === 'export' ? 'export clients' : 'wholesale dealers'} found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. FISH ITEMS SLOTS WITH TOP TABS & PHOTO PICKER */}
              <div className="space-y-2.5">
                {/* Visual Fish Tabs in this Box */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10.5px] sm:text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Scale size={13} className="text-amber-700" />
                      <span>Fishes in Box #{currentBoxNumber} ({boxSlots.length}):</span>
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-amber-900 bg-amber-100 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                      Tap photo to change
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {boxSlots.map((slot, sIdx) => {
                      const netSlotKg = (parseFloat(slot.weightKg) || 0) + ((parseFloat(slot.weightGrams) || 0) / 1000);
                      return (
                        <div
                          key={slot.id || sIdx}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#E8DCCB] bg-white font-bold text-xs shadow-2xs shrink-0"
                        >
                          <div
                            onClick={() => {
                              setSlotIndexToChange(sIdx);
                              setShowWholesaleFishPicker(true);
                            }}
                            className="w-5 h-5 rounded-md overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-500"
                            title="Tap to change fish photo"
                          >
                            {slot.fish?.image ? (
                              <img src={formatImageUrl(slot.fish.image)} alt={slot.fish.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-[11px]">🐟</span>
                            )}
                          </div>
                          <span className="truncate max-w-[85px] sm:max-w-[110px]">{slot.fish?.name || `Fish #${sIdx + 1}`}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {netSlotKg.toFixed(1)}kg
                          </span>
                          {boxSlots.length > 1 && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSlot(sIdx);
                              }}
                              className="ml-0.5 rounded px-1 py-0.2 text-[10px] font-black cursor-pointer text-red-500 hover:bg-red-50"
                              title="Remove fish from box"
                            >
                              ✕
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {boxSlots.length < 10 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSlotIndexToChange(null);
                          setShowWholesaleFishPicker(true);
                        }}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs border ${
                          showWholesaleFishPicker && slotIndexToChange === null
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-[#FAF0E4] hover:bg-[#F5E8D8] text-amber-900 border-amber-300'
                        }`}
                      >
                        <Plus size={14} strokeWidth={3} />
                        <span>Add Another Fish</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* CONDITIONAL: VISUAL PHOTO-GRID FISH PICKER FOR WHOLESALE / EXPORT */}
                {showWholesaleFishPicker && (
                  <div className="bg-white border-2 border-amber-400 rounded-2xl p-2.5 sm:p-3 shadow-md space-y-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                        <span>🐟 Tap Any Fish Photo to {slotIndexToChange !== null ? `Change Fish #${slotIndexToChange + 1}` : `Add to Box #${currentBoxNumber}`}:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setShowWholesaleFishPicker(false);
                          setSlotIndexToChange(null);
                        }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Close ✕
                      </button>
                    </div>

                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search fish (English / తెలుగు)..."
                        value={wholesaleFishSearch}
                        onChange={(e) => setWholesaleFishSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto pr-0.5">
                      {items
                        .filter(it => it.isAvailable !== false)
                        .filter(it => {
                          if (!wholesaleFishSearch) return true;
                          const s = wholesaleFishSearch.toLowerCase();
                          return (it.name && it.name.toLowerCase().includes(s)) ||
                            (it.nameTranslations && Object.values(it.nameTranslations).some(v => String(v).toLowerCase().includes(s))) ||
                            (it.scientificName && it.scientificName.toLowerCase().includes(s));
                        })
                        .map(f => {
                          const fRate = getItemPricePerKg(f, fishOrderMode);
                          const fStock = Number(f.stock ?? f.inventoryStock ?? f.currentStock ?? 0);
                          const fIsSea = getItemWaterType(f) === 'sea_water';
                          const teluguName = f.nameTranslations?.te || f.nameTranslations?.telugu || '';
                          return (
                            <div
                              key={f._id}
                              onClick={() => {
                                if (slotIndexToChange !== null) {
                                  handleSlotFishChange(slotIndexToChange, f._id);
                                  setSlotIndexToChange(null);
                                  setShowWholesaleFishPicker(false);
                                } else {
                                  handlePickWholesaleFishToAdd(f);
                                }
                              }}
                              className="bg-[#FAF0E4]/60 hover:bg-amber-100/90 border-2 border-[#E8DCCB] hover:border-amber-500 rounded-xl p-2 cursor-pointer transition-all active:scale-95 shadow-2xs flex flex-col items-center text-center group"
                            >
                              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-lg overflow-hidden bg-white border border-[#E8DCCB] mb-1.5 flex items-center justify-center shrink-0 shadow-xs">
                                {f.image ? (
                                  <img src={formatImageUrl(f.image)} alt={f.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                  <span className="text-2xl">🐟</span>
                                )}
                              </div>
                              <div className="w-full">
                                <span className="text-xs font-black text-slate-900 truncate block leading-snug">
                                  {f.name}
                                </span>
                                {teluguName && (
                                  <span className="text-[11px] font-bold text-amber-900 truncate block leading-snug">
                                    ({teluguName})
                                  </span>
                                )}
                                <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                    fIsSea ? 'bg-sky-50 text-sky-800 border-sky-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  }`}>
                                    {fIsSea ? '🌊 Sea' : '🌿 Fresh'}
                                  </span>
                                  <span className="text-[9px] font-mono text-slate-500">
                                    {fStock}kg
                                  </span>
                                </div>
                                <div className="mt-1 font-mono font-black text-amber-900 text-xs bg-white/80 py-0.5 px-1 rounded border border-amber-200">
                                  ₹{fRate}/Kg
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[34vh] overflow-y-auto pr-0.5">
                  {boxSlots.map((slot, index) => {
                    const netSlotKg = (parseFloat(slot.weightKg) || 0) + ((parseFloat(slot.weightGrams) || 0) / 1000);
                    const itemTotal = netSlotKg * (parseFloat(slot.pricePerKg) || 0);

                    return (
                      <div
                        key={slot.id || index}
                        className="bg-white border border-[#E8DCCB] hover:border-amber-400/80 rounded-xl sm:rounded-2xl p-2.5 shadow-2xs transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black text-amber-800 bg-[#FAF0E4] border border-[#E8DCCB] px-2 py-0.5 rounded-lg">
                            Fish #{index + 1}
                          </span>
                          {boxSlots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlot(index)}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-lg transition-colors cursor-pointer"
                              title="Remove this fish"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center">
                          {/* Fish selector with visual thumbnail */}
                          <div className="col-span-12 sm:col-span-5">
                            <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-0.5">
                              Select Fish Variety
                            </label>
                            <div className="flex items-center gap-1.5">
                              <div
                                onClick={() => {
                                  setSlotIndexToChange(index);
                                  setShowWholesaleFishPicker(true);
                                }}
                                className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-[#E8DCCB] shrink-0 flex items-center justify-center shadow-xs cursor-pointer hover:border-amber-500 hover:ring-2 hover:ring-amber-300 transition-all"
                                title="Tap to change fish photo"
                              >
                                {slot.fish?.image ? (
                                  <img src={formatImageUrl(slot.fish.image)} alt={slot.fish?.name || 'Fish'} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-base">🐟</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <SearchableDropdown
                                  mode="select"
                                  value={slot.fishId || ''}
                                  onChange={(val) => handleSlotFishChange(index, val)}
                                  options={fishBoxOptions}
                                  placeholder="-- Choose Fish Variety --"
                                  searchPlaceholder="Search fish species..."
                                  className="w-full"
                                  inputClassName="!h-9 !py-0 !rounded-lg sm:!rounded-xl !text-[11px] sm:!text-xs flex items-center font-bold !bg-[#FAF0E4] !border-[#E8DCCB]"
                                  minDropdownWidth={290}
                                  accentColor="orange"
                                  clearable={false}
                                  required
                                />
                              </div>
                            </div>
                          </div>

                          {/* Kilograms (Kg) Input */}
                          <div className="col-span-4 sm:col-span-2">
                            <label className="text-[9.5px] font-black text-slate-700 uppercase block mb-0.5">
                              Kg
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={slot.weightKg === '0' || slot.weightKg === 0 ? '' : (slot.weightKg ?? '')}
                                onFocus={(e) => {
                                  e.target.select();
                                  handleSlotWeightKgChange(index, '');
                                }}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  if (val && String(val).includes('.')) {
                                    const parts = String(val).split('.');
                                    const wholeKg = parts[0] || '1';
                                    const fracStr = (parts[1] || '').slice(0, 3);
                                    const fracGrams = fracStr ? Math.round(parseFloat(`0.${fracStr}`) * 1000) : 0;
                                    handleSlotWeightKgChange(index, wholeKg);
                                    if (fracGrams > 0) {
                                      handleSlotWeightGramsChange(index, String(fracGrams));
                                    }
                                  } else if (!val || isNaN(parseFloat(val)) || parseFloat(val) <= 0) {
                                    handleSlotWeightKgChange(index, '1');
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    e.target.blur();
                                  }
                                }}
                                onChange={(e) => handleSlotWeightKgChange(index, e.target.value)}
                                placeholder=""
                                className="w-full bg-white border border-[#E8DCCB] rounded-lg sm:rounded-xl pl-1 pr-5 py-1 text-[11px] sm:text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono text-center active:scale-98 transition-all"
                              />
                              <span className="absolute right-1 top-1 text-[9px] text-slate-400 font-bold pointer-events-none">
                                Kg
                              </span>
                            </div>
                          </div>

                          {/* Grams (g) Input */}
                          <div className="col-span-4 sm:col-span-2">
                            <label className="text-[9.5px] font-black text-slate-700 uppercase block mb-0.5">
                              Grams (g)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="999"
                                step="50"
                                value={slot.weightGrams === '0' || slot.weightGrams === 0 ? '' : (slot.weightGrams ?? '')}
                                onFocus={(e) => {
                                  e.target.select();
                                  handleSlotWeightGramsChange(index, '');
                                }}
                                onBlur={(e) => {
                                  if (!e.target.value || isNaN(parseFloat(e.target.value))) {
                                    handleSlotWeightGramsChange(index, '');
                                  }
                                }}
                                onChange={(e) => handleSlotWeightGramsChange(index, e.target.value)}
                                placeholder=""
                                className="w-full bg-white border border-[#E8DCCB] rounded-lg sm:rounded-xl pl-1 pr-4 py-1 text-[11px] sm:text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono text-center active:scale-98 transition-all"
                              />
                              <span className="absolute right-1 top-1 text-[9px] text-slate-400 font-bold pointer-events-none">
                                g
                              </span>
                            </div>
                          </div>

                          {/* Rate / Price per Kg */}
                          <div className="col-span-4 sm:col-span-3 text-right">
                            <label className="text-[9.5px] font-bold text-slate-500 uppercase block mb-0.5">
                              Rate (₹/Kg)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={slot.pricePerKg === '0' || slot.pricePerKg === 0 ? '' : (slot.pricePerKg ?? '')}
                                onFocus={(e) => {
                                  e.target.select();
                                  handleSlotPriceChange(index, '');
                                }}
                                onBlur={(e) => {
                                  if (!e.target.value || isNaN(parseFloat(e.target.value))) {
                                    handleSlotPriceChange(index, '0');
                                  }
                                }}
                                onChange={(e) => handleSlotPriceChange(index, e.target.value)}
                                placeholder=""
                                className="w-full bg-white border border-[#E8DCCB] rounded-lg sm:rounded-xl px-1 sm:px-2 py-1 text-[11px] sm:text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono text-center active:scale-98 transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Auto-Fetched Fish Size Grades (Small, Medium, Big) for Wholesale / Export */}
                        {(() => {
                          const grades = getItemSizeGrades(slot.fish, fishOrderMode);
                          if (!grades || grades.length === 0) return null;
                          const currentGrade = slot.sizeGrade || (grades.some(g => g.key === 'medium') ? 'medium' : grades[0]?.key);

                          return (
                            <div className="bg-[#FAF0E4]/80 p-1.5 rounded-lg sm:rounded-xl border border-[#E8DCCB] space-y-1">
                              <div className="flex items-center justify-between text-[9px] sm:text-[9.5px]">
                                <span className="font-bold text-slate-700 flex items-center gap-1">
                                  <span>Fish Size Grade:</span>
                                </span>
                                <span className="text-[8.5px] text-amber-800 font-semibold">
                                  Auto-sets Avg Weight & {fishOrderMode === 'export' ? 'Export' : 'Wholesale'} Rate
                                </span>
                              </div>
                              <div className={`grid gap-1 sm:gap-1.5 ${
                                grades.length === 1 ? 'grid-cols-1' : grades.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                              }`}>
                                {grades.map(g => {
                                  const isSelected = currentGrade === g.key;
                                  return (
                                    <button
                                      key={g.key}
                                      type="button"
                                      onClick={() => handleSlotGradeChange(index, g.key)}
                                      className={`py-1 px-1.5 rounded-lg text-center transition-all cursor-pointer border ${
                                        isSelected
                                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs font-black'
                                          : 'bg-white text-slate-700 border-[#E8DCCB] hover:bg-amber-50'
                                      }`}
                                    >
                                      <div className="flex items-center justify-center gap-1 leading-tight">
                                        <span className="text-[10px] sm:text-[11px] font-bold">{g.label}</span>
                                        <span className={`text-[8px] sm:text-[8.5px] ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                                          ({g.range})
                                        </span>
                                      </div>
                                      <div className={`text-[9px] sm:text-[9.5px] font-mono font-bold leading-tight ${isSelected ? 'text-white' : 'text-emerald-700'}`}>
                                        ₹{g.price}/Kg
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Quick Grams Increments + Slot Total */}
                        <div className="flex items-center justify-between text-[10px] font-bold pt-1 border-t border-[#E8DCCB]/60">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-slate-400 text-[9px]">Quick:</span>
                            {[100, 250, 400, 500, 750].map(g => (
                              <button
                                key={g}
                                type="button"
                                onClick={() => handleSlotWeightGramsChange(index, String(g))}
                                className="px-1.5 py-0.5 rounded bg-[#FAF0E4] hover:bg-amber-100 border border-[#E8DCCB] text-amber-900 font-mono active:scale-95 transition-all cursor-pointer"
                              >
                                +{g}g
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleSlotWeightGramsChange(index, '0')}
                              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono active:scale-95 transition-all cursor-pointer"
                            >
                              0g
                            </button>
                          </div>
                          <div className="text-right font-mono font-black text-amber-950 text-xs">
                            {Number(netSlotKg.toFixed(3))} Kg = ₹{itemTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {boxSlots.length < 10 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlotIndexToChange(null);
                      setShowWholesaleFishPicker(true);
                    }}
                    className="w-full py-2 bg-white hover:bg-[#FAF0E4] border border-dashed border-[#E8DCCB] hover:border-amber-400 text-amber-800 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                  >
                    <span>+</span>
                    <span>Add Another Fish to Box #{currentBoxNumber}</span>
                  </button>
                )}
              </div>

              {/* 4. TOTAL BOX SUMMARY CARD & ORDER PREVIEW */}
              {(() => {
                const totalKg = boxSlots.reduce((acc, s) => {
                  const wt = (parseFloat(s.weightKg) || 0) + ((parseFloat(s.weightGrams) || 0) / 1000);
                  return acc + wt;
                }, 0);
                const totalAmt = boxSlots.reduce((acc, s) => {
                  const wt = (parseFloat(s.weightKg) || 0) + ((parseFloat(s.weightGrams) || 0) / 1000);
                  return acc + (wt * (parseFloat(s.pricePerKg) || 0));
                }, 0);
                const validCount = boxSlots.filter(s => {
                  const wt = (parseFloat(s.weightKg) || 0) + ((parseFloat(s.weightGrams) || 0) / 1000);
                  return s.fish && wt > 0;
                }).length;

                return (
                  <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-500/50 rounded-xl sm:rounded-2xl p-2.5 shadow-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-amber-950 uppercase tracking-wider block">
                          Box #{currentBoxNumber} Summary
                        </span>
                        <span className="text-[11px] text-amber-800 font-bold">
                          {validCount} Varieties &bull; Total Weight: <strong className="font-mono text-slate-900">{totalKg.toFixed(3)} Kg</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Box Total Price</span>
                        <span className="text-base sm:text-xl font-black text-amber-900 font-mono">
                          ₹{totalAmt.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* List of Added Fish Varieties with Images in Box */}
                    {boxSlots.filter(s => s.fish).length > 0 && (
                      <div className="pt-1.5 border-t border-amber-500/30">
                        <span className="text-[10px] font-black uppercase text-amber-900 block mb-1">
                          Added Fish Varieties:
                        </span>
                        <div className="flex gap-2 overflow-x-auto py-0.5 no-scrollbar">
                          {boxSlots.filter(s => s.fish).map((slot, sIdx) => {
                            const netSlotKg = (parseFloat(slot.weightKg) || 0) + ((parseFloat(slot.weightGrams) || 0) / 1000);
                            const slotAmt = netSlotKg * (parseFloat(slot.pricePerKg) || 0);
                            return (
                              <div
                                key={slot.id || sIdx}
                                className="flex items-center gap-2 bg-white/95 border border-amber-300 rounded-xl p-1.5 shrink-0 shadow-2xs"
                              >
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                                  {slot.fish?.image ? (
                                    <img src={formatImageUrl(slot.fish.image)} alt={slot.fish.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-sm">🐟</span>
                                  )}
                                </div>
                                <div className="text-[10.5px] leading-tight min-w-[70px]">
                                  <div className="font-black text-slate-800 truncate max-w-[110px]">{slot.fish.name}</div>
                                  <div className="text-amber-900 font-bold font-mono text-[9.5px]">
                                    {netSlotKg.toFixed(2)} Kg &bull; ₹{slotAmt.toFixed(0)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {cart && cart.length > 0 && (
                      <div className="pt-1 border-t border-amber-500/30 flex items-center justify-between text-[11px] text-slate-700 font-bold">
                        <span>Existing Boxes in Order ({cart.length} items):</span>
                        <span className="font-mono font-black text-emerald-800">
                          Order Total: ₹{(cartTotal + totalAmt).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer with Instant Action Buttons - Single Compact Row */}
            <div className="p-2 sm:p-2.5 border-t border-[#E8DCCB] bg-[#FAF0E4] shrink-0 sticky bottom-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowBoxPacker(false)}
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => handleModalSave(false)}
                  className="flex-1 py-2 sm:py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer"
                >
                  {actionLoading === 'save' ? (
                    <Loader2 size={13} className="animate-spin text-white" />
                  ) : (
                    <Save size={13} />
                  )}
                  <span>SAVE (KHATA)</span>
                </button>

                <button
                  type="button"
                  disabled={actionLoading !== null}
                  onClick={() => handleModalSave(true)}
                  className="flex-1 py-2 sm:py-2.5 px-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer"
                >
                  {actionLoading === 'print' ? (
                    <Loader2 size={13} className="animate-spin text-white" />
                  ) : (
                    <Printer size={13} />
                  )}
                  <span>SAVE & PRINT</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Description Popup - rendered at root level */}
      {activeDescCard && (() => {
        const descItem = items.find(i => i._id === activeDescCard);
        if (!descItem || !descItem.description) return null;

        return createPortal(
          <div className="relative z-[9999]">
            <div
              className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-sm"
              onClick={(e) => { e.stopPropagation(); setActiveDescCard(null); }}
            />
            <div
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] bg-white border border-border shadow-2xl rounded-2xl p-5 w-[90vw] max-w-[350px] whitespace-normal"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <div className="flex justify-between items-center mb-3 border-b border-border pb-3">
                <div className="pr-2">
                  <p className="font-bold text-base text-text-main">{(language !== 'en' && descItem.nameTranslations?.[language]) || descItem.name}</p>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{t("Description")}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveDescCard(null); }}
                  className="text-gray-400 hover:text-text-muted bg-gray-100 hover:bg-gray-200 rounded-lg p-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
              <p className="text-sm text-text-muted leading-relaxed overflow-y-auto max-h-[60vh] custom-scrollbar pr-1">{descItem.description}</p>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Dynamic Flying Fish Particles into Cart */}
      {flyingItems.map((fItem) =>
        createPortal(
          <div
            key={fItem.id}
            className="flying-cart-fish"
            style={{
              '--start-x': `${fItem.startX}px`,
              '--start-y': `${fItem.startY}px`,
              '--target-x': `${fItem.targetX}px`,
              '--target-y': `${fItem.targetY}px`,
            }}
          >
            <div className="relative w-28 h-20 sm:w-32 sm:h-24 flex items-center justify-center pointer-events-none filter drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)]">
              {fItem.image ? (
                <img
                  src={fItem.image}
                  alt={fItem.name}
                  className="w-full h-full object-contain pointer-events-none"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <span className={`text-5xl ${fItem.image ? 'hidden' : 'flex'} filter drop-shadow-lg`}>🐟</span>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  );
};

export default MenuGrid;