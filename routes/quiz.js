const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.post('/:lessonId',
  authenticate,
  [
    body('question.en').isString().notEmpty(),
    body('options').isArray({ min: 2 }),
    body('correct').isIn(['a','b','c','d']),
    body('points').optional().isInt({ min: 1 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id, question, options, correct, points, explanation } = req.body;
      const qid = id || ('q-' + Date.now());
      await query('INSERT INTO quiz_questions (id, lesson_id, question, options, correct, points, explanation) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [qid, req.params.lessonId, question, options, correct, points || 5, explanation || {}]);
      const r = await query('SELECT * FROM quiz_questions WHERE id=$1', [qid]);
      res.status(201).json((r.rows || r)[0]);
    } catch (e) {
      logger.error('POST quiz error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put('/:lessonId/:idx',
  authenticate,
  [
    body('question.en').optional().isString(),
    body('options').optional().isArray({ min: 2 }),
    body('correct').optional().isIn(['a','b','c','d'])
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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
    } catch (e) {
      logger.error('PUT quiz error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete('/:lessonId/:idx', authenticate, async (req, res) => {
  try {
    const existing = await query('SELECT * FROM quiz_questions WHERE lesson_id=$1 ORDER BY id', [req.params.lessonId]);
    const rows = existing.rows || existing;
    const oldId = rows[parseInt(req.params.idx)]?.id;
    if (oldId) await query('DELETE FROM quiz_questions WHERE id=$1', [oldId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('DELETE quiz error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/submit',
  authenticate,
  [
    body('lessonId').isString().notEmpty(),
    body('score').isInt({ min: 0, max: 100 }),
    body('passed').isBoolean()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { lessonId, score, passed } = req.body;
      await query(
        'INSERT INTO quiz_scores (user_id, lesson_id, score, passed) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, lesson_id) DO UPDATE SET score=$3, passed=$4, attempted_at=NOW()',
        [req.user.userId, lessonId, score, passed]
      );
      res.json({ success: true });
    } catch (e) {
      logger.error('Submit quiz error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/reset/:lessonId', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM quiz_scores WHERE user_id=$1 AND lesson_id=$2', [req.user.userId, req.params.lessonId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('Reset quiz error:', e);
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
    logger.error('Get scores error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
