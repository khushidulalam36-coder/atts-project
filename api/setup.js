// ===================================================
// SECTION 1: Dependencies & Configuration
// ===================================================
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { put } from '@vercel/blob';
import { Resend } from 'resend';
import { z } from 'zod';
import * as Sentry from '@sentry/node';
import webPush from 'web-push';
import Busboy from 'busboy';

// ---------- Environment validation ----------
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing environment variable: ${envVar}`);
    process.exit(1);
  }
}

const sql = neon(process.env.DATABASE_URL);
const ADMIN_SECRET = process.env.ADMIN_SECRET || (() => { throw new Error('ADMIN_SECRET must be set') })();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://your-domain.vercel.app';
const allowedOrigins = CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map(s => s.trim());
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const SENTRY_DSN = process.env.SENTRY_DSN || '';
const RATE_LIMIT_KV_URL = process.env.KV_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1 });
}

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    'mailto:support@alamquant.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ---------- Rate limiter ----------
let kv;
if (RATE_LIMIT_KV_URL) {
  try {
    const { createClient } = await import('@vercel/kv');
    kv = createClient({ url: RATE_LIMIT_KV_URL });
  } catch (e) {
    console.warn('KV import failed, using in-memory rate limiter');
    Sentry.captureException(e);
  }
}
const rateLimitMap = new Map();
async function rateLimiter(ip, limit = 100, windowMs = 60000) {
  if (kv) {
    try {
      const key = `rl:${ip}`;
      const current = await kv.incr(key);
      if (current === 1) await kv.expire(key, Math.ceil(windowMs / 1000));
      return current <= limit;
    } catch (e) {
      Sentry.captureException(e);
    }
  }
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return true;
  }
  const entry = rateLimitMap.get(ip);
  if (now - entry.start > windowMs) {
    entry.count = 1;
    entry.start = now;
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

// ---------- Helper functions ----------
function json(data, status = 200, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function errorJson(message, status = 500) {
  console.error(`[ERROR] ${message}`);
  return json({ error: message }, status);
}

function maskEmail(email) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return name.substring(0, 2) + '***@' + domain;
}

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------- Auth helpers ----------
async function authenticate(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [blacklisted] = await sql`SELECT 1 FROM token_blacklist WHERE token = ${token}`;
    if (blacklisted) return null;
    const [user] = await sql`SELECT * FROM users WHERE id = ${decoded.id}`;
    return user;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function authenticateAdmin(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.role || decoded.role !== 'admin') return null;
    const [admin] = await sql`SELECT * FROM admin_users WHERE id = ${decoded.id}`;
    if (admin?.password_change_required) {
      return { ...admin, require_password_change: true };
    }
    return admin;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ---------- Multilingual helper ----------
async function getUserLanguage(userId) {
  const [settings] = await sql`SELECT language FROM user_settings WHERE user_id = ${userId}`;
  return settings?.language || 'en';
}

// ---------- Business logic helpers (existing) ----------
function calculateRadarScores(scores) {
  return {
    planning: (scores.q1 || 0) + (scores.q2 || 0),
    execution: (scores.q4 || 0) + (scores.q5 || 0),
    risk: scores.q3 || 0,
    psychology: (scores.q7 || 0) + (scores.q8 || 0),
    improvement: (scores.q9 || 0) + (scores.q10 || 0),
  };
}

function computeIdentityPhase(totalDays) {
  if (totalDays >= 26) return 'Institutional Mindset';
  if (totalDays >= 21) return 'Professional Execution';
  if (totalDays >= 16) return 'Psychology';
  if (totalDays >= 11) return 'Consistency';
  if (totalDays >= 6)  return 'Discipline';
  return 'Awareness';
}

function calculateLevel(xp) {
  return Math.floor(xp / 75) + 1;
}

async function computeDisciplineStreak(userId) {
  const rows = await sql`
    SELECT date, scores->>'q6' as q6
    FROM daily_journals
    WHERE user_id = ${userId}
    ORDER BY date DESC
  `;
  if (!rows.length) return 0;
  let streak = 0;
  let prevDate = null;
  for (const row of rows) {
    const q6 = row.q6 ? parseInt(row.q6, 10) : 0;
    if (q6 < 8) break;
    const currDate = new Date(row.date);
    if (prevDate === null) {
      streak = 1;
      prevDate = currDate;
    } else {
      const diffDays = Math.round((prevDate - currDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        streak++;
        prevDate = currDate;
      } else break;
    }
  }
  return streak;
}

async function generateFeedback(userId, journal, userName) {
  const f = [], m = [];
  if (journal.stop_loss_moved) {
    f.push(`${userName}, you moved your stop loss, increasing risk.`);
    m.push('Keep your stop loss intact tomorrow; that is the foundation of discipline.');
  }
  if (journal.revenge_trade) {
    f.push('Revenge trading destroys professionalism, stay calm.');
    m.push('Do not make any revenge trades tomorrow under any circumstances.');
  }
  if (journal.fomo_entry) {
    f.push('Avoid FOMO entries; opportunities will come.');
    m.push('Analyze for 3 minutes before every entry.');
  }
  if (journal.overtrading) {
    f.push('Overtrading depletes both capital and mind.');
    m.push('Limit yourself to a maximum of 2 trades tomorrow, focusing on quality.');
  }
  const radar = journal.radar_scores;
  if (radar?.planning < 12) f.push('Focus more on following the plan.');
  if (radar?.execution < 12) f.push('Improve execution, reduce small mistakes.');
  if (radar?.risk < 6) f.push('Risk management was weak today, be careful.');
  if (radar?.psychology < 12) f.push('Work on emotional control; it is the key weapon of a professional trader.');
  if (radar?.improvement < 12) f.push('Apply today\'s lessons for a better tomorrow.');

  const last7 = await sql`SELECT radar_scores FROM daily_journals WHERE user_id = ${userId} AND date < CURRENT_DATE ORDER BY date DESC LIMIT 7`;
  if (last7.length >= 3) {
    let riskDecline = 0;
    for (let i = 0; i < last7.length - 1; i++) {
      if ((last7[i].radar_scores?.risk || 0) < (last7[i + 1].radar_scores?.risk || 0)) riskDecline++;
      else break;
    }
    if (riskDecline >= 2) f.push('Your risk management has been declining over the last few days, be cautious.');
    let psychImprove = 0;
    for (let i = 0; i < last7.length - 1; i++) {
      if ((last7[i].radar_scores?.psychology || 0) > (last7[i + 1].radar_scores?.psychology || 0)) psychImprove++;
      else break;
    }
    if (psychImprove >= 2) f.push('Your psychology index has been improving consistently, great progress!');
  }

  if (journal.rule_followed && journal.scores?.q6 >= 8)
    f.push(`Excellent ${userName}! You were a true Rule Follower today, congratulations.`);
  if (f.length === 0) f.push('It was a neutral day, but keep journaling; that is what matters.');
  if (m.length === 0) m.push('Follow your trading plan tomorrow, consistency is strength.');

  return { feedback: f.join(' '), mission: m[0] };
}

async function checkAndAwardBadges(userId, journal) {
  const newB = [];
  const { count: total } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${userId}`)[0];
  if (total === 1) {
    await sql`INSERT INTO badges (user_id, badge_type) VALUES (${userId}, 'first-journal') ON CONFLICT DO NOTHING`;
    newB.push('first-journal');
  }

  const streakRes = await sql`WITH grp AS (SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp FROM daily_journals WHERE user_id = ${userId}) SELECT COUNT(*)::int as cnt FROM grp GROUP BY grp ORDER BY MAX(date) DESC LIMIT 1`;
  const streak = streakRes[0]?.cnt || 0;
  for (const [d, b] of [[7, '7-day-streak'], [14, '14-day-streak'], [21, '21-day-streak'], [30, '30-day-master']]) {
    if (streak >= d) {
      await sql`INSERT INTO badges (user_id, badge_type) VALUES (${userId}, ${b}) ON CONFLICT DO NOTHING`;
      newB.push(b);
    }
  }

  const lastSl = await sql`SELECT date FROM daily_journals WHERE user_id = ${userId} AND stop_loss_moved = true ORDER BY date DESC LIMIT 1`;
  const noSl = lastSl.length === 0 ? total : (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${userId} AND date > ${lastSl[0].date}`)[0].cnt;
  if (noSl >= 10) {
    await sql`INSERT INTO badges (user_id, badge_type) VALUES (${userId}, '10-days-clean-stop') ON CONFLICT DO NOTHING`;
    newB.push('10-days-clean-stop');
  }
  if (total >= 20) {
    await sql`INSERT INTO badges (user_id, badge_type) VALUES (${userId}, '20-day-reviewer') ON CONFLICT DO NOTHING`;
    newB.push('20-day-reviewer');
  }
  return newB;
}

async function checkAndCompleteQuest(userId, journal, date) {
  const [quest] = await sql`SELECT * FROM daily_quests WHERE user_id = ${userId} AND quest_date = ${date}`;
  if (!quest || quest.completed) return;
  let completed = false;
  switch (quest.quest_type) {
    case 'no_revenge':
      completed = !journal.revenge_trade;
      break;
    case 'no_fomo':
      completed = !journal.fomo_entry;
      break;
    case 'q6_8plus':
      completed = (journal.scores?.q6 >= 8);
      break;
    case 'mindfulness':
      completed = journal.mindfulness_done;
      break;
    case 'habit_complete':
      const habits = await sql`SELECT hd.id FROM habit_definitions hd JOIN habit_logs hl ON hd.id = hl.habit_id WHERE hl.user_id = ${userId} AND hl.date = ${date} AND hl.completed_times IS NOT NULL`;
      completed = habits.length > 0;
      break;
  }
  if (completed) {
    await sql`UPDATE daily_quests SET completed = true WHERE id = ${quest.id}`;
  }
}

// ---------- Zod validation schemas ----------
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().optional(),
  avatar_emoji: z.string().max(10).optional(),
  language: z.string().max(10).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  display_name: z.string().optional(),
  language: z.string().max(10).optional(),
});

const evaluationSchema = z.object({
  trades_count: z.number().int().min(0),
  stop_loss_moved: z.boolean(),
  plan_deviation: z.boolean(),
  revenge_trade: z.boolean(),
  fomo_entry: z.boolean(),
  overtrading: z.boolean(),
  rule_followed: z.boolean(),
  scores: z.record(z.number().min(0).max(10)),
  evaluation_notes: z.string().optional(),
  reflection: z.string().min(1),
  date: z.string().optional(),
  mood: z.enum(['happy', 'neutral', 'stressed', 'angry']).optional(),
});

// ---------- Auth helper for Node req (used in multipart handler) ----------
async function verifyTokenFromNodeReq(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [user] = await sql`SELECT * FROM users WHERE id = ${decoded.id}`;
    return user;
  } catch {
    return null;
  }
}

// ===================================================
// SECTION 2: Node.js to Fetch API wrapper
// ===================================================
function toNodeHandler(handlerFn) {
  return async (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const fullUrl = `${protocol}://${host}${req.url}`;
    const reqPath = new URL(fullUrl).pathname;

    // ----- SPECIAL MULTIPART UPLOAD HANDLING -----
    const isUploadRoute = (
      req.method === 'POST' &&
      (reqPath === '/api/setup/upload-image' || reqPath === '/api/setup/admin/upload-image')
    );

    if (isUploadRoute) {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.startsWith('multipart/form-data')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Must be multipart/form-data' }));
        return;
      }

      let requiredRole = null;
      if (reqPath === '/api/setup/admin/upload-image') {
        requiredRole = 'admin';
      }

      if (requiredRole === 'admin') {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication required' }));
          return;
        }
        try {
          const token = authHeader.replace('Bearer ', '');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (!decoded.role || decoded.role !== 'admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
          }
        } catch {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid token' }));
          return;
        }
      } else {
        const user = await verifyTokenFromNodeReq(req);
        if (!user) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Authentication required' }));
          return;
        }
      }

      try {
        const bb = new Busboy({ headers: { 'content-type': contentType }, limits: { fileSize: 5 * 1024 * 1024 } });
        const files = [];
        let aborted = false;
        let errorSent = false;

        bb.on('file', (fieldname, fileStream, info) => {
          const { mimeType } = info;
          if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'].includes(mimeType)) {
            aborted = true;
            fileStream.resume();
            if (!errorSent) {
              errorSent = true;
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid file type' }));
            }
            return;
          }
          const chunks = [];
          fileStream.on('data', (chunk) => chunks.push(chunk));
          fileStream.on('end', async () => {
            if (aborted) return;
            const buffer = Buffer.concat(chunks);
            try {
              const blob = await put(info.filename, buffer, { access: 'public', contentType: mimeType });
              files.push(blob.url);
              await sql`INSERT INTO media_files (url, filename) VALUES (${blob.url}, ${info.filename})`;
            } catch (blobError) {
              console.error('Vercel Blob failed:', blobError.message);
              Sentry.captureException(blobError);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Upload to storage failed' }));
                aborted = true;
              }
            }
          });
        });

        bb.on('finish', () => {
          if (aborted || errorSent) return;
          if (files.length === 0) {
            if (!res.headersSent) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No file uploaded' }));
            }
            return;
          }
          if (!res.headersSent) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ url: files[0] }));
          }
        });

        bb.on('error', (err) => {
          console.error('Busboy error:', err);
          Sentry.captureException(err);
          if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        req.pipe(bb);
        return;
      } catch (err) {
        Sentry.captureException(err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
        return;
      }
    }

    // ---------- Normal Fetch API conversion ----------
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
        else headers.set(key, value);
      }
    }

    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        body = await new Promise((resolve, reject) => {
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', (err) => { Sentry.captureException(err); resolve(null); });
          setTimeout(() => resolve(null), 10000);
        });
      } catch (e) { Sentry.captureException(e); }
    }

    const request = new Request(fullUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });

    try {
      const response = await handlerFn(request);
      const responseHeaders = {
        'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      };
      response.headers.forEach((value, key) => { responseHeaders[key] = value; });
      res.writeHead(response.status, responseHeaders);
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(value);
          await pump();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err) {
      Sentry.captureException(err);
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0]
      });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}

// ===================================================
// SECTION 3: Main API Handler
// ===================================================
async function apiHandler(req) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  if (!(await rateLimiter(ip, 100, 60000))) {
    return json({ error: 'Too many requests' }, 429);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const host = req.headers.get('host') || 'localhost';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const forwardedPath = req.headers.get('x-forwarded-path');
  let path;
  if (forwardedPath) {
    const originalUrl = new URL(forwardedPath, `http://${host}`);
    path = originalUrl.pathname;
  } else {
    const fullUrl = req.url.startsWith('http') ? req.url : `${protocol}://${host}${req.url}`;
    const url = new URL(fullUrl);
    path = url.pathname;
  }

  // Normalize path
  if (path.startsWith('/api/setup')) {
    path = path.replace('/api/setup', '');
  } else if (path.startsWith('/api/')) {
    path = path.replace('/api', '');
  }

  try {
    const getQueryParam = (paramName) => {
      const url = new URL(req.url, `${protocol}://${host}`);
      return url.searchParams.get(paramName);
    };

    // ==================== DB Init & Seed ====================
    if (path === '/init-db' && req.method === 'POST') {
      if (process.env.ALLOW_INIT_DB !== 'true') {
        return errorJson('Init DB is disabled in production', 403);
      }
      const bodyText = await req.text();
      let body;
      try { body = JSON.parse(bodyText); } catch { return errorJson('Invalid JSON', 400); }
      const { admin_secret } = body;
      if (admin_secret !== ADMIN_SECRET) return errorJson('Forbidden', 403);

      const [{ exists }] = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')`;
      if (exists) {
        return errorJson('Database already initialized. To re-init, drop all tables first.', 400);
      }

      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

      // ==================== TABLE CREATIONS ====================
      // (All existing tables from original, plus new training tables)
      await sql`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        identity_level VARCHAR(50) DEFAULT 'Beginner',
        xp INT DEFAULT 0,
        level INT DEFAULT 1,
        avatar_emoji VARCHAR(10) DEFAULT '🙂',
        email_verified BOOLEAN DEFAULT false,
        verification_token UUID,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS daily_journals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        mindfulness_done BOOLEAN DEFAULT false,
        commitment TEXT,
        trades_count INT,
        stop_loss_moved BOOLEAN,
        plan_deviation BOOLEAN,
        revenge_trade BOOLEAN,
        fomo_entry BOOLEAN,
        overtrading BOOLEAN,
        rule_followed BOOLEAN,
        scores JSONB,
        radar_scores JSONB,
        evaluation_notes TEXT,
        reflection TEXT,
        feedback TEXT,
        tomorrow_mission TEXT,
        UNIQUE(user_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS badges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        badge_type VARCHAR(100) NOT NULL,
        awarded_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, badge_type)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        day INT NOT NULL,
        phase VARCHAR(50),
        title VARCHAR(255),
        content TEXT
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_lessons (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INT REFERENCES lessons(id) ON DELETE CASCADE,
        completed_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, lesson_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS community_posts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        post_type VARCHAR(50) CHECK (post_type IN ('lesson','mistake','rule','general')),
        likes INT DEFAULT 0,
        reactions JSONB DEFAULT '{}',
        is_hidden BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS replies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS quizzes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct INT NOT NULL,
        active BOOLEAN DEFAULT true
      )`;

      await sql`CREATE TABLE IF NOT EXISTS quiz_attempts (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        correct BOOLEAN,
        PRIMARY KEY (user_id, quiz_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS notif_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_enabled BOOLEAN DEFAULT true,
        push_enabled BOOLEAN DEFAULT true,
        push_subscription JSONB
      )`;

      await sql`CREATE TABLE IF NOT EXISTS video_library (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100),
        title VARCHAR(255),
        description TEXT,
        youtube_id VARCHAR(50),
        duration VARCHAR(20)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS certificates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        verification_code UUID UNIQUE,
        issued_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS weekly_challenges (
        id SERIAL PRIMARY KEY,
        week_start DATE,
        title VARCHAR(255),
        description TEXT,
        target INT,
        reward_xp INT
      )`;

      await sql`CREATE TABLE IF NOT EXISTS daily_rewards (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        PRIMARY KEY(user_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS mystery_boxes (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        opened BOOLEAN DEFAULT false,
        reward TEXT,
        PRIMARY KEY(user_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS habit_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        icon VARCHAR(10) DEFAULT '✅',
        color VARCHAR(7) DEFAULT '#d4af37',
        reminder_times JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS habit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        habit_id UUID REFERENCES habit_definitions(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        completed_times JSONB DEFAULT '{}',
        note TEXT,
        UNIQUE(user_id, habit_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS mood_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        mood VARCHAR(20) CHECK (mood IN ('happy','neutral','stressed','angry')),
        UNIQUE(user_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS streak_freeze_items (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        quantity INT DEFAULT 0,
        PRIMARY KEY (user_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS portfolio_performance (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        discipline_score INT,
        virtual_balance DECIMAL DEFAULT 10000,
        PRIMARY KEY(user_id, date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS daily_quests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
        quest_type VARCHAR(50),
        completed BOOLEAN DEFAULT false,
        claimed BOOLEAN DEFAULT false,
        UNIQUE(user_id, quest_date)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) DEFAULT 'Admin',
        role VARCHAR(50) DEFAULT 'super_admin',
        password_change_required BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // ===== NEW TRAINING TABLES =====
      await sql`CREATE TABLE IF NOT EXISTS training_subjects (
        id SERIAL PRIMARY KEY,
        icon VARCHAR(10) DEFAULT '📁',
        names JSONB NOT NULL, -- {en, hi, bn}
        order_index INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS training_lessons (
        id SERIAL PRIMARY KEY,
        subject_id INT REFERENCES training_subjects(id) ON DELETE CASCADE,
        titles JSONB NOT NULL, -- {en, hi, bn}
        contents JSONB,        -- {en, hi, bn} HTML content
        duration INT DEFAULT 15,
        level VARCHAR(20) DEFAULT 'Beginner',
        quiz_pass_score INT DEFAULT 80,
        order_index INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS training_quiz_questions (
        id SERIAL PRIMARY KEY,
        lesson_id INT REFERENCES training_lessons(id) ON DELETE CASCADE,
        question JSONB NOT NULL,      -- {en, hi, bn}
        options JSONB NOT NULL,       -- array of {id: 'a', text: {en, hi, bn}}
        correct CHAR(1) NOT NULL,     -- 'a','b','c','d'
        points INT DEFAULT 5,
        explanation JSONB,            -- {en, hi, bn}
        order_index INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS training_user_progress (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INT REFERENCES training_lessons(id) ON DELETE CASCADE,
        progress INT DEFAULT 0,       -- 0-100
        quiz_score INT DEFAULT 0,
        quiz_passed BOOLEAN DEFAULT false,
        completed_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, lesson_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS training_bookmarks (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INT REFERENCES training_lessons(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, lesson_id)
      )`;

      // ===== Existing tables continued =====
      await sql`CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // We keep chapters table but we no longer use it; we'll keep for backward compatibility but not use.
      // However, we can keep them empty.
      await sql`CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        order_index INT NOT NULL,
        content_text TEXT,
        image_url TEXT,
        video_url TEXT,
        images JSONB DEFAULT '[]',
        videos JSONB DEFAULT '[]',
        language VARCHAR(10) DEFAULT 'bn',
        passing_score INT DEFAULT 90,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(course_id, order_index, language)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS chapter_quiz_questions (
        id SERIAL PRIMARY KEY,
        chapter_id INT REFERENCES chapters(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_index INT NOT NULL,
        explanation TEXT,
        language VARCHAR(10) DEFAULT 'bn',
        order_index INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_chapter_progress (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        chapter_id INT REFERENCES chapters(id) ON DELETE CASCADE,
        quiz_attempts INT DEFAULT 0,
        best_score DECIMAL(5,2) DEFAULT 0,
        passed BOOLEAN DEFAULT false,
        completed_at TIMESTAMPTZ,
        last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, chapter_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS final_exam_results (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        score DECIMAL(5,2),
        passed BOOLEAN DEFAULT false,
        total_questions INT,
        correct_answers INT,
        attempted_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_energy (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
        current_energy INT DEFAULT 100,
        max_energy INT DEFAULT 100,
        last_reset_date DATE DEFAULT CURRENT_DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS trading_simulator (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scenario JSONB NOT NULL,
        user_decision JSONB,
        result JSONB,
        xp_earned INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS mentor_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mentor_id UUID REFERENCES users(id) ON DELETE CASCADE,
        student_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'active'
      )`;

      await sql`CREATE TABLE IF NOT EXISTS content_translations (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL,
        record_id INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        translated_text TEXT,
        UNIQUE(table_name, record_id, language_code, field_name)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS assessment_questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        category VARCHAR(50),
        order_index INT DEFAULT 0
      )`;
      await sql`CREATE TABLE IF NOT EXISTS user_assessments (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        question_id INT REFERENCES assessment_questions(id) ON DELETE CASCADE,
        answer BOOLEAN,
        answered_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, question_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS benefits (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(10)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS admin_activity_log (
        id SERIAL PRIMARY KEY,
        admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_activity_log (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(100) NOT NULL,
        details JSONB,
        ip_address VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS exam_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMPTZ DEFAULT NOW(),
        expiry TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'active'
      )`;

      await sql`CREATE TABLE IF NOT EXISTS ui_translations (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) NOT NULL,
        lang VARCHAR(10) NOT NULL,
        value TEXT NOT NULL,
        UNIQUE(key, lang)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS token_blacklist (
        token TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )`;

      await sql`CREATE TABLE IF NOT EXISTS site_settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      )`;

      await sql`CREATE TABLE IF NOT EXISTS media_files (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        filename TEXT,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS user_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        reminder_enabled BOOLEAN DEFAULT false,
        reminder_times JSONB DEFAULT '["08:00"]',
        email_reminder BOOLEAN DEFAULT false,
        push_reminder BOOLEAN DEFAULT true,
        whatsapp_reminder BOOLEAN DEFAULT false,
        whatsapp_number VARCHAR(20),
        language VARCHAR(10) DEFAULT 'en'
      )`;

      await sql`CREATE TABLE IF NOT EXISTS slideshow_images (
        id SERIAL PRIMARY KEY,
        image_url_desktop TEXT NOT NULL,
        image_url_mobile TEXT NOT NULL,
        title VARCHAR(255),
        link_url TEXT,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // ===== INDEXES =====
      await sql`CREATE INDEX IF NOT EXISTS idx_daily_journals_user_date ON daily_journals(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_user ON user_chapter_progress(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_habits_logs_user_date ON habit_logs(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_portfolio_user_date ON portfolio_performance(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON daily_quests(user_id, quest_date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_training_lessons_subject ON training_lessons(subject_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_training_quiz_questions_lesson ON training_quiz_questions(lesson_id)`;

      // ----- Seed default translations -----
      await seedDefaultTranslations();

      // ----- Seed default admin -----
      const [adminExists] = await sql`SELECT id FROM admin_users WHERE email = 'admin@alamquant.com'`;
      if (!adminExists) {
        const tempPassword = uuidv4().slice(0, 12);
        const adminHash = await bcrypt.hash(tempPassword, 12);
        await sql`INSERT INTO admin_users (email, password_hash, name, role, password_change_required) VALUES ('admin@alamquant.com', ${adminHash}, 'Super Admin', 'super_admin', true)`;
        console.log('---------------------------------------------------');
        console.log('🔐 Initial admin credentials:');
        console.log(`   Email: admin@alamquant.com`);
        console.log(`   Temporary password: ${tempPassword}`);
        console.log('   Please change immediately after first login!');
        console.log('---------------------------------------------------');
      }

      // ----- Seed demo training subjects and lessons -----
      const [subjectExists] = await sql`SELECT id FROM training_subjects LIMIT 1`;
      if (!subjectExists) {
        // Insert sample subject
        const [subj] = await sql`
          INSERT INTO training_subjects (icon, names, order_index)
          VALUES ('📊', '{"en":"Trading Basics","hi":"ट्रेडिंग बेसिक्स","bn":"ট্রেডিং বেসিকস"}', 1)
          RETURNING id
        `;
        // Insert sample lesson
        const [lesson] = await sql`
          INSERT INTO training_lessons (subject_id, titles, contents, duration, level, quiz_pass_score, order_index)
          VALUES (${subj.id}, '{"en":"Market Structure","hi":"मार्केट स्ट्रक्चर","bn":"মার্কেট স্ট্রাকচার"}',
                  '{"en":"<p>Understanding <strong>market structure</strong> is the cornerstone of trading. Learn about trends, ranges, support & resistance levels, and market phases.</p>","hi":"<p>बाजार संरचना को समझना ट्रेडिंग की नींव है।</p>","bn":"<p>মার্কেট স্ট্রাকচার বোঝা ট্রেডিংয়ের ভিত্তি।</p>"}',
                  15, 'Beginner', 10, 1)
          RETURNING id
        `;
        // Insert quiz questions
        await sql`
          INSERT INTO training_quiz_questions (lesson_id, question, options, correct, points, explanation, order_index)
          VALUES (${lesson.id},
                  '{"en":"What does \\"market structure\\" primarily refer to?","hi":"\\"मार्केट स्ट्रक्चर\\" मुख्य रूप से किसे संदर्भित करता है?","bn":"\\"মার্কেট স্ট্রাকচার\\" মূলত কী বোঝায়?"}',
                  '[{"id":"a","text":{"en":"The framework of trends, ranges, support & resistance","hi":"ट्रेंड, रेंज, सपोर्ट और रेसिस्टेंस का ढांचा","bn":"ট্রেন্ড, রেঞ্জ, সাপোর্ট ও রেসিস্ট্যান্সের কাঠামো"}},{"id":"b","text":{"en":"Only candlestick colors","hi":"केवल कैंडलस्टिक रंग","bn":"শুধুমাত্র ক্যান্ডেলস্টিকের রং"}},{"id":"c","text":{"en":"The company balance sheet","hi":"कंपनी की बैलेंस शीट","bn":"কোম্পানির ব্যালেন্স শীট"}},{"id":"d","text":{"en":"Daily economic news only","hi":"केवल दैनिक आर्थिक समाचार","bn":"শুধুমাত্র দৈনিক অর্থনৈতিক খবর"}}]',
                  'a', 5,
                  '{"en":"Market structure is the framework of price action.","hi":"मार्केट स्ट्रक्चर प्राइस एक्शन का ढांचा है।","bn":"মার্কেট স্ট্রাকচার হলো প্রাইস অ্যাকশনের কাঠামো।"}',
                  1)
        `;
      }

      const { count: aqCount } = (await sql`SELECT COUNT(*)::int FROM assessment_questions`)[0];
      if (aqCount === 0) {
        await sql`INSERT INTO assessment_questions (question, category, order_index) VALUES 
          ('Have you incurred continuous losses in the last 6 months?', 'loss', 1),
          ('Do you feel urge to trade again quickly after a loss?', 'emotion', 2),
          ('Do you have a written trading plan?', 'planning', 3),
          ('Do you often move your stop loss?', 'risk', 4),
          ('Do you lose emotional control during a trade?', 'psychology', 5),
          ('Do you take more than 3 trades a day?', 'overtrading', 6),
          ('Do you increase lot size to recover losses?', 'revenge', 7),
          ('Do you trade based on social media tips?', 'fomo', 8),
          ('Do you have defined risk management rules?', 'discipline', 9),
          ('Do you write a daily trading journal?', 'journaling', 10)`;
      }

      const { count: bCount } = (await sql`SELECT COUNT(*)::int FROM benefits`)[0];
      if (bCount === 0) {
        await sql`INSERT INTO benefits (title, description, icon) VALUES 
          ('Builds discipline', 'Daily journaling forces rule-based trading', '📋'),
          ('Emotional control', 'Learn to decide calmly without fear, greed, or FOMO', '🧘'),
          ('Professional mindset', 'See trading as a business', '💼'),
          ('Risk management', 'Learn to protect capital for the long term', '🛡️'),
          ('Community support', 'Exchange experiences with successful traders', '🤝')`;
      }

      return json({ message: 'Database initialized successfully. Indexes and seed data created. Please note the temporary admin password shown in server logs.' });
    }

    // ==================== PUBLIC ROUTES (no auth required) ====================
    if (path === '/auto-login' && req.method === 'GET') {
      const tokenParam = getQueryParam('token');
      if (!tokenParam) return errorJson('No token', 400);
      let payload;
      try { payload = jwt.verify(tokenParam, process.env.JWT_SECRET); } catch { return errorJson('Invalid token', 401); }
      let user = (await sql`SELECT * FROM users WHERE email = ${payload.email}`)[0];
      if (!user) user = (await sql`INSERT INTO users (email, password_hash) VALUES (${payload.email}, '') RETURNING *`)[0];
      const newToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'auto_login', ${JSON.stringify({email: payload.email})}, ${ip})`;
      return json({ token: newToken, user: sanitizeUser(user) });
    }

    if (path === '/auth/google' && req.method === 'POST') {
      if (!GOOGLE_CLIENT_ID) return errorJson('Google auth not configured', 501);
      const body = await req.json();
      const { credential } = body;
      try {
        const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();
        const email = payload.email;
        const displayName = payload.name || email.split('@')[0];
        let user = (await sql`SELECT * FROM users WHERE email = ${email}`)[0];
        if (!user) {
          const [newUser] = await sql`INSERT INTO users (email, password_hash, display_name, avatar_emoji) VALUES (${email}, '', ${displayName}, '🙂') RETURNING *`;
          user = newUser;
        } else if (!user.display_name) {
          await sql`UPDATE users SET display_name = ${displayName} WHERE id = ${user.id}`;
          user.display_name = displayName;
        }
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'google_login', ${JSON.stringify({email})}, ${ip})`;
        return json({ token, user: sanitizeUser(user) });
      } catch (e) {
        Sentry.captureException(e);
        return errorJson('Invalid Google token', 401);
      }
    }

    if (path === '/admin/login' && req.method === 'POST') {
      const body = await req.json();
      const { email, password } = body;
      const [adminUser] = await sql`SELECT * FROM admin_users WHERE email = ${email}`;
      if (!adminUser || !(await bcrypt.compare(password, adminUser.password_hash))) {
        return errorJson('Invalid credentials', 401);
      }
      const adminToken = jwt.sign({ id: adminUser.id, role: 'admin', admin_level: adminUser.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
      return json({
        token: adminToken,
        name: adminUser.name,
        role: adminUser.role,
        require_password_change: adminUser.password_change_required || false
      });
    }

    if (path === '/register' && req.method === 'POST') {
      try {
        const body = await req.json();
        const parsed = registerSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.issues }, 400);
        const { email, password, display_name, avatar_emoji, language } = parsed.data;
        const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existing) return errorJson('Email already registered', 409);
        const hash = await bcrypt.hash(password, 12);
        const verificationToken = uuidv4();
        const name = display_name || email.split('@')[0];
        const [user] = await sql`
          INSERT INTO users (email, password_hash, display_name, avatar_emoji, verification_token, email_verified)
          VALUES (${email}, ${hash}, ${name}, ${avatar_emoji || '🙂'}, ${verificationToken}, false)
          RETURNING *
        `;
        await sql`INSERT INTO user_settings (user_id, language) VALUES (${user.id}, ${language || 'en'}) ON CONFLICT (user_id) DO NOTHING`;
        if (resend) {
          const verifyLink = `${protocol}://${host}/verify-email?token=${verificationToken}`;
          try {
            await resend.emails.send({
              from: 'AlamQuant ATTS <noreply@alamquant.com>',
              to: email,
              subject: 'Verify your email',
              html: `<p>Click to verify:</p><a href="${verifyLink}">${verifyLink}</a>`
            });
          } catch (e) {
            Sentry.captureException(e);
          }
        }
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'register', ${JSON.stringify({email})}, ${ip})`;
        return json({ token, user: sanitizeUser(user), message: 'Registration successful. Please verify your email.' });
      } catch (err) {
        console.error('REGISTRATION ERROR:', err);
        Sentry.captureException(err);
        return errorJson('Internal server error during registration', 500);
      }
    }

    if (path === '/verify-email' && req.method === 'GET') {
      const token = getQueryParam('token');
      if (!token) return errorJson('No token provided', 400);
      const [user] = await sql`SELECT * FROM users WHERE verification_token = ${token}`;
      if (!user) return errorJson('Invalid or expired token', 400);
      await sql`UPDATE users SET email_verified = true, verification_token = NULL WHERE id = ${user.id}`;
      return new Response(null, { status: 302, headers: { Location: '/?verified=true' } });
    }

    if (path === '/verify-email' && req.method === 'POST') {
      const body = await req.json();
      const { token: verifyToken } = body;
      const [user] = await sql`SELECT * FROM users WHERE verification_token = ${verifyToken}`;
      if (!user) return errorJson('Invalid or expired token', 400);
      await sql`UPDATE users SET email_verified = true, verification_token = NULL WHERE id = ${user.id}`;
      return json({ message: 'Email verified successfully' });
    }

    if (path === '/login' && req.method === 'POST') {
      try {
        const body = await req.json();
        const parsed = loginSchema.safeParse(body);
        if (!parsed.success) return json({ error: parsed.error.issues }, 400);
        const { email, password, display_name, language } = parsed.data;
        const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
        if (!user || !(await bcrypt.compare(password, user.password_hash))) return errorJson('Invalid credentials', 401);
        if (!user.email_verified) return errorJson('Please verify your email first', 403);
        if (display_name && !user.display_name) {
          await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
          user.display_name = display_name;
        }
        if (language) {
          await sql`INSERT INTO user_settings (user_id, language) VALUES (${user.id}, ${language}) ON CONFLICT (user_id) DO UPDATE SET language = ${language}`;
        }
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'login', ${JSON.stringify({email})}, ${ip})`;
        return json({ token, user: sanitizeUser(user) });
      } catch (err) {
        console.error('LOGIN ERROR:', err);
        Sentry.captureException(err);
        return errorJson('Internal server error during login', 500);
      }
    }

    if (path === '/request-password-reset' && req.method === 'POST') {
      const body = await req.json();
      const { email } = body;
      const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (!user) return json({ message: 'If the email exists, a reset link has been sent.' });
      const resetToken = uuidv4();
      await sql`UPDATE users SET verification_token = ${resetToken} WHERE id = ${user.id}`;
      if (resend) {
        const resetLink = `${protocol}://${host}/reset-password?token=${resetToken}`;
        try {
          await resend.emails.send({
            from: 'AlamQuant ATTS <noreply@alamquant.com>',
            to: email,
            subject: 'Password Reset',
            html: `<p>Click to reset password:</p><a href="${resetLink}">${resetLink}</a>`
          });
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'password_reset_request', ${JSON.stringify({email})}, ${ip})`;
      return json({ message: 'If the email exists, a reset link has been sent.' });
    }

    if (path === '/reset-password' && req.method === 'GET') {
      const token = getQueryParam('token');
      if (!token) return errorJson('No token provided', 400);
      return new Response(null, { status: 302, headers: { Location: `/reset-password.html?token=${token}` } });
    }

    if (path === '/reset-password' && req.method === 'POST') {
      const body = await req.json();
      const { token: resetToken, new_password } = body;
      if (!new_password || new_password.length < 6) return errorJson('Password must be at least 6 characters', 400);
      const [user] = await sql`SELECT * FROM users WHERE verification_token = ${resetToken}`;
      if (!user) return errorJson('Invalid or expired token', 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE users SET password_hash = ${hash}, verification_token = NULL WHERE id = ${user.id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'password_reset', ${JSON.stringify({})}, ${ip})`;
      return json({ message: 'Password has been reset successfully' });
    }

    if (path === '/assessment/questions' && req.method === 'GET') {
      const questions = await sql`SELECT * FROM assessment_questions ORDER BY order_index`;
      return json(questions);
    }

    if (path === '/benefits' && req.method === 'GET') {
      const benefits = await sql`SELECT * FROM benefits ORDER BY id`;
      return json(benefits);
    }

    if (path === '/translations' && req.method === 'GET') {
      try {
        const lang = getQueryParam('lang') || 'en';
        const rows = await sql`SELECT key, value FROM ui_translations WHERE lang = ${lang}`;
        const result = {};
        rows.forEach(r => result[r.key] = r.value);
        return json(result);
      } catch (err) {
        console.error('TRANSLATIONS ERROR:', err);
        return errorJson('Internal server error in translations', 500);
      }
    }

    if (path.startsWith('/verify/') && req.method === 'GET') {
      const code = path.split('/').pop();
      const [cert] = await sql`SELECT c.*, u.email, u.display_name FROM certificates c JOIN users u ON c.user_id = u.id WHERE verification_code = ${code}`;
      if (!cert) return json({ valid: false, message: 'Certificate not found' });
      return json({
        valid: true,
        user: maskEmail(cert.email),
        display_name: cert.display_name,
        issued_at: cert.issued_at,
        verification_code: code
      });
    }

    if (path === '/version' && req.method === 'GET') {
      return json({ version: '2.0.1' });
    }

    if (path === '/slideshow' && req.method === 'GET') {
      try {
        const slides = await sql`SELECT * FROM slideshow_images WHERE is_active = true ORDER BY sort_order, id`;
        return json(slides);
      } catch (e) {
        console.error('Slideshow error:', e);
        return json([], 200);
      }
    }

    if (path === '/update-subscription' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { oldSubscription, newSubscription } = body;
        if (newSubscription && oldSubscription?.endpoint) {
          const [user] = await sql`
            SELECT user_id FROM notif_settings
            WHERE push_subscription->>'endpoint' = ${oldSubscription.endpoint}
          `;
          if (user) {
            await sql`
              UPDATE notif_settings
              SET push_subscription = ${newSubscription}
              WHERE user_id = ${user.user_id}
            `;
          }
        }
        return json({ success: true });
      } catch (e) {
        console.error('Subscription update error:', e);
        Sentry.captureException(e);
        return errorJson('Failed to update subscription', 500);
      }
    }

    // ==================== ADMIN ENDPOINTS ====================

    // --- Admin Dashboard ---
    if (path === '/admin/dashboard' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const [{ count: totalUsers }] = await sql`SELECT COUNT(*)::int FROM users`;
      const [{ count: dailyActiveUsers }] = await sql`SELECT COUNT(*)::int FROM daily_journals WHERE date = CURRENT_DATE`;
      const [{ count: totalJournals }] = await sql`SELECT COUNT(*)::int FROM daily_journals`;
      const [{ count: completedTrainings }] = await sql`SELECT COUNT(*)::int FROM final_exam_results WHERE passed = true`;
      const [{ count: totalChapters }] = await sql`SELECT COUNT(*)::int FROM chapters WHERE is_active = true`;
      const [{ count: totalQuestions }] = await sql`SELECT COUNT(*)::int FROM chapter_quiz_questions`;
      const completionRate = totalUsers > 0 ? Math.round((completedTrainings / totalUsers) * 100) : 0;
      return json({ totalUsers, dailyActiveUsers, totalJournals, completedTrainings, completionRate, totalChapters, totalQuestions });
    }

    // --- Admin Users ---
    if (path === '/admin/users' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const search = getQueryParam('search') || '';
      let users;
      if (search) {
        users = await sql`SELECT id, email, display_name, xp, level FROM users WHERE email ILIKE ${'%'+search+'%'} OR display_name ILIKE ${'%'+search+'%'} ORDER BY created_at DESC LIMIT 100`;
      } else {
        users = await sql`SELECT id, email, display_name, xp, level FROM users ORDER BY created_at DESC LIMIT 100`;
      }
      return json({ users });
    }

    if (path === '/admin/reset-password' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { user_id, new_password } = await req.json();
      if (!new_password || new_password.length < 6) return errorJson('Password must be at least 6 chars', 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user_id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'reset_user_password', ${JSON.stringify({user_id})})`;
      return json({ success: true });
    }

    if (path === '/admin/impersonate' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { user_id } = await req.json();
      const [user] = await sql`SELECT id FROM users WHERE id = ${user_id}`;
      if (!user) return errorJson('User not found', 404);
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'impersonate', ${JSON.stringify({user_id})})`;
      return json({ token });
    }

    if (path.match(/^\/admin\/user\/(.+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const userId = path.split('/')[3];
      try {
        await sql`DELETE FROM daily_journals WHERE user_id = ${userId}`;
        await sql`DELETE FROM badges WHERE user_id = ${userId}`;
        await sql`DELETE FROM user_lessons WHERE user_id = ${userId}`;
        await sql`DELETE FROM community_posts WHERE user_id = ${userId}`;
        await sql`DELETE FROM replies WHERE user_id = ${userId}`;
        await sql`DELETE FROM quiz_attempts WHERE user_id = ${userId}`;
        await sql`DELETE FROM notif_settings WHERE user_id = ${userId}`;
        await sql`DELETE FROM daily_quests WHERE user_id = ${userId}`;
        await sql`DELETE FROM habit_definitions WHERE user_id = ${userId}`;
        await sql`DELETE FROM habit_logs WHERE user_id = ${userId}`;
        await sql`DELETE FROM mood_logs WHERE user_id = ${userId}`;
        await sql`DELETE FROM portfolio_performance WHERE user_id = ${userId}`;
        await sql`DELETE FROM user_chapter_progress WHERE user_id = ${userId}`;
        await sql`DELETE FROM final_exam_results WHERE user_id = ${userId}`;
        await sql`DELETE FROM user_energy WHERE user_id = ${userId}`;
        await sql`DELETE FROM user_settings WHERE user_id = ${userId}`;
        await sql`DELETE FROM user_activity_log WHERE user_id = ${userId}`;
        await sql`DELETE FROM streak_freeze_items WHERE user_id = ${userId}`;
        await sql`DELETE FROM mystery_boxes WHERE user_id = ${userId}`;
        await sql`DELETE FROM daily_rewards WHERE user_id = ${userId}`;
        await sql`DELETE FROM certificates WHERE user_id = ${userId}`;
        await sql`DELETE FROM trading_simulator WHERE user_id = ${userId}`;
        await sql`DELETE FROM mentor_assignments WHERE mentor_id = ${userId} OR student_id = ${userId}`;
        await sql`DELETE FROM user_assessments WHERE user_id = ${userId}`;
        await sql`DELETE FROM exam_sessions WHERE user_id = ${userId}`;
        await sql`DELETE FROM training_user_progress WHERE user_id = ${userId}`;
        await sql`DELETE FROM training_bookmarks WHERE user_id = ${userId}`;
        await sql`DELETE FROM users WHERE id = ${userId}`;
        await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'delete_user', ${JSON.stringify({userId})})`;
        return json({ success: true });
      } catch (err) {
        Sentry.captureException(err);
        return errorJson('Failed to delete user', 500);
      }
    }

    // ===== NEW TRAINING ADMIN ENDPOINTS =====

    // --- Subjects CRUD ---
    if (path === '/admin/subjects' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const subjects = await sql`
        SELECT * FROM training_subjects
        WHERE is_active = true
        ORDER BY order_index, id
      `;
      // Also fetch lessons for each subject
      const result = [];
      for (const subj of subjects) {
        const lessons = await sql`
          SELECT * FROM training_lessons
          WHERE subject_id = ${subj.id} AND is_active = true
          ORDER BY order_index, id
        `;
        result.push({ ...subj, subSubjects: lessons });
      }
      return json(result);
    }

    if (path === '/admin/subject' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { icon, names, order_index } = body;
      if (!names || !names.en) return errorJson('English name required', 400);
      const [subj] = await sql`
        INSERT INTO training_subjects (icon, names, order_index)
        VALUES (${icon || '📁'}, ${JSON.stringify(names)}, ${order_index || 0})
        RETURNING *
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'create_subject', ${JSON.stringify({subject_id: subj.id})})`;
      return json(subj, 201);
    }

    if (path.match(/^\/admin\/subject\/(\d+)$/) && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const subjectId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { icon, names, order_index, is_active } = body;
      await sql`
        UPDATE training_subjects SET
          icon = COALESCE(${icon}, icon),
          names = COALESCE(${JSON.stringify(names)}, names),
          order_index = COALESCE(${order_index}, order_index),
          is_active = COALESCE(${is_active}, is_active)
        WHERE id = ${subjectId}
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'update_subject', ${JSON.stringify({subjectId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/subject\/(\d+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const subjectId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM training_subjects WHERE id = ${subjectId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'delete_subject', ${JSON.stringify({subjectId})})`;
      return json({ success: true });
    }

    // --- Lessons CRUD ---
    if (path === '/admin/lessons' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const subjectId = getQueryParam('subjectId');
      if (!subjectId) return errorJson('subjectId required', 400);
      const lessons = await sql`
        SELECT * FROM training_lessons
        WHERE subject_id = ${subjectId} AND is_active = true
        ORDER BY order_index, id
      `;
      return json(lessons);
    }

    if (path === '/admin/lesson' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { subject_id, titles, contents, duration, level, quiz_pass_score, order_index } = body;
      if (!subject_id || !titles || !titles.en) return errorJson('subject_id and English title required', 400);
      const [lesson] = await sql`
        INSERT INTO training_lessons (subject_id, titles, contents, duration, level, quiz_pass_score, order_index)
        VALUES (${subject_id}, ${JSON.stringify(titles)}, ${JSON.stringify(contents || {})}, ${duration || 15}, ${level || 'Beginner'}, ${quiz_pass_score || 80}, ${order_index || 0})
        RETURNING *
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'create_lesson', ${JSON.stringify({lesson_id: lesson.id})})`;
      return json(lesson, 201);
    }

    if (path.match(/^\/admin\/lesson\/(\d+)$/) && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const lessonId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { subject_id, titles, contents, duration, level, quiz_pass_score, order_index, is_active } = body;
      await sql`
        UPDATE training_lessons SET
          subject_id = COALESCE(${subject_id}, subject_id),
          titles = COALESCE(${JSON.stringify(titles)}, titles),
          contents = COALESCE(${JSON.stringify(contents)}, contents),
          duration = COALESCE(${duration}, duration),
          level = COALESCE(${level}, level),
          quiz_pass_score = COALESCE(${quiz_pass_score}, quiz_pass_score),
          order_index = COALESCE(${order_index}, order_index),
          is_active = COALESCE(${is_active}, is_active)
        WHERE id = ${lessonId}
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'update_lesson', ${JSON.stringify({lessonId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/lesson\/(\d+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const lessonId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM training_lessons WHERE id = ${lessonId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'delete_lesson', ${JSON.stringify({lessonId})})`;
      return json({ success: true });
    }

    // --- Quiz Questions CRUD ---
    if (path === '/admin/quiz' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const lessonId = getQueryParam('lessonId');
      if (!lessonId) return errorJson('lessonId required', 400);
      const questions = await sql`
        SELECT * FROM training_quiz_questions
        WHERE lesson_id = ${lessonId}
        ORDER BY order_index, id
      `;
      return json(questions);
    }

    if (path === '/admin/quiz' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { lesson_id, question, options, correct, points, explanation, order_index } = body;
      if (!lesson_id || !question || !question.en) return errorJson('lesson_id and English question required', 400);
      if (!options || !Array.isArray(options) || options.length < 2) return errorJson('At least 2 options required', 400);
      if (!correct || !['a','b','c','d'].includes(correct)) return errorJson('correct must be a,b,c,d', 400);
      const [q] = await sql`
        INSERT INTO training_quiz_questions (lesson_id, question, options, correct, points, explanation, order_index)
        VALUES (${lesson_id}, ${JSON.stringify(question)}, ${JSON.stringify(options)}, ${correct}, ${points || 5}, ${JSON.stringify(explanation || {})}, ${order_index || 0})
        RETURNING *
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'create_quiz_question', ${JSON.stringify({question_id: q.id})})`;
      return json(q, 201);
    }

    if (path.match(/^\/admin\/quiz\/(\d+)$/) && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const questionId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { question, options, correct, points, explanation, order_index } = body;
      await sql`
        UPDATE training_quiz_questions SET
          question = COALESCE(${JSON.stringify(question)}, question),
          options = COALESCE(${JSON.stringify(options)}, options),
          correct = COALESCE(${correct}, correct),
          points = COALESCE(${points}, points),
          explanation = COALESCE(${JSON.stringify(explanation)}, explanation),
          order_index = COALESCE(${order_index}, order_index)
        WHERE id = ${questionId}
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'update_quiz_question', ${JSON.stringify({questionId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/quiz\/(\d+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const questionId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM training_quiz_questions WHERE id = ${questionId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'delete_quiz_question', ${JSON.stringify({questionId})})`;
      return json({ success: true });
    }

    // ===== USER TRAINING ENDPOINTS =====

    // GET /training/subjects - for logged-in users
    if (path === '/training/subjects' && req.method === 'GET') {
      const user = await authenticate(req);
      if (!user) return errorJson('Authentication required', 401);
      const lang = getQueryParam('lang') || (await getUserLanguage(user.id)) || 'en';

      const subjects = await sql`
        SELECT * FROM training_subjects
        WHERE is_active = true
        ORDER BY order_index, id
      `;

      const result = [];
      for (const subj of subjects) {
        const lessons = await sql`
          SELECT id, titles, contents, duration, level, quiz_pass_score, order_index
          FROM training_lessons
          WHERE subject_id = ${subj.id} AND is_active = true
          ORDER BY order_index, id
        `;
        // Also get user progress for each lesson
        const lessonsWithProgress = [];
        for (const les of lessons) {
          const [progress] = await sql`
            SELECT progress, quiz_score, quiz_passed, completed_at
            FROM training_user_progress
            WHERE user_id = ${user.id} AND lesson_id = ${les.id}
          `;
          lessonsWithProgress.push({
            ...les,
            user_progress: progress || { progress: 0, quiz_score: 0, quiz_passed: false }
          });
        }
        result.push({ ...subj, subSubjects: lessonsWithProgress });
      }
      return json(result);
    }

    // GET /training/lesson/:lessonId - detailed lesson with quiz
    if (path.match(/^\/training\/lesson\/(\d+)$/) && req.method === 'GET') {
      const user = await authenticate(req);
      if (!user) return errorJson('Authentication required', 401);
      const lessonId = parseInt(path.split('/')[3]);
      const lang = getQueryParam('lang') || (await getUserLanguage(user.id)) || 'en';

      const [lesson] = await sql`
        SELECT id, subject_id, titles, contents, duration, level, quiz_pass_score
        FROM training_lessons
        WHERE id = ${lessonId} AND is_active = true
      `;
      if (!lesson) return errorJson('Lesson not found', 404);

      const questions = await sql`
        SELECT id, question, options, correct, points, explanation
        FROM training_quiz_questions
        WHERE lesson_id = ${lessonId}
        ORDER BY order_index, id
      `;

      const [progress] = await sql`
        SELECT progress, quiz_score, quiz_passed, completed_at
        FROM training_user_progress
        WHERE user_id = ${user.id} AND lesson_id = ${lessonId}
      `;

      return json({
        lesson,
        questions,
        user_progress: progress || { progress: 0, quiz_score: 0, quiz_passed: false }
      });
    }

    // POST /training/quiz/:lessonId - submit quiz
    if (path.match(/^\/training\/quiz\/(\d+)$/) && req.method === 'POST') {
      const user = await authenticate(req);
      if (!user) return errorJson('Authentication required', 401);
      const lessonId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { answers } = body; // array of {question_id, selected_option: 'a'|'b'|'c'|'d'}

      // Fetch all questions for this lesson
      const questions = await sql`
        SELECT id, correct, points
        FROM training_quiz_questions
        WHERE lesson_id = ${lessonId}
        ORDER BY order_index, id
      `;
      if (!questions.length) return errorJson('No questions for this lesson', 400);

      let earned = 0;
      let correctCount = 0;
      const details = [];
      for (const q of questions) {
        const userAns = answers.find(a => a.question_id === q.id);
        const isCorrect = userAns && userAns.selected_option === q.correct;
        if (isCorrect) {
          earned += (q.points || 5);
          correctCount++;
        }
        details.push({
          question_id: q.id,
          correct: q.correct,
          user_answer: userAns?.selected_option || null,
          is_correct: isCorrect
        });
      }

      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 5), 0);
      const passed = earned >= (lesson.quiz_pass_score || 80);

      // Update or insert progress
      await sql`
        INSERT INTO training_user_progress (user_id, lesson_id, progress, quiz_score, quiz_passed, completed_at)
        VALUES (${user.id}, ${lessonId}, 100, ${earned}, ${passed}, ${passed ? new Date().toISOString() : null})
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          progress = 100,
          quiz_score = ${earned},
          quiz_passed = ${passed},
          completed_at = CASE WHEN ${passed} THEN NOW() ELSE training_user_progress.completed_at END
      `;

      // Award XP if passed
      if (passed) {
        await sql`UPDATE users SET xp = xp + 20 WHERE id = ${user.id}`;
      }

      return json({
        score: earned,
        total: totalPoints,
        passed,
        correct: correctCount,
        total_questions: questions.length,
        details
      });
    }

    // POST /training/bookmark/:lessonId - toggle bookmark
    if (path.match(/^\/training\/bookmark\/(\d+)$/) && req.method === 'POST') {
      const user = await authenticate(req);
      if (!user) return errorJson('Authentication required', 401);
      const lessonId = parseInt(path.split('/')[3]);
      const [exists] = await sql`
        SELECT 1 FROM training_bookmarks WHERE user_id = ${user.id} AND lesson_id = ${lessonId}
      `;
      if (exists) {
        await sql`DELETE FROM training_bookmarks WHERE user_id = ${user.id} AND lesson_id = ${lessonId}`;
        return json({ bookmarked: false });
      } else {
        await sql`INSERT INTO training_bookmarks (user_id, lesson_id) VALUES (${user.id}, ${lessonId})`;
        return json({ bookmarked: true });
      }
    }

    // GET /training/bookmarks - list bookmarked lessons
    if (path === '/training/bookmarks' && req.method === 'GET') {
      const user = await authenticate(req);
      if (!user) return errorJson('Authentication required', 401);
      const bookmarks = await sql`
        SELECT lesson_id FROM training_bookmarks WHERE user_id = ${user.id}
      `;
      return json(bookmarks.map(b => b.lesson_id));
    }

    // ============================================================
    // CONTINUED: Existing admin endpoints (content, theme, media, etc.)
    // ============================================================

    // --- Content Manager (lessons, quizzes, videos) - legacy, keep ---
    if (path === '/admin/content/list' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const type = getQueryParam('type');
      if (type === 'lesson') {
        const lessons = await sql`SELECT * FROM lessons ORDER BY day`;
        return json(lessons);
      } else if (type === 'quiz') {
        const quizzes = await sql`SELECT * FROM quizzes WHERE active = true`;
        return json(quizzes);
      } else if (type === 'video') {
        const videos = await sql`SELECT * FROM video_library ORDER BY id`;
        return json(videos);
      } else {
        return errorJson('Invalid type', 400);
      }
    }

    if (path === '/admin/content' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { type, ...data } = body;
      if (type === 'lesson') {
        const { day, phase, title, content } = data;
        await sql`INSERT INTO lessons (day, phase, title, content) VALUES (${day}, ${phase}, ${title}, ${content})`;
      } else if (type === 'quiz') {
        const { question, options, correct } = data;
        await sql`INSERT INTO quizzes (question, options, correct) VALUES (${question}, ${JSON.stringify(options)}, ${correct})`;
      } else if (type === 'video') {
        const { category, title, description, youtube_id, duration } = data;
        await sql`INSERT INTO video_library (category, title, description, youtube_id, duration) VALUES (${category}, ${title}, ${description}, ${youtube_id}, ${duration})`;
      }
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'add_content', ${JSON.stringify({type})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/content\/(.+)\/(\d+)$/) && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const [, type, id] = path.split('/');
      const body = await req.json();
      if (type === 'lesson') {
        const { day, phase, title, content } = body;
        await sql`UPDATE lessons SET day = COALESCE(${day}, day), phase = COALESCE(${phase}, phase), title = COALESCE(${title}, title), content = COALESCE(${content}, content) WHERE id = ${parseInt(id)}`;
      } else if (type === 'quiz') {
        const { question, options, correct } = body;
        await sql`UPDATE quizzes SET question = COALESCE(${question}, question), options = COALESCE(${JSON.stringify(options)}, options), correct = COALESCE(${correct}, correct) WHERE id = ${parseInt(id)}`;
      } else if (type === 'video') {
        const { category, title, description, youtube_id, duration } = body;
        await sql`UPDATE video_library SET category = COALESCE(${category}, category), title = COALESCE(${title}, title), description = COALESCE(${description}, description), youtube_id = COALESCE(${youtube_id}, youtube_id), duration = COALESCE(${duration}, duration) WHERE id = ${parseInt(id)}`;
      }
      return json({ success: true });
    }

    if (path.match(/^\/admin\/content\/(.+)\/(\d+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const [, type, id] = path.split('/');
      if (type === 'lesson') {
        await sql`DELETE FROM lessons WHERE id = ${parseInt(id)}`;
      } else if (type === 'quiz') {
        await sql`DELETE FROM quizzes WHERE id = ${parseInt(id)}`;
      } else if (type === 'video') {
        await sql`DELETE FROM video_library WHERE id = ${parseInt(id)}`;
      }
      return json({ success: true });
    }

    // --- Media Library ---
    if (path === '/admin/media' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const media = await sql`SELECT * FROM media_files ORDER BY uploaded_at DESC LIMIT 100`;
      return json(media);
    }

    if (path === '/admin/media/url' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { url } = await req.json();
      await sql`INSERT INTO media_files (url) VALUES (${url})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/media\/(\d+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const mediaId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM media_files WHERE id = ${mediaId}`;
      return json({ success: true });
    }

    // --- Admin Image Upload (fallback via formData) ---
    if (path === '/admin/upload-image' && req.method === 'POST') {
      // handled by multipart wrapper above, but keep for fallback
      return errorJson('Use multipart form-data', 400);
    }

    // --- Translations (UI) ---
    if (path === '/admin/translations' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const lang = getQueryParam('lang') || 'en';
      const translations = await sql`SELECT * FROM ui_translations WHERE lang = ${lang}`;
      return json(translations);
    }

    if (path === '/admin/translations' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { key, lang, value } = await req.json();
      await sql`INSERT INTO ui_translations (key, lang, value) VALUES (${key}, ${lang}, ${value}) ON CONFLICT (key, lang) DO UPDATE SET value = ${value}`;
      return json({ success: true });
    }

    // --- Content Translations (legacy) ---
    if (path === '/admin/translations/content' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { table_name, record_id, language_code, translations } = await req.json();
      for (const [field_name, translated_text] of Object.entries(translations)) {
        await sql`
          INSERT INTO content_translations (table_name, record_id, language_code, field_name, translated_text)
          VALUES (${table_name}, ${record_id}, ${language_code}, ${field_name}, ${translated_text})
          ON CONFLICT (table_name, record_id, language_code, field_name) DO UPDATE SET translated_text = ${translated_text}
        `;
      }
      return json({ success: true });
    }

    if (path === '/admin/translations/content' && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { table_name, record_id, language_code } = await req.json();
      await sql`DELETE FROM content_translations WHERE table_name = ${table_name} AND record_id = ${record_id} AND language_code = ${language_code}`;
      return json({ success: true });
    }

    // --- Assessment Questions CRUD (Admin) ---
    if (path === '/admin/assessments' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const questions = await sql`SELECT * FROM assessment_questions ORDER BY order_index`;
      return json(questions);
    }

    if (path === '/admin/assessments' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { question, category, order_index } = body;
      if (!question) return errorJson('Question is required', 400);
      const [newQ] = await sql`INSERT INTO assessment_questions (question, category, order_index) VALUES (${question}, ${category || ''}, ${order_index || 0}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'create_assessment_question', ${JSON.stringify({id: newQ.id})})`;
      return json(newQ, 201);
    }

    if (path.match(/^\/admin\/assessments\/(\d+)$/)) {
      const assessmentId = parseInt(path.split('/')[3]);
      if (req.method === 'PUT') {
        const admin = await authenticateAdmin(req);
        if (!admin) return errorJson('Forbidden', 403);
        const body = await req.json();
        const { question, category, order_index } = body;
        await sql`UPDATE assessment_questions SET question = COALESCE(${question}, question), category = COALESCE(${category}, category), order_index = COALESCE(${order_index}, order_index) WHERE id = ${assessmentId}`;
        return json({ success: true });
      } else if (req.method === 'DELETE') {
        const admin = await authenticateAdmin(req);
        if (!admin) return errorJson('Forbidden', 403);
        await sql`DELETE FROM assessment_questions WHERE id = ${assessmentId}`;
        return json({ success: true });
      }
    }

    // --- Slideshow Management ---
    if (path === '/admin/slideshow' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const images = await sql`SELECT * FROM slideshow_images ORDER BY sort_order, id`;
      return json(images);
    }

    if (path === '/admin/slideshow' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { image_url_desktop, image_url_mobile, title, link_url, sort_order, is_active } = body;
      if (!image_url_desktop || !image_url_mobile) return errorJson('Both desktop and mobile image URLs required', 400);
      const [newSlide] = await sql`
        INSERT INTO slideshow_images (image_url_desktop, image_url_mobile, title, link_url, sort_order, is_active)
        VALUES (${image_url_desktop}, ${image_url_mobile}, ${title || null}, ${link_url || null}, ${sort_order || 0}, ${is_active ?? true})
        RETURNING *
      `;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'create_slideshow', ${JSON.stringify({id: newSlide.id})})`;
      return json(newSlide, 201);
    }

    if (path.match(/^\/admin\/slideshow\/(\d+)$/) && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const slideId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { image_url_desktop, image_url_mobile, title, link_url, sort_order, is_active } = body;
      await sql`
        UPDATE slideshow_images SET
          image_url_desktop = COALESCE(${image_url_desktop}, image_url_desktop),
          image_url_mobile = COALESCE(${image_url_mobile}, image_url_mobile),
          title = COALESCE(${title}, title),
          link_url = COALESCE(${link_url}, link_url),
          sort_order = COALESCE(${sort_order}, sort_order),
          is_active = COALESCE(${is_active}, is_active)
        WHERE id = ${slideId}
      `;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/slideshow\/(\d+)$/) && req.method === 'DELETE') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const slideId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM slideshow_images WHERE id = ${slideId}`;
      return json({ success: true });
    }

    // ==================== Training Export/Import (legacy) ====================
    if (path === '/admin/export/training' && req.method === 'GET') {
      // Now export the new training data
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      try {
        const subjects = await sql`SELECT * FROM training_subjects WHERE is_active = true ORDER BY order_index, id`;
        const result = [];
        for (const subj of subjects) {
          const lessons = await sql`SELECT * FROM training_lessons WHERE subject_id = ${subj.id} AND is_active = true ORDER BY order_index, id`;
          const lessonsWithQuestions = [];
          for (const les of lessons) {
            const questions = await sql`SELECT * FROM training_quiz_questions WHERE lesson_id = ${les.id} ORDER BY order_index, id`;
            lessonsWithQuestions.push({ ...les, questions });
          }
          result.push({ ...subj, subSubjects: lessonsWithQuestions });
        }
        return json({ exported_at: new Date().toISOString(), version: '2.0', data: result });
      } catch (err) {
        Sentry.captureException(err);
        return errorJson('Export failed: ' + err.message, 500);
      }
    }

    if (path === '/admin/import/training' && req.method === 'POST') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      let body;
      try { body = await req.json(); } catch { return errorJson('Invalid JSON file', 400); }
      if (!body.data || !Array.isArray(body.data)) return errorJson('Invalid backup format: missing data array', 400);
      try {
        for (const subj of body.data) {
          const [existingSubj] = await sql`SELECT id FROM training_subjects WHERE id = ${subj.id}`;
          if (existingSubj) {
            await sql`UPDATE training_subjects SET icon=${subj.icon}, names=${JSON.stringify(subj.names)}, order_index=${subj.order_index}, is_active=${subj.is_active} WHERE id = ${subj.id}`;
          } else {
            await sql`INSERT INTO training_subjects (id, icon, names, order_index, is_active) VALUES (${subj.id}, ${subj.icon}, ${JSON.stringify(subj.names)}, ${subj.order_index}, ${subj.is_active})`;
          }
          for (const les of (subj.subSubjects || [])) {
            const [existingLesson] = await sql`SELECT id FROM training_lessons WHERE id = ${les.id}`;
            if (existingLesson) {
              await sql`UPDATE training_lessons SET subject_id=${subj.id}, titles=${JSON.stringify(les.titles)}, contents=${JSON.stringify(les.contents)}, duration=${les.duration}, level=${les.level}, quiz_pass_score=${les.quiz_pass_score}, order_index=${les.order_index}, is_active=${les.is_active} WHERE id = ${les.id}`;
            } else {
              await sql`INSERT INTO training_lessons (id, subject_id, titles, contents, duration, level, quiz_pass_score, order_index, is_active) VALUES (${les.id}, ${subj.id}, ${JSON.stringify(les.titles)}, ${JSON.stringify(les.contents)}, ${les.duration}, ${les.level}, ${les.quiz_pass_score}, ${les.order_index}, ${les.is_active})`;
            }
            // Delete existing questions for this lesson and insert
            await sql`DELETE FROM training_quiz_questions WHERE lesson_id = ${les.id}`;
            for (const q of (les.questions || [])) {
              await sql`INSERT INTO training_quiz_questions (id, lesson_id, question, options, correct, points, explanation, order_index) VALUES (${q.id}, ${les.id}, ${JSON.stringify(q.question)}, ${JSON.stringify(q.options)}, ${q.correct}, ${q.points}, ${JSON.stringify(q.explanation)}, ${q.order_index})`;
            }
          }
        }
        return json({ success: true, message: 'Training data imported successfully' });
      } catch (err) {
        Sentry.captureException(err);
        return errorJson('Import failed: ' + err.message, 500);
      }
    }

    // --- Activity Log ---
    if (path === '/admin/activity-log' && req.method === 'GET') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const logs = await sql`SELECT al.*, au.email as admin_email, au.name as admin_name FROM admin_activity_log al LEFT JOIN admin_users au ON al.admin_id = au.id ORDER BY al.created_at DESC LIMIT 100`;
      return json(logs);
    }

    // --- Admin Password Change ---
    if (path === '/admin/change-password' && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const { current_password, new_password } = await req.json();
      if (!new_password || new_password.length < 6) return errorJson('Password too short', 400);
      const valid = await bcrypt.compare(current_password, admin.password_hash);
      if (!valid) return errorJson('Current password incorrect', 401);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE admin_users SET password_hash = ${hash}, password_change_required = false WHERE id = ${admin.id}`;
      return json({ success: true });
    }

    // --- Site Settings ---
    if (path === '/admin/settings' && req.method === 'GET') {
      const rows = await sql`SELECT * FROM site_settings`;
      const map = {};
      rows.forEach(r => map[r.key] = r.value);
      return json(map);
    }

    if (path === '/admin/settings' && req.method === 'PUT') {
      const admin = await authenticateAdmin(req);
      if (!admin) return errorJson('Forbidden', 403);
      const body = await req.json();
      for (const [key, value] of Object.entries(body)) {
        await sql`INSERT INTO site_settings (key, value) VALUES (${key}, ${String(value)}) ON CONFLICT (key) DO UPDATE SET value = ${String(value)}`;
      }
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${admin.id}, 'update_settings', ${JSON.stringify(body)})`;
      return json({ success: true });
    }

    // ==================== AUTH REQUIRED USER ROUTES ====================
    const user = await authenticate(req);
    if (!user) return errorJson('Authentication required', 401);

    // --- User image upload (non-admin) ---
    if (path === '/upload-image' && req.method === 'POST') {
      // handled by multipart wrapper above
      return errorJson('Use multipart form-data', 400);
    }

    // --- User Settings (with reminders & language) ---
    if (path === '/settings' && req.method === 'GET') {
      const [settings] = await sql`SELECT * FROM user_settings WHERE user_id = ${user.id}`;
      return json(settings || {
        reminder_enabled: false,
        reminder_times: ["08:00"],
        email_reminder: false,
        push_reminder: true,
        whatsapp_reminder: false,
        whatsapp_number: '',
        language: 'en'
      });
    }

    if (path === '/settings' && req.method === 'POST') {
      const body = await req.json();
      await sql`
        INSERT INTO user_settings (user_id, reminder_enabled, reminder_times, email_reminder, push_reminder, whatsapp_reminder, whatsapp_number, language)
        VALUES (${user.id}, ${body.reminder_enabled}, ${JSON.stringify(body.reminder_times || ["08:00"])}, ${body.email_reminder}, ${body.push_reminder}, ${body.whatsapp_reminder}, ${body.whatsapp_number}, ${body.language})
        ON CONFLICT (user_id) DO UPDATE SET
          reminder_enabled = ${body.reminder_enabled},
          reminder_times = ${JSON.stringify(body.reminder_times || ["08:00"])},
          email_reminder = ${body.email_reminder},
          push_reminder = ${body.push_reminder},
          whatsapp_reminder = ${body.whatsapp_reminder},
          whatsapp_number = ${body.whatsapp_number},
          language = COALESCE(${body.language}, user_settings.language)
      `;
      return json({ success: true });
    }

    // --- Save Push Subscription ---
    if (path === '/save-subscription' && req.method === 'POST') {
      const body = await req.json();
      const { subscription } = body;
      if (!subscription) return errorJson('Missing subscription', 400);
      await sql`INSERT INTO notif_settings (user_id, push_enabled, push_subscription) VALUES (${user.id}, true, ${subscription}) ON CONFLICT (user_id) DO UPDATE SET push_subscription = ${subscription}`;
      return json({ success: true });
    }

    // --- Mood ---
    if (path === '/mood' && req.method === 'POST') {
      const body = await req.json();
      const { mood, date } = body;
      await sql`INSERT INTO mood_logs (user_id, date, mood) VALUES (${user.id}, ${date || new Date().toISOString().slice(0,10)}, ${mood}) ON CONFLICT (user_id, date) DO UPDATE SET mood = ${mood}`;
      return json({ success: true });
    }

    // --- Daily Quest ---
    if (path === '/daily-quest' && req.method === 'GET') {
      const today = new Date().toISOString().slice(0,10);
      let [quest] = await sql`SELECT * FROM daily_quests WHERE user_id = ${user.id} AND quest_date = ${today}`;
      if (!quest) {
        const types = ['no_revenge','no_fomo','q6_8plus','mindfulness','habit_complete'];
        const type = types[Math.floor(Math.random()*types.length)];
        [quest] = await sql`INSERT INTO daily_quests (user_id, quest_date, quest_type) VALUES (${user.id}, ${today}, ${type}) RETURNING *`;
      }
      const [journal] = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = ${today}`;
      let progress = 0; const target = 1;
      if (journal) {
        switch (quest.quest_type) {
          case 'no_revenge': progress = journal.revenge_trade ? 0 : 1; break;
          case 'no_fomo': progress = journal.fomo_entry ? 0 : 1; break;
          case 'q6_8plus': progress = (journal.scores?.q6 >= 8) ? 1 : 0; break;
          case 'mindfulness': progress = journal.mindfulness_done ? 1 : 0; break;
          case 'habit_complete': {
            const habits = await sql`SELECT hd.id FROM habit_definitions hd JOIN habit_logs hl ON hd.id = hl.habit_id WHERE hl.user_id = ${user.id} AND hl.date = ${today} AND hl.completed_times IS NOT NULL`;
            progress = habits.length > 0 ? 1 : 0; break;
          }
        }
      }
      return json({ quest, progress, target, completed: progress === target, claimed: quest.claimed });
    }

    if (path === '/claim-quest-reward' && req.method === 'POST') {
      const today = new Date().toISOString().slice(0,10);
      const [quest] = await sql`SELECT * FROM daily_quests WHERE user_id = ${user.id} AND quest_date = ${today}`;
      if (!quest || quest.claimed) return errorJson('Already claimed or no quest', 400);
      if (!quest.completed) return errorJson('Quest not completed yet', 400);
      await sql`UPDATE daily_quests SET claimed = true WHERE id = ${quest.id}`;
      await sql`UPDATE users SET xp = xp + 15 WHERE id = ${user.id}`;
      return json({ success: true, xp: 15 });
    }

    // --- Streak Freeze ---
    if (path === '/use-streak-freeze' && req.method === 'POST') {
      const [item] = await sql`SELECT quantity FROM streak_freeze_items WHERE user_id = ${user.id}`;
      if (!item || item.quantity < 1) return errorJson('No freeze available', 400);
      await sql`UPDATE streak_freeze_items SET quantity = quantity - 1 WHERE user_id = ${user.id}`;
      return json({ success: true, remaining: item.quantity - 1 });
    }

    if (path === '/streak-freeze' && req.method === 'GET') {
      const [item] = await sql`SELECT quantity FROM streak_freeze_items WHERE user_id = ${user.id}`;
      return json({ quantity: item?.quantity || 0 });
    }

    // --- Portfolio ---
    if (path === '/portfolio' && req.method === 'GET') {
      const rows = await sql`SELECT * FROM portfolio_performance WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 30`;
      return json(rows);
    }

    // --- Latest Feedback ---
    if (path === '/latest-feedback' && req.method === 'GET') {
      const [journal] = await sql`SELECT feedback FROM daily_journals WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 1`;
      return json({ feedback: journal?.feedback || null });
    }

    // --- Daily Reward ---
    if (path === '/daily-reward' && req.method === 'POST') {
      const [exists] = await sql`SELECT * FROM daily_rewards WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (!exists) {
        await sql`INSERT INTO daily_rewards (user_id, date) VALUES (${user.id}, CURRENT_DATE)`;
        await sql`UPDATE users SET xp = xp + 1 WHERE id = ${user.id}`;
        return json({ claimed: true, xp: 1 });
      }
      return json({ claimed: false, message: 'Daily bonus already claimed' });
    }

    // --- Mystery Box ---
    if (path === '/open-box' && req.method === 'POST') {
      const [box] = await sql`SELECT * FROM mystery_boxes WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (box?.opened) return json({ opened: false, message: 'Box already opened today' });
      const rewards = ['+3 XP', '+5 XP', 'Special Badge "Lucky Trader"', '+2 XP', 'Streak Freeze'];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      if (!box) await sql`INSERT INTO mystery_boxes (user_id, date, opened, reward) VALUES (${user.id}, CURRENT_DATE, true, ${reward})`;
      else await sql`UPDATE mystery_boxes SET opened = true, reward = ${reward} WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (reward.includes('XP')) { const xp = parseInt(reward); await sql`UPDATE users SET xp = xp + ${xp} WHERE id = ${user.id}`; }
      else if (reward.includes('Badge')) await sql`INSERT INTO badges (user_id, badge_type) VALUES (${user.id}, 'lucky-trader') ON CONFLICT DO NOTHING`;
      else if (reward === 'Streak Freeze') await sql`INSERT INTO streak_freeze_items (user_id, quantity) VALUES (${user.id}, 1) ON CONFLICT (user_id) DO UPDATE SET quantity = streak_freeze_items.quantity + 1`;
      return json({ reward });
    }

    // --- Community Reactions ---
    if (path === '/reaction' && req.method === 'POST') {
      const body = await req.json();
      const { post_id, reaction } = body;
      if (!['👍','🔥','❤️'].includes(reaction)) return errorJson('Invalid reaction', 400);
      await sql`UPDATE community_posts SET reactions = jsonb_set(COALESCE(reactions, '{}'), ARRAY[${reaction}], COALESCE((reactions->>${reaction})::int, 0)::int + 1::text::jsonb) WHERE id = ${post_id}`;
      return json({ success: true });
    }

    // --- Profile ---
    if (path === '/profile' && req.method === 'GET') {
      const [today] = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      const { count: total } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0];
      const phase = computeIdentityPhase(total);
      if (user.identity_level !== phase) {
        await sql`UPDATE users SET identity_level = ${phase} WHERE id = ${user.id}`;
        user.identity_level = phase;
      }
      const streakRes = await sql`WITH grp AS (SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp FROM daily_journals WHERE user_id = ${user.id}) SELECT COUNT(*)::int as cnt FROM grp GROUP BY grp ORDER BY MAX(date) DESC LIMIT 1`;
      const streak = streakRes[0]?.cnt || 0;
      const disciplineStreak = await computeDisciplineStreak(user.id);
      const [adminExists] = await sql`SELECT id FROM admin_users WHERE email = ${user.email}`;
      const [settings] = await sql`SELECT language FROM user_settings WHERE user_id = ${user.id}`;
      const userData = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        identity_level: user.identity_level,
        xp: user.xp,
        level: calculateLevel(user.xp),
        avatar_emoji: user.avatar_emoji,
        is_admin: !!adminExists,
        language: settings?.language || 'en'
      };
      return json({ user: userData, today_entry: today, totalDays: total, streak, disciplineStreak });
    }

    if (path === '/profile' && req.method === 'POST') {
      const body = await req.json();
      const { avatar_emoji, display_name } = body;
      if (avatar_emoji) await sql`UPDATE users SET avatar_emoji = ${avatar_emoji} WHERE id = ${user.id}`;
      if (display_name) await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
      return json({ success: true });
    }

    // --- Checkin ---
    if (path === '/checkin' && req.method === 'POST') {
      const body = await req.json();
      const { mindfulness_done, commitment, date } = body;
      const effectiveDate = date || new Date().toISOString().slice(0,10);
      await sql`INSERT INTO daily_journals (user_id, date, mindfulness_done, commitment) VALUES (${user.id}, ${effectiveDate}, ${mindfulness_done}, ${commitment}) ON CONFLICT (user_id, date) DO UPDATE SET mindfulness_done = ${mindfulness_done}, commitment = ${commitment}`;
      return json({ success: true });
    }

    // --- Evaluation ---
    if (path === '/evaluation' && req.method === 'POST') {
      const body = await req.json();
      const parsed = evaluationSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.issues }, 400);
      const { trades_count, stop_loss_moved, plan_deviation, revenge_trade, fomo_entry, overtrading, rule_followed, scores, evaluation_notes, reflection, date, mood } = parsed.data;
      const effectiveDate = date || new Date().toISOString().slice(0,10);
      const [existing] = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = ${effectiveDate}`;
      if (!existing) return errorJson('Morning checkin first', 400);
      if (existing.feedback) return errorJson('Already submitted', 400);
      const radar = calculateRadarScores(scores);
      await sql`UPDATE daily_journals SET trades_count=${trades_count}, stop_loss_moved=${stop_loss_moved}, plan_deviation=${plan_deviation}, revenge_trade=${revenge_trade}, fomo_entry=${fomo_entry}, overtrading=${overtrading}, rule_followed=${rule_followed}, scores=${JSON.stringify(scores)}, radar_scores=${JSON.stringify(radar)}, evaluation_notes=${evaluation_notes}, reflection=${reflection} WHERE user_id=${user.id} AND date=${effectiveDate}`;
      const journal = (await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = ${effectiveDate}`)[0];
      const userName = user.display_name || user.email.split('@')[0];
      const { feedback, mission } = await generateFeedback(user.id, journal, userName);
      await sql`UPDATE daily_journals SET feedback=${feedback}, tomorrow_mission=${mission} WHERE id = ${journal.id}`;

      if (mood) {
        await sql`INSERT INTO mood_logs (user_id, date, mood) VALUES (${user.id}, ${effectiveDate}, ${mood}) ON CONFLICT (user_id, date) DO UPDATE SET mood = ${mood}`;
      }

      const prev = await sql`SELECT virtual_balance FROM portfolio_performance WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 1`;
      const prevBalance = prev.length ? prev[0].virtual_balance : 10000;
      const discipline = scores.q6;
      const newBalance = prevBalance + (discipline - 5) * 10;
      await sql`INSERT INTO portfolio_performance (user_id, date, discipline_score, virtual_balance) VALUES (${user.id}, ${effectiveDate}, ${discipline}, ${newBalance}) ON CONFLICT (user_id, date) DO UPDATE SET discipline_score = ${discipline}, virtual_balance = ${newBalance}`;

      await checkAndCompleteQuest(user.id, journal, effectiveDate);

      const streakRes = await sql`WITH grp AS (SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp FROM daily_journals WHERE user_id = ${user.id}) SELECT COUNT(*)::int as cnt FROM grp GROUP BY grp ORDER BY MAX(date) DESC LIMIT 1`;
      const streak = streakRes[0]?.cnt || 0;
      let xpGain = 5, bonus = 0;
      if (streak >= 7) { bonus = 3; xpGain += 3; }
      else if (streak >= 3) { bonus = 1; xpGain += 1; }
      await sql`UPDATE users SET xp = xp + ${xpGain} WHERE id = ${user.id}`;

      const badges = await checkAndAwardBadges(user.id, journal);
      const total = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0].count;
      const phase = computeIdentityPhase(total);
      if (user.identity_level !== phase) {
        await sql`UPDATE users SET identity_level = ${phase} WHERE id = ${user.id}`;
        user.identity_level = phase;
      }
      const disciplineStreak = await computeDisciplineStreak(user.id);
      const newXp = (await sql`SELECT xp FROM users WHERE id = ${user.id}`)[0].xp;
      const level = calculateLevel(newXp);
      const [box] = await sql`SELECT * FROM mystery_boxes WHERE user_id = ${user.id} AND date = ${effectiveDate}`;

      return json({ feedback, mission, badges, identity_level: phase, streak, disciplineStreak, totalDays: total, xp: newXp, level, radar_scores: radar, xpGain, bonus, box_available: !box || !box.opened });
    }

    // --- Progress ---
    if (path === '/progress' && req.method === 'GET') {
      const days = await sql`SELECT date, scores, radar_scores FROM daily_journals WHERE user_id = ${user.id} ORDER BY date ASC`;
      const badges = await sql`SELECT badge_type FROM badges WHERE user_id = ${user.id}`;
      const totalDays = days.length;
      const disciplineStreak = await computeDisciplineStreak(user.id);
      const streakRes = await sql`WITH grp AS (SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp FROM daily_journals WHERE user_id = ${user.id}) SELECT COUNT(*)::int as cnt FROM grp GROUP BY grp ORDER BY MAX(date) DESC LIMIT 1`;
      const streak = streakRes[0]?.cnt || 0;
      const todayRadar = days.length > 0 ? days[days.length-1].radar_scores : null;
      const yesterdayRadar = days.length > 1 ? days[days.length-2].radar_scores : null;
      return json({ days, badges: badges.map(b => b.badge_type), streak, totalDays, identity_level: computeIdentityPhase(totalDays), disciplineStreak, radar_today: todayRadar, radar_yesterday: yesterdayRadar });
    }

    // --- Insights ---
    if (path === '/insights' && req.method === 'GET') {
      const totalJournals = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0].count;
      const currentStreak = await computeDisciplineStreak(user.id);
      const mistakeCounts = await sql`SELECT SUM(CASE WHEN stop_loss_moved = true THEN 1 ELSE 0 END) as sl_moved, SUM(CASE WHEN revenge_trade = true THEN 1 ELSE 0 END) as revenge, SUM(CASE WHEN fomo_entry = true THEN 1 ELSE 0 END) as fomo, SUM(CASE WHEN overtrading = true THEN 1 ELSE 0 END) as overtrade FROM daily_journals WHERE user_id = ${user.id}`;
      const mc = mistakeCounts[0];
      const mistakes = { 'Stop loss moved': mc.sl_moved, 'Revenge trade': mc.revenge, 'FOMO': mc.fomo, 'Overtrading': mc.overtrade };
      const topMistake = Object.entries(mistakes).sort((a,b)=>b[1]-a[1])[0];
      const avgDiscipline = (await sql`SELECT AVG((scores->>'q6')::int)::float FROM daily_journals WHERE user_id = ${user.id}`)[0].avg;
      return json({ totalJournals, currentStreak, topMistake: topMistake[1]>0?topMistake[0]:'No mistakes!', avgDiscipline });
    }

    // --- Lessons (legacy) ---
    if (path === '/lessons' && req.method === 'GET') {
      const lessons = await sql`SELECT l.*, ul.completed_at FROM lessons l LEFT JOIN user_lessons ul ON l.id = ul.lesson_id AND ul.user_id = ${user.id} ORDER BY l.day`;
      return json(lessons);
    }
    if (path === '/complete-lesson' && req.method === 'POST') {
      const body = await req.json();
      const { lesson_id } = body;
      await sql`INSERT INTO user_lessons (user_id, lesson_id) VALUES (${user.id}, ${lesson_id}) ON CONFLICT DO NOTHING`;
      await sql`UPDATE users SET xp = xp + 3 WHERE id = ${user.id}`;
      return json({ success: true });
    }

    // --- Community ---
    if (path === '/community' && req.method === 'GET') {
      const posts = await sql`SELECT cp.*, u.email as author, u.display_name, u.avatar_emoji FROM community_posts cp JOIN users u ON cp.user_id = u.id WHERE cp.is_hidden = false ORDER BY cp.created_at DESC LIMIT 50`;
      return json(posts.map(p => ({ ...p, author: maskEmail(p.author), display_name: p.display_name || p.author.split('@')[0] })));
    }
    if (path === '/community' && req.method === 'POST') {
      const body = await req.json();
      const { content, post_type } = body;
      if (!['lesson','mistake','rule','general'].includes(post_type)) return errorJson('Invalid type', 400);
      await sql`INSERT INTO community_posts (user_id, content, post_type) VALUES (${user.id}, ${content}, ${post_type})`;
      return json({ success: true });
    }
    if (path === '/like-post' && req.method === 'POST') {
      const body = await req.json();
      const { post_id } = body;
      await sql`UPDATE community_posts SET likes = likes + 1 WHERE id = ${post_id}`;
      return json({ success: true });
    }
    if (path === '/reply-post' && req.method === 'POST') {
      const body = await req.json();
      const { post_id, content } = body;
      await sql`INSERT INTO replies (post_id, user_id, content) VALUES (${post_id}, ${user.id}, ${content})`;
      return json({ success: true });
    }
    if (path === '/replies' && req.method === 'GET') {
      const postId = getQueryParam('post_id');
      const replies = await sql`SELECT r.*, u.email, u.display_name, u.avatar_emoji FROM replies r JOIN users u ON r.user_id = u.id WHERE post_id = ${postId} ORDER BY created_at ASC`;
      return json(replies.map(r => ({ ...r, email: maskEmail(r.email), display_name: r.display_name || r.email.split('@')[0] })));
    }

    // --- Leaderboard ---
    if (path === '/leaderboard' && req.method === 'GET') {
      const lb = await sql`SELECT u.id as user_id, u.email, u.display_name, u.avatar_emoji, AVG((daily_journals.scores->>'q6')::int)::float as avg_discipline FROM daily_journals JOIN users u ON daily_journals.user_id = u.id WHERE daily_journals.date > CURRENT_DATE - INTERVAL '7 days' GROUP BY u.id, u.email, u.display_name, u.avatar_emoji ORDER BY avg_discipline DESC LIMIT 10`;
      return json(lb.map(u => ({ ...u, user_id: u.user_id, email: maskEmail(u.email), display_name: u.display_name || u.email.split('@')[0] })));
    }

    // --- Quiz (legacy) ---
    if (path === '/quiz' && req.method === 'GET') {
      const [quiz] = await sql`SELECT * FROM quizzes WHERE active = true ORDER BY RANDOM() LIMIT 1`;
      if (!quiz) return json({ question: null });
      const [attempt] = await sql`SELECT * FROM quiz_attempts WHERE user_id = ${user.id} AND quiz_id = ${quiz.id} AND date = CURRENT_DATE`;
      if (attempt) return json({ question: null, message: 'Already attempted today' });
      return json(quiz);
    }
    if (path === '/quiz' && req.method === 'POST') {
      const body = await req.json();
      const { quiz_id, answer } = body;
      const [quiz] = await sql`SELECT * FROM quizzes WHERE id = ${quiz_id}`;
      if (!quiz) return errorJson('Invalid quiz', 404);
      const correct = answer === quiz.correct;
      await sql`INSERT INTO quiz_attempts (user_id, quiz_id, date, correct) VALUES (${user.id}, ${quiz_id}, CURRENT_DATE, ${correct}) ON CONFLICT DO NOTHING`;
      if (correct) { await sql`UPDATE users SET xp = xp + 10 WHERE id = ${user.id}`; return json({ correct: true, message: 'Correct! +10 XP' }); }
      return json({ correct: false, message: 'Wrong answer' });
    }

    // --- Notification Settings ---
    if (path === '/notif-settings' && req.method === 'GET') {
      const [s] = await sql`SELECT * FROM notif_settings WHERE user_id = ${user.id}`;
      return json(s || { email_enabled: true, push_enabled: true });
    }
    if (path === '/notif-settings' && req.method === 'POST') {
      const body = await req.json();
      const { email, push, subscription } = body;
      await sql`INSERT INTO notif_settings (user_id, email_enabled, push_enabled, push_subscription) VALUES (${user.id}, ${email ?? true}, ${push ?? true}, ${subscription ?? null}) ON CONFLICT (user_id) DO UPDATE SET email_enabled = ${email ?? true}, push_enabled = ${push ?? true}, push_subscription = COALESCE(${subscription ?? null}, notif_settings.push_subscription)`;
      return json({ success: true });
    }

    // --- Videos ---
    if (path === '/videos' && req.method === 'GET') {
      const videos = await sql`SELECT * FROM video_library ORDER BY category, id`;
      return json(videos);
    }

    // --- Weekly Challenge ---
    if (path === '/weekly-challenge' && req.method === 'GET') {
      const startOfWeek = new Date();
      const day = startOfWeek.getDay();
      const diff = (day === 0 ? -6 : 1 - day);
      startOfWeek.setDate(startOfWeek.getDate() + diff);
      const weekStart = startOfWeek.toISOString().slice(0,10);
      const [challenge] = await sql`SELECT * FROM weekly_challenges WHERE week_start = ${weekStart}`;
      if (!challenge) return json(null);
      const completed = await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id} AND date >= ${weekStart} AND date < (${weekStart}::date + INTERVAL '7 days') AND fomo_entry = false`;
      return json({ ...challenge, progress: completed[0].count });
    }

    // ==================== HABIT ENDPOINTS ====================
    if (path === '/habits/definitions' && req.method === 'GET') {
      const habits = await sql`SELECT * FROM habit_definitions WHERE user_id = ${user.id} AND is_active = true ORDER BY created_at`;
      return json(habits);
    }
    if (path === '/habits/definitions' && req.method === 'POST') {
      const body = await req.json();
      const { title, icon, color, reminder_times } = body;
      const times = typeof reminder_times === 'string' ? reminder_times.split(',').map(t=>t.trim()).filter(t=>t) : (reminder_times || []);
      const [habit] = await sql`INSERT INTO habit_definitions (user_id, title, icon, color, reminder_times) VALUES (${user.id}, ${title}, ${icon||'✅'}, ${color||'#c59b3b'}, ${JSON.stringify(times)}) RETURNING *`;
      return json(habit, 201);
    }
    if (path.match(/^\/habits\/definitions\/(.+)$/) && req.method === 'PUT') {
      const habitId = path.split('/')[3];
      const body = await req.json();
      const { title, icon, color, reminder_times } = body;
      const times = typeof reminder_times === 'string' ? reminder_times.split(',').map(t=>t.trim()).filter(t=>t) : (reminder_times || []);
      await sql`UPDATE habit_definitions SET title=${title}, icon=${icon}, color=${color}, reminder_times=${JSON.stringify(times)} WHERE id=${habitId} AND user_id=${user.id}`;
      return json({ success: true });
    }
    if (path.match(/^\/habits\/definitions\/(.+)$/) && req.method === 'DELETE') {
      const habitId = path.split('/')[3];
      await sql`DELETE FROM habit_definitions WHERE id=${habitId} AND user_id=${user.id}`;
      return json({ success: true });
    }
    if (path === '/habits/logs' && req.method === 'GET') {
      const date = getQueryParam('date') || new Date().toISOString().slice(0,10);
      const habits = await sql`SELECT * FROM habit_definitions WHERE user_id = ${user.id} AND is_active = true`;
      const logs = await sql`SELECT * FROM habit_logs WHERE user_id = ${user.id} AND date = ${date}`;
      const merged = habits.map(h => {
        const log = logs.find(l => l.habit_id === h.id);
        return { habit_id: h.id, title: h.title, icon: h.icon, color: h.color, reminder_times: h.reminder_times, completed_times: log?.completed_times || {} };
      });
      return json(merged);
    }
    if (path === '/habits/logs' && req.method === 'POST') {
      const body = await req.json();
      const { habit_id, date, time, completed } = body;
      const [habit] = await sql`SELECT id FROM habit_definitions WHERE id = ${habit_id} AND user_id = ${user.id}`;
      if (!habit) return errorJson('Habit not found', 404);
      const [existing] = await sql`SELECT * FROM habit_logs WHERE user_id = ${user.id} AND habit_id = ${habit_id} AND date = ${date}`;
      if (existing) {
        const ct = existing.completed_times || {};
        ct[time] = completed;
        await sql`UPDATE habit_logs SET completed_times = ${JSON.stringify(ct)} WHERE id = ${existing.id}`;
      } else {
        const ct = {}; ct[time] = completed;
        await sql`INSERT INTO habit_logs (user_id, habit_id, date, completed_times) VALUES (${user.id}, ${habit_id}, ${date}, ${JSON.stringify(ct)})`;
      }
      return json({ success: true });
    }

    // ==================== LEGACY TRAINING ENDPOINTS (kept for compatibility but not used) ====================
    // (We keep them but they will return empty or error)
    if (path === '/training/chapters' && req.method === 'GET') {
      return json([]);
    }
    if (path.match(/^\/training\/chapter\/(\d+)$/) && req.method === 'GET') {
      return errorJson('Chapter system deprecated, use new training endpoints', 410);
    }
    if (path.match(/^\/training\/chapter\/(\d+)\/quiz$/) && req.method === 'POST') {
      return errorJson('Chapter system deprecated', 410);
    }
    if (path === '/training/final-exam' && (req.method === 'GET' || req.method === 'POST')) {
      return errorJson('Final exam deprecated', 410);
    }
    // Keep certificate generation
    if (path === '/certificate' && req.method === 'GET') {
      const { count: totalJournals } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0];
      if (totalJournals < 1) return errorJson('No journals', 400);
      const chapters = await sql`SELECT c.id, COALESCE(ucp.best_score, 0) as best_score FROM chapters c JOIN user_chapter_progress ucp ON c.id = ucp.chapter_id WHERE ucp.user_id = ${user.id} AND c.is_active = true`;
      const trainingAvg = chapters.length ? chapters.reduce((s, c) => s + parseFloat(c.best_score), 0) / chapters.length : 0;
      const [finalExam] = await sql`SELECT score FROM final_exam_results WHERE user_id = ${user.id} AND passed = true ORDER BY attempted_at DESC LIMIT 1`;
      const trainingScore = Math.round((trainingAvg * 0.6 + (finalExam?.score || 0) * 0.4) * 100) / 100;
      const avgQ6 = (await sql`SELECT AVG((scores->>'q6')::int)::float FROM daily_journals WHERE user_id = ${user.id}`)[0].avg || 0;
      const disciplineScore = Math.round((avgQ6 / 10) * 100 * 100) / 100;
      const streakRes = await sql`WITH grp AS (SELECT date, date - (ROW_NUMBER() OVER (ORDER BY date))::int AS grp FROM daily_journals WHERE user_id = ${user.id}) SELECT COUNT(*)::int as cnt FROM grp GROUP BY grp ORDER BY MAX(date) DESC LIMIT 1`;
      const streak = streakRes[0]?.cnt || 0;
      const streakBonus = Math.min(streak * 2, 30);
      const journalScore = Math.min(disciplineScore + streakBonus, 100);
      const overall = Math.round(((trainingScore * 0.5 + journalScore * 0.5)) * 100) / 100;
      const grade = overall >= 95 ? 'A+' : overall >= 85 ? 'A' : overall >= 75 ? 'B+' : overall >= 65 ? 'B' : 'C';
      const verificationId = uuidv4();
      await sql`INSERT INTO certificates (user_id, verification_code) VALUES (${user.id}, ${verificationId})`;
      const badges = (await sql`SELECT badge_type FROM badges WHERE user_id = ${user.id}`).map(b => b.badge_type).join(', ');
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f2d680"/>
      <stop offset="50%" stop-color="#c59b3b"/>
      <stop offset="100%" stop-color="#8b6914"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0b16"/>
      <stop offset="100%" stop-color="#1a0b2e"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)"/>
  <rect x="20" y="20" width="960" height="660" fill="none" stroke="url(#goldGrad)" stroke-width="3" rx="15"/>
  <rect x="30" y="30" width="940" height="640" fill="none" stroke="url(#goldGrad)" stroke-width="1" rx="10"/>
  <text x="500" y="100" text-anchor="middle" fill="url(#goldGrad)" font-size="42" font-weight="bold" font-family="Arial">AlamQuant Transformation Certificate</text>
  <text x="500" y="150" text-anchor="middle" fill="#ccc" font-size="18" font-family="Arial">This certifies that</text>
  <text x="500" y="210" text-anchor="middle" fill="url(#goldGrad)" font-size="36" font-weight="bold" font-family="Arial">${xmlEscape(user.display_name || user.email)}</text>
  <text x="500" y="260" text-anchor="middle" fill="#ddd" font-size="16" font-family="Arial">has successfully completed the Professional Trader Transformation Program</text>
  <text x="200" y="340" fill="url(#goldGrad)" font-size="20" font-weight="bold" font-family="Arial">Performance Summary</text>
  <text x="200" y="380" fill="#fff" font-size="16" font-family="Arial">Training Score: ${trainingScore}%</text>
  <text x="600" y="380" fill="#fff" font-size="16" font-family="Arial">Discipline Score: ${disciplineScore}%</text>
  <text x="200" y="420" fill="#fff" font-size="16" font-family="Arial">Journal Streak: ${streak} Days</text>
  <text x="600" y="420" fill="#fff" font-size="16" font-family="Arial">Identity Phase: ${computeIdentityPhase(totalJournals)}</text>
  <text x="200" y="460" fill="#fff" font-size="16" font-family="Arial">Total Journals: ${totalJournals} Days</text>
  <text x="500" y="520" text-anchor="middle" fill="url(#goldGrad)" font-size="28" font-weight="bold" font-family="Arial">Overall Grade: ${grade} (${overall}%)</text>
  <text x="500" y="580" text-anchor="middle" fill="#aaa" font-size="14" font-family="Arial">Badges: ${badges || 'None'}</text>
  <text x="500" y="620" text-anchor="middle" fill="#888" font-size="12" font-family="Arial">Verification: ${verificationId} | Date: ${new Date().toLocaleDateString('en-US')}</text>
</svg>`;
      return new Response(svg, {
        headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': 'attachment; filename="certificate.svg"' }
      });
    }

    if (path === '/energy' && req.method === 'GET') {
      const today = new Date().toISOString().slice(0,10);
      const [energy] = await sql`SELECT * FROM user_energy WHERE user_id = ${user.id}`;
      if (!energy) {
        await sql`INSERT INTO user_energy (user_id, current_energy, max_energy, last_reset_date) VALUES (${user.id}, 100, 100, ${today})`;
        return json({ current_energy: 100, max_energy: 100 });
      }
      if (energy.last_reset_date.toISOString().slice(0,10) !== today) {
        await sql`UPDATE user_energy SET current_energy = max_energy, last_reset_date = ${today} WHERE user_id = ${user.id}`;
        return json({ current_energy: energy.max_energy, max_energy: energy.max_energy });
      }
      return json({ current_energy: energy.current_energy, max_energy: energy.max_energy });
    }

    // --- Simulator ---
    if (path === '/simulator/scenario' && req.method === 'GET') {
      const scenarios = [
        { market_condition: 'Bullish Trend', chart_description: 'Nifty 50 rising 3 days. RSI 72.', options: ['Buy full','Buy half','Wait for pullback','Short sell'], correct_index: 2, explanation: 'RSI overbought, pullback likely.' },
        { market_condition: 'News Event', chart_description: 'RBI policy in 30 min, high volatility.', options: ['Trade before','Trade after','Avoid trading','Trade during'], correct_index: 2, explanation: 'Avoid trading around major news.' }
      ];
      const scenario = scenarios[Math.floor(Math.random()*scenarios.length)];
      const [saved] = await sql`INSERT INTO trading_simulator (user_id, scenario) VALUES (${user.id}, ${JSON.stringify(scenario)}) RETURNING id`;
      return json({ id: saved.id, ...scenario });
    }
    if (path === '/simulator/answer' && req.method === 'POST') {
      const body = await req.json();
      const { scenario_id, selected_index } = body;
      const [sim] = await sql`SELECT * FROM trading_simulator WHERE id = ${scenario_id} AND user_id = ${user.id}`;
      if (!sim) return errorJson('Scenario not found', 404);
      const isCorrect = selected_index === sim.scenario.correct_index;
      const xpEarned = isCorrect ? 15 : 0;
      await sql`UPDATE trading_simulator SET user_decision = ${JSON.stringify({selected_index})}, result = ${JSON.stringify({is_correct: isCorrect})}, xp_earned = ${xpEarned} WHERE id = ${scenario_id}`;
      if (isCorrect) await sql`UPDATE users SET xp = xp + 15 WHERE id = ${user.id}`;
      return json({ is_correct: isCorrect, explanation: sim.scenario.explanation, xp_earned: xpEarned });
    }

    // --- Assessment Submit ---
    if (path === '/assessment/submit' && req.method === 'POST') {
      const body = await req.json();
      const { answers } = body;
      for (const a of answers) {
        await sql`INSERT INTO user_assessments (user_id, question_id, answer) VALUES (${user.id}, ${a.question_id}, ${a.answer}) ON CONFLICT (user_id, question_id) DO UPDATE SET answer = ${a.answer}`;
      }
      const yesCount = answers.filter(a => a.answer).length;
      let recommendation;
      if (yesCount >= 7) recommendation = "Your trading lacks discipline severely. Our program will transform you completely.";
      else if (yesCount >= 4) recommendation = "You need improvement in some areas. Training will boost your performance.";
      else recommendation = "You are doing well, but our training can still sharpen your edge.";
      return json({ yesCount, total: answers.length, recommendation });
    }

    // --- AI Coach ---
    if (path === '/ai/coach' && req.method === 'POST') {
      if (OPENAI_API_KEY) {
        const journals = await sql`SELECT scores, stop_loss_moved, revenge_trade, fomo_entry FROM daily_journals WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 7`;
        const prompt = `Analyze this trader's last 7 days: ${JSON.stringify(journals)}. Give a personalized coaching message in English under 100 words.`;
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
        });
        const data = await openaiRes.json();
        const msg = data.choices?.[0]?.message?.content || 'No coaching message.';
        return json({ coaching: msg });
      } else {
        return json({ coaching: "Your discipline has declined over the past 2 days. Write a concrete trading plan tomorrow and stick to it." });
      }
    }

    // --- Export My Data ---
    if (path === '/export-my-data' && req.method === 'GET') {
      const journals = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} ORDER BY date`;
      const badges = await sql`SELECT badge_type FROM badges WHERE user_id = ${user.id}`;
      const habits = await sql`SELECT * FROM habit_definitions WHERE user_id = ${user.id}`;
      const profile = { email: user.email, display_name: user.display_name, xp: user.xp, level: calculateLevel(user.xp) };
      return json({ profile, journals, badges: badges.map(b => b.badge_type), habits });
    }

    // ==================== CRON JOB (Reminders) ====================
    if (path === '/cron/check-reminders' && req.method === 'GET') {
      const secret = getQueryParam('secret');
      if (CRON_SECRET && secret !== CRON_SECRET) {
        return errorJson('Forbidden', 403);
      }
      
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

      const users = await sql`
        SELECT u.id, u.email, u.display_name, us.email_reminder, us.push_reminder, us.whatsapp_reminder, us.whatsapp_number
        FROM user_settings us
        JOIN users u ON us.user_id = u.id
        WHERE us.reminder_enabled = true AND us.reminder_times ? ${currentTime}
      `;

      const results = [];

      for (const user of users) {
        const userName = user.display_name || user.email.split('@')[0];
        const message = `🔥 ${userName}, time to write your trading journal! Stay disciplined.`;

        if (user.email_reminder && resend) {
          try {
            await resend.emails.send({
              from: 'AlamQuant ATTS <noreply@alamquant.com>',
              to: user.email,
              subject: '📝 Journal Reminder',
              text: message
            });
            results.push({ userId: user.id, type: 'email', status: 'sent' });
          } catch (e) {
            results.push({ userId: user.id, type: 'email', status: 'failed' });
          }
        }

        if (user.push_reminder) {
          const [sub] = await sql`SELECT push_subscription FROM notif_settings WHERE user_id = ${user.id}`;
          if (sub?.push_subscription) {
            try {
              const payload = JSON.stringify({
                title: "⏰ Journal Reminder",
                body: message,
                icon: "/icon-192.png",
                badge: "/badge-72.png",
                actions: [
                  { action: "open-journal", title: "Write Journal" },
                  { action: "snooze", title: "Remind Later" }
                ],
                data: { url: "/#/journey" }
              });
              await webPush.sendNotification(sub.push_subscription, payload);
              results.push({ userId: user.id, type: 'push', status: 'sent' });
            } catch (e) {
              results.push({ userId: user.id, type: 'push', status: 'failed' });
            }
          }
        }

        if (user.whatsapp_reminder && user.whatsapp_number) {
          results.push({ userId: user.id, type: 'whatsapp', status: 'not_implemented' });
        }
      }

      return json({ success: true, remindersSent: results.length, details: results });
    }

    // Fallback
    return errorJson('Not found', 404);
  } catch (error) {
    Sentry.captureException(error);
    return errorJson('Internal server error', 500);
  }
}

// Translation seed function
async function seedDefaultTranslations() {
  const translations = [
    { key: 'journey', lang: 'en', value: 'Journey' },
    { key: 'training', lang: 'en', value: 'Training' },
    { key: 'habits', lang: 'en', value: 'Habits' },
    { key: 'progress', lang: 'en', value: 'Progress' },
    { key: 'community', lang: 'en', value: 'Community' },
    { key: 'profile', lang: 'en', value: 'Profile' },
    { key: 'leaderboard', lang: 'en', value: 'Leaderboard' },
    { key: 'lessons', lang: 'en', value: 'Lessons' },
    { key: 'videos', lang: 'en', value: 'Videos' },
    { key: 'insights', lang: 'en', value: 'Insights' },
    { key: 'settings', lang: 'en', value: 'Settings' },
    { key: 'darkmode', lang: 'en', value: 'Dark Mode' },
    { key: 'help', lang: 'en', value: 'Help' },
    { key: 'logout', lang: 'en', value: 'Logout' },
    { key: 'tagline', lang: 'en', value: '"Not a promise to get rich, but a journey to become a disciplined trader."' },
    { key: 'welcome', lang: 'en', value: 'Welcome to ATTS' },
    { key: 'journey', lang: 'bn', value: 'যাত্রা' },
    { key: 'training', lang: 'bn', value: 'প্রশিক্ষণ' },
    { key: 'habits', lang: 'bn', value: 'অভ্যাস' },
    { key: 'progress', lang: 'bn', value: 'অগ্রগতি' },
    { key: 'community', lang: 'bn', value: 'কমিউনিটি' },
    { key: 'profile', lang: 'bn', value: 'প্রোফাইল' },
    { key: 'leaderboard', lang: 'bn', value: 'লিডারবোর্ড' },
    { key: 'lessons', lang: 'bn', value: 'লেসন' },
    { key: 'videos', lang: 'bn', value: 'ভিডিও' },
    { key: 'insights', lang: 'bn', value: 'ইনসাইটস' },
    { key: 'settings', lang: 'bn', value: 'সেটিংস' },
    { key: 'darkmode', lang: 'bn', value: 'ডার্ক মোড' },
    { key: 'help', lang: 'bn', value: 'সহায়তা' },
    { key: 'logout', lang: 'bn', value: 'লগআউট' },
    { key: 'tagline', lang: 'bn', value: '"ধনী হওয়ার প্রতিশ্রুতি নয়, একজন শৃঙ্খলাবদ্ধ ট্রেডারে পরিণত হওয়ার যাত্রা।"' },
    { key: 'welcome', lang: 'bn', value: 'এটিটিএস-এ স্বাগতম' },
    { key: 'journey', lang: 'hi', value: 'यात्रा' },
    { key: 'training', lang: 'hi', value: 'प्रशिक्षण' },
    { key: 'habits', lang: 'hi', value: 'आदतें' },
    { key: 'progress', lang: 'hi', value: 'प्रगति' },
    { key: 'community', lang: 'hi', value: 'समुदाय' },
    { key: 'profile', lang: 'hi', value: 'प्रोफ़ाइल' },
    { key: 'leaderboard', lang: 'hi', value: 'लीडरबोर्ड' },
    { key: 'lessons', lang: 'hi', value: 'पाठ' },
    { key: 'videos', lang: 'hi', value: 'वीडियो' },
    { key: 'insights', lang: 'hi', value: 'अंतर्दृष्टि' },
    { key: 'settings', lang: 'hi', value: 'सेटिंग्स' },
    { key: 'darkmode', lang: 'hi', value: 'डार्क मोड' },
    { key: 'help', lang: 'hi', value: 'मदद' },
    { key: 'logout', lang: 'hi', value: 'लॉग आउट' },
    { key: 'tagline', lang: 'hi', value: '"अमीर बनने का वादा नहीं, बल्कि एक अनुशासित व्यापारी बनने की यात्रा।"' },
    { key: 'welcome', lang: 'hi', value: 'ATTS में आपका स्वागत है' },
  ];
  for (const t of translations) {
    await sql`INSERT INTO ui_translations (key, lang, value) VALUES (${t.key}, ${t.lang}, ${t.value}) ON CONFLICT (key, lang) DO NOTHING`;
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, verification_token, ...safe } = user;
  return safe;
}

export { apiHandler };
export default toNodeHandler(apiHandler);