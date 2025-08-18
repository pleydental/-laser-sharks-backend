// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();

// Behind proxies (Render/Heroku/NGINX)
app.set('trust proxy', 1);

// ----- Config -----
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGINS ||
  'http://localhost:3000,https://lasersharksfantasyfootball.netlify.app'
).split(',').map(s => s.trim());

const UNIVERSAL_PASSWORD = process.env.UNIVERSAL_PASSWORD || 'laser2025';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || '').toLowerCase() === 'true'; // true in prod
const COOKIE_SAMESITE = process.env.COOKIE_SAMESITE || 'Lax'; // 'Lax' (dev) or 'None' (prod)

// ----- Middleware -----
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);


// ----- Helpers -----
function setAuthCookie(res, token, remember) {
  const opts = {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: '/',
  };
  if (remember) opts.maxAge = 1000 * 60 * 60 * 24 * 30; // 30 days
  res.cookie('ls_auth', token, opts);
}

function authMiddleware(req, res, next) {
  const token = req.cookies?.ls_auth;
  if (!token) return res.status(401).json({ ok: false, error: 'no_token' });
  try {
    req.user = jwt.verify(token, AUTH_SECRET);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'invalid_token' });
  }
}

// ----- Routes -----
app.get('/', (_req, res) => res.json({ ok: true, service: 'laser-sharks-auth' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Login: body { password: string, remember?: boolean }
app.post('/api/login', (req, res) => {
  const { password, remember } = req.body || {};
  if (!password || password !== UNIVERSAL_PASSWORD) {
    return res.status(401).json({ ok: false, error: 'invalid_password' });
  }
  const token = jwt.sign({ role: 'member' }, AUTH_SECRET, {
    expiresIn: remember ? '30d' : '12h',
  });
  setAuthCookie(res, token, !!remember);
  res.json({ ok: true });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: { role: 'member' } });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('ls_auth', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: COOKIE_SAMESITE,
    path: '/',
  });
  res.json({ ok: true });
});

// Error handler (e.g., CORS origin errors)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'server_error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`Auth server on http://localhost:${PORT}`);
  console.log('[auth] allowed origins:', ALLOWED_ORIGINS);
  console.log('[auth] cookie opts -> secure:', COOKIE_SECURE, 'sameSite:', COOKIE_SAMESITE);
});
