import api from '../system/axios';

export const getOperationsSummary = async (startDate, endDate) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const res = await api.get('/operations/summary', { params });
  return res.data?.data || null;
};

export const getSuppliers = async (search = '', type = '') => {
  const params = {};
  if (search) params.search = search;
  if (type) params.type = type;
  const res = await api.get('/operations/suppliers', { params });
  return res.data?.data || [];
};

export const createSupplier = async (data) => {
  const res = await api.post('/operations/suppliers', data);
  return res.data?.data || null;
};

export const updateSupplier = async (id, data) => {
  const res = await api.put(`/operations/suppliers/${id}`, data);
  return res.data?.data || null;
};

export const deleteSupplier = async (id) => {
  const res = await api.delete(`/operations/suppliers/${id}`);
  return res.data || null;
};
