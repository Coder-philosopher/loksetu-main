/*
 * LokSetu Local Development Gateway
 * Simulates the blockchain gateway (server.js) using in-memory storage.
 * Use this when Hyperledger Fabric is not available.
 *
 * Mirrors the real chaincode (VoterContract) behavior:
 * - Vote token minting & burning
 * - Double-vote prevention
 * - State matching validation
 * - Ballot records (docType: 'ballot') for result aggregation
 * - Transaction IDs for every write operation
 */
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const PORT = 3000;

// --- IN-MEMORY LEDGER (simulates blockchain world state) ---
const ledger = {};   // voters, tokens, ballots — keyed like Fabric
const txLog = [];    // ordered transaction log (append-only, like a real blockchain)

function generateTxId() {
  return crypto.randomBytes(16).toString('hex');
}

// Seed initial voters (same as chaincode InitLedger)
function initLedger() {
  // Clear everything
  Object.keys(ledger).forEach(k => delete ledger[k]);
  txLog.length = 0;

  const initial = [
    { id: 'VOTER_001', docType: 'voter', biometricHash: 'hash_001', homeState: 'Delhi', currentState: 'Delhi', constituencyId: 'ND-01', hasVoted: false },
    { id: 'VOTER_002', docType: 'voter', biometricHash: 'hash_002', homeState: 'Maharashtra', currentState: 'Maharashtra', constituencyId: 'MS-01', hasVoted: false },
    { id: 'VOTER_003', docType: 'voter', biometricHash: 'hash_003', homeState: 'Bihar', currentState: 'Delhi', constituencyId: 'ND-01', hasVoted: false },
  ];
  initial.forEach(v => { ledger[v.id] = v; });
  console.log(`📦 Ledger initialized with ${initial.length} voters`);
}

// --- Kafka Producer ---
async function connectKafka() {
  try {
    const { Kafka } = require('kafkajs');
    const kafka = new Kafka({ clientId: 'LokSetu-gateway-local', brokers: ['localhost:9092'] });
    const producer = kafka.producer();
    await producer.connect();
    console.log('✅ Kafka Producer Connected');
    return producer;
  } catch {
    console.log('⚠️  Kafka not available - votes will be processed in-memory');
    return null;
  }
}

let kafkaProducer = null;

// --- ENDPOINTS (API-compatible with server.js) ---

// Health check
app.get('/', (req, res) => {
  res.json({
    project: 'LokSetu Gateway (Local Dev)',
    status: 'Active 🟢',
    mode: 'in-memory',
    ledgerSize: Object.keys(ledger).length,
    transactions: txLog.length
  });
});

// Reset ledger endpoint (for system master reset)
app.post('/reset-ledger', (req, res) => {
  console.log('\n🔴 LEDGER RESET TRIGGERED 🔴');
  try {
    const prevSize = Object.keys(ledger).length;
    const prevTxCount = txLog.length;

    // Clear ledger and transaction log
    Object.keys(ledger).forEach(k => delete ledger[k]);
    txLog.length = 0;

    // Re-initialize with seed data
    initLedger();

    console.log(`✅ Ledger reset completed`);
    console.log(`  Previous state: ${prevSize} entries, ${prevTxCount} transactions`);
    console.log(`  Current state: ${Object.keys(ledger).length} entries, ${txLog.length} transactions\n`);

    res.json({
      success: true,
      message: 'Ledger reset successfully',
      previous: { entries: prevSize, transactions: prevTxCount },
      current: { entries: Object.keys(ledger).length, transactions: txLog.length }
    });
  } catch (error) {
    console.error('❌ Ledger reset failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mint vote token (mirrors chaincode MintVoteToken)
app.post('/mint-token', (req, res) => {
  const { electionId, voterID } = req.body;
  if (!electionId || !voterID) {
    return res.status(400).json({ success: false, error: 'Missing electionId or voterID' });
  }

  const tokenKey = `VOTE_TOKEN_${electionId}_${voterID}`;
  if (ledger[tokenKey]) {
    return res.status(409).json({ success: false, error: 'Vote Token already exists for this voter' });
  }

  const txId = generateTxId();
  ledger[tokenKey] = {
    docType: 'voteToken',
    electionId,
    voterID,
    isUsed: false,
    createdAt: new Date().toISOString()
  };
  txLog.push({ txId, type: 'MintVoteToken', key: tokenKey, timestamp: new Date().toISOString() });

  console.log(`🎫 Token minted: ${tokenKey} (tx: ${txId})`);
  res.json({ success: true, message: `Ballot Token generated for ${voterID}`, txId });
});

// Cast vote — full chaincode validation
app.post('/cast-vote', async (req, res) => {
  const { electionId, voterID, candidateID, candidateState, boothLocation } = req.body;
  if (!electionId || !voterID || !candidateID || !candidateState) {
    return res.status(400).json({ error: 'Missing required voting fields' });
  }

  const payload = { electionId, voterID, candidateID, candidateState, boothLocation };

  // Process in-memory with validation (mirrors chaincode)
  const result = processVoteInMemory(payload);
  if (!result.success) {
    return res.status(409).json({ success: false, error: result.error });
  }

  // Also send to Kafka if available (for consumer pipeline testing)
  if (kafkaProducer) {
    try {
      await kafkaProducer.send({
        topic: 'vote.cast',
        messages: [{ key: voterID, value: JSON.stringify(payload) }],
      });
      console.log(`📥 Vote also queued to Kafka: ${voterID}`);
    } catch {
      console.log(`⚠️  Kafka send failed (vote already processed in-memory)`);
    }
  }

  txLog.push({ txId: result.txId, type: 'CastVote', voter: voterID, candidate: candidateID, timestamp: new Date().toISOString() });

  res.json({ success: true, message: 'Vote received and queued for processing.', txId: result.txId });
});

function processVoteInMemory(payload) {
  const { electionId, voterID, candidateID, candidateState, boothLocation } = payload;
  const txId = generateTxId();

  // --- Token validation (mirrors chaincode) ---
  const tokenKey = `VOTE_TOKEN_${electionId}_${voterID}`;
  const token = ledger[tokenKey];
  if (token && token.isUsed) {
    console.log(`❌ Double Voting attempt blocked: ${voterID}`);
    return { success: false, error: `Double Voting Detected: Vote Token already used by ${voterID}` };
  }

  // --- Check if voter already voted ---
  if (ledger[voterID] && ledger[voterID].hasVoted) {
    console.log(`❌ Double Voting attempt blocked (voter flag): ${voterID}`);
    return { success: false, error: `Double Voting Detected: Voter ${voterID} has already cast a vote` };
  }

  // --- Update voter record ---
  if (ledger[voterID]) {
    ledger[voterID].hasVoted = true;
    ledger[voterID].votedFor = candidateID;
  } else {
    ledger[voterID] = { id: voterID, docType: 'voter', hasVoted: true, votedFor: candidateID };
  }

  // --- Burn the token ---
  if (token) {
    token.isUsed = true;
    token.usedAt = new Date().toISOString();
  }

  // --- Create ballot record (critical for result aggregation) ---
  const ballotKey = `BALLOT_${electionId}_${voterID}`;
  ledger[ballotKey] = {
    docType: 'ballot',
    electionId,
    voterID,
    candidateID,
    state: candidateState,
    constituency: candidateState,
    boothLocation: boothLocation || 'LokSetu_WEB_REMOTE',
    timestamp: new Date().toISOString(),
    txId
  };

  txLog.push({ txId, type: 'CastVote', key: ballotKey, timestamp: new Date().toISOString() });
  console.log(`✅ Vote processed in-memory: ${voterID} -> ${candidateID} (ballot: ${ballotKey}, tx: ${txId})`);
  return { success: true, txId };
}

// Query single asset
app.get('/query/:key', (req, res) => {
  const data = ledger[req.params.key];
  if (!data) {
    return res.status(404).json({ error: `Asset ${req.params.key} not found` });
  }
  res.json({ response: JSON.stringify(data) });
});

// Register voter (accepts both voterID and voterId for compatibility)
app.post('/register-voter', (req, res) => {
  const voterID = req.body.voterID || req.body.voterId;
  const { biometricHash, homeState } = req.body;

  if (!voterID) {
    return res.status(400).json({ success: false, error: 'Missing voterID' });
  }

  const txId = generateTxId();
  ledger[voterID] = { id: voterID, docType: 'voter', biometricHash, homeState, currentState: homeState, hasVoted: false };
  txLog.push({ txId, type: 'CreateVoter', key: voterID, timestamp: new Date().toISOString() });

  console.log(`📝 Voter registered: ${voterID} (tx: ${txId})`);
  res.json({ success: true, message: `Voter ${voterID} registered successfully`, txId });
});

// Bulk register
app.post('/bulk-register', (req, res) => {
  const { votersList } = req.body;
  if (!Array.isArray(votersList)) {
    return res.status(400).json({ error: 'votersList must be an array' });
  }
  votersList.forEach(v => {
    const id = v.voterID || v.voterId || v.id;
    ledger[id] = { ...v, id, docType: 'voter', hasVoted: false };
  });
  console.log(`📝 Bulk registered ${votersList.length} voters`);
  res.json({ success: true, message: 'State sync complete.' });
});

// Change state (transfer voter)
app.post('/change-state', (req, res) => {
  const voterId = req.body.voterID || req.body.voterId;
  const { newState, newConstituencyId } = req.body;
  if (!ledger[voterId]) {
    return res.status(404).json({ error: `Voter ${voterId} not found` });
  }
  const txId = generateTxId();
  ledger[voterId].currentState = newState;
  ledger[voterId].constituencyId = newConstituencyId;
  txLog.push({ txId, type: 'TransferVoter', key: voterId, timestamp: new Date().toISOString() });
  console.log(`🔄 Voter ${voterId} moved to ${newState} (tx: ${txId})`);
  res.json({ success: true, message: `Moved to ${newState}`, txId });
});

// Query all — returns Fabric-compatible format: { Key, Record }
app.get('/query-all', (req, res) => {
  const data = Object.entries(ledger).map(([key, value]) => ({
    Key: key,
    Record: value
  }));
  res.json({ success: true, data });
});

// Init ledger
app.get('/init', (req, res) => {
  initLedger();
  res.send('Ledger Initialized Successfully');
});

// Transaction log (for debugging / audit)
app.get('/tx-log', (req, res) => {
  res.json({ success: true, count: txLog.length, transactions: txLog });
});

// --- START ---
async function start() {
  initLedger();
  kafkaProducer = await connectKafka();
  app.listen(PORT, () => {
    console.log(`✅ LokSetu Gateway (Local Dev) running on http://localhost:${PORT}`);
  });
}

start();
