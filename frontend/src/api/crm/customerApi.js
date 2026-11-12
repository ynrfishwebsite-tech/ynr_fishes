import api from '../system/axios';

const CRM_CACHE_KEY = 'resto_crm_cache';

/**
 * Save a single customer object to local CRM cache immediately
 * and dispatch window event so all open components synchronize instantly
 */
export const saveCustomerToCache = (newCustomer) => {
  if (!newCustomer || !newCustomer.phone) return;
  try {
    const cleanPhone = String(newCustomer.phone).replace(/\D/g, '').slice(-10);
    const raw = localStorage.getItem(CRM_CACHE_KEY);
    let list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (e) { list = []; }
    }
    if (!Array.isArray(list)) list = [];

    const idx = list.findIndex(c => {
      const p = String(c?.phone || '').replace(/\D/g, '').slice(-10);
      return p === cleanPhone;
    });

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...newCustomer };
    } else {
      list.unshift(newCustomer);
    }

    localStorage.setItem(CRM_CACHE_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('customersUpdated', { detail: newCustomer }));
    }
  } catch (e) {
    console.warn('Failed to save customer to cache:', e);
  }
};

/**
 * Remove a deleted customer from local CRM cache immediately
 * and dispatch window event so open views stay synchronized
 */
export const removeCustomerFromCache = (phone) => {
  if (!phone) return;
  try {
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const raw = localStorage.getItem(CRM_CACHE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter(c => {
          const p = String(c?.phone || '').replace(/\D/g, '').slice(-10);
          return p !== cleanPhone && String(c?.phone || '') !== String(phone);
        });
        localStorage.setItem(CRM_CACHE_KEY, JSON.stringify(filtered));
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('customersUpdated', { detail: { deletedPhone: cleanPhone } }));
    }
  } catch (e) {
    console.warn('Failed to remove customer from cache:', e);
  }
};

/**
 * Permanently delete a CRM customer/dealer/client by phone
 */
export const deleteCustomer = async (phone) => {
  const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10) || String(phone || '').trim();
  const res = await api.delete(`/customers/${encodeURIComponent(cleanPhone)}`);
  removeCustomerFromCache(cleanPhone);
  return res.data;
};

/**
 * Merge an array of customers into local CRM cache by clean phone
 */
export const updateAllCustomersCache = (incomingList) => {
  if (!Array.isArray(incomingList)) return;
  try {
    const raw = localStorage.getItem(CRM_CACHE_KEY);
    let existingList = [];
    if (raw) {
      try { existingList = JSON.parse(raw); } catch (e) { existingList = []; }
    }
    if (!Array.isArray(existingList)) existingList = [];

    const map = new Map();
    // Pre-populate with existing cache
    existingList.forEach(c => {
      if (c && c.phone) {
        const clean = String(c.phone).replace(/\D/g, '').slice(-10);
        if (clean) map.set(clean, c);
      }
    });

    // Merge incoming server records
    incomingList.forEach(c => {
      if (c && c.phone) {
        const clean = String(c.phone).replace(/\D/g, '').slice(-10);
        if (clean) {
          const prev = map.get(clean) || {};
          map.set(clean, { ...prev, ...c });
        }
      }
    });

    const merged = Array.from(map.values());
    localStorage.setItem(CRM_CACHE_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('Failed to update all customers cache:', e);
  }
};

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
      if (!c) return false;
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
 * Fetch customers from server with instant cache fallback and persistent cache sync
 */
export const fetchPredefinedCustomers = async (category = 'All', exportSubCategory = 'All', forceRefresh = false) => {
  try {
    const params = {};
    if (category !== 'All') params.category = category;
    if (exportSubCategory !== 'All') params.exportSubCategory = exportSubCategory;

    const res = await api.get('/customers', { params });
    const customers = res.data || [];

    if (Array.isArray(customers)) {
      updateAllCustomersCache(customers);
      if (category === 'All' && exportSubCategory === 'All') {
        localStorage.setItem(CRM_CACHE_KEY, JSON.stringify(customers));
      }
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
