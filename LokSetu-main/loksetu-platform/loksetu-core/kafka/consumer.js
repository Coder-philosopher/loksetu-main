const { Kafka } = require('kafkajs');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const kafka = new Kafka({ clientId: 'LokSetu-processor', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'LokSetu-vote-group' });

// --- CONFIGURATION ---
const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'LokSetu';

async function getContract() {
    // 1. Correct Path to Connection Profile (server-core/connection-org1.json)
    // __dirname is 'server-core/kafka', so we go up one level '../'
    const ccpPath = path.resolve(__dirname, '../connection-org1.json');
    
    // 2. Correct Path to Wallet (server-core/wallet)
    const walletPath = path.join(__dirname, '../wallet'); 

    console.log(`🔎 Looking for wallet at: ${walletPath}`); // Debug log

    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
    const wallet = await Wallets.newFileSystemWallet(walletPath);
    
    // Check if identity exists
    const identity = await wallet.get('appUserV2');
    if (!identity) {
        throw new Error(`❌ Identity 'appUserV2' not found in wallet at ${walletPath}. Did you run enrollUser.js?`);
    }

    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet, identity: 'appUserV2', 
        discovery: { enabled: true, asLocalhost: true }, asLocalhost: true
    });
    
    const network = await gateway.getNetwork(CHANNEL_NAME);
    const contract = network.getContract(CHAINCODE_NAME);
    return { contract, gateway };
}

const startVoteProcessor = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'vote.cast', fromBeginning: false });

  console.log("👷 Kafka Vote Worker Started...");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const payload = JSON.parse(message.value.toString());
      console.log(`⚙️ Processing Vote: ${payload.voterID}`);

      try {
        const { contract, gateway } = await getContract();
        
        await contract.submitTransaction(
             'CastVote', 
             payload.electionId, 
             payload.voterID, 
             payload.candidateID, 
             payload.candidateState,
             payload.boothLocation
        );
        
        console.log(`✅ Ledger Updated: ${payload.voterID}`);
        await gateway.disconnect();

      } catch (error) {
        console.error(`❌ Ledger Error for ${payload.voterID}:`, error.message);
    
        // Optional: Handle token errors specifically
        if (error.message.includes("Double Voting")) {
            console.error("⚠️ Double Vote Attempt Detected & Blocked.");
        }
      }
    },
  });
};

startVoteProcessor();