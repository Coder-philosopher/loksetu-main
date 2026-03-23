import axios from 'axios';
import FormData from 'form-data';

const getApiKey = () => process.env.FACEPP_API_KEY;
const getApiSecret = () => process.env.FACEPP_API_SECRET;
// Face++ outer_id only accepts [a-zA-Z0-9_-], so sanitize the env value
const getFaceSetOuterId = () => {
    const raw = process.env.FACEPP_FACESET_TOKEN || 'LokSetu_voters_faceset';
    return raw.replace(/[^a-zA-Z0-9_-]/g, '');
};
const BASE_URL = 'https://api-us.faceplusplus.com/facepp/v3';

/** Validate that Face++ env vars are present. Throws if missing. */
export const validateFaceppConfig = () => {
    const missing: string[] = [];
    if (!getApiKey()) missing.push('FACEPP_API_KEY');
    if (!getApiSecret()) missing.push('FACEPP_API_SECRET');
    if (missing.length > 0) {
        throw new Error(`Face++ config missing: ${missing.join(', ')}. Check your .env file.`);
    }
    console.log(`🔑 Face++ config OK | FaceSet outer_id: '${getFaceSetOuterId()}'`);
};

// Helper: Sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Basic Request (Throttled)
const makeRequest = async (endpoint: string, params: any) => {
    await sleep(1200); // 1.2s Throttle

    const form = new FormData();
    form.append('api_key', getApiKey());
    form.append('api_secret', getApiSecret());
    for (const key in params) {
        form.append(key, params[key]);
    }

    try {
        const response = await axios.post(`${BASE_URL}${endpoint}`, form, {
            headers: { ...form.getHeaders() }
        });
        return response.data;
    } catch (error: any) {
        throw new Error(error.response?.data?.error_message || error.message);
    }
};

/**
 * 1. INITIALIZE (Use outer_id)
 */
export const ensureFaceSetExists = async () => {
    const outerId = getFaceSetOuterId();
    try {
        console.log(`⚙️ Ensuring FaceSet '${outerId}' exists...`);
        await makeRequest('/faceset/create', { 
            outer_id: outerId, 
            display_name: 'LokSetu Voters'
        });
        console.log("✅ New FaceSet Created.");
        await sleep(2000); 
    } catch (error: any) {
        if (error.message.includes('FACESET_EXIST')) {
            console.log("✅ FaceSet already exists.");
            return;
        }
        // If the outer_id itself was rejected, this is a config problem — propagate it
        if (error.message.includes('BAD_ARGUMENTS')) {
            throw new Error(`FaceSet outer_id '${outerId}' rejected by Face++. Check FACEPP_FACESET_TOKEN in .env.`);
        }
        console.warn("⚠️ FaceSet Init Warning:", error.message);
    }
};

/**
 * 2. NEW: LIVENESS CHECK (Quality Analysis)
 * Returns true if the image is high quality (likely real), false if suspicious.
 */
/**
 * 2. UPDATED: STRICTER LIVENESS CHECK
 * Checks Quality + Blur to detect screens.
 */
export const checkLiveness = async (base64Image: string): Promise<{ live: boolean; score: number; details: string }> => {
    if (!getApiKey() || !getApiSecret()) {
        throw new Error('FACEPP_API_KEY or FACEPP_API_SECRET not set in .env');
    }

    try {
        const res = await makeRequest('/detect', {
            image_base64: base64Image,
            return_attributes: 'facequality,blur,headpose,eyestatus' 
        });

        if (!res.faces || res.faces.length === 0) {
            return { live: false, score: 0, details: 'No face detected in image' };
        }

        if (res.faces.length > 1) {
            return { live: false, score: 10, details: 'Multiple faces detected — single face required' };
        }

        const face = res.faces[0];
        const quality = face.attributes?.facequality?.value ?? 0;
        const blur = face.attributes?.blur?.blurness?.value ?? 100;
        const headpose = face.attributes?.headpose || {};
        const eyestatus = face.attributes?.eyestatus || {};

        // Head pose: reject extreme angles (likely spoofing or screen at angle)
        const yawAngle = Math.abs(headpose.yaw_angle || 0);
        const pitchAngle = Math.abs(headpose.pitch_angle || 0);

        console.log(`🔍 LIVENESS -> Quality: ${quality} | Blur: ${blur} | Yaw: ${yawAngle.toFixed(1)}° | Pitch: ${pitchAngle.toFixed(1)}°`);

        let score = 100;
        const issues: string[] = [];

        // Quality check
        if (quality < 40) {
            return { live: false, score: 5, details: 'Image quality too low (possible screen capture)' };
        }
        if (quality < 70) {
            score -= 30;
            issues.push('low quality');
        }

        // Blur check
        if (blur > 20) {
            return { live: false, score: 10, details: 'Image too blurry' };
        }
        if (blur > 10) {
            score -= 20;
            issues.push('slight blur');
        }

        // Head pose check
        if (yawAngle > 45 || pitchAngle > 35) {
            return { live: false, score: 15, details: 'Extreme head angle — face the camera directly' };
        }
        if (yawAngle > 25 || pitchAngle > 20) {
            score -= 15;
            issues.push('head angled');
        }

        const passed = score >= 50;
        return {
            live: passed,
            score,
            details: passed
                ? `Liveness passed (score: ${score})`
                : `Liveness failed: ${issues.join(', ')} (score: ${score})`
        };
    } catch (error: any) {
        const msg = error.message || '';
        if (msg.includes('IMAGE_ERROR')) {
            throw new Error(`IMAGE_FORMAT_ERROR: ${msg}`);
        }
        console.error("Liveness Check Failed (API Error):", error);
        return { live: false, score: 0, details: 'Liveness API error' };
    }
};
/**
 * 3. SEARCH FACE (Use outer_id)
 */
export const searchFace = async (base64Image: string) => {
    // Note: We do a basic detect here just to get the token for searching
    const detectRes = await makeRequest('/detect', { image_base64: base64Image });
    if (!detectRes.faces || detectRes.faces.length === 0) return null;
    
    const faceToken = detectRes.faces[0].face_token;

    try {
        const searchRes = await makeRequest('/search', {
            face_token: faceToken,
            outer_id: getFaceSetOuterId(),
            return_result_count: 1
        });

        if (searchRes.results && searchRes.results.length > 0) {
            const match = searchRes.results[0];
            if (match.confidence > 80) {
                return { matchFound: true, faceToken: match.face_token, userId: match.user_id };
            }
        }
        return { matchFound: false, faceToken: faceToken };

    } catch (e: any) {
        if (e.message.includes('EMPTY_FACESET') || e.message.includes('INVALID_FACESET')) {
            return { matchFound: false, faceToken: faceToken };
        }
        throw e;
    }
};

/**
 * 4. ENROLL FACE (Use outer_id)
 */
export const enrollFace = async (faceToken: string, userId: string, retries = 3) => {
    try {
        console.log(`📝 Enrolling face into '${getFaceSetOuterId()}'...`);
        
        await makeRequest('/faceset/addface', {
            outer_id: getFaceSetOuterId(),
            face_tokens: faceToken
        });

        await makeRequest('/face/setuserid', {
            face_token: faceToken,
            user_id: userId
        });

    } catch (error: any) {
        if (error.message.includes('INVALID_FACESET') && retries > 0) {
            console.log("⏳ FaceSet syncing. Retrying...");
            await sleep(2000);
            return enrollFace(faceToken, userId, retries - 1);
        }
        throw error;
    }
};

/**
 * 5. REMOVE FACE from FaceSet (for orphan cleanup)
 */
export const removeFaceFromFaceSet = async (faceToken: string) => {
    try {
        console.log(`🗑️ Removing face ${faceToken.substring(0, 12)}... from FaceSet '${getFaceSetOuterId()}'`);
        await makeRequest('/faceset/removeface', {
            outer_id: getFaceSetOuterId(),
            face_tokens: faceToken
        });
        console.log('  ✓ Face removed from FaceSet');
    } catch (error: any) {
        console.warn('⚠️ Failed to remove face from FaceSet:', error.message);
    }
};

/**
 * 6. REMOVE ALL FACES from FaceSet (for system reset)
 */
export const removeAllFacesFromFaceSet = async () => {
    try {
        console.log(`🗑️ Removing ALL faces from FaceSet '${getFaceSetOuterId()}'...`);
        await makeRequest('/faceset/removeface', {
            outer_id: getFaceSetOuterId(),
            face_tokens: 'RemoveAllFaceTokens'
        });
        console.log('  ✓ All faces removed from FaceSet');
        return true;
    } catch (error: any) {
        console.warn('⚠️ Failed to remove all faces from FaceSet:', error.message);
        return false;
    }
};