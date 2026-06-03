CREATE TYPE "CompanyQuotationDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

ALTER TABLE "CompanyQuotation"
ADD COLUMN "discountType" "CompanyQuotationDiscountType" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "discountValue" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0;
