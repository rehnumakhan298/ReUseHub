// GET /api/impact -> real counts calculated from the database (public).
// Sample (demo) listings are counted separately and are NOT treated as completed exchanges.
const express = require('express');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errors');

const router = express.Router();

router.get('/', asyncHandler(async (req, res) => {
  const [[row]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM items WHERE status = 'active' AND is_sample = 0) AS studentListings,
       (SELECT COUNT(*) FROM items WHERE status = 'active' AND is_sample = 1) AS sampleListings,
       (SELECT COUNT(*) FROM items WHERE status = 'active' AND is_available = 1) AS availableItems,
       (SELECT COUNT(*) FROM exchange_requests WHERE status = 'Completed') AS completedExchanges,
       (SELECT COUNT(*) FROM users WHERE role = 'student') AS students`
  );
  res.json(row);
}));

module.exports = router;
