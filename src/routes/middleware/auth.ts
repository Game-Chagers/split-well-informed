import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Extract Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const secret = process.env.JWT_SECRET || 'your_fallback_secret';
    const decoded = jwt.verify(token, secret) as { userId: string };
    
    (req as any).userId = decoded.userId;
    next();
    
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
};