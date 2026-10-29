// Registration, login, admin login, logout and "who am I".
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');
const { ensureToken } = require('../middleware/csrf');
const { cleanText, isValidEmail, passwordProblem } = require('../utils/validate');

const router = express.Router();

// --- Very small in-memory login limiter (10 failed tries per 15 minutes per IP+email) ---
const failedLogins = new Map();
const WINDOW_MS = 15 * 60 * 1000;
function isLockedOut(key) {
  const entry = failedLogins.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { failedLogins.delete(key); return false; }
  return entry.count >= 10;
}
function recordFailure(key) {
  const entry = failedLogins.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) failedLogins.set(key, { count: 1, first: Date.now() });
  else entry.count += 1;
}

// GET /api/auth/me -> current user (or null) + CSRF token. Frontend calls this on every page.
router.get('/me', (req, res) => {
  const csrfToken = ensureToken(req);
  const user = req.user
    ? { id: req.user.id, fullName: req.user.full_name, email: req.user.email, department: req.user.department, role: req.user.role }
    : null;
  res.json({ user, csrfToken });
});

// POST /api/auth/register -> always creates a STUDENT. The role is never read from the request.
router.post('/register', asyncHandler(async (req, res) => {
  const fullName = cleanText(req.body.fullName);
  const email = cleanText(req.body.email).toLowerCase();
  const department = cleanText(req.body.department);
  const { password, confirmPassword } = req.body;
  const errors = [];

  if (fullName.length < 2 || fullName.length > 100) errors.push('Full name must be 2 to 100 characters.');
  if (!isValidEmail(email)) errors.push('Enter a valid email address.');
  if (department.length < 2 || department.length > 100) errors.push('Department must be 2 to 100 characters.');
  const pwProblem = passwordProblem(password);
  if (pwProblem) errors.push(pwProblem);
  else if (password !== confirmPassword) errors.push('Passwords do not match.');
  if (req.body.agreeRules !== true) errors.push('You must agree to the platform rules.');
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = await bcrypt.hash(password, 10);
  try {
    await db.query(
      "INSERT INTO users (full_name, email, department, password_hash, role) VALUES (?, ?, ?, ?, 'student')",
      [fullName, email, department, hash]
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists.' });
    throw err;
  }
  res.status(201).json({ message: 'Account created. You can log in now.' });
}));

// Shared login logic. expectedRole keeps student login and admin login separate.
function makeLoginHandler(expectedRole) {
  return asyncHandler(async (req, res, next) => {
    const email = cleanText(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const limitKey = req.ip + '|' + email;

    if (isLockedOut(limitKey)) return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND role = ?', [email, expectedRole]);
    const user = rows[0];
    const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

    // Same message for "no such user" and "wrong password" so attackers learn nothing.
    if (!user || !passwordOk) {
      recordFailure(limitKey);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (!user.is_active) return res.status(403).json({ error: 'This account has been deactivated. Contact the administrator.' });

    failedLogins.delete(limitKey);
    // New session id on login (prevents session fixation)
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      const csrfToken = ensureToken(req);
      res.json({
        user: { id: user.id, fullName: user.full_name, email: user.email, department: user.department, role: user.role },
        csrfToken
      });
    });
  });
}

router.post('/login', makeLoginHandler('student'));
router.post('/admin-login', makeLoginHandler('admin'));

// POST /api/auth/logout -> destroys the server-side session
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('reusehub.sid');
    res.json({ message: 'Logged out.' });
  });
});

module.exports = router;
