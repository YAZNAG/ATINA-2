require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const prisma = require('./config/database');
const { ensureArticlesPrismaColumns } = require('./utils/articleSkuLink');
const { ensureNodeTypesPrismaColumns } = require('./utils/ensureNodeTypesDb');
const { ensureZonesLevelsTables } = require('./utils/ensureWarehouseZonesLevelsDb');
const { ensureMoveTypesPrismaColumns } = require('./utils/ensureMoveTypesDb');
const routes = require('./routes');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();
const PORT = process.env.PORT || 5000;
const BODY_LIMIT = process.env.BODY_LIMIT || '10mb';

// ── CORS — allow admin web + Flutter web dev ports ──────────────────────────
const _corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const _defaultOrigins = [
  'http://localhost:5173',   // Vite admin
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:8383',   // Flutter web (alt)
  'http://localhost:8484',   // Flutter web (dev)
  'http://192.168.100.4:5173',
  'http://192.168.100.4:8383',
  'http://192.168.100.4:8484',
];

const _allowedOrigins = new Set([..._defaultOrigins, ..._corsOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    // Allow no-origin requests (mobile apps, curl, Postman)
    if (!origin || _allowedOrigins.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Stripe webhook needs raw body — register BEFORE express.json() ────────────
app.use('/api/payment/stripe/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  req.rawBody = req.body; // Buffer available as req.rawBody in stripe.routes.js
  next();
});

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(morgan('dev'));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[API] ${req.method} ${req.path}`, Object.keys(req.body ?? {}).length ? req.body : '');
  }
  next();
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/storage', express.static(path.join(__dirname, '..', 'storage')));

// Health checks
app.get('/health',     (req, res) => res.json({ status: 'ok', timestamp: new Date() }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

app.use('/api', routes);

app.use(errorMiddleware);

async function start() {
  try {
    await ensureArticlesPrismaColumns(prisma);
    await ensureNodeTypesPrismaColumns(prisma);
    await ensureZonesLevelsTables(prisma);
    await ensureMoveTypesPrismaColumns(prisma);
  } catch (e) {
    console.warn('[server] schema self-heal:', e?.message ?? e);
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();

module.exports = app;
