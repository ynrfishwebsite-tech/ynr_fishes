import mongoose from 'mongoose';
import dns from 'node:dns';

try { dns.setDefaultResultOrder('ipv4first'); } catch {}

const uri = 'mongodb://mstechhived1_db_user:bcZdeggKnDHgdpmx@ac-0mpy1zk-shard-00-00.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-01.lyywyv4.mongodb.net:27017,ac-0mpy1zk-shard-00-02.lyywyv4.mongodb.net:27017/fishes?ssl=true&authSource=admin&retryWrites=true&w=majority';

async function migrate() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri);
  console.log('Connected successfully!');

  for (const dbName of ['kdp', 'fishes']) {
    console.log(`\n========================================`);
    console.log(`Scanning Database: ${dbName}`);
    console.log(`========================================`);

    const rawDb = mongoose.connection.client.db(dbName);
    const billsCol = rawDb.collection('bills');

    const bills = await billsCol.find({}).toArray();
    console.log(`Found ${bills.length} total bills in ${dbName}.`);

    let updatedBillsCount = 0;
    let updatedItemsCount = 0;

    for (const bill of bills) {
      if (!Array.isArray(bill.items) || bill.items.length === 0) continue;

      let billModified = false;
      const updatedItems = bill.items.map(item => {
        const isKg = !item.sellingUnit || item.sellingUnit.toLowerCase() === 'kg';
        let wt = Number(item.weightKg || item.enteredWeight || item.netWeightKg || 0);

        if (wt <= 0) {
          const m = (item.name || '').match(/(\d+(?:\.\d+)?)\s*kg/i);
          if (m) wt = parseFloat(m[1]);
        }

        // Check if item needs migration (quantity is 1 or differs from weight in kg)
        if (isKg && wt > 0 && item.quantity !== wt) {
          const oldQty = item.quantity;
          const oldPrice = Number(item.price || 0);
          const totalAmt = Number(item.total !== undefined ? item.total : (oldPrice * (oldQty || 1)));

          let rate = Number(item.pricePerKg || 0);
          if (rate <= 0 && totalAmt > 0 && wt > 0) {
            rate = Number((totalAmt / wt).toFixed(2));
          } else if (rate <= 0 && oldPrice > 0) {
            rate = oldPrice;
          }

          console.log(`  [${bill.billNumber || bill._id}] Item "${item.name}": qty ${oldQty} -> ${wt} Kg, price ₹${oldPrice} -> ₹${rate}/kg, total ₹${totalAmt}`);

          billModified = true;
          updatedItemsCount++;

          return {
            ...item,
            quantity: wt,
            price: rate,
            pricePerKg: rate,
            weightKg: wt,
            enteredWeight: wt,
            netWeightKg: wt,
            grossWeightKg: item.grossWeightKg ? Number(item.grossWeightKg) : wt,
            total: totalAmt
          };
        }

        return item;
      });

      if (billModified) {
        // Verify subtotal
        const newSubtotal = updatedItems
          .filter(i => !i.isCancelled)
          .reduce((sum, i) => sum + (Number(i.price || 0) * (Number(i.quantity) || 1)), 0);

        await billsCol.updateOne(
          { _id: bill._id },
          {
            $set: {
              items: updatedItems,
              // Maintain subtotal accuracy
              subtotal: Math.round(newSubtotal * 100) / 100
            }
          }
        );
        updatedBillsCount++;
      }
    }

    console.log(`\nCompleted ${dbName}: Updated ${updatedItemsCount} items across ${updatedBillsCount} bills.`);
  }

  await mongoose.disconnect();
  console.log('\nMigration complete! Disconnected from MongoDB.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

