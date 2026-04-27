-- AlterTable
ALTER TABLE "BoardProjectResource"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'General',
ADD COLUMN "resourceKey" TEXT NOT NULL DEFAULT '';

-- Backfill from existing label when key is empty
UPDATE "BoardProjectResource"
SET "resourceKey" = "label"
WHERE "resourceKey" = '';
