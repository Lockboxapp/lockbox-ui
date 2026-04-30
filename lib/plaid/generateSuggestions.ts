// ============================================================
// lib/plaid/generateSuggestions.ts
// Sprint 17 (Phase 2) — turn detected RecurringBill rows into
// box suggestions ranked by amount (largest first).
// Sprint 17 extended hotfix — credit-card and loan payment patterns
// always recommend HARD; canonical naming via suggestedNameFor.
// ============================================================
// Recommendation rules:
//  - Payment patterns (credit cards, mortgages, auto/student loans) → HARD
//  - Bills ≥ $500/mo (rent / mortgage / housing) → HARD
//  - Bills ≥ $80/mo and matching utility/insurance keywords → HARD
//  - Everything else (subscriptions, smaller services) → SOFT
// Suggestion is filtered out if RecurringBill.boxId is already set
// (user has already accepted that suggestion).
// ============================================================

import { prisma } from "@/lib/db";
import { suggestedNameFor } from "@/lib/plaid/detectRecurring";

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

// Canonical group keys produced by detectRecurring's classifyPaymentPattern.
const PAYMENT_PATTERN_DISPLAYS = new Set([
  "Visa Payment",
  "Mastercard Payment",
  "Amex Payment",
  "Discover Payment",
  "Credit Card Payment",
  "Mortgage Payment",
  "Car Payment",
  "Student Loan Payment",
  "Loan Payment",
]);

function classify(
  merchant: string,
  amountCents: number,
): "SOFT" | "HARD" {
  if (PAYMENT_PATTERN_DISPLAYS.has(merchant)) return "HARD";
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
