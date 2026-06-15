ALTER TABLE "public"."Task"
  ADD COLUMN "trackedByTimer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "actualDurationMinutes" INTEGER;
