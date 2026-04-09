// ============================================================
// app/(onboarding)/onboard-signup/page.tsx
// Screen 3 — Identity + Signup (account created here)
// ============================================================

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

function OnboardSignupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent") ?? "control";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // Create account
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create account.");
        setLoading(false);
        return;
      }

      // Sign in immediately
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setError(
          "Account created but sign in failed. Please sign in manually.",
        );
        setLoading(false);
        return;
      }

      // Proceed to protect screen with intent
      router.push(`/protect?intent=${intent}`);
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
          Let's get you set up
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          We'll help you protect what matters next.
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              autoComplete="name"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              autoComplete="off"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Terms */}
          <label className="flex items-start gap-3 cursor-pointer">
            <div
              onClick={() => setAgreed(!agreed)}
              className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                agreed ? "bg-emerald-600 border-emerald-600" : "border-gray-300"
              }`}
            >
              {agreed && (
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
              )}
            </div>
            <span className="text-xs text-gray-500 leading-relaxed">
              I agree to the{" "}
              <a href="/terms" className="text-emerald-600 underline">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-emerald-600 underline">
                Privacy Policy
              </a>
            </span>
          </label>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name || !email || !password || !agreed}
            className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base disabled:opacity-40"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
      </div>

      <div className="pb-8 pt-4">
        <div className="flex justify-center gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === 2 ? "w-6 bg-emerald-600" : "w-1.5 bg-gray-200"}`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-1">Step 3 of 4</p>
      </div>
    </div>
  );
}

export default function OnboardSignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-sm text-gray-400">Loading…</div>
        </div>
      }
    >
      <OnboardSignupInner />
    </Suspense>
  );
}
