import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Plus, Edit2, Trash2, Key, Eye, EyeOff, Fingerprint, RefreshCw, ArrowLeft } from 'lucide-react';
import BackButton from '../common/BackButton';
import { getApiUrl } from '../../../config.js';

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
    password: '', 
    role: 'cashier',
    permittedPages: ['billing', 'active-orders', 'bill-history']
  });

  useEffect(() => {
    fetchUsers();
    fetchRolesAndPages();
  }, []);

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
    setFormData({
      ...formData,
      role: newRole,
      permittedPages: defaultPages
    });
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
          permittedPages: formData.permittedPages
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
          permittedPages: formData.permittedPages
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
    const defaultPages = backendRoles.find(r => r.id === 'cashier')?.defaultPages || ['billing', 'active-orders', 'bill-history'];
    setFormData({ 
      username: '', 
      email: '',
      password: '', 
      role: 'cashier',
      permittedPages: defaultPages
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    const existingPages = Array.isArray(user.permittedPages) && user.permittedPages.length > 0
      ? user.permittedPages
      : (backendRoles.find(r => r.id === user.role?.toLowerCase())?.defaultPages || ['billing', 'active-orders', 'bill-history']);
    
    setFormData({ 
      username: user.username, 
      email: user.email || '',
      password: '', 
      role: (user.role || 'cashier').toLowerCase(),
      permittedPages: existingPages
    });
    setShowPassword(false);
    setIsModalOpen(true);
  };

  return (
    <div className="w-full h-full flex flex-col px-3 sm:px-6 md:px-8 py-4 sm:py-6 overflow-y-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-5 sm:mb-6 gap-3.5 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3">
          {onGoBack && <BackButton onClick={onGoBack} label="Back" />}
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <Shield className="text-amber-400 shrink-0" size={22} />
              <span>Admin Control Panel</span>
            </h1>
            <p className="text-[11px] sm:text-sm text-slate-600 mt-0.5 leading-tight">
              Configure staff user logins, assign dynamic roles, and toggle operating page access
            </p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white px-4 sm:px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-xs sm:text-sm w-full sm:w-auto shrink-0 cursor-pointer"
        >
          <Plus size={18} />
          <span>Create User Login</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-[#FDFBF7] rounded-2xl shadow-sm border border-[#E8DCCB] overflow-hidden w-full">
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
                            <div className="w-10 h-10 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                              {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-sm block">{u.username}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {u.email && (
                                  <span className="text-[11px] text-slate-600 font-mono">{u.email}</span>
                                )}
                                {u.name && u.name !== u.username && (
                                  <span className="text-[11px] text-sky-300/40">• {u.name}</span>
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
            <div className="block md:hidden divide-y divide-sky-500/15">
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
                        <div className="w-10 h-10 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                          {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 text-sm block truncate">{u.username}</span>
                          {u.email && (
                            <span className="text-[11px] text-slate-600 block truncate font-mono">{u.email}</span>
                          )}
                          {u.name && u.name !== u.username && (
                            <span className="text-[10px] text-slate-500 block truncate">{u.name}</span>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider shrink-0 ${
                        roleStr === 'admin' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' :
                        roleStr === 'manager' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                        roleStr === 'cashier' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                        'bg-sky-500/20 text-sky-300 border border-sky-500/40'}`
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
                          <span className="text-[10px] bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-md font-semibold border border-purple-500/30">
                            ⚡ Full Branch Access (All Pages)
                          </span>
                        ) : (
                          pages.map(pageId => (
                            <span key={pageId} className="text-[10px] bg-[#FAF0E4] text-[#7c3f1d] px-2 py-0.5 rounded-md font-semibold border border-[#E8DCCB]">
                              {availablePages.find(p => p.id === pageId)?.label || pageId}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Card Bottom: Date & Actions */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-sky-200/50">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-bold">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="e.g. cashier_kdp or operator_vizag"
                    className="w-full px-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#ea580c] focus:bg-white"
                    required 
                  />
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-bold">
                    Assigned Role (Backend Dynamic)
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#F7EFE2] border border-[#E8DCCB] rounded-xl text-slate-800 text-sm focus:outline-none focus:border-[#ea580c] focus:bg-white capitalize"
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
                        <option value="admin">Admin (Full Branch Access)</option>
                      </>
                    )}
                  </select>
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
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#ea580c] to-[#c2410c] hover:from-[#f97316] hover:to-[#ea580c] text-white font-bold rounded-xl transition-all shadow-md text-sm cursor-pointer"
                >
                  {editingUser ? 'Save Permissions' : 'Create Staff Login'}
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
    </div>
  );
};

export default AdminPanel;
