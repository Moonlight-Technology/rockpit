-- AlterTable
ALTER TABLE "public"."Board" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
