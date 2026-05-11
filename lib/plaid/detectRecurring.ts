// ============================================================
// lib/plaid/detectRecurring.ts
// Sprint 17 (Phase 2) — heuristic recurring-bill detection.
// Sprint 17 extended hotfix — tightened to fix over-suggesting
// ("a box for every transaction") + added credit-card / loan
// payment detection.
// ============================================================
// Scans the last 90 days of PlaidTransaction debits for the user.
// Groups by *aggressively normalized* merchant key (store numbers,
// store branches, location suffixes, transaction id fragments are
// stripped) so charges from the same vendor across different stores
// or formats collapse into one bill.
//
// A group is treated as a recurring bill iff ALL of:
//   - 2+ occurrences in the window
//   - amounts within ±25% of mean
//   - median day-gap matches one of: weekly (6–9d), biweekly (13–16d),
//     monthly (27–34d), or annual (350–380d)
//
// Credit-card and loan payments are detected by matching common
// payment descriptors (VISA PAYMENT, MORTGAGE PAYMENT, CAR PAYMENT…)
// against the raw merchant/description, *before* normalization, so
// variations like "VISA PAYMENT - CHASE" still cluster correctly.
//
// At most 8 detected bills are persisted, ranked by averageAmount
// descending. Stale rows (no longer detected) are removed for that
// user — but rows already linked to a Box (boxId != null) are
// preserved regardless so accepted suggestions never get clobbered.
// ============================================================

import { prisma } from "@/lib/db";

const WINDOW_DAYS = 90;
const MAX_BILLS = 8;

type Frequency = "weekly" | "biweekly" | "monthly" | "annual";

// ------------------------------------------------------------
// Merchant normalization
// ------------------------------------------------------------
// Goal: collapse "Starbucks #4012", "STARBUCKS STORE 1209 NYC",
// "Starbucks Coffee — Manhattan" into the single key "starbucks".
function normalizeMerchant(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw
    .toLowerCase()
    .replace(/[#*]\s*\d+/g, " ") // store numbers like "#4012" or "*123"
    .replace(/\b\d{3,}\b/g, " ") // any 3+ digit number (txn refs, store IDs)
    .replace(/\s+(store|location|branch)\b.*$/g, " ")
    .replace(/\s+(llc|inc|corp|co|ltd|company)\b.*$/g, " ")
    .replace(/\s+\(?[a-z]{2}\)?$/g, " ") // trailing US state abbreviations
    .replace(/[^a-z0-9& ]+/g, " ") // strip punctuation
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

// ------------------------------------------------------------
// Credit / loan payment detection
// ------------------------------------------------------------
// Matched against the raw (un-normalized) merchant or description.
// Returns the canonical category key + suggested box label, or null
// if no match.
type PaymentMatch = {
  groupKey: string;
  display: string;
};

function classifyPaymentPattern(raw: string | null): PaymentMatch | null {
  if (!raw) return null;
  const s = raw.toLowerCase();

  // Credit card payments — collapse to one box per card brand seen.
  if (/\bvisa\b.*\bpayment\b/.test(s) || /\bvisa pmt\b/.test(s))
    return { groupKey: "__visa_payment__", display: "Visa Payment" };
  if (/\bmastercard\b.*\bpayment\b/.test(s) || /\bmc payment\b/.test(s))
    return { groupKey: "__mastercard_payment__", display: "Mastercard Payment" };
  if (/\bamex\b.*\bpayment\b/.test(s) || /american express.*payment/.test(s))
    return { groupKey: "__amex_payment__", display: "Amex Payment" };
  if (/\bdiscover\b.*\bpayment\b/.test(s))
    return { groupKey: "__discover_payment__", display: "Discover Payment" };
  if (/credit\s*card\b.*\bpayment\b/.test(s))
    return { groupKey: "__cc_payment__", display: "Credit Card Payment" };

  // Loan / mortgage / auto payments.
  if (/\bmortgage\b/.test(s) || /\bhome\s*loan\b/.test(s))
    return { groupKey: "__mortgage_payment__", display: "Mortgage Payment" };
  if (/\b(auto|car)\s*(loan|payment|pmt)\b/.test(s))
    return { groupKey: "__auto_loan_payment__", display: "Car Payment" };
  if (/\bstudent\s*loan\b/.test(s) || /\bnelnet\b/.test(s) || /\bsallie\s*mae\b/.test(s))
    return { groupKey: "__student_loan_payment__", display: "Student Loan Payment" };
  if (/\bpersonal\s*loan\b/.test(s))
    return { groupKey: "__personal_loan_payment__", display: "Loan Payment" };

  return null;
}

function suggestedNameFor(display: string): string {
  // Title-case + " Box" suffix. Already canonical for payment matches;
  // for normal merchants we're given the original display string.
  const cleaned = display
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
  return /box$/i.test(cleaned) ? cleaned : `${cleaned} Box`;
}

// ------------------------------------------------------------
// Cadence
// ------------------------------------------------------------
function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function classifyCadence(medianGapDays: number): Frequency | null {
  if (medianGapDays >= 6 && medianGapDays <= 9) return "weekly";
  if (medianGapDays >= 13 && medianGapDays <= 16) return "biweekly";
  if (medianGapDays >= 27 && medianGapDays <= 34) return "monthly";
  if (medianGapDays >= 350 && medianGapDays <= 380) return "annual";
  return null;
}

// ------------------------------------------------------------
// Detection
// ------------------------------------------------------------
export type DetectedBill = {
  merchant: string;
  averageAmount: number; // cents, positive
  frequency: Frequency;
  typicalDay: number | null;
  occurrences: number;
  isPaymentPattern: boolean; // credit-card / loan match → HARD recommendation
};

export async function detectRecurringForUser(
  userId: string,
): Promise<DetectedBill[]> {
  const since = new Date();
  since.setDate(since.getDate() - WINDOW_DAYS);

  const txs = await prisma.plaidTransaction.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { merchant: true, amount: true, date: true },
  });

  const groups = new Map<
    string,
    {
      display: string;
      amounts: number[];
      dates: Date[];
      isPaymentPattern: boolean;
    }
  >();

  for (const tx of txs) {
    if (tx.amount <= 0) continue; // debits only

    // 1) Try payment-pattern match first (credit / loan).
    const payment = classifyPaymentPattern(tx.merchant);
    let key: string;
    let display: string;
    let isPaymentPattern = false;
    if (payment) {
      key = payment.groupKey;
      display = payment.display;
      isPaymentPattern = true;
    } else {
      const norm = normalizeMerchant(tx.merchant);
      if (!norm) continue;
      key = norm;
      display = (tx.merchant ?? norm).trim();
    }

    const g =
      groups.get(key) ?? { display, amounts: [], dates: [], isPaymentPattern };
    g.amounts.push(tx.amount);
    g.dates.push(tx.date);
    if (isPaymentPattern) g.isPaymentPattern = true;
    groups.set(key, g);
  }

  const detected: DetectedBill[] = [];

  for (const [, g] of groups) {
    if (g.amounts.length < 2) continue;

    const mean = g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
    const within = g.amounts.every((a) => Math.abs(a - mean) <= mean * 0.25);
    if (!within) continue;

    const gaps: number[] = [];
    for (let i = 1; i < g.dates.length; i++) {
      const ms = g.dates[i].getTime() - g.dates[i - 1].getTime();
      gaps.push(Math.round(ms / (1000 * 60 * 60 * 24)));
    }
    const cadence = classifyCadence(median(gaps));
    if (!cadence) continue;

    const typicalDay =
      cadence === "monthly" ? median(g.dates.map((d) => d.getDate())) : null;

    detected.push({
      merchant: g.display,
      averageAmount: Math.round(mean),
      frequency: cadence,
      typicalDay,
      occurrences: g.amounts.length,
      isPaymentPattern: g.isPaymentPattern,
    });
  }

  // Cap and rank.
  detected.sort((a, b) => b.averageAmount - a.averageAmount);
  const capped = detected.slice(0, MAX_BILLS);
  const cappedKeys = new Set(capped.map((d) => d.merchant));

  // Persist: upsert detected, drop stale UNLESS already linked to a Box.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.recurringBill.findMany({
      where: { userId },
      select: { id: true, merchant: true, boxId: true },
    });
    for (const row of existing) {
      if (!cappedKeys.has(row.merchant) && !row.boxId) {
        await tx.recurringBill.delete({ where: { id: row.id } });
      }
    }
    for (const d of capped) {
      const existingForMerchant = await tx.recurringBill.findFirst({
        where: { userId, merchant: d.merchant },
        select: { id: true, boxId: true },
      });
      if (existingForMerchant) {
        await tx.recurringBill.update({
          where: { id: existingForMerchant.id },
          data: {
            averageAmount: d.averageAmount,
            frequency: d.frequency,
            typicalDay: d.typicalDay,
          },
        });
      } else {
        await tx.recurringBill.create({
          data: {
            userId,
            merchant: d.merchant,
            averageAmount: d.averageAmount,
            frequency: d.frequency,
            typicalDay: d.typicalDay,
          },
        });
      }
    }
  });

  return capped;
}

// Exported for generateSuggestions so it can use the same labeling.
export { suggestedNameFor };
