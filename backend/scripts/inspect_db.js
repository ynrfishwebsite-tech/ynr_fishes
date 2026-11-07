import mongoose from 'mongoose';
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
const uri = 'mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function test() {
  await mongoose.connect(uri, { dbName: 'fishes' });
  for (const dbName of ['fishes', 'kdp']) {
    const rawDb = mongoose.connection.client.db(dbName);
    const cols = await rawDb.listCollections().toArray();
    console.log(dbName, 'collections:', cols.map(c => c.name));
    for (const c of cols) {
      const colName = c.name;
      if (['orders', 'bills', 'active_orders', 'kots'].includes(colName)) {
        const count = await rawDb.collection(colName).countDocuments();
        const takCount = await rawDb.collection(colName).countDocuments({
          $or: [
            { tableNo: { $regex: '^TAK-', $options: 'i' } },
            { orderNo: { $regex: '^TAK-', $options: 'i' } },
            { orderNumber: { $regex: '^TAK-', $options: 'i' } },
            { token: { $regex: '^TAK-', $options: 'i' } }
          ]
        });
        console.log(`  ${colName}: total=${count}, with TAK=${takCount}`);
        if (takCount > 0) {
          const sample = await rawDb.collection(colName).find({
            $or: [
              { tableNo: { $regex: '^TAK-', $options: 'i' } },
              { orderNo: { $regex: '^TAK-', $options: 'i' } }
            ]
          }).limit(5).toArray();
          console.log(`  Sample ${colName} docs:`, sample.map(s => ({ _id: s._id, tableNo: s.tableNo, orderNo: s.orderNo, status: s.status })));
        }
      }
    }
  }
  await mongoose.disconnect();
}
test().catch(console.error);
