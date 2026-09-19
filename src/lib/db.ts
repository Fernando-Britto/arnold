import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton
 * Ensures only one instance of PrismaClient is created and reused
 * across the application (especially important in serverless/hot-reload environments)
 */
let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // In development, use a global variable to avoid multiple instances during hot reload
  let globalPrisma = (global as unknown as { prisma?: PrismaClient }).prisma;

  if (!globalPrisma) {
    globalPrisma = new PrismaClient();
    (global as unknown as { prisma?: PrismaClient }).prisma = globalPrisma;
  }

  prisma = globalPrisma;
}

export { prisma };
