// Express 4 does not catch errors from async handlers by itself, so we wrap them.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// Unknown /api route
function apiNotFound(req, res) {
  res.status(404).json({ error: 'API route not found' });
}

// Last-resort error handler: log details on the server, send a safe message to the browser.
function errorHandler(err, req, res, next) {
  console.error('Server error:', err);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON in request.' });
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
}

module.exports = { asyncHandler, apiNotFound, errorHandler };
