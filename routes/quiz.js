const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    const { id, question, options, correct, points, explanation } = req.body;
    if (!question?.en) return res.status(400).json({ error: 'Question text required' });
    const qid = id || ('q-' + Date.now());
    await query('INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]);
    const r = await query('SELECT * FROM quiz_questions WHERE id=$1', [qid]);
    res.status(201).json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const { id, question, options, correct, points, explanation } = req.body;
    const qid = id || ('q-' + Date.now());
    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
    const rows = existing.rows || existing;
    const oldId = rows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
    await query('INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
    const rows = existing.rows || existing;
    const oldId = rows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/submit', authenticate, async (req, res) => {
  try {
    const { lessonId, score, passed } = req.body;
    await query(
      'INSERT INTO quiz_scores (user_id, lesson_id, score, passed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET score=$3, passed=$4, attempted_at=NOW()',
      [req.user.userId, lessonId, score, passed]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.get('/scores', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, score, passed FROM quiz_scores WHERE user_id=$1', [req.user.userId]);
    const scores = {};
    (r.rows || r).forEach(row => { scores[row.lesson_id] = { score: row.score, passed: row.passed }; });
    res.json(scores);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
