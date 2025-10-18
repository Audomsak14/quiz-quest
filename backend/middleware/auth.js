export function requireAuth(req, res, next) {
  try {
    const header = req.headers['authorization'] || req.headers['x-auth-token'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (!token || !token.startsWith('simple_token_')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // simple_token_<userId>_<role>_<timestamp>
    const parts = token.replace('simple_token_', '').split('_');
    if (parts.length < 3) return res.status(401).json({ error: 'Invalid token' });
    const [userId, role] = parts;
    req.user = { id: userId, role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function authOptional(req, _res, next) {
  try {
    const header = req.headers['authorization'] || req.headers['x-auth-token'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    if (token && token.startsWith('simple_token_')) {
      const parts = token.replace('simple_token_', '').split('_');
      if (parts.length >= 3) {
        const [userId, role] = parts;
        req.user = { id: userId, role };
      }
    }
  } catch {}
  next();
}