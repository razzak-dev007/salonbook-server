// Vercel serverless entry point for SalonBook Express API
import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectToDatabase } from '../src/db.js';
import { seedDatabase } from '../src/seed.js';

import authRoutes from '../src/routes/auth.js';
import serviceRoutes from '../src/routes/services.js';
import appointmentRoutes from '../src/routes/appointments.js';
import paymentRoutes from '../src/routes/payments.js';
import userRoutes from '../src/routes/users.js';
import dashboardRoutes from '../src/routes/dashboard.js';
import uploadRoutes from '../src/routes/upload.js';

dotenv.config();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'stripe-signature'],
  })
);

app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Initialize database on first lambda invocation
let isInitialized = false;
async function initialize() {
  if (!isInitialized) {
    await connectToDatabase();
    await seedDatabase();
    isInitialized = true;
  }
}

app.use(async (_req, _res, next) => {
  await initialize();
  next();
});

// Root & Health
app.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    platform: 'SalonBook - Salon Appointment Booking Platform API',
    category: '002',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'production',
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

export default app;
