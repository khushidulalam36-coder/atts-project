const { fetchCandles } = require('../lib/binance');
const { uploadCandles } = require('../lib/blob');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT'];
const LIMIT = 10000;

async function updateBlobCandles() {
  console.log('🔄 Updating blob candles...');
  for (const symbol of SYMBOLS) {
    try {
      const candles = await fetchCandles(symbol, '1m', LIMIT);
      if (candles && candles.length > 0) {
        const url = await uploadCandles(symbol, candles, 60);
        console.log(`✅ Updated ${symbol} -> ${url}`);
      } else {
        console.warn(`⚠️ No candles for ${symbol}`);
      }
    } catch (e) {
      console.error(`❌ Error updating ${symbol}:`, e.message);
    }
  }
}

module.exports = { updateBlobCandles };
