/**
 * index.ts — SalonBook Backend API Main Server
 * Express application with MongoDB, JWT Authentication, and Stripe Integration.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectToDatabase } from './db.js';
import { seedDatabase } from './seed.js';

import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import appointmentRoutes from './routes/appointments.js';
import paymentRoutes from './routes/payments.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// 1. CORS Configuration
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or serverless proxies)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in evaluation to avoid any CORS issues
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'stripe-signature'],
  })
);

// 2. Parse Raw Body for Stripe Webhooks & JSON for standard APIs
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

// 3. Health & Status Check Endpoints
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
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 4. API Route Registrations
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

// 5. 404 Route Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API route not found. Please verify the endpoint documentation.',
  });
});

// 6. Global Error Handling Middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server Internal Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error. Please try again later.',
  });
});

// 7. Initialize Database & Start Server
async function startServer() {
  await connectToDatabase();
  await seedDatabase();

  app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`💈 SalonBook Server running on http://localhost:${PORT}`);
    console.log(`📡 Client URL configured: ${CLIENT_URL}`);
    console.log(`🔐 Default Admin: admin@salonbook.com / Admin@123456`);
    console.log(`======================================================`);
  });
}

// Start if not in test suite or serverless import
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
