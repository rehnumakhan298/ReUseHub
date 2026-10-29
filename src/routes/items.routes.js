// Item listings. Browsing is public; creating/editing/removing requires a logged-in student
// who OWNS the item (checked in SQL with owner_id, not trusted from the browser).
const express = require('express');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');
const { requireStudent } = require('../middleware/auth');
const { validateItem, CATEGORIES, CONDITIONS, LISTING_TYPES } = require('../utils/validate');
const { removeItem } = require('../services/items.service');

const router = express.Router();

// Columns sent to the browser (never includes the owner's email or password hash)
const ITEM_COLUMNS = `i.id, i.name, i.category, i.description, i.item_condition, i.listing_type, i.price,
  i.image_url, i.is_available, i.is_sample, i.created_at, i.owner_id, u.full_name AS owner_name`;

// GET /api/items?q=&category=&condition=&type=&limit=  -> public, available listings only
router.get('/', asyncHandler(async (req, res) => {
  const where = ["i.status = 'active'", 'i.is_available = 1'];
  const params = [];

  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  if (q) {
    where.push('(i.name LIKE ? OR i.description LIKE ?)');
    params.push('%' + q + '%', '%' + q + '%');
  }
  if (CATEGORIES.includes(req.query.category)) { where.push('i.category = ?'); params.push(req.query.category); }
  if (CONDITIONS.includes(req.query.condition)) { where.push('i.item_condition = ?'); params.push(req.query.condition); }
  if (LISTING_TYPES.includes(req.query.type)) { where.push('i.listing_type = ?'); params.push(req.query.type); }

  let limit = parseInt(req.query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) limit = 60;
  params.push(limit);

  const [rows] = await db.query(
    `SELECT ${ITEM_COLUMNS} FROM items i JOIN users u ON u.id = i.owner_id
     WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC, i.id DESC LIMIT ?`,
    params
  );
  res.json(rows);
}));

// GET /api/items/mine -> the logged-in student's own active listings (declared before /:id)
router.get('/mine', requireStudent, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT ${ITEM_COLUMNS},
       (SELECT COUNT(*) FROM exchange_requests r WHERE r.item_id = i.id AND r.status = 'Pending') AS pending_requests
     FROM items i JOIN users u ON u.id = i.owner_id
     WHERE i.owner_id = ? AND i.status = 'active' ORDER BY i.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
}));

// GET /api/items/:id -> public details of one (non-removed) item
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid item id.' });
  const [rows] = await db.query(
    `SELECT ${ITEM_COLUMNS} FROM items i JOIN users u ON u.id = i.owner_id WHERE i.id = ? AND i.status = 'active'`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Item not found.' });
  res.json(rows[0]);
}));

// POST /api/items -> create a listing (owner = logged-in student, never from the request body)
router.post('/', requireStudent, asyncHandler(async (req, res) => {
  const { errors, values } = validateItem(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  const [result] = await db.query(
    `INSERT INTO items (owner_id, name, category, description, item_condition, listing_type, price, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, values.name, values.category, values.description, values.item_condition, values.listing_type, values.price, values.image_url]
  );
  res.status(201).json({ id: result.insertId, message: 'Item listed successfully.' });
}));

// PUT /api/items/:id -> edit own listing
router.put('/:id', requireStudent, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid item id.' });
  const { errors, values } = validateItem(req.body);
  if (errors.length) return res.status(400).json({ error: errors[0], details: errors });

  const [result] = await db.query(
    `UPDATE items SET name = ?, category = ?, description = ?, item_condition = ?, listing_type = ?, price = ?, image_url = ?
     WHERE id = ? AND owner_id = ? AND status = 'active'`,
    [values.name, values.category, values.description, values.item_condition, values.listing_type, values.price, values.image_url, id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: 'Item not found, or you do not own it.' });
  res.json({ message: 'Listing updated.' });
}));

// DELETE /api/items/:id -> remove own listing (soft delete, open requests are cancelled)
router.delete('/:id', requireStudent, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid item id.' });
  const [rows] = await db.query("SELECT id FROM items WHERE id = ? AND owner_id = ? AND status = 'active'", [id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Item not found, or you do not own it.' });
  await removeItem(db, id);
  res.json({ message: 'Listing removed.' });
}));

module.exports = router;
