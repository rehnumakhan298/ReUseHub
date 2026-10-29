// CSRF protection: every state-changing request (POST/PUT/PATCH/DELETE) must send the
// token from GET /api/auth/me in the X-CSRF-Token header. A malicious website cannot read it.
const crypto = require('crypto');

function ensureToken(req) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  return req.session.csrfToken;
}

function verifyCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token');
  if (!sent || !req.session.csrfToken || sent !== req.session.csrfToken) {
    return res.status(403).json({ error: 'Security token missing or expired. Please refresh the page and try again.' });
  }
  next();
}

module.exports = { ensureToken, verifyCsrf };
