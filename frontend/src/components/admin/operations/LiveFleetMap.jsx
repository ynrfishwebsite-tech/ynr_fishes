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
  ClipboardPaste
} from 'lucide-react';
import io from 'socket.io-client';
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

export default function LiveFleetMap({ vehicles = [], onRefresh }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const depotMarkerRef = useRef(null);
  const socketRef = useRef(null);

  const [depot, setDepot] = useState(DEFAULT_DEPOT);
  const [liveVehicles, setLiveVehicles] = useState(vehicles);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [copiedPlate, setCopiedPlate] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [lastHeartbeat, setLastHeartbeat] = useState(new Date());

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

  // Helper to create custom HTML Truck Marker Icon
  const createVehicleIcon = (v, isLiveActive) => {
    const bgColor = isLiveActive ? '#10b981' : v.status === 'In Maintenance' ? '#f59e0b' : '#3b82f6';

    const html = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        ${
          isLiveActive
            ? `<div style="position: absolute; width: 46px; height: 46px; border-radius: 50%; background: ${bgColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
            : ''
        }
        <div style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${bgColor};
          border: 3px solid #ffffff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
          position: relative;
          z-index: 2;
        ">
          🚚
        </div>
        <div style="
          margin-top: 4px;
          background: #0f172a;
          color: #f8fafc;
          padding: 2px 6px;
          border-radius: 6px;
          font-family: monospace;
          font-weight: 800;
          font-size: 10px;
          border: 1px solid #334155;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        ">
          ${v.vehicleNumber}
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-fleet-marker',
      iconSize: [46, 56],
      iconAnchor: [23, 28],
      popupAnchor: [0, -26]
    });
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
            width: 44px;
            height: 44px;
            border-radius: 14px;
            background: #7c3f1d;
            border: 3px solid ${isDragging ? '#f97316' : '#ea580c'};
            box-shadow: 0 6px 16px rgba(124, 63, 29, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 22px;
            z-index: 5;
            transition: transform 0.2s;
            ${isDragging ? 'transform: scale(1.15);' : ''}
          ">
            🐟
          </div>
          <div style="
            margin-top: 5px;
            background: #7c3f1d;
            color: #ffedd5;
            padding: 3px 9px;
            border-radius: 8px;
            font-weight: 800;
            font-size: 11px;
            border: 1.5px solid #fed7aa;
            white-space: nowrap;
            box-shadow: 0 3px 8px rgba(0,0,0,0.2);
          ">
            ${isDragging ? '📍 Drag to Shop Roof' : 'Kadapa Store (HQ)'}
          </div>
        </div>
      `,
      className: 'custom-depot-marker',
      iconSize: [50, 68],
      iconAnchor: [25, 34],
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

      // Add Depot HQ Marker
      const depotMarker = L.marker([depot.lat, depot.lng], {
        icon: createDepotIcon(false),
        draggable: false,
        zIndexOffset: 1000
      }).addTo(map);

      depotMarker.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
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
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // When depot state changes, update the map marker and view
  useEffect(() => {
    if (depotMarkerRef.current && mapInstanceRef.current) {
      depotMarkerRef.current.setLatLng([depot.lat, depot.lng]);
      depotMarkerRef.current.setIcon(createDepotIcon(isCalibrating));
      depotMarkerRef.current.setPopupContent(`
        <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
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

  // Sync Vehicles on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    liveVehicles.forEach((veh, index) => {
      const isTrackingActive = Boolean(veh.lastKnownLocation?.isTrackingActive);

      let lat, lng;
      if (isTrackingActive && veh.lastKnownLocation?.lat && veh.lastKnownLocation?.lng) {
        lat = veh.lastKnownLocation.lat;
        lng = veh.lastKnownLocation.lng;
      } else {
        // Parked in shop yard (slight distinct offset: 0.00015 is ~15 meters)
        lat = depot.lat + (index % 2 === 0 ? 0.0002 : -0.0002) * (Math.floor(index / 2) + 1);
        lng = depot.lng + (index % 2 === 0 ? 0.00025 : -0.00025) * (Math.floor(index / 2) + 1);
      }

      const coords = [lat, lng];

      if (markersRef.current[veh._id]) {
        // Move existing marker smoothly
        markersRef.current[veh._id].setLatLng(coords);
        markersRef.current[veh._id].setIcon(createVehicleIcon(veh, isTrackingActive));
      } else {
        // Create new vehicle marker
        const marker = L.marker(coords, { icon: createVehicleIcon(veh, isTrackingActive) }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 190px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-family: monospace; font-weight: 800; background: #fef3c7; color: #1e293b; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a; font-size: 11px;">
                ${veh.vehicleNumber}
              </span>
              <span style="font-size: 10px; font-weight: 700; color: ${
                isTrackingActive ? '#059669' : '#2563eb'
              }">
                ${isTrackingActive ? '● Live on Road' : '🅿️ At Depot'}
              </span>
            </div>
            <strong style="color: #7c3f1d; font-size: 12px;">${veh.modelName}</strong>
            <div style="font-size: 11px; color: #475569; margin-top: 4px; line-height: 1.4;">
              👤 Driver: <strong>${veh.driverName || 'Not Assigned'}</strong><br />
              ⚡ Speed: <strong>${isTrackingActive ? veh.lastKnownLocation?.speed || 0 : 0} KM/H</strong><br />
              📏 Odo: <strong>${veh.currentKm ? veh.currentKm.toLocaleString('en-IN') : 0} KM</strong>
            </div>
            ${
              veh.driverPhone
                ? `<a href="tel:${veh.driverPhone}" style="display: inline-block; margin-top: 6px; padding: 4px 8px; background: #ea580c; color: white; border-radius: 6px; text-decoration: none; font-size: 10px; font-weight: 700;">
                     📞 Call Driver
                   </a>`
                : ''
            }
          </div>
        `);

        marker.on('click', () => setSelectedVehicle(veh));
        markersRef.current[veh._id] = marker;
      }
    });
  }, [liveVehicles, depot]);

  // Connect to live Socket.IO stream
  useEffect(() => {
    const backendHost = window.location.hostname;
    const socket = io(`http://${backendHost}:5000`, { transports: ['websocket', 'polling'] });
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
      setLiveVehicles((prev) =>
        prev.map((v) => {
          if (v.vehicleNumber === data.vehicleNumber) {
            return {
              ...v,
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
            };
          }
          return v;
        })
      );
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
            isTrackingActive: false,
            updatedAt: new Date()
          }
        }))
      );
      showToast('All fleet vehicles reset to Depot parking', 'info');
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
  }, [depot]);

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
      showToast('🔄 All vehicles reset to Depot parking', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('Reset failed: ' + err.message, 'error');
    }
  };

  // Focus specific vehicle
  const focusVehicle = (v) => {
    setSelectedVehicle(v);
    const map = mapInstanceRef.current;
    if (!map) return;

    const isTrackingActive = Boolean(v.lastKnownLocation?.isTrackingActive);
    const lat = isTrackingActive && v.lastKnownLocation?.lat ? v.lastKnownLocation.lat : depot.lat;
    const lng = isTrackingActive && v.lastKnownLocation?.lng ? v.lastKnownLocation.lng : depot.lng;

    map.flyTo([lat, lng], 16, { duration: 1.2 });

    const marker = markersRef.current[v._id];
    if (marker) {
      marker.openPopup();
    }
  };

  // Driver link generator
  const getDriverLink = (plate) => {
    const host = window.location.host;
    const proto = window.location.protocol;
    return `${proto}//${host}/driver-gps?v=${encodeURIComponent(plate)}`;
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

  return (
    <div className="space-y-3 relative">
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
              <CheckCircle size={16} className="text-emerald-600" />
            ) : toast.type === 'error' ? (
              <AlertTriangle size={16} className="text-rose-600" />
            ) : (
              <Crosshair size={16} className="text-amber-600 animate-spin" />
            )}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-700">
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
              className="px-3.5 py-1.5 bg-white text-[#7c3f1d] hover:bg-orange-50 rounded-lg text-xs font-bold shadow transition-all flex items-center gap-1.5"
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
              className="px-3 py-1.5 bg-black/20 hover:bg-black/30 text-white rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Column (2 spans on desktop) */}
        <div
          className="lg:col-span-2 bg-white rounded-2xl border border-[#FED7AA] shadow-sm overflow-hidden flex flex-col h-[400px] sm:h-[500px] lg:h-[600px] relative isolate"
          style={{ zIndex: 1 }}
        >
          {/* Map Header Status & Action Bar */}
          <div className="p-3 bg-[#fffaf5] border-b border-[#fed7aa] flex flex-wrap items-center justify-between gap-2 z-10">
            {/* Left: Location & Title */}
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#ea580c] text-white rounded-lg">
                <Navigation size={16} />
              </div>
              <div>
                <h3 className="font-bold text-[#7c3f1d] text-sm flex items-center gap-2">
                  <span>Live Fleet & Store GPS</span>
                  {isLiveConnected ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      Live Socket
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                      Polling
                    </span>
                  )}
                </h3>
                <div className="text-[11px] text-slate-500 font-medium truncate max-w-[280px] sm:max-w-[380px]">
                  📍 {depot.address}
                </div>
              </div>
            </div>

            {/* Right: Calibration Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* One-Click GPS Auto Detect */}
              <button
                onClick={handleAutoDetectGPS}
                disabled={isDetectingGps}
                title="Automatically detect shop location from your browser/device GPS"
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              >
                <Crosshair size={13} className={isDetectingGps ? 'animate-spin' : ''} />
                <span>{isDetectingGps ? 'Locating...' : 'Auto-Detect Shop GPS'}</span>
              </button>

              {/* Pin Drag Mode */}
              <button
                onClick={toggleCalibratePin}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isCalibrating
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white hover:bg-orange-50 text-[#7c3f1d] border-[#fed7aa]'
                }`}
                title="Drag and drop depot pin directly onto your shop rooftop"
              >
                <Move size={13} />
                <span>{isCalibrating ? 'Draggable...' : 'Drag Pin'}</span>
              </button>

              {/* Settings Modal */}
              <button
                onClick={() => setShowConfigModal(true)}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 text-[#7c3f1d] border border-[#fed7aa] rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                title="Configure depot address & coordinates manually"
              >
                <Settings size={13} />
                <span>Settings</span>
              </button>

              {/* Reset to Depot */}
              <button
                onClick={() => {
                  const map = mapInstanceRef.current;
                  if (map) map.flyTo([depot.lat, depot.lng], 15);
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-orange-50 border border-[#fed7aa] rounded-lg text-xs font-semibold text-[#7c3f1d] transition-all"
                title="Center map on shop depot"
              >
                Center Depot
              </button>
            </div>
          </div>

          {/* Map Canvas (Contained stacking context so Leaflet panes cannot punch through modals) */}
          <div
            ref={mapContainerRef}
            className="flex-1 w-full h-full relative isolate"
            style={{ zIndex: 0 }}
          />

          {/* Bottom Bar: Coordinates Summary */}
          <div className="p-2.5 bg-white/95 backdrop-blur-xs border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 z-10 px-3">
            <span className="flex items-center gap-1.5">
              <Compass size={13} className="text-[#ea580c]" />
              <strong>Store Pin:</strong> {depot.lat.toFixed(5)}°N, {depot.lng.toFixed(5)}°E
            </span>
            <button
              onClick={handleResetFleet}
              className="text-[#ea580c] hover:underline font-semibold flex items-center gap-1"
              title="Reset all vehicles to depot parking"
            >
              <RefreshCw size={11} /> Reset Fleet to Shop
            </button>
          </div>
        </div>

        {/* Fleet Live List Sidebar (1 span) */}
        <div className="bg-white rounded-2xl border border-[#FED7AA] p-4 shadow-sm flex flex-col justify-between max-h-[600px] overflow-y-auto">
          <div>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#fed7aa]">
              <h3 className="font-bold text-[#7c3f1d] text-sm flex items-center gap-1.5">
                <Radio size={16} className="text-[#ea580c]" />
                Fleet GPS Status
              </h3>
              <span className="text-xs text-slate-500 font-semibold">{liveVehicles.length} Vehicles</span>
            </div>

            <div className="space-y-3">
              {liveVehicles.map((v) => {
                const isLiveActive = Boolean(v.lastKnownLocation?.isTrackingActive);
                return (
                  <div
                    key={v._id}
                    onClick={() => focusVehicle(v)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedVehicle?._id === v._id
                        ? 'bg-orange-50/70 border-[#ea580c] ring-2 ring-orange-200'
                        : 'bg-[#FAF0E4]/50 hover:bg-[#FAF0E4] border-[#fed7aa]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 bg-amber-400 text-slate-900 font-mono font-extrabold text-xs rounded border border-slate-900 shadow-xs">
                        {v.vehicleNumber}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isLiveActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {isLiveActive ? '● Live on Road' : '🅿️ At Depot'}
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

                    {/* Share Driver Link Buttons */}
                    <div className="mt-3 pt-2.5 border-t border-orange-200/60 flex items-center justify-between gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(v.vehicleNumber);
                        }}
                        className="flex-1 py-1 px-2 bg-white hover:bg-orange-100 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 flex items-center justify-center gap-1 transition-colors"
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
                        className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors shadow-xs"
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

          {/* Option 1 Info Note */}
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] text-slate-600 space-y-1">
            <strong className="text-[#7c3f1d] block flex items-center gap-1">
              <Compass size={13} className="text-[#ea580c]" />
              Driver Mobile GPS Tracking
            </strong>
            <p>
              Send the WhatsApp link to the driver. When they click <strong>"START DELIVERY TRIP"</strong> on their phone, their phone's satellite GPS automatically broadcasts their real-time speed and position to this map.
            </p>
          </div>
        </div>
      </div>

      {/* Manual Depot Location Settings Modal (Mounted into document.body with createPortal and z-[99999] so Leaflet cannot overlay it) */}
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-colors"
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
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
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
                  className="px-2.5 py-1 bg-white hover:bg-orange-100 text-[#7c3f1d] border border-[#fed7aa] rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                >
                  <Move size={12} />
                  <span>Pick on Map</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveModalConfig} className="p-5 space-y-4">
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
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
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
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
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
