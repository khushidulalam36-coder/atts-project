const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.get('/all', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, content FROM notes WHERE user_id=$1', [req.user.userId]);
    const notes = {};
    (r.rows || r).forEach(row => { notes[row.lesson_id] = row.content; });
    res.json(notes);
  } catch (e) {
    logger.error('GET all notes error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:lessonId', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT content FROM notes WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ content: (r.rows || r)[0]?.content || '' });
  } catch (e) {
    logger.error('GET note error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:lessonId', authenticate, async (req, res) => {
  try {
    await query(
      'INSERT INTO notes (user_id, lesson_id, content) VALUES ($1,$2,$3) ON CONFLICT (user_id, lesson_id) DO UPDATE SET content=$3, updated_at=NOW()',
      [req.user.userId, req.params.lessonId, req.body.content || '']
    );
    res.json({ success: true });
  } catch (e) {
    logger.error('PUT note error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
