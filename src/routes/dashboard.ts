/**
 * dashboard.ts — Aggregated Dashboard Analytics Routes
 * Provides real-time metrics for Customer and Admin overview screens.
 */

import { Router, Response } from 'express';
import { dbService } from '../db.js';
import { AuthenticatedRequest, verifyToken, requireCustomer, requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/dashboard/customer
 * Customer Dashboard Overview
 * Metrics:
 *  - Total Appointment Requests
 *  - Pending Appointments
 *  - Confirmed Appointments
 *  - Cancelled Appointments
 */
router.get('/customer', verifyToken, requireCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.user!.userId;
    const appointments = await dbService.appointments.find({ customerId });

    const totalRequests = appointments.length;
    const pendingAppointments = appointments.filter(a => a.status === 'pending').length;
    const confirmedAppointments = appointments.filter(a => a.status === 'confirmed').length;
    const cancelledAppointments = appointments.filter(a => a.status === 'cancelled').length;
    const paidAppointments = appointments.filter(a => a.paymentStatus === 'paid').length;

    res.json({
      success: true,
      data: {
        totalRequests,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        paidAppointments,
        recentAppointments: appointments.slice(0, 5),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to load customer dashboard overview.' });
  }
});

/**
 * GET /api/dashboard/admin
 * Admin Dashboard Overview
 * Metrics:
 *  - Total Registered Customers
 *  - Total Active Services
 *  - Total Appointment Requests
 *  - Pending Appointments
 *  - Confirmed Appointments
 *  - Total Successful Payments
 */
router.get('/admin', verifyToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const allUsers = await dbService.users.find();
    const registeredCustomers = allUsers.filter(u => u.role === 'customer').length;

    const allServices = await dbService.services.find();
    const activeServices = allServices.filter(s => s.status === 'active').length;

    const allAppointments = await dbService.appointments.find();
    const totalAppointments = allAppointments.length;
    const pendingAppointments = allAppointments.filter(a => a.status === 'pending').length;
    const confirmedAppointments = allAppointments.filter(a => a.status === 'confirmed').length;
    const cancelledAppointments = allAppointments.filter(a => a.status === 'cancelled').length;

    const allTransactions = await dbService.transactions.find();
    const successfulPayments = allTransactions.filter(t => t.status === 'paid').length;
    const totalRevenue = allTransactions
      .filter(t => t.status === 'paid')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    res.json({
      success: true,
      data: {
        totalRegisteredCustomers: registeredCustomers,
        totalActiveServices: activeServices,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        totalSuccessfulPayments: successfulPayments,
        totalRevenue,
        recentAppointments: allAppointments.slice(0, 5),
        recentTransactions: allTransactions.slice(0, 5),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to load admin dashboard overview.' });
  }
});

export default router;
