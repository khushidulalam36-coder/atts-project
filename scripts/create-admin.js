require('dotenv').config();
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
        console.log(`✅ Admin user "${u}" created/updated successfully!`);
      } catch (err) {
        console.error('❌ Error:', err.message);
      }
      rl.close();
      process.exit(0);
    });
  });
}

createAdmin();
