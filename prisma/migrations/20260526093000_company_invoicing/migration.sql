CREATE TYPE "CompanyInvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

CREATE TABLE "CompanyInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "status" "CompanyInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "issuedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "CompanyInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyInvoice_companyId_invoiceNumber_key"
  ON "CompanyInvoice"("companyId", "invoiceNumber");
CREATE INDEX "CompanyInvoice_companyId_createdAt_idx"
  ON "CompanyInvoice"("companyId", "createdAt");
CREATE INDEX "CompanyInvoice_quotationId_status_idx"
  ON "CompanyInvoice"("quotationId", "status");
CREATE INDEX "CompanyInvoiceLine_invoiceId_position_idx"
  ON "CompanyInvoiceLine"("invoiceId", "position");

ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_quotationId_fkey"
  FOREIGN KEY ("quotationId") REFERENCES "CompanyQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "CompanyLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice"
  ADD CONSTRAINT "CompanyInvoice_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoiceLine"
  ADD CONSTRAINT "CompanyInvoiceLine_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "CompanyInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
