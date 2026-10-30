import api from '../system/axios';

export const getOperationsSummary = async (startDate, endDate) => {
  const params = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  const res = await api.get('/operations/summary', { params });
  return res.data?.data || null;
};

export const getOperationsList = async (operationType = 'All', limit = 50) => {
  const res = await api.get('/operations/list', { params: { operationType, limit } });
  return res.data?.data || [];
};

export const createOperationEntry = async (data) => {
  const res = await api.post('/operations/entry', data);
  return res.data?.data || null;
};

export const getSuppliers = async (search = '') => {
  const res = await api.get('/operations/suppliers', { params: { search } });
  return res.data?.data || [];
};

export const createSupplier = async (data) => {
  const res = await api.post('/operations/suppliers', data);
  return res.data?.data || null;
};
