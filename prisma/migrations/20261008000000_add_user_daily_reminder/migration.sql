-- AlterTable
ALTER TABLE "users" ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "reminderSentOn" DATE,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'UTC';

-- CreateIndex
CREATE INDEX "users_reminderEnabled_idx" ON "users"("reminderEnabled");
