// MySQL connection pool. Credentials come from environment variables, never from browser code.
// We use pool.query(sql, [values]): the ? placeholders are escaped by mysql2,
// which protects against SQL injection (we never join user text into SQL).
const mysql = require('mysql2/promise');
const { getDbOptions } = require('./dbOptions');

const pool = mysql.createPool({
  ...getDbOptions(),
  database: process.env.DB_NAME || 'reusehub',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
