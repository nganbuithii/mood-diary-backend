-- CreateTable
CREATE TABLE "future_letters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "moodAtWriting" "Mood",
    "deliverAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "future_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "future_letters_userId_deliverAt_idx" ON "future_letters"("userId", "deliverAt");

-- CreateIndex
CREATE INDEX "future_letters_emailSentAt_deliverAt_idx" ON "future_letters"("emailSentAt", "deliverAt");

-- AddForeignKey
ALTER TABLE "future_letters" ADD CONSTRAINT "future_letters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

