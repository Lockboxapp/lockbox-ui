-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isRestricted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "restrictedAt" TIMESTAMP(3),
ADD COLUMN     "restrictedReason" TEXT;
