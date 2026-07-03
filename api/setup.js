import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please-in-production';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
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

async function authenticate(req) {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const [user] = await sql`SELECT * FROM users WHERE id = ${decoded.id}`;
    return user;
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
  if (radar.planning < 12) f.push('পরিকল্পনা অনুসরণে আরও মনোযোগ দিতে হবে।');
  if (radar.execution < 12) f.push('এক্সিকিউশন ইম্প্রুভ করো, ছোটখাটো ভুল কমানো দরকার।');
  if (radar.risk < 6) f.push('রিস্ক ম্যানেজমেন্টে আজ দুর্বলতা ছিল, সাবধান।');
  if (radar.psychology < 12) f.push('আবেগ নিয়ন্ত্রণে কাজ করতে হবে, এটি প্রফেশনাল ট্রেডারের মূল হাতিয়ার।');
  if (radar.improvement < 12) f.push('আজকের শিক্ষাকে কাজে লাগিয়ে আগামীকাল আরও ভালো করো।');

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

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/setup', '');

  try {
    // ---------------- DB Init & Seed ----------------
    if (path === '/init-db' && req.method === 'POST') {
      const { admin_secret } = await req.json();
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);

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

      // Seed lessons
      const { count: lc } = (await sql`SELECT COUNT(*)::int FROM lessons`)[0];
      if (lc === 0) {
        const topics = ['Probability Thinking','Loss Acceptance','FOMO','Confirmation Bias','Revenge Trading','Overconfidence','Deep Work','Sleep & Trading','Meditation','Patience','Focus','Review Process','Trading Routine','Long-term Thinking','Community','Risk Management Basics','Position Sizing','Stop Loss Psychology','Discipline Over Emotion','Journaling Effectively','Handling Winning Streaks','Handling Losing Streaks','Pre-market Preparation','Post-market Analysis','Building a Trading Plan','Execution Over Prediction','Emotional Detachment','Continuous Learning','The Institutional Mindset','Graduation Day'];
        for (let i = 0; i < 30; i++) {
          let phase = 'Awareness';
          if (i >= 5) phase = 'Discipline';
          if (i >= 10) phase = 'Consistency';
          if (i >= 15) phase = 'Psychology';
          if (i >= 20) phase = 'Professional Execution';
          if (i >= 25) phase = 'Institutional Mindset';
          await sql`INSERT INTO lessons (day, phase, title, content) VALUES (${i + 1}, ${phase}, ${'Day ' + (i + 1) + ': ' + topics[i]}, ${'Learn about ' + topics[i] + ' and apply today.'})`;
        }
      }

      // Seed videos
      const { count: vc } = (await sql`SELECT COUNT(*)::int FROM video_library`)[0];
      if (vc === 0) {
        await sql`INSERT INTO video_library (category, title, description, youtube_id, duration) VALUES 
          ('Mindfulness', '1-Minute Breathing Exercise', 'Start your day calm', 'inpok4MKVLM', '1:00'),
          ('Emotion Control', 'Trading Psychology Basics', 'Control your emotions', 'PLACEHOLDER_1', '22:10'),
          ('Discipline', 'Discipline for Traders', 'Daily habits for rule-based trading', 'PLACEHOLDER_2', '18:45'),
          ('Professional Trader', 'Institutional Mindset', 'Think like a pro', 'PLACEHOLDER_3', '30:00')`;
      }

      // Seed quizzes
      const { count: qc } = (await sql`SELECT COUNT(*)::int FROM quizzes`)[0];
      if (qc === 0) {
        const quizData = [
          { question: 'ট্রেডিংয়ে সবচেয়ে গুরুত্বপূর্ণ কি?', options: ['প্রফিট', 'ডিসিপ্লিন', 'স্পীড', 'লাক'], correct: 1 },
          { question: 'স্টপ লস সরানো কেন ক্ষতিকর?', options: ['প্রফিট কমায়', 'রিস্ক বাড়ায়', 'কমিশন বাড়ায়', 'সময় নষ্ট'], correct: 1 },
          { question: 'FOMO এর অর্থ কি?', options: ['Fear Of Missing Out', 'Fast Order Management', 'Free Online Market', 'Future Options'], correct: 0 },
          { question: 'রিভেঞ্জ ট্রেডিং কেন করা উচিত নয়?', options: ['এটি ইমোশনাল সিদ্ধান্ত', 'এটি দ্রুত লাভ আনে', 'এটি সিস্টেমেটিক', 'এটি নিরাপদ'], correct: 0 },
          { question: 'একজন প্রফেশনাল ট্রেডারের প্রধান বৈশিষ্ট্য কি?', options: ['বড় ক্যাপিটাল', 'শক্তিশালী কম্পিউটার', 'শৃঙ্খলা', 'ভবিষ্যদ্বাণী'], correct: 2 },
          { question: 'জার্নালিং এর প্রধান উদ্দেশ্য কি?', options: ['ট্রেড রেকর্ড রাখা', 'আত্মবিশ্লেষণ', 'ব্র্যাগিং', 'অ্যাকাউন্টিং'], correct: 1 },
          { question: 'ওভারট্রেডিং এর ক্ষতি কি?', options: ['ক্লান্তি', 'কমিশন বাড়া', 'রিস্ক বৃদ্ধি ও মানসিক চাপ', 'সবগুলো'], correct: 3 },
          { question: 'পজিশন সাইজিং কেন গুরুত্বপূর্ণ?', options: ['সর্বোচ্চ লাভের জন্য', 'রিস্ক নিয়ন্ত্রণে', 'স্প্রেড কভারে', 'মার্জিনে'], correct: 1 },
          { question: 'প্রি-মার্কেট প্রিপারেশন বলতে বোঝায়?', options: ['খবর দেখা', 'চার্ট এনালাইসিস', 'প্ল্যান তৈরি', 'সবগুলো'], correct: 3 },
          { question: 'একজন ট্রেডারের জন্য সাইকোলজি কতটা গুরুত্বপূর্ণ?', options: ['২০%', '৫০%', '৮০%', '১০০%'], correct: 2 }
        ];
        for (const q of quizData) {
          await sql`INSERT INTO quizzes (question, options, correct) VALUES (${q.question}, ${JSON.stringify(q.options)}, ${q.correct})`;
        }
      }

      // Seed weekly challenge
      const { count: wc } = (await sql`SELECT COUNT(*)::int FROM weekly_challenges`)[0];
      if (wc === 0) {
        await sql`INSERT INTO weekly_challenges (week_start, title, description, target, reward_xp) VALUES (CURRENT_DATE - (EXTRACT(DOW FROM CURRENT_DATE)::int - 1), 'No FOMO Week', 'Avoid FOMO entries all week', 5, 25)`;
      }

      // Add columns if not exists (for upgrades)
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100)`;
      await sql`ALTER TABLE notif_settings ADD COLUMN IF NOT EXISTS push_subscription JSONB`;

      return json({ message: 'DB initialized with all tables and sample data' });
    }

    // ---------------- Auto Login ----------------
    if (path === '/auto-login' && req.method === 'GET') {
      const tokenParam = url.searchParams.get('token');
      if (!tokenParam) return json({ error: 'No token' }, 400);
      let payload;
      try { payload = jwt.verify(tokenParam, JWT_SECRET); } catch { return json({ error: 'Invalid token' }, 401); }
      let user = (await sql`SELECT * FROM users WHERE email = ${payload.email}`)[0];
      if (!user) user = (await sql`INSERT INTO users (email, password_hash) VALUES (${payload.email}, '') RETURNING *`)[0];
      const newToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
      return json({ token: newToken, user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji } });
    }

    // ---------------- Google OAuth ----------------
    if (path === '/auth/google' && req.method === 'POST') {
      const { credential } = await req.json();
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
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
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
        return json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji } });
      } catch (e) {
        return json({ error: 'Invalid Google token' }, 401);
      }
    }

    // ---------------- Register ----------------
    if (path === '/register' && req.method === 'POST') {
      const { email, password, display_name, avatar_emoji } = await req.json();
      if (!email || !password || password.length < 6) return json({ error: 'Invalid input' }, 400);
      const hash = await bcrypt.hash(password, 12);
      const name = display_name || email.split('@')[0];
      const [user] = await sql`INSERT INTO users (email, password_hash, display_name, avatar_emoji) VALUES (${email}, ${hash}, ${name}, ${avatar_emoji || '🙂'}) RETURNING id, email, display_name, identity_level, xp, level, avatar_emoji`;
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
      return json({ token, user });
    }

    // ---------------- Login ----------------
    if (path === '/login' && req.method === 'POST') {
      const { email, password, display_name } = await req.json();
      const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
      if (!user || !(await bcrypt.compare(password, user.password_hash))) return json({ error: 'Invalid credentials' }, 401);
      if (display_name && !user.display_name) {
        await sql`UPDATE users SET display_name = ${display_name} WHERE id = ${user.id}`;
        user.display_name = display_name;
      }
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
      return json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji } });
    }

    // ---------------- Auth Required ----------------
    const user = await authenticate(req);
    if (!user) return json({ error: 'Authentication required' }, 401);

    // Daily reward
    if (path === '/daily-reward' && req.method === 'POST') {
      const [exists] = await sql`SELECT * FROM daily_rewards WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (!exists) {
        await sql`INSERT INTO daily_rewards (user_id, date) VALUES (${user.id}, CURRENT_DATE)`;
        await sql`UPDATE users SET xp = xp + 1 WHERE id = ${user.id}`;
        return json({ claimed: true, xp: 1 });
      }
      return json({ claimed: false, message: 'আজকের বোনাস নেওয়া হয়ে গেছে' });
    }

    // Mystery box
    if (path === '/open-box' && req.method === 'POST') {
      const [box] = await sql`SELECT * FROM mystery_boxes WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (box?.opened) return json({ opened: false, message: 'আজ বক্স খোলা হয়ে গেছে' });
      const rewards = ['+3 XP', '+5 XP', 'বিশেষ ব্যাজ "লাকি ট্রেডার"', '+2 XP'];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      if (!box) {
        await sql`INSERT INTO mystery_boxes (user_id, date, opened, reward) VALUES (${user.id}, CURRENT_DATE, true, ${reward})`;
      } else {
        await sql`UPDATE mystery_boxes SET opened = true, reward = ${reward} WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      }
      if (reward.includes('XP')) {
        const xp = parseInt(reward);
        await sql`UPDATE users SET xp = xp + ${xp} WHERE id = ${user.id}`;
      } else if (reward.includes('বিশেষ ব্যাজ')) {
        await sql`INSERT INTO badges (user_id, badge_type) VALUES (${user.id}, 'lucky-trader') ON CONFLICT DO NOTHING`;
      }
      return json({ reward });
    }

    // Reaction
    if (path === '/reaction' && req.method === 'POST') {
      const { post_id, reaction } = await req.json();
      if (!['👍','🔥','❤️'].includes(reaction)) return json({ error: 'Invalid reaction' }, 400);
      await sql`UPDATE community_posts SET reactions = jsonb_set(COALESCE(reactions, '{}'), ARRAY[${reaction}], COALESCE((reactions->>${reaction})::int, 0)::int + 1::text::jsonb) WHERE id = ${post_id}`;
      return json({ success: true });
    }

    // ---------- ADMIN ENDPOINTS ----------
    if (path === '/admin' && req.method === 'GET') {
      const admin_secret = url.searchParams.get('admin_secret');
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const totalUsers = (await sql`SELECT COUNT(*)::int FROM users`)[0].count;
      const dau = (await sql`SELECT COUNT(DISTINCT user_id)::int FROM daily_journals WHERE date = CURRENT_DATE`)[0].count;
      const wau = (await sql`SELECT COUNT(DISTINCT user_id)::int FROM daily_journals WHERE date > CURRENT_DATE - INTERVAL '7 days'`)[0].count;
      const avgQ6 = (await sql`SELECT AVG((scores->>'q6')::int)::float FROM daily_journals WHERE date > CURRENT_DATE - INTERVAL '30 days'`)[0].avg;
      const cohort = await sql`SELECT date, COUNT(DISTINCT user_id)::int as users FROM daily_journals GROUP BY date ORDER BY date DESC LIMIT 30`;
      return json({ totalUsers, dailyActive: dau, weeklyActive: wau, avgDiscipline: avgQ6, cohort });
    }

    if (path === '/admin/users' && req.method === 'GET') {
      const admin_secret = url.searchParams.get('admin_secret');
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const search = url.searchParams.get('search') || '';
      let users;
      if (search) {
        users = await sql`SELECT id, email, display_name, identity_level, xp, level, avatar_emoji FROM users WHERE email ILIKE ${'%'+search+'%'} OR display_name ILIKE ${'%'+search+'%'} ORDER BY created_at DESC LIMIT 50`;
      } else {
        users = await sql`SELECT id, email, display_name, identity_level, xp, level, avatar_emoji FROM users ORDER BY created_at DESC LIMIT 50`;
      }
      return json(users);
    }

    if (path === '/admin/simulate-day' && req.method === 'POST') {
      const { admin_secret, email, days, start_day } = await req.json();
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const targetUser = (await sql`SELECT id FROM users WHERE email = ${email}`)[0];
      if (!targetUser) return json({ error: 'User not found' }, 404);
      const userId = targetUser.id;
      const totalDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
      const today = new Date().toISOString().slice(0, 10);
      const startOffset = Math.min(Math.max(parseInt(start_day) || 1, 1), 30);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (startOffset - 1));
      let inserted = 0;
      for (let i = 0; i < totalDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().slice(0, 10);
        if (dateStr > today) break;
        const [existing] = await sql`SELECT id FROM daily_journals WHERE user_id = ${userId} AND date = ${dateStr}`;
        if (existing) continue;
        const scores = {
          q1: Math.floor(Math.random() * 10) + 1,
          q2: Math.floor(Math.random() * 10) + 1,
          q3: Math.floor(Math.random() * 10) + 1,
          q4: Math.floor(Math.random() * 10) + 1,
          q5: Math.floor(Math.random() * 10) + 1,
          q6: Math.floor(Math.random() * 10) + 1,
          q7: Math.floor(Math.random() * 10) + 1,
          q8: Math.floor(Math.random() * 10) + 1,
          q9: Math.floor(Math.random() * 10) + 1,
          q10: Math.floor(Math.random() * 10) + 1,
        };
        const radar = calculateRadarScores(scores);
        await sql`INSERT INTO daily_journals (user_id, date, mindfulness_done, commitment, trades_count, stop_loss_moved, revenge_trade, fomo_entry, overtrading, rule_followed, scores, radar_scores, evaluation_notes, reflection, feedback, tomorrow_mission) VALUES (${userId}, ${dateStr}, true, 'Simulated commitment', ${Math.floor(Math.random()*5)+1}, ${Math.random()>0.7}, ${Math.random()>0.8}, ${Math.random()>0.7}, ${Math.random()>0.8}, ${scores.q6>=8}, ${JSON.stringify(scores)}, ${JSON.stringify(radar)}, 'Simulated', 'Simulated', 'Good job!', 'Keep it up')`;
        inserted++;
      }
      const { count: totalJournals } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${userId}`)[0];
      const phase = computeIdentityPhase(totalJournals);
      await sql`UPDATE users SET identity_level = ${phase}, xp = xp + ${inserted * 3} WHERE id = ${userId}`;
      return json({ success: true, inserted_days: inserted });
    }

    if (path.startsWith('/admin/community') && req.method === 'GET') {
      const admin_secret = url.searchParams.get('admin_secret');
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const posts = await sql`SELECT cp.*, u.email as author, u.display_name, u.avatar_emoji FROM community_posts cp JOIN users u ON cp.user_id = u.id ORDER BY cp.created_at DESC LIMIT 100`;
      return json(posts.map(p => ({ ...p, author: maskEmail(p.author), display_name: p.display_name || p.author.split('@')[0] })));
    }

    if (path.match(/^\/admin\/posts\/(.+)\/hide$/) && req.method === 'PUT') {
      const admin_secret = (await req.json()).admin_secret;
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const postId = path.split('/')[3];
      const { hide } = await req.json();
      await sql`UPDATE community_posts SET is_hidden = ${hide} WHERE id = ${postId}`;
      return json({ success: true });
    }

    if (path.match(/^\/admin\/posts\/(.+)$/) && req.method === 'DELETE') {
      const admin_secret = (await req.json()).admin_secret;
      if (admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
      const postId = path.split('/')[3];
      await sql`DELETE FROM community_posts WHERE id = ${postId}`;
      return json({ success: true });
    }

    if (path === '/admin/content' && req.method === 'POST') {
      const body = await req.json();
      if (body.admin_secret !== ADMIN_SECRET) return json({ error: 'Forbidden' }, 403);
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
      return json({ success: true });
    }

    // ---------- USER ENDPOINTS ----------
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
      return json({
        user: { id: user.id, email: user.email, display_name: user.display_name, identity_level: user.identity_level, xp: user.xp, level: calculateLevel(user.xp), avatar_emoji: user.avatar_emoji },
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
      const { mindfulness_done, commitment } = await req.json();
      await sql`INSERT INTO daily_journals (user_id, date, mindfulness_done, commitment) VALUES (${user.id}, CURRENT_DATE, ${mindfulness_done}, ${commitment}) ON CONFLICT (user_id, date) DO UPDATE SET mindfulness_done = ${mindfulness_done}, commitment = ${commitment}`;
      return json({ success: true });
    }

    if (path === '/evaluation' && req.method === 'POST') {
      const body = await req.json();
      const { trades_count, stop_loss_moved, plan_deviation, revenge_trade, fomo_entry, overtrading, rule_followed, scores, evaluation_notes, reflection } = body;
      const [existing] = await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
      if (!existing) return json({ error: 'Morning checkin first' }, 400);
      if (existing.feedback) return json({ error: 'Already submitted' }, 400);
      const radar = calculateRadarScores(scores);
      await sql`UPDATE daily_journals SET trades_count=${trades_count}, stop_loss_moved=${stop_loss_moved}, plan_deviation=${plan_deviation}, revenge_trade=${revenge_trade}, fomo_entry=${fomo_entry}, overtrading=${overtrading}, rule_followed=${rule_followed}, scores=${JSON.stringify(scores)}, radar_scores=${JSON.stringify(radar)}, evaluation_notes=${evaluation_notes}, reflection=${reflection} WHERE user_id=${user.id} AND date=CURRENT_DATE`;
      const journal = (await sql`SELECT * FROM daily_journals WHERE user_id = ${user.id} AND date = CURRENT_DATE`)[0];
      const userName = user.display_name || user.email.split('@')[0];
      const { feedback, mission } = await generateFeedback(user.id, journal, userName);
      await sql`UPDATE daily_journals SET feedback=${feedback}, tomorrow_mission=${mission} WHERE id = ${journal.id}`;

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
      const [box] = await sql`SELECT * FROM mystery_boxes WHERE user_id = ${user.id} AND date = CURRENT_DATE`;
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
      if (correct) {
        await sql`UPDATE users SET xp = xp + 10 WHERE id = ${user.id}`;
        return json({ correct: true, message: 'Correct! +10 XP' });
      }
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
      const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
      const weekStart = startOfWeek.toISOString().slice(0,10);
      const [challenge] = await sql`SELECT * FROM weekly_challenges WHERE week_start = ${weekStart}`;
      if (!challenge) return json(null);
      const completed = await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id} AND date >= ${weekStart} AND date < (${weekStart}::date + INTERVAL '7 days') AND fomo_entry = false`;
      return json({ ...challenge, progress: completed[0].count });
    }

    if (path === '/certificate' && req.method === 'GET') {
      const { count } = (await sql`SELECT COUNT(*)::int FROM daily_journals WHERE user_id = ${user.id}`)[0];
      if (count < 30) return json({ error: 'Complete 30 days first' }, 400);
      const phase = computeIdentityPhase(count);
      const badges = (await sql`SELECT badge_type FROM badges WHERE user_id = ${user.id}`).map(b => b.badge_type).join(', ');
      const avgScore = (await sql`SELECT AVG((scores->>'q6')::int)::float FROM daily_journals WHERE user_id = ${user.id}`)[0].avg || 0;
      const verificationId = uuidv4();
      await sql`INSERT INTO certificates (user_id, verification_code) VALUES (${user.id}, ${verificationId})`;

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffb800"/>
      <stop offset="100%" stop-color="#d4af37"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0a0a0a"/>
  <text x="400" y="80" text-anchor="middle" fill="url(#gold)" font-size="38" font-weight="bold" font-family="Arial, sans-serif">AlamQuant Transformation Certificate</text>
  <text x="400" y="160" text-anchor="middle" fill="#fff" font-size="22" font-family="Arial, sans-serif">This certifies that</text>
  <text x="400" y="220" text-anchor="middle" fill="url(#gold)" font-size="32" font-weight="bold" font-family="Arial, sans-serif">${user.display_name || user.email}</text>
  <text x="400" y="280" text-anchor="middle" fill="#ddd" font-size="20" font-family="Arial, sans-serif">has completed the 30-Day Trader Transformation Journey</text>
  <text x="400" y="340" text-anchor="middle" fill="#ccc" font-size="20" font-family="Arial, sans-serif">Identity Phase: ${phase}</text>
  <text x="400" y="390" text-anchor="middle" fill="#ccc" font-size="20" font-family="Arial, sans-serif">Avg. Discipline Score: ${avgScore.toFixed(1)}</text>
  <text x="400" y="440" text-anchor="middle" fill="#aaa" font-size="16" font-family="Arial, sans-serif">Badges: ${badges || 'None'}</text>
  <text x="400" y="500" text-anchor="middle" fill="#888" font-size="16" font-family="Arial, sans-serif">Date: ${new Date().toLocaleDateString('en-US')}</text>
  <text x="400" y="550" text-anchor="middle" fill="#666" font-size="12" font-family="Arial, sans-serif">Verification: ${verificationId}</text>
</svg>`;

      return new Response(svg, {
        headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': 'attachment; filename="certificate.svg"' }
      });
    }

    if (path.startsWith('/verify/') && req.method === 'GET') {
      const code = path.split('/').pop();
      const [cert] = await sql`SELECT * FROM certificates WHERE verification_code = ${code}`;
      if (!cert) return json({ valid: false });
      const [u] = await sql`SELECT email, display_name FROM users WHERE id = ${cert.user_id}`;
      return json({ valid: true, user: maskEmail(u?.email), display_name: u?.display_name });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }
}