// Students can report an inappropriate listing; admins review reports in the dashboard.
const express = require('express');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');
const { requireStudent } = require('../middleware/auth');
const { cleanText } = require('../utils/validate');

const router = express.Router();

router.post('/', requireStudent, asyncHandler(async (req, res) => {
  const itemId = parseInt(req.body.itemId, 10);
  const reason = cleanText(req.body.reason);
  if (!Number.isInteger(itemId) || itemId < 1) return res.status(400).json({ error: 'Invalid item.' });
  if (reason.length < 5 || reason.length > 500) return res.status(400).json({ error: 'Reason must be 5 to 500 characters.' });

  const [items] = await db.query("SELECT owner_id FROM items WHERE id = ? AND status = 'active'", [itemId]);
  if (!items.length) return res.status(404).json({ error: 'Item not found.' });
  if (items[0].owner_id === req.user.id) return res.status(403).json({ error: 'You cannot report your own listing.' });

  const [dup] = await db.query("SELECT id FROM reports WHERE item_id = ? AND reporter_id = ? AND status = 'Open'", [itemId, req.user.id]);
  if (dup.length) return res.status(409).json({ error: 'You already reported this listing. The admin will review it.' });

  await db.query('INSERT INTO reports (item_id, reporter_id, reason) VALUES (?, ?, ?)', [itemId, req.user.id, reason]);
  res.status(201).json({ message: 'Report submitted. Thank you.' });
}));

module.exports = router;
