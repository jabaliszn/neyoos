/**
 * Prisma client singleton.
 * In dev, Next.js hot-reload can create many clients; we cache one on globalThis.
 * Every service file (Chunk 3 of each feature) imports `db` from here.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
