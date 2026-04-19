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

export default function UnlockModal({
  open,
  onClose,
  vault,
  defaultSendToPartner,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  vault: Vault | null;
  defaultSendToPartner: boolean;
  onSubmit: (amount: number, reason: string, sendToPartner: boolean) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [sendToPartner, setSendToPartner] = useState(defaultSendToPartner);

  if (!open || !vault) return null;

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
          <div className="text-lg font-semibold mb-1">Request early unlock</div>
          <div className="text-sm text-gray-500 mb-4">
            {sendToPartner
              ? "We’ll send this to your accountability partner for approval."
              : "No partner approval required — unlock will process immediately."}
          </div>

          <div className="flex items-center rounded-xl border px-3 py-2 mb-3">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number" min={0} className="w-full outline-none py-2"
            />
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for unlock..."
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none mb-4"
          />

          <div className="p-3 rounded-xl border flex items-center justify-between mb-4">
            <div>
              <div className="font-medium text-sm">Send to accountability partner</div>
              <div className="text-xs text-gray-500">Toggle off to unlock instantly (if allowed).</div>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only" checked={sendToPartner} onChange={(e) => setSendToPartner(e.target.checked)} />
              <div className={`w-11 h-6 rounded-full ${sendToPartner ? "bg-emerald-600" : "bg-gray-300"} relative transition`}>
                <span className={`absolute top-0.5 ${sendToPartner ? "left-6" : "left-0.5"} h-5 w-5 bg-white rounded-full transition`} />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">Cancel</button>
            <button
              onClick={() => {
                posthog.capture("unlock_request_submitted", {
                  vault_id: vault.id,
                  vault_name: vault.name,
                  amount,
                  send_to_partner: sendToPartner,
                  has_reason: reason.trim().length > 0,
                });
                onSubmit(amount, reason, sendToPartner);
              }}
              className="py-3 rounded-xl bg-emerald-600 text-white"
            >
              Submit
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
