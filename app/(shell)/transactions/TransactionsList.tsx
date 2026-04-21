"use client";

// ============================================================
// TransactionsList — Sprint 15
// Filters (box / type / range) + offset-based "Load more" pagination.
// Icons chosen per transaction type. CARD_SPEND shows card icon + merchant.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, CreditCard } from "lucide-react";

export type BoxOption = {
  id: string;
  name: string;
  isClosed: boolean;
  isWallet: boolean;
};

type Tx = {
  id: string;
  type: string;
  amountCents: number;
  description: string;
  postedAt: string;
  box: { id: string; name: string; lockType: string } | null;
};

type BucketFilter = "all" | "deposit" | "withdraw" | "transfer" | "card_spend";
type RangeFilter = "all" | "this_week" | "this_month" | "last_3_months";

const PAGE_SIZE = 25;

const INFLOW_TYPES = new Set(["DEPOSIT", "TRANSFER_IN", "INCOME"]);

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function iconFor(type: string) {
  const cls = "h-4 w-4";
  switch (type) {
    case "DEPOSIT":
      return <ArrowDownLeft className={`${cls} text-emerald-600`} />;
    case "TRANSFER_IN":
      return <ArrowRight className={`${cls} text-sky-600 rotate-180`} />;
    case "TRANSFER_OUT":
      return <ArrowRight className={`${cls} text-sky-600`} />;
    case "CARD_SPEND":
      return <CreditCard className={`${cls} text-rose-600`} />;
    case "WITHDRAW":
    case "WITHDRAWAL":
      return <ArrowUpRight className={`${cls} text-rose-600`} />;
    default:
      return <ArrowRight className={`${cls} text-gray-500`} />;
  }
}

function bgFor(type: string) {
  switch (type) {
    case "DEPOSIT":
      return "bg-emerald-50";
    case "TRANSFER_IN":
    case "TRANSFER_OUT":
      return "bg-sky-50";
    case "CARD_SPEND":
      return "bg-rose-50";
    case "WITHDRAW":
    case "WITHDRAWAL":
      return "bg-rose-50";
    default:
      return "bg-gray-50";
  }
}

function titleFor(tx: Tx): { title: string; subtitle: string | null } {
  if (tx.type === "CARD_SPEND") {
    const merchant = tx.description.replace(/^Card purchase — /, "") || "Card purchase";
    return { title: "Card purchase", subtitle: merchant };
  }
  const baseTitle: Record<string, string> = {
    DEPOSIT: "Deposit",
    WITHDRAW: "Withdrawal",
    WITHDRAWAL: "Withdrawal",
    TRANSFER_IN: "Transfer in",
    TRANSFER_OUT: "Transfer out",
    LOCK: "Locked",
    UNLOCK: "Unlocked",
  };
  const title = baseTitle[tx.type] ?? tx.type;
  return { title, subtitle: tx.box?.name ?? null };
}

export default function TransactionsList({ boxes }: { boxes: BoxOption[] }) {
  const [boxId, setBoxId] = useState<string>("");
  const [type, setType] = useState<BucketFilter>("all");
  const [range, setRange] = useState<RangeFilter>("all");
  const [items, setItems] = useState<Tx[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextOffset: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          offset: String(nextOffset),
          limit: String(PAGE_SIZE),
          type,
          range,
        });
        if (boxId) params.set("boxId", boxId);
        const res = await fetch(`/api/transactions/list?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        const rows: Tx[] = data.transactions ?? [];
        setHasMore(!!data.hasMore);
        setItems((prev) => (replace ? rows : [...prev, ...rows]));
        setOffset(nextOffset + rows.length);
      } catch {
        setError("Couldn't load transactions.");
      } finally {
        setLoading(false);
      }
    },
    [boxId, type, range],
  );

  // Reload whenever filters change
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(false);
    void load(0, true);
  }, [boxId, type, range, load]);

  return (
    <>
      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm space-y-2">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            Box
          </label>
          <select
            value={boxId}
            onChange={(e) => setBoxId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
          >
            <option value="">All boxes</option>
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.isWallet ? " (Wallet)" : ""}
                {b.isClosed ? " — closed" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BucketFilter)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="all">All</option>
              <option value="deposit">Deposits</option>
              <option value="withdraw">Withdrawals</option>
              <option value="transfer">Transfers</option>
              <option value="card_spend">Card spend</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Range
            </label>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeFilter)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="all">All time</option>
              <option value="this_week">This week</option>
              <option value="this_month">This month</option>
              <option value="last_3_months">Last 3 months</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {error && (
        <div className="text-sm text-rose-600">{error}</div>
      )}

      {!loading && items.length === 0 && !error ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-8 text-center shadow-sm">
          <p className="text-sm text-gray-600 font-medium">No transactions yet.</p>
          <p className="text-xs text-gray-400 mt-1">Your activity will appear here.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {items.map((tx, i) => {
            const inflow = INFLOW_TYPES.has(tx.type);
            const { title, subtitle } = titleFor(tx);
            const amtDollars = Math.round(tx.amountCents / 100);
            const amtStr = `${inflow ? "+" : "−"}$${amtDollars.toLocaleString("en-US")}`;
            const dateStr = new Date(tx.postedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <div
                key={tx.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < items.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center ${bgFor(tx.type)}`}
                >
                  {iconFor(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 leading-snug truncate">
                    {title}
                  </div>
                  {subtitle && (
                    <div className="text-xs text-gray-500 truncate">{subtitle}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-sm font-semibold ${
                      inflow ? "text-emerald-600" : "text-gray-900"
                    }`}
                  >
                    {amtStr}
                  </div>
                  <div className="text-[11px] text-gray-400 whitespace-nowrap">
                    {dateStr}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => void load(offset, false)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}

      {loading && items.length === 0 && (
        <div className="text-xs text-gray-400 text-center py-3">Loading…</div>
      )}
    </>
  );
}
