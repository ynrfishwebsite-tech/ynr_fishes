import mongoose from 'mongoose';
import dns from 'node:dns';

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const DIRECT_REPLICA_URI =
  "mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority";

function detectCategory(o) {
  if (
    o.customerCategory === 'Export' ||
    o.orderMode === 'export' ||
    o.billType === 'Export' ||
    o.exportSubCategory ||
    String(o.billNumber || '').startsWith('EXP-')
  ) {
    return 'Export';
  }
  if (
    o.customerCategory === 'Wholesale' ||
    o.orderChannel === 'Wholesale-Box' ||
    o.orderMode === 'bulk' ||
    o.billType === 'Wholesale' ||
    String(o.billNumber || '').startsWith('WS-') ||
    (Number(o.totalBoxes) > 0) ||
    (Array.isArray(o.boxes) && o.boxes.length > 0) ||
    (Array.isArray(o.items) && o.items.some(i => i.isWholesaleBox || Number(i.boxNumber || 0) > 0 || i.pricingTier === 'wholesale' || Number(i.weight || i.weightKg || i.enteredWeight || 0) >= 20))
  ) {
    return 'Wholesale';
  }
  return 'Retail';
}

async function run() {
  console.log('[Migration] Connecting to MongoDB Atlas via direct replica set...');
  const conn = await mongoose.connect(DIRECT_REPLICA_URI, {
    dbName: 'fishes',
    serverSelectionTimeoutMS: 15000
  });
  console.log('[Migration] Connected to host:', conn.connection.host);

  const dbNames = ['fishes', 'kdp'];

  for (const dbName of dbNames) {
    console.log(`\n=================== Database: ${dbName} ===================`);
    const db = mongoose.connection.useDb(dbName);
    const billsCol = db.collection('bills');

    const takBills = await billsCol.find({
      $or: [
        { tableNo: { $regex: '^TAK-', $options: 'i' } },
        { orderNo: { $regex: '^TAK-', $options: 'i' } }
      ]
    }).toArray();

    console.log(`Found ${takBills.length} orders with TAK- in ${dbName}`);

    for (const b of takBills) {
      const cat = detectCategory(b);
      const prefix = cat === 'Export' ? 'EXP-' : (cat === 'Wholesale' ? 'WS-' : 'RET-');

      const oldTableNo = b.tableNo || '';
      const newTableNo = oldTableNo.replace(/^TAK-/i, prefix);

      const oldOrderNo = b.orderNo || '';
      const newOrderNo = oldOrderNo ? oldOrderNo.replace(/^TAK-/i, prefix) : newTableNo;

      console.log(`  _id: ${b._id} | ${oldTableNo} -> ${newTableNo} (${cat}) | billNo: ${b.billNumber || '-'} | status: ${b.status}`);

      const updateDoc = {
        $set: {
          tableNo: newTableNo,
          orderNo: newOrderNo
        }
      };

      if (Array.isArray(b.kots) && b.kots.length > 0) {
        updateDoc.$set.kots = b.kots.map(k => ({
          ...k,
          tableNo: (k.tableNo || '').replace(/^TAK-/i, prefix)
        }));
      }

      await billsCol.updateOne({ _id: b._id }, updateDoc);
    }
  }

  console.log('\n[Migration] Migration complete!');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
