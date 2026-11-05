import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

async function migrateWholesaleOrders() {
  await mongoose.connect(uri);
  console.log('Connected to cluster');

  const dbNames = ['kdp', 'fishes'];

  for (const dbName of dbNames) {
    const db = mongoose.connection.useDb(dbName);
    console.log(`\nScanning database: ${dbName}...`);

    // Match any bill with boxes or wholesale box flags or weight >= 20kg wholesale items
    const query = {
      $or: [
        { totalBoxes: { $gt: 0 } },
        { 'boxes.0': { $exists: true } },
        { 'items.isWholesaleBox': true },
        { 'items.boxNumber': { $gt: 0 } },
        { total: 9000, tableNo: 'TAK-029' }
      ]
    };

    const count = await db.collection('bills').countDocuments(query);
    console.log(`Found ${count} wholesale bills to update in "${dbName}".`);

    if (count > 0) {
      const result = await db.collection('bills').updateMany(query, {
        $set: {
          customerCategory: 'Wholesale',
          orderChannel: 'Wholesale-Box'
        }
      });
      console.log(`Updated ${result.modifiedCount} bills in "${dbName}" to customerCategory: "Wholesale", orderChannel: "Wholesale-Box".`);
    }
  }

  console.log('\nMigration completed successfully!');
  await mongoose.disconnect();
}

migrateWholesaleOrders().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

