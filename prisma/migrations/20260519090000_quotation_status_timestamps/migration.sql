-- AlterTable
ALTER TABLE "public"."CompanyQuotation"
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Backfill existing rows: copy issuedAt into the timestamp matching current status
UPDATE "public"."CompanyQuotation"
SET "sentAt" = "issuedAt"
WHERE "status" = 'SENT' AND "issuedAt" IS NOT NULL;

UPDATE "public"."CompanyQuotation"
SET "approvedAt" = "issuedAt"
WHERE "status" = 'APPROVED' AND "issuedAt" IS NOT NULL;

UPDATE "public"."CompanyQuotation"
SET "rejectedAt" = "issuedAt"
WHERE "status" = 'REJECTED' AND "issuedAt" IS NOT NULL;
