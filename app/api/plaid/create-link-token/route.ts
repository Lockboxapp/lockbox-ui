// ============================================================
// app/api/plaid/create-link-token/route.ts
// POST — issues a short-lived Plaid Link token for the signed-in user.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getPlaidClient,
  PLAID_PRODUCTS,
  PLAID_COUNTRY_CODES,
} from "@/lib/plaid/client";
import { DepositoryAccountSubtype } from "plaid";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const plaid = getPlaidClient();
    // Sprint 17 extended hotfix — restrict the Plaid Link UI to
    // depository accounts only (checking, savings, money market).
    // Credit cards, mortgages, CDs, investments don't appear in the
    // institution selector. Server-side enforcement; cannot be bypassed
    // from the client.
    const res = await plaid.linkTokenCreate({
      user: { client_user_id: session.user.id },
      client_name: "LockBox",
      products: PLAID_PRODUCTS,
      country_codes: PLAID_COUNTRY_CODES,
      language: "en",
      account_filters: {
        depository: {
          account_subtypes: [
            DepositoryAccountSubtype.Checking,
            DepositoryAccountSubtype.Savings,
            DepositoryAccountSubtype.MoneyMarket,
          ],
        },
      },
    });

    return NextResponse.json({ linkToken: res.data.link_token });
  } catch (err) {
    console.error("[POST /api/plaid/create-link-token]", err);
    return NextResponse.json(
      { error: "Failed to create link token" },
      { status: 500 },
    );
  }
}
