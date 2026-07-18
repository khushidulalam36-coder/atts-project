// ================================================================
// SETUP.JS – FINAL PRODUCTION-READY (Render + Neon DB + Vercel)
// All files created directly in current folder.
// index.html will be empty – you fill manually.
// ================================================================

const fs = require('fs');
const path = require('path');

// ─── KONFIG ──────────────────────────────────────────────────────────
const PROJECT_ROOT = process.cwd();

const ENV_TEMPLATE = `# Neon DB (PostgreSQL)
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/alamquant?sslmode=require

# Vercel Blob
VERCEL_BLOB_READ_WRITE_TOKEN=vercel_blob_read_write_token_here

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=change_this_to_a_random_64_char_string_in_production

# Finnhub API (optional – for real market prices)
FINNHUB_API_KEY=d9bqlapr01ql2jmt3ht0d9bqlapr01ql2jmt3htg

# Server Port
PORT=5000

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
`;

// ─── FILE DEFINITIONS ───────────────────────────────────────────────
const files = {
  'index.html': '',   // ← USER FILLS MANUALLY

  'package.json': JSON.stringify({
    name: 'alamquant-backend',
    version: '2.0.0',
    description: 'Alamquant Multi-User Training HUB – Production Backend',
    main: 'server.js',
    scripts: {
      start: 'node server.js',
      dev: 'nodemon server.js',
      migrate: 'node scripts/migrate.js',
      'create-admin': 'node scripts/create-admin.js'
    },
    dependencies: {
      express: '^4.18.2',
      cors: '^2.8.5',
      dotenv: '^16.3.1',
      jsonwebtoken: '^9.0.2',
      bcrypt: '^5.1.1',
      '@neondatabase/serverless': '^0.9.0',
      '@vercel/blob': '^0.22.1',
      'node-fetch': '^3.3.2',
      multer: '^1.4.5-lts.1',
      ws: '^8.14.2',
      'express-rate-limit': '^7.1.5',
      helmet: '^7.0.0'
    },
    devDependencies: {
      nodemon: '^3.0.1'
    }
  }, null, 2),

  '.env': ENV_TEMPLATE,

  '.gitignore': `node_modules/
.env
uploads/
*.log
.DS_Store
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
| VERCEL_BLOB_READ_WRITE_TOKEN | Vercel Blob token for file uploads |
| JWT_SECRET | Secret key for JWT (change this!) |
| FINNHUB_API_KEY | Finnhub API key for real-time prices |
| PORT | Server port (default 5000) |
| FRONTEND_URL | Frontend URL for CORS |

## Default Admin
- Username: \`admin\`
- Password: \`admin123\`
- **Change after first login!**
`,

  // ── server.js (FINAL WITH CORS FIX) ─────────────────────────────────
  'server.js': `const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// ── WebSocket ────────────────────────────────────────────────────────
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

// Simulated price stream (every 2 seconds)
setInterval(() => {
  const syms = ['AAPL','TSLA','GOOGL','MSFT','AMZN','BTCUSD','ETHUSD','EURUSD','GBPUSD','XAUUSD'];
  const prices = {};
  syms.forEach(s => { prices[s] = +(100 + Math.random() * 300).toFixed(2); });
  broadcast({ type: 'price_update', prices, timestamp: Date.now() });
}, 2000);

// ── Middleware ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// Explicit CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Explicit OPTIONS handler for preflight requests
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

// ── Routes ───────────────────────────────────────────────────────────
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), wsClients: wsClients.size, timestamp: new Date().toISOString() });
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(\`╔══════════════════════════════════════════╗\`);
  console.log(\`║  🚀 Alamquant Backend  v2.0.0          ║\`);
  console.log(\`║  📡 API:  http://localhost:\${PORT}/api     ║\`);
  console.log(\`║  🔌 WS:   ws://localhost:\${PORT}          ║\`);
  console.log(\`║  ❤️  Health: /api/health               ║\`);
  console.log(\`╚══════════════════════════════════════════╝\`);
});

module.exports = { app, server, wss, broadcast };
`,

  // ── scripts/migrate.js (dotenv fix) ─────────────────────────────────
  'scripts/migrate.js': `require('dotenv').config();
const { query } = require('../lib/db');
const bcrypt = require('bcrypt');

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
    console.log('✅ Default admin created (username: admin, password: admin123)');
  } catch (err) {
    console.log('ℹ️ Admin user already exists or error:', err.message);
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
    console.log('ℹ️ Portfolio creation error:', err.message);
  }
}

(async function migrate() {
  console.log('🔄 Running migrations...');
  for (const sql of migrations) {
    try {
      await query(sql);
      console.log('✅ Migration executed.');
    } catch (err) {
      console.error('❌ Migration error:', err.message);
    }
  }
  await createDefaultAdmin();
  await createAdminPortfolio();
  console.log('🎉 Migration complete!');
  process.exit(0);
})();
`,

  // ─── scripts/create-admin.js ─────────────────────────────────────────
  'scripts/create-admin.js': `require('dotenv').config();
const { query } = require('../lib/db');
const bcrypt = require('bcrypt');
const readline = require('readline');

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
        console.log(\`✅ Admin user "\${u}" created/updated successfully!\`);
      } catch (err) {
        console.error('❌ Error:', err.message);
      }
      rl.close();
      process.exit(0);
    });
  });
}

createAdmin();
`,

  // ─── lib/db.js ──────────────────────────────────────────────────────
  'lib/db.js': `const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function query(text, params = []) {
  try {
    const result = await sql(text, params);
    return result;
  } catch (error) {
    console.error('DB Error:', error.message);
    throw error;
  }
}

module.exports = { query };
`,

  // ─── lib/blob.js ────────────────────────────────────────────────────
  'lib/blob.js': `const { put, del, list } = require('@vercel/blob');

const TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
if (!TOKEN) console.warn('⚠️ VERCEL_BLOB_READ_WRITE_TOKEN not set. Uploads will fail.');

async function uploadFile(buffer, fileName, contentType = 'application/pdf') {
  const blob = await put(\`certificates/\${Date.now()}-\${fileName}\`, buffer, {
    access: 'public',
    contentType
  });
  return blob.url;
}

async function deleteFile(url) {
  try { await del(url); return true; }
  catch (e) { console.error('Blob delete error:', e); return false; }
}

async function listFiles(prefix = 'certificates/') {
  const { blobs } = await list({ prefix });
  return blobs.map(b => ({ url: b.url, size: b.size, uploadedAt: b.uploadedAt }));
}

module.exports = { uploadFile, deleteFile, listFiles };
`,

  // ─── lib/auth.js ────────────────────────────────────────────────────
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

  // ─── lib/finnhub.js ────────────────────────────────────────────────
  'lib/finnhub.js': `const API_KEY = process.env.FINNHUB_API_KEY;

async function getRealTimePrice(symbol) {
  if (!API_KEY) return +(100 + Math.random() * 300).toFixed(2);
  try {
    const res = await fetch(\`https://finnhub.io/api/v1/quote?symbol=\${symbol}&token=\${API_KEY}\`);
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
`,

  // ─── middleware/auth.js ──────────────────────────────────────────────
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

  // ─── ROUTES ─────────────────────────────────────────────────────────
  'routes/auth.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const {
  generateToken, hashPassword, comparePassword,
  getUserByUsername, createUser, getOrCreatePortfolio, getUserById, verifyToken
} = require('../lib/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const user = await getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await comparePassword(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken(user.id, user.username);
    await getOrCreatePortfolio(user.id);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3) return res.status(400).json({ error: 'Username min 3 chars' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
    const exists = await getUserByUsername(username);
    if (exists) return res.status(409).json({ error: 'Username taken' });
    const hash = await hashPassword(password);
    const user = await createUser(username, hash);
    await getOrCreatePortfolio(user.id);
    const token = generateToken(user.id, user.username);
    res.status(201).json({ token, user: { id: user.id, username: user.username } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

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
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/subjects.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { names, icon } = req.body;
    if (!names?.en) return res.status(400).json({ error: 'English name required' });
    const id = 'subj-' + Date.now();
    await query('INSERT INTO subjects (id, icon, names, "order") VALUES ($1,$2,$3,(SELECT COALESCE(MAX("order"),0)+1 FROM subjects))', [id, icon || '📁', names]);
    const r = await query('SELECT * FROM subjects WHERE id = $1', [id]);
    res.status(201).json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { names, icon } = req.body;
    await query('UPDATE subjects SET names=$1, icon=$2 WHERE id=$3', [names, icon, req.params.id]);
    const r = await query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    res.json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try { await query('DELETE FROM subjects WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/reorder', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    for (let i = 0; i < ids.length; i++) await query('UPDATE subjects SET "order"=$1 WHERE id=$2', [i, ids[i]]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/lessons.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, async (req, res) => {
  try {
    const { subjectId, titles, contents, duration, level, quizPassScore } = req.body;
    if (!subjectId || !titles?.en) return res.status(400).json({ error: 'subjectId + English title required' });
    const id = 'les-' + Date.now();
    await query(
      'INSERT INTO lessons (id, subject_id, titles, contents, duration, level, quiz_pass_score, "order") VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX("order"),0)+1 FROM lessons WHERE subject_id=$2))',
      [id, subjectId, titles, contents || {}, duration || 15, level || 'Beginner', quizPassScore || 80]
    );
    const r = await query('SELECT * FROM lessons WHERE id = $1', [id]);
    res.status(201).json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { titles, contents, duration, level, quizPassScore } = req.body;
    await query('UPDATE lessons SET titles=$1,contents=$2,duration=$3,level=$4,quiz_pass_score=$5 WHERE id=$6',
      [titles, contents, duration, level, quizPassScore, req.params.id]);
    const r = await query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
    res.json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try { await query('DELETE FROM lessons WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/reorder', authenticate, async (req, res) => {
  try {
    const { subjectId, ids } = req.body;
    if (!subjectId || !Array.isArray(ids)) return res.status(400).json({ error: 'subjectId + ids required' });
    for (let i = 0; i < ids.length; i++) await query('UPDATE lessons SET "order"=$1 WHERE id=$2 AND subject_id=$3', [i, ids[i], subjectId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/quiz.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    const { id, question, options, correct, points, explanation } = req.body;
    if (!question?.en) return res.status(400).json({ error: 'Question text required' });
    const qid = id || ('q-' + Date.now());
    await query('INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]);
    const r = await query('SELECT * FROM quiz_questions WHERE id=$1', [qid]);
    res.status(201).json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:lessonId/:idx', authenticate, async (req, res) => {
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
    const rows = existing.rows || existing;
    const oldId = rows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/submit', authenticate, async (req, res) => {
  try {
    const { lessonId, score, passed } = req.body;
    await query(
      'INSERT INTO quiz_scores (user_id, lesson_id, score, passed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET score=$3, passed=$4, attempted_at=NOW()',
      [req.user.userId, lessonId, score, passed]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/scores', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, score, passed FROM quiz_scores WHERE user_id=$1', [req.user.userId]);
    const scores = {};
    (r.rows || r).forEach(row => { scores[row.lesson_id] = { score: row.score, passed: row.passed }; });
    res.json(scores);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/progress.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, progress FROM user_progress WHERE user_id=$1', [req.user.userId]);
    const prog = {};
    (r.rows || r).forEach(row => { prog[row.lesson_id] = row.progress; });
    res.json(prog);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/', authenticate, async (req, res) => {
  try {
    const { lessonId, progress } = req.body;
    await query(
      'INSERT INTO user_progress (user_id, lesson_id, progress, completed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET progress=$3, completed=$4, updated_at=NOW()',
      [req.user.userId, lessonId, progress, progress >= 100]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/bookmarks.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id FROM bookmarks WHERE user_id=$1', [req.user.userId]);
    res.json((r.rows || r).map(row => row.lesson_id));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    await query('INSERT INTO bookmarks (user_id, lesson_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM bookmarks WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/notes.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.get('/all', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, content FROM notes WHERE user_id=$1', [req.user.userId]);
    const notes = {};
    (r.rows || r).forEach(row => { notes[row.lesson_id] = row.content; });
    res.json(notes);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:lessonId', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT content FROM notes WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ content: (r.rows || r)[0]?.content || '' });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:lessonId', authenticate, async (req, res) => {
  try {
    await query(
      'INSERT INTO notes (user_id, lesson_id, content) VALUES ($1,$2,$3) ON CONFLICT (user_id, lesson_id) DO UPDATE SET content=$3, updated_at=NOW()',
      [req.user.userId, req.params.lessonId, req.body.content || '']
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/portfolio.js': `const router = require('express').Router();
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
`,

  'routes/upload.js': `const router = require('express').Router();
const multer = require('multer');
const { uploadFile, deleteFile } = require('../lib/blob');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url, success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

router.delete('/', authenticate, async (req, res) => {
  try {
    if (!req.body.url) return res.status(400).json({ error: 'URL required' });
    await deleteFile(req.body.url);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
`,

  'routes/export.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
`,

  'routes/import.js': `const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

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
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
`,
};

// ─── FILE CREATION ENGINE ────────────────────────────────────────────
function createProject() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  🚀 Alamquant Backend Setup v2.0        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const folders = ['routes', 'lib', 'middleware', 'scripts', 'uploads'];
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
  console.log('📌 index.html তৈরি হয়েছে – এখন ম্যানুয়ালি পেস্ট করুন।\n');
}

// ─── EXECUTE ─────────────────────────────────────────────────────────
try {
  createProject();
} catch (err) {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
}