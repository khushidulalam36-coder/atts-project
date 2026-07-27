const { query } = require('./db');
const { fetchPrice } = require('./binance');
const logger = require('./logger');

// Price cache – updated every 3 seconds
const priceCache = new Map();
let priceCacheInterval = null;

async function refreshPriceCache() {
  try {
    // Get all symbols that have any position across all users
    const result = await query(`
      SELECT DISTINCT jsonb_object_keys(holdings) AS symbol
      FROM portfolios
      WHERE holdings != '{}' AND holdings IS NOT NULL
    `);
    const rows = result.rows || result;
    const symbols = rows.map(r => r.symbol).filter(Boolean);
    if (symbols.length === 0) return;
    
    const uniqueSymbols = [...new Set(symbols)];
    for (const sym of uniqueSymbols) {
      const price = await fetchPrice(sym);
      if (price !== null) {
        priceCache.set(sym, price);
      }
    }
  } catch (e) {
    logger.error('Price cache refresh error:', e.message);
  }
}

function startPriceCache() {
  if (priceCacheInterval) clearInterval(priceCacheInterval);
  priceCacheInterval = setInterval(refreshPriceCache, 3000);
  // initial fill
  refreshPriceCache();
}

function stopPriceCache() {
  if (priceCacheInterval) {
    clearInterval(priceCacheInterval);
    priceCacheInterval = null;
  }
}

async function checkAndExecuteSLTP() {
  try {
    const result = await query(`
      SELECT user_id, holdings, cash, transactions 
      FROM portfolios 
      WHERE holdings != '{}' AND holdings IS NOT NULL
    `);
    const rows = result.rows || result;
    if (!rows.length) return;

    for (const row of rows) {
      let holdings = typeof row.holdings === 'string' ? JSON.parse(row.holdings) : row.holdings;
      let cash = parseFloat(row.cash);
      let transactions = typeof row.transactions === 'string' ? JSON.parse(row.transactions) : row.transactions;
      let changed = false;

      for (const [symbol, data] of Object.entries(holdings)) {
        // Use cached price if available, else fetch directly
        let price = priceCache.get(symbol);
        if (price === undefined) {
          price = await fetchPrice(symbol);
          if (price !== null) priceCache.set(symbol, price);
        }
        if (!price) continue;
        
        const isShort = data.qty < 0;
        const qty = Math.abs(data.qty);

        if (data.slPrice) {
          if ((!isShort && price <= data.slPrice) || (isShort && price >= data.slPrice)) {
            if (data.qty > 0) cash += qty * price;
            else cash += qty * price;
            transactions.unshift({ type: 'sell', symbol, qty, price, time: new Date().toISOString(), reason: 'Stop Loss' });
            delete holdings[symbol];
            changed = true;
            continue;
          }
        }
        if (data.tpPrice) {
          if ((!isShort && price >= data.tpPrice) || (isShort && price <= data.tpPrice)) {
            if (data.qty > 0) cash += qty * price;
            else cash += qty * price;
            transactions.unshift({ type: 'sell', symbol, qty, price, time: new Date().toISOString(), reason: 'Take Profit' });
            delete holdings[symbol];
            changed = true;
          }
        }
      }

      if (changed) {
        await query(
          'UPDATE portfolios SET cash = $1, holdings = $2, transactions = $3 WHERE user_id = $4',
          [cash, JSON.stringify(holdings), JSON.stringify(transactions), row.user_id]
        );
      }
    }
  } catch (e) {
    logger.error('Trade engine error:', e.message);
  }
}

let engineInterval = null;

function startTradeEngine() {
  if (engineInterval) clearInterval(engineInterval);
  // Start price cache
  startPriceCache();
  engineInterval = setInterval(checkAndExecuteSLTP, 5000);
  logger.info('⚙️ Trade engine started (SL/TP check every 5s, price cache every 3s)');
}

function stopTradeEngine() {
  if (engineInterval) { clearInterval(engineInterval); engineInterval = null; }
  stopPriceCache();
}

module.exports = { checkAndExecuteSLTP, startTradeEngine, stopTradeEngine };
