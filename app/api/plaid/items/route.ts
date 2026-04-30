// ============================================================
// app/api/plaid/items/route.ts
// GET — list all PlaidItems for the signed-in user.
// Returns id, institution, isPrimary, createdAt for each.
// Sprint 17 extended hotfix — multi-bank.
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.plaidItem.findMany({
      where: { userId: session.user.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        institution: true,
        isPrimary: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("[GET /api/plaid/items]", err);
    return NextResponse.json(
      { error: "Failed to load connected banks" },
      { status: 500 },
    );
  }
}
