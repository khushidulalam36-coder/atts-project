const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const { query } = require('../lib/db');
const {
  generateToken, hashPassword, comparePassword,
  getUserByUsername, createUser, getOrCreatePortfolio, getUserById, verifyToken
} = require('../lib/auth');
const logger = require('../lib/logger');

router.post('/login',
  [
    body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { username, password } = req.body;
      const user = await getUserByUsername(username);
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      const match = await comparePassword(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid credentials' });
      const token = generateToken(user.id, user.username);
      await getOrCreatePortfolio(user.id);
      res.json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      logger.error('Login error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.post('/register',
  [
    body('username').isLength({ min: 3 }).withMessage('Username min 3 chars'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { username, password } = req.body;
      const exists = await getUserByUsername(username);
      if (exists) return res.status(409).json({ error: 'Username taken' });
      const hash = await hashPassword(password);
      const user = await createUser(username, hash);
      await getOrCreatePortfolio(user.id);
      const token = generateToken(user.id, user.username);
      res.status(201).json({ token, user: { id: user.id, username: user.username } });
    } catch (e) {
      logger.error('Register error:', e);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: 'Unauthorized' });
    const token = header.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Invalid token' });
    const user = await getUserById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (e) {
    logger.error('Me error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
