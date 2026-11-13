import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { 
  Shield, Plus, Edit2, Trash2, Key, Eye, EyeOff, Fingerprint, RefreshCw, ArrowLeft,
  Truck, Building, Upload, Image as ImageIcon, Crop, User, Check, AlertTriangle
} from 'lucide-react';
import BackButton from '../common/BackButton';
import { getApiUrl } from '../../../config.js';
import ImageCropperModal from '../crm/ImageCropperModal';
import { getVehicles } from '../../../api/operations/vehicle';
import { getSuppliers } from '../../../api/operations/operations';

const AdminPanel = ({ onGoBack }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic roles & available pages from backend
  const [backendRoles, setBackendRoles] = useState([]);
  const [availablePages, setAvailablePages] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', isError: false });
  const [formData, setFormData] = useState({ 
    username: '', 
    name: '',
    phone: '',
    email: '',
    password: '', 
    role: 'cashier',
    profileImage: '',
    permittedPages: ['billing', 'active-orders', 'bill-history']
  });

  // Dynamic Driver & Supplier linking lists
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Image Cropper State for Staff Profile Photo
  const [uploadFileInfo, setUploadFileInfo] = useState(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperRawSrc, setCropperRawSrc] = useState(null);
  const [cropperPendingInfo, setCropperPendingInfo] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchRolesAndPages();
    fetchDrivers();
    fetchSuppliersList();
  }, []);

  const fetchDrivers = async () => {
    try {
      const vehList = await getVehicles();
      if (Array.isArray(vehList)) {
        const driversMap = new Map();
        vehList.forEach(v => {
          if (v.driverName && v.driverName.trim()) {
            const trimmed = v.driverName.trim();
            const key = trimmed.toLowerCase();
            if (!driversMap.has(key)) {
              driversMap.set(key, {
                id: v._id || trimmed,
                name: trimmed,
                phone: v.driverPhone || '',
                driverPhoto: v.driverPhoto || '',
                vehicleNumber: v.vehicleNumber || ''
              });
            }
          }
        });
        setAvailableDrivers(Array.from(driversMap.values()));
      }
    } catch (e) {
      console.warn('Could not fetch vehicles for drivers:', e);
    }
  };

  const fetchSuppliersList = async () => {
    try {
      const suppList = await getSuppliers();
      if (Array.isArray(suppList)) {
        setAvailableSuppliers(suppList);
      }
    } catch (e) {
      console.warn('Could not fetch suppliers:', e);
    }
  };

  const fetchRolesAndPages = async () => {
    try {
      const API_BASE_URL = getApiUrl();
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/roles-and-pages`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      if (response.data.success) {
        setBackendRoles(response.data.roles || []);
        setAvailablePages(response.data.availablePages || []);
      }
    } catch (err) {
      console.warn('Could not load backend roles-and-pages dynamically:', err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = getApiUrl();
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
        }
      });
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching users', error);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: error.response?.data?.message || 'Failed to fetch users. You might not have Admin privileges.',
        isError: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (newRole) => {
    const matchedRole = backendRoles.find(r => r.id === newRole);
    const defaultPages = matchedRole?.defaultPages || ['billing', 'active-orders', 'bill-history'];
    setSelectedDriverId('');
    setSelectedSupplierId('');
    setFormData(prev => ({
      ...prev,
      role: newRole,
      permittedPages: defaultPages
    }));

    if (newRole === 'driver') {
      fetchDrivers();
    } else if (newRole === 'supplier') {
      fetchSuppliersList();
    }
  };

  // Helper to check if a fleet driver already has an active user login
  const getDriverExistingUser = useCallback((driver) => {
    if (!driver || !users.length) return null;
    const cleanSlug = (driver.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);
    const generatedUsername = cleanSlug ? `driver_${cleanSlug}` : '';

    return users.find(u => {
      if (editingUser && u._id === editingUser._id) return false;
      // Match generated username
      if (generatedUsername && u.username?.toLowerCase() === generatedUsername.toLowerCase()) return true;
      // Match phone if available
      if (driver.phone && u.phone && u.phone.replace(/\D/g, '') === driver.phone.replace(/\D/g, '')) return true;
      // Match full name if role is driver
      if (driver.name && u.name && u.role === 'driver' && u.name.trim().toLowerCase() === driver.name.trim().toLowerCase()) return true;
      return false;
    }) || null;
  }, [users, editingUser]);

  // Helper to check if a directory supplier already has an active user login
  const getSupplierExistingUser = useCallback((supp) => {
    if (!supp || !users.length) return null;
    const cleanSlug = (supp.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);
    const generatedUsername = cleanSlug ? `supp_${cleanSlug}` : '';

    return users.find(u => {
      if (editingUser && u._id === editingUser._id) return false;
      // Match generated username
      if (generatedUsername && u.username?.toLowerCase() === generatedUsername.toLowerCase()) return true;
      // Match phone if available
      if (supp.phone && u.phone && u.phone.replace(/\D/g, '') === supp.phone.replace(/\D/g, '')) return true;
      // Match name if role is supplier
      if (supp.name && u.name && u.role === 'supplier' && u.name.trim().toLowerCase() === supp.name.trim().toLowerCase()) return true;
      return false;
    }) || null;
  }, [users, editingUser]);

  // Real-time duplicate username check across all current users
  const duplicateUser = useMemo(() => {
    const currentUsername = (formData.username || '').trim().toLowerCase();
    if (!currentUsername) return null;
    return users.find(u => {
      if (editingUser && u._id === editingUser._id) return false;
      return u.username?.toLowerCase() === currentUsername;
    }) || null;
  }, [formData.username, users, editingUser]);

  // Auto-fill Username and Profile details when selecting an existing Driver
  const handleDriverSelect = (driverKey) => {
    setSelectedDriverId(driverKey);
    const driver = availableDrivers.find(d => (d.id === driverKey || d.name === driverKey));
    if (!driver) return;

    // Check if this driver already has a user account
    const existingDriverUser = getDriverExistingUser(driver);

    // Generate clean username slug
    const cleanSlug = (driver.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);

    const generatedUsername = cleanSlug ? `driver_${cleanSlug}` : '';
    const generatedEmail = driver.phone ? `${cleanSlug || 'driver'}@driver.local` : '';

    setFormData(prev => ({
      ...prev,
      username: generatedUsername || prev.username,
      name: driver.name,
      phone: driver.phone || prev.phone,
      email: prev.email || generatedEmail,
      profileImage: driver.driverPhoto || prev.profileImage
    }));

    if (driver.driverPhoto) {
      setUploadFileInfo({
        name: `${driver.name} (Driver Photo)`,
        extension: 'img',
        size: 'Auto-linked'
      });
    }

    if (existingDriverUser) {
      setAlertDialog({
        isOpen: true,
        title: 'Driver Already Created',
        message: `This driver "${driver.name}" already has an active login account (Username: "${existingDriverUser.username}"). You cannot create a duplicate account for this driver.`,
        isError: true
      });
    }
  };

  // Auto-fill Username and Profile details when selecting an existing Supplier
  const handleSupplierSelect = (supplierId) => {
    setSelectedSupplierId(supplierId);
    const supp = availableSuppliers.find(s => s._id === supplierId);
    if (!supp) return;

    // Check if this supplier already has a user account
    const existingSuppUser = getSupplierExistingUser(supp);

    // Generate clean username slug
    const cleanSlug = (supp.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 20);

    const generatedUsername = cleanSlug ? `supp_${cleanSlug}` : '';
    const generatedEmail = supp.email || (cleanSlug ? `${cleanSlug}@supplier.local` : '');

    setFormData(prev => ({
      ...prev,
      username: generatedUsername || prev.username,
      name: supp.name,
      phone: supp.phone || prev.phone,
      email: prev.email || generatedEmail,
      profileImage: supp.profileImage || prev.profileImage
    }));

    if (supp.profileImage) {
      setUploadFileInfo({
        name: `${supp.name} (Supplier Photo)`,
        extension: 'img',
        size: 'Auto-linked'
      });
    }

    if (existingSuppUser) {
      setAlertDialog({
        isOpen: true,
        title: 'Supplier Already Created',
        message: `This supplier "${supp.name}" already has an active login account (Username: "${existingSuppUser.username}"). You cannot create a duplicate account for this supplier.`,
        isError: true
      });
    }
  };

  // Image Upload with <= 5MB validation & Image Cropper trigger
  const handleImageUpload = (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAlertDialog({
        isOpen: true,
        title: 'File Too Large',
        message: 'Image size must be less than or equal to 5MB',
        isError: true
      });
      return;
    }
    const extension = file.name.split('.').pop() || 'jpg';
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    const fileInfo = {
      name: file.name,
      extension: extension,
      size: `${sizeInMb} MB`
    };

    const reader = new FileReader();
    reader.onloadend = (event) => {
      setCropperRawSrc(event.target.result);
      setCropperPendingInfo(fileInfo);
      setIsCropperOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const togglePagePermission = (pageId) => {
    const current = [...(formData.permittedPages || [])];
    const exists = current.includes(pageId);
    let updated;
    if (exists) {
      updated = current.filter(p => p !== pageId);
    } else {
      updated = [...current, pageId];
    }
    setFormData({ ...formData, permittedPages: updated });
  };

  const selectAllPages = () => {
    const allIds = availablePages.map(p => p.id);
    setFormData({ ...formData, permittedPages: allIds });
  };

  const deselectAllPages = () => {
    setFormData({ ...formData, permittedPages: [] });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      // Client-side duplicate user validation
      if (!editingUser && duplicateUser) {
        setAlertDialog({
          isOpen: true,
          title: 'User Already Created',
          message: `This ${formData.role === 'driver' ? 'driver' : formData.role === 'supplier' ? 'supplier' : 'user'} username "${formData.username}" is already created in this branch. You cannot create a duplicate account.`,
          isError: true
        });
        return;
      }

      const API_BASE_URL = getApiUrl();
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers = { 
        Authorization: `Bearer ${token}`,
        'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
      };

      if (editingUser) {
        const updateData = { 
          username: formData.username, 
          email: formData.email,
          role: formData.role,
          permittedPages: formData.permittedPages,
          profileImage: formData.profileImage || '',
          name: formData.name || '',
          phone: formData.phone || ''
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await axios.put(`${API_BASE_URL}/admin/users/${editingUser._id}`, updateData, { headers });
      } else {
        const payload = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          permittedPages: formData.permittedPages,
          profileImage: formData.profileImage || '',
          name: formData.name || '',
          phone: formData.phone || ''
        };
        await axios.post(`${API_BASE_URL}/admin/users`, payload, { headers });
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user', error);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: error.response?.data?.message || 'Error saving user',
        isError: true
      });
    }
  };

  const handleDelete = (user) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete User',
      message: `Are you sure you want to delete "${user.username}" (${user.role})? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          const API_BASE_URL = getApiUrl();
          const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
          await axios.delete(`${API_BASE_URL}/admin/users/${user._id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
            }
          });
          fetchUsers();
        } catch (error) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: error.response?.data?.message || 'Error deleting user',
            isError: true
          });
        }
      }
    });
  };

  const openAddModal = () => {
    setEditingUser(null);
    setSelectedDriverId('');
    setSelectedSupplierId('');
    setUploadFileInfo(null);
    const defaultPages = backendRoles.find(r => r.id === 'cashier')?.defaultPages || ['billing', 'active-orders', 'bill-history'];
    setFormData({ 
      username: '', 
      name: '',
      phone: '',
      email: '',
      password: '', 
      role: 'cashier',
      profileImage: '',
      permittedPages: defaultPages
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setSelectedDriverId('');
    setSelectedSupplierId('');
    setUploadFileInfo(user.profileImage ? { name: `${user.username} Profile Photo`, extension: 'img', size: 'Saved' } : null);
    const existingPages = Array.isArray(user.permittedPages) && user.permittedPages.length > 0
      ? user.permittedPages
      : (backendRoles.find(r => r.id === user.role?.toLowerCase())?.defaultPages || ['billing', 'active-orders', 'bill-history']);
    
    setFormData({ 
      username: user.username || '', 
      name: user.name || '',
      phone: user.phone || '',
      email: user.email || '',
      password: '', 
      role: (user.role || 'cashier').toLowerCase(),
      profileImage: user.profileImage || '',
      permittedPages: existingPages
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const getAvatarStyle = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'admin':
        return 'bg-purple-100 border-purple-300 text-purple-900';
      case 'manager':
        return 'bg-emerald-100 border-emerald-300 text-emerald-900';
      case 'cashier':
        return 'bg-amber-100 border-amber-300 text-amber-900';
      case 'driver':
        return 'bg-blue-100 border-blue-300 text-blue-900';
      case 'supplier':
        return 'bg-teal-100 border-teal-300 text-teal-900';
      default:
        return 'bg-sky-100 border-sky-300 text-sky-900';
    }
  };

  return (
    <div className="w-full min-h-full shrink-0 flex flex-col px-2.5 sm:px-5 md:px-6 py-2.5 sm:py-4 pb-16 touch-pan-y">
      {/* Compact Mobile-Friendly Header bar */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 px-2.5 sm:px-3.5 py-2 bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          {onGoBack && <BackButton onClick={onGoBack} label="Back" className="shrink-0" />}
          <div className="min-w-0 flex-1">
            <h1 className="text-[13px] sm:text-lg font-black text-slate-900 flex items-center gap-1.5 min-w-0 leading-tight">
              <span className="hidden xs:flex p-1 sm:p-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 shrink-0 items-center justify-center">
                <Shield size={13} className="sm:w-4 sm:h-4" />
              </span>
              <span className="leading-tight">Admin Control Panel</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-600 mt-0.5 truncate hidden sm:block">
              Configure staff user logins, assign dynamic roles, and toggle operating page access
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-1 sm:gap-1.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-black transition-all shadow-xs active:scale-95 text-[11px] sm:text-xs shrink-0 cursor-pointer whitespace-nowrap"
        >
          <Plus size={14} strokeWidth={2.5} className="shrink-0" />
          <span className="sm:hidden">Add User</span>
          <span className="hidden sm:inline">Create User Login</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="md:bg-[#FDFBF7] md:rounded-2xl md:shadow-sm md:border md:border-[#E8DCCB] md:overflow-hidden w-full">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 px-4 text-sky-200/60">
            <Shield size={40} className="mx-auto mb-3 text-sky-400/40" />
            <p className="font-bold text-base text-white">No custom user logins created yet</p>
            <p className="text-xs text-sky-200/60 mt-1">Click "Create User Login" above to add branch staff or billing operators.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (hidden on mobile, visible on md+) */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F7EFE2] border-b border-[#E8DCCB] text-xs uppercase tracking-wider text-slate-700 font-bold">
                    <th className="p-4 font-bold">Username</th>
                    <th className="p-4 font-bold">Role</th>
                    <th className="p-4 font-bold">Permitted Operating Pages</th>
                    <th className="p-4 font-bold">Created At</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-500/10">
                  {users.map((u) => {
                    const roleStr = (u.role || '').toLowerCase();
                    const pages = Array.isArray(u.permittedPages) && u.permittedPages.length > 0 
                      ? u.permittedPages 
                      : (roleStr === 'admin' ? ['All Admin Pages'] : ['billing', 'active-orders', 'bill-history']);

                    return (
                      <tr key={u._id} className="hover:bg-sky-500/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {u.profileImage ? (
                              <img
                                src={u.profileImage}
                                alt={u.username}
                                className="w-10 h-10 rounded-full object-cover border border-[#E8DCCB] shrink-0 shadow-xs"
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${getAvatarStyle(u.role)}`}>
                                {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">{u.username}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {u.email && (
                                  <span className="text-[11px] text-slate-700 font-mono font-medium">{u.email}</span>
                                )}
                                {u.name && u.name !== u.username && (
                                  <span className="text-[11px] text-slate-700 font-semibold">• {u.name}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                            roleStr === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                            roleStr === 'manager' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            roleStr === 'cashier' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            roleStr === 'driver' ? 'bg-blue-100 text-blue-800 border border-blue-300 font-black' :
                            roleStr === 'supplier' ? 'bg-teal-100 text-teal-800 border border-teal-300 font-black' :
                            'bg-sky-100 text-sky-800 border border-sky-300'}`
                          }>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5 max-w-md">
                            {roleStr === 'admin' ? (
                              <span className="text-[11px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-semibold border border-purple-300">
                                ⚡ Full Branch Access (All Pages)
                              </span>
                            ) : (
                              pages.map(pageId => (
                                <span key={pageId} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-300">
                                  {availablePages.find(p => p.id === pageId)?.label || pageId}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => openEditModal(u)} 
                              className="p-2 text-sky-700 hover:text-sky-900 hover:bg-sky-100 rounded-lg transition-colors" 
                              title="Edit User & Page Permissions"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(u)} 
                              className="p-2 text-rose-700 hover:text-rose-900 hover:bg-rose-100 rounded-lg transition-colors" 
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (visible on < md screens) */}
            <div className="flex flex-col gap-3 md:hidden">
              {users.map((u) => {
                const roleStr = (u.role || '').toLowerCase();
                const pages = Array.isArray(u.permittedPages) && u.permittedPages.length > 0 
                  ? u.permittedPages 
                  : (roleStr === 'admin' ? ['All Admin Pages'] : ['billing', 'active-orders', 'bill-history']);

                return (
                  <div key={u._id} className="p-4 flex flex-col gap-3 bg-[#F7EFE2] hover:bg-[#F5E8D8] border border-[#E8DCCB] rounded-xl transition-colors">
                    {/* Card Top: Avatar, Name/Username/Email, and Role Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {u.profileImage ? (
                          <img
                            src={u.profileImage}
                            alt={u.username}
                            className="w-10 h-10 rounded-full object-cover border border-[#E8DCCB] shrink-0 shadow-xs"
                          />
                        ) : (
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-black text-sm shrink-0 shadow-xs ${getAvatarStyle(u.role)}`}>
                            {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-sm block truncate">{u.username}</span>
                          {u.email && (
                            <span className="text-[11px] text-slate-700 block truncate font-mono font-medium">{u.email}</span>
                          )}
                          {u.name && u.name !== u.username && (
                            <span className="text-[11px] text-slate-700 block truncate font-semibold">• {u.name}</span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                        roleStr === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                        roleStr === 'manager' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                        roleStr === 'cashier' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        roleStr === 'driver' ? 'bg-blue-100 text-blue-800 border border-blue-300 font-black' :
                        roleStr === 'supplier' ? 'bg-teal-100 text-teal-800 border border-teal-300 font-black' :
                        'bg-sky-100 text-sky-800 border border-sky-300'}`
                      }>
                        {u.role}
                      </span>
                    </div>

                    {/* Card Middle: Permitted Pages */}
                    <div className="bg-white p-2.5 rounded-xl border border-[#E8DCCB]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                        Operating Permissions
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {roleStr === 'admin' ? (
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold border border-purple-300">
                            ⚡ Full Branch Access (All Pages)
                          </span>
                        ) : (
                          pages.map(pageId => (
                            <span key={pageId} className="text-[10px] bg-[#FAF0E4] text-slate-800 px-2 py-0.5 rounded-md font-bold border border-[#E8DCCB]">
                              {availablePages.find(p => p.id === pageId)?.label || pageId}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Card Bottom: Date & Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-700 font-medium">
                        Added: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={() => openEditModal(u)} 
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors font-bold cursor-pointer" 
                          title="Edit User & Page Permissions"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(u)} 
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors font-bold cursor-pointer" 
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal with Dynamic Roles & Page Toggles */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[999999] p-3 sm:p-4 overflow-y-auto" style={{ zIndex: 999999 }}>
          <div className="bg-[#FDFBF7] border border-[#E8DCCB] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col text-slate-800">
            <div className="p-4 sm:p-5 border-b border-[#E8DCCB] flex justify-between items-center bg-[#F7EFE2] border-b border-[#E8DCCB] shrink-0">
              <div className="min-w-0 pr-2">
                <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2 truncate">
                  {editingUser ? <Edit2 className="text-sky-400 shrink-0" size={18} /> : <Plus className="text-amber-400 shrink-0" size={18} />}
                  <span className="truncate">{editingUser ? 'Edit User & Permissions' : 'Create Staff User Login'}</span>
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                  Configure login access and toggle operating page access
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-500 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 text-base leading-none cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
              {/* Assigned Role */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-bold">
                  Assigned Role (Backend Dynamic)
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#ea580c] focus:bg-white capitalize font-semibold"
                >
                  {backendRoles.length > 0 ? (
                    backendRoles.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="cashier">Cashier (Billing & Printing)</option>
                      <option value="worker">Worker / Operator (POS & Orders)</option>
                      <option value="manager">Manager (Operations & Analytics)</option>
                      <option value="driver">Driver (Assigned Deliveries - View Only)</option>
                      <option value="supplier">Supplier (Catch Passbook & Khata - View Only)</option>
                      <option value="admin">Admin (Full Branch Access)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Dynamic Auto-Fetch & Auto-Fill for DRIVER */}
              {formData.role === 'driver' && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <Truck size={14} className="text-blue-600" />
                      Select Existing Driver from Fleet
                    </label>
                    <span className="text-[10.5px] text-blue-600 font-semibold">
                      Auto-fills Username & Photo
                    </span>
                  </div>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => handleDriverSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">-- Choose a Fleet Driver ({availableDrivers.length} available) --</option>
                    {availableDrivers.map(d => {
                      const existing = getDriverExistingUser(d);
                      return (
                        <option key={d.id || d.name} value={d.id || d.name}>
                          {existing ? `⚠️ [Created: ${existing.username}] ` : ''}
                          {d.name} {d.phone ? `(${d.phone})` : ''} {d.vehicleNumber ? `• ${d.vehicleNumber}` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Warning Alert if Selected Driver Already Exists */}
                  {selectedDriverId && (() => {
                    const driver = availableDrivers.find(d => (d.id === selectedDriverId || d.name === selectedDriverId));
                    const existing = getDriverExistingUser(driver);
                    if (!existing) return null;
                    return (
                      <div className="p-2.5 bg-amber-100/90 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start justify-between gap-2 shadow-2xs animate-fade-in">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-amber-950">
                              Driver Already Created!
                            </div>
                            <div className="text-[11px] text-amber-900 mt-0.5">
                              This driver already has an active login: <span className="font-mono font-bold bg-amber-200/90 px-1.5 py-0.2 rounded border border-amber-400">{existing.username}</span>
                              {existing.phone ? ` • Phone: ${existing.phone}` : ''}
                            </div>
                            <div className="text-[10.5px] text-amber-800 mt-0.5">
                              You cannot create a duplicate account with this username. Edit the existing user instead.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditModal(existing)}
                          className="px-2.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-lg text-[11px] font-black transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95"
                        >
                          Edit User
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Dynamic Auto-Fetch & Auto-Fill for SUPPLIER */}
              {formData.role === 'supplier' && (
                <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                      <Building size={14} className="text-teal-600" />
                      Select Existing Supplier from Directory
                    </label>
                    <span className="text-[10.5px] text-teal-600 font-semibold">
                      Auto-fills Username & Photo
                    </span>
                  </div>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => handleSupplierSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="">-- Choose a Registered Supplier ({availableSuppliers.length} available) --</option>
                    {availableSuppliers.map(s => {
                      const existing = getSupplierExistingUser(s);
                      return (
                        <option key={s._id} value={s._id}>
                          {existing ? `⚠️ [Created: ${existing.username}] ` : ''}
                          {s.name} {s.companyName ? `(${s.companyName})` : ''} {s.phone ? `• ${s.phone}` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {/* Warning Alert if Selected Supplier Already Exists */}
                  {selectedSupplierId && (() => {
                    const supp = availableSuppliers.find(s => s._id === selectedSupplierId);
                    const existing = getSupplierExistingUser(supp);
                    if (!existing) return null;
                    return (
                      <div className="p-2.5 bg-amber-100/90 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start justify-between gap-2 shadow-2xs animate-fade-in">
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-extrabold text-amber-950">
                              Supplier Already Created!
                            </div>
                            <div className="text-[11px] text-amber-900 mt-0.5">
                              This supplier already has an active login: <span className="font-mono font-bold bg-amber-200/90 px-1.5 py-0.2 rounded border border-amber-400">{existing.username}</span>
                              {existing.phone ? ` • Phone: ${existing.phone}` : ''}
                            </div>
                            <div className="text-[10.5px] text-amber-800 mt-0.5">
                              You cannot create a duplicate account with this username. Edit the existing user instead.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditModal(existing)}
                          className="px-2.5 py-1.5 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-lg text-[11px] font-black transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95"
                        >
                          Edit User
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Username & Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 font-bold">
                      Username
                    </label>
                    {(formData.role === 'driver' || formData.role === 'supplier') && (
                      <span className="text-[10.5px] text-emerald-600 font-semibold">Auto-fill active</span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. cashier_kdp or operator_vizag"
                    className={`w-full px-4 py-2.5 bg-[#F7EFE2] border rounded-xl text-slate-800 text-sm focus:outline-none transition-all ${
                      duplicateUser
                        ? 'border-rose-500 bg-rose-50/60 focus:border-rose-600'
                        : 'border-[#E8DCCB] focus:border-[#ea580c] focus:bg-white'
                    }`}
                    required 
                  />
                  {duplicateUser && (
                    <div className="mt-1 flex items-center gap-1.5 text-rose-600 text-[11px] font-bold animate-fade-in">
                      <AlertTriangle size={12} className="shrink-0" />
                      <span>
                        This username is already created ({duplicateUser.role?.toUpperCase()} • {duplicateUser.name || duplicateUser.username})!
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-bold flex justify-between">
                    <span>Email Address</span>
                    <span className="text-[11px] text-slate-500 normal-case">(Login / Notifications)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. cashier@ynrfishes.com"
                    className="w-full px-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#ea580c] focus:bg-white"
                  />
                </div>
              </div>

              {/* Password & Profile Image Upload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-bold flex justify-between">
                    <span>Password</span>
                    {editingUser && <span className="text-[11px] text-slate-500 normal-case">(Keep blank to preserve)</span>}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      className="w-full px-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#ea580c] focus:bg-white pr-10"
                      required={!editingUser}
                      minLength="4" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#ea580c] transition-colors p-1 rounded-md hover:bg-[#FAF0E4]"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Profile Photo Upload with <= 5MB validation & Image Cropper */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Profile Photo (Optional)
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Max 5MB • JPG, PNG</span>
                  </div>
                  {!formData.profileImage ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value=""
                        readOnly
                        className="flex-1 px-3 py-2 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-xs text-slate-400 focus:outline-none"
                        placeholder="Upload user profile photo..."
                      />
                      <label className="bg-orange-50 hover:bg-orange-100 text-[#ea580c] px-3.5 py-2 rounded-xl cursor-pointer flex items-center gap-1.5 text-xs border border-orange-200 shrink-0 font-bold transition-all shadow-2xs">
                        <Upload size={13} />
                        <span>Upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) handleImageUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2 bg-[#FAF0E4] border border-[#E8DCCB] rounded-xl gap-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <img
                          src={formData.profileImage}
                          alt="Staff Preview"
                          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-orange-300 shrink-0 shadow-2xs"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-800 truncate block">
                            {uploadFileInfo?.name || (formData.username ? `${formData.username}'s Photo` : 'User Photo')}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {uploadFileInfo ? `.${uploadFileInfo.extension} • ${uploadFileInfo.size}` : 'Uploaded'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setCropperRawSrc(formData.profileImage);
                            setCropperPendingInfo(uploadFileInfo || {
                              name: formData.username ? `${formData.username} Profile Photo` : 'User Photo',
                              extension: 'jpg',
                              size: 'Cropped'
                            });
                            setIsCropperOpen(true);
                          }}
                          className="px-1.5 sm:px-2 py-1 bg-orange-50 hover:bg-orange-100 text-[#ea580c] border border-orange-200 rounded-lg text-[10px] sm:text-[10.5px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                          title="Crop photo"
                        >
                          <Crop size={11} />
                          <span>Crop</span>
                        </button>
                        <label className="px-1.5 sm:px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-[10px] sm:text-[10.5px] font-bold cursor-pointer transition-colors">
                          <span>Change</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) handleImageUpload(file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadFileInfo(null);
                            setFormData({ ...formData, profileImage: '' });
                          }}
                          className="px-1.5 sm:px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] sm:text-[10.5px] font-bold cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Page Permissions Toggles */}
              <div>
                <div className="flex items-center justify-between mb-2 pb-1 border-b border-sky-500/20">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
                      Operate Page Toggles
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Toggle ON the pages this staff member can view and operate in their workspace
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllPages}
                      className="text-[11px] px-2.5 py-1 bg-[#FAF0E4] hover:bg-[#F5E8D8] text-[#7c3f1d] hover:text-[#5c2d13] font-bold rounded-lg transition-colors border border-[#E8DCCB]"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllPages}
                      className="text-[11px] px-2.5 py-1 bg-[#FAF0E4] hover:bg-[#F5E8D8] text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors border border-[#E8DCCB]"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1 pr-2">
                  {availablePages.map(page => {
                    const isChecked = (formData.permittedPages || []).includes(page.id);
                    return (
                      <label
                        key={page.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isChecked 
                            ? 'bg-[#FFF3E0] border-[#ea580c] text-slate-900 font-bold shadow-xs' 
                            : 'bg-white border-[#E8DCCB] text-slate-700 hover:border-[#fed7aa] hover:bg-[#FAF3E8]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePagePermission(page.id)}
                          className="mt-0.5 accent-[#ea580c] w-4 h-4 rounded cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-bold block truncate">{page.label}</span>
                          <span className={`text-[10px] block leading-tight truncate ${isChecked ? "text-[#c2410c] font-medium" : "text-slate-500"}`}>{page.description}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E8DCCB] flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#FAF0E4] hover:bg-[#F5E8D8] text-slate-700 hover:text-slate-900 font-bold rounded-xl transition-colors text-sm border border-[#E8DCCB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(!editingUser && duplicateUser)}
                  className={`flex-1 py-2.5 text-white font-bold rounded-xl transition-all shadow-md text-sm ${
                    !editingUser && duplicateUser
                      ? 'bg-slate-400 cursor-not-allowed opacity-60 shadow-none'
                      : 'bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] cursor-pointer'
                  }`}
                  title={!editingUser && duplicateUser ? `User "${duplicateUser.username}" is already created` : ''}
                >
                  {editingUser
                    ? 'Save Permissions'
                    : duplicateUser
                      ? 'User Already Created'
                      : 'Create Staff Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] p-4" style={{ zIndex: 999999 }}>
          <div className="bg-[#FDFBF7] border border-rose-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog({ isOpen: false })}
                className="flex-1 py-2 bg-sky-500/10 text-sky-300 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Dialog */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999999] p-4" style={{ zIndex: 999999 }}>
          <div className="bg-[#FDFBF7] border border-sky-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-white mb-2">{alertDialog.title}</h3>
            <p className="text-xs text-sky-200/80 mb-5 leading-relaxed">{alertDialog.message}</p>
            <button 
              onClick={() => setAlertDialog({ isOpen: false })}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {/* Staff Profile Photo Cropper Modal */}
      {isCropperOpen && (
        <ImageCropperModal
          title="Crop Staff Profile Photo"
          imageSrc={cropperRawSrc}
          onCropComplete={(croppedDataUrl) => {
            setFormData(prev => ({ ...prev, profileImage: croppedDataUrl }));
            if (cropperPendingInfo) {
              setUploadFileInfo(cropperPendingInfo);
            }
            setIsCropperOpen(false);
          }}
          onClose={() => setIsCropperOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminPanel;
