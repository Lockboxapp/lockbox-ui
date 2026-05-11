// ============================================================
// app/api/plaid/sync/route.ts
// POST — sync the signed-in user's last 90 days of Plaid transactions.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncPlaidTransactionsForUser } from "@/lib/plaid/sync";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncPlaidTransactionsForUser(session.user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /api/plaid/sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
