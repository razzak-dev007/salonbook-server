# SalonBook Backend API — Salon Appointment Booking Platform

**Assignment 9 — Category: 002**  
A modern, secure, and resilient RESTful API backend for **SalonBook**, built with Node.js, Express.js, TypeScript, MongoDB, JWT Authentication, and Stripe Checkout.

---

## 📌 Project Overview
SalonBook is a salon appointment booking platform where customers explore salon services, request appointments, manage bookings, and complete secure payments via Stripe. Administrators manage services, review appointment requests, handle customer accounts, and monitor payment transactions.

---

## 🚀 Key Features
- **Role-Based JWT Authentication & Authorization**: Strict server-side verification for `admin` and `customer` roles.
- **Account Suspension & Security**: Blocked users are immediately barred from accessing protected platform endpoints.
- **Salon Services Catalog**:
  - Full CRUD operations for administrators (Add, Update, Delete, Toggle Active/Inactive status).
  - Validation ensuring price and duration are strictly positive numbers.
  - Search services by name, filter by category, and sort by price.
- **Appointment Booking Engine**:
  - Customer-only booking with date, predefined time slots, and optional notes.
  - Conflict prevention avoiding duplicate active bookings for the same date and time slot.
  - Strict cancellation rules: customers can only cancel their own pending appointments.
  - Admin controls: only pending appointments can be confirmed.
- **Stripe Payment Gateway Integration**:
  - Customers pay for confirmed appointments via Stripe Checkout.
  - Webhook endpoint with raw signature verification updating status only upon verified fulfillment.
  - Direct verification endpoint ensuring real-time appointment and transaction synchronization.
- **Analytics & Dashboard Metrics**: Real-time aggregated statistics for both customer and administrator dashboards.
- **Resilient Dual-Mode Database Layer**: Native MongoDB connection with automatic fallback to an in-memory database store, guaranteeing zero downtime.

---

## 🛠️ Technology Stack
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (via official MongoDB driver) with dual-mode in-memory resilience
- **Authentication**: JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, HTTPOnly Cookie & Bearer header parsing
- **Payments**: Stripe API (`stripe`)
- **Image Hosting**: ImgBB API integration
- **Deployment**: Vercel Serverless Function (`@vercel/node`)

---

## 📋 Required Environment Variables
Create a `.env` file in the root of the `server/` directory:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Database Configuration
MONGODB_URI=

# Authentication Secrets
JWT_SECRET=
BETTER_AUTH_SECRET=

# Stripe Configuration
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ImgBB API Configuration
IMGBB_API_KEY=

# Default Admin Credentials
ADMIN_NAME=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

> **Note**: Never commit your actual `.env` file or sensitive API keys to GitHub.

---

## 💻 Installation & Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/razzak-dev007/salonbook-server.git
   cd salonbook-server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

4. **Compile TypeScript:**
   ```bash
   npm run build
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   Or run the compiled production build:
   ```bash
   npm start
   ```

The server will be accessible at `http://localhost:5000`.

---

## 🔑 Default Evaluation Credentials
- **Admin Email**: `admin@salonbook.com`
- **Admin Password**: `Admin@123456`
- **Customer Email**: `customer@salonbook.com`
- **Customer Password**: `Customer@123456`

---

## 🔗 Repository & Live Deployment Links
- **Live Client Application**: https://client-pi-three-30.vercel.app
- **Live Server API**: https://server-lac-ten-53.vercel.app
- **Client GitHub Repository**: https://github.com/razzak-dev007/salonbook-client
- **Server GitHub Repository**: https://github.com/razzak-dev007/salonbook-server

---

## 🛡️ License
MIT License. Developed for Assignment 9 (Category: 002).
