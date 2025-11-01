"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type NewVaultModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (vault: any) => void; // parent will merge this into state
};

export default function NewVaultModal({ open, onClose, onCreated }: NewVaultModalProps) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>(""); // yyyy-mm-dd
  const [requireKeyholder, setRequireKeyholder] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  if (!open) return null;

  async function handleSubmit() {
    setError("");
    if (!name.trim()) {
      setError("Please enter a vault name.");
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setError("Target must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          target: Math.round(Number(target)), // store as integer
          saved: 0,
          locked: 0,
          dueDate: dueDate ? new Date(dueDate) : null,
          isLocked: false,
          requireKeyholder,
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Create failed (${res.status})`);
      }

      const created = await res.json();
      onCreated(created);
      onClose();
      // reset form after close
      setName(""); setTarget(0); setDueDate(""); setRequireKeyholder(false);
    } catch (e: any) {
      setError(e?.message || "Failed to create vault.");
    } finally {
      setSubmitting(false);
    }
  }

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
          <div className="text-lg font-semibold mb-4">Create New Vault</div>

          <label className="block text-sm mb-1">Vault name</label>
          <input
            className="w-full rounded-xl border px-3 py-2 outline-none mb-3"
            placeholder="e.g., Rent safe-deposit box"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="block text-sm mb-1">Target amount (USD)</label>
          <input
            type="number"
            min={1}
            className="w-full rounded-xl border px-3 py-2 outline-none mb-3"
            placeholder="1500"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value || 0))}
          />

          <label className="block text-sm mb-1">Due date (optional)</label>
          <input
            type="date"
            className="w-full rounded-xl border px-3 py-2 outline-none mb-4"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <label className="flex items-center justify-between p-3 rounded-xl border mb-4 cursor-pointer">
            <div>
              <div className="text-sm font-medium">Require Keyholder for early unlock</div>
              <div className="text-xs text-gray-500">
                If enabled, early unlocks must be approved by a partner.
              </div>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={requireKeyholder}
              onChange={(e) => setRequireKeyholder(e.target.checked)}
            />
          </label>

          {error && <div className="text-rose-600 text-sm mb-3">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <button disabled={submitting} onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className={`py-3 rounded-xl text-white ${submitting ? "bg-gray-400" : "bg-emerald-600"}`}
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
