import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './fish_website/backend/.env' });
import { connectDB } from '../src/config/db.js';

async function run() {
  const conn = await connectDB();
  console.log('--- CONNECTED ---');

  const connection = conn.connection || conn;
  const db = connection.useDb('kdp', { useCache: true });
  const types = await db.collection('stocklogs').distinct('type');
  console.log('Distinct types in kdp stocklogs:', types);
  const inwardLogs = await db.collection('stocklogs').find({}).toArray();
  console.log('Total kdp stocklogs:', inwardLogs.length);
  const inwardFiltered = inwardLogs.filter(l => l.type && (l.type.includes('Stock-In') || l.type.includes('Procurement') || l.type.includes('Initial')));
  console.log('Inward filtered count:', inwardFiltered.length);
  console.log(JSON.stringify(inwardFiltered, null, 2));

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
