// ============================================================
// app/api/plaid/exchange-token/route.ts
// POST — exchange Plaid Link's public_token for an access_token,
// encrypt it, and persist a PlaidItem for the signed-in user.
// One PlaidItem per user (unique on userId) — re-linking replaces.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid/client";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const publicToken: unknown = body?.publicToken;
    const institutionFromClient: unknown = body?.institution;
    if (typeof publicToken !== "string" || !publicToken) {
      return NextResponse.json(
        { error: "publicToken is required" },
        { status: 400 },
      );
    }

    const plaid = getPlaidClient();

    const exchange = await plaid.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    let institution =
      typeof institutionFromClient === "string" && institutionFromClient
        ? institutionFromClient
        : "Connected bank";
    try {
      const itemRes = await plaid.itemGet({ access_token: accessToken });
      const instId = itemRes.data.item.institution_id;
      if (instId) {
        const instRes = await plaid.institutionsGetById({
          institution_id: instId,
          country_codes: ["US" as never],
        });
        institution = instRes.data.institution.name;
      }
    } catch {
      // institution lookup is best-effort; fall back to client-provided name
    }

    const encrypted = encrypt(accessToken);

    await prisma.plaidItem.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessToken: encrypted,
        itemId,
        institution,
      },
      update: {
        accessToken: encrypted,
        itemId,
        institution,
      },
    });

    return NextResponse.json({ success: true, institution });
  } catch (err) {
    console.error("[POST /api/plaid/exchange-token]", err);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 },
    );
  }
}
