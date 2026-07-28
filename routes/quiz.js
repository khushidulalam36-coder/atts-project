const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

// POST: Add new question to a lesson
router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    const { id, question, options, correct, points, explanation } = req.body;
    if (!question?.en) return res.status(400).json({ error: 'Question text (EN) required' });
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least two options required' });
    }

    const lessonId = req.params.lessonId;

    // Lesson existence check
    const lessonCheck = await query('SELECT id FROM lessons WHERE id = $1', [lessonId]);
    const lessonRows = Array.isArray(lessonCheck) ? lessonCheck : (lessonCheck.rows || []);
    if (lessonRows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const qid = id || ('q-' + Date.now());
    const pointsValue = parseInt(points, 10) || 5;

    // Detailed logging for debugging
    console.log('Inserting quiz:', {
      qid,
      lessonId,
      questionType: typeof question,
      optionsType: typeof options,
      correct,
      pointsValue,
      explanationType: typeof explanation
    });

    await query(
      `INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [qid, lessonId, question, options, correct, pointsValue, explanation || {}]
    );

    // Retrieve the inserted row
    const r = await query('SELECT * FROM quiz_questions WHERE id = $1', [qid]);
    const rows = Array.isArray(r) ? r : (r.rows || []);
    if (rows.length === 0) {
      throw new Error('Insert succeeded but row not found');
    }

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('❌ Quiz POST error:', e.message);
    console.error('Stack:', e.stack);
    console.error('Request body:', JSON.stringify(req.body).slice(0, 500));
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// PUT: Update question by index
router.put('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const lessonCheck = await query('SELECT id FROM lessons WHERE id = $1', [lessonId]);
    const lessonRows = Array.isArray(lessonCheck) ? lessonCheck : (lessonCheck.rows || []);
    if (lessonRows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    const { id, question, options, correct, points, explanation } = req.body;
    const qid = id || ('q-' + Date.now());
    const pointsValue = parseInt(points, 10) || 5;

    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [lessonId]);
    const existingRows = Array.isArray(existing) ? existing : (existing.rows || []);
    const oldId = existingRows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);

    await query(
      `INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [qid, lessonId, question, options, correct, pointsValue, explanation || {}]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Quiz PUT error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// DELETE question by index
router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
    const rows = Array.isArray(existing) ? existing : (existing.rows || []);
    const oldId = rows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/submit', authenticate, async (req, res) => {
  try {
    const { lessonId, score, passed } = req.body;
    await query(
      'INSERT INTO quiz_scores (user_id, lesson_id, score, passed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET score=$3, passed=$4, attempted_at=NOW()',
      [req.user.userId, lessonId, score, passed]
    );
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/scores', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, score, passed FROM quiz_scores WHERE user_id=$1', [req.user.userId]);
    const scores = {};
    (Array.isArray(r) ? r : (r.rows || [])).forEach(row => {
      scores[row.lesson_id] = { score: row.score, passed: row.passed };
    });
    res.json(scores);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;