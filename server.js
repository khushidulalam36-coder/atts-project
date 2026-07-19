const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ── Imports ────────────────────────────────────────────────────────
const { updateBlobCandles } = require('./cron/updateCandles');
const { startTradeEngine } = require('./lib/tradeEngine');
const { fetchLatestCandle } = require('./lib/binance');
const { get } = require('@vercel/blob');

// ── Trust proxy (for rate limiter behind reverse proxy) ──────────
app.set('trust proxy', 1);

// ── WebSocket ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
});

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}

// Simulated price stream (fallback)
setInterval(() => {
  const syms = ['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT','BNBUSDT','DOGEUSDT','ADAUSDT','LINKUSDT','AVAXUSDT','DOTUSDT'];
  const prices = {};
  syms.forEach(s => { prices[s] = +(100 + Math.random() * 300).toFixed(2); });
  broadcast({ type: 'price_update', prices, timestamp: Date.now() });
}, 2000);

// ── Middleware ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, try again later.' }
});
app.use('/api', apiLimiter);

// ── Routes ─────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/subjects',   require('./routes/subjects'));
app.use('/api/lessons',    require('./routes/lessons'));
app.use('/api/quiz',       require('./routes/quiz'));
app.use('/api/progress',   require('./routes/progress'));
app.use('/api/bookmarks',  require('./routes/bookmarks'));
app.use('/api/notes',      require('./routes/notes'));
app.use('/api/portfolio',  require('./routes/portfolio'));
app.use('/api/upload',     require('./routes/upload'));
app.use('/api/export',     require('./routes/export'));
app.use('/api/import',     require('./routes/import'));

// ── New endpoints ──────────────────────────────────────────────────
app.get('/api/candle/latest/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const candle = await fetchLatestCandle(symbol);
    if (candle) res.json(candle);
    else res.status(404).json({ error: 'Candle not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 🔥 Proxy endpoint to serve candles from private Blob store
app.get('/api/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
    if (!TOKEN) throw new Error('Blob token missing');
    
    const key = `candles_${symbol}_60.json`;
    const blob = await get(key, { token: TOKEN });
    if (!blob) return res.status(404).json({ error: 'Candles not found' });
    
    const data = await blob.json();
    res.json(data);
  } catch (e) {
    console.error('Proxy error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(), 
    wsClients: wsClients.size, 
    timestamp: new Date().toISOString(),
    cronLastRun: global._cronLastRun || null
  });
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Cron Job: Update Blob every minute ──────────────────────────
cron.schedule('* * * * *', async () => {
  console.log('⏰ Running candle update cron...');
  try {
    await updateBlobCandles();
    global._cronLastRun = new Date().toISOString();
    console.log('✅ Blob candles updated');
  } catch (e) {
    console.error('❌ Cron error:', e.message);
  }
});

// ── Start Background Trade Engine ────────────────────────────────
startTradeEngine();

// ── Start Server ──────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════════╗`);
  console.log(`║  🚀 Alamquant Backend  v2.0.0          ║`);
  console.log(`║  📡 API:  http://localhost:${PORT}/api     ║`);
  console.log(`║  🔌 WS:   ws://localhost:${PORT}          ║`);
  console.log(`║  ❤️  Health: /api/health               ║`);
  console.log(`║  🕐 Cron:  Every minute (Blob update)  ║`);
  console.log(`║  ⚙️  Trade Engine: Active (SL/TP)       ║`);
  console.log(`╚══════════════════════════════════════════╝`);
});

module.exports = { app, server, wss, broadcast };
