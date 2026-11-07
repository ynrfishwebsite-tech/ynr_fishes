import mongoose from 'mongoose';
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
const uri = 'mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function fix() {
  await mongoose.connect(uri, { dbName: 'kdp' });
  const col = mongoose.connection.collection('bills');

  // Fix all WS- bills to Wholesale
  const wsRes = await col.updateMany(
    {
      $or: [
        { billNumber: { $regex: '^WS-', $options: 'i' } },
        { tableNo: { $regex: '^WS-', $options: 'i' } },
        { totalBoxes: { $gt: 0 } }
      ]
    },
    {
      $set: {
        customerCategory: 'Wholesale',
        billType: 'Wholesale',
        orderChannel: 'Wholesale-Box'
      }
    }
  );
  console.log('Updated Wholesale bills count:', wsRes.modifiedCount);

  // Fix all EXP- bills to Export
  const expRes = await col.updateMany(
    {
      $or: [
        { billNumber: { $regex: '^EXP-', $options: 'i' } },
        { tableNo: { $regex: '^EXP-', $options: 'i' } }
      ]
    },
    {
      $set: {
        customerCategory: 'Export',
        billType: 'Export'
      }
    }
  );
  console.log('Updated Export bills count:', expRes.modifiedCount);

  // Check remaining Retail
  const retBills = await col.find({
    billNumber: { $not: /^WS-|^EXP-/i },
    tableNo: { $not: /^WS-|^EXP-/i }
  }).toArray();
  console.log('Remaining Retail bills count:', retBills.length);

  await mongoose.disconnect();
}
fix().catch(console.error);

