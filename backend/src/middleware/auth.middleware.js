const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'quiz-quest-dev-secret';

function attachUser(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = null;
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  return next();
}

module.exports = {
  JWT_SECRET,
  attachUser,
  requireAuth,
};
