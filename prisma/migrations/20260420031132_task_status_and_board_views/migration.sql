-- CreateEnum
CREATE TYPE "public"."TaskStatus" AS ENUM ('TODO', 'DONE');

-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "status" "public"."TaskStatus" NOT NULL DEFAULT 'TODO';
