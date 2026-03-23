import pool from '../config/db';

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

const DELHI_MCD_WARDS = Array.from({ length: 250 }, (_v, i) => `Ward ${String(i + 1).padStart(3, '0')}`);

const normalizeNamePart = (value: string) => value.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
const buildCandidateName = (electionName: string, scopeValue: string, slot: 1 | 2) =>
  `${normalizeNamePart(electionName)}_${normalizeNamePart(scopeValue)}_cand-${slot}`;

const seedDatabase = async () => {
  try {
    console.log("🌱 Seeding LokSetu Database...");

    // 1. Clean Slate (Drop & Recreate Tables)
    // We use CASCADE to remove links between tables automatically
    await pool.query(`
      DROP TABLE IF EXISTS election_results, election_metrics, elections, candidates, voters, registration_requests, constituencies, states CASCADE;
      
      CREATE TABLE states (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL,
          code VARCHAR(10) UNIQUE NOT NULL
      );

      CREATE TABLE constituencies (
          id SERIAL PRIMARY KEY,
          state_id INT REFERENCES states(id),
          name VARCHAR(100) NOT NULL
      );

      CREATE TABLE candidates (
          id SERIAL PRIMARY KEY,
          constituency_id INT REFERENCES constituencies(id),
          name VARCHAR(100) NOT NULL,
          party VARCHAR(100) NOT NULL,
          symbol_url TEXT,
          election_id UUID,
          scope_type VARCHAR(20) DEFAULT 'VS',
          scope_value VARCHAR(100)
      );

      CREATE TABLE voters (
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

      CREATE TABLE registration_requests (
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

          CREATE TABLE elections (
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

          CREATE TABLE election_metrics (
            id SERIAL PRIMARY KEY,
            election_id UUID UNIQUE REFERENCES elections(id) ON DELETE CASCADE,
            total_registered_voters INT DEFAULT 0,
            votes_cast INT DEFAULT 0,
            turnout_percentage DECIMAL(5,2) DEFAULT 0,
            pending_votes INT DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );

          CREATE TABLE election_results (
            id SERIAL PRIMARY KEY,
            election_id UUID REFERENCES elections(id) ON DELETE CASCADE,
            candidate_id INT REFERENCES candidates(id),
            votes_count INT DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
    `);

    // 2. Insert Delhi state only
    const stateRes = await pool.query(`
      INSERT INTO states (name, code)
      VALUES ('Delhi', 'DL')
      RETURNING *;
    `);
    const dlId = stateRes.rows[0].id;

    // 3. Insert all 70 Delhi Vidhan Sabha constituencies
    for (const constituencyName of DELHI_VIDHAN_SABHA_CONSTITUENCIES) {
      await pool.query(
        `INSERT INTO constituencies (state_id, name) VALUES ($1, $2)`,
        [dlId, constituencyName]
      );
    }

    const constRes = await pool.query(`SELECT id, name FROM constituencies WHERE state_id = $1`, [dlId]);
    const ndId = constRes.rows.find((c: any) => c.name === 'New Delhi').id;

    // 4. Insert Candidates (For Member A's Frontend)
    await pool.query(`
      INSERT INTO candidates (constituency_id, name, party, symbol_url)
      VALUES 
        (${ndId}, 'Arvind K.', 'AAP', 'broom.png'),
        (${ndId}, 'Manoj T.', 'BJP', 'lotus.png');
    `);

    // 5. Keep voters and registration requests empty after reset
    await pool.query(`DELETE FROM registration_requests;`);
    await pool.query(`DELETE FROM voters;`);
    await pool.query(`DELETE FROM elections;`);
    await pool.query(`DELETE FROM election_metrics;`);

    // 6. Seed sample elections
    console.log("🗳️  Seeding Elections...");

    const newDelhiVS = constRes.rows.find((c: any) => c.name === 'New Delhi');
    const delhiCanttVS = constRes.rows.find((c: any) => c.name === 'Delhi Cantt');

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const oneDayLater = new Date(now.getTime() + (24 * 60 * 60 * 1000));

    // Sample LS Election
    const lsElectionRes = await pool.query(`
      INSERT INTO elections (name, election_type, state_id, status, description, start_time, end_time, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id
    `, ['Delhi Lok Sabha Elections 2026', 'LS', dlId, 'active', 'General elections for Lok Sabha seats', oneHourAgo, oneDayLater]);

    const lsElectionId = lsElectionRes.rows[0].id;

    // Add metrics for LS election
    await pool.query(
      `
        INSERT INTO election_metrics (election_id, total_registered_voters, votes_cast, turnout_percentage, pending_votes)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [lsElectionId, 1800000, 0, 0.0, 1800000]
    );

    // Auto-generate LS candidates (7 seats x 2 parties)
    for (const seat of DELHI_LOK_SABHA_SEATS) {
      await pool.query(
        `
          INSERT INTO candidates (constituency_id, name, party, symbol_url, election_id, scope_type, scope_value)
          VALUES
            (NULL, $1, 'BJP', 'lotus.png', $2, 'LS', $3),
            (NULL, $4, 'AAP', 'broom.png', $2, 'LS', $3)
        `,
        [
          buildCandidateName('Delhi Lok Sabha Elections 2026', seat, 1),
          lsElectionId,
          seat,
          buildCandidateName('Delhi Lok Sabha Elections 2026', seat, 2),
        ]
      );
    }

    // Sample VS Elections
    const vsElection1Res = await pool.query(`
      INSERT INTO elections (name, election_type, constituency_id, state_id, status, description, start_time, end_time, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, ['New Delhi Vidhan Sabha Elections 2025', 'VS', newDelhiVS.id, dlId, 'completed', 'State assembly elections for New Delhi', new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)), new Date(now.getTime() - (6 * 24 * 60 * 60 * 1000))]);

    await pool.query(`
      INSERT INTO election_metrics (election_id, total_registered_voters, votes_cast, turnout_percentage, pending_votes)
      VALUES ($1, $2, $3, $4, $5)
    `, [vsElection1Res.rows[0].id, 180000, 135000, 75.0, 2000]);

    const vsElection2Res = await pool.query(`
      INSERT INTO elections (name, election_type, constituency_id, state_id, status, description, start_time, end_time, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, ['Delhi Vidhan Sabha Elections 2026', 'VS', delhiCanttVS.id, dlId, 'active', 'State assembly elections for Delhi', oneHourAgo, oneDayLater]);

    const activeVsElectionId = vsElection2Res.rows[0].id;

    // Auto-generate candidates for all VS constituencies in active election
    for (const constituency of constRes.rows) {
      await pool.query(
        `
          INSERT INTO candidates (constituency_id, name, party, symbol_url, election_id, scope_type, scope_value)
          VALUES
            ($1, $2, 'BJP', 'lotus.png', $3, 'VS', $4),
            ($1, $5, 'AAP', 'broom.png', $3, 'VS', $4)
        `,
        [
          constituency.id,
          buildCandidateName('Delhi Vidhan Sabha Elections 2026', constituency.name, 1),
          activeVsElectionId,
          constituency.name,
          buildCandidateName('Delhi Vidhan Sabha Elections 2026', constituency.name, 2),
        ]
      );
    }

    await pool.query(`
      INSERT INTO election_metrics (election_id, total_registered_voters, votes_cast, turnout_percentage, pending_votes)
      VALUES ($1, $2, $3, $4, $5)
    `, [activeVsElectionId, 160000, 0, 0.0, 160000]);

    // Sample MCD Election
    const mcdElectionRes = await pool.query(`
      INSERT INTO elections (name, election_type, mcd_ward, state_id, status, description, start_time, end_time, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, ['MCD Ward 001 Municipal Elections 2026', 'MCD', 'Ward 001', dlId, 'active', 'Municipal corporation elections for Ward 001', oneHourAgo, oneDayLater]);

    const mcdElectionId = mcdElectionRes.rows[0].id;

    for (const ward of DELHI_MCD_WARDS) {
      await pool.query(
        `
          INSERT INTO candidates (constituency_id, name, party, symbol_url, election_id, scope_type, scope_value)
          VALUES
            (NULL, $1, 'BJP', 'lotus.png', $2, 'MCD', $3),
            (NULL, $4, 'AAP', 'broom.png', $2, 'MCD', $3)
        `,
        [
          buildCandidateName('MCD Ward 001 Municipal Elections 2026', ward, 1),
          mcdElectionId,
          ward,
          buildCandidateName('MCD Ward 001 Municipal Elections 2026', ward, 2),
        ]
      );
    }

    await pool.query(`
      INSERT INTO election_metrics (election_id, total_registered_voters, votes_cast, turnout_percentage, pending_votes)
      VALUES ($1, $2, $3, $4, $5)
    `, [mcdElectionId, 5000, 0, 0.0, 5000]);

    console.log("✅ Elections seeded successfully!");
    console.log("✅ Seeding Complete! Users reset. Delhi-only lookup data and sample elections are ready.");
    process.exit();

  } catch (err) {
    console.error("❌ Seeding Failed:", err);
    process.exit(1);
  }
};

seedDatabase();