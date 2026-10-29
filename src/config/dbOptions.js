// Connection settings shared by the app (src/config/database.js) and scripts/setup.js.
// Works for local MySQL and for cloud MySQL services (which need a port and SSL).
require('dotenv').config();

function getDbOptions() {
  const options = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };
  // Cloud databases usually require an encrypted connection: set DB_SSL=true
  if (String(process.env.DB_SSL).toLowerCase() === 'true') {
    options.ssl = {
      minVersion: 'TLSv1.2',
      // Only set DB_SSL_ALLOW_UNVERIFIED=true if your provider's certificate is rejected (demo use only)
      rejectUnauthorized: String(process.env.DB_SSL_ALLOW_UNVERIFIED).toLowerCase() !== 'true'
    };
  }
  return options;
}

module.exports = { getDbOptions };
