"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Wallet, Lock } from "lucide-react";
import { currency } from "@/lib/helpers";

type Tx = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number; // cents
  description?: string | null;
  postedAt: string;
  vault?: { name: string | null } | null;
  category?: { name: string | null } | null;
};

export default function HomeDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    totalSaved: number;
    totalLocked: number;
    totalAvailable: number;
  } | null>(null);
  const [recent, setRecent] = useState<Tx[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/summary");
      if (!r.ok) {
        setErr("Failed to load");
        setLoading(false);
        return;
      }
      const data = await r.json();
      setSummary({
        totalSaved: data.totalSaved,
        totalLocked: data.totalLocked,
        totalAvailable: data.totalAvailable,
      });
      setRecent(data.recent ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-4">Loading…</div>;
  if (err) return <div className="p-4 text-rose-600 text-sm">{err}</div>;
  if (!summary) return null;

  return (
    <div className="p-4 space-y-6">
      {/* Top cards */}
      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={() => location.assign("/transactions")}
          className="text-left"
        >
          <Card className="p-4 bg-[#0E3559] text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-90">Total Balance</span>
              <Wallet className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold mt-1">
              {currency(summary.totalSaved)}
            </div>
            <div className="text-xs opacity-80 mt-1">
              Tap to view transactions
            </div>
          </Card>
        </button>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Locked</span>
            <Lock className="h-5 w-5 text-gray-500" />
          </div>
          <div className="text-xl font-semibold mt-1">
            {currency(summary.totalLocked)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Available: {currency(summary.totalAvailable)}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Recent activity</div>
        {recent.length === 0 ? (
          <div className="text-sm text-gray-500">No transactions yet.</div>
        ) : (
          <div className="space-y-2">
            {recent.map((tx) => (
              <Card key={tx.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <div className="font-medium">
                      {tx.description ?? tx.type}
                    </div>
                    <div className="text-xs text-gray-500">
                      {tx.vault?.name ? `Vault: ${tx.vault.name}` : "—"}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      tx.type === "EXPENSE"
                        ? "text-rose-600"
                        : "text-emerald-700"
                    }`}
                  >
                    {tx.type === "EXPENSE" ? "-" : "+"}
                    {currency(tx.amount)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
