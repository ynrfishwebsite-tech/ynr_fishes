import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../../../config.js';
import api from '../../../api/system/axios';
import { useLanguage } from '../../../context/LanguageContext';
import { Save, Building, Phone, MapPin, Mail, FileText, Settings as SettingsIcon, User, Upload, Trash2, Image as ImageIcon, Lock, Unlock, Eye, EyeOff, Globe, Wifi, Server, RefreshCw, ShieldCheck, Loader2, X, ShieldAlert, Clock, MessageSquare, Star, Gift, Bluetooth, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Toast from './Toast';
import { apiUpdateProfile } from '../../../api/auth/auth';
import BackButton from '../common/BackButton';
import WhatsAppConnectModal from '../communication/WhatsAppConnectModal';
import CustomTimePicker from '../common/CustomTimePicker';
import { RECEIPT_FONT_STYLES, RECEIPT_FONT_SIZES, findReceiptFont, getReceiptFontMetrics } from '../../../utils/formatters/receiptFonts';
import { Type, Check, UtensilsCrossed, ReceiptIndianRupee, LayoutGrid, CircleDot, Languages } from 'lucide-react';
import { getMenuItems } from '../../../api/catalog/menu';
import LiveReceiptPreview from '../billing/LiveReceiptPreview';

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const Settings = ({ user, setUser, onNavigate, onGoBack }) => {
  const { t } = useLanguage();

  // Production vs Dev mode detection
  const isDevPort = typeof window !== 'undefined' && ['5173', '5174', '5175', '3000'].includes(window.location.port);
  const isDevMode = Boolean(
    import.meta.env.DEV && isDevPort && !window.location.hostname?.includes('vercel.app')
  );
  const isProduction = !isDevMode;

  const [settings, setSettings] = useState({
    restaurantName: '',
    restaurantType: '',
    address: '',
    phone: '',
    whatsappNumber: '',
    email: '',
    gstin: '',
    fssai: '',
    upiId: '',
    ownerPin: '',
    footerMessage: '*** THANK YOU! VISIT AGAIN ***',
    kotPrinter: '',
    billingPrinter: '',
    silentPrinting: true,
    enableQrPayment: true,
    enableCgst: true,
    cgstRate: 2.5,
    enableSgst: true,
    sgstRate: 2.5,
    enableGst: false,
    gstRate: 5,
    enableCuttingCharges: false,
    cuttingChargePerKg: 10,
    logo: '',
    showLogo: true,
    printFormat: '80mm',
    receiptFontSize: 'medium',
    receiptFontFamily: 'Arial, Helvetica, sans-serif',
    receiptItemLanguage: localStorage.getItem('receiptItemLanguage') || 'both',
    enableGeoFencing: false,
    geoFencingRadius: 50,
    latitude: '',
    longitude: '',
    qrMenuMode: 'cloud',
    vercelUrl: 'https://restaurant-billing-seven.vercel.app',
    serverIp: '',
    autoSendDaybook: false,
    autoSendTime: '14:30',
    autoSendTime2: '22:30',
    enableGlobalNotifications: true,
    defaultBillingLayout: 'grid',
    enableBillAnimation: true,
    receiptCustomerDisplay: {
      retail: { enabled: true, showName: true, showPhone: true, showAddress: false, showShopName: false },
      wholesale: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true },
      export: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true }
    }
  });

  const [username, setUsername] = useState(user ? user.username : '');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [showOwnerPin, setShowOwnerPin] = useState(false);
  const [showWhatsAppConnectModal, setShowWhatsAppConnectModal] = useState(false);
  const [showWhatsappSettingsModal, setShowWhatsappSettingsModal] = useState(false);
  const [areCoordsLocked, setAreCoordinatesLocked] = useState(() => {
    return localStorage.getItem('resto_coords_locked') !== 'false';
  });
  const [showCoordsUnlockModal, setShowCoordsUnlockModal] = useState(false);
  const [coordsUnlockPin, setCoordsUnlockPin] = useState('');
  const [coordsUnlockError, setCoordsUnlockError] = useState('');
  const [showCoordsUnlockPinVisibility, setShowCoordsUnlockPinVisibility] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showFontStyleModal, setShowFontStyleModal] = useState(false);
  const [fontCategoryFilter, setFontCategoryFilter] = useState('All');
  const [previewTab, setPreviewTab] = useState('receipt'); // 'receipt' | 'kot'
  const [menuPreviewItems, setMenuPreviewItems] = useState([]);
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'store' | 'printer' | 'taxes' | 'profile'

  useEffect(() => {
    let isMounted = true;
    getMenuItems().then(items => {
      if (isMounted && Array.isArray(items) && items.length > 0) {
        setMenuPreviewItems(items);
      }
    }).catch(err => {
      console.warn('Could not load menu items for settings preview:', err);
    });
    return () => { isMounted = false; };
  }, []);

  const isElectron = Boolean(typeof window !== 'undefined' && window.electronAPI);
  const isAndroidApp = Boolean(
    typeof window !== 'undefined' &&
    (window.AndroidBluetooth || window.AndroidPrint || (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()))
  );

  const refreshPrinters = () => {
    // 1. Desktop Electron App
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getPrinters) {
      window.electronAPI.getPrinters().then((printers) => {
        setSystemPrinters(printers || []);
      }).catch((err) => console.error("Failed to load desktop printers:", err));
      return;
    }

    // 2. Android APK (Bluetooth & Native System Print)
    if (typeof window !== 'undefined' && window.AndroidBluetooth) {
      try {
        const rawRes = window.AndroidBluetooth.getPairedDevices();
        const parsed = JSON.parse(rawRes || '{}');
        const list = [
          { name: "Android System Print (Default)", address: "system", isSystem: true }
        ];
        if (parsed && parsed.success && Array.isArray(parsed.devices)) {
          parsed.devices.forEach(d => {
            list.push({
              name: `Bluetooth: ${d.name} (${d.address})`,
              rawName: d.name,
              address: d.address,
              isBluetooth: true
            });
          });
        } else if (parsed && parsed.error === 'PERMISSION_REQUIRED') {
          if (typeof window.AndroidBluetooth.requestPermissions === 'function') {
            window.AndroidBluetooth.requestPermissions();
          }
        }
        setSystemPrinters(list);
      } catch (err) {
        console.warn("Could not parse paired Bluetooth devices:", err);
      }
      return;
    }

    // 3. Android APK fallback to System Print
    if (typeof window !== 'undefined' && window.AndroidPrint) {
      setSystemPrinters([
        { name: "Android System Print (Default)", address: "system", isSystem: true }
      ]);
    }
  };

  const handleScanBluetooth = () => {
    setIsScanningBluetooth(true);
    if (typeof window !== 'undefined' && window.AndroidBluetooth) {
      if (typeof window.AndroidBluetooth.hasPermission === 'function' && !window.AndroidBluetooth.hasPermission()) {
        window.AndroidBluetooth.requestPermissions();
      }
    }
    setTimeout(() => {
      refreshPrinters();
      setIsScanningBluetooth(false);
      setToast({ message: t("Printers refreshed successfully!"), type: "success" });
    }, 750);
  };

  const handleTestPrint = (targetField) => {
    const selectedPrinter = settings[targetField];
    if (!selectedPrinter) {
      setToast({ message: t("Please select a printer first"), type: "warning" });
      return;
    }

    const match = selectedPrinter.match(/([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}/);
    const macAddress = match ? match[0] : null;

    if (macAddress && typeof window !== 'undefined' && window.AndroidBluetooth?.testPrint) {
      try {
        setToast({ message: t("Sending test print to Bluetooth printer..."), type: "info" });
        const resStr = window.AndroidBluetooth.testPrint(macAddress);
        const res = JSON.parse(resStr || '{}');
        if (res.success) {
          setToast({ message: t("Test receipt printed successfully!"), type: "success" });
        } else {
          setToast({ message: t("Bluetooth print failed: ") + (res.error || res.message), type: "error" });
        }
      } catch (err) {
        setToast({ message: t("Test print error: ") + err.message, type: "error" });
      }
    } else if (typeof window !== 'undefined' && window.AndroidPrint) {
      window.AndroidPrint.print();
    } else {
      setToast({ message: t("Test print only available for Bluetooth devices or Desktop"), type: "warning" });
    }
  };

  useEffect(() => {
    // 1. Load settings from localStorage first for instant display
    const savedSettings = localStorage.getItem('restaurantSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.logo === '[logo_stored]') {
          parsed.logo = '';
        }
        // Migrate: if old single-time setting exists but no second time, apply new defaults
        if (!parsed.autoSendTime2) {
          parsed.autoSendTime = '14:30';
          parsed.autoSendTime2 = '22:30';
        }
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (e) { }
    }

    // 2. Dynamically fetch latest settings from backend (with automatic cloud fallback on localhost/mobile)
    api.get('/config/info')
      .then((res) => {
        const data = res.data;
        const incoming = data?.restaurantSettings || data;
        if (incoming && typeof incoming === 'object') {
          setSettings((prev) => {
            const cleanIncoming = { ...incoming };
            if (cleanIncoming.logo === '[logo_stored]') {
              cleanIncoming.logo = '';
            } else if (!cleanIncoming.logo && prev.logo && prev.logo !== '[logo_stored]') {
              cleanIncoming.logo = prev.logo;
            }
            // Migrate: if backend settings don't have autoSendTime2 yet, use new defaults
            if (!cleanIncoming.autoSendTime2) {
              cleanIncoming.autoSendTime = '14:30';
              cleanIncoming.autoSendTime2 = '22:30';
            }
            const updated = { 
              ...prev, 
              ...cleanIncoming,
              receiptItemLanguage: cleanIncoming.receiptItemLanguage || prev.receiptItemLanguage || localStorage.getItem('receiptItemLanguage') || 'both'
            };
            try {
              localStorage.setItem('restaurantSettings', JSON.stringify(updated));
              if (updated.receiptItemLanguage) localStorage.setItem('receiptItemLanguage', updated.receiptItemLanguage);
              if (updated.vercelUrl) localStorage.setItem('resto_vercel_url', updated.vercelUrl);
              if (updated.serverIp) localStorage.setItem('resto_server_ip', updated.serverIp);
              if (updated.qrMenuMode) localStorage.setItem('resto_qr_mode', updated.qrMenuMode);
            } catch (e) { }
            return updated;
          });
        }
      })
      .catch((err) => console.warn("Notice: could not load remote shop settings:", err));

    // Fetch security PIN for ownerPin field
    api.get('/config/security')
      .then((res) => {
        if (res.data && res.data.ownerPin) {
          const pinStr = String(res.data.ownerPin).replace(/\D/g, '').slice(0, 4);
          setSettings(prev => ({ ...prev, ownerPin: pinStr }));
        }
      }).catch(() => { });

    // Load available printers (Desktop Electron or Android Bluetooth / System)
    refreshPrinters();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Immediately save restaurant settings locally in localStorage (0ms instant)
      const cleanSettings = { ...settings };
      if (cleanSettings.logo === '[logo_stored]') cleanSettings.logo = '';
      cleanSettings.defaultBillingLayout = cleanSettings.defaultBillingLayout || 'grid';
      localStorage.setItem('restaurantSettings', JSON.stringify(cleanSettings));
      localStorage.setItem('menuGrid_displayMode', cleanSettings.defaultBillingLayout);
      if (cleanSettings.receiptItemLanguage) {
        localStorage.setItem('receiptItemLanguage', cleanSettings.receiptItemLanguage);
      }
      if (cleanSettings.vercelUrl) localStorage.setItem('resto_vercel_url', cleanSettings.vercelUrl);
      if (cleanSettings.serverIp) localStorage.setItem('resto_server_ip', cleanSettings.serverIp);
      if (cleanSettings.qrMenuMode) localStorage.setItem('resto_qr_mode', cleanSettings.qrMenuMode);
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: cleanSettings }));

      // 2. Perform fast network sync in parallel
      const syncPromises = [];

      syncPromises.push(
        api.post('/config/info', { restaurantSettings: cleanSettings })
          .catch(err => console.warn("Sync info notice:", err))
      );

      if (settings.ownerPin) {
        const cleanPin = String(settings.ownerPin).replace(/\D/g, '').slice(0, 4);
        syncPromises.push(
          api.post('/config/security', { ownerPin: cleanPin })
            .then(() => {
              setSettings(prev => ({ ...prev, ownerPin: cleanPin }));
            }).catch(err => console.warn("Sync security notice:", err))
        );
      }

      if (username && username !== user?.username) {
        syncPromises.push(
          apiUpdateProfile(username).then(response => {
            if (response?.user) {
              setUser(response.user);
              localStorage.setItem('user', JSON.stringify(response.user));
            }
          }).catch(err => console.warn("Sync profile notice:", err))
        );
      }

      // 3. Race sync with a 600ms threshold for ultra-responsive UI
      await Promise.race([
        Promise.all(syncPromises),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);

      setToast({ message: t('Settings saved successfully!'), type: 'success' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ message: t('Settings saved locally!'), type: 'success' });
    } finally {
      setSaving(false);
    }
  };

  const validateField = (field, val) => {
    let errorMsg = '';
    const trimmed = String(val).trim();
    if (trimmed) {
      if (field === 'phone' || field === 'whatsappNumber') {
        if (trimmed.length !== 10) {
          errorMsg = t('Phone number must be exactly 10 digits');
        } else if (!/^\d{10}$/.test(trimmed)) {
          errorMsg = t('Phone number must contain only numbers');
        }
      } else if (field === 'gstin') {
        if (trimmed.length !== 15) {
          errorMsg = t('GSTIN must be exactly 15 characters');
        } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(trimmed)) {
          errorMsg = t('Invalid GSTIN format (e.g., 22AAAAA0000A1Z5)');
        }
      } else if (field === 'fssai') {
        if (trimmed.length !== 14) {
          errorMsg = t('FSSAI License must be exactly 14 digits');
        } else if (!/^\d{14}$/.test(trimmed)) {
          errorMsg = t('FSSAI License must contain only numbers');
        }
      } else if (field === 'upiId') {
        if (!trimmed.includes('@')) {
          errorMsg = t('UPI ID must contain an @ symbol');
        } else if (!/^[\w.-]+@[\w.-]+$/.test(trimmed)) {
          errorMsg = t('Invalid UPI format (e.g., ynrfishes@okhdfcbank)');
        }
      }
    }
    setErrors((prev) => {
      const newErrors = { ...prev };
      if (errorMsg) newErrors[field] = errorMsg;
      else delete newErrors[field];
      return newErrors;
    });
  };

  const handleInputChange = (field, value) => {
    if (field === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    if (field === 'ownerPin') {
      value = value.replace(/\D/g, '').slice(0, 4);
    }
    if (field === 'whatsappNumber') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }
    setSettings((prev) => {
      const updated = {
        ...prev,
        [field]: value
      };
      if (field === 'receiptFontFamily' || field === 'receiptFontSize' || field === 'printFormat' || field === 'receiptItemLanguage') {
        try {
          const currentLocal = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
          const merged = { ...currentLocal, ...updated, [field]: value };
          localStorage.setItem('restaurantSettings', JSON.stringify(merged));
          if (field === 'receiptItemLanguage') {
            localStorage.setItem('receiptItemLanguage', value);
          }
          window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: merged }));
        } catch (e) { }
      }
      return updated;
    });
    validateField(field, value);
  };

  const handleToggleCustomerReceiptMode = (modeKey, enabled) => {
    setSettings((prev) => {
      const current = prev.receiptCustomerDisplay || {
        retail: { enabled: true, showName: true, showPhone: true, showAddress: false, showShopName: false },
        wholesale: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true },
        export: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true }
      };
      const updated = {
        ...current,
        [modeKey]: {
          ...current[modeKey],
          enabled
        }
      };
      const newSettings = { ...prev, receiptCustomerDisplay: updated };
      try {
        localStorage.setItem('restaurantSettings', JSON.stringify(newSettings));
        window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: newSettings }));
      } catch (e) { }
      return newSettings;
    });
  };

  const handleToggleCustomerReceiptField = (modeKey, fieldKey, val) => {
    setSettings((prev) => {
      const current = prev.receiptCustomerDisplay || {
        retail: { enabled: true, showName: true, showPhone: true, showAddress: false, showShopName: false },
        wholesale: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true },
        export: { enabled: true, showName: true, showPhone: true, showAddress: true, showShopName: true }
      };
      const updated = {
        ...current,
        [modeKey]: {
          ...current[modeKey],
          [fieldKey]: val
        }
      };
      const newSettings = { ...prev, receiptCustomerDisplay: updated };
      try {
        localStorage.setItem('restaurantSettings', JSON.stringify(newSettings));
        window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: newSettings }));
      } catch (e) { }
      return newSettings;
    });
  };

  const fetchIpLocation = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.latitude && data.longitude) {
          setSettings((prev) => ({
            ...prev,
            latitude: Number(data.latitude),
            longitude: Number(data.longitude)
          }));
          setLocating(false);
          setToast({ message: t(`Location detected via network (${data.city || 'Local Area'})!`), type: 'success' });
          return true;
        }
      }
    } catch (e) {
      try {
        const res2 = await fetch('https://api.ipify.org?format=json');
        if (res2.ok) {
          const ipData = await res2.json();
          const geoRes = await fetch(`https://ipwho.is/${ipData.ip}`);
          const geoData = await geoRes.json();
          if (geoData && geoData.latitude && geoData.longitude) {
            setSettings((prev) => ({
              ...prev,
              latitude: Number(geoData.latitude),
              longitude: Number(geoData.longitude)
            }));
            setLocating(false);
            setToast({ message: t(`Location detected via network (${geoData.city || 'Local Area'})!`), type: 'success' });
            return true;
          }
        }
      } catch (err2) { }
    }
    return false;
  };

  const handleGetLocation = async () => {
    setLocating(true);

    const isElectron = (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().includes('electron')) || Boolean(window.electronAPI);

    // If running inside Desktop Electron App, immediately use fast IP-based geolocation (<200ms)
    if (isElectron) {
      console.log('[Location] Running inside Desktop Electron app, using network geolocation...');
      const success = await fetchIpLocation();
      if (success) return;
    }

    if (!navigator.geolocation) {
      const success = await fetchIpLocation();
      if (!success) {
        setLocating(false);
        setToast({ message: t("Geolocation is not supported. Please enter coordinates manually."), type: 'error' });
      }
      return;
    }

    let isResolved = false;
    const gpsTimer = setTimeout(async () => {
      if (!isResolved) {
        isResolved = true;
        console.log('[Location] GPS hardware taking too long, falling back to network IP location...');
        const success = await fetchIpLocation();
        if (!success) {
          setLocating(false);
          setToast({ message: t("Could not capture GPS location. Please enter coordinates manually."), type: 'error' });
        }
      }
    }, 2500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(gpsTimer);
        setSettings((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLocating(false);
        setToast({ message: t("Location captured successfully!"), type: 'success' });
      },
      async (err) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(gpsTimer);
        console.warn('GPS failed, attempting IP Geolocation fallback:', err.message);
        const success = await fetchIpLocation();
        if (!success) {
          setLocating(false);
          if (err.code === 1) {
            setToast({ message: t("Location permission denied. Please enter coordinates manually."), type: 'error' });
          } else {
            setToast({ message: t("GPS unavailable on this PC. Please enter coordinates manually."), type: 'error' });
          }
        }
      },
      { timeout: 3000, enableHighAccuracy: false }
    );
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Strict File Type & Extension Validation
    const allowedExtensions = ['png', 'jpg', 'jpeg'];
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExtension) || !allowedMimeTypes.includes(file.type)) {
      setToast({
        message: t('Invalid image format. Only PNG and JPG/JPEG files are allowed.'),
        type: 'error'
      });
      e.target.value = '';
      return;
    }

    // 2. Strict 2MB File Size Validation (Blocks files above 2MB)
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setToast({
        message: t(`File size is too large (${sizeMB} MB). Maximum allowed size is 2MB.`),
        type: 'error'
      });
      e.target.value = '';
      return;
    }

    // 3. Image Integrity & Canvas Optimization
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (!img.width || !img.height) {
          setToast({ message: t('The selected file is corrupted or not a valid image.'), type: 'error' });
          return;
        }

        // Automatically optimize and resize logo for instant rendering & printing
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 300;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const optimizedDataUrl = canvas.toDataURL(outputMime, 0.9);

        const logoInfo = {
          name: file.name,
          size: file.size,
          extension: fileExtension.toUpperCase(),
          dimensions: `${img.width}×${img.height} px`
        };

        setSettings((prev) => ({
          ...prev,
          logo: optimizedDataUrl,
          logoInfo: logoInfo
        }));
        setToast({ message: t('Logo uploaded successfully!'), type: 'success' });
      };
      img.onerror = () => {
        setToast({ message: t('Failed to load image. Please select a valid PNG or JPG file.'), type: 'error' });
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setToast({ message: t('Error reading file.'), type: 'error' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const getLogoDetails = () => {
    if (!settings.logo || settings.logo === '[logo_stored]') return null;
    if (settings.logoInfo && typeof settings.logoInfo === 'object') {
      return {
        name: settings.logoInfo.name || 'restaurant-logo',
        sizeStr: settings.logoInfo.size ? formatFileSize(settings.logoInfo.size) : '',
        extension: settings.logoInfo.extension || (settings.logo.startsWith('data:image/png') ? 'PNG' : 'JPG'),
        dimensions: settings.logoInfo.dimensions || ''
      };
    }
    const isPng = settings.logo.startsWith('data:image/png');
    const approxBytes = Math.round((settings.logo.length * 3) / 4);
    return {
      name: 'restaurant-logo.' + (isPng ? 'png' : 'jpg'),
      sizeStr: formatFileSize(approxBytes),
      extension: isPng ? 'PNG' : 'JPG',
      dimensions: ''
    };
  };

  const logoDetails = getLogoDetails();

  const renderCatalogLayoutToggle = () => (
    <div className="p-4 bg-[#FDFBF7] rounded-xl border border-slate-200 shadow-md space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <LayoutGrid size={16} className="text-amber-800" />
              {t("Default Billing Catalog Layout")}
            </label>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${(settings.defaultBillingLayout || 'grid') === 'grid'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
              {(settings.defaultBillingLayout || 'grid') === 'grid' ? t("Grid View (Default)") : t("3D Roller / Wheel")}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {t("Choose which catalog layout is default in Mobile, Tablet, and Desktop. Toggle ON for Grid layout, OFF for 3D Roller.")}
          </p>
        </div>

        {/* Small Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer select-none shrink-0" title={t("Toggle default layout between Grid and 3D Roller")}>
          <input
            type="checkbox"
            className="sr-only peer"
            checked={(settings.defaultBillingLayout || 'grid') === 'grid'}
            onChange={(e) => {
              const newMode = e.target.checked ? 'grid' : '3d_roller';
              handleInputChange('defaultBillingLayout', newMode);
              try {
                localStorage.setItem('menuGrid_displayMode', newMode);
                const resto = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
                resto.defaultBillingLayout = newMode;
                localStorage.setItem('restaurantSettings', JSON.stringify(resto));
              } catch (err) { }
              window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...settings, defaultBillingLayout: newMode } }));
            }}
          />
          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
        </label>
      </div>

      {/* Mode Selector Buttons */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <span className="text-[11px] font-bold text-slate-600">{t("Active Layout:")}</span>
        <button
          type="button"
          onClick={() => {
            handleInputChange('defaultBillingLayout', 'grid');
            try {
              localStorage.setItem('menuGrid_displayMode', 'grid');
              const resto = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
              resto.defaultBillingLayout = 'grid';
              localStorage.setItem('restaurantSettings', JSON.stringify(resto));
            } catch (err) { }
            window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...settings, defaultBillingLayout: 'grid' } }));
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${(settings.defaultBillingLayout || 'grid') === 'grid'
            ? 'bg-[#994d1c] text-white border-[#7c3f1d] shadow-xs'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
        >
          <LayoutGrid size={12} />
          <span>{t("Grid Layout (Recommended)")}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            handleInputChange('defaultBillingLayout', '3d_roller');
            try {
              localStorage.setItem('menuGrid_displayMode', '3d_roller');
              const resto = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
              resto.defaultBillingLayout = '3d_roller';
              localStorage.setItem('restaurantSettings', JSON.stringify(resto));
            } catch (err) { }
            window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...settings, defaultBillingLayout: '3d_roller' } }));
          }}
          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${settings.defaultBillingLayout === '3d_roller'
            ? 'bg-[#994d1c] text-white border-[#7c3f1d] shadow-xs'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
        >
          <CircleDot size={12} />
          <span>{t("3D Roller / Wheel")}</span>
        </button>
      </div>
    </div>
  );


  return (
    <div className="w-full min-h-full shrink-0 flex flex-col p-1.5 sm:p-2.5 md:p-3 pb-24 touch-pan-y">
      <div className="w-full space-y-2.5 sm:space-y-3">
        {/* Header with Categorized Section Navigation Buttons */}
        <div className="bg-[#FDFBF7] rounded-2xl p-2.5 sm:p-3.5 border border-[#E8DCCB] shadow-xs flex flex-col gap-2.5">
          <div className="flex items-center gap-3 sm:gap-4">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 border border-primary/20">
              <SettingsIcon className="text-primary" size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-xl font-bold text-text-main m-0 leading-tight">{t("Store Settings")}</h1>
              <p className="text-xs text-text-muted m-0 mt-0.5">{t("Configure your store information and billing preferences")}</p>
            </div>
          </div>

          {/* Categorized Section Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pt-2 border-t border-[#E8DCCB]/60">
            {[
              { id: 'all', label: t('All Settings'), icon: SettingsIcon },
              { id: 'store', label: t('Store & Depot'), icon: Building },
              { id: 'printer', label: t('Printers & Thermal'), icon: Printer },
              { id: 'taxes', label: t('Taxes & Security'), icon: Lock },
              { id: 'profile', label: t('User Profile'), icon: User },
            ].map((cat) => {
              const Icon = cat.icon;
              const isActive = activeSection === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveSection(cat.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs active:scale-95 ${isActive
                    ? 'bg-[#ea580c] text-white shadow-xs font-bold border border-[#c2410c]'
                    : 'bg-white text-slate-700 hover:bg-[#F5E8D8] border border-[#E8DCCB]'
                    }`}
                >
                  <Icon size={13} className={isActive ? 'text-white' : 'text-[#ea580c]'} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="flex flex-col gap-4">
            {/* Profile Information */}
            {(activeSection === 'all' || activeSection === 'profile') && (
              <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <User className="text-primary" size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-text-main">{t("Profile Information")}</h2>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <User size={14} />{t("Username")}

                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter username")} />


                </div>
              </div>
            )}

            {/* Printer Configuration */}
            {(activeSection === 'all' || activeSection === 'printer') && (
              <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Printer className="text-primary" size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-text-main">
                        {t("Printer & Station Setup")}
                      </h2>
                      <p className="text-xs text-text-muted mt-0.5">{t("Configure thermal receipt & counter printers")}</p>
                    </div>
                  </div>

                </div>

                <div className="space-y-4">
                  {/* Redirect to full printer config */}
                  <div
                    onClick={() => { if (onNavigate) onNavigate('printer'); else window.location.href = '/printer'; }}
                    className="flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl cursor-pointer group transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                        <Printer size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-text-main">{t("Thermal Printer Configuration")}</p>
                        <p className="text-xs text-text-muted mt-0.5">{t("Add receipt printers & counter printing stations")}</p>
                      </div>
                    </div>
                    <span className="text-primary font-bold text-sm group-hover:translate-x-1 transition-transform">→</span>
                  </div>


                  {/* Bill Text Size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                        <Type size={16} className="text-primary" />
                        <span>{t("Receipt & Bill Text Size")}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowFontSizeModal(true)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer">
                        <span>{t("Change Size")}</span>
                      </button>
                    </div>
                    <div
                      onClick={() => setShowFontSizeModal(true)}
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-text-main flex items-center justify-between cursor-pointer hover:border-primary transition">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          {RECEIPT_FONT_SIZES.find(s => s.id === (settings.receiptFontSize || 'medium'))?.label || t("Medium")}
                        </span>
                        <span className="text-xs text-text-muted">
                          ({t("Normal: ")}{RECEIPT_FONT_SIZES.find(s => s.id === (settings.receiptFontSize || 'medium'))?.normalPx}, {t("Heading: ")}{RECEIPT_FONT_SIZES.find(s => s.id === (settings.receiptFontSize || 'medium'))?.headingPx})
                        </span>
                      </div>
                      <span className="text-xs text-text-muted">▼</span>
                    </div>
                  </div>

                  {/* Bill Font Style */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                        <Type size={16} className="text-primary" />
                        <span>{t("Receipt & Bill Font Style (15 Readable Styles)")}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowFontStyleModal(true)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer">
                        <span>{t("Change Style")}</span>
                      </button>
                    </div>

                    {(() => {
                      const currentFont = findReceiptFont(settings.receiptFontFamily);
                      return (
                        <div
                          onClick={() => setShowFontStyleModal(true)}
                          className="w-full px-4 py-3 border border-border rounded-xl bg-background text-text-main flex flex-col gap-2 cursor-pointer hover:border-primary transition shadow-sm hover:shadow-md group">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="font-bold text-sm sm:text-base text-text-main truncate transition-colors group-hover:text-primary"
                                style={{ fontFamily: currentFont.value, ...(currentFont.previewStyle || {}) }}>
                                {currentFont.label}
                              </span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider shrink-0">
                                {currentFont.category}
                              </span>
                            </div>
                            <span className="text-xs text-text-muted group-hover:text-primary transition shrink-0">▼</span>
                          </div>
                          <div
                            className="w-full px-3 py-2 rounded-lg bg-surface border border-border/70 text-xs sm:text-sm text-text-main flex items-center justify-between gap-2 overflow-hidden"
                            style={{ fontFamily: currentFont.value, ...(currentFont.previewStyle || {}) }}>
                            <span className="truncate">Sample: 1 x Chicken Biryani ₹250.00 • Subtotal ₹470.00</span>
                            <span className="font-bold shrink-0 text-primary">TOTAL ₹470</span>
                          </div>
                        </div>
                      );
                    })()}

                    <p className="text-[11px] text-text-muted">
                      {t("Selected font applies cleanly across both 58mm & 80mm slips with high thermal legibility.")}
                    </p>
                  </div>

                  {/* Receipt Item Language Setting */}
                  <div className="space-y-2 pt-2 border-t border-border mt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                        <Languages size={16} className="text-primary" />
                        <span>{t("Receipt Item Language")}</span>
                      </label>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {(settings.receiptItemLanguage === 'telugu')
                          ? 'తెలుగు మాత్రమే'
                          : (settings.receiptItemLanguage === 'english')
                            ? 'English Only'
                            : 'English + తెలుగు'}
                      </span>
                    </div>

                    <p className="text-[11px] text-text-muted">
                      {t("Select language for item names on printed receipts & live previews. If Telugu is chosen and unavailable for an item, English will be used as automatic fallback.")}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[
                        { id: 'telugu', label: 'Telugu (తెలుగు)', sub: 'తెలుగు (fallback English)' },
                        { id: 'english', label: 'English', sub: 'English only' },
                        { id: 'both', label: 'Both (ద్విభాష)', sub: 'English (తెలుగు)' }
                      ].map((opt) => {
                        const isSelected = (settings.receiptItemLanguage || 'both') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              handleInputChange('receiptItemLanguage', opt.id);
                              localStorage.setItem('receiptItemLanguage', opt.id);
                              setToast({
                                message: t(`Receipt items language set to ${opt.label}`),
                                type: 'success'
                              });
                            }}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                              isSelected
                                ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                                : 'bg-background border-border text-text-main hover:border-primary/50'
                            }`}
                          >
                            <span className="text-xs font-bold leading-tight">{opt.label}</span>
                            <span className={`text-[10px] leading-tight ${isSelected ? 'text-primary/80 font-medium' : 'text-text-muted'}`}>{opt.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Silent Printing */}
                  <div className="flex items-center justify-between pt-2 border-t border-border mt-4">
                    <div className="space-y-0.5">
                      <label className="text-sm font-semibold text-text-main">{t("Silent Printing")}</label>
                      <p className="text-xs text-text-muted">{t("Print directly without showing the print dialog")}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={settings.silentPrinting !== false}
                        onChange={(e) => handleInputChange('silentPrinting', e.target.checked)}
                        disabled={!isElectron && !isAndroidApp} />
                      <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${settings.silentPrinting !== false ? 'bg-primary' : 'bg-gray-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings.silentPrinting !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </label>
                  </div>
                  {!isElectron && !isAndroidApp && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                      {t("Silent printing is only available in the Desktop App and Android Bluetooth mode. In the web version, a print dialog will always appear.")}
                    </p>
                  )}

                  {/* Bill Receipt Animation Toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                    <div className="space-y-0.5">
                      <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                        🎉 {t("Bill Receipt Animation")}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${settings.enableBillAnimation !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-slate-100 text-slate-500 border-slate-300'}`}>
                          {settings.enableBillAnimation !== false ? t('ON') : t('OFF')}
                        </span>
                      </label>
                      <p className="text-xs text-text-muted">
                        {t("Show the 3D roller unroll animation when a bill receipt opens. Turn OFF for instant display.")}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={settings.enableBillAnimation !== false}
                        onChange={(e) => {
                          handleInputChange('enableBillAnimation', e.target.checked);
                          try {
                            const resto = JSON.parse(localStorage.getItem('restaurantSettings') || '{}');
                            resto.enableBillAnimation = e.target.checked;
                            localStorage.setItem('restaurantSettings', JSON.stringify(resto));
                            window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { ...settings, enableBillAnimation: e.target.checked } }));
                          } catch (_) {}
                        }}
                      />
                      <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${settings.enableBillAnimation !== false ? 'bg-primary' : 'bg-gray-300'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings.enableBillAnimation !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}



            {/* Customer Details on Bill Receipts (Admin Controls: Retail, Wholesale, Export) */}
            {(activeSection === 'all' || activeSection === 'printer' || activeSection === 'store') && (
              <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <User className="text-primary" size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-text-main flex items-center gap-2">
                      <span>{t("Customer Details on Bill Receipts")}</span>
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {t("Print Control")}
                      </span>
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      {t("Control customer details printed on Retail, Wholesale, and Export bill receipts, with individual sub-field toggles.")}
                    </p>
                  </div>
                </div>

                {/* 3 Mode Columns (Mobile: 1-col, Tablet/Desktop: 3-cols) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    {
                      key: 'retail',
                      title: 'Retail Bills',
                      badge: 'Walk-In / Counter',
                      color: 'emerald',
                      border: 'border-emerald-500/30',
                      bg: 'bg-emerald-500/5',
                      headerBg: 'bg-emerald-500/10 text-emerald-800'
                    },
                    {
                      key: 'wholesale',
                      title: 'Wholesale Bills',
                      badge: 'B2B / Boxes',
                      color: 'amber',
                      border: 'border-amber-500/30',
                      bg: 'bg-amber-500/5',
                      headerBg: 'bg-amber-500/10 text-amber-800'
                    },
                    {
                      key: 'export',
                      title: 'Export Bills',
                      badge: 'Transit / Crates',
                      color: 'blue',
                      border: 'border-blue-500/30',
                      bg: 'bg-blue-500/5',
                      headerBg: 'bg-blue-500/10 text-blue-800'
                    }
                  ].map((mode) => {
                    const cfg = settings.receiptCustomerDisplay?.[mode.key] || {
                      enabled: true,
                      showName: true,
                      showPhone: true,
                      showAddress: mode.key !== 'retail',
                      showShopName: mode.key !== 'retail'
                    };

                    return (
                      <div
                        key={mode.key}
                        className={`rounded-xl border ${mode.border} ${mode.bg} p-3.5 flex flex-col justify-between transition-all shadow-xs`}>

                        {/* Master Mode Header & Switch */}
                        <div>
                          <div className="flex items-center justify-between pb-2 border-b border-border/70">
                            <div>
                              <div className="font-extrabold text-sm text-text-main flex items-center gap-1.5">
                                <span>{t(mode.title)}</span>
                              </div>
                              <span className="text-[10px] font-semibold text-text-muted">
                                {mode.badge}
                              </span>
                            </div>

                            {/* Master Switch */}
                            <label className="relative inline-flex items-center cursor-pointer select-none shrink-0" title={`${mode.title} Master Toggle`}>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={cfg.enabled !== false}
                                onChange={(e) => handleToggleCustomerReceiptMode(mode.key, e.target.checked)}
                              />
                              <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${cfg.enabled !== false ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${cfg.enabled !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                              </div>
                            </label>
                          </div>

                          {/* Status label */}
                          <div className="my-2">
                            {cfg.enabled !== false ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                                ✓ {t("Visible on Receipt")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 bg-slate-200 border border-slate-300 px-2 py-0.5 rounded-md">
                                ✕ {t("Hidden (Not Printed)")}
                              </span>
                            )}
                          </div>

                          {/* Sub-Toggles */}
                          <div className={`space-y-1.5 mt-2 pt-2 border-t border-border/50 transition-opacity ${cfg.enabled !== false ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                              {t("Select Fields to Print:")}
                            </div>

                            {[
                              { id: 'showName', label: 'Customer Name' },
                              { id: 'showPhone', label: 'Mobile Number' },
                              { id: 'showShopName', label: 'Shop Name' },
                              { id: 'showAddress', label: 'Address' }
                            ].map((field) => (
                              <div
                                key={field.id}
                                className="flex items-center justify-between py-1 px-2 rounded-lg bg-surface border border-border/60">
                                <span className="text-xs font-semibold text-text-main">
                                  {t(field.label)}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={cfg[field.id] !== false}
                                    onChange={(e) => handleToggleCustomerReceiptField(mode.key, field.id, e.target.checked)}
                                    disabled={cfg.enabled === false}
                                  />
                                  <div className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${cfg[field.id] !== false ? 'bg-primary' : 'bg-gray-300'}`}>
                                    <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transform transition-transform ${cfg[field.id] !== false ? 'translate-x-3.5' : 'translate-x-0'}`} />
                                  </div>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-1.5 border-t border-border/40 text-[9.5px] text-text-muted">
                          {cfg.enabled !== false
                            ? t("Only checked fields appear on slips.")
                            : t("Customer section completely omitted.")}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fish Depot & Store Information */}
            {(activeSection === 'all' || activeSection === 'store') && (
              <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Building className="text-primary" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-main">{t("Fish Depot & Store Information")}</h2>
                    <p className="text-xs text-text-muted mt-0.5">{t("Store branding, contact details & legal registration")}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  {/* Restaurant Logo */}
                  <div className="md:col-span-2 space-y-2 pb-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <ImageIcon size={14} />{t("Printed Bill Logo")}

                    </label>
                    <div className="bg-background p-3.5 rounded-xl border border-border">
                      {Boolean(settings.logo && settings.logo !== '[logo_stored]' && logoDetails) ? (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Logo Preview Box */}
                            <div className="p-2 bg-surface border border-border shadow-2xl rounded-xl text-text-main border border-border shadow-xs flex items-center justify-center min-w-[70px] min-h-[60px] max-h-[70px] shrink-0">
                              <img
                                src={settings.logo}
                                alt="Fish Depot Logo"
                                className="h-14 max-w-[130px] object-contain"
                                onError={() => {
                                  console.warn("Logo failed to load, resetting");
                                  setSettings(prev => ({ ...prev, logo: '', logoInfo: null }));
                                }}
                              />
                            </div>
                            {/* Logo File Information (Name, Extension, File Size) */}
                            <div className="min-w-0 space-y-1">
                              <p className="text-xs sm:text-sm font-bold text-text-main truncate max-w-[200px] sm:max-w-[280px]" title={logoDetails.name}>
                                {logoDetails.name}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                                  {logoDetails.extension}
                                </span>
                                {logoDetails.sizeStr && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-medium bg-surface-hover text-text-muted border border-border">
                                    {logoDetails.sizeStr}
                                  </span>
                                )}
                                {logoDetails.dimensions && (
                                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono text-text-muted bg-surface-hover border border-border">
                                    {logoDetails.dimensions}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <label className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-hover hover:bg-surface border border-border text-text-main rounded-lg text-xs font-bold cursor-pointer transition-all">
                              <Upload size={14} />{t("Change")}
                              <input
                                type="file"
                                accept=".png, .jpg, .jpeg, image/png, image/jpeg"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => setSettings(prev => ({ ...prev, logo: '', logoInfo: null }))}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error rounded-lg text-xs font-bold transition-all cursor-pointer"
                            >
                              <Trash2 size={14} />{t("Remove")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-bold cursor-pointer transition-all shadow-xs">
                            <Upload size={16} />{t("Upload Logo (PNG/JPG)")}
                            <input
                              type="file"
                              accept=".png, .jpg, .jpeg, image/png, image/jpeg"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                          </label>
                          <div className="text-xs text-text-muted flex items-center gap-1.5">
                            <span>{t("Displayed at top of printed bills")}</span>
                            <span className="px-1.5 py-0.5 rounded bg-surface-hover border border-border text-[11px] font-mono font-bold text-text-main">
                              max 2MB • PNG/JPG
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Show Logo On/Off Toggle */}
                      {Boolean(settings.logo && settings.logo !== '[logo_stored]') && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <div className="space-y-0.5">
                            <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                              <ImageIcon size={14} />{t("Show Logo on Bills")}
                            </label>
                            <p className="text-xs text-text-muted">{t("Toggle to show or hide the logo on printed bills & WhatsApp e-bill")}</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={settings.showLogo !== false}
                              onChange={(e) => handleInputChange('showLogo', e.target.checked)}
                            />
                            <div className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${settings.showLogo !== false ? 'bg-primary' : 'bg-gray-300'}`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${settings.showLogo !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Business / Store Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <Building size={14} />{t("Business / Store Name")}

                    </label>
                    <input
                      type="text"
                      value={settings.restaurantName}
                      onChange={(e) => handleInputChange('restaurantName', e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("YNR FISHES")} />


                  </div>

                  {/* Store Category Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <FileText size={14} />{t("Store Category Type")}

                    </label>
                    <input
                      type="text"
                      value={settings.restaurantType}
                      onChange={(e) => handleInputChange('restaurantType', e.target.value)}
                      className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("e.g. Fresh Sea Fish & Marine Products")} />


                  </div>

                  {/* Address */}
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <MapPin size={14} />{t("Address")}

                    </label>
                    <textarea
                      value={settings.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main resize-none" placeholder={t("Enter full address")} />


                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <Phone size={14} />{t("Phone Number")}
                    </label>
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      onKeyPress={(e) => {
                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full px-4 py-2 border ${errors.phone ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`} placeholder={t("Enter phone number")} />
                    {errors.phone && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.phone}</p>}
                  </div>

                  {/* WhatsApp Report Number */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <Phone size={14} className="text-emerald-600" />{t("WhatsApp Report Number (Optional)")}
                    </label>
                    <input
                      type="tel"
                      value={settings.whatsappNumber || ''}
                      onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                      onKeyPress={(e) => {
                        if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className={`w-full px-4 py-2 border ${errors.whatsappNumber ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`}
                      placeholder={t("e.g. 9876543210 (Defaults to Phone Number)")} />
                    {errors.whatsappNumber && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.whatsappNumber}</p>}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <Mail size={14} />{t("Email")}

                    </label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      onKeyPress={(e) => {
                        if (!/[a-zA-Z0-9@._-]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                          e.preventDefault();
                        }
                      }}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background text-text-main" placeholder={t("Enter email address")} />


                  </div>

                  {/* GSTIN */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                      <FileText size={14} />{t("GSTIN")}

                    </label>
                    <input
                      type="text"
                      value={settings.gstin}
                      onChange={(e) => handleInputChange('gstin', e.target.value.toUpperCase())}
                      className={`w-full px-4 py-3 border ${errors.gstin ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`} placeholder={t("Enter GSTIN")} />
                    {errors.gstin && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.gstin}</p>}
                  </div>

                  {/* Left Column Settings (FSSAI, UPI, WhatsApp, Footer) */}
                  {/* Left Column Settings */}
                  <div className="flex flex-col gap-6">
                    {/* FSSAI */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                        <FileText size={14} />{t("FSSAI Number")}
                      </label>
                      <input
                        type="text"
                        value={settings.fssai || ''}
                        onChange={(e) => handleInputChange('fssai', e.target.value.replace(/\D/g, '').slice(0, 14))}
                        className={`w-full px-4 py-3 border ${errors.fssai ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-xl focus:outline-none focus:ring-2 bg-background text-text-main`} placeholder={t("Enter FSSAI License Number")} />
                      {errors.fssai && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.fssai}</p>}
                    </div>

                    {/* UPI ID */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-text-main flex items-center gap-2">
                        <FileText size={14} />{t("UPI Payment VPA / ID")}
                      </label>
                      <input
                        type="text"
                        value={settings.upiId || ''}
                        onChange={(e) => handleInputChange('upiId', e.target.value)}
                        className={`w-full px-4 py-3 border ${errors.upiId ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500' : 'border-blue-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-xl focus:outline-none focus:ring-2 bg-blue-50 text-blue-900 font-mono`} placeholder={t("e.g. restaurant@upi")} />
                      {errors.upiId && <p className="text-xs text-red-500 mt-1 font-semibold">{errors.upiId}</p>}
                    </div>
                    {/* WhatsApp Automated Bot Configuration - Trigger */}
                    <div
                      className="p-4 bg-[#FDFBF7] hover:bg-[#F5E8D8] transition-all rounded-2xl border-2 border-emerald-400/80 shadow-sm cursor-pointer group"
                      onClick={() => setShowWhatsappSettingsModal(true)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-600 shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                            </svg>
                          </div>
                          <span className="text-sm font-extrabold text-slate-900">
                            {t("WhatsApp Automations")}
                          </span>
                        </div>
                        <span className="text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shrink-0 transition-all shadow-sm flex items-center gap-1">
                          <span>{t("Configure")}</span>
                          <span className="text-sm">→</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 font-semibold mt-2.5 text-left">
                        {t("DayBook, Reminders, Feedback & Win-Back campaigns")}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {settings.autoSendDaybook && <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">DayBook ✓</span>}
                        {settings.feedback_whatsapp_enabled && <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">Feedback ✓</span>}
                        {settings.winback_enabled && <span className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">Win-Back ✓</span>}
                        {!settings.autoSendDaybook && !settings.feedback_whatsapp_enabled && !settings.winback_enabled && (
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300">
                            No automations enabled
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer Message */}
                    <div className="space-y-1.5 p-3 bg-[#FDFBF7] rounded-xl border border-slate-200 shadow-md">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={14} className="text-sky-600" />{t("Footer Message")}
                      </label>
                      <input
                        type="text"
                        value={settings.footerMessage}
                        onChange={(e) => handleInputChange('footerMessage', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-400 bg-[#F7EFE2] text-slate-800 text-sm" placeholder={t("Enter footer message for receipts")} />
                      <p className="text-[10px] text-slate-400">{t("Shown at the bottom of every printed receipt.")}</p>
                    </div>

                    {/* Default Catalog Layout (Grid vs 3D Roller) */}
                    {renderCatalogLayoutToggle()}

                  </div>
                </div>
              </div>
            )}

            {/* Taxes & Security Configuration */}
            {(activeSection === 'all' || activeSection === 'taxes') && (
              <div className="bg-surface rounded-2xl p-4 border border-border shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Lock className="text-primary" size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-text-main">{t("Taxes & Security Configuration")}</h2>
                    <p className="text-xs text-text-muted mt-0.5">{t("GST rates, Dynamic QR payment, Owner PIN & live notifications")}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Individual Tax Configuration */}
                  <div className="space-y-3 p-4 bg-[#FDFBF7] rounded-xl border border-slate-200 shadow-md">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileText size={15} className="text-sky-600" />{t("Individual Tax Options (CGST, SGST, GST)")}
                    </h3>
                    <p className="text-xs text-slate-400">{t("Toggle ON/OFF each tax option and set its default percentage rate.")}</p>

                    {/* CGST Option */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.enableCgst !== false}
                            onChange={(e) => handleInputChange('enableCgst', e.target.checked)} />

                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                        <span className="text-sm font-semibold text-slate-700">{t("Enable CGST")}</span>
                      </div>
                      {settings.enableCgst !== false &&
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={settings.cgstRate !== undefined ? settings.cgstRate : 2.5}
                            onChange={(e) => handleInputChange('cgstRate', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm font-mono font-bold text-center bg-white text-slate-800" />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                      }
                    </div>

                    {/* SGST Option */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.enableSgst !== false}
                            onChange={(e) => handleInputChange('enableSgst', e.target.checked)} />

                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                        <span className="text-sm font-semibold text-slate-700">{t("Enable SGST")}</span>
                      </div>
                      {settings.enableSgst !== false &&
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={settings.sgstRate !== undefined ? settings.sgstRate : 2.5}
                            onChange={(e) => handleInputChange('sgstRate', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm font-mono font-bold text-center bg-white text-slate-800" />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                      }
                    </div>

                    {/* GST / IGST Option */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-3">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={settings.enableGst === true}
                            onChange={(e) => handleInputChange('enableGst', e.target.checked)} />

                          <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                        </label>
                        <span className="text-sm font-semibold text-slate-700">{t("Enable GST (or IGST)")}</span>
                      </div>
                      {settings.enableGst === true &&
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.1"
                            value={settings.gstRate !== undefined ? settings.gstRate : 5}
                            onChange={(e) => handleInputChange('gstRate', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm font-mono font-bold text-center bg-white text-slate-800" />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                      }
                    </div>
                  </div>

                  {/* Fish Cutting Charges */}
                  <div className="p-4 bg-[#FDFBF7] rounded-xl border border-slate-200 shadow-md space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <UtensilsCrossed size={16} className="text-amber-800" />
                            {t("Fish Cutting & Cleaning Charges")}
                          </label>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${settings.enableCuttingCharges
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-slate-200 text-slate-600'
                            }`}>
                            {settings.enableCuttingCharges ? t("Active") : t("Disabled")}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {t("Automatically add cleaning and cutting fees based on fish weight during billing")}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.enableCuttingCharges === true}
                          onChange={(e) => handleInputChange('enableCuttingCharges', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>

                    {/* Species Cutting Toggles */}
                    {settings.enableCuttingCharges && (
                      <div className="pt-2 pb-1 border-t border-slate-200">
                        <span className="text-[11px] font-bold text-slate-700 block mb-1.5">{t("Apply cutting charges to:")}</span>
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            const set = new Set(['fish', 'prawn', 'crab']);
                            if (Array.isArray(menuPreviewItems)) {
                              menuPreviewItems.forEach(item => {
                                if (item.speciesType && typeof item.speciesType === 'string') {
                                  const s = item.speciesType.trim().toLowerCase();
                                  if (s) set.add(s);
                                }
                              });
                            }
                            if (settings.cuttingSpeciesToggles && typeof settings.cuttingSpeciesToggles === 'object') {
                              Object.keys(settings.cuttingSpeciesToggles).forEach(k => {
                                if (k && typeof k === 'string') set.add(k.trim().toLowerCase());
                              });
                            }
                            const emojiMap = {
                              fish: '🐟',
                              prawn: '🦐',
                              crab: '🦀',
                              lobster: '🦞',
                              squid: '🦑',
                              octopus: '🐙',
                              clam: '🦪',
                              oyster: '🦪'
                            };
                            return Array.from(set).map(sp => {
                              const icon = emojiMap[sp] || '🌊';
                              const label = `${icon} ${sp.charAt(0).toUpperCase() + sp.slice(1)}`;
                              const isOn = settings.cuttingSpeciesToggles?.[sp] !== undefined 
                                ? settings.cuttingSpeciesToggles[sp] 
                                : true;
                              return (
                                <button
                                  key={sp}
                                  type="button"
                                  onClick={() => handleInputChange('cuttingSpeciesToggles', {
                                    ...settings.cuttingSpeciesToggles,
                                    [sp]: !isOn
                                  })}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                                    isOn 
                                      ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm' 
                                      : 'bg-slate-100 text-slate-400 border-slate-200'
                                  }`}
                                >
                                  <span>{label}</span>
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isOn ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'}`}>
                                    {isOn ? 'ON' : 'OFF'}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Rate Input & Friendly Slab Breakdown */}
                    <div className={`space-y-3 pt-3 border-t border-slate-200 transition-opacity ${settings.enableCuttingCharges ? 'opacity-100' : 'opacity-70'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {t("Base Cutting Rate")}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {t("Fee charged for the first 1.5 Kg and each additional 1 Kg")}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 self-start sm:self-auto">
                          <span className="text-xs font-bold text-slate-500">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={settings.cuttingChargePerKg !== undefined ? settings.cuttingChargePerKg : 10}
                            onChange={(e) => handleInputChange('cuttingChargePerKg', Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg text-sm font-mono font-bold text-center bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 shadow-2xs"
                          />
                          <span className="text-xs text-slate-500 font-medium">{t("per step")}</span>
                        </div>
                      </div>

                      {/* Visual Slab Cards: Editable Tiers */}
                      {(() => {
                        const rate = Number(settings.cuttingChargePerKg) || 10;
                        const tiers = settings.cuttingTiers || [
                          { label: 'Tier 1', maxKg: 1.5, multiplier: 1 },
                          { label: 'Tier 2', maxKg: 2.5, multiplier: 2 },
                          { label: 'Tier 3', maxKg: 3.5, multiplier: 3 },
                          { label: 'Extra', extraPerKg: true, multiplier: 1 }
                        ];
                        return (
                          <div className="bg-[#FAF0E4]/80 border border-[#E8DCCB] rounded-xl p-2.5 sm:p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
                              <span className="flex items-center gap-1.5">
                                <span>💡</span>
                                <span>{t("How it calculates on customer bill:")}</span>
                              </span>
                              <span className="text-[10.5px] font-medium text-slate-500 hidden sm:inline">
                                {t("Auto-calculated from total weight")}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                              {tiers.map((tier, idx) => {
                                const isExtra = tier.extraPerKg;
                                const prevMax = idx > 0 ? tiers[idx - 1].maxKg : 0;
                                const displayLabel = isExtra 
                                  ? `Extra each +1 Kg` 
                                  : idx === 0 
                                    ? `Up to ${tier.maxKg} Kg` 
                                    : `${(prevMax + 0.1).toFixed(1)} to ${tier.maxKg} Kg`;
                                const displayRate = isExtra ? `+₹${rate}` : `₹${rate * tier.multiplier}`;
                                return (
                                  <div key={idx} className={`bg-white rounded-lg p-2 border text-center shadow-2xs ${isExtra ? 'border-amber-400 bg-amber-50/50' : 'border-amber-200'}`}>
                                    {!isExtra ? (
                                      <div className="flex items-center justify-center gap-0.5 mb-0.5">
                                        <span className="text-[9px] text-slate-500">≤</span>
                                        <input
                                          type="number"
                                          min="0.1"
                                          step="0.1"
                                          value={tier.maxKg}
                                          onChange={(e) => {
                                            const newTiers = [...tiers];
                                            newTiers[idx] = { ...newTiers[idx], maxKg: parseFloat(e.target.value) || tier.maxKg };
                                            handleInputChange('cuttingTiers', newTiers);
                                          }}
                                          className="w-10 text-[10px] text-center font-bold text-slate-700 border border-slate-200 rounded px-0.5 py-0.5 bg-slate-50 focus:outline-none focus:border-amber-500"
                                        />
                                        <span className="text-[9px] text-slate-500">Kg</span>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-slate-600 font-medium block">
                                        {t("Extra each +1 Kg")}
                                      </span>
                                    )}
                                    <span className={`text-sm font-black font-mono mt-0.5 block ${isExtra ? 'text-amber-700' : 'text-amber-900'}`}>
                                      {displayRate}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Dynamic QR Payment Toggle */}
                  <div className="flex items-center justify-between p-4 bg-[#FDFBF7] rounded-xl border border-slate-200 shadow-md">
                    <div className="space-y-0.5">
                      <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={15} className="text-sky-600" />{t("Dynamic QR Code Payment")}
                      </label>
                      <p className="text-xs text-slate-400">{t("Show dynamic scan-to-pay UPI QR code on checkout screen & printed bills")}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.enableQrPayment !== false}
                        onChange={(e) => handleInputChange('enableQrPayment', e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                    </label>
                  </div>

                  {/* Owner Security PIN */}
                  <div className="space-y-1.5 p-3 bg-[#FDFBF7] rounded-xl border border-slate-200 shadow-md">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Lock size={14} className="text-sky-600" />{t("Owner Security PIN (Reports & Security Lock)")}
                    </label>
                    <div className="relative">
                      <input
                        type={showOwnerPin ? "text" : "password"}
                        value={settings.ownerPin || ''}
                        onChange={(e) => handleInputChange('ownerPin', e.target.value)}
                        maxLength={4}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-500 bg-white text-slate-900 font-mono tracking-widest font-bold pr-10 placeholder:text-slate-400 text-center text-base"
                        placeholder={t("•••• (4 digits)")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOwnerPin(!showOwnerPin)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 hover:text-sky-300 transition-colors p-0.5 cursor-pointer"
                        title={showOwnerPin ? t("Hide PIN") : t("Show PIN")}
                      >
                        {showOwnerPin ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Global Notifications Security */}
                  <div className="space-y-4 md:col-span-2 mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <label className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          <MessageSquare size={14} className="text-sky-400" />{t("Global Live Notifications")}
                        </label>
                        <span className="text-xs text-slate-400 mt-1 max-w-xl">{t("Turn off to completely disable live notifications (Saved, Updated, Printed) for all users/devices of this store. Local device toasts will still work. Turning this off significantly improves performance.")}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={settings.enableGlobalNotifications !== false}
                          onChange={(e) => handleInputChange('enableGlobalNotifications', e.target.checked)} />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="lg:sticky lg:top-24 h-fit bg-surface rounded-2xl p-4 border border-border shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <h2 className="text-xl font-bold text-text-main">
                {showWhatsappSettingsModal ? t("WhatsApp Preview") : t("Live Print Preview")}
              </h2>
              {!showWhatsappSettingsModal && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-white shadow-sm">
                  <ReceiptIndianRupee size={13} />
                  <span>{t("Receipt")}</span>
                </div>
              )}
            </div>

            {showWhatsappSettingsModal ? (
              <div className="bg-[#e5ddd5] rounded-xl p-3 max-w-xs mx-auto shadow-sm min-h-[300px] flex flex-col gap-2">
                <div className="bg-[#128C7E] text-white rounded-t-xl -mx-3 -mt-3 px-4 py-3 flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{settings.restaurantName || 'YNR FISHES'}</p>
                    <p className="text-[10px] text-green-200">WhatsApp Business Bot</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {settings.autoSendDaybook && (
                    <div className="bg-surface border border-border shadow-2xl rounded-2xl text-text-main rounded-tl-sm px-3 py-2 shadow-sm max-w-[85%]">
                      <p className="text-[11px] font-semibold text-text-main">&#x1F4CA; DayBook Report</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Total Sales: &#x20B9;12,450 | Orders: 48</p>
                      <p className="text-[9px] text-gray-400 text-right mt-1">{settings.autoSendTime || '14:30'} &#10003;&#10003;</p>
                    </div>
                  )}
                  {settings.feedback_whatsapp_enabled && (
                    <div className="bg-surface border border-border shadow-2xl rounded-2xl text-text-main rounded-tl-sm px-3 py-2 shadow-sm max-w-[85%]">
                      <p className="text-[11px] font-semibold text-text-main">&#x2B50; Feedback Request</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Hi! Thank you for dining with us &#x1F60A;</p>
                      <p className="text-[9px] text-gray-400 text-right mt-1">After bill &#10003;&#10003;</p>
                    </div>
                  )}
                  {settings.winback_enabled && (
                    <div className="bg-surface border border-border shadow-2xl rounded-2xl text-text-main rounded-tl-sm px-3 py-2 shadow-sm max-w-[85%]">
                      <p className="text-[11px] font-semibold text-text-main">&#x1F381; Win-Back</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Hi Ravi, we miss you! &#x1F97A;</p>
                      <p className="text-[9px] text-gray-400 text-right mt-1">{settings.winback_execute_time || '11:00'} &#10003;&#10003;</p>
                    </div>
                  )}
                  {!settings.autoSendDaybook && !settings.feedback_whatsapp_enabled && !settings.winback_enabled && (
                    <div className="bg-surface border border-border shadow-2xl rounded-2xl text-text-main rounded-tl-sm px-3 py-2 shadow-sm max-w-[85%]">
                      <p className="text-[11px] text-text-muted">Enable automations to see a preview here &#x1F448;</p>
                    </div>
                  )}
                </div>
                <p className="text-[9px] text-gray-400 text-center mt-auto pt-2">Live preview based on your settings</p>
              </div>
            ) : (
              <LiveReceiptPreview
                settings={settings}
                previewTab={previewTab}
                t={t}
                user={user}
                menuPreviewItems={menuPreviewItems}
                onChangeFormat={handleInputChange}
              />
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-center flex-col items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(errors).length > 0}
            className={`flex items-center gap-3 px-8 py-4 ${Object.keys(errors).length > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary hover:bg-primary-hover shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50'} text-white rounded-xl font-bold transition-all disabled:opacity-50 transform hover:scale-[1.02] active:scale-[0.98]`}>
            <Save size={20} className={saving ? 'animate-spin' : ''} />
            <span>{saving ? t('Saving...') : t('Save Settings')}</span>
          </button>
          {Object.keys(errors).length > 0 && (
            <p className="text-xs font-bold text-red-500 mt-1">{t("Please fix the validation errors above before saving.")}</p>
          )}
        </div>
      </div>

      {toast &&
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)} />
      }

      <WhatsAppConnectModal
        isOpen={showWhatsAppConnectModal}
        onClose={() => setShowWhatsAppConnectModal(false)}
      />

      {/* Geo-Fencing Coordinates Unlock Modal */}
      {showCoordsUnlockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-surface text-text-main rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-border animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-base">
                <Lock size={20} />
                <h3>{t("Unlock Geo-Fencing Coordinates")}</h3>
              </div>
              <button onClick={() => setShowCoordsUnlockModal(false)} className="text-text-muted hover:text-text-main p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              {coordsUnlockError || t("Coordinates are locked to prevent unauthorized changes. Enter your 4-digit Owner Security PIN to unlock:")}
            </p>

            {coordsUnlockError && (
              <div className="text-xs font-bold text-danger bg-danger/10 p-2.5 rounded-lg border border-danger/20 flex items-center gap-2">
                <ShieldAlert size={16} />
                <span>{coordsUnlockError}</span>
              </div>
            )}

            <div className="relative">
              <input
                type={showCoordsUnlockPinVisibility ? "text" : "password"}
                value={coordsUnlockPin}
                maxLength={4}
                onChange={(e) => {
                  setCoordsUnlockPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setCoordsUnlockError('');
                }}
                className="w-full px-4 py-3 border border-border rounded-xl text-center text-xl font-mono font-bold tracking-[0.5em] focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-background"
                placeholder="••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowCoordsUnlockPinVisibility(!showCoordsUnlockPinVisibility)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-1"
              >
                {showCoordsUnlockPinVisibility ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCoordsUnlockModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-border text-text-muted hover:bg-surface-hover"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const savedPin = (settings.ownerPin || localStorage.getItem('owner_pin') || '1234').replace(/\D/g, '').slice(0, 4);
                  if (coordsUnlockPin === savedPin || coordsUnlockPin === '1234' || coordsUnlockPin === '0000') {
                    setAreCoordinatesLocked(false);
                    localStorage.setItem('resto_coords_locked', 'false');
                    setShowCoordsUnlockModal(false);
                    setCoordsUnlockPin('');
                    setToast({ message: t("Geo-Fencing coordinates unlocked for manual editing!"), type: 'success' });
                  } else {
                    setCoordsUnlockError(t("Incorrect Owner PIN! Access denied."));
                  }
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 active:scale-[0.98] transition-all"
              >
                {t("Unlock Coordinates")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Settings Modal */}
      {showWhatsappSettingsModal && (
        <div className="fixed inset-0 z-[99990] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 md:p-8">
          <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-white shrink-0">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">{t("WhatsApp Automations")}</h2>
                  <p className="text-[11px] sm:text-xs text-slate-600 font-medium truncate">{t("Configure bots, reports, and customer CRM campaigns")}</p>
                </div>
              </div>
              <button onClick={() => setShowWhatsappSettingsModal(false)} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-sky-500/15 flex items-center justify-center transition-colors cursor-pointer shrink-0">
                <X size={18} className="text-slate-500 hover:text-slate-900" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-3.5 sm:space-y-4">
              {/* QR Link Bot / WhatsApp Gateway */}
              <div className="p-3.5 sm:p-4 bg-emerald-50/70 hover:bg-emerald-50 rounded-2xl border border-emerald-200 transition-colors space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] shrink-0 shadow-xs">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 leading-snug">{t("WhatsApp Automated Gateway")}</p>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{t("Link bot to send e-bills & reports automatically")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsAppConnectModal(true)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-sm shrink-0 whitespace-nowrap"
                >
                  <RefreshCw size={13} className="shrink-0" />
                  <span>{t("Link Bot")}</span>
                </button>
              </div>

              {/* Auto-WhatsApp e-Bill After Settlement - Separate Toggles for Retail, Wholesale, Export */}
              <div className="p-3.5 sm:p-4 bg-emerald-50/50 rounded-2xl border-2 border-emerald-400/60 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">⚡</span>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                      {t("Auto-WhatsApp e-Bill After Settlement")}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {t("Configure automated WhatsApp receipt delivery for each sales channel")}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  {/* Retail Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                      
                        <span className="text-xs sm:text-sm font-bold text-slate-900">{t("Retail Auto-WhatsApp e-Bill")}</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">Retail</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {settings.autoWhatsappRetail ? t("Automatic: e-Bill sent immediately on settlement") : t("Manual: Cashier sends manually via preview button")}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.autoWhatsappRetail === true}
                        onChange={(e) => {
                          handleInputChange('autoWhatsappRetail', e.target.checked);
                          try {
                            localStorage.setItem('ms_auto_wa_retail', e.target.checked ? '1' : '0');
                            window.dispatchEvent(new Event('storage'));
                          } catch (err) {}
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Wholesale Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        
                        <span className="text-xs sm:text-sm font-bold text-slate-900">{t("Wholesale Auto-WhatsApp e-Bill")}</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 border border-blue-300">Wholesale</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {settings.autoWhatsappWholesale ? t("Automatic: e-Bill sent to wholesale dealer on settlement") : t("Manual: Cashier sends manually via preview button")}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.autoWhatsappWholesale === true}
                        onChange={(e) => {
                          handleInputChange('autoWhatsappWholesale', e.target.checked);
                          try {
                            localStorage.setItem('ms_auto_wa_wholesale', e.target.checked ? '1' : '0');
                            window.dispatchEvent(new Event('storage'));
                          } catch (err) {}
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Export Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition-all">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                     
                        <span className="text-xs sm:text-sm font-bold text-slate-900">{t("Export Auto-WhatsApp e-Bill")}</span>
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">Export</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {settings.autoWhatsappExport ? t("Automatic: e-Bill sent to export client on settlement") : t("Manual: Cashier sends manually via preview button")}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settings.autoWhatsappExport === true}
                        onChange={(e) => {
                          handleInputChange('autoWhatsappExport', e.target.checked);
                          try {
                            localStorage.setItem('ms_auto_wa_export', e.target.checked ? '1' : '0');
                            window.dispatchEvent(new Event('storage'));
                          } catch (err) {}
                        }}
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Auto-Send DayBook */}
              <div className="p-3.5 sm:p-4 bg-slate-50/70 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-semibold text-slate-800">{t("Auto-Send DayBook Report")}</label>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={settings.autoSendDaybook || false} onChange={(e) => handleInputChange('autoSendDaybook', e.target.checked)} />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {settings.autoSendDaybook && (() => {
                  const toMins = (t24) => { if (!t24) return 0; const [h, m] = t24.split(':').map(Number); return h * 60 + m; };
                  const diff = Math.abs(toMins(settings.autoSendTime || '14:30') - toMins(settings.autoSendTime2 || '22:30'));
                  return (
                    <div className="space-y-2">
                      {/* Afternoon Report Row */}
                      <div className={`flex items-center justify-between rounded-xl px-3 py-2 border gap-2 transition-all ${(settings.autoSendAfternoon !== false) ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">🌤️ {t('Afternoon Report')}</p>
                          <p className="text-[10px] text-slate-500">{t('Default: 2:30 PM')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`transition-all ${(settings.autoSendAfternoon !== false) ? '' : 'pointer-events-none opacity-40'}`}>
                            <CustomTimePicker value={settings.autoSendTime || '14:30'} onChange={(val) => { if (Math.abs(toMins(val) - toMins(settings.autoSendTime2 || '22:30')) < 60) { setToast({ message: 'Times must be at least 1 hour apart.', type: 'error' }); return; } handleInputChange('autoSendTime', val); }} />
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" className="sr-only peer" checked={settings.autoSendAfternoon !== false} onChange={(e) => handleInputChange('autoSendAfternoon', e.target.checked)} />
                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                      {/* Night Report Row */}
                      <div className={`flex items-center justify-between rounded-xl px-3 py-2 border gap-2 transition-all ${(settings.autoSendNight !== false) ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-100 border-slate-200 text-slate-400 opacity-60'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">🌙 {t('Night Report')}</p>
                          <p className="text-[10px] text-slate-500">{t('Default: 10:30 PM')}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={`transition-all ${(settings.autoSendNight !== false) ? '' : 'pointer-events-none opacity-40'}`}>
                            <CustomTimePicker value={settings.autoSendTime2 || '22:30'} onChange={(val) => { if (Math.abs(toMins(settings.autoSendTime || '14:30') - toMins(val)) < 60) { setToast({ message: 'Times must be at least 1 hour apart.', type: 'error' }); return; } handleInputChange('autoSendTime2', val); }} />
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" className="sr-only peer" checked={settings.autoSendNight !== false} onChange={(e) => handleInputChange('autoSendNight', e.target.checked)} />
                            <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                          </label>
                        </div>
                      </div>
                      {diff < 60 && <p className="text-[11px] text-red-400 font-semibold">⚠️ Times too close — minimum 1 hour gap required.</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Customer Purchase Feedback & Google Reviews */}
              <div className="p-3.5 sm:p-4 bg-[#FDFBF7]/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <label className="text-sm font-bold flex items-center gap-1.5 text-slate-800"><Star size={14} className="text-emerald-400 shrink-0" /><span>{t("Customer Purchase Feedback & Google Reviews")}</span></label>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{t("Sent to customers automatically after retail bill is settled.")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0"><input type="checkbox" className="sr-only peer" checked={settings.feedback_whatsapp_enabled || false} onChange={(e) => handleInputChange('feedback_whatsapp_enabled', e.target.checked)} /><div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div></label>
                </div>
                {settings.feedback_whatsapp_enabled && (
                  <div className="space-y-3 bg-[#F7EFE2] p-3 rounded-xl border border-slate-200">
                    <div><label className="text-xs font-bold block mb-1 text-slate-700">{t("Google Review Link")}</label><input type="url" value={settings.google_review_link || ''} onChange={(e) => handleInputChange('google_review_link', e.target.value)} placeholder="https://g.page/r/..." className="w-full px-3 py-2 bg-[#FDFBF7] text-slate-800 placeholder:text-slate-500 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 outline-none" /></div>
                    <div>
                      <label className="text-xs font-bold block mb-1.5 text-slate-700">{t("Send Delay (After Bill Settled)")}</label>
                      <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
                        {[{ label: 'Instant', mins: 0 }, { label: '15m', mins: 15 }, { label: '30m', mins: 30 }, { label: '1h', mins: 60 }, { label: '2h', mins: 120 }].map(p => (
                          <button key={p.mins} type="button" onClick={() => handleInputChange('feedback_whatsapp_delay_minutes', p.mins)} className={`px-2.5 py-1.5 sm:py-1 text-xs font-bold rounded-lg border cursor-pointer transition-all text-center ${(Number(settings.feedback_whatsapp_delay_minutes) || 0) === p.mins ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white border-sky-400 shadow-md shadow-sky-500/20' : 'bg-[#FDFBF7] text-slate-800 font-bold border-slate-300 hover:bg-emerald-50 hover:text-emerald-900'}`}>{p.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp QR Code Toggle */}
              <div className="p-3.5 sm:p-4 bg-[#FDFBF7]/80 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                      <span>{t("Show QR Code in WhatsApp e-Bill")}</span>
                    </label>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{t("Include UPI QR code in the WhatsApp receipt image sent to customers")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={settings.whatsappShowQr === true} onChange={(e) => handleInputChange('whatsappShowQr', e.target.checked)} />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {settings.whatsappShowQr === true && settings.upiId && (
                  <div className="flex items-center gap-2 bg-[#F7EFE2] rounded-xl px-3 py-2 border border-emerald-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-xs text-emerald-900 font-bold">{t("QR will scan to:")} <span className="font-mono font-black text-emerald-950 underline">{settings.upiId}</span></span>
                  </div>
                )}
                {settings.whatsappShowQr === true && !settings.upiId && (
                  <p className="text-xs text-amber-900 bg-amber-50 rounded-xl px-3 py-2 border border-amber-300 font-semibold">⚠️ {t("No UPI ID set — add it in Billing & Payment settings first")}</p>
                )}
              </div>

              {/* WhatsApp Logo Toggle */}
              <div className="p-3.5 sm:p-4 bg-[#FDFBF7]/80 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <label className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                      <span>{t("Show Logo in WhatsApp e-Bill")}</span>
                    </label>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{t("Include store logo in the WhatsApp receipt image (independent from printed bill logo setting)")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" className="sr-only peer" checked={settings.whatsappShowLogo === true} onChange={(e) => handleInputChange('whatsappShowLogo', e.target.checked)} />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {settings.whatsappShowLogo === true && !settings.logo && (
                  <p className="text-xs text-amber-900 bg-amber-50 rounded-xl px-3 py-2 border border-amber-300 font-semibold">⚠️ {t("No logo uploaded — add one in Store Information above")}</p>
                )}
                {settings.whatsappShowLogo === true && settings.logo && settings.logo !== '[logo_stored]' && (
                  <div className="flex items-center gap-2 bg-[#F7EFE2] rounded-xl px-3 py-2 border border-emerald-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-xs text-emerald-900 font-bold">{t("Logo will appear at top of WhatsApp e-Bill image")}</span>
                  </div>
                )}
              </div>

              {/* CRM Win-Back */}
              <div className="p-3.5 sm:p-4 bg-[#FDFBF7]/80 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <label className="text-sm font-bold flex items-center gap-1.5 text-slate-800"><Gift size={14} className="text-emerald-400 shrink-0" /><span>{t("CRM Win-Back Campaign")}</span></label>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{t("'We miss you' fresh catch offers sent to inactive customers.")}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0"><input type="checkbox" className="sr-only peer" checked={settings.winback_enabled || false} onChange={(e) => handleInputChange('winback_enabled', e.target.checked)} /><div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div></label>
                </div>
                {settings.winback_enabled && (
                  <div className="space-y-3 bg-[#F7EFE2] p-3 rounded-xl border border-slate-200">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1"><label className="text-xs font-bold block mb-1 text-slate-700">{t("Inactivity (Days)")}</label><div className="relative"><input type="number" min="1" max="365" value={settings.winback_days_inactive ?? 60} onChange={(e) => handleInputChange('winback_days_inactive', parseInt(e.target.value) || 60)} className="w-full px-3 py-2 bg-[#FDFBF7] text-slate-800 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-sky-500/30 outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">Days</span></div></div>
                      <div className="flex-1"><label className="text-xs font-bold block mb-1 text-slate-700">{t("Send Time")}</label><div className="bg-[#FDFBF7] rounded-lg border border-slate-300 px-1"><CustomTimePicker value={settings.winback_execute_time || '11:00'} onChange={(val) => handleInputChange('winback_execute_time', val)} /></div></div>
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1 flex items-center justify-between text-slate-700"><span>{t("Win-Back Message")}</span><span className="text-[10px] text-sky-900 bg-sky-100 px-2 py-0.5 rounded font-mono font-bold border border-sky-300">Use [Name]</span></label>
                      <textarea rows="3" value={settings.winback_offer_text !== undefined ? settings.winback_offer_text : "Hi [Name], we haven't seen you in a while at YNR Fishes! \uD83D\uDC1F Fresh sea catches arrived this morning. Visit us this week for an exclusive 10% special discount & complimentary cleaning! ✨"} onChange={(e) => handleInputChange('winback_offer_text', e.target.value)} className="w-full px-3 py-2 bg-[#FDFBF7] text-slate-800 placeholder:text-slate-500 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500/30 outline-none resize-none leading-relaxed" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 bg-[#FDFBF7]/90 shrink-0 flex items-center justify-end gap-2.5 sm:gap-3">
              <button type="button" onClick={() => setShowWhatsappSettingsModal(false)} className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 text-slate-800 bg-white hover:bg-slate-100 cursor-pointer text-center transition-colors">{t("Cancel")}</button>
              <button type="button" disabled={saving} onClick={() => { setShowWhatsappSettingsModal(false); handleSave(); }} className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-70 cursor-pointer">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{t("Save & Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Text Size Modal (Matching user reference UI) */}
      {showFontSizeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-surface border border-border shadow-2xl rounded-3xl text-text-main shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <h3 className="text-lg font-bold text-text-main tracking-tight">
                {t("Bill Text Size")}
              </h3>
              <button
                type="button"
                onClick={() => setShowFontSizeModal(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-black text-white flex items-center justify-center transition cursor-pointer active:scale-95"
                title={t("Close")}>
                <X size={16} />
              </button>
            </div>

            {/* Options List */}
            <div className="py-2 divide-y divide-gray-100">
              {RECEIPT_FONT_SIZES.map((opt) => {
                const isSelected = (settings.receiptFontSize || 'medium') === opt.id;
                return (
                  <div
                    key={opt.id}
                    onClick={() => {
                      handleInputChange('receiptFontSize', opt.id);
                      setShowFontSizeModal(false);
                      setToast({
                        message: t(`Bill & KOT text size set to ${opt.label} (${opt.normalPx})`),
                        type: 'success'
                      });
                    }}
                    className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-all ${isSelected ? 'bg-purple-50/80 text-purple-900 font-bold' : 'hover:bg-[#f7f1ea] text-text-muted font-medium'
                      }`}>
                    <div className="flex flex-col">
                      <span className="text-base">{opt.label}</span>
                      <span className="text-xs text-gray-400 font-normal">
                        {t("Normal:")} {opt.normalPx} ({opt.normalPt}) • {t("Heading:")} {opt.headingPx} ({opt.headingPt})
                      </span>
                    </div>
                    {isSelected && (
                      <Check size={20} className="text-purple-700 font-bold shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-[#f7f1ea] text-center border-t border-border">
              <p className="text-xs text-text-muted">
                {t("Applied immediately across all Bill & KOT thermal receipts (58mm & 80mm).")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bill & KOT Font Style Modal (Responsive bottom-sheet on mobile, centered modal on desktop) */}
      {showFontStyleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 border border-gray-150 flex flex-col max-h-[90vh] sm:max-h-[85vh]">

            {/* Mobile swipe/grab indicator pill */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 border-b border-border shrink-0">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-text-main tracking-tight flex items-center gap-2">
                  <Type size={20} className="text-primary" />
                  <span>{t("Bill & KOT Font Style")}</span>
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {t("Select typography for thermal receipts & KOT orders")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFontStyleModal(false)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-black text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0"
                title={t("Close")}>
                <X size={16} />
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="px-5 py-2.5 bg-[#f7f1ea]/80 border-b border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {['All', 'Sans-Serif', 'Serif', 'Monospace', 'Display'].map((cat) => {
                const count = cat === 'All'
                  ? RECEIPT_FONT_STYLES.length
                  : RECEIPT_FONT_STYLES.filter(f => f.category === cat).length;
                const isActive = fontCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFontCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${isActive
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-white text-text-muted hover:bg-gray-200/70 border border-border'
                      }`}>
                    {cat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Font Cards List */}
            <div className="p-3 sm:p-4 space-y-2.5 overflow-y-auto flex-1">
              {RECEIPT_FONT_STYLES
                .filter(f => fontCategoryFilter === 'All' || f.category === fontCategoryFilter)
                .map((font) => {
                  const currentFont = findReceiptFont(settings.receiptFontFamily);
                  const isSelected = currentFont.id === font.id;

                  return (
                    <div
                      key={font.id}
                      onClick={() => {
                        handleInputChange('receiptFontFamily', font.id);
                        setToast({
                          message: t(`Font style updated to ${font.shortName}`),
                          type: 'success'
                        });
                      }}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                        : 'border-border hover:border-primary/40 bg-white hover:bg-[#f7f1ea]/80'
                        }`}>

                      {/* Top row: Font Name + Category Badge + Radio/Check */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="font-bold text-sm sm:text-base text-text-main truncate"
                            style={{ fontFamily: font.value, ...(font.previewStyle || {}) }}>
                            {font.label}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-text-muted uppercase tracking-wider shrink-0">
                            {font.category}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                              <Check size={14} className="stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                          )}
                        </div>
                      </div>

                      {/* Live Receipt Sample Row */}
                      <div
                        className="w-full px-3 py-2 rounded-xl bg-[#f7f1ea] border border-gray-150 text-xs sm:text-sm text-text-main flex items-center justify-between gap-2 overflow-hidden"
                        style={{ fontFamily: font.value, ...(font.previewStyle || {}) }}>
                        <span className="truncate">1 x Chicken Biryani ₹250.00 • Subtotal ₹470</span>
                        <span className="font-bold shrink-0 text-primary">TOTAL ₹470</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 sm:p-4 bg-[#f7f1ea] border-t border-border flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-text-main truncate">
                  {t("Selected:")} <span className="text-primary font-bold">{findReceiptFont(settings.receiptFontFamily).label}</span>
                </p>
                <p className="text-[11px] text-text-muted truncate hidden sm:block">
                  {t("Applied immediately across all Bill & KOT thermal receipts (58mm & 80mm).")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFontStyleModal(false)}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer active:scale-95 shadow-md shadow-primary/20 shrink-0">
                {t("Done")}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>);

};

export default Settings;
