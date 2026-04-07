// ============================================================
// app/(shell)/vaults/page.tsx
// Safe Deposit Boxes screen — light theme, wired to real API
// ============================================================

"use client";

import { useEffect, useState, useCallback } from "react";
import VaultsScreen from "@/components/screens/VaultsScreen";

type Box = {
  id: string;
  name: string;
  balance: number;
  targetAmount: number | null;
  lockUntil: string | null;
  status: string;
  unitAccountId: string | null;
};

function toVaultShape(box: Box) {
  return {
    id: box.id,
    name: box.name,
    target: box.targetAmount ? box.targetAmount / 100 : 0,
    locked:
      box.status === "LOCKED" || box.status === "UNLOCK_PENDING"
        ? box.balance / 100
        : 0,
    saved: box.balance / 100,
    dueDays: box.lockUntil
      ? Math.ceil(
          (new Date(box.lockUntil).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null,
    isLocked: box.status === "LOCKED" || box.status === "UNLOCK_PENDING",
  };
}

export default function VaultsPage() {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showTransfer, setShowTransfer] = useState<null | { id: string }>(null);
  const [addFundsModal, setAddFundsModal] = useState<null | {
    vaultId: string;
  }>(null);
  const [lockModal, setLockModal] = useState<null | { vaultId: string }>(null);
  const [unlockModal, setUnlockModal] = useState<null | { vaultId: string }>(
    null,
  );
  const [newVaultOpen, setNewVaultOpen] = useState(false);

  const fetchBoxes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/boxes");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBoxes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const vaults = boxes.map(toVaultShape);

  return (
    <>
      <VaultsScreen
        vaults={vaults}
        vaultsLoading={loading}
        vaultsError={error}
        onCreateNew={() => setNewVaultOpen(true)}
        setShowTransfer={setShowTransfer}
        setAddFundsModal={setAddFundsModal}
        setLockModal={setLockModal}
        setUnlockModal={setUnlockModal}
      />

      {/* Create box modal */}
      {newVaultOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md mx-auto">
            <h3 className="font-semibold text-lg mb-4">New Safe Deposit Box</h3>
            <CreateBoxForm
              onClose={() => setNewVaultOpen(false)}
              onSuccess={() => {
                setNewVaultOpen(false);
                fetchBoxes();
              }}
            />
          </div>
        </div>
      )}

      {/* Deposit modal */}
      {addFundsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md mx-auto">
            <h3 className="font-semibold text-lg mb-4">Add Funds</h3>
            <DepositForm
              boxId={addFundsModal.vaultId}
              onClose={() => setAddFundsModal(null)}
              onSuccess={() => {
                setAddFundsModal(null);
                fetchBoxes();
              }}
            />
          </div>
        </div>
      )}

      {/* Lock modal */}
      {lockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl p-6 w-full max-w-md mx-auto">
            <h3 className="font-semibold text-lg mb-4">
              Lock Safe Deposit Box
            </h3>
            <LockForm
              boxId={lockModal.vaultId}
              onClose={() => setLockModal(null)}
              onSuccess={() => {
                setLockModal(null);
                fetchBoxes();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------
// Create Box Form
// ------------------------------------------------------------
function CreateBoxForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [lockUntil, setLockUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          targetAmount: target ? Number(target) : undefined,
          lockUntil: lockUntil ? new Date(lockUntil).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        placeholder="Name (e.g. Rent — May)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        placeholder="Target amount ($)"
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        type="date"
        value={lockUntil}
        onChange={(e) => setLockUntil(e.target.value)}
      />
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          {loading ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Deposit Form
// ------------------------------------------------------------
function DepositForm({
  boxId,
  onClose,
  onSuccess,
}: {
  boxId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!amount || Number(amount) < 1) {
      setError("Minimum $1");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/boxes/${boxId}/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInDollars: Number(amount) }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        placeholder="Amount ($)"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          {loading ? "Depositing…" : `Deposit $${amount || "0"}`}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Lock Form
// ------------------------------------------------------------
function LockForm({
  boxId,
  onClose,
  onSuccess,
}: {
  boxId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [lockUntil, setLockUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!lockUntil) {
      setError("Pick a date");
      return;
    }
    if (new Date(lockUntil) <= new Date()) {
      setError("Must be a future date");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock",
          lockUntil: new Date(lockUntil).toISOString(),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
        type="date"
        value={lockUntil}
        onChange={(e) => setLockUntil(e.target.value)}
      />
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          {loading ? "Locking…" : "🔒 Lock"}
        </button>
      </div>
    </div>
  );
}
