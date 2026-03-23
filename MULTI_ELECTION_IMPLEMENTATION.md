# Multi-Election Voting System Implementation

## Overview
Implemented a complete multi-election voting system that allows:
- Multiple concurrent elections
- Per-election voting constraints (one vote per voter per election)
- Time-based election windows (start_time and end_time)
- Election-specific candidate filtering
- Dashboard showing all active elections to the voter

## Database Schema Changes

### 1. Elections Table Enhancement
**File**: `loksetu-core/src/config/initDb.ts`

Added two new timestamp columns:
```sql
ALTER TABLE elections ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ
ALTER TABLE elections ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ
```

**Purpose**: Define the exact time window when voting is allowed for each election

### 2. Vote Transactions Table Fix
**File**: `loksetu-core/src/config/initDb.ts`

Added critical changes:
```sql
-- Add election_id reference
ALTER TABLE vote_transactions ADD COLUMN IF NOT EXISTS election_id UUID

-- Add unique constraint to enforce per-election voting
UNIQUE(voter_epic_id, election_id)

-- Added indices for performance
CREATE INDEX idx_vote_tx_election ON vote_transactions(election_id);
CREATE INDEX idx_vote_tx_voter_election ON vote_transactions(voter_epic_id, election_id);
```

**Purpose**: 
- Link each vote to a specific election
- Enforce that a voter can only vote once per election (not globally)
- Enable efficient lookups for per-election voting validation

## Backend API Changes

### 1. Updated getActiveElection() Function
**File**: `loksetu-core/src/routes/ballotRoutes.ts`

```typescript
async function getActiveElection(stateId: number) {
  return pool.query(`
    SELECT id, election_type, name, status, start_time, end_time
    FROM elections
    WHERE status = 'active' 
      AND state_id = $1
      AND NOW() BETWEEN start_time AND end_time
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1
  `);
}
```

**Changes**:
- Now checks if current time is between `start_time` and `end_time`
- Returns timing information for UI display
- Only returns truly "active" elections that are within voting window

### 2. Updated /ballot/cast Endpoint
**File**: `loksetu-core/src/routes/ballotRoutes.ts`

**Key Changes**:
- Now requires `election_id` in request body
- Validates election is active AND within time window
- Checks per-election voting: `SELECT FROM vote_transactions WHERE voter_epic_id = ? AND election_id = ?`
- Rejects with "You have already voted in this election" if vote exists
- Stores `election_id` in vote_transactions table
- Sends `election_id` to blockchain gateway

**Validation Flow**:
```
Step 1: Validate election exists and is active
Step 2: Validate election is within start_time and end_time
Step 3: Check if voter already voted in THIS election
Step 4: Validate candidate belongs to this election
Step 5: Validate voter is eligible (scope validation)
Step 6: Submit to blockchain
Step 7: Record vote in vote_transactions with election_id
```

### 3. New /ballot/elections/active Endpoint
**File**: `loksetu-core/src/routes/ballotRoutes.ts`

Returns voter profile and all active elections:
```json
{
  "voter": {
    "epicId": "...",
    "name": "...",
    "state": "...",
    "hasPassword": true,
    "hasFaceSetToken": true
  },
  "elections": [
    {
      "id": "election-uuid",
      "name": "...",
      "election_type": "VS|LS|MCD",
      "status": "active",
      "start_time": "2026-03-23T10:00:00Z",
      "end_time": "2026-03-23T18:00:00Z",
      "description": "...",
      "hasVoted": false
    }
  ]
}
```

**Purpose**: Shows voter all elections they can participate in and their voting status

### 4. Updated Admin Routes
**File**: `loksetu-core/src/routes/adminRoutes.ts`

**Election Creation**:
- Now requires `start_time` and `end_time` in request
- Validates both are provided before creating election
- Stores timing information in database

**Election Queries**:
- Updated `GET /admin/elections` to include `start_time` and `end_time`
- Updated `GET /admin/elections/:id` to include timing fields

## Frontend Implementation

### 1. New Dashboard Component
**File**: `client-voter/src/pages/Dashboard.jsx`

**Features**:
- Shows voter profile with name, EPIC ID, and state
- Displays all active elections with full details
- Shows election status (Open/Voted)
- Shows time remaining for each election
- Vote Now button per election
- Displays security badges (Password Set, Face Verified)

**Layout**:
```
Header with LokSetu branding and logout
  ↓
Voter Profile Card (Name, EPIC ID, State, Security Status)
  ↓
Active Elections Grid (3-column responsive)
  - Election name and type
  - Time remaining
  - Vote Now button
  - Voted/Open status badge
  ↓
Empty state message if no elections
```

### 2. New Election-Specific Vote Page
**File**: `client-voter/src/pages/ElectionVote.jsx`

**Features**:
- Parameterized route: `/vote/:electionId`
- Shows election-specific candidates only
- Session timeout (5 minutes)
- Behavioral tracking for fraud detection
- Displays vote confirmation with transaction ID
- Auto-redirect to dashboard after successful vote

**Key Logic**:
- Filters candidates to show only those for selected election
- Sends `election_id` in vote casting request
- Handles all per-election voting logic
- Shows security information and blockchain status

### 3. Updated App Router
**File**: `client-voter/src/App.jsx`

Added new routes:
```javascript
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/vote/:electionId" element={<ElectionVote />} />
```

Maintained legacy route:
```javascript
<Route path="/vote" element={<Vote />} />  // Generic voting booth
```

### 4. Login Redirect Updated
**File**: `client-voter/src/pages/Login.jsx`

Changed successful login redirect from `/vote` to `/dashboard`

```javascript
// Old: setTimeout(() => navigate("/vote"), 2000);
// New: setTimeout(() => navigate("/dashboard"), 2000);
```

## Complete Voting Flow

### Voter Perspective:
```
1. Login with credentials
   ↓
2. Navigate to Dashboard
   ↓
3. See all active elections
   ↓
4. Check voting status per election
   ↓
5. Click "Vote Now" for desired election
   ↓
6. Redirected to election-specific voting page
   ↓
7. Select candidate from filtered list
   ↓
8. Confirm vote (passes election_id to backend)
   ↓
9. Vote recorded on blockchain
   ↓
10. Success message + redirect to dashboard
   ↓
11. Dashboard shows "Already Voted" for that election
   ↓
12. Can vote in other elections if available
```

### Backend Validation:
```
For each vote attempt:
1. Election exists? ✓
2. Election is active? ✓
3. Current time is within voting window? ✓
4. Voter hasn't voted yet in THIS election? ✓
5. Candidate belongs to THIS election? ✓
6. Voter is eligible for THIS election scope? ✓
→ RECORD VOTE with election_id
→ Send to blockchain with election_id
→ Update election_metrics for THIS election
```

## Database Queries

### Check if Voter Can Vote in Election:
```sql
SELECT id FROM vote_transactions 
WHERE voter_epic_id = ? AND election_id = ?
```

If returns 0 rows → voter can vote
If returns 1+ row → voter already voted

### Get Active Elections for Voter:
```sql
SELECT * FROM elections
WHERE state_id = ? 
  AND status = 'active'
  AND NOW() BETWEEN start_time AND end_time
ORDER BY start_time DESC
```

### Get Candidates for Election:
```sql
SELECT * FROM candidates
WHERE election_id = ?
  AND scope_type = ? 
  AND scope_value = ?
```

## Migration Path for Existing Data

The implementation uses safe migrations:
```sql
ALTER TABLE IF NOT EXISTS ... ADD COLUMN IF NOT EXISTS ...
```

Existing elections without `start_time` and `end_time`:
- Can be updated via `/admin/elections/:id` endpoint
- Or via direct SQL: `UPDATE elections SET start_time = NOW() WHERE start_time IS NULL`

Existing votes:
- Remain valid (no `election_id` for old votes, but new votes require it)
- Historical analysis possible if needed

## Security Considerations

1. **Per-Election Constraints**: UNIQUE(voter_epic_id, election_id) enforces one vote per voter per election
2. **Time Windows**: Database enforces voting only within `start_time` to `end_time`
3. **Scope Validation**: Each voter can only vote for candidates in their election scope
4. **Blockchain Integration**: Each vote includes election_id for ledger tracking
5. **Fraud Detection**: Behavioral tracking and fraud analysis per election

## Testing Checklist

- [ ] Create an election with start_time and end_time
- [ ] Set election status to "active"
- [ ] Login as voter
- [ ] Verify Dashboard shows election
- [ ] Click "Vote Now"
- [ ] Verify correct candidates shown
- [ ] Cast vote
- [ ] Verify vote recorded with election_id
- [ ] Verify "You have already voted" on second attempt
- [ ] Create second election
- [ ] Verify voter can vote in second election
- [ ] Verify vote counts separate per election

## API Examples

### Create Election with Timing:
```bash
POST /admin/elections
{
  "name": "Delhi Vidhan Sabha 2026",
  "election_type": "VS",
  "state_id": 1,
  "description": "Elections for Delhi Legislative Assembly",
  "start_time": "2026-03-23T10:00:00Z",
  "end_time": "2026-03-23T18:00:00Z"
}
```

### Activate Election:
```bash
PUT /admin/elections/:id
{ "status": "active" }
```

### Get Active Elections (Voter):
```bash
GET /ballot/elections/active
Authorization: Bearer <token>
```

### Cast Vote:
```bash
POST /ballot/cast
Authorization: Bearer <token>
{
  "candidate_id": 123,
  "election_id": "uuid-...",
  "sessionDuration": 45000,
  "behavioral": { ... }
}
```

## Files Modified/Created

### Backend Modified:
1. `loksetu-core/src/config/initDb.ts` - Schema updates
2. `loksetu-core/src/routes/ballotRoutes.ts` - Voting logic and new endpoint
3. `loksetu-core/src/routes/adminRoutes.ts` - Election creation/update with timing

### Frontend Created:
1. `client-voter/src/pages/Dashboard.jsx` - New
2. `client-voter/src/pages/ElectionVote.jsx` - New

### Frontend Modified:
1. `client-voter/src/App.jsx` - New routes
2. `client-voter/src/pages/Login.jsx` - Redirect to dashboard

## Benefits

1. **Scalability**: Support unlimited concurrent elections without voter conflicts
2. **Time Management**: Elections can have defined voting windows
3. **Voter Control**: Voters see all elections they're eligible for
4. **Data Integrity**: UNIQUE constraint prevents double-voting per election
5. **Blockchain Ready**: Each vote linked to specific election on ledger
6. **User Experience**: Clear dashboard showing election status and time remaining
7. **Audit Trail**: Complete history of per-election voting
