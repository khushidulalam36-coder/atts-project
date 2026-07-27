const router = require('express').Router();
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
