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
import busboy from 'busboy';
import { Resend } from 'resend';
import { z } from 'zod';
import * as Sentry from '@sentry/node';

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

// Sentry initialization
if (SENTRY_DSN) {
  Sentry.init({ dsn: SENTRY_DSN, tracesSampleRate: 0.1 });
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// ---------- Rate limiter (Vercel KV + in-memory fallback) ----------
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

// ---------- Business logic helpers ----------
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
      const diffDays = (prevDate - currDate) / (1000 * 60 * 60 * 24);
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
    f.push(`${userName}, আজ তুমি স্টপ লস সরিয়েছ, যা ঝুঁকি বাড়িয়েছে।`);
    m.push('কাল স্টপ লস অটুট রাখো, এটাই শৃঙ্খলার ভিত।');
  }
  if (journal.revenge_trade) {
    f.push('রিভেঞ্জ ট্রেডিং পেশাদারিত্ব নষ্ট করে, নিজেকে শান্ত রাখো।');
    m.push('কাল কোনো অবস্থাতেই প্রতিশোধমূলক ট্রেড করবে না।');
  }
  if (journal.fomo_entry) {
    f.push('FOMO এন্ট্রি এড়িয়ে চলো, সুযোগ সবসময় আসবে।');
    m.push('প্রতিটি এন্ট্রির আগে ৩ মিনিট বিশ্লেষণ করো।');
  }
  if (journal.overtrading) {
    f.push('ওভারট্রেডিং ক্যাপিটাল ও মাইন্ড দুটোই ক্ষয় করে।');
    m.push('কাল সর্বোচ্চ ২টি ট্রেড করবে, মান বজায় রাখো।');
  }
  const radar = journal.radar_scores;
  if (radar?.planning < 12) f.push('পরিকল্পনা অনুসরণে আরও মনোযোগ দিতে হবে।');
  if (radar?.execution < 12) f.push('এক্সিকিউশন ইম্প্রুভ করো, ছোটখাটো ভুল কমানো দরকার।');
  if (radar?.risk < 6) f.push('রিস্ক ম্যানেজমেন্টে আজ দুর্বলতা ছিল, সাবধান।');
  if (radar?.psychology < 12) f.push('আবেগ নিয়ন্ত্রণে কাজ করতে হবে, এটি প্রফেশনাল ট্রেডারের মূল হাতিয়ার।');
  if (radar?.improvement < 12) f.push('আজকের শিক্ষাকে কাজে লাগিয়ে আগামীকাল আরও ভালো করো।');

  const last7 = await sql`SELECT radar_scores FROM daily_journals WHERE user_id = ${userId} AND date < CURRENT_DATE ORDER BY date DESC LIMIT 7`;
  if (last7.length >= 3) {
    let riskDecline = 0;
    for (let i = 0; i < last7.length - 1; i++) {
      if ((last7[i].radar_scores?.risk || 0) < (last7[i + 1].radar_scores?.risk || 0)) riskDecline++;
      else break;
    }
    if (riskDecline >= 2) f.push('তোমার রিস্ক ম্যানেজমেন্ট গত কয়েকদিন ধরে কমছে, সাবধান।');
    let psychImprove = 0;
    for (let i = 0; i < last7.length - 1; i++) {
      if ((last7[i].radar_scores?.psychology || 0) > (last7[i + 1].radar_scores?.psychology || 0)) psychImprove++;
      else break;
    }
    if (psychImprove >= 2) f.push('তোমার সাইকোলজি ইনডেক্স টানা বেড়েছে, দারুণ উন্নতি!');
  }

  if (journal.rule_followed && journal.scores?.q6 >= 8)
    f.push(`অসাধারণ ${userName}! তুমি আজ একজন সত্যিকারের Rule Follower, অভিনন্দন।`);
  if (f.length === 0) f.push('নিরপেক্ষ দিন, তবে জার্নালিং চালিয়ে যাও এটাই জরুরি।');
  if (m.length === 0) m.push('কাল ট্রেডিং প্ল্যান অনুসরণ করো, ধারাবাহিকতাই শক্তি।');

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
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  display_name: z.string().optional(),
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

// ===================================================
// SECTION 2: Node.js to Fetch API wrapper
// ===================================================
function toNodeHandler(handlerFn) {
  return async (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const fullUrl = `${protocol}://${host}${req.url}`;

    // ---------- Multipart file upload handling ----------
    if (req.method === 'POST' && (req.url.startsWith('/api/setup/admin/upload-image') || req.url.startsWith('/api/setup/upload-image'))) {
      let requiredRole = null;
      if (req.url.startsWith('/api/setup/admin/upload-image')) {
        requiredRole = 'admin';
      }
      
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.writeHead(401, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (requiredRole === 'admin') {
          if (!decoded.role || decoded.role !== 'admin') {
            res.writeHead(403, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
          }
        }
        // For non-admin upload, just ensure user exists (we'll verify user later)
      } catch {
        res.writeHead(401, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }

      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.startsWith('multipart/form-data')) {
        res.writeHead(400, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
        res.end(JSON.stringify({ error: 'Must be multipart/form-data' }));
        return;
      }

      try {
        const bb = busboy({ headers: { 'content-type': contentType }, limits: { fileSize: 5 * 1024 * 1024 } });
        const files = [];
        let aborted = false;

        bb.on('file', (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;
          if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) {
            aborted = true;
            fileStream.resume();
            bb.emit('error', new Error('Invalid file type'));
            return;
          }
          const chunks = [];
          fileStream.on('data', (chunk) => chunks.push(chunk));
          fileStream.on('end', async () => {
            if (aborted) return;
            const buffer = Buffer.concat(chunks);
            let finalUrl = '';
            try {
              const blob = await put(filename, buffer, { access: 'public', contentType: mimeType });
              finalUrl = blob.url;
              await sql`INSERT INTO media_files (url, filename) VALUES (${finalUrl}, ${filename})`;
            } catch (blobError) {
              console.error('Vercel Blob failed, falling back to Base64 storage:', blobError.message);
              Sentry.captureException(blobError);
              const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
              finalUrl = base64;
              await sql`INSERT INTO media_files (url, filename) VALUES (${finalUrl}, ${filename})`;
            }
            files.push(finalUrl);
          });
        });

        bb.on('finish', () => {
          if (aborted) return;
          if (files.length === 0) {
            res.writeHead(400, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
            res.end(JSON.stringify({ error: 'No file uploaded' }));
            return;
          }
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0]
          });
          res.end(JSON.stringify({ url: files[0] }));  // Return first file URL; for multiple we'd return array
        });

        bb.on('error', (err) => {
          console.error('Busboy error:', err);
          Sentry.captureException(err);
          if (!res.headersSent) {
            res.writeHead(400, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
            res.end(JSON.stringify({ error: err.message }));
          }
        });

        req.pipe(bb);
        return;
      } catch (err) {
        Sentry.captureException(err);
        res.writeHead(500, { 'Access-Control-Allow-Origin': allowedOrigins === '*' ? '*' : allowedOrigins[0] });
        res.end(JSON.stringify({ error: 'Internal server error' }));
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
  const fullUrl = req.url.startsWith('http') ? req.url : `${protocol}://${host}${req.url}`;
  const url = new URL(fullUrl);
  let path = url.pathname;

  // Normalize path
  if (path.startsWith('/api/setup')) {
    path = path.replace('/api/setup', '');
  } else if (path.startsWith('/api/')) {
    path = path.replace('/api', '');
  }

  try {
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
        user_id UUID REFERENCES users(id),
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
        user_id UUID REFERENCES users(id),
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

      await sql`CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

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
        current_energy INT DEFAULT 50,
        max_energy INT DEFAULT 50,
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
        mentor_id UUID REFERENCES users(id),
        student_id UUID REFERENCES users(id) UNIQUE,
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
        admin_id UUID REFERENCES admin_users(id),
        action VARCHAR(255) NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // ----- NEW: user_activity_log table -----
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
        user_id UUID REFERENCES users(id),
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

      // ----- ADD INDEXES -----
      await sql`CREATE INDEX IF NOT EXISTS idx_daily_journals_user_date ON daily_journals(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_badges_user ON badges(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_chapters_course ON chapters(course_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_user_chapter_progress_user ON user_chapter_progress(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_community_posts_user ON community_posts(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_habits_logs_user_date ON habit_logs(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date ON mood_logs(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_portfolio_user_date ON portfolio_performance(user_id, date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_daily_quests_user_date ON daily_quests(user_id, quest_date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_chapter_quiz_questions_chapter ON chapter_quiz_questions(chapter_id)`;
      // Index for activity log
      await sql`CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id)`;

      // ----- Seed data -----
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

      const [courseExists] = await sql`SELECT id FROM courses WHERE title = 'Professional Trader Transformation' AND is_active = true`;
      if (!courseExists) {
        await sql`INSERT INTO courses (title, description) VALUES ('Professional Trader Transformation', 'Complete 30-day transformation from amateur to professional trader')`;
        const [course] = await sql`SELECT id FROM courses WHERE title = 'Professional Trader Transformation'`;
        const courseId = course.id;
        const chaptersSeed = [
          { title: 'FOMO (Fear Of Missing Out) – সম্পূর্ণ গাইড', order_index: 1, content_text: `<h2>FOMO কি?</h2><p>FOMO বা Fear Of Missing Out হল একটি মানসিক অবস্থা...</p>`, language: 'bn' },
          { title: 'Risk Management – ঝুঁকি ব্যবস্থাপনার মূলনীতি', order_index: 2, content_text: `<h2>Risk Management কেন জরুরি?</h2><p>...</p>`, language: 'bn' }
        ];
        for (const ch of chaptersSeed) {
          const [chapter] = await sql`INSERT INTO chapters (course_id, title, order_index, content_text, image_url, video_url, passing_score, language) VALUES (${courseId}, ${ch.title}, ${ch.order_index}, ${ch.content_text}, ${null}, ${null}, ${90}, ${ch.language}) RETURNING id`;
          if (ch.order_index === 1) {
            const quizQuestions = [
              { question: 'FOMO এর পূর্ণরূপ কি?', options: ['Fear Of Missing Out','Fast Order Management','Free Online Market','Future Options Market'], correct_index: 0, explanation: 'FOMO = Fear Of Missing Out', language: 'bn' },
              { question: 'FOMO এড়াতে ট্রেডের আগে কতক্ষণ বিশ্লেষণ?', options: ['১ মিনিট','২ মিনিট','৩ মিনিট','৫ মিনিট'], correct_index: 2, explanation: 'ন্যূনতম ৩ মিনিট', language: 'bn' }
            ];
            for (const q of quizQuestions) {
              await sql`INSERT INTO chapter_quiz_questions (chapter_id, question, options, correct_index, explanation, language) VALUES (${chapter.id}, ${q.question}, ${JSON.stringify(q.options)}, ${q.correct_index}, ${q.explanation}, ${q.language})`;
            }
          }
        }
      }

      const { count: aqCount } = (await sql`SELECT COUNT(*)::int FROM assessment_questions`)[0];
      if (aqCount === 0) {
        await sql`INSERT INTO assessment_questions (question, category, order_index) VALUES 
          ('আপনি কি গত ৬ মাসে টানা লোকসান করেছেন?', 'loss', 1),
          ('ক্ষতির পর পুনরায় দ্রুত ট্রেড নেওয়ার তাড়া অনুভব করেন?', 'emotion', 2),
          ('আপনার কি লিখিত ট্রেডিং প্ল্যান আছে?', 'planning', 3),
          ('আপনি কি প্রায়ই স্টপ লস সরিয়ে দেন?', 'risk', 4),
          ('ট্রেড চলাকালে কি আবেগ নিয়ন্ত্রণ হারান?', 'psychology', 5),
          ('আপনি কি দিনে ৩টির বেশি ট্রেড করেন?', 'overtrading', 6),
          ('ক্ষতি পুষিয়ে নিতে বড় লট সাইজ ব্যবহার করেন?', 'revenge', 7),
          ('সোশ্যাল মিডিয়ার টিপস দেখে ট্রেড নেন?', 'fomo', 8),
          ('আপনার কি নির্দিষ্ট রিস্ক ম্যানেজমেন্ট রুলস আছে?', 'discipline', 9),
          ('প্রতিদিন ট্রেডিং জার্নাল লেখেন?', 'journaling', 10)`;
      }

      const { count: bCount } = (await sql`SELECT COUNT(*)::int FROM benefits`)[0];
      if (bCount === 0) {
        await sql`INSERT INTO benefits (title, description, icon) VALUES 
          ('শৃঙ্খলা গড়ে ওঠে', 'প্রতিদিনের জার্নালিং আপনাকে নিয়ম মেনে ট্রেড করতে বাধ্য করবে', '📋'),
          ('আবেগ নিয়ন্ত্রণ', 'ফিয়ার, গ্রিড, FOMO থেকে মুক্তি পেয়ে ঠান্ডা মাথায় সিদ্ধান্ত নেওয়া শিখবেন', '🧘'),
          ('পেশাদার মানসিকতা', 'ট্রেডিংকে ব্যবসা হিসেবে দেখার দক্ষতা অর্জন হবে', '💼'),
          ('ঝুঁকি ব্যবস্থাপনা', 'ক্যাপিটাল বাঁচিয়ে দীর্ঘমেয়াদে টিকে থাকার কৌশল রপ্ত করবেন', '🛡️'),
          ('কমিউনিটি সাপোর্ট', 'সফল ট্রেডারদের সাথে অভিজ্ঞতা বিনিময়ের সুযোগ', '🤝')`;
      }

      return json({ message: 'Database initialized successfully. Indexes and seed data created. Please note the temporary admin password shown in server logs.' });
    }

    // ==================== PUBLIC ROUTES (no auth required) ====================
    if (path === '/auto-login' && req.method === 'GET') {
      const tokenParam = url.searchParams.get('token');
      if (!tokenParam) return errorJson('No token', 400);
      let payload;
      try { payload = jwt.verify(tokenParam, process.env.JWT_SECRET); } catch { return errorJson('Invalid token', 401); }
      let user = (await sql`SELECT * FROM users WHERE email = ${payload.email}`)[0];
      if (!user) user = (await sql`INSERT INTO users (email, password_hash) VALUES (${payload.email}, '') RETURNING *`)[0];
      const newToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      // Log auto-login as user activity
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
        // Log Google login
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
      // Log admin login (could also be stored in admin_activity_log later)
      return json({
        token: adminToken,
        name: adminUser.name,
        role: adminUser.role,
        require_password_change: adminUser.password_change_required || false
      });
    }

    if (path === '/register' && req.method === 'POST') {
      const body = await req.json();
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.issues }, 400);
      const { email, password, display_name, avatar_emoji } = parsed.data;
      const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (existing) return errorJson('Email already registered', 409);
      const hash = await bcrypt.hash(password, 12);
      const verificationToken = uuidv4();
      const name = display_name || email.split('@')[0];
      const [user] = await sql`INSERT INTO users (email, password_hash, display_name, avatar_emoji, verification_token) VALUES (${email}, ${hash}, ${name}, ${avatar_emoji || '🙂'}, ${verificationToken}) RETURNING *`;
      
      // Send verification email
      if (resend) {
        const verifyLink = `${protocol}://${host}/api/setup/verify-email?token=${verificationToken}`;
        try {
          await resend.emails.send({
            from: 'AlamQuant ATTS <noreply@alamquant.com>',
            to: email,
            subject: 'ইমেইল যাচাইকরণ',
            html: `<p>ইমেইল যাচাই করতে এখানে ক্লিক করুন:</p><a href="${verifyLink}">${verifyLink}</a>`
          });
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      // Log registration
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'register', ${JSON.stringify({email})}, ${ip})`;
      return json({ token, user: sanitizeUser(user), message: 'Registration successful. Please verify your email.' });
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
      const body = await req.json();
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) return json({ error: parsed.error.issues }, 400);
      const { email, password, display_name } = parsed.data;
      const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!user || !(await bcrypt.compare(password, user.password_hash))) return errorJson('Invalid credentials', 401);
      if (!user.email_verified) return errorJson('Please verify your email first', 403);
      if (display_name && !user.display_name) {
        await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
        user.display_name = display_name;
      }
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      // Log login
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'login', ${JSON.stringify({email})}, ${ip})`;
      return json({ token, user: sanitizeUser(user) });
    }

    if (path === '/request-password-reset' && req.method === 'POST') {
      const body = await req.json();
      const { email } = body;
      const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;
      if (!user) return json({ message: 'If the email exists, a reset link has been sent.' });
      const resetToken = uuidv4();
      await sql`UPDATE users SET verification_token = ${resetToken} WHERE id = ${user.id}`;
      if (resend) {
        const resetLink = `${protocol}://${host}/api/setup/reset-password?token=${resetToken}`;
        try {
          await resend.emails.send({
            from: 'AlamQuant ATTS <noreply@alamquant.com>',
            to: email,
            subject: 'পাসওয়ার্ড রিসেট',
            html: `<p>পাসওয়ার্ড রিসেট করতে ক্লিক করুন:</p><a href="${resetLink}">${resetLink}</a>`
          });
        } catch (e) {
          Sentry.captureException(e);
        }
      }
      // Log password reset request
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'password_reset_request', ${JSON.stringify({email})}, ${ip})`;
      return json({ message: 'If the email exists, a reset link has been sent.' });
    }

    if (path === '/reset-password' && req.method === 'POST') {
      const body = await req.json();
      const { token: resetToken, new_password } = body;
      if (!new_password || new_password.length < 6) return errorJson('Password must be at least 6 characters', 400);
      const [user] = await sql`SELECT * FROM users WHERE verification_token = ${resetToken}`;
      if (!user) return errorJson('Invalid or expired token', 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE users SET password_hash = ${hash}, verification_token = NULL WHERE id = ${user.id}`;
      // Log password reset
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
      const lang = url.searchParams.get('lang') || 'bn';
      const rows = await sql`SELECT key, value FROM ui_translations WHERE lang = ${lang}`;
      const result = {};
      rows.forEach(r => result[r.key] = r.value);
      return json(result);
    }

    // ---------------- VERIFY CERTIFICATE (PUBLIC) ----------------
    if (path.startsWith('/verify/') && req.method === 'GET') {
      const code = path.split('/').pop();
      const [cert] = await sql`SELECT c.*, u.email, u.display_name FROM certificates c JOIN users u ON c.user_id = u.id WHERE verification_code = ${code}`;
      if (!cert) return json({ valid: false, message: 'সার্টিফিকেট পাওয়া যায়নি' });
      return json({
        valid: true,
        user: maskEmail(cert.email),
        display_name: cert.display_name,
        issued_at: cert.issued_at,
        verification_code: code
      });
    }

    // ---------------- SITE SETTINGS (PUBLIC GET) ----------------
    if (path === '/admin/settings' && req.method === 'GET') {
      const rows = await sql`SELECT * FROM site_settings`;
      const map = {};
      rows.forEach(r => map[r.key] = r.value);
      return json(map);
    }

    // ==================== ADMIN ENDPOINTS (require admin auth) ====================
    if (path === '/admin/settings' && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      if (body && typeof body === 'object') {
        for (const [k, v] of Object.entries(body)) {
          await sql`INSERT INTO site_settings (key, value) VALUES (${k}, ${String(v)}) ON CONFLICT (key) DO UPDATE SET value = ${String(v)}`;
        }
        await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'update_site_settings', ${JSON.stringify(body)})`;
        return json({ success: true });
      } else {
        return errorJson('Invalid settings format', 400);
      }
    }

    if (path === '/admin/media' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const files = await sql`SELECT id, url, filename, uploaded_at FROM media_files ORDER BY uploaded_at DESC`;
      return json(files);
    }

    if (path.match(/^\/admin\/media\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const mediaId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM media_files WHERE id = ${mediaId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'delete_media', ${JSON.stringify({media_id: mediaId})})`;
      return json({ success: true });
    }

    // Vercel Blob URL manually add
    if (path === '/admin/media/url' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const { url } = await req.json();
      if (!url) return errorJson('URL required', 400);
      await sql`INSERT INTO media_files (url, filename) VALUES (${url}, 'manual')`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'add_media_url', ${JSON.stringify({url})})`;
      return json({ success: true });
    }

    if (path === '/admin/translations' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const lang = url.searchParams.get('lang') || 'bn';
      const rows = await sql`SELECT key, value, lang FROM ui_translations WHERE lang = ${lang} ORDER BY key`;
      return json(rows);
    }

    if (path === '/admin/translations' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { key, lang, value } = body;
      if (!key || !lang || !value) return errorJson('key, lang, and value required', 400);
      await sql`INSERT INTO ui_translations (key, lang, value) VALUES (${key}, ${lang}, ${value}) ON CONFLICT (key, lang) DO UPDATE SET value = ${value}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'translation_update', ${JSON.stringify({key, lang})})`;
      return json({ success: true });
    }

    if (path === '/admin/translations/bulk' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { translations } = body;
      for (const t of translations) {
        await sql`INSERT INTO ui_translations (key, lang, value) VALUES (${t.key}, ${t.lang}, ${t.value}) ON CONFLICT (key, lang) DO UPDATE SET value = ${t.value}`;
      }
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'translation_bulk_update', ${JSON.stringify({count: translations.length})})`;
      return json({ success: true });
    }

    if (path === '/admin/dashboard' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const totalUsers = (await sql`SELECT COUNT(*)::int FROM users`)[0].count;
      const dau = (await sql`SELECT COUNT(DISTINCT user_id)::int FROM daily_journals WHERE date = CURRENT_DATE`)[0].count;
      const totalJournals = (await sql`SELECT COUNT(*)::int FROM daily_journals`)[0].count;
      const totalChapters = (await sql`SELECT COUNT(*)::int FROM chapters WHERE is_active = true`)[0].count;
      const completedTrainings = (await sql`SELECT COUNT(*)::int FROM final_exam_results WHERE passed = true`)[0].count;
      return json({ totalUsers, dailyActiveUsers: dau, totalJournals, totalChapters, completedTrainings, completionRate: totalUsers ? Math.round(completedTrainings/totalUsers*100) : 0 });
    }

    // ------------------ PAGINATED USERS ------------------
    if (path === '/admin/users' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = 20;
      const offset = (page - 1) * limit;
      const search = url.searchParams.get('search') || '';

      let baseQuery = sql`SELECT id, email, display_name, identity_level, xp, level, avatar_emoji, email_verified FROM users`;
      if (search) {
        baseQuery = sql`${baseQuery} WHERE email ILIKE ${'%'+search+'%'} OR display_name ILIKE ${'%'+search+'%'}`;
      }
      const countQuery = search ? 
        sql`SELECT COUNT(*)::int FROM users WHERE email ILIKE ${'%'+search+'%'} OR display_name ILIKE ${'%'+search+'%'}` :
        sql`SELECT COUNT(*)::int FROM users`;
      
      const total = (await countQuery)[0].count;
      const users = await sql`${baseQuery} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
      return json({ users, total, page, totalPages: Math.ceil(total / limit) });
    }

    if (path.match(/^\/admin\/user\/(.+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const userId = path.split('/')[3];
      await sql`DELETE FROM users WHERE id = ${userId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'user_delete', ${JSON.stringify({deleted_user_id: userId})})`;
      return json({ success: true });
    }

    if (path === '/admin/reset-password' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { user_id, new_password } = body;
      if (!user_id || !new_password || new_password.length < 6) return errorJson('Invalid input', 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user_id}`;
      // Log admin password reset in user activity as well
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user_id}, 'password_reset_by_admin', ${JSON.stringify({admin_id: adminUser.id})}, ${ip})`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'user_password_reset', ${JSON.stringify({user_id})})`;
      return json({ success: true });
    }

    if (path === '/admin/change-password' && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { current_password, new_password } = body;
      const valid = await bcrypt.compare(current_password, adminUser.password_hash);
      if (!valid) return errorJson('Current password incorrect', 400);
      if (!new_password || new_password.length < 6) return errorJson('New password must be at least 6 characters', 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE admin_users SET password_hash = ${hash}, password_change_required = false WHERE id = ${adminUser.id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'admin_password_change', ${JSON.stringify({})})`;
      return json({ success: true });
    }

    // ---------------- IMPERSONATE ----------------
    if (path === '/admin/impersonate' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { user_id } = body;
      const [user] = await sql`SELECT * FROM users WHERE id = ${user_id}`;
      if (!user) return errorJson('User not found', 404);
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'impersonate', ${JSON.stringify({impersonated_user_id: user_id})})`;
      return json({ token, user: sanitizeUser(user) });
    }

    // Admin Chapters CRUD (with language support)
    if (path === '/admin/chapters' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const courseId = url.searchParams.get('course_id') || 1;
      const lang = url.searchParams.get('lang') || 'bn';
      const chapters = await sql`
        SELECT c.*, 
               (SELECT COUNT(*)::int FROM chapter_quiz_questions WHERE chapter_id = c.id) as question_count,
               (SELECT COUNT(*)::int FROM user_chapter_progress WHERE chapter_id = c.id AND passed = true) as passed_count
        FROM chapters c WHERE c.course_id = ${courseId} AND c.language = ${lang} ORDER BY c.order_index
      `;
      return json(chapters);
    }

    if (path === '/admin/chapter' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { course_id, title, order_index, content_text, image_url, video_url, images, videos, passing_score, language } = body;
      const lang = language || 'bn';
      const [chapter] = await sql`INSERT INTO chapters (course_id, title, order_index, content_text, image_url, video_url, images, videos, passing_score, language) VALUES (${course_id}, ${title}, ${order_index}, ${content_text}, ${image_url}, ${video_url}, ${JSON.stringify(images || [])}, ${JSON.stringify(videos || [])}, ${passing_score || 90}, ${lang}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'chapter_create', ${JSON.stringify(chapter)})`;
      return json(chapter, 201);
    }

    if (path.match(/^\/admin\/chapter\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const chapterId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { title, order_index, content_text, image_url, video_url, images, videos, passing_score, is_active, language } = body;
      await sql`UPDATE chapters SET title=COALESCE(${title}, title), order_index=COALESCE(${order_index}, order_index), content_text=COALESCE(${content_text}, content_text), image_url=COALESCE(${image_url}, image_url), video_url=COALESCE(${video_url}, video_url), images=COALESCE(${images ? JSON.stringify(images) : null}::jsonb, images), videos=COALESCE(${videos ? JSON.stringify(videos) : null}::jsonb, videos), passing_score=COALESCE(${passing_score}, passing_score), is_active=COALESCE(${is_active}, is_active), language=COALESCE(${language}, language) WHERE id=${chapterId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'chapter_update', ${JSON.stringify({chapter_id: chapterId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/chapter\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const chapterId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM chapters WHERE id = ${chapterId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'chapter_delete', ${JSON.stringify({chapter_id: chapterId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/chapter\/(\d+)\/questions$/) && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const chapterId = parseInt(path.split('/')[3]);
      const questions = await sql`SELECT * FROM chapter_quiz_questions WHERE chapter_id = ${chapterId} ORDER BY order_index, id`;
      return json(questions);
    }

    if (path.match(/^\/admin\/chapter\/(\d+)\/question$/) && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const chapterId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { question, options, correct_index, explanation, order_index, language } = body;
      const lang = language || 'bn';
      const [q] = await sql`INSERT INTO chapter_quiz_questions (chapter_id, question, options, correct_index, explanation, order_index, language) VALUES (${chapterId}, ${question}, ${JSON.stringify(options)}, ${correct_index}, ${explanation}, ${order_index || 0}, ${lang}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'question_create', ${JSON.stringify(q)})`;
      return json(q, 201);
    }

    if (path.match(/^\/admin\/question\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const questionId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { question, options, correct_index, explanation, order_index, language } = body;
      await sql`UPDATE chapter_quiz_questions SET question=COALESCE(${question}, question), options=COALESCE(${JSON.stringify(options)}::jsonb, options), correct_index=COALESCE(${correct_index}, correct_index), explanation=COALESCE(${explanation}, explanation), order_index=COALESCE(${order_index}, order_index), language=COALESCE(${language}, language) WHERE id=${questionId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'question_update', ${JSON.stringify({question_id: questionId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/question\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const questionId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM chapter_quiz_questions WHERE id = ${questionId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'question_delete', ${JSON.stringify({question_id: questionId})})`;
      return json({ success: true });
    }

    // Admin Simulate Days
    if (path === '/admin/simulate-day' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { email, days, start_day } = body;
      const targetUser = (await sql`SELECT id FROM users WHERE email = ${email}`)[0];
      if (!targetUser) return errorJson('User not found', 404);
      const userId = targetUser.id;
      const totalDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
      const startOffset = Math.min(Math.max(parseInt(start_day) || 1, 1), 30);
      const startDate = new Date(); startDate.setDate(startDate.getDate() - (startOffset - 1));
      let inserted = 0;
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate); date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().slice(0,10);
        if (dateStr > new Date().toISOString().slice(0,10)) break;
        const [existing] = await sql`SELECT id FROM daily_journals WHERE user_id = ${userId} AND date = ${dateStr}`;
        if (existing) continue;
        const scores = {};
        for (let i=1; i<=10; i++) scores['q'+i] = Math.floor(Math.random()*10)+1;
        const radar = calculateRadarScores(scores);
        await sql`INSERT INTO daily_journals (user_id, date, mindfulness_done, commitment, trades_count, stop_loss_moved, revenge_trade, fomo_entry, overtrading, rule_followed, scores, radar_scores, evaluation_notes, reflection, feedback, tomorrow_mission) VALUES (${userId}, ${dateStr}, true, 'Simulated', ${Math.floor(Math.random()*5)+1}, ${Math.random()>0.7}, ${Math.random()>0.8}, ${Math.random()>0.7}, ${Math.random()>0.8}, ${scores.q6>=8}, ${JSON.stringify(scores)}, ${JSON.stringify(radar)}, 'Simulated', 'Simulated', 'Good job!', 'Keep it up')`;
        inserted++;
      }
      const { count: totalJournals } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${userId}`)[0];
      const phase = computeIdentityPhase(totalJournals);
      await sql`UPDATE users SET identity_level = ${phase}, xp = xp + ${inserted * 3} WHERE id = ${userId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'simulate_days', ${JSON.stringify({user_id: userId, inserted})})`;
      return json({ success: true, inserted_days: inserted });
    }

    if (path === '/admin/community' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const posts = await sql`SELECT cp.*, u.email as author, u.display_name, u.avatar_emoji FROM community_posts cp JOIN users u ON cp.user_id = u.id ORDER BY cp.created_at DESC LIMIT 100`;
      return json(posts.map(p => ({ ...p, author: maskEmail(p.author), display_name: p.display_name || p.author.split('@')[0] })));
    }

    if (path.match(/^\/admin\/posts\/(.+)\/hide$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const postId = path.split('/')[3];
      const body = await req.json();
      const { hide } = body;
      await sql`UPDATE community_posts SET is_hidden = ${hide} WHERE id = ${postId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'post_visibility_change', ${JSON.stringify({post_id: postId, hidden: hide})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/posts\/(.+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const postId = path.split('/')[3];
      await sql`DELETE FROM community_posts WHERE id = ${postId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'post_delete', ${JSON.stringify({post_id: postId})})`;
      return json({ success: true });
    }

    // ------------------ ADMIN CONTENT DELETE (SQL injection fix) ------------------
    if (path.match(/^\/admin\/content\/(lesson|quiz|video)\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const [type, idStr] = path.split('/').slice(-2);
      const id = parseInt(idStr);
      const tableMap = { lesson: 'lessons', quiz: 'quizzes', video: 'video_library' };
      const table = tableMap[type];
      if (!table) return errorJson('Invalid type', 400);
      await sql`DELETE FROM ${sql(table)} WHERE id = ${id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'content_delete', ${JSON.stringify({type, id})})`;
      return json({ success: true });
    }

    if (path === '/admin/content' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { type } = body;
      if (type === 'lesson') {
        const { day, phase, title, content } = body;
        await sql`INSERT INTO lessons (day, phase, title, content) VALUES (${day}, ${phase}, ${title}, ${content})`;
      } else if (type === 'quiz') {
        const { question, options, correct } = body;
        await sql`INSERT INTO quizzes (question, options, correct) VALUES (${question}, ${JSON.stringify(options)}, ${correct})`;
      } else if (type === 'video') {
        const { category, title, description, youtube_id, duration } = body;
        await sql`INSERT INTO video_library (category, title, description, youtube_id, duration) VALUES (${category}, ${title}, ${description}, ${youtube_id}, ${duration})`;
      } else {
        return errorJson('Invalid content type', 400);
      }
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'content_add', ${JSON.stringify(body)})`;
      return json({ success: true });
    }

    if (path === '/admin/content/list' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const type = url.searchParams.get('type') || 'lesson';
      if (type === 'lesson') {
        const lessons = await sql`SELECT * FROM lessons ORDER BY day`;
        return json(lessons);
      } else if (type === 'quiz') {
        const quizzes = await sql`SELECT * FROM quizzes ORDER BY id`;
        return json(quizzes);
      } else if (type === 'video') {
        const videos = await sql`SELECT * FROM video_library ORDER BY category, id`;
        return json(videos);
      }
      return errorJson('Invalid type', 400);
    }

    if (path.match(/^\/admin\/content\/(lesson|quiz|video)\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const [type, idStr] = path.split('/').slice(-2);
      const id = parseInt(idStr);
      const body = await req.json();
      if (type === 'lesson') {
        const { day, phase, title, content } = body;
        await sql`UPDATE lessons SET day=${day}, phase=${phase}, title=${title}, content=${content} WHERE id=${id}`;
      } else if (type === 'quiz') {
        const { question, options, correct } = body;
        await sql`UPDATE quizzes SET question=${question}, options=${JSON.stringify(options)}, correct=${correct} WHERE id=${id}`;
      } else if (type === 'video') {
        const { category, title, description, youtube_id, duration } = body;
        await sql`UPDATE video_library SET category=${category}, title=${title}, description=${description}, youtube_id=${youtube_id}, duration=${duration} WHERE id=${id}`;
      }
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'content_update', ${JSON.stringify({type, id})})`;
      return json({ success: true });
    }

    // ---------------- COURSE CRUD ----------------
    if (path === '/admin/courses' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const courses = await sql`SELECT * FROM courses ORDER BY created_at DESC`;
      return json(courses);
    }
    if (path === '/admin/course' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const body = await req.json();
      const { title, description } = body;
      const [course] = await sql`INSERT INTO courses (title, description) VALUES (${title}, ${description}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'course_create', ${JSON.stringify(course)})`;
      return json(course, 201);
    }
    if (path.match(/^\/admin\/course\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const courseId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { title, description, is_active } = body;
      await sql`UPDATE courses SET title=${title}, description=${description}, is_active=${is_active} WHERE id=${courseId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'course_update', ${JSON.stringify({courseId})})`;
      return json({ success: true });
    }
    if (path.match(/^\/admin\/course\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const courseId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM courses WHERE id = ${courseId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'course_delete', ${JSON.stringify({courseId})})`;
      return json({ success: true });
    }

    // Activity Log
    if (path === '/admin/activity-log' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const logs = await sql`
        SELECT al.*, au.email as admin_email, au.name as admin_name
        FROM admin_activity_log al
        JOIN admin_users au ON al.admin_id = au.id
        ORDER BY al.created_at DESC
        LIMIT 100
      `;
      return json(logs);
    }

    // User Export CSV
    if (path === '/admin/users/export' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const users = await sql`SELECT id, email, display_name, identity_level, xp, level, created_at FROM users ORDER BY created_at DESC`;
      const csv = ['id,email,display_name,identity_level,xp,level,created_at']
        .concat(users.map(u => `${u.id},${u.email},${u.display_name},${u.identity_level},${u.xp},${u.level},${u.created_at}`))
        .join('\n');
      return new Response(csv, {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="users.csv"' }
      });
    }

    // System Health
    if (path === '/admin/health' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return errorJson('Forbidden', 403);
      const dbCheck = await sql`SELECT 1 as ok`;
      return json({
        database: dbCheck.length > 0 ? 'connected' : 'error',
        tables: {
          users: (await sql`SELECT COUNT(*)::int FROM users`)[0].count,
          journals: (await sql`SELECT COUNT(*)::int FROM daily_journals`)[0].count,
          chapters: (await sql`SELECT COUNT(*)::int FROM chapters`)[0].count,
        }
      });
    }

    // ==================== AUTH REQUIRED USER ROUTES ====================
    const user = await authenticate(req);
    if (!user) return errorJson('Authentication required', 401);

    // --- NEW: User image upload (non-admin) ---
    if (path === '/upload-image' && req.method === 'POST') {
      // Already handled in toNodeHandler's multipart section, but we need to ensure it's also reachable here.
      // However, our toNodeHandler intercepts before apiHandler. Since we added '/upload-image' path check there, it works.
      return json({ message: 'Use multipart/form-data' }); // not reached
    }

    // --- Mood ---
    if (path === '/mood' && req.method === 'POST') {
      const body = await req.json();
      const { mood, date } = body;
      await sql`INSERT INTO mood_logs (user_id, date, mood) VALUES (${user.id}, ${date || new Date().toISOString().slice(0,10)}, ${mood}) ON CONFLICT (user_id, date) DO UPDATE SET mood = ${mood}`;
      // Log mood
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'mood_logged', ${JSON.stringify({mood, date})}, ${ip})`;
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'claim_quest', ${JSON.stringify({quest_id: quest.id})}, ${ip})`;
      return json({ success: true, xp: 15 });
    }

    // --- Streak Freeze ---
    if (path === '/use-streak-freeze' && req.method === 'POST') {
      const [item] = await sql`SELECT quantity FROM streak_freeze_items WHERE user_id = ${user.id}`;
      if (!item || item.quantity < 1) return errorJson('No freeze available', 400);
      await sql`UPDATE streak_freeze_items SET quantity = quantity - 1 WHERE user_id = ${user.id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'use_streak_freeze', ${JSON.stringify({})}, ${ip})`;
      return json({ success: true, remaining: item.quantity - 1 });
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
        await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'claim_daily_reward', ${JSON.stringify({})}, ${ip})`;
        return json({ claimed: true, xp: 1 });
      }
      return json({ claimed: false, message: 'আজকের বোনাস নেওয়া হয়ে গেছে' });
    }

    // --- Mystery Box ---
    if (path === '/open-box' && req.method === 'POST') {
      const [box] = await sql`SELECT * FROM mystery_boxes WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (box?.opened) return json({ opened: false, message: 'আজ বক্স খোলা হয়ে গেছে' });
      const rewards = ['+3 XP', '+5 XP', 'বিশেষ ব্যাজ "লাকি ট্রেডার"', '+2 XP', 'Streak Freeze'];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      if (!box) await sql`INSERT INTO mystery_boxes (user_id, date, opened, reward) VALUES (${user.id}, CURRENT_DATE, true, ${reward})`;
      else await sql`UPDATE mystery_boxes SET opened = true, reward = ${reward} WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (reward.includes('XP')) {
        const xp = parseInt(reward);
        await sql`UPDATE users SET xp = xp + ${xp} WHERE id = ${user.id}`;
      } else if (reward.includes('লাকি ট্রেডার')) {
        await sql`INSERT INTO badges (user_id, badge_type) VALUES (${user.id}, 'lucky-trader') ON CONFLICT DO NOTHING`;
      } else if (reward === 'Streak Freeze') {
        await sql`INSERT INTO streak_freeze_items (user_id, quantity) VALUES (${user.id}, 1) ON CONFLICT (user_id) DO UPDATE SET quantity = streak_freeze_items.quantity + 1`;
      }
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'open_mystery_box', ${JSON.stringify({reward})}, ${ip})`;
      return json({ reward });
    }

    // --- Community Reactions ---
    if (path === '/reaction' && req.method === 'POST') {
      const body = await req.json();
      const { post_id, reaction } = body;
      if (!['👍','🔥','❤️'].includes(reaction)) return errorJson('Invalid reaction', 400);
      await sql`UPDATE community_posts SET reactions = jsonb_set(COALESCE(reactions, '{}'), ARRAY[${reaction}], COALESCE((reactions->>${reaction})::int, 0)::int + 1::text::jsonb) WHERE id = ${post_id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'react_post', ${JSON.stringify({post_id, reaction})}, ${ip})`;
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
      const userData = {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        identity_level: user.identity_level,
        xp: user.xp,
        level: calculateLevel(user.xp),
        avatar_emoji: user.avatar_emoji,
        is_admin: !!adminExists
      };
      return json({
        user: userData,
        today_entry: today,
        totalDays: total,
        streak,
        disciplineStreak
      });
    }

    if (path === '/profile' && req.method === 'POST') {
      const body = await req.json();
      const { avatar_emoji, display_name } = body;
      if (avatar_emoji) await sql`UPDATE users SET avatar_emoji = ${avatar_emoji} WHERE id = ${user.id}`;
      if (display_name) await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'profile_update', ${JSON.stringify(body)}, ${ip})`;
      return json({ success: true });
    }

    // --- Checkin ---
    if (path === '/checkin' && req.method === 'POST') {
      const body = await req.json();
      const { mindfulness_done, commitment, date } = body;
      const effectiveDate = date || new Date().toISOString().slice(0,10);
      await sql`INSERT INTO daily_journals (user_id, date, mindfulness_done, commitment) VALUES (${user.id}, ${effectiveDate}, ${mindfulness_done}, ${commitment}) ON CONFLICT (user_id, date) DO UPDATE SET mindfulness_done = ${mindfulness_done}, commitment = ${commitment}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'checkin', ${JSON.stringify({mindfulness_done, commitment})}, ${ip})`;
      return json({ success: true });
    }

    // --- Evaluation (with Zod) ---
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

      // Log evaluation
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'evaluation_submitted', ${JSON.stringify({date: effectiveDate, q6: scores.q6})}, ${ip})`;

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
      const mistakes = { 'স্টপ লস সরানো': mc.sl_moved, 'রিভেঞ্জ ট্রেড': mc.revenge, 'FOMO': mc.fomo, 'ওভারট্রেডিং': mc.overtrade };
      const topMistake = Object.entries(mistakes).sort((a,b) => b[1]-a[1])[0];
      const avgDiscipline = (await sql`SELECT AVG((scores->>'q6')::int)::float FROM daily_journals WHERE user_id = ${user.id}`)[0].avg;
      return json({ totalJournals, currentStreak, topMistake: topMistake[1] > 0 ? topMistake[0] : 'কোনো ভুল নেই!', avgDiscipline });
    }

    // --- Lessons ---
    if (path === '/lessons' && req.method === 'GET') {
      const lessons = await sql`SELECT l.*, ul.completed_at FROM lessons l LEFT JOIN user_lessons ul ON l.id = ul.lesson_id AND ul.user_id = ${user.id} ORDER BY l.day`;
      return json(lessons);
    }
    if (path === '/complete-lesson' && req.method === 'POST') {
      const body = await req.json();
      const { lesson_id } = body;
      await sql`INSERT INTO user_lessons (user_id, lesson_id) VALUES (${user.id}, ${lesson_id}) ON CONFLICT DO NOTHING`;
      await sql`UPDATE users SET xp = xp + 3 WHERE id = ${user.id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'complete_lesson', ${JSON.stringify({lesson_id})}, ${ip})`;
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'create_post', ${JSON.stringify({post_type})}, ${ip})`;
      return json({ success: true });
    }
    if (path === '/like-post' && req.method === 'POST') {
      const body = await req.json();
      const { post_id } = body;
      await sql`UPDATE community_posts SET likes = likes + 1 WHERE id = ${post_id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'like_post', ${JSON.stringify({post_id})}, ${ip})`;
      return json({ success: true });
    }
    if (path === '/reply-post' && req.method === 'POST') {
      const body = await req.json();
      const { post_id, content } = body;
      await sql`INSERT INTO replies (post_id, user_id, content) VALUES (${post_id}, ${user.id}, ${content})`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'reply_post', ${JSON.stringify({post_id})}, ${ip})`;
      return json({ success: true });
    }
    if (path === '/replies' && req.method === 'GET') {
      const postId = url.searchParams.get('post_id');
      const replies = await sql`SELECT r.*, u.email, u.display_name, u.avatar_emoji FROM replies r JOIN users u ON r.user_id = u.id WHERE post_id = ${postId} ORDER BY created_at ASC`;
      return json(replies.map(r => ({ ...r, email: maskEmail(r.email), display_name: r.display_name || r.email.split('@')[0] })));
    }

    // --- Leaderboard ---
    if (path === '/leaderboard' && req.method === 'GET') {
      const lb = await sql`SELECT u.id as user_id, u.email, u.display_name, u.avatar_emoji, AVG((daily_journals.scores->>'q6')::int)::float as avg_discipline FROM daily_journals JOIN users u ON daily_journals.user_id = u.id WHERE daily_journals.date > CURRENT_DATE - INTERVAL '7 days' GROUP BY u.id, u.email, u.display_name, u.avatar_emoji ORDER BY avg_discipline DESC LIMIT 10`;
      return json(lb.map(u => ({ ...u, user_id: u.user_id, email: maskEmail(u.email), display_name: u.display_name || u.email.split('@')[0] })));
    }

    // --- Quiz ---
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
      if (correct) { await sql`UPDATE users SET xp = xp + 10 WHERE id = ${user.id}`; await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'quiz_correct', ${JSON.stringify({quiz_id})}, ${ip})`; return json({ correct: true, message: 'Correct! +10 XP' }); }
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'update_notif_settings', ${JSON.stringify({email_enabled: email, push_enabled: push})}, ${ip})`;
      return json({ success: true });
    }
    if (path === '/save-subscription' && req.method === 'POST') {
      const body = await req.json();
      const { subscription } = body;
      if (!subscription) return errorJson('Missing subscription', 400);
      await sql`INSERT INTO notif_settings (user_id, push_enabled, push_subscription) VALUES (${user.id}, true, ${subscription}) ON CONFLICT (user_id) DO UPDATE SET push_subscription = ${subscription}`;
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'create_habit', ${JSON.stringify({habit_id: habit.id, title})}, ${ip})`;
      return json(habit, 201);
    }
    if (path.match(/^\/habits\/definitions\/(.+)$/) && req.method === 'PUT') {
      const habitId = path.split('/')[3];
      const body = await req.json();
      const { title, icon, color, reminder_times } = body;
      const times = typeof reminder_times === 'string' ? reminder_times.split(',').map(t=>t.trim()).filter(t=>t) : (reminder_times || []);
      await sql`UPDATE habit_definitions SET title=${title}, icon=${icon}, color=${color}, reminder_times=${JSON.stringify(times)} WHERE id=${habitId} AND user_id=${user.id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'update_habit', ${JSON.stringify({habitId})}, ${ip})`;
      return json({ success: true });
    }
    if (path.match(/^\/habits\/definitions\/(.+)$/) && req.method === 'DELETE') {
      const habitId = path.split('/')[3];
      await sql`DELETE FROM habit_definitions WHERE id=${habitId} AND user_id=${user.id}`;
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'delete_habit', ${JSON.stringify({habitId})}, ${ip})`;
      return json({ success: true });
    }
    if (path === '/habits/logs' && req.method === 'GET') {
      const date = url.searchParams.get('date') || new Date().toISOString().slice(0,10);
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'toggle_habit_time', ${JSON.stringify({habit_id, time, completed})}, ${ip})`;
      return json({ success: true });
    }

    // ==================== TRAINING & SIMULATOR ENDPOINTS ====================
    if (path === '/training/chapters' && req.method === 'GET') {
      const courseId = url.searchParams.get('course_id') || 1;
      const lang = url.searchParams.get('lang') || 'bn';
      const chapters = await sql`
        SELECT c.*, 
               COALESCE(ucp.passed, false) as passed, 
               COALESCE(ucp.best_score, 0) as best_score,
               COALESCE(ucp.quiz_attempts, 0) as quiz_attempts,
               ucp.completed_at
        FROM chapters c
        LEFT JOIN user_chapter_progress ucp ON c.id = ucp.chapter_id AND ucp.user_id = ${user.id}
        WHERE c.course_id = ${courseId} AND c.is_active = true AND c.language = ${lang}
        ORDER BY c.order_index
      `;
      return json(chapters);
    }

    if (path.match(/^\/training\/chapter\/(\d+)$/) && req.method === 'GET') {
      const chapterId = parseInt(path.split('/')[3]);
      const lang = url.searchParams.get('lang') || 'bn';
      const [chapter] = await sql`SELECT * FROM chapters WHERE id = ${chapterId} AND is_active = true AND language = ${lang}`;
      if (!chapter) return errorJson('Chapter not found', 404);
      const questions = await sql`SELECT id, question, options, order_index FROM chapter_quiz_questions WHERE chapter_id = ${chapterId} AND language = ${lang} ORDER BY order_index, id`;
      const [progress] = await sql`SELECT * FROM user_chapter_progress WHERE user_id = ${user.id} AND chapter_id = ${chapterId}`;
      const [energy] = await sql`SELECT current_energy FROM user_energy WHERE user_id = ${user.id}`;
      return json({ ...chapter, questions, user_progress: progress || null, energy: energy?.current_energy || 50 });
    }

    if (path.match(/^\/training\/chapter\/(\d+)\/quiz$/) && req.method === 'POST') {
      const chapterId = parseInt(path.split('/')[3]);
      const body = await req.json();
      const { answers } = body;
      const [energy] = await sql`SELECT current_energy FROM user_energy WHERE user_id = ${user.id}`;
      if (!energy || energy.current_energy < 5) {
        return errorJson('পর্যাপ্ত এনার্জি নেই!', 400);
      }
      const questions = await sql`SELECT * FROM chapter_quiz_questions WHERE chapter_id = ${chapterId} ORDER BY id`;
      let correct = 0;
      const total = questions.length;
      for (const q of questions) {
        const userAns = answers.find(a => a.question_id === q.id);
        if (userAns && userAns.selected_index === q.correct_index) correct++;
      }
      const score = total > 0 ? (correct / total) * 100 : 0;
      const [chapter] = await sql`SELECT passing_score FROM chapters WHERE id = ${chapterId}`;
      const passed = score >= (chapter.passing_score || 90);

      await sql`
        INSERT INTO user_chapter_progress (user_id, chapter_id, quiz_attempts, best_score, passed, completed_at, last_attempt_at)
        VALUES (${user.id}, ${chapterId}, 1, ${score}, ${passed}, ${passed ? new Date().toISOString() : null}, NOW())
        ON CONFLICT (user_id, chapter_id) DO UPDATE SET
          quiz_attempts = user_chapter_progress.quiz_attempts + 1,
          best_score = GREATEST(COALESCE(user_chapter_progress.best_score, 0), ${score}),
          passed = ${passed},
          completed_at = CASE WHEN ${passed} THEN NOW() ELSE user_chapter_progress.completed_at END,
          last_attempt_at = NOW()
      `;
      const energyCost = passed ? 5 : 10;
      await sql`UPDATE user_energy SET current_energy = GREATEST(0, current_energy - ${energyCost}) WHERE user_id = ${user.id}`;
      if (passed) await sql`UPDATE users SET xp = xp + 20 WHERE id = ${user.id}`;

      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'chapter_quiz', ${JSON.stringify({chapterId, score, passed})}, ${ip})`;

      return json({
        score, passed, total, correct, passing_score: chapter.passing_score,
        xp_earned: passed ? 20 : 0, energy_cost: energyCost,
        message: passed ? 'অভিনন্দন! আপনি পাস করেছেন।' : `আপনার স্কোর ${score.toFixed(0)}%। পাসিং স্কোর ${chapter.passing_score}%। পুনরায় পড়ুন।`
      });
    }

    if (path === '/training/final-exam' && req.method === 'GET') {
      const [existing] = await sql`SELECT * FROM final_exam_results WHERE user_id = ${user.id} AND passed = true`;
      if (existing) return json({ message: 'ইতিমধ্যে উত্তীর্ণ', score: existing.score, passed: true });

      const chapters = await sql`SELECT id FROM chapters WHERE course_id = 1 AND is_active = true ORDER BY order_index`;
      const passedChapters = await sql`SELECT chapter_id FROM user_chapter_progress WHERE user_id = ${user.id} AND passed = true`;
      const passedSet = new Set(passedChapters.map(r => r.chapter_id));
      if (chapters.some(ch => !passedSet.has(ch.id))) {
        return errorJson('সব চ্যাপ্টার পাস করা আবশ্যক', 400);
      }

      const startTime = new Date();
      const expiry = new Date(startTime.getTime() + 20 * 60 * 1000);
      const [session] = await sql`INSERT INTO exam_sessions (user_id, start_time, expiry) VALUES (${user.id}, ${startTime}, ${expiry}) RETURNING id, start_time, expiry`;

      const questions = await sql`
        SELECT id, question, options FROM chapter_quiz_questions
        WHERE chapter_id IN (SELECT id FROM chapters WHERE course_id = 1 AND is_active = true)
        ORDER BY RANDOM() LIMIT 30
      `;
      return json({
        session_id: session.id,
        start_time: session.start_time,
        expiry: session.expiry,
        questions,
        total: questions.length,
        passing_score: 80
      });
    }

    if (path === '/training/final-exam' && req.method === 'POST') {
      const body = await req.json();
      const { session_id, answers } = body;
      const [session] = await sql`SELECT * FROM exam_sessions WHERE id = ${session_id} AND user_id = ${user.id}`;
      if (!session || session.status !== 'active' || new Date() > new Date(session.expiry)) {
        return errorJson('Time expired or invalid session', 400);
      }

      const questionIds = answers.map(a => a.question_id);
      const questions = await sql`SELECT id, correct_index FROM chapter_quiz_questions WHERE id = ANY(${questionIds})`;
      let correct = 0;
      for (const q of questions) {
        const userAns = answers.find(a => a.question_id === q.id);
        if (userAns && userAns.selected_index === q.correct_index) correct++;
      }
      const total = questions.length;
      const score = total ? (correct / total) * 100 : 0;
      const passed = score >= 80;

      await sql`
        INSERT INTO final_exam_results (user_id, score, passed, total_questions, correct_answers)
        VALUES (${user.id}, ${score}, ${passed}, ${total}, ${correct})
        ON CONFLICT (user_id) DO UPDATE SET score = ${score}, passed = ${passed}, total_questions = ${total}, correct_answers = ${correct}, attempted_at = NOW()
      `;
      await sql`UPDATE exam_sessions SET status = 'completed' WHERE id = ${session_id}`;
      if (passed) await sql`UPDATE users SET xp = xp + 100 WHERE id = ${user.id}`;

      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'final_exam', ${JSON.stringify({score, passed})}, ${ip})`;

      return json({
        score, passed, total, correct, xp_earned: passed ? 100 : 0,
        message: passed ? 'অভিনন্দন! ফাইনাল পরীক্ষায় উত্তীর্ণ!' : `স্কোর ${score.toFixed(0)}%, পাসিং 80%`
      });
    }

    if (path === '/certificate' && req.method === 'GET') {
      const { count: totalJournals } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0];
      if (totalJournals < 1) return errorJson('কোনো জার্নাল নেই', 400);
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'certificate_download', ${JSON.stringify({verification_code: verificationId})}, ${ip})`;
      return new Response(svg, {
        headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': 'attachment; filename="certificate.svg"' }
      });
    }

    if (path === '/energy' && req.method === 'GET') {
      const today = new Date().toISOString().slice(0,10);
      const [energy] = await sql`SELECT * FROM user_energy WHERE user_id = ${user.id}`;
      if (!energy) {
        await sql`INSERT INTO user_energy (user_id, current_energy, max_energy, last_reset_date) VALUES (${user.id}, 50, 50, ${today})`;
        return json({ current_energy: 50, max_energy: 50 });
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
        { market_condition: 'Bullish Trend', chart_description: 'Nifty 50 has been rising for 3 days. RSI 72.', options: ['Buy with full position','Buy half','Wait for pullback','Short sell'], correct_index: 2, explanation: 'RSI overbought, pullback likely.' },
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
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'simulator_answer', ${JSON.stringify({scenario_id, isCorrect})}, ${ip})`;
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
      if (yesCount >= 7) recommendation = "আপনার ট্রেডিংয়ে গুরুতর শৃঙ্খলাহীনতা রয়েছে। আমাদের প্রোগ্রাম আপনাকে সম্পূর্ণ বদলে দেবে।";
      else if (yesCount >= 4) recommendation = "আপনার কিছু জায়গায় উন্নতি দরকার। ট্রেনিং আপনার কার্যকারিতা বাড়াবে।";
      else recommendation = "আপনি ভাল অবস্থায় আছেন, তবু আরও ধারালো হতে আমাদের ট্রেনিং সহায়ক হবে।";
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'assessment', ${JSON.stringify({yesCount, total: answers.length})}, ${ip})`;
      return json({ yesCount, total: answers.length, recommendation });
    }

    // --- AI Coach ---
    if (path === '/ai/coach' && req.method === 'POST') {
      if (OPENAI_API_KEY) {
        const journals = await sql`SELECT scores, stop_loss_moved, revenge_trade, fomo_entry FROM daily_journals WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 7`;
        const prompt = `Analyze this trader's last 7 days: ${JSON.stringify(journals)}. Give a personalized coaching message in Bengali under 100 words.`;
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: [{ role: 'user', content: prompt }], temperature: 0.7 })
        });
        const data = await openaiRes.json();
        const msg = data.choices?.[0]?.message?.content || 'কোচিং মেসেজ পাওয়া যায়নি।';
        return json({ coaching: msg });
      } else {
        return json({ coaching: "তোমার ডিসিপ্লিন গত ২ দিন ধরে কমছে। আগামীকাল একটি নির্দিষ্ট ট্রেডিং প্ল্যান লিখে শুরু করো।" });
      }
    }

    // --- Export My Data ---
    if (path === '/export-my-data' && req.method === 'GET') {
      const journals = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} ORDER BY date`;
      const badges = await sql`SELECT badge_type FROM badges WHERE user_id = ${user.id}`;
      const habits = await sql`SELECT * FROM habit_definitions WHERE user_id = ${user.id}`;
      const profile = { email: user.email, display_name: user.display_name, xp: user.xp, level: calculateLevel(user.xp) };
      await sql`INSERT INTO user_activity_log (user_id, action, details, ip_address) VALUES (${user.id}, 'export_data', ${JSON.stringify({})}, ${ip})`;
      return json({ profile, journals, badges: badges.map(b => b.badge_type), habits });
    }

    // Fallback
    return errorJson('Not found', 404);
  } catch (error) {
    Sentry.captureException(error);
    return errorJson('Internal server error', 500);
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, verification_token, ...safe } = user;
  return safe;
}

export { apiHandler };
export default toNodeHandler(apiHandler);