const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

// 🛠️ Helper to safely stringify JSONB fields
function safeJsonb(value) {
  try {
    return JSON.stringify(value);
  } catch (e) {
    console.error('❌ JSON.stringify error:', e.message);
    return JSON.stringify({});
  }
}

// 📌 POST /api/quiz/:lessonId – add a new question
router.post('/:lessonId', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const { id, question, options, correct, points, explanation } = req.body;

    console.log('🔍 [QUIZ POST] lessonId:', lessonId);
    console.log('🔍 [QUIZ POST] body:', JSON.stringify(req.body, null, 2));

    // ── Validate required fields ──────────────────────────────
    if (!question?.en) {
      console.warn('⚠️ Missing question.en');
      return res.status(400).json({ error: 'Question text (EN) required' });
    }
    if (!Array.isArray(options) || options.length < 2) {
      console.warn('⚠️ Invalid options array – not array or too short');
      return res.status(400).json({ error: 'At least two options required' });
    }
    // Ensure each option has an id and text
    for (const opt of options) {
      if (!opt.id || !opt.text?.en) {
        console.warn('⚠️ Option missing id or text.en:', opt);
        return res.status(400).json({ error: 'Each option must have id and text.en' });
      }
    }

    // ── Check lesson existence ────────────────────────────────
    console.log('🔍 [QUIZ POST] Checking lesson existence...');
    let lessonCheck;
    try {
      lessonCheck = await query('SELECT id FROM lessons WHERE id = $1', [lessonId]);
    } catch (dbErr) {
      console.error('❌ DB error while checking lesson:', dbErr.message);
      return res.status(500).json({ error: 'Database error checking lesson' });
    }
    const lessonRows = lessonCheck.rows || lessonCheck;
    if (!lessonRows || lessonRows.length === 0) {
      console.warn('⚠️ Lesson not found:', lessonId);
      return res.status(404).json({ error: 'Lesson not found. Please create the lesson first.' });
    }
    console.log('✅ Lesson found:', lessonId);

    // ── Build question ID ──────────────────────────────────────
    const qid = id || ('q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    console.log('🔑 Generated question ID:', qid);

    // ── Prepare JSONB values ──────────────────────────────────
    const questionJson = safeJsonb(question);
    const optionsJson = safeJsonb(options);
    const explanationJson = safeJsonb(explanation || {});
    const correctStr = (correct || '').trim();
    if (!correctStr) {
      console.warn('⚠️ Correct answer not provided');
      return res.status(400).json({ error: 'Correct answer required' });
    }
    const pointsNum = parseInt(points) || 5;
    if (pointsNum < 1) {
      console.warn('⚠️ Points must be >= 1, using 5');
    }
    console.log('📦 Inserting quiz question with:', { qid, lessonId, questionJson, optionsJson, correctStr, pointsNum,
      explanationJson });

    // ── Insert into DB ─────────────────────────────────────────
    try {
      await query(
        'INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [qid, lessonId, questionJson, optionsJson, correctStr, pointsNum, explanationJson]
      );
      console.log('✅ Quiz question inserted successfully, id:', qid);
    } catch (insertErr) {
      console.error('❌ Insert error:', insertErr.message, insertErr.stack);
      return res.status(500).json({ error: 'Failed to insert question: ' + insertErr.message });
    }

    // ── Return the created question ──────────────────────────
    let result;
    try {
      result = await query('SELECT * FROM quiz_questions WHERE id = $1', [qid]);
    } catch (selectErr) {
      console.error('❌ Error fetching inserted question:', selectErr.message);
      return res.status(500).json({ error: 'Question created but failed to retrieve it' });
    }
    const row = (result.rows || result)[0];
    res.status(201).json(row);

  } catch (e) {
    console.error('❌ [QUIZ POST] Unhandled error:', e.message, e.stack);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// 📌 PUT /api/quiz/:lessonId/:idx – update a question by index
router.put('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const idx = parseInt(req.params.idx);
    const { id, question, options, correct, points, explanation } = req.body;

    console.log('🔍 [QUIZ PUT] lessonId:', lessonId, 'idx:', idx);
    console.log('🔍 [QUIZ PUT] body:', JSON.stringify(req.body, null, 2));

    // ── Validate ──────────────────────────────────────────────
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

    // ── Get existing questions ────────────────────────────────
    let existing;
    try {
      existing = await query('SELECT * FROM quiz_questions WHERE lesson_id = $1 ORDER BY id', [lessonId]);
    } catch (err) {
      console.error('❌ Error fetching existing questions:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    const rows = existing.rows || existing;
    if (idx < 0 || idx >= rows.length) {
      return res.status(404).json({ error: 'Question index out of range' });
    }
    const oldId = rows[idx].id;

    // ── Delete old, insert updated ────────────────────────────
    const qid = id || ('q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    try {
      await query('DELETE FROM quiz_questions WHERE id = $1', [oldId]);
      await query(
        'INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [qid, lessonId, safeJsonb(question), safeJsonb(options), correct, parseInt(points) || 5, safeJsonb(explanation || {})]
      );
      console.log('✅ Quiz question updated, new id:', qid);
    } catch (err) {
      console.error('❌ Error updating question:', err.message);
      return res.status(500).json({ error: 'Failed to update question: ' + err.message });
    }

    res.json({ success: true, id: qid });
  } catch (e) {
    console.error('❌ [QUIZ PUT] error:', e.message, e.stack);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// 📌 DELETE /api/quiz/:lessonId/:idx – delete a question by index
router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const idx = parseInt(req.params.idx);
    console.log('🔍 [QUIZ DELETE] lessonId:', lessonId, 'idx:', idx);

    let existing;
    try {
      existing = await query('SELECT * FROM quiz_questions WHERE lesson_id = $1 ORDER BY id', [lessonId]);
    } catch (err) {
      console.error('❌ Error fetching existing questions:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    const rows = existing.rows || existing;
    if (idx < 0 || idx >= rows.length) {
      return res.status(404).json({ error: 'Question index out of range' });
    }
    const oldId = rows[idx].id;
    try {
      await query('DELETE FROM quiz_questions WHERE id = $1', [oldId]);
      console.log('✅ Quiz question deleted:', oldId);
    } catch (err) {
      console.error('❌ Error deleting question:', err.message);
      return res.status(500).json({ error: 'Failed to delete question: ' + err.message });
    }
    res.json({ success: true });
  } catch (e) {
    console.error('❌ [QUIZ DELETE] error:', e.message, e.stack);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// ── Submit quiz score ─────────────────────────────────────────────
router.post('/submit', authenticate, async (req, res) => {
  try {
    const { lessonId, score, passed } = req.body;
    console.log('🔍 [QUIZ SUBMIT] lessonId:', lessonId, 'score:', score, 'passed:', passed);
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

// ── Reset quiz for a lesson ──────────────────────────────────────
router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ [QUIZ RESET] error:', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get all scores for logged-in user ───────────────────────────
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
