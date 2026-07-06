import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env.local') });

const sql = neon(process.env.DATABASE_URL);

try {
  const result = await sql`SELECT NOW()`;
  console.log('✅ Database connection successful:', result);
} catch (error) {
  console.error('❌ Database connection failed:', error.message);
}