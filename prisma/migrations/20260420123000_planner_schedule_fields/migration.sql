ALTER TABLE "public"."Task"
  ADD COLUMN "plannedStartAt" TIMESTAMP(3),
  ADD COLUMN "plannedDurationMinutes" INTEGER;
