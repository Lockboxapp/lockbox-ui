-- AlterTable
ALTER TABLE "WaitlistEntry" ADD COLUMN     "email1SentAt" TIMESTAMP(3),
ADD COLUMN     "email2SentAt" TIMESTAMP(3),
ADD COLUMN     "email3SentAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribed" BOOLEAN NOT NULL DEFAULT false;
