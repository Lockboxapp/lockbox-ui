/*
  Warnings:

  - You are about to drop the `Keyholder` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "KeyholderScopeType" AS ENUM ('ALL', 'SELECTED');

-- CreateEnum
CREATE TYPE "KeyholderRelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REVOKED');

-- CreateEnum
CREATE TYPE "KeyholderOTPPurpose" AS ENUM ('INVITE', 'APPROVAL');

-- CreateEnum
CREATE TYPE "KeyholderSessionPurpose" AS ENUM ('INVITE', 'APPROVAL');

-- DropForeignKey
ALTER TABLE "Keyholder" DROP CONSTRAINT "Keyholder_boxId_fkey";

-- DropTable
DROP TABLE "Keyholder";

-- CreateTable
CREATE TABLE "KeyholderProfile" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyholderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyholderRelationship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "scopeType" "KeyholderScopeType" NOT NULL DEFAULT 'ALL',
    "status" "KeyholderRelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "inviteToken" TEXT NOT NULL,
    "inviteExpiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "safetyMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeyholderRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyholderRelationshipBox" (
    "id" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,

    CONSTRAINT "KeyholderRelationshipBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyholderOTP" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileId" TEXT,
    "codeHash" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "purpose" "KeyholderOTPPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyholderOTP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyholderSession" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileId" TEXT,
    "sessionToken" TEXT NOT NULL,
    "sourceToken" TEXT NOT NULL,
    "purpose" "KeyholderSessionPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyholderSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeyholderProfile_email_key" ON "KeyholderProfile"("email");

-- CreateIndex
CREATE INDEX "KeyholderProfile_email_idx" ON "KeyholderProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "KeyholderRelationship_inviteToken_key" ON "KeyholderRelationship"("inviteToken");

-- CreateIndex
CREATE INDEX "KeyholderRelationship_userId_idx" ON "KeyholderRelationship"("userId");

-- CreateIndex
CREATE INDEX "KeyholderRelationship_profileId_idx" ON "KeyholderRelationship"("profileId");

-- CreateIndex
CREATE INDEX "KeyholderRelationship_userId_profileId_idx" ON "KeyholderRelationship"("userId", "profileId");

-- CreateIndex
CREATE INDEX "KeyholderRelationship_inviteToken_idx" ON "KeyholderRelationship"("inviteToken");

-- CreateIndex
CREATE INDEX "KeyholderRelationship_status_idx" ON "KeyholderRelationship"("status");

-- CreateIndex
CREATE INDEX "KeyholderRelationshipBox_relationshipId_idx" ON "KeyholderRelationshipBox"("relationshipId");

-- CreateIndex
CREATE INDEX "KeyholderRelationshipBox_boxId_idx" ON "KeyholderRelationshipBox"("boxId");

-- CreateIndex
CREATE UNIQUE INDEX "KeyholderRelationshipBox_relationshipId_boxId_key" ON "KeyholderRelationshipBox"("relationshipId", "boxId");

-- CreateIndex
CREATE INDEX "KeyholderOTP_email_idx" ON "KeyholderOTP"("email");

-- CreateIndex
CREATE INDEX "KeyholderOTP_token_idx" ON "KeyholderOTP"("token");

-- CreateIndex
CREATE UNIQUE INDEX "KeyholderSession_sessionToken_key" ON "KeyholderSession"("sessionToken");

-- CreateIndex
CREATE INDEX "KeyholderSession_email_idx" ON "KeyholderSession"("email");

-- CreateIndex
CREATE INDEX "KeyholderSession_sessionToken_idx" ON "KeyholderSession"("sessionToken");

-- CreateIndex
CREATE INDEX "AuditEvent_actorId_idx" ON "AuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "KeyholderRelationship" ADD CONSTRAINT "KeyholderRelationship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyholderRelationship" ADD CONSTRAINT "KeyholderRelationship_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "KeyholderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyholderRelationshipBox" ADD CONSTRAINT "KeyholderRelationshipBox_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "KeyholderRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyholderRelationshipBox" ADD CONSTRAINT "KeyholderRelationshipBox_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyholderOTP" ADD CONSTRAINT "KeyholderOTP_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "KeyholderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyholderSession" ADD CONSTRAINT "KeyholderSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "KeyholderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
