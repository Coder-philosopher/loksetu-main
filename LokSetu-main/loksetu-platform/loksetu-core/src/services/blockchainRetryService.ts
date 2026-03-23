import axios from 'axios';
import { analyticsService } from './analyticsService';

const LEDGER_URL = process.env.LEDGER_URL || 'http://localhost:3000/cast-vote';
const CURRENT_ELECTION_ID = 'LOKSETU_LS_2026';
const BOOTH_ID = 'LOKSETU_WEB_REMOTE';
const RETRY_INTERVAL_MS = 60_000; // 1 minute

let retryTimer: ReturnType<typeof setInterval> | null = null;

async function retryPendingVotes() {
  try {
    const pending = await analyticsService.getPendingBlockchainVotes();
    if (pending.length === 0) return;

    console.log(`\n🔄 [BlockchainRetry] Found ${pending.length} pending vote(s) — attempting sync...`);

    let synced = 0;
    let failed = 0;

    for (const vote of pending) {
      try {
        const response = await axios.post(LEDGER_URL, {
          electionId: CURRENT_ELECTION_ID,
          voterID: vote.voter_epic_id,
          candidateID: vote.candidate_id,
          candidateState: vote.candidate_state,
          boothLocation: BOOTH_ID,
        }, { timeout: 10000 });

        const txHash = response.data.txId;
        await analyticsService.markVoteBlockchainSynced(vote.id, txHash);
        synced++;
        console.log(`   ✅ Synced vote #${vote.id} (${vote.voter_epic_id}) → TX: ${txHash}`);

      } catch (err: any) {
        failed++;
        // Don't log each failure in detail if gateway is simply offline
        if (failed === 1) {
          const msg = err.response?.data?.error || err.message;
          console.log(`   ❌ Gateway still unavailable: ${msg}`);
        }
      }
    }

    if (synced > 0) {
      console.log(`🔄 [BlockchainRetry] Synced ${synced}/${pending.length} votes to blockchain`);
      analyticsService.log('INFO', 'blockchain-retry', `Synced ${synced} pending votes to blockchain`).catch(() => {});
    }
  } catch (err) {
    // Silent — retry job should not crash the server
    console.error('[BlockchainRetry] Error:', err);
  }
}

export function startBlockchainRetryJob() {
  if (retryTimer) return;
  retryTimer = setInterval(retryPendingVotes, RETRY_INTERVAL_MS);
  console.log(`🔄 [BlockchainRetry] Background retry job started (every ${RETRY_INTERVAL_MS / 1000}s)`);
}

export function stopBlockchainRetryJob() {
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
}
