// ============================================================
// app/api/boxes/route.ts
// GET  /api/boxes  — list all boxes for the authed user
// POST /api/boxes  — create a new box
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { BOX_STATUS } from "@/lib/types";
import {
  createDepositAccountForCustomer,
  getServerCustomerToken,
} from "@/lib/unit";

// ------------------------------------------------------------
// GET — return all boxes for the authenticated user
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sprint 4 — lazy-backfill Wallet for existing users who signed up before the feature
    const walletExists = await prisma.box.findFirst({
      where: { userId: session.user.id, isWallet: true },
      select: { id: true },
    });
    if (!walletExists) {
      await prisma.box.create({
        data: {
          userId: session.user.id,
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
        userId: session.user.id,
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

    return NextResponse.json(boxes);
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
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user including Unit customer ID
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, unitCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, description, targetAmount, lockUntil, lockType, keyholderRelationshipId } = body;

    // Validate lockType
    const validLockTypes = ["HARD", "SOFT", "KEYHOLDER"];
    const resolvedLockType =
      lockType && validLockTypes.includes(lockType) ? lockType : "SOFT";

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const box = await prisma.box.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        targetAmount: targetAmount ? Math.round(targetAmount * 100) : null,
        lockType: resolvedLockType,
        lockUntil: lockUntil ? new Date(lockUntil) : null,
        status: BOX_STATUS.CREATED,
        userId: session.user.id,
        isWallet: false, // Wallet is only created via signup or lazy-backfill
      },
    });

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
            userId: session.user.id,
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
          where: { id: keyholderRelationshipId, userId: session.user.id },
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

    return NextResponse.json(box, { status: 201 });
  } catch (error) {
    console.error("[POST /api/boxes]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
