const { neon } = require('@neondatabase/serverless');
const logger = require('./logger');

if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

// Create connection with pooling options
const sql = neon(process.env.DATABASE_URL, {
  max: 10,                // max connections in pool
  idleTimeout: 30,        // idle timeout in seconds
  connectionTimeout: 10,  // connection timeout in seconds
});

async function query(text, params = []) {
  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    logger.error('DB Query Error:', { error: error.message, query: text });
    throw error;
  }
}

module.exports = { query };
