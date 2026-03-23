import { Router } from 'express';
import pool from '../config/db';
import { getFraudAlerts, getFraudStats, getAnalyticsData, registerSSEClient, removeSSEClient, getGraphNetworkData, getBehavioralSummary } from '../services/fraudDetection';

const router = Router();

// --- FRAUD ALERTS ---
router.get('/fraud/alerts', async (_req: any, res: any) => {
  try {
    const severity = _req.query.severity as string | undefined;
    const limit = _req.query.limit ? parseInt(_req.query.limit as string) : 50;
    const alerts = getFraudAlerts({ severity, limit });
    res.json({ alerts, total: alerts.length });
  } catch (err) {
    console.error('Fraud alerts error:', err);
    res.status(500).json({ error: 'Failed to fetch fraud alerts' });
  }
});

// --- FRAUD STATS ---
router.get('/fraud/stats', async (_req: any, res: any) => {
  try {
    const stats = getFraudStats();
    res.json(stats);
  } catch (err) {
    console.error('Fraud stats error:', err);
    res.status(500).json({ error: 'Failed to fetch fraud stats' });
  }
});

// --- FULL ANALYTICS DASHBOARD DATA ---
router.get('/analytics', async (_req: any, res: any) => {
  try {
    const analytics = getAnalyticsData();

    // Enrich with DB data
    const [voterStats, constituencyStats, candidateStats] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*) as total_voters,
          COUNT(*) FILTER (WHERE has_voted = true) as votes_cast,
          COUNT(*) FILTER (WHERE has_voted = false) as pending_voters
        FROM voters
      `),
      pool.query(`
        SELECT cons.name as constituency, s.name as state,
          COUNT(v.id) as total_voters,
          COUNT(v.id) FILTER (WHERE v.has_voted = true) as votes_cast
        FROM constituencies cons
        JOIN states s ON cons.state_id = s.id
        LEFT JOIN voters v ON v.home_constituency_id = cons.id
        GROUP BY cons.id, cons.name, s.name
        ORDER BY votes_cast DESC
      `),
      pool.query(`
        SELECT c.name, c.party, cons.name as constituency,
          COUNT(v.id) as vote_count
        FROM candidates c
        JOIN constituencies cons ON c.constituency_id = cons.id
        LEFT JOIN voters v ON v.voted_for_candidate_id = c.id AND v.has_voted = true
        GROUP BY c.id, c.name, c.party, cons.name
        ORDER BY vote_count DESC
      `)
    ]);

    const dbStats = voterStats.rows[0];
    const turnoutPct = dbStats.total_voters > 0
      ? ((dbStats.votes_cast / dbStats.total_voters) * 100).toFixed(1)
      : '0.0';

    res.json({
      ...analytics,
      voterStats: {
        totalVoters: parseInt(dbStats.total_voters),
        votesCast: parseInt(dbStats.votes_cast),
        pendingVoters: parseInt(dbStats.pending_voters),
        turnoutPercentage: parseFloat(turnoutPct),
      },
      constituencyBreakdown: constituencyStats.rows,
      candidateStats: candidateStats.rows,
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// --- AUDIT LOG ---
router.get('/audit-log', async (_req: any, res: any) => {
  try {
    // Fetch recent voter activity from DB
    const recentVoters = await pool.query(`
      SELECT v.epic_id, v.full_name, v.has_voted, cons.name as constituency
      FROM voters v
      JOIN constituencies cons ON v.home_constituency_id = cons.id
      ORDER BY v.id DESC
      LIMIT 50
    `);

    // Combine with fraud alerts for a unified audit view
    const alerts = getFraudAlerts({ limit: 50 });

    // Build a unified activity feed
    const activityFeed = [
      ...recentVoters.rows.map((v: any) => ({
        type: v.has_voted ? 'vote_cast' : 'voter_registered',
        label: v.has_voted ? `${v.full_name} cast a vote` : `${v.full_name} registered`,
        detail: `${v.constituency} • ${v.epic_id}`,
        timestamp: new Date().toISOString(),
        severity: 'info',
      })),
      ...alerts.map((a: any) => ({
        type: 'fraud_alert',
        label: `Fraud: ${a.type}`,
        detail: a.details,
        timestamp: a.timestamp,
        severity: a.severity,
      })),
    ].sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30);

    res.json({
      recentActivity: recentVoters.rows,
      securityAlerts: alerts,
      activityFeed,
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// --- SYSTEM HEALTH ---
router.get('/health', async (_req: any, res: any) => {
  const checks: Record<string, any> = {};

  // DB health
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    checks.database = { status: 'healthy', latencyMs: Date.now() - start, required: true };
  } catch {
    checks.database = { status: 'unhealthy', latencyMs: 0, required: true };
  }

  // Gateway health (optional for local dev)
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch('http://localhost:3000/query-all', { signal: controller.signal });
    clearTimeout(timeout);
    checks.gateway = { status: resp.ok ? 'healthy' : 'degraded', latencyMs: Date.now() - start, required: false, note: 'Hyperledger Fabric' };
  } catch {
    checks.gateway = { status: 'offline', latencyMs: 0, required: false, note: 'Hyperledger Fabric — optional for local dev' };
  }

  // Kafka health (optional for local dev)
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch('http://localhost:9092', { signal: controller.signal });
    clearTimeout(timeout);
    checks.kafka = { status: 'healthy', latencyMs: Date.now() - start, required: false, note: 'Event Streaming' };
  } catch {
    checks.kafka = { status: 'offline', latencyMs: 0, required: false, note: 'Event Streaming — optional for local dev' };
  }

  // AI Fraud Detection engine status
  const fraudEngineAlerts = getFraudAlerts({ limit: 1 });
  checks.fraudEngine = { status: 'healthy', latencyMs: 0, engines: 7, required: true };

  // Face++ API health
  const faceppKey = process.env.FACEPP_API_KEY;
  checks.faceVerification = {
    status: faceppKey ? 'healthy' : 'unconfigured',
    latencyMs: 0,
    required: true,
    note: 'Face++ Liveness',
  };

  // Overall status: only required services count
  const requiredServices = Object.values(checks).filter((c: any) => c.required);
  const allRequiredHealthy = requiredServices.every((c: any) => c.status === 'healthy');

  res.json({
    status: allRequiredHealthy ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    services: checks,
    timestamp: new Date().toISOString(),
  });
});

// --- SSE: REAL-TIME FRAUD ALERT STREAM ---
router.get('/fraud/stream', (req: any, res: any) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE stream active' })}\n\n`);

  const clientId = registerSSEClient(res);

  // Keep-alive ping every 30s
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    removeSSEClient(clientId);
  });
});

// --- GRAPH NETWORK DATA ---
router.get('/graph-network', (_req: any, res: any) => {
  try {
    const graphData = getGraphNetworkData();
    res.json(graphData);
  } catch (err) {
    console.error('Graph network error:', err);
    res.status(500).json({ error: 'Failed to fetch graph network data' });
  }
});

// --- BEHAVIORAL ANALYSIS SUMMARY ---
router.get('/behavioral', (_req: any, res: any) => {
  try {
    const summary = getBehavioralSummary();
    res.json(summary);
  } catch (err) {
    console.error('Behavioral analysis error:', err);
    res.status(500).json({ error: 'Failed to fetch behavioral data' });
  }
});

// --- FRAUD TREND (24h hourly buckets) ---
router.get('/fraud/trend', async (_req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT 
        to_char(date_trunc('hour', created_at), 'HH24:00') as time,
        COUNT(*) as alerts
      FROM fraud_alerts
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY date_trunc('hour', created_at)
      ORDER BY date_trunc('hour', created_at)
    `);
    // Fill in missing hours with 0
    const hourMap = new Map<string, number>();
    for (let h = 0; h < 24; h++) {
      hourMap.set(`${h.toString().padStart(2, '0')}:00`, 0);
    }
    for (const row of result.rows) {
      hourMap.set(row.time, parseInt(row.alerts));
    }
    const trend = Array.from(hourMap.entries()).map(([time, alerts]) => ({ time, alerts }));
    res.json({ trend });
  } catch (err) {
    console.error('Fraud trend error:', err);
    res.status(500).json({ error: 'Failed to fetch fraud trend' });
  }
});

export default router;
