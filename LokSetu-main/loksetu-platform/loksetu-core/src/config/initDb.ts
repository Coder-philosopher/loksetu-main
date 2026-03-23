import pool from './db';

const DELHI_VIDHAN_SABHA_CONSTITUENCIES = [
  'Narela', 'Burari', 'Timarpur', 'Adarsh Nagar', 'Badli', 'Rithala', 'Bawana', 'Mundka', 'Kirari', 'Sultanpur Majra',
  'Nangloi Jat', 'Mangol Puri', 'Rohini', 'Shalimar Bagh', 'Shakur Basti', 'Tri Nagar', 'Wazirpur', 'Model Town', 'Sadar Bazar', 'Chandni Chowk',
  'Matia Mahal', 'Ballimaran', 'Karol Bagh', 'Patel Nagar', 'Moti Nagar', 'Madipur', 'Rajouri Garden', 'Hari Nagar', 'Tilak Nagar', 'Janakpuri',
  'Vikaspuri', 'Uttam Nagar', 'Dwarka', 'Matiala', 'Najafgarh', 'Bijwasan', 'Palam', 'Delhi Cantt', 'Rajinder Nagar', 'New Delhi',
  'Jangpura', 'Kasturba Nagar', 'Malviya Nagar', 'R K Puram', 'Mehrauli', 'Chhatarpur', 'Deoli', 'Ambedkar Nagar', 'Sangam Vihar', 'Greater Kailash',
  'Kalkaji', 'Tughlakabad', 'Badarpur', 'Okhla', 'Trilokpuri', 'Kondli', 'Patparganj', 'Laxmi Nagar', 'Vishwas Nagar', 'Krishna Nagar',
  'Gandhi Nagar', 'Shahdara', 'Seemapuri', 'Rohtas Nagar', 'Seelampur', 'Ghonda', 'Babarpur', 'Gokalpur', 'Mustafabad', 'Karawal Nagar',
];

const DELHI_LOK_SABHA_SEATS = [
  'Chandni Chowk',
  'North East Delhi',
  'East Delhi',
  'New Delhi',
  'North West Delhi',
  'West Delhi',
  'South Delhi',
];

const DELHI_MCD_WARDS = ['Ward 001'];

/**
 * Auto-create all required tables if they don't exist.
 * Safe to run on every server start — uses IF NOT EXISTS.
 */
export async function initializeDatabase(): Promise<void> {
  console.log('[DB] Initializing database schema...');

  await pool.query(`
    -- Core election tables
    CREATE TABLE IF NOT EXISTS states (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      code VARCHAR(10) UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS constituencies (
      id SERIAL PRIMARY KEY,
      state_id INT REFERENCES states(id),
      name VARCHAR(100) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      constituency_id INT REFERENCES constituencies(id),
      name VARCHAR(100) NOT NULL,
      party VARCHAR(100) NOT NULL,
      symbol_url TEXT,
      election_id UUID,
      scope_type VARCHAR(20) DEFAULT 'VS',
      scope_value VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS voters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      epic_id VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      home_constituency_id INT REFERENCES constituencies(id),
      biometric_hash TEXT UNIQUE,
      password_hash VARCHAR(255),
      face_set_token VARCHAR(255),
      has_voted BOOLEAN DEFAULT FALSE,
      voted_for_candidate_id INT REFERENCES candidates(id) DEFAULT NULL,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      voted_at TIMESTAMPTZ DEFAULT NULL,
      registration_ip VARCHAR(45) DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS registration_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      epic_id VARCHAR(20) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      home_state VARCHAR(50) NOT NULL DEFAULT 'Delhi',
      constituency_name VARCHAR(100) NOT NULL,
      lok_sabha_name VARCHAR(100) NOT NULL,
      mcd_ward VARCHAR(50) NOT NULL,
      constituency_id INT REFERENCES constituencies(id),
      biometric_hash TEXT UNIQUE NOT NULL,
      password_hash VARCHAR(255),
      face_set_token VARCHAR(255),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ DEFAULT NULL,
      reviewed_by VARCHAR(100) DEFAULT NULL,
      review_notes TEXT DEFAULT NULL,
      registration_ip VARCHAR(45) DEFAULT NULL,
      CONSTRAINT chk_registration_request_status CHECK (status IN ('pending', 'approved', 'rejected'))
    );

    -- Fraud detection & security tables
    CREATE TABLE IF NOT EXISTS fraud_alerts (
      id SERIAL PRIMARY KEY,
      alert_id VARCHAR(50) UNIQUE NOT NULL,
      voter_id VARCHAR(50),
      type VARCHAR(50) NOT NULL,
      severity VARCHAR(10) NOT NULL,
      score INT DEFAULT 0,
      details TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      resolved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Vote audit trail with blockchain hashes
    CREATE TABLE IF NOT EXISTS vote_transactions (
      id SERIAL PRIMARY KEY,
      voter_epic_id VARCHAR(20) NOT NULL,
      election_id UUID,
      candidate_id INT REFERENCES candidates(id),
      tx_hash VARCHAR(100),
      blockchain_timestamp TIMESTAMPTZ,
      booth_location VARCHAR(100),
      ip_address VARCHAR(45),
      blockchain_status VARCHAR(20) DEFAULT 'confirmed',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(voter_epic_id, election_id)
    );

    -- IP tracking for fraud detection
    CREATE TABLE IF NOT EXISTS ip_tracking (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      voter_epic_id VARCHAR(20),
      action VARCHAR(50) NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Chatbot interaction logs
    CREATE TABLE IF NOT EXISTS chatbot_logs (
      id SERIAL PRIMARY KEY,
      session_id VARCHAR(50),
      user_message TEXT NOT NULL,
      bot_response TEXT NOT NULL,
      model_used VARCHAR(50),
      tokens_used INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Election analytics snapshots
    CREATE TABLE IF NOT EXISTS analytics_snapshots (
      id SERIAL PRIMARY KEY,
      total_voters INT DEFAULT 0,
      votes_cast INT DEFAULT 0,
      turnout_percentage DECIMAL(5,2) DEFAULT 0,
      fraud_alerts_count INT DEFAULT 0,
      snapshot_data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- System audit log
    CREATE TABLE IF NOT EXISTS system_logs (
      id SERIAL PRIMARY KEY,
      level VARCHAR(10) NOT NULL DEFAULT 'INFO',
      source VARCHAR(50) NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Elections management
    CREATE TABLE IF NOT EXISTS elections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      election_type VARCHAR(20) NOT NULL,
      constituency_id INT REFERENCES constituencies(id),
      lok_sabha_name VARCHAR(100),
      mcd_ward VARCHAR(50),
      state_id INT REFERENCES states(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      description TEXT,
      scheduled_date TIMESTAMPTZ,
      start_time TIMESTAMPTZ,
      end_time TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT chk_election_type CHECK (election_type IN ('LS', 'VS', 'MCD')),
      CONSTRAINT chk_election_status CHECK (status IN ('pending', 'active', 'completed', 'cancelled'))
    );

    -- Election metrics (votes cast, turnout, pending votes)
    CREATE TABLE IF NOT EXISTS election_metrics (
      id SERIAL PRIMARY KEY,
      election_id UUID UNIQUE REFERENCES elections(id) ON DELETE CASCADE,
      total_registered_voters INT DEFAULT 0,
      votes_cast INT DEFAULT 0,
      turnout_percentage DECIMAL(5,2) DEFAULT 0,
      pending_votes INT DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Election results per candidate
    CREATE TABLE IF NOT EXISTS election_results (
      id SERIAL PRIMARY KEY,
      election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
      candidate_id INT REFERENCES candidates(id),
      votes_count INT DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Add columns to voters if missing (safe migration)
  const migrations = [
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS voted_for_candidate_id INT REFERENCES candidates(id) DEFAULT NULL`,
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS voted_at TIMESTAMPTZ DEFAULT NULL`,
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(45) DEFAULT NULL`,
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
    `ALTER TABLE voters ADD COLUMN IF NOT EXISTS face_set_token VARCHAR(255)`,
    `ALTER TABLE vote_transactions ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(20) DEFAULT 'confirmed'`,
    `ALTER TABLE vote_transactions ADD COLUMN IF NOT EXISTS election_id UUID`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS election_id UUID`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20) DEFAULT 'VS'`,
    `ALTER TABLE candidates ADD COLUMN IF NOT EXISTS scope_value VARCHAR(100)`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS constituency_id INT REFERENCES constituencies(id)`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ DEFAULT NULL`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(100) DEFAULT NULL`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS review_notes TEXT DEFAULT NULL`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
    `ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS face_set_token VARCHAR(255)`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ`,
    `ALTER TABLE elections ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ`,
  ];

  for (const sql of migrations) {
    try { await pool.query(sql); } catch { /* column may already exist */ }
  }

  // Add missing FK/constraints safely for older schemas.
  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'vote_transactions_election_id_fkey'
        ) THEN
          ALTER TABLE vote_transactions
          ADD CONSTRAINT vote_transactions_election_id_fkey
          FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE;
        END IF;
      END
      $$;
    `);
  } catch {
    // Ignore legacy constraint compatibility issues.
  }

  try {
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'vote_transactions_voter_epic_id_election_id_key'
        ) THEN
          ALTER TABLE vote_transactions
          ADD CONSTRAINT vote_transactions_voter_epic_id_election_id_key
          UNIQUE (voter_epic_id, election_id);
        END IF;
      END
      $$;
    `);
  } catch {
    // Ignore if duplicates already exist in legacy data.
  }

  // Create indices after all migrations so legacy schemas don't fail during startup.
  const indexMigrations = [
    `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts(severity)`,
    `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON fraud_alerts(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_type ON fraud_alerts(type)`,
    `CREATE INDEX IF NOT EXISTS idx_vote_tx_voter ON vote_transactions(voter_epic_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vote_tx_election ON vote_transactions(election_id)`,
    `CREATE INDEX IF NOT EXISTS idx_vote_tx_voter_election ON vote_transactions(voter_epic_id, election_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ip_tracking_ip ON ip_tracking(ip_address)`,
    `CREATE INDEX IF NOT EXISTS idx_ip_tracking_created ON ip_tracking(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_voters_epic ON voters(epic_id)`,
    `CREATE INDEX IF NOT EXISTS idx_voters_voted ON voters(has_voted)`,
    `CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON registration_requests(status)`,
    `CREATE INDEX IF NOT EXISTS idx_registration_requests_submitted ON registration_requests(submitted_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_chatbot_created ON chatbot_logs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_elections_status ON elections(status)`,
    `CREATE INDEX IF NOT EXISTS idx_elections_type ON elections(election_type)`,
    `CREATE INDEX IF NOT EXISTS idx_elections_created ON elections(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates(election_id)`,
    `CREATE INDEX IF NOT EXISTS idx_candidates_scope ON candidates(scope_type, scope_value)`,
    `CREATE INDEX IF NOT EXISTS idx_election_results_election ON election_results(election_id)`,
    `CREATE INDEX IF NOT EXISTS idx_election_results_candidate ON election_results(candidate_id)`,
  ];

  for (const sql of indexMigrations) {
    try { await pool.query(sql); } catch { /* ignore index migration issues on legacy data */ }
  }

  console.log('[DB] Ensuring Delhi lookup data...');
  await pool.query(`
    INSERT INTO states (name, code)
    VALUES ('Delhi', 'DL')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
  `);

  const { rows: delhiRows } = await pool.query(`SELECT id FROM states WHERE code = 'DL' LIMIT 1`);
  const delhiStateId = delhiRows[0]?.id;

  if (delhiStateId) {
    for (const constituencyName of DELHI_VIDHAN_SABHA_CONSTITUENCIES) {
      await pool.query(
        `
          INSERT INTO constituencies (state_id, name)
          SELECT $1, $2::varchar(100)
          WHERE NOT EXISTS (
            SELECT 1 FROM constituencies WHERE state_id = $1 AND name = $2::varchar(100)
          )
        `,
        [delhiStateId, constituencyName]
      );
    }
  }
  console.log('[DB] Delhi lookup data ready.');

  const { rows: candidateCountRows } = await pool.query('SELECT COUNT(*)::int as count FROM candidates');
  const candidateCount = candidateCountRows[0]?.count || 0;
  if (candidateCount === 0 && delhiStateId) {
    console.log('[DB] No candidates found. Seeding minimal candidate data...');

    const { rows: newDelhiRows } = await pool.query(
      `SELECT id, name FROM constituencies WHERE state_id = $1 AND name = 'New Delhi' LIMIT 1`,
      [delhiStateId]
    );
    const newDelhiId = newDelhiRows[0]?.id;

    if (newDelhiId) {
      await pool.query(
        `INSERT INTO candidates (constituency_id, name, party, symbol_url, scope_type, scope_value)
         VALUES
           ($1, 'Candidate-New Delhi-1', 'BJP', 'lotus.png', 'VS', 'New Delhi'),
           ($1, 'Candidate-New Delhi-2', 'AAP', 'broom.png', 'VS', 'New Delhi')`,
        [newDelhiId]
      );
    }

    for (const seat of DELHI_LOK_SABHA_SEATS) {
      await pool.query(
        `INSERT INTO candidates (constituency_id, name, party, symbol_url, scope_type, scope_value)
         VALUES
           (NULL, $1, 'BJP', 'lotus.png', 'LS', $2),
           (NULL, $3, 'AAP', 'broom.png', 'LS', $2)`,
        [`Candidate-${seat}-1`, seat, `Candidate-${seat}-2`]
      );
    }

    for (const ward of DELHI_MCD_WARDS) {
      await pool.query(
        `INSERT INTO candidates (constituency_id, name, party, symbol_url, scope_type, scope_value)
         VALUES
           (NULL, $1, 'BJP', 'lotus.png', 'MCD', $2),
           (NULL, $3, 'AAP', 'broom.png', 'MCD', $2)`,
        [`Candidate-${ward}-1`, ward, `Candidate-${ward}-2`]
      );
    }

    console.log('[DB] Minimal candidates seeded.');
  }

  console.log('[DB] Schema initialization complete.');
}
