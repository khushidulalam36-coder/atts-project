const { verifyToken } = require('../lib/auth');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Missing authorization header' });
  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid authorization format' });
  const decoded = verifyToken(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid or expired token' });
  req.user = decoded;
  next();
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header) {
    const token = header.split(' ')[1];
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) req.user = decoded;
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
