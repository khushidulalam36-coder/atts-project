const router = require('express').Router();
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
