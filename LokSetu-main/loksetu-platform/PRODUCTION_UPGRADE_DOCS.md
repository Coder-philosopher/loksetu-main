# LokSetu Platform — Production Upgrade Documentation

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         LokSetu Architecture                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────────┐  │
│  │ Admin Client │   │ Voter Client │   │   External Services     │  │
│  │  (React)     │   │  (React)     │   │  ┌───────────────────┐  │  │
│  │  Port: 5173  │   │  Port: 5174  │   │  │ Face++ API        │  │  │
│  └──────┬───────┘   └──────┬───────┘   │  │ OpenAI API        │  │  │
│         │                  │           │  └───────────────────┘  │  │
│         └───────┬──────────┘           └────────────┬────────────┘  │
│                 │                                   │               │
│    ┌────────────▼───────────────────────────────────▼──────────┐    │
│    │              Express.js API Server (Port 8080)            │    │
│    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │    │
│    │  │ Security │ │  Error   │ │   Auth   │ │    Rate     │  │    │
│    │  │ Headers  │ │ Handler  │ │   JWT    │ │   Limiter   │  │    │
│    │  └──────────┘ └──────────┘ └──────────┘ └─────────────┘  │    │
│    │  ┌──────────────────────────────────────────────────────┐ │    │
│    │  │                   API Routes                         │ │    │
│    │  │  /admin  /auth  /ballot  /monitor  /results  /system │ │    │
│    │  │  /chat                                               │ │    │
│    │  └──────────────────────────────────────────────────────┘ │    │
│    │  ┌───────────────────┐  ┌────────────────────────────┐   │    │
│    │  │ Analytics Service │  │  Fraud Detection Service   │   │    │
│    │  │ (DB Persistence)  │  │  (7 AI Engines + DB)       │   │    │
│    │  └───────────────────┘  └────────────────────────────┘   │    │
│    │  ┌───────────────────┐                                   │    │
│    │  │ Blockchain Service│                                   │    │
│    │  │ (Fabric Gateway)  │                                   │    │
│    │  └───────────────────┘                                   │    │
│    └──────────┬──────────────────┬──────────────┬─────────────┘    │
│               │                  │              │                   │
│    ┌──────────▼──────┐ ┌────────▼──────┐ ┌─────▼──────────────┐   │
│    │  PostgreSQL 16  │ │ Apache Kafka  │ │ Hyperledger Fabric │   │
│    │  Port: 5432     │ │ Port: 9092    │ │ Port: 3000         │   │
│    │  (Supabase/     │ │ Topic:        │ │ (gateway-local.js  │   │
│    │   Docker)       │ │ vote.cast     │ │  or server.js)     │   │
│    └─────────────────┘ └───────────────┘ └────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Database Schema

10 tables auto-created by `initDb.ts` on server startup:

| Table | Purpose |
|-------|---------|
| `states` | Indian states/UTs for constituency mapping |
| `constituencies` | Electoral constituencies linked to states |
| `candidates` | Candidates with party, constituency, symbol_url |
| `voters` | Voter records with EPIC ID, face_token, biometric data, voted_at |
| `fraud_alerts` | Persistent storage for all 7 fraud engine alerts |
| `vote_transactions` | Blockchain TX hash audit trail for every vote |
| `ip_tracking` | Request frequency tracking per IP address |
| `chatbot_logs` | AI chatbot conversation persistence |
| `analytics_snapshots` | Point-in-time analytics data snapshots |
| `system_logs` | Application-level audit log entries |

## AI Fraud Detection Logic

The fraud detection system (`fraudDetection.ts`) runs 7 independent engines on every vote event:

1. **Duplicate Attempt Detection** — Checks if the same EPIC ID has already voted. Severity: CRITICAL.
2. **Velocity Anomaly** — Detects abnormally fast voting from the same IP (<10 seconds between votes). Severity: HIGH.
3. **IP Cluster Analysis** — Flags IPs that appear in multiple vote events (>3 from same IP). Severity: MEDIUM.
4. **Bot Detection** — Analyzes behavioral signals (mouse movements, click count, keystrokes, idle time) to detect automated voting. Severity: CRITICAL.
5. **Device Fingerprinting** — Identifies anomalous device characteristics (resolution, timezone, touch capability mismatch). Severity: MEDIUM.
6. **Graph Network Analysis** — Maps relationships between IPs, voter IDs, and device profiles to detect coordinated fraud. Severity: HIGH.
7. **Behavioral AI** — Compares session behavior patterns against expected human interaction thresholds. Severity: HIGH.

Each engine produces a score (0-100) and severity level. Alerts are:
- Stored in-memory for real-time SSE streaming to the admin dashboard
- Persisted to the `fraud_alerts` PostgreSQL table via `analyticsService`
- Grouped by severity in the fraud stats endpoint

## Blockchain Transaction Flow

```
Voter Login ──► Face++ Verification ──► JWT Token Issued
                                              │
                                              ▼
                                     Ballot Page Load
                                     (GET /api/v1/ballot)
                                              │
                                              ▼
                                     Voter Selects Candidate
                                              │
                                              ▼
                              POST /api/v1/ballot/cast
                              ┌───────────────────────────┐
                              │ Step 1: JWT Verification   │
                              │ Step 2: Duplicate Check    │
                              │ Step 3: Blockchain Submit  │
                              │   → submitTransaction()   │
                              │   → Returns TX Hash       │
                              │ Step 4: DB Update          │
                              │   → voters.has_voted=true  │
                              │   → voters.voted_at=NOW()  │
                              │   → Store vote_transaction │
                              │ Step 5: Kafka Publish      │
                              │   → Topic: vote.cast       │
                              │ Step 6: Fraud Analysis      │
                              │   → 7 engines evaluate     │
                              │   → Alerts persisted to DB │
                              │ Step 7: Response            │
                              │   → TX hash to client      │
                              └───────────────────────────┘
```

## Analytics Pipeline

1. **Data Collection**: Every vote, registration, and fraud alert triggers database persistence via `analyticsService`
2. **Real-time Streaming**: SSE endpoint (`/monitor/fraud/stream`) pushes fraud alerts to connected admin clients
3. **Polling**: Admin dashboard polls `/monitor/analytics` every 15-20 seconds for voter stats, constituency breakdown, candidate performance
4. **Aggregation**: Analytics endpoint joins voters, candidates, constituencies tables for real-time computation
5. **Snapshots**: `/api/v1/system/snapshot` POST endpoint captures point-in-time analytics data to `analytics_snapshots` table
6. **Audit Log**: `/monitor/audit-log` provides activity feed with recent registrations, votes, and events

## Chatbot Integration

- **Backend**: `/api/v1/chat` POST endpoint proxies to OpenAI GPT-4o-mini with election-specific system prompt
- **Context**: System prompt includes voter count, constituency count, fraud alert count fetched from DB
- **Persistence**: Each chat interaction is logged to `chatbot_logs` table with session ID, role, content, timestamp
- **Frontend**: Floating chat button in bottom-right corner with message history, quick action prompts, and real-time responses
- **Session Tracking**: Each chat window gets a unique `crypto.randomUUID()` session ID

## Files Created / Modified

### New Backend Files
| File | Purpose |
|------|---------|
| `src/config/initDb.ts` | Auto-creates all 10 database tables with indices on startup |
| `src/middleware/errorHandler.ts` | Global error handler, ApiError class, validateRequired helper |
| `src/middleware/security.ts` | Rate limiter, IP tracker middleware, security headers |
| `src/services/blockchainService.ts` | Modular Hyperledger Fabric gateway interface |
| `src/services/analyticsService.ts` | DB persistence for analytics, fraud, votes, chat, logs |
| `src/routes/systemRoutes.ts` | System logs, transactions, chat history, IP tracking endpoints |

### Modified Backend Files
| File | Changes |
|------|---------|
| `src/index.ts` | Added helmet, morgan, security middleware, rate limiting, DB init, error handlers |
| `src/services/fraudDetection.ts` | Added DB persistence for fraud alerts |
| `src/routes/chatRoutes.ts` | Added chat log persistence, session tracking |
| `src/routes/ballotRoutes.ts` | Added vote transaction storage, voted_at timestamp, fraud alert DB persistence |

### New Frontend Files
| File | Purpose |
|------|---------|
| `client-admin/src/pages/SystemLogs.jsx` | System logs, vote transactions, IP tracking dashboard |

### Modified Frontend Files
| File | Changes |
|------|---------|
| `client-admin/src/App.jsx` | Added SystemLogs import/route/nav, Security Notice page, wired Settings dropdown |
| `client-admin/src/index.css` | Added table utilities, badge variants, btn-danger, btn-ghost, progress bar, status indicators |
| `client-voter/src/pages/VotingBooth.jsx` | Added session timer display, Clock icon |
| `client-voter/src/index.css` | Added gov-card-hover, gov-btn-danger, gov-badge utilities |
| `client-voter/src/App.css` | Cleaned up unused Vite template CSS |
| `client-voter/index.html` | Updated page title |

## Security Measures Implemented

1. **Rate Limiting** — In-memory rate limiter (200 requests/min/IP) with auto-cleanup
2. **Security Headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy
3. **Helmet.js** — Production-grade HTTP header security
4. **IP Tracking** — All request IPs logged to `ip_tracking` table with frequency monitoring
5. **JWT Authentication** — Token-based access control on all ballot/voter endpoints
6. **Input Validation** — `validateRequired` utility for API parameter validation
7. **Error Isolation** — Global error handler prevents stack trace leakage in production
8. **Behavioral Analysis** — Client-side behavioral data (mouse, keyboard, scroll, idle) sent with votes for bot detection
9. **Biometric Liveness** — Face-api.js blink detection prevents photo-based spoofing
10. **Blockchain Immutability** — All votes are immutable once committed to Hyperledger Fabric
