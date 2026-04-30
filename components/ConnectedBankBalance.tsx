"use client";

// ============================================================
// components/ConnectedBankBalance.tsx
// Sprint 17 (Phase 2) — surfaces the user's real bank balance from
// Plaid on the home Money Snapshot. Read-only.
// Sprint 17 extended hotfix — tappable card opens a bottom sheet:
//   1. Add to LockBox        → /vaults?action=addFunds&source=external
//   2. View transactions     → /plaid/transactions
//   3. Manage connection     → /settings/banks
// And a visible "Add to LockBox" button on the card itself so the
// primary action is one tap, not two.
// ============================================================

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ListOrdered,
  PlusCircle,
  Settings,
  X,
} from "lucide-react";

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
  const router = useRouter();
  const [state, setState] = useState<BalanceState>({ status: "loading" });
  const [sheetOpen, setSheetOpen] = useState(false);

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

  function goAddToLockBox() {
    setSheetOpen(false);
    router.push("/vaults?action=addFunds&source=external");
  }
  function goTransactions() {
    setSheetOpen(false);
    router.push("/plaid/transactions");
  }
  function goManage() {
    setSheetOpen(false);
    router.push("/settings/banks");
  }

  return (
    <>
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="w-full flex items-center gap-3 text-left"
          aria-haspopup="menu"
        >
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
          <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
        </button>
        <button
          type="button"
          onClick={goAddToLockBox}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium inline-flex items-center justify-center gap-1.5"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Add to LockBox
        </button>
      </div>

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl p-4 shadow-2xl space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold text-gray-900">
                {state.institution}
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <SheetItem
              icon={<PlusCircle className="h-4 w-4 text-emerald-600" />}
              label="Add to LockBox"
              sub="Move money from this bank into your Wallet"
              onClick={goAddToLockBox}
            />
            <SheetItem
              icon={<ListOrdered className="h-4 w-4 text-gray-700" />}
              label="View transactions"
              sub="See your bank activity inside LockBox"
              onClick={goTransactions}
            />
            <SheetItem
              icon={<Settings className="h-4 w-4 text-gray-700" />}
              label="Manage connection"
              sub="Sync, disconnect, or add another bank"
              onClick={goManage}
            />
          </div>
        </div>
      )}
    </>
  );
}

function SheetItem({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 text-left"
    >
      <div className="h-9 w-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{sub}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
    </button>
  );
}
