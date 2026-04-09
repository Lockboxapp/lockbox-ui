// ============================================================
// app/(onboarding)/intent/page.tsx
// Screen 2 — Intent Selection (no login yet)
// ============================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INTENTS = [
  {
    id: "rent",
    label: "Rent",
    icon: "🏠",
    description: "Cover your rent every month",
  },
  {
    id: "bills",
    label: "Bills",
    icon: "⚡",
    description: "Never miss a utility or subscription",
  },
  {
    id: "savings",
    label: "Savings",
    icon: "💰",
    description: "Build a protected savings goal",
  },
  {
    id: "control",
    label: "Just want more control",
    icon: "🛡️",
    description: "Protect money from impulse spending",
  },
];

export default function IntentPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  function handleContinue() {
    if (!selected) return;
    router.push(`/onboard-signup?intent=${selected}`);
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      <div className="flex-1 pt-4">
        {/* Back */}
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
          What do you want to make sure is always covered?
        </h1>
        <p className="text-gray-500 text-sm mb-8">Choose one to get started.</p>

        <div className="space-y-3">
          {INTENTS.map((intent) => (
            <button
              key={intent.id}
              onClick={() => setSelected(intent.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                selected === intent.id
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <span className="text-2xl">{intent.icon}</span>
              <div>
                <div
                  className={`font-semibold text-sm ${selected === intent.id ? "text-emerald-700" : "text-gray-900"}`}
                >
                  {intent.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {intent.description}
                </div>
              </div>
              {selected === intent.id && (
                <div className="ml-auto h-5 w-5 bg-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
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
      </div>

      {/* CTA */}
      <div className="pb-8 pt-6">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base disabled:opacity-40"
        >
          Continue
        </button>
        <div className="flex justify-center gap-1.5 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === 1 ? "w-6 bg-emerald-600" : "w-1.5 bg-gray-200"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-1"></p>
      </div>
    </div>
  );
}
