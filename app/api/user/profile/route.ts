// ============================================================
// app/api/user/profile/route.ts
// GET  — return the signed-in user's profile (Sprint 16)
// PATCH — update display name and/or IANA timezone
//
// Sprint 2 (native): auth via getRequestUserId so both the
// NextAuth session cookie (web) and Bearer header (mobile)
// resolve correctly. The GET response also exposes mobile-
// facing counts (boxes, keyholders, connected banks) and a
// `subscription` block — additive only, the existing `user`
// payload that the web app consumes is unchanged.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { getRequestUserId } from "@/lib/mobile-auth";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional().nullable(),
  timezone: z.string().trim().max(64).optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        createdAt: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mobile-facing aggregates. Counts only — no nested data leakage.
    // We do not yet have a real subscription model (no Stripe wired),
    // so the subscription block is hardcoded for now. Update once
    // billing lands.
    const [boxCount, keyholdersCount, connectedBanksCount] = await Promise.all([
      prisma.box.count({
        where: { userId, isWallet: false, isClosed: false },
      }),
      prisma.keyholderRelationship.count({
        where: { userId, status: "ACTIVE" },
      }),
      prisma.plaidItem.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      user,
      subscription: {
        plan: "Free",
        priceCents: 0,
        renewsAt: null as string | null,
        status: "active" as const,
      },
      counts: {
        boxCount,
        keyholdersCount,
        connectedBanksCount,
      },
    });
  } catch (err) {
    console.error("[GET /api/user/profile]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 },
      );
    }

    const { name, timezone } = parsed.data;

    const data: Record<string, string | null> = {};
    if (name !== undefined) data.name = name ?? null;
    if (timezone !== undefined) data.timezone = timezone ?? null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (err) {
    console.error("[PATCH /api/user/profile]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
