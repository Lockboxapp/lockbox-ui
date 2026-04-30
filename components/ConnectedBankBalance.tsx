"use client";

// ============================================================
// components/ConnectedBankBalance.tsx
// Sprint 17 (Phase 2) — surfaces the user's real bank balance from
// Plaid on the home Money Snapshot. Read-only.
// If not connected, renders a single "Connect bank" tap-target.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";

type BalanceState =
  | { status: "loading" }
  | { status: "disconnected" }
  | {
      status: "connected";
      institution: string;
      accountName: string | null;
      balanceCents: number | null;
    }
  | { status: "error" };

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default function ConnectedBankBalance() {
  const [state, setState] = useState<BalanceState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plaid/balance");
        if (!res.ok) {
          if (!cancelled) setState({ status: "error" });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!data.connected) {
          setState({ status: "disconnected" });
        } else {
          setState({
            status: "connected",
            institution: data.institution ?? "Connected bank",
            accountName: data.accountName ?? null,
            balanceCents:
              typeof data.balanceCents === "number" ? data.balanceCents : null,
          });
        }
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") return null;
  if (state.status === "error") return null;

  if (state.status === "disconnected") {
    return (
      <Link
        href="/connect-bank"
        className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">Connect bank</div>
            <div className="text-xs text-gray-500">
              Read-only — see real balances and bill suggestions.
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500">
            {state.institution}
            {state.accountName ? ` · ${state.accountName}` : ""}
          </div>
          <div className="text-base font-semibold text-gray-900">
            {state.balanceCents == null ? "—" : fmt(state.balanceCents)}
          </div>
        </div>
      </div>
    </div>
  );
}
