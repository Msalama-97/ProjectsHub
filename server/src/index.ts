import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { closeDb, initDb, migrate, waitForDb } from './db.js';
import { authRouter, ensureAdmin, requireAuth, usersRouter } from './auth.js';
import { errorHandler } from './util.js';
import { projectsRouter } from './routes/projects.js';
import { expensesRouter, incomesRouter } from './routes/finance.js';
import { allocationsRouter, peopleRouter } from './routes/people.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { documentsRouter } from './routes/documents.js';
import { dashboardRouter } from './routes/dashboard.js';

async function main() {
  await initDb();
  await waitForDb();
  await migrate(config.migrationsDir);
  await ensureAdmin();

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);

  const api = express.Router();
  api.use(requireAuth);
  api.use('/users', usersRouter);
  api.use('/projects', projectsRouter);
  api.use('/incomes', incomesRouter);
  api.use('/expenses', expensesRouter);
  api.use('/people', peopleRouter);
  api.use('/allocations', allocationsRouter);
  api.use('/subscriptions', subscriptionsRouter);
  api.use('/documents', documentsRouter);
  api.use('/dashboard', dashboardRouter);
  app.use('/api', api);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built web app (single-page app)
  if (fs.existsSync(config.webDir)) {
    app.use(express.static(config.webDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, (_req, res) => res.sendFile(path.join(config.webDir, 'index.html')));
  }

  app.use(errorHandler);

  const server = app.listen(config.port, () => console.log(`ProjectHub running on http://localhost:${config.port}`));

  const shutdown = async () => {
    console.log('Shutting down...');
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
