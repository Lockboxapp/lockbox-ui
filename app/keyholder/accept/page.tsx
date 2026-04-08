// ============================================================
// app/keyholder/accept/page.tsx
// Keyholder invite acceptance page
// No auth required — token IS the auth
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AcceptPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<
    "loading" | "success" | "already" | "expired" | "invalid"
  >("loading");
  const [boxOwner, setBoxOwner] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }

    fetch(`/api/keyholders/${token}`, { method: "PATCH" })
      .then(async (res) => {
        const json = await res.json();
        if (res.status === 404) {
          setState("invalid");
          return;
        }
        if (res.status === 410) {
          setState("expired");
          return;
        }
        if (res.status === 409) {
          setState("already");
          return;
        }
        if (res.ok) {
          setState("success");
          return;
        }
        setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-lg font-bold text-gray-900">LockBox</span>
          <span className="text-xs text-gray-400 ml-1.5">Keyholder Portal</span>
        </div>

        {state === "loading" && (
          <div className="text-center text-sm text-gray-400">
            Accepting invite…
          </div>
        )}

        {state === "success" && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              You're now a keyholder
            </h1>
            <p className="text-sm text-gray-500">
              You'll receive an email when they request an early unlock. You can
              approve or deny each request — you cannot move or access their
              funds.
            </p>
          </div>
        )}

        {state === "already" && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Already accepted
            </h1>
            <p className="text-sm text-gray-500">
              You've already accepted this keyholder invitation. No further
              action needed.
            </p>
          </div>
        )}

        {state === "expired" && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⏱️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Invite expired
            </h1>
            <p className="text-sm text-gray-500">
              This invite has expired. Ask the person who invited you to send a
              new one.
            </p>
          </div>
        )}

        {state === "invalid" && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">🔒</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Link not found
            </h1>
            <p className="text-sm text-gray-500">
              This link is invalid or has already been used.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      }
    >
      <AcceptPageInner />
    </Suspense>
  );
}
