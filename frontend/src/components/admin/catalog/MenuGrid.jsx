import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, ChevronLeft, ChevronRight, Star, X, ChevronDown, Image as ImageIcon,
  Fish, Waves, Anchor, Droplets, Box, Package, Flame, Gift, Menu as MenuIcon,
  Plus, Minus, Loader2, RefreshCw, Sparkles, Scale, UtensilsCrossed
} from 'lucide-react';
import api from '../../../api/system/axios';
import { getMenuItems, updateMenuItem } from '../../../api/catalog/menu';
import { getCategories } from '../../../api/catalog/category';
import { getCachedMenuItems, getCachedCategories } from '../../../db/offlineDb';
import realtimeService from '../../../services/realtimeService';

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

const formatImageUrl = (url) => {
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
  onAddBox
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
  const [selectedCutType, setSelectedCutType] = useState('Whole');
  const [tareGrams, setTareGrams] = useState(0);
  const [boxCountInput, setBoxCountInput] = useState('1');

  // Wholesale Multi-Item Box Builder State
  const [showBoxPacker, setShowBoxPacker] = useState(false);
  const [boxSlotCount, setBoxSlotCount] = useState(3);
  const [boxSlots, setBoxSlots] = useState([]);

  // Calculate current box number (Box #1, Box #2, etc.) based on existing boxes in cart
  const currentBoxNumber = useMemo(() => {
    const maxNum = (cart || []).reduce((max, it) => Math.max(max, Number(it.boxNumber || 0)), 0);
    return maxNum + 1;
  }, [cart]);

  // Open the Wholesale Box Builder
  const openBoxPackerModal = useCallback((initialFish = null) => {
    const defaultCount = 3;
    setBoxSlotCount(defaultCount);
    const availableFishes = items.filter(it => it.isAvailable !== false);
    const initialSlots = [];
    for (let i = 0; i < defaultCount; i++) {
      let chosenFish = null;
      if (i === 0 && initialFish) {
        chosenFish = initialFish;
      } else {
        chosenFish = availableFishes[i] || items[i % (items.length || 1)] || null;
      }
      initialSlots.push({
        id: `slot_${i}_${Date.now()}_${Math.random()}`,
        fishId: chosenFish?._id || '',
        fish: chosenFish,
        weightKg: '10',
        pricePerKg: chosenFish?.price ? String(chosenFish.price) : '200'
      });
    }
    setBoxSlots(initialSlots);
    setShowBoxPacker(true);
  }, [items]);

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
          updated.push({
            id: `slot_${i}_${Date.now()}_${Math.random()}`,
            fishId: chosen?._id || '',
            fish: chosen,
            weightKg: '10',
            pricePerKg: chosen?.price ? String(chosen.price) : '200'
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
    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      return {
        ...slot,
        fishId: selectedFishId,
        fish: chosen || null,
        pricePerKg: chosen?.price ? String(chosen.price) : slot.pricePerKg
      };
    }));
  };

  const handleSlotWeightChange = (index, weightVal) => {
    setBoxSlots(prev => prev.map((slot, idx) => {
      if (idx !== index) return slot;
      return { ...slot, weightKg: weightVal };
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
    setBoxSlots(prev => [
      ...prev,
      {
        id: `slot_${nextIdx}_${Date.now()}_${Math.random()}`,
        fishId: chosen?._id || '',
        fish: chosen,
        weightKg: '10',
        pricePerKg: chosen?.price ? String(chosen.price) : '200'
      }
    ]);
    setBoxSlotCount(prev => prev + 1);
  };

  const handleAddBoxToOrder = () => {
    const validSlots = boxSlots.filter(s => s.fish && (parseFloat(s.weightKg) || 0) > 0);
    if (validSlots.length === 0) {
      if (showToast) showToast('Please select at least one fish with valid weight', 'error');
      return;
    }
    const boxItems = validSlots.map((slot, idx) => {
      const wt = parseFloat(slot.weightKg) || 0;
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
        sellingUnit: 'Kg',
        quantity: 1,
        weightKg: wt,
        enteredWeight: wt,
        grossWeightKg: wt,
        netWeightKg: wt,
        pricePerKg: rate,
        price: totalAmount,
        total: totalAmount,
        itemKey: `${slot.fish._id}_box${currentBoxNumber}_slot${idx}_${Date.now()}`
      };
    });

    if (onAddBox) {
      onAddBox(boxItems);
    } else {
      boxItems.forEach(it => onSelectItem(it));
    }
    setShowBoxPacker(false);
  };
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
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

    // 1. Mobile Detection: Target the visible [ 🛒 Current Order ] tab at top of screen
    const mobileCartTab = document.getElementById('mobile-cart-tab') || document.querySelector('[data-mobile-cart-tab="true"]');
    const isMobileMode = window.innerWidth < 1024 || (mobileCartTab && mobileCartTab.offsetParent !== null);

    if (isMobileMode && mobileCartTab) {
      const mRect = mobileCartTab.getBoundingClientRect();
      targetX = mRect.left + mRect.width / 2;
      targetY = mRect.top + mRect.height / 2;
    } else {
      // 2. Desktop Mode: Target the exact newly added item spot at top of the items list
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

      return matchesCategory && matchesSearch && matchesDescFilter;
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
  }, [items, category, debouncedSearchTerm, sortBy, categories, descFilter]);

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
            transform: translate3d(var(--start-x), var(--start-y), 70px) translate(-50%, -50%) scale(1.15) perspective(1000px) rotateX(12deg) rotateY(-18deg) rotateZ(6deg);
          }
          48% {
            opacity: 1;
            transform: translate3d(calc(var(--start-x) + (var(--target-x) - var(--start-x)) * 0.52), calc(var(--start-y) + (var(--target-y) - var(--start-y)) * 0.4 - 70px), 85px) translate(-50%, -50%) scale(0.98) perspective(1000px) rotateX(16deg) rotateY(-22deg) rotateZ(10deg);
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
      {/* Mobile & Tablet Top Category Scrollbar (Visible on screens < 1024px) */}
      <div className="flex lg:hidden overflow-x-auto category-scroll py-2 px-3 bg-[#f7f1ea] border-b border-border shrink-0 gap-2 w-full no-scrollbar">
        {categoryOptions.filter(cat => cat !== '⭐ Favourites').map((cat) => {
          const isSelected = category === cat;
          const count = categoryItemCounts[cat];
          return (
            <button
              key={cat}
              onClick={() => { setCategory(cat); if (onSearchChange) onSearchChange(''); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all shadow-xs ${isSelected
                ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-sm'
                : 'bg-[#FDFBF7] text-slate-600 hover:bg-orange-50 hover:text-orange-800 border border-orange-100'
                }`}>
              {getCategoryIcon(cat, isSelected)}
              <span>{t(cat)}</span>
              {count !== undefined && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${isSelected
                    ? 'bg-white/25 text-white'
                    : 'bg-gray-100 text-text-muted'
                  }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Left Sidebar: Categories (Visible on large screens >= 1024px) */}
      {!isCategorySidebarCollapsed && (
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

        {/* Filter & Sort Controls Row */}
        <div className="flex items-center justify-between bg-[#f7f1ea] border-b border-border py-1.5 px-2 sm:px-3 gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto no-scrollbar">
          {/* Desktop Categories Open Button when collapsed */}
          {isCategorySidebarCollapsed && (
            <button
              type="button"
              onClick={toggleCategorySidebar}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FDFBF7] text-slate-200 hover:bg-sky-950 hover:text-white border border-sky-500/30 shadow-xs transition-all shrink-0 cursor-pointer"
              title={t("Open Categories Sidebar")}>
              <MenuIcon size={14} className="text-slate-600" />
              <span>{t("Categories")}</span>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          )}

          {/* Mobile Favorite Items Toggle Button (Left side on mobile) */}
          <button
            type="button"
            onClick={() => { setCategory(category === '⭐ Favourites' ? 'All' : '⭐ Favourites'); if (onSearchChange) onSearchChange(''); }}
            className={`flex sm:hidden items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${category === '⭐ Favourites'
              ? 'bg-amber-500 text-black border-amber-600 shadow-xs font-black'
              : 'bg-[#FDFBF7] text-slate-300 hover:bg-sky-950 hover:text-white border-sky-500/30 shadow-xs'
              }`}
          >
            <Star size={12} className={category === '⭐ Favourites' ? 'fill-black text-black' : 'text-amber-400 fill-amber-400'} />
            <span>{t("Favorite Items")}</span>
          </button>



          {/* Right Controls: Sort, Add Item, Image Toggle */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto justify-end">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-8 px-2 border border-sky-500/30 rounded-lg bg-[#FDFBF7] text-slate-200 text-xs font-bold focus:outline-none focus:border-sky-400 transition-all shadow-xs cursor-pointer max-w-[130px]"
            >
              <option value="latest">{t("Latest")}</option>
              <option value="oldest">{t("Oldest")}</option>
              <option value="alphaAsc">{t("A-Z")}</option>
              <option value="alphaDesc">{t("Z-A")}</option>
              <option value="priceAsc">{t("Price: Low-High")}</option>
              <option value="priceDesc">{t("Price: High-Low")}</option>
            </select>

            {userRole === 'Admin' && (
              <button
                onClick={() => onNavigate && onNavigate('menu')}
                className="flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg bg-red-500 text-white shadow-xs hover:bg-red-600 active:scale-95 transition-all gap-1 font-bold text-xs whitespace-nowrap cursor-pointer shrink-0"
                title={t("Add Item")}
              >
                <Plus size={14} />
                <span className="hidden xl:inline">{t("Add Item")}</span>
              </button>
            )}

            <button
              onClick={() => setShowImages(!showImages)}
              className={`flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg border shadow-xs active:scale-95 transition-all gap-1 font-bold text-xs cursor-pointer shrink-0 ${showImages
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-white text-text-muted border-border hover:bg-[#f7f1ea]'
                }`}
              title={showImages ? t('Images: On') : t('Images: Off')}
            >
              <ImageIcon size={14} />
              <span className="hidden xl:inline">{showImages ? t('Images: On') : t('Images: Off')}</span>
            </button>

            <button
              onClick={() => setShowAnimation(!showAnimation)}
              className={`flex items-center justify-center h-8 px-2 sm:px-2.5 rounded-lg border shadow-xs active:scale-95 transition-all gap-1 font-bold text-xs cursor-pointer shrink-0 ${showAnimation
                ? 'bg-purple-50 text-purple-600 border-purple-200'
                : 'bg-white text-text-muted border-border hover:bg-[#f7f1ea]'
                }`}
              title={showAnimation ? t('Animation: On') : t('Animation: Off')}
            >
              <Sparkles size={14} />
              <span className="hidden xl:inline">{showAnimation ? t('Anim: On') : t('Anim: Off')}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Items Grid */}
        <div ref={gridContainerRef} className="flex-1 overflow-y-auto p-4 relative bg-[#f7f1ea] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Wholesale Box Packer Banner */}
          {fishOrderMode === 'bulk' && (
            <div className="bg-gradient-to-r from-amber-500/15 via-[#FAF0E4] to-amber-500/15 border-2 border-amber-500/50 rounded-2xl p-3.5 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                  📦
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/90 px-2.5 py-0.5 rounded-full border border-amber-300">
                      Wholesale Bulk Mode
                    </span>
                    <span className="text-xs font-black text-amber-950 bg-white border border-amber-300 px-2.5 py-0.5 rounded-lg shadow-2xs">
                      Ready: Box #{currentBoxNumber}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 mt-1 font-semibold">
                    Pack mixed fish varieties (3 to 10 items) with custom weight & pricing into Box #{currentBoxNumber}.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openBoxPackerModal(null)}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 border border-amber-600"
              >
                <span>📦</span>
                <span>Pack Wholesale Box (Box #{currentBoxNumber})</span>
              </button>
            </div>
          )}

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

                return (
                  <div
                    key={item._id}
                    data-fish-card-id={item._id}
                    style={{ animationDelay: showAnimation ? `${Math.min(idx * 30, 400)}ms` : '0ms' }}
                    className={`menu-card-item ${showAnimation ? 'menu-card-anim-enabled' : ''} bg-[#FDFBF7] transition-all border flex flex-col justify-between overflow-hidden relative rounded-2xl ${isAvailable ? 'cursor-pointer hover:shadow-lg hover:border-orange-300 hover:shadow-orange-500/10 hover:-translate-y-1 border-orange-100 shadow-md' : 'cursor-not-allowed opacity-50 bg-[#F7EFE2] border-orange-100'} ${showImages ? 'min-h-48 sm:min-h-52' : 'h-30 p-3'}`}
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
                      // Open Fish Weight / Box selection modal
                      if (fishOrderMode === 'bulk') {
                        openBoxPackerModal(item);
                      } else {
                        setSelectedFishItem(item);
                        setFishWeightGrams('1000');
                        setSelectedCutType('Whole');
                        setTareGrams(0);
                        setBoxCountInput('1');
                      }
                    }}>

                    <div className={`flex items-start justify-between w-full h-4 z-[2] absolute ${showImages ? 'top-2.5 left-0 px-2.5' : 'top-3 left-0 px-3'}`}>
                      <div className="flex gap-1 items-center">
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                          {fishOrderMode === 'bulk' ? '📦 Box' : '🐟 Kg'}
                        </span>
                      </div>

                      <div className="flex gap-1.5 items-center">
                        {!isAvailable && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shadow-sm ${showImages ? 'text-white bg-red-500/90 backdrop-blur-sm' : 'text-red-500 bg-red-50'}`}>{t("Out of Stock")}</span>}

                        {/* Description info button */}
                        {item.description && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDescCard(activeDescCard === item._id ? null : item._id);
                            }}
                            className={`p-1 rounded-full backdrop-blur-sm transition-all shadow-sm flex items-center justify-center ${activeDescCard === item._id
                                ? 'bg-blue-500 text-white border border-blue-400'
                                : showImages
                                  ? 'bg-black/20 text-white hover:bg-blue-500/80 border border-white/20'
                                  : 'bg-gray-100 text-text-muted hover:bg-blue-50 hover:text-blue-600 border border-border'
                              }`}
                            title={t("View Description")}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="8" /><line x1="12" y1="12" x2="12" y2="16" /></svg>
                          </button>
                        )}

                        <button
                          onClick={(e) => handleToggleFavorite(e, item)}
                          className={`p-1 rounded-full backdrop-blur-sm transition-all shadow-sm flex items-center justify-center ${item.isFavorite ?
                            'bg-yellow-50 text-yellow-500 border border-yellow-200' :
                            showImages ? 'bg-black/20 text-white hover:bg-black/40 border border-white/20' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 border border-border'}`
                          }>
                          <Star size={12} className={item.isFavorite ? "fill-yellow-500" : ""} />
                        </button>
                      </div>
                    </div>

                    {showImages && (
                      <div className="w-full h-28 sm:h-30 shrink-0 bg-gray-100 relative overflow-hidden">
                        <LazyMenuImage src={formatImageUrl(item.image)} alt={item.name} index={idx} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                      </div>
                    )}

                    <div className={`flex-1 flex flex-col justify-between ${showImages ? 'p-2.5' : ''}`}>
                      <div className={`flex-1 flex flex-col items-center justify-center text-center mt-1 text-[13px] sm:text-[14px] leading-tight ${isAvailable ? 'font-bold text-slate-800' : 'font-medium text-slate-500 line-through'}`}>
                        <span className="line-clamp-2 leading-snug">{(language !== 'en' && item.nameTranslations?.[language]) || item.name}</span>
                        {item.scientificName && (
                          <span className="text-[11px] text-slate-600 font-medium italic line-clamp-1 mt-0.5">{item.scientificName}</span>
                        )}
                      </div>

                      <div className={`flex justify-center w-full ${showImages ? 'mt-1.5' : 'mt-2 mb-0.5'}`}>
                        {fishOrderMode === 'bulk' ? (
                          <span className="text-[12px] sm:text-[13px] font-black px-2.5 py-1 rounded-full shadow-sm border bg-[#F7EFE2] text-[#C2410C] border-[#FDBA74] bg-[#FFF7ED] font-mono shadow-xs">
                            ₹{(item.boxPrice || (item.price * (item.boxPackingKg || 60))).toFixed(0)}
                            <span className="text-[10px] text-[#9A3412] font-bold ml-0.5">/Box ({item.boxPackingKg || 60}kg)</span>
                          </span>
                        ) : (
                          <span className="text-[12px] sm:text-[13px] font-black px-2.5 py-1 rounded-full shadow-xs border bg-emerald-50 text-emerald-800 border-emerald-300 font-mono font-black">
                            ₹{item.price ? `${item.price.toFixed(2)}` : '0.00'}
                            <span className="text-[10px] text-emerald-700 font-semibold ml-0.5">/{item.sellingUnit || 'Kg'}</span>
                          </span>
                        )}
                      </div>
                    </div>
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
        </div>

        {/* Pagination Navigation Footer Bar — Desktop only (hidden on mobile) */}
        {filteredItems.length > 0 && (
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedFishItem(null)}
        >
          <div
            data-fish-modal="true"
            className="bg-white w-full max-w-[490px] max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-[#E8DCCB] bg-[#FAF0E4]">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#c2410c] bg-[#FFF3E0] px-2.5 py-0.5 rounded-full border border-[#ffcc80]">
                  🐟 Retail Weight Selection
                </span>
                <h2 className="text-base sm:text-lg font-black text-slate-900 mt-1 leading-tight">{selectedFishItem.name}</h2>
                <p className="text-xs text-[#7c3f1d] font-bold mt-0.5">
                  ₹{selectedFishItem.price} / Kg
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFishItem(null)}
                className="text-slate-500 hover:text-slate-800 bg-white hover:bg-[#F5E8D8] border border-[#E8DCCB] rounded-full p-1.5 transition-all cursor-pointer shadow-xs"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-3.5 overflow-y-auto flex-1">
              {/* 🐟 Individual Retail Order (Kg / Grams / Cuts) */}
              <div className="space-y-3">
                  {/* Cut Type Selection (Balanced 5-Button Row) */}
                  <div className="bg-[#F7EFE2] border border-sky-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Cutting Style / Preparation</span>
                      <span className="text-[10px] text-slate-400">Butcher slip instruction</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { name: 'Whole', label: 'Whole' },
                        { name: 'Cleaned', label: 'Cleaned' },
                        { name: 'Curry Cut', label: 'Curry Cut' },
                        { name: 'Fry Cut', label: 'Fry Cut' },
                        { name: 'Boneless Fillet', label: 'Boneless' }
                      ].map(cut => {
                        const isSelected = selectedCutType === cut.name;
                        return (
                          <button
                            key={cut.name}
                            type="button"
                            onClick={() => setSelectedCutType(cut.name)}
                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer text-center ${
                              isSelected
                                ? 'bg-[#994d1c] text-white border-[#994d1c] shadow-xs font-black'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400 hover:bg-sky-50 font-semibold'
                            }`}
                          >
                            {cut.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Weighing & Scale Weight */}
                  <div className="bg-[#F7EFE2] border border-sky-500/30 rounded-xl p-3.5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-800">Scale Weighed Grams</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400">Tare:</span>
                        {[0, 50, 100].map(tVal => (
                          <button
                            key={tVal}
                            type="button"
                            onClick={() => setTareGrams(tVal)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                              tareGrams === tVal
                                ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-xs'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {tVal === 0 ? 'Zero' : `-${tVal}g`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Grams Selectors */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: '250g (¼ Kg)', val: '250' },
                        { label: '500g (½ Kg)', val: '500' },
                        { label: '750g (¾ Kg)', val: '750' },
                        { label: '1000g (1 Kg)', val: '1000' },
                        { label: '1500g (1.5 Kg)', val: '1500' },
                        { label: '2000g (2 Kg)', val: '2000' },
                        { label: '2500g (2.5 Kg)', val: '2500' },
                        { label: '3000g (3 Kg)', val: '3000' }
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setFishWeightGrams(preset.val)}
                          className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center leading-tight ${
                            fishWeightGrams === preset.val
                              ? 'bg-[#994d1c] text-white border-[#994d1c] font-black shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-sky-400 hover:bg-sky-50 font-semibold'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Scale Digital Reading Input */}
                    <div className="flex items-center gap-2 bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 focus-within:border-[#994d1c] focus-within:bg-white transition-colors">
                      <Scale size={18} className="text-slate-600 shrink-0" />
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={fishWeightGrams}
                        onWheel={(e) => e.target.blur()}
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E'].includes(e.key)) {
                            e.preventDefault();
                          }
                        }}
                        onChange={(e) => {
                          const sanitized = e.target.value.replace(/[^0-9.]/g, '');
                          setFishWeightGrams(sanitized);
                        }}
                        placeholder="Scale grams"
                        className="flex-1 bg-transparent font-mono text-xl font-black text-slate-900 focus:outline-none"
                      />
                      <span className="text-xs font-black text-slate-500 shrink-0 font-mono">GRAMS</span>
                    </div>

                    {/* Accurate Real-World Billing & Stock Breakdown */}
                    {(() => {
                      const scaleGrams = parseFloat(fishWeightGrams) || 0;
                      const netGrams = Math.max(0, scaleGrams - tareGrams);
                      const netKg = netGrams / 1000;
                      const calculatedPrice = (netKg * (selectedFishItem.price || 0));

                      return (
                        <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-3 space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs">
                              <span className="text-[10px] text-slate-500 font-semibold block">Weighed</span>
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                {netGrams >= 1000 ? `${netKg.toFixed(2)} Kg` : `${netGrams}g`}
                              </span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs">
                              <span className="text-[10px] text-slate-500 font-semibold block">Cut Prep</span>
                              <span className="font-bold text-slate-800 text-xs truncate block">
                                {selectedCutType}
                              </span>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-lg p-1.5 shadow-xs">
                              <span className="text-[10px] text-slate-500 font-semibold block">Rate</span>
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                ₹{selectedFishItem.price}/Kg
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                            <div>
                              <span className="text-xs font-bold text-slate-800">Total Billed:</span>
                              <span className="text-[10px] text-emerald-700 font-semibold block">1:1 Raw Stock Deducted</span>
                            </div>
                            <span className="text-xl font-black text-emerald-700 font-mono">₹{calculatedPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    disabled={!fishWeightGrams || parseFloat(fishWeightGrams) <= 0}
                    onClick={(e) => {
                      const scaleGrams = parseFloat(fishWeightGrams) || 1000;
                      if (scaleGrams <= 0) return;
                      const netGrams = Math.max(0, scaleGrams - tareGrams);
                      const netKg = netGrams / 1000;
                      const calculatedPrice = parseFloat((netKg * (selectedFishItem.price || 0)).toFixed(2));
                      const weightLabel = netGrams >= 1000 ? `${netKg} Kg` : `${netGrams}g`;

                      const itemToAdd = {
                        ...selectedFishItem,
                        itemKey: `${selectedFishItem._id}_${selectedCutType}_${netGrams}g`,
                        menuItem: selectedFishItem._id,
                        originalId: selectedFishItem._id,
                        originalFishName: selectedFishItem.name,
                        name: `${selectedFishItem.name} (${selectedCutType} - ${weightLabel})`,
                        price: calculatedPrice,
                        quantity: 1,
                        sellingUnit: 'Kg',
                        enteredWeight: netKg,
                        netWeightKg: netKg,
                        grossWeightKg: netKg, // 1:1 exact raw catch deduction
                        cutType: selectedCutType,
                        yieldFactor: 1.0,
                        tareWeightKg: (tareGrams / 1000)
                      };

                      // Retrieve the original card's position on the screen
                      let startX = window.innerWidth / 2;
                      let startY = window.innerHeight * 0.4;
                      const cardEl = document.querySelector(`[data-fish-card-id="${selectedFishItem._id}"]`);
                      if (cardEl) {
                        const cRect = cardEl.getBoundingClientRect();
                        startX = cRect.left + cRect.width / 2;
                        startY = cRect.top + (showImages ? 65 : cRect.height / 2);
                      } else if (lastClickedCardPos.current && lastClickedCardPos.current.cardId === selectedFishItem._id) {
                        startX = lastClickedCardPos.current.x;
                        startY = lastClickedCardPos.current.y;
                      }

                      triggerFlyAnimation(
                        startX,
                        startY,
                        selectedFishItem.name,
                        formatImageUrl(selectedFishItem.image)
                      );

                      onSelectItem(itemToAdd);
                      setSelectedFishItem(null);
                    }}
                    className="w-full bg-gradient-to-r from-[#994d1c] to-[#7c3f1d] hover:from-[#884318] hover:to-[#6c3618] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-2.5 rounded-xl shadow-lg cursor-pointer transition-all active:scale-[0.98] text-sm"
                  >
                    Add to Fish Order
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
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowBoxPacker(false)}
        >
          <div
            data-box-packer-modal="true"
            className="bg-[#FDFBF7] w-full max-w-[620px] max-h-[94vh] rounded-3xl shadow-2xl border-2 border-[#E8DCCB] flex flex-col overflow-hidden text-slate-800 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 py-4 border-b border-[#E8DCCB] bg-gradient-to-r from-[#FAF0E4] via-[#FFF8EE] to-[#FAF0E4]">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-sm border border-amber-400">
                  📦
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full border border-amber-300">
                      WHOLESALE BOX PACKER
                    </span>
                    <span className="text-sm font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                      Box #{currentBoxNumber}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    Packing Wholesale Box #{currentBoxNumber}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Mix 1 to 10 fish items in this box with custom weights & prices
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBoxPacker(false)}
                className="text-slate-500 hover:text-slate-800 bg-white hover:bg-[#F5E8D8] border border-[#E8DCCB] rounded-full p-2 transition-all cursor-pointer shadow-xs"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Step 1: Number of Items in this Box */}
              <div className="bg-white border border-[#E8DCCB] rounded-2xl p-3.5 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span>1️⃣</span> Number of Fish Items in this Box:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Select how many different fish varieties will be packed into Box #{currentBoxNumber}
                    </span>
                  </div>
                  
                  {/* Stepper +/- */}
                  <div className="flex items-center gap-1.5 self-start sm:self-auto bg-[#FAF0E4] p-1 rounded-xl border border-[#E8DCCB]">
                    <button
                      type="button"
                      onClick={() => handleSlotCountChange(boxSlotCount - 1)}
                      disabled={boxSlotCount <= 1}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-black text-base flex items-center justify-center border border-[#E8DCCB] shadow-2xs cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-black text-sm text-amber-900 font-mono">
                      {boxSlotCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSlotCountChange(boxSlotCount + 1)}
                      disabled={boxSlotCount >= 10}
                      className="w-7 h-7 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-800 font-black text-base flex items-center justify-center border border-[#E8DCCB] shadow-2xs cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Quick Item Count Buttons 1..10 */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(cnt => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => handleSlotCountChange(cnt)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        boxSlotCount === cnt
                          ? 'bg-amber-500 text-white border-amber-600 font-black shadow-xs scale-105'
                          : 'bg-[#FAF0E4] hover:bg-[#F5E8D8] text-slate-700 border-[#E8DCCB]'
                      }`}
                    >
                      {cnt} {cnt === 1 ? 'Item' : 'Items'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Fish Items Slots */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span>2️⃣</span> Fish Varieties & Weights for Box #{currentBoxNumber}:
                  </span>
                  <span className="text-[11px] text-amber-800 font-bold">
                    {boxSlots.length} of {boxSlotCount} slots configured
                  </span>
                </div>

                <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                  {boxSlots.map((slot, index) => {
                    const itemTotal = (parseFloat(slot.weightKg) || 0) * (parseFloat(slot.pricePerKg) || 0);
                    return (
                      <div
                        key={slot.id || index}
                        className="bg-white border border-[#E8DCCB] hover:border-amber-400/80 rounded-2xl p-3 shadow-2xs transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black text-amber-800 bg-[#FAF0E4] border border-[#E8DCCB] px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <span>🐟 Fish #{index + 1}</span>
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

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          {/* Fish selector (sm:col-span-5) */}
                          <div className="sm:col-span-5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Select Fish Variety
                            </label>
                            <select
                              value={slot.fishId || ''}
                              onChange={(e) => handleSlotFishChange(index, e.target.value)}
                              className="w-full bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 truncate cursor-pointer"
                            >
                              <option value="" disabled>-- Choose a fish --</option>
                              {items.map(fish => (
                                <option key={fish._id} value={fish._id}>
                                  {fish.name} (₹{fish.price}/Kg)
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Weight (Kg) (sm:col-span-3) */}
                          <div className="sm:col-span-3">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Weight (Kg)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0.1"
                                step="0.5"
                                value={slot.weightKg}
                                onChange={(e) => handleSlotWeightChange(index, e.target.value)}
                                placeholder="e.g. 10"
                                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono text-center"
                              />
                              <span className="absolute right-2 top-1.5 text-[10px] text-slate-400 font-bold pointer-events-none">
                                Kg
                              </span>
                            </div>
                          </div>

                          {/* Rate / Price per Kg (sm:col-span-2) */}
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Rate (₹/Kg)
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={slot.pricePerKg}
                                onChange={(e) => handleSlotPriceChange(index, e.target.value)}
                                placeholder="Rate"
                                className="w-full bg-white border border-[#E8DCCB] rounded-xl px-2 py-1.5 text-xs font-black text-slate-900 focus:outline-none focus:border-amber-500 font-mono text-center"
                              />
                            </div>
                          </div>

                          {/* Total Amount (sm:col-span-2) */}
                          <div className="sm:col-span-2 text-right">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                              Item Total
                            </label>
                            <div className="text-xs font-black text-amber-900 font-mono py-1.5">
                              ₹{itemTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {boxSlots.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="w-full py-2 bg-white hover:bg-[#FAF0E4] border border-dashed border-[#E8DCCB] hover:border-amber-400 text-amber-800 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>+</span>
                    <span>Add Another Fish to Box #{currentBoxNumber}</span>
                  </button>
                )}
              </div>

              {/* Step 3: Total Box Summary Card */}
              {(() => {
                const totalKg = boxSlots.reduce((acc, s) => acc + (parseFloat(s.weightKg) || 0), 0);
                const totalAmt = boxSlots.reduce((acc, s) => acc + ((parseFloat(s.weightKg) || 0) * (parseFloat(s.pricePerKg) || 0)), 0);
                const validCount = boxSlots.filter(s => s.fish && (parseFloat(s.weightKg) || 0) > 0).length;

                return (
                  <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/20 border-2 border-amber-500/50 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-amber-950 uppercase tracking-wider block">
                          📦 Box #{currentBoxNumber} Summary
                        </span>
                        <span className="text-[11px] text-amber-800 font-bold">
                          {validCount} Varieties &bull; Total Weight: <strong className="font-mono text-slate-900">{totalKg.toFixed(2)} Kg</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Box Total Price</span>
                        <span className="text-xl sm:text-2xl font-black text-amber-900 font-mono">
                          ₹{totalAmt.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#E8DCCB] bg-[#FAF0E4] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowBoxPacker(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 font-bold text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBoxToOrder}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-xs sm:text-sm shadow-md cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <span>📦</span>
                <span>Add Box #{currentBoxNumber} to Order</span>
              </button>
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