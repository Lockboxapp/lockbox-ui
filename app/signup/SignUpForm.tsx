"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Failed to sign up");
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/signin"), 800);
  };

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6">
        <h1 className="text-xl font-semibold mb-4">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm">Full name</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Full Name"
              required
            />
          </div>
          <div>
            <label className="text-sm">Email</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-sm">Password</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          {ok && (
            <div className="text-sm text-emerald-700">Account created!</div>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 text-white"
          >
            Sign up
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4">
          Have an account?{" "}
          <a className="text-emerald-700 underline" href="/signin">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
