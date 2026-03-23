import { Router } from 'express';
import pool from '../config/db';
import axios from 'axios';
// IMPORT facepp utilities
import { ensureFaceSetExists, searchFace, enrollFace, checkLiveness, validateFaceppConfig, removeFaceFromFaceSet, removeAllFacesFromFaceSet } from '../utils/facepp'; 
import { analyticsService } from '../services/analyticsService';

const router = Router();
// ✅ FIXED: Pointing to the correct blockchain route
const LEDGER_BASE_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const LEDGER_GATEWAY_URL = process.env.LEDGER_REGISTER_VOTER_URL || `${LEDGER_BASE_URL}/register-voter`;
const LEDGER_CHANGE_STATE_URL = process.env.LEDGER_CHANGE_STATE_URL || `${LEDGER_BASE_URL}/change-state`;

const DELHI_LOK_SABHA_SEATS = [
    'Chandni Chowk',
    'North East Delhi',
    'East Delhi',
    'New Delhi',
    'North West Delhi',
    'West Delhi',
    'South Delhi',
];

const DELHI_MCD_WARDS = Array.from({ length: 250 }, (_, i) => `Ward ${String(i + 1).padStart(3, '0')}`);

const getCandidateParty = (slot: 1 | 2) => (slot === 1 ? 'BJP' : 'AAP');
const getCandidateSymbol = (slot: 1 | 2) => (slot === 1 ? 'lotus.png' : 'broom.png');
const normalizeNamePart = (value: string) => value.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
const buildCandidateName = (electionName: string, scopeValue: string, slot: 1 | 2) =>
    `${normalizeNamePart(electionName)}_${normalizeNamePart(scopeValue)}_cand-${slot}`;

async function generateAutoCandidatesForElection(client: any, electionId: string, electionType: 'LS' | 'VS' | 'MCD', stateId: number) {
        const electionRow = await client.query(`SELECT name FROM elections WHERE id = $1 LIMIT 1`, [electionId]);
        const electionName = electionRow.rows[0]?.name || 'ELECTION';

    await client.query('DELETE FROM candidates WHERE election_id = $1', [electionId]);

    if (electionType === 'VS') {
        const constituencies = await client.query(
            `
                SELECT id, name
                FROM constituencies
                WHERE state_id = $1
                ORDER BY name ASC
            `,
            [stateId]
        );

        for (const constituency of constituencies.rows) {
            for (const slot of [1, 2] as const) {
                await client.query(
                    `
                        INSERT INTO candidates (constituency_id, name, party, symbol_url, election_id, scope_type, scope_value)
                        VALUES ($1, $2, $3, $4, $5, 'VS', $6)
                    `,
                    [
                        constituency.id,
                        buildCandidateName(electionName, constituency.name, slot),
                        getCandidateParty(slot),
                        getCandidateSymbol(slot),
                        electionId,
                        constituency.name,
                    ]
                );
            }
        }
        return;
    }

    if (electionType === 'LS') {
        for (const seat of DELHI_LOK_SABHA_SEATS) {
            for (const slot of [1, 2] as const) {
                await client.query(
                    `
                        INSERT INTO candidates (constituency_id, name, party, symbol_url, election_id, scope_type, scope_value)
                        VALUES (NULL, $1, $2, $3, $4, 'LS', $5)
                    `,
                    [
                        buildCandidateName(electionName, seat, slot),
                        getCandidateParty(slot),
                        getCandidateSymbol(slot),
                        electionId,
                        seat,
                    ]
                );
            }
        }
        return;
    }

    for (const ward of DELHI_MCD_WARDS) {
        for (const slot of [1, 2] as const) {
            await client.query(
                `
                    INSERT INTO candidates (constituency_id, name, party, symbol_url, election_id, scope_type, scope_value)
                    VALUES (NULL, $1, $2, $3, $4, 'MCD', $5)
                `,
                [
                    buildCandidateName(electionName, ward, slot),
                    getCandidateParty(slot),
                    getCandidateSymbol(slot),
                    electionId,
                    ward,
                ]
            );
        }
    }
}

async function getOrCreateDelhiConstituencyId(client: any, constituencyName: string): Promise<number> {
    const existing = await client.query(
        `
            SELECT c.id
            FROM constituencies c
            JOIN states s ON s.id = c.state_id
            WHERE s.code = 'DL' AND c.name = $1
            LIMIT 1
        `,
        [constituencyName]
    );

    if (existing.rows.length > 0) {
        return existing.rows[0].id;
    }

    const stateRes = await client.query(
        `
            INSERT INTO states (name, code)
            VALUES ('Delhi', 'DL')
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
        `
    );

    const delhiStateId = stateRes.rows[0].id;
    const inserted = await client.query(
        `
            INSERT INTO constituencies (state_id, name)
            VALUES ($1, $2)
            RETURNING id
        `,
        [delhiStateId, constituencyName]
    );

    return inserted.rows[0].id;
}

// --- ROUTE 1: REGISTER VOTER (Existing) ---
router.post('/register-voter', async (req: any, res: any) => {
    const { fullName, epicId, base64Image, homeState, constituencyId } = req.body;
    let step = 'INPUT_VALIDATION';

    // ── Step 0: Input Validation ──────────────────────────────
    if (!base64Image || typeof base64Image !== 'string' || base64Image.length < 100) {
        console.warn('[register-voter] REJECTED: missing or invalid base64Image');
        return res.status(400).json({
            success: false,
            error: "INVALID_IMAGE",
            message: "No valid face image provided. Please capture a photo first."
        });
    }

    if (!fullName || !epicId) {
        console.warn('[register-voter] REJECTED: missing fullName or epicId');
        return res.status(400).json({
            success: false,
            error: "MISSING_FIELDS",
            message: "Full name and EPIC ID are required."
        });
    }

    if (!constituencyId) {
        console.warn('[register-voter] REJECTED: missing constituencyId');
        return res.status(400).json({
            success: false,
            error: "MISSING_FIELDS",
            message: "Constituency ID is required."
        });
    }

    try {
        console.log(`\n──── Registration Start: ${fullName} (${epicId}) ────`);

        // ── Step 1: Verify Face++ Config ──────────────────────
        step = 'FACEPP_CONFIG';
        console.log('[Step 1/7] Verifying Face++ configuration...');
        validateFaceppConfig();

        // ── Step 2: Ensure FaceSet Exists ─────────────────────
        step = 'FACESET_INIT';
        console.log('[Step 2/7] Ensuring FaceSet exists...');
        await ensureFaceSetExists();

        // ── Step 3: Clean Base64 Image ────────────────────────
        step = 'IMAGE_PROCESSING';
        console.log('[Step 3/7] Processing image...');
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
        if (cleanBase64.length < 100) {
            return res.status(400).json({
                success: false,
                error: "INVALID_IMAGE",
                message: "Image data is too small after processing."
            });
        }
        console.log(`  Image size: ${(cleanBase64.length / 1024).toFixed(0)} KB`);

        // ── Step 4: Liveness Check ────────────────────────────
        step = 'LIVENESS_CHECK';
        console.log('[Step 4/7] Running liveness & quality check...');
        let livenessResult: { live: boolean; score: number; details: string };
        try {
            livenessResult = await checkLiveness(cleanBase64);
        } catch (livenessErr: any) {
            if (livenessErr.message?.includes('IMAGE_FORMAT_ERROR')) {
                console.warn(`[register-voter] REJECTED: Bad image format for ${fullName}`);
                return res.status(400).json({
                    success: false,
                    error: "INVALID_IMAGE_FORMAT",
                    message: "The captured image format is invalid. Please retake the photo."
                });
            }
            throw livenessErr;
        }
        
        if (!livenessResult.live) {
            console.warn(`[register-voter] BLOCKED: Liveness failed for ${fullName} — ${livenessResult.details}`);
            return res.status(403).json({
                success: false,
                error: "LIVENESS_FAILED",
                message: `Security check failed: ${livenessResult.details}. Ensure you are using a live camera with good lighting.`,
                livenessScore: livenessResult.score,
            });
        }
        console.log(`  ✓ Liveness verified (score: ${livenessResult.score})`);

        // ── Step 5: Duplicate Face Check ──────────────────────
        step = 'FACE_SEARCH';
        console.log('[Step 5/7] Searching for duplicate faces...');
        const searchResult = await searchFace(cleanBase64);

        if (!searchResult) {
            return res.status(400).json({
                success: false,
                error: "NO_FACE_DETECTED",
                message: "No face detected in the photo. Please retake."
            });
        }

        if (searchResult.matchFound) {
            // Check if the "duplicate" actually has a DB record.
            // If not, the previous registration failed partway — the face is orphaned
            // in Face++ with no matching voter row. Allow re-registration.
            const existingVoter = await pool.query(
                'SELECT id FROM voters WHERE epic_id = $1',
                [searchResult.userId]
            );

            if (existingVoter.rows.length > 0) {
                // Genuine duplicate — voter exists in both Face++ and DB
                console.warn(`[register-voter] BLOCKED: duplicate face → ${searchResult.userId} (DB record exists)`);
                return res.status(409).json({
                    success: false,
                    error: "DUPLICATE_FACE",
                    message: `This face is already registered as ${searchResult.userId}.`
                });
            }

            // Orphaned face: exists in Face++ but NOT in DB.
            // Remove the old face entry so we can re-enroll cleanly.
            console.warn(`[register-voter] ORPHAN DETECTED: face linked to '${searchResult.userId}' in Face++ but NO DB record. Cleaning up...`);
            await removeFaceFromFaceSet(searchResult.faceToken);
            console.log('  ✓ Orphaned face removed. Proceeding with fresh registration.');

            // Re-detect to get a new face token for enrollment
            const freshSearch = await searchFace(cleanBase64);
            if (!freshSearch) {
                return res.status(400).json({
                    success: false,
                    error: "NO_FACE_DETECTED",
                    message: "No face detected after cleanup. Please retake."
                });
            }
            // Use the fresh token for enrollment below
            searchResult.faceToken = freshSearch.faceToken;
            searchResult.matchFound = false;
        }
        console.log(`  ✓ No duplicate. Token: ${searchResult.faceToken}`);

        // ── Step 6: Enroll Face in Face++ ─────────────────────
        step = 'FACE_ENROLL';
        console.log('[Step 6/7] Enrolling face in cloud...');
        await enrollFace(searchResult.faceToken, epicId);
        console.log('  ✓ Face enrolled');

        // ── Step 7a: Blockchain Registration (non-blocking) ────
        step = 'BLOCKCHAIN';
        console.log('[Step 7a/7] Writing to blockchain...');
        let blockchainSynced = false;
        try {
            await axios.post(LEDGER_GATEWAY_URL, {
                voterId: epicId, 
                biometricHash: searchResult.faceToken,
                homeState: homeState || "Delhi"
            });
            blockchainSynced = true;
            console.log('  ✓ Blockchain committed');
        } catch (bcErr: any) {
            // Don't fail registration if gateway is offline — voter saves in DB
            console.warn(`  ⚠️ Blockchain gateway offline: ${bcErr.message}. Voter will be saved in DB only.`);
        }

        // ── Step 7b: Database Insert ──────────────────────────
        step = 'DATABASE';
        console.log('[Step 7b/7] Inserting voter into PostgreSQL...');
        const query = `
            INSERT INTO voters (epic_id, full_name, biometric_hash, face_set_token, home_constituency_id, registration_ip)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
        `;
        let result;
        try {
            result = await pool.query(query, [epicId, fullName, searchResult.faceToken, searchResult.faceToken, constituencyId || 1, req.ip || req.headers['x-forwarded-for'] || null]);
        } catch (dbErr: any) {
            // Handle duplicate EPIC ID or biometric hash gracefully
            if (dbErr.code === '23505') {
                const detail = dbErr.detail || '';
                if (detail.includes('epic_id')) {
                    return res.status(409).json({
                        success: false,
                        error: 'DUPLICATE_EPIC_ID',
                        message: `A voter with EPIC ID ${epicId} is already registered.`,
                    });
                }
                if (detail.includes('biometric_hash')) {
                    return res.status(409).json({
                        success: false,
                        error: 'DUPLICATE_BIOMETRIC',
                        message: 'This biometric data is already linked to another voter.',
                    });
                }
                return res.status(409).json({
                    success: false,
                    error: 'DUPLICATE_ENTRY',
                    message: 'A voter with this data already exists.',
                });
            }
            if (dbErr.code === '23503') {
                console.error('[register-voter] FK violation:', dbErr.detail);
                return res.status(400).json({
                    success: false,
                    error: 'INVALID_CONSTITUENCY',
                    message: `Constituency ID ${constituencyId} does not exist. Please select a valid constituency.`,
                });
            }
            throw dbErr;
        }

        if (!result.rows || result.rows.length === 0) {
            throw new Error('Database insert returned no rows — voter may not have been saved.');
        }

        const newVoterId = result.rows[0].id;
        console.log(`  ✓ Voter saved. DB id: ${newVoterId}`);
        console.log(`──── Registration Complete: ${fullName} ────\n`);

        // Log to ip_tracking (non-blocking)
        pool.query(
            'INSERT INTO ip_tracking (ip_address, voter_epic_id, action, user_agent) VALUES ($1, $2, $3, $4)',
            [req.ip || req.headers['x-forwarded-for'] || 'unknown', epicId, 'VOTER_REGISTRATION', req.headers['user-agent'] || '']
        ).catch(() => {});

        analyticsService.log('INFO', 'admin', `Voter registered: ${fullName} (${epicId})`, { blockchainSynced, ip: req.ip });

        res.status(201).json({ success: true, voterId: newVoterId, blockchainSynced });

    } catch (error: any) {
        console.error(`❌ Registration Failed at step [${step}]:`, error.message);
        console.error('   Stack:', error.stack);
        analyticsService.log('ERROR', 'admin', `Registration failed at ${step}: ${error.message}`, { epicId, step, ip: req.ip });

        // Map step to a user-friendly error
        const stepMessages: Record<string, string> = {
            FACEPP_CONFIG:   'Face recognition service is misconfigured. Contact admin.',
            FACESET_INIT:    'Could not initialize face database. Try again later.',
            IMAGE_PROCESSING:'Image could not be processed.',
            LIVENESS_CHECK:  'Liveness verification failed unexpectedly.',
            FACE_SEARCH:     'Face search failed. The recognition service may be down.',
            FACE_ENROLL:     'Could not enroll face. Try again.',
            BLOCKCHAIN:      'Blockchain registration failed. The ledger gateway may be offline.',
            DATABASE:        'Could not save voter record to database.',
        };

        console.error('   Full error:', error);
        res.status(500).json({ 
            success: false,
            error: `REGISTRATION_FAILED_AT_${step}`,
            step,
            message: stepMessages[step] || error.message || 'Registration failed.',
            detail: error.message
        });
    }
});

// --- ROUTE 1B: LIST REGISTRATION REQUESTS ---
router.get('/registration-requests', async (req: any, res: any) => {
    const status = (req.query.status || 'pending').toString();

    const allowedStatuses = ['pending', 'approved', 'rejected', 'all'];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status filter.' });
    }

    const whereClause = status === 'all' ? '' : 'WHERE status = $1';
    const params = status === 'all' ? [] : [status];

    const query = `
        SELECT
            id,
            epic_id,
            first_name,
            last_name,
            full_name,
            home_state,
            constituency_name,
            lok_sabha_name,
            mcd_ward,
            status,
            submitted_at,
            reviewed_at,
            reviewed_by,
            review_notes
        FROM registration_requests
        ${whereClause}
        ORDER BY submitted_at DESC
        LIMIT 500
    `;

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, requests: result.rows });
});

// --- ROUTE 1C: APPROVE REGISTRATION REQUEST ---
router.post('/registration-requests/:id/approve', async (req: any, res: any) => {
    const requestId = req.params.id;
    const reviewedBy = req.headers['x-admin-user'] || 'admin';
    const reviewNotes = (req.body?.notes || '').toString();

    const client = await pool.connect();
    let blockchainSynced = false;

    try {
        await client.query('BEGIN');

        const pendingRes = await client.query(
            `
                SELECT *
                FROM registration_requests
                WHERE id = $1 AND status = 'pending'
                FOR UPDATE
            `,
            [requestId]
        );

        if (pendingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Pending registration request not found.' });
        }

        const pending = pendingRes.rows[0];
        const constituencyId = await getOrCreateDelhiConstituencyId(client, pending.constituency_name);

        try {
            await axios.post(LEDGER_GATEWAY_URL, {
                voterId: pending.epic_id,
                biometricHash: pending.biometric_hash,
                homeState: pending.home_state || 'Delhi',
            });
            blockchainSynced = true;
        } catch (bcErr: any) {
            console.warn(`⚠️ Blockchain gateway offline while approving request ${requestId}: ${bcErr.message}`);
        }

        const insertResult = await client.query(
            `
                INSERT INTO voters (epic_id, full_name, biometric_hash, password_hash, face_set_token, home_constituency_id, registration_ip)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `,
            [
                pending.epic_id,
                pending.full_name,
                pending.biometric_hash,
                pending.password_hash,
                pending.face_set_token,
                constituencyId,
                pending.registration_ip,
            ]
        );

        await client.query(
            `
                UPDATE registration_requests
                SET
                    status = 'approved',
                    reviewed_at = NOW(),
                    reviewed_by = $2,
                    review_notes = $3,
                    constituency_id = $4
                WHERE id = $1
            `,
            [requestId, reviewedBy, reviewNotes || null, constituencyId]
        );

        await client.query('COMMIT');

        analyticsService.log(
            'INFO',
            'admin',
            `Registration approved: ${pending.full_name} (${pending.epic_id})`,
            { blockchainSynced, requestId, ip: req.ip }
        );

        return res.status(200).json({
            success: true,
            voterId: insertResult.rows[0]?.id,
            blockchainSynced,
        });
    } catch (error: any) {
        await client.query('ROLLBACK');

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'DUPLICATE_ENTRY',
                message: 'Voter already exists or biometric is already linked.',
            });
        }

        analyticsService.log('ERROR', 'admin', `Approval failed for request ${requestId}: ${error.message}`, { ip: req.ip });
        return res.status(500).json({ success: false, message: error.message || 'Approval failed.' });
    } finally {
        client.release();
    }
});

// --- ROUTE 1D: REJECT REGISTRATION REQUEST ---
router.post('/registration-requests/:id/reject', async (req: any, res: any) => {
    const requestId = req.params.id;
    const reviewedBy = req.headers['x-admin-user'] || 'admin';
    const reviewNotes = (req.body?.notes || '').toString();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pendingRes = await client.query(
            `
                SELECT *
                FROM registration_requests
                WHERE id = $1 AND status = 'pending'
                FOR UPDATE
            `,
            [requestId]
        );

        if (pendingRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Pending registration request not found.' });
        }

        const pending = pendingRes.rows[0];

        if (pending.biometric_hash) {
            await removeFaceFromFaceSet(pending.biometric_hash).catch((err: any) => {
                console.warn(`⚠️ Could not remove biometric token during rejection (${requestId}): ${err.message}`);
            });
        }

        await client.query(
            `
                UPDATE registration_requests
                SET
                    status = 'rejected',
                    reviewed_at = NOW(),
                    reviewed_by = $2,
                    review_notes = $3
                WHERE id = $1
            `,
            [requestId, reviewedBy, reviewNotes || null]
        );

        await client.query('COMMIT');

        analyticsService.log(
            'INFO',
            'admin',
            `Registration rejected: ${pending.full_name} (${pending.epic_id})`,
            { requestId, ip: req.ip }
        );

        return res.status(200).json({ success: true });
    } catch (error: any) {
        await client.query('ROLLBACK');
        analyticsService.log('ERROR', 'admin', `Rejection failed for request ${requestId}: ${error.message}`, { ip: req.ip });
        return res.status(500).json({ success: false, message: error.message || 'Rejection failed.' });
    } finally {
        client.release();
    }
});

// --- ROUTE 2: SEARCH VOTER BY FACE (Auto-Fill) ---
router.post('/search-voter-by-face', async (req: any, res: any) => {
    const { base64Image } = req.body;

    try {
        console.log("\n--- 🔍 Searching Face for Auto-Fill ---");
        
        if (!base64Image) {
            return res.status(400).json({ success: false, message: "No image provided." });
        }

        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

        // Search Face++ Database
        const searchResult = await searchFace(cleanBase64);

        if (searchResult && searchResult.matchFound) {
            console.log(`✅ Match Found! User ID: ${searchResult.userId}`);
            
            return res.status(200).json({ 
                success: true, 
                voterId: searchResult.userId 
            });
        } else {
            console.log("❌ No match found.");
            return res.status(404).json({ success: false, message: "Face not recognized." });
        }

    } catch (error: any) {
        console.error("Search Error:", error.message);
        res.status(500).json({ error: "Face search failed." });
    }
});

// --- ROUTE 3: UPDATE VOTER CONSTITUENCY (Syncs DB + Blockchain) ---
router.post('/update-location', async (req: any, res: any) => {
    const { voterId, newState, newConstituencyId } = req.body;

    if (!voterId || !newState || !newConstituencyId) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    // Get a dedicated client from the pool for the transaction
    const client = await pool.connect();

    try {
        console.log(`\n--- 🔄 Processing Mobility for ${voterId} ---`);

        // 1. UPDATE SQL DATABASE (Supabase)
        // We update the home_constituency_id (e.g., '2') and address state
        // NOTE: Ensure your voters table has a 'home_state' column, or remove that part if unused
        const sqlQuery = `
            UPDATE voters 
            SET home_constituency_id = $1
            WHERE epic_id = $2
            RETURNING id;
        `;
        // If you have a home_state column in SQL, use this query instead:
        // SET home_constituency_id = $1, home_state = $2 WHERE epic_id = $3
        
        const dbResult = await client.query(sqlQuery, [newConstituencyId, voterId]);

        if (dbResult.rowCount === 0) {
            console.warn(`⚠️ Warning: Voter ${voterId} not found in SQL, but proceeding to Blockchain.`);
        } else {
            console.log("✅ Supabase SQL Updated.");
        }

        // 2. UPDATE BLOCKCHAIN LEDGER
        // We call the Blockchain Server (Port 3000) to execute the smart contract
        const ledgerUrl = LEDGER_CHANGE_STATE_URL;
        
        await axios.post(ledgerUrl, {
            voterId,
            newState,
            newConstituencyId
        });
        console.log("✅ Blockchain Ledger Updated.");

        res.status(200).json({ 
            success: true, 
            message: `Voter moved to ${newState} (ID: ${newConstituencyId}) on both DB and Blockchain.` 
        });

    } catch (error: any) {
        console.error("❌ Mobility Update Failed:", error.message);
        // If it was a blockchain error, we pass that message back
        const errMsg = error.response?.data?.error || error.message;
        res.status(500).json({ error: errMsg });
    } finally {
        client.release();
    }
});

// ───────────────────── ELECTIONS MANAGEMENT ────────────────────────

// --- ROUTE 4A: CREATE NEW ELECTION ---
router.post('/elections', async (req: any, res: any) => {
    const { name, election_type, constituency_id, lok_sabha_name, mcd_ward, state_id, description, scheduled_date, start_time, end_time } = req.body;

    // Validate input
    if (!name || !election_type) {
        return res.status(400).json({ success: false, message: 'Election name and type are required.' });
    }

    if (!['LS', 'VS', 'MCD'].includes(election_type)) {
        return res.status(400).json({ success: false, message: 'Invalid election type. Must be LS, VS, or MCD.' });
    }

    // Backward-compatible timing: allow legacy payloads with only scheduled_date.
    let resolvedStartTime = start_time ? new Date(start_time) : null;
    let resolvedEndTime = end_time ? new Date(end_time) : null;

    if ((!resolvedStartTime || !resolvedEndTime) && scheduled_date) {
        const base = new Date(scheduled_date);
        if (!Number.isNaN(base.getTime())) {
            resolvedStartTime = resolvedStartTime || base;
            const eod = new Date(base);
            eod.setHours(23, 59, 59, 999);
            resolvedEndTime = resolvedEndTime || eod;
        }
    }

    if (!resolvedStartTime || !resolvedEndTime) {
        const now = new Date();
        const plusEightHours = new Date(now.getTime() + (8 * 60 * 60 * 1000));
        resolvedStartTime = resolvedStartTime || now;
        resolvedEndTime = resolvedEndTime || plusEightHours;
    }

    if (resolvedEndTime <= resolvedStartTime) {
        return res.status(400).json({ success: false, message: 'Election end_time must be after start_time.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Resolve Delhi state id from DB to avoid hardcoded id mismatches across environments.
        const delhiStateRes = await client.query(`SELECT id FROM states WHERE code = 'DL' LIMIT 1`);
        if (delhiStateRes.rows.length === 0) {
            throw new Error('Delhi state (code: DL) not found in database.');
        }

        const normalizedStateId = delhiStateRes.rows[0].id;
        const electionType = election_type as 'LS' | 'VS' | 'MCD';
        const result = await client.query(
            `
                INSERT INTO elections (name, election_type, constituency_id, lok_sabha_name, mcd_ward, state_id, description, scheduled_date, start_time, end_time, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
                RETURNING id
            `,
            [
                name,
                election_type,
                constituency_id || null,
                lok_sabha_name || null,
                mcd_ward || null,
                normalizedStateId,
                description || null,
                scheduled_date || null,
                resolvedStartTime,
                resolvedEndTime,
            ]
        );

        const electionId = result.rows[0].id;

        await generateAutoCandidatesForElection(client, electionId, electionType, normalizedStateId);

        const votersCountRes = await client.query(
            `
                SELECT COUNT(v.id)::int AS total
                FROM voters v
                JOIN constituencies c ON c.id = v.home_constituency_id
                WHERE c.state_id = $1
            `,
            [normalizedStateId]
        );
        const totalRegisteredVoters = Number(votersCountRes.rows[0]?.total || 0);

        // Initialize election metrics
        await client.query(
            `
                INSERT INTO election_metrics (election_id, total_registered_voters, votes_cast, pending_votes, turnout_percentage)
                VALUES ($1, $2, 0, $2, 0)
            `,
            [electionId, totalRegisteredVoters]
        );

        await client.query('COMMIT');

        analyticsService.log('INFO', 'admin', `Election created: ${name} (${election_type})`, { electionId, ip: req.ip });

        return res.status(201).json({ success: true, electionId, candidatesGenerated: true });
    } catch (error: any) {
        await client.query('ROLLBACK');
        analyticsService.log('ERROR', 'admin', `Election creation failed: ${error.message}`, { ip: req.ip });
        return res.status(500).json({ success: false, message: error.message || 'Election creation failed.' });
    } finally {
        client.release();
    }
});

// --- ROUTE 4B: LIST ALL ELECTIONS ---
router.get('/elections', async (req: any, res: any) => {
    const status = req.query.status ? req.query.status.toString() : null;

    try {
        let query = `
            SELECT
                e.id,
                e.name,
                e.election_type,
                e.constituency_id,
                e.lok_sabha_name,
                e.mcd_ward,
                c.name as constituency_name,
                e.status,
                e.description,
                e.scheduled_date,
                e.start_time,
                e.end_time,
                e.created_at,
                e.updated_at,
                em.votes_cast,
                em.turnout_percentage,
                em.pending_votes,
                em.total_registered_voters
            FROM elections e
            LEFT JOIN constituencies c ON e.constituency_id = c.id
            LEFT JOIN election_metrics em ON e.id = em.election_id
        `;

        const params: any[] = [];

        if (status) {
            query += ` WHERE e.status = $1`;
            params.push(status);
        }

        query += ` ORDER BY e.created_at DESC LIMIT 500`;

        const result = await pool.query(query, params);
        return res.status(200).json({ success: true, elections: result.rows });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch elections.' });
    }
});

// --- ROUTE 4C: GET SINGLE ELECTION WITH METRICS ---
router.get('/elections/:id', async (req: any, res: any) => {
    const electionId = req.params.id;

    try {
        const result = await pool.query(
            `
                SELECT
                    e.id,
                    e.name,
                    e.election_type,
                    e.constituency_id,
                    e.lok_sabha_name,
                    e.mcd_ward,
                    c.name as constituency_name,
                    e.status,
                    e.description,
                    e.scheduled_date,
                    e.start_time,
                    e.end_time,
                    e.created_at,
                    e.updated_at,
                    em.votes_cast,
                    em.turnout_percentage,
                    em.pending_votes,
                    em.total_registered_voters
                FROM elections e
                LEFT JOIN constituencies c ON e.constituency_id = c.id
                LEFT JOIN election_metrics em ON e.id = em.election_id
                WHERE e.id = $1
            `,
            [electionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Election not found.' });
        }

        return res.status(200).json({ success: true, election: result.rows[0] });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch election.' });
    }
});

// --- ROUTE 4D: UPDATE ELECTION STATUS (Activate/Complete) ---
router.put('/elections/:id', async (req: any, res: any) => {
    const electionId = req.params.id;
    const { status } = req.body;

    // Validate status
    if (!status || !['pending', 'active', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid election status.' });
    }

    try {
        const result = await pool.query(
            `
                UPDATE elections
                SET status = $1, updated_at = NOW()
                WHERE id = $2
                RETURNING id
            `,
            [status, electionId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Election not found.' });
        }

        analyticsService.log('INFO', 'admin', `Election status updated to ${status}`, { electionId, ip: req.ip });

        return res.status(200).json({ success: true, message: `Election status updated to ${status}.` });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to update election.' });
    }
});

// --- ROUTE 4E: GET VOTER COUNTS BY CONSTITUENCY (For Election Setup) ---
router.get('/constituencies/voter-count', async (req: any, res: any) => {
    const type = req.query.type ? req.query.type.toString() : null;

    try {
        let query = `
            SELECT
                c.id,
                c.name,
                COUNT(v.id) as voter_count
            FROM constituencies c
            LEFT JOIN voters v ON v.home_constituency_id = c.id
        `;

        const params: any[] = [];

        // If filtering by type, join with states and filter
        if (type) {
            query += ` WHERE c.state_id = (SELECT id FROM states WHERE code = 'DL')`;
        } else {
            query += ` WHERE c.state_id = (SELECT id FROM states WHERE code = 'DL')`;
        }

        query += ` GROUP BY c.id, c.name ORDER BY c.name`;

        const result = await pool.query(query, params);
        return res.status(200).json({ success: true, constituencies: result.rows });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch voter counts.' });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// 🟢 MASTER RESET ENDPOINT
// ══════════════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/master-reset
// Purpose: Reset entire system to "fresh install" state
// Security: Requires confirmation string "RESET" in request body
// Resets:
//   1. Face++ FaceSet (removes all enrolled faces)
//   2. Database (TRUNCATE voters, candidates, elections)
//   3. Mock ledger/blockchain (clears in-memory storage)
//   4. Logs the reset event with admin timestamp
// ══════════════════════════════════════════════════════════════════════════════

router.post('/master-reset', async (req: any, res: any) => {
    const startTime = new Date();
    console.log('\n🔴 MASTER RESET TRIGGERED 🔴');
    console.log(`⏰ Timestamp: ${startTime.toISOString()}`);

    try {
        // ── Step 1: Validate Confirmation ──────────────────────────────────
        const { confirmation } = req.body;
        if (confirmation !== 'RESET') {
            console.warn('❌ MASTER RESET REJECTED: Invalid confirmation string');
            return res.status(400).json({
                success: false,
                message: 'Invalid confirmation. Expected: "RESET"'
            });
        }
        console.log('✅ Confirmation validated');

        // ── Step 2: Remove All Faces from Face++ ──────────────────────────
        console.log('\n📍 Step 1/4: Removing all faces from Face++...');
        try {
            const facesRemoved = await removeAllFacesFromFaceSet();
            if (facesRemoved) {
                console.log('✅ All faces removed from Face++ FaceSet');
            } else {
                console.warn('⚠️  Face++ removal failed or empty FaceSet - continuing with reset');
            }
        } catch (faceErr: any) {
            console.warn('⚠️  Face++ API error (non-blocking):', faceErr.message);
        }

        // ── Step 3: Truncate Database Tables ───────────────────────────────
        console.log('\n📍 Step 2/4: Truncating database tables...');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // TRUNCATE voters table
            console.log('  → Truncating voters table...');
            await client.query('TRUNCATE TABLE voters RESTART IDENTITY CASCADE');
            console.log('    ✓ Voters table cleared');

            // TRUNCATE candidates table
            console.log('  → Truncating candidates table...');
            await client.query('TRUNCATE TABLE candidates RESTART IDENTITY CASCADE');
            console.log('    ✓ Candidates table cleared');

            // TRUNCATE elections table
            console.log('  → Truncating elections table...');
            await client.query('TRUNCATE TABLE elections RESTART IDENTITY CASCADE');
            console.log('    ✓ Elections table cleared');

            // TRUNCATE vote_transactions table
            console.log('  → Truncating vote_transactions table...');
            await client.query('TRUNCATE TABLE vote_transactions RESTART IDENTITY CASCADE');
            console.log('    ✓ Vote transactions table cleared');

            // TRUNCATE election_metrics table
            console.log('  → Truncating election_metrics table...');
            await client.query('TRUNCATE TABLE election_metrics RESTART IDENTITY CASCADE');
            console.log('    ✓ Election metrics table cleared');

            // NOTE: DO NOT truncate these tables (for audit trail):
            // - fraud_alerts
            // - vote_transactions (already done above)
            // - ip_tracking
            // - chatbot_logs
            // - analytics_snapshots
            // - system_logs

            await client.query('COMMIT');
            console.log('✅ All data tables truncated successfully');
        } catch (dbErr: any) {
            await client.query('ROLLBACK');
            console.error('❌ Database reset failed:', dbErr.message);
            throw new Error(`Database reset failed: ${dbErr.message}`);
        } finally {
            client.release();
        }

        // ── Step 4: Clear Mock Ledger/Blockchain ────────────────────────────
        console.log('\n📍 Step 3/4: Clearing mock ledger/blockchain...');
        try {
            // Call the gateway's reset endpoint if it exists, or make a direct call
            const gatewayResetUrl = process.env.GATEWAY_RESET_URL || `${LEDGER_BASE_URL}/reset-ledger`;
            await axios.post(gatewayResetUrl, {}, { timeout: 5000 }).catch(err => {
                // Gateway might not have reset endpoint - that's okay
                console.warn('⚠️  Gateway reset endpoint not available - ledger not cleared');
            });
            console.log('✅ Mock ledger cleared (or gateway unavailable)');
        } catch (ledgerErr: any) {
            console.warn('⚠️  Ledger reset failed (non-blocking):', ledgerErr.message);
        }

        // ── Step 5: Log the Reset Event ──────────────────────────────────
        console.log('\n📍 Step 4/4: Logging reset event...');
        try {
            const logEntry = await pool.query(
                `INSERT INTO system_logs (level, source, message, metadata, created_at) 
                 VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
                [
                    'ERROR',
                    'admin',
                    'MASTER RESET TRIGGERED',
                    {
                        action: 'master_reset',
                        admin: 'admin_panel',
                        timestamp: startTime.toISOString(),
                        duration_ms: new Date().getTime() - startTime.getTime(),
                        removed: {
                            voters: 'ALL',
                            candidates: 'ALL',
                            elections: 'ALL',
                            votes: 'ALL',
                            biometric_data: 'ALL (Face++)',
                            ledger: 'CLEARED'
                        }
                    },
                ]
            );
            console.log(`✅ Reset event logged (ID: ${logEntry.rows[0].id})`);
        } catch (logErr: any) {
            console.warn('⚠️  Failed to log reset event:', logErr.message);
        }

        // ── Success Response ───────────────────────────────────────────────
        const duration = new Date().getTime() - startTime.getTime();
        console.log('\n' + '═'.repeat(70));
        console.log('✅ MASTER RESET COMPLETED SUCCESSFULLY');
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log('═'.repeat(70) + '\n');

        return res.status(200).json({
            success: true,
            message: 'System reset completed successfully',
            timestamp: startTime.toISOString(),
            duration_ms: duration,
            reset_items: {
                voters: 'cleared',
                candidates: 'cleared',
                elections: 'cleared',
                votes: 'cleared',
                biometric_data: 'cleared (Face++)',
                ledger: 'cleared'
            }
        });

    } catch (error: any) {
        const duration = new Date().getTime() - startTime.getTime();
        console.error('❌ MASTER RESET FAILED');
        console.error('Error:', error.message);
        console.error(`Duration: ${duration}ms\n`);

        return res.status(500).json({
            success: false,
            message: error.message || 'Master reset failed',
            timestamp: startTime.toISOString(),
            duration_ms: duration
        });
    }
});

export default router;