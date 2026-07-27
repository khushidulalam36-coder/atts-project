const router = require('express').Router();
const { query } = require('../lib/db');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, async (req, res) => {
  try {
    const user = await query('SELECT username FROM users WHERE id=$1', [req.user.userId]);
    const u = (user.rows || user)[0];
    if (u?.username !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Array expected' });
    for (const s of data) {
      await query('INSERT INTO subjects (id,icon,names,"order") VALUES ($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET icon=$2,names=$3,"order"=$4',
        [s.id, s.icon || '📁', s.names, s.order || 0]);
      for (const l of (s.lessons || [])) {
        await query('INSERT INTO lessons (id,subject_id,titles,contents,duration,level,quiz_pass_score,"order") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET subject_id=$2,titles=$3,contents=$4,duration=$5,level=$6,quiz_pass_score=$7,"order"=$8',
          [l.id, s.id, l.titles, l.contents, l.duration || 15, l.level || 'Beginner', l.quizPassScore || 80, l.order || 0]);
        for (const q of (l.quiz || [])) {
          await query('INSERT INTO quiz_questions (id,lesson_id,question,options,correct,points,explanation) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET lesson_id=$2,question=$3,options=$4,correct=$5,points=$6,explanation=$7',
            [q.id, l.id, q.question, q.options, q.correct, q.points || 5, q.explanation || {}]);
        }
      }
    }
    res.json({ success: true, count: data.length });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
