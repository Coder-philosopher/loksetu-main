import 'dotenv/config';          // Must be first — loads .env before any other module reads process.env
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import pool from './config/db';
import { initializeDatabase } from './config/initDb';
import authRoutes from './routes/authRoutes';
import ballotRoutes from './routes/ballotRoutes';
import adminRoutes from './routes/adminRoutes';
import candidateRoutes from './routes/candidateRoutes';
import resultRoutes from './routes/resultRoutes';
import monitorRoutes from './routes/monitorRoutes';
import chatRoutes from './routes/chatRoutes';
import systemRoutes from './routes/systemRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimiter, securityHeaders, ipTracker } from './middleware/security';
import { analyticsService } from './services/analyticsService';
import { startBlockchainRetryJob } from './services/blockchainRetryService';

const app = express();
const PORT = process.env.PORT || 8080;

// ── Security Middleware ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(securityHeaders);
app.use(cors());
app.use(morgan('short'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate limiting — 200 requests per minute per IP
app.use(rateLimiter(60000, 200));

// IP tracking — audit trail for all requests
app.use(ipTracker(pool));

// ── API Routes ─────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/ballot', ballotRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/candidates', candidateRoutes);
app.use('/api/v1/results', resultRoutes);
app.use('/api/v1/monitor', monitorRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/system', systemRoutes);

// ── Health Check ───────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ 
    project: "LokSetu Platform", 
    status: "Active",
    version: "2.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint for DB connectivity
app.get('/api/test-voters', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM voters LIMIT 50');
    res.json(result.rows);
  } catch (err: any) {
    console.error('[test-voters]', err.message);
    res.status(500).json({ error: "Database Fetch Failed", detail: err.message });
  }
});

// ── Error Handling ─────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Server Start ───────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 LokSetu Backend v2.0 running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize database schema (auto-create tables)
  try {
    await initializeDatabase();
    console.log('   Database: Connected & Schema Ready');
    analyticsService.log('INFO', 'server', 'LokSetu Backend v2.0 started', { port: PORT, env: process.env.NODE_ENV || 'development' });

    // Start background job to sync pending votes to blockchain
    startBlockchainRetryJob();
  } catch (err: any) {
    console.error('   Database initialization error:', err.message);
    analyticsService.log('ERROR', 'server', `Database initialization failed: ${err.message}`);
  }

  console.log(`   API: http://localhost:${PORT}/api/v1/`);
  console.log('');
});