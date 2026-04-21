// ============================================================
// app/api/keyholders/[relationshipId]/boxes/[boxId]/route.ts
// DELETE — remove a single box from a keyholder's SELECTED scope.
// If the relationship has ALL scope, reject — that isn't a per-box model.
// If removing the last covered box, revoke the entire relationship
// (status=REVOKED, revokedBy=OWNER) and audit it.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ relationshipId: string; boxId: string }> },
) {
  const { relationshipId, boxId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rel = await prisma.keyholderRelationship.findUnique({
      where: { id: relationshipId },
      include: {
        boxes: { include: { box: { select: { id: true, name: true } } } },
      },
    });
    if (!rel) {
      return NextResponse.json(
        { error: "Keyholder relationship not found" },
        { status: 404 },
      );
    }
    if (rel.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (rel.scopeType !== "SELECTED") {
      return NextResponse.json(
        {
          error:
            "This keyholder covers all boxes. Remove the whole relationship or narrow scope first.",
          code: "not_selected_scope",
        },
        { status: 400 },
      );
    }

    const linkedBox = rel.boxes.find((b) => b.boxId === boxId);
    if (!linkedBox) {
      return NextResponse.json(
        { error: "Box is not covered by this keyholder." },
        { status: 404 },
      );
    }

    const wasLastBox = rel.boxes.length === 1;

    await prisma.keyholderRelationshipBox.delete({
      where: { id: linkedBox.id },
    });

    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: session.user.id,
        action: "KEYHOLDER_BOX_REMOVED",
        targetId: relationshipId,
        metadata: JSON.stringify({
          boxId,
          boxName: linkedBox.box?.name ?? null,
          wasLastBox,
        }),
      },
    });

    if (wasLastBox) {
      await prisma.keyholderRelationship.update({
        where: { id: relationshipId },
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
          targetId: relationshipId,
          metadata: JSON.stringify({ reason: "last_box_removed" }),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      relationshipRevoked: wasLastBox,
    });
  } catch (err) {
    console.error(
      "[DELETE /api/keyholders/:relationshipId/boxes/:boxId]",
      err,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
