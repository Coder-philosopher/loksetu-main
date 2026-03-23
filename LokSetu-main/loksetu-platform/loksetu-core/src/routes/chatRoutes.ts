import { Router } from 'express';
import pool from '../config/db';
import { analyticsService } from '../services/analyticsService';
import crypto from 'crypto';

const router = Router();

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are LokSetu AI Assistant — an intelligent, concise admin helper for the LokSetu Secure Digital Voting Platform.

Key facts about LokSetu:
- Hyperledger Fabric blockchain for immutable vote records
- 7 fraud detection engines: Duplicate Attempt, Velocity Anomaly, IP Clustering, Bot Detection, Device Fingerprinting, Graph Network Analysis, Behavioral AI
- Face++ liveness verification for voter authentication
- Real-time SSE monitoring for fraud alerts
- PostgreSQL database for voter records and analytics
- Kafka for event streaming between services

You can help with:
- Summarizing fraud alerts and detection status
- Explaining election metrics and turnout statistics
- Voter management guidance (onboarding, constituency updates)
- System health and architecture questions
- Best practices for election security

Keep answers concise (2-4 sentences for simple questions). Use bullet points for lists. Do not fabricate live data — if asked for real-time stats, advise the admin to check the Dashboard or Fraud Monitor panels.`;

/**
 * Build the provider list in priority order.
 * Each provider is tried in sequence until one succeeds.
 */
function getProviders(): Array<{ name: string; url: string; key: string; model: string }> {
  const providers: Array<{ name: string; url: string; key: string; model: string }> = [];

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey && openaiKey.length >= 10) {
    providers.push({
      name: 'openai',
      url: OPENAI_API_URL,
      key: openaiKey,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey && groqKey.length >= 10) {
    providers.push({
      name: 'groq',
      url: GROQ_API_URL,
      key: groqKey,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    });
  }

  return providers;
}

/**
 * Call an OpenAI-compatible chat API.
 * Returns { reply, model, tokens } on success, throws on failure.
 */
async function callChatAPI(
  provider: { name: string; url: string; key: string; model: string },
  messages: Array<{ role: string; content: string }>
): Promise<{ reply: string; model: string; tokens: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      const err = new Error(`${provider.name} API error ${response.status}`);
      (err as any).status = response.status;
      (err as any).body = errBody;
      console.error(`[chat] ${provider.name} error ${response.status}:`, errBody.substring(0, 200));
      throw err;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error(`${provider.name} returned empty response`);

    return {
      reply,
      model: provider.model,
      tokens: data.usage?.total_tokens || 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}

router.post('/', async (req: any, res: any) => {
  const { message, history } = req.body;
  const sessionId = req.body.sessionId || crypto.randomBytes(8).toString('hex');

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  let reply: string;
  let modelUsed = 'fallback';
  let tokensUsed = 0;

  const providers = getProviders();

  if (providers.length === 0) {
    console.warn('[chat] No AI API keys configured — using local fallback');
    reply = await getFallbackReply(message);
  } else {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history.slice(-10).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: String(m.content).slice(0, 2000),
      })) : []),
      { role: 'user', content: message.slice(0, 2000) },
    ];

    let succeeded = false;
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        const result = await callChatAPI(provider, messages);
        reply = result.reply;
        modelUsed = result.model;
        tokensUsed = result.tokens;
        succeeded = true;
        console.log(`[chat] ${provider.name} responded (${result.tokens} tokens, model: ${result.model})`);
        break;
      } catch (err: any) {
        const status = err.status || 'unknown';
        errors.push(`${provider.name}:${status}`);

        if (status === 401) {
          console.error(`[chat] ${provider.name}: Invalid API key — check .env`);
        } else if (status === 429) {
          console.warn(`[chat] ${provider.name}: Quota exceeded — trying next provider`);
        } else {
          console.error(`[chat] ${provider.name}: ${err.message}`);
        }
      }
    }

    if (!succeeded) {
      console.error(`[chat] All providers failed: ${errors.join(', ')} — using local fallback`);
      analyticsService.log('WARN', 'chat', `All AI providers failed: ${errors.join(', ')}`, { message: message.substring(0, 100) });
      reply = await getFallbackReply(message);
    }
  }

  // Store chatbot interaction in database (non-blocking)
  analyticsService.storeChatLog({
    sessionId,
    userMessage: message.slice(0, 2000),
    botResponse: reply.slice(0, 5000),
    modelUsed,
    tokensUsed,
  }).catch(() => {});

  return res.json({ reply, sessionId, model: modelUsed });
});

async function getFallbackReply(message: string): Promise<string> {
  const lower = message.toLowerCase();

  // Provide helpful context-aware fallback responses
  if (lower.includes('fraud') || lower.includes('alert') || lower.includes('threat')) {
    try {
      const result = await pool.query(
        `SELECT severity, COUNT(*) as count FROM fraud_alerts WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY severity`
      );
      if (result.rows.length > 0) {
        const summary = result.rows.map(r => `${r.severity}: ${r.count}`).join(', ');
        return `Fraud alert summary (last 24h): ${summary}. Check the Fraud Monitor panel for detailed real-time analysis with all 7 detection engines.`;
      }
    } catch { /* DB not available */ }
    return 'The Fraud Monitor panel shows real-time alerts from all 7 detection engines (Duplicate Attempt, Velocity Anomaly, IP Clustering, Bot Detection, Device Fingerprinting, Graph Network, Behavioral AI). Visit the Fraud Monitor page for live data.';
  }

  if (lower.includes('turnout') || lower.includes('voter') || lower.includes('stat')) {
    try {
      const result = await pool.query('SELECT COUNT(*) as total FROM voters');
      const total = result.rows[0]?.total || 'unknown';
      return `There are ${total} registered voters in the system. Check the Analytics page for detailed turnout statistics, voting trends, and constituency-level breakdowns.`;
    } catch { /* DB not available */ }
    return 'Visit the Analytics page for comprehensive turnout statistics, regional breakdowns, and voting trends. The Dashboard also shows key metrics at a glance.';
  }

  if (lower.includes('health') || lower.includes('status') || lower.includes('system')) {
    return 'System health is displayed on the Dashboard. It monitors: Database connectivity, Kafka event streaming, Hyperledger Fabric blockchain network, and Face++ verification service. Green indicators mean all services are operational.';
  }

  if (lower.includes('blockchain') || lower.includes('fabric') || lower.includes('ledger')) {
    return 'LokSetu uses Hyperledger Fabric for immutable vote recording. Each vote is committed as a blockchain transaction with the voter\'s EPIC ID, candidate selection, and timestamp. The chaincode (smart contract) validates and stores votes on the distributed ledger.';
  }

  if (lower.includes('register') || lower.includes('onboard')) {
    return 'To register a voter: Go to Voter Onboarding, enter their Full Name, EPIC ID, State, and Constituency, then capture a live face photo. The system verifies liveness via Face++ and registers the face biometric for future authentication.';
  }

  if (lower.includes('result') || lower.includes('winner') || lower.includes('election')) {
    return 'Live election results are available on the Results page. It shows real-time vote tallies, leading candidates per constituency, and blockchain-verified vote counts. Results update automatically as new votes are recorded.';
  }

  return 'I\'m the LokSetu AI Assistant. I can help with fraud detection, voter management, election analytics, system monitoring, and blockchain operations. Ask me anything about the platform!';
}

export default router;
