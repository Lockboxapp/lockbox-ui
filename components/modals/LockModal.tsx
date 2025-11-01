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

export default function LockModal({
  open,
  onClose,
  vault,
  keyholderAvailable,
  initialRequireKeyholder,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  vault: Vault | null;
  keyholderAvailable: boolean;
  initialRequireKeyholder: boolean;
  onSubmit: (amount: number, requireKeyholder: boolean) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [usePartner, setUsePartner] = useState(initialRequireKeyholder);

  if (!open || !vault) return null;
  const lockable = Math.max(0, vault.saved - vault.locked);

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
          <div className="text-lg font-semibold mb-2">Lock funds</div>
          <div className="text-sm text-gray-500 mb-3">Lock up to <b>${lockable}</b> in “{vault.name}”.</div>

          <div className="flex items-center rounded-xl border px-3 py-2">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number" min={0} max={lockable} className="w-full outline-none py-2"
            />
          </div>

          <div className="mt-4 p-3 rounded-xl border flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Require Keyholder for early unlock</div>
              <div className="text-xs text-gray-500">
                {keyholderAvailable
                  ? "Your partner must approve an early unlock."
                  : "No partner configured — toggle has no effect until you add one."}
              </div>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only" checked={usePartner} onChange={(e) => setUsePartner(e.target.checked)} />
              <div className={`w-11 h-6 rounded-full ${usePartner ? "bg-emerald-600" : "bg-gray-300"} relative transition`}>
                <span className={`absolute top-0.5 ${usePartner ? "left-6" : "left-0.5"} h-5 w-5 bg-white rounded-full transition`} />
              </div>
            </label>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">Cancel</button>
            <button
              disabled={amount <= 0 || amount > lockable}
              onClick={() => onSubmit(amount, usePartner)}
              className={`py-3 rounded-xl text-white ${amount > 0 && amount <= lockable ? "bg-emerald-600" : "bg-gray-300"}`}
            >
              Lock
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
