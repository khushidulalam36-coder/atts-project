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

async function fetchCandles(symbol, interval = '1m', limit = 10000) {
  try {
    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
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

// 🔥 নতুন ফাংশন: ২৫,০০০ ক্যান্ডেল পেতে পেজিনেশন ব্যবহার করছে
async function fetchAllCandles(symbol, interval = '1m', limit = 25000) {
  const maxLimit = 1000;
  const calls = Math.ceil(limit / maxLimit);
  let allCandles = [];
  let endTime = null;

  for (let i = 0; i < calls; i++) {
    const currentLimit = Math.min(maxLimit, limit - i * maxLimit);
    let url = `${BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${currentLimit}`;
    if (endTime) url += `&endTime=${endTime}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;

    const candles = data.map(k => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));
    
    allCandles = candles.concat(allCandles);
    endTime = data[0][0];
  }
  return allCandles;
}

module.exports = { fetchLatestCandle, fetchPrice, fetchCandles, fetchAllCandles };
