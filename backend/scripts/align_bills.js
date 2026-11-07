import mongoose from 'mongoose';
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
const uri = 'mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function fix() {
  await mongoose.connect(uri, { dbName: 'kdp' });
  const col = mongoose.connection.collection('bills');

  // Any bill starting with RET- is strictly Retail
  await col.updateMany(
    { billNumber: { $regex: '^RET-', $options: 'i' } },
    { $set: { customerCategory: 'Retail', billType: 'Retail' } }
  );

  // Any bill starting with WS- is strictly Wholesale
  await col.updateMany(
    { billNumber: { $regex: '^WS-', $options: 'i' } },
    { $set: { customerCategory: 'Wholesale', billType: 'Wholesale' } }
  );

  // Any bill starting with EXP- is strictly Export
  await col.updateMany(
    { billNumber: { $regex: '^EXP-', $options: 'i' } },
    { $set: { customerCategory: 'Export', billType: 'Export' } }
  );

  console.log('Fixed RET-, WS-, EXP- bills category alignment.');
  await mongoose.disconnect();
}
fix().catch(console.error);

