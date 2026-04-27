-- CreateEnum
CREATE TYPE "ProjectResourceKind" AS ENUM ('TEXT', 'URL', 'SECRET');

-- CreateTable
CREATE TABLE "BoardProjectInfo" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardProjectInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardProjectResource" (
    "id" TEXT NOT NULL,
    "projectInfoId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "kind" "ProjectResourceKind" NOT NULL DEFAULT 'TEXT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardProjectResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardProjectInfo_boardId_key" ON "BoardProjectInfo"("boardId");

-- CreateIndex
CREATE INDEX "BoardProjectResource_projectInfoId_position_idx" ON "BoardProjectResource"("projectInfoId", "position");

-- AddForeignKey
ALTER TABLE "BoardProjectInfo" ADD CONSTRAINT "BoardProjectInfo_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardProjectResource" ADD CONSTRAINT "BoardProjectResource_projectInfoId_fkey" FOREIGN KEY ("projectInfoId") REFERENCES "BoardProjectInfo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
