import React from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';

const isElectronOrFile =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' ||
   Boolean(window.electronAPI) ||
   Boolean(window.process?.versions?.electron) ||
   navigator.userAgent.toLowerCase().includes('electron'));
import Navbar from './components/landing/Navbar';
import CartDrawer from './components/landing/CartDrawer';
import HeroSection from './components/landing/HeroSection';
import TrustBanner from './components/landing/TrustBanner';
import AboutSection from './components/landing/AboutSection';
import ProductsSection from './components/landing/ProductsSection';
import GallerySection from './components/landing/GallerySection';
import ContactSection from './components/landing/ContactSection';
import ServicesSection from './components/landing/ServicesSection';
import EnterpriseFooter from './components/landing/EnterpriseFooter';

// Auth & Dashboard Imports
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DriverGpsPortal from './pages/DriverGpsPortal';
import SuperAdminDashboard from './pages/dashboards/SuperAdminDashboard';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import ManagerDashboard from './pages/dashboards/ManagerDashboard';
import WorkerDashboard from './pages/dashboards/WorkerDashboard';

const HomePage = () => (
  <>
    <HeroSection />
    <TrustBanner />
    <AboutSection />
    <ServicesSection />
    <ProductsSection />
    <GallerySection />
  </>
);

function AppLayout() {
  const location = useLocation();
  const isDashboardOrLogin =
    location.pathname.startsWith('/dashboard') ||
    location.pathname === '/login' ||
    location.pathname === '/driver-gps' ||
    location.pathname.startsWith('/track');

  return (
    <main className={!isDashboardOrLogin ? "outer-ocean-theme" : ""} style={{ position: 'relative', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: !isDashboardOrLogin ? '#010A14' : 'var(--color-background)' }}>
      {/* Navbar is only displayed on public customer pages, hidden on login and dashboards */}
      {!isDashboardOrLogin && (
        <Navbar
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            zIndex: 1000,
            background: 'linear-gradient(to bottom, rgba(1,10,20,0.95) 0%, rgba(1,10,20,0.7) 60%, transparent 100%)',
            backdropFilter: 'blur(10px)',
          }}
        />
      )}

      <CartDrawer />

      <div>
        <Routes>
          {/* Public Customer Routes */}
          <Route path="/" element={isElectronOrFile ? <Navigate to="/login" replace /> : <HomePage />} />
          <Route path="/about" element={<div style={{ paddingTop: '100px' }}><AboutSection /></div>} />
          <Route path="/services" element={<div style={{ paddingTop: '100px' }}><ServicesSection /></div>} />
          <Route path="/products" element={<div style={{ paddingTop: '100px' }}><ProductsSection /></div>} />
          <Route path="/gallery" element={<div style={{ paddingTop: '100px' }}><GallerySection /></div>} />
          <Route path="/contact" element={<div style={{ paddingTop: '100px' }}><ContactSection /></div>} />

          {/* Staff Unified Login Gateway */}
          <Route path="/login" element={<LoginPage />} />

          {/* Driver Live GPS Tracking Portal (Option 1) */}
          <Route path="/driver-gps" element={<DriverGpsPortal />} />
          <Route path="/track" element={<DriverGpsPortal />} />

          {/* Role-Based Access Control (RBAC) Dashboards */}
          <Route
            path="/dashboard/super-admin"
            element={
              <ProtectedRoute allowedRoles={['super-admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={['super-admin', 'admin', 'manager', 'cashier', 'worker']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/manager"
            element={
              <ProtectedRoute allowedRoles={['super-admin', 'admin', 'manager']}>
                <ManagerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/worker"
            element={
              <ProtectedRoute allowedRoles={['super-admin', 'admin', 'manager', 'worker']}>
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>

      {!isDashboardOrLogin && <EnterpriseFooter />}

      {/* Floating Action Buttons (only on customer pages) */}
      {!isDashboardOrLogin && (
        <div
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: 999,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <a
            href="https://wa.me/919849313889"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Order on WhatsApp"
            title="Order on WhatsApp"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              backgroundColor: 'rgba(3, 20, 36, 0.8)',
              border: '1px solid rgba(61, 192, 204, 0.4)',
              borderRadius: '50%',
              color: '#ffffff',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'transform 0.2s ease, background-color 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </a>

          <a
            href="https://maps.app.goo.gl/8TYhrcsoawkcYgBUA"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Location"
            title="View Location"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              backgroundColor: 'rgba(3, 20, 36, 0.8)',
              border: '1px solid rgba(61, 192, 204, 0.4)',
              borderRadius: '50%',
              color: '#ffffff',
              boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              transition: 'transform 0.2s ease, background-color 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
          </a>
        </div>
      )}
    </main>
  );
}

export default function App() {
  if (isElectronOrFile) {
    return (
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <AppLayout />
        </MemoryRouter>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}
