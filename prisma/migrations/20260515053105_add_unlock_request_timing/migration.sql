-- AlterTable
ALTER TABLE "UnlockRequest" ADD COLUMN     "expiresAt" TIMESTAMP(3);
ALTER TABLE "UnlockRequest" ADD COLUMN     "keyholderRelationshipId" TEXT;

-- CreateIndex
CREATE INDEX "UnlockRequest_expiresAt_idx" ON "UnlockRequest"("expiresAt");
