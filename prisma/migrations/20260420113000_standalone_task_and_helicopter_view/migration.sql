-- Add createdById as nullable first so existing rows can be backfilled safely
ALTER TABLE "public"."Task" ADD COLUMN "createdById" TEXT;

-- Backfill createdById from assignee first, then board owner
UPDATE "public"."Task" t
SET "createdById" = COALESCE(t."assigneeId", b."ownerId")
FROM "public"."Board" b
WHERE t."boardId" = b."id"
  AND t."createdById" IS NULL;

-- Final fallback: oldest user in the system (if any row is still null)
UPDATE "public"."Task" t
SET "createdById" = u."id"
FROM (
  SELECT "id"
  FROM "public"."User"
  ORDER BY "createdAt" ASC
  LIMIT 1
) u
WHERE t."createdById" IS NULL;

-- Guardrail: stop migration if rows are still null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."Task"
    WHERE "createdById" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot set Task.createdById to NOT NULL because some rows are still NULL';
  END IF;
END $$;

-- Make board/column optional for standalone tasks
ALTER TABLE "public"."Task" ALTER COLUMN "boardId" DROP NOT NULL;
ALTER TABLE "public"."Task" ALTER COLUMN "columnId" DROP NOT NULL;

-- Enforce required creator after backfill
ALTER TABLE "public"."Task" ALTER COLUMN "createdById" SET NOT NULL;

-- Recreate FKs to match new onDelete behavior
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_boardId_fkey";
ALTER TABLE "public"."Task" DROP CONSTRAINT "Task_columnId_fkey";

ALTER TABLE "public"."Task"
  ADD CONSTRAINT "Task_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "public"."Board"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Task"
  ADD CONSTRAINT "Task_columnId_fkey"
  FOREIGN KEY ("columnId") REFERENCES "public"."BoardColumn"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Task"
  ADD CONSTRAINT "Task_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "public"."User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Task_createdById_idx" ON "public"."Task"("createdById");
