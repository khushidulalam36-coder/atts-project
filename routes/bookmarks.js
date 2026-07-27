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
    const { id, question, options, correct, points, explanation } = req.body;
    if (!question?.en) return res.status(400).json({ error: 'Question text (EN) required' });
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least two options required' });
    }
    // নিশ্চিত করুন lesson_id exists
    const lessonCheck = await query('SELECT id FROM lessons WHERE id = $1', [req.params.lessonId]);
    if (!lessonCheck.rows || lessonCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }
    const qid = id || ('q-' + Date.now());
    // JSONB-তে সেভ করার জন্য options-কে JSON.stringify করা লাগবে না, neon driver নিজেই করবে
    await query(
      'INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]
    );
    const r = await query('SELECT * FROM quiz_questions WHERE id=$1', [qid]);
    res.status(201).json((r.rows || r)[0]);
  } catch (e) {
    console.error('❌ Quiz POST error:', e.message, e.stack);
    // ডিটেইলড এরর পাঠান (শুধু ডেভের জন্য)
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

router.delete('/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM bookmarks WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
