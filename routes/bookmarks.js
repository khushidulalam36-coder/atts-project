const router = require('express').Router();
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
