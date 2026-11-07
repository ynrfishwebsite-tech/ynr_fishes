import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Radio,
  Power,
  Navigation,
  MapPin,
  Crosshair,
  Building,
  Gauge,
  Compass,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowUpRight
} from 'lucide-react';

// Fix Vite Leaflet marker icon asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Kadapa Central Depot Coordinates
const KADAPA_DEPOT = {
  name: 'YNR Fishes — Kadapa Central Depot',
  address: 'Chemmumiahpet, Ravindra Nagar, Utukuru, Kadapa',
  lat: 14.4628,
  lng: 78.8119
};

// Calculate straight-line distance in KM
const getDistanceToDepot = (lat, lng) => {
  if (!lat || !lng) return 0;
  const R = 6371;
  const dLat = ((KADAPA_DEPOT.lat - lat) * Math.PI) / 180;
  const dLon = ((KADAPA_DEPOT.lng - lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat * Math.PI) / 180) *
      Math.cos((KADAPA_DEPOT.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
};

export default function DriverGpsTab({
  assignedVehicle,
  isTracking,
  currentSpeed = 0,
  heading = 0,
  tripDistanceKm = 0,
  elapsedTimeFormatted = '00:00',
  gpsAccuracy = null,
  lastCoords,
  routeTrail = [],
  isSocketConnected = false,
  onToggleGps
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const depotMarkerRef = useRef(null);
  const routePolylineRef = useRef(null);

  const [mapLayer, setMapLayer] = useState('streets'); // 'streets' | 'satellite'

  const currentLat = lastCoords?.lat || KADAPA_DEPOT.lat;
  const currentLng = lastCoords?.lng || KADAPA_DEPOT.lng;
  const distanceToDepot = getDistanceToDepot(lastCoords?.lat, lastCoords?.lng);
  const vehicleNumber = assignedVehicle?.vehicleNumber || 'AP 04 YZ 6723';

  // Custom Depot Marker Icon
  const createDepotIcon = () => {
    return L.divIcon({
      className: 'custom-depot-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #ea580c;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 14px rgba(234, 88, 12, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            z-index: 2;
          ">
            🏢
          </div>
          <div style="
            margin-top: 4px;
            background: #7c3f1d;
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 9px;
            font-weight: 800;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.3);
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">
            Kadapa Depot HQ
          </div>
        </div>
      `,
      iconSize: [40, 56],
      iconAnchor: [20, 19]
    });
  };

  // Custom Vehicle Marker Icon with heading and pulse
  const createVehicleIcon = (isLive, angle) => {
    return L.divIcon({
      className: 'custom-driver-vehicle-marker',
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          ${
            isLive
              ? '<div style="position: absolute; width: 50px; height: 50px; border-radius: 50%; background: #10b981; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: -5px;"></div>'
              : ''
          }
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: ${isLive ? '#10b981' : '#2563eb'};
            border: 3px solid #ffffff;
            box-shadow: 0 4px 14px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            transform: rotate(${angle || 0}deg);
            transition: transform 0.3s ease;
            position: relative;
            z-index: 2;
          ">
            🚚
          </div>
          <div style="
            margin-top: 4px;
            background: #0f172a;
            color: #fbbf24;
            padding: 2px 6px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 900;
            font-family: monospace;
            white-space: nowrap;
            border: 1px solid rgba(255,255,255,0.25);
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          ">
            ${vehicleNumber}
          </div>
        </div>
      `,
      iconSize: [44, 58],
      iconAnchor: [22, 20]
    });
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCoords = [currentLat, currentLng];

    const map = L.map(mapContainerRef.current, {
      center: initialCoords,
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    // High quality standard street tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Zoom controls at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add Kadapa Depot HQ Marker
    const depotMarker = L.marker([KADAPA_DEPOT.lat, KADAPA_DEPOT.lng], {
      icon: createDepotIcon()
    }).addTo(map);

    depotMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 2px;">
        <b style="color: #ea580c;">${KADAPA_DEPOT.name}</b><br/>
        <span style="color: #64748b;">${KADAPA_DEPOT.address}</span><br/>
        <span style="font-weight: bold; color: #0f172a;">Fleet Hub & Dispatch Base</span>
      </div>
    `);

    depotMarkerRef.current = depotMarker;

    // Add Driver Vehicle Marker
    const vMarker = L.marker(initialCoords, {
      icon: createVehicleIcon(isTracking, heading)
    }).addTo(map);

    vMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 2px;">
        <b style="color: #0f172a;">${vehicleNumber}</b><br/>
        <span style="color: #10b981; font-weight: bold;">Driver Live Position</span><br/>
        <span>Speed: <b>${currentSpeed} KM/H</b></span>
      </div>
    `);

    vehicleMarkerRef.current = vMarker;

    // Create polyline for route trail
    const polyline = L.polyline([], {
      color: '#ea580c',
      weight: 4,
      opacity: 0.85,
      lineJoin: 'round',
      dashArray: null
    }).addTo(map);

    routePolylineRef.current = polyline;
    mapInstanceRef.current = map;

    // Invalidate size after layout settles
    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. React to Coordinates, Heading & Tracking State changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const vMarker = vehicleMarkerRef.current;
    if (!map || !vMarker) return;

    const coords = [currentLat, currentLng];

    // Smoothly pan marker
    vMarker.setLatLng(coords);
    vMarker.setIcon(createVehicleIcon(isTracking, heading));

    // Update route trail polyline
    if (routePolylineRef.current) {
      const trailPoints = (routeTrail || []).map((p) => [p.lat, p.lng]);
      if (trailPoints.length > 0) {
        routePolylineRef.current.setLatLngs(trailPoints);
      }
    }

    // Auto-center map if tracking is actively broadcasting
    if (isTracking && lastCoords) {
      map.panTo(coords, { animate: true, duration: 0.8 });
    }
  }, [currentLat, currentLng, isTracking, heading, routeTrail]);

  // Recenter actions
  const handleCenterMe = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([currentLat, currentLng], 16, { duration: 1.2 });
  };

  const handleCenterDepot = () => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([KADAPA_DEPOT.lat, KADAPA_DEPOT.lng], 15, { duration: 1.2 });
  };

  const handleFitOverview = () => {
    if (!mapInstanceRef.current) return;
    const bounds = L.latLngBounds([
      [currentLat, currentLng],
      [KADAPA_DEPOT.lat, KADAPA_DEPOT.lng]
    ]);
    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Top Status & Telemetry Bar */}
      <div className="bg-white rounded-2xl border border-[#E8DCCB] p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border transition-all ${
              isTracking
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 animate-pulse'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            <Radio size={13} className={isTracking ? 'text-emerald-500 animate-spin' : ''} />
            <span>{isTracking ? 'LIVE BROADCASTING ACTIVE' : 'GPS TRANSMITTER STANDBY'}</span>
          </span>

          <span
            className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
              isSocketConnected
                ? 'bg-teal-50 text-teal-700 border border-teal-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSocketConnected ? 'bg-teal-500 animate-ping' : 'bg-amber-500'
              }`}
            ></span>
            <span>{isSocketConnected ? 'Depot Socket Online' : 'Connecting Stream...'}</span>
          </span>
        </div>

        {/* Distance to Kadapa Depot */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1 text-slate-600 font-bold">
            <Building size={13} className="text-[#ea580c]" />
            <span>To Kadapa Depot:</span>
            <span className="font-mono font-black text-slate-900 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
              {distanceToDepot} KM
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleGps}
            className={`px-3 py-1.5 rounded-xl font-black text-xs shadow-xs cursor-pointer active:scale-98 transition-all flex items-center gap-1.5 ${
              isTracking
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <Power size={13} />
            <span>{isTracking ? 'STOP BROADCAST' : 'START LIVE GPS'}</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Grid: Map + Speedometer Telemetry HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
        {/* Left: Interactive Leaflet Map (Takes 7 or 8 columns on large screens) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E8DCCB] shadow-2xs overflow-hidden relative flex flex-col">
          {/* Map Header with Quick Actions */}
          <div className="p-2.5 bg-[#fffaf5] border-b border-[#E8DCCB] flex items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-2">
              <Navigation size={15} className="text-[#ea580c]" />
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Live Road Navigator & Fleet Trajectory
              </span>
            </div>

            {/* Quick Map Pan Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleCenterMe}
                className="px-2 py-1 bg-white hover:bg-orange-50 border border-[#E8DCCB] rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Pan to My Current Position"
              >
                <Crosshair size={12} className="text-emerald-600" />
                <span className="hidden sm:inline">My Location</span>
              </button>

              <button
                type="button"
                onClick={handleCenterDepot}
                className="px-2 py-1 bg-white hover:bg-orange-50 border border-[#E8DCCB] rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Pan to Kadapa Depot HQ"
              >
                <Building size={12} className="text-[#ea580c]" />
                <span className="hidden sm:inline">Depot HQ</span>
              </button>

              <button
                type="button"
                onClick={handleFitOverview}
                className="px-2 py-1 bg-white hover:bg-orange-50 border border-[#E8DCCB] rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                title="Show Entire Route to Depot"
              >
                <ArrowUpRight size={12} className="text-blue-600" />
                <span className="hidden sm:inline">Fit Route</span>
              </button>
            </div>
          </div>

          {/* Interactive Leaflet Map Container */}
          <div
            ref={mapContainerRef}
            className="w-full h-[360px] sm:h-[420px] lg:h-[480px] bg-slate-100 relative z-0"
            style={{ minHeight: '340px' }}
          />

          {/* Bottom Coordinates & Accuracy Ribbon */}
          <div className="px-3 py-1.5 bg-[#FAF0E4]/80 border-t border-[#E8DCCB] text-[11px] font-mono flex items-center justify-between text-slate-600 flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Current GPS:</span>
              <span>
                Lat {currentLat.toFixed(5)} • Lng {currentLng.toFixed(5)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>
                Heading: <b>{heading}°</b>
              </span>
              <span>
                Signal Accuracy: <b>{gpsAccuracy ? `±${gpsAccuracy}m` : 'Normal'}</b>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Digital Speedometer HUD & Telemetry Metrics (4 columns) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E8DCCB] p-4 shadow-2xs flex flex-col justify-between text-center space-y-4">
          <div>
            <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
              Digital Speedometer
            </div>

            {/* Circular Speed Gauge */}
            <div className="relative inline-flex items-center justify-center w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-slate-900 border-6 border-orange-500 shadow-xl my-1">
              <div className="text-white text-center">
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-amber-400">
                  {currentSpeed}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  KM / H
                </div>
              </div>

              {/* Pulsing beacon ring when actively broadcasting */}
              {isTracking && (
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-25 pointer-events-none"></div>
              )}
            </div>

            {/* Vehicle Plate Badge */}
            <div className="mt-3">
              <span className="font-mono font-black text-xs px-3 py-1 bg-amber-400 text-slate-900 rounded-lg border border-slate-900 shadow-xs">
                {vehicleNumber}
              </span>
              <div className="text-[11px] font-bold text-slate-500 mt-1">
                {assignedVehicle?.modelName || 'Ashok Leyland Dost Plus'}
              </div>
            </div>
          </div>

          {/* 3 Telemetry Cards */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E8DCCB]">
            <div className="bg-[#FAF0E4] p-2 rounded-xl border border-[#E8DCCB]">
              <div className="text-[9px] font-bold text-slate-500 uppercase">Trip Run</div>
              <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                {tripDistanceKm} <span className="text-[9px] font-sans">KM</span>
              </div>
            </div>

            <div className="bg-[#FAF0E4] p-2 rounded-xl border border-[#E8DCCB]">
              <div className="text-[9px] font-bold text-slate-500 uppercase">Elapsed</div>
              <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                {elapsedTimeFormatted}
              </div>
            </div>

            <div className="bg-[#FAF0E4] p-2 rounded-xl border border-[#E8DCCB]">
              <div className="text-[9px] font-bold text-slate-500 uppercase">To Depot</div>
              <div className="text-sm font-black font-mono text-slate-900 mt-0.5">
                {distanceToDepot} <span className="text-[9px] font-sans">KM</span>
              </div>
            </div>
          </div>

          {/* Big High-Visibility Control Button */}
          <button
            type="button"
            onClick={onToggleGps}
            className={`w-full py-3 rounded-xl font-black text-xs shadow-md cursor-pointer active:scale-98 transition-all flex items-center justify-center gap-2 ${
              isTracking
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
            }`}
          >
            <Power size={16} />
            <span>{isTracking ? 'STOP GPS BROADCAST' : 'START LIVE GPS BROADCAST'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
