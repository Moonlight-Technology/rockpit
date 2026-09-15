CREATE TABLE "public"."TaskNetworkPosition" (
  "id" TEXT NOT NULL,
  "boardId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskNetworkPosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskNetworkPosition_boardId_taskId_key" ON "public"."TaskNetworkPosition"("boardId", "taskId");
CREATE INDEX "TaskNetworkPosition_boardId_idx" ON "public"."TaskNetworkPosition"("boardId");
CREATE INDEX "TaskNetworkPosition_taskId_idx" ON "public"."TaskNetworkPosition"("taskId");

ALTER TABLE "public"."TaskNetworkPosition" ADD CONSTRAINT "TaskNetworkPosition_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "public"."Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TaskNetworkPosition" ADD CONSTRAINT "TaskNetworkPosition_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
