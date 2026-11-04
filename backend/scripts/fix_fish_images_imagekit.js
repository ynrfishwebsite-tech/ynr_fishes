import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'node:dns';
import mongoose from 'mongoose';
import ImageKit from 'imagekit';

// Fix Windows DNS resolution for MongoDB Atlas SRV
dns.setServers(['8.8.8.8', '1.1.1.1']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../frontend/public');

const ik = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Comprehensive mapping of fish items to their actual image source
const FISH_IMAGE_CONFIG = [
  {
    match: ['rohu', 'రోహు', 'labeo rohita'],
    fileName: 'rohu.png',
    localFile: 'bocha.png' // bocha.png contains real Rohu carp
  },
  {
    match: ['katla', 'కాట్లా', 'బొచ్చె', 'gibelion catla'],
    fileName: 'katla.png',
    localFile: 'catla.png'
  },
  {
    match: ['prawn', 'రొయ్యలు', 'penaeus monodon'],
    fileName: 'red_prawns.jpg',
    localFile: 'images/prawns.jpg'
  },
  {
    match: ['basa', 'పంగస్', 'pangasius'],
    fileName: 'basa_pangas.png',
    localFile: 'pangas.png'
  },
  {
    match: ['white pomfret', 'తెల్ల చందువా', 'pampus argenteus'],
    fileName: 'white_pomfret.png',
    localFile: 'pumenu.png'
  },
  {
    match: ['vanjaram', 'king fish', 'వంజరం', 'scomberomorus'],
    fileName: 'vanjaram_kingfish.jpg',
    localFile: 'images/sea_fish.jpg'
  },
  {
    match: ['tilapia', 'తిలాపియా', 'pilot', 'oreochromis'],
    fileName: 'tilapia_jalebi.png',
    localFile: 'jalebi.png'
  },
  {
    match: ['korramenu', 'కొర్రమీను', 'murrel', 'channa striata'],
    fileName: 'korramenu_murrel.png',
    localFile: 'korameenu.png'
  },
  {
    match: ['common fish', 'కామన్ ఫిష్', 'cyprinus carpio'],
    fileName: 'common_fish.png',
    localFile: 'gaddi.png'
  },
  {
    match: ['mattu', 'మట్టు', 'siluriformes'],
    fileName: 'mattu_mosu.png',
    localFile: 'mosu.png'
  },
  {
    match: ['karimeen', 'కరిమీన్', 'etroplus'],
    fileName: 'karimeen_pearlspot.png',
    localFile: 'chuka jilebi.png'
  },
  {
    match: ['apollo meat', 'అపోలో ఫిష్', 'boneless fillet'],
    fileName: 'apollo_meat.png',
    localFile: 'cut jella.png'
  },
  {
    match: ['tuna', 'సూర', 'చూర', 'thunnini'],
    fileName: 'tuna_dhoma.png',
    localFile: 'dhoma.png'
  },
  {
    match: ['aila', 'కనగర్తలు', 'mackerel', 'rastrelliger'],
    fileName: 'aila_mackerel.jpg',
    localFile: 'images/sea_fish_1790409145549.jpg',
    fallbackLocal: 'images/sea_fish.jpg'
  },
  {
    match: ['sheelavathi', 'ఓషా ఫిష్', 'శీలావతి', 'labeo rohita hybrid'],
    fileName: 'sheelavathi.jpg',
    localFile: 'images/freshwater_fish.jpg',
    fallbackLocal: 'gaddi.png'
  },
  {
    match: ['nethallu', 'nethili', 'నెత్తళ్లు', 'anchoviella'],
    fileName: 'nethallu_anchovy.jpg',
    localFile: 'images/gella_small.jpg',
    fallbackLocal: 'jella.png'
  },
  {
    match: ['black pomfret', 'నల్ల చందువా', 'parastromateus'],
    fileName: 'black_pomfret.png',
    localFile: 'assets/silver_pomfret.png',
    fallbackLocal: 'pumenu.png'
  },
  {
    match: ['sea crabs', 'పీతలు', 'crabs', 'portunus pelagicus'],
    fileName: 'sea_crabs.jpg',
    localFile: 'images/crabs.jpg'
  },
  {
    match: ['mirayal', 'మిరయల్', 'cirrhinus mrigala'],
    fileName: 'mirayal_mrigal.jpg',
    localFile: 'images/freshwater_fish.jpg',
    fallbackLocal: 'bocha.png'
  },
  {
    match: ['bangaru theega', 'బంగారుతీగ', 'golden fish', 'carassius auratus'],
    fileName: 'bangaru_theega.png',
    localFile: 'bangaru teega.png'
  },
  {
    match: ['koli', 'కోలి చేప', 'croaker', 'otolithes ruber'],
    fileName: 'koli_croaker.png',
    localFile: 'kontimuka.png'
  },
  {
    match: ['pothi gini', 'చిన్న చేపలు', 'puntius sophore'],
    fileName: 'pothi_gini.png',
    localFile: 'chuka jilebi.png'
  },
  {
    // Rani / Pink Perch (Nemipterus japonicus) - the catch photo from the screenshot
    match: ['rani', 'గులివిందలు', 'nemipterus japonicus', 'pink perch'],
    fileName: 'rani_gulivindalu.png',
    localFile: 'ulinka.png'
  },
  {
    match: ['wallago', 'వాలగ', 'valuga', 'wallago attu'],
    fileName: 'wallago_valuga.png',
    localFile: 'valuga.png'
  }
];

async function uploadToImageKit(config) {
  let filePath = path.join(publicDir, config.localFile);
  if (!fs.existsSync(filePath) && config.fallbackLocal) {
    filePath = path.join(publicDir, config.fallbackLocal);
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local file not found: ${filePath}`);
  }

  // Create local alias in public folder if helpful
  const localAliasPath = path.join(publicDir, config.fileName);
  if (!fs.existsSync(localAliasPath)) {
    try {
      fs.copyFileSync(filePath, localAliasPath);
    } catch (e) {}
  }

  const fileBuffer = fs.readFileSync(filePath);

  const uploadRes = await ik.upload({
    file: fileBuffer,
    fileName: config.fileName,
    folder: '/menus/',
    useUniqueFileName: false,
    overwriteFile: true
  });

  return uploadRes.url;
}

async function run() {
  console.log('=== 1. Uploading verified fish photos to ImageKit ===');
  const urlMap = new Map();

  for (const item of FISH_IMAGE_CONFIG) {
    try {
      const url = await uploadToImageKit(item);
      console.log(`✅ [ImageKit] ${item.fileName} -> ${url}`);
      urlMap.set(item.fileName, url);
    } catch (err) {
      console.error(`❌ [ImageKit Error] ${item.fileName}:`, err.message);
    }
  }

  console.log('\n=== 2. Connecting to MongoDB & Updating Menu Items ===');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const targetDatabases = ['kdp', 'fishes'];

  for (const dbName of targetDatabases) {
    const db = mongoose.connection.client.db(dbName);
    const cols = await db.listCollections().toArray();
    const hasMenus = cols.some(c => c.name === 'menus');
    if (!hasMenus) {
      console.log(`DB ${dbName} has no menus collection, skipping`);
      continue;
    }

    const items = await db.collection('menus').find({}).toArray();
    console.log(`\nDB [${dbName}]: Found ${items.length} items in menus`);

    for (const menuDoc of items) {
      const name = (menuDoc.name || '').toLowerCase();
      const sciName = (menuDoc.scientificName || '').toLowerCase();

      const foundConfig = FISH_IMAGE_CONFIG.find(cfg =>
        cfg.match.some(m => name.includes(m.toLowerCase()) || sciName.includes(m.toLowerCase()))
      );

      if (foundConfig) {
        const ikUrl = urlMap.get(foundConfig.fileName);
        if (ikUrl) {
          await db.collection('menus').updateOne(
            { _id: menuDoc._id },
            { $set: { image: ikUrl, updatedAt: new Date() } }
          );
          console.log(`  Updated [${menuDoc.name}] => ${ikUrl}`);
        } else {
          console.warn(`  No ImageKit URL for ${menuDoc.name}`);
        }
      } else {
        console.warn(`  Unmatched item: ${menuDoc.name} (${menuDoc.scientificName})`);
      }
    }
  }

  await mongoose.disconnect();
  console.log('\n✅ All database items updated with ImageKit URLs successfully!');
}

run().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

