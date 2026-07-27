const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');
const logger = require('./lib/logger');

dotenv.config();

// Validate required environment variables
const requiredEnv = ['DATABASE_URL', 'VERCEL_BLOB_READ_WRITE_TOKEN', 'JWT_SECRET', 'FRONTEND_URL'];
requiredEnv.forEach(key => {
  if (!process.env[key]) {
    logger.error(`Missing required env: ${key}`);
    process.exit(1);
  }
});

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
// Helmet with custom CSP (allows inline scripts for Quill & FontAwesome)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.quilljs.com", "cdn.jsdelivr.net", "cdnjs.cloudflare.com", "fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.quilljs.com", "cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "fonts.gstatic.com", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || '', "wss://stream.binance.com", "wss://*.binance.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS – only allow specified frontend
const corsOptions = {
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter – per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // 100 requests per 15 minutes per IP
  keyGenerator: (req) => req.ip,
  skip: (req) => req.path === '/api/health',
  message: { error: 'Too many requests, please try again later.' },
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
    logger.error('Candle latest error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// 🔥 Proxy endpoint to serve candles from public Blob store (still requires token for get)
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
    logger.error('Proxy error:', e.message);
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

// ── Cron Job: Update Blob every 5 minutes ────────────────────────
cron.schedule('*/5 * * * *', async () => {
  logger.info('⏰ Running candle update cron...');
  try {
    await updateBlobCandles();
    global._cronLastRun = new Date().toISOString();
    logger.info('✅ Blob candles updated');
  } catch (e) {
    logger.error('❌ Cron error:', e.message);
  }
});

// ── Start Background Trade Engine ────────────────────────────────
startTradeEngine();

// ── Graceful Shutdown ─────────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing server...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
  // Force exit after 10s if not closed
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
});

// ── Start Server ──────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`╔══════════════════════════════════════════╗`);
  logger.info(`║  🚀 Alamquant Backend  v2.1.0          ║`);
  logger.info(`║  📡 API:  http://localhost:${PORT}/api     ║`);
  logger.info(`║  🔌 WS:   ws://localhost:${PORT}          ║`);
  logger.info(`║  ❤️  Health: /api/health               ║`);
  logger.info(`║  🕐 Cron:  Every 5 minutes (Blob update)║`);
  logger.info(`║  ⚙️  Trade Engine: Active (SL/TP)       ║`);
  logger.info(`╚══════════════════════════════════════════╝`);
});

module.exports = { app, server, wss, broadcast };
