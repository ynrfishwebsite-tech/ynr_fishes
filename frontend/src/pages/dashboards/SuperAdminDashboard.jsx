import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import PortalHeader from '../../components/common/PortalHeader';
import OverviewTab from '../../components/superadmin/OverviewTab';
import BranchesTab from '../../components/superadmin/BranchesTab';
import StaffTab from '../../components/superadmin/StaffTab';
import BroadcastsTab from '../../components/superadmin/BroadcastsTab';
import TelemetryDashboard from '../../components/superadmin/telemetry/TelemetryDashboard';
import { getSuperadminApiUrl } from '../../config.js';

const API_BASE = getSuperadminApiUrl();

export default function SuperAdminDashboard() {
  const { token } = useAuth();
  
  // Persist tab across page reloads via localStorage
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('ynr_sa_active_tab');
      if (saved) return saved;
      const hash = window.location.hash.replace('#', '');
      if (['telemetry', 'overview', 'branches', 'staff', 'broadcasts'].includes(hash)) {
        return hash;
      }
    } catch {
      // ignore
    }
    return 'overview';
  });

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    try {
      localStorage.setItem('ynr_sa_active_tab', tabId);
      window.location.hash = tabId;
    } catch {
      // ignore
    }
  };

  // Core Data loaded strictly from real Backend API
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notice, setNotice] = useState({ text: '', type: '' });

  // Filters
  const [branchSearch, setBranchSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');

  // Modals
  const [branchModal, setBranchModal] = useState({ isOpen: false, isEdit: false, id: null, name: '', code: '', city: '', address: '', phone: '', capacityKg: '' });
  const [staffModal, setStaffModal] = useState({ isOpen: false, isEdit: false, id: null, name: '', username: '', email: '', password: '', role: 'worker', branchId: '' });
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [broadcastModal, setBroadcastModal] = useState({ isOpen: false, title: '', message: '', priority: 'info' });

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const showNotice = (text, type = 'success') => {
    setNotice({ text, type });
    setTimeout(() => setNotice({ text: '', type: '' }), 4000);
  };

  // Fetch real data from Backend API
  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [bRes, uRes, bcRes] = await Promise.allSettled([
        fetch(`${API_BASE}/branches`, { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/users`, { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetch(`${API_BASE}/broadcasts`, { headers: authHeaders }).then(r => r.ok ? r.json() : null),
      ]);

      if (bRes.status === 'fulfilled' && bRes.value?.branches) {
        setBranches(bRes.value.branches);
      }
      if (uRes.status === 'fulfilled' && uRes.value?.users) {
        setUsers(uRes.value.users);
      }
      if (bcRes.status === 'fulfilled' && bcRes.value?.broadcasts) {
        setBroadcasts(bcRes.value.broadcasts);
      }
    } catch {
      // Backend may be offline; keep existing fallback state
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Branch CRUD Handlers
  const handleSaveBranch = async (e) => {
    e.preventDefault();
    const payload = {
      name: branchModal.name,
      code: branchModal.code.toUpperCase(),
      city: branchModal.city,
      address: branchModal.address,
      phone: branchModal.phone,
      capacityKg: Number(branchModal.capacityKg) || 0
    };

    try {
      if (branchModal.isEdit) {
        await fetch(`${API_BASE}/branches/${branchModal.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        setBranches(prev => prev.map(b => b._id === branchModal.id ? { ...b, ...payload } : b));
        showNotice(`Branch "${payload.name}" updated successfully.`);
      } else {
        const res = await fetch(`${API_BASE}/branches`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        setBranches(prev => [...prev, data.branch || { ...payload, _id: Date.now().toString(), status: 'active' }]);
        showNotice(`Branch node "${payload.name}" provisioned successfully.`);
      }
      setBranchModal({ isOpen: false, isEdit: false, id: null, name: '', code: '', city: '', address: '', phone: '', capacityKg: '' });
    } catch {
      showNotice('Saved locally (backend offline).', 'warning');
      setBranchModal({ isOpen: false, isEdit: false, id: null, name: '', code: '', city: '', address: '', phone: '', capacityKg: '' });
    }
  };

  const handleDeleteBranch = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete branch "${name}"?`)) return;
    try {
      await fetch(`${API_BASE}/branches/${id}`, { method: 'DELETE', headers: authHeaders });
    } catch {
      // ignore
    }
    setBranches(prev => prev.filter(b => b._id !== id));
    showNotice(`Branch "${name}" deleted.`);
  };

  // Staff CRUD Handlers
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    const payload = {
      name: staffModal.name,
      username: staffModal.username,
      email: staffModal.email,
      role: staffModal.role,
      branch: staffModal.branchId || null
    };
    if (staffModal.password) {
      payload.password = staffModal.password;
    }

    try {
      if (staffModal.isEdit) {
        const res = await fetch(`${API_BASE}/users/${staffModal.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        const assignedBranch = branches.find(b => b._id === payload.branch);
        setUsers(prev => prev.map(u => u._id === staffModal.id ? (data.user || { ...u, ...payload, branch: assignedBranch }) : u));
        showNotice(`Staff profile "${payload.name}" updated successfully.`);
      } else {
        const res = await fetch(`${API_BASE}/users`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        const assignedBranch = branches.find(b => b._id === payload.branch);
        setUsers(prev => [...prev, data.user || { ...payload, _id: Date.now().toString(), isActive: true, branch: assignedBranch }]);
        showNotice(`Staff user "${payload.name}" created successfully.`);
      }
    } catch {
      const assignedBranch = branches.find(b => b._id === payload.branch);
      if (staffModal.isEdit) {
        setUsers(prev => prev.map(u => u._id === staffModal.id ? { ...u, ...payload, branch: assignedBranch } : u));
        showNotice(`Staff user updated locally.`, 'warning');
      } else {
        setUsers(prev => [...prev, { ...payload, _id: Date.now().toString(), isActive: true, branch: assignedBranch }]);
        showNotice('Staff user saved locally.', 'warning');
      }
    }
    setStaffModal({ isOpen: false, isEdit: false, id: null, name: '', username: '', email: '', password: '', role: 'worker', branchId: '' });
  };

  const handleToggleUserActive = async (id, currentStatus) => {
    try {
      await fetch(`${API_BASE}/users/${id}/toggle-status`, { method: 'PUT', headers: authHeaders });
    } catch {
      // ignore
    }
    setUsers(prev => prev.map(u => u._id === id ? { ...u, isActive: !currentStatus } : u));
    showNotice(`User status updated.`);
  };

  const handleResetPassword = async (id, name) => {
    const newPass = window.prompt(`Enter new password for ${name} (min. 6 characters):`);
    if (!newPass || !newPass.trim()) return;
    if (newPass.trim().length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/users/${id}/password`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ newPassword: newPass.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showNotice(`✅ Password reset successfully for "${name}".`);
      } else {
        showNotice(data.message || `Failed to reset password for "${name}".`, 'warning');
      }
    } catch {
      showNotice(`Network error: Could not reset password for "${name}".`, 'warning');
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Delete user account "${name}"?`)) return;
    try {
      await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE', headers: authHeaders });
    } catch {
      // ignore
    }
    setUsers(prev => prev.filter(u => u._id !== id));
    showNotice(`User "${name}" removed.`);
  };

  // Broadcast Handlers
  const handleSaveBroadcast = async (e) => {
    e.preventDefault();
    const payload = {
      title: broadcastModal.title,
      message: broadcastModal.message,
      priority: broadcastModal.priority
    };
    try {
      const res = await fetch(`${API_BASE}/broadcasts`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setBroadcasts(prev => [data.broadcast || { ...payload, _id: Date.now().toString(), createdAt: new Date() }, ...prev]);
      showNotice('Broadcast sent to all branch nodes.');
    } catch {
      setBroadcasts(prev => [{ ...payload, _id: Date.now().toString(), createdAt: new Date() }, ...prev]);
      showNotice('Broadcast posted locally.', 'warning');
    }
    setBroadcastModal({ isOpen: false, title: '', message: '', priority: 'info' });
  };

  const handleDeleteBroadcast = async (id) => {
    try {
      await fetch(`${API_BASE}/broadcasts/${id}`, { method: 'DELETE', headers: authHeaders });
    } catch {
      // ignore
    }
    setBroadcasts(prev => prev.filter(b => b._id !== id));
    showNotice('Broadcast removed.');
  };

  const stats = {
    totalBranches: branches.length,
    activeBranches: branches.filter(b => b.status === 'active').length,
    totalUsers: users.length
  };

  return (
    <div className="dashboard-container superadmin-dashboard-container">
      {/* Central Reusable Portal Header */}
      <PortalHeader
        title="YNR Fishes — Super Administrator Control Node"
        subtitle="Single Cluster Enterprise Architecture | Multi-Branch Regional Network Control"
        icon="👑"
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      {/* Global Action Notification Banner */}
      {notice.text && (
        <div
          className="sa-notice-banner"
          style={{
            background: notice.type === 'warning' ? 'rgba(245, 193, 68, 0.15)' : 'rgba(78, 225, 160, 0.15)',
            border: `1px solid ${notice.type === 'warning' ? '#f5c144' : '#4ee1a0'}`,
            color: notice.type === 'warning' ? '#f5c144' : '#4ee1a0',
          }}
        >
          <span>✨ {notice.text}</span>
          <button
            onClick={() => setNotice({ text: '', type: '' })}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="superadmin-nav-tabs">
        <button
          onClick={() => handleTabChange('telemetry')}
          className={`sa-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: '5px', verticalAlign: 'middle', flexShrink: 0 }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span className="sa-tab-full">REALTIME TELEMETRY</span>
          <span className="sa-tab-mobile">Telemetry</span>
        </button>
        <button
          onClick={() => handleTabChange('overview')}
          className={`sa-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
        >
          <span className="sa-tab-icon">📊</span>
          <span className="sa-tab-full">Network Overview</span>
          <span className="sa-tab-mobile">Overview</span>
        </button>
        <button
          onClick={() => handleTabChange('branches')}
          className={`sa-tab-btn ${activeTab === 'branches' ? 'active' : ''}`}
        >
          <span className="sa-tab-icon">🏢</span>
          <span className="sa-tab-full">Regional Branches ({branches.length})</span>
          <span className="sa-tab-mobile">Branches ({branches.length})</span>
        </button>
        <button
          onClick={() => handleTabChange('staff')}
          className={`sa-tab-btn ${activeTab === 'staff' ? 'active' : ''}`}
        >
          <span className="sa-tab-icon">👥</span>
          <span className="sa-tab-full">Staff & RBAC Access ({users.length})</span>
          <span className="sa-tab-mobile">Staff ({users.length})</span>
        </button>
        <button
          onClick={() => handleTabChange('broadcasts')}
          className={`sa-tab-btn ${activeTab === 'broadcasts' ? 'active' : ''}`}
        >
          <span className="sa-tab-icon">📢</span>
          <span className="sa-tab-full">System Announcements ({broadcasts.length})</span>
          <span className="sa-tab-mobile">Bulletins ({broadcasts.length})</span>
        </button>
      </div>

      {/* Active Tab View */}
      {activeTab === 'telemetry' && (
        <TelemetryDashboard authHeaders={authHeaders} />
      )}

      {activeTab === 'overview' && (
        <OverviewTab
          stats={stats}
          branches={branches}
          onTabChange={setActiveTab}
        />
      )}

      {activeTab === 'branches' && (
        <BranchesTab
          branches={branches}
          searchTerm={branchSearch}
          setSearchTerm={setBranchSearch}
          onOpenCreateModal={() => setBranchModal({ isOpen: true, isEdit: false, id: null, name: '', code: '', city: '', address: '', phone: '', capacityKg: '' })}
          onOpenEditModal={(b) => setBranchModal({ isOpen: true, isEdit: true, id: b._id, name: b.name, code: b.code, city: b.city, address: b.address || '', phone: b.phone || '', capacityKg: b.capacityKg || '' })}
          onDeleteBranch={handleDeleteBranch}
        />
      )}

      {activeTab === 'staff' && (
        <StaffTab
          users={users}
          branches={branches}
          roleFilter={staffRoleFilter}
          setRoleFilter={setStaffRoleFilter}
          searchTerm={staffSearch}
          setSearchTerm={setStaffSearch}
          onOpenCreateModal={() => setStaffModal({ isOpen: true, isEdit: false, id: null, name: '', username: '', email: '', password: '', role: 'worker', branchId: branches[0]?._id || '' })}
          onOpenEditModal={(u) => setStaffModal({
            isOpen: true,
            isEdit: true,
            id: u._id,
            name: u.name || '',
            username: u.username || '',
            email: u.email || '',
            password: '', // optional on edit
            role: u.role || 'worker',
            branchId: (u.branch?._id || u.branch) || ''
          })}
          onToggleUserActive={handleToggleUserActive}
          onResetPassword={handleResetPassword}
          onDeleteUser={handleDeleteUser}
        />
      )}

      {activeTab === 'broadcasts' && (
        <BroadcastsTab
          broadcasts={broadcasts}
          onOpenCreateModal={() => setBroadcastModal({ isOpen: true, title: '', message: '', priority: 'info' })}
          onDeleteBroadcast={handleDeleteBroadcast}
        />
      )}

      {/* Branch Modal */}
      {branchModal.isOpen && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-card">
            <div className="sa-modal-header">
              <h3>{branchModal.isEdit ? '✏️ Edit Branch Node' : '➕ Provision Regional Branch Node'}</h3>
              <button
                onClick={() => setBranchModal({ ...branchModal, isOpen: false })}
                className="sa-modal-close-btn"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveBranch}>
              <div className="sa-form-grid">
                <div className="sa-form-full">
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Branch Name
                  </label>
                  <input
                    type="text"
                    required
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Nellore Wholesale Terminal"
                    value={branchModal.name}
                    onChange={(e) => setBranchModal({ ...branchModal, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Branch Code (Unique)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    disabled={branchModal.isEdit}
                    className="sa-search-input"
                    style={{ width: '100%', textTransform: 'uppercase' }}
                    placeholder="e.g. NLR"
                    value={branchModal.code}
                    onChange={(e) => setBranchModal({ ...branchModal, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    required
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Nellore"
                    value={branchModal.city}
                    onChange={(e) => setBranchModal({ ...branchModal, city: e.target.value })}
                  />
                </div>
                <div className="sa-form-full">
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Physical Address
                  </label>
                  <input
                    type="text"
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="Harbor road, Wholesale market..."
                    value={branchModal.address}
                    onChange={(e) => setBranchModal({ ...branchModal, address: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="+91 98480..."
                    value={branchModal.phone}
                    onChange={(e) => setBranchModal({ ...branchModal, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Daily Capacity (kg)
                  </label>
                  <input
                    type="number"
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="10000"
                    value={branchModal.capacityKg}
                    onChange={(e) => setBranchModal({ ...branchModal, capacityKg: e.target.value })}
                  />
                </div>
              </div>
              <div className="sa-modal-actions">
                <button
                  type="button"
                  onClick={() => setBranchModal({ ...branchModal, isOpen: false })}
                  className="sa-btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="sa-btn-save">
                  {branchModal.isEdit ? 'Save Changes' : 'Provision Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {staffModal.isOpen && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-card">
            <div className="sa-modal-header">
              <h3>{staffModal.isEdit ? '✏️ Edit Enterprise Staff Account' : '➕ Create Enterprise Staff Account'}</h3>
              <button
                onClick={() => setStaffModal({ ...staffModal, isOpen: false })}
                className="sa-modal-close-btn"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveStaff}>
              <div className="sa-form-grid">
                <div className="sa-form-full">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Ramesh Kumar"
                    value={staffModal.name}
                    onChange={(e) => setStaffModal({ ...staffModal, name: e.target.value })}
                  />
                </div>
                <div>
                  <label>Username</label>
                  <input
                    type="text"
                    required
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="ramesh_worker"
                    value={staffModal.username}
                    onChange={(e) => setStaffModal({ ...staffModal, username: e.target.value.toLowerCase().trim() })}
                  />
                </div>
                <div>
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="ramesh@ynrfishes.com"
                    value={staffModal.email}
                    onChange={(e) => setStaffModal({ ...staffModal, email: e.target.value.toLowerCase().trim() })}
                  />
                </div>
                <div className="sa-form-full">
                  <label>{staffModal.isEdit ? 'Password (Leave blank to keep current)' : 'Password'}</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showStaffPassword ? 'text' : 'password'}
                      required={!staffModal.isEdit}
                      className="sa-search-input"
                      style={{ width: '100%', paddingRight: '42px' }}
                      placeholder={staffModal.isEdit ? '•••••••• (unchanged)' : 'Minimum 6 characters'}
                      value={staffModal.password}
                      onChange={(e) => setStaffModal({ ...staffModal, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      title={showStaffPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: showStaffPassword ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        transition: 'color 0.2s ease',
                      }}
                    >
                      {showStaffPassword ? (
                        /* Eye Open */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      ) : (
                        /* Eye Off / Crossed */
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label>Role Assignment</label>
                  <select
                    className="sa-select-filter"
                    style={{ width: '100%' }}
                    value={staffModal.role}
                    onChange={(e) => setStaffModal({ ...staffModal, role: e.target.value })}
                  >
                    <option value="worker">Billing Worker</option>
                    <option value="cashier">Branch Cashier</option>
                    <option value="manager">Branch Manager</option>
                    <option value="admin">Branch Administrator</option>
                  </select>
                </div>
                <div>
                  <label>Assigned Branch Node</label>
                  <select
                    className="sa-select-filter"
                    style={{ width: '100%' }}
                    disabled={staffModal.role === 'super-admin'}
                    value={staffModal.branchId}
                    onChange={(e) => setStaffModal({ ...staffModal, branchId: e.target.value })}
                  >
                    <option value="">Select Branch</option>
                    {branches.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sa-modal-actions">
                <button
                  type="button"
                  onClick={() => setStaffModal({ ...staffModal, isOpen: false })}
                  className="sa-btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="sa-btn-save">
                  {staffModal.isEdit ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {broadcastModal.isOpen && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-card">
            <div className="sa-modal-header">
              <h3>📢 Send Enterprise Broadcast</h3>
              <button
                onClick={() => setBroadcastModal({ ...broadcastModal, isOpen: false })}
                className="sa-modal-close-btn"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveBroadcast}>
              <div className="sa-form-grid">
                <div className="sa-form-full">
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    required
                    className="sa-search-input"
                    style={{ width: '100%' }}
                    placeholder="e.g. Daily Fish Auction Rates Updated"
                    value={broadcastModal.title}
                    onChange={(e) => setBroadcastModal({ ...broadcastModal, title: e.target.value })}
                  />
                </div>
                <div className="sa-form-full">
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Broadcast Message Content
                  </label>
                  <textarea
                    required
                    rows={4}
                    className="sa-search-input"
                    style={{ width: '100%', resize: 'vertical' }}
                    placeholder="Enter details visible to all branch staff..."
                    value={broadcastModal.message}
                    onChange={(e) => setBroadcastModal({ ...broadcastModal, message: e.target.value })}
                  />
                </div>
                <div className="sa-form-full">
                  <label style={{ fontSize: '0.8rem', color: 'rgba(230,247,255,0.7)', display: 'block', marginBottom: '4px' }}>
                    Notice Priority
                  </label>
                  <select
                    className="sa-select-filter"
                    style={{ width: '100%' }}
                    value={broadcastModal.priority}
                    onChange={(e) => setBroadcastModal({ ...broadcastModal, priority: e.target.value })}
                  >
                    <option value="info">Informational</option>
                    <option value="warning">Warning / Critical Notice</option>
                    <option value="urgent">Urgent Operational Alert</option>
                  </select>
                </div>
              </div>
              <div className="sa-modal-actions">
                <button
                  type="button"
                  onClick={() => setBroadcastModal({ ...broadcastModal, isOpen: false })}
                  className="sa-btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="sa-btn-save">
                  Dispatch Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
