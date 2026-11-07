import fs from 'fs';
import path from 'path';

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) searchDir(full);
    else if (full.endsWith('.js')) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('/bills') || c.includes('getOpenBills') || c.includes('open')) {
        if (c.includes('/open') || c.includes('getOpenOrders') || c.includes('getOpenBills')) {
          console.log('Match:', full);
        }
      }
    }
  }
}
searchDir('c:/Users/shaik/Desktop/fishes_1/fish_website/backend');

