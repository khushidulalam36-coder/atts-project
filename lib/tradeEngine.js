const { query } = require('./db');
const { fetchPrice } = require('./binance');

// Check open trades and execute SL/TP
async function checkAndExecuteSLTP() {
  try {
    // Get all users with open positions (holdings not empty)
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
        const price = await fetchPrice(symbol);
        if (!price) continue;
        const isShort = data.qty < 0;
        const qty = Math.abs(data.qty);

        // Check SL
        if (data.slPrice) {
          if ((!isShort && price <= data.slPrice) || (isShort && price >= data.slPrice)) {
            // Close position
            if (data.qty > 0) cash += qty * price;
            else cash += qty * price; // short: close short = buy back
            transactions.unshift({ type: 'sell', symbol, qty, price, time: new Date().toISOString(), reason: 'Stop Loss' });
            delete holdings[symbol];
            changed = true;
            continue;
          }
        }
        // Check TP
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
    console.error('Trade engine error:', e.message);
  }
}

let engineInterval = null;

function startTradeEngine() {
  if (engineInterval) clearInterval(engineInterval);
  engineInterval = setInterval(checkAndExecuteSLTP, 5000);
  console.log('⚙️ Trade engine started (SL/TP check every 5s)');
}

function stopTradeEngine() {
  if (engineInterval) { clearInterval(engineInterval); engineInterval = null; }
}

module.exports = { checkAndExecuteSLTP, startTradeEngine, stopTradeEngine };
