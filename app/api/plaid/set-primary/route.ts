// ============================================================
// app/api/plaid/set-primary/route.ts
// POST — promote a PlaidItem to primary. Atomically demotes all
// other items for the user. Sprint 17 extended hotfix — multi-bank.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const plaidItemId: unknown = body?.plaidItemId;
    if (typeof plaidItemId !== "string" || !plaidItemId) {
      return NextResponse.json(
        { error: "plaidItemId is required" },
        { status: 400 },
      );
    }

    const target = await prisma.plaidItem.findFirst({
      where: { id: plaidItemId, userId: session.user.id },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.plaidItem.updateMany({
        where: { userId: session.user.id, NOT: { id: plaidItemId } },
        data: { isPrimary: false },
      }),
      prisma.plaidItem.update({
        where: { id: plaidItemId },
        data: { isPrimary: true },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/plaid/set-primary]", err);
    return NextResponse.json(
      { error: "Failed to set primary" },
      { status: 500 },
    );
  }
}
