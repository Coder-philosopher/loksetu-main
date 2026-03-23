import { Request, Response, NextFunction } from 'express';

/**
 * Structured error class for API responses
 */
export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Global error handler — catches all unhandled errors from routes
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  // Log server errors
  if (statusCode >= 500) {
    console.error(`[ERROR] ${code}: ${message}`, err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: code,
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${_req.method} ${_req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Request validation helper
 */
export function validateRequired(body: any, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}
