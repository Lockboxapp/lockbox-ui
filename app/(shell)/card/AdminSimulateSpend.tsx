"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSimulateSpend({ walletBalance }: { walletBalance: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSimulate() {
    setError("");
    setSuccess("");
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 1) {
      setError("Enter an amount of at least $1");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/card/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInDollars: n }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Simulation failed");
        return;
      }
      setSuccess(`Simulated $${n} card spend. New Wallet balance: $${data.newWalletBalance}.`);
      setAmount("");
      router.refresh();
    } catch {
      setError("Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-rose-50 border-2 border-dashed border-rose-300 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-rose-700 uppercase tracking-widest">
          Admin · Dev tool
        </span>
        <span className="text-[10px] bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full font-semibold">
          SIMULATED
        </span>
      </div>
      <p className="text-xs text-rose-800">
        Not a real card. Debits your Wallet balance and writes a fake transaction for testing.
        Regular users never see this.
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          placeholder="Amount ($)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 border border-rose-300 rounded-xl px-3 py-2 text-sm text-gray-900 bg-white"
        />
        <button
          onClick={handleSimulate}
          disabled={loading || walletBalance <= 0}
          className="px-4 py-2 rounded-xl bg-rose-700 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Running…" : "Simulate"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-700 font-medium">{error}</p>}
      {success && <p className="text-xs text-emerald-700 font-medium">{success}</p>}
    </div>
  );
}
