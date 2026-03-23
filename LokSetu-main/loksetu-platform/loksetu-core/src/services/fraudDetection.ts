/**
 * LokSetu AI Fraud Detection Engine
 * Detects suspicious voting behavior using statistical anomaly detection,
 * graph-based network analysis, and behavioral AI.
 * 
 * Techniques:
 * - Velocity analysis (too-fast voting)
 * - Duplicate attempt tracking
 * - IP-based clustering
 * - Device fingerprint analysis
 * - Z-Score anomaly detection (lightweight Isolation Forest alternative)
 * - Graph-based coordinated fraud network detection
 * - Behavioral analysis (mouse, timing, interaction patterns)
 */

interface VoteEvent {
  voterID: string;
  candidateID: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  sessionDuration?: number; // ms from login to vote
  behavioral?: BehavioralData;
}

interface BehavioralData {
  mouseMovements?: number;    // total mouse move events during session
  clickCount?: number;        // total clicks
  keystrokes?: number;        // total keystrokes
  scrollEvents?: number;      // total scroll events
  idleTime?: number;          // ms of inactivity
  screenResolution?: string;  // e.g. "1920x1080"
  timezone?: string;          // e.g. "Asia/Kolkata"
  touchCapable?: boolean;     // device has touch
  pageVisibility?: number;    // ms page was visible
}

interface FraudAlert {
  id: string;
  voterID: string;
  type: 'DUPLICATE_ATTEMPT' | 'VELOCITY_ANOMALY' | 'IP_CLUSTER' | 'BOT_SUSPECT' | 'DEVICE_ANOMALY' | 'GRAPH_NETWORK' | 'BEHAVIORAL_ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number; // 0-100
  details: string;
  timestamp: Date;
}

// ---------- In-memory stores (production would use Redis) ----------
const voteTimestamps: Map<string, number[]> = new Map();
const ipVoteMap: Map<string, string[]> = new Map();
const deviceMap: Map<string, string[]> = new Map();
const fraudAlerts: FraudAlert[] = [];
const voteSpeeds: number[] = [];

// Graph-based fraud detection stores
const voterIPEdges: Map<string, Set<string>> = new Map();      // voterID -> Set<IP>
const voterDeviceEdges: Map<string, Set<string>> = new Map();  // voterID -> Set<deviceFingerprint>
const ipTimestampMap: Map<string, number[]> = new Map();       // IP -> timestamps (for burst detection)

// Behavioral analysis stores
const behavioralProfiles: Map<string, BehavioralData[]> = new Map(); // voterID -> profile history
const globalBehavioralStats = {
  mouseMoves: [] as number[],
  sessionDurations: [] as number[],
  clickCounts: [] as number[],
  idleTimes: [] as number[],
};

// SSE notification subscribers
type SSEClient = { id: string; res: any };
const sseClients: SSEClient[] = [];

let alertIdCounter = 1;

function generateAlertId(): string {
  return `FRAUD_${Date.now()}_${alertIdCounter++}`;
}

/**
 * Broadcast a fraud alert to all SSE subscribers
 */
function broadcastAlert(alert: FraudAlert) {
  const data = JSON.stringify(alert);
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write(`data: ${data}\n\n`);
    } catch {
      sseClients.splice(i, 1); // Remove dead connections
    }
  }
}

/**
 * Register an SSE client for real-time notifications
 */
export function registerSSEClient(res: any): string {
  const clientId = `SSE_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sseClients.push({ id: clientId, res });
  return clientId;
}

/**
 * Remove an SSE client
 */
export function removeSSEClient(clientId: string) {
  const idx = sseClients.findIndex(c => c.id === clientId);
  if (idx !== -1) sseClients.splice(idx, 1);
}

/**
 * Extract a simple device fingerprint from user-agent
 */
function extractDeviceFingerprint(userAgent: string): string {
  const parts = userAgent.toLowerCase();
  const os = parts.includes('windows') ? 'win' : parts.includes('mac') ? 'mac' : parts.includes('linux') ? 'linux' : parts.includes('android') ? 'android' : parts.includes('iphone') ? 'ios' : 'unknown';
  const browser = parts.includes('chrome') ? 'chrome' : parts.includes('firefox') ? 'firefox' : parts.includes('safari') ? 'safari' : parts.includes('edge') ? 'edge' : 'unknown';
  return `${os}:${browser}`;
}

// ===========================
// GRAPH-BASED FRAUD DETECTION
// ===========================

/**
 * Detect coordinated fraud networks by analyzing voter-IP-device graph relationships.
 * Finds clusters of voters sharing IPs/devices that indicate organized fraud.
 */
function detectGraphFraud(voterID: string, ip?: string, userAgent?: string): FraudAlert[] {
  const alerts: FraudAlert[] = [];

  if (ip) {
    // Build voter <-> IP edges
    if (!voterIPEdges.has(voterID)) voterIPEdges.set(voterID, new Set());
    voterIPEdges.get(voterID)!.add(ip);

    // Track IP burst (many votes from same IP in short window)
    const ipTimes = ipTimestampMap.get(ip) || [];
    ipTimes.push(Date.now());
    ipTimestampMap.set(ip, ipTimes);

    // Check for burst: 5+ votes from same IP within 5 minutes
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const recentFromIP = ipTimes.filter(t => t > fiveMinAgo);
    if (recentFromIP.length >= 5) {
      alerts.push({
        id: generateAlertId(),
        voterID,
        type: 'GRAPH_NETWORK',
        severity: recentFromIP.length >= 10 ? 'CRITICAL' : 'HIGH',
        score: Math.min(100, recentFromIP.length * 12),
        details: `IP burst detected: ${recentFromIP.length} vote events from ${ip} in last 5 minutes. Indicates possible ballot stuffing operation.`,
        timestamp: new Date()
      });
    }

    // Find connected components: voters sharing IPs with this voter
    const connectedVoters = findConnectedVoters(voterID);
    if (connectedVoters.size >= 4) {
      alerts.push({
        id: generateAlertId(),
        voterID,
        type: 'GRAPH_NETWORK',
        severity: connectedVoters.size >= 8 ? 'CRITICAL' : 'HIGH',
        score: Math.min(100, connectedVoters.size * 10 + 20),
        details: `Coordinated network detected: ${connectedVoters.size} voters connected via shared IPs: [${[...connectedVoters].slice(0, 5).join(', ')}${connectedVoters.size > 5 ? '...' : ''}]`,
        timestamp: new Date()
      });
    }
  }

  if (userAgent) {
    const fingerprint = extractDeviceFingerprint(userAgent);
    if (!voterDeviceEdges.has(voterID)) voterDeviceEdges.set(voterID, new Set());
    voterDeviceEdges.get(voterID)!.add(fingerprint);

    // Check how many different voters used same device fingerprint
    const sameDeviceVoters = [...voterDeviceEdges.entries()]
      .filter(([_, devices]) => devices.has(fingerprint))
      .map(([vid]) => vid);

    if (sameDeviceVoters.length >= 3) {
      alerts.push({
        id: generateAlertId(),
        voterID,
        type: 'DEVICE_ANOMALY',
        severity: sameDeviceVoters.length >= 6 ? 'CRITICAL' : 'MEDIUM',
        score: Math.min(100, sameDeviceVoters.length * 15),
        details: `${sameDeviceVoters.length} voters using identical device fingerprint (${fingerprint}): [${sameDeviceVoters.slice(0, 4).join(', ')}]`,
        timestamp: new Date()
      });
    }
  }

  return alerts;
}

/**
 * BFS to find all voters connected through shared IP addresses
 */
function findConnectedVoters(startVoterID: string): Set<string> {
  const visited = new Set<string>();
  const queue = [startVoterID];
  visited.add(startVoterID);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const ips = voterIPEdges.get(current) || new Set();

    for (const ip of ips) {
      // Find all voters who used this IP
      for (const [otherVoter, otherIPs] of voterIPEdges.entries()) {
        if (!visited.has(otherVoter) && otherIPs.has(ip)) {
          visited.add(otherVoter);
          queue.push(otherVoter);
        }
      }
    }
  }

  return visited;
}

// ===========================
// BEHAVIORAL AI ANALYSIS
// ===========================

/**
 * Analyze behavioral signals to detect bots, automation, or suspicious user behavior.
 */
function analyzeBehavior(voterID: string, behavioral?: BehavioralData, sessionDuration?: number): FraudAlert[] {
  const alerts: FraudAlert[] = [];
  if (!behavioral) return alerts;

  // Store profile
  if (!behavioralProfiles.has(voterID)) behavioralProfiles.set(voterID, []);
  behavioralProfiles.get(voterID)!.push(behavioral);

  // Update global stats for Z-score computation
  if (behavioral.mouseMovements !== undefined) globalBehavioralStats.mouseMoves.push(behavioral.mouseMovements);
  if (behavioral.clickCount !== undefined) globalBehavioralStats.clickCounts.push(behavioral.clickCount);
  if (behavioral.idleTime !== undefined) globalBehavioralStats.idleTimes.push(behavioral.idleTime);
  if (sessionDuration !== undefined) globalBehavioralStats.sessionDurations.push(sessionDuration);

  let suspicionScore = 0;
  const reasons: string[] = [];

  // 1. Zero or very low mouse movements (bot indicator)
  if (behavioral.mouseMovements !== undefined && behavioral.mouseMovements < 5) {
    suspicionScore += 30;
    reasons.push(`Near-zero mouse movement (${behavioral.mouseMovements})`);
  }

  // 2. Zero clicks besides vote button (bot indicator)
  if (behavioral.clickCount !== undefined && behavioral.clickCount < 2) {
    suspicionScore += 20;
    reasons.push(`Minimal clicks (${behavioral.clickCount})`);
  }

  // 3. Very high idle time relative to session (distracted or scripted)
  if (behavioral.idleTime !== undefined && sessionDuration && sessionDuration > 0) {
    const idleRatio = behavioral.idleTime / sessionDuration;
    if (idleRatio > 0.9) {
      suspicionScore += 25;
      reasons.push(`${(idleRatio * 100).toFixed(0)}% idle time — possible background script`);
    }
  }

  // 4. No scroll events (unusual for a real user on a form page)
  if (behavioral.scrollEvents !== undefined && behavioral.scrollEvents === 0 && sessionDuration && sessionDuration > 10000) {
    suspicionScore += 10;
    reasons.push('No scroll events during session');
  }

  // 5. Statistical anomaly on mouse movements (Z-score)
  if (globalBehavioralStats.mouseMoves.length >= 10 && behavioral.mouseMovements !== undefined) {
    const mean = globalBehavioralStats.mouseMoves.reduce((a, b) => a + b, 0) / globalBehavioralStats.mouseMoves.length;
    const variance = globalBehavioralStats.mouseMoves.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / globalBehavioralStats.mouseMoves.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) {
      const zScore = Math.abs((behavioral.mouseMovements - mean) / stdDev);
      if (zScore > 2.5) {
        suspicionScore += 20;
        reasons.push(`Mouse movement Z-score: ${zScore.toFixed(2)}`);
      }
    }
  }

  // 6. Page visibility anomaly (page mostly hidden)
  if (behavioral.pageVisibility !== undefined && sessionDuration && sessionDuration > 5000) {
    const visRatio = behavioral.pageVisibility / sessionDuration;
    if (visRatio < 0.3) {
      suspicionScore += 15;
      reasons.push(`Page only visible ${(visRatio * 100).toFixed(0)}% of session`);
    }
  }

  if (suspicionScore >= 25) {
    const severity: FraudAlert['severity'] = suspicionScore >= 70 ? 'CRITICAL' : suspicionScore >= 50 ? 'HIGH' : suspicionScore >= 35 ? 'MEDIUM' : 'LOW';
    alerts.push({
      id: generateAlertId(),
      voterID,
      type: 'BEHAVIORAL_ANOMALY',
      severity,
      score: Math.min(100, suspicionScore),
      details: `Behavioral anomalies detected: ${reasons.join('; ')}`,
      timestamp: new Date()
    });
  }

  return alerts;
}

/**
 * Analyze a vote event for fraud signals (all detection engines)
 */
export function analyzeVoteEvent(event: VoteEvent): FraudAlert[] {
  const alerts: FraudAlert[] = [];
  const now = Date.now();

  // 1. DUPLICATE ATTEMPT DETECTION
  const timestamps = voteTimestamps.get(event.voterID) || [];
  if (timestamps.length > 0) {
    const alert: FraudAlert = {
      id: generateAlertId(),
      voterID: event.voterID,
      type: 'DUPLICATE_ATTEMPT',
      severity: timestamps.length >= 3 ? 'CRITICAL' : 'HIGH',
      score: Math.min(100, 60 + timestamps.length * 15),
      details: `Voter ${event.voterID} attempted to vote ${timestamps.length + 1} times. Previous attempts at: ${timestamps.map(t => new Date(t).toISOString()).join(', ')}`,
      timestamp: new Date()
    };
    alerts.push(alert);
  }
  timestamps.push(now);
  voteTimestamps.set(event.voterID, timestamps);

  // 2. VELOCITY ANOMALY (voting too fast after login)
  if (event.sessionDuration !== undefined && event.sessionDuration < 5000) {
    const alert: FraudAlert = {
      id: generateAlertId(),
      voterID: event.voterID,
      type: 'VELOCITY_ANOMALY',
      severity: event.sessionDuration < 2000 ? 'CRITICAL' : 'HIGH',
      score: Math.min(100, Math.round(100 - (event.sessionDuration / 50))),
      details: `Vote cast only ${event.sessionDuration}ms after authentication. Normal range: 15-120 seconds.`,
      timestamp: new Date()
    };
    alerts.push(alert);
  }

  // 3. IP CLUSTERING (multiple voters from same IP)
  if (event.ip) {
    const ipVoters = ipVoteMap.get(event.ip) || [];
    if (!ipVoters.includes(event.voterID)) {
      ipVoters.push(event.voterID);
      ipVoteMap.set(event.ip, ipVoters);
    }
    if (ipVoters.length >= 3) {
      const alert: FraudAlert = {
        id: generateAlertId(),
        voterID: event.voterID,
        type: 'IP_CLUSTER',
        severity: ipVoters.length >= 5 ? 'CRITICAL' : 'MEDIUM',
        score: Math.min(100, ipVoters.length * 20),
        details: `${ipVoters.length} different voters from IP ${event.ip}: ${ipVoters.join(', ')}`,
        timestamp: new Date()
      };
      alerts.push(alert);
    }
  }

  // 4. BOT DETECTION (missing user agent or known bot signatures)
  if (event.userAgent) {
    const botPatterns = /bot|crawler|spider|headless|phantom|selenium|puppeteer|playwright/i;
    if (botPatterns.test(event.userAgent)) {
      const alert: FraudAlert = {
        id: generateAlertId(),
        voterID: event.voterID,
        type: 'BOT_SUSPECT',
        severity: 'CRITICAL',
        score: 95,
        details: `User-Agent matches known bot pattern: ${event.userAgent.substring(0, 80)}`,
        timestamp: new Date()
      };
      alerts.push(alert);
    }
  } else {
    const alert: FraudAlert = {
      id: generateAlertId(),
      voterID: event.voterID,
      type: 'BOT_SUSPECT',
      severity: 'MEDIUM',
      score: 55,
      details: `No User-Agent header present. Possible automated request.`,
      timestamp: new Date()
    };
    alerts.push(alert);
  }

  // 5. STATISTICAL ANOMALY (Z-Score on voting speed)
  if (event.sessionDuration !== undefined) {
    voteSpeeds.push(event.sessionDuration);
    if (voteSpeeds.length >= 5) {
      const mean = voteSpeeds.reduce((a, b) => a + b, 0) / voteSpeeds.length;
      const variance = voteSpeeds.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / voteSpeeds.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > 0) {
        const zScore = Math.abs((event.sessionDuration - mean) / stdDev);
        if (zScore > 2.5) {
          const alert: FraudAlert = {
            id: generateAlertId(),
            voterID: event.voterID,
            type: 'VELOCITY_ANOMALY',
            severity: zScore > 3.5 ? 'CRITICAL' : 'HIGH',
            score: Math.min(100, Math.round(zScore * 25)),
            details: `Voting speed Z-Score: ${zScore.toFixed(2)} (mean: ${(mean/1000).toFixed(1)}s, this: ${(event.sessionDuration/1000).toFixed(1)}s). Statistically anomalous.`,
            timestamp: new Date()
          };
          alerts.push(alert);
        }
      }
    }
  }

  // 6. GRAPH-BASED NETWORK FRAUD DETECTION
  const graphAlerts = detectGraphFraud(event.voterID, event.ip, event.userAgent);
  alerts.push(...graphAlerts);

  // 7. BEHAVIORAL AI ANALYSIS
  const behaviorAlerts = analyzeBehavior(event.voterID, event.behavioral, event.sessionDuration);
  alerts.push(...behaviorAlerts);

  // Store all alerts & broadcast via SSE
  fraudAlerts.push(...alerts);
  for (const alert of alerts) {
    broadcastAlert(alert);
    // Persist to database (non-blocking)
    persistAlertToDb(alert);
  }

  return alerts;
}

/**
 * Persist a fraud alert to the database (non-blocking)
 */
async function persistAlertToDb(alert: FraudAlert) {
  try {
    const pool = (await import('../config/db')).default;
    await pool.query(
      `INSERT INTO fraud_alerts (alert_id, voter_id, type, severity, score, details)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (alert_id) DO NOTHING`,
      [alert.id, alert.voterID, alert.type, alert.severity, alert.score, alert.details]
    );
  } catch { /* silent — DB may not have the table yet */ }
}

/**
 * Get all fraud alerts with optional filtering
 */
export function getFraudAlerts(options?: { severity?: string; limit?: number }): FraudAlert[] {
  let result = [...fraudAlerts].reverse(); // newest first
  if (options?.severity) {
    result = result.filter(a => a.severity === options.severity);
  }
  if (options?.limit) {
    result = result.slice(0, options.limit);
  }
  return result;
}

/**
 * Get fraud statistics summary
 */
export function getFraudStats() {
  const total = fraudAlerts.length;
  const bySeverity = {
    CRITICAL: fraudAlerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: fraudAlerts.filter(a => a.severity === 'HIGH').length,
    MEDIUM: fraudAlerts.filter(a => a.severity === 'MEDIUM').length,
    LOW: fraudAlerts.filter(a => a.severity === 'LOW').length,
  };
  const byType = {
    DUPLICATE_ATTEMPT: fraudAlerts.filter(a => a.type === 'DUPLICATE_ATTEMPT').length,
    VELOCITY_ANOMALY: fraudAlerts.filter(a => a.type === 'VELOCITY_ANOMALY').length,
    IP_CLUSTER: fraudAlerts.filter(a => a.type === 'IP_CLUSTER').length,
    BOT_SUSPECT: fraudAlerts.filter(a => a.type === 'BOT_SUSPECT').length,
    DEVICE_ANOMALY: fraudAlerts.filter(a => a.type === 'DEVICE_ANOMALY').length,
    GRAPH_NETWORK: fraudAlerts.filter(a => a.type === 'GRAPH_NETWORK').length,
    BEHAVIORAL_ANOMALY: fraudAlerts.filter(a => a.type === 'BEHAVIORAL_ANOMALY').length,
  };
  const avgScore = total > 0 ? Math.round(fraudAlerts.reduce((s, a) => s + a.score, 0) / total) : 0;

  return { total, bySeverity, byType, avgScore };
}

/**
 * Get analytics data for the dashboard 
 */
export function getAnalyticsData() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Vote timeline (hourly buckets for last 24h)
  const hourlyVotes: { hour: string; votes: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourLabel = hourStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const count = [...voteTimestamps.values()].reduce((total, timestamps) => {
      return total + timestamps.filter(t => {
        const d = new Date(t);
        return d >= hourStart && d < new Date(hourStart.getTime() + 60 * 60 * 1000);
      }).length;
    }, 0);
    hourlyVotes.push({ hour: hourLabel, votes: count });
  }

  // IP distribution
  const topIPs = [...ipVoteMap.entries()]
    .map(([ip, voters]) => ({ ip, voterCount: voters.length }))
    .sort((a, b) => b.voterCount - a.voterCount)
    .slice(0, 10);

  // Total unique voters
  const uniqueVoters = voteTimestamps.size;
  const totalAttempts = [...voteTimestamps.values()].reduce((s, t) => s + t.length, 0);

  return {
    uniqueVoters,
    totalAttempts,
    duplicateAttempts: totalAttempts - uniqueVoters,
    hourlyVotes,
    topIPs,
    fraudStats: getFraudStats(),
    recentAlerts: getFraudAlerts({ limit: 20 }),
  };
}

/**
 * Clear all tracking data (for testing)
 */
export function resetFraudEngine() {
  voteTimestamps.clear();
  ipVoteMap.clear();
  deviceMap.clear();
  fraudAlerts.length = 0;
  voteSpeeds.length = 0;
  voterIPEdges.clear();
  voterDeviceEdges.clear();
  ipTimestampMap.clear();
  behavioralProfiles.clear();
  globalBehavioralStats.mouseMoves.length = 0;
  globalBehavioralStats.sessionDurations.length = 0;
  globalBehavioralStats.clickCounts.length = 0;
  globalBehavioralStats.idleTimes.length = 0;
  alertIdCounter = 1;
}

/**
 * Get graph network summary for visualization
 */
export function getGraphNetworkData() {
  const nodes: { id: string; type: 'voter' | 'ip' | 'device'; label: string }[] = [];
  const edges: { source: string; target: string; type: 'uses_ip' | 'uses_device' }[] = [];

  const addedNodes = new Set<string>();

  for (const [voterID, ips] of voterIPEdges.entries()) {
    if (!addedNodes.has(voterID)) {
      nodes.push({ id: voterID, type: 'voter', label: voterID.substring(0, 8) });
      addedNodes.add(voterID);
    }
    for (const ip of ips) {
      const ipId = `ip:${ip}`;
      if (!addedNodes.has(ipId)) {
        nodes.push({ id: ipId, type: 'ip', label: ip });
        addedNodes.add(ipId);
      }
      edges.push({ source: voterID, target: ipId, type: 'uses_ip' });
    }
  }

  for (const [voterID, devices] of voterDeviceEdges.entries()) {
    if (!addedNodes.has(voterID)) {
      nodes.push({ id: voterID, type: 'voter', label: voterID.substring(0, 8) });
      addedNodes.add(voterID);
    }
    for (const device of devices) {
      const devId = `dev:${device}`;
      if (!addedNodes.has(devId)) {
        nodes.push({ id: devId, type: 'device', label: device });
        addedNodes.add(devId);
      }
      edges.push({ source: voterID, target: devId, type: 'uses_device' });
    }
  }

  return { nodes, edges, totalNodes: nodes.length, totalEdges: edges.length };
}

/**
 * Get behavioral analysis summary
 */
export function getBehavioralSummary() {
  return {
    profilesTracked: behavioralProfiles.size,
    globalStats: {
      avgMouseMoves: globalBehavioralStats.mouseMoves.length > 0 
        ? Math.round(globalBehavioralStats.mouseMoves.reduce((a, b) => a + b, 0) / globalBehavioralStats.mouseMoves.length) : 0,
      avgSessionDuration: globalBehavioralStats.sessionDurations.length > 0
        ? Math.round(globalBehavioralStats.sessionDurations.reduce((a, b) => a + b, 0) / globalBehavioralStats.sessionDurations.length) : 0,
      avgClicks: globalBehavioralStats.clickCounts.length > 0
        ? Math.round(globalBehavioralStats.clickCounts.reduce((a, b) => a + b, 0) / globalBehavioralStats.clickCounts.length) : 0,
      totalSamples: globalBehavioralStats.mouseMoves.length,
    },
    behavioralAlerts: fraudAlerts.filter(a => a.type === 'BEHAVIORAL_ANOMALY').length,
  };
}

/**
 * Report a face-based fraud attempt (duplicate biometric)
 * Called from authRoutes when a voter who has already voted scans their face again.
 */
export function reportFaceFraud(params: { voterID: string; reason: string; ip?: string }): void {
  const alert: FraudAlert = {
    id: generateAlertId(),
    voterID: params.voterID,
    type: 'DUPLICATE_ATTEMPT',
    severity: 'CRITICAL',
    score: 95,
    details: params.reason + (params.ip ? ` | IP: ${params.ip}` : ''),
    timestamp: new Date(),
  };
  fraudAlerts.push(alert);
  broadcastAlert(alert);
  persistAlertToDb(alert);
  console.log(`[FRAUD] FACE FRAUD ALERT: ${params.reason}`);
}
