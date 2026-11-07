import mongoose from 'mongoose';
import dns from 'node:dns';
try { dns.setDefaultResultOrder('ipv4first'); } catch {}
const uri = 'mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function test() {
  await mongoose.connect(uri, { dbName: 'kdp' });
  const col = mongoose.connection.collection('bills');

  // Retail query
  const query = {
    status: { $in: ['Paid', 'Unpaid', 'Cancelled', 'Deleted'] },
    billNumber: { $not: /^WS-|^EXP-/i },
    tableNo: { $not: /^WS-|^EXP-/i },
    $or: [
      { customerCategory: 'Retail' },
      { orderChannel: /Retail|Counter/i },
      { billType: 'Retail' },
      { billNumber: /^RET-/i }
    ]
  };

  const retailBills = await col.find(query).limit(10).toArray();
  console.log('Retail query results count:', retailBills.length);
  console.log('Sample bill numbers:', retailBills.map(b => b.billNumber));
  const hasWs = retailBills.some(b => String(b.billNumber).startsWith('WS-') || String(b.tableNo).startsWith('WS-'));
  console.log('Any WS bills in retail query?:', hasWs);

  // Wholesale query
  const wsQuery = {
    status: { $in: ['Paid', 'Unpaid', 'Cancelled', 'Deleted'] },
    $or: [
      { customerCategory: 'Wholesale' },
      { orderChannel: /Wholesale/i },
      { billType: 'Wholesale' },
      { billNumber: /^WS-/i }
    ]
  };
  const wsBills = await col.find(wsQuery).limit(10).toArray();
  console.log('\nWholesale query results count:', wsBills.length);
  console.log('Sample WS bill numbers:', wsBills.map(b => b.billNumber));

  await mongoose.disconnect();
}
test().catch(console.error);

