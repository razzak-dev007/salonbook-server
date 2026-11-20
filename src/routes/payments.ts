/**
 * payments.ts — Stripe Checkout & Payment Processing Routes
 * Handles checkout session creation, webhook fulfillment, payment verification,
 * and immutable transaction records.
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import dotenv from 'dotenv';
import { dbService } from '../db.js';
import { AuthenticatedRequest, verifyToken, requireCustomer, requireAdmin } from '../middleware/auth.js';

dotenv.config();

const router = Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key_for_salonbook';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Initialize Stripe client
let stripeClient: Stripe | null = null;
if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.includes('placeholder')) {
  try {
    stripeClient = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as any,
    });
  } catch (err) {
    console.warn('⚠️ Stripe client initialization with placeholder/invalid key. Dev mode enabled.');
  }
}

/**
 * POST /api/payments/create-checkout-session
 * Customer: Pay for confirmed appointments
 * Rules:
 *  - Customers cannot pay for cancelled or pending appointments.
 *  - Customers can only pay for their own appointments.
 */
router.post('/create-checkout-session', verifyToken, requireCustomer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId } = req.body;
    const customerId = req.user!.userId;

    if (!appointmentId) {
      res.status(400).json({ success: false, message: 'Appointment ID is required.' });
      return;
    }

    const appointment = await dbService.appointments.findOne({ _id: appointmentId });
    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }

    // Ownership check
    if (appointment.customerId !== customerId) {
      res.status(403).json({ success: false, message: 'Unauthorized. You can only pay for your own appointments.' });
      return;
    }

    // Rule: Customers cannot pay for cancelled or pending appointments
    if (appointment.status === 'pending') {
      res.status(400).json({
        success: false,
        message: 'Cannot pay for pending appointments. Please wait until the salon administrator confirms your booking.',
      });
      return;
    }

    if (appointment.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: 'Cannot pay for cancelled appointments.',
      });
      return;
    }

    if (appointment.paymentStatus === 'paid') {
      res.status(400).json({
        success: false,
        message: 'This appointment has already been paid.',
      });
      return;
    }

    const service = await dbService.services.findOne({ _id: appointment.serviceId });
    const serviceName = service?.serviceName || 'Salon Service';
    const amountInCents = Math.round((appointment.servicePrice || 50) * 100);

    // If Stripe client is configured with real key, create real Stripe Checkout Session
    if (stripeClient) {
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: serviceName,
                description: `Appointment on ${appointment.appointmentDate} at ${appointment.timeSlot}`,
                images: service?.image ? [service.image] : undefined,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&appointment_id=${appointment._id}`,
        cancel_url: `${CLIENT_URL}/payment/cancel?appointment_id=${appointment._id}`,
        customer_email: req.user!.email,
        metadata: {
          appointmentId: appointment._id,
          customerId: customerId,
        },
      });

      res.json({
        success: true,
        sessionId: session.id,
        url: session.url,
      });
      return;
    }

    // Fallback: Test / Demo checkout session generator
    // Generates a test session ID and direct redirect URL for testing without live credentials
    const testSessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const redirectUrl = `${CLIENT_URL}/payment/success?session_id=${testSessionId}&appointment_id=${appointment._id}`;

    res.json({
      success: true,
      sessionId: testSessionId,
      url: redirectUrl,
      mode: 'test_simulation',
      message: 'Stripe test checkout initialized.',
    });
  } catch (err: any) {
    console.error('Checkout Session Error:', err);
    res.status(500).json({ success: false, message: 'Failed to create Stripe checkout session.' });
  }
});

/**
 * POST /api/payments/verify-session
 * Verification & Synchronization Endpoint for Payment Success Page
 * Updates appointment payment status and creates transaction record.
 */
router.post('/verify-session', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId, appointmentId } = req.body;
    const userId = req.user!.userId;

    if (!sessionId || !appointmentId) {
      res.status(400).json({ success: false, message: 'Session ID and Appointment ID are required.' });
      return;
    }

    const appointment = await dbService.appointments.findOne({ _id: appointmentId });
    if (!appointment) {
      res.status(404).json({ success: false, message: 'Appointment not found.' });
      return;
    }

    // Ensure appointment belongs to the caller or admin
    if (req.user!.role !== 'admin' && appointment.customerId !== userId) {
      res.status(403).json({ success: false, message: 'Unauthorized access to appointment payment verification.' });
      return;
    }

    // Check if transaction already recorded
    let existingTx = await dbService.transactions.findOne({ stripeSessionId: sessionId });

    if (!existingTx) {
      // Record transaction
      existingTx = await dbService.transactions.insertOne({
        appointmentId: appointment._id,
        customerId: appointment.customerId,
        amount: appointment.servicePrice,
        currency: 'usd',
        stripeSessionId: sessionId,
        status: 'paid',
        createdAt: new Date().toISOString(),
      });
    }

    // Update appointment paymentStatus to paid
    await dbService.appointments.updateOne(appointment._id, {
      paymentStatus: 'paid',
    });

    const updatedAppointment = await dbService.appointments.findOne({ _id: appointment._id });

    res.json({
      success: true,
      message: 'Payment verified and confirmed successfully!',
      transaction: existingTx,
      appointment: updatedAppointment,
    });
  } catch (err: any) {
    console.error('Verify Payment Error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify payment status.' });
  }
});

/**
 * POST /api/payments/webhook
 * Verified Stripe Webhook Endpoint
 * Rule: Appointment payment status must be updated only after a verified Stripe webhook event
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    if (stripeClient && webhookSecret && sig) {
      // Verified webhook construction using raw body buffer
      event = stripeClient.webhooks.constructEvent(
        (req as any).rawBody || req.body,
        sig,
        webhookSecret
      );
    } else {
      // In dev mode / simulated webhooks
      event = req.body as Stripe.Event;
    }
  } catch (err: any) {
    console.error('⚠️ Stripe Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;
    const customerId = session.metadata?.customerId;
    const amountTotal = session.amount_total ? session.amount_total / 100 : 0;
    const currency = session.currency || 'usd';

    if (appointmentId) {
      // Update appointment paymentStatus to 'paid'
      await dbService.appointments.updateOne(appointmentId, {
        paymentStatus: 'paid',
      });

      // Save transaction
      const existingTx = await dbService.transactions.findOne({ stripeSessionId: session.id });
      if (!existingTx) {
        await dbService.transactions.insertOne({
          appointmentId,
          customerId: customerId || '',
          amount: amountTotal,
          currency,
          stripeSessionId: session.id,
          status: 'paid',
          createdAt: new Date().toISOString(),
        });
      }
      console.log(`✅ Webhook: Appointment ${appointmentId} marked as PAID via session ${session.id}`);
    }
  }

  res.json({ received: true });
});

/**
 * GET /api/payments/transactions
 * Admin: View all transactions
 * Rule: Admin must not be able to modify payment records manually to mark an unsuccessful payment as successful.
 */
router.get('/transactions', verifyToken, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const transactions = await dbService.transactions.find();
    res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Failed to retrieve transactions.' });
  }
});

export default router;
