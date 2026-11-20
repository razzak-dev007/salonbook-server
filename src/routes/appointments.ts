/**
 * appointments.ts — Appointment Booking & Management Routes
 * Enforces customer-only bookings, slot conflict prevention, role-based status changes,
 * and strict ownership checks.
 */

import { Router, Response } from 'express';
import { dbService } from '../db.js';
import { AuthenticatedRequest, verifyToken, requireCustomer, requireAdmin } from '../middleware/auth.js';
import { AppointmentStatus } from '../types.js';

const router = Router();

/**
 * POST /api/appointments
 * Customer: Submit new appointment request
 * Rules:
 *  - Only authenticated Customers can submit appointment requests.
 *  - Admins cannot submit customer appointment requests.
 *  - Prevent customers from booking inactive services.
 *  - Prevent duplicate active appointments for the same date and time slot.
 *  - Default Appointment Status: Pending.
 *  - Default Payment Status: Unpaid.
 */
router.post('/', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;

    // Admins cannot submit customer appointment requests
    if (user.role === 'admin') {
      res.status(403).json({
        success: false,
        message: 'Administrators cannot book customer appointments. Please use a customer account.',
      });
      return;
    }

    const { serviceId, appointmentDate, timeSlot, message } = req.body;

    if (!serviceId || !appointmentDate || !timeSlot) {
      res.status(400).json({
        success: false,
        message: 'Please provide Service, Appointment Date, and Time Slot.',
      });
      return;
    }

    // 1. Verify service exists and is active
    const service = await dbService.services.findOne({ _id: serviceId });
    if (!service) {
      res.status(404).json({ success: false, message: 'Selected salon service was not found.' });
      return;
    }

    if (service.status !== 'active') {
      res.status(400).json({
        success: false,
        message: 'This salon service is currently inactive and unavailable for booking.',
      });
      return;
    }

    // 2. Prevent duplicate active appointments for the same date and time slot
    // Active appointments are those that are NOT cancelled (pending or confirmed)
    const existingAppointments = await dbService.appointments.find({
      appointmentDate: appointmentDate.trim(),
      timeSlot: timeSlot.trim(),
    });

    const activeConflict = existingAppointments.find(
      a => a.status === 'pending' || a.status === 'confirmed'
    );

    if (activeConflict) {
      res.status(409).json({
        success: false,
        message: `The time slot (${timeSlot}) on ${appointmentDate} is already reserved. Please select another time or date.`,
      });
      return;
    }

    // 3. Create appointment
    const newAppointment = await dbService.appointments.insertOne({
      serviceId,
      customerId: user.userId,
      appointmentDate: appointmentDate.trim(),
      timeSlot: timeSlot.trim(),
      message: message ? message.trim() : '',
      servicePrice: service.price,
      paymentStatus: 'unpaid',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    // Populate service & customer for response
    const populated = await dbService.appointments.findOne({ _id: newAppointment._id });

    res.status(201).json({
      success: true,
      message: 'Appointment request submitted successfully! Pending salon confirmation.',
      data: populated,
    });
  } catch (err: any) {
    console.error('Create Appointment Error:', err);
    res.status(500).json({ success: false, message: 'Failed to create appointment request.' });
  }
});

/**
 * GET /api/appointments/my
 * Customer: View own appointment requests
 * Rules: Customers can only view their own appointments.
 */
router.get('/my', verifyToken, requireCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.user!.userId;
    const appointments = await dbService.appointments.find({ customerId });

    res.json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve your appointments.' });
  }
});

/**
 * PATCH /api/appointments/:id/cancel
 * Customer: Cancel own pending appointment request
 * Rules:
 *  - Customers can only cancel their own appointments.
 *  - Customers cannot cancel an already confirmed or cancelled appointment.
 */
router.patch('/:id/cancel', verifyToken, requireCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.userId;

    const appointment = await dbService.appointments.findOne({ _id: id });
    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }

    // Check ownership
    if (appointment.customerId !== customerId) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized. You can only cancel your own appointments.',
      });
      return;
    }

    // Rule: Customers cannot cancel an already confirmed or cancelled appointment
    if (appointment.status === 'confirmed') {
      res.status(400).json({
        success: false,
        message: 'This appointment is already confirmed. Please contact the salon directly to reschedule or cancel.',
      });
      return;
    }

    if (appointment.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: 'This appointment has already been cancelled.',
      });
      return;
    }

    // Must be pending
    if (appointment.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel an appointment with status '${appointment.status}'.`,
      });
      return;
    }

    await dbService.appointments.updateOne(id, { status: 'cancelled' });
    const updated = await dbService.appointments.findOne({ _id: id });

    res.json({
      success: true,
      message: 'Appointment request cancelled successfully.',
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to cancel appointment.' });
  }
});

/**
 * GET /api/appointments/all
 * Admin: View all appointment requests
 */
router.get('/all', verifyToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const appointments = await dbService.appointments.find();
    res.json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve all appointments.' });
  }
});

/**
 * PATCH /api/appointments/:id/status
 * Admin: Confirm or Cancel appointment requests
 * Rules:
 *  - Only pending appointments can be confirmed.
 *  - Admin can cancel pending or confirmed appointments.
 */
router.patch('/:id/status', verifyToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: AppointmentStatus };

    if (!status || (status !== 'confirmed' && status !== 'cancelled')) {
      res.status(400).json({
        success: false,
        message: "Status must be either 'confirmed' or 'cancelled'.",
      });
      return;
    }

    const appointment = await dbService.appointments.findOne({ _id: id });
    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }

    // Rule: Only pending appointments can be confirmed
    if (status === 'confirmed' && appointment.status !== 'pending') {
      res.status(400).json({
        success: false,
        message: `Only pending appointments can be confirmed. Current status: ${appointment.status}.`,
      });
      return;
    }

    // If cancelling an appointment that was already paid, notice
    await dbService.appointments.updateOne(id, { status });
    const updated = await dbService.appointments.findOne({ _id: id });

    res.json({
      success: true,
      message: `Appointment successfully marked as ${status}.`,
      data: updated,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to update appointment status.' });
  }
});

export default router;
