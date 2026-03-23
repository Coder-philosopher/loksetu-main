import { Router } from 'express';
import axios from 'axios';
import pool from '../config/db';
import { analyticsService } from '../services/analyticsService';

const router = Router();
const LEDGER_ALL_URL = 'http://localhost:3000/query-all';

type ScopeType = 'LS' | 'VS' | 'MCD';

function normalizeScopeType(value?: string): ScopeType {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('lok')) return 'LS';
  if (normalized.includes('mcd')) return 'MCD';
  return 'VS';
}

// Party color mapping for chart display
const PARTY_COLORS: Record<string, string> = {
  'BJP': '#FF9933',
  'INC': '#138808',
  'AAP': '#0A3D62',
  'Digital Bharat Party': '#FF9933',
  'Green Future Alliance': '#138808',
};

function getPartyColor(party: string, index: number): string {
  const fallbackColors = ['#FF9933', '#138808', '#0A3D62', '#f59e0b', '#dc2626'];
  return PARTY_COLORS[party] || fallbackColors[index % fallbackColors.length];
}

function getConstituencyLabel(election: any): string {
  if (election.election_type === 'VS') return election.constituency_name || 'Delhi';
  if (election.election_type === 'LS') return election.lok_sabha_name || 'Delhi';
  if (election.election_type === 'MCD') return election.mcd_ward || 'Delhi';
  return election.constituency_name || election.lok_sabha_name || election.mcd_ward || 'Delhi';
}

function mapStatusBadge(status?: string): string {
  if (!status) return 'pending';
  if (status === 'active') return 'active';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'pending';
}

// GET /api/v1/results/elections — admin election list for results landing page
router.get('/elections', async (req: any, res: any) => {
  const status = req.query?.status ? String(req.query.status) : null;

  try {
    let sql = `
      SELECT
        e.id,
        e.name,
        e.election_type,
        e.status,
        e.constituency_id,
        e.lok_sabha_name,
        e.mcd_ward,
        c.name AS constituency_name,
        e.start_time,
        e.end_time,
        e.scheduled_date,
        e.created_at,
        em.votes_cast,
        em.turnout_percentage,
        em.total_registered_voters,
        em.pending_votes
      FROM elections e
      LEFT JOIN constituencies c ON c.id = e.constituency_id
      LEFT JOIN election_metrics em ON em.election_id = e.id
    `;

    const params: any[] = [];
    if (status) {
      params.push(status);
      sql += ` WHERE e.status = $1`;
    }

    sql += ` ORDER BY e.created_at DESC`;

    const result = await pool.query(sql, params);
    const elections = result.rows.map((row: any) => ({
      id: row.id,
      title: row.name,
      electionType: row.election_type,
      status: mapStatusBadge(row.status),
      constituency: getConstituencyLabel(row),
      constituencyName: row.constituency_name,
      lokSabhaName: row.lok_sabha_name,
      mcdWard: row.mcd_ward,
      startTime: row.start_time,
      endTime: row.end_time,
      scheduledDate: row.scheduled_date,
      votesCast: Number(row.votes_cast || 0),
      turnoutPercentage: Number(row.turnout_percentage || 0),
      totalRegisteredVoters: Number(row.total_registered_voters || 0),
      pendingVotes: Number(row.pending_votes || 0),
    }));

    return res.json({ success: true, elections, count: elections.length, timestamp: new Date().toISOString() });
  } catch (error: any) {
    analyticsService.log('ERROR', 'results', `Results elections list failed: ${error.message}`).catch(() => {});
    return res.status(500).json({ success: false, message: 'Failed to fetch election results list', error: error.message });
  }
});

// GET /api/v1/results/elections/:electionId — admin election detail dashboard data
router.get('/elections/:electionId', async (req: any, res: any) => {
  const { electionId } = req.params;

  try {
    const electionRes = await pool.query(
      `
      SELECT
        e.id,
        e.name,
        e.election_type,
        e.status,
        e.description,
        e.constituency_id,
        e.lok_sabha_name,
        e.mcd_ward,
        c.name AS constituency_name,
        e.start_time,
        e.end_time,
        e.scheduled_date,
        em.votes_cast,
        em.turnout_percentage,
        em.total_registered_voters,
        em.pending_votes
      FROM elections e
      LEFT JOIN constituencies c ON c.id = e.constituency_id
      LEFT JOIN election_metrics em ON em.election_id = e.id
      WHERE e.id = $1
      LIMIT 1
      `,
      [electionId]
    );

    if (electionRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    const election = electionRes.rows[0];

    const candidateVoteRes = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.party,
        c.scope_type,
        c.scope_value,
        COUNT(vt.id)::int AS votes
      FROM candidates c
      LEFT JOIN vote_transactions vt ON vt.candidate_id = c.id AND vt.election_id = $1
      WHERE c.election_id = $1
      GROUP BY c.id, c.name, c.party, c.scope_type, c.scope_value
      ORDER BY c.scope_value ASC, votes DESC, c.name ASC
      `,
      [electionId]
    );

    const candidates = candidateVoteRes.rows.map((row: any, index: number) => ({
      id: row.id,
      name: row.name,
      party: row.party,
      scopeType: row.scope_type,
      scopeValue: row.scope_value,
      votes: Number(row.votes || 0),
      fill: getPartyColor(row.party, index),
    }));

    const totalVotes = candidates.reduce((sum: number, candidate: any) => sum + candidate.votes, 0);

    const seatMap = new Map<string, any[]>();
    candidates.forEach((candidate: any) => {
      const seatKey = candidate.scopeValue || 'Delhi';
      if (!seatMap.has(seatKey)) seatMap.set(seatKey, []);
      seatMap.get(seatKey)?.push(candidate);
    });

    const seats = Array.from(seatMap.entries()).map(([seatName, seatCandidates]) => {
      const sortedCandidates = [...seatCandidates].sort((a, b) => b.votes - a.votes);
      const winner = sortedCandidates.length > 0 ? sortedCandidates[0] : null;
      const runnerUp = sortedCandidates.length > 1 ? sortedCandidates[1] : null;
      const margin = winner ? Math.max((winner.votes || 0) - (runnerUp?.votes || 0), 0) : 0;
      const seatVotes = sortedCandidates.reduce((sum, item) => sum + (item.votes || 0), 0);

      return {
        seatName,
        scopeType: election.election_type,
        totalVotes: seatVotes,
        winner: winner
          ? {
              candidateId: winner.id,
              name: winner.name,
              party: winner.party,
              votes: winner.votes,
              margin,
            }
          : null,
        candidates: sortedCandidates,
      };
    }).sort((a, b) => a.seatName.localeCompare(b.seatName));

    const partyMap = new Map<string, number>();
    candidates.forEach((candidate: any) => {
      partyMap.set(candidate.party, (partyMap.get(candidate.party) || 0) + candidate.votes);
    });

    const partyVoteShare = Array.from(partyMap.entries())
      .map(([party, votes], index) => ({
        party,
        votes,
        voteShare: totalVotes > 0 ? Number(((votes / totalVotes) * 100).toFixed(2)) : 0,
        color: getPartyColor(party, index),
      }))
      .sort((a, b) => b.votes - a.votes);

    const leadingParty = partyVoteShare[0]?.party || null;

    return res.json({
      success: true,
      election: {
        id: election.id,
        title: election.name,
        electionType: election.election_type,
        status: mapStatusBadge(election.status),
        description: election.description,
        constituency: getConstituencyLabel(election),
        constituencyName: election.constituency_name,
        lokSabhaName: election.lok_sabha_name,
        mcdWard: election.mcd_ward,
        startTime: election.start_time,
        endTime: election.end_time,
        scheduledDate: election.scheduled_date,
      },
      metrics: {
        totalVotes,
        totalCandidates: candidates.length,
        totalSeats: seats.length,
        turnoutPercentage: Number(election.turnout_percentage || 0),
        votesCast: Number(election.votes_cast || totalVotes),
        totalRegisteredVoters: Number(election.total_registered_voters || 0),
        pendingVotes: Number(election.pending_votes || 0),
        leadingParty,
        isLive: election.status === 'active',
      },
      candidates,
      seats,
      partyVoteShare,
      noVotes: totalVotes === 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    analyticsService.log('ERROR', 'results', `Election result detail failed for ${electionId}: ${error.message}`).catch(() => {});
    return res.status(500).json({ success: false, message: 'Failed to fetch election result details', error: error.message });
  }
});

// GET /api/v1/results — overall summary across all constituencies
router.get('/', async (req: any, res: any) => {
  try {
    const scopeType = normalizeScopeType(req.query?.type as string | undefined);
    console.log(`[results] Overall request type=${scopeType}`);

    console.log('📊 Fetching overall election results...');

    const result = scopeType === 'VS'
      ? await pool.query(`
          SELECT 
            cons.id as constituency_id,
            cons.name as constituency,
            s.name as state,
            c.id as candidate_id,
            c.name,
            c.party,
            COUNT(v.id) FILTER (WHERE v.has_voted = true AND v.voted_for_candidate_id = c.id) as votes
          FROM candidates c
          JOIN constituencies cons ON c.constituency_id = cons.id
          JOIN states s ON cons.state_id = s.id
          LEFT JOIN voters v ON v.home_constituency_id = cons.id
          WHERE c.scope_type = 'VS'
          GROUP BY cons.id, cons.name, s.name, c.id, c.name, c.party
          ORDER BY cons.name, votes DESC
        `)
      : await pool.query(`
          SELECT 
            c.scope_value as constituency,
            $1::varchar as state,
            c.id as candidate_id,
            c.name,
            c.party,
            0 as votes
          FROM candidates c
          WHERE c.scope_type = $2
          ORDER BY c.scope_value, c.name
        `, ['Delhi', scopeType]);

    // Group by constituency
    const grouped: Record<string, any> = {};
    result.rows.forEach((row: any) => {
      const key = row.constituency;
      if (!grouped[key]) {
        grouped[key] = {
          constituencyId: row.constituency_id || row.constituency,
          constituency: row.constituency,
          state: row.state,
          type: scopeType,
          candidates: [],
        };
      }
      grouped[key].candidates.push({
        name: row.name,
        party: row.party,
        votes: parseInt(row.votes) || 0,
      });
    });

    const totalVotes = result.rows.reduce((sum: number, r: any) => sum + (parseInt(r.votes) || 0), 0);
    console.log(`   📊 Overall results: ${Object.keys(grouped).length} constituencies, ${totalVotes} total votes`);

    res.json({
      constituencies: Object.values(grouped),
      totalVotes,
      source: 'database',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('📊 Overall results error:', err.message);
    analyticsService.log('ERROR', 'results', `Overall results query failed: ${err.message}`).catch(() => {});
    res.status(500).json({ message: 'Failed to fetch overall results', error: err.message });
  }
});

// GET /api/v1/results/:constituencyId — results for a specific constituency
router.get('/:constituencyId', async (req: any, res: any) => {
  const { constituencyId } = req.params;
  const scopeType = normalizeScopeType(req.query?.type as string | undefined);
  let source = 'database';
  let blockchainMeta: { source: string; ledgerCount?: number } = { source: 'database' };

  try {
    console.log(`[results] Request constituency=${constituencyId} type=${scopeType}`);
    console.log(`📊 Fetching LIVE results for Constituency ${constituencyId}...`);

    const numericId = Number(constituencyId);
    const isNumericId = !Number.isNaN(numericId);

    // VS lookups are constituency_id based (integer). Prevent invalid NaN SQL casts.
    if (scopeType === 'VS' && !isNumericId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid constituency id for VS result lookup',
      });
    }

    const candidatesRes = scopeType === 'VS'
      ? await pool.query(
          'SELECT id, name, party, symbol_url FROM candidates WHERE constituency_id = $1 AND scope_type = $2',
          [numericId, scopeType]
        )
      : await pool.query(
          'SELECT id, name, party, symbol_url FROM candidates WHERE scope_type = $1 AND scope_value = $2',
          [scopeType, String(constituencyId)]
        );

    console.log(`[results] Candidate query returned ${candidatesRes.rows.length} rows`);

    if (candidatesRes.rows.length === 0) {
      return res.json({
        success: false,
        message: 'No candidates found',
        candidates: [],
        totalVotes: 0,
        partySummary: [],
        leadingParty: null,
        source,
        blockchainData: blockchainMeta,
        timestamp: new Date().toISOString(),
      });
    }

    const candidates = candidatesRes.rows;
    let tallyMap: Record<string, number> = {};
    candidates.forEach((c: any) => { tallyMap[c.id] = 0; });

    // STEP 2: Try blockchain first, fallback to database
    try {
      const ledgerRes = await axios.get(LEDGER_ALL_URL, { timeout: 5000 });
      const allAssets = ledgerRes.data?.data;

      if (Array.isArray(allAssets)) {
        // Get constituency name for matching
        let consState = 'Delhi';
        if (scopeType === 'VS' && isNumericId) {
          const consNameRes = await pool.query(
            'SELECT cons.name, s.name as state FROM constituencies cons JOIN states s ON cons.state_id = s.id WHERE cons.id = $1',
            [numericId]
          );
          consState = consNameRes.rows[0]?.state || consState;
        }

        let ledgerCount = 0;
        allAssets.forEach((asset: any) => {
          const record = asset.Record;
          if (record.docType === 'ballot' && record.state === consState) {
            const votedForId = record.candidateID;
            if (tallyMap[votedForId] !== undefined) {
              tallyMap[votedForId]++;
              ledgerCount += 1;
            }
          }
        });
        source = 'blockchain';
        blockchainMeta = { source: 'blockchain', ledgerCount };
        console.log(`   🔗 Source: Blockchain ledger`);
      } else {
        throw new Error('Invalid blockchain response format');
      }
    } catch (bcError: any) {
      // FALLBACK: Count votes from PostgreSQL voters table
      console.log(`   ⚠️ Blockchain unavailable (${bcError.message}) — using database fallback`);
      source = 'database';
      blockchainMeta = { source: 'database' };

      const voteCountRes = scopeType === 'VS' && isNumericId
        ? await pool.query(
            `SELECT voted_for_candidate_id, COUNT(*) as vote_count
             FROM voters
             WHERE has_voted = true AND home_constituency_id = $1 AND voted_for_candidate_id IS NOT NULL
             GROUP BY voted_for_candidate_id`,
            [numericId]
          )
        : { rows: [] };

      voteCountRes.rows.forEach((row: any) => {
        if (tallyMap[row.voted_for_candidate_id] !== undefined) {
          tallyMap[row.voted_for_candidate_id] = parseInt(row.vote_count);
        }
      });
    }

    // STEP 3: Format for Frontend
    const totalVotes = Object.values(tallyMap).reduce((a, b) => a + b, 0);

    const sortedByVotes = [...candidates].sort((a: any, b: any) => {
      const aVotes = tallyMap[a.id] || 0;
      const bVotes = tallyMap[b.id] || 0;
      return bVotes - aVotes;
    });
    const leaderCandidate = totalVotes > 0 ? sortedByVotes[0] : null;
    const runnerUpCandidate = totalVotes > 0 ? sortedByVotes[1] : null;
    const leaderVotes = leaderCandidate ? tallyMap[leaderCandidate.id] || 0 : 0;
    const runnerUpVotes = runnerUpCandidate ? tallyMap[runnerUpCandidate.id] || 0 : 0;
    const leaderMargin = leaderCandidate ? Math.max(leaderVotes - runnerUpVotes, 0) : null;

    const finalResults = candidates.map((c: any, i: number) => {
      const votes = tallyMap[c.id] || 0;
      return {
        id: c.id,
        name: c.name,
        party: c.party,
        votes,
        fill: getPartyColor(c.party, i),
        status: leaderCandidate && c.id === leaderCandidate.id && totalVotes > 0 ? 'winner' : 'lost',
        marginVotes: leaderCandidate && c.id === leaderCandidate.id ? leaderMargin : null,
      };
    });

    const partyVotes = new Map<string, number>();
    candidates.forEach((c: any) => {
      const votes = tallyMap[c.id] || 0;
      partyVotes.set(c.party, (partyVotes.get(c.party) || 0) + votes);
    });

    const partySummary = Array.from(partyVotes.entries()).map(([party, votes], index) => {
      const voteShare = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
      const won = leaderCandidate && leaderCandidate.party === party && totalVotes > 0 ? 1 : 0;
      const leading = 0;
      return {
        party,
        votes,
        voteShare: Number(voteShare.toFixed(2)),
        won,
        leading,
        total: won + leading,
        color: getPartyColor(party, index),
      };
    });

    const leadingParty = leaderCandidate?.party || null;

    console.log(`   📊 Results: ${totalVotes} total votes across ${candidates.length} candidates (source: ${source})`);

    res.json({
      success: true,
      candidates: finalResults,
      totalVotes,
      partySummary,
      leadingParty,
      source,
      blockchainData: blockchainMeta,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('📊 Result Aggregation Error:', error.message);
    analyticsService.log('ERROR', 'results', `Result aggregation failed for constituency ${constituencyId}: ${error.message}`).catch(() => {});
    res.status(500).json({ message: 'Failed to calculate results', error: error.message });
  }
});

export default router;