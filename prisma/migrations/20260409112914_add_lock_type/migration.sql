-- CreateEnum
CREATE TYPE "LockType" AS ENUM ('HARD', 'SOFT', 'KEYHOLDER');

-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "lockType" "LockType" NOT NULL DEFAULT 'SOFT';
