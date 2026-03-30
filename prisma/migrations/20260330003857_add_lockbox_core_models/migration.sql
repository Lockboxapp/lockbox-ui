-- CreateTable
CREATE TABLE "Box" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "targetAmount" INTEGER,
    "lockUntil" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Box_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Keyholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boxId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "inviteToken" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Keyholder_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnlockRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boxId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reflection" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvalToken" TEXT NOT NULL,
    "cooldownUntil" DATETIME,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UnlockRequest_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "postedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "vaultId" TEXT,
    "boxId" TEXT,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "Box" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "categoryId", "createdAt", "description", "id", "postedAt", "type", "updatedAt", "userId", "vaultId") SELECT "amount", "categoryId", "createdAt", "description", "id", "postedAt", "type", "updatedAt", "userId", "vaultId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_postedAt_idx" ON "Transaction"("userId", "postedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Box_userId_idx" ON "Box"("userId");

-- CreateIndex
CREATE INDEX "Box_status_idx" ON "Box"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Keyholder_boxId_key" ON "Keyholder"("boxId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyholder_inviteToken_key" ON "Keyholder"("inviteToken");

-- CreateIndex
CREATE INDEX "Keyholder_email_idx" ON "Keyholder"("email");

-- CreateIndex
CREATE INDEX "Keyholder_inviteToken_idx" ON "Keyholder"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockRequest_approvalToken_key" ON "UnlockRequest"("approvalToken");

-- CreateIndex
CREATE INDEX "UnlockRequest_boxId_idx" ON "UnlockRequest"("boxId");

-- CreateIndex
CREATE INDEX "UnlockRequest_approvalToken_idx" ON "UnlockRequest"("approvalToken");

-- CreateIndex
CREATE INDEX "UnlockRequest_status_idx" ON "UnlockRequest"("status");
