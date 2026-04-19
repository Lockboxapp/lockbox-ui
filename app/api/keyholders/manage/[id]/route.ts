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
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendKeyholderRemovedByOwnerEmail } from "@/lib/email";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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
    if (rel.userId !== session.user.id) {
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
        actorId: session.user.id,
        action: "KEYHOLDER_REMOVED_BY_OWNER",
        targetId: rel.id,
        metadata: JSON.stringify({ keyholderEmail: rel.profile.email }),
      },
    });

    // Compute affected box names for the notification.
    let affected: string[] = [];
    if (rel.scopeType === "SELECTED") {
      affected = rel.boxes.filter((b) => !b.box.isClosed).map((b) => b.box.name);
    } else {
      const allBoxes = await prisma.box.findMany({
        where: {
          userId: rel.userId,
          isClosed: false,
          lockType: "KEYHOLDER",
        },
        select: { name: true },
      });
      affected = allBoxes.map((b) => b.name);
    }

    // Notify the keyholder (best-effort).
    try {
      await sendKeyholderRemovedByOwnerEmail({
        to: rel.profile.email,
        keyholderName: rel.profile.name,
        ownerName: rel.user.name ?? "Your LockBox user",
        affectedBoxNames: affected,
      });
    } catch (err) {
      console.error("[keyholders/manage] removed email failed:", err);
    }

    return NextResponse.json({ ok: true, affectedBoxCount: affected.length });
  } catch (err) {
    console.error("[DELETE /api/keyholders/manage/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
