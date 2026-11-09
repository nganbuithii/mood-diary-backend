-- CreateTable
CREATE TABLE "user_achievements" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "seenLevel" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("userId","achievementId")
);

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

