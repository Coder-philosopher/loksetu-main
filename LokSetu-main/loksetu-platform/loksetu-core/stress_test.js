/*
 * Member C Tool: Stress Test the Network
 * Usage: node stress_test.js <NUMBER_OF_VOTES>
 */

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

async function main() {
    try {
        const totalVotes = parseInt(process.argv[2]) || 100; // Default to 100 votes
        console.log(`🔥 STARTING STRESS TEST: ${totalVotes} Transactions...`);

        // 1. Setup Network Config
        const ccpPath = path.resolve(__dirname, '..', 'LokSetu-chaincode', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUserV2',
            discovery: { enabled: true, asLocalhost: true }
        });

        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('LokSetu');

        // 2. The Spam Logic
        let successCount = 0;
        let failCount = 0;
        const startTime = Date.now();

        // Generate an array of promises (parallel transactions)
        const transactions = [];
        
        for (let i = 0; i < totalVotes; i++) {
            const randomId = crypto.randomBytes(16).toString('hex');
            
            // Push the transaction promise into the array
            // We use 'submitTransaction' which waits for Orderer consensus
            const p = contract.submitTransaction('CreateVoter', randomId, 'Test-District', 'LoadTest')
                .then(() => {
                    process.stdout.write('.'); // Print dot on success
                    successCount++;
                })
                .catch((err) => {
                    process.stdout.write('x'); // Print x on fail
                    failCount++;
                });
            
            transactions.push(p);
        }

        // 3. Execute All in Parallel
        await Promise.all(transactions);

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        console.log(`\n\n📊 RESULTS:`);
        console.log(`   - Total Time: ${duration.toFixed(2)} seconds`);
        console.log(`   - Throughput: ${(totalVotes / duration).toFixed(2)} TPS (Transactions Per Second)`);
        console.log(`   - Success: ${successCount}`);
        console.log(`   - Failures: ${failCount}`);

        gateway.disconnect();

    } catch (error) {
        console.error(`\n❌ Fatal Error: ${error}`);
    }
}

main();