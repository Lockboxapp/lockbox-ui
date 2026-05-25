// ============================================================
// app/api/plaid/items/route.ts
// GET — list all PlaidItems for the signed-in user.
//
// Sprint 6 (native settings): switched auth from getServerSession
// to getRequestUserId so Bearer tokens from the native app work
// alongside the web session cookie. The response shape was also
// flattened to a top-level array of bank-shaped objects the
// mobile "Connected banks" screen consumes directly. We do NOT
// currently store per-account `last4` / `accountType` locally
// (those live on Plaid Accounts, not our PlaidItem table), so
// those fields are returned as null — populated only if/when we
// call /accounts/get and persist them.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.plaidItem.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        institution: true,
      },
    });

    // Empty list is a valid result, never a 404.
    const banks = items.map((item) => ({
      id: item.id,
      institutionName: item.institution,
      // Not stored locally yet — Plaid Accounts API would populate.
      accountType: null as string | null,
      last4: null as string | null,
    }));

    return NextResponse.json(banks);
  } catch (err) {
    console.error("[GET /api/plaid/items]", err);
    return NextResponse.json(
      { error: "Failed to load connected banks" },
      { status: 500 },
    );
  }
}
