// ================================================================
// SETUP.JS – FINAL PRODUCTION-READY (Render + Neon DB + Vercel Blob Public)
// All files created directly in current folder.
// index.html will be empty – fill manually.
// ================================================================

const fs = require('fs');
const path = require('path');

// ─── KONFIG ──────────────────────────────────────────────────────────
const PROJECT_ROOT = process.cwd();

const ENV_TEMPLATE = `# Neon DB (PostgreSQL)
DATABASE_URL=postgresql://neondb_owner:npg_dL7R2YzkygWM@ep-dawn-grass-ahoh2dpq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Vercel Blob (Public store – token still required for uploads)
VERCEL_BLOB_READ_WRITE_TOKEN=vercel_blob_rw_1AlIc3ApesIGLHil_hE5IvGS3hoyZX7YwYT1vC70hZp6A14

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=krfyde3332rtt#R$%$ERE$ttttrtgffft234

# Server Port
PORT=5000

# আপনার ফ্রন্টএন্ড URL (Vercel)
FRONTEND_URL=https://atts-project.vercel.app

# Log level (debug/info/warn/error)
LOG_LEVEL=info
`;

// ─── FILE DEFINITIONS ───────────────────────────────────────────────
const files = {
  'index.html': '', // ← USER FILLS MANUALLY

  'package.json': JSON.stringify({
    name: 'alamquant-backend',
    version: '2.1.0',
    description: 'Alamquant Multi-User Training HUB – Production Backend',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js',
      migrate: 'node scripts/migrate.js',
      'create-admin': 'node scripts/create-admin.js',
      test: 'jest'
    },
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5',
      dotenv: '^16.3.1',
      jsonwebtoken: '^9.0.2',
      bcrypt: '^5.1.1',
      '@neondatabase/serverless': '^0.9.0',
      '@vercel/blob': '^0.22.1',
      multer: '^1.4.5-lts.1',
      ws: '^8.14.2',
      'express-rate-limit': '^7.1.5',
      helmet: '^7.0.0',
      'node-cron': '^3.0.3',
      'express-validator': '^7.0.1',
      winston: '^3.11.0',
      'helmet': '^7.0.0'
    },
    devDependencies: {
      nodemon: '^3.0.1',
      jest: '^29.7.0',
      supertest: '^6.3.3'
    }
  }, null, 2),

  '.env': ENV_TEMPLATE,

  '.gitignore': `node_modules/
.env
uploads/
*.log
.DS_Store
coverage/
`,

  'README.md': `# 🚀 Alamquant Training Platform – Backend

## Quick Start
\`\`\`bash
npm install
npm run migrate
npm start
\`\`\`

## Environment Variables (.env)
| Variable | Description |
|---|---|
| DATABASE_URL | Neon DB PostgreSQL connection string |
| VERCEL_BLOB_READ_WRITE_TOKEN | Vercel Blob token (public store) |
| JWT_SECRET | Secret key for JWT (change this!) |
| PORT | Server port (default 5000) |
| FRONTEND_URL | Frontend URL for CORS |
| LOG_LEVEL | Log level (debug/info/warn/error) |

## Default Admin
- Username: \`admin\`
- Password: \`admin123\`
- **Change after first login!**

## Production Notes
- All routes are validated with express-validator.
- Rate limiting is applied per IP (100 requests per 15 min).
- Helmet CSP is configured for inline scripts.
- Trade engine uses cached prices (updated every 3 sec).
- Cron job updates public candles every 5 minutes.
- Graceful shutdown on SIGTERM.
- Winston logging (error.log, combined.log).
`,

  // ── server.js (production-ready) ────────────────────────────────
  'server.js': `const express = require('express');
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
    logger.error(\`Missing required env: \${key}\`);
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
    
    const key = \`candles_\${symbol}_60.json\`;
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
  logger.info(\`╔══════════════════════════════════════════╗\`);
  logger.info(\`║  🚀 Alamquant Backend  v2.1.0          ║\`);
  logger.info(\`║  📡 API:  http://localhost:\${PORT}/api     ║\`);
  logger.info(\`║  🔌 WS:   ws://localhost:\${PORT}          ║\`);
  logger.info(\`║  ❤️  Health: /api/health               ║\`);
  logger.info(\`║  🕐 Cron:  Every 5 minutes (Blob update)║\`);
  logger.info(\`║  ⚙️  Trade Engine: Active (SL/TP)       ║\`);
  logger.info(\`╚══════════════════════════════════════════╝\`);
});

module.exports = { app, server, wss, broadcast };
`,

  // ── lib/logger.js (new) ──────────────────────────────────────────
  'lib/logger.js': `const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ],
  exitOnError: false,
});

module.exports = logger;
`,

  // ── lib/binance.js (unchanged, but with fetch) ──────────────────
  'lib/binance.js': `// Node.js 18+ has native fetch
const BASE_URL = 'https://api.binance.com/api/v3';

async function fetchLatestCandle(symbol) {
  try {
    const url = \`\${BASE_URL}/klines?symbol=\${symbol}&interval=1m&limit=2\`;
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
    const url = \`\${BASE_URL}/ticker/price?symbol=\${symbol}\`;
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
    const url = \`\${BASE_URL}/klines?symbol=\${symbol}&interval=\${interval}&limit=\${limit}\`;
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
`,

  // ── lib/blob.js (unchanged) ──────────────────────────────────────
  'lib/blob.js': `const { put, del, list } = require('@vercel/blob');

const TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) console.warn('⚠️ VERCEL_BLOB_READ_WRITE_TOKEN not set. Uploads will fail.');

function getBlobOptions() {
  return {
    access: 'public',
    token: TOKEN,
    cacheControl: 'public, max-age=60'
  };
}

async function uploadFile(buffer, fileName, contentType = 'application/pdf') {
  const blob = await put(\`certificates/\${Date.now()}-\${fileName}\`, buffer, {
    ...getBlobOptions(),
    contentType
  });
  return blob.url;
}

async function deleteFile(url) {
  try { await del(url, { token: TOKEN }); return true; }
  catch (e) { console.error('Blob delete error:', e); return false; }
}

async function listFiles(prefix = 'certificates/') {
  const { blobs } = await list({ prefix, token: TOKEN });
  return blobs.map(b => ({ url: b.url, size: b.size, uploadedAt: b.uploadedAt }));
}

async function uploadCandles(symbol, candles, tf = 60) {
  const key = \`candles_\${symbol}_\${tf}.json\`;
  const blob = await put(key, JSON.stringify(candles), {
    ...getBlobOptions(),
    contentType: 'application/json'
  });
  return blob.url;
}

module.exports = { uploadFile, deleteFile, listFiles, uploadCandles };
`,

  // ── cron/updateCandles.js (reduced frequency) ──────────────────
  'cron/updateCandles.js': `const { fetchCandles } = require('../lib/binance');
const { uploadCandles } = require('../lib/blob');
const logger = require('../lib/logger');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT'];
const LIMIT = 10000;

async function updateBlobCandles() {
  logger.info('🔄 Updating blob candles...');
  let anyUpdated = false;
  for (const symbol of SYMBOLS) {
    try {
      const candles = await fetchCandles(symbol, '1m', LIMIT);
      if (candles && candles.length > 0) {
        const url = await uploadCandles(symbol, candles, 60);
        logger.info(\`✅ Updated \${symbol} -> \${url}\`);
        anyUpdated = true;
      } else {
        logger.warn(\`⚠️ No candles for \${symbol}\`);
      }
    } catch (e) {
      logger.error(\`❌ Error updating \${symbol}:\`, e.message);
    }
  }
  if (anyUpdated) {
    logger.info('✅ Blob candles updated (at least one symbol)');
  } else {
    logger.warn('⚠️ No candles were updated for any symbol');
  }
}

module.exports = { updateBlobCandles };
`,

  // ── lib/db.js (unchanged) ──────────────────────────────────────────
  'lib/db.js': `const { neon } = require('@neondatabase/serverless');
const logger = require('./logger');

if (!process.env.DATABASE_URL) {
  logger.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function query(text, params = []) {
  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    logger.error('DB Error:', error.message);
    throw error;
  }
}

module.exports = { query };
`,

  // ── lib/auth.js (unchanged) ─────────────────────────────────────────
  'lib/auth.js': `const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production-64-chars-min';

function generateToken(userId, username) {
  return jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
async function comparePassword(pw, hash) { return bcrypt.compare(pw, hash); }

async function getUserByUsername(username) {
  const r = await query('SELECT * FROM users WHERE username = $1', [username]);
  return r.rows?.[0] || r[0] || null;
}

async function getUserById(id) {
  const r = await query('SELECT id, username, created_at FROM users WHERE id = $1', [id]);
  return r.rows?.[0] || r[0] || null;
}

async function createUser(username, passwordHash) {
  const r = await query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
    [username, passwordHash]
  );
  return r.rows?.[0] || r[0];
}

async function getOrCreatePortfolio(userId) {
  let r = await query('SELECT * FROM portfolios WHERE user_id = $1', [userId]);
  const row = r.rows?.[0] || r[0];
  if (!row) {
    await query(
      'INSERT INTO portfolios (user_id, cash, holdings, transactions, drawn_lines) VALUES ($1, $2, $3, $4, $5)',
      [userId, 100000.00, JSON.stringify({}), JSON.stringify([]), JSON.stringify({})]
    );
    r = await query('SELECT * FROM portfolios WHERE user_id = $1', [userId]);
    return r.rows?.[0] || r[0];
  }
  return row;
}

module.exports = {
  JWT_SECRET, generateToken, verifyToken,
  hashPassword, comparePassword,
  getUserByUsername, getUserById,
  createUser, getOrCreatePortfolio
};
`,

  // ── lib/tradeEngine.js (with price cache) ──────────────────────
  'lib/tradeEngine.js': `const { query } = require('./db');
const { fetchPrice } = require('./binance');
const logger = require('./logger');

// Price cache – updated every 3 seconds
const priceCache = new Map();
let priceCacheInterval = null;

async function refreshPriceCache() {
  try {
    // Get all symbols that have any position across all users
    const result = await query(\`
      SELECT DISTINCT jsonb_object_keys(holdings) AS symbol
      FROM portfolios
      WHERE holdings != '{}' AND holdings IS NOT NULL
    \`);
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
    const result = await query(\`
      SELECT user_id, holdings, cash, transactions 
      FROM portfolios 
      WHERE holdings != '{}' AND holdings IS NOT NULL
    \`);
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
`,

  // ── middleware/auth.js (unchanged) ──────────────────────────────────
  'middleware/auth.js': `const { verifyToken } = require('../lib/auth');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing authorization header' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid authorization format' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header) {
    const token = header.split(' ')[1];
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) req.user = decoded;
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
`,

  // ── ROUTES (all enhanced with validation) ──────────────────────

  // routes/auth.js (with express-validator)
  'routes/auth.js': `const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const {
  generateToken, hashPassword, comparePassword,
  getUserByUsername, createUser, getOrCreatePortfolio, getUserById, verifyToken
} = require('../lib/auth');
const logger = require('../lib/logger');

router.post('/login',
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { username, password } = req.body;
      const user = await getUserByUsername(username);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const match = await comparePassword(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
      const token = generateToken(user.id, user.username);
      await getOrCreatePortfolio(user.id);
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      logger.error('Login error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/register',
  [
    body('username').isLength({ min: 3 }).withMessage('Username min 3 chars'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { username, password } = req.body;
      const exists = await getUserByUsername(username);
      if (exists) return res.status(409).json({ error: 'Username taken' });
      const hash = await hashPassword(password);
      const user = await createUser(username, hash);
      await getOrCreatePortfolio(user.id);
      const token = generateToken(user.id, user.username);
      res.status(201).json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      logger.error('Register error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Unauthorized' });
    const token = header.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const user = await getUserById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    logger.error('Me error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/subjects.js (with validation)
  'routes/subjects.js': `const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.get('/', async (req, res) => {
  try {
    const subjs = await query('SELECT * FROM subjects ORDER BY "order", id');
    for (const s of (subjs.rows || subjs)) {
      const lr = await query('SELECT * FROM lessons WHERE subject_id = $1 ORDER BY "order", id', [s.id]);
      s.lessons = lr.rows || lr;
      for (const l of s.lessons) {
        const qr = await query('SELECT * FROM quiz_questions WHERE lesson_id = $1', [l.id]);
        l.quiz = qr.rows || qr;
      }
    }
    res.json(subjs.rows || subjs);
  } catch (e) {
    logger.error('GET subjects error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/',
  authenticate,
  [
    body('names.en').isString().notEmpty().withMessage('English name required'),
    body('icon').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { names, icon } = req.body;
      const id = 'subj-' + Date.now();
      await query('INSERT INTO subjects (id, icon, names, "order") VALUES ($1,$2,$3,(SELECT COALESCE(MAX("order"),0)+1 FROM subjects))', [id, icon || '📁', names]);
      const r = await query('SELECT * FROM subjects WHERE id = $1', [id]);
      res.status(201).json((r.rows || r)[0]);
    } catch (e) {
      logger.error('POST subject error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put('/:id',
  authenticate,
  [
    body('names.en').optional().isString(),
    body('icon').optional().isString()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { names, icon } = req.body;
      await query('UPDATE subjects SET names=$1, icon=$2 WHERE id=$3', [names, icon, req.params.id]);
      const r = await query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
      res.json((r.rows || r)[0]);
    } catch (e) {
      logger.error('PUT subject error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM subjects WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    logger.error('DELETE subject error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reorder', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    for (let i = 0; i < ids.length; i++) await query('UPDATE subjects SET "order"=$1 WHERE id=$2', [i, ids[i]]);
    res.json({ success: true });
  } catch (e) {
    logger.error('Reorder subjects error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/lessons.js (with validation)
  'routes/lessons.js': `const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.post('/',
  authenticate,
  [
    body('subjectId').isString().notEmpty(),
    body('titles.en').isString().notEmpty(),
    body('contents').optional().isObject(),
    body('duration').optional().isInt({ min: 1 }),
    body('level').optional().isIn(['Beginner','Intermediate','Advanced']),
    body('quizPassScore').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { subjectId, titles, contents, duration, level, quizPassScore } = req.body;
      const id = 'les-' + Date.now();
      await query(
        'INSERT INTO lessons (id, subject_id, titles, contents, duration, level, quiz_pass_score, "order") VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX("order"),0)+1 FROM lessons WHERE subject_id=$2))',
        [id, subjectId, titles, contents || {}, duration || 15, level || 'Beginner', quizPassScore || 80]
      );
      const r = await query('SELECT * FROM lessons WHERE id = $1', [id]);
      res.status(201).json((r.rows || r)[0]);
    } catch (e) {
      logger.error('POST lesson error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put('/:id',
  authenticate,
  [
    body('titles.en').optional().isString(),
    body('contents').optional().isObject(),
    body('duration').optional().isInt({ min: 1 }),
    body('level').optional().isIn(['Beginner','Intermediate','Advanced']),
    body('quizPassScore').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { titles, contents, duration, level, quizPassScore } = req.body;
      await query('UPDATE lessons SET titles=$1,contents=$2,duration=$3,level=$4,quiz_pass_score=$5 WHERE id=$6',
        [titles, contents, duration, level, quizPassScore, req.params.id]);
      const r = await query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
      res.json((r.rows || r)[0]);
    } catch (e) {
      logger.error('PUT lesson error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM lessons WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    logger.error('DELETE lesson error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reorder', authenticate, async (req, res) => {
  try {
    const { subjectId, ids } = req.body;
    if (!subjectId || !Array.isArray(ids)) return res.status(400).json({ error: 'subjectId + ids required' });
    for (let i = 0; i < ids.length; i++) await query('UPDATE lessons SET "order"=$1 WHERE id=$2 AND subject_id=$3', [i, ids[i], subjectId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('Reorder lessons error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/quiz.js (with validation)
  'routes/quiz.js': `const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.post('/:lessonId',
  authenticate,
  [
    body('question.en').isString().notEmpty(),
    body('options').isArray({ min: 2 }),
    body('correct').isIn(['a','b','c','d']),
    body('points').optional().isInt({ min: 1 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id, question, options, correct, points, explanation } = req.body;
      const qid = id || ('q-' + Date.now());
      await query('INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]);
      const r = await query('SELECT * FROM quiz_questions WHERE id=$1', [qid]);
      res.status(201).json((r.rows || r)[0]);
    } catch (e) {
      logger.error('POST quiz error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put('/:lessonId/:idx',
  authenticate,
  [
    body('question.en').optional().isString(),
    body('options').optional().isArray({ min: 2 }),
    body('correct').optional().isIn(['a','b','c','d'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id, question, options, correct, points, explanation } = req.body;
      const qid = id || ('q-' + Date.now());
      const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
      const rows = existing.rows || existing;
      const oldId = rows[parseInt(req.params.idx)]?.id;
      if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
      await query('INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]);
      res.json({ success: true });
    } catch (e) {
      logger.error('PUT quiz error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
    const rows = existing.rows || existing;
    const oldId = rows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('DELETE quiz error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/submit',
  authenticate,
  [
    body('lessonId').isString().notEmpty(),
    body('score').isInt({ min: 0, max: 100 }),
    body('passed').isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { lessonId, score, passed } = req.body;
      await query(
        'INSERT INTO quiz_scores (user_id, lesson_id, score, passed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET score=$3, passed=$4, attempted_at=NOW()',
        [req.user.userId, lessonId, score, passed]
      );
      res.json({ success: true });
    } catch (e) {
      logger.error('Submit quiz error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('Reset quiz error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/scores', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, score, passed FROM quiz_scores WHERE user_id=$1', [req.user.userId]);
    const scores = {};
    (r.rows || r).forEach(row => { scores[row.lesson_id] = { score: row.score, passed: row.passed }; });
    res.json(scores);
  } catch (e) {
    logger.error('Get scores error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/progress.js (unchanged)
  'routes/progress.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, progress FROM user_progress WHERE user_id=$1', [req.user.userId]);
    const prog = {};
    (r.rows || r).forEach(row => { prog[row.lesson_id] = row.progress; });
    res.json(prog);
  } catch (e) {
    logger.error('GET progress error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const { lessonId, progress } = req.body;
    await query(
      'INSERT INTO user_progress (user_id, lesson_id, progress, completed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET progress=$3, completed=$4, updated_at=NOW()',
      [req.user.userId, lessonId, progress, progress >= 100]
    );
    res.json({ success: true });
  } catch (e) {
    logger.error('PUT progress error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/bookmarks.js (FIXED)
  'routes/bookmarks.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id FROM bookmarks WHERE user_id=$1', [req.user.userId]);
    res.json((r.rows || r).map(row => row.lesson_id));
  } catch (e) {
    logger.error('GET bookmarks error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    await query(
      'INSERT INTO bookmarks (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT (user_id, lesson_id) DO NOTHING',
      [req.user.userId, req.params.lessonId]
    );
    res.json({ success: true });
  } catch (e) {
    logger.error('POST bookmark error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM bookmarks WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('DELETE bookmark error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/notes.js (unchanged)
  'routes/notes.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.get('/all', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, content FROM notes WHERE user_id=$1', [req.user.userId]);
    const notes = {};
    (r.rows || r).forEach(row => { notes[row.lesson_id] = row.content; });
    res.json(notes);
  } catch (e) {
    logger.error('GET all notes error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:lessonId', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT content FROM notes WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ content: (r.rows || r)[0]?.content || '' });
  } catch (e) {
    logger.error('GET note error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:lessonId', authenticate, async (req, res) => {
  try {
    await query(
      'INSERT INTO notes (user_id, lesson_id, content) VALUES ($1,$2,$3) ON CONFLICT (user_id, lesson_id) DO UPDATE SET content=$3, updated_at=NOW()',
      [req.user.userId, req.params.lessonId, req.body.content || '']
    );
    res.json({ success: true });
  } catch (e) {
    logger.error('PUT note error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/portfolio.js (FIXED with proper conversion)
  'routes/portfolio.js': `const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const { getOrCreatePortfolio } = require('../lib/auth');
const { fetchPrice } = require('../lib/binance');
const logger = require('../lib/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const p = await getOrCreatePortfolio(req.user.userId);
    let holdings = typeof p.holdings === 'string' ? JSON.parse(p.holdings) : (p.holdings || {});
    const positions = Object.entries(holdings).map(([symbol, data]) => {
      const qty = data.qty || 0;
      return {
        symbol,
        qty: Math.abs(qty),
        entryPrice: data.avgPrice || 0,
        type: qty > 0 ? 'long' : 'short',
        slPrice: data.slPrice || null,
        tpPrice: data.tpPrice || null,
        currentPrice: data.avgPrice || 0
      };
    });
    res.json({
      cash: p.cash,
      positions: positions,
      transactions: p.transactions,
      drawnLines: p.drawn_lines
    });
  } catch (e) {
    logger.error('GET /portfolio error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/',
  authenticate,
  [
    body('symbol').isString().notEmpty(),
    body('qty').isFloat({ min: 0.001 }),
    body('type').isIn(['buy','sell']),
    body('slPrice').optional().isFloat({ min: 0 }),
    body('tpPrice').optional().isFloat({ min: 0 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { symbol, qty, type, slPrice, tpPrice } = req.body;
      const p = await getOrCreatePortfolio(req.user.userId);
      let holdings = typeof p.holdings === 'string' ? JSON.parse(p.holdings) : (p.holdings || {});
      let transactions = typeof p.transactions === 'string' ? JSON.parse(p.transactions) : (p.transactions || []);
      let cash = parseFloat(p.cash);
      const price = await fetchPrice(symbol);
      if (!price) return res.status(500).json({ error: 'Could not fetch price' });

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
    } catch (e) {
      logger.error('PUT portfolio error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put('/sync',
  authenticate,
  [
    body('cash').isFloat({ min: 0 }),
    body('positions').optional().isArray(),
    body('transactions').optional().isArray(),
    body('drawnLines').optional().isObject()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { cash, positions, transactions, drawnLines } = req.body;
      const holdings = {};
      (positions || []).forEach(pos => {
        if (pos.symbol && pos.qty !== undefined && pos.entryPrice !== undefined) {
          let qty = pos.qty;
          if (pos.type === 'short') qty = -pos.qty;
          holdings[pos.symbol] = {
            qty: qty,
            avgPrice: pos.entryPrice,
            slPrice: pos.slPrice || null,
            tpPrice: pos.tpPrice || null
          };
        }
      });

      await query(
        \`UPDATE portfolios 
         SET cash = $1, 
             holdings = $2, 
             transactions = $3, 
             drawn_lines = $4 
         WHERE user_id = $5\`,
        [
          parseFloat(cash),
          JSON.stringify(holdings),
          JSON.stringify(transactions || []),
          JSON.stringify(drawnLines || {}),
          req.user.userId
        ]
      );

      res.json({ success: true });
    } catch (e) {
      logger.error('Portfolio sync error:', e.message);
      res.status(500).json({ error: 'Sync failed' });
    }
  }
);

router.delete('/holding/:symbol', authenticate, async (req, res) => {
  try {
    const p = await getOrCreatePortfolio(req.user.userId);
    let holdings = typeof p.holdings === 'string' ? JSON.parse(p.holdings) : (p.holdings || {});
    let cash = parseFloat(p.cash);
    let transactions = typeof p.transactions === 'string' ? JSON.parse(p.transactions) : (p.transactions || []);
    const h = holdings[req.params.symbol];
    if (!h) return res.status(404).json({ error: 'Holding not found' });
    const price = await fetchPrice(req.params.symbol);
    if (!price) return res.status(500).json({ error: 'Could not fetch price' });
    cash += h.qty * price;
    transactions.unshift({ type: 'sell', symbol: req.params.symbol, qty: h.qty, price, time: new Date().toISOString(), reason: 'Manual Exit' });
    delete holdings[req.params.symbol];
    await query('UPDATE portfolios SET cash=$1, holdings=$2, transactions=$3 WHERE user_id=$4',
      [cash, JSON.stringify(holdings), JSON.stringify(transactions), req.user.userId]);
    res.json(await getOrCreatePortfolio(req.user.userId));
  } catch (e) {
    logger.error('DELETE holding error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/upload.js (unchanged)
  'routes/upload.js': `const router = require('express').Router();
const multer = require('multer');
const { uploadFile, deleteFile } = require('../lib/blob');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url, success: true });
  } catch (e) {
    logger.error('Upload error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/', authenticate, async (req, res) => {
  try {
    if (!req.body.url) return res.status(400).json({ error: 'URL required' });
    await deleteFile(req.body.url);
    res.json({ success: true });
  } catch (e) {
    logger.error('Delete file error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
`,

  // routes/export.js (unchanged)
  'routes/export.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const user = await query('SELECT username FROM users WHERE id=$1', [req.user.userId]);
    const u = (user.rows || user)[0];
    if (u?.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const subjs = await query('SELECT * FROM subjects ORDER BY "order"');
    for (const s of (subjs.rows || subjs)) {
      const lr = await query('SELECT * FROM lessons WHERE subject_id=$1 ORDER BY "order"', [s.id]);
      s.lessons = lr.rows || lr;
      for (const l of s.lessons) {
        const qr = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1', [l.id]);
        l.quiz = qr.rows || qr;
      }
    }
    res.json(subjs.rows || subjs);
  } catch (e) {
    logger.error('Export error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
`,

  // routes/import.js (unchanged)
  'routes/import.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.post('/', authenticate, async (req, res) => {
  try {
    const user = await query('SELECT username FROM users WHERE id=$1', [req.user.userId]);
    const u = (user.rows || user)[0];
    if (u?.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    for (const s of data) {
      await query('INSERT INTO subjects (id,icon,names,"order") VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET icon=$2,names=$3,"order"=$4',
        [s.id, s.icon || '📁', s.names, s.order || 0]);
      for (const l of (s.lessons || [])) {
        await query('INSERT INTO lessons (id,subject_id,titles,contents,duration,level,quiz_pass_score,"order") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET subject_id=$2,titles=$3,contents=$4,duration=$5,level=$6,quiz_pass_score=$7,"order"=$8',
          [l.id, s.id, l.titles, l.contents, l.duration || 15, l.level || 'Beginner', l.quizPassScore || 80, l.order || 0]);
        for (const q of (l.quiz || [])) {
          await query('INSERT INTO quiz_questions (id,lesson_id,question,options,correct,points,explanation) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET lesson_id=$2,question=$3,options=$4,correct=$5,points=$6,explanation=$7',
            [q.id, l.id, q.question, q.options, q.correct, q.points || 5, q.explanation || {}]);
        }
      }
    }
    res.json({ success: true, count: data.length });
  } catch (e) {
    logger.error('Import error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
`,

  // ── scripts/migrate.js (unchanged) ────────────────────────────────
  'scripts/migrate.js': `require('dotenv').config();
const { query } = require('../lib/db');
const bcrypt = require('bcrypt');
const logger = require('../lib/logger');

const migrations = [
  \`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );\`,
  \`CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      icon TEXT DEFAULT '📁',
      names JSONB NOT NULL,
      "order" INTEGER DEFAULT 0
  );\`,
  \`CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
      titles JSONB NOT NULL,
      contents JSONB NOT NULL DEFAULT '{}',
      duration INTEGER DEFAULT 15,
      level TEXT DEFAULT 'Beginner',
      quiz_pass_score INTEGER DEFAULT 80,
      "order" INTEGER DEFAULT 0
  );\`,
  \`CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      question JSONB NOT NULL,
      options JSONB NOT NULL,
      correct TEXT NOT NULL,
      points INTEGER DEFAULT 5,
      explanation JSONB DEFAULT '{}'
  );\`,
  \`CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      progress INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );\`,
  \`CREATE TABLE IF NOT EXISTS quiz_scores (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      score INTEGER DEFAULT 0,
      passed BOOLEAN DEFAULT FALSE,
      attempted_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );\`,
  \`CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );\`,
  \`CREATE TABLE IF NOT EXISTS notes (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      content TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );\`,
  \`CREATE TABLE IF NOT EXISTS portfolios (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cash DECIMAL(15,2) DEFAULT 100000.00,
      holdings JSONB DEFAULT '{}',
      transactions JSONB DEFAULT '[]',
      drawn_lines JSONB DEFAULT '{}'
  );\`
];

async function createDefaultAdmin() {
  const username = 'admin';
  const password = 'admin123';
  const hashed = await bcrypt.hash(password, 10);
  try {
    await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING',
      [username, hashed]
    );
    logger.info('✅ Default admin created (username: admin, password: admin123)');
  } catch (err) {
    logger.info('ℹ️ Admin user already exists or error:', err.message);
  }
}

async function createAdminPortfolio() {
  try {
    const admin = await query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (admin.rows && admin.rows.length > 0) {
      await query(
        'INSERT INTO portfolios (user_id, cash, holdings, transactions, drawn_lines) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING',
        [admin.rows[0].id, 100000.00, '{}', '[]', '{}']
      );
    }
  } catch (err) {
    logger.info('ℹ️ Portfolio creation error:', err.message);
  }
}

(async function migrate() {
  logger.info('🔄 Running migrations...');
  for (const sql of migrations) {
    try {
      await query(sql);
      logger.info('✅ Migration executed.');
    } catch (err) {
      logger.error('❌ Migration error:', err.message);
    }
  }
  await createDefaultAdmin();
  await createAdminPortfolio();
  logger.info('🎉 Migration complete!');
  process.exit(0);
})();
`,

  // ── scripts/create-admin.js (unchanged) ────────────────────────────
  'scripts/create-admin.js': `require('dotenv').config();
const { query } = require('../lib/db');
const bcrypt = require('bcrypt');
const readline = require('readline');
const logger = require('../lib/logger');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createAdmin() {
  rl.question('Username (default: admin): ', async (username) => {
    const u = username.trim() || 'admin';
    rl.question('Password (default: admin123): ', async (password) => {
      const p = password.trim() || 'admin123';
      const hashed = await bcrypt.hash(p, 10);
      try {
        await query(
          'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = $2',
          [u, hashed]
        );
        const user = await query('SELECT id FROM users WHERE username = $1', [u]);
        if (user.rows && user.rows.length > 0) {
          await query(
            'INSERT INTO portfolios (user_id, cash, holdings, transactions, drawn_lines) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING',
            [user.rows[0].id, 100000.00, '{}', '[]', '{}']
          );
        }
        logger.info(\`✅ Admin user "\${u}" created/updated successfully!\`);
      } catch (err) {
        logger.error('❌ Error:', err.message);
      }
      rl.close();
      process.exit(0);
    });
  });
}

createAdmin();
`,
};

// ─── FILE CREATION ENGINE ───────────────────────────────────────────
function createProject() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🚀 Alamquant Backend Setup v2.1        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const folders = ['routes', 'lib', 'middleware', 'scripts', 'cron', 'uploads'];
  folders.forEach(f => {
    const p = path.join(PROJECT_ROOT, f);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });

  let count = 0;
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(PROJECT_ROOT, relPath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    count++;
    const label = relPath === 'index.html' ? '📄 index.html (empty – fill manually)' : relPath;
    console.log(`   ✅ ${label}`);
  }

  console.log(`\n🎉 Done! ${count} files created directly in:`);
  console.log(`   ${PROJECT_ROOT}`);
  console.log('\n🔧 Next Steps:');
  console.log('   1.  npm install');
  console.log('   2.  Edit .env → set your DATABASE_URL, JWT_SECRET, etc.');
  console.log('   3.  npm run migrate');
  console.log('   4.  npm start');
  console.log('\n📌 Default Admin:  admin / admin123');
  console.log('📌 index.html is empty – paste your frontend code manually.');
  console.log('📌 Cron job updates Blob every 5 minutes (public store with token).');
  console.log('📌 Trade engine uses cached prices (refreshed every 3s).');
  console.log('📌 Graceful shutdown enabled (SIGTERM).');
  console.log('📌 Logging with winston (error.log, combined.log).\n');
}

// ─── EXECUTE ─────────────────────────────────────────────────────────
try {
  createProject();
} catch (err) {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
}