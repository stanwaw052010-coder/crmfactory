-- Проміжний стан черги нагадувань: задачу забрав воркер.
-- Потрібен, щоб два одночасні запуски планувальника не надіслали
-- клієнту одне нагадування двічі.
ALTER TYPE "ReminderStatus" ADD VALUE 'SENDING';

-- `updatedAt` показує, коли задачу востаннє чіпали. За ним воркер
-- повертає в чергу задачі, що зависли в SENDING після падіння процесу.
--
-- DEFAULT потрібен лише для заповнення наявних рядків і одразу
-- знімається: значення проставляє Prisma (@updatedAt), а не база.
ALTER TABLE "ReminderJob" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ReminderJob" ALTER COLUMN "updatedAt" DROP DEFAULT;
