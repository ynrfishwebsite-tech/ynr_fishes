import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

// Map of exact corrections based on species and biology
const corrections = [
  { match: /wallago|వాలగ/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /mirayal|మిరయల్/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /bangaru theega|బంగారుతీగ|golden fish/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /pothi gini|చిన్న చేపలు/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /korramenu|murrel|కొర్రమీను/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /sheelavathi|ఓషా/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /sea crabs|పీతలు/i, waterType: 'sea_water', speciesType: 'crab' },
  { match: /red prawns|రొయ్యలు/i, speciesType: 'prawn' },
  { match: /rani|గులివిందలు/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /koli|కోలి చేప/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /vanjaram|king fish/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /white pomfret/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /black pomfret/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /tuna|సూర/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /aila|కనగర్తలు/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /nethallu|nethili/i, waterType: 'sea_water', speciesType: 'fish' },
  { match: /rohu|రోహు/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /katla|బొచ్చె|కాట్లా/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /basa|పంగస్/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /tilapia|తిలాపియా/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /mattu|మట్టు/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /karimeen|కరిమీన్/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /apollo/i, waterType: 'fresh_water', speciesType: 'fish' },
  { match: /common fish/i, waterType: 'fresh_water', speciesType: 'fish' }
];

async function runFix() {
  await mongoose.connect(uri);
  const dbNames = ['kdp', 'fishes'];

  for (const dbName of dbNames) {
    const db = mongoose.connection.useDb(dbName);
    const items = await db.collection('menus').find({}).toArray();
    console.log(`Checking ${items.length} items in ${dbName}...`);

    for (const item of items) {
      for (const rule of corrections) {
        if (rule.match.test(item.name)) {
          const update = {};
          if (rule.waterType) update.waterType = rule.waterType;
          if (rule.speciesType) update.speciesType = rule.speciesType;

          await db.collection('menus').updateOne(
            { _id: item._id },
            { $set: update }
          );
          break;
        }
      }
    }

    // Fix null customerCategory in bills: set to 'Retail' (or 'Wholesale' if totalBoxes > 0)
    const wholesaleBillResult = await db.collection('bills').updateMany(
      {
        $or: [
          { totalBoxes: { $gt: 0 } },
          { 'boxes.0': { $exists: true } },
          { 'items.isWholesaleBox': true },
          { orderChannel: 'Wholesale-Box' }
        ]
      },
      {
        $set: {
          customerCategory: 'Wholesale',
          orderChannel: 'Wholesale-Box'
        }
      }
    );

    const retailBillResult = await db.collection('bills').updateMany(
      { customerCategory: { $in: [null, ''] } },
      {
        $set: {
          customerCategory: 'Retail',
          orderChannel: 'Counter-Retail'
        }
      }
    );

    console.log(`Updated bills in ${dbName}: ${wholesaleBillResult.modifiedCount} wholesale, ${retailBillResult.modifiedCount} retail.`);
  }

  console.log('Corrections applied successfully!');
  await mongoose.disconnect();
}

runFix().catch(console.error);

