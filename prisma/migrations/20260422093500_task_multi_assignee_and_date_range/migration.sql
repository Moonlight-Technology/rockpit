ALTER TABLE "public"."User"
  ADD COLUMN "avatarUrl" TEXT;

ALTER TABLE "public"."Task"
  ADD COLUMN "startDate" TIMESTAMP(3);

CREATE TABLE "public"."TaskAssignment" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAssignment_taskId_userId_key" ON "public"."TaskAssignment"("taskId", "userId");
CREATE INDEX "TaskAssignment_userId_taskId_idx" ON "public"."TaskAssignment"("userId", "taskId");

ALTER TABLE "public"."TaskAssignment"
  ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."TaskAssignment"
  ADD CONSTRAINT "TaskAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "public"."TaskAssignment" ("id", "taskId", "userId", "createdAt", "updatedAt")
SELECT
  CONCAT('ta_', "id", '_', "assigneeId") AS "id",
  "id" AS "taskId",
  "assigneeId" AS "userId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Task"
WHERE "assigneeId" IS NOT NULL
ON CONFLICT ("taskId", "userId") DO NOTHING;
