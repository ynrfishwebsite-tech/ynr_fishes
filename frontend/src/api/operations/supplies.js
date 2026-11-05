import api from '../system/axios';

// Get all packaging and consumables categories
export const getSupplyCategories = async () => {
  const res = await api.get('/supplies/categories');
  return res.data?.data || [];
};

// Create a new custom supply category
export const createSupplyCategory = async (name, description = '') => {
  const res = await api.post('/supplies/categories', { name, description });
  return res.data?.data || null;
};

// Record supply intake
export const recordSupplyStockIn = async (data) => {
  const res = await api.post('/supplies/stock-in', data);
  return res.data || null;
};

// Get supply stock intake logs
export const getSupplyLogs = async (category = 'All', limit = 50) => {
  const res = await api.get('/supplies/logs', { params: { category, limit } });
  return res.data?.data || [];
};

