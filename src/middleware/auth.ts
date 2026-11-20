/**
 * auth.ts — JWT Authentication & Role Authorization Middleware
 * Verifies JWT tokens, blocks banned users, and enforces role access.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { dbService } from '../db.js';
import { JWTPayload, UserRole } from '../types.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'salonbook_jwt_secret_key_2026_super_secure_cat002';

// Extend Express Request to attach user info
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload & { isBlocked?: boolean };
}

/**
 * Verify JWT Token from Authorization header (Bearer token) or Cookies
 */
export async function verifyToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // Check Authorization Header: "Bearer <token>"
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Fallback to cookie
      token = req.cookies.token;
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access denied. No authentication token provided.',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Verify user exists and check blocked status in database
    const userDoc = await dbService.users.findOne({ _id: decoded.userId });
    if (!userDoc) {
      res.status(401).json({
        success: false,
        message: 'User account no longer exists.',
      });
      return;
    }

    // Check if user is blocked
    if (userDoc.isBlocked) {
      res.status(403).json({
        success: false,
        message: 'Your account has been blocked by the administrator. Access denied.',
      });
      return;
    }

    // Attach decoded user to request
    req.user = {
      userId: userDoc._id,
      email: userDoc.email,
      name: userDoc.name,
      role: userDoc.role,
      isBlocked: userDoc.isBlocked,
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Session has expired. Please sign in again.',
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.',
    });
  }
}

/**
 * Role-Based Middleware: Require Admin
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Forbidden. Administrator privileges are required to access this resource.',
    });
    return;
  }

  next();
}

/**
 * Role-Based Middleware: Require Customer
 */
export function requireCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required.' });
    return;
  }

  if (req.user.role !== 'customer') {
    res.status(403).json({
      success: false,
      message: 'This action can only be performed by customer accounts.',
    });
    return;
  }

  next();
}
