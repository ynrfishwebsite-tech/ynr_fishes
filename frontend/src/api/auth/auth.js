import api from '../system/axios';

export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const logoutUser = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const refreshAccessToken = async (refreshToken) => {
  const response = await api.post('/auth/refresh', { refreshToken });
  return response.data;
};

export const apiUpdateProfile = async (username) => {
  const response = await api.put('/auth/profile', { username });
  return response.data;
};

export const generateBiometricAuthOptions = async (identifier, targetType = 'user') => {
  const response = await api.post('/auth/biometric/auth-options', { identifier, targetType });
  return response.data;
};

export const verifyBiometricAuth = async (identifier, authenticationResponse, targetType = 'user', isLogin = true) => {
  const response = await api.post('/auth/biometric/auth-verify', {
    identifier,
    authenticationResponse,
    targetType,
    isLogin
  });
  return response.data;
};

export const generateBiometricRegOptions = async (targetUserId, targetType = 'user') => {
  const response = await api.post('/auth/biometric/register-options', { targetUserId, targetType });
  return response.data;
};

export const verifyBiometricReg = async (targetUserId, registrationResponse, deviceName, targetType = 'user') => {
  const response = await api.post('/auth/biometric/register-verify', {
    targetUserId,
    registrationResponse,
    deviceName,
    targetType
  });
  return response.data;
};

export const apiResetBiometrics = async (targetUserId, targetType = 'user') => {
  const response = await api.post('/auth/biometric/reset', { targetUserId, targetType });
  return response.data;
};

export const apiCheckBiometricStatus = async (username, targetType = 'user') => {
  const response = await api.get('/auth/biometric/status', { params: { username, targetType } });
  return response.data;
};
export const registerNativeBiometricToken = async (userId, targetType = "user") => { const response = await api.post("/auth/biometric/native-register", { userId, targetType }); return response.data; }; export const verifyNativeBiometricToken = async (username, nativeToken, targetType = "user") => { const response = await api.post("/auth/biometric/native-verify", { username, nativeToken, targetType }); return response.data; };
