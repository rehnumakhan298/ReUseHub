// Exchange requests and the chat attached to each request.
// A student can only see/act on requests where they are the requester OR the item's owner.
const express = require('express');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');
const { requireStudent } = require('../middleware/auth');
const { cleanText } = require('../utils/validate');

const router = express.Router();
router.use(requireStudent);

// Allowed status changes and who may make them.
// "owner" = the item's owner, "requester" = the student who asked, "either" = both.
const TRANSITIONS = {
  Pending: { Accepted: 'owner', Rejected: 'owner', Cancelled: 'requester' },
  Accepted: { Completed: 'owner', Cancelled: 'either' }
};

function parseId(value) {
  const id = parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Loads a request plus its item owner, only if the current user is a participant.
async function loadParticipantRequest(conn, requestId, userId, lock) {
  const [rows] = await conn.query(
    `SELECT r.*, i.owner_id, i.name AS item_name, i.status AS item_status
     FROM exchange_requests r JOIN items i ON i.id = r.item_id
     WHERE r.id = ? AND (r.requester_id = ? OR i.owner_id = ?) ${lock ? 'FOR UPDATE' : ''}`,
    [requestId, userId, userId]
  );
  return rows[0] || null;
}

// GET /api/requests?box=incoming|outgoing|all
router.get('/', asyncHandler(async (req, res) => {
  const box = ['incoming', 'outgoing'].includes(req.query.box) ? req.query.box : 'all';
  let condition = '(r.requester_id = ? OR i.owner_id = ?)';
  let params = [req.user.id, req.user.id];
  if (box === 'incoming') { condition = 'i.owner_id = ?'; params = [req.user.id]; }
  if (box === 'outgoing') { condition = 'r.requester_id = ?'; params = [req.user.id]; }

  const [rows] = await db.query(
    `SELECT r.id, r.item_id, r.message, r.offered_item, r.status, r.created_at, r.updated_at,
            i.name AS item_name, i.listing_type, i.owner_id, owner.full_name AS owner_name,
            r.requester_id, requester.full_name AS requester_name
     FROM exchange_requests r
     JOIN items i ON i.id = r.item_id
     JOIN users owner ON owner.id = i.owner_id
     JOIN users requester ON requester.id = r.requester_id
     WHERE ${condition}
     ORDER BY r.created_at DESC, r.id DESC`,
    params
  );
  // Tell the frontend which side the current user is on
  res.json(rows.map((r) => ({ ...r, your_role: r.owner_id === req.user.id ? 'owner' : 'requester' })));
}));

// POST /api/requests -> ask for an item
router.post('/', asyncHandler(async (req, res) => {
  const itemId = parseId(req.body.itemId);
  const message = cleanText(req.body.message);
  const offeredItem = cleanText(req.body.offeredItem) || null;
  const errors = [];
  if (!itemId) errors.push('Invalid item.');
  if (message.length < 5 || message.length > 500) errors.push('Message must be 5 to 500 characters.');
  if (offeredItem && offeredItem.length > 150) errors.push('Offered item must be at most 150 characters.');
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  const [items] = await db.query("SELECT id, owner_id, is_available FROM items WHERE id = ? AND status = 'active'", [itemId]);
  if (!items.length) return res.status(404).json({ error: 'Item not found.' });
  if (items[0].owner_id === req.user.id) return res.status(403).json({ error: 'You cannot request your own item.' });
  if (!items[0].is_available) return res.status(409).json({ error: 'This item is no longer available.' });

  const [open] = await db.query(
    "SELECT id FROM exchange_requests WHERE item_id = ? AND requester_id = ? AND status IN ('Pending','Accepted')",
    [itemId, req.user.id]
  );
  if (open.length) return res.status(409).json({ error: 'You already have an open request for this item.' });

  const [result] = await db.query(
    'INSERT INTO exchange_requests (item_id, requester_id, message, offered_item) VALUES (?, ?, ?, ?)',
    [itemId, req.user.id, message, offeredItem]
  );
  res.status(201).json({ id: result.insertId, message: 'Request sent to the owner.' });
}));

// PATCH /api/requests/:id/status -> accept / reject / cancel / complete (validated transitions)
router.patch('/:id/status', asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  const newStatus = cleanText(req.body.status);
  if (!requestId) return res.status(400).json({ error: 'Invalid request id.' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const request = await loadParticipantRequest(conn, requestId, req.user.id, true);
    if (!request) { await conn.rollback(); return res.status(404).json({ error: 'Request not found.' }); }

    const allowed = TRANSITIONS[request.status] && TRANSITIONS[request.status][newStatus];
    if (!allowed) {
      await conn.rollback();
      return res.status(400).json({ error: `A ${request.status} request cannot be changed to ${newStatus || 'that status'}.` });
    }
    const actorRole = request.owner_id === req.user.id ? 'owner' : 'requester';
    if (allowed !== 'either' && allowed !== actorRole) {
      await conn.rollback();
      return res.status(403).json({ error: `Only the ${allowed} can set this status.` });
    }

    await conn.query('UPDATE exchange_requests SET status = ? WHERE id = ?', [newStatus, requestId]);

    if (newStatus === 'Completed') {
      // The item is no longer available; other open requests for it are rejected.
      await conn.query('UPDATE items SET is_available = 0 WHERE id = ?', [request.item_id]);
      await conn.query(
        "UPDATE exchange_requests SET status = 'Rejected' WHERE item_id = ? AND id <> ? AND status IN ('Pending','Accepted')",
        [request.item_id, requestId]
      );
    }
    await conn.commit();
    res.json({ message: 'Request marked as ' + newStatus + '.' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/requests/:id/messages -> chat history (participants only)
router.get('/:id/messages', asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  if (!requestId) return res.status(400).json({ error: 'Invalid request id.' });
  const request = await loadParticipantRequest(db, requestId, req.user.id, false);
  if (!request) return res.status(404).json({ error: 'Request not found.' });

  const [rows] = await db.query(
    `SELECT m.id, m.body, m.created_at, m.sender_id, u.full_name AS sender_name
     FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.request_id = ? ORDER BY m.id ASC LIMIT 200`,
    [requestId]
  );
  res.json({
    status: request.status,
    canSend: ['Pending', 'Accepted', 'Completed'].includes(request.status),
    messages: rows.map((m) => ({ ...m, mine: m.sender_id === req.user.id }))
  });
}));

// POST /api/requests/:id/messages -> send a chat message
router.post('/:id/messages', asyncHandler(async (req, res) => {
  const requestId = parseId(req.params.id);
  const body = cleanText(req.body.body);
  if (!requestId) return res.status(400).json({ error: 'Invalid request id.' });
  if (body.length < 1 || body.length > 500) return res.status(400).json({ error: 'Message must be 1 to 500 characters.' });

  const request = await loadParticipantRequest(db, requestId, req.user.id, false);
  if (!request) return res.status(404).json({ error: 'Request not found.' });
  if (!['Pending', 'Accepted', 'Completed'].includes(request.status)) {
    return res.status(409).json({ error: 'Chat is closed for ' + request.status.toLowerCase() + ' requests.' });
  }
  await db.query('INSERT INTO messages (request_id, sender_id, body) VALUES (?, ?, ?)', [requestId, req.user.id, body]);
  res.status(201).json({ message: 'Message sent.' });
}));

module.exports = router;
