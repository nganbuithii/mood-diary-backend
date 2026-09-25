-- AlterTable
ALTER TABLE "mood_entries" ADD COLUMN     "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
