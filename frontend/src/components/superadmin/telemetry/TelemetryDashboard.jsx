import React, { useState, useEffect, useRef } from 'react';
import TelemetryHeader from './TelemetryHeader';
import TelemetrySubTabs from './TelemetrySubTabs';
import NetworkTrafficTab from './NetworkTrafficTab';
import StorageServicesTab from './StorageServicesTab';
import WhatsAppMatrixTab from './WhatsAppMatrixTab';
import { getSuperadminApiUrl } from '../../../config.js';

const API_ROOT = `${getSuperadminApiUrl()}/telemetry`;

export default function TelemetryDashboard({ authHeaders }) {
  const [activeSubTab, setActiveSubTab] = useState('network');
  const [currentTime, setCurrentTime] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [storageData, setStorageData] = useState(null);
  const [whatsAppData, setWhatsAppData] = useState(null);

  const timerRef = useRef(null);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).toLowerCase()
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch telemetry data from backend with fallback support
  const fetchTelemetryData = async (showSyncSpinner = false) => {
    if (showSyncSpinner) setIsSyncing(true);
    try {
      const [resOverview, resStorage, resWA] = await Promise.allSettled([
        fetch(`${API_ROOT}/overview`, { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetch(`${API_ROOT}/storage-services`, { headers: authHeaders }).then(r => r.ok ? r.json() : null),
        fetch(`${API_ROOT}/whatsapp-matrix`, { headers: authHeaders }).then(r => r.ok ? r.json() : null),
      ]);

      if (resOverview.status === 'fulfilled' && resOverview.value?.success) {
        setOverviewData(resOverview.value);
      }
      if (resStorage.status === 'fulfilled' && resStorage.value?.success) {
        setStorageData(resStorage.value);
      }
      if (resWA.status === 'fulfilled' && resWA.value?.success) {
        setWhatsAppData(resWA.value);
      }
    } catch {
      // Offline fallback handling already built into tab components
    } finally {
      if (showSyncSpinner) {
        setTimeout(() => setIsSyncing(false), 400);
      }
    }
  };

  // Auto-refresh polling every 5 seconds (LIVE 5s badge)
  useEffect(() => {
    fetchTelemetryData();
    timerRef.current = setInterval(() => {
      fetchTelemetryData(false);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="telemetry-module-wrapper">
      {/* Top Telemetry Header with Live (5s) Badge & Sync Button */}
      <TelemetryHeader
        currentTime={currentTime}
        onSync={() => fetchTelemetryData(true)}
        isSyncing={isSyncing}
        autoRefreshInterval={5}
      />

      {/* 3 Sub-Tabs Navigation */}
      <TelemetrySubTabs
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
      />

      {/* Active Tab View */}
      {activeSubTab === 'network' && (
        <NetworkTrafficTab data={overviewData} />
      )}

      {activeSubTab === 'storage' && (
        <StorageServicesTab data={storageData} />
      )}

      {activeSubTab === 'whatsapp' && (
        <WhatsAppMatrixTab data={whatsAppData} />
      )}
    </div>
  );
}
