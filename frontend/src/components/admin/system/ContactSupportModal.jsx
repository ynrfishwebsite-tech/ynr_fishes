import { useLanguage } from "../../../context/LanguageContext";import React from 'react';
import { X, Phone, Mail, Globe, MessageSquare, HeadphonesIcon } from 'lucide-react';

const ContactSupportModal = ({ isOpen, onClose }) => {const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[#E8DCCB] animate-slide-up relative text-slate-800">
        
        {/* Header Background */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-black/10 blur-2xl"></div>
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-black/20 rounded-full transition-all">
            
            <X size={24} />
          </button>
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg">
              <HeadphonesIcon size={40} className="text-white drop-shadow-md" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight drop-shadow-md">{t("Support Center")}</h2>
              <p className="text-orange-50 font-medium mt-1 drop-shadow-sm">{t("We're here to help you 24/7")}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <p className="text-slate-600 mb-8 font-medium">{t("Having trouble with your Fish Market YNR billing terminal? Reach out to our store helpdesk using any of the channels below.")}

          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone Card 1 */}
            <div className="bg-[#F7EFE2] p-6 rounded-2xl border border-[#E8DCCB] hover:shadow-md hover:border-[#ea580c] transition-all group">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 text-orange-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Phone size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{t("Store Contact")}</h3>
              <p className="text-slate-500 text-sm mb-3">{t("Chemmumiahpet, Kadapa")}</p>
              <a href="tel:+919701800140" className="text-lg font-black text-orange-500 hover:text-orange-600 transition-colors">
                +91 9701800140
              </a>
            </div>

            {/* Phone Card 2 */}
            <div className="bg-[#F7EFE2] p-6 rounded-2xl border border-[#E8DCCB] hover:shadow-md hover:border-[#ea580c] transition-all group">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 text-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare size={24} />
              </div>
              <h3 className="font-bold text-slate-900 mb-1">{t("WhatsApp Support")}</h3>
              <p className="text-slate-500 text-sm mb-3">{t("For quick support and queries")}</p>
              <a href="tel:+919032223352" className="text-lg font-black text-blue-500 hover:text-blue-600 transition-colors">
                +91 9032223352
              </a>
            </div>

            {/* Email Card */}
            <div className="bg-[#F7EFE2] p-6 rounded-2xl border border-[#E8DCCB] hover:shadow-md hover:border-[#ea580c] transition-all group md:col-span-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 text-green-500 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{t("Email Support")}</h3>
                  <p className="text-slate-500 text-sm mb-2">{t("Send us queries or requests")}</p>
                  <a href="mailto:contact@fishmarketynr.com" className="text-lg font-black text-green-500 hover:text-green-600 transition-colors">{t("contact@fishmarketynr.com")}

                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#E8DCCB] text-center">
            <p className="text-sm font-medium text-slate-400 flex items-center justify-center gap-2">
              <Globe size={16} />{t("Fish Market YNR - Nature's Super Food")}
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>);

};

export default ContactSupportModal;