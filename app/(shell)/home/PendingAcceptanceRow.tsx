"use client";

// ============================================================
// PendingAcceptanceRow — Sprint 14
// Renders a single Today's Actions row for a PENDING_USER_ACCEPTANCE
// transfer. Tapping opens the full acceptance modal with Accept/Cancel.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";

const fmt = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export type PendingAcceptanceCard = {
  id: string;
  sourceBoxName: string;
  destinationBoxName: string;
  destinationLockType: string; // "HARD" | "KEYHOLDER"
  amountDollars: number;
};

export default function PendingAcceptanceRow({
  card,
}: {
  card: PendingAcceptanceCard;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(action: "accept" | "cancel-by-user") {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/unlock-requests/${card.id}/${action}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm hover:bg-amber-100 cursor-pointer transition-colors w-full text-left"
      >
        <div className="h-8 w-8 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0 text-sm font-semibold">
          ⚡
        </div>
        <div className="flex-1 text-sm font-medium text-amber-900 leading-snug">
          Your keyholder approved your transfer — tap to review
        </div>
        <div className="text-amber-500 text-lg shrink-0">›</div>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
          onClick={() => (loading ? null : setOpen(false))}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Transfer approved
            </h3>
            <p className="text-sm text-gray-600 leading-snug mb-4">
              Your keyholder approved your transfer of{" "}
              <strong>{fmt(card.amountDollars)}</strong> from{" "}
              <strong>{card.sourceBoxName}</strong> to{" "}
              <strong>{card.destinationBoxName}</strong>. As a reminder, once
              transferred, these funds will be locked and will require the
              unlock process to access.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-amber-800 leading-snug">
                {card.destinationLockType === "KEYHOLDER"
                  ? "Accessing these funds later will require your keyholder's approval."
                  : "Accessing these funds later will require going through the unlock flow."}
              </p>
            </div>

            {error && (
              <p className="text-sm text-rose-600 mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => submit("cancel-by-user")}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-50"
              >
                {loading ? "…" : "Cancel"}
              </button>
              <button
                onClick={() => submit("accept")}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Working…" : "Accept transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
