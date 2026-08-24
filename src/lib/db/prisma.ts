import { PrismaClient } from "@prisma/client";

/**
 * Єдиний інстанс Prisma Client.
 * У dev-режимі Next.js перезавантажує модулі — без глобального кешу
 * ми б відкривали новий пул з'єднань на кожен hot-reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
