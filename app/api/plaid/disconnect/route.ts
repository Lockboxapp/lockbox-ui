// ============================================================
// app/api/plaid/disconnect/route.ts
// POST — disconnect the signed-in user's Plaid item.
// Best-effort calls /item/remove on Plaid, then deletes
// PlaidTransaction + RecurringBill + PlaidItem rows for the user.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const item = await prisma.plaidItem.findUnique({
      where: { userId: session.user.id },
    });
    if (!item) {
      return NextResponse.json({ success: true, alreadyDisconnected: true });
    }

    try {
      const plaid = getPlaidClient();
      const accessToken = decrypt(item.accessToken);
      await plaid.itemRemove({ access_token: accessToken });
    } catch (err) {
      // best-effort — even if Plaid call fails, we still wipe local state
      console.warn("[plaid disconnect] itemRemove failed; deleting locally", err);
    }

    await prisma.$transaction([
      prisma.recurringBill.deleteMany({ where: { userId: session.user.id } }),
      prisma.plaidTransaction.deleteMany({ where: { userId: session.user.id } }),
      prisma.plaidItem.delete({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/plaid/disconnect]", err);
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
  }
}
