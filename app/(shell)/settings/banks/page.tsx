"use client";

// ============================================================
// app/(shell)/settings/banks/page.tsx
// Sprint 17 (Phase 2) — Connected banks settings.
// Shows the connected institution + Sync now / Disconnect actions,
// or routes the user to /connect-bank if nothing is linked yet.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, RefreshCw, Trash2 } from "lucide-react";

type ConnState =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "connected"; institution: string };

export default function ConnectedBanksPage() {
  const router = useRouter();
  const [state, setState] = useState<ConnState>({ status: "loading" });
  const [busy, setBusy] = useState<"sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/plaid/balance");
      if (!res.ok) {
        setState({ status: "disconnected" });
        return;
      }
      const data = await res.json();
      if (!data.connected) {
        setState({ status: "disconnected" });
      } else {
        setState({
          status: "connected",
          institution: data.institution ?? "Connected bank",
        });
      }
    } catch {
      setState({ status: "disconnected" });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function syncNow() {
    setBusy("sync");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (!res.ok) throw new Error("sync_failed");
      const data = await res.json();
      setMessage(
        `Synced ${data.totalFetched ?? 0} transactions (${data.newCount ?? 0} new).`,
      );
    } catch {
      setError("Sync failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect this bank? Your transaction history and bill suggestions will be removed from LockBox. Your boxes stay.",
      )
    ) {
      return;
    }
    setBusy("disconnect");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/plaid/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("disconnect_failed");
      setMessage("Bank disconnected.");
      await refresh();
    } catch {
      setError("Couldn't disconnect. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-4 py-5 pb-24 max-w-md mx-auto space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">Connected banks</h2>
      <p className="text-sm text-gray-600">
        LockBox uses Plaid to read balances and scan recent transactions. Money
        never moves through your bank from here.
      </p>

      {state.status === "loading" && (
        <div className="text-sm text-gray-500">Loading…</div>
      )}

      {state.status === "disconnected" && (
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

      {state.status === "connected" && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {state.institution}
              </div>
              <div className="text-xs text-gray-500">Connected</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={syncNow}
              disabled={busy !== null}
              className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy !== null}
              className="py-2.5 rounded-xl border border-rose-200 text-sm text-rose-600 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-emerald-700">{message}</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
