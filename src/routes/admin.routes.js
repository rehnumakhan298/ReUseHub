// Administrator API. EVERY route here passes requireAdmin on the server.
const express = require('express');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');
const { requireAdmin } = require('../middleware/auth');
const { removeItem } = require('../services/items.service');

const router = express.Router();
router.use(requireAdmin);

function parseId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/admin/stats -> platform numbers
router.get('/stats', asyncHandler(async (req, res) => {
  const [[row]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
       (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = 0) AS deactivatedStudents,
       (SELECT COUNT(*) FROM items WHERE status = 'active') AS activeListings,
       (SELECT COUNT(*) FROM items WHERE status = 'removed') AS removedListings,
       (SELECT COUNT(*) FROM items WHERE status = 'active' AND is_sample = 1) AS sampleListings,
       (SELECT COUNT(*) FROM exchange_requests) AS totalRequests,
       (SELECT COUNT(*) FROM exchange_requests WHERE status = 'Pending') AS pendingRequests,
       (SELECT COUNT(*) FROM exchange_requests WHERE status = 'Completed') AS completedExchanges,
       (SELECT COUNT(*) FROM reports WHERE status = 'Open') AS openReports`
  );
  const [byCategory] = await db.query(
    "SELECT category, COUNT(*) AS total FROM items WHERE status = 'active' GROUP BY category ORDER BY total DESC"
  );
  res.json({ ...row, byCategory });
}));

// GET /api/admin/users -> basic moderation info (no password hashes)
router.get('/users', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT u.id, u.full_name, u.email, u.department, u.role, u.is_active, u.created_at,
            (SELECT COUNT(*) FROM items i WHERE i.owner_id = u.id AND i.status = 'active') AS listings
     FROM users u ORDER BY u.created_at DESC, u.id DESC LIMIT 500`
  );
  res.json(rows);
}));

// PATCH /api/admin/users/:id/active -> deactivate / reactivate a STUDENT account
router.patch('/users/:id/active', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid user id.' });
  if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be true or false.' });
  const [result] = await db.query("UPDATE users SET is_active = ? WHERE id = ? AND role = 'student'", [req.body.isActive ? 1 : 0, id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Student account not found.' });
  res.json({ message: req.body.isActive ? 'Account reactivated.' : 'Account deactivated.' });
}));

// GET /api/admin/items -> all listings including removed ones
router.get('/items', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT i.id, i.name, i.category, i.listing_type, i.is_available, i.status, i.is_sample, i.created_at,
            u.full_name AS owner_name
     FROM items i JOIN users u ON u.id = i.owner_id ORDER BY i.created_at DESC, i.id DESC LIMIT 500`
  );
  res.json(rows);
}));

// DELETE /api/admin/items/:id -> remove an inappropriate listing
router.delete('/items/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid item id.' });
  const [rows] = await db.query("SELECT id FROM items WHERE id = ? AND status = 'active'", [id]);
  if (!rows.length) return res.status(404).json({ error: 'Active item not found.' });
  await removeItem(db, id);
  res.json({ message: 'Listing removed.' });
}));

// GET /api/admin/reports
router.get('/reports', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT rp.id, rp.item_id, rp.reason, rp.status, rp.created_at,
            i.name AS item_name, i.status AS item_status, reporter.full_name AS reporter_name
     FROM reports rp
     JOIN items i ON i.id = rp.item_id
     JOIN users reporter ON reporter.id = rp.reporter_id
     ORDER BY (rp.status = 'Open') DESC, rp.created_at DESC LIMIT 300`
  );
  res.json(rows);
}));

// PATCH /api/admin/reports/:id -> action: dismiss | resolve | remove_item
router.patch('/reports/:id', asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const action = req.body.action;
  if (!id) return res.status(400).json({ error: 'Invalid report id.' });
  if (!['dismiss', 'resolve', 'remove_item'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });

  const [rows] = await db.query("SELECT id, item_id FROM reports WHERE id = ? AND status = 'Open'", [id]);
  if (!rows.length) return res.status(404).json({ error: 'Open report not found.' });

  if (action === 'remove_item') await removeItem(db, rows[0].item_id);
  const newStatus = action === 'dismiss' ? 'Dismissed' : 'Resolved';
  await db.query('UPDATE reports SET status = ? WHERE id = ?', [newStatus, id]);
  res.json({ message: 'Report ' + newStatus.toLowerCase() + '.' });
}));

// GET /api/admin/requests -> all exchange requests (read-only for moderation)
router.get('/requests', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT r.id, r.status, r.created_at, i.name AS item_name,
            owner.full_name AS owner_name, requester.full_name AS requester_name
     FROM exchange_requests r
     JOIN items i ON i.id = r.item_id
     JOIN users owner ON owner.id = i.owner_id
     JOIN users requester ON requester.id = r.requester_id
     ORDER BY r.created_at DESC, r.id DESC LIMIT 300`
  );
  res.json(rows);
}));

module.exports = router;
