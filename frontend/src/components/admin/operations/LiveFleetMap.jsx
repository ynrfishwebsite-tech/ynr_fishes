import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Truck,
  Navigation,
  MapPin,
  Radio,
  Phone,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Gauge,
  Clock,
  Layers,
  Crosshair,
  Move,
  Settings,
  CheckCircle,
  AlertTriangle,
  X,
  Compass,
  Building,
  ClipboardPaste,
  Eye
} from 'lucide-react';
import io from 'socket.io-client';
import { getSocketUrl, getDriverTrackingUrl } from '../../../config';
import {
  getLiveLocations,
  getDepotConfig,
  saveDepotConfig,
  resetFleetSimulation
} from '../../../api/operations/vehicle';

// Fix default Leaflet icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// Accurate Kadapa Depot Coordinates for Chemmumiahpet, Ravindra Nagar, Utukuru road
const DEFAULT_DEPOT = {
  name: 'YNR Fishes — Kadapa Central Depot',
  address: 'Chemmumiahpet, Ravindra Nagar, Utukuru, Kadapa, AP 516004',
  phone: '+91 98493 13889',
  lat: 14.4628,
  lng: 78.8119,
  zoom: 15
};

// Distance calculation in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * 111320;
  const avgLatRad = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (111320 * Math.cos(avgLatRad));
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Geometric Radial Depot Yard & Anti-Collision Position Resolver
export function resolveFleetPositions(vehicles = [], depot) {
  const parked = [];
  const live = [];

  vehicles.forEach((v, idx) => {
    const hasLiveGps = Boolean(
      v.lastKnownLocation?.isTrackingActive &&
      v.lastKnownLocation?.lat &&
      v.lastKnownLocation?.lng
    );
    if (hasLiveGps) {
      live.push({ vehicle: v, originalIdx: idx });
    } else {
      parked.push({ vehicle: v, originalIdx: idx });
    }
  });

  const resultMap = new Map();

  // 1. Assign Dedicated Radial Parking Bays for Parked/Rest Vehicles around Depot
  // Distance: ~105m North/South (0.00095 deg), ~125m East/West (0.00120 deg)
  // Angles: Spaced evenly around Depot HQ, starting at 35° (North-East) to avoid overlapping the depot badge
  const totalParked = parked.length;
  parked.forEach((item, parkIdx) => {
    const angleStep = 360 / Math.max(totalParked, 3);
    const angleDeg = 35 + parkIdx * angleStep;
    const angleRad = (angleDeg * Math.PI) / 180;

    const rLat = 0.00095;
    const rLng = 0.00120;

    const lat = Number((depot.lat + rLat * Math.sin(angleRad)).toFixed(6));
    const lng = Number((depot.lng + rLng * Math.cos(angleRad)).toFixed(6));
    const key = (item.vehicle.vehicleNumber || item.vehicle._id || `veh_${item.originalIdx}`).trim().toUpperCase();

    resultMap.set(key, {
      lat,
      lng,
      isLive: false,
      bayNumber: parkIdx + 1,
      isAtDepotYard: true
    });
  });

  // 2. Process Live On-Road Vehicles
  live.forEach((item) => {
    let lat = Number(Number(item.vehicle.lastKnownLocation.lat).toFixed(6));
    let lng = Number(Number(item.vehicle.lastKnownLocation.lng).toFixed(6));
    const key = (item.vehicle.vehicleNumber || item.vehicle._id || `veh_${item.originalIdx}`).trim().toUpperCase();

    // Check if live vehicle is physically at or very near Depot (< 140 meters)
    const distToDepot = getDistanceMeters(lat, lng, depot.lat, depot.lng);
    let isAtDepotYard = false;

    if (distToDepot < 140) {
      // Place in dedicated Departure Lane (North-North-East, 155m out)
      isAtDepotYard = true;
      lat = Number((depot.lat + 0.00135).toFixed(6));
      lng = Number((depot.lng + 0.00025).toFixed(6));
    }

    resultMap.set(key, {
      lat,
      lng,
      isLive: true,
      bayNumber: null,
      isAtDepotYard
    });
  });

  // 3. Spiderfy Anti-Collision Pass (Nudge apart if any two vehicles are within 45m)
  const keys = Array.from(resultMap.keys());
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const posA = resultMap.get(keys[i]);
      const posB = resultMap.get(keys[j]);
      const dist = getDistanceMeters(posA.lat, posA.lng, posB.lat, posB.lng);

      if (dist < 50) {
        posA.lat += 0.00030;
        posA.lng -= 0.00035;
        posB.lat -= 0.00030;
        posB.lng += 0.00035;
      }
    }
  }

  return resultMap;
}

export default function LiveFleetMap({ vehicles = [], onRefresh }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const depotMarkerRef = useRef(null);
  const yardCircleRef = useRef(null);
  const bayLinesRef = useRef([]);
  const vehiclePositionsRef = useRef(new Map());
  const socketRef = useRef(null);

  const [depot, setDepot] = useState(DEFAULT_DEPOT);
  const [liveVehicles, setLiveVehicles] = useState(vehicles);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [copiedPlate, setCopiedPlate] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState(new Date());
  const [mapReady, setMapReady] = useState(false);

  // Mobile View Switcher: 'map' | 'list'
  const [mobileTab, setMobileTab] = useState('map');

  // Location Calibration States
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [pasteInput, setPasteInput] = useState('');
  const [editDepotForm, setEditDepotForm] = useState({
    name: DEFAULT_DEPOT.name,
    address: DEFAULT_DEPOT.address,
    phone: DEFAULT_DEPOT.phone,
    lat: DEFAULT_DEPOT.lat.toString(),
    lng: DEFAULT_DEPOT.lng.toString()
  });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper to create custom HTML Truck Marker Icon with Vehicle Plate & Driver Name
  const createVehicleIcon = (v, isLiveActive, bayNumber) => {
    const bgColor = isLiveActive ? '#10b981' : v.status === 'In Maintenance' ? '#f59e0b' : '#2563eb';
    const plate = v.vehicleNumber || 'Vehicle';
    const driver = v.driverName || 'Driver';
    const speed = v.lastKnownLocation?.speed || 0;
    const bayBadge = !isLiveActive && bayNumber ? `<span style="background: #1e40af; color: #ffffff; padding: 1px 5px; border-radius: 4px; font-size: 8.5px; font-weight: 800; margin-right: 3px;">BAY ${bayNumber}</span>` : '';

    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        ${
          isLiveActive
            ? `<div style="position: absolute; width: 56px; height: 56px; border-radius: 50%; background: #10b981; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; top: -8px;"></div>`
            : ''
        }
        <div style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: ${bgColor};
          border: 3px solid #ffffff;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 17px;
          position: relative;
          z-index: 2;
        ">
          🚚
        </div>
        <div style="
          margin-top: 3px;
          background: #0f172a;
          color: #f8fafc;
          padding: 3px 8px;
          border-radius: 6px;
          font-family: monospace;
          border: 1.5px solid ${isLiveActive ? '#10b981' : '#475569'};
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          text-align: center;
        ">
          <div style="font-weight: 900; font-size: 10.5px; color: #fbbf24; display: flex; align-items: center; justify-content: center;">
            ${bayBadge}<span>${plate}</span>
          </div>
          <div style="font-size: 9px; font-weight: 800; color: #cbd5e1; max-width: 125px; overflow: hidden; text-overflow: ellipsis;">
            👤 ${driver}
          </div>
          ${
            isLiveActive
              ? `<div style="font-size: 8.5px; font-weight: 900; color: #4ade80;">⚡ ${speed} KM/H (LIVE)</div>`
              : `<div style="font-size: 8px; font-weight: 700; color: #94a3b8;">🅿️ AT DEPOT YARD</div>`
          }
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-fleet-marker',
      iconSize: [64, 76],
      iconAnchor: [32, 20],
      popupAnchor: [0, -24]
    });
  };

  // Helper to create Popup HTML
  const createPopupHtml = (veh, isLiveActive, pos) => {
    return `
      <div style="font-family: sans-serif; min-width: 190px; max-width: 240px; padding: 2px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 4px;">
          <span style="font-family: monospace; font-weight: 900; background: #fef3c7; color: #1e293b; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a; font-size: 11px;">
            ${veh.vehicleNumber}
          </span>
          <span style="font-size: 9.5px; font-weight: 800; color: ${
            isLiveActive ? '#059669' : '#2563eb'
          };">
            ${isLiveActive ? '● Live on Road' : `🅿️ Depot (Bay ${pos?.bayNumber || 1})`}
          </span>
        </div>
        <strong style="color: #7c3f1d; font-size: 11.5px; display: block; margin-bottom: 2px;">${veh.modelName}</strong>
        <div style="font-size: 10.5px; color: #475569; line-height: 1.45;">
          👤 Driver: <strong style="color: #0f172a;">${veh.driverName || 'Not Assigned'}</strong><br />
          ⚡ Speed: <strong style="color: ${isLiveActive ? '#059669' : '#64748b'};">${isLiveActive ? veh.lastKnownLocation?.speed || 0 : 0} KM/H</strong><br />
          📏 Odometer: <strong>${veh.currentKm ? veh.currentKm.toLocaleString('en-IN') : 0} KM</strong><br />
          📍 Status: <span style="font-size: 9.5px; font-weight: 700; color: ${isLiveActive ? '#059669' : '#1e40af'};">
            ${isLiveActive ? 'Active GPS Transmission' : 'Parked at Kadapa Depot Yard'}
          </span>
        </div>
        ${
          veh.driverPhone
            ? `<a href="tel:${veh.driverPhone}" style="display: block; text-align: center; margin-top: 6px; padding: 5px 10px; background: #ea580c; color: white; border-radius: 6px; text-decoration: none; font-size: 10.5px; font-weight: 800;">
                 📞 Call Driver (${veh.driverPhone})
               </a>`
            : ''
        }
      </div>
    `;
  };

  // Create Depot HQ Icon
  const createDepotIcon = (isDragging = false) => {
    return L.divIcon({
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: ${isDragging ? 'grab' : 'pointer'};">
          ${
            isDragging
              ? `<div style="position: absolute; width: 56px; height: 56px; border-radius: 16px; background: #ea580c; opacity: 0.3; animation: ping 1s infinite;"></div>`
              : ''
          }
          <div style="
            width: 42px;
            height: 42px;
            border-radius: 14px;
            background: #7c3f1d;
            border: 3px solid ${isDragging ? '#f97316' : '#ea580c'};
            box-shadow: 0 6px 16px rgba(124, 63, 29, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 20px;
            z-index: 5;
            transition: transform 0.2s;
            ${isDragging ? 'transform: scale(1.15);' : ''}
          ">
            🐟
          </div>
          <div style="
            margin-top: 4px;
            background: #7c3f1d;
            color: #ffedd5;
            padding: 3px 8px;
            border-radius: 7px;
            font-weight: 800;
            font-size: 10.5px;
            border: 1.5px solid #fed7aa;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.2);
          ">
            ${isDragging ? '📍 Drag to Shop Roof' : 'Kadapa Store (HQ)'}
          </div>
        </div>
      `,
      className: 'custom-depot-marker',
      iconSize: [52, 70],
      iconAnchor: [26, 35],
      popupAnchor: [0, -30]
    });
  };

  // Fetch saved Depot configuration on mount
  useEffect(() => {
    const fetchDepot = async () => {
      try {
        const config = await getDepotConfig();
        if (config && config.lat && config.lng) {
          setDepot(config);
          setEditDepotForm({
            name: config.name || DEFAULT_DEPOT.name,
            address: config.address || DEFAULT_DEPOT.address,
            phone: config.phone || DEFAULT_DEPOT.phone,
            lat: config.lat.toString(),
            lng: config.lng.toString()
          });
        }
      } catch (err) {
        console.warn('Could not load remote depot config:', err);
      }
    };
    fetchDepot();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [depot.lat, depot.lng],
        zoom: depot.zoom || 15,
        zoomControl: true
      });

      // OpenStreetMap Standard Tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | YNR Fishes Logistics'
      }).addTo(map);

      // Add Depot HQ Marker (Base zIndexOffset 100 so fleet vehicles render above it)
      const depotMarker = L.marker([depot.lat, depot.lng], {
        icon: createDepotIcon(false),
        draggable: false,
        zIndexOffset: 100
      }).addTo(map);

      depotMarker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; min-width: 210px;">
          <strong style="color: #7c3f1d; font-size: 13px; display: block; margin-bottom: 3px;">
            ${depot.name}
          </strong>
          <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.4;">
            ${depot.address}<br />
            <strong>Phone:</strong> ${depot.phone}
          </p>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #fed7aa; font-size: 10px; color: #ea580c; font-weight: 700;">
            GPS: ${depot.lat.toFixed(5)}, ${depot.lng.toFixed(5)}
          </div>
        </div>
      `);

      // Drag event handler for calibration mode
      depotMarker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setEditDepotForm((prev) => ({
          ...prev,
          lat: lat.toFixed(6),
          lng: lng.toFixed(6)
        }));
      });

      depotMarkerRef.current = depotMarker;
      mapInstanceRef.current = map;
      setMapReady(true);

      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 250);
    }

    return () => {
      if (yardCircleRef.current) {
        try { yardCircleRef.current.remove(); } catch (_) {}
        yardCircleRef.current = null;
      }
      bayLinesRef.current.forEach((l) => {
        try { l.remove(); } catch (_) {}
      });
      bayLinesRef.current = [];

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
        setMapReady(false);
      }
    };
  }, []);

  // When depot state changes, update the map marker and view
  useEffect(() => {
    if (depotMarkerRef.current && mapInstanceRef.current) {
      depotMarkerRef.current.setLatLng([depot.lat, depot.lng]);
      depotMarkerRef.current.setIcon(createDepotIcon(isCalibrating));
      depotMarkerRef.current.setPopupContent(`
        <div style="font-family: sans-serif; padding: 4px; min-width: 210px;">
          <strong style="color: #7c3f1d; font-size: 13px; display: block; margin-bottom: 3px;">
            ${depot.name}
          </strong>
          <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.4;">
            ${depot.address}<br />
            <strong>Phone:</strong> ${depot.phone}
          </p>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #fed7aa; font-size: 10px; color: #ea580c; font-weight: 700;">
            GPS: ${depot.lat.toFixed(5)}, ${depot.lng.toFixed(5)}
          </div>
        </div>
      `);

      if (!isCalibrating) {
        mapInstanceRef.current.flyTo([depot.lat, depot.lng], 15, { duration: 1.2 });
      }
    }
  }, [depot, isCalibrating]);

  // Sync when parent vehicles list loads/updates
  useEffect(() => {
    if (vehicles && vehicles.length > 0) {
      setLiveVehicles(vehicles);
    }
  }, [vehicles]);

  // Sync Vehicles and Depot Yard Bays on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    // 1. Resolve Geometric Non-Overlapping Coordinates for all vehicles
    const resolvedPositions = resolveFleetPositions(liveVehicles, depot);
    vehiclePositionsRef.current = resolvedPositions;

    // 2. Draw/Update Depot Yard Boundary Ring (radius 135 meters)
    if (yardCircleRef.current && map.hasLayer(yardCircleRef.current)) {
      yardCircleRef.current.setLatLng([depot.lat, depot.lng]);
    } else {
      yardCircleRef.current = L.circle([depot.lat, depot.lng], {
        radius: 135,
        color: '#ea580c',
        dashArray: '5, 8',
        weight: 1.5,
        fillColor: '#fed7aa',
        fillOpacity: 0.08
      }).addTo(map);
    }

    // 3. Clear previous bay guide lines
    bayLinesRef.current.forEach((l) => {
      try { map.removeLayer(l); } catch (_) {}
    });
    bayLinesRef.current = [];

    // 4. Plot each vehicle in its dedicated bay / road position
    liveVehicles.forEach((veh, index) => {
      const markerKey = (veh.vehicleNumber || veh._id || `veh_${index}`).trim().toUpperCase();
      const pos = resolvedPositions.get(markerKey) || {
        lat: depot.lat,
        lng: depot.lng,
        isLive: false,
        bayNumber: index + 1,
        isAtDepotYard: true
      };

      const isTrackingActive = pos.isLive;

      // Draw subtle connector guide line from depot center to parking bay
      if (!isTrackingActive && pos.isAtDepotYard) {
        const bayLine = L.polyline([[depot.lat, depot.lng], [pos.lat, pos.lng]], {
          color: '#ea580c',
          dashArray: '3, 6',
          weight: 1.5,
          opacity: 0.45
        }).addTo(map);
        bayLinesRef.current.push(bayLine);
      }

      const coords = [pos.lat, pos.lng];
      const existingMarker = markersRef.current[markerKey];
      const isAttached = existingMarker && map.hasLayer(existingMarker);

      if (isAttached) {
        existingMarker.setLatLng(coords);
        existingMarker.setIcon(createVehicleIcon(veh, isTrackingActive, pos.bayNumber));
        existingMarker.setZIndexOffset(isTrackingActive ? 5000 : 2000 + (pos.bayNumber || 1) * 10);
        existingMarker.setPopupContent(createPopupHtml(veh, isTrackingActive, pos));
      } else {
        if (existingMarker) {
          try { existingMarker.remove(); } catch (_) {}
        }

        const marker = L.marker(coords, {
          icon: createVehicleIcon(veh, isTrackingActive, pos.bayNumber),
          zIndexOffset: isTrackingActive ? 5000 : 2000 + (pos.bayNumber || 1) * 10
        }).addTo(map);

        marker.bindPopup(createPopupHtml(veh, isTrackingActive, pos), {
          autoPan: true,
          autoPanPadding: [15, 15],
          maxWidth: 250
        });

        marker.on('click', () => setSelectedVehicle(veh));
        markersRef.current[markerKey] = marker;
      }
    });
  }, [liveVehicles, depot, mapReady]);

  // Auto-focus on active broadcasting driver if present
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || isCalibrating) return;

    const liveVeh = liveVehicles.find((v) => Boolean(v.lastKnownLocation?.isTrackingActive));
    if (liveVeh?.lastKnownLocation?.lat && liveVeh?.lastKnownLocation?.lng) {
      const markerKey = (liveVeh.vehicleNumber || liveVeh._id || '').trim().toUpperCase();
      const pos = vehiclePositionsRef.current.get(markerKey);
      const targetLat = pos ? pos.lat : liveVeh.lastKnownLocation.lat;
      const targetLng = pos ? pos.lng : liveVeh.lastKnownLocation.lng;

      map.flyTo([targetLat, targetLng], 16, { duration: 1.2 });
      const m = markersRef.current[markerKey];
      if (m && map.hasLayer(m)) {
        setTimeout(() => m.openPopup(), 600);
      }
    }
  }, [mapReady, liveVehicles]);

  // Invalidate map size on mobile tab switch
  useEffect(() => {
    if (mobileTab === 'map' && mapInstanceRef.current) {
      const timer = setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [mobileTab]);

  // Connect to live Socket.IO stream
  useEffect(() => {
    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsLiveConnected(true);
    });

    socket.on('disconnect', () => {
      setIsLiveConnected(false);
    });

    // Real-time location stream from driver phones
    socket.on('vehicle:location_stream', (data) => {
      setLastHeartbeat(new Date());
      if (!data || !data.vehicleNumber) return;

      const cleanPlate = data.vehicleNumber.trim().toUpperCase();

      setLiveVehicles((prev) => {
        const idx = prev.findIndex(
          (v) => (v.vehicleNumber || '').trim().toUpperCase() === cleanPlate
        );

        if (idx === -1) {
          return [
            ...prev,
            {
              _id: data.vehicleId || cleanPlate,
              vehicleNumber: cleanPlate,
              modelName: data.modelName || 'Fleet Vehicle',
              driverName: data.driverName || 'Driver',
              driverPhone: data.driverPhone || '',
              status: data.status || 'On Trip',
              lastKnownLocation: {
                lat: data.lat,
                lng: data.lng,
                speed: data.speed,
                heading: data.heading,
                accuracy: data.accuracy,
                isTrackingActive: Boolean(data.isTrackingActive),
                updatedAt: new Date()
              }
            }
          ];
        }

        return prev.map((v, i) =>
          i === idx
            ? {
                ...v,
                status: data.status || 'On Trip',
                driverName: data.driverName || v.driverName,
                driverPhone: data.driverPhone || v.driverPhone,
                lastKnownLocation: {
                  lat: data.lat,
                  lng: data.lng,
                  speed: data.speed,
                  heading: data.heading,
                  accuracy: data.accuracy,
                  isTrackingActive: Boolean(data.isTrackingActive),
                  updatedAt: new Date()
                }
              }
            : v
        );
      });

      // Smoothly pan map to live driver position (if not currently calibrating pin)
      if (data.isTrackingActive && data.lat && data.lng && mapInstanceRef.current && !isCalibrating) {
        mapInstanceRef.current.panTo([data.lat, data.lng], { animate: true, duration: 1 });
      }
    });

    // Reset all vehicles broadcast
    socket.on('vehicle:reset_all', () => {
      setLiveVehicles((prev) =>
        prev.map((v) => ({
          ...v,
          status: 'Available',
          lastKnownLocation: {
            lat: depot.lat,
            lng: depot.lng,
            speed: 0,
            heading: 0,
            accuracy: 10,
            isTrackingActive: false,
            updatedAt: new Date()
          }
        }))
      );
      showToast('All fleet vehicles returned to Depot parking bays', 'info');
    });

    // Polling fallback every 15s to keep live data accurate
    const pollInterval = setInterval(async () => {
      try {
        const list = await getLiveLocations();
        if (list && list.length > 0) {
          setLiveVehicles(list);
        }
      } catch (_) {}
    }, 15000);

    return () => {
      socket.disconnect();
      clearInterval(pollInterval);
    };
  }, [depot, isCalibrating]);

  // 1. One-Click Auto-Detect Shop GPS
  const handleAutoDetectGPS = () => {
    if (!navigator.geolocation) {
      showToast('GPS Geolocation is not supported by this browser.', 'error');
      return;
    }

    setIsDetectingGps(true);
    showToast('📡 Detecting exact GPS coordinates from your device...', 'info');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsDetectingGps(false);
        const newLat = Number(pos.coords.latitude.toFixed(6));
        const newLng = Number(pos.coords.longitude.toFixed(6));

        const updatedDepot = {
          ...depot,
          lat: newLat,
          lng: newLng
        };

        setDepot(updatedDepot);
        setEditDepotForm((prev) => ({
          ...prev,
          lat: newLat.toString(),
          lng: newLng.toString()
        }));

        try {
          await saveDepotConfig(updatedDepot);
          showToast(`🎯 Store Location calibrated to your exact device GPS: ${newLat}, ${newLng}`, 'success');
        } catch (_) {
          showToast(`Depot updated locally to ${newLat}, ${newLng}`, 'info');
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([newLat, newLng], 16, { duration: 1.5 });
        }
      },
      (err) => {
        setIsDetectingGps(false);
        showToast(`GPS Detection Failed: ${err.message}. Please enable location permission.`, 'error');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // 2. Toggle Pin Drag Mode
  const toggleCalibratePin = () => {
    const nextState = !isCalibrating;
    setIsCalibrating(nextState);

    if (depotMarkerRef.current) {
      if (nextState) {
        depotMarkerRef.current.dragging.enable();
        depotMarkerRef.current.setIcon(createDepotIcon(true));
        showToast('📍 Pin Draggable: Drag the orange fish icon to your exact shop building on the map!', 'info');
      } else {
        depotMarkerRef.current.dragging.disable();
        depotMarkerRef.current.setIcon(createDepotIcon(false));
      }
    }
  };

  // 3. Save Pin After Dragging
  const handleSaveDraggedLocation = async () => {
    if (!depotMarkerRef.current) return;
    const currentPos = depotMarkerRef.current.getLatLng();
    const newLat = Number(currentPos.lat.toFixed(6));
    const newLng = Number(currentPos.lng.toFixed(6));

    const updatedDepot = {
      ...depot,
      lat: newLat,
      lng: newLng
    };

    setDepot(updatedDepot);
    setIsCalibrating(false);
    depotMarkerRef.current.dragging.disable();
    depotMarkerRef.current.setIcon(createDepotIcon(false));

    try {
      await saveDepotConfig(updatedDepot);
      showToast(`✅ Exact Shop Location saved successfully: ${newLat}, ${newLng}!`, 'success');
    } catch (err) {
      showToast('Depot location updated locally', 'info');
    }
  };

  // 4. Quick Parse Google Maps Link or Coords
  const handleParseGoogleMapsInput = () => {
    if (!pasteInput.trim()) return;

    // Pattern 1: e.g. 14.4628, 78.8119 or 14.4628,78.8119
    const directCoordsMatch = pasteInput.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (directCoordsMatch) {
      const lat = directCoordsMatch[1];
      const lng = directCoordsMatch[2];
      setEditDepotForm((prev) => ({ ...prev, lat, lng }));
      showToast(`Parsed Coordinates: ${lat}, ${lng}`, 'success');
      return;
    }

    // Pattern 2: Google Maps URL containing @14.4628,78.8119
    const urlMatch = pasteInput.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (urlMatch) {
      const lat = urlMatch[1];
      const lng = urlMatch[2];
      setEditDepotForm((prev) => ({ ...prev, lat, lng }));
      showToast(`Extracted from URL: ${lat}, ${lng}`, 'success');
      return;
    }

    showToast('Could not find latitude & longitude in text', 'error');
  };

  // 5. Manual Modal Save
  const handleSaveModalConfig = async (e) => {
    e.preventDefault();
    const lat = parseFloat(editDepotForm.lat);
    const lng = parseFloat(editDepotForm.lng);

    if (isNaN(lat) || isNaN(lng)) {
      showToast('Invalid Latitude or Longitude numbers', 'error');
      return;
    }

    const updatedDepot = {
      ...depot,
      name: editDepotForm.name,
      address: editDepotForm.address,
      phone: editDepotForm.phone,
      lat,
      lng
    };

    setDepot(updatedDepot);
    setShowConfigModal(false);

    try {
      await saveDepotConfig(updatedDepot);
      showToast('✅ Depot configuration updated across all terminals!', 'success');
    } catch (_) {
      showToast('Depot updated locally', 'info');
    }
  };

  // 6. Reset All Vehicles to Depot
  const handleResetFleet = async () => {
    try {
      await resetFleetSimulation();
      showToast('🔄 All vehicles returned to Depot parking bays', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Reset failed: ' + err.message, 'error');
    }
  };

  // Focus specific vehicle (with mobile tab switch and zIndex pop)
  const focusVehicle = (v) => {
    setSelectedVehicle(v);
    const map = mapInstanceRef.current;
    if (!map) return;

    // Switch to map view if on mobile
    setMobileTab('map');
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 150);

    const markerKey = (v.vehicleNumber || v._id || '').trim().toUpperCase();
    const pos = vehiclePositionsRef.current.get(markerKey);
    const targetLat = pos ? pos.lat : depot.lat;
    const targetLng = pos ? pos.lng : depot.lng;

    map.flyTo([targetLat, targetLng], 16, { duration: 1.2 });

    const marker = markersRef.current[markerKey];
    if (marker && map.hasLayer(marker)) {
      marker.setZIndexOffset(10000);
      setTimeout(() => marker.openPopup(), 650);
    }
  };

  // Driver link generator (Resolves dynamic host/domain)
  const getDriverLink = (plate) => {
    return getDriverTrackingUrl(plate);
  };

  const handleCopyLink = (plate) => {
    const link = getDriverLink(plate);
    navigator.clipboard.writeText(link);
    setCopiedPlate(plate);
    setTimeout(() => setCopiedPlate(null), 2500);
  };

  const handleShareWhatsApp = (veh) => {
    const link = getDriverLink(veh.vehicleNumber);
    const msg = `Hello ${veh.driverName || 'Driver'},\nPlease click this link to start live GPS delivery tracking for YNR Fishes (${veh.vehicleNumber}):\n${link}`;
    const phone = veh.driverPhone ? veh.driverPhone.replace(/\D/g, '') : '';
    const waUrl = phone
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const liveCount = liveVehicles.filter((v) => v.lastKnownLocation?.isTrackingActive).length;
  const parkedCount = liveVehicles.length - liveCount;

  return (
    <div className="space-y-2.5 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-300'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            ) : (
              <Crosshair size={16} className="text-amber-600 animate-spin shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Calibration Banner (When user activates Pin Dragging) */}
      {isCalibrating && (
        <div className="p-3 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <Move size={20} className="shrink-0" />
            <div>
              <div className="font-extrabold text-sm">Shop Pin Calibration Mode Active</div>
              <div className="text-xs text-orange-100">
                Drag the fish marker on the map to your exact shop rooftop / front door, then click "Save Exact Pin".
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraggedLocation}
              className="px-3.5 py-1.5 bg-white text-[#7c3f1d] hover:bg-orange-50 rounded-lg text-xs font-bold shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} className="text-emerald-600" />
              Save Exact Pin
            </button>
            <button
              onClick={() => {
                setIsCalibrating(false);
                if (depotMarkerRef.current) {
                  depotMarkerRef.current.dragging.disable();
                  depotMarkerRef.current.setLatLng([depot.lat, depot.lng]);
                  depotMarkerRef.current.setIcon(createDepotIcon(false));
                }
              }}
              className="px-3 py-1.5 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher (Visible on small screens < lg) */}
      <div className="flex items-center p-1 bg-[#fffaf5] border border-[#fed7aa] rounded-xl lg:hidden shadow-2xs">
        <button
          type="button"
          onClick={() => {
            setMobileTab('map');
            setTimeout(() => {
              if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
            }, 150);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'map'
              ? 'bg-[#7c3f1d] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Navigation size={13} className={mobileTab === 'map' ? 'text-amber-300' : 'text-[#ea580c]'} />
          <span>Live Fleet Map</span>
          {liveCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'list'
              ? 'bg-[#7c3f1d] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Truck size={13} className={mobileTab === 'list' ? 'text-amber-300' : 'text-[#ea580c]'} />
          <span>Fleet GPS Status ({liveVehicles.length})</span>
        </button>
      </div>

      {/* Main Grid: Map & Fleet Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Map Column (2 spans on desktop) */}
        <div
          className={`lg:col-span-2 bg-white rounded-2xl border border-[#FED7AA] shadow-sm overflow-hidden flex flex-col relative isolate ${
            mobileTab === 'list' ? 'hidden lg:flex' : 'flex'
          } h-[470px] sm:h-[530px] lg:h-[620px]`}
          style={{ zIndex: 1 }}
        >
          {/* Map Header Status & Action Bar */}
          <div className="p-2.5 sm:p-3 bg-[#fffaf5] border-b border-[#fed7aa] flex flex-col sm:flex-row sm:items-center justify-between gap-2 z-10">
            {/* Left: Location & Title */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 bg-[#ea580c] text-white rounded-lg shrink-0">
                  <Navigation size={15} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-[#7c3f1d] text-xs sm:text-sm truncate">
                      Live Fleet & Store GPS
                    </h3>
                    {isLiveConnected ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                        Live
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0">
                        Polling
                      </span>
                    )}
                  </div>
                  <div className="text-[10.5px] text-slate-500 font-medium truncate max-w-[210px] sm:max-w-[340px]">
                    📍 {depot.address}
                  </div>
                </div>
              </div>

              {/* Mobile Track Live Button */}
              {liveVehicles.some((v) => v.lastKnownLocation?.isTrackingActive) && (
                <button
                  type="button"
                  onClick={() => {
                    const liveVeh = liveVehicles.find((v) => v.lastKnownLocation?.isTrackingActive);
                    if (liveVeh) focusVehicle(liveVeh);
                  }}
                  className="sm:hidden px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 animate-pulse shrink-0 cursor-pointer shadow-xs"
                >
                  <Radio size={11} className="animate-spin text-emerald-200" />
                  <span>Live</span>
                </button>
              )}
            </div>

            {/* Right: Calibration & Quick Actions */}
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:py-0">
              {/* One-Click GPS Auto Detect */}
              <button
                onClick={handleAutoDetectGPS}
                disabled={isDetectingGps}
                title="Automatically detect shop location from your browser/device GPS"
                className="px-2 sm:px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
              >
                <Crosshair size={12} className={isDetectingGps ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isDetectingGps ? 'Locating...' : 'Auto-Detect Shop GPS'}</span>
                <span className="sm:hidden">{isDetectingGps ? 'GPS...' : 'Auto GPS'}</span>
              </button>

              {/* Pin Drag Mode */}
              <button
                onClick={toggleCalibratePin}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 border cursor-pointer ${
                  isCalibrating
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white hover:bg-orange-50 text-[#7c3f1d] border-[#fed7aa]'
                }`}
                title="Drag and drop depot pin directly onto your shop rooftop"
              >
                <Move size={12} />
                <span>{isCalibrating ? 'Dragging' : 'Drag Pin'}</span>
              </button>

              {/* Settings Modal */}
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-2 sm:px-2.5 py-1.5 bg-white hover:bg-orange-50 text-[#7c3f1d] border border-[#fed7aa] rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                title="Configure depot address & coordinates manually"
              >
                <Settings size={12} />
                <span className="hidden sm:inline">Settings</span>
              </button>

              {/* Center Depot */}
              <button
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (map) map.flyTo([depot.lat, depot.lng], 15);
                }}
                className="px-2 sm:px-2.5 py-1.5 bg-white hover:bg-orange-50 border border-[#fed7aa] rounded-lg text-xs font-semibold text-[#7c3f1d] transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                title="Center map on shop depot"
              >
                <Building size={12} className="sm:hidden inline" />
                <span className="hidden sm:inline">Center Depot</span>
              </button>

              {/* Desktop Track Live Driver button */}
              {liveVehicles.some((v) => v.lastKnownLocation?.isTrackingActive) && (
                <button
                  type="button"
                  onClick={() => {
                    const liveVeh = liveVehicles.find((v) => v.lastKnownLocation?.isTrackingActive);
                    if (liveVeh) focusVehicle(liveVeh);
                  }}
                  className="hidden sm:flex px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all items-center gap-1.5 shadow-xs animate-pulse cursor-pointer shrink-0"
                  title="Center map on live driver position"
                >
                  <Radio size={12} className="animate-spin text-emerald-200" />
                  <span>
                    Track {liveVehicles.find((v) => v.lastKnownLocation?.isTrackingActive)?.vehicleNumber}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Map Canvas (Contained stacking context so Leaflet cannot overlay modals) */}
          <div
            ref={mapContainerRef}
            className="flex-1 w-full h-full relative isolate"
            style={{ zIndex: 0 }}
          />

          {/* Bottom Bar: Coordinates Summary & Reset */}
          <div className="p-2 sm:p-2.5 bg-white/95 backdrop-blur-xs border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[10.5px] sm:text-[11px] text-slate-600 z-10 px-3">
            <span className="flex items-center gap-1.5">
              <Compass size={13} className="text-[#ea580c] shrink-0" />
              <span>
                <strong>Store Hub:</strong> {depot.lat.toFixed(5)}°N, {depot.lng.toFixed(5)}°E
              </span>
            </span>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-slate-400">|</span>
              <span className="text-emerald-700 font-bold">
                {liveCount} Live
              </span>
              <span className="text-blue-700 font-bold">
                {parkedCount} at Depot Yard
              </span>
              <span className="text-slate-300">•</span>
              <button
                onClick={handleResetFleet}
                className="text-[#ea580c] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                title="Reset all vehicles to depot parking bays"
              >
                <RefreshCw size={11} /> <span>Reset Fleet</span>
              </button>
            </div>
          </div>
        </div>

        {/* Fleet Live List Sidebar (1 span on desktop) */}
        <div
          className={`bg-white rounded-2xl border border-[#FED7AA] p-3 sm:p-4 shadow-sm flex flex-col justify-between overflow-y-auto ${
            mobileTab === 'map' ? 'hidden lg:flex' : 'flex'
          } max-h-[620px]`}
        >
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#fed7aa]">
              <h3 className="font-bold text-[#7c3f1d] text-sm flex items-center gap-1.5">
                <Radio size={16} className="text-[#ea580c]" />
                Fleet GPS Status
              </h3>
              <span className="text-xs text-slate-500 font-semibold">{liveVehicles.length} Vehicles</span>
            </div>

            <div className="space-y-2.5 sm:space-y-3">
              {liveVehicles.map((v, idx) => {
                const key = (v.vehicleNumber || v._id || `veh_${idx}`).trim().toUpperCase();
                const pos = vehiclePositionsRef.current?.get(key);
                const isLiveActive = Boolean(v.lastKnownLocation?.isTrackingActive);
                return (
                  <div
                    key={v._id || key}
                    onClick={() => focusVehicle(v)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedVehicle?._id === v._id
                        ? 'bg-orange-50/80 border-[#ea580c] ring-2 ring-orange-200'
                        : 'bg-[#FAF0E4]/50 hover:bg-[#FAF0E4] border-[#fed7aa]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-amber-400 text-slate-900 font-mono font-extrabold text-xs rounded border border-slate-900 shadow-2xs">
                        {v.vehicleNumber}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isLiveActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isLiveActive ? '● Live on Road' : `🅿️ Depot (Bay ${pos?.bayNumber || idx + 1})`}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-slate-700">
                      <div className="font-bold text-[#7c3f1d]">{v.modelName}</div>
                      <div className="flex items-center justify-between text-slate-500 mt-1">
                        <span>
                          Driver: <strong className="text-slate-800">{v.driverName || 'Not Assigned'}</strong>
                        </span>
                        <span className={`font-mono font-bold ${isLiveActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {isLiveActive ? `${v.lastKnownLocation?.speed || 0} KM/H` : '0 KM/H'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 pt-2.5 border-t border-orange-200/60 flex items-center justify-between gap-1.5 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          focusVehicle(v);
                        }}
                        className="flex-1 py-1 px-2 bg-orange-100 hover:bg-orange-200 text-[#7c3f1d] rounded-lg text-[11px] font-bold border border-orange-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Locate vehicle on map"
                      >
                        <Compass size={12} className="text-[#ea580c]" />
                        <span>Locate</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(v.vehicleNumber);
                        }}
                        className="flex-1 py-1 px-2 bg-white hover:bg-orange-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                        title="Copy GPS link for driver smartphone"
                      >
                        {copiedPlate === v.vehicleNumber ? (
                          <>
                            <Check size={12} className="text-emerald-600" />
                            <span className="text-emerald-700 font-bold">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareWhatsApp(v);
                        }}
                        className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-2xs cursor-pointer"
                        title="Send tracking link to driver via WhatsApp"
                      >
                        <MessageSquare size={12} />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Info Note */}
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <strong className="text-[#7c3f1d] block flex items-center gap-1">
              <Compass size={13} className="text-[#ea580c]" />
              Depot Yard Parking Bays
            </strong>
            <p>
              Vehicles resting at Kadapa Depot are neatly distributed across dedicated radial parking bays around the store pin so all vehicle numbers and driver names stay completely visible and readable.
            </p>
          </div>
        </div>
      </div>

      {/* Manual Depot Location Settings Modal */}
      {showConfigModal && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 99999 }}
          onClick={() => setShowConfigModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full border border-[#FED7AA] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ zIndex: 100000 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#FAF0E4] border-b border-[#fed7aa] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#ea580c] text-white rounded-xl shadow-xs">
                  <Building size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[#7c3f1d] text-base">Store Depot Location Settings</h3>
                  <p className="text-[11px] text-slate-500">Configure central hub GPS coordinates and address</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Actions Bar inside Modal */}
            <div className="p-3 bg-orange-50/70 border-b border-orange-200/60 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#7c3f1d]">Quick GPS Tools:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    handleAutoDetectGPS();
                  }}
                  disabled={isDetectingGps}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <Crosshair size={12} className={isDetectingGps ? 'animate-spin' : ''} />
                  <span>{isDetectingGps ? 'Detecting...' : 'Use My GPS'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(false);
                    toggleCalibratePin();
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-orange-100 text-[#7c3f1d] border border-[#fed7aa] rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Move size={12} />
                  <span>Pick on Map</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveModalConfig} className="p-4 sm:p-5 space-y-3.5">
              {/* Paste Google Maps link or coordinates */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Paste Google Maps Link or Coordinates (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    placeholder="e.g. 14.4628, 78.8119 or https://maps.app.goo.gl/..."
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleParseGoogleMapsInput}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <ClipboardPaste size={13} />
                    <span>Apply</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store / Hub Name</label>
                <input
                  type="text"
                  value={editDepotForm.name}
                  onChange={(e) => setEditDepotForm({ ...editDepotForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-hidden font-medium"
                  placeholder="YNR Fishes — Kadapa Central Depot"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Shop Address</label>
                <input
                  type="text"
                  value={editDepotForm.address}
                  onChange={(e) => setEditDepotForm({ ...editDepotForm, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-hidden"
                  placeholder="Chemmumiahpet, Ravindra Nagar, Utukuru, Kadapa 516004"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editDepotForm.lat}
                    onChange={(e) => setEditDepotForm({ ...editDepotForm, lat: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-hidden bg-slate-50"
                    placeholder="14.4628"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={editDepotForm.lng}
                    onChange={(e) => setEditDepotForm({ ...editDepotForm, lng: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-hidden bg-slate-50"
                    placeholder="78.8119"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={editDepotForm.phone}
                  onChange={(e) => setEditDepotForm({ ...editDepotForm, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ea580c] outline-hidden"
                  placeholder="+91 98493 13889"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check size={14} />
                  <span>Save Store Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
