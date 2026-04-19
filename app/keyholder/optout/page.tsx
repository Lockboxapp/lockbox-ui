// ============================================================
// app/keyholder/optout/page.tsx
// Standalone keyholder opt-out page — outside the authenticated shell.
// Token IS the auth. No sign-in required.
// ============================================================

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type PageState = "loading" | "confirm" | "submitting" | "done" | "invalid";

type ContextData = {
  ownerName: string | null;
  boxCount: number;
  alreadyRevoked: boolean;
};

function OptOutInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<PageState>("loading");
  const [ctx, setCtx] = useState<ContextData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`/api/keyholder/optout?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? "Invalid or expired link.");
          setState("invalid");
          return;
        }
        if (data.alreadyRevoked) {
          setCtx(data);
          setState("done");
          return;
        }
        setCtx(data);
        setState("confirm");
      })
      .catch(() => {
        setError("Something went wrong. Please try again.");
        setState("invalid");
      });
  }, [token]);

  async function handleConfirm() {
    setState("submitting");
    setError("");
    try {
      const res = await fetch("/api/keyholder/optout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Opt-out failed.");
        setState("confirm");
        return;
      }
      setState("done");
    } catch {
      setError("Something went wrong. Please try again.");
      setState("confirm");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 grid place-items-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-white stroke-current fill-none" strokeWidth={2}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">LockBox</span>
        </div>

        {state === "loading" && <p className="text-sm text-gray-500">Loading…</p>}

        {state === "invalid" && (
          <>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">Link not valid</h1>
            <p className="text-sm text-gray-500">
              {error || "This opt-out link is invalid or has expired."}
            </p>
          </>
        )}

        {state === "confirm" && ctx && (
          <>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">
              Step down as keyholder?
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              You are about to remove yourself as a keyholder
              {ctx.ownerName ? ` for ${ctx.ownerName}` : ""}. This will affect{" "}
              <strong>{ctx.boxCount}</strong> box{ctx.boxCount === 1 ? "" : "es"}.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              They will be notified and will need to assign a new keyholder or switch the affected boxes to Flexible protection.
            </p>
            {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => window.close()}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium"
              >
                Confirm opt-out
              </button>
            </div>
          </>
        )}

        {state === "submitting" && <p className="text-sm text-gray-500">Submitting…</p>}

        {state === "done" && (
          <>
            <div className="text-3xl mb-3">✓</div>
            <h1 className="text-lg font-semibold text-gray-900 mb-2">
              You&apos;ve been removed as a keyholder.
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              {ctx?.ownerName ? `${ctx.ownerName} has been notified.` : "The owner has been notified."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function KeyholderOptOutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      }
    >
      <OptOutInner />
    </Suspense>
  );
}
