import React, { useState, useEffect } from 'react';
import { useLanguage } from "../../../context/LanguageContext";
import { getMenuItems, addMenuItem, bulkAddMenuItems, updateMenuItem, deleteMenuItem, deleteAllMenuItems } from '../../../api/catalog/menu';
import { getAllCategories, createCategory, updateCategory, deleteCategory } from '../../../api/catalog/category';
import { getCachedMenuItems, getCachedCategories } from '../../../db/offlineDb';
import { getInventory } from '../../../api/inventory/inventory';
import realtimeService from '../../../services/realtimeService';
import Papa from 'papaparse';
import { Plus, Edit2, Trash2, X, Search, FolderPlus, Folder, FolderOpen, ChevronLeft, ChevronRight, Eye, Download, Upload, ToggleLeft, Loader2, RefreshCw, MoreVertical, Tag, Percent, Hash } from 'lucide-react';
import ConfirmationModal from '../system/ConfirmationModal';
import Toast from '../system/Toast';
import BackButton from '../common/BackButton';
import BulkImportModal, { generateExcelWithStyling } from './BulkImportModal';

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
    } catch (e) {}
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]{30,}$/.test(trimmed) || trimmed.startsWith('iVBOR') || trimmed.startsWith('/9j/') || trimmed.startsWith('R0lGOD') || trimmed.startsWith('UklGR')) {
    let mime = 'jpeg';
    if (trimmed.startsWith('iVBOR')) mime = 'png';else
    if (trimmed.startsWith('R0lGOD')) mime = 'gif';else
    if (trimmed.startsWith('UklGR')) mime = 'webp';
    return `data:image/${mime};base64,${trimmed}`;
  }
  return trimmed;
};

const MenuManagement = ({ user, onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = !user?.role || userRole === 'admin' || userRole === 'super-admin' || userRole === 'manager';
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Instant Cache Load (0ms delay)
    getCachedMenuItems().then((cachedItems) => {
      if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
        setItems(cachedItems);
        setLoading(false);
      }
    }).catch(() => {});

    getCachedCategories().then((cachedCats) => {
      if (cachedCats && Array.isArray(cachedCats) && cachedCats.length > 0) {
        setCategories(cachedCats);
      }
    }).catch(() => {});

    // 2. Background Revalidation
    fetchItems(true);
    fetchCategories();
    fetchInventory();

    // 3. Live Real-Time Stock Sync
    const unsubStock = realtimeService.subscribe('fishStockUpdated', () => {
      fetchItems(true);
    });
    const unsubBill = realtimeService.subscribe('billSettled', () => {
      fetchItems(true);
    });

    return () => {
      if (unsubStock) unsubStock();
      if (unsubBill) unsubBill();
    };
  }, []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isCategoryViewMode, setIsCategoryViewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [descFilter, setDescFilter] = useState('all'); // 'all' | 'hasDesc' | 'noDesc'
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, itemId: null, categoryId: null });
  const [toast, setToast] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('latest');
  const [selectedWaterType, setSelectedWaterType] = useState('all'); // 'all' | 'sea_water' | 'fresh_water'
  const [selectedSpeciesType, setSelectedSpeciesType] = useState('all'); // 'all' | 'fish' | 'prawn' | 'crab'
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [activeDescTooltip, setActiveDescTooltip] = useState(null);
  // Per-recipe-row dropdown open state & search query
  const [ingredientDropdown, setIngredientDropdown] = useState({}); // { [rowIndex]: { open: bool, query: string } }
  const [uploadFileInfo, setUploadFileInfo] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedWaterType, selectedSpeciesType]);
  const itemsPerPage = 20;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    scientificName: '',
    category: '',
    sellingUnit: 'Kg',
    price: '',
    wholesalePricePerKg: '',
    exportPricePerKg: '',
    waterType: 'sea_water',
    speciesType: 'fish',
    sizeGrades: {
      small: { minKg: 0, maxKg: 1, enabled: true, price: '', wholesalePrice: '', exportPrice: '', unit: 'kg', cuttingCharge: '' },
      medium: { minKg: 1, maxKg: 4, enabled: true, price: '', wholesalePrice: '', exportPrice: '', unit: 'kg', cuttingCharge: '' },
      big: { minKg: 4, maxKg: 99, enabled: true, price: '', wholesalePrice: '', exportPrice: '', unit: 'kg', cuttingCharge: '' }
    },
    customCuttingChargeEnabled: false,
    cuttingCharge: '',
    openingStock: '',
    type: 'non-veg',
    description: '',
    image: '',
    taxRate: 0,
    hsnCode: '',
    isAvailable: true,
    recipe: [],
    variants: []
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    sortOrder: 0,
    isActive: true
  });

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const data = await getInventory();
      setInventoryItems(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
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

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleOpenModal = (item = null, viewMode = false) => {
    setIsViewMode(viewMode);
    if (item) {
      setCurrentItem(item);
      const catName = String(item.category?.name || item.category || '').toLowerCase();
      const itemName = String(item.name || '').toLowerCase();
      const inferredWater = item.waterType || (catName.includes('fresh') || catName.includes('river') || catName.includes('sweet') ? 'fresh_water' : 'sea_water');
      const inferredSpecies = item.speciesType || (itemName.includes('prawn') || catName.includes('prawn') || itemName.includes('shrimp') ? 'prawn' : itemName.includes('crab') || catName.includes('crab') ? 'crab' : 'fish');

      setFormData({
        name: item.name || '',
        scientificName: item.scientificName || '',
        category: item.category?.name || item.category || '',
        sellingUnit: item.sellingUnit || 'Kg',
        purchasePrice: item.purchasePrice !== undefined && item.purchasePrice !== null ? item.purchasePrice : '',
        price: item.price !== undefined && item.price !== null ? item.price : '',
        wholesalePricePerKg: item.wholesalePricePerKg !== undefined && item.wholesalePricePerKg !== null ? item.wholesalePricePerKg : '',
        exportPricePerKg: item.exportPricePerKg !== undefined && item.exportPricePerKg !== null ? item.exportPricePerKg : '',
        waterType: inferredWater,
        speciesType: inferredSpecies,
        sizeGrades: {
          small: {
            minKg: item.sizeGrades?.small?.minKg ?? 0,
            maxKg: item.sizeGrades?.small?.maxKg ?? 1,
            enabled: item.sizeGrades?.small?.enabled !== false,
            price: item.sizeGrades?.small?.price ?? '',
            wholesalePrice: item.sizeGrades?.small?.wholesalePrice ?? '',
            exportPrice: item.sizeGrades?.small?.exportPrice ?? '',
            unit: item.sizeGrades?.small?.unit || 'kg',
            cuttingCharge: item.sizeGrades?.small?.cuttingCharge ?? ''
          },
          medium: {
            minKg: item.sizeGrades?.medium?.minKg ?? 1,
            maxKg: item.sizeGrades?.medium?.maxKg ?? 4,
            enabled: item.sizeGrades?.medium?.enabled !== false,
            price: item.sizeGrades?.medium?.price ?? '',
            wholesalePrice: item.sizeGrades?.medium?.wholesalePrice ?? '',
            exportPrice: item.sizeGrades?.medium?.exportPrice ?? '',
            unit: item.sizeGrades?.medium?.unit || 'kg',
            cuttingCharge: item.sizeGrades?.medium?.cuttingCharge ?? ''
          },
          big: {
            minKg: item.sizeGrades?.big?.minKg ?? 4,
            maxKg: item.sizeGrades?.big?.maxKg ?? 99,
            enabled: item.sizeGrades?.big?.enabled !== false,
            price: item.sizeGrades?.big?.price ?? '',
            wholesalePrice: item.sizeGrades?.big?.wholesalePrice ?? '',
            exportPrice: item.sizeGrades?.big?.exportPrice ?? '',
            unit: item.sizeGrades?.big?.unit || 'kg',
            cuttingCharge: item.sizeGrades?.big?.cuttingCharge ?? ''
          }
        },
        customCuttingChargeEnabled: item.customCuttingChargeEnabled || false,
        cuttingCharge: item.cuttingCharge ?? '',
        openingStock: item.stock ?? item.openingStock ?? '',
        type: item.type || 'non-veg',
        description: item.description || '',
        image: item.image || '',
        taxRate: item.taxRate || 0,
        hsnCode: item.hsnCode || '',
        isAvailable: item.isAvailable !== false,
        recipe: item.recipe || [],
        variants: item.variants || []
      });
    } else {
      setCurrentItem(null);
      setFormData({
        name: '',
        scientificName: '',
        category: '',
        sellingUnit: 'Kg',
        purchasePrice: '',
        price: '',
        wholesalePricePerKg: '',
        exportPricePerKg: '',
        waterType: 'sea_water',
        speciesType: 'fish',
        sizeGrades: {
          small: { minKg: 0, maxKg: 1, enabled: true, price: '', wholesalePrice: '', exportPrice: '', unit: 'kg', cuttingCharge: '' },
          medium: { minKg: 1, maxKg: 4, enabled: true, price: '', wholesalePrice: '', exportPrice: '', unit: 'kg', cuttingCharge: '' },
          big: { minKg: 4, maxKg: 99, enabled: true, price: '', wholesalePrice: '', exportPrice: '', unit: 'kg', cuttingCharge: '' }
        },
        customCuttingChargeEnabled: false,
        cuttingCharge: '',
        openingStock: '',
        type: 'non-veg',
        description: '',
        image: '',
        taxRate: 0,
        hsnCode: '',
        isAvailable: true,
        recipe: [],
        variants: []
      });
    }
    setShowCustomCategoryInput(false);
    setCustomCategoryName('');
    setUploadFileInfo(null);
    setIsModalOpen(true);
  };

  const handleOpenCategoryModal = (category = null, viewMode = false) => {
    setIsCategoryViewMode(viewMode);
    if (category) {
      setCurrentCategory(category);
      setCategoryFormData({
        name: category.name,
        description: category.description || '',
        sortOrder: category.sortOrder || 0,
        isActive: category.isActive !== false
      });
    } else {
      setCurrentCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
        sortOrder: 0,
        isActive: true
      });
    }
    setIsCategoryModalOpen(true);
  };

  const validateItemForm = () => {
    const errors = {};

    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Item name is required';
    }

    // Price is optional — only validate if provided
    if (formData.price !== '' && formData.price !== undefined && formData.price !== null) {
      const price = parseFloat(formData.price);
      if (isNaN(price) || price < 0) {
        errors.price = 'Price must be a non-negative number';
      }
    }

    const taxRate = parseFloat(formData.taxRate);
    if (formData.taxRate !== '' && (isNaN(taxRate) || taxRate < 0)) {
      errors.taxRate = 'Tax rate must be a non-negative number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmittingItem) return;

    if (!validateItemForm()) {
      setToast({ message: 'Please fix validation errors', type: 'error' });
      return;
    }

    setIsSubmittingItem(true);

    try {
      let finalCategory = formData.category || (formData.waterType === 'fresh_water' ? 'Fresh Water' : 'Sea Water');
      
      if (showCustomCategoryInput && customCategoryName.trim()) {
        try {
          const newCategory = await createCategory({
            name: customCategoryName.trim(),
            description: '',
            sortOrder: categories.length,
            isActive: true
          });
          finalCategory = newCategory.name;
          setCategories(prev => [...prev, newCategory]);
        } catch (catError) {
          console.error('Error creating custom category:', catError);
          setToast({ message: 'Failed to create new category', type: 'error' });
          setIsSubmittingItem(false);
          return;
        }
      }

      const price = formData.price !== '' && formData.price !== null && formData.price !== undefined
        ? parseFloat(formData.price)
        : 0;
      const purchasePrice = formData.purchasePrice !== '' && formData.purchasePrice !== null && formData.purchasePrice !== undefined
        ? parseFloat(formData.purchasePrice)
        : 0;
      const openingStock = formData.openingStock !== '' && formData.openingStock !== null && formData.openingStock !== undefined
        ? parseFloat(formData.openingStock)
        : 0;
      const taxRate = parseFloat(formData.taxRate) || 0;

      // Sanitize recipe — convert '' ingredientId to null and drop fully empty rows
      const cleanRecipe = (formData.recipe || [])
        .filter(r => r.ingredientId || r.customName?.trim())  // keep only meaningful rows
        .map(r => ({
          ingredientId: r.ingredientId || null,   // empty string → null for Mongoose ObjectId
          customName: r.customName?.trim() || '',
          unit: r.unit?.trim() || '',
          quantityRequired: Number(r.quantityRequired) || 1
        }));

      // Sanitize variants
      const cleanVariants = (formData.variants || [])
        .filter(v => v.name?.trim())
        .map(v => ({ name: v.name.trim(), price: parseFloat(v.price) || 0 }));

      const wholesalePricePerKg = parseFloat(formData.wholesalePricePerKg) || price;
      const exportPricePerKg = parseFloat(formData.exportPricePerKg) || wholesalePricePerKg;

      const itemData = {
        ...formData,
        scientificName: formData.scientificName?.trim() || '',
        sellingUnit: formData.sellingUnit || 'Kg',
        purchasePrice,
        openingStock,
        stock: openingStock,
        wholesalePricePerKg,
        exportPricePerKg,
        waterType: formData.waterType || 'sea_water',
        speciesType: formData.speciesType || 'fish',
        sizeGrades: {
          small: {
            minKg: parseFloat(formData.sizeGrades?.small?.minKg) || 0,
            maxKg: parseFloat(formData.sizeGrades?.small?.maxKg) || 1,
            enabled: formData.sizeGrades?.small?.enabled !== false,
            price: parseFloat(formData.sizeGrades?.small?.price) || price,
            wholesalePrice: parseFloat(formData.sizeGrades?.small?.wholesalePrice) || wholesalePricePerKg,
            exportPrice: parseFloat(formData.sizeGrades?.small?.exportPrice) || exportPricePerKg,
            unit: formData.sizeGrades?.small?.unit || 'kg',
            cuttingCharge: parseFloat(formData.sizeGrades?.small?.cuttingCharge) || 0
          },
          medium: {
            minKg: parseFloat(formData.sizeGrades?.medium?.minKg) || 1,
            maxKg: parseFloat(formData.sizeGrades?.medium?.maxKg) || 4,
            enabled: formData.sizeGrades?.medium?.enabled !== false,
            price: parseFloat(formData.sizeGrades?.medium?.price) || price,
            wholesalePrice: parseFloat(formData.sizeGrades?.medium?.wholesalePrice) || wholesalePricePerKg,
            exportPrice: parseFloat(formData.sizeGrades?.medium?.exportPrice) || exportPricePerKg,
            unit: formData.sizeGrades?.medium?.unit || 'kg',
            cuttingCharge: parseFloat(formData.sizeGrades?.medium?.cuttingCharge) || 0
          },
          big: {
            minKg: parseFloat(formData.sizeGrades?.big?.minKg) || 4,
            maxKg: parseFloat(formData.sizeGrades?.big?.maxKg) || 99,
            enabled: formData.sizeGrades?.big?.enabled !== false,
            price: parseFloat(formData.sizeGrades?.big?.price) || price,
            wholesalePrice: parseFloat(formData.sizeGrades?.big?.wholesalePrice) || wholesalePricePerKg,
            exportPrice: parseFloat(formData.sizeGrades?.big?.exportPrice) || exportPricePerKg,
            unit: formData.sizeGrades?.big?.unit || 'kg',
            cuttingCharge: parseFloat(formData.sizeGrades?.big?.cuttingCharge) || 0
          }
        },
        customCuttingChargeEnabled: formData.customCuttingChargeEnabled || false,
        cuttingCharge: parseFloat(formData.cuttingCharge) || 0,
        category: finalCategory,
        image: formatImageUrl(formData.image),
        price,
        taxRate,
        recipe: cleanRecipe,
        variants: cleanVariants
      };

      // Ensure legacy box packing fields are not saved or sent
      delete itemData.boxPackingKg;
      delete itemData.boxPrice;
      delete itemData.boxTareWeightKg;
      delete itemData.boxNetFishKg;

      console.log('Submitting menu item:', itemData);

      if (currentItem) {
        await updateMenuItem(currentItem._id, itemData);
        setToast({ message: 'Item updated successfully', type: 'success' });
      } else {
        await addMenuItem(itemData);
        setToast({ message: 'Item created successfully', type: 'success' });
      }
      fetchItems();
      setIsModalOpen(false);
      setValidationErrors({});
    } catch (error) {
      console.error('Error saving item:', error);

      // Extract meaningful error message
      let errorMessage = 'Failed to save item';

      if (error.response) {
        // Server responded with error status
        errorMessage = error.response.data?.message ||
        error.response.data?.error ||
        `Server error: ${error.response.status}`;
        console.error('Server error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'No response from server. Please check your connection.';
        console.error('No response received:', error.request);
      } else {
        // Error in request setup
        errorMessage = error.message || 'Failed to save item';
        console.error('Request setup error:', error.message);
      }

      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const fileInputRef = React.useRef(null);

  const handleExportExcel = async () => {
    try {
      const exportItems = items.map((item) => ({
        name: item.name,
        scientificName: item.scientificName || '',
        category: item.category?.name || item.category,
        speciesType: item.speciesType || (item.name?.toLowerCase().includes('prawn') ? 'Prawn' : item.name?.toLowerCase().includes('crab') ? 'Crab' : 'Fish'),
        sellingUnit: item.sellingUnit || 'Kg',
        price: item.price,
        wholesalePricePerKg: item.wholesalePricePerKg || item.price,
        exportPricePerKg: item.exportPricePerKg || item.wholesalePricePerKg || item.price,
        type: item.type === 'veg' ? 'Veg' : item.type === 'non-veg' ? 'Non-Veg' : 'Egg',
        description: item.description || '',
        isAvailable: item.isAvailable ? 'TRUE' : 'FALSE',
        taxRate: item.taxRate || 0,
        image: item.image || ''
      }));

      await generateExcelWithStyling(exportItems, 'YNR_Fishes_Catalog_Export.xlsx');
      setToast({ message: 'Fish catalog exported to Excel successfully!', type: 'success' });
    } catch (err) {
      console.error('Export error:', err);
      // Fallback to CSV export
      handleExportCSV();
    }
  };

  const handleExportCSV = () => {
    const csvData = items.map((item) => ({
      'Fish Name': item.name,
      'Scientific Name': item.scientificName || '',
      'Water Environment': item.category?.name || item.category,
      'Seafood Species': item.speciesType || (item.name?.toLowerCase().includes('prawn') ? 'Prawn' : item.name?.toLowerCase().includes('crab') ? 'Crab' : 'Fish'),
      'Selling Unit': item.sellingUnit || 'Kg',
      'Retail Price (₹/Kg)': item.price,
      'Wholesale Price (₹/Kg)': item.wholesalePricePerKg || item.price,
      'Export Price (₹/Kg)': item.exportPricePerKg || item.wholesalePricePerKg || item.price,
      Type: item.type === 'veg' ? 'Veg' : item.type === 'non-veg' ? 'Non-Veg' : 'Egg',
      Description: item.description || '',
      'Is Available': item.isAvailable ? 'Yes' : 'No',
      'Tax Rate': item.taxRate || 0,
      'Image URL': item.image || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'YNR_Fishes_Catalog_Export.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImportItems = async (validItems) => {
    try {
      const itemsPayload = validItems.map(row => ({
        name: row.name,
        scientificName: row.scientificName || '',
        category: row.category,
        sellingUnit: row.sellingUnit || 'Kg',
        price: parseFloat(row.price) || 0,
        wholesalePricePerKg: parseFloat(row.wholesalePricePerKg) || parseFloat(row.price) || 0,
        exportPricePerKg: parseFloat(row.exportPricePerKg) || parseFloat(row.wholesalePricePerKg) || parseFloat(row.price) || 0,
        waterType: row.waterType || (String(row.category || '').toLowerCase().includes('sea') ? 'sea_water' : 'fresh_water'),
        speciesType: row.speciesType || 'fish',
        openingStock: parseFloat(row.openingStock) || 0,
        stock: parseFloat(row.openingStock) || 0,
        type: row.type || 'non-veg',
        description: row.description || '',
        isAvailable: row.isAvailable !== false,
        taxRate: row.taxRate || 0,
        image: row.image || '',
        variants: Array.isArray(row.variants) ? row.variants : [],
        sizeGrades: row.sizeGrades,
        customCuttingChargeEnabled: row.customCuttingChargeEnabled || false,
        cuttingCharge: parseFloat(row.cuttingCharge) || 0
      }));

      const res = await bulkAddMenuItems(itemsPayload);
      setToast({
        message: res.message || `Bulk Import Complete: ${res.inserted || 0} items added, ${res.updated || 0} items updated.`,
        type: 'success'
      });
      await fetchItems(false);
      await fetchCategories();
    } catch (err) {
      console.error("Failed to bulk import:", err);
      setToast({
        message: 'Bulk import failed: ' + (err.response?.data?.message || err.message),
        type: 'error'
      });
    }
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;
          const itemsPayload = [];

          for (const row of rows) {
            if (!row.Name || !row.Price || !row.Category) continue;

            let parsedVariants = [];
            if (row.Variants) {
              parsedVariants = row.Variants.split('|').map((v) => {
                const parts = v.split(':');
                return { name: parts[0] ? parts[0].trim() : '', price: parseFloat(parts[1]) || 0 };
              });
            }

            itemsPayload.push({
              name: row.Name.trim(),
              price: parseFloat(row.Price) || 0,
              category: row.Category.trim(),
              type: row.Type && row.Type.toLowerCase().includes('non') ? 'non-veg' : 'veg',
              description: row.Description || '',
              isAvailable: row['Is Available'] ? row['Is Available'].toLowerCase() === 'yes' : true,
              taxRate: parseFloat(row['Tax Rate']) || 0,
              hsnCode: row['HSN Code'] || '',
              image: row['Image URL'] || '',
              variants: parsedVariants
            });
          }

          if (itemsPayload.length === 0) {
            setToast({ message: 'No valid items found in CSV file', type: 'error' });
            return;
          }

          const res = await bulkAddMenuItems(itemsPayload);
          setToast({
            message: res.message || `Imported ${res.inserted || 0} items successfully, updated ${res.updated || 0}.`,
            type: 'success'
          });
          await fetchItems(false);
          await fetchCategories();
        } catch (error) {
          setToast({ message: 'Error processing CSV file: ' + (error.response?.data?.message || error.message), type: 'error' });
        } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        setToast({ message: 'Failed to parse CSV file', type: 'error' });
        setLoading(false);
      }
    });
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, itemId: id });
  };

  const handleToggleAvailability = async (item) => {
    try {
      const updated = await updateMenuItem(item._id, { isAvailable: !item.isAvailable });
      setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, isAvailable: !item.isAvailable } : i));
      setToast({ message: `"${item.name}" marked as ${!item.isAvailable ? 'Available' : 'Unavailable'}`, type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to update availability', type: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (deleteModal.deleteAll) {
      try {
        await deleteAllMenuItems();
        fetchItems();
        setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false });
        setToast({ message: 'All items deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting all items:', error);
        setToast({ message: 'Failed to delete all items', type: 'error' });
      }
    } else if (deleteModal.itemId) {
      try {
        await deleteMenuItem(deleteModal.itemId);
        fetchItems();
        setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false });
        setToast({ message: 'Item deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting item:', error);
        setToast({ message: error.response?.data?.message || 'Failed to delete item', type: 'error' });
      }
    } else if (deleteModal.categoryId) {
      try {
        await deleteCategory(deleteModal.categoryId);
        fetchCategories();
        fetchItems(); // Refresh items as categories might be referenced
        setDeleteModal({ isOpen: false, itemId: null, categoryId: null });
        setToast({ message: 'Category deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting category:', error);
        setToast({ message: error.response?.data?.message || 'Failed to delete category', type: 'error' });
      }
    }
  };

  const validateCategoryForm = () => {
    const errors = {};

    if (!categoryFormData.name || categoryFormData.name.trim() === '') {
      errors.name = 'Category name is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();

    if (isSubmittingCategory) return;

    if (!validateCategoryForm()) {
      setToast({ message: 'Please fix validation errors', type: 'error' });
      return;
    }

    setIsSubmittingCategory(true);

    try {
      console.log('Submitting category:', categoryFormData);

      if (currentCategory) {
        await updateCategory(currentCategory._id, categoryFormData);
        setToast({ message: 'Category updated successfully', type: 'success' });
      } else {
        await createCategory(categoryFormData);
        setToast({ message: 'Category created successfully', type: 'success' });
      }
      fetchCategories();
      setIsCategoryModalOpen(false);
      setValidationErrors({});
    } catch (error) {
      console.error('Error saving category:', error);

      // Extract meaningful error message
      let errorMessage = 'Failed to save category';

      if (error.response) {
        errorMessage = error.response.data?.message ||
        error.response.data?.error ||
        `Server error: ${error.response.status}`;
        console.error('Server error details:', {
          status: error.response.status,
          data: error.response.data
        });
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
        console.error('No response received:', error.request);
      } else {
        errorMessage = error.message || 'Failed to save category';
        console.error('Request setup error:', error.message);
      }

      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleDeleteCategoryClick = (id) => {
    setDeleteModal({ isOpen: true, itemId: null, categoryId: id });
  };

  const filteredItems = items.filter((item) => {
    // Water Type filter
    if (selectedWaterType !== 'all') {
      const itemWater = (item.waterType || '').toLowerCase();
      if (selectedWaterType === 'sea_water' && itemWater !== 'sea_water') return false;
      if (selectedWaterType === 'fresh_water' && itemWater !== 'fresh_water') return false;
    }

    // Species filter
    if (selectedSpeciesType !== 'all') {
      const itemSpecies = (item.speciesType || '').toLowerCase();
      if (itemSpecies !== selectedSpeciesType) return false;
    }

    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      item.name.toLowerCase().includes(term) ||
      (item.scientificName || '').toLowerCase().includes(term) ||
      (item.category?.name || item.category || '').toLowerCase().includes(term)
    );
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

  const filteredCategories = categories.filter((category) =>
  category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
  (category.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ─── Filter Counts for Catalog Filter Pills ─────────────────────────────
  const filterCounts = React.useMemo(() => {
    const seaWaterCount = items.filter(i => (i.waterType || '').toLowerCase() === 'sea_water').length;
    const freshWaterCount = items.filter(i => (i.waterType || '').toLowerCase() === 'fresh_water').length;
    const fishCount = items.filter(i => (i.speciesType || 'fish').toLowerCase() === 'fish').length;
    const prawnCount = items.filter(i => (i.speciesType || '').toLowerCase() === 'prawn').length;
    const crabCount = items.filter(i => (i.speciesType || '').toLowerCase() === 'crab').length;

    return {
      all: items.length,
      seaWater: seaWaterCount,
      freshWater: freshWaterCount,
      fish: fishCount,
      prawn: prawnCount,
      crab: crabCount
    };
  }, [items]);

  // Pagination logic
  const itemsTotalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const categoriesTotalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  const itemsStartIndex = (currentPage - 1) * itemsPerPage;
  const itemsEndIndex = itemsStartIndex + itemsPerPage;
  const paginatedItems = filteredItems.slice(itemsStartIndex, itemsEndIndex);

  const categoriesStartIndex = (currentPage - 1) * itemsPerPage;
  const categoriesEndIndex = categoriesStartIndex + itemsPerPage;
    const paginatedCategories = filteredCategories.slice(categoriesStartIndex, categoriesEndIndex);

  if (loading) return <div className="flex items-center justify-center h-full text-text-muted">{t("Loading...")}</div>;

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-hidden">
      {/* Responsive Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-2.5 mb-2 sm:mb-2.5 p-2 sm:p-2.5 bg-surface rounded-2xl border border-border shrink-0 shadow-2xs">
        {/* Title + Mobile Controls */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            <BackButton onClick={onGoBack} className="shrink-0 scale-90 sm:scale-100" />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base md:text-lg font-bold text-text-main leading-tight whitespace-nowrap truncate">{t("Menu Management")}</h1>
              <p className="text-[10px] sm:text-xs text-text-muted hidden sm:block">{t("Manage your restaurant's menu items and categories")}</p>
            </div>
          </div>
          
          {/* Mobile Right: Tab Switcher + 3 Dots Button */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            <div className="flex bg-background p-0.5 rounded-xl border border-border shrink-0">
              <button
                onClick={() => setActiveTab('items')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'items'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {t("Items")}
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'categories'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface'
                }`}
              >
                {t("Categories")}
              </button>
            </div>

            <button 
              onClick={() => setShowMobileActions(!showMobileActions)}
              className="p-1.5 bg-background hover:bg-surface-hover border border-border rounded-xl text-text-main transition-colors shrink-0 shadow-2xs"
              title={t("More Options")}
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Desktop & Tablet Action Controls Toolbar (Hidden on Mobile) */}
        <div className="hidden sm:flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 w-auto">
          {/* Tab Switcher Pills */}
          <div className="flex bg-background p-0.5 rounded-xl border border-border shrink-0">
            <button
              onClick={() => setActiveTab('items')}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'items'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              {t("Menu Items")}
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'categories'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-text-muted hover:text-text-main hover:bg-surface'
              }`}
            >
              {t("Categories")}
            </button>
          </div>

          {/* Action Buttons: Compact */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleImportCSV}
              className="hidden" />

            {isAdmin && activeTab === 'items' && (
              <>
                <button
                  onClick={() => setIsBulkImportModalOpen(true)}
                  className="flex items-center gap-1 bg-background text-text-muted px-2 py-1 md:px-3 md:py-1.5 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs md:text-sm font-semibold shadow-2xs cursor-pointer"
                  title={t("Bulk Import (.xlsx, .csv)")}
                >
                  <Download size={15} className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden xs:inline">{t("Import")}</span>
                </button>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1 bg-background text-text-muted px-2 py-1 md:px-3 md:py-1.5 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs md:text-sm font-semibold shadow-2xs cursor-pointer"
                  title={t("Export Excel / CSV")}
                >
                  <Upload size={15} className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden xs:inline">{t("Export")}</span>
                </button>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, itemId: null, categoryId: null, deleteAll: true })}
                  className="flex items-center gap-1 bg-danger/10 text-danger px-2 py-1 md:px-3 md:py-1.5 rounded-xl hover:bg-danger/20 transition-colors border border-danger/20 text-xs md:text-sm font-semibold cursor-pointer"
                  title={t("Delete All Items")}
                >
                  <Trash2 size={15} className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">{t("Delete All")}</span>
                </button>
              </>
            )}

            {isAdmin && activeTab === 'items' && (
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center gap-1 bg-primary text-white px-2.5 sm:px-3 py-1 md:px-4 md:py-1.5 rounded-xl hover:bg-primary-hover transition-colors shadow-xs text-xs md:text-sm font-bold whitespace-nowrap cursor-pointer"
              >
                <Plus size={16} className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{t("Add Item")}</span>
              </button>
            )}

            {isAdmin && activeTab === 'categories' && (
              <button
                onClick={() => handleOpenCategoryModal()}
                className="flex items-center gap-1 bg-secondary text-white px-2.5 sm:px-3 py-1 md:px-4 md:py-1.5 rounded-xl hover:bg-accent transition-colors shadow-xs text-xs md:text-sm font-bold whitespace-nowrap cursor-pointer"
              >
                <FolderPlus size={16} className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{t("Add Category")}</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Actions Drawer when 3 dots toggled */}
        {showMobileActions && (
          <div className="sm:hidden flex flex-wrap gap-1.5 w-full pt-2 border-t border-border mt-1 animate-in fade-in slide-in-from-top-1">
            {isAdmin && activeTab === 'items' && (
              <>
                <button
                  onClick={() => { setIsBulkImportModalOpen(true); setShowMobileActions(false); }}
                  className="flex items-center gap-1 bg-background text-text-muted px-2.5 py-1.5 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs font-semibold shadow-2xs flex-1 justify-center"
                >
                  <Download size={13} />
                  <span>{t("Import")}</span>
                </button>
                <button
                  onClick={() => { handleExportExcel(); setShowMobileActions(false); }}
                  className="flex items-center gap-1 bg-background text-text-muted px-2.5 py-1.5 rounded-xl hover:bg-surface-hover hover:text-text-main transition-colors border border-border text-xs font-semibold shadow-2xs flex-1 justify-center"
                >
                  <Upload size={13} />
                  <span>{t("Export")}</span>
                </button>
                <button
                  onClick={() => { setDeleteModal({ isOpen: true, itemId: null, categoryId: null, deleteAll: true }); setShowMobileActions(false); }}
                  className="flex items-center gap-1 bg-danger/10 text-danger px-2.5 py-1.5 rounded-xl hover:bg-danger/20 transition-colors border border-danger/20 text-xs font-semibold flex-1 justify-center"
                >
                  <Trash2 size={13} />
                  <span>{t("Delete All")}</span>
                </button>
              </>
            )}

            {isAdmin && activeTab === 'items' && (
              <button
                onClick={() => { handleOpenModal(); setShowMobileActions(false); }}
                className="w-full flex items-center justify-center gap-1 bg-primary text-white py-1.5 rounded-xl hover:bg-primary-hover transition-colors shadow-xs text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>{t("Add Item")}</span>
              </button>
            )}

            {isAdmin && activeTab === 'categories' && (
              <button
                onClick={() => { handleOpenCategoryModal(); setShowMobileActions(false); }}
                className="w-full flex items-center justify-center gap-1 bg-secondary text-white py-1.5 rounded-xl hover:bg-accent transition-colors shadow-xs text-xs font-bold cursor-pointer"
              >
                <FolderPlus size={14} />
                <span>{t("Add Category")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search, Sort & Top Pagination */}
      <div className="mb-2 sm:mb-2.5 flex flex-col gap-1.5 shrink-0">
        {/* Row 1: Search + Sort + Pagination */}
        <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-text-muted w-3.5 h-3.5 md:w-4 md:h-4" />
          <input
            type="search"
            name="search_menu_items_no_autofill"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            aria-autocomplete="none"
            placeholder={`Search ${activeTab === 'items' ? 'items' : 'categories'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 md:pl-10 pr-3 md:pr-4 py-1.5 md:py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-primary transition-colors text-xs md:text-sm text-text-main shadow-2xs font-medium" />
        </div>

        {/* Sort Filter */}
        {activeTab === 'items' && (
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-28 sm:w-36 md:w-48 px-2.5 py-1.5 md:px-3 md:py-2 border border-border rounded-xl bg-surface text-text-main text-xs md:text-sm focus:outline-none focus:border-primary transition-colors shadow-2xs cursor-pointer shrink-0 font-medium"
          >
            <option value="latest">{t("Added: Latest")}</option>
            <option value="oldest">{t("Added: Oldest")}</option>
            <option value="alphaAsc">{t("Alphabetical (A-Z)")}</option>
            <option value="alphaDesc">{t("Alphabetical (Z-A)")}</option>
            <option value="priceAsc">{t("Price: Low to High")}</option>
            <option value="priceDesc">{t("Price: High to Low")}</option>
          </select>
        )}

        {/* Top Pagination Controls */}
        {(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages) > 1 && (
          <div className="flex items-center gap-0.5 bg-surface border border-border rounded-xl px-1.5 py-1 shrink-0 shadow-2xs">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-0.5 rounded-lg text-text-muted hover:text-text-main hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t("Previous Page")}
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] sm:text-[11px] font-bold text-text-main px-1 select-none whitespace-nowrap">
              {currentPage} / {activeTab === 'items' ? itemsTotalPages : categoriesTotalPages}
            </span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages, p + 1))}
              disabled={currentPage === (activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)}
              className="p-0.5 rounded-lg text-text-muted hover:text-text-main hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title={t("Next Page")}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
        </div>{/* end Row 1 */}

        {/* Row 2: Filter Pills — only for items tab, shown on all screen sizes */}
        {activeTab === 'items' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-nowrap py-1">
            <span className="text-[10px] md:text-xs font-bold text-text-muted uppercase tracking-wider shrink-0 hidden sm:inline">{t("Filter")}:</span>
            
            {/* All */}
            <button
              type="button"
              onClick={() => { setSelectedWaterType('all'); setSelectedSpeciesType('all'); setCurrentPage(1); }}
              className={`px-3 py-1 md:px-3.5 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                selectedWaterType === 'all' && selectedSpeciesType === 'all'
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface text-text-main border-border hover:bg-surface-hover'
              }`}
            >
              {t("All")}
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                selectedWaterType === 'all' && selectedSpeciesType === 'all' ? 'bg-white/25 text-white' : 'bg-surface-hover text-text-muted'
              }`}>
                {items.length}
              </span>
            </button>

            {/* Separator */}
            <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

            {/* Sea Water */}
            <button
              type="button"
              onClick={() => { setSelectedWaterType(prev => prev === 'sea_water' ? 'all' : 'sea_water'); setCurrentPage(1); }}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                selectedWaterType === 'sea_water'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                  : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100'
              }`}
            >
              {t("Sea Water")}
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                selectedWaterType === 'sea_water' ? 'bg-white/25 text-white' : 'bg-sky-200/70 dark:bg-sky-900 text-sky-900 dark:text-sky-200'
              }`}>
                {filterCounts.seaWater}
              </span>
            </button>

            {/* Fresh Water */}
            <button
              type="button"
              onClick={() => { setSelectedWaterType(prev => prev === 'fresh_water' ? 'all' : 'fresh_water'); setCurrentPage(1); }}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                selectedWaterType === 'fresh_water'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-100'
              }`}
            >
              {t("Fresh Water")}
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                selectedWaterType === 'fresh_water' ? 'bg-white/25 text-white' : 'bg-teal-200/70 dark:bg-teal-900 text-teal-900 dark:text-teal-200'
              }`}>
                {filterCounts.freshWater}
              </span>
            </button>

            {/* Separator */}
            <div className="h-4 w-px bg-border mx-0.5 shrink-0" />

            {/* Fish */}
            <button
              type="button"
              onClick={() => { setSelectedSpeciesType(prev => prev === 'fish' ? 'all' : 'fish'); setCurrentPage(1); }}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                selectedSpeciesType === 'fish'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
              }`}
            >
              {t("Fish")}
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                selectedSpeciesType === 'fish' ? 'bg-white/25 text-white' : 'bg-indigo-200/70 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-200'
              }`}>
                {filterCounts.fish}
              </span>
            </button>

            {/* Prawn */}
            <button
              type="button"
              onClick={() => { setSelectedSpeciesType(prev => prev === 'prawn' ? 'all' : 'prawn'); setCurrentPage(1); }}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                selectedSpeciesType === 'prawn'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
              }`}
            >
              {t("Prawn")}
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                selectedSpeciesType === 'prawn' ? 'bg-white/25 text-white' : 'bg-rose-200/70 dark:bg-rose-900 text-rose-900 dark:text-rose-200'
              }`}>
                {filterCounts.prawn}
              </span>
            </button>

            {/* Crab */}
            <button
              type="button"
              onClick={() => { setSelectedSpeciesType(prev => prev === 'crab' ? 'all' : 'crab'); setCurrentPage(1); }}
              className={`px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                selectedSpeciesType === 'crab'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
            >
              {t("Crab")}
              <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none ${
                selectedSpeciesType === 'crab' ? 'bg-white/25 text-white' : 'bg-amber-200/70 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
              }`}>
                {filterCounts.crab}
              </span>
            </button>

            <span className="text-[10px] md:text-xs text-text-muted font-medium ml-1 shrink-0">
              ({filteredItems.length} {t("items")})
            </span>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden flex-1 flex flex-col shadow-sm">
        <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
          <div className="min-w-[1050px]">
            {activeTab === 'items' ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FAF6F0] dark:bg-slate-900 sticky top-0 z-10 border-b-2 border-border shadow-xs">
                  <tr>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Fish Name")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Water Type")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Seafood Species")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Unit")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50/50 dark:bg-emerald-950/20">{t("Retail (₹/Kg)")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider bg-amber-50/50 dark:bg-amber-950/20">{t("Wholesale (₹/Kg)")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-950/20">{t("Export (₹/Kg)")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Size Grades & Availability")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">{t("Stock")}</th>
                    <th className="px-3 md:px-4 py-2.5 text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {loading && items.length === 0 ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-border animate-pulse">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-surface-hover shrink-0"></div>
                            <div className="w-28 h-3.5 bg-surface-hover rounded"></div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5"><div className="w-16 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-16 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-10 h-3.5 bg-surface-hover rounded-full"></div></td>
                        <td className="px-3 py-2.5"><div className="w-14 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-14 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-14 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-20 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5"><div className="w-12 h-3.5 bg-surface-hover rounded"></div></td>
                        <td className="px-3 py-2.5 text-right"><div className="w-16 h-3.5 bg-surface-hover rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-10 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 size={24} className={loading ? "animate-spin text-primary" : "hidden"} />
                          <span className="font-medium text-xs">
                            {loading ? t("Loading fish items...") : t("No fish items found")}
                          </span>
                          {!loading && (
                            <button
                              onClick={() => fetchItems(false)}
                              className="mt-1 px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                              <RefreshCw size={13} /> {t("Refresh")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr key={item._id} className="hover:bg-surface-hover transition-colors group">
                        <td className="px-3 md:px-4 py-2 md:py-3 font-medium text-text-main">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {formatImageUrl(item.image) ? (
                              <div className="w-9 h-9 rounded-lg overflow-hidden bg-background border border-border shrink-0 shadow-2xs relative">
                                <img
                                  src={formatImageUrl(item.image)}
                                  alt={item.name}
                                  className="w-9 h-9 object-cover"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                                Fish
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-xs sm:text-sm text-text-main truncate">{item.name}</span>
                              {item.scientificName && (
                                <span className="text-[10px] text-text-muted italic truncate">{item.scientificName}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Water Type */}
                        {/* Water Type */}
                        <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                          {item.waterType === 'sea_water' || (!item.waterType && (item.category?.name || item.category || '').toLowerCase().includes('sea')) ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-black bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-700 shadow-2xs">
                              {t("Sea Water")}
                            </span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700 shadow-2xs">
                              {t("Fresh Water")}
                            </span>
                          )}
                        </td>
                        {/* Seafood Species */}
                        <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                          {(() => {
                            const sp = (item.speciesType || '').toLowerCase();
                            const nameCat = `${item.name || ''} ${item.category?.name || item.category || ''}`.toLowerCase();
                            if (sp === 'prawn' || nameCat.includes('prawn') || nameCat.includes('రొయ్యలు')) {
                              return (
                                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 shadow-2xs">
                                  {t("Prawn")}
                                </span>
                              );
                            }
                            if (sp === 'crab' || nameCat.includes('crab') || nameCat.includes('పీతలు')) {
                              return (
                                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700 shadow-2xs">
                                  {t("Crab")}
                                </span>
                              );
                            }
                            return (
                              <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700 shadow-2xs">
                                {t("Fish")}
                              </span>
                            );
                          })()}
                        </td>
                        {/* Unit */}
                        <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                            {item.sellingUnit || 'Kg'}
                          </span>
                        </td>
                        {/* Retail Price (₹/Kg) */}
                        <td className="px-3 md:px-4 py-2.5 font-black text-emerald-800 dark:text-emerald-400 whitespace-nowrap text-sm bg-emerald-50/20 dark:bg-emerald-950/10">
                          ₹{Number(item.price || 0).toFixed(2)}
                        </td>
                        {/* Wholesale Price (₹/Kg) */}
                        <td className="px-3 md:px-4 py-2.5 font-black text-amber-800 dark:text-amber-400 whitespace-nowrap text-sm bg-amber-50/20 dark:bg-amber-950/10">
                          ₹{Number(item.wholesalePricePerKg || item.price || 0).toFixed(2)}
                        </td>
                        {/* Export Price (₹/Kg) */}
                        <td className="px-3 md:px-4 py-2.5 font-black text-blue-800 dark:text-blue-400 whitespace-nowrap text-sm bg-blue-50/20 dark:bg-blue-950/10">
                          ₹{Number(item.exportPricePerKg || item.wholesalePricePerKg || item.price || 0).toFixed(2)}
                        </td>
                        {/* Size Grades & Availability */}
                        <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {/* Small */}
                            <span 
                              title={`Small: ${item.sizeGrades?.small?.minKg ?? 0}-${item.sizeGrades?.small?.maxKg ?? 1} Kg (${item.sizeGrades?.small?.enabled !== false ? 'Available' : 'Unavailable'})`}
                              className={`px-2 py-0.5 rounded text-[11px] font-black border transition-colors ${
                                item.sizeGrades?.small?.enabled !== false 
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700' 
                                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              }`}
                            >
                              S
                            </span>

                            {/* Medium */}
                            <span 
                              title={`Medium: ${item.sizeGrades?.medium?.minKg ?? 1}-${item.sizeGrades?.medium?.maxKg ?? 4} Kg (${item.sizeGrades?.medium?.enabled !== false ? 'Available' : 'Unavailable'})`}
                              className={`px-2 py-0.5 rounded text-[11px] font-black border transition-colors ${
                                item.sizeGrades?.medium?.enabled !== false 
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700' 
                                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              }`}
                            >
                              M
                            </span>

                            {/* Big */}
                            <span 
                              title={`Big: ${item.sizeGrades?.big?.minKg ?? 4}+ Kg (${item.sizeGrades?.big?.enabled !== false ? 'Available' : 'Unavailable'})`}
                              className={`px-2 py-0.5 rounded text-[11px] font-black border transition-colors ${
                                item.sizeGrades?.big?.enabled !== false 
                                  ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700' 
                                  : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                              }`}
                            >
                              B
                            </span>
                          </div>
                        </td>
                        {/* Stock */}
                        <td className="px-3 md:px-4 py-2.5 whitespace-nowrap">
                          <span className={`text-xs font-black ${Number(item.stock ?? item.openingStock ?? 0) <= 10 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                            {item.stock ?? item.openingStock ?? 0} {item.sellingUnit || 'Kg'}
                          </span>
                        </td>
                        <td className="px-3 md:px-4 py-2 md:py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1.5 items-center">
                            <button
                              onClick={() => handleToggleAvailability(item)}
                              title={item.isAvailable ? t("Mark Unavailable") : t("Mark Available")}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 ${item.isAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${item.isAvailable ? 'translate-x-4.5' : 'translate-x-1'}`} />
                            </button>
                            <button
                              onClick={() => handleOpenModal(item, true)}
                              className="p-1 hover:bg-background rounded-lg text-primary transition-colors"
                              title={t("View Details")}
                            >
                              <Eye size={15} />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleOpenModal(item, false)}
                                  className="p-1 hover:bg-background rounded-lg text-primary transition-colors cursor-pointer"
                                  title={t("Edit Item")}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(item._id)}
                                  className="p-1 hover:bg-background rounded-lg text-danger transition-colors cursor-pointer"
                                  title={t("Delete Item")}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-background sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Name")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Description")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Sort Order")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border">{t("Status")}</th>
                    <th className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {paginatedCategories.map((category) => (
                    <tr key={category._id} className="hover:bg-surface-hover transition-colors group">
                      <td className="px-3 py-2 font-semibold text-text-main whitespace-nowrap">{category.name}</td>
                      <td className="px-3 py-2 text-text-muted max-w-[200px] truncate">{category.description || '-'}</td>
                      <td className="px-3 py-2 text-text-muted whitespace-nowrap">{category.sortOrder}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${category.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenCategoryModal(category, true)}
                            className="p-1 hover:bg-background rounded-lg text-primary transition-colors" title={t("View Details")}>
                            <Eye size={15} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenCategoryModal(category, false)}
                                className="p-1 hover:bg-background rounded-lg text-primary transition-colors cursor-pointer" title={t("Edit Category")}>
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategoryClick(category._id)}
                                className="p-1 hover:bg-background rounded-lg text-danger transition-colors cursor-pointer" title={t("Delete Category")}>
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination Controls - Visible on desktop, mobile uses compact top toolbar pagination */}
        {(activeTab === 'items' && itemsTotalPages > 1 || activeTab === 'categories' && categoriesTotalPages > 1) && (
          <div className="hidden md:flex p-3 border-t border-border items-center justify-between bg-background text-xs">
            <div className="text-text-muted font-medium">
              {t("Showing")}{' '}
              {activeTab === 'items' ? itemsStartIndex + 1 : categoriesStartIndex + 1} {t("to")}{' '}
              {activeTab === 'items'
                ? Math.min(itemsEndIndex, filteredItems.length)
                : Math.min(categoriesEndIndex, filteredCategories.length)
              } {t("of")}{' '}
              {activeTab === 'items' ? filteredItems.length : filteredCategories.length}{' '}
              {activeTab === 'items' ? t('items') : t('categories')}
            </div>
            <div className="flex items-center gap-2">
              <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors">
              
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)].map((_, i) => {
                const page = i + 1;
                const totalPages = activeTab === 'items' ? itemsTotalPages : categoriesTotalPages;
                if (
                page === 1 ||
                page === totalPages ||
                page >= currentPage - 1 && page <= currentPage + 1)
                {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${currentPage === page ?
                      'bg-primary text-white' :
                      'bg-surface text-text-muted hover:bg-surface-hover hover:text-text-main border border-border'}`
                      }>
                      
                        {page}
                      </button>);

                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-text-muted">...</span>;
                }
                return null;
              })}
              </div>
              <button
              onClick={() => setCurrentPage((prev) => Math.min(activeTab === 'items' ? itemsTotalPages : categoriesTotalPages, prev + 1))}
              disabled={currentPage === (activeTab === 'items' ? itemsTotalPages : categoriesTotalPages)}
              className="p-2 rounded-lg border border-border bg-surface text-text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-hover transition-colors">
              
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Product Overview Modal (View Mode) */}
      {isModalOpen && isViewMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-border bg-background/50">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-primary/10 text-primary rounded-lg">
                  
                </span>
                <h2 className="text-sm sm:text-base font-bold text-text-main">
                  {t("Product Overview")}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body - Structured & Compact without scrolling */}
            <div className="p-3.5 space-y-2.5">
              {/* Visual Hero Showcase */}
              <div className="relative w-full h-48 sm:h-56 rounded-xl overflow-hidden bg-background border border-border flex items-center justify-center shadow-inner group">
                {formatImageUrl(formData.image || currentItem?.image) ? (
                  <img
                    src={formatImageUrl(formData.image || currentItem?.image)}
                    alt={formData.name || currentItem?.name}
                    loading="lazy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1 text-primary/80">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center font-black text-xl">
                      {(formData.name || currentItem?.name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[10px] text-text-muted font-medium">{t("No image uploaded")}</span>
                  </div>
                )}

                {/* Overlays on Image */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/30 pointer-events-none" />

                {/* Top Badges */}
                <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md bg-sky-600/90 text-white">
                    {formData.category || currentItem?.category?.name || currentItem?.category || 'Fish'}
                  </span>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${
                    (formData.isAvailable ?? currentItem?.isAvailable ?? true)
                      ? 'bg-emerald-600/90 text-white'
                      : 'bg-red-600/90 text-white'
                  }`}>
                    {(formData.isAvailable ?? currentItem?.isAvailable ?? true) ? t('Available') : t('Unavailable')}
                  </span>
                </div>

                {/* Bottom Overlay Title & Price */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between text-white">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-sm sm:text-base font-bold truncate leading-tight drop-shadow-md">
                      {formData.name || currentItem?.name}
                    </h3>
                    <p className="text-[11px] text-white/80 font-medium truncate">
                      {formData.category || currentItem?.category?.name || currentItem?.category || t('General')}
                    </p>
                  </div>
                  <div className="text-right shrink-0 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/20 shadow-sm">
                    {currentItem?.sweetConfig?.enabled ? (
                      <span className="text-xs sm:text-sm font-black text-amber-300">
                        ₹{parseFloat(currentItem.sweetConfig.pricePerKg || 0).toFixed(2)}<span className="text-[10px] text-amber-300/80">/Kg</span>
                      </span>
                    ) : (
                      <span className="text-xs sm:text-sm font-black text-amber-300">
                        ₹{parseFloat(formData.price || currentItem?.price || 0).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Information Grid: Compact Stat Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Water Environment */}
                <div className="bg-background p-2 rounded-xl border border-border flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-bold">Water Type</span>
                  <span className="text-xs font-black text-sky-800 dark:text-sky-300 mt-0.5">
                    {currentItem?.waterType === 'sea_water' ? 'Sea Water' : 'Fresh Water'}
                  </span>
                </div>

                {/* Seafood Species */}
                <div className="bg-background p-2 rounded-xl border border-border flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-bold">Species</span>
                  <span className="text-xs font-black text-amber-800 dark:text-amber-300 capitalize mt-0.5">
                    {currentItem?.speciesType || 'Fish'}
                  </span>
                </div>

                {/* Wholesale Rate */}
                <div className="bg-background p-2 rounded-xl border border-amber-300/40 flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-bold">Wholesale Rate</span>
                  <span className="text-xs font-black text-amber-800 dark:text-amber-400 mt-0.5">
                    ₹{parseFloat(currentItem?.wholesalePricePerKg || currentItem?.price || 0).toFixed(2)} / Kg
                  </span>
                </div>

                {/* Export Rate */}
                <div className="bg-background p-2 rounded-xl border border-blue-300/40 flex flex-col justify-center shadow-2xs">
                  <span className="text-[10px] text-text-muted font-bold">Export Rate</span>
                  <span className="text-xs font-black text-blue-800 dark:text-blue-400 mt-0.5">
                    ₹{parseFloat(currentItem?.exportPricePerKg || currentItem?.wholesalePricePerKg || currentItem?.price || 0).toFixed(2)} / Kg
                  </span>
                </div>
              </div>

              {/* Description (if available) */}
              {(formData.description || currentItem?.description) && (
                <div className="bg-background p-2 rounded-xl border border-border">
                  <span className="text-[10px] text-text-muted font-semibold block mb-0.5">
                    {t("Description")}
                  </span>
                  <p className="text-xs text-text-main line-clamp-2 italic">
                    "{formData.description || currentItem?.description}"
                  </p>
                </div>
              )}

              {/* Raw Materials Recipe (if available) */}
              {(() => {
                const recipeList = formData.recipe?.length ? formData.recipe : (currentItem?.recipe || []);
                // Filter only entries that have a meaningful ingredient reference
                const visibleRecipe = recipeList.filter(r => {
                  if (!r) return false;
                  // Inventory-linked (could be populated object or just id string)
                  if (r.ingredientId) return true;
                  // Custom-name ingredient
                  if (r.customName) return true;
                  return false;
                });
                if (visibleRecipe.length === 0) return null;
                return (
                  <div className="bg-background p-2 rounded-xl border border-border">
                    <span className="text-[10px] text-text-muted font-semibold block mb-1">
                      {t("Recipe Ingredients")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {visibleRecipe.map((r, idx) => {
                        // Handle populated object (DB returns { _id, name, unit }) or plain id string
                        const populated = typeof r.ingredientId === 'object' && r.ingredientId !== null && r.ingredientId.name;
                        let label;
                        if (populated) {
                          label = `${r.ingredientId.name} (${r.quantityRequired} ${r.ingredientId.unit || 'unit'})`;
                        } else {
                          const inv = inventoryItems.find(i => i._id === r.ingredientId);
                          label = inv
                            ? `${inv.name} (${r.quantityRequired} ${inv.unit})`
                            : r.customName
                              ? `${r.customName} (${r.quantityRequired} ${r.unit || 'qty'})`
                              : null;
                        }
                        if (!label) return null;
                        return (
                          <span key={idx} className="bg-surface px-1.5 py-0.5 rounded-md border border-border text-[10px] text-text-muted font-medium">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-2.5 sm:p-3 border-t border-border bg-background/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const item = currentItem;
                    if (!item?._id) return;
                    const newVal = !(formData.isAvailable ?? item.isAvailable ?? true);
                    // Optimistic update — both form state and currentItem
                    setFormData(prev => ({ ...prev, isAvailable: newVal }));
                    setCurrentItem(prev => ({ ...prev, isAvailable: newVal }));
                    try {
                      await updateMenuItem(item._id, { isAvailable: newVal });
                      setItems(prev => prev.map(i => i._id === item._id ? { ...i, isAvailable: newVal } : i));
                      setToast({ message: `"${item.name}" marked as ${newVal ? 'Available' : 'Unavailable'}`, type: 'success' });
                    } catch (err) {
                      // Revert on failure
                      setFormData(prev => ({ ...prev, isAvailable: !newVal }));
                      setCurrentItem(prev => ({ ...prev, isAvailable: !newVal }));
                      setToast({ message: 'Failed to update availability', type: 'error' });
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border shadow-2xs cursor-pointer ${
                    (formData.isAvailable ?? currentItem?.isAvailable ?? true)
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    (formData.isAvailable ?? currentItem?.isAvailable ?? true) ? 'bg-emerald-500' : 'bg-red-500'
                  }`} />
                  <span>{(formData.isAvailable ?? currentItem?.isAvailable ?? true) ? t("Available") : t("Unavailable")}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <button
                    onClick={() => setIsViewMode(false)}
                    className="flex items-center gap-1 bg-primary text-white px-3 py-1 rounded-xl hover:bg-primary-hover transition-colors text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Edit2 size={12} />
                    <span>{t("Edit Item")}</span>
                  </button>
                )}
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1 bg-surface text-text-main border border-border hover:bg-surface-hover rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Add Item Form Modal */}
      {isModalOpen && !isViewMode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[99999] p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[94vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-4 py-2.5 border-b border-border bg-[#FAF6F0] dark:bg-slate-900 rounded-t-2xl shrink-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                {currentItem ? t('Edit Item') : t('Add New Item')}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-main transition-colors cursor-pointer p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-2.5 overflow-y-auto custom-scrollbar flex-1">
              {/* 1. Fish Name * & 2. Scientific Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-200">{t("Fish Name")} *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value });
                      if (validationErrors.name) setValidationErrors({ ...validationErrors, name: null });
                    }}
                    className={`w-full bg-background border rounded-lg px-2.5 py-1.5 text-xs text-text-main font-bold focus:outline-none focus:border-primary ${validationErrors.name ? 'border-danger' : 'border-border'}`}
                    placeholder={t("e.g. Silver Pomfret, Vanjaram")}
                  />
                  {validationErrors.name && (
                    <p className="text-[10px] text-danger">{validationErrors.name}</p>
                  )}
                </div>

                <div className="space-y-0.5">
                  <label className="text-[11px] sm:text-xs font-semibold text-text-muted">{t("Scientific Name")}</label>
                  <input
                    type="text"
                    value={formData.scientificName}
                    onChange={(e) => setFormData({ ...formData, scientificName: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-main italic focus:outline-none focus:border-primary"
                    placeholder={t("e.g. Pampus argenteus")}
                  />
                </div>
              </div>

              {/* 3. Item Image (Optional) */}
              <div className="space-y-0.5">
                <label className="text-[11px] sm:text-xs font-semibold text-text-muted">{t("Item Image (Optional)")} <span className="text-[10px] text-text-muted">(Max 5MB)</span></label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: formatImageUrl(e.target.value) })}
                    className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary"
                    placeholder={t("Paste image URL or upload image file...")}
                  />
                  <label className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0 transition-colors shadow-2xs">
                    <span>{t("Upload")}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            setToast({ message: t("Image size should be less than or equal to 5MB"), type: 'error' });
                            e.target.value = '';
                            return;
                          }
                          const extension = file.name.split('.').pop();
                          const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
                          setUploadFileInfo({
                            name: file.name,
                            extension: extension,
                            size: `${sizeInMb} MB`
                          });

                          const reader = new FileReader();
                          reader.onloadend = (event) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const MAX_WIDTH = 400;
                              const MAX_HEIGHT = 400;
                              let width = img.width;
                              let height = img.height;
                              if (width > height) {
                                if (width > MAX_WIDTH) {
                                  height = Math.round(height * MAX_WIDTH / width);
                                  width = MAX_WIDTH;
                                }
                              } else {
                                if (height > MAX_HEIGHT) {
                                  width = Math.round(width * MAX_HEIGHT / height);
                                  height = MAX_HEIGHT;
                                }
                              }
                              canvas.width = width;
                              canvas.height = height;
                              const ctx = canvas.getContext('2d');
                              ctx.drawImage(img, 0, 0, width, height);
                              const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
                              setFormData({ ...formData, image: compressedDataUrl });
                            };
                            img.src = event.target.result;
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {formatImageUrl(formData.image) && (
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0 bg-background group">
                      <img src={formatImageUrl(formData.image)} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setUploadFileInfo(null); setFormData({ ...formData, image: '' }); }}
                        className="absolute inset-0 bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t("Remove image")}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Water Environment & 5. Seafood Species & Selling Unit */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#FAF6F0] dark:bg-slate-900/60 p-2.5 rounded-xl border border-border">
                <div className="space-y-0.5">
                  <label className="text-[11px] font-black text-slate-800 dark:text-slate-200">{t("Water Environment")}</label>
                  <select
                    value={formData.waterType || 'sea_water'}
                    onChange={(e) => setFormData({ ...formData, waterType: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="sea_water">Sea Water (Marine)</option>
                    <option value="fresh_water">Fresh Water (River)</option>
                    <option value="all">All / General</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[11px] font-black text-slate-800 dark:text-slate-200">{t("Seafood Species")}</label>
                  <select
                    value={formData.speciesType || 'fish'}
                    onChange={(e) => setFormData({ ...formData, speciesType: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="fish">Fish (Fish Varieties)</option>
                    <option value="prawn">Prawns & Shrimps</option>
                    <option value="crab">Crabs & Shellfish</option>
                    <option value="other">Other Seafood</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[11px] font-black text-slate-800 dark:text-slate-200">{t("Selling Unit")} *</label>
                  <select
                    value={formData.sellingUnit || 'Kg'}
                    onChange={(e) => setFormData({ ...formData, sellingUnit: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-white font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="Kg">Kg (Per Kilogram)</option>
                    <option value="Piece">Piece (Count)</option>
                  </select>
                </div>
              </div>

              {/* 6. Retail (₹/Kg) *, 7. Wholesale (₹/Kg), 8. Export (₹/Kg) */}
              <div className="bg-amber-50/40 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{t("Standard Selling Rates (₹ / Kg)")}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{t("Base rates per sale mode")}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-black text-emerald-800 dark:text-emerald-400 block">{t("Retail (₹/Kg)")} *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      value={formData.price}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || parseFloat(v) >= 0) {
                          setFormData({ ...formData, price: v });
                          if (validationErrors.price) setValidationErrors({ ...validationErrors, price: null });
                        }
                      }}
                      className={`w-full bg-white dark:bg-slate-800 border rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-950 dark:text-emerald-200 focus:outline-none focus:border-emerald-600 ${validationErrors.price ? 'border-danger' : 'border-emerald-300 dark:border-emerald-700'}`}
                      placeholder="e.g. 700"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[11px] font-black text-amber-800 dark:text-amber-400 block">{t("Wholesale (₹/Kg)")}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      value={formData.wholesalePricePerKg}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || parseFloat(v) >= 0) {
                          setFormData({ ...formData, wholesalePricePerKg: v });
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-xs font-black text-amber-950 dark:text-amber-200 focus:outline-none focus:border-amber-600"
                      placeholder={formData.price || 'Wholesale rate'}
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[11px] font-black text-blue-800 dark:text-blue-400 block">{t("Export (₹/Kg)")}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      value={formData.exportPricePerKg}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || parseFloat(v) >= 0) {
                          setFormData({ ...formData, exportPricePerKg: v });
                        }
                      }}
                      className="w-full bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs font-black text-blue-950 dark:text-blue-200 focus:outline-none focus:border-blue-600"
                      placeholder={formData.wholesalePricePerKg || formData.price || 'Export rate'}
                    />
                  </div>
                </div>
              </div>

              {/* 9. Description */}
              <div className="space-y-0.5">
                <label className="text-[11px] sm:text-xs font-semibold text-text-muted">{t("Description")}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-primary h-14 resize-none"
                  placeholder={t("Brief fish description...")}
                />
              </div>

              {/* 10. Fish Size Grading (Small, Medium, Big) with Grade Prices, Unit Toggle & Cutting Charges */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-slate-900 dark:text-white">{t("Size Grades & Availability")}</span>
                  <span className="text-[10px] text-slate-500">{t("Set weight ranges, prices and availability")}</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {/* Reusable Grade Row */}
                  {[
                    { key: 'small', label: 'Small', borderColor: 'amber', badgeBg: 'amber', defaultMin: 0, defaultMax: 1 },
                    { key: 'medium', label: 'Medium', borderColor: 'blue', badgeBg: 'blue', defaultMin: 1, defaultMax: 4 },
                    { key: 'big', label: 'Big', borderColor: 'blue', badgeBg: 'blue', defaultMin: 4, defaultMax: 99 }
                  ].map(grade => {
                    const gradeData = formData.sizeGrades?.[grade.key] || {};
                    const isOn = gradeData.enabled !== false;
                    const currentUnit = gradeData.unit || 'kg';
                    return (
                      <div key={grade.key} className={`p-2 rounded-lg border transition-all ${
                        isOn ? `bg-white dark:bg-slate-800 border-${grade.borderColor}-300 dark:border-${grade.borderColor}-700 shadow-2xs` : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60'
                      }`}>
                        {/* Row 1: Grade name, weight range, unit toggle, ON/OFF */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-[70px]">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-100">{grade.label}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                              isOn ? `bg-${grade.badgeBg}-100 text-${grade.badgeBg}-900 dark:bg-${grade.badgeBg}-950 dark:text-${grade.badgeBg}-200` : 'bg-slate-200 text-slate-500'
                            }`}>
                              {isOn ? 'Active' : 'Off'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <span className="text-[10px] font-medium text-slate-400">From</span>
                            <input
                              type="number" min="0" step="0.1"
                              onWheel={(e) => e.target.blur()}
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                              disabled={!isOn}
                              value={gradeData.minKg ?? grade.defaultMin}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '' || parseFloat(v) >= 0) {
                                  setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, minKg: v } } });
                                }
                              }}
                              className="w-14 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                            <span className="text-[10px] font-medium text-slate-400">to</span>
                            <input
                              type="number" min="0" step="0.1"
                              onWheel={(e) => e.target.blur()}
                              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                              disabled={!isOn}
                              value={gradeData.maxKg ?? grade.defaultMax}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '' || parseFloat(v) >= 0) {
                                  setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, maxKg: v } } });
                                }
                              }}
                              className="w-14 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                            />
                            {/* Unit Toggle: Kg / g */}
                            <button
                              type="button"
                              disabled={!isOn}
                              onClick={() => setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, unit: currentUnit === 'kg' ? 'g' : 'kg' } } })}
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full border transition-all cursor-pointer disabled:opacity-50 ${
                                currentUnit === 'kg' ? 'bg-slate-800 text-white border-slate-800' : 'bg-amber-100 text-amber-900 border-amber-400'
                              }`}
                            >
                              {currentUnit === 'kg' ? 'Kg' : 'g'}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, enabled: !isOn } } })}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${isOn ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${isOn ? 'translate-x-4.5' : 'translate-x-1'}`} />
                          </button>
                        </div>

                        {/* Row 2: Grade-specific prices (only shown when expanded/active) */}
                        {isOn && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700 grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Retail ₹/{currentUnit === 'kg' ? 'Kg' : 'g'}</label>
                              <input
                                type="number" min="0" step="1"
                                onWheel={(e) => e.target.blur()}
                                placeholder={formData.price || '0'}
                                value={gradeData.price ?? ''}
                                onChange={(e) => setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, price: e.target.value } } })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Wholesale</label>
                              <input
                                type="number" min="0" step="1"
                                onWheel={(e) => e.target.blur()}
                                placeholder={formData.wholesalePricePerKg || '0'}
                                value={gradeData.wholesalePrice ?? ''}
                                onChange={(e) => setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, wholesalePrice: e.target.value } } })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 block mb-0.5">Export</label>
                              <input
                                type="number" min="0" step="1"
                                onWheel={(e) => e.target.blur()}
                                placeholder={formData.exportPricePerKg || '0'}
                                value={gradeData.exportPrice ?? ''}
                                onChange={(e) => setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [grade.key]: { ...gradeData, exportPrice: e.target.value } } })}
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 10b. Custom Cutting Charges per Item */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{t("Custom Cutting Charges")}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${formData.customCuttingChargeEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                      {formData.customCuttingChargeEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, customCuttingChargeEnabled: !formData.customCuttingChargeEnabled })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none ${formData.customCuttingChargeEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs ${formData.customCuttingChargeEnabled ? 'translate-x-4.5' : 'translate-x-1'}`} />
                  </button>
                </div>
                {formData.customCuttingChargeEnabled && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-600 min-w-[80px]">{t("Base Cutting ₹")}</label>
                      <input
                        type="number" min="0" step="1"
                        onWheel={(e) => e.target.blur()}
                        placeholder="0"
                        value={formData.cuttingCharge ?? ''}
                        onChange={(e) => setFormData({ ...formData, cuttingCharge: e.target.value })}
                        className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[10px] text-slate-400">{t("per step")}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['small', 'medium', 'big'].map(gk => {
                        const gd = formData.sizeGrades?.[gk] || {};
                        if (gd.enabled === false) return null;
                        return (
                          <div key={gk} className="bg-white dark:bg-slate-800 rounded-lg p-1.5 border border-slate-200 dark:border-slate-700">
                            <label className="text-[9px] font-bold text-slate-500 block mb-0.5 capitalize">{gk} ₹</label>
                            <input
                              type="number" min="0" step="1"
                              onWheel={(e) => e.target.blur()}
                              placeholder={formData.cuttingCharge || '0'}
                              value={gd.cuttingCharge ?? ''}
                              onChange={(e) => setFormData({ ...formData, sizeGrades: { ...formData.sizeGrades, [gk]: { ...gd, cuttingCharge: e.target.value } } })}
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-center font-bold text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 11. Variants / Variety */}
              <div className="space-y-1.5 border-t border-border pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-200">
                    {t("Variants / Variety")} <span className="text-[10px] text-text-muted font-normal">(e.g. Tiger, Red Prawn, Vannamei)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, variants: [...(formData.variants || []), { name: '', price: '' }] })}
                    className="text-xs text-primary font-bold hover:underline cursor-pointer"
                  >
                    + Add Variant
                  </button>
                </div>
                {(formData.variants || []).map((variant, vIdx) => (
                  <div key={vIdx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Variant name (e.g. Tiger, Red Prawn)"
                      value={variant.name}
                      onChange={(e) => {
                        const newVariants = [...formData.variants];
                        newVariants[vIdx] = { ...newVariants[vIdx], name: e.target.value };
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-primary"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      placeholder="Price ₹/Kg"
                      value={variant.price}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || parseFloat(v) >= 0) {
                          const newVariants = [...formData.variants];
                          newVariants[vIdx] = { ...newVariants[vIdx], price: v };
                          setFormData({ ...formData, variants: newVariants });
                        }
                      }}
                      className="w-24 bg-background border border-border rounded-lg px-2.5 py-1 text-xs text-text-main focus:outline-none focus:border-primary font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, variants: formData.variants.filter((_, i) => i !== vIdx) })}
                      className="text-danger p-1 cursor-pointer shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingItem}
                  className="w-full bg-primary text-white py-2 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-md shadow-primary/20 text-xs sm:text-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmittingItem ? (
                    <>
                      <Loader2 size={15} className="animate-spin shrink-0" />
                      <span>{currentItem ? t('Updating Item...') : t('Creating Item...')}</span>
                    </>
                  ) : (
                    <span>{currentItem ? t('Update Item') : t('Create Item')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen &&
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold text-text-main">
                {isCategoryViewMode ? 'View Category' : currentCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="text-text-muted hover:text-text-main transition-colors">
              
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">{t("Category Name")}</label>
                <input
                type="text"
                required
                value={categoryFormData.name}
                onChange={(e) => {
                  setCategoryFormData({ ...categoryFormData, name: e.target.value });
                  if (validationErrors.name) setValidationErrors({ ...validationErrors, name: null });
                }}
                className={`w-full bg-background border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary ${validationErrors.name ? 'border-danger' : 'border-border'}`
                } placeholder={t("e.g. Main Course")} />

              
                {validationErrors.name &&
              <p className="text-xs text-danger">{validationErrors.name}</p>
              }
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">{t("Description")}</label>
                <textarea
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary h-24 resize-none" placeholder={t("Category description...")} />

              
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-text-muted">{t("Sort Order")}</label>
                <input
                type="number"
                value={categoryFormData.sortOrder}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, sortOrder: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-4 py-2 text-text-main focus:outline-none focus:border-primary"
                placeholder="0" />
              
              </div>

              {!isCategoryViewMode &&
            <div className="pt-4">
                  <button
                type="submit"
                disabled={isSubmittingCategory}
                className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:bg-accent transition-all shadow-lg shadow-secondary/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                
                    {isSubmittingCategory ? (
                      <>
                        <Loader2 size={16} className="animate-spin shrink-0" />
                        <span>{currentCategory ? t('Updating Category...') : t('Creating Category...')}</span>
                      </>
                    ) : (
                      <span>{currentCategory ? t('Update Category') : t('Create Category')}</span>
                    )}
                  </button>
                </div>
            }
            </form>
          </div>
        </div>
      }

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, itemId: null, categoryId: null, deleteAll: false })}
        onConfirm={confirmDelete}
        title={deleteModal.deleteAll ? "Delete All Items" : deleteModal.itemId ? "Delete Item" : "Delete Category"}
        message={deleteModal.deleteAll ? "Are you sure you want to delete ALL menu items? This action cannot be undone and will empty your entire menu." : `Are you sure you want to delete this ${deleteModal.itemId ? 'menu item' : 'category'}? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true} />

      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onImportSuccess={handleBulkImportItems} />
      

      {toast &&
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)} />

      }
    </div>);

};

export default MenuManagement;