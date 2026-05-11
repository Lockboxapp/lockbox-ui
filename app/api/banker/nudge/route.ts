// ============================================================
// app/api/banker/nudge/route.ts
// GET /api/banker/nudge
//
// Returns the single most-urgent Banker coaching card, or null
// when nothing requires attention. Shared logic lives in
// lib/native-summary so /api/home/summary returns the same card.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { getRequestUserId } from "@/lib/mobile-auth";
import { computeBankerNudge, loadUserBoxes } from "@/lib/native-summary";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const userId = await getRequestUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const boxes = await loadUserBoxes(userId);
    const nudge = computeBankerNudge(boxes);

    return NextResponse.json({ nudge });
  } catch (err) {
    console.error("[GET /api/banker/nudge]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
