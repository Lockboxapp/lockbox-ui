// ============================================================
// app/api/boxes/[id]/keyholder-status/route.ts
// GET /api/boxes/:id/keyholder-status
//
// Lean payload purpose-built for the native request-unlock
// screen. Answers ONLY what that screen needs:
//   - Which keyholders can I send a request to right now?
//   - Is there already an active request?
//   - Am I inside a 24-hour cooldown?
//
// Board decision (Sprint 5): owner picks exactly one keyholder
// per request. Even if a box has multiple ACTIVE relationships,
// only one gets the notification.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const box = await prisma.box.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!box) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (box.userId !== userId) {
      // 404 not 403 so existence isn't leaked.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Pull every ACTIVE relationship that covers this box.
    const relationships = await prisma.keyholderRelationship.findMany({
      where: {
        userId,
        status: "ACTIVE",
        OR: [
          { scopeType: "ALL" },
          { scopeType: "SELECTED", boxes: { some: { boxId: id } } },
        ],
      },
      include: { profile: { select: { email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    // The most-recent unlock request on this box drives both the
    // active-request state and the cooldown gate.
    const lastRequest = await prisma.unlockRequest.findFirst({
      where: { boxId: id },
      orderBy: { requestedAt: "desc" },
      include: {
        // Pull the keyholder profile via the stored relationship id
        // so the UI can show "waiting on Alice" even if multiple
        // keyholders are on file.
      },
    });

    const now = Date.now();

    const activeRequest =
      lastRequest && lastRequest.status === "PENDING"
        ? {
            id: lastRequest.id,
            requestType: lastRequest.requestType,
            requestedAt: lastRequest.requestedAt.toISOString(),
            expiresAt: lastRequest.expiresAt?.toISOString() ?? null,
            secondsRemaining: lastRequest.expiresAt
              ? Math.max(
                  0,
                  Math.floor(
                    (lastRequest.expiresAt.getTime() - now) / 1000,
                  ),
                )
              : null,
            keyholder:
              lastRequest.keyholderRelationshipId != null
                ? await resolveKeyholderForRequest(
                    lastRequest.keyholderRelationshipId,
                  )
                : null,
          }
        : null;

    // Cooldown: present when the last request has a cooldownUntil
    // in the future (set on deny or on cron expiry).
    const cooldownActive =
      lastRequest != null &&
      lastRequest.cooldownUntil != null &&
      lastRequest.cooldownUntil.getTime() > now;
    const cooldownEndsAt = cooldownActive
      ? lastRequest!.cooldownUntil!.toISOString()
      : null;
    const cooldownSecondsRemaining = cooldownActive
      ? Math.max(
          0,
          Math.floor(
            (lastRequest!.cooldownUntil!.getTime() - now) / 1000,
          ),
        )
      : null;

    return NextResponse.json({
      hasActiveRequest: activeRequest != null,
      activeRequest,
      cooldownActive,
      cooldownEndsAt,
      cooldownSecondsRemaining,
      assignedKeyholders: relationships.map((r) => ({
        id: r.id,
        email: r.profile.email,
        name: r.profile.name,
        status: r.status,
        scopeType: r.scopeType,
      })),
    });
  } catch (err) {
    console.error("[GET /api/boxes/:id/keyholder-status]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function resolveKeyholderForRequest(relationshipId: string) {
  const rel = await prisma.keyholderRelationship.findUnique({
    where: { id: relationshipId },
    include: { profile: { select: { email: true, name: true } } },
  });
  if (!rel) return null;
  return {
    id: rel.id,
    email: rel.profile.email,
    name: rel.profile.name,
  };
}
