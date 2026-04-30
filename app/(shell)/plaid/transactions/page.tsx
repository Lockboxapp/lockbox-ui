"use client";

// ============================================================
// app/(shell)/plaid/transactions/page.tsx
// Sprint 17 extended hotfix — read-only view of the user's real
// bank transactions pulled via Plaid. Distinct from the LockBox
// activity feed at /transactions; the title makes that explicit.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";

const PAGE_SIZE = 50;

type Tx = {
  id: string;
  merchant: string | null;
  amount: number; // cents, positive = debit
  category: string | null;
  date: string;
};

type RangeFilter = "all" | "this_week" | "this_month" | "last_3_months";

const fmt = (cents: number) =>
  (Math.abs(cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

function prettyCategory(c: string | null): string {
  if (!c) return "Uncategorized";
  return c
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function PlaidTransactionsPage() {
  const router = useRouter();
  const [institution, setInstitution] = useState<string | null>(null);
  const [items, setItems] = useState<Tx[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [range, setRange] = useState<RangeFilter>("last_3_months");
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // institution name for the header
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plaid/balance");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.connected) setInstitution(data.institution ?? null);
      } catch {
        // header label falls back to generic
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (nextOffset: number, replace: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          offset: String(nextOffset),
          limit: String(PAGE_SIZE),
          range,
        });
        if (category) params.set("category", category);
        if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
        const res = await fetch(
          `/api/plaid/transactions/list?${params.toString()}`,
        );
        if (!res.ok) throw new Error("load_failed");
        const data = await res.json();
        const rows: Tx[] = data.transactions ?? [];
        setHasMore(!!data.hasMore);
        setCategories(data.categories ?? []);
        setItems((prev) => (replace ? rows : [...prev, ...rows]));
        setOffset(nextOffset + rows.length);
      } catch {
        setError("Couldn't load transactions.");
      } finally {
        setLoading(false);
      }
    },
    [range, category, debouncedQuery],
  );

  // reset on filter change
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setHasMore(false);
    void load(0, true);
  }, [range, category, debouncedQuery, load]);

  return (
    <div className="px-4 py-5 pb-24 max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => router.push("/home")}
          className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4 text-gray-700" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {institution ? `${institution} transactions` : "Bank transactions"}
          </h2>
          <p className="text-xs text-gray-500">
            Read-only · pulled from your bank via Plaid
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by merchant"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
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
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {prettyCategory(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}

      {!loading && items.length === 0 && !error ? (
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-8 text-center shadow-sm">
          <p className="text-sm text-gray-600 font-medium">
            No transactions match these filters.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {items.map((tx, i) => {
            const isCredit = tx.amount < 0;
            const dateStr = new Date(tx.date).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <div
                key={tx.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < items.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <div
                  className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center ${
                    isCredit ? "bg-emerald-50" : "bg-gray-100"
                  }`}
                >
                  {isCredit ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 leading-snug truncate">
                    {tx.merchant ?? "Transaction"}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {prettyCategory(tx.category)} · {dateStr}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`text-sm font-semibold ${
                      isCredit ? "text-emerald-600" : "text-gray-900"
                    }`}
                  >
                    {isCredit ? "+" : "−"}
                    {fmt(tx.amount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <button
          type="button"
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
    </div>
  );
}
