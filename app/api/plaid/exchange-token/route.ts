// ============================================================
// app/api/plaid/exchange-token/route.ts
// POST — exchange Plaid Link's public_token for an access_token,
// encrypt it, and persist a PlaidItem for the signed-in user.
// Sprint 17 extended hotfix — multi-bank: each successful link
// creates an additional PlaidItem. The first becomes primary;
// subsequent links default to non-primary unless the user explicitly
// promotes them via /api/plaid/set-primary. Re-linking the same
// institution updates the existing record (matched on plaid itemId).
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

    // Multi-bank: was this user's first connection?
    const existingCount = await prisma.plaidItem.count({
      where: { userId: session.user.id },
    });
    const isFirst = existingCount === 0;

    // If the same Plaid item already exists for this user (re-link),
    // update it; otherwise create a new row.
    const existing = await prisma.plaidItem.findFirst({
      where: { userId: session.user.id, itemId },
    });
    if (existing) {
      await prisma.plaidItem.update({
        where: { id: existing.id },
        data: { accessToken: encrypted, institution },
      });
    } else {
      await prisma.plaidItem.create({
        data: {
          userId: session.user.id,
          accessToken: encrypted,
          itemId,
          institution,
          isPrimary: isFirst, // first wins; later links must opt in
        },
      });
    }

    return NextResponse.json({ success: true, institution });
  } catch (err) {
    console.error("[POST /api/plaid/exchange-token]", err);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 },
    );
  }
}
