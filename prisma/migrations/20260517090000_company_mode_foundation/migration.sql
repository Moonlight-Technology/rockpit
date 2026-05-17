-- CreateEnum
CREATE TYPE "public"."CompanyBusinessType" AS ENUM ('JASA');

-- CreateEnum
CREATE TYPE "public"."CompanyLeadStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "public"."CompanyQuotationStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."WorkspaceType" AS ENUM ('PERSONAL', 'COMPANY');

-- AlterTable
ALTER TABLE "public"."Board"
ADD COLUMN "workspaceType" "public"."WorkspaceType" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN "companyId" TEXT,
ADD COLUMN "sourceLeadId" TEXT;

-- CreateTable
CREATE TABLE "public"."UserPremiumUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unlockSource" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPremiumUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "businessType" "public"."CompanyBusinessType" NOT NULL DEFAULT 'JASA',
    "quotationPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyLeadBoard" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLeadBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyLeadBoardMember" (
    "id" TEXT NOT NULL,
    "leadBoardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."BoardRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "CompanyLeadBoardMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyLeadColumn" (
    "id" TEXT NOT NULL,
    "leadBoardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CompanyLeadColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyLead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadBoardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prospectName" TEXT NOT NULL,
    "estimatedValue" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "stage" "public"."CompanyLeadStage" NOT NULL DEFAULT 'NEW',
    "wonAt" TIMESTAMP(3),
    "convertedProjectBoardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyQuotation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "public"."CompanyQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyQuotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyQuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CompanyQuotationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_sourceLeadId_key" ON "public"."Board"("sourceLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPremiumUnlock_userId_key" ON "public"."UserPremiumUnlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerId_slug_key" ON "public"."Company"("ownerId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ownerId_quotationPrefix_key" ON "public"."Company"("ownerId", "quotationPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLeadBoardMember_leadBoardId_userId_key" ON "public"."CompanyLeadBoardMember"("leadBoardId", "userId");

-- CreateIndex
CREATE INDEX "CompanyLeadColumn_leadBoardId_position_idx" ON "public"."CompanyLeadColumn"("leadBoardId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLead_convertedProjectBoardId_key" ON "public"."CompanyLead"("convertedProjectBoardId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyQuotation_leadId_revisionNumber_key" ON "public"."CompanyQuotation"("leadId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyQuotation_companyId_quotationNumber_revisionNumber_key" ON "public"."CompanyQuotation"("companyId", "quotationNumber", "revisionNumber");

-- CreateIndex
CREATE INDEX "CompanyQuotationLine_quotationId_position_idx" ON "public"."CompanyQuotationLine"("quotationId", "position");

-- AddForeignKey
ALTER TABLE "public"."Board" ADD CONSTRAINT "Board_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Board" ADD CONSTRAINT "Board_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "public"."CompanyLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserPremiumUnlock" ADD CONSTRAINT "UserPremiumUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLeadBoard" ADD CONSTRAINT "CompanyLeadBoard_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLeadBoardMember" ADD CONSTRAINT "CompanyLeadBoardMember_leadBoardId_fkey" FOREIGN KEY ("leadBoardId") REFERENCES "public"."CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLeadBoardMember" ADD CONSTRAINT "CompanyLeadBoardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLeadColumn" ADD CONSTRAINT "CompanyLeadColumn_leadBoardId_fkey" FOREIGN KEY ("leadBoardId") REFERENCES "public"."CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLead" ADD CONSTRAINT "CompanyLead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLead" ADD CONSTRAINT "CompanyLead_leadBoardId_fkey" FOREIGN KEY ("leadBoardId") REFERENCES "public"."CompanyLeadBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLead" ADD CONSTRAINT "CompanyLead_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "public"."CompanyLeadColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLead" ADD CONSTRAINT "CompanyLead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyQuotation" ADD CONSTRAINT "CompanyQuotation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyQuotation" ADD CONSTRAINT "CompanyQuotation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."CompanyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyQuotation" ADD CONSTRAINT "CompanyQuotation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyQuotationLine" ADD CONSTRAINT "CompanyQuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."CompanyQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
