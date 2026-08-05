const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

function safeJsonb(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.error('❌ JSON.stringify error:', e.message);
    return JSON.stringify({});
  }
}

router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const { id, question, options, correct, points, explanation } = req.body;

    if (!question?.en) {
      return res.status(400).json({ error: 'Question text (EN) required' });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least two options required' });
    }
    for (const opt of options) {
      if (!opt.id || !opt.text?.en) {
        return res.status(400).json({ error: 'Each option must have id and text.en' });
      }
    }

    let lessonCheck = await query('SELECT id FROM lessons WHERE id = $1', [lessonId]);
    const lessonRows = lessonCheck.rows || lessonCheck;
    if (!lessonRows || lessonRows.length === 0) {
      return res.status(404).json({ error: 'Lesson not found. Please create the lesson first.' });
    }

    const qid = id || ('q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    const questionJson = safeJsonb(question);
    const optionsJson = safeJsonb(options);
    const explanationJson = safeJsonb(explanation || {});
    const correctStr = (correct || '').trim();
    if (!correctStr) return res.status(400).json({ error: 'Correct answer required' });
    const pointsNum = parseInt(points) || 5;

    await query(
      'INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [qid, lessonId, questionJson, optionsJson, correctStr, pointsNum, explanationJson]
    );

    let result = await query('SELECT * FROM quiz_questions WHERE id = $1', [qid]);
    const row = (result.rows || result)[0];
    res.status(201).json(row);
  } catch (e) {
    console.error('❌ [QUIZ POST] error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

router.put('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const idx = parseInt(req.params.idx);
    const { id, question, options, correct, points, explanation } = req.body;

    if (!question?.en) return res.status(400).json({ error: 'Question text (EN) required' });
    if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'At least two options required' });
    for (const opt of options) {
      if (!opt.id || !opt.text?.en) return res.status(400).json({ error: 'Each option must have id and text.en' });
    }

    let existing = await query('SELECT * FROM quiz_questions WHERE lesson_id = $1 ORDER BY id', [lessonId]);
    const rows = existing.rows || existing;
    if (idx < 0 || idx >= rows.length) return res.status(404).json({ error: 'Question index out of range' });
    const oldId = rows[idx].id;

    const qid = id || ('q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    await query('DELETE FROM quiz_questions WHERE id = $1', [oldId]);
    await query(
      'INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [qid, lessonId, safeJsonb(question), safeJsonb(options), correct, parseInt(points) || 5, safeJsonb(explanation || {})]
    );
    res.json({ success: true, id: qid });
  } catch (e) {
    console.error('❌ [QUIZ PUT] error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const idx = parseInt(req.params.idx);
    let existing = await query('SELECT * FROM quiz_questions WHERE lesson_id = $1 ORDER BY id', [lessonId]);
    const rows = existing.rows || existing;
    if (idx < 0 || idx >= rows.length) return res.status(404).json({ error: 'Question index out of range' });
    const oldId = rows[idx].id;
    await query('DELETE FROM quiz_questions WHERE id = $1', [oldId]);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ [QUIZ DELETE] error:', e.message);
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
    console.error('❌ [QUIZ SUBMIT] error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ [QUIZ RESET] error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/scores', authenticate, async (req, res) => {
  try {
    const r = await query('SELECT lesson_id, score, passed FROM quiz_scores WHERE user_id=$1', [req.user.userId]);
    const scores = {};
    (r.rows || r).forEach(row => { scores[row.lesson_id] = { score: row.score, passed: row.passed }; });
    res.json(scores);
  } catch (e) {
    console.error('❌ [QUIZ SCORES] error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
