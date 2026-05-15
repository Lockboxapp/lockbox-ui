// ============================================================
// app/api/keyholders/manage/[id]/route.ts
// DELETE /api/keyholders/manage/:id — owner removes a keyholder
// ============================================================
// Only the owner of the KeyholderRelationship can invoke this.
// Sets status=REVOKED with revokedBy='OWNER' and notifies the keyholder.
// Path is nested under /manage to avoid the route-collision with the existing
// [token] dynamic segment at the same level.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendKeyholderRemovedByOwnerEmail } from "@/lib/email";
import { getRequestUserId } from "@/lib/mobile-auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rel = await prisma.keyholderRelationship.findUnique({
      where: { id },
      include: {
        user: { select: { name: true } },
        profile: true,
        boxes: { include: { box: { select: { id: true, name: true, isClosed: true } } } },
      },
    });

    if (!rel) {
      return NextResponse.json({ error: "Keyholder relationship not found" }, { status: 404 });
    }
    if (rel.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (rel.status === "REVOKED") {
      return NextResponse.json({ ok: true, alreadyRevoked: true });
    }

    await prisma.keyholderRelationship.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedBy: "OWNER",
      },
    });

    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: userId,
        action: "KEYHOLDER_REMOVED_BY_OWNER",
        targetId: rel.id,
        metadata: JSON.stringify({ keyholderEmail: rel.profile.email }),
      },
    });

    // Compute affected boxes for the email AND the response. Sprint 5
    // surfaces them as `{id, name}[]` so the native UI can render
    // them inline in the confirmation/result modal.
    let affectedBoxes: { id: string; name: string }[] = [];
    if (rel.scopeType === "SELECTED") {
      affectedBoxes = rel.boxes
        .filter((b) => !b.box.isClosed)
        .map((b) => ({ id: b.box.id, name: b.box.name }));
    } else {
      const allBoxes = await prisma.box.findMany({
        where: {
          userId: rel.userId,
          isClosed: false,
          lockType: "KEYHOLDER",
        },
        select: { id: true, name: true },
      });
      affectedBoxes = allBoxes.map((b) => ({ id: b.id, name: b.name }));
    }
    const affectedNames = affectedBoxes.map((b) => b.name);

    // Notify the keyholder (best-effort).
    try {
      await sendKeyholderRemovedByOwnerEmail({
        to: rel.profile.email,
        keyholderName: rel.profile.name,
        ownerName: rel.user.name ?? "Your LockBox user",
        affectedBoxNames: affectedNames,
      });
    } catch (err) {
      console.error("[keyholders/manage] removed email failed:", err);
    }

    return NextResponse.json({
      ok: true,
      removedRelationshipId: rel.id,
      affectedBoxCount: affectedBoxes.length,
      affectedBoxes,
    });
  } catch (err) {
    console.error("[DELETE /api/keyholders/manage/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
