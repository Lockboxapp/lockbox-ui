"use client";

// ============================================================
// app/(shell)/connect-bank/page.tsx
// Sprint 17 (Phase 2) — Plaid sandbox connection + Banker review of
// detected recurring bills. Each bill becomes a one-tap box.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, X } from "lucide-react";
import PlaidLink from "@/components/PlaidLink";

type Suggestion = {
  recurringBillId: string;
  merchant: string;
  suggestedName: string;
  amount: number; // cents
  targetDay: number | null;
  recommendedLockType: "SOFT" | "HARD";
};

type ConnectionState = "idle" | "syncing" | "ready";

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function nextOccurrence(day: number | null): Date | null {
  if (!day) return null;
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), day);
  if (candidate.getTime() < now.getTime()) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  return candidate;
}

export default function ConnectBankPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [institution, setInstitution] = useState<string | null>(null);
  const [state, setState] = useState<ConnectionState>("idle");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // If user already connected, skip the link step.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plaid/balance");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.connected) {
          setConnected(true);
          setInstitution(data.institution ?? "Connected bank");
          await runScan();
        }
      } catch {
        // not connected yet
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runScan = useCallback(async () => {
    setState("syncing");
    setError(null);
    try {
      const sync = await fetch("/api/plaid/sync", { method: "POST" });
      if (!sync.ok) throw new Error("sync_failed");
      const sugRes = await fetch("/api/plaid/suggestions");
      if (!sugRes.ok) throw new Error("suggestions_failed");
      const data = await sugRes.json();
      setSuggestions(data.suggestions ?? []);
      setState("ready");
    } catch {
      setError("Couldn't scan transactions. Try again.");
      setState("ready");
    }
  }, []);

  const handleConnected = useCallback(
    async (inst: string) => {
      setConnected(true);
      setInstitution(inst);
      await runScan();
    },
    [runScan],
  );

  async function acceptSuggestion(s: Suggestion) {
    setAccepting(s.recurringBillId);
    setError(null);
    try {
      const lockUntil = nextOccurrence(s.targetDay);
      const res = await fetch("/api/plaid/accept-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringBillId: s.recurringBillId,
          name: s.suggestedName,
          lockType: s.recommendedLockType,
          targetAmountCents: s.amount,
          lockUntilISO: lockUntil ? lockUntil.toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error("accept_failed");
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(s.recurringBillId);
        return next;
      });
    } catch {
      setError("Couldn't create box. Try again.");
    } finally {
      setAccepting(null);
    }
  }

  function skipSuggestion(id: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  const visible = suggestions.filter((s) => !dismissed.has(s.recurringBillId));
  const allReviewed =
    connected && state === "ready" && visible.length === 0;

  return (
    <div className="px-4 py-5 pb-24 max-w-md mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Connect your bank</h2>
        <p className="mt-1 text-sm text-gray-600">
          Read-only. LockBox never moves money through your bank — it scans your
          recent activity to suggest boxes for the bills you already pay.
        </p>
      </div>

      {!connected && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <PlaidLink onConnected={handleConnected} label="Connect bank with Plaid" />
          <p className="mt-3 text-xs text-gray-500">
            Sandbox: use <span className="font-medium">user_good</span> /{" "}
            <span className="font-medium">pass_good</span>.
          </p>
        </div>
      )}

      {connected && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {institution ?? "Connected bank"}
            </div>
            <div className="text-xs text-gray-500">Connected</div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        </div>
      )}

      {connected && state === "syncing" && (
        <div className="text-sm text-gray-600">
          Scanning your last 90 days of transactions…
        </div>
      )}

      {connected && state === "ready" && visible.length > 0 && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-sm text-gray-900 font-medium">
              I looked through your last 3 months. Here's what I found:
            </p>
            <p className="mt-1 text-xs text-gray-600">— The Banker</p>
          </div>

          {visible.map((s) => {
            const next = nextOccurrence(s.targetDay);
            return (
              <div
                key={s.recurringBillId}
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {s.suggestedName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {s.merchant} · {fmt(s.amount)}
                    {next
                      ? ` · next on ${next.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}`
                      : ""}
                  </div>
                  <div className="mt-1 inline-block text-[11px] uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-2 py-0.5">
                    Recommended: {s.recommendedLockType}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => acceptSuggestion(s)}
                    disabled={accepting === s.recurringBillId}
                    className="py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {accepting === s.recurringBillId ? "Creating…" : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => skipSuggestion(s.recurringBillId)}
                    className="py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allReviewed && (
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-8 text-center shadow-sm">
          <p className="text-sm text-gray-900 font-medium">All reviewed.</p>
          <p className="mt-1 text-xs text-gray-500">
            You can revisit suggestions any time as more transactions sync.
          </p>
          <button
            type="button"
            onClick={() => router.push("/home")}
            className="mt-4 py-2.5 px-5 rounded-xl bg-gray-900 text-white text-sm font-medium"
          >
            Done
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
