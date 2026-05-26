-- AlterTable
ALTER TABLE "KeyholderRelationship" ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT;
