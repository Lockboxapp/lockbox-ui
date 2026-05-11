// ============================================================
// lib/native-summary.ts
// Shared helpers for the mobile-shaped summary endpoints:
//   GET /api/home/summary
//   GET /api/banker/nudge
//   GET /api/banker/insights
//
// All money values are returned in CENTS, matching the rest of
// the API. Callers convert to dollars at the display layer only.
// ============================================================

import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const URGENCY_HORIZON_DAYS = 14;
const WALLET_LOW_THRESHOLD_CENTS = 20_00;

export type BoxRow = {
  id: string;
  name: string;
  balance: number;
  lockedAmount: number;
  targetAmount: number | null;
  lockUntil: Date | null;
  isWallet: boolean;
  isClosed: boolean;
  status: string;
  lockType: "SOFT" | "HARD" | "KEYHOLDER";
};

export type BankerNudge = {
  headline: string;
  body: string;
  ctaLabel: string;
  ctaAction: "transfer" | "deposit" | "open_chat";
  ctaAmountCents: number;
  ctaTargetBoxId: string | null;
} | null;

/** Load every non-closed box for the user, including Wallet. */
export async function loadUserBoxes(userId: string): Promise<BoxRow[]> {
  const rows = await prisma.box.findMany({
    where: { userId, isClosed: false },
    select: {
      id: true,
      name: true,
      balance: true,
      lockedAmount: true,
      targetAmount: true,
      lockUntil: true,
      isWallet: true,
      isClosed: true,
      status: true,
      lockType: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return rows as BoxRow[];
}

/** Wallet box for the user — lazy-backfilled by GET /api/boxes, so it should always exist. */
export function findWallet(boxes: BoxRow[]): BoxRow | null {
  return boxes.find((b) => b.isWallet) ?? null;
}

/**
 * Money figures expressed the same way the web home dashboard treats them.
 *
 *   protectedCents  — sum of `balance` across non-wallet, non-closed
 *                     boxes whose status is LOCKED or UNLOCK_PENDING.
 *                     Matches the web's "Protected in boxes" calc.
 *                     AGENT.md §16 #15 calls for `sum(lockedAmount)`,
 *                     but in practice `lockedAmount` drifts because
 *                     `/api/boxes/[id]/deposit` only increments
 *                     `balance` — so the web filters by lock status
 *                     and sums balance instead. We mirror that.
 *   walletCents     — wallet balance
 *   totalCents      — wallet + sum of non-wallet balances (every
 *                     non-closed box, regardless of lock state)
 *   availableCents  — wallet + sum(balance - lockedAmount) for non-wallet
 *
 *  `loadUserBoxes` already filters `isClosed: false`, so the input here
 *  is the right set of boxes by definition.
 */
export function computeMoneyFigures(boxes: BoxRow[]) {
  const wallet = findWallet(boxes);
  const nonWallet = boxes.filter((b) => !b.isWallet);

  const protectedCents = nonWallet
    .filter((b) => b.status === 'LOCKED' || b.status === 'UNLOCK_PENDING')
    .reduce((s, b) => s + b.balance, 0);
  const walletCents = wallet?.balance ?? 0;
  const totalCents =
    walletCents + nonWallet.reduce((s, b) => s + b.balance, 0);
  const availableCents =
    walletCents +
    nonWallet.reduce((s, b) => s + Math.max(0, b.balance - b.lockedAmount), 0);

  return { protectedCents, walletCents, totalCents, availableCents };
}

/**
 * The next non-wallet box with a future lockUntil that is still
 * underfunded (balance < targetAmount). Returns the shortfall in
 * cents along with the box.
 */
export function findNextBillBox(boxes: BoxRow[]) {
  const now = Date.now();
  const candidates = boxes
    .filter(
      (b) =>
        !b.isWallet &&
        b.lockUntil != null &&
        b.lockUntil.getTime() > now &&
        b.targetAmount != null &&
        b.balance < b.targetAmount,
    )
    .sort(
      (a, b) =>
        (a.lockUntil!.getTime() - b.lockUntil!.getTime()),
    );
  const next = candidates[0];
  if (!next) return null;
  const shortfallCents = Math.max(
    0,
    (next.targetAmount ?? 0) - next.balance,
  );
  return { box: next, shortfallCents };
}

/**
 * Simplified Banker insight ladder for Sprint 2. Mirrors the priority
 * order in AGENT.md Section 12 without the OpenAI dependency. Returns
 * a single most-urgent card or null.
 */
export function computeBankerNudge(boxes: BoxRow[]): BankerNudge {
  const wallet = findWallet(boxes);
  const now = Date.now();

  // 1. Urgency: any non-wallet box underfunded with target date within
  //    URGENCY_HORIZON_DAYS.
  const urgent = boxes
    .filter(
      (b) =>
        !b.isWallet &&
        b.lockUntil != null &&
        b.targetAmount != null &&
        b.balance < b.targetAmount,
    )
    .map((b) => ({
      box: b,
      daysOut: Math.ceil((b.lockUntil!.getTime() - now) / DAY_MS),
      shortfallCents: Math.max(0, (b.targetAmount ?? 0) - b.balance),
    }))
    .filter((c) => c.daysOut <= URGENCY_HORIZON_DAYS)
    .sort((a, b) => a.daysOut - b.daysOut);

  if (urgent.length > 0) {
    const { box, shortfallCents } = urgent[0];
    const dollars = (shortfallCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    return {
      headline: `${box.name} is short ${dollars}`,
      body: `Move money today to stay on track before your target date.`,
      ctaLabel: `Move ${dollars}`,
      ctaAction: "transfer",
      ctaAmountCents: shortfallCents,
      ctaTargetBoxId: box.id,
    };
  }

  // 2. Wallet running low while money is locked away.
  const hasLockedMoney = boxes.some((b) => !b.isWallet && b.lockedAmount > 0);
  if (
    wallet != null &&
    wallet.balance < WALLET_LOW_THRESHOLD_CENTS &&
    hasLockedMoney
  ) {
    return {
      headline: "Your Wallet is running low",
      body: "Only move what you need. The Banker can help you decide.",
      ctaLabel: "Ask The Banker",
      ctaAction: "open_chat",
      ctaAmountCents: 0,
      ctaTargetBoxId: null,
    };
  }

  // 3. Default — no nudge.
  return null;
}

/** Recent transactions for the activity feed. */
export async function loadRecentActivity(userId: string, limit = 5) {
  const rows = await prisma.transaction.findMany({
    where: { userId },
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      postedAt: true,
      box: { select: { id: true, name: true } },
    },
  });
  return rows.map((tx) => ({
    id: tx.id,
    type: tx.type,
    amountCents: tx.amount,
    description: tx.description ?? "",
    postedAt: tx.postedAt.toISOString(),
    box: tx.box ? { id: tx.box.id, name: tx.box.name } : null,
  }));
}

/** Sum of DEPOSIT transactions in the last 30 days, in cents. */
export async function loadIncomeLast30dCents(userId: string): Promise<number> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await prisma.transaction.aggregate({
    where: {
      userId,
      type: "DEPOSIT",
      postedAt: { gte: since },
    },
    _sum: { amount: true },
  });
  return rows._sum.amount ?? 0;
}
