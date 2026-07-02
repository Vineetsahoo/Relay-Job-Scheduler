import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'job_scheduler';

// Singleton client and db instances.
let client: MongoClient;
let db: Db;

export async function connectDb(): Promise<void> {
  if (client) return; // already connected
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  console.log(`[db] connected to MongoDB (db=${dbName})`);
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected — call connectDb() first');
  return db;
}

export async function closeDb(): Promise<void> {
  if (client) await client.close();
}
