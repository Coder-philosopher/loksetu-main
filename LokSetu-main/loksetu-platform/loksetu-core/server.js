/*
 * Member C: Guardian of Trust
 * Component: API Gateway (server.js)
 * Purpose: The Bridge between the Web and the Blockchain.
 */
console.log("🚨🚨🚨 LokSetu GATEWAY V3: KAFKA EVENT BACKBONE ENABLED 🚨🚨🚨");
const express = require('express');
const cors = require('cors');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// ➕ NEW: Import the Kafka Producer
const { sendVoteToQueue } = require('./kafka/producer');

const app = express();

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- CONFIGURATION ---
const PORT = 3000;
const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'LokSetu';

const ccpPath = path.resolve(__dirname, 'connection-org1.json');
const walletPath = path.join(process.cwd(), 'wallet');
const FABRIC_AVAILABLE = fs.existsSync(ccpPath) && fs.existsSync(walletPath);
const mockGatewayState = {
    voters: new Map(),
    tokens: new Set(),
};

if (!FABRIC_AVAILABLE) {
    console.warn('⚠️ Fabric config missing (connection-org1.json and/or wallet). Gateway running in MOCK mode.');
}

// --- HELPER FUNCTION: CONNECT TO NETWORK ---
async function getContract() {
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: 'appUserV2',
        discovery: { enabled: true, asLocalhost: true },
        asLocalhost: true // Crucial for Docker/Colima
    });

    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);

    return { contract, gateway };
}

// =================================================================
// 🔐 PHASE 1: TOKEN MANAGEMENT (DIRECT - NO QUEUE NEEDED)
// =================================================================

// --- API ENDPOINT: MINT VOTE TOKEN ---
// This remains synchronous because it's an infrequent administrative action
app.post('/mint-token', async (req, res) => {
    try {
        const { electionId, voterID } = req.body;

        if (!electionId || !voterID) {
            return res.status(400).json({ success: false, error: 'Missing electionId or voterID' });
        }

        if (!FABRIC_AVAILABLE) {
            const tokenKey = `${electionId}::${voterID}`;
            if (mockGatewayState.tokens.has(tokenKey)) {
                return res.status(409).json({ success: false, error: 'Vote Token already exists for this voter' });
            }
            mockGatewayState.tokens.add(tokenKey);
            return res.status(200).json({
                success: true,
                message: `Ballot Token generated for ${voterID} (mock mode)`,
                txId: `mock-mint-${Date.now()}`,
                mode: 'mock',
            });
        }

        const { contract, gateway } = await getContract();

        console.log(`\n🎫 MINTING TOKEN: Election ${electionId} for Voter ${voterID}`);

        await contract.submitTransaction('MintVoteToken', electionId, voterID);
        
        console.log('✅ Token Minted on Ledger');
        await gateway.disconnect();

        res.status(200).json({ 
            success: true, 
            message: `Ballot Token generated for ${voterID}` 
        });
    } catch (error) {
        console.error(`❌ Minting Failed: ${error}`);
        const status = error.message.includes('already exists') ? 409 : 500;
        res.status(status).json({ success: false, error: error.message });
    }
});

// =================================================================
// 🚀 PHASE 2: HIGH-THROUGHPUT VOTING (MODIFIED FOR KAFKA)
// =================================================================

// --- API ENDPOINT: CAST VOTE (QUEUED) ---
// Usage: POST http://localhost:3000/cast-vote
app.post('/cast-vote', async (req, res) => {
    try {
        // 1. Destructure all arguments
        const { electionId, voterID, candidateID, candidateState, boothLocation } = req.body;
        
        if (!electionId || !voterID || !candidateID || !candidateState) {
            return res.status(400).json({ error: "Missing required voting fields" });
        }

        if (!FABRIC_AVAILABLE) {
            const tokenKey = `${electionId}::${voterID}`;
            if (!mockGatewayState.tokens.has(tokenKey)) {
                return res.status(403).json({ success: false, error: 'SECURITY VIOLATION: No valid Vote Token found.' });
            }
            mockGatewayState.tokens.delete(tokenKey);
            return res.status(200).json({
                success: true,
                message: 'Vote received and queued for processing. (mock mode)',
                txId: `mock-cast-${Date.now()}`,
                mode: 'mock',
            });
        }

        console.log(`\n📥 INCOMING VOTE: ${voterID} -> Queueing...`);

        // 2. 🔥 SEND TO KAFKA PRODUCER (Instead of blocking on Blockchain)
        // This is instant (~10ms) vs Blockchain (~2000ms)
        await sendVoteToQueue({
            electionId, 
            voterID, 
            candidateID, 
            candidateState, 
            boothLocation
        });

        // 3. ⚡ INSTANT RESPONSE to Client
        // The client gets a "Received" status. The actual mining happens in the background.
        res.status(200).json({ 
            success: true, 
            message: `Vote received and queued for processing.`
        });
        
    } catch (error) {
        console.error(`❌ Queue Failed: ${error}`);
        res.status(500).json({ success: false, error: "System Busy - Queue Unavailable" });
    }
});

// =================================================================
// 🛠 EXISTING UTILITIES (PRESERVED)
// =================================================================

// --- QUERY ASSET ---
app.get('/query/:key', async (req, res) => {
    try {
        const { contract, gateway } = await getContract();
        const result = await contract.evaluateTransaction('ReadVoter', req.params.key);
        res.status(200).json({ response: result.toString() });
        await gateway.disconnect();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- REGISTER VOTER (LEGACY / DIRECT) ---
app.post('/register-voter', async (req, res) => {
    try {
        const { voterId, biometricHash, homeState } = req.body;

        if (!voterId || !biometricHash || !homeState) {
            return res.status(400).json({ success: false, error: 'Missing voterId, biometricHash, or homeState' });
        }

        if (!FABRIC_AVAILABLE) {
            mockGatewayState.voters.set(voterId, { voterId, biometricHash, homeState, createdAt: new Date().toISOString() });
            return res.status(200).json({
                success: true,
                message: `Voter ${voterId} registered successfully (mock mode)`,
                txId: `mock-register-${Date.now()}`,
                mode: 'mock',
            });
        }

        const { contract, gateway } = await getContract(); 
        console.log(`\n--> Registering Voter: ${voterId}`);
        await contract.submitTransaction('CreateVoter', voterId, biometricHash, homeState);
        await gateway.disconnect();
        res.status(200).json({ success: true, message: `Voter ${voterId} registered successfully` });
    } catch (error) {
        console.error(`Failed to register voter: ${error}`);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- BULK REGISTER ---
app.post('/bulk-register', async (req, res) => {
    try {
        const { votersList } = req.body;
        const { contract, gateway } = await getContract();
        console.log(`--> Syncing ${votersList.length} voters...`);
        await contract.submitTransaction('BulkRegisterVoters', JSON.stringify(votersList));
        await gateway.disconnect();
        res.status(200).json({ success: true, message: "State sync complete." });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- MOBILITY CHANGE ---
app.post('/change-state', async (req, res) => {
    try {
        const { voterId, newState, newConstituencyId } = req.body;
        const { contract, gateway } = await getContract();
        console.log(`\n--> Moving ${voterId} to ${newState}`);
        await contract.submitTransaction('TransferVoter', voterId, newState, newConstituencyId);
        await gateway.disconnect();
        res.status(200).json({ success: true, message: `Moved to ${newState}` });
    } catch (error) {
        console.error(`❌ Transfer Failed: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// --- QUERY ALL ---
app.get('/query-all', async (req, res) => {
    try {
        const { contract, gateway } = await getContract();
        const result = await contract.evaluateTransaction('GetAllAssets');
        res.status(200).json({ success: true, data: JSON.parse(result.toString()) });
        await gateway.disconnect();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- INIT LEDGER ---
app.get('/init', async (req, res) => {
    try {
        const { contract, gateway } = await getContract();
        await contract.submitTransaction('InitLedger');
        res.send('Ledger Initialized Successfully');
        await gateway.disconnect();
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.listen(PORT, () => {
    console.log(`✅ LokSetu Gateway running on http://localhost:${PORT}`);
});