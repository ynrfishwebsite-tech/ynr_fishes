import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

// Helper to determine waterType from name and category
function getWaterType(item) {
  const text = `${item.name || ''} ${item.category?.name || item.category || ''}`.toLowerCase();
  if (
    text.includes('sea') || text.includes('marine') || text.includes('ocean') ||
    text.includes('pomfret') || text.includes('vanjaram') || text.includes('tuna') ||
    text.includes('aila') || text.includes('nethallu') || text.includes('nethili') ||
    text.includes('rani') || text.includes('koli') || text.includes('crab') || text.includes('పీతలు')
  ) {
    return 'sea_water';
  }
  return 'fresh_water';
}

// Helper to determine speciesType from name
function getSpeciesType(item) {
  const text = `${item.name || ''} ${item.category?.name || item.category || ''}`.toLowerCase();
  if (text.includes('prawn') || text.includes('shrimp') || text.includes('రొయ్యలు')) {
    return 'prawn';
  }
  if (text.includes('crab') || text.includes('shell') || text.includes('పీతలు')) {
    return 'crab';
  }
  return 'fish';
}

async function migrate() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB cluster');

  const dbNames = ['kdp', 'fishes'];

  for (const dbName of dbNames) {
    const db = mongoose.connection.useDb(dbName);
    const items = await db.collection('menus').find({}).toArray();
    console.log(`\nFound ${items.length} menu items in database: ${dbName}`);

    for (const it of items) {
      const retailPrice = Number(it.price || 200);
      
      // Calculate realistic wholesale and export prices if not set or 0
      let wholesalePrice = Number(it.wholesalePricePerKg || 0);
      if (wholesalePrice <= 0) {
        wholesalePrice = Math.round((retailPrice * 0.75) / 10) * 10;
        if (wholesalePrice <= 0) wholesalePrice = retailPrice;
      }

      let exportPrice = Number(it.exportPricePerKg || 0);
      if (exportPrice <= 0) {
        exportPrice = Math.round((retailPrice * 0.70) / 10) * 10;
        if (exportPrice <= 0) exportPrice = wholesalePrice;
      }

      const waterType = it.waterType && it.waterType !== 'all' ? it.waterType : getWaterType(it);
      const speciesType = it.speciesType || getSpeciesType(it);

      // Construct Size Grades & Availability
      const sizeGrades = {
        small: {
          minKg: 0,
          maxKg: 1,
          price: retailPrice,
          wholesalePrice: wholesalePrice,
          exportPrice: exportPrice,
          enabled: it.sizeGrades?.small?.enabled !== false
        },
        medium: {
          minKg: 1,
          maxKg: 4,
          price: Math.round((retailPrice * 1.1) / 10) * 10,
          wholesalePrice: Math.round((wholesalePrice * 1.1) / 10) * 10,
          exportPrice: Math.round((exportPrice * 1.1) / 10) * 10,
          enabled: it.sizeGrades?.medium?.enabled !== false
        },
        big: {
          minKg: 4,
          maxKg: 99,
          price: Math.round((retailPrice * 1.25) / 10) * 10,
          wholesalePrice: Math.round((wholesalePrice * 1.25) / 10) * 10,
          exportPrice: Math.round((exportPrice * 1.25) / 10) * 10,
          enabled: it.sizeGrades?.big?.enabled !== false
        }
      };

      // Update item with all modern sales fields and unset old box fields
      await db.collection('menus').updateOne(
        { _id: it._id },
        {
          $set: {
            price: retailPrice,
            wholesalePricePerKg: wholesalePrice,
            exportPricePerKg: exportPrice,
            waterType: waterType,
            speciesType: speciesType,
            sizeGrades: sizeGrades,
            sellingUnit: it.sellingUnit === 'Box' ? 'Kg' : (it.sellingUnit || 'Kg')
          },
          $unset: {
            boxPackingKg: "",
            boxPrice: "",
            boxTareWeightKg: "",
            boxNetFishKg: ""
          }
        }
      );
    }

    console.log(`Successfully migrated ${items.length} items in "${dbName}".`);
  }

  await mongoose.disconnect();
  console.log('\nAll databases migrated successfully!');
}

migrate().catch(console.error);

