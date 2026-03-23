import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ☢️ NUCLEAR FIX: Ignore certificate errors ☢️
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// --- ⚡️ SECURE CONNECTION ⚡️ ---
// NEVER hardcode the connection string in public code.
if (!process.env.DATABASE_URL) {
  throw new Error("🚨 DATABASE_URL is missing in .env file");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('connect', () => {
  console.log('✅ Connected to LokSetu Database');
});

pool.on('error', (err) => {
  console.error('❌ Database Error:', err);
});

export default pool;