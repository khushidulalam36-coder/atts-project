require('dotenv').config();
const { query } = require('../lib/db');
const bcrypt = require('bcrypt');

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      icon TEXT DEFAULT '📁',
      names JSONB NOT NULL,
      "order" INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      subject_id TEXT REFERENCES subjects(id) ON DELETE CASCADE,
      titles JSONB NOT NULL,
      contents JSONB NOT NULL DEFAULT '{}',
      duration INTEGER DEFAULT 15,
      level TEXT DEFAULT 'Beginner',
      quiz_pass_score INTEGER DEFAULT 80,
      "order" INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      question JSONB NOT NULL,
      options JSONB NOT NULL,
      correct TEXT NOT NULL,
      points INTEGER DEFAULT 5,
      explanation JSONB DEFAULT '{}'
  );`,
  `CREATE TABLE IF NOT EXISTS user_progress (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      progress INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );`,
  `CREATE TABLE IF NOT EXISTS quiz_scores (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      score INTEGER DEFAULT 0,
      passed BOOLEAN DEFAULT FALSE,
      attempted_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );`,
  `CREATE TABLE IF NOT EXISTS bookmarks (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );`,
  `CREATE TABLE IF NOT EXISTS notes (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
      content TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, lesson_id)
  );`,
  `CREATE TABLE IF NOT EXISTS portfolios (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      cash DECIMAL(15,2) DEFAULT 100000.00,
      holdings JSONB DEFAULT '{}',
      transactions JSONB DEFAULT '[]',
      drawn_lines JSONB DEFAULT '{}'
  );`
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
