ALTER TABLE "BoardMember"
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pinnedAt" TIMESTAMP(3);

CREATE INDEX "BoardMember_userId_isPinned_idx" ON "BoardMember"("userId", "isPinned");
