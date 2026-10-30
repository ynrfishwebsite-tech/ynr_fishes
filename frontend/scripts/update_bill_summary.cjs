const fs = require('fs');

const path = 'fish_website/frontend/src/components/admin/billing/BillSummary.jsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Overall sidebar container
c = c.replace(/border-l border-orange-100/g, 'border-l border-[#eedecb]');

// 2. Counter Sale header
c = c.replace(/px-3 py-2 bg-\[#ffffff\] border-b border-sky-500\/20/g, 'px-3 py-2 bg-[#FAF7F2] border-b border-[#eedecb]');
c = c.replace(/text-sky-300 tracking-wide uppercase">\s*\{t\("Counter Sale \/ Direct Order"\)\}/g, 'text-[#0f2942] tracking-wide uppercase font-black">{t("Counter Sale / Direct Order")}');
c = c.replace(/bg-sky-500\/15 text-sky-400 border border-sky-500\/30/g, 'bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] font-bold');

// 3. Info bar - CRM & Notes
c = c.replace(/px-2\.5 sm:px-3 py-1\.5 border-b border-sky-500\/20 bg-\[#ffffff\]/g, 'px-2.5 sm:px-3 py-1.5 border-b border-[#eedecb] bg-[#FAF7F2]');
c = c.replace(/bg-\[#f7f1ea\] hover:bg-\[#fff7ed\] border-sky-500\/20 text-slate-300 hover:text-white/g, 'bg-[#ffffff] hover:bg-[#FFF3E5] border-[#eedecb] text-[#334155]');
c = c.replace(/bg-\[#ffffff\] hover:bg-sky-950 border border-sky-500\/30 text-slate-300 hover:text-white/g, 'bg-[#ffffff] hover:bg-[#FFF3E5] border border-[#eedecb] text-[#334155]');

// 4. Table Headers
c = c.replace(/bg-\[#faf8f5\] border-b border-sky-500\/20 text-sky-300/g, 'bg-[#FAF7F2] border-b border-[#eedecb] text-[#475569]');

// 5. Scrollable cart list container
c = c.replace(/bg-\[#030e1a\]/g, 'bg-[#ffffff]');
c = c.replace(/bg-\[#020b16\]/g, 'bg-[#ffffff]');
c = c.replace(/text-gray-400 py-10/g, 'text-slate-400 py-12');
c = c.replace(/hover:bg-\[#f7f1ea\]/g, 'hover:bg-[#FFF3E5]');
c = c.replace(/border-b border-border hover:bg-\[#FFF3E5\]/g, 'border-b border-[#f1f5f9] hover:bg-[#FFF3E5]');

// Quantity controls
c = c.replace(/bg-\[#faf8f5\] rounded-md overflow-hidden border border-sky-500\/30/g, 'bg-[#FAF7F2] rounded-lg overflow-hidden border border-[#eedecb]');
c = c.replace(/text-slate-400 hover:bg-sky-950 hover:text-red-400/g, 'text-[#64748b] hover:bg-[#FFF3E5] hover:text-red-500');
c = c.replace(/text-slate-400 hover:bg-sky-950 hover:text-emerald-400/g, 'text-[#64748b] hover:bg-[#FFF3E5] hover:text-emerald-600');
c = c.replace(/bg-\[#ffffff\] text-center font-bold text-\[11px\] text-sky-200 focus:outline-none focus:ring-1 focus:ring-sky-400 border-x border-sky-500\/30/g, 'bg-[#ffffff] text-center font-bold text-[11px] text-[#1e293b] focus:outline-none border-x border-[#eedecb]');

// 6. Bottom action area & charges
c = c.replace(/bg-\[#041322\] border-t border-sky-500\/20 shadow-\[0_-4px_20px_rgba\(0,0,0,0\.4\)\]/g, 'bg-[#FAF7F2] border-t border-[#eedecb] shadow-sm');
c = c.replace(/bg-\[#f7f1ea\] flex flex-col relative w-full border-b border-sky-900\/40/g, 'bg-[#FAF7F2] flex flex-col relative w-full border-b border-[#eedecb]');
c = c.replace(/bg-\[#ffffff\] hover:bg-sky-950\/80 flex items-center justify-center text-sky-400 transition-colors border-t border-sky-500\/25/g, 'bg-[#FAF7F2] hover:bg-[#FFF3E5] flex items-center justify-center text-slate-500 transition-colors border-t border-[#eedecb]');
c = c.replace(/text-sky-400 stroke-\[2\.5\]/g, 'text-slate-500 stroke-[2.2]');
c = c.replace(/bg-\[#faf8f5\]/g, 'bg-[#FAF7F2]');
c = c.replace(/border-sky-500\/30/g, 'border-[#eedecb]');
c = c.replace(/border-sky-500\/20/g, 'border-[#eedecb]');

// Offers and Total bar
c = c.replace(/bg-sky-500\/15 text-sky-300 border-sky-500\/30 hover:bg-sky-500\/25/g, 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa] hover:bg-[#ffedd5]');
c = c.replace(/bg-rose-500\/15 text-rose-300 border-rose-500\/30 hover:bg-rose-500\/25/g, 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca] hover:bg-[#fee2e2]');
c = c.replace(/text-sky-100 text-right px-1\.5 rounded-lg outline-none focus:border-sky-400 font-bold/g, 'text-[#1e293b] text-right px-1.5 rounded-lg outline-none focus:border-[#ea580c] font-black');

// Checkbox and WhatsApp toggle
c = c.replace(/border-sky-500\/40 bg-\[#FAF7F2\]/g, 'border-[#eedecb] bg-white');

// Status messages
c = c.replace(/bg-\[#f7f1ea\]\/80/g, 'bg-[#FAF7F2]');
c = c.replace(/bg-\[#f7f1ea\]\/50/g, 'bg-white');

// 7. Action Buttons Grid
c = c.replace(/grid grid-cols-2 gap-2 px-2\.5 py-2\.5 bg-\[#041322\]/g, 'grid grid-cols-2 gap-2 px-2.5 py-2.5 bg-[#FAF7F2]');
c = c.replace(/bg-\[#fff7ed\] text-sky-300 py-2 rounded-xl text-xs font-bold hover:bg-\[#0a2c52\]/g, 'bg-white text-slate-700 py-2 rounded-xl text-xs font-bold hover:bg-[#FFF3E5] border border-[#eedecb]');
c = c.replace(/bg-red-500\/15 text-red-400 py-2 rounded-xl text-xs font-bold hover:bg-red-500\/25/g, 'bg-[#fef2f2] text-[#dc2626] py-2 rounded-xl text-xs font-bold hover:bg-[#fee2e2] border border-[#fecaca]');

// 8. Direct Print Config
c = c.replace(/px-2 py-1 bg-\[#041322\] border-t border-sky-500\/20/g, 'px-2 py-1 bg-[#FAF7F2] border-t border-[#eedecb]');
c = c.replace(/bg-\[#f7f1ea\] px-2 py-1 rounded border border-border/g, 'bg-white px-2 py-1 rounded border border-[#eedecb]');
c = c.replace(/bg-\[#ffffff\] shadow-2xl border border-sky-500\/40/g, 'bg-white shadow-2xl border border-[#eedecb]');
c = c.replace(/text-sky-400 uppercase tracking-wider mb-2 border-b border-sky-900\/50/g, 'text-[#ea580c] uppercase tracking-wider mb-2 border-b border-[#eedecb]');

fs.writeFileSync(path, c, 'utf8');
console.log('Successfully overhauled BillSummary.jsx to warm cream / white aesthetic!');

