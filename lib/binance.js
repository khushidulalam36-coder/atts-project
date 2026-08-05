const BASE_URL = 'https://api.binance.com/api/v3';

async function fetchLatestCandle(symbol) {
  try {
    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=1m&limit=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance API error');
    const data = await res.json();
    if (data && data.length >= 2) {
      const k = data[data.length - 2];
      return {
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      };
    }
    return null;
  } catch (e) {
    console.error('fetchLatestCandle error:', e.message);
    return null;
  }
}

async function fetchPrice(symbol) {
  try {
    const url = `${BASE_URL}/ticker/price?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance API error');
    const data = await res.json();
    return parseFloat(data.price);
  } catch (e) {
    console.error('fetchPrice error:', e.message);
    return null;
  }
}

// Original fetchCandles (limited to 1000 per request)
async function fetchCandles(symbol, interval = '1m', limit = 10000) {
  try {
    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(limit, 1000)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance API error');
    const data = await res.json();
    return data.map(k => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
  } catch (e) {
    console.error('fetchCandles error:', e.message);
    return [];
  }
}

// NEW: Fetch many candles using pagination (up to 50,000)
async function fetchManyCandles(symbol, interval = '1m', limit = 50000) {
  const maxPerRequest = 1000;
  let endTime = Date.now(); // current time in ms
  let totalFetched = 0;
  const candles = [];

  while (totalFetched < limit) {
    const remaining = limit - totalFetched;
    const count = Math.min(remaining, maxPerRequest);
    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${count}&endTime=${endTime}`;
    try {
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      if (!data || data.length === 0) break;
      const parsed = data.map(k => ({
        time: Math.floor(k[0] / 1000),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
      }));
      candles.unshift(...parsed);
      totalFetched += parsed.length;
      if (parsed.length > 0) {
        endTime = parsed[0].time * 1000 - 1; // go further back in time
      } else break;
    } catch (e) {
      console.error('fetchManyCandles error:', e.message);
      break;
    }
  }
  return candles;
}

module.exports = { fetchLatestCandle, fetchPrice, fetchCandles, fetchManyCandles };
