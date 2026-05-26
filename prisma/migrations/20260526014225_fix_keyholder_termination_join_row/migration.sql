/*
  Warnings:

  - You are about to drop the column `terminatedAt` on the `KeyholderRelationship` table. All the data in the column will be lost.
  - You are about to drop the column `terminationReason` on the `KeyholderRelationship` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "KeyholderRelationship" DROP COLUMN "terminatedAt",
DROP COLUMN "terminationReason";

-- AlterTable
ALTER TABLE "KeyholderRelationshipBox" ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT;
