// ============================================================
// app/api/cron/plaid-sync/route.ts
// GET — daily cron. Bearer auth via CRON_SECRET, identical pattern to
// /api/cron/waitlist-emails. Iterates every PlaidItem and syncs.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncPlaidTransactionsForUser } from "@/lib/plaid/sync";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.plaidItem.findMany({ select: { userId: true } });
  const results: Array<{
    userId: string;
    ok: boolean;
    newCount?: number;
    error?: string;
  }> = [];

  for (const item of items) {
    try {
      const r = await syncPlaidTransactionsForUser(item.userId);
      results.push({ userId: item.userId, ok: true, newCount: r.newCount });
    } catch (err) {
      results.push({
        userId: item.userId,
        ok: false,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}
