const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/components/admin/billing/BillSummary.jsx');
let code = fs.readFileSync(targetPath, 'utf8');

code = code.replace(
  'fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in',
  'fixed inset-0 bg-black/50 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in'
);

code = code.replace(
  'border border-sky-500/40 shadow-2xl rounded-2xl text-slate-100',
  'border border-[#eedecb] shadow-2xl rounded-2xl text-slate-800'
);

code = code.replace(
  'bg-sky-500/20 border border-sky-500/40 text-sky-400 rounded-xl',
  'bg-orange-100 border border-orange-200 text-[#ea580c] rounded-xl'
);

code = code.replace(
  '<h2 className="text-base font-black text-white">{t("Available Offers & Discounts")}</h2>',
  '<h2 className="text-base font-black text-slate-800">{t("Available Offers & Discounts")}</h2>'
);

code = code.replace(
  '<div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1 bg-[#f7f1ea]">',
  '<div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1 bg-white">'
);

code = code.replace(
  '<span className="font-bold text-sm text-white truncate">{offer.name}</span>',
  '<span className="font-bold text-sm text-slate-800 truncate">{offer.name}</span>'
);

// Also fix input texts in container charge and delivery charge
code = code.replace(
  /className="w-\[80px\] bg-\[#ffffff\] border border-\[#eedecb\] text-white text-right/g,
  'className="w-[80px] bg-[#FAF7F2] border border-[#eedecb] text-[#1e293b] text-right'
);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('BillSummary.jsx offers modal and input text colors updated!');

