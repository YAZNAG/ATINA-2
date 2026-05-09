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

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(morgan('dev'));

// Static files for uploads & familles (storage/image/famille/...)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/storage', express.static(path.join(__dirname, '..', 'storage')));

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

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
