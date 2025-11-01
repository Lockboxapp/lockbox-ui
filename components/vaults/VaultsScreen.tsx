"use client";
import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import { motion } from "framer-motion";
import { Lock, Unlock, Plus, ArrowRightLeft } from "lucide-react";
import NewVaultModal from "@/components/modals/NewVaultModal";
import { vaultAction, currency } from "@/lib/helpers";

export default function VaultsScreen() {
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewVault, setShowNewVault] = useState(false);

  async function loadVaults() {
    try {
      setLoading(true);
      const res = await fetch("/api/vaults");
      if (!res.ok) throw new Error("Failed to load vaults");
      const data = await res.json();
      setVaults(data || []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load vaults");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVaults();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Your Vaults</h2>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowNewVault(true)}
          className="px-3 py-2 rounded-xl bg-emerald-600 text-white flex items-center gap-1"
        >
          <Plus className="h-4 w-4" /> New Vault
        </motion.button>
      </div>

      {loading && <div>Loading vaults...</div>}
      {error && <div className="text-rose-600 text-sm">{error}</div>}

      {!loading && vaults.length === 0 && (
        <div className="text-gray-500 text-sm">No vaults yet. Create your first!</div>
      )}

      {vaults.map((v) => {
        const progress = v.target ? Math.min(100, Math.round((v.saved / v.target) * 100)) : 0;

        return (
          <Card key={v.id} className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-sm text-gray-500">
                  {currency(Number(v.saved) || 0)} / {currency(Number(v.target) || 0)}
                </div>
                {v.dueDate && (
                  <div className="text-xs text-gray-400">
                    Due: {new Date(v.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right text-sm text-gray-500">
                  Locked: {currency(Number(v.locked) || 0)}
                </div>
                {v.isLocked ? (
                  <Lock className="text-gray-600 h-5 w-5" />
                ) : (
                  <Unlock className="text-emerald-600 h-5 w-5" />
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-emerald-600"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Add Funds */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  const val = prompt("Enter amount to add:");
                  if (!val) return;
                  const amount = Number(val);
                  if (Number.isNaN(amount) || amount <= 0) return alert("Invalid amount");
                  try {
                    const updated = await vaultAction(v.id, "addFunds", amount);
                    // server returns the updated vault; merge it
                    setVaults((prev) => prev.map((x) => (x.id === v.id ? updated : x)));
                    alert("Funds added.");
                  } catch (e) {
                    console.error(e);
                    alert("Failed to add funds.");
                  }
                }}
                className="px-3 py-1.5 rounded-full text-sm bg-emerald-600 text-white"
              >
                + Add Funds
              </motion.button>

              {/* Lock / Unlock */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={async () => {
                  const intent = v.isLocked ? "unlock" : "lock";
                  const val = prompt(`Enter amount to ${intent}:`);
                  if (!val) return;
                  const amount = Number(val);
                  if (Number.isNaN(amount) || amount <= 0) return alert("Invalid amount");
                  const action = v.isLocked ? "unlockFunds" : "lockFunds";
                  try {
                    const updated = await vaultAction(v.id, action, amount);
                    setVaults((prev) => prev.map((x) => (x.id === v.id ? updated : x)));
                    alert(`${v.isLocked ? "Unlocked" : "Locked"} funds.`);
                  } catch (e) {
                    console.error(e);
                    alert("Action failed.");
                  }
                }}
                className="px-3 py-1.5 rounded-full text-sm bg-gray-900 text-white"
              >
                {v.isLocked ? "Unlock" : "Lock"}
              </motion.button>

              {/* Transfer */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  if (vaults.length < 2) {
                    return alert("You need at least two vaults to transfer.");
                  }
                  const toVaultId = prompt(
                    `Enter the ID of the destination vault:\n\n${vaults
                      .filter((x) => x.id !== v.id)
                      .map((x) => `• ${x.name} — ${x.id}`)
                      .join("\n")}`
                  );
                  if (!toVaultId || toVaultId === v.id) return;

                  const val = prompt("Amount to transfer:");
                  if (!val) return;
                  const amount = Number(val);
                  if (Number.isNaN(amount) || amount <= 0) return alert("Invalid amount");

                  try {
                    await vaultAction(v.id, "transfer", amount, toVaultId);
                    // easiest: refresh both source and destination from server
                    await loadVaults();
                    alert("Transfer complete.");
                  } catch (e) {
                    console.error(e);
                    alert("Transfer failed.");
                  }
                }}
                className="px-3 py-1.5 rounded-full text-sm bg-blue-600 text-white flex items-center gap-1"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </motion.button>
            </div>
          </Card>
        );
      })}

      <NewVaultModal
        open={showNewVault}
        onClose={() => setShowNewVault(false)}
        onCreated={(vault: any) => setVaults((v) => [...v, vault])}
      />
    </div>
  );
}
