-- AlterTable
ALTER TABLE "mood_entries" ADD COLUMN     "isFavorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "mood_entries_userId_isFavorite_entryDate_idx" ON "mood_entries"("userId", "isFavorite", "entryDate");
