// ============================================================
// app/api/unlock-requests/[token]/deny/route.ts
// POST /api/unlock-requests/:token/deny — keyholder denies
// ============================================================
// SECURITY RULES:
//   - Requires valid x-keyholder-session header
//   - Session must not be expired
//   - Session sourceToken must match the approvalToken in URL
//   - Session purpose must be APPROVAL
//   - Session email must match active keyholder for this box
//   - 24-hour cooldown enforced server-side after denial
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BOX_STATUS, UNLOCK_STATUS } from "@/lib/types";

async function verifyKeyholderSession(
  sessionToken: string,
  approvalToken: string,
): Promise<{ valid: boolean; profileId?: string; email?: string }> {
  const session = await prisma.keyholderSession.findUnique({
    where: { sessionToken },
  });

  if (!session) return { valid: false };
  if (session.expiresAt < new Date()) return { valid: false };
  if (session.sourceToken !== approvalToken) return { valid: false };
  if (session.purpose !== "APPROVAL") return { valid: false };

  return {
    valid: true,
    profileId: session.profileId ?? undefined,
    email: session.email,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    // Verify keyholder session
    const sessionToken = req.headers.get("x-keyholder-session");
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionCheck = await verifyKeyholderSession(sessionToken, token);
    if (!sessionCheck.valid) {
      await prisma.auditEvent.create({
        data: {
          actor: "SYSTEM",
          action: "SESSION_REJECTED",
          targetId: token,
          metadata: JSON.stringify({ reason: "invalid_or_expired_session" }),
        },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Load unlock request
    const unlockRequest = await prisma.unlockRequest.findUnique({
      where: { approvalToken: token },
      include: { box: true },
    });

    if (!unlockRequest) {
      return NextResponse.json(
        { error: "Invalid or expired approval token" },
        { status: 404 },
      );
    }

    if (unlockRequest.status !== UNLOCK_STATUS.PENDING) {
      return NextResponse.json(
        { error: `Request already ${unlockRequest.status.toLowerCase()}` },
        { status: 409 },
      );
    }

    // Verify session email matches active keyholder for this box
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
      activeRelationship.profile.email !== sessionCheck.email
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 24-hour cooldown before user can re-request
    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Deny — update unlock request and box in a transaction
    await prisma.$transaction([
      prisma.unlockRequest.update({
        where: { id: unlockRequest.id },
        data: {
          status: UNLOCK_STATUS.DENIED,
          resolvedAt: new Date(),
          cooldownUntil,
        },
      }),
      prisma.box.update({
        where: { id: unlockRequest.boxId },
        data: { status: BOX_STATUS.LOCKED },
      }),
    ]);

    // Audit event
    await prisma.auditEvent.create({
      data: {
        actor: "KEYHOLDER",
        actorId: sessionCheck.profileId ?? undefined,
        action: "REQUEST_DENIED",
        targetId: unlockRequest.id,
        metadata: JSON.stringify({
          boxId: unlockRequest.boxId,
          keyholderEmail: sessionCheck.email,
          cooldownUntil: cooldownUntil.toISOString(),
        }),
      },
    });

    return NextResponse.json({
      denied: true,
      boxName: unlockRequest.box.name,
      cooldownUntil,
    });
  } catch (error) {
    console.error("[POST /api/unlock-requests/:token/deny]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
