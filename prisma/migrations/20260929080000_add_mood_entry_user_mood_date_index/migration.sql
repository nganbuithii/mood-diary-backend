-- CreateIndex
CREATE INDEX "mood_entries_userId_mood_entryDate_idx" ON "mood_entries"("userId", "mood", "entryDate");
