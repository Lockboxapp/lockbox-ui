// ============================================================
// app/api/keyholders/route.ts
// POST /api/keyholders — invite a keyholder
// ============================================================
// SECURITY RULES:
//   - User cannot add themselves as keyholder (checked against all emails)
//   - inviteToken is generated server-side, sent only to keyholder email
//   - Email always stored lowercase
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendKeyholderInvite } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email, name, scopeType = "ALL", boxIds = [] } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Fetch user and all their associated emails
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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
      // Log the blocked attempt
      await prisma.auditEvent.create({
        data: {
          actor: "USER",
          actorId: session.user.id,
          action: "SELF_KEYHOLDER_BLOCKED",
          metadata: JSON.stringify({ attemptedEmail: normalizedEmail }),
        },
      });

      return NextResponse.json(
        { error: "You cannot add yourself as your own keyholder" },
        { status: 400 },
      );
    }

    // Check for existing active relationship with this email
    const existingProfile = await prisma.keyholderProfile.findUnique({
      where: { email: normalizedEmail },
    });

    const existingRelationship = existingProfile
      ? await prisma.keyholderRelationship.findFirst({
          where: {
            userId: session.user.id,
            profileId: existingProfile.id,
            status: { in: ["PENDING", "ACTIVE"] },
          },
        })
      : null;

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
        userId: session.user.id,
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
      ownerName: session.user.name ?? session.user.email,
      inviteToken: relationship.inviteToken,
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        actor: "USER",
        actorId: session.user.id,
        action: "INVITE_SENT",
        targetId: relationship.id,
        metadata: JSON.stringify({
          keyholderEmail: normalizedEmail,
          scopeType,
        }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        relationshipId: relationship.id,
      },
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
