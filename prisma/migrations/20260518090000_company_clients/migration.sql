-- CreateTable
CREATE TABLE "public"."CompanyClient" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyClient_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."CompanyLead"
ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE INDEX "CompanyClient_companyId_name_idx" ON "public"."CompanyClient"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyLead_companyId_clientId_idx" ON "public"."CompanyLead"("companyId", "clientId");

-- AddForeignKey
ALTER TABLE "public"."CompanyClient"
ADD CONSTRAINT "CompanyClient_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyLead"
ADD CONSTRAINT "CompanyLead_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."CompanyClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
