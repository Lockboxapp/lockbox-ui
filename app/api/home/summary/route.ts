// ============================================================
// app/api/home/summary/route.ts
// GET /api/home/summary
//
// Mobile-shaped home payload composed from existing data: boxes,
// wallet, transactions, and the Banker nudge ladder. The web app
// has its own home rendering — this endpoint exists so the native
// app can fetch a single response and render the whole Home tab.
//
// All money is returned in CENTS. Conversion to dollars happens
// at the display layer only.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/mobile-auth";
import {
  computeBankerNudge,
  computeMoneyFigures,
  findNextBillBox,
  findWallet,
  loadPendingKeyholderRequestsCount,
  loadPendingOwnerRequestsCount,
  loadRecentActivity,
  loadUserBoxes,
} from "@/lib/native-summary";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      boxes,
      recentActivity,
      pendingKeyholderRequestsCount,
      pendingOwnerRequestsCount,
    ] = await Promise.all([
      loadUserBoxes(userId),
      loadRecentActivity(userId, 5),
      loadPendingKeyholderRequestsCount(userId),
      loadPendingOwnerRequestsCount(userId),
    ]);

    const { protectedCents, walletCents, totalCents } = computeMoneyFigures(
      boxes,
    );
    const wallet = findWallet(boxes);
    const nextBill = findNextBillBox(boxes);
    const bankerNudge = computeBankerNudge(boxes);

    return NextResponse.json({
      // All money values in cents.
      walletBoxId: wallet?.id ?? null,
      totalLockedCents: protectedCents,
      walletBalanceCents: walletCents,
      // "Connected" = total under management. We do not return Plaid
      // balances here in Sprint 2 — that requires a live Plaid call,
      // and we don't want the home tab to be gated on it.
      connectedBalanceCents: totalCents,
      // Month-over-month delta — placeholder. Requires a snapshot
      // table to compute correctly; revisit when one exists.
      totalLockedDeltaCents: 0,
      nextBill: nextBill
        ? {
            boxId: nextBill.box.id,
            boxName: nextBill.box.name,
            amountCents: nextBill.shortfallCents,
            dueAt: nextBill.box.lockUntil?.toISOString() ?? null,
          }
        : null,
      bankerNudge,
      recentActivity,
      // Sprint 3 — drives the Home banners on native for the
      // keyholder-approval and owner-status flows.
      pendingKeyholderRequestsCount,
      pendingOwnerRequestsCount,
    });
  } catch (err) {
    console.error("[GET /api/home/summary]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
