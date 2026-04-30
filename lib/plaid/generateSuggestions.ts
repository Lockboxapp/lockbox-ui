// ============================================================
// lib/plaid/generateSuggestions.ts
// Sprint 17 (Phase 2) — turn detected RecurringBill rows into
// box suggestions ranked by amount (largest first).
// ============================================================
// Recommendation rules:
//  - Bills ≥ $500/mo (rent / mortgage / housing) → HARD
//  - Bills ≥ $80/mo and matching utility/insurance keywords → HARD
//  - Everything else (subscriptions, smaller services) → SOFT
// Suggestion is filtered out if RecurringBill.boxId is already set
// (user has already accepted that suggestion).
// ============================================================

import { prisma } from "@/lib/db";

export type BoxSuggestion = {
  recurringBillId: string;
  merchant: string;
  suggestedName: string; // e.g. "Rent Box"
  amount: number; // cents
  targetDay: number | null; // day of month
  recommendedLockType: "SOFT" | "HARD";
};

const HARD_KEYWORDS = [
  "rent",
  "mortgage",
  "landlord",
  "apartments",
  "electric",
  "power",
  "gas company",
  "water",
  "utility",
  "utilities",
  "insurance",
  "geico",
  "progressive",
  "state farm",
];

function suggestedNameFor(merchant: string): string {
  const m = merchant.trim();
  // Pull first significant word for the box label.
  const word =
    m.split(/[\s—–-]+/).find((w) => w.length >= 3) ?? m;
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()} Box`;
}

function classify(
  merchant: string,
  amountCents: number,
): "SOFT" | "HARD" {
  const lower = merchant.toLowerCase();
  if (amountCents >= 500_00) return "HARD";
  if (HARD_KEYWORDS.some((k) => lower.includes(k)) && amountCents >= 80_00) {
    return "HARD";
  }
  return "SOFT";
}

export async function generateSuggestionsForUser(
  userId: string,
): Promise<BoxSuggestion[]> {
  const bills = await prisma.recurringBill.findMany({
    where: { userId, boxId: null },
    orderBy: { averageAmount: "desc" },
  });

  return bills.map((b) => ({
    recurringBillId: b.id,
    merchant: b.merchant,
    suggestedName: suggestedNameFor(b.merchant),
    amount: b.averageAmount,
    targetDay: b.typicalDay,
    recommendedLockType: classify(b.merchant, b.averageAmount),
  }));
}
