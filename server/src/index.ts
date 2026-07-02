import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import queueRoutes from './routes/queues';
import jobRoutes from './routes/jobs';
import workerRoutes from './routes/workers';
import deadLetterRoutes from './routes/deadLetter';
import dashboardRoutes from './routes/dashboard';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/errors';
import { connectDb } from './db/client';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Simple structured request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: Date.now() - start,
      })
    );
  });
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, projectRoutes);
app.use('/api/queues', requireAuth, queueRoutes);
app.use('/api/jobs', requireAuth, jobRoutes);
app.use('/api/workers', requireAuth, workerRoutes);
app.use('/api/dead-letter', requireAuth, deadLetterRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDb()
  .then(() => {
    app.listen(PORT, () => console.log(`API server listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('[startup] failed to connect to MongoDB', err);
    process.exit(1);
  });
