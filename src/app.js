// Main Express server: sessions, security headers, CSRF, API routes and static pages.
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { loadUser } = require('./middleware/auth');
const { verifyCsrf } = require('./middleware/csrf');
const { apiNotFound, errorHandler } = require('./middleware/errors');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
  console.error('SESSION_SECRET is missing or too short. Set a long random value in your .env file.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) app.set('trust proxy', 1);

// Basic security headers (no inline scripts/styles are used anywhere in the frontend)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' https: http: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
  next();
});

app.use(express.json({ limit: '20kb' }));

// Server-side sessions. The browser only holds an opaque, HttpOnly cookie.
// NOTE: the default MemoryStore is fine for a local demo (sessions reset when the server restarts).
app.use(session({
  name: 'reusehub.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 2 * 60 * 60 * 1000 // 2 hours
  }
}));

app.use(loadUser);

// admin.html is only served to a logged-in administrator (the API is protected separately too)
app.get('/admin.html', (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/admin-login.html');
  next();
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// API
app.use('/api', verifyCsrf);
app.get('/api/health', (req, res) => res.json({ status: 'ok', project: 'ReUseHub' }));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/profile', require('./routes/profile.routes'));
app.use('/api/items', require('./routes/items.routes'));
app.use('/api/requests', require('./routes/requests.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/impact', require('./routes/impact.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api', apiNotFound);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`ReUseHub running at http://localhost:${PORT}`);
});
