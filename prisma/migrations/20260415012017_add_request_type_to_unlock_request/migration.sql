-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('UNLOCK', 'TRANSFER');

-- AlterTable
ALTER TABLE "UnlockRequest" ADD COLUMN     "destinationBoxId" TEXT,
ADD COLUMN     "requestType" "RequestType" NOT NULL DEFAULT 'UNLOCK',
ADD COLUMN     "transferAmount" INTEGER;
