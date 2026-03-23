/*
 * LokSetu Local Kafka Consumer
 * Processes votes from Kafka queue using in-memory storage (no Fabric required).
 */
const { Kafka } = require('kafkajs');

const kafka = new Kafka({ clientId: 'LokSetu-processor-local', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'LokSetu-vote-group' });

const votes = [];

const startVoteProcessor = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'vote.cast', fromBeginning: false });

  console.log('👷 Kafka Vote Worker (Local Dev) Started...');

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = JSON.parse(message.value.toString());
      console.log(`⚙️  Processing Vote: ${payload.voterID} -> ${payload.candidateID}`);
      votes.push({ ...payload, processedAt: new Date().toISOString() });
      console.log(`✅ Vote processed (total: ${votes.length})`);
    },
  });
};

startVoteProcessor().catch(err => {
  console.error('❌ Consumer failed to start:', err.message);
  console.log('⚠️  Kafka may not be ready yet. Retrying in 5s...');
  setTimeout(() => startVoteProcessor().catch(() => {
    console.error('❌ Consumer failed again. Make sure Kafka is running on port 9092.');
  }), 5000);
});
