"use client";

// ============================================================
// components/PlaidLink.tsx
// Sprint 17 (Phase 2) — opens Plaid Link in sandbox/production.
// Calls /api/plaid/create-link-token on mount, then renders a
// "Connect bank" button that opens Plaid's UI. On success, posts
// the public_token to /api/plaid/exchange-token and notifies the
// parent via onConnected.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

type Props = {
  onConnected?: (institution: string) => void;
  className?: string;
  label?: string;
};

export default function PlaidLink({ onConnected, className, label }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/plaid/create-link-token", {
          method: "POST",
        });
        if (!res.ok) throw new Error("link_token_failed");
        const data = await res.json();
        if (!cancelled) setLinkToken(data.linkToken);
      } catch {
        if (!cancelled) setError("Couldn't start Plaid. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: { institution?: { name?: string } | null }) => {
      setExchanging(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            institution: metadata?.institution?.name ?? null,
          }),
        });
        if (!res.ok) throw new Error("exchange_failed");
        const data = await res.json();
        onConnected?.(data.institution ?? metadata?.institution?.name ?? "Connected bank");
      } catch {
        setError("Couldn't finish connecting. Please try again.");
      } finally {
        setExchanging(false);
      }
    },
    [onConnected],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  const disabled = loading || exchanging || !ready || !linkToken;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => open()}
        disabled={disabled}
        className={
          className ??
          "w-full py-3 rounded-xl bg-emerald-600 text-white font-medium text-sm disabled:opacity-50"
        }
      >
        {exchanging
          ? "Connecting…"
          : loading
            ? "Loading…"
            : (label ?? "Connect bank")}
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
