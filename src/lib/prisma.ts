import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

declare global {
  var prismaInstance: PrismaClient | undefined;
}

export const prisma = globalThis.prismaInstance || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaInstance = prisma;
}

export default prisma;
