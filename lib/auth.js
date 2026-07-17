const jwt = require('jsonwebtoken');
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
