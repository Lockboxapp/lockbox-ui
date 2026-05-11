-- DropIndex
DROP INDEX "PlaidItem_userId_key";

-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "PlaidItem_userId_isPrimary_idx" ON "PlaidItem"("userId", "isPrimary");
