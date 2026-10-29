// Authentication / authorization middleware. All permission checks happen HERE on the server;
// hiding buttons in the frontend is only for convenience.
const db = require('../config/database');
const { asyncHandler } = require('./errors');

// Loads the logged-in user (fresh from MySQL) into req.user. Deactivated users are logged out.
const loadUser = asyncHandler(async (req, res, next) => {
  if (req.session && req.session.userId) {
    const [rows] = await db.query(
      'SELECT id, full_name, email, department, role, is_active, created_at FROM users WHERE id = ?',
      [req.session.userId]
    );
    if (rows.length && rows[0].is_active) {
      req.user = rows[0];
    } else {
      delete req.session.userId; // account removed or deactivated
    }
  }
  next();
});

function requireLogin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

// Students only (admins use the admin dashboard, not student actions)
function requireStudent(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== 'student') return res.status(403).json({ error: 'This action is only for student accounts.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in as an administrator.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  next();
}

module.exports = { loadUser, requireLogin, requireStudent, requireAdmin };
