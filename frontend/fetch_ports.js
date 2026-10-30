import fs from 'fs';
import path from 'path';

async function fetchWikiImage(query, filename) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&pithumbsize=800&titles=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    const pages = data.query.pages;
    const pageId = Object.keys(pages)[0];
    if (pageId !== '-1' && pages[pageId].thumbnail) {
      const imgUrl = pages[pageId].thumbnail.source;
      const imgRes = await fetch(imgUrl);
      const buffer = await imgRes.arrayBuffer();
      fs.writeFileSync(path.join('public/images', filename), Buffer.from(buffer));
      console.log(`Saved ${filename} from ${imgUrl}`);
      return `/images/${filename}`;
    } else {
        console.log(`No image found for ${query}`);
    }
  } catch(e) {
    console.error(`Failed to fetch ${query}:`, e);
  }
  return null;
}

const ports = [
  { name: 'Krishnapatnam_Port', file: 'nellore_port.jpg' },
  { name: 'Chennai_Port', file: 'chennai_port.jpg' },
  { name: 'Mumbai_Port_Trust', file: 'mumbai_port.jpg' },
  { name: 'Mormugao_Port_Authority', file: 'goa_port.jpg' },
  { name: 'Syama_Prasad_Mookerjee_Port_Trust', file: 'kolkata_port.jpg' },
  { name: 'Visakhapatnam_Port', file: 'vizag_port.jpg' },
  { name: 'Cochin_Port', file: 'kochi_port.jpg' },
  { name: 'New_Mangalore_Port_Authority', file: 'mangalore_port.jpg' },
  { name: 'Paradip_Port', file: 'paradip_port.jpg' },
  { name: 'Haldia_Dock_Complex', file: 'haldia_port.jpg' },
  { name: 'V._O._Chidambaranar_Port_Authority', file: 'tuticorin_port.jpg' },
  { name: 'Kandla_Port', file: 'kandla_port.jpg' },
  { name: 'Kamarajar_Port_Limited', file: 'ennore_port.jpg' },
  { name: 'Kakinada_Port', file: 'kakinada_port.jpg' },
  { name: 'Port', file: 'machilipatnam_port.jpg' } // fallback generic port for Machilipatnam
];

async function run() {
  for (const p of ports) {
    await fetchWikiImage(p.name, p.file);
  }
}
run();
