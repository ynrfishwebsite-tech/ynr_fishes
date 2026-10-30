import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';

const BackButton = ({ onClick, label = 'Back', className = '' }) => {
  const { t } = useLanguage();
  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 active:scale-95 border border-slate-300 rounded-xl transition-all shadow-xs cursor-pointer md:px-4 md:py-2 ${className}`}
      aria-label={t(label)}
    >
      <ArrowLeft size={16} className="md:w-5 md:h-5 text-slate-600" />
      <span className="font-semibold">{t(label)}</span>
    </button>
  );
};

export default BackButton;
