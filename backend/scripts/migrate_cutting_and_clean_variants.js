import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

async function migrate() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  for (const dbName of ['kdp', 'fishes']) {
    const db = mongoose.connection.useDb(dbName);
    const items = await db.collection('menus').find({}).toArray();
    console.log(`\nMigrating ${items.length} items in "${dbName}"...`);

    for (const it of items) {
      const retail = Number(it.price || 0);
      const wholesale = Number(it.wholesalePricePerKg || retail);
      const exp = Number(it.exportPricePerKg || wholesale);

      const baseCutting = typeof it.cuttingCharge === 'number' ? it.cuttingCharge : 0;
      const customCuttingEnabled = typeof it.customCuttingChargeEnabled === 'boolean'
        ? it.customCuttingChargeEnabled
        : (baseCutting > 0);

      const small = it.sizeGrades?.small || {};
      const medium = it.sizeGrades?.medium || {};
      const big = it.sizeGrades?.big || {};

      const updatedSizeGrades = {
        small: {
          minKg: Number(small.minKg ?? 0),
          maxKg: Number(small.maxKg ?? 1),
          price: Number(small.price ?? retail),
          wholesalePrice: Number(small.wholesalePrice ?? wholesale),
          exportPrice: Number(small.exportPrice ?? exp),
          enabled: small.enabled !== false,
          unit: small.unit || 'kg',
          cuttingCharge: typeof small.cuttingCharge === 'number' ? small.cuttingCharge : baseCutting
        },
        medium: {
          minKg: Number(medium.minKg ?? 1),
          maxKg: Number(medium.maxKg ?? 4),
          price: Number(medium.price ?? (retail ? Math.round(retail * 1.1 / 10) * 10 : 0)),
          wholesalePrice: Number(medium.wholesalePrice ?? (wholesale ? Math.round(wholesale * 1.1 / 10) * 10 : 0)),
          exportPrice: Number(medium.exportPrice ?? (exp ? Math.round(exp * 1.1 / 10) * 10 : 0)),
          enabled: medium.enabled !== false,
          unit: medium.unit || 'kg',
          cuttingCharge: typeof medium.cuttingCharge === 'number' ? medium.cuttingCharge : baseCutting
        },
        big: {
          minKg: Number(big.minKg ?? 4),
          maxKg: Number(big.maxKg ?? 99),
          price: Number(big.price ?? (retail ? Math.round(retail * 1.25 / 10) * 10 : 0)),
          wholesalePrice: Number(big.wholesalePrice ?? (wholesale ? Math.round(wholesale * 1.25 / 10) * 10 : 0)),
          exportPrice: Number(big.exportPrice ?? (exp ? Math.round(exp * 1.25 / 10) * 10 : 0)),
          enabled: big.enabled !== false,
          unit: big.unit || 'kg',
          cuttingCharge: typeof big.cuttingCharge === 'number' ? big.cuttingCharge : baseCutting
        }
      };

      await db.collection('menus').updateOne(
        { _id: it._id },
        {
          $set: {
            customCuttingChargeEnabled: customCuttingEnabled,
            cuttingCharge: baseCutting,
            sizeGrades: updatedSizeGrades
          },
          $unset: {
            variants: ''
          }
        }
      );
    }

    console.log(`Successfully migrated cutting charges and removed variants for all items in "${dbName}".`);
  }

  await mongoose.disconnect();
  console.log('Migration completed successfully.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

