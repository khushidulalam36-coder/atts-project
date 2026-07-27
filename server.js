const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const cron = require('node-cron');
const { envalid, str, num } = require('envalid');

// Load environment variables
dotenv.config();

// Validate environment
envalid.cleanEnv(process.env, {
  DATABASE_URL: str(),
  JWT_SECRET: str().min(32),
  PORT: num({ default: 5000 }),
  FRONTEND_URL: str(),
  VERCEL_BLOB_READ_WRITE_TOKEN: str(),
  NODE_ENV: str({ choices: ['development', 'production', 'test'], default: 'development' }),
  LOG_LEVEL: str({ choices: ['debug', 'info', 'warn', 'error'], default: 'info' })
});

// ── Logger ────────────────────────────────────────────────────────
const logger = require('./lib/logger');

// ── Imports ────────────────────────────────────────────────────────
const { updateBlobCandles } = require('./cron/updateCandles');
const { startTradeEngine } = require('./lib/tradeEngine');
const { fetchLatestCandle } = require('./lib/binance');
const { get } = require('@vercel/blob');
const { query } = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ── Trust proxy (for rate limiter behind reverse proxy) ──────────
app.set('trust proxy', 1);

// ── WebSocket ──────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected' }));
  logger.debug('WebSocket client connected');
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

// ── Security & Middleware ─────────────────────────────────────────
// Helmet with CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "vercel.com"],
      connectSrc: ["'self'", "api.binance.com", "stream.binance.com", "atts-project.onrender.com"],
      fontSrc: ["'self'", "cdnjs.cloudflare.com", "fonts.gstatic.com"],
    },
  },
}));

// Compression
app.use(compression());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.sendStatus(200);
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  skip: (req) => req.path === '/api/health',
  standardHeaders: true,
  legacyHeaders: false,
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
    logger.error('Latest candle error', { error: e.message, symbol: req.params.symbol });
    res.status(500).json({ error: e.message });
  }
});

// Proxy endpoint to serve candles from public Blob store
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
    logger.error('Candle proxy error', { error: e.message, symbol: req.params.symbol });
    res.status(500).json({ error: e.message });
  }
});

// Enhanced health check
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      db: false,
      blob: false,
      binance: false,
      wsClients: wsClients.size
    }
  };
  try {
    await query('SELECT 1');
    health.services.db = true;
  } catch (e) {
    logger.error('Health check DB failed', { error: e.message });
  }
  try {
    const { get } = require('@vercel/blob');
    await get('health-check', { token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN });
    health.services.blob = true;
  } catch (e) {
    logger.error('Health check Blob failed', { error: e.message });
  }
  try {
    const res = await fetch('https://api.binance.com/api/v3/ping');
    health.services.binance = res.ok;
  } catch (e) {
    logger.error('Health check Binance failed', { error: e.message });
  }
  const overall = Object.values(health.services).every(v => v === true);
  health.status = overall ? 'ok' : 'degraded';
  res.status(overall ? 200 : 503).json(health);
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Cron Job: Update Blob every minute with retry ──────────────
const updateBlobWithRetry = require('./cron/updateCandles').updateBlobCandlesWithRetry;
cron.schedule('* * * * *', async () => {
  logger.info('⏰ Running candle update cron...');
  try {
    await updateBlobWithRetry(3);
    logger.info('✅ Blob candles updated');
  } catch (e) {
    logger.error('❌ Cron error:', { error: e.message });
  }
});

// ── Start Background Trade Engine ────────────────────────────────
startTradeEngine();

// ── Graceful Shutdown ─────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    // Close WebSocket connections
    wsClients.forEach(ws => ws.close());
    // Close DB connection (if any)
    // Neon driver handles it automatically, but if we have a pool we close it.
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Start Server ──────────────────────────────────────────────────
server.listen(PORT, () => {
  logger.info(`╔══════════════════════════════════════════╗`);
  logger.info(`║  🚀 Alamquant Backend  v3.0.0          ║`);
  logger.info(`║  📡 API:  http://localhost:${PORT}/api     ║`);
  logger.info(`║  🔌 WS:   ws://localhost:${PORT}          ║`);
  logger.info(`║  ❤️  Health: /api/health               ║`);
  logger.info(`║  🕐 Cron:  Every minute (Blob update)  ║`);
  logger.info(`║  ⚙️  Trade Engine: Active (SL/TP)       ║`);
  logger.info(`╚══════════════════════════════════════════╝`);
});

module.exports = { app, server, wss, broadcast };
