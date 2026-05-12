// ============================================================
// app/api/keyholder/requests/[id]/deny/route.ts
// POST /api/keyholder/requests/:id/deny
//
// Native keyholder denial path. Auth via Bearer / NextAuth
// session. Business logic lives in lib/keyholder-actions.ts.
//
// Optional `reason` in the request body is stored alongside the
// audit event for owner visibility. The 24h re-request cooldown
// is enforced server-side inside the helper.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { denyUnlockRequest } from "@/lib/keyholder-actions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    // Reason is optional — captured as audit metadata when present.
    let denialReason: string | null = null;
    try {
      const body = await req.json();
      if (typeof body?.reason === "string" && body.reason.trim().length > 0) {
        denialReason = body.reason.trim().slice(0, 500);
      }
    } catch {
      // Empty body is fine.
    }

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!me?.email) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await denyUnlockRequest({
      unlockRequestId: id,
      actorUserId: userId,
      actorEmail: me.email,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    // Append a separate audit event capturing the denial reason
    // so it's discoverable on review without polluting the action
    // log itself (action stays REQUEST_DENIED for parity with the
    // email-flow route).
    if (denialReason) {
      await prisma.auditEvent.create({
        data: {
          actor: "KEYHOLDER",
          action: "REQUEST_DENIED_REASON",
          targetId: id,
          metadata: JSON.stringify({
            reason: denialReason,
            source: "mobile",
          }),
        },
      });
    }

    return NextResponse.json({
      denied: true,
      boxName: result.boxName,
      cooldownUntil: result.cooldownUntil.toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/keyholder/requests/:id/deny]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
