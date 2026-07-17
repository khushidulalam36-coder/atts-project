const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const { getOrCreatePortfolio } = require('../lib/auth');
const { getRealTimePrice } = require('../lib/finnhub');

router.get('/', authenticate, async (req, res) => {
  try {
    const p = await getOrCreatePortfolio(req.user.userId);
    res.json(p);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const { symbol, qty, type, slPrice, tpPrice } = req.body;
    if (!symbol || !qty || qty <= 0 || !type) return res.status(400).json({ error: 'symbol, qty, type required' });
    const p = await getOrCreatePortfolio(req.user.userId);
    let holdings = typeof p.holdings === 'string' ? JSON.parse(p.holdings) : (p.holdings || {});
    let transactions = typeof p.transactions === 'string' ? JSON.parse(p.transactions) : (p.transactions || []);
    let cash = parseFloat(p.cash);
    const price = await getRealTimePrice(symbol);

    if (type === 'buy') {
      const cost = qty * price;
      if (cash < cost) return res.status(400).json({ error: 'Insufficient cash' });
      cash -= cost;
      if (!holdings[symbol]) holdings[symbol] = { qty: 0, avgPrice: 0 };
      const h = holdings[symbol];
      h.avgPrice = ((h.qty * h.avgPrice) + (qty * price)) / (h.qty + qty);
      h.qty += qty;
      if (slPrice) h.slPrice = slPrice;
      if (tpPrice) h.tpPrice = tpPrice;
      transactions.unshift({ type: 'buy', symbol, qty, price, time: new Date().toISOString() });
    } else if (type === 'sell') {
      if (!holdings[symbol] || holdings[symbol].qty <= 0) return res.status(400).json({ error: 'No position to sell' });
      const h = holdings[symbol];
      const closeQty = Math.min(h.qty, qty);
      cash += closeQty * price;
      h.qty -= closeQty;
      if (h.qty === 0) delete holdings[symbol];
      transactions.unshift({ type: 'sell', symbol, qty: closeQty, price, time: new Date().toISOString() });
    }

    await query('UPDATE portfolios SET cash=$1, holdings=$2, transactions=$3 WHERE user_id=$4',
      [cash, JSON.stringify(holdings), JSON.stringify(transactions), req.user.userId]);
    res.json(await getOrCreatePortfolio(req.user.userId));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/holding/:symbol', authenticate, async (req, res) => {
  try {
    const p = await getOrCreatePortfolio(req.user.userId);
    let holdings = typeof p.holdings === 'string' ? JSON.parse(p.holdings) : (p.holdings || {});
    let cash = parseFloat(p.cash);
    let transactions = typeof p.transactions === 'string' ? JSON.parse(p.transactions) : (p.transactions || []);
    const h = holdings[req.params.symbol];
    if (!h) return res.status(404).json({ error: 'Holding not found' });
    const price = await getRealTimePrice(req.params.symbol);
    cash += h.qty * price;
    transactions.unshift({ type: 'sell', symbol: req.params.symbol, qty: h.qty, price, time: new Date().toISOString(), reason: 'Manual Exit' });
    delete holdings[req.params.symbol];
    await query('UPDATE portfolios SET cash=$1, holdings=$2, transactions=$3 WHERE user_id=$4',
      [cash, JSON.stringify(holdings), JSON.stringify(transactions), req.user.userId]);
    res.json(await getOrCreatePortfolio(req.user.userId));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
