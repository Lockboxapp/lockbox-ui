"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MERCHANTS = [
  "Grocery store",
  "Gas station",
  "Restaurant",
  "Pharmacy",
  "Online shopping",
];

type Result =
  | {
      approved: true;
      amountCents: number;
      newWalletBalance: number;
    }
  | {
      approved: false;
      amountCents: number;
      walletBalance: number;
    }
  | null;

const fmtCents = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

export default function CardSimulate({ walletBalance }: { walletBalance: number }) {
  const router = useRouter();
  const [merchant, setMerchant] = useState<string>(MERCHANTS[0]);
  const [customMerchant, setCustomMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result>(null);

  async function handleCharge() {
    setError("");
    setResult(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0.01) {
      setError("Enter an amount of at least $0.01");
      return;
    }
    const merchantValue = merchant === "Custom" ? customMerchant.trim() : merchant;
    if (!merchantValue) {
      setError("Enter a merchant name");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/card/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInDollars: n, merchant: merchantValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Simulation failed");
        return;
      }
      setResult(data);
      setAmount("");
      router.refresh(); // so the card visual's balance reflects the new state
    } catch {
      setError("Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Simulate a purchase
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Test how card spending behaves against your Wallet.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Merchant</label>
        <select
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
        >
          {MERCHANTS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value="Custom">Custom…</option>
        </select>
        {merchant === "Custom" && (
          <input
            type="text"
            placeholder="Merchant name"
            value={customMerchant}
            onChange={(e) => setCustomMerchant(e.target.value)}
            className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($)</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        onClick={handleCharge}
        disabled={loading}
        className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Charging…" : "Charge card"}
      </button>

      {result?.approved === true && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-snug text-emerald-900">
          <div className="font-semibold mb-1">✅ Purchase approved</div>
          <div>{fmtCents(result.amountCents)} charged to your Wallet.</div>
          <div className="text-xs mt-1 text-emerald-800">
            New Wallet balance: {fmtCents(result.newWalletBalance)}.
          </div>
        </div>
      )}

      {result?.approved === false && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-snug text-rose-900">
          <div className="font-semibold mb-1">Your card only spends from Wallet.</div>
          <div>
            You have {fmtCents(result.walletBalance)} available. This purchase
            requires {fmtCents(result.amountCents)}.
          </div>
          <div className="text-xs mt-2 text-rose-800">
            Move money from a box only if you decide you need more available funds.
          </div>
        </div>
      )}
    </div>
  );
}
