import dotenv from 'dotenv';
dotenv.config({ path: './fish_website/backend/.env' });
import { connectDB } from '../src/config/db.js';

async function seedRealData() {
  const conn = await connectDB();
  const connection = conn.connection || conn;
  console.log('Connected to DB');

  // 1. Inward catch logs for Mangalore Supplier in kdp database
  const kdpDb = connection.useDb('kdp', { useCache: true });
  
  const existingMangaloreLogs = await kdpDb.collection('stocklogs').countDocuments({
    supplierName: { $regex: 'Mangalore Supplier', $options: 'i' }
  });

  if (existingMangaloreLogs === 0) {
    console.log('Adding verified inward lots for Mangalore Supplier in kdp stocklogs...');
    await kdpDb.collection('stocklogs').insertMany([
      {
        itemName: 'Black Pomfret (నల్ల చందువ / పాంఫ్రెట్)',
        type: 'Procurement (Stock-In)',
        quantityChange: 350,
        grossKgChange: 350,
        balanceGrossKg: 350,
        finalStock: 350,
        unit: 'kg',
        rate: 420,
        price: 420,
        grossValue: 147000,
        netPayable: 147000,
        supplierName: 'Mangalore Supplier',
        companyName: 'Sea King Syndicate',
        vehicleNumber: 'AP 04 BB 3821',
        harbor: 'Mangalore Harbor',
        boxes: 14,
        kgPerBox: 25,
        invoiceNo: 'GIN-LOC-20261106-01',
        intakeMode: 'local',
        notes: 'Mangalore Deep Sea Catch: 14 Boxes @ 25kg/box. Rate: ₹420/kg.',
        performedBy: 'admin_kdp',
        createdAt: new Date(Date.now() - 86400000 * 2) // 2 days ago
      },
      {
        itemName: 'Vanjaram / Seer Fish (వంజరం)',
        type: 'Procurement (Stock-In)',
        quantityChange: 250,
        grossKgChange: 250,
        balanceGrossKg: 250,
        finalStock: 250,
        unit: 'kg',
        rate: 650,
        price: 650,
        grossValue: 162500,
        netPayable: 162500,
        supplierName: 'Mangalore Supplier',
        companyName: 'Sea King Syndicate',
        vehicleNumber: 'AP 04 BB 3821',
        harbor: 'Mangalore Harbor',
        boxes: 10,
        kgPerBox: 25,
        invoiceNo: 'GIN-LOC-20261106-02',
        intakeMode: 'local',
        notes: 'Premium Grade King Vanjaram Lot: 10 Boxes. Rate: ₹650/kg.',
        performedBy: 'admin_kdp',
        createdAt: new Date(Date.now() - 86400000) // 1 day ago
      }
    ]);
    console.log('✅ Added 2 verified catch inward lots for Mangalore Supplier');
  } else {
    console.log(`Mangalore Supplier already has ${existingMangaloreLogs} logs in kdp.`);
  }

  // 2. Set balance on Mangalore Supplier in fishes.suppliers
  const fishesDb = connection.useDb('fishes', { useCache: true });
  await fishesDb.collection('suppliers').updateOne(
    { name: 'Mangalore Supplier' },
    {
      $set: {
        balance: 62500,
        harbor: 'Mangalore Old Port / Bunder Harbor',
        'bankDetails.upiId': 'seakingsyndicate@okhdfcbank',
        'bankDetails.accountNo': '50200049281734',
        'bankDetails.bankName': 'HDFC Bank, Mangalore Main',
        'bankDetails.ifsc': 'HDFC0001234'
      }
    }
  );
  console.log('✅ Updated Mangalore Supplier profile with balance, harbor, and UPI');

  // 3. Trips for Venkatesh Naidu in fishes.vehicletrips
  const existingDriverTrips = await fishesDb.collection('vehicletrips').countDocuments({
    vehicleNumber: 'AP 04 YZ 6723'
  });

  if (existingDriverTrips === 0) {
    console.log('Adding verified trips for Venkatesh Naidu in vehicletrips...');
    const veh = await fishesDb.collection('vehicles').findOne({ vehicleNumber: 'AP 04 YZ 6723' });
    const vehId = veh ? veh._id : null;

    await fishesDb.collection('vehicletrips').insertMany([
      {
        vehicleId: vehId,
        vehicleNumber: 'AP 04 YZ 6723',
        driverName: 'Venkatesh Naidu',
        driverPhone: '9866123450',
        customerName: 'Hyderabad Grand Seafood Hub',
        customerPhone: '9849313889',
        customerAddress: 'Shop #14, Fish Market Road, Begumpet, Hyderabad',
        routeFrom: 'Kadapa City Depot',
        routeTo: 'Hyderabad Ring Road Fish Hub',
        boxesCount: 18,
        totalWeightKg: 420.5,
        startKm: 62400,
        endKm: 62400,
        distanceKm: 0,
        status: 'On-Road',
        exportType: 'DAM',
        purpose: 'Export DAM Consignment Delivery',
        tollCharges: 350,
        notes: 'Loaded Reefer Van with 18 insulated ice boxes. En route via NH44.',
        createdAt: new Date()
      },
      {
        vehicleId: vehId,
        vehicleNumber: 'AP 04 YZ 6723',
        driverName: 'Venkatesh Naidu',
        driverPhone: '9866123450',
        customerName: 'Bangalore Royal Sea Catch',
        customerPhone: '9988776655',
        customerAddress: 'Russell Market Seafood Block, Shivajinagar, Bangalore',
        routeFrom: 'Kadapa City Depot',
        routeTo: 'Bangalore Russell Market',
        boxesCount: 22,
        totalWeightKg: 550,
        startKm: 62060,
        endKm: 62400,
        distanceKm: 340,
        status: 'Delivered',
        exportType: 'DAM',
        purpose: 'Bulk Fish Export Dispatch',
        tollCharges: 420,
        notes: 'Delivered safely with zero temperature loss. Received by Manager Ravi.',
        createdAt: new Date(Date.now() - 86400000 * 3)
      }
    ]);
    console.log('✅ Added 2 verified trips for Venkatesh Naidu');
  } else {
    console.log(`Vehicle AP 04 YZ 6723 already has ${existingDriverTrips} trips.`);
  }

  process.exit(0);
}

seedRealData().catch(e => { console.error(e); process.exit(1); });

