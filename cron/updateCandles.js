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
      logger.error(`❌ Error updating ${symbol}:`, e.message);
    }
  }
  if (anyUpdated) {
    logger.info('✅ Blob candles updated (at least one symbol)');
  } else {
    logger.warn('⚠️ No candles were updated for any symbol');
  }
}

module.exports = { updateBlobCandles };
