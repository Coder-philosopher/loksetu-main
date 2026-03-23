import pool from '../config/db';

/**
 * Analytics Service — aggregates election data from database.
 * Provides voter stats, constituency breakdowns, candidate performance, and trends.
 */
export class AnalyticsService {

  /** Get overall voter statistics */
  async getVoterStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_voters,
        COUNT(*) FILTER (WHERE has_voted = true) as votes_cast,
        COUNT(*) FILTER (WHERE has_voted = false) as pending_voters
      FROM voters
    `);
    const row = result.rows[0];
    const total = parseInt(row.total_voters);
    const cast = parseInt(row.votes_cast);
    return {
      totalVoters: total,
      votesCast: cast,
      pendingVoters: parseInt(row.pending_voters),
      turnoutPercentage: total > 0 ? parseFloat(((cast / total) * 100).toFixed(1)) : 0,
    };
  }

  /** Get constituency-level breakdown */
  async getConstituencyBreakdown() {
    const result = await pool.query(`
      SELECT cons.name as constituency, s.name as state,
        COUNT(v.id) as total_voters,
        COUNT(v.id) FILTER (WHERE v.has_voted = true) as votes_cast
      FROM constituencies cons
      JOIN states s ON cons.state_id = s.id
      LEFT JOIN voters v ON v.home_constituency_id = cons.id
      GROUP BY cons.id, cons.name, s.name
      ORDER BY votes_cast DESC
    `);
    return result.rows;
  }

  /** Get candidate vote tallies */
  async getCandidateStats() {
    const result = await pool.query(`
      SELECT c.name, c.party, cons.name as constituency,
        COUNT(v.id) as vote_count
      FROM candidates c
      JOIN constituencies cons ON c.constituency_id = cons.id
      LEFT JOIN voters v ON v.voted_for_candidate_id = c.id AND v.has_voted = true
      GROUP BY c.id, c.name, c.party, cons.name
      ORDER BY vote_count DESC
    `);
    return result.rows;
  }

  /** Get recent voter activity */
  async getRecentActivity(limit: number = 50) {
    const result = await pool.query(`
      SELECT v.epic_id, v.full_name, v.has_voted, cons.name as constituency,
        v.registered_at, v.voted_at
      FROM voters v
      JOIN constituencies cons ON v.home_constituency_id = cons.id
      ORDER BY v.id DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  /** Get fraud alerts from database */
  async getStoredFraudAlerts(options?: { severity?: string; limit?: number }) {
    let query = 'SELECT * FROM fraud_alerts WHERE 1=1';
    const params: any[] = [];

    if (options?.severity) {
      params.push(options.severity);
      query += ` AND severity = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      params.push(options.limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    return result.rows;
  }

  /** Store a fraud alert in the database */
  async storeFraudAlert(alert: {
    alertId: string;
    voterId: string;
    type: string;
    severity: string;
    score: number;
    details: string;
    ip?: string;
    userAgent?: string;
  }) {
    try {
      await pool.query(
        `INSERT INTO fraud_alerts (alert_id, voter_id, type, severity, score, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (alert_id) DO NOTHING`,
        [alert.alertId, alert.voterId, alert.type, alert.severity, alert.score, alert.details, alert.ip, alert.userAgent]
      );
    } catch (err) {
      console.error('[AnalyticsService] Failed to store fraud alert:', err);
    }
  }

  /** Store a vote transaction record */
  async storeVoteTransaction(params: {
    voterEpicId: string;
    candidateId: number;
    txHash?: string;
    boothLocation: string;
    ipAddress?: string;
    blockchainStatus?: string;
  }) {
    try {
      await pool.query(
        `INSERT INTO vote_transactions (voter_epic_id, candidate_id, tx_hash, blockchain_timestamp, booth_location, ip_address, blockchain_status)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
        [params.voterEpicId, params.candidateId, params.txHash, params.boothLocation, params.ipAddress, params.blockchainStatus || 'confirmed']
      );
    } catch (err) {
      console.error('[AnalyticsService] Failed to store vote transaction:', err);
    }
  }

  /** Get all pending blockchain transactions for retry */
  async getPendingBlockchainVotes() {
    const result = await pool.query(
      `SELECT vt.*, s.name as candidate_state
       FROM vote_transactions vt
       JOIN candidates c ON vt.candidate_id = c.id
       JOIN constituencies cons ON c.constituency_id = cons.id
       JOIN states s ON cons.state_id = s.id
       WHERE vt.blockchain_status = 'pending'
       ORDER BY vt.created_at ASC`
    );
    return result.rows;
  }

  /** Mark a vote transaction as synced to blockchain */
  async markVoteBlockchainSynced(id: number, txHash: string) {
    await pool.query(
      `UPDATE vote_transactions SET blockchain_status = 'confirmed', tx_hash = $2, blockchain_timestamp = NOW() WHERE id = $1`,
      [id, txHash]
    );
  }

  /** Store a chatbot interaction */
  async storeChatLog(params: {
    sessionId?: string;
    userMessage: string;
    botResponse: string;
    modelUsed?: string;
    tokensUsed?: number;
  }) {
    try {
      await pool.query(
        `INSERT INTO chatbot_logs (session_id, user_message, bot_response, model_used, tokens_used)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.sessionId, params.userMessage, params.botResponse, params.modelUsed, params.tokensUsed]
      );
    } catch (err) {
      console.error('[AnalyticsService] Failed to store chat log:', err);
    }
  }

  /** Take an analytics snapshot */
  async takeSnapshot() {
    try {
      const stats = await this.getVoterStats();
      const fraudCount = await pool.query('SELECT COUNT(*) as count FROM fraud_alerts');
      
      await pool.query(
        `INSERT INTO analytics_snapshots (total_voters, votes_cast, turnout_percentage, fraud_alerts_count, snapshot_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [stats.totalVoters, stats.votesCast, stats.turnoutPercentage, parseInt(fraudCount.rows[0].count), JSON.stringify(stats)]
      );
    } catch (err) {
      console.error('[AnalyticsService] Failed to take snapshot:', err);
    }
  }

  /** Get vote transaction history */
  async getVoteTransactions(limit: number = 50) {
    const result = await pool.query(`
      SELECT vt.*, c.name as candidate_name, c.party
      FROM vote_transactions vt
      LEFT JOIN candidates c ON vt.candidate_id = c.id
      ORDER BY vt.created_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  }

  /** Get system logs */
  async getSystemLogs(limit: number = 100) {
    const result = await pool.query(
      'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  /** Write a system log entry */
  async log(level: string, source: string, message: string, metadata?: any) {
    try {
      await pool.query(
        'INSERT INTO system_logs (level, source, message, metadata) VALUES ($1, $2, $3, $4)',
        [level, source, message, JSON.stringify(metadata || {})]
      );
    } catch { /* silent — logging is non-critical */ }
  }
}

export const analyticsService = new AnalyticsService();
