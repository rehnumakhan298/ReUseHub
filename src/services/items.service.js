// Logic shared by the student route (delete own listing) and the admin route (remove listing).

// Soft-removes an item and cancels its open requests. Runs inside one transaction.
async function removeItem(pool, itemId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE items SET status = 'removed', is_available = 0 WHERE id = ?", [itemId]);
    await conn.query(
      "UPDATE exchange_requests SET status = 'Cancelled' WHERE item_id = ? AND status IN ('Pending','Accepted')",
      [itemId]
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { removeItem };
