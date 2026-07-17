const router = require('express').Router();
const multer = require('multer');
const { uploadFile, deleteFile } = require('../lib/blob');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({ url, success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

router.delete('/', authenticate, async (req, res) => {
  try {
    if (!req.body.url) return res.status(400).json({ error: 'URL required' });
    await deleteFile(req.body.url);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

module.exports = router;
