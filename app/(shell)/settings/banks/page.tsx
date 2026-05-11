"use client";

// ============================================================
// app/(shell)/settings/banks/page.tsx
// Sprint 17 (Phase 2) — Connected banks settings.
// Sprint 17 extended hotfix — multi-bank UI: lists every connected
// PlaidItem with per-item Sync now, Disconnect, and Set as primary.
// "Add another bank" opens Plaid Link again.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, RefreshCw, Trash2, Star, Plus } from "lucide-react";
import PlaidLink from "@/components/PlaidLink";

type Item = {
  id: string;
  institution: string;
  isPrimary: boolean;
  createdAt: string;
};

export default function ConnectedBanksPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // `${itemId}:${action}`
  const [showLink, setShowLink] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/plaid/items");
      if (!res.ok) throw new Error("items_failed");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function syncAll() {
    setBusy("__all__:sync");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessage(
        `Synced ${data.totalFetched ?? 0} transactions across ${data.itemsSynced ?? 0} bank(s) (${data.newCount ?? 0} new).`,
      );
    } catch {
      setError("Sync failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function setPrimary(plaidItemId: string) {
    setBusy(`${plaidItemId}:primary`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/set-primary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      setMessage("Primary bank updated.");
    } catch {
      setError("Couldn't set primary. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(plaidItemId: string, institution: string) {
    if (
      !window.confirm(
        `Disconnect ${institution}? Your boxes stay; bill suggestions tied to this bank will be removed.`,
      )
    ) {
      return;
    }
    setBusy(`${plaidItemId}:disconnect`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId }),
      });
      if (!res.ok) throw new Error();
      await refresh();
      setMessage(`${institution} disconnected.`);
    } catch {
      setError("Couldn't disconnect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const sortedItems = useMemo(() => items ?? [], [items]);
  const hasAny = sortedItems.length > 0;

  return (
    <div className="px-4 py-5 pb-24 max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">Connected banks</h2>
      <p className="text-sm text-gray-600">
        Plaid is read-only. LockBox uses these connections for balance and
        transaction visibility — money never moves through your bank from here.
      </p>

      {items === null && (
        <div className="text-sm text-gray-500">Loading…</div>
      )}

      {items !== null && !hasAny && !showLink && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm text-gray-700">No bank connected yet.</p>
          <button
            type="button"
            onClick={() => router.push("/connect-bank")}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
          >
            Connect a bank
          </button>
        </div>
      )}

      {hasAny && (
        <div className="space-y-3">
          {sortedItems.map((it) => (
            <div
              key={it.id}
              className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {it.institution}
                  </div>
                  <div className="text-xs text-gray-500 inline-flex items-center gap-1">
                    {it.isPrimary && (
                      <span className="inline-flex items-center gap-0.5 text-amber-600">
                        <Star className="h-3 w-3" /> Primary
                      </span>
                    )}
                    {!it.isPrimary && <span>Connected</span>}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {!it.isPrimary && sortedItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPrimary(it.id)}
                    disabled={busy !== null}
                    className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                    {busy === `${it.id}:primary` ? "Setting…" : "Set as primary"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => disconnect(it.id, it.institution)}
                  disabled={busy !== null}
                  className="py-2.5 rounded-xl border border-rose-200 text-sm text-rose-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {busy === `${it.id}:disconnect`
                    ? "Disconnecting…"
                    : "Disconnect"}
                </button>
              </div>
            </div>
          ))}

          <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
            <button
              type="button"
              onClick={syncAll}
              disabled={busy !== null}
              className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {busy === "__all__:sync" ? "Syncing…" : "Sync all banks now"}
            </button>
          </div>

          {!showLink ? (
            <button
              type="button"
              onClick={() => setShowLink(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add another bank
            </button>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <PlaidLink
                onConnected={async (inst) => {
                  setShowLink(false);
                  setMessage(`${inst} connected.`);
                  await refresh();
                }}
                label="Connect bank with Plaid"
              />
              <button
                type="button"
                onClick={() => setShowLink(false)}
                className="mt-2 w-full py-2 rounded-xl text-sm text-gray-600"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
