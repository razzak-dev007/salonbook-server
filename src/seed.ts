/**
 * seed.ts — Initial Data Seeder for SalonBook
 * Seeds default administrator, test customer, and featured salon services.
 */

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { dbService, inMemoryStore } from './db.js';
import { Service, User } from './types.js';

dotenv.config();

export async function seedDatabase(force = false): Promise<void> {
  const existingServices = await dbService.services.countDocuments();
  if (existingServices > 0 && !force) {
    console.log('🌱 Database already populated. Skipping seeder.');
    return;
  }

  console.log('🌱 Seeding SalonBook database with default admin, customer, and services...');

  // 1. Seed Default Admin Account
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@salonbook.com';
  const existingAdmin = await dbService.users.findOne({ email: adminEmail });

  let adminId = existingAdmin?._id;
  if (!existingAdmin) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUser = await dbService.users.insertOne({
      name: process.env.ADMIN_NAME || 'SalonBook Administrator',
      email: adminEmail,
      password: hashedPassword,
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      role: 'admin',
      isBlocked: false,
      phone: '+1 (555) 019-2834',
      createdAt: new Date().toISOString(),
    });
    adminId = adminUser._id;
    console.log(`✅ Default Admin created: ${adminEmail} / ${adminPassword}`);
  }

  // 2. Seed Default Customer Account
  const customerEmail = 'customer@salonbook.com';
  const existingCustomer = await dbService.users.findOne({ email: customerEmail });

  let customerId = existingCustomer?._id;
  if (!existingCustomer) {
    const customerPassword = 'Customer@123456';
    const hashedPassword = await bcrypt.hash(customerPassword, 10);
    const customerUser = await dbService.users.insertOne({
      name: 'Jessica Reynolds',
      email: customerEmail,
      password: hashedPassword,
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      role: 'customer',
      isBlocked: false,
      phone: '+1 (555) 782-9011',
      createdAt: new Date().toISOString(),
    });
    customerId = customerUser._id;
    console.log(`✅ Test Customer created: ${customerEmail} / ${customerPassword}`);
  }

  // 3. Seed Comprehensive Salon Services
  const initialServices: Omit<Service, '_id'>[] = [
    {
      serviceName: 'Signature Precision Haircut & Blowdry',
      category: 'Haircut & Styling',
      description: 'Custom tailored consultation, luxury hair wash with botanical oils, precision cut, and signature voluminous blowout styling.',
      price: 65,
      duration: 60,
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Balayage & Dimensional Sun-Kissed Color',
      category: 'Hair Coloring',
      description: 'Hand-painted balayage highlights delivering a seamless, natural transition with customized gloss toning and deep bond building treatment.',
      price: 180,
      duration: 150,
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Keratin Smooth & Restore Therapy',
      category: 'Hair Treatment',
      description: 'Intense keratin smoothing system that eliminates frizz, restores damaged cuticles, and locks in high-gloss shine for up to 4 months.',
      price: 140,
      duration: 120,
      image: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Hydra-Glow Deep Cleansing Facial',
      category: 'Facial & Skincare',
      description: 'Multi-step clinical facial featuring gentle ultrasonic exfoliation, vortex suction extractions, peptide infusion, and soothing LED light therapy.',
      price: 95,
      duration: 75,
      image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Red Carpet Glamour & Event Makeup',
      category: 'Makeup',
      description: 'Full-face professional application with luxury contouring, custom false lashes, humidity-proof setting spray, and long-lasting lip artistry.',
      price: 85,
      duration: 60,
      image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Deluxe Gel Spa Manicure & Pedicure',
      category: 'Manicure & Pedicure',
      description: 'Aromatherapy soak, cuticle refinement, organic scrub, hot stone massage, and long-wear chip-resistant UV gel polish.',
      price: 75,
      duration: 80,
      image: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Aromatherapy Hot Stone Massage',
      category: 'Spa & Massage',
      description: 'Full-body relaxation ritual combining heated volcanic river stones with custom lavender and eucalyptus essential oils to dissolve tension.',
      price: 110,
      duration: 90,
      image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      serviceName: 'Gentlemen’s Royal Beard Sculpt & Cut',
      category: 'Haircut & Styling',
      description: 'Classic barber haircut, straight-razor neck shave, hot towel treatment, botanical beard wash, conditioning oil, and precise line-up sculpting.',
      price: 55,
      duration: 45,
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ];

  const createdServices: Service[] = [];
  for (const s of initialServices) {
    const created = await dbService.services.insertOne(s);
    createdServices.push(created);
  }

  // 4. Seed Sample Appointments for Customer
  if (customerId && createdServices.length >= 3) {
    const appt1 = await dbService.appointments.insertOne({
      serviceId: createdServices[0]._id,
      customerId: customerId,
      appointmentDate: '2026-11-24',
      timeSlot: '10:00 AM',
      message: 'Looking forward to a fresh haircut before my weekend event.',
      servicePrice: createdServices[0].price,
      paymentStatus: 'paid',
      status: 'confirmed',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    });

    // Add corresponding transaction
    await dbService.transactions.insertOne({
      appointmentId: appt1._id,
      customerId: customerId,
      amount: createdServices[0].price,
      currency: 'usd',
      stripeSessionId: 'cs_test_sample_session_101',
      status: 'paid',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    });

    const appt2 = await dbService.appointments.insertOne({
      serviceId: createdServices[1]._id,
      customerId: customerId,
      appointmentDate: '2026-11-28',
      timeSlot: '02:00 PM',
      message: 'Would love advice on subtle highlights that suit warm skin tones.',
      servicePrice: createdServices[1].price,
      paymentStatus: 'unpaid',
      status: 'confirmed',
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    });

    await dbService.appointments.insertOne({
      serviceId: createdServices[3]._id,
      customerId: customerId,
      appointmentDate: '2026-12-02',
      timeSlot: '11:30 AM',
      message: 'Need gentle extraction for sensitive skin.',
      servicePrice: createdServices[3].price,
      paymentStatus: 'unpaid',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }

  inMemoryStore.seeded = true;
  console.log('✅ SalonBook database seeding complete!');
}
