CREATE TABLE "public"."TaskDependency" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "dependsOnTaskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskDependency_taskId_dependsOnTaskId_key" ON "public"."TaskDependency"("taskId", "dependsOnTaskId");
CREATE INDEX "TaskDependency_dependsOnTaskId_idx" ON "public"."TaskDependency"("dependsOnTaskId");

ALTER TABLE "public"."TaskDependency" ADD CONSTRAINT "TaskDependency_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."TaskDependency" ADD CONSTRAINT "TaskDependency_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
