"use client";
import React, { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (vault: {
    id: string;
    name: string;
    balance: number;
    createdAt?: string | Date;
    updatedAt?: string | Date;
  }) => void;
};

export default function NewVaultModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const payload: Record<string, unknown> = { name: name.trim() };
      if (initialBalance !== "" && Number.isFinite(Number(initialBalance))) {
        payload.initialBalance = Number(initialBalance);
      }

      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Failed to create vault");
      }

      const created = await res.json();
      onCreated?.(created);
      onClose();
      setName("");
      setInitialBalance("");
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Create New Vault</h2>

        <label className="mb-2 block text-sm font-medium">Name</label>
        <input
          className="mb-4 w-full rounded-lg border p-2"
          placeholder="e.g., Bills, Emergency Fund"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mb-2 block text-sm font-medium">
          Initial Balance (optional)
        </label>
        <input
          className="mb-2 w-full rounded-lg border p-2"
          type="number"
          min={0}
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            className="rounded-xl border px-4 py-2"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-black px-4 py-2 text-white"
            onClick={submit}
            disabled={!name.trim() || submitting}
          >
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
