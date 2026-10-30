import React, { useState, useEffect } from 'react';
import { getWhatsAppStatus } from '../../../api/communication/whatsapp';
import { useLanguage } from '../../../context/LanguageContext';

const WhatsAppStatusIndicator = ({ mobileMenu, naked, onClick }) => {
  const { t } = useLanguage();
  const [waConnected, setWaConnected] = useState(false);

  useEffect(() => {
    const fetchWA = async () => {
      try {
        const res = await getWhatsAppStatus();
        setWaConnected(res && res.status === 'CONNECTED' && !!res.connectedNumber);
      } catch (e) {
        setWaConnected(false);
      }
    };
    fetchWA();
    const interval = setInterval(fetchWA, 30000);
    return () => clearInterval(interval);
  }, []);

  const svgIcon = (
    <svg className={`w-4 h-4 sm:w-[18px] sm:h-[18px] fill-current ${waConnected ? "text-[#25D366]" : "text-red-500"}`} viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
    </svg>
  );

  if (naked) {
    return (
      <button
        onClick={onClick}
        className="p-1 flex items-center justify-center cursor-pointer transition-transform active:scale-95"
        title={waConnected ? t("WhatsApp Bot: Connected") : t("WhatsApp Bot: Disconnected")}
      >
        {svgIcon}
      </button>
    );
  }

  if (mobileMenu) {
    return (
      <button
        onClick={onClick}
        className="flex items-center justify-center gap-1.5 px-2.5 py-2.5 bg-[#f7f1ea] hover:bg-gray-100 border border-border rounded-xl text-xs font-bold text-text-muted w-full"
        title={waConnected ? t("WhatsApp Bot: Connected") : t("WhatsApp Bot: Disconnected")}
      >
        {svgIcon}
        <span>{t('WhatsApp')}</span>
      </button>
    );
  }

  return (
    <div 
      className="hidden md:flex items-center justify-center p-1.5 rounded-lg border border-border bg-white cursor-help transition-colors mr-1"
      title={waConnected ? t("WhatsApp Bot: Connected") : t("WhatsApp Bot: Disconnected")}
    >
      {svgIcon}
    </div>
  );
};

export default WhatsAppStatusIndicator;
