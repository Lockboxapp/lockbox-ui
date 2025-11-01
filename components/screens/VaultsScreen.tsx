"use client";

import React from "react";
import { motion } from "framer-motion";
import { Plus, ArrowRightLeft, Lock, Unlock } from "lucide-react";
import Card from "@/components/ui/Card";

type Vault = {
  id: string;
  name: string;
  target: number;
  locked: number;
  saved: number;
  dueDays: number | null;
  isLocked: boolean;
};

type Props = {
  vaults: Vault[];
  vaultsLoading: boolean;
  vaultsError: string | null;
  onCreateNew: () => void;
  setShowTransfer: React.Dispatch<React.SetStateAction<null | { id: string }>>;
  setAddFundsModal: React.Dispatch<React.SetStateAction<null | { vaultId: string }>>;
  setLockModal: React.Dispatch<React.SetStateAction<null | { vaultId: string }>>;
  setUnlockModal: React.Dispatch<React.SetStateAction<null | { vaultId: string }>>;
};

const currency = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n)
    ? n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "$0";

function Progress({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function VaultsScreen({
  vaults,
  vaultsLoading,
  vaultsError,
  onCreateNew,
  setShowTransfer,
  setAddFundsModal,
  setLockModal,
  setUnlockModal,
}: Props) {
  return (
    <div className="px-4 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Vaults</h2>
        {/*<motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white shadow-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Create New</span>
        </motion.button>*/}
      </div>

      {/* States */}
      {vaultsLoading && <div className="text-sm text-gray-500">Loading vaults…</div>}
      {vaultsError && <div className="text-sm text-rose-600">Error: {vaultsError}</div>}
      {!vaultsLoading && !vaultsError && vaults.length === 0 && (
  <Card className="p-6 text-center border-dashed border-gray-300">
    <div className="text-gray-600 mb-3 text-sm">
      No vaults yet. Let’s start building your savings!
    </div>
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onCreateNew}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
    >
      <Plus className="h-4 w-4" />
      Create Your First Vault
    </motion.button>
  </Card>
)}


      {/* List */}
      {!vaultsLoading && !vaultsError && vaults.length > 0 && (
        <>
          {vaults.map((v) => {
            const pct = (v.saved / Math.max(1, v.target)) * 100;
            return (
              <Card key={v.id} className="p-4">
                {/* Row: title + locked */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{v.name}</div>
                    <div className="text-sm text-gray-500">
                      {currency(v.target)}
                      {v.dueDays ? ` due in ${v.dueDays} days` : " target"}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    Locked: {currency(v.locked)}
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <Progress value={pct} />
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Saved: <span className="font-medium text-gray-900">{currency(v.saved)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Transfer */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowTransfer({ id: v.id })}
                      className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1 bg-gray-900 text-white"
                    >
                      <ArrowRightLeft className="h-4 w-4" /> Transfer
                    </motion.button>

                    {/* Add funds */}
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setAddFundsModal({ vaultId: v.id })}
                      className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1 bg-emerald-600 text-white"
                    >
                      <Plus className="h-4 w-4" /> Add funds
                    </motion.button>

                    {/* One-tap lock/unlock */}
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      animate={{
                        scale: 1,
                        boxShadow: v.isLocked
                          ? "0 3px 5px rgba(0,0,0,0.25)"
                          : "inset 0 2px 4px rgba(0,0,0,0.15)",
                        backgroundColor: v.isLocked ? "#f3f4f6" : "#d1fae5",
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      onClick={() => {
                        if (v.isLocked) setUnlockModal({ vaultId: v.id });
                        else setLockModal({ vaultId: v.id });
                      }}
                      className="h-9 w-9 grid place-items-center rounded-xl cursor-pointer border border-gray-200"
                      aria-label={v.isLocked ? "Vault locked" : "Vault unlocked"}
                      title={v.isLocked ? "Tap to request unlock" : "Tap to lock funds"}
                    >
                      {v.isLocked ? (
                        <Lock className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Unlock className="h-4 w-4 text-emerald-600" />
                      )}
                    </motion.button>
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
