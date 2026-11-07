import mongoose from 'mongoose';
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
const uri = 'mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function test() {
  await mongoose.connect(uri, { dbName: 'fishes' });
  for (const dbName of ['fishes', 'kdp']) {
    const rawDb = mongoose.connection.client.db(dbName);
    const openBills = await rawDb.collection('bills').find({
      status: { $in: ['Open', 'Billed', 'Hold'] }
    }).toArray();
    console.log(`\n${dbName} open/billed bills count: ${openBills.length}`);
    openBills.forEach(b => {
      console.log(`  id: ${b._id} | tableNo: ${b.tableNo} | orderNo: ${b.orderNo} | billNo: ${b.billNumber} | status: ${b.status} | customerCategory: ${b.customerCategory} | totalBoxes: ${b.totalBoxes}`);
    });
  }
  await mongoose.disconnect();
}
test().catch(console.error);

