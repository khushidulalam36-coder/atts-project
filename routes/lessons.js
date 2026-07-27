const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');
const logger = require('../lib/logger');

router.post('/',
  authenticate,
  [
    body('subjectId').isString().notEmpty(),
    body('titles.en').isString().notEmpty(),
    body('contents').optional().isObject(),
    body('duration').optional().isInt({ min: 1 }),
    body('level').optional().isIn(['Beginner','Intermediate','Advanced']),
    body('quizPassScore').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { subjectId, titles, contents, duration, level, quizPassScore } = req.body;
      const id = 'les-' + Date.now();
      await query(
        'INSERT INTO lessons (id, subject_id, titles, contents, duration, level, quiz_pass_score, "order") VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX("order"),0)+1 FROM lessons WHERE subject_id=$2))',
        [id, subjectId, titles, contents || {}, duration || 15, level || 'Beginner', quizPassScore || 80]
      );
      const r = await query('SELECT * FROM lessons WHERE id = $1', [id]);
      res.status(201).json((r.rows || r)[0]);
    } catch (e) {
      logger.error('POST lesson error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.put('/:id',
  authenticate,
  [
    body('titles.en').optional().isString(),
    body('contents').optional().isObject(),
    body('duration').optional().isInt({ min: 1 }),
    body('level').optional().isIn(['Beginner','Intermediate','Advanced']),
    body('quizPassScore').optional().isInt({ min: 0, max: 100 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { titles, contents, duration, level, quizPassScore } = req.body;
      await query('UPDATE lessons SET titles=$1,contents=$2,duration=$3,level=$4,quiz_pass_score=$5 WHERE id=$6',
        [titles, contents, duration, level, quizPassScore, req.params.id]);
      const r = await query('SELECT * FROM lessons WHERE id = $1', [req.params.id]);
      res.json((r.rows || r)[0]);
    } catch (e) {
      logger.error('PUT lesson error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.delete('/:id', authenticate, async (req, res) => {
  try {
    await query('DELETE FROM lessons WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    logger.error('DELETE lesson error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reorder', authenticate, async (req, res) => {
  try {
    const { subjectId, ids } = req.body;
    if (!subjectId || !Array.isArray(ids)) return res.status(400).json({ error: 'subjectId + ids required' });
    for (let i = 0; i < ids.length; i++) await query('UPDATE lessons SET "order"=$1 WHERE id=$2 AND subject_id=$3', [i, ids[i], subjectId]);
    res.json({ success: true });
  } catch (e) {
    logger.error('Reorder lessons error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
