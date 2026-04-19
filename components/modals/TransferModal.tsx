"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import posthog from "posthog-js";

type Vault = {
  id: string;
  name: string;
  target: number;
  saved: number;
  locked: number;
  isLocked: boolean;
  requireKeyholder?: boolean;
};

export default function TransferModal({
  open,
  onClose,
  sourceVault,
  vaults,
  onTransferToBank,
  onTransferBetween,
}: {
  open: boolean;
  onClose: () => void;
  sourceVault: Vault | null;
  vaults: Vault[];
  onTransferToBank: (amount: number) => void;
  onTransferBetween: (amount: number, toId: string) => void;
}) {
  const [amount, setAmount] = useState(50);
  const [toId, setToId] = useState<string>("");

  if (!open || !sourceVault) return null;

  const unlocked = Math.max(0, sourceVault.saved - sourceVault.locked);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
          className="w-full max-w-sm rounded-3xl bg-white p-6"
        >
          <div className="text-lg font-semibold mb-2">Transfer from “{sourceVault.name}”</div>
          <div className="text-sm text-gray-500 mb-3">Unlocked available: ${unlocked}</div>

          <div className="flex items-center rounded-xl border px-3 py-2 mb-3">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number" min={0} max={unlocked} className="w-full outline-none py-2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Move to another vault</label>
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
            >
              <option value="">— Select vault —</option>
              {vaults
                .filter((v) => v.id !== sourceVault.id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">Cancel</button>
            {toId ? (
              <button
                disabled={amount <= 0 || amount > unlocked}
                onClick={() => {
                  posthog.capture("transfer_submitted", {
                    from_vault_id: sourceVault.id,
                    from_vault_name: sourceVault.name,
                    to_vault_id: toId,
                    transfer_type: "vault_to_vault",
                    amount,
                  });
                  onTransferBetween(amount, toId);
                }}
                className={`py-3 rounded-xl text-white ${amount > 0 && amount <= unlocked ? "bg-gray-900" : "bg-gray-300"}`}
              >
                Transfer to Vault
              </button>
            ) : (
              <button
                disabled={amount <= 0 || amount > unlocked}
                onClick={() => {
                  posthog.capture("transfer_submitted", {
                    from_vault_id: sourceVault.id,
                    from_vault_name: sourceVault.name,
                    transfer_type: "vault_to_bank",
                    amount,
                  });
                  onTransferToBank(amount);
                }}
                className={`py-3 rounded-xl text-white ${amount > 0 && amount <= unlocked ? "bg-gray-900" : "bg-gray-300"}`}
              >
                Withdraw to Bank
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
