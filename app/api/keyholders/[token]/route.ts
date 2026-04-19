// ============================================================
// app/api/keyholders/[token]/route.ts
// PATCH /api/keyholders/:token — keyholder accepts invite
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendKeyholderWelcomeEmail } from "@/lib/email";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    const relationship = await prisma.keyholderRelationship.findUnique({
      where: { inviteToken: token },
      include: { profile: true },
    });

    if (!relationship) {
      return NextResponse.json(
        { error: "Invalid or expired invite token" },
        { status: 404 },
      );
    }

    if (relationship.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invite already ${relationship.status.toLowerCase()}` },
        { status: 409 },
      );
    }

    if (
      relationship.inviteExpiresAt &&
      relationship.inviteExpiresAt < new Date()
    ) {
      await prisma.keyholderRelationship.update({
        where: { id: relationship.id },
        data: { status: "REVOKED" },
      });
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 410 },
      );
    }

    await prisma.$transaction([
      prisma.keyholderRelationship.update({
        where: { id: relationship.id },
        data: { status: "ACTIVE", acceptedAt: new Date() },
      }),
      prisma.keyholderProfile.update({
        where: { id: relationship.profileId },
        data: { verified: true },
      }),
    ]);

    await prisma.auditEvent.create({
      data: {
        actor: "KEYHOLDER",
        actorId: relationship.profileId,
        action: "RELATIONSHIP_ACCEPTED",
        targetId: relationship.id,
      },
    });

    // Sprint 11 — send welcome email to the keyholder once they accept.
    // Best-effort; never fail the acceptance if email send fails.
    try {
      const owner = await prisma.user.findUnique({
        where: { id: relationship.userId },
        select: { name: true, email: true },
      });

      let boxesForEmail: { name: string; targetAmount: number | null }[] = [];
      if (relationship.scopeType === "SELECTED") {
        const joins = await prisma.keyholderRelationshipBox.findMany({
          where: { relationshipId: relationship.id },
          include: { box: { select: { name: true, targetAmount: true, isClosed: true } } },
        });
        boxesForEmail = joins
          .filter((j) => !j.box.isClosed)
          .map((j) => ({ name: j.box.name, targetAmount: j.box.targetAmount }));
      } else {
        boxesForEmail = await prisma.box.findMany({
          where: {
            userId: relationship.userId,
            isClosed: false,
            lockType: "KEYHOLDER",
          },
          select: { name: true, targetAmount: true },
        });
      }

      await sendKeyholderWelcomeEmail({
        to: relationship.profile.email,
        keyholderName: relationship.profile.name,
        ownerName: owner?.name ?? owner?.email ?? "Your LockBox user",
        boxes: boxesForEmail,
        relationshipId: relationship.id,
      });
    } catch (err) {
      console.error("[keyholders/accept] welcome email failed:", err);
    }

    return NextResponse.json({ ok: true, accepted: true });
  } catch (error) {
    console.error("[PATCH /api/keyholders/:token]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
