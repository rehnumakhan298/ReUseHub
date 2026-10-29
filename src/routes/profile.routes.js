// A student's own profile. Only the logged-in user's row is ever read or changed.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');
const { requireLogin } = require('../middleware/auth');
const { cleanText, passwordProblem } = require('../utils/validate');

const router = express.Router();
router.use(requireLogin);

router.get('/', asyncHandler(async (req, res) => {
  const [[counts]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM items WHERE owner_id = ? AND status = 'active') AS listings,
       (SELECT COUNT(*) FROM exchange_requests WHERE requester_id = ?) AS requestsSent,
       (SELECT COUNT(*) FROM exchange_requests r JOIN items i ON i.id = r.item_id WHERE i.owner_id = ?) AS requestsReceived`,
    [req.user.id, req.user.id, req.user.id]
  );
  res.json({
    profile: {
      fullName: req.user.full_name, email: req.user.email, department: req.user.department,
      role: req.user.role, memberSince: req.user.created_at
    },
    counts
  });
}));

// PUT /api/profile -> change name/department, and optionally the password.
router.put('/', asyncHandler(async (req, res) => {
  const fullName = cleanText(req.body.fullName);
  const department = cleanText(req.body.department);
  const errors = [];
  if (fullName.length < 2 || fullName.length > 100) errors.push('Full name must be 2 to 100 characters.');
  if (department.length < 2 || department.length > 100) errors.push('Department must be 2 to 100 characters.');

  const wantsPasswordChange = Boolean(req.body.newPassword);
  let newHash = null;
  if (wantsPasswordChange) {
    const [[row]] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const currentOk = await bcrypt.compare(String(req.body.currentPassword || ''), row.password_hash);
    if (!currentOk) errors.push('Current password is incorrect.');
    const problem = passwordProblem(req.body.newPassword);
    if (problem) errors.push(problem);
    if (!errors.length) newHash = await bcrypt.hash(req.body.newPassword, 10);
  }
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  // Only these columns can change; role and email are not editable here.
  if (newHash) {
    await db.query('UPDATE users SET full_name = ?, department = ?, password_hash = ? WHERE id = ?', [fullName, department, newHash, req.user.id]);
  } else {
    await db.query('UPDATE users SET full_name = ?, department = ? WHERE id = ?', [fullName, department, req.user.id]);
  }
  res.json({ message: 'Profile updated.' });
}));

module.exports = router;
