-- CreateEnum
CREATE TYPE "public"."MoneyAccountType" AS ENUM ('CASH', 'BANK', 'EWALLET', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."MoneyCategoryKind" AS ENUM ('INCOME', 'EXPENSE', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."MoneyTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'LEND', 'RECEIVABLE_PAYMENT');

-- CreateEnum
CREATE TYPE "public"."MoneyWishlistPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."MoneyWishlistStatus" AS ENUM ('PLANNED', 'BOUGHT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."MoneyReceivableStatus" AS ENUM ('ACTIVE', 'PAID');

-- CreateTable
CREATE TABLE "public"."MoneyAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."MoneyAccountType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyCategory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."MoneyCategoryKind" NOT NULL DEFAULT 'BOTH',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "public"."MoneyTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "receivableId" TEXT,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyBudgetPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyBudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyBudgetBucket" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyBudgetBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyBudgetBucketCategory" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyBudgetBucketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyWishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedPrice" INTEGER NOT NULL DEFAULT 0,
    "priority" "public"."MoneyWishlistPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."MoneyWishlistStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyWishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyReceivable" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL,
    "status" "public"."MoneyReceivableStatus" NOT NULL DEFAULT 'ACTIVE',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MoneyReceivablePayment" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyAccount_userId_type_idx" ON "public"."MoneyAccount"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyCategory_userId_name_key" ON "public"."MoneyCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "MoneyCategory_userId_isActive_idx" ON "public"."MoneyCategory"("userId", "isActive");

-- CreateIndex
CREATE INDEX "MoneyTransaction_userId_occurredAt_idx" ON "public"."MoneyTransaction"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "MoneyTransaction_accountId_idx" ON "public"."MoneyTransaction"("accountId");

-- CreateIndex
CREATE INDEX "MoneyTransaction_fromAccountId_idx" ON "public"."MoneyTransaction"("fromAccountId");

-- CreateIndex
CREATE INDEX "MoneyTransaction_toAccountId_idx" ON "public"."MoneyTransaction"("toAccountId");

-- CreateIndex
CREATE INDEX "MoneyTransaction_receivableId_idx" ON "public"."MoneyTransaction"("receivableId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyBudgetPlan_userId_month_key" ON "public"."MoneyBudgetPlan"("userId", "month");

-- CreateIndex
CREATE INDEX "MoneyBudgetBucket_budgetPlanId_position_idx" ON "public"."MoneyBudgetBucket"("budgetPlanId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyBudgetBucketCategory_bucketId_categoryId_key" ON "public"."MoneyBudgetBucketCategory"("bucketId", "categoryId");

-- CreateIndex
CREATE INDEX "MoneyWishlistItem_userId_status_idx" ON "public"."MoneyWishlistItem"("userId", "status");

-- CreateIndex
CREATE INDEX "MoneyReceivable_userId_status_idx" ON "public"."MoneyReceivable"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyReceivablePayment_transactionId_key" ON "public"."MoneyReceivablePayment"("transactionId");

-- CreateIndex
CREATE INDEX "MoneyReceivablePayment_receivableId_paidAt_idx" ON "public"."MoneyReceivablePayment"("receivableId", "paidAt");

-- AddForeignKey
ALTER TABLE "public"."MoneyAccount" ADD CONSTRAINT "MoneyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyCategory" ADD CONSTRAINT "MoneyCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MoneyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "public"."MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "public"."MoneyReceivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyBudgetPlan" ADD CONSTRAINT "MoneyBudgetPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyBudgetBucket" ADD CONSTRAINT "MoneyBudgetBucket_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "public"."MoneyBudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyBudgetBucketCategory" ADD CONSTRAINT "MoneyBudgetBucketCategory_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "public"."MoneyBudgetBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyBudgetBucketCategory" ADD CONSTRAINT "MoneyBudgetBucketCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MoneyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyWishlistItem" ADD CONSTRAINT "MoneyWishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyReceivable" ADD CONSTRAINT "MoneyReceivable_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyReceivablePayment" ADD CONSTRAINT "MoneyReceivablePayment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "public"."MoneyReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MoneyReceivablePayment" ADD CONSTRAINT "MoneyReceivablePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."MoneyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
