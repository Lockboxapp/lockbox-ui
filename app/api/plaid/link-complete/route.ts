// ============================================================
// app/api/plaid/link-complete/route.ts
// POST /api/plaid/link-complete
//
// Native onboarding v2 — the native app's bank-link step calls this.
// Exchanges Plaid Link's public_token for an access_token, encrypts
// it, and persists a PlaidItem.
//
// Mirrors /api/plaid/exchange-token (still used by the web app, left
// untouched) with three native adjustments:
//   - getRequestUserId auth (Bearer token, not session cookie)
//   - accepts `institutionName` as well as `institution`
//   - returns `{ ok }` alongside `{ success }`
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRequestUserId } from "@/lib/mobile-auth";
import { getPlaidClient } from "@/lib/plaid/client";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const publicToken: unknown = body?.publicToken;
    // Native sends `institutionName`; the web route uses `institution`.
    const institutionFromClient: unknown =
      body?.institutionName ?? body?.institution;
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

    // Multi-bank: was this the user's first connection?
    const existingCount = await prisma.plaidItem.count({
      where: { userId },
    });
    const isFirst = existingCount === 0;

    // Re-link of the same Plaid item updates the row; otherwise create.
    const existing = await prisma.plaidItem.findFirst({
      where: { userId, itemId },
    });
    if (existing) {
      await prisma.plaidItem.update({
        where: { id: existing.id },
        data: { accessToken: encrypted, institution },
      });
    } else {
      await prisma.plaidItem.create({
        data: {
          userId,
          accessToken: encrypted,
          itemId,
          institution,
          isPrimary: isFirst, // first wins; later links must opt in
        },
      });
    }

    // `ok` for the native client; `success` kept for parity with
    // the web exchange-token route.
    return NextResponse.json({ ok: true, success: true, institution });
  } catch (err) {
    console.error("[POST /api/plaid/link-complete]", err);
    return NextResponse.json(
      { error: "Failed to complete bank link" },
      { status: 500 },
    );
  }
}
