import api from '../../../api/system/axios.js';

export const triggerNetworkKOT = async () => true;

export const triggerNetworkBill = async (payload) => {
  return await api.post('/orders/print', payload);
};
