// ============================================================
// app/api/boxes/route.ts
// GET  /api/boxes  — list all boxes for the authed user
// POST /api/boxes  — create a new box
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";
import {
  createDepositAccountForCustomer,
  getServerCustomerToken,
} from "@/lib/unit";
import { getServerPosthog } from "@/lib/posthog-server";
import { getRequestUserId } from "@/lib/mobile-auth";

// ------------------------------------------------------------
// GET — return all boxes for the authenticated user
// Sprint 2 (native): auth resolved via getRequestUserId so this
// route works for both the NextAuth session cookie (web) and the
// Authorization: Bearer header (mobile).
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sprint 4 — lazy-backfill Wallet for existing users who signed up before the feature
    const walletExists = await prisma.box.findFirst({
      where: { userId, isWallet: true },
      select: { id: true },
    });
    if (!walletExists) {
      await prisma.box.create({
        data: {
          userId,
          name: "Wallet",
          status: "CREATED",
          lockType: "SOFT",
          isWallet: true,
          balance: 0,
          lockedAmount: 0,
        },
      });
    }

    const { searchParams } = new URL(req.url);
    const includeClosed = searchParams.get("includeClosed") === "1";
    const closedOnly = searchParams.get("closed") === "1";

    const boxes = await prisma.box.findMany({
      where: {
        userId,
        ...(closedOnly ? { isClosed: true } : includeClosed ? {} : { isClosed: false }),
      },
      include: {
        unlockRequests: {
          where: { status: "PENDING" },
          orderBy: { requestedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Sprint 4 — surface a server-computed `isTemporarilyUnlocked`
    // flag alongside the raw fields so the native client doesn't
    // have to compute the boundary itself. We compute against
    // `Date.now()` on the server at response time; clients will
    // re-evaluate via their own countdown for sub-second freshness.
    const responseNow = Date.now();
    const responseBoxes = boxes.map((b) => ({
      ...b,
      isTemporarilyUnlocked:
        b.temporaryUnlockExpiresAt != null &&
        b.temporaryUnlockExpiresAt.getTime() > responseNow,
    }));
    return NextResponse.json(responseBoxes);
  } catch (error) {
    console.error("[GET /api/boxes]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ------------------------------------------------------------
// POST — create a new box for the authenticated user
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user including Unit customer ID
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, unitCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      description,
      targetAmount,
      targetAmountCents,
      lockUntil: lockUntilRaw,
      targetDate,
      lockType,
      keyholderRelationshipId,
      initialDepositInDollars,
    } = body;

    // Native client sends `targetDate`; the legacy web client sends
    // `lockUntil`. Accept either so a single backend serves both.
    const lockUntil = lockUntilRaw ?? targetDate ?? null;

    // `targetAmountCents` (native, integer cents) wins when present;
    // otherwise fall back to the legacy web shape `targetAmount`
    // (dollars, multiplied to cents at write time).
    const targetAmountInCents =
      targetAmountCents != null
        ? Math.round(targetAmountCents)
        : targetAmount != null
          ? Math.round(targetAmount * 100)
          : null;

    // Validate lockType
    const validLockTypes = ["HARD", "SOFT", "KEYHOLDER"];
    const resolvedLockType =
      lockType && validLockTypes.includes(lockType) ? lockType : "SOFT";

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "Name must be 50 characters or fewer" }, { status: 400 });
    }

    // Sprint 5 — HARD and KEYHOLDER boxes auto-lock at creation
    const autoLock = resolvedLockType === "HARD" || resolvedLockType === "KEYHOLDER";
    const initialDepositCents =
      typeof initialDepositInDollars === "number" && Number.isFinite(initialDepositInDollars) && initialDepositInDollars >= 1
        ? Math.round(initialDepositInDollars * 100)
        : 0;

    const box = await prisma.box.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        targetAmount: targetAmountInCents,
        lockType: resolvedLockType,
        lockUntil: lockUntil ? new Date(lockUntil) : null,
        status: autoLock ? BOX_STATUS.LOCKED : BOX_STATUS.CREATED,
        balance: initialDepositCents,
        lockedAmount: autoLock ? initialDepositCents : 0,
        userId: userId,
        isWallet: false, // Wallet is only created via signup or lazy-backfill
      },
    });

    // Record the initial deposit as a Transaction for activity feed
    if (initialDepositCents > 0) {
      await prisma.transaction.create({
        data: {
          userId: userId,
          boxId: box.id,
          type: "DEPOSIT",
          amount: initialDepositCents,
          description: `Initial deposit to ${box.name}`,
        },
      });
    }

    // If the user has a Unit customer ID, create a deposit account for this box
    if (user.unitCustomerId) {
      try {
        const customerToken = await getServerCustomerToken(user.unitCustomerId);

        const unitAccount = await createDepositAccountForCustomer({
          customerId: user.unitCustomerId,
          customerToken,
          tags: {
            boxId: box.id,
            boxName: box.name,
            userId: userId,
          },
        });

        await prisma.box.update({
          where: { id: box.id },
          data: { unitAccountId: unitAccount.data.id },
        });
      } catch (unitError) {
        // Don't fail box creation if Unit fails — log and continue
        console.error(
          "[POST /api/boxes] Unit account creation failed:",
          unitError,
        );
      }
    }

    // If KEYHOLDER lockType and a relationship was provided, link it to this box
    if (resolvedLockType === "KEYHOLDER" && keyholderRelationshipId) {
      try {
        const rel = await prisma.keyholderRelationship.findFirst({
          where: { id: keyholderRelationshipId, userId: userId },
        });
        if (rel) {
          await prisma.keyholderRelationshipBox.create({
            data: { relationshipId: keyholderRelationshipId, boxId: box.id },
          });
        }
      } catch (khErr) {
        // Non-fatal: box was created; just log the failure
        console.error("[POST /api/boxes] keyholder link failed:", khErr);
      }
    }

    const ph = getServerPosthog();
    ph.capture({
      distinctId: userId,
      event: "box_created",
      properties: { lockType: resolvedLockType },
    });
    await ph.shutdown();

    return NextResponse.json(box, { status: 201 });
  } catch (error) {
    console.error("[POST /api/boxes]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
