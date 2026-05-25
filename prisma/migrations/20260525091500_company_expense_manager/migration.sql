-- CreateTable
CREATE TABLE "public"."CompanyMoneyAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."MoneyAccountType" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "public"."MoneyCategoryKind" NOT NULL DEFAULT 'BOTH',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
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

    CONSTRAINT "CompanyMoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyBudgetPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyBudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyBudgetBucket" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyBudgetBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyBudgetBucketCategory" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyBudgetBucketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyWishlistItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedPrice" INTEGER NOT NULL DEFAULT 0,
    "priority" "public"."MoneyWishlistPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."MoneyWishlistStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyWishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyReceivable" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "originalAmount" INTEGER NOT NULL,
    "remainingAmount" INTEGER NOT NULL,
    "status" "public"."MoneyReceivableStatus" NOT NULL DEFAULT 'ACTIVE',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanyMoneyReceivablePayment" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMoneyReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyMoneyAccount_companyId_type_idx" ON "public"."CompanyMoneyAccount"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMoneyCategory_companyId_name_key" ON "public"."CompanyMoneyCategory"("companyId", "name");

-- CreateIndex
CREATE INDEX "CompanyMoneyCategory_companyId_isActive_idx" ON "public"."CompanyMoneyCategory"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "CompanyMoneyTransaction_companyId_occurredAt_idx" ON "public"."CompanyMoneyTransaction"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "CompanyMoneyTransaction_accountId_idx" ON "public"."CompanyMoneyTransaction"("accountId");

-- CreateIndex
CREATE INDEX "CompanyMoneyTransaction_fromAccountId_idx" ON "public"."CompanyMoneyTransaction"("fromAccountId");

-- CreateIndex
CREATE INDEX "CompanyMoneyTransaction_toAccountId_idx" ON "public"."CompanyMoneyTransaction"("toAccountId");

-- CreateIndex
CREATE INDEX "CompanyMoneyTransaction_receivableId_idx" ON "public"."CompanyMoneyTransaction"("receivableId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMoneyBudgetPlan_companyId_month_key" ON "public"."CompanyMoneyBudgetPlan"("companyId", "month");

-- CreateIndex
CREATE INDEX "CompanyMoneyBudgetBucket_budgetPlanId_position_idx" ON "public"."CompanyMoneyBudgetBucket"("budgetPlanId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMoneyBudgetBucketCategory_bucketId_categoryId_key" ON "public"."CompanyMoneyBudgetBucketCategory"("bucketId", "categoryId");

-- CreateIndex
CREATE INDEX "CompanyMoneyWishlistItem_companyId_status_idx" ON "public"."CompanyMoneyWishlistItem"("companyId", "status");

-- CreateIndex
CREATE INDEX "CompanyMoneyReceivable_companyId_status_idx" ON "public"."CompanyMoneyReceivable"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMoneyReceivablePayment_transactionId_key" ON "public"."CompanyMoneyReceivablePayment"("transactionId");

-- CreateIndex
CREATE INDEX "CompanyMoneyReceivablePayment_receivableId_paidAt_idx" ON "public"."CompanyMoneyReceivablePayment"("receivableId", "paidAt");

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyAccount" ADD CONSTRAINT "CompanyMoneyAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyCategory" ADD CONSTRAINT "CompanyMoneyCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyTransaction" ADD CONSTRAINT "CompanyMoneyTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyTransaction" ADD CONSTRAINT "CompanyMoneyTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."CompanyMoneyCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyTransaction" ADD CONSTRAINT "CompanyMoneyTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."CompanyMoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyTransaction" ADD CONSTRAINT "CompanyMoneyTransaction_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "public"."CompanyMoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyTransaction" ADD CONSTRAINT "CompanyMoneyTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "public"."CompanyMoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyTransaction" ADD CONSTRAINT "CompanyMoneyTransaction_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "public"."CompanyMoneyReceivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyBudgetPlan" ADD CONSTRAINT "CompanyMoneyBudgetPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyBudgetBucket" ADD CONSTRAINT "CompanyMoneyBudgetBucket_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "public"."CompanyMoneyBudgetPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyBudgetBucketCategory" ADD CONSTRAINT "CompanyMoneyBudgetBucketCategory_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "public"."CompanyMoneyBudgetBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyBudgetBucketCategory" ADD CONSTRAINT "CompanyMoneyBudgetBucketCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."CompanyMoneyCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyWishlistItem" ADD CONSTRAINT "CompanyMoneyWishlistItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyReceivable" ADD CONSTRAINT "CompanyMoneyReceivable_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyReceivablePayment" ADD CONSTRAINT "CompanyMoneyReceivablePayment_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "public"."CompanyMoneyReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CompanyMoneyReceivablePayment" ADD CONSTRAINT "CompanyMoneyReceivablePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "public"."CompanyMoneyTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
