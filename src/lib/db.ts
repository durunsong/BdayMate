import 'server-only';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaPg } from '@prisma/adapter-pg';
const globalDb = globalThis as unknown as { bdayPrisma?: PrismaClient };
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const host = new URL(connectionString).hostname;
  const adapter = host.endsWith('.neon.tech')
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log: [] });
}
export const db = globalDb.bdayPrisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalDb.bdayPrisma = db;
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
