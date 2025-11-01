"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type UnlockRequest = {
  id: string;
  vaultId: string;
  amount: number;
  reason: string;
  code: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

export default function KeyholderPortalModal({
  open,
  onClose,
  requests,
  onApprove,
  onReject,
}: {
  open: boolean;
  onClose: () => void;
  requests: UnlockRequest[];
  onApprove: (code: string) => void;
  onReject: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  if (!open) return null;

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-sm rounded-3xl bg-white p-6"
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
        >
          <div className="text-lg font-semibold mb-1">Keyholder Portal (demo)</div>
          <div className="text-sm text-gray-500 mb-3">Enter the 6-digit code from the SMS to approve or reject.</div>

          <div className="flex items-center rounded-xl border px-3 py-2 mb-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
              className="w-full outline-none py-2"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setCode("")} className="py-2 rounded-xl border">Clear</button>
            <button onClick={() => onReject(code)} className="py-2 rounded-xl bg-rose-600 text-white">Reject</button>
            <button onClick={() => onApprove(code)} className="py-2 rounded-xl bg-emerald-600 text-white">Approve</button>
          </div>

          <div className="mt-5">
            <div className="text-sm font-medium mb-2">Pending requests</div>
            {pending.length === 0 ? (
              <div className="text-sm text-gray-500">No pending requests.</div>
            ) : (
              <div className="space-y-2">
                {pending.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl border text-sm">
                    <div className="font-medium">Vault: {r.vaultId}</div>
                    <div>Amount: ${r.amount}</div>
                    <div>Reason: {r.reason || "(none)"}</div>
                    <div className="text-xs text-gray-500">Code: {r.code}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <button onClick={onClose} className="w-full py-3 rounded-xl border">Close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
