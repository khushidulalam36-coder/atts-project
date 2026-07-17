const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const subjs = await query('SELECT * FROM subjects ORDER BY "order", id');
    for (const s of (subjs.rows || subjs)) {
      const lr = await query('SELECT * FROM lessons WHERE subject_id = $1 ORDER BY "order", id', [s.id]);
      s.lessons = lr.rows || lr;
      for (const l of s.lessons) {
        const qr = await query('SELECT * FROM quiz_questions WHERE lesson_id = $1', [l.id]);
        l.quiz = qr.rows || qr;
      }
    }
    res.json(subjs.rows || subjs);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { names, icon } = req.body;
    if (!names?.en) return res.status(400).json({ error: 'English name required' });
    const id = 'subj-' + Date.now();
    await query('INSERT INTO subjects (id, icon, names, "order") VALUES ($1,$2,$3,(SELECT COALESCE(MAX("order"),0)+1 FROM subjects))', [id, icon || '📁', names]);
    const r = await query('SELECT * FROM subjects WHERE id = $1', [id]);
    res.status(201).json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const { names, icon } = req.body;
    await query('UPDATE subjects SET names=$1, icon=$2 WHERE id=$3', [names, icon, req.params.id]);
    const r = await query('SELECT * FROM subjects WHERE id = $1', [req.params.id]);
    res.json((r.rows || r)[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try { await query('DELETE FROM subjects WHERE id=$1', [req.params.id]); res.json({ success: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

router.post('/reorder', authenticate, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    for (let i = 0; i < ids.length; i++) await query('UPDATE subjects SET "order"=$1 WHERE id=$2', [i, ids[i]]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
