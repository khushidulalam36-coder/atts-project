const { fetchCandles } = require('../lib/binance');
const { uploadCandles } = require('../lib/blob');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT'];
const LIMIT = 1000;

async function updateBlobCandles() {
  console.log('🔄 Updating blob candles (attempt)...');
  let anyUpdated = false;
  for (const symbol of SYMBOLS) {
    try {
      const candles = await fetchCandles(symbol, '1m', LIMIT);
      if (candles && candles.length > 0) {
        const url = await uploadCandles(symbol, candles, 60);
        if (url) {
          console.log(`✅ Updated ${symbol} -> ${url}`);
          anyUpdated = true;
        } else {
          console.warn(`⚠️ Upload failed for ${symbol}`);
        }
      } else {
        console.warn(`⚠️ No candles for ${symbol}`);
      }
    } catch (e) {
      console.error(`❌ Error updating ${symbol}:`, e.message);
    }
  }
  if (anyUpdated) {
    console.log('✅ Some candles uploaded to Blob');
  } else {
    console.warn('⚠️ No candles were uploaded (Blob may be suspended)');
  }
}

module.exports = { updateBlobCandles };
