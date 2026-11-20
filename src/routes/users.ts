/**
 * users.ts — Admin User Management Routes
 * Allows administrators to view registered customers and block/unblock accounts.
 */

import { Router, Response } from 'express';
import { dbService } from '../db.js';
import { AuthenticatedRequest, verifyToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/users
 * Admin: View all registered customers
 */
router.get('/', verifyToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await dbService.users.find();

    // Sanitize user list: hide passwords
    const sanitized = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      isBlocked: u.isBlocked,
      phone: u.phone,
      createdAt: u.createdAt,
    }));

    res.json({
      success: true,
      count: sanitized.length,
      data: sanitized,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve user list.' });
  }
});

/**
 * PATCH /api/users/:id/block
 * Admin: Block or Unblock user account
 * Rules:
 *  - Cannot block admin accounts
 *  - Blocked users must not access protected platform features
 */
router.patch('/:id/block', verifyToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
      res.status(400).json({ success: false, message: 'isBlocked field must be a boolean.' });
      return;
    }

    const targetUser = await dbService.users.findOne({ _id: id });
    if (!targetUser) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Safety rule: Cannot block admin accounts
    if (targetUser.role === 'admin') {
      res.status(400).json({
        success: false,
        message: 'Administrator accounts cannot be blocked.',
      });
      return;
    }

    await dbService.users.updateOne(id, { isBlocked });

    res.json({
      success: true,
      message: `User ${targetUser.name} has been ${isBlocked ? 'blocked' : 'unblocked'} successfully.`,
      isBlocked,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update user block status.' });
  }
});

export default router;
