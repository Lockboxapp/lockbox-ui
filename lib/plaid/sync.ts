// ============================================================
// lib/plaid/sync.ts
// Sprint 17 (Phase 2) — pulls last 90 days of transactions from
// Plaid, dedupes by plaidId, and upserts into PlaidTransaction.
// Sprint 17 extended hotfix — multi-bank: each PlaidItem is synced
// individually; per-user sync iterates all items.
// ============================================================
// Sign convention: Plaid uses positive = debit, negative = credit.
// We store `amount` in CENTS preserving that sign.
// ============================================================

import { prisma } from "@/lib/db";
import { getPlaidClient } from "@/lib/plaid/client";
import { decrypt } from "@/lib/encryption";

const WINDOW_DAYS = 90;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Sync a single Plaid item (one bank connection).
async function syncOnePlaidItem(itemId: string): Promise<{
  newCount: number;
  totalFetched: number;
}> {
  const item = await prisma.plaidItem.findUnique({ where: { id: itemId } });
  if (!item) return { newCount: 0, totalFetched: 0 };

  const accessToken = decrypt(item.accessToken);
  const plaid = getPlaidClient();

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - WINDOW_DAYS);

  let offset = 0;
  const pageSize = 250;
  let totalAvailable = Infinity;
  const collected: Array<{
    transaction_id: string;
    name: string | null;
    merchant_name: string | null;
    amount: number;
    date: string;
    personal_finance_category?: { primary?: string } | null;
    category?: string[] | null;
  }> = [];

  while (offset < totalAvailable) {
    const res = await plaid.transactionsGet({
      access_token: accessToken,
      start_date: isoDate(start),
      end_date: isoDate(end),
      options: { count: pageSize, offset },
    });
    totalAvailable = res.data.total_transactions;
    for (const tx of res.data.transactions) {
      collected.push({
        transaction_id: tx.transaction_id,
        name: tx.name ?? null,
        merchant_name: tx.merchant_name ?? null,
        amount: tx.amount,
        date: tx.date,
        personal_finance_category: tx.personal_finance_category ?? null,
        category: tx.category ?? null,
      });
    }
    offset += res.data.transactions.length;
    if (res.data.transactions.length === 0) break;
  }

  let newCount = 0;
  for (const t of collected) {
    const merchant = t.merchant_name ?? t.name ?? null;
    const category =
      t.personal_finance_category?.primary ??
      (t.category && t.category.length > 0 ? t.category[0] : null);
    const amountCents = Math.round(t.amount * 100); // preserve sign
    const date = new Date(t.date);

    const result = await prisma.plaidTransaction.upsert({
      where: { plaidId: t.transaction_id },
      create: {
        userId: item.userId,
        plaidId: t.transaction_id,
        merchant,
        amount: amountCents,
        category,
        date,
      },
      update: {
        merchant,
        amount: amountCents,
        category,
        date,
      },
    });
    if (result.createdAt.getTime() > Date.now() - 5_000) newCount++;
  }

  return { newCount, totalFetched: collected.length };
}

// Sync every PlaidItem the user has connected.
export async function syncPlaidTransactionsForUser(userId: string): Promise<{
  newCount: number;
  totalFetched: number;
  itemsSynced: number;
}> {
  const items = await prisma.plaidItem.findMany({
    where: { userId },
    select: { id: true },
  });
  let newCount = 0;
  let totalFetched = 0;
  for (const item of items) {
    const r = await syncOnePlaidItem(item.id);
    newCount += r.newCount;
    totalFetched += r.totalFetched;
  }
  return { newCount, totalFetched, itemsSynced: items.length };
}

export { syncOnePlaidItem };
