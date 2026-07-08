// ===================================================
// AlamQuant ATTS - api/setup.js
// Enterprise-Grade Production Ready
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

const sql = neon(process.env.DATABASE_URL);
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
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

async function authenticate(req) {
  const auth = req.headers.get('authorization');
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

async function authenticateAdmin(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.role || decoded.role !== 'admin') return null;
    const [admin] = await sql`SELECT * FROM admin_users WHERE id = ${decoded.id}`;
    return admin;
  } catch {
    return null;
  }
}

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

// ====================== Node.js to Fetch API wrapper ======================
function toNodeHandler(handlerFn) {
  return async (req, res) => {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const fullUrl = `${protocol}://${host}${req.url}`;

    // ---------- Handle multipart file upload directly (busboy) ----------
    if (req.method === 'POST' && req.url.startsWith('/api/setup/admin/upload-image')) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({ error: 'Authentication required' }));
        return;
      }
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.role || decoded.role !== 'admin') {
          res.writeHead(403, corsHeaders);
          res.end(JSON.stringify({ error: 'Forbidden' }));
          return;
        }
      } catch {
        res.writeHead(401, corsHeaders);
        res.end(JSON.stringify({ error: 'Invalid token' }));
        return;
      }

      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.startsWith('multipart/form-data')) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({ error: 'Must be multipart/form-data' }));
        return;
      }

      try {
        const bb = busboy({ headers: { 'content-type': contentType } });
        const files = [];

        bb.on('file', (fieldname, fileStream, info) => {
          const { filename, mimeType } = info;
          const chunks = [];
          fileStream.on('data', (chunk) => chunks.push(chunk));
          fileStream.on('end', async () => {
            const buffer = Buffer.concat(chunks);
            try {
              const blob = await put(filename, buffer, { access: 'public', contentType: mimeType });
              files.push(blob.url);
            } catch (err) {
              console.error('Blob upload error:', err);
              res.writeHead(500, corsHeaders);
              res.end(JSON.stringify({ error: 'Upload failed' }));
              return;
            }
          });
        });

        bb.on('finish', () => {
          if (files.length === 0) {
            res.writeHead(400, corsHeaders);
            res.end(JSON.stringify({ error: 'No file uploaded' }));
            return;
          }
          res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ url: files[0] }));
        });

        bb.on('error', (err) => {
          console.error('Busboy error:', err);
          res.writeHead(500, corsHeaders);
          res.end(JSON.stringify({ error: 'Upload error' }));
        });

        req.pipe(bb);
        return;
      } catch (err) {
        console.error(err);
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
      }
    }

    // ---------- Normal Fetch API conversion for other routes ----------
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
        else headers.set(key, value);
      }
    }
    let body = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const request = new Request(fullUrl, {
      method: req.method,
      headers: headers,
      body: body,
    });
    try {
      const response = await handlerFn(request);
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      res.writeHead(response.status, responseHeaders);
      if (response.body) {
        const reader = response.body.getReader();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          res.write(value);
          await pump();
        };
        await pump();
      } else {
        res.end();
      }
    } catch (err) {
      console.error(err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}

// ====================== Main API Handler ======================
async function apiHandler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const host = req.headers.get('host') || 'localhost';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const fullUrl = req.url.startsWith('http') ? req.url : `${protocol}://${host}${req.url}`;
  const url = new URL(fullUrl);
  let path = url.pathname;

  // ✅ লোকাল ও ভের্সেল উভয়ের জন্য সঠিক পাথ বের করা
  if (path.startsWith('/api/setup')) {
    path = path.replace('/api/setup', '');
  } else if (path.startsWith('/api/')) {
    path = path.replace('/api', '');
  }

  try {
    // ==================== DB Init & Seed (PROTECTED) ====================
    if (path === '/init-db' && req.method === 'POST') {
      // Security: only allow if ALLOW_INIT_DB env is true
      if (process.env.ALLOW_INIT_DB !== 'true') {
        return json({ error: 'Init DB is disabled in production' }, 403);
      }
      const { admin_secret } = await req.json();
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);

      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;

      // Users
      await sql`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        identity_level VARCHAR(50) DEFAULT 'Beginner',
        xp INT DEFAULT 0,
        level INT DEFAULT 1,
        avatar_emoji VARCHAR(10) DEFAULT '🙂',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Daily Journals
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

      // Badges
      await sql`CREATE TABLE IF NOT EXISTS badges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        badge_type VARCHAR(100) NOT NULL,
        awarded_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, badge_type)
      )`;

      // Lessons (legacy)
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

      // Community
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

      // Quizzes (legacy)
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

      // Notifications
      await sql`CREATE TABLE IF NOT EXISTS notif_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        email_enabled BOOLEAN DEFAULT true,
        push_enabled BOOLEAN DEFAULT true,
        push_subscription JSONB
      )`;

      // Videos
      await sql`CREATE TABLE IF NOT EXISTS video_library (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100),
        title VARCHAR(255),
        description TEXT,
        youtube_id VARCHAR(50),
        duration VARCHAR(20)
      )`;

      // Certificates
      await sql`CREATE TABLE IF NOT EXISTS certificates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        verification_code UUID UNIQUE,
        issued_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Weekly Challenges
      await sql`CREATE TABLE IF NOT EXISTS weekly_challenges (
        id SERIAL PRIMARY KEY,
        week_start DATE,
        title VARCHAR(255),
        description TEXT,
        target INT,
        reward_xp INT
      )`;

      // Daily Rewards
      await sql`CREATE TABLE IF NOT EXISTS daily_rewards (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        PRIMARY KEY(user_id, date)
      )`;

      // Mystery Boxes
      await sql`CREATE TABLE IF NOT EXISTS mystery_boxes (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        opened BOOLEAN DEFAULT false,
        reward TEXT,
        PRIMARY KEY(user_id, date)
      )`;

      // Habits
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

      // Mood
      await sql`CREATE TABLE IF NOT EXISTS mood_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        mood VARCHAR(20) CHECK (mood IN ('happy','neutral','stressed','angry')),
        UNIQUE(user_id, date)
      )`;

      // Streak Freeze
      await sql`CREATE TABLE IF NOT EXISTS streak_freeze_items (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        quantity INT DEFAULT 0,
        PRIMARY KEY (user_id)
      )`;

      // Portfolio Performance
      await sql`CREATE TABLE IF NOT EXISTS portfolio_performance (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        discipline_score INT,
        virtual_balance DECIMAL DEFAULT 10000,
        PRIMARY KEY(user_id, date)
      )`;

      // Daily Quests
      await sql`CREATE TABLE IF NOT EXISTS daily_quests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        quest_date DATE NOT NULL DEFAULT CURRENT_DATE,
        quest_type VARCHAR(50),
        completed BOOLEAN DEFAULT false,
        claimed BOOLEAN DEFAULT false,
        UNIQUE(user_id, quest_date)
      )`;

      // Admin Users
      await sql`CREATE TABLE IF NOT EXISTS admin_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) DEFAULT 'Admin',
        role VARCHAR(50) DEFAULT 'super_admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Courses
      await sql`CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        thumbnail_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Chapters
      await sql`CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        order_index INT NOT NULL,
        content_text TEXT,
        image_url TEXT,
        video_url TEXT,
        passing_score INT DEFAULT 90,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(course_id, order_index)
      )`;

      // Chapter Quiz Questions
      await sql`CREATE TABLE IF NOT EXISTS chapter_quiz_questions (
        id SERIAL PRIMARY KEY,
        chapter_id INT REFERENCES chapters(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_index INT NOT NULL,
        explanation TEXT,
        order_index INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // User Chapter Progress
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

      // Final Exam Results
      await sql`CREATE TABLE IF NOT EXISTS final_exam_results (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        score DECIMAL(5,2),
        passed BOOLEAN DEFAULT false,
        total_questions INT,
        correct_answers INT,
        attempted_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id)
      )`;

      // User Energy
      await sql`CREATE TABLE IF NOT EXISTS user_energy (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
        current_energy INT DEFAULT 50,
        max_energy INT DEFAULT 50,
        last_reset_date DATE DEFAULT CURRENT_DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Trading Simulator
      await sql`CREATE TABLE IF NOT EXISTS trading_simulator (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        scenario JSONB NOT NULL,
        user_decision JSONB,
        result JSONB,
        xp_earned INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Mentor Assignments
      await sql`CREATE TABLE IF NOT EXISTS mentor_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        mentor_id UUID REFERENCES users(id),
        student_id UUID REFERENCES users(id) UNIQUE,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'active'
      )`;

      // Content Translations (for i18n)
      await sql`CREATE TABLE IF NOT EXISTS content_translations (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL,
        record_id INT NOT NULL,
        language_code VARCHAR(10) NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        translated_text TEXT,
        UNIQUE(table_name, record_id, language_code, field_name)
      )`;

      // Assessment Questions
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

      // Benefits
      await sql`CREATE TABLE IF NOT EXISTS benefits (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(10)
      )`;

      // ===== ENTERPRISE NEW TABLES =====
      // Admin Activity Log
      await sql`CREATE TABLE IF NOT EXISTS admin_activity_log (
        id SERIAL PRIMARY KEY,
        admin_id UUID REFERENCES admin_users(id),
        action VARCHAR(255) NOT NULL,
        details JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;

      // Exam Sessions (for timed exams)
      await sql`CREATE TABLE IF NOT EXISTS exam_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        start_time TIMESTAMPTZ DEFAULT NOW(),
        expiry TIMESTAMPTZ NOT NULL,
        status VARCHAR(20) DEFAULT 'active'
      )`;

      // UI Translations (i18n)
      await sql`CREATE TABLE IF NOT EXISTS ui_translations (
        id SERIAL PRIMARY KEY,
        key VARCHAR(255) UNIQUE NOT NULL,
        lang VARCHAR(10) NOT NULL,
        value TEXT NOT NULL
      )`;

      // Seed admin user
      const [adminExists] = await sql`SELECT id FROM admin_users WHERE email = 'admin@alamquant.com'`;
      if (!adminExists) {
        const adminHash = await bcrypt.hash('Admin@2024!Secure', 12);
        await sql`INSERT INTO admin_users (email, password_hash, name, role) VALUES ('admin@alamquant.com', ${adminHash}, 'Super Admin', 'super_admin')`;
      }

      // Seed default course and chapters
      const [courseExists] = await sql`SELECT id FROM courses WHERE title = 'Professional Trader Transformation'`;
      if (!courseExists) {
        await sql`INSERT INTO courses (title, description) VALUES ('Professional Trader Transformation', 'Complete 30-day transformation from amateur to professional trader')`;
        const [course] = await sql`SELECT id FROM courses WHERE title = 'Professional Trader Transformation'`;
        const courseId = course.id;
        const chaptersSeed = [
          { title: 'FOMO (Fear Of Missing Out) – সম্পূর্ণ গাইড', order_index: 1, content_text: `<h2>FOMO কি?</h2><p>FOMO বা Fear Of Missing Out হল একটি মানসিক অবস্থা...</p>`, image_url: null, video_url: null, passing_score: 90 },
          { title: 'Risk Management – ঝুঁকি ব্যবস্থাপনার মূলনীতি', order_index: 2, content_text: `<h2>Risk Management কেন জরুরি?</h2><p>...</p>`, image_url: null, video_url: null, passing_score: 90 }
        ];
        for (const ch of chaptersSeed) {
          const [chapter] = await sql`INSERT INTO chapters (course_id, title, order_index, content_text, image_url, video_url, passing_score) VALUES (${courseId}, ${ch.title}, ${ch.order_index}, ${ch.content_text}, ${ch.image_url}, ${ch.video_url}, ${ch.passing_score}) RETURNING id`;
          if (ch.order_index === 1) {
            const quizQuestions = [
              { question: 'FOMO এর পূর্ণরূপ কি?', options: ['Fear Of Missing Out','Fast Order Management','Free Online Market','Future Options Market'], correct_index: 0, explanation: 'FOMO = Fear Of Missing Out' },
              { question: 'FOMO এড়াতে ট্রেডের আগে কতক্ষণ বিশ্লেষণ?', options: ['১ মিনিট','২ মিনিট','৩ মিনিট','৫ মিনিট'], correct_index: 2, explanation: 'ন্যূনতম ৩ মিনিট' }
            ];
            for (const q of quizQuestions) {
              await sql`INSERT INTO chapter_quiz_questions (chapter_id, question, options, correct_index, explanation) VALUES (${chapter.id}, ${q.question}, ${JSON.stringify(q.options)}, ${q.correct_index}, ${q.explanation})`;
            }
          }
        }
      }

      // Seed assessment questions
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

      // Seed benefits
      const { count: bCount } = (await sql`SELECT COUNT(*)::int FROM benefits`)[0];
      if (bCount === 0) {
        await sql`INSERT INTO benefits (title, description, icon) VALUES 
          ('শৃঙ্খলা গড়ে ওঠে', 'প্রতিদিনের জার্নালিং আপনাকে নিয়ম মেনে ট্রেড করতে বাধ্য করবে', '📋'),
          ('আবেগ নিয়ন্ত্রণ', 'ফিয়ার, গ্রিড, FOMO থেকে মুক্তি পেয়ে ঠান্ডা মাথায় সিদ্ধান্ত নেওয়া শিখবেন', '🧘'),
          ('পেশাদার মানসিকতা', 'ট্রেডিংকে ব্যবসা হিসেবে দেখার দক্ষতা অর্জন হবে', '💼'),
          ('ঝুঁকি ব্যবস্থাপনা', 'ক্যাপিটাল বাঁচিয়ে দীর্ঘমেয়াদে টিকে থাকার কৌশল রপ্ত করবেন', '🛡️'),
          ('কমিউনিটি সাপোর্ট', 'সফল ট্রেডারদের সাথে অভিজ্ঞতা বিনিময়ের সুযোগ', '🤝')`;
      }

      return json({ message: 'DB initialized with all tables and sample data' });
    }

    // ---------------- PUBLIC: Auto Login, Google OAuth, Admin Login, Register, Login ----------------
    if (path === '/auto-login' && req.method === 'GET') {
      const tokenParam = url.searchParams.get('token');
      if (!tokenParam) return json({ error: 'No token' }, 400);
      let payload;
      try { payload = jwt.verify(tokenParam, process.env.JWT_SECRET); } catch { return json({ error: 'Invalid token' }, 401); }
      let user = (await sql`SELECT * FROM users WHERE email = ${payload.email}`)[0];
      if (!user) user = (await sql`INSERT INTO users (email, password_hash) VALUES (${payload.email}, '') RETURNING *`)[0];
      const newToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return json({ token: newToken, user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji } });
    }

    if (path === '/auth/google' && req.method === 'POST') {
      const { credential } = await req.json();
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
        return json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji } });
      } catch (e) {
        return json({ error: 'Invalid Google token' }, 401);
      }
    }

    if (path === '/admin/login' && req.method === 'POST') {
      const { email, password } = await req.json();
      const [adminUser] = await sql`SELECT * FROM admin_users WHERE email = ${email}`;
      if (!adminUser || !(await bcrypt.compare(password, adminUser.password_hash))) {
        return json({ error: 'Invalid credentials' }, 401);
      }
      const adminToken = jwt.sign({ id: adminUser.id, role: 'admin', admin_level: adminUser.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
      return json({ token: adminToken, name: adminUser.name, role: adminUser.role });
    }

    if (path === '/register' && req.method === 'POST') {
      const { email, password, display_name, avatar_emoji } = await req.json();
      if (!email || !password || password.length < 6) return json({ error: 'Invalid input' }, 400);
      const hash = await bcrypt.hash(password, 12);
      const name = display_name || email.split('@')[0];
      const [user] = await sql`INSERT INTO users (email, password_hash, display_name, avatar_emoji) VALUES (${email}, ${hash}, ${name}, ${avatar_emoji || '🙂'}) RETURNING id, email, display_name, identity_level, xp, level, avatar_emoji`;
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return json({ token, user });
    }

    if (path === '/login' && req.method === 'POST') {
      const { email, password, display_name } = await req.json();
      const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!user || !(await bcrypt.compare(password, user.password_hash))) return json({ error: 'Invalid credentials' }, 401);
      if (display_name && !user.display_name) {
        await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
        user.display_name = display_name;
      }
      const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
      return json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji } });
    }

    // ---------------- PUBLIC: Assessment Questions & Benefits ----------------
    if (path === '/assessment/questions' && req.method === 'GET') {
      const questions = await sql`SELECT * FROM assessment_questions ORDER BY order_index`;
      return json(questions);
    }

    if (path === '/benefits' && req.method === 'GET') {
      const benefits = await sql`SELECT * FROM benefits ORDER BY id`;
      return json(benefits);
    }

    // i18n endpoint (PUBLIC)
    if (path === '/translations' && req.method === 'GET') {
      const lang = url.searchParams.get('lang') || 'bn';
      const rows = await sql`SELECT key, value FROM ui_translations WHERE lang = ${lang}`;
      const result = {};
      rows.forEach(r => result[r.key] = r.value);
      return json(result);
    }

    // ---------------- Auth Required ----------------
    const user = await authenticate(req);
    if (!user) return json({ error: 'Authentication required' }, 401);

    // ==================== USER ENDPOINTS (authenticated) ====================
    if (path === '/mood' && req.method === 'POST') {
      const { mood, date } = await req.json();
      await sql`INSERT INTO mood_logs (user_id, date, mood) VALUES (${user.id}, ${date || new Date().toISOString().slice(0,10)}, ${mood}) ON CONFLICT (user_id, date) DO UPDATE SET mood = ${mood}`;
      return json({ success: true });
    }

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
      if (!quest || quest.claimed) return json({ error: 'Already claimed or no quest' }, 400);
      if (!quest.completed) return json({ error: 'Quest not completed yet' }, 400);
      await sql`UPDATE daily_quests SET claimed = true WHERE id = ${quest.id}`;
      await sql`UPDATE users SET xp = xp + 15 WHERE id = ${user.id}`;
      return json({ success: true, xp: 15 });
    }

    if (path === '/use-streak-freeze' && req.method === 'POST') {
      const [item] = await sql`SELECT quantity FROM streak_freeze_items WHERE user_id = ${user.id}`;
      if (!item || item.quantity < 1) return json({ error: 'No freeze available' }, 400);
      await sql`UPDATE streak_freeze_items SET quantity = quantity - 1 WHERE user_id = ${user.id}`;
      return json({ success: true, remaining: item.quantity - 1 });
    }

    if (path === '/portfolio' && req.method === 'GET') {
      const rows = await sql`SELECT * FROM portfolio_performance WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 30`;
      return json(rows);
    }

    if (path === '/latest-feedback' && req.method === 'GET') {
      const [journal] = await sql`SELECT feedback FROM daily_journals WHERE user_id = ${user.id} ORDER BY date DESC LIMIT 1`;
      return json({ feedback: journal?.feedback || null });
    }

    if (path === '/daily-reward' && req.method === 'POST') {
      const [exists] = await sql`SELECT * FROM daily_rewards WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (!exists) {
        await sql`INSERT INTO daily_rewards (user_id, date) VALUES (${user.id}, CURRENT_DATE)`;
        await sql`UPDATE users SET xp = xp + 1 WHERE id = ${user.id}`;
        return json({ claimed: true, xp: 1 });
      }
      return json({ claimed: false, message: 'আজকের বোনাস নেওয়া হয়ে গেছে' });
    }

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
      return json({ reward });
    }

    if (path === '/reaction' && req.method === 'POST') {
      const { post_id, reaction } = await req.json();
      if (!['👍','🔥','❤️'].includes(reaction)) return json({ error: 'Invalid reaction' }, 400);
      await sql`UPDATE community_posts SET reactions = jsonb_set(COALESCE(reactions, '{}'), ARRAY[${reaction}], COALESCE((reactions->>${reaction})::int, 0)::int + 1::text::jsonb) WHERE id = ${post_id}`;
      return json({ success: true });
    }

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
      // Check if user is also an admin
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
      const { avatar_emoji, display_name } = await req.json();
      if (avatar_emoji) await sql`UPDATE users SET avatar_emoji = ${avatar_emoji} WHERE id = ${user.id}`;
      if (display_name) await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
      return json({ success: true });
    }

    if (path === '/checkin' && req.method === 'POST') {
      const { mindfulness_done, commitment, date } = await req.json();
      const effectiveDate = date || new Date().toISOString().slice(0,10);
      await sql`INSERT INTO daily_journals (user_id, date, mindfulness_done, commitment) VALUES (${user.id}, ${effectiveDate}, ${mindfulness_done}, ${commitment}) ON CONFLICT (user_id, date) DO UPDATE SET mindfulness_done = ${mindfulness_done}, commitment = ${commitment}`;
      return json({ success: true });
    }

    if (path === '/evaluation' && req.method === 'POST') {
      const body = await req.json();
      const { trades_count, stop_loss_moved, plan_deviation, revenge_trade, fomo_entry, overtrading, rule_followed, scores, evaluation_notes, reflection, date, mood } = body;
      const effectiveDate = date || new Date().toISOString().slice(0,10);
      const [existing] = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = ${effectiveDate}`;
      if (!existing) return json({ error: 'Morning checkin first' }, 400);
      if (existing.feedback) return json({ error: 'Already submitted' }, 400);
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

    if (path === '/lessons' && req.method === 'GET') {
      const lessons = await sql`SELECT l.*, ul.completed_at FROM lessons l LEFT JOIN user_lessons ul ON l.id = ul.lesson_id AND ul.user_id = ${user.id} ORDER BY l.day`;
      return json(lessons);
    }
    if (path === '/complete-lesson' && req.method === 'POST') {
      const { lesson_id } = await req.json();
      await sql`INSERT INTO user_lessons (user_id, lesson_id) VALUES (${user.id}, ${lesson_id}) ON CONFLICT DO NOTHING`;
      await sql`UPDATE users SET xp = xp + 3 WHERE id = ${user.id}`;
      return json({ success: true });
    }

    if (path === '/community' && req.method === 'GET') {
      const posts = await sql`SELECT cp.*, u.email as author, u.display_name, u.avatar_emoji FROM community_posts cp JOIN users u ON cp.user_id = u.id WHERE cp.is_hidden = false ORDER BY cp.created_at DESC LIMIT 50`;
      return json(posts.map(p => ({ ...p, author: maskEmail(p.author), display_name: p.display_name || p.author.split('@')[0] })));
    }
    if (path === '/community' && req.method === 'POST') {
      const { content, post_type } = await req.json();
      if (!['lesson','mistake','rule','general'].includes(post_type)) return json({ error: 'Invalid type' }, 400);
      await sql`INSERT INTO community_posts (user_id, content, post_type) VALUES (${user.id}, ${content}, ${post_type})`;
      return json({ success: true });
    }
    if (path === '/like-post' && req.method === 'POST') {
      const { post_id } = await req.json();
      await sql`UPDATE community_posts SET likes = likes + 1 WHERE id = ${post_id}`;
      return json({ success: true });
    }
    if (path === '/reply-post' && req.method === 'POST') {
      const { post_id, content } = await req.json();
      await sql`INSERT INTO replies (post_id, user_id, content) VALUES (${post_id}, ${user.id}, ${content})`;
      return json({ success: true });
    }
    if (path === '/replies' && req.method === 'GET') {
      const postId = url.searchParams.get('post_id');
      const replies = await sql`SELECT r.*, u.email, u.display_name, u.avatar_emoji FROM replies r JOIN users u ON r.user_id = u.id WHERE post_id = ${postId} ORDER BY created_at ASC`;
      return json(replies.map(r => ({ ...r, email: maskEmail(r.email), display_name: r.display_name || r.email.split('@')[0] })));
    }

    if (path === '/leaderboard' && req.method === 'GET') {
      const lb = await sql`SELECT u.id as user_id, u.email, u.display_name, u.avatar_emoji, AVG((daily_journals.scores->>'q6')::int)::float as avg_discipline FROM daily_journals JOIN users u ON daily_journals.user_id = u.id WHERE daily_journals.date > CURRENT_DATE - INTERVAL '7 days' GROUP BY u.id, u.email, u.display_name, u.avatar_emoji ORDER BY avg_discipline DESC LIMIT 10`;
      return json(lb.map(u => ({ ...u, user_id: u.user_id, email: maskEmail(u.email), display_name: u.display_name || u.email.split('@')[0] })));
    }

    if (path === '/quiz' && req.method === 'GET') {
      const [quiz] = await sql`SELECT * FROM quizzes WHERE active = true ORDER BY RANDOM() LIMIT 1`;
      if (!quiz) return json({ question: null });
      const [attempt] = await sql`SELECT * FROM quiz_attempts WHERE user_id = ${user.id} AND quiz_id = ${quiz.id} AND date = CURRENT_DATE`;
      if (attempt) return json({ question: null, message: 'Already attempted today' });
      return json(quiz);
    }
    if (path === '/quiz' && req.method === 'POST') {
      const { quiz_id, answer } = await req.json();
      const [quiz] = await sql`SELECT * FROM quizzes WHERE id = ${quiz_id}`;
      if (!quiz) return json({ error: 'Invalid quiz' }, 404);
      const correct = answer === quiz.correct;
      await sql`INSERT INTO quiz_attempts (user_id, quiz_id, date, correct) VALUES (${user.id}, ${quiz_id}, CURRENT_DATE, ${correct}) ON CONFLICT DO NOTHING`;
      if (correct) { await sql`UPDATE users SET xp = xp + 10 WHERE id = ${user.id}`; return json({ correct: true, message: 'Correct! +10 XP' }); }
      return json({ correct: false, message: 'Wrong answer' });
    }

    if (path === '/notif-settings' && req.method === 'GET') {
      const [s] = await sql`SELECT * FROM notif_settings WHERE user_id = ${user.id}`;
      return json(s || { email_enabled: true, push_enabled: true });
    }
    if (path === '/notif-settings' && req.method === 'POST') {
      const { email, push, subscription } = await req.json();
      await sql`INSERT INTO notif_settings (user_id, email_enabled, push_enabled, push_subscription) VALUES (${user.id}, ${email ?? true}, ${push ?? true}, ${subscription ?? null}) ON CONFLICT (user_id) DO UPDATE SET email_enabled = ${email ?? true}, push_enabled = ${push ?? true}, push_subscription = COALESCE(${subscription ?? null}, notif_settings.push_subscription)`;
      return json({ success: true });
    }

    if (path === '/save-subscription' && req.method === 'POST') {
      const { subscription } = await req.json();
      if (!subscription) return json({ error: 'Missing subscription' }, 400);
      await sql`INSERT INTO notif_settings (user_id, push_enabled, push_subscription) VALUES (${user.id}, true, ${subscription}) ON CONFLICT (user_id) DO UPDATE SET push_subscription = ${subscription}`;
      return json({ success: true });
    }

    if (path === '/videos' && req.method === 'GET') {
      const videos = await sql`SELECT * FROM video_library ORDER BY category, id`;
      return json(videos);
    }

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
      const { title, icon, color, reminder_times } = await req.json();
      const times = typeof reminder_times === 'string' ? reminder_times.split(',').map(t=>t.trim()).filter(t=>t) : (reminder_times || []);
      const [habit] = await sql`INSERT INTO habit_definitions (user_id, title, icon, color, reminder_times) VALUES (${user.id}, ${title}, ${icon||'✅'}, ${color||'#c59b3b'}, ${JSON.stringify(times)}) RETURNING *`;
      return json(habit, 201);
    }
    if (path.match(/^\/habits\/definitions\/(.+)$/) && req.method === 'PUT') {
      const habitId = path.split('/')[3];
      const { title, icon, color, reminder_times } = await req.json();
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
      const { habit_id, date, time, completed } = await req.json();
      const [habit] = await sql`SELECT id FROM habit_definitions WHERE id = ${habit_id} AND user_id = ${user.id}`;
      if (!habit) return json({ error: 'Habit not found' }, 404);
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

    // ==================== TRAINING & SIMULATOR ENDPOINTS ====================
    if (path === '/training/chapters' && req.method === 'GET') {
      const courseId = url.searchParams.get('course_id') || 1;
      const chapters = await sql`
        SELECT c.*, 
               COALESCE(ucp.passed, false) as passed, 
               COALESCE(ucp.best_score, 0) as best_score,
               COALESCE(ucp.quiz_attempts, 0) as quiz_attempts,
               ucp.completed_at
        FROM chapters c
        LEFT JOIN user_chapter_progress ucp ON c.id = ucp.chapter_id AND ucp.user_id = ${user.id}
        WHERE c.course_id = ${courseId} AND c.is_active = true
        ORDER BY c.order_index
      `;
      return json(chapters);
    }

    if (path.match(/^\/training\/chapter\/(\d+)$/) && req.method === 'GET') {
      const chapterId = parseInt(path.split('/')[3]);
      const [chapter] = await sql`SELECT * FROM chapters WHERE id = ${chapterId} AND is_active = true`;
      if (!chapter) return json({ error: 'Chapter not found' }, 404);
      const questions = await sql`SELECT id, question, options, order_index FROM chapter_quiz_questions WHERE chapter_id = ${chapterId} ORDER BY order_index, id`;
      const [progress] = await sql`SELECT * FROM user_chapter_progress WHERE user_id = ${user.id} AND chapter_id = ${chapterId}`;
      const [energy] = await sql`SELECT current_energy FROM user_energy WHERE user_id = ${user.id}`;
      return json({ ...chapter, questions, user_progress: progress || null, energy: energy?.current_energy || 50 });
    }

    if (path.match(/^\/training\/chapter\/(\d+)\/quiz$/) && req.method === 'POST') {
      const chapterId = parseInt(path.split('/')[3]);
      const { answers } = await req.json();
      const [energy] = await sql`SELECT current_energy FROM user_energy WHERE user_id = ${user.id}`;
      if (!energy || energy.current_energy < 5) {
        return json({ error: 'পর্যাপ্ত এনার্জি নেই!', energy: energy?.current_energy || 0 }, 400);
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

      return json({
        score, passed, total, correct, passing_score: chapter.passing_score,
        xp_earned: passed ? 20 : 0, energy_cost: energyCost,
        message: passed ? 'অভিনন্দন! আপনি পাস করেছেন।' : `আপনার স্কোর ${score.toFixed(0)}%। পাসিং স্কোর ${chapter.passing_score}%। পুনরায় পড়ুন।`
      });
    }

    if (path === '/training/final-exam' && req.method === 'GET') {
      // Check if already passed
      const [existing] = await sql`SELECT * FROM final_exam_results WHERE user_id = ${user.id} AND passed = true`;
      if (existing) return json({ message: 'ইতিমধ্যে উত্তীর্ণ', score: existing.score, passed: true });

      // Check chapters all passed
      const chapters = await sql`SELECT id FROM chapters WHERE course_id = 1 AND is_active = true ORDER BY order_index`;
      const passedChapters = await sql`SELECT chapter_id FROM user_chapter_progress WHERE user_id = ${user.id} AND passed = true`;
      const passedSet = new Set(passedChapters.map(r => r.chapter_id));
      if (chapters.some(ch => !passedSet.has(ch.id))) {
        return json({ error: 'সব চ্যাপ্টার পাস করা আবশ্যক' }, 400);
      }

      // Create exam session
      const startTime = new Date();
      const expiry = new Date(startTime.getTime() + 20 * 60 * 1000); // 20 min
      const [session] = await sql`INSERT INTO exam_sessions (user_id, start_time, expiry) VALUES (${user.id}, ${startTime}, ${expiry}) RETURNING id, start_time, expiry`;

      // Get random questions
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
      const { session_id, answers } = await req.json();
      // Validate session
      const [session] = await sql`SELECT * FROM exam_sessions WHERE id = ${session_id} AND user_id = ${user.id}`;
      if (!session || session.status !== 'active' || new Date() > new Date(session.expiry)) {
        return json({ error: 'Time expired or invalid session' }, 400);
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

      return json({
        score, passed, total, correct, xp_earned: passed ? 100 : 0,
        message: passed ? 'অভিনন্দন! ফাইনাল পরীক্ষায় উত্তীর্ণ!' : `স্কোর ${score.toFixed(0)}%, পাসিং 80%`
      });
    }

    if (path === '/certificate' && req.method === 'GET') {
      const { count: totalJournals } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0];
      if (totalJournals < 1) return json({ error: 'কোনো জার্নাল নেই' }, 400);
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
        await sql`INSERT INTO user_energy (user_id, current_energy, max_energy, last_reset_date) VALUES (${user.id}, 50, 50, ${today})`;
        return json({ current_energy: 50, max_energy: 50 });
      }
      if (energy.last_reset_date.toISOString().slice(0,10) !== today) {
        await sql`UPDATE user_energy SET current_energy = max_energy, last_reset_date = ${today} WHERE user_id = ${user.id}`;
        return json({ current_energy: energy.max_energy, max_energy: energy.max_energy });
      }
      return json({ current_energy: energy.current_energy, max_energy: energy.max_energy });
    }

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
      const { scenario_id, selected_index } = await req.json();
      const [sim] = await sql`SELECT * FROM trading_simulator WHERE id = ${scenario_id} AND user_id = ${user.id}`;
      if (!sim) return json({ error: 'Scenario not found' }, 404);
      const isCorrect = selected_index === sim.scenario.correct_index;
      const xpEarned = isCorrect ? 15 : 0;
      await sql`UPDATE trading_simulator SET user_decision = ${JSON.stringify({selected_index})}, result = ${JSON.stringify({is_correct: isCorrect})}, xp_earned = ${xpEarned} WHERE id = ${scenario_id}`;
      if (isCorrect) await sql`UPDATE users SET xp = xp + 15 WHERE id = ${user.id}`;
      return json({ is_correct: isCorrect, explanation: sim.scenario.explanation, xp_earned: xpEarned });
    }

    // ==================== ASSESSMENT SUBMIT (authenticated) ====================
    if (path === '/assessment/submit' && req.method === 'POST') {
      const { answers } = await req.json();
      for (const a of answers) {
        await sql`INSERT INTO user_assessments (user_id, question_id, answer) VALUES (${user.id}, ${a.question_id}, ${a.answer}) ON CONFLICT (user_id, question_id) DO UPDATE SET answer = ${a.answer}`;
      }
      const yesCount = answers.filter(a => a.answer).length;
      let recommendation;
      if (yesCount >= 7) recommendation = "আপনার ট্রেডিংয়ে গুরুতর শৃঙ্খলাহীনতা রয়েছে। আমাদের প্রোগ্রাম আপনাকে সম্পূর্ণ বদলে দেবে।";
      else if (yesCount >= 4) recommendation = "আপনার কিছু জায়গায় উন্নতি দরকার। ট্রেনিং আপনার কার্যকারিতা বাড়াবে।";
      else recommendation = "আপনি ভাল অবস্থায় আছেন, তবু আরও ধারালো হতে আমাদের ট্রেনিং সহায়ক হবে।";
      return json({ yesCount, total: answers.length, recommendation });
    }

    // ==================== AI COACH ====================
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

    // ==================== ADMIN ENDPOINTS ====================
    if (path === '/admin/dashboard' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const totalUsers = (await sql`SELECT COUNT(*)::int FROM users`)[0].count;
      const dau = (await sql`SELECT COUNT(DISTINCT user_id)::int FROM daily_journals WHERE date = CURRENT_DATE`)[0].count;
      const totalJournals = (await sql`SELECT COUNT(*)::int FROM daily_journals`)[0].count;
      const totalChapters = (await sql`SELECT COUNT(*)::int FROM chapters WHERE is_active = true`)[0].count;
      const completedTrainings = (await sql`SELECT COUNT(*)::int FROM final_exam_results WHERE passed = true`)[0].count;
      return json({ totalUsers, dailyActiveUsers: dau, totalJournals, totalChapters, completedTrainings, completionRate: totalUsers ? Math.round(completedTrainings/totalUsers*100) : 0 });
    }

    if (path === '/admin/users' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const search = url.searchParams.get('search') || '';
      let users;
      if (search) {
        users = await sql`SELECT id, email, display_name, identity_level, xp, level, avatar_emoji FROM users WHERE email ILIKE ${'%'+search+'%'} OR display_name ILIKE ${'%'+search+'%'} ORDER BY created_at DESC LIMIT 50`;
      } else {
        users = await sql`SELECT id, email, display_name, identity_level, xp, level, avatar_emoji FROM users ORDER BY created_at DESC LIMIT 50`;
      }
      return json(users);
    }

    if (path.match(/^\/admin\/user\/(.+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const userId = path.split('/')[3];
      await sql`DELETE FROM users WHERE id = ${userId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'user_delete', ${JSON.stringify({deleted_user_id: userId})})`;
      return json({ success: true });
    }

    if (path === '/admin/reset-password' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const { user_id, new_password } = await req.json();
      if (!user_id || !new_password || new_password.length < 6) return json({ error: 'Invalid input' }, 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${user_id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'user_password_reset', ${JSON.stringify({user_id})})`;
      return json({ success: true });
    }

    // ** NEW: Admin change own password **
    if (path === '/admin/change-password' && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const { current_password, new_password } = await req.json();
      const valid = await bcrypt.compare(current_password, adminUser.password_hash);
      if (!valid) return json({ error: 'Current password incorrect' }, 400);
      if (!new_password || new_password.length < 6) return json({ error: 'New password must be at least 6 characters' }, 400);
      const hash = await bcrypt.hash(new_password, 12);
      await sql`UPDATE admin_users SET password_hash = ${hash} WHERE id = ${adminUser.id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'admin_password_change', ${JSON.stringify({})})`;
      return json({ success: true });
    }

    // Admin Chapters CRUD (with activity log)
    if (path === '/admin/chapters' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const courseId = url.searchParams.get('course_id') || 1;
      const chapters = await sql`
        SELECT c.*, 
               (SELECT COUNT(*)::int FROM chapter_quiz_questions WHERE chapter_id = c.id) as question_count,
               (SELECT COUNT(*)::int FROM user_chapter_progress WHERE chapter_id = c.id AND passed = true) as passed_count
        FROM chapters c WHERE c.course_id = ${courseId} ORDER BY c.order_index
      `;
      return json(chapters);
    }

    if (path === '/admin/chapter' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const { course_id, title, order_index, content_text, image_url, video_url, passing_score } = await req.json();
      const [chapter] = await sql`INSERT INTO chapters (course_id, title, order_index, content_text, image_url, video_url, passing_score) VALUES (${course_id}, ${title}, ${order_index}, ${content_text}, ${image_url}, ${video_url}, ${passing_score || 90}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'chapter_create', ${JSON.stringify(chapter)})`;
      return json(chapter, 201);
    }

    if (path.match(/^\/admin\/chapter\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const chapterId = parseInt(path.split('/')[3]);
      const { title, order_index, content_text, image_url, video_url, passing_score, is_active } = await req.json();
      await sql`UPDATE chapters SET title=COALESCE(${title}, title), order_index=COALESCE(${order_index}, order_index), content_text=COALESCE(${content_text}, content_text), image_url=COALESCE(${image_url}, image_url), video_url=COALESCE(${video_url}, video_url), passing_score=COALESCE(${passing_score}, passing_score), is_active=COALESCE(${is_active}, is_active) WHERE id=${chapterId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'chapter_update', ${JSON.stringify({chapter_id: chapterId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/chapter\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const chapterId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM chapters WHERE id = ${chapterId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'chapter_delete', ${JSON.stringify({chapter_id: chapterId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/chapter\/(\d+)\/questions$/) && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const chapterId = parseInt(path.split('/')[3]);
      const questions = await sql`SELECT * FROM chapter_quiz_questions WHERE chapter_id = ${chapterId} ORDER BY order_index, id`;
      return json(questions);
    }

    if (path.match(/^\/admin\/chapter\/(\d+)\/question$/) && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const chapterId = parseInt(path.split('/')[3]);
      const { question, options, correct_index, explanation, order_index } = await req.json();
      const [q] = await sql`INSERT INTO chapter_quiz_questions (chapter_id, question, options, correct_index, explanation, order_index) VALUES (${chapterId}, ${question}, ${JSON.stringify(options)}, ${correct_index}, ${explanation}, ${order_index || 0}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'question_create', ${JSON.stringify(q)})`;
      return json(q, 201);
    }

    if (path.match(/^\/admin\/question\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const questionId = parseInt(path.split('/')[3]);
      const { question, options, correct_index, explanation, order_index } = await req.json();
      await sql`UPDATE chapter_quiz_questions SET question=COALESCE(${question}, question), options=COALESCE(${JSON.stringify(options)}::jsonb, options), correct_index=COALESCE(${correct_index}, correct_index), explanation=COALESCE(${explanation}, explanation), order_index=COALESCE(${order_index}, order_index) WHERE id=${questionId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'question_update', ${JSON.stringify({question_id: questionId})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/question\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const questionId = parseInt(path.split('/')[3]);
      await sql`DELETE FROM chapter_quiz_questions WHERE id = ${questionId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'question_delete', ${JSON.stringify({question_id: questionId})})`;
      return json({ success: true });
    }

    // Admin Simulate, Community, Posts, Content (with logging where appropriate)
    if (path === '/admin/simulate-day' && req.method === 'POST') {
      const { admin_secret, email, days, start_day } = await req.json();
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const targetUser = (await sql`SELECT id FROM users WHERE email = ${email}`)[0];
      if (!targetUser) return json({ error: 'User not found' }, 404);
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
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const posts = await sql`SELECT cp.*, u.email as author, u.display_name, u.avatar_emoji FROM community_posts cp JOIN users u ON cp.user_id = u.id ORDER BY cp.created_at DESC LIMIT 100`;
      return json(posts.map(p => ({ ...p, author: maskEmail(p.author), display_name: p.display_name || p.author.split('@')[0] })));
    }

    if (path.match(/^\/admin\/posts\/(.+)\/hide$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const postId = path.split('/')[3];
      const { hide } = await req.json();
      await sql`UPDATE community_posts SET is_hidden = ${hide} WHERE id = ${postId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'post_visibility_change', ${JSON.stringify({post_id: postId, hidden: hide})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/posts\/(.+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const postId = path.split('/')[3];
      await sql`DELETE FROM community_posts WHERE id = ${postId}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'post_delete', ${JSON.stringify({post_id: postId})})`;
      return json({ success: true });
    }

    if (path === '/admin/content' && req.method === 'POST') {
      const body = await req.json();
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
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
        return json({ error: 'Invalid content type' }, 400);
      }
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'content_add', ${JSON.stringify(body)})`;
      return json({ success: true });
    }

    // Content PUT/DELETE (with logging)
    if (path.match(/^\/admin\/content\/(lesson|quiz|video)\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
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

    if (path.match(/^\/admin\/content\/(lesson|quiz|video)\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const [type, idStr] = path.split('/').slice(-2);
      const id = parseInt(idStr);
      const tableMap = { lesson: 'lessons', quiz: 'quizzes', video: 'video_library' };
      await sql`DELETE FROM ${sql(tableMap[type])} WHERE id = ${id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'content_delete', ${JSON.stringify({type, id})})`;
      return json({ success: true });
    }

    // Assessment/ Benefit PUT (admin)
    if (path.match(/^\/admin\/assessment\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const id = parseInt(path.split('/')[3]);
      const { question, category } = await req.json();
      await sql`UPDATE assessment_questions SET question = ${question}, category = ${category} WHERE id = ${id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'assessment_update', ${JSON.stringify({id})})`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/benefit\/(\d+)$/) && req.method === 'PUT') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const id = parseInt(path.split('/')[3]);
      const { title, description, icon } = await req.json();
      await sql`UPDATE benefits SET title = ${title}, description = ${description}, icon = ${icon} WHERE id = ${id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'benefit_update', ${JSON.stringify({id})})`;
      return json({ success: true });
    }

    if (path === '/admin/assessment-question' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const { question, category } = await req.json();
      if (!question) return json({ error: 'Question required' }, 400);
      const [q] = await sql`INSERT INTO assessment_questions (question, category, order_index) VALUES (${question}, ${category || ''}, 99) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'assessment_add', ${JSON.stringify(q)})`;
      return json(q, 201);
    }

    if (path.match(/^\/admin\/assessment\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const id = parseInt(path.split('/')[3]);
      await sql`DELETE FROM assessment_questions WHERE id = ${id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'assessment_delete', ${JSON.stringify({id})})`;
      return json({ success: true });
    }

    if (path === '/admin/benefit' && req.method === 'POST') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const { title, description, icon } = await req.json();
      if (!title) return json({ error: 'Title required' }, 400);
      const [b] = await sql`INSERT INTO benefits (title, description, icon) VALUES (${title}, ${description || ''}, ${icon || '🎁'}) RETURNING *`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'benefit_add', ${JSON.stringify(b)})`;
      return json(b, 201);
    }

    if (path.match(/^\/admin\/benefit\/(\d+)$/) && req.method === 'DELETE') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const id = parseInt(path.split('/')[3]);
      await sql`DELETE FROM benefits WHERE id = ${id}`;
      await sql`INSERT INTO admin_activity_log (admin_id, action, details) VALUES (${adminUser.id}, 'benefit_delete', ${JSON.stringify({id})})`;
      return json({ success: true });
    }

    // Analytics
    if (path === '/admin/analytics/retention' && req.method === 'GET') {
      const adminUser = await authenticateAdmin(req);
      if (!adminUser) return json({ error: 'Forbidden' }, 403);
      const dailyActive = await sql`
        SELECT date, COUNT(DISTINCT user_id)::int as active_users
        FROM daily_journals
        WHERE date > CURRENT_DATE - INTERVAL '7 days'
        GROUP BY date
        ORDER BY date
      `;
      return json(dailyActive);
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

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }
}

export { apiHandler };
export default toNodeHandler(apiHandler);