// ============================================================
// app/api/keyholder/requests/route.ts
// GET /api/keyholder/requests
//
// Returns all PENDING UnlockRequest rows where the current
// authenticated user is the keyholder for the owning box.
//
// AUTH MODEL (mobile)
// -------------------
// This endpoint authenticates the *keyholder* via their LockBox
// Bearer token / NextAuth session. The keyholder identity is then
// matched against KeyholderProfile.email and the active
// KeyholderRelationship rows that cover each owner's box.
//
// We never use or expose UnlockRequest.approvalToken on this
// route — that secret stays in the email flow. The native client
// only ever sees UnlockRequest.id.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve the keyholder's email from the User row.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      // The user is signed in but has no email — they cannot be a
      // keyholder. Return an empty list rather than failing.
      return NextResponse.json({ requests: [] });
    }
    const email = user.email.toLowerCase();

    // KeyholderProfile is keyed by lowercased email and joins to all
    // relationships this person holds across multiple owners.
    const profile = await prisma.keyholderProfile.findUnique({
      where: { email },
      select: {
        id: true,
        relationships: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            userId: true,
            scopeType: true,
            boxes: { select: { boxId: true } },
          },
        },
      },
    });
    if (!profile || profile.relationships.length === 0) {
      return NextResponse.json({ requests: [] });
    }

    // Build the set of owner-userIds + boxIds this keyholder covers.
    // For SELECTED relationships we limit to the join-table boxIds.
    // For ALL relationships we accept any box owned by that user.
    const allOwnerIds = new Set<string>();
    const selectedBoxIds = new Set<string>();
    for (const rel of profile.relationships) {
      if (rel.scopeType === "ALL") {
        allOwnerIds.add(rel.userId);
      } else {
        for (const b of rel.boxes) selectedBoxIds.add(b.boxId);
      }
    }

    // Pull all pending unlock requests against boxes whose owner is
    // ALL-scoped to this keyholder, OR whose boxId is in the SELECTED
    // list. We never trust client input for scope — every join below
    // is enforced server-side.
    const requests = await prisma.unlockRequest.findMany({
      where: {
        status: "PENDING",
        OR: [
          ...(allOwnerIds.size > 0
            ? [{ box: { userId: { in: Array.from(allOwnerIds) } } }]
            : []),
          ...(selectedBoxIds.size > 0
            ? [{ boxId: { in: Array.from(selectedBoxIds) } }]
            : []),
        ],
      },
      orderBy: { requestedAt: "desc" },
      include: {
        box: {
          select: {
            id: true,
            name: true,
            lockType: true,
            balance: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({
      requests: requests.map((r) => {
        return {
          id: r.id,
          requestType: r.requestType, // 'UNLOCK' | 'TRANSFER'
          status: r.status,
          reason: r.reason,
          reflection: r.reflection,
          transferAmountCents: r.transferAmount ?? null,
          // destinationBoxName is resolved on the detail endpoint —
          // the list intentionally stays lean to avoid N+1.
          requestedAt: r.requestedAt.toISOString(),
          box: {
            id: r.box.id,
            name: r.box.name,
            lockType: r.box.lockType,
            balanceCents: r.box.balance,
          },
          owner: {
            name: r.box.user.name,
            email: r.box.user.email,
          },
        };
      }),
    });
  } catch (err) {
    console.error("[GET /api/keyholder/requests]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
