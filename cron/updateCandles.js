const { fetchCandles } = require('../lib/binance');
const { uploadCandles } = require('../lib/blob');
const logger = require('../lib/logger');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT'];
const LIMIT = 10000;

async function updateBlobCandles() {
  logger.info('🔄 Updating blob candles...');
  let anyUpdated = false;
  for (const symbol of SYMBOLS) {
    try {
      const candles = await fetchCandles(symbol, '1m', LIMIT);
      if (candles && candles.length > 0) {
        const url = await uploadCandles(symbol, candles, 60);
        logger.info(`✅ Updated ${symbol} -> ${url}`);
        anyUpdated = true;
      } else {
        logger.warn(`⚠️ No candles for ${symbol}`);
      }
    } catch (e) {
      logger.error(`❌ Error updating ${symbol}:`, { error: e.message });
    }
  }
  if (anyUpdated) {
    logger.info('✅ Blob candles updated (at least one symbol)');
  } else {
    logger.warn('⚠️ No candles were updated for any symbol');
  }
  return anyUpdated;
}

async function updateBlobCandlesWithRetry(maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await updateBlobCandles();
      if (result) return true;
    } catch (e) {
      lastError = e;
      logger.warn(`Attempt ${attempt} failed: ${e.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw lastError || new Error('All retries failed');
}

module.exports = { updateBlobCandles, updateBlobCandlesWithRetry };
