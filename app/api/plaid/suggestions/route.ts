// ============================================================
// app/api/plaid/suggestions/route.ts
// GET — runs detectRecurring + generateSuggestions for the
// signed-in user and returns the ranked suggestion list.
// Sprint 17 (Phase 2 — phase2 branch only).
// ============================================================

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { detectRecurringForUser } from "@/lib/plaid/detectRecurring";
import { generateSuggestionsForUser } from "@/lib/plaid/generateSuggestions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await detectRecurringForUser(session.user.id);
    const suggestions = await generateSuggestionsForUser(session.user.id);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[GET /api/plaid/suggestions]", err);
    return NextResponse.json(
      { error: "Failed to compute suggestions" },
      { status: 500 },
    );
  }
}
