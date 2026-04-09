// ============================================================
// app/(onboarding)/lock/page.tsx
// Screen 5 — Lock Behavior
// ============================================================

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const LOCK_OPTIONS = [
  {
    id: "locked",
    icon: "🔒",
    label: "Fully locked",
    description: "Money stays locked until you say so.",
  },
  {
    id: "emergency",
    icon: "🛡️",
    label: "Allow emergency access",
    description: "Access any time, with extra friction.",
  },
  {
    id: "keyholder",
    icon: "👤",
    label: "Add a keyholder",
    description: "Someone you trust approves unlocks.",
  },
];

function LockPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const boxId = searchParams.get("boxId");
  const intent = searchParams.get("intent") ?? "control";

  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (!selected || !boxId) return;
    setLoading(true);

    // Map selection to lockType enum
    const lockTypeMap: Record<string, string> = {
      locked: "HARD",
      emergency: "SOFT",
      keyholder: "KEYHOLDER",
    };

    const lockType = lockTypeMap[selected] ?? "SOFT";

    try {
      await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockType }),
      });
    } catch {
      // Non-blocking — still redirect to dashboard
    }

    // If keyholder selected, redirect to keyholders page
    if (selected === "keyholder") {
      router.push("/keyholders");
    } else {
      router.push("/");
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

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          How do you want to protect it?
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          You can always change this later.
        </p>

        <div className="space-y-3">
          {LOCK_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                selected === option.id
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1">
                <div
                  className={`font-semibold text-sm ${selected === option.id ? "text-emerald-700" : "text-gray-900"}`}
                >
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {option.description}
                </div>
              </div>
              {selected === option.id && (
                <div className="h-5 w-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* The Banker */}
        <p className="text-xs text-emerald-600 font-medium mt-8 italic">
          "You're doing the right thing." — The Banker
        </p>
      </div>

      <div className="pb-8 pt-4">
        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base disabled:opacity-40 mb-4"
        >
          {loading ? "Setting up…" : "Go to dashboard"}
        </button>
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === 3 ? "w-6 bg-emerald-600" : "w-1.5 bg-gray-200"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-1"></p>
      </div>
    </div>
  );
}

export default function LockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      }
    >
      <LockPageInner />
    </Suspense>
  );
}
