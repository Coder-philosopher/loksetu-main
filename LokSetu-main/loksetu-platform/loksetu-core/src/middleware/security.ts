import { Request, Response, NextFunction } from 'express';

/**
 * Simple in-memory rate limiter.
 * In production, use Redis-backed rate limiting.
 */
const ipHitCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(windowMs: number = 60000, maxRequests: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();
    const entry = ipHitCounts.get(ip);

    if (!entry || now > entry.resetTime) {
      ipHitCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
    }

    next();
  };
}

/**
 * IP tracking middleware — logs client IPs for audit
 */
export function ipTracker(pool: any) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      const userAgent = req.headers['user-agent'] || '';
      const action = `${req.method} ${req.path}`;

      // Non-blocking insert
      pool.query(
        'INSERT INTO ip_tracking (ip_address, action, user_agent) VALUES ($1, $2, $3)',
        [ip, action, userAgent]
      ).catch(() => { /* silent — tracking is non-critical */ });
    } catch { /* silent */ }
    next();
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}

// Cleanup old entries periodically (prevent memory leak)
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipHitCounts.entries()) {
    if (now > entry.resetTime) ipHitCounts.delete(ip);
  }
}, 60000);
