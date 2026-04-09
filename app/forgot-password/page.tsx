"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col max-w-md mx-auto px-6">
      <div className="pt-8 pb-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <span className="text-lg font-bold text-gray-900">LockBox</span>
        </div>

        {sent ? (
          <div className="pt-8">
            <div className="text-4xl mb-4">📬</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Check your email
            </h1>
            <p className="text-gray-500 mb-8">
              If an account exists for <strong>{email}</strong>, we sent a reset
              link. Check your inbox.
            </p>
            <button
              onClick={() => router.push("/signin")}
              className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Forgot your password?
            </h1>
            <p className="text-gray-500 mb-8">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-semibold text-base disabled:opacity-40"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <button
              onClick={() => router.push("/signin")}
              className="w-full mt-4 text-sm text-gray-500 text-center"
            >
              ← Back to sign in
            </button>
          </>
        )}
      </div>
    </main>
  );
}
