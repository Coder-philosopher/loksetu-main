import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'LokSetu_super_secret_key';

// This expands the Express Request to include 'user'
export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  // Token usually comes as "Bearer <token_string>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied: No Token Provided" });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified; // Attach user info (id, constituency) to the request
    next(); // Pass to the next handler (Voting)
  } catch (err) {
    res.status(403).json({ message: "Invalid Token" });
  }
};