// ============================================================
// lib/plaid/detectRecurring.ts
// Sprint 17 (Phase 2) — heuristic recurring-bill detection.
// ============================================================
// Reads PlaidTransaction rows in the last 90 days for a user, groups
// by normalized merchant, and classifies each merchant's cadence.
//
// Heuristic:
//  - Only debits (Plaid sign convention: amount > 0 = money out).
//  - Need 2+ occurrences of the same merchant.
//  - Amount must be tightly clustered (mean ± 25%).
//  - Cadence inferred from median gap between occurrences:
//      6–9 days   → weekly
//      27–34 days → monthly
//      350–380 d  → annual
//    Anything else is rejected (not enough evidence).
//  - typicalDay = median day-of-month across occurrences.
// Upserts into RecurringBill keyed on (userId, merchant). Stale rows
// (no longer detected) are removed for that user.
// ============================================================

import { prisma } from "@/lib/db";

const WINDOW_DAYS = 90;

type Frequency = "weekly" | "monthly" | "annual";

function normalizeMerchant(raw: string | null): string | null {
  if (!raw) return null;
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

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
  if (medianGapDays >= 27 && medianGapDays <= 34) return "monthly";
  if (medianGapDays >= 350 && medianGapDays <= 380) return "annual";
  return null;
}

export type DetectedBill = {
  merchant: string;
  averageAmount: number; // cents, positive
  frequency: Frequency;
  typicalDay: number | null;
  occurrences: number;
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
    { display: string; amounts: number[]; dates: Date[] }
  >();

  for (const tx of txs) {
    if (tx.amount <= 0) continue; // skip credits
    const key = normalizeMerchant(tx.merchant);
    if (!key) continue;
    const display = (tx.merchant ?? key).trim();
    const g = groups.get(key) ?? { display, amounts: [], dates: [] };
    g.amounts.push(tx.amount);
    g.dates.push(tx.date);
    groups.set(key, g);
  }

  const detected: DetectedBill[] = [];

  for (const [, g] of groups) {
    if (g.amounts.length < 2) continue;

    const mean =
      g.amounts.reduce((s, a) => s + a, 0) / g.amounts.length;
    const within = g.amounts.every(
      (a) => Math.abs(a - mean) <= mean * 0.25,
    );
    if (!within) continue;

    const gaps: number[] = [];
    for (let i = 1; i < g.dates.length; i++) {
      const ms =
        g.dates[i].getTime() - g.dates[i - 1].getTime();
      gaps.push(Math.round(ms / (1000 * 60 * 60 * 24)));
    }
    const cadence = classifyCadence(median(gaps));
    if (!cadence) continue;

    const days = g.dates.map((d) => d.getDate());
    const typicalDay = cadence === "monthly" ? median(days) : null;

    detected.push({
      merchant: g.display,
      averageAmount: Math.round(mean),
      frequency: cadence,
      typicalDay,
      occurrences: g.amounts.length,
    });
  }

  // Persist: upsert detected, drop stale.
  const detectedKeys = new Set(detected.map((d) => d.merchant));

  await prisma.$transaction(async (tx) => {
    const existing = await tx.recurringBill.findMany({
      where: { userId },
      select: { id: true, merchant: true },
    });
    for (const row of existing) {
      if (!detectedKeys.has(row.merchant)) {
        await tx.recurringBill.delete({ where: { id: row.id } });
      }
    }
    for (const d of detected) {
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

  return detected;
}
