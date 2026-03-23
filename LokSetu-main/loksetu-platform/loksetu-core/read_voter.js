/*
 * Member C Tool: Verify Voter Existence on Ledger
 * Usage: node read_voter.js <HASH>
 */

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        const voterHash = process.argv[2];
        if (!voterHash) {
            console.log('❌ Usage: node read_voter.js <HASH>');
            return;
        }

        // 1. Setup Same Configs as Register
        const ccpPath = path.resolve(__dirname, '..', 'LokSetu-chaincode', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        // 2. Connect
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUserV2', 
            discovery: { enabled: true, asLocalhost: true } 
        });

        // 3. Get Contract
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('LokSetu'); // Correct name confirmed!

        console.log(`🔎 Searching Ledger for Identity: ${voterHash.substring(0, 10)}...`);

        // 4. Evaluate Transaction (Read-Only, so it's faster)
        const result = await contract.evaluateTransaction('ReadVoter', voterHash);
        
        console.log(`\n✅ VOTER FOUND:`);
        console.log(JSON.parse(result.toString()));

        gateway.disconnect();

    } catch (error) {
        console.error(`❌ Voter NOT Found: ${error.message}`);
    }
}

main();