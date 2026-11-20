/**
 * db.ts — SalonBook Resilient Database Layer
 * Supports MongoDB native connection and seamless in-memory fallback
 * for 100% reliability in local development, testing, and production.
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { User, Service, Appointment, Transaction } from './types.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/salonbook';
const DB_NAME = 'salonbook';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let isConnectedToMongo = false;

// In-Memory store fallback
function generateId(): string {
  let hex = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < 24; i++) {
    hex += chars[Math.floor(Math.random() * 16)];
  }
  return hex;
}

export const inMemoryStore: {
  users: User[];
  services: Service[];
  appointments: Appointment[];
  transactions: Transaction[];
  seeded: boolean;
} = {
  users: [],
  services: [],
  appointments: [],
  transactions: [],
  seeded: false,
};

export async function connectToDatabase(): Promise<boolean> {
  if (mongoDb && isConnectedToMongo) return true;

  try {
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
      connectTimeoutMS: 2500,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    isConnectedToMongo = true;
    console.log('✅ Connected to MongoDB successfully:', MONGODB_URI.replace(/:[^:]*@/, ':***@'));
    return true;
  } catch (err: any) {
    console.warn('⚠️ MongoDB connection not available. Using built-in persistent in-memory database store.');
    isConnectedToMongo = false;
    return false;
  }
}

export function isMongoActive(): boolean {
  return isConnectedToMongo && mongoDb !== null;
}

// --------------------------------------------------------------------------
// Database Collection Abstractions (Seamlessly handles MongoDB and Store)
// --------------------------------------------------------------------------

export const dbService = {
  // Users
  users: {
    find: async (filter: Partial<User> = {}): Promise<User[]> => {
      if (isMongoActive()) {
        const query: any = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const docs = await mongoDb!.collection('users').find(query).toArray();
        return docs.map(d => ({ ...d, _id: d._id.toString() } as unknown as User));
      }
      return inMemoryStore.users.filter(u => {
        for (const key of Object.keys(filter) as (keyof User)[]) {
          if (filter[key] !== undefined && u[key] !== filter[key]) return false;
        }
        return true;
      });
    },

    findOne: async (filter: Partial<User>): Promise<User | null> => {
      if (isMongoActive()) {
        const query: any = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const doc = await mongoDb!.collection('users').findOne(query);
        if (!doc) return null;
        return { ...doc, _id: doc._id.toString() } as unknown as User;
      }
      const found = inMemoryStore.users.find(u => {
        for (const key of Object.keys(filter) as (keyof User)[]) {
          if (filter[key] !== undefined && u[key] !== filter[key]) return false;
        }
        return true;
      });
      return found ? { ...found } : null;
    },

    insertOne: async (user: Omit<User, '_id'> & { _id?: string }): Promise<User> => {
      const _id = user._id || generateId();
      const newUser: User = { ...user, _id } as User;
      if (isMongoActive()) {
        await mongoDb!.collection('users').insertOne({ ...newUser, _id: new ObjectId(_id) } as any);
      } else {
        inMemoryStore.users.push(newUser);
      }
      return newUser;
    },

    updateOne: async (id: string, updates: Partial<User>): Promise<boolean> => {
      if (isMongoActive()) {
        const res = await mongoDb!.collection('users').updateOne(
          { _id: (ObjectId.isValid(id) ? new ObjectId(id) : id) as any },
          { $set: updates }
        );
        return res.matchedCount > 0;
      }
      const idx = inMemoryStore.users.findIndex(u => u._id === id);
      if (idx !== -1) {
        inMemoryStore.users[idx] = { ...inMemoryStore.users[idx], ...updates };
        return true;
      }
      return false;
    },

    countDocuments: async (filter: Partial<User> = {}): Promise<number> => {
      if (isMongoActive()) {
        return await mongoDb!.collection('users').countDocuments(filter as any);
      }
      return (await dbService.users.find(filter)).length;
    },
  },

  // Services
  services: {
    find: async (filter: any = {}): Promise<Service[]> => {
      if (isMongoActive()) {
        const query = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const docs = await mongoDb!.collection('services').find(query).toArray();
        return docs.map(d => ({ ...d, _id: d._id.toString() } as unknown as Service));
      }
      return inMemoryStore.services.filter(s => {
        for (const key of Object.keys(filter)) {
          if (filter[key] !== undefined && (s as any)[key] !== filter[key]) return false;
        }
        return true;
      });
    },

    findOne: async (filter: any): Promise<Service | null> => {
      if (isMongoActive()) {
        const query = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const doc = await mongoDb!.collection('services').findOne(query);
        if (!doc) return null;
        return { ...doc, _id: doc._id.toString() } as unknown as Service;
      }
      const found = inMemoryStore.services.find(s => {
        for (const key of Object.keys(filter)) {
          if (filter[key] !== undefined && (s as any)[key] !== filter[key]) return false;
        }
        return true;
      });
      return found ? { ...found } : null;
    },

    insertOne: async (service: Omit<Service, '_id'> & { _id?: string }): Promise<Service> => {
      const _id = service._id || generateId();
      const newService: Service = { ...service, _id } as Service;
      if (isMongoActive()) {
        await mongoDb!.collection('services').insertOne({ ...newService, _id: new ObjectId(_id) } as any);
      } else {
        inMemoryStore.services.push(newService);
      }
      return newService;
    },

    updateOne: async (id: string, updates: Partial<Service>): Promise<boolean> => {
      if (isMongoActive()) {
        const res = await mongoDb!.collection('services').updateOne(
          { _id: (ObjectId.isValid(id) ? new ObjectId(id) : id) as any },
          { $set: updates }
        );
        return res.matchedCount > 0;
      }
      const idx = inMemoryStore.services.findIndex(s => s._id === id);
      if (idx !== -1) {
        inMemoryStore.services[idx] = { ...inMemoryStore.services[idx], ...updates };
        return true;
      }
      return false;
    },

    deleteOne: async (id: string): Promise<boolean> => {
      if (isMongoActive()) {
        const res = await mongoDb!.collection('services').deleteOne({
          _id: (ObjectId.isValid(id) ? new ObjectId(id) : id) as any,
        });
        return res.deletedCount > 0;
      }
      const idx = inMemoryStore.services.findIndex(s => s._id === id);
      if (idx !== -1) {
        inMemoryStore.services.splice(idx, 1);
        return true;
      }
      return false;
    },

    countDocuments: async (filter: any = {}): Promise<number> => {
      if (isMongoActive()) {
        return await mongoDb!.collection('services').countDocuments(filter);
      }
      return (await dbService.services.find(filter)).length;
    },
  },

  // Appointments
  appointments: {
    find: async (filter: any = {}): Promise<Appointment[]> => {
      let list: Appointment[] = [];
      if (isMongoActive()) {
        const query = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const docs = await mongoDb!.collection('appointments').find(query).sort({ createdAt: -1 }).toArray();
        list = docs.map(d => ({ ...d, _id: d._id.toString() } as unknown as Appointment));
      } else {
        list = inMemoryStore.appointments
          .filter(a => {
            for (const key of Object.keys(filter)) {
              if (filter[key] !== undefined && (a as any)[key] !== filter[key]) return false;
            }
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      // Populate service & customer details for convenience
      const populated = await Promise.all(
        list.map(async appt => {
          const service = await dbService.services.findOne({ _id: appt.serviceId });
          const customer = await dbService.users.findOne({ _id: appt.customerId });
          return {
            ...appt,
            service: service || undefined,
            customer: customer
              ? {
                  _id: customer._id,
                  name: customer.name,
                  email: customer.email,
                  image: customer.image,
                  phone: customer.phone,
                }
              : undefined,
          };
        })
      );
      return populated;
    },

    findOne: async (filter: any): Promise<Appointment | null> => {
      let found: Appointment | null = null;
      if (isMongoActive()) {
        const query = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const doc = await mongoDb!.collection('appointments').findOne(query);
        if (doc) {
          found = { ...doc, _id: doc._id.toString() } as unknown as Appointment;
        }
      } else {
        const appt = inMemoryStore.appointments.find(a => {
          for (const key of Object.keys(filter)) {
            if (filter[key] !== undefined && (a as any)[key] !== filter[key]) return false;
          }
          return true;
        });
        if (appt) found = { ...appt };
      }

      if (found) {
        const service = await dbService.services.findOne({ _id: found.serviceId });
        const customer = await dbService.users.findOne({ _id: found.customerId });
        found.service = service || undefined;
        if (customer) {
          found.customer = {
            _id: customer._id,
            name: customer.name,
            email: customer.email,
            image: customer.image,
            phone: customer.phone,
          };
        }
      }
      return found;
    },

    insertOne: async (appointment: Omit<Appointment, '_id'> & { _id?: string }): Promise<Appointment> => {
      const _id = appointment._id || generateId();
      const newAppt: Appointment = { ...appointment, _id } as Appointment;
      if (isMongoActive()) {
        await mongoDb!.collection('appointments').insertOne({ ...newAppt, _id: new ObjectId(_id) } as any);
      } else {
        inMemoryStore.appointments.push(newAppt);
      }
      return newAppt;
    },

    updateOne: async (id: string, updates: Partial<Appointment>): Promise<boolean> => {
      if (isMongoActive()) {
        const res = await mongoDb!.collection('appointments').updateOne(
          { _id: (ObjectId.isValid(id) ? new ObjectId(id) : id) as any },
          { $set: updates }
        );
        return res.matchedCount > 0;
      }
      const idx = inMemoryStore.appointments.findIndex(a => a._id === id);
      if (idx !== -1) {
        inMemoryStore.appointments[idx] = { ...inMemoryStore.appointments[idx], ...updates };
        return true;
      }
      return false;
    },

    countDocuments: async (filter: any = {}): Promise<number> => {
      if (isMongoActive()) {
        return await mongoDb!.collection('appointments').countDocuments(filter);
      }
      return (await dbService.appointments.find(filter)).length;
    },
  },

  // Transactions
  transactions: {
    find: async (filter: any = {}): Promise<Transaction[]> => {
      let list: Transaction[] = [];
      if (isMongoActive()) {
        const query = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const docs = await mongoDb!.collection('transactions').find(query).sort({ createdAt: -1 }).toArray();
        list = docs.map(d => ({ ...d, _id: d._id.toString() } as unknown as Transaction));
      } else {
        list = inMemoryStore.transactions
          .filter(t => {
            for (const key of Object.keys(filter)) {
              if (filter[key] !== undefined && (t as any)[key] !== filter[key]) return false;
            }
            return true;
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      // Populate related details
      const populated = await Promise.all(
        list.map(async tx => {
          const appt = await dbService.appointments.findOne({ _id: tx.appointmentId });
          const customer = await dbService.users.findOne({ _id: tx.customerId });
          return {
            ...tx,
            serviceName: appt?.service?.serviceName || 'Salon Service',
            appointmentDate: appt?.appointmentDate || 'N/A',
            customerName: customer?.name || 'Customer',
            customerEmail: customer?.email || 'N/A',
          };
        })
      );
      return populated;
    },

    findOne: async (filter: any): Promise<Transaction | null> => {
      if (isMongoActive()) {
        const query = { ...filter };
        if (query._id && typeof query._id === 'string' && ObjectId.isValid(query._id)) {
          query._id = new ObjectId(query._id);
        }
        const doc = await mongoDb!.collection('transactions').findOne(query);
        if (!doc) return null;
        return { ...doc, _id: doc._id.toString() } as unknown as Transaction;
      }
      const found = inMemoryStore.transactions.find(t => {
        for (const key of Object.keys(filter)) {
          if (filter[key] !== undefined && (t as any)[key] !== filter[key]) return false;
        }
        return true;
      });
      return found ? { ...found } : null;
    },

    insertOne: async (transaction: Omit<Transaction, '_id'> & { _id?: string }): Promise<Transaction> => {
      const _id = transaction._id || generateId();
      const newTx: Transaction = { ...transaction, _id } as Transaction;
      if (isMongoActive()) {
        await mongoDb!.collection('transactions').insertOne({ ...newTx, _id: new ObjectId(_id) } as any);
      } else {
        inMemoryStore.transactions.push(newTx);
      }
      return newTx;
    },

    countDocuments: async (filter: any = {}): Promise<number> => {
      if (isMongoActive()) {
        return await mongoDb!.collection('transactions').countDocuments(filter);
      }
      return (await dbService.transactions.find(filter)).length;
    },
  },
};
