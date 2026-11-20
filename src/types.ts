export type UserRole = 'admin' | 'customer';
export type ServiceStatus = 'active' | 'inactive';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid';
export type TransactionStatus = 'paid' | 'failed';

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: UserRole;
  isBlocked: boolean;
  phone?: string;
  createdAt: string;
}

export interface Service {
  _id: string;
  serviceName: string;
  category: string;
  description: string;
  price: number;
  duration: number; // in minutes
  image: string;
  status: ServiceStatus;
  createdAt: string;
}

export interface Appointment {
  _id: string;
  serviceId: string;
  customerId: string;
  appointmentDate: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:00 AM"
  message?: string;
  servicePrice: number;
  paymentStatus: PaymentStatus;
  status: AppointmentStatus;
  createdAt: string;
  // Populated helpers
  service?: Service;
  customer?: {
    _id: string;
    name: string;
    email: string;
    image?: string;
    phone?: string;
  };
}

export interface Transaction {
  _id: string;
  appointmentId: string;
  customerId: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  status: TransactionStatus;
  createdAt: string;
  // Populated helpers
  serviceName?: string;
  customerName?: string;
  customerEmail?: string;
  appointmentDate?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}
