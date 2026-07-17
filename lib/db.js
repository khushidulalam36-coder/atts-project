const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function query(text, params = []) {
  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    console.error('DB Error:', error.message);
    throw error;
  }
}

module.exports = { query };
