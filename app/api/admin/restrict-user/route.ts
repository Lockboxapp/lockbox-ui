// ============================================================
// app/api/admin/restrict-user/route.ts
// PATCH /api/admin/restrict-user — ADMIN-ONLY account restriction toggle
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, restrict, reason } = body as {
      userId?: string;
      restrict?: boolean;
      reason?: string;
    };

    if (!userId || typeof restrict !== "boolean") {
      return NextResponse.json(
        { error: "userId and restrict (boolean) are required" },
        { status: 400 },
      );
    }
    if (restrict && (!reason || typeof reason !== "string" || !reason.trim())) {
      return NextResponse.json({ error: "reason is required to restrict" }, { status: 400 });
    }

    // Prevent an admin from restricting themselves accidentally.
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: "You cannot restrict your own account." },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isRestricted: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: restrict
        ? {
            isRestricted: true,
            restrictedAt: new Date(),
            restrictedReason: reason!.trim(),
          }
        : {
            isRestricted: false,
            restrictedAt: null,
            restrictedReason: null,
          },
      select: {
        id: true,
        email: true,
        isRestricted: true,
        restrictedAt: true,
        restrictedReason: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        actor: "ADMIN",
        actorId: session.user.id,
        action: restrict ? "ACCOUNT_RESTRICTED" : "ACCOUNT_UNRESTRICTED",
        targetId: userId,
        metadata: JSON.stringify({
          email: target.email,
          reason: restrict ? reason!.trim() : null,
        }),
      },
    });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/restrict-user]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
