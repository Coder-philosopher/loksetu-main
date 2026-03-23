/*
 * Member C Tool: Register the AI Hash on the Blockchain
 * Usage: node register_face.js <PASTE_YOUR_HASH_HERE>
 */

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

async function main() {
    try {
        // 1. Get the Hash from the command line
        const voterHash = process.argv[2];
        if (!voterHash) {
            console.log('❌ Error: Please provide the Voter Hash from your Python script.');
            console.log('Usage: node register_face.js <HASH>');
            return;
        }

        // 2. Load the Network Config
        const ccpPath = path.resolve(__dirname, '..', 'LokSetu-chaincode', 'test-network', 'organizations', 'peerOrganizations', 'org1.example.com', 'connection-org1.json');
        const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

        // 3. Connect to the Wallet
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const identity = await wallet.get('appUserV3'); // Ensure you have an admin/user enrolled

        if (!identity) {
            console.log('❌ Error: "appUser" identity not found in wallet. Run enrollUser.js first.');
            return;
        }

        // 4. Connect to the Gateway
        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: 'appUserV3',
            discovery: { enabled: true, asLocalhost: true } 
        });

        // 5. Get the Contract
        const network = await gateway.getNetwork('mychannel');
        const contract = network.getContract('LokSetu');

        console.log(`⏳ Registering Voter on Ledger: ${voterHash.substring(0, 10)}...`);

        // 6. Submit Transaction (CreateVoter)
        // Params: ctx, voterId, electionDistrict, homeState
        await contract.submitTransaction('CreateVoter', voterHash, 'Delhi-North', 'Bihar');

        console.log('✅ Success: Voter Identity permanently recorded on the Blockchain.');
        console.log('   - You can now use this face to cast a vote.');

        gateway.disconnect();

    } catch (error) {
        console.error(`❌ Failed to register: ${error}`);
    }
}

main();