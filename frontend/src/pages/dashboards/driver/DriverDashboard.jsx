import React, { useState } from 'react';
import { Truck, Radio, Fuel } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useDriverData } from './hooks/useDriverData';
import { useDriverGps } from './hooks/useDriverGps';
import DriverHeader from './components/DriverHeader';
import DriverMetricsGrid from './components/DriverMetricsGrid';
import DriverTripsTab from './components/DriverTripsTab';
import DriverGpsTab from './components/DriverGpsTab';
import DriverFuelTab from './components/DriverFuelTab';
import LogTripModal from './components/LogTripModal';
import LogFuelModal from './components/LogFuelModal';
import CompleteTripModal from './components/CompleteTripModal';

export default function DriverDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('trips'); // 'trips' | 'gps' | 'fuel'

  // Data & GPS hooks
  const {
    vehicles,
    assignedVehicle,
    setAssignedVehicle,
    trips,
    setTrips,
    fuelLogs,
    setFuelLogs,
    maintLogs,
    loading,
    refreshing,
    refresh
  } = useDriverData(user);

  const {
    isTracking,
    toggleGps,
    currentSpeed,
    heading,
    gpsAccuracy,
    lastCoords,
    routeTrail,
    tripDistanceKm,
    formattedTime,
    isSocketConnected
  } = useDriverGps(assignedVehicle);

  // Modals state
  const [showLogTripModal, setShowLogTripModal] = useState(false);
  const [showLogFuelModal, setShowLogFuelModal] = useState(false);
  const [completingTrip, setCompletingTrip] = useState(null);

  const driverName = user?.name || user?.username || 'Fleet Driver';
  const driverPhone = user?.phone || '';

  return (
    <div className="min-h-screen bg-[#F7EFE2] text-slate-800 flex flex-col font-sans select-none antialiased w-full">
      {/* 1. Sleek Compact Header */}
      <DriverHeader
        user={user}
        assignedVehicle={assignedVehicle}
        isTracking={isTracking}
        onToggleGpsTab={() => setActiveTab('gps')}
        onRefresh={refresh}
        refreshing={refreshing}
        onLogout={logout}
      />

      {/* 2. Full-Width Workspace with Minimum Padding */}
      <main className="w-full px-2 sm:px-4 py-2 space-y-2 flex-1">
        {/* Telemetry Metrics Grid */}
        <DriverMetricsGrid
          assignedVehicle={assignedVehicle}
          trips={trips}
          currentSpeed={currentSpeed}
          tripDistanceKm={tripDistanceKm}
          elapsedTimeFormatted={formattedTime}
          isTracking={isTracking}
          onToggleGps={toggleGps}
        />

        {/* Tab Controls Bar */}
        <div className="flex items-center justify-between gap-1.5 border-b border-[#E8DCCB] pb-1.5 flex-wrap w-full">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('trips')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'trips'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              <Truck size={13} />
              <span>Assigned Deliveries ({trips.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('gps')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'gps'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              <Radio size={13} className={isTracking ? 'text-emerald-400 animate-pulse' : ''} />
              <span>Speedometer & GPS</span>
            </button>

            <button
              onClick={() => setActiveTab('fuel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'fuel'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-[#E8DCCB] text-slate-600 hover:bg-[#FAF0E4]'
              }`}
            >
              <Fuel size={13} />
              <span>Fuel & Upkeep ({fuelLogs.length})</span>
            </button>
          </div>

          {/* Quick Action Button */}
          {activeTab === 'trips' && (
            <button
              onClick={() => setShowLogTripModal(true)}
              className="px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <span>+ Log Delivery</span>
            </button>
          )}
        </div>

        {/* Tab Views */}
        {activeTab === 'trips' && (
          <DriverTripsTab
            trips={trips}
            loading={loading}
            assignedVehicle={assignedVehicle}
            onOpenLogTrip={() => setShowLogTripModal(true)}
            onOpenCompleteTrip={(trip) => setCompletingTrip(trip)}
          />
        )}

        {activeTab === 'gps' && (
          <DriverGpsTab
            assignedVehicle={assignedVehicle}
            isTracking={isTracking}
            currentSpeed={currentSpeed}
            heading={heading}
            tripDistanceKm={tripDistanceKm}
            elapsedTimeFormatted={formattedTime}
            gpsAccuracy={gpsAccuracy}
            lastCoords={lastCoords}
            routeTrail={routeTrail}
            isSocketConnected={isSocketConnected}
            onToggleGps={toggleGps}
          />
        )}

        {activeTab === 'fuel' && (
          <DriverFuelTab
            fuelLogs={fuelLogs}
            maintLogs={maintLogs}
            assignedVehicle={assignedVehicle}
            onOpenLogFuel={() => setShowLogFuelModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      <LogTripModal
        isOpen={showLogTripModal}
        onClose={() => setShowLogTripModal(false)}
        assignedVehicle={assignedVehicle}
        driverName={driverName}
        driverPhone={driverPhone}
        onTripCreated={(newTrip) => setTrips(prev => [newTrip, ...prev])}
      />

      <LogFuelModal
        isOpen={showLogFuelModal}
        onClose={() => setShowLogFuelModal(false)}
        assignedVehicle={assignedVehicle}
        onFuelLogged={(newLog, odo) => {
          setFuelLogs(prev => [newLog, ...prev]);
          if (assignedVehicle && odo > assignedVehicle.currentKm) {
            setAssignedVehicle(prev => ({ ...prev, currentKm: odo }));
          }
        }}
      />

      <CompleteTripModal
        trip={completingTrip}
        onClose={() => setCompletingTrip(null)}
        assignedVehicle={assignedVehicle}
        onTripCompleted={(updatedTrip, endKmNum) => {
          setTrips(prev => prev.map(t => t._id === updatedTrip._id ? updatedTrip : t));
          if (assignedVehicle && endKmNum > assignedVehicle.currentKm) {
            setAssignedVehicle(prev => ({ ...prev, currentKm: endKmNum, status: 'Available' }));
          }
        }}
      />
    </div>
  );
}
