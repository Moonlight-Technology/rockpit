ALTER TABLE "Board"
ADD COLUMN "closedAt" TIMESTAMP(3);

CREATE INDEX "Board_closedAt_idx" ON "Board"("closedAt");
