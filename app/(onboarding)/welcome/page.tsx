// ============================================================
// app/(onboarding)/welcome/page.tsx
// Screen 1 — Welcome
// ============================================================

"use client";

import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)]">
      {/* Content */}
      <div className="flex-1 flex flex-col justify-center pt-8">
        {/* Lock illustration */}
        <div className="mb-10">
          <div className="h-20 w-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-8">
            <div className="h-12 w-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
            Protect your money
            <br />
            before you spend it
          </h1>
          <p className="text-gray-500 text-base leading-relaxed">
            LockBox helps you set aside what matters — so your bills are always
            covered.
          </p>
        </div>

        {/* Trust points */}
        <div className="space-y-4 mb-10">
          {[
            { icon: "🔒", text: "Your money stays yours — always" },
            { icon: "✅", text: "You decide what gets locked" },
            { icon: "🔑", text: "Unlocks require your approval" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-3">
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm text-gray-600">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="pb-8 space-y-3">
        <button
          type="button"
          onClick={() => router.push("/intent")}
          className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base"
        >
          Get started
        </button>
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a href="/signin" className="text-emerald-600 font-medium">
            Sign in
          </a>
        </p>

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 pt-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === 0 ? "w-6 bg-emerald-600" : "w-1.5 bg-gray-200"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-400"></p>
      </div>
    </div>
  );
}
