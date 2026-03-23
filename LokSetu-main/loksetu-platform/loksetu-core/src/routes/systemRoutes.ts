import { Router } from 'express';
import { analyticsService } from '../services/analyticsService';
import { blockchainService } from '../services/blockchainService';

const router = Router();

/** System logs endpoint */
router.get('/logs', async (_req: any, res: any) => {
  try {
    const limit = _req.query.limit ? parseInt(_req.query.limit) : 100;
    const logs = await analyticsService.getSystemLogs(limit);
    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('System logs error:', err);
    res.status(500).json({ error: 'Failed to fetch system logs' });
  }
});

/** Vote transaction history */
router.get('/transactions', async (_req: any, res: any) => {
  try {
    const limit = _req.query.limit ? parseInt(_req.query.limit) : 50;
    const transactions = await analyticsService.getVoteTransactions(limit);
    
    // Optionally merge with blockchain gateway log
    let blockchainTxLog: any[] = [];
    try {
      blockchainTxLog = await blockchainService.getTransactionLog();
    } catch { /* gateway may be offline */ }

    res.json({
      dbTransactions: transactions,
      blockchainLog: blockchainTxLog.slice(0, limit),
      total: transactions.length,
    });
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/** Chatbot history */
router.get('/chat-history', async (_req: any, res: any) => {
  try {
    const limit = _req.query.limit ? parseInt(_req.query.limit) : 50;
    const { rows } = await (await import('../config/db')).default.query(
      'SELECT * FROM chatbot_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    res.json({ logs: rows, total: rows.length });
  } catch (err) {
    console.error('Chat history error:', err);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

/** Analytics snapshot trigger */
router.post('/snapshot', async (_req: any, res: any) => {
  try {
    await analyticsService.takeSnapshot();
    res.json({ success: true, message: 'Analytics snapshot saved' });
  } catch (err) {
    console.error('Snapshot error:', err);
    res.status(500).json({ error: 'Failed to take snapshot' });
  }
});

/** IP tracking data */
router.get('/ip-tracking', async (_req: any, res: any) => {
  try {
    const limit = _req.query.limit ? parseInt(_req.query.limit) : 100;
    const { rows } = await (await import('../config/db')).default.query(
      'SELECT ip_address, COUNT(*) as request_count, MAX(created_at) as last_seen FROM ip_tracking GROUP BY ip_address ORDER BY request_count DESC LIMIT $1',
      [limit]
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error('IP tracking error:', err);
    res.status(500).json({ error: 'Failed to fetch IP tracking data' });
  }
});

export default router;
