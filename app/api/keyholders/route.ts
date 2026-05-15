// ============================================================
// app/api/keyholders/route.ts
// GET  /api/keyholders — list keyholder relationships
// POST /api/keyholders — invite a keyholder
// ============================================================
// SECURITY RULES:
//   - User cannot add themselves as keyholder
//   - inviteToken generated server-side, sent only to keyholder
//   - Email always stored lowercase
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendKeyholderInvite } from "@/lib/email";
import { getServerPosthog } from "@/lib/posthog-server";
import { getRequestUserId } from "@/lib/mobile-auth";

// ── GET — list all keyholder relationships ──────────────────

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sprint 5 — also include the SELECTED-scope box links so the
    // native /keyholders screen can render "Affected boxes" inline.
    const relationships = await prisma.keyholderRelationship.findMany({
      where: { userId },
      include: {
        profile: true,
        boxes: {
          include: { box: { select: { id: true, name: true, isClosed: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(relationships);
  } catch (error) {
    console.error("[GET /api/keyholders]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ── POST — invite a keyholder ───────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email, name, scopeType = "ALL", boxIds = [] } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch user and all associated emails
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { accounts: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Self-keyholder prevention — backend enforcement
    const userEmails = [
      user.email,
      ...user.accounts
        .map((a) => a.providerAccountId)
        .filter((e) => e?.includes("@")),
    ]
      .filter(Boolean)
      .map((e) => e!.toLowerCase());

    if (userEmails.includes(normalizedEmail)) {
      await prisma.auditEvent.create({
        data: {
          actor: "USER",
          actorId: userId,
          action: "SELF_KEYHOLDER_BLOCKED",
          metadata: JSON.stringify({ attemptedEmail: normalizedEmail }),
        },
      });
      return NextResponse.json(
        { error: "You cannot add yourself as your own keyholder" },
        { status: 400 },
      );
    }

    // Check for existing active or pending relationship
    const existingProfile = await prisma.keyholderProfile.findUnique({
      where: { email: normalizedEmail },
    });

    const existingRelationship = existingProfile
      ? await prisma.keyholderRelationship.findFirst({
          where: {
            userId: userId,
            profileId: existingProfile.id,
            status: { in: ["PENDING", "ACTIVE"] },
          },
        })
      : null;

    // Sprint 11 — scope-update path: if there's already an ACTIVE SELECTED
    // relationship with this keyholder, add any new boxIds to the existing
    // relationship and send the scope-update email instead of a fresh invite.
    if (
      existingRelationship &&
      existingRelationship.status === "ACTIVE" &&
      existingRelationship.scopeType === "SELECTED" &&
      scopeType === "SELECTED" &&
      Array.isArray(boxIds) &&
      boxIds.length > 0
    ) {
      // Find which boxIds are genuinely new.
      const existingLinks = await prisma.keyholderRelationshipBox.findMany({
        where: { relationshipId: existingRelationship.id },
        select: { boxId: true },
      });
      const existingSet = new Set(existingLinks.map((l) => l.boxId));
      const newBoxIds = (boxIds as string[]).filter((bId) => !existingSet.has(bId));

      if (newBoxIds.length > 0) {
        await prisma.keyholderRelationshipBox.createMany({
          data: newBoxIds.map((boxId) => ({
            relationshipId: existingRelationship.id,
            boxId,
          })),
          skipDuplicates: true,
        });

        await prisma.auditEvent.create({
          data: {
            actor: "USER",
            actorId: userId,
            action: "KEYHOLDER_SCOPE_UPDATED",
            targetId: existingRelationship.id,
            metadata: JSON.stringify({ addedBoxIds: newBoxIds }),
          },
        });

        // Compose the full (all) and newly added box lists for the email.
        const allJoins = await prisma.keyholderRelationshipBox.findMany({
          where: { relationshipId: existingRelationship.id },
          include: { box: { select: { name: true, targetAmount: true, isClosed: true } } },
        });
        const allBoxes = allJoins
          .filter((j) => !j.box.isClosed)
          .map((j) => ({ name: j.box.name, targetAmount: j.box.targetAmount }));
        const newBoxesMeta = await prisma.box.findMany({
          where: { id: { in: newBoxIds } },
          select: { name: true },
        });

        try {
          const { sendKeyholderScopeUpdateEmail } = await import("@/lib/email");
          await sendKeyholderScopeUpdateEmail({
            to: existingProfile!.email,
            keyholderName: existingProfile!.name,
            ownerName: user.name ?? user.email ?? "Your LockBox user",
            allBoxes,
            newBoxes: newBoxesMeta.map((b) => ({ name: b.name })),
            relationshipId: existingRelationship.id,
          });
        } catch (err) {
          console.error("[keyholders] scope-update email failed:", err);
        }

        return NextResponse.json(
          { ok: true, relationshipId: existingRelationship.id, scopeUpdated: true, addedBoxCount: newBoxIds.length },
          { status: 200 },
        );
      }

      // Nothing new to add — fall through to the existing 409.
    }

    if (existingRelationship) {
      return NextResponse.json(
        {
          error:
            "An active or pending keyholder relationship already exists with this email",
        },
        { status: 409 },
      );
    }

    // Create or find KeyholderProfile
    const profile = await prisma.keyholderProfile.upsert({
      where: { email: normalizedEmail },
      update: { name: name ?? undefined },
      create: { email: normalizedEmail, name: name ?? null },
    });

    // Set invite expiry — 7 days
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Create relationship
    const relationship = await prisma.keyholderRelationship.create({
      data: {
        userId: userId,
        profileId: profile.id,
        scopeType: scopeType === "SELECTED" ? "SELECTED" : "ALL",
        status: "PENDING",
        inviteExpiresAt,
      },
    });

    // If SELECTED scope, create box join rows
    if (scopeType === "SELECTED" && boxIds.length > 0) {
      await prisma.keyholderRelationshipBox.createMany({
        data: boxIds.map((boxId: string) => ({
          relationshipId: relationship.id,
          boxId,
        })),
        skipDuplicates: true,
      });
    }

    // Send invite email
    await sendKeyholderInvite({
      keyholderEmail: normalizedEmail,
      keyholderName: name ?? null,
      ownerName: user.name ?? user.email,
      inviteToken: relationship.inviteToken,
      relationshipId: relationship.id,
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: userId,
        action: "INVITE_SENT",
        targetId: relationship.id,
        metadata: JSON.stringify({
          keyholderEmail: normalizedEmail,
          scopeType,
        }),
      },
    });

    const ph = getServerPosthog();
    ph.capture({ distinctId: userId, event: "keyholder_invited" });
    await ph.shutdown();

    return NextResponse.json(
      { ok: true, relationshipId: relationship.id },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/keyholders]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
