import api from '../system/axios';

const CRM_CACHE_KEY = 'resto_crm_cache';

/**
 * Get customers from local cache, optionally filtered by category
 */
export const getCachedCustomers = (category = 'All', exportSubCategory = 'All') => {
  try {
    const raw = localStorage.getItem(CRM_CACHE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];

    return list.filter(c => {
      if (category === 'All') return true;
      const cat = c.category || (c.lastOrderType === 'Wholesale' ? 'Wholesale' : (c.lastOrderType === 'Export' ? 'Export' : 'Retail'));
      if (cat !== category) return false;

      if (category === 'Export' && exportSubCategory !== 'All') {
        const sub = c.exportSubCategory || 'Local';
        return sub === exportSubCategory;
      }
      return true;
    });
  } catch (e) {
    console.warn('Failed to read CRM cache:', e);
    return [];
  }
};

/**
 * Fetch all customers from server with cache fallback
 */
export const fetchPredefinedCustomers = async (category = 'All', exportSubCategory = 'All', forceRefresh = false) => {
  // If not forcing refresh, return instant cache if available
  if (!forceRefresh) {
    const cached = getCachedCustomers(category, exportSubCategory);
    if (cached.length > 0) return cached;
  }

  try {
    const params = {};
    if (category !== 'All') params.category = category;
    if (exportSubCategory !== 'All') params.exportSubCategory = exportSubCategory;

    const res = await api.get('/customers', { params });
    const customers = res.data || [];

    if (Array.isArray(customers) && category === 'All') {
      localStorage.setItem(CRM_CACHE_KEY, JSON.stringify(customers));
    }
    return customers;
  } catch (err) {
    console.error('Failed to fetch customers:', err);
    return getCachedCustomers(category, exportSubCategory);
  }
};

/**
 * Fast search predefined customers
 */
export const searchPredefinedCustomers = async (q, category = 'All', exportSubCategory = 'All') => {
  if (!q || !q.trim()) {
    return getCachedCustomers(category, exportSubCategory).slice(0, 15);
  }

  const query = q.trim().toLowerCase();
  const localMatches = getCachedCustomers(category, exportSubCategory).filter(c => {
    return (
      (c.phone && c.phone.includes(query)) ||
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.businessName && c.businessName.toLowerCase().includes(query))
    );
  });

  if (localMatches.length > 0) return localMatches.slice(0, 15);

  try {
    const res = await api.get('/customers/search', {
      params: { q: query, category, exportSubCategory }
    });
    return res.data || [];
  } catch (e) {
    return localMatches;
  }
};

