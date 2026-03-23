import { Router } from 'express';
import pool from '../config/db';
import { analyticsService } from '../services/analyticsService';

const router = Router();

type ScopeType = 'LS' | 'VS' | 'MCD';

function normalizeScopeType(value?: string): ScopeType {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('lok')) return 'LS';
  if (normalized.includes('mcd')) return 'MCD';
  return 'VS';
}

router.get('/', async (req: any, res: any) => {
  const scopeType = normalizeScopeType(req.query?.type as string | undefined);
  const constituency = req.query?.constituency as string | undefined;

  try {
    console.log(`[candidates] Request type=${scopeType} constituency=${constituency || 'all'}`);

    let result;
    if (constituency) {
      const numericId = Number(constituency);
      const isNumericId = !Number.isNaN(numericId);

      result = scopeType === 'VS' && isNumericId
        ? await pool.query(
            'SELECT id, constituency_id, name, party, symbol_url, scope_type, scope_value FROM candidates WHERE constituency_id = $1 AND scope_type = $2 ORDER BY name ASC',
            [numericId, scopeType]
          )
        : await pool.query(
            'SELECT id, constituency_id, name, party, symbol_url, scope_type, scope_value FROM candidates WHERE scope_type = $1 AND scope_value = $2 ORDER BY name ASC',
            [scopeType, constituency]
          );
    } else {
      result = await pool.query(
        'SELECT id, constituency_id, name, party, symbol_url, scope_type, scope_value FROM candidates WHERE scope_type = $1 ORDER BY scope_value ASC, name ASC',
        [scopeType]
      );
    }

    console.log(`[candidates] Query rows=${result.rows.length}`);

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'No candidates found', candidates: [] });
    }

    return res.json({ success: true, candidates: result.rows });
  } catch (err: any) {
    console.error('[candidates] Error:', err.message);
    analyticsService.log('ERROR', 'candidates', `Candidates query failed: ${err.message}`).catch(() => {});
    return res.status(500).json({ success: false, message: 'Failed to fetch candidates', error: err.message });
  }
});

export default router;
