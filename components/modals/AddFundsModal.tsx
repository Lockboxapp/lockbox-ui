"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Vault = {
  id: string;
  name: string;
  target: number;
  saved: number;
  locked: number;
  isLocked: boolean;
  requireKeyholder?: boolean;
};

export default function AddFundsModal({
  open,
  onClose,
  vault,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  vault: Vault | null;
  onSubmit: (amount: number) => void;
}) {
  const [amount, setAmount] = useState(50);
  if (!open || !vault) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          className="w-full max-w-sm rounded-3xl bg-white p-6"
        >
          <div className="text-lg font-semibold mb-2">Add funds</div>
          <div className="text-sm text-gray-500 mb-3">
            Add money to “{vault.name}”.
          </div>

          <div className="flex items-center rounded-xl border px-3 py-2">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => {
                const n = Number(e.target.value);
                setAmount(Number.isFinite(n) && n >= 0 ? n : 0);
              }}
              type="number"
              step="0.01"
              min={0}
              inputMode="decimal"
              className="w-full outline-none py-2"
              onKeyDown={(e) => {
                if (e.key === "Enter" && amount > 0) {
                  onSubmit(amount);
                }
              }}
            />
          </div>

          <div className="mt-5 flex gap-2">
            {[25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setAmount(n)}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-sm"
              >
                ${n}
              </button>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              disabled={amount <= 0}
              onClick={() => onSubmit(amount)}
              className={`py-3 rounded-xl text-white ${
                amount > 0 ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              Add
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
