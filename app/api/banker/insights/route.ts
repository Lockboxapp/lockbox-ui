// ============================================================
// app/api/banker/insights/route.ts
// GET /api/banker/insights
//
// Three top-line financial signals for the Banker tab on native:
//   income     — sum of DEPOSIT transactions in the last 30 days
//   locked     — sum(lockedAmount) for non-wallet active boxes
//   available  — wallet + sum(balance - lockedAmount) for the rest
//
// Each row carries a small caption + tone so the native shell can
// render a status badge without re-deriving meaning on the client.
// All money values in CENTS.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/mobile-auth";
import {
  computeMoneyFigures,
  loadIncomeLast30dCents,
  loadUserBoxes,
} from "@/lib/native-summary";

export const runtime = "nodejs";

type InsightTone = "success" | "warning" | "neutral";
type Insight = {
  key: "income" | "locked" | "available";
  label: string;
  valueCents: number;
  caption: string;
  tone: InsightTone;
  badge: string;
};

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [boxes, incomeCents] = await Promise.all([
      loadUserBoxes(userId),
      loadIncomeLast30dCents(userId),
    ]);

    const { protectedCents, availableCents, totalCents } = computeMoneyFigures(
      boxes,
    );

    const lockedRatio = totalCents > 0 ? protectedCents / totalCents : 0;
    const lockedPct = Math.round(lockedRatio * 100);

    const insights: Insight[] = [
      {
        key: "income",
        label: "Income",
        valueCents: incomeCents,
        caption:
          incomeCents > 0
            ? "Deposits over the last 30 days."
            : "No deposits in the last 30 days yet.",
        tone: incomeCents > 0 ? "success" : "neutral",
        badge: incomeCents > 0 ? "On track" : "Steady",
      },
      {
        key: "locked",
        label: "Locked",
        valueCents: protectedCents,
        caption:
          totalCents > 0
            ? `${lockedPct}% of your money is protected.`
            : "Lock your first dollar into a box.",
        tone: "neutral",
        badge: "Steady",
      },
      {
        key: "available",
        label: "Available",
        valueCents: availableCents,
        caption:
          availableCents < 2_000
            ? "Available balance is running low."
            : "Liquid money you can move today.",
        tone: availableCents < 2_000 ? "warning" : "success",
        badge: availableCents < 2_000 ? "Watch" : "On track",
      },
    ];

    return NextResponse.json({ insights });
  } catch (err) {
    console.error("[GET /api/banker/insights]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
