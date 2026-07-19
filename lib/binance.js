const fetch = require('node-fetch');

const BASE_URL = 'https://api.binance.com/api/v3';

// Get latest completed M1 candle (last 2 candles, return the older one)
async function fetchLatestCandle(symbol) {
  try {
    const url = `${BASE_URL}/klines?symbol=${symbol}&interval=1m&limit=2`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance API error');
    const data = await res.json();
    if (data && data.length >= 2) {
      const k = data[data.length - 2]; // the completed candle
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

// Get current price
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

// Get last N candles (for initial load)
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

module.exports = { fetchLatestCandle, fetchPrice, fetchCandles };
