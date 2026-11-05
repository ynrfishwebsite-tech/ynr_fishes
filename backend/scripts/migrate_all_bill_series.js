import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGO_URI;

async function migrateBills() {
  await mongoose.connect(uri);
  const dbNames = ['kdp', 'fishes'];

  for (const dbName of dbNames) {
    const db = mongoose.connection.useDb(dbName);
    console.log(`\n========================================`);
    console.log(`Starting migration for database: ${dbName}`);
    console.log(`========================================`);

    // Fetch all bills sorted by createdAt ascending
    const allBills = await db.collection('bills').find({}).sort({ createdAt: 1, _id: 1 }).toArray();
    console.log(`Total bills found in ${dbName}: ${allBills.length}`);

    if (allBills.length === 0) continue;

    // Categorize bills
    const wholesaleBills = [];
    const exportBills = [];
    const retailBills = [];

    for (const bill of allBills) {
      const isExport = 
        String(bill.customerCategory || '').toLowerCase().includes('export') ||
        String(bill.orderChannel || '').toLowerCase().includes('export') ||
        String(bill.billType || '').toLowerCase().includes('export');

      const isWholesale = 
        !isExport && (
          Number(bill.totalBoxes || 0) > 0 ||
          (Array.isArray(bill.boxes) && bill.boxes.length > 0) ||
          (Array.isArray(bill.items) && bill.items.some(i => i.isWholesaleBox || Number(i.boxNumber || 0) > 0)) ||
          String(bill.orderChannel || '').toLowerCase().includes('wholesale') ||
          String(bill.customerCategory || '').toLowerCase().includes('wholesale') ||
          bill.tableNo === 'TAK-022' || bill.tableNo === 'TAK-029'
        );

      if (isExport) {
        exportBills.push(bill);
      } else if (isWholesale) {
        wholesaleBills.push(bill);
      } else {
        retailBills.push(bill);
      }
    }

    console.log(`Categorization summary:`);
    console.log(`- Wholesale Bills: ${wholesaleBills.length}`);
    console.log(`- Export Bills:    ${exportBills.length}`);
    console.log(`- Retail Bills:    ${retailBills.length}`);

    // Update Wholesale bills series: WS-0001, WS-0002...
    let wsCounter = 1;
    for (const b of wholesaleBills) {
      const newBillNumber = `WS-${wsCounter.toString().padStart(4, '0')}`;
      await db.collection('bills').updateOne(
        { _id: b._id },
        {
          $set: {
            billNumber: newBillNumber,
            customerCategory: 'Wholesale',
            orderChannel: 'Wholesale-Box',
            legacyBillNumber: b.billNumber || ''
          }
        }
      );
      console.log(`[Wholesale] Bill ${b._id} (${b.billNumber}) -> ${newBillNumber}`);
      wsCounter++;
    }

    // Update Export bills series: EXP-0001, EXP-0002...
    let expCounter = 1;
    for (const b of exportBills) {
      const newBillNumber = `EXP-${expCounter.toString().padStart(4, '0')}`;
      await db.collection('bills').updateOne(
        { _id: b._id },
        {
          $set: {
            billNumber: newBillNumber,
            customerCategory: 'Export',
            orderChannel: b.orderChannel || 'Export-Local',
            legacyBillNumber: b.billNumber || ''
          }
        }
      );
      console.log(`[Export] Bill ${b._id} (${b.billNumber}) -> ${newBillNumber}`);
      expCounter++;
    }

    // Update Retail bills series: RET-0001, RET-0002...
    let retCounter = 1;
    for (const b of retailBills) {
      const newBillNumber = `RET-${retCounter.toString().padStart(4, '0')}`;
      await db.collection('bills').updateOne(
        { _id: b._id },
        {
          $set: {
            billNumber: newBillNumber,
            customerCategory: 'Retail',
            orderChannel: 'Counter-Retail',
            legacyBillNumber: b.billNumber || ''
          }
        }
      );
      console.log(`[Retail] Bill ${b._id} (${b.billNumber}) -> ${newBillNumber}`);
      retCounter++;
    }

    console.log(`\nMigration completed for ${dbName}:`);
    console.log(`Updated ${wsCounter - 1} Wholesale bills (WS-0001 to WS-${(wsCounter - 1).toString().padStart(4, '0')})`);
    console.log(`Updated ${expCounter - 1} Export bills`);
    console.log(`Updated ${retCounter - 1} Retail bills (RET-0001 to RET-${(retCounter - 1).toString().padStart(4, '0')})`);
  }

  await mongoose.disconnect();
}

migrateBills().catch(console.error);

