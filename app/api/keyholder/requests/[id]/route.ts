// ============================================================
// app/api/keyholder/requests/[id]/route.ts
// GET /api/keyholder/requests/:id
//
// Returns the detail of a single UnlockRequest by id — but only
// when the signed-in user is an active keyholder for the owning
// box. The approvalToken is NEVER included in the response (board
// rule §16 #2: keyholder approval token never visible to the
// requesting user — same rule applies in reverse for the
// keyholder too, since the token is the email-link credential).
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

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!me?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const myEmail = me.email.toLowerCase();

    const unlockRequest = await prisma.unlockRequest.findUnique({
      where: { id },
      include: {
        box: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });
    if (!unlockRequest) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Authorize: must be the active keyholder on this box.
    const activeRelationship = await prisma.keyholderRelationship.findFirst({
      where: {
        userId: unlockRequest.box.userId,
        status: "ACTIVE",
        OR: [
          { scopeType: "ALL" },
          {
            scopeType: "SELECTED",
            boxes: { some: { boxId: unlockRequest.boxId } },
          },
        ],
      },
      include: { profile: true },
    });
    if (
      !activeRelationship ||
      (activeRelationship.profile.email ?? "").toLowerCase() !== myEmail
    ) {
      // Do not reveal the request exists — return 404.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Resolve destination box name for TRANSFER requests.
    let destinationBoxName: string | null = null;
    if (
      unlockRequest.requestType === "TRANSFER" &&
      unlockRequest.destinationBoxId
    ) {
      const dest = await prisma.box.findUnique({
        where: { id: unlockRequest.destinationBoxId },
        select: { name: true },
      });
      destinationBoxName = dest?.name ?? null;
    }

    return NextResponse.json({
      id: unlockRequest.id,
      status: unlockRequest.status,
      requestType: unlockRequest.requestType,
      reason: unlockRequest.reason,
      reflection: unlockRequest.reflection,
      transferAmountCents: unlockRequest.transferAmount ?? null,
      destinationBoxName,
      requestedAt: unlockRequest.requestedAt.toISOString(),
      resolvedAt: unlockRequest.resolvedAt?.toISOString() ?? null,
      cooldownUntil: unlockRequest.cooldownUntil?.toISOString() ?? null,
      box: {
        id: unlockRequest.box.id,
        name: unlockRequest.box.name,
        lockType: unlockRequest.box.lockType,
        balanceCents: unlockRequest.box.balance,
        lockUntil: unlockRequest.box.lockUntil?.toISOString() ?? null,
        status: unlockRequest.box.status,
      },
      owner: {
        name: unlockRequest.box.user.name,
        email: unlockRequest.box.user.email,
      },
    });
  } catch (err) {
    console.error("[GET /api/keyholder/requests/:id]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
