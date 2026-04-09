// ============================================================
// app/(onboarding)/protect/page.tsx
// Screen 4 — Create First Box
// ============================================================

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const INTENT_CONFIG: Record<
  string,
  { boxName: string; description: string; placeholder: string }
> = {
  rent: {
    boxName: "Rent Box",
    description: "This will hold your rent so it's ready when you need it.",
    placeholder: "1500",
  },
  bills: {
    boxName: "Bills Box",
    description: "This will hold your bill money so you never miss a payment.",
    placeholder: "500",
  },
  savings: {
    boxName: "Savings Box",
    description: "This will protect your savings from impulse spending.",
    placeholder: "1000",
  },
  control: {
    boxName: "My Box",
    description: "This will hold money you want to protect from spending.",
    placeholder: "500",
  },
};

function ProtectPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent") ?? "control";
  const config = INTENT_CONFIG[intent] ?? INTENT_CONFIG.control;

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!amount || Number(amount) < 1) {
      setError("Please enter an amount.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.boxName,
          targetAmount: Number(amount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create box.");
        setLoading(false);
        return;
      }

      // Pass box id to lock screen
      router.push(`/lock?boxId=${data.id}&intent=${intent}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      <div className="flex-1 pt-4">
        <button onClick={() => router.back()} className="mb-6 text-gray-400">
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Let's protect your first expense.
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          We'll set this money aside so you don't accidentally spend it.
        </p>

        {/* Box preview card */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">
              {config.boxName}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {config.description}
            </div>
          </div>
        </div>

        {/* Amount input */}
        <div className="mb-2">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            How much do you need to protect?
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">
              $
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={config.placeholder}
              min="1"
              className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-4 text-xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            You can change this anytime.
          </p>
        </div>

        {/* The Banker */}
        <p className="text-xs text-emerald-600 font-medium mt-6 italic">
          "I'll help you keep this safe." — The Banker
        </p>

        {error && <p className="text-sm text-rose-600 mt-4">{error}</p>}
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={handleCreate}
          disabled={loading || !amount}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base disabled:opacity-40 mb-4"
        >
          {loading ? "Creating…" : "Create & protect it"}
        </button>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === 2 ? "w-6 bg-emerald-600" : "w-1.5 bg-gray-200"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-1"></p>
      </div>
    </div>
  );
}

export default function ProtectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      }
    >
      <ProtectPageInner />
    </Suspense>
  );
}
