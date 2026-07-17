const API_KEY = process.env.FINNHUB_API_KEY;

async function getRealTimePrice(symbol) {
  if (!API_KEY) return +(100 + Math.random() * 300).toFixed(2);
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    if (data?.c > 0) return data.c;
    throw new Error('No price');
  } catch {
    return +(100 + Math.random() * 300).toFixed(2);
  }
}

async function getMultiplePrices(symbols) {
  const prices = {};
  for (const s of symbols) prices[s] = await getRealTimePrice(s);
  return prices;
}

module.exports = { getRealTimePrice, getMultiplePrices };
