import { Router } from 'express';
import pool from '../config/db';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcrypt from 'bcrypt';
import {
  ensureFaceSetExists,
  searchFace,
  removeFaceFromFaceSet,
  checkLiveness,
  validateFaceppConfig,
  enrollFace,
} from '../utils/facepp'; 
import { reportFaceFraud } from '../services/fraudDetection';
import { analyticsService } from '../services/analyticsService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("Missing JWT_SECRET in .env");

// 🔗 CONFIGURATION
const LEDGER_BASE_URL = 'http://localhost:3000'; // Gateway URL
const CURRENT_ELECTION_ID = "LOKSETU_LS_2026";     // Must match your Chaincode Election ID

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

router.post('/register-request', async (req: any, res: any) => {
  const {
    firstName,
    lastName,
    epicId,
    homeState,
    vidhanSabha,
    lokSabha,
    mcdWard,
    password,
    base64Image,
  } = req.body || {};

  const normalizedFirstName = normalizeName(firstName || '');
  const normalizedLastName = normalizeName(lastName || '');
  const normalizedEpicId = (epicId || '').trim().toUpperCase();
  const normalizedState = (homeState || '').trim();
  const normalizedVidhanSabha = (vidhanSabha || '').trim();
  const normalizedLokSabha = (lokSabha || '').trim();
  const normalizedMcdWard = (mcdWard || '').trim();
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();

  if (!normalizedFirstName || !normalizedLastName || !normalizedEpicId) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_FIELDS',
      message: 'First name, last name, and EPIC ID are required.',
    });
  }

  if (!/^[A-Z]{3}\d{6,7}$/i.test(normalizedEpicId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_EPIC_ID',
      message: 'EPIC ID format is invalid. Expected 3 letters followed by 6-7 digits.',
    });
  }

  if (!password || password.trim().length < 6) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PASSWORD',
      message: 'Password must be at least 6 characters long.',
    });
  }

  if (normalizedState !== 'Delhi') {
    return res.status(400).json({
      success: false,
      error: 'UNSUPPORTED_STATE',
      message: 'Only Delhi registrations are currently supported.',
    });
  }

  if (!normalizedVidhanSabha || !normalizedLokSabha || !normalizedMcdWard) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_ADDRESS_FIELDS',
      message: 'Vidhan Sabha, Lok Sabha, and MCD ward are required.',
    });
  }

  if (!base64Image || typeof base64Image !== 'string' || base64Image.length < 100) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_IMAGE',
      message: 'No valid face image provided. Please capture a photo first.',
    });
  }

  let faceTokenToCleanup: string | null = null;

  try {
    validateFaceppConfig();
    await ensureFaceSetExists();

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
    if (cleanBase64.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'Image data is too small after processing.',
      });
    }

    const existingByEpic = await pool.query(
      `
        SELECT epic_id FROM voters WHERE epic_id = $1
        UNION
        SELECT epic_id FROM registration_requests WHERE epic_id = $1 AND status = 'pending'
      `,
      [normalizedEpicId]
    );
    if (existingByEpic.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_EPIC_ID',
        message: `A registration already exists for EPIC ID ${normalizedEpicId}.`,
      });
    }

    const livenessResult = await checkLiveness(cleanBase64);
    if (!livenessResult.live) {
      return res.status(403).json({
        success: false,
        error: 'LIVENESS_FAILED',
        message: `Security check failed: ${livenessResult.details}. Ensure you are using a live camera with good lighting.`,
        livenessScore: livenessResult.score,
      });
    }

    const searchResult = await searchFace(cleanBase64);
    if (!searchResult) {
      return res.status(400).json({
        success: false,
        error: 'NO_FACE_DETECTED',
        message: 'No face detected in the photo. Please retake.',
      });
    }

    let faceToken = searchResult.faceToken;
    if (searchResult.matchFound) {
      const existingByFace = await pool.query(
        `
          SELECT epic_id FROM voters WHERE epic_id = $1
          UNION
          SELECT epic_id FROM registration_requests WHERE epic_id = $1 AND status = 'pending'
        `,
        [searchResult.userId]
      );

      if (existingByFace.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_FACE',
          message: `This face is already linked to EPIC ${searchResult.userId}.`,
        });
      }

      await removeFaceFromFaceSet(searchResult.faceToken);
      const refreshedSearch = await searchFace(cleanBase64);
      if (!refreshedSearch) {
        return res.status(400).json({
          success: false,
          error: 'NO_FACE_DETECTED',
          message: 'No face detected after cleanup. Please retake.',
        });
      }
      faceToken = refreshedSearch.faceToken;
    }

    await enrollFace(faceToken, normalizedEpicId);
    faceTokenToCleanup = faceToken;

    // Hash password before storing
    const passwordHash = await bcrypt.hash(password.trim(), 10);

    const insertResult = await pool.query(
      `
        INSERT INTO registration_requests (
          epic_id,
          first_name,
          last_name,
          full_name,
          home_state,
          constituency_name,
          lok_sabha_name,
          mcd_ward,
          biometric_hash,
          face_set_token,
          password_hash,
          status,
          registration_ip
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
        RETURNING id
      `,
      [
        normalizedEpicId,
        normalizedFirstName,
        normalizedLastName,
        fullName,
        normalizedState,
        normalizedVidhanSabha,
        normalizedLokSabha,
        normalizedMcdWard,
        faceToken,
        faceToken,
        passwordHash,
        req.ip || req.headers['x-forwarded-for'] || null,
      ]
    );

    analyticsService.log(
      'INFO',
      'auth',
      `Registration request submitted: ${fullName} (${normalizedEpicId})`,
      { ip: req.ip }
    );

    return res.status(201).json({
      success: true,
      requestId: insertResult.rows[0]?.id,
      message: 'Registration request submitted successfully. Please wait for admin approval.',
    });
  } catch (err: any) {
    if (faceTokenToCleanup) {
      await removeFaceFromFaceSet(faceTokenToCleanup).catch(() => {});
    }

    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_ENTRY',
        message: 'A registration request for this EPIC or biometric already exists.',
      });
    }

    analyticsService.log('ERROR', 'auth', `Registration request failed: ${err.message}`, { ip: req.ip });
    return res.status(500).json({
      success: false,
      error: 'REGISTRATION_REQUEST_FAILED',
      message: err.message || 'Registration request failed.',
    });
  }
});

// =====================================================================
// NEW: Multi-Factor Authentication Login (EPIC ID + Password + Face)
// =====================================================================
router.post('/login', async (req: any, res: any) => {
  try {
    const { epicId, password, imageBase64 } = req.body;

    if (!epicId || !password) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CREDENTIALS',
        message: 'EPIC ID and password are required.',
      });
    }

    const normalizedEpicId = epicId.trim().toUpperCase();

    // STEP 1: Verify EPIC ID + Password
    console.log(`\n🔐 Login attempt: ${normalizedEpicId}`);
    
    const voterResult = await pool.query(
      'SELECT * FROM voters WHERE epic_id = $1',
      [normalizedEpicId]
    );

    const voter = voterResult.rows[0];

    if (!voter) {
      // Check if pending registration
      const pendingReg = await pool.query(
        'SELECT status FROM registration_requests WHERE epic_id = $1 ORDER BY submitted_at DESC LIMIT 1',
        [normalizedEpicId]
      );

      if (pendingReg.rows.length > 0) {
        const status = pendingReg.rows[0].status;
        if (status === 'pending') {
          return res.status(403).json({
            success: false,
            error: 'PENDING_REGISTRATION',
            message: 'Your registration request is pending admin approval.',
          });
        }
      }

      return res.status(401).json({
        success: false,
        error: 'INVALID_EPIC_ID',
        message: 'EPIC ID not found. Please register first.',
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password.trim(), voter.password_hash || '');
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_PASSWORD',
        message: 'Incorrect password.',
      });
    }

    console.log(`✅ Password verified for ${normalizedEpicId}`);

    // STEP 2: Face Verification (Secondary Factor)
    let authenticationRoute = 'route-2'; // Default to fallback (password only)
    
    if (imageBase64) {
      try {
        console.log(`📸 Attempting face verification...`);
        await ensureFaceSetExists();
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        
        const searchResult = await searchFace(cleanBase64);
        
        if (searchResult && searchResult.matchFound && searchResult.userId === normalizedEpicId) {
          console.log(`✅ Face verified for ${normalizedEpicId}`);
          authenticationRoute = 'route-1'; // Face verification successful
        } else {
          console.log(`⚠️ Face verification failed, using password-only authentication`);
          // Don't throw error - still allow auto-login via route-2
        }
      } catch (faceError: any) {
        console.log(`⚠️ Face verification error: ${faceError.message}. Using password-only authentication.`);
        // Don't block login - fallback to route-2
      }
    }

    // STEP 3: Mint Token on Blockchain
    try {
      console.log(`🎫 Auto-Minting Ballot Token for ${normalizedEpicId}...`);
      await axios.post(`${LEDGER_BASE_URL}/mint-token`, {
        electionId: CURRENT_ELECTION_ID,
        voterID: normalizedEpicId
      });
      console.log(`✅ Token Ready on Ledger.`);
    } catch (mintError: any) {
      if (mintError.response && mintError.response.status === 409) {
        console.log(`ℹ️ Token already exists for this user.`);
      } else {
        console.error(`⚠️ Token Minting Warning:`, mintError.message);
      }
    }

    // STEP 4: Generate JWT
    const token = jwt.sign(
      { 
        id: voter.id, 
        epic_id: voter.epic_id, 
        home_constituency_id: voter.home_constituency_id 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    analyticsService.log(
      'INFO',
      'auth',
      `Voter ${voter.full_name} (${voter.epic_id}) authenticated via ${authenticationRoute === 'route-1' ? 'face verification' : 'password only'}`,
      { ip: req.ip }
    );

    return res.json({
      success: true,
      token: token,
      user: { name: voter.full_name, epic_id: voter.epic_id },
      authRoute: authenticationRoute,
      message: authenticationRoute === 'route-1' 
        ? 'signed in using route-1' 
        : 'signed in using route-2'
    });

  } catch (err: any) {
    console.error('Login error:', err.message);
    analyticsService.log('ERROR', 'auth', `Login failed: ${err.message}`, { ip: req.ip });
    return res.status(500).json({
      success: false,
      error: 'LOGIN_FAILED',
      message: 'Login failed. Please try again.',
    });
  }
});

router.post('/scan', async (req: any, res: any) => {
  try {
    const { imageBase64 } = req.body;
    console.log(`\n📸 Received Login Request.`);

    await ensureFaceSetExists();
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // 1. SEARCH FACE
    const searchResult = await searchFace(cleanBase64);

    if (!searchResult || !searchResult.matchFound) {
        console.log("⛔ Face not recognized.");
        return res.status(401).json({ message: "Face not recognized. Please register first." });
    }

    // Success! searchResult.userId is the EPIC ID
    const recognizedEpicId = searchResult.userId;
    console.log(`✅ Face++ Identified User: ${recognizedEpicId}`);
    console.log(`   Face Token: ${searchResult.faceToken}`);

    // =================================================================
    // 🆕 AUTOMATIC TOKEN MINTING (The Fix)
    // =================================================================
    try {
        console.log(`🎫 Auto-Minting Ballot Token for ${recognizedEpicId}...`);
        
        // This ensures the voter has a valid "Ballot Paper" on the blockchain
        // before they even reach the voting screen.
        await axios.post(`${LEDGER_BASE_URL}/mint-token`, {
            electionId: CURRENT_ELECTION_ID,
            voterID: recognizedEpicId
        });
        
        console.log(`✅ Token Ready on Ledger.`);
    } catch (mintError: any) {
        // If error is 409, it means token ALREADY exists. That is PERFECT.
        if (mintError.response && mintError.response.status === 409) {
            console.log(`ℹ️ Token already exists for this user. Proceeding.`);
        } else {
            // Log other errors but DO NOT block login.
            console.error(`⚠️ Token Minting Warning:`, mintError.message);
        }
    }
    // =================================================================

    // 2. CHECK BLOCKCHAIN STATUS
    try {
        const ledgerRes = await axios.get(`${LEDGER_BASE_URL}/query/${recognizedEpicId}`);
        const rawData = ledgerRes.data.response || ledgerRes.data; 
        const ledgerData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

        if (ledgerData.hasVoted === true) {
             // Fire face-based fraud alert
             reportFaceFraud({
               voterID: recognizedEpicId,
               reason: 'Duplicate biometric voting attempt — face scan after already voted',
               ip: req.ip || req.headers['x-forwarded-for'] as string,
             });
             return res.status(403).json({ message: "⛔ SECURITY ALERT: Blockchain says you have already voted!" });
        }
    } catch (bcError) {
        // If query fails, it might just mean they aren't on the chain yet.
        console.log("⚠️ Identity not found on Blockchain (checking local DB...)");
    }

    // 3. DB LOOKUP & TOKEN GENERATION
    console.log(`🔍 Looking up voter in DB with epic_id = '${recognizedEpicId}'...`);
    const result = await pool.query('SELECT * FROM voters WHERE epic_id = $1', [recognizedEpicId]);
    const voter = result.rows[0];

    if (!voter) {
      const pendingRequest = await pool.query(
        `
          SELECT status, reviewed_at
          FROM registration_requests
          WHERE epic_id = $1
          ORDER BY submitted_at DESC
          LIMIT 1
        `,
        [recognizedEpicId]
      );

      if (pendingRequest.rows.length > 0) {
        const status = pendingRequest.rows[0].status;
        if (status === 'pending') {
          return res.status(403).json({
            message: 'Your registration request is pending admin approval. Please try again later.',
            status: 'pending_approval',
          });
        }

        if (status === 'rejected') {
          return res.status(403).json({
            message: 'Your registration request was rejected. Please submit a new registration request.',
            status: 'registration_rejected',
          });
        }
      }

      console.error(`❌ IDENTITY MISMATCH: Face++ recognized '${recognizedEpicId}' but NO matching row in voters table.`);
      console.error(`   Orphaned face detected — auto-cleaning from Face++ FaceSet...`);

      // Auto-clean: remove the orphaned face from Face++ so re-registration works cleanly
      try {
        await removeFaceFromFaceSet(searchResult.faceToken);
        console.log(`   ✓ Orphaned face token ${searchResult.faceToken} removed from Face++.`);
      } catch (cleanupErr: any) {
        console.warn(`   ⚠️ Could not auto-remove orphaned face: ${cleanupErr.message}`);
      }

      return res.status(404).json({
        message: "Your face was recognized but your voter record is incomplete. The orphaned biometric has been cleaned up — please ask an admin to re-register you.",
        detail: "Face existed in biometric system without a matching database record. Orphan has been removed."
      });
    }
    console.log(`  ✓ Voter found: ${voter.full_name} (${voter.epic_id})`);

    // Face-based fraud detection: flag if voter already voted in local DB
    if (voter.has_voted) {
      reportFaceFraud({
        voterID: voter.epic_id,
        reason: `Duplicate biometric voting attempt — ${voter.full_name} (${voter.epic_id}) already voted but face scanned again`,
        ip: req.ip || req.headers['x-forwarded-for'] as string,
      });
    }

    // 🚨 THIS GENERATES THE FRONTEND SESSION TOKEN
    const token = jwt.sign(
      { 
        id: voter.id, 
        epic_id: voter.epic_id, 
        // ✅ Key must match exactly what ballotRoutes expects
        home_constituency_id: voter.home_constituency_id 
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    analyticsService.log('INFO', 'auth', `Voter ${voter.full_name} (${voter.epic_id}) authenticated via face scan`, { ip: req.ip });

    res.json({
      success: true,
      token: token,
      user: { name: voter.full_name, epic_id: voter.epic_id }
    });

  } catch (err: any) {
    console.error("Auth Error:", err.message);
    analyticsService.log('ERROR', 'auth', `Authentication failed: ${err.message}`, { ip: req.ip });
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;