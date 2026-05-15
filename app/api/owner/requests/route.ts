// ============================================================
// app/api/owner/requests/route.ts
// GET /api/owner/requests
//
// Read-only owner-side view of unlock + transfer requests the
// current user has submitted (i.e. requests against their own
// boxes). Used by the native /owner-requests screen.
//
// Sprint 3 — no actions in this response. Owner cancel is a
// future sprint.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

export const runtime = "nodejs";

// Surfaced statuses. CANCELLED_BY_USER and FAILED are kept in the
// response so owners can see resolution history without surprises.
const SURFACED_STATUSES = [
  "PENDING",
  "APPROVED",
  "DENIED",
  "EXPIRED",
  "PENDING_USER_ACCEPTANCE",
  "CANCELLED_BY_USER",
  "FAILED",
];

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.unlockRequest.findMany({
      where: {
        box: { userId },
        status: { in: SURFACED_STATUSES },
      },
      orderBy: { requestedAt: "desc" },
      take: 50,
      include: {
        box: {
          select: {
            id: true,
            name: true,
            lockType: true,
            balance: true,
          },
        },
      },
    });

    // Pull keyholder info per request so owners know who is on
    // file. We resolve the active keyholder for the box at request
    // time — the actual approver could differ historically, but
    // for v1 surface the current one.
    const boxIds = Array.from(new Set(requests.map((r) => r.boxId)));
    const relsByBoxId = new Map<
      string,
      { email: string; name: string | null }
    >();
    if (boxIds.length > 0) {
      const rels = await prisma.keyholderRelationship.findMany({
        where: {
          userId,
          status: "ACTIVE",
          OR: [
            { scopeType: "ALL" },
            {
              scopeType: "SELECTED",
              boxes: { some: { boxId: { in: boxIds } } },
            },
          ],
        },
        include: {
          profile: { select: { email: true, name: true } },
          boxes: { select: { boxId: true } },
        },
      });
      // For ALL-scoped relationships, every box gets that profile.
      // For SELECTED, only the join-table boxIds.
      for (const rel of rels) {
        const profile = { email: rel.profile.email, name: rel.profile.name };
        if (rel.scopeType === "ALL") {
          for (const id of boxIds) {
            if (!relsByBoxId.has(id)) relsByBoxId.set(id, profile);
          }
        } else {
          for (const b of rel.boxes) {
            if (boxIds.includes(b.boxId)) {
              if (!relsByBoxId.has(b.boxId)) relsByBoxId.set(b.boxId, profile);
            }
          }
        }
      }
    }

    // Resolve destination box names for TRANSFER requests in one batch.
    const destIds = Array.from(
      new Set(
        requests
          .filter((r) => r.requestType === "TRANSFER" && r.destinationBoxId)
          .map((r) => r.destinationBoxId!),
      ),
    );
    const destsById = new Map<string, string>();
    if (destIds.length > 0) {
      const dests = await prisma.box.findMany({
        where: { id: { in: destIds } },
        select: { id: true, name: true },
      });
      for (const d of dests) destsById.set(d.id, d.name);
    }

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        requestType: r.requestType,
        status: r.status,
        reason: r.reason,
        transferAmountCents: r.transferAmount ?? null,
        destinationBoxName: r.destinationBoxId
          ? destsById.get(r.destinationBoxId) ?? null
          : null,
        requestedAt: r.requestedAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        cooldownUntil: r.cooldownUntil?.toISOString() ?? null,
        box: {
          id: r.box.id,
          name: r.box.name,
          lockType: r.box.lockType,
          balanceCents: r.box.balance,
        },
        keyholder: relsByBoxId.get(r.boxId)
          ? {
              email: relsByBoxId.get(r.boxId)!.email,
              name: relsByBoxId.get(r.boxId)!.name,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error("[GET /api/owner/requests]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
