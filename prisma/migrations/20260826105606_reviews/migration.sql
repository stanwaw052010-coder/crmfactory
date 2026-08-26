-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "reviewDelayHours" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "reviewPublicUrl" TEXT,
ADD COLUMN     "reviewsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'PENDING',
    "sendAfter" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "rating" INTEGER,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "replyText" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_tokenHash_key" ON "Review"("tokenHash");

-- CreateIndex
CREATE INDEX "Review_organizationId_submittedAt_idx" ON "Review"("organizationId", "submittedAt");

-- CreateIndex
CREATE INDEX "Review_organizationId_rating_idx" ON "Review"("organizationId", "rating");

-- CreateIndex
CREATE INDEX "Review_status_sendAfter_idx" ON "Review"("status", "sendAfter");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Оцінка або відсутня, або від 1 до 5. Перевірка на рівні бази, а не лише
-- Zod: у таблицю пишуть і сервер, і майбутні скрипти, а «шість зірок»
-- потім не виправиш жодною статистикою.
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range"
  CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
