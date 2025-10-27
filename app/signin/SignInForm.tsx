"use client";
import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
    if (res?.error) {
      setError("Invalid credentials");
      return;
    }
    router.push("/");
  };

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
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
            />
          </div>
          {error && <div className="text-sm text-rose-600">{error}</div>}
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 text-white"
          >
            Sign in
          </button>
        </form>
        <p className="text-sm text-gray-500 mt-4">
          No account? <a className="text-emerald-700 underline" href="/signup">Create one</a>
        </p>
      </div>
    </main>
  );
}
