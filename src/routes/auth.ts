/**
 * auth.ts — Authentication Routes
 * Handles user registration, credential login, Google sign-in, profile updates, and session verification.
 */

import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { dbService } from '../db.js';
import { AuthenticatedRequest, verifyToken } from '../middleware/auth.js';
import { JWTPayload, User } from '../types.js';

dotenv.config();

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'salonbook_jwt_secret_key_2026_super_secure_cat002';
const TOKEN_EXPIRY = '7d';

// Helper to generate JWT token
function signUserToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

// Password validation rules: min 6 chars, 1 uppercase, 1 lowercase
function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  return { valid: true };
}

/**
 * POST /api/auth/register
 * Customer registration
 */
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, image, phone } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.',
      });
      return;
    }

    // Password validation
    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      res.status(400).json({
        success: false,
        message: passCheck.message,
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await dbService.users.findOne({ email: normalizedEmail });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // SECURITY: Public registration is always customer role. Admin accounts cannot be created publicly!
    const newUser = await dbService.users.insertOne({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      image: image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
      role: 'customer',
      isBlocked: false,
      phone: phone?.trim() || '',
      createdAt: new Date().toISOString(),
    });

    const token = signUserToken({
      userId: newUser._id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to SalonBook.',
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        image: newUser.image,
        role: newUser.role,
        isBlocked: newUser.isBlocked,
        phone: newUser.phone,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Registration Error:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred during registration. Please try again.',
    });
  }
});

/**
 * POST /api/auth/login
 * Credential Login
 */
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await dbService.users.findOne({ email: normalizedEmail });

    if (!user || !user.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    // Verify blocked status
    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        message: 'Your account has been suspended by the administrator. Please contact support.',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
      return;
    }

    const token = signUserToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Signed in successfully!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isBlocked: user.isBlocked,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Login Error:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred during sign-in. Please try again.',
    });
  }
});

/**
 * POST /api/auth/google
 * Google Authentication Sign-In / Sign-Up
 */
router.post('/google', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, image } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Google authentication requires a valid email.',
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await dbService.users.findOne({ email: normalizedEmail });

    if (user) {
      if (user.isBlocked) {
        res.status(403).json({
          success: false,
          message: 'Your account has been suspended. Please contact administrator.',
        });
        return;
      }
    } else {
      // Create new customer account for Google user
      user = await dbService.users.insertOne({
        name: name || 'SalonBook Guest',
        email: normalizedEmail,
        image: image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        role: 'customer',
        isBlocked: false,
        phone: '',
        createdAt: new Date().toISOString(),
      });
    }

    const token = signUserToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      message: 'Google authentication successful!',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isBlocked: user.isBlocked,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    console.error('Google Auth Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to authenticate with Google.',
    });
  }
});

/**
 * GET /api/auth/me
 * Get currently authenticated user
 */
router.get('/me', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await dbService.users.findOne({ _id: req.user!.userId });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        isBlocked: user.isBlocked,
        phone: user.phone,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve user profile.' });
  }
});

/**
 * PUT /api/auth/profile
 * Profile Management: update name, image, phone
 * Rules:
 *  - Cannot change role or isBlocked!
 *  - Cannot update another user's profile!
 */
router.put('/profile', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, image, phone } = req.body;
    const userId = req.user!.userId;

    const updates: Partial<User> = {};
    if (name && typeof name === 'string') updates.name = name.trim();
    if (image && typeof image === 'string') updates.image = image.trim();
    if (phone !== undefined && typeof phone === 'string') updates.phone = phone.trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: 'No valid profile fields provided for update.' });
      return;
    }

    const updated = await dbService.users.updateOne(userId, updates);
    if (!updated) {
      res.status(404).json({ success: false, message: 'User profile not found.' });
      return;
    }

    const user = await dbService.users.findOne({ _id: userId });

    res.json({
      success: true,
      message: 'Profile updated successfully!',
      user: {
        _id: user!._id,
        name: user!.name,
        email: user!.email,
        image: user!.image,
        role: user!.role,
        isBlocked: user!.isBlocked,
        phone: user!.phone,
        createdAt: user!.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

/**
 * POST /api/auth/logout
 * Clear session cookie
 */
router.post('/logout', (_req: AuthenticatedRequest, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

export default router;
