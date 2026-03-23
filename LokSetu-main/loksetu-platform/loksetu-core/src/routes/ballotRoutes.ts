import { Router } from 'express';
import pool from '../config/db';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import crypto from 'crypto';
import { analyzeVoteEvent } from '../services/fraudDetection';
import { analyticsService } from '../services/analyticsService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'LokSetu_super_secret_key';
const LEDGER_BASE_URL = process.env.GATEWAY_URL || 'http://localhost:3000';

// 🔗 Point this to your server-core Fabric Gateway
const LEDGER_URL = process.env.LEDGER_URL || `${LEDGER_BASE_URL}/cast-vote`;
const LEDGER_MINT_TOKEN_URL = process.env.LEDGER_MINT_TOKEN_URL || `${LEDGER_BASE_URL}/mint-token`;

// 🆔 CONSTANTS
const CURRENT_ELECTION_ID = "LOKSETU_LS_2026"; 
const BOOTH_ID = "LOKSETU_WEB_REMOTE";

const DELHI_LOK_SABHA_MAP: Record<string, string> = {
  'Narela': 'North West Delhi', 'Burari': 'North East Delhi', 'Timarpur': 'Chandni Chowk', 'Adarsh Nagar': 'North West Delhi', 'Badli': 'North West Delhi',
  'Rithala': 'North West Delhi', 'Bawana': 'North West Delhi', 'Mundka': 'North West Delhi', 'Kirari': 'North West Delhi', 'Sultanpur Majra': 'North West Delhi',
  'Nangloi Jat': 'North West Delhi', 'Mangol Puri': 'North West Delhi', 'Rohini': 'North West Delhi', 'Shalimar Bagh': 'North West Delhi', 'Shakur Basti': 'North West Delhi',
  'Tri Nagar': 'North West Delhi', 'Wazirpur': 'Chandni Chowk', 'Model Town': 'Chandni Chowk', 'Sadar Bazar': 'Chandni Chowk', 'Chandni Chowk': 'Chandni Chowk',
  'Matia Mahal': 'Chandni Chowk', 'Ballimaran': 'Chandni Chowk', 'Karol Bagh': 'New Delhi', 'Patel Nagar': 'New Delhi', 'Moti Nagar': 'New Delhi',
  'Madipur': 'West Delhi', 'Rajouri Garden': 'West Delhi', 'Hari Nagar': 'West Delhi', 'Tilak Nagar': 'West Delhi', 'Janakpuri': 'West Delhi',
  'Vikaspuri': 'West Delhi', 'Uttam Nagar': 'West Delhi', 'Dwarka': 'West Delhi', 'Matiala': 'West Delhi', 'Najafgarh': 'West Delhi',
  'Bijwasan': 'South Delhi', 'Palam': 'South Delhi', 'Delhi Cantt': 'New Delhi', 'Rajinder Nagar': 'New Delhi', 'New Delhi': 'New Delhi',
  'Jangpura': 'New Delhi', 'Kasturba Nagar': 'New Delhi', 'Malviya Nagar': 'South Delhi', 'R K Puram': 'South Delhi', 'Mehrauli': 'South Delhi',
  'Chhatarpur': 'South Delhi', 'Deoli': 'South Delhi', 'Ambedkar Nagar': 'South Delhi', 'Sangam Vihar': 'South Delhi', 'Greater Kailash': 'New Delhi',
  'Kalkaji': 'South Delhi', 'Tughlakabad': 'South Delhi', 'Badarpur': 'South Delhi', 'Okhla': 'East Delhi', 'Trilokpuri': 'East Delhi',
  'Kondli': 'East Delhi', 'Patparganj': 'East Delhi', 'Laxmi Nagar': 'East Delhi', 'Vishwas Nagar': 'East Delhi', 'Krishna Nagar': 'East Delhi',
  'Gandhi Nagar': 'East Delhi', 'Shahdara': 'East Delhi', 'Seemapuri': 'North East Delhi', 'Rohtas Nagar': 'North East Delhi', 'Seelampur': 'North East Delhi',
  'Ghonda': 'North East Delhi', 'Babarpur': 'North East Delhi', 'Gokalpur': 'North East Delhi', 'Mustafabad': 'North East Delhi', 'Karawal Nagar': 'North East Delhi',
};

function getDefaultWardFromConstituency(constituencyName: string): string {
  const keys = Object.keys(DELHI_LOK_SABHA_MAP);
  const index = Math.max(0, keys.indexOf(constituencyName));
  const wardNumber = ((index * 3) % 250) + 1;
  return `Ward ${String(wardNumber).padStart(3, '0')}`;
}

async function getActiveElection(stateId: number) {
  const result = await pool.query(
    `
      SELECT id, election_type, name, status, start_time, end_time
      FROM elections
      WHERE status = 'active' 
        AND state_id = $1
        AND (start_time IS NULL OR NOW() >= start_time)
        AND (end_time IS NULL OR NOW() <= end_time)
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1
    `,
    [stateId]
  );
  return result.rows[0] || null;
}

async function getVoterScopeMeta(epicId: string, constituencyName: string) {
  const reqResult = await pool.query(
    `
      SELECT lok_sabha_name, mcd_ward
      FROM registration_requests
      WHERE epic_id = $1 AND status = 'approved'
      ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC
      LIMIT 1
    `,
    [epicId]
  );

  const row = reqResult.rows[0] || {};
  const derivedLokSabha = row.lok_sabha_name || DELHI_LOK_SABHA_MAP[constituencyName] || 'New Delhi';
  const derivedWard = row.mcd_ward || getDefaultWardFromConstituency(constituencyName);

  return {
    lokSabhaName: derivedLokSabha,
    mcdWard: derivedWard,
  };
}

// --- MIDDLEWARE ---
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: "Access Denied" });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Invalid Token" });
    
    // ⚠️ SCHEMA MAPPING: Ensure the user object matches the 'voters' table columns
    req.user = user; 
    next();
  });
};

// --- FETCH BALLOT ---
router.get('/', authenticateToken, async (req: any, res: any) => {
  try {
    // Always resolve voter from DB for latest constituency mapping
    const voterResult = await pool.query(
      `
        SELECT v.id, v.epic_id, v.home_constituency_id, cons.name AS constituency_name, s.id AS state_id, s.name AS state_name
        FROM voters v
        LEFT JOIN constituencies cons ON v.home_constituency_id = cons.id
        LEFT JOIN states s ON cons.state_id = s.id
        WHERE v.id = $1
        LIMIT 1
      `,
      [req.user.id]
    );

    if (voterResult.rows.length === 0) {
      return res.status(404).json({ message: 'Voter not found' });
    }

    let voter = voterResult.rows[0];
    let constituencyId = voter.home_constituency_id;

    // Backfill missing constituency to a known Delhi constituency for legacy rows.
    if (!constituencyId) {
      const fallbackRes = await pool.query(
        `
          SELECT c.id, c.name AS constituency_name, s.id AS state_id, s.name AS state_name
          FROM constituencies c
          JOIN states s ON s.id = c.state_id
          WHERE s.code = 'DL'
          ORDER BY CASE WHEN c.name = 'New Delhi' THEN 0 ELSE 1 END, c.id
          LIMIT 1
        `
      );

      if (fallbackRes.rows.length > 0) {
        const fallback = fallbackRes.rows[0];
        constituencyId = fallback.id;
        await pool.query('UPDATE voters SET home_constituency_id = $1 WHERE id = $2', [constituencyId, voter.id]);
        voter = {
          ...voter,
          home_constituency_id: fallback.id,
          constituency_name: fallback.constituency_name,
          state_id: fallback.state_id,
          state_name: fallback.state_name,
        };
      }
    }

    if (!constituencyId) {
      return res.status(400).json({ message: 'Invalid voter data: no home constituency assigned.' });
    }

    const requestedElectionId = (req.query.electionId as string | undefined)?.trim();
    let activeElection = null;

    if (requestedElectionId && voter.state_id) {
      const requestedElectionRes = await pool.query(
        `
          SELECT id, election_type, name, status, start_time, end_time
          FROM elections
          WHERE id = $1
            AND state_id = $2
            AND status = 'active'
            AND (start_time IS NULL OR NOW() >= start_time)
            AND (end_time IS NULL OR NOW() <= end_time)
          LIMIT 1
        `,
        [requestedElectionId, voter.state_id]
      );
      activeElection = requestedElectionRes.rows[0] || null;
    }

    if (!activeElection) {
      activeElection = voter.state_id ? await getActiveElection(voter.state_id) : null;
    }

    const scopeMeta = await getVoterScopeMeta(voter.epic_id, voter.constituency_name || 'New Delhi');

    let candidates: any[] = [];

    if (activeElection) {
      if (activeElection.election_type === 'VS') {
        const result = await pool.query(
          `
            SELECT c.id, c.name, c.party, c.symbol_url
            FROM candidates c
            WHERE c.election_id = $1
              AND c.scope_type = 'VS'
              AND LOWER(TRIM(c.scope_value)) = LOWER(TRIM($2))
            ORDER BY c.id
          `,
          [activeElection.id, voter.constituency_name]
        );
        candidates = result.rows;
      } else if (activeElection.election_type === 'LS') {
        const result = await pool.query(
          `
            SELECT c.id, c.name, c.party, c.symbol_url
            FROM candidates c
            WHERE c.election_id = $1
              AND c.scope_type = 'LS'
              AND LOWER(TRIM(c.scope_value)) = LOWER(TRIM($2))
            ORDER BY c.id
          `,
          [activeElection.id, scopeMeta.lokSabhaName]
        );
        candidates = result.rows;
      } else if (activeElection.election_type === 'MCD') {
        const result = await pool.query(
          `
            SELECT c.id, c.name, c.party, c.symbol_url
            FROM candidates c
            WHERE c.election_id = $1
              AND c.scope_type = 'MCD'
              AND LOWER(TRIM(c.scope_value)) = LOWER(TRIM($2))
            ORDER BY c.id
          `,
          [activeElection.id, scopeMeta.mcdWard]
        );
        candidates = result.rows;
      }
    }

    // Legacy fallback if no active election or no generated candidates
    if (candidates.length === 0) {
      const legacy = await pool.query(
        `
          SELECT c.id, c.name, c.party, c.symbol_url
          FROM candidates c
          WHERE c.constituency_id = $1
            AND c.election_id IS NULL
          ORDER BY c.id
        `,
        [constituencyId]
      );
      candidates = legacy.rows;
    }

    res.json({
      constituency: voter.constituency_name || 'Unknown',
      state: voter.state_name || 'Unknown',
      election: activeElection ? { id: activeElection.id, type: activeElection.election_type, name: activeElection.name } : null,
      candidates,
    });
  } catch (err) {
    console.error("Ballot Fetch Error:", err);
    res.status(500).json({ message: "Failed to fetch ballot" });
  }
});

// --- CAST VOTE (UPGRADED) ---
router.post('/cast', authenticateToken, async (req: any, res: any) => {
  try {
    const { candidate_id, election_id } = req.body;
    const user = req.user; // Contains { id, epic_id, home_constituency_id, ... }

    console.log(`\n🗳️ Vote Request from: ${user.epic_id} for election: ${election_id}`);

    // --- STEP 1: VALIDATE ELECTION & TIME WINDOW ---
    if (!election_id) {
      return res.status(400).json({ message: "Election ID is required" });
    }

    const electionCheck = await pool.query(
      `SELECT id, election_type, status, start_time, end_time FROM elections WHERE id = $1`,
      [election_id]
    );

    if (electionCheck.rows.length === 0) {
      return res.status(404).json({ message: "Election not found" });
    }

    const election = electionCheck.rows[0];
    const now = new Date();

    if (election.status !== 'active') {
      return res.status(403).json({ message: "This election is not currently active" });
    }

    const isWithinWindow =
      (!election.start_time || now >= new Date(election.start_time)) &&
      (!election.end_time || now <= new Date(election.end_time));

    if (!isWithinWindow) {
      return res.status(403).json({ message: "Voting is not open for this election at this time" });
    }

    // --- STEP 2: CHECK IF VOTER ALREADY VOTED IN THIS ELECTION ---
    const existingVote = await pool.query(
      `SELECT id FROM vote_transactions WHERE voter_epic_id = $1 AND election_id = $2`,
      [user.epic_id, election_id]
    );

    if (existingVote.rows.length > 0) {
      return res.status(409).json({ message: "You have already voted in this election" });
    }

    // --- STEP 3: GET CANDIDATE + VOTER METADATA ---
    const voterMetaRes = await pool.query(
      `
        SELECT v.epic_id, cons.name AS constituency_name, s.id AS state_id, s.name AS state_name
        FROM voters v
        LEFT JOIN constituencies cons ON cons.id = v.home_constituency_id
        LEFT JOIN states s ON s.id = cons.state_id
        WHERE v.id = $1
        LIMIT 1
      `,
      [user.id]
    );

    const voterMeta = voterMetaRes.rows[0] || {};
    
    const candidateQuery = `
      SELECT c.id, c.election_id, c.scope_type, c.scope_value, s.name as state
      FROM candidates c 
      LEFT JOIN constituencies cons ON c.constituency_id = cons.id 
      LEFT JOIN states s ON cons.state_id = s.id
      WHERE c.id = $1
      LIMIT 1
    `;
    const candidateResult = await pool.query(candidateQuery, [candidate_id]);
    
    if (candidateResult.rows.length === 0) {
        return res.status(400).json({ message: "Invalid Candidate ID" });
    }

    const candidateRow = candidateResult.rows[0];
    const candidateState = candidateRow.state || voterMeta.state_name || 'Delhi';

    // Verify candidate belongs to this election
    if (candidateRow.election_id !== election_id) {
      return res.status(400).json({ message: 'Candidate does not belong to this election.' });
    }

    // Verify voter is eligible to vote for this candidate
    const scopeMeta = await getVoterScopeMeta(user.epic_id, voterMeta.constituency_name || 'New Delhi');
    const expectedScope = election.election_type === 'VS'
      ? (voterMeta.constituency_name || 'New Delhi')
      : election.election_type === 'LS'
        ? scopeMeta.lokSabhaName
        : scopeMeta.mcdWard;

    const normalizedCandidateScope = String(candidateRow.scope_value || '').trim().toLowerCase();
    const normalizedExpectedScope = String(expectedScope || '').trim().toLowerCase();

    if (normalizedCandidateScope !== normalizedExpectedScope) {
      return res.status(403).json({ message: 'Candidate is not valid for your election constituency.' });
    }

    // --- STEP 4: SUBMIT TO BLOCKCHAIN GATEWAY (NON-BLOCKING) ---
    console.log(`🔗 Submitting to Blockchain...`);
    console.log(`   Election: ${election_id}`);
    console.log(`   State Match: Voter(Constituency ${user.home_constituency_id}) -> Candidate(${candidateState})`);

    let txId: string;
    let blockchainSynced = false;

    try {
      const ledgerResponse = await axios.post(LEDGER_URL, {
        electionId: election_id,
        voterID: user.epic_id,
        candidateID: candidate_id,
        candidateState: candidateState,
        boothLocation: BOOTH_ID
      }, { timeout: 10000 });

      txId = ledgerResponse.data.txId;
      blockchainSynced = true;
      console.log(`✅ Blockchain confirmed TX: ${txId}`);

    } catch (error: any) {
      const ledgerError = error.response?.data?.error || error.message;

      // Critical blockchain rejections — these MUST block the vote
      if (error.response?.status && error.response.status < 500) {
        if (ledgerError.includes("Vote Token")) {
          // Recovery path for dynamic multi-election flows:
          // mint token for this exact election and retry cast once.
          try {
            await axios.post(LEDGER_MINT_TOKEN_URL, {
              electionId: election_id,
              voterID: user.epic_id,
            }, { timeout: 8000 });

            const retryLedgerResponse = await axios.post(LEDGER_URL, {
              electionId: election_id,
              voterID: user.epic_id,
              candidateID: candidate_id,
              candidateState: candidateState,
              boothLocation: BOOTH_ID
            }, { timeout: 10000 });

            txId = retryLedgerResponse.data.txId;
            blockchainSynced = true;
            console.log(`✅ Blockchain confirmed TX after token recovery: ${txId}`);
          } catch (retryErr: any) {
            const retryError = retryErr.response?.data?.error || retryErr.message;
            return res.status(403).json({ message: `Voting Token Missing or Invalid. Please Re-login. (${retryError})` });
          }
        }
        if (ledgerError.includes("Double Voting")) {
          return res.status(409).json({ message: "CRITICAL: Double Voting Detected on Ledger!" });
        }
      }

      // Gateway offline or server error — fallback to PostgreSQL
      if (!blockchainSynced) {
        txId = `local-${crypto.randomUUID()}`;
        console.warn(`⚠️  Blockchain unavailable (${ledgerError}) — falling back to PostgreSQL`);
        console.log(`   Local TX hash: ${txId} | blockchain_status: pending`);
        analyticsService.log('WARN', 'ballot', `Blockchain offline — vote stored locally for ${user.epic_id}`, { txId, error: ledgerError });
      }
    }

    // --- STEP 5: STORE VOTE IN DATABASE (PER-ELECTION) ---
    await pool.query(
      `INSERT INTO vote_transactions (voter_epic_id, election_id, candidate_id, tx_hash, booth_location, ip_address, blockchain_status, blockchain_timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [user.epic_id, election_id, candidate_id, txId, BOOTH_ID, req.ip || req.headers['x-forwarded-for'] as string, blockchainSynced ? 'confirmed' : 'pending']
    );

    // Update election metrics
    await pool.query(
      `
        UPDATE election_metrics
        SET
          votes_cast = votes_cast + 1,
          pending_votes = GREATEST(total_registered_voters - (votes_cast + 1), 0),
          turnout_percentage = CASE
            WHEN total_registered_voters > 0 THEN ROUND(((votes_cast + 1)::decimal / total_registered_voters::decimal) * 100, 2)
            ELSE 0
          END,
          updated_at = NOW()
        WHERE election_id = $1
      `,
      [election_id]
    );

    // --- STEP 6: FRAUD ANALYSIS ---
    const fraudAlerts = analyzeVoteEvent({
      voterID: user.epic_id,
      candidateID: candidate_id,
      timestamp: new Date(),
      ip: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'] as string,
      sessionDuration: req.body.sessionDuration,
      behavioral: req.body.behavioral,
    });
    if (fraudAlerts.length > 0) {
      console.log(`[FRAUD] Alerts for ${user.epic_id}:`, fraudAlerts.map(a => `${a.type}(${a.severity})`).join(', '));
      // Persist fraud alerts to DB
      for (const alert of fraudAlerts) {
        analyticsService.storeFraudAlert({
          alertId: alert.id,
          voterId: alert.voterID,
          type: alert.type,
          severity: alert.severity,
          score: alert.score,
          details: alert.details,
          ip: req.ip || req.headers['x-forwarded-for'] as string,
          userAgent: req.headers['user-agent'] as string,
        }).catch(() => {});
      }
    }

    console.log(`✅ Vote Committed! Election: ${election_id} | TX: ${txId} | Blockchain: ${blockchainSynced ? 'confirmed' : 'pending'}`);
    analyticsService.log('INFO', 'ballot', `Vote committed for ${user.epic_id} → candidate ${candidate_id} in election ${election_id}`, { txId, booth: BOOTH_ID, blockchainSynced });

    res.json({
      success: true,
      message: blockchainSynced ? "Vote Recorded on LokSetu Ledger" : "Vote Recorded — Blockchain sync pending",
      transactionId: txId,
      blockchainSynced,
      electionId: election_id,
      timestamp: new Date().toISOString()
    });

  } catch (err: any) {
    console.error("Voting System Error:", err);
    analyticsService.log('ERROR', 'ballot', `Vote casting failed: ${err.message}`, { voter: req.user?.epic_id });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// --- FETCH VOTER PROFILE & ACTIVE ELECTIONS ---
router.get('/elections/active', authenticateToken, async (req: any, res: any) => {
  try {
    // Get voter info
    const voterResult = await pool.query(
      `SELECT id, epic_id, full_name, home_constituency_id, password_hash, face_set_token
       FROM voters WHERE id = $1`,
      [req.user.id]
    );

    if (voterResult.rows.length === 0) {
      return res.status(404).json({ message: 'Voter not found' });
    }

    const voter = voterResult.rows[0];

    // Get voter's state
    const stateResult = await pool.query(
      `SELECT s.id, s.name FROM states s
       JOIN constituencies c ON c.state_id = s.id
       WHERE c.id = (SELECT home_constituency_id FROM voters WHERE id = $1)`,
      [req.user.id]
    );

    let stateId = stateResult.rows[0]?.id;
    let stateName = stateResult.rows[0]?.name;

    if (!stateId) {
      const delhiStateRes = await pool.query(
        `SELECT id, name FROM states WHERE code = 'DL' LIMIT 1`
      );
      stateId = delhiStateRes.rows[0]?.id;
      stateName = delhiStateRes.rows[0]?.name || 'Delhi';
    }

    if (!stateId) {
      return res.status(500).json({ message: 'State mapping is missing for voter profile.' });
    }

    // Get all active elections for voter's state that are currently open
    const electionsResult = await pool.query(
      `SELECT 
         id, name, description, election_type, status, start_time, end_time, 
         scheduled_date
       FROM elections
       WHERE state_id = $1 
         AND status = 'active'
         AND (start_time IS NULL OR NOW() >= start_time)
         AND (end_time IS NULL OR NOW() <= end_time)
       ORDER BY start_time DESC`,
      [stateId]
    );

    const elections = electionsResult.rows;

    // For each election, check if voter already voted
    const electionsWithStatus = await Promise.all(
      elections.map(async (election) => {
        const voteCheck = await pool.query(
          `SELECT id FROM vote_transactions WHERE voter_epic_id = $1 AND election_id = $2`,
          [voter.epic_id, election.id]
        );
        return {
          ...election,
          hasVoted: voteCheck.rows.length > 0
        };
      })
    );

    res.json({
      voter: {
        epicId: voter.epic_id,
        name: voter.full_name,
        state: stateName,
        hasPassword: !!voter.password_hash,
        hasFaceSetToken: !!voter.face_set_token
      },
      elections: electionsWithStatus
    });
  } catch (err) {
    console.error("Election Fetch Error:", err);
    res.status(500).json({ message: "Failed to fetch elections" });
  }
});

export default router;