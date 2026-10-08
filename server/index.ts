import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db';
import { migrateFromCsvIfNeeded } from './migration';
import authRouter from './routes/auth';
import apiRouter from './routes/api';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Initialize PostgreSQL 3NF database schema and seed if necessary
await initDb();
await migrateFromCsvIfNeeded();

const app = express();
app.disable('x-powered-by');

// Manual CORS handling for all origins (adjust as needed)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json({ limit: '200mb' }));

// Mount Authentication & API routes backed by PostgreSQL
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

// Frontend static serving or Vite dev middleware
const isProduction = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
if (isProduction) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
app.listen(port, host, () => {
  console.log(`[Full-Stack Server] Running at: http://${host}:${port}`);
  console.log(`[DBMS] PostgreSQL 3NF Database: ${process.env.DATABASE_URL || 'postgres://postgres@localhost:5432/cpms_db'}`);
});

