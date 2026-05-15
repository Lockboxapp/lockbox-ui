-- AlterTable
ALTER TABLE "Box" ADD COLUMN     "temporaryUnlockExpiresAt" TIMESTAMP(3);
ALTER TABLE "Box" ADD COLUMN     "originalLockType" "LockType";

-- CreateIndex
CREATE INDEX "Box_temporaryUnlockExpiresAt_idx" ON "Box"("temporaryUnlockExpiresAt");
