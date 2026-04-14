// ============================================================
// app/(shell)/vaults/page.tsx
// Safe Deposit Boxes screen — light theme, wired to real API
// ============================================================

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import VaultsScreen from "@/components/screens/VaultsScreen";

type Box = {
  id: string;
  name: string;
  balance: number;
  lockedAmount: number;
  targetAmount: number | null;
  lockUntil: string | null;
  status: string;
  unitAccountId: string | null;
  lockType: string;
  isWallet: boolean;
  isClosed: boolean;
  updatedAt: string;
};

function toVaultShape(box: Box) {
  return {
    id: box.id,
    name: box.name,
    target: box.targetAmount ? box.targetAmount / 100 : 0,
    locked: (box.lockedAmount ?? 0) / 100,
    saved: box.balance / 100,
    dueDays: box.lockUntil
      ? Math.ceil(
          (new Date(box.lockUntil).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null,
    isLocked: box.status === "LOCKED" || box.status === "UNLOCK_PENDING",
    lockType: box.lockType ?? "SOFT",
    isWallet: box.isWallet,
    isClosed: box.isClosed,
    closedAt: box.isClosed ? box.updatedAt : null,
  };
}

export default function VaultsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-5 text-sm text-gray-400">Loading…</div>}>
      <VaultsPageInner />
    </Suspense>
  );
}

function VaultsPageInner() {
  const searchParams = useSearchParams();
  const boxParam = searchParams.get("box");
  const [highlightId, setHighlightId] = useState<string | null>(boxParam);

  // Fade out highlight after 2s (Fix 6 — temporary + obvious)
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(t);
  }, [highlightId]);
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
  const [softUnlockModal, setSoftUnlockModal] = useState<null | {
    vaultId: string;
  }>(null);
  const [newVaultOpen, setNewVaultOpen] = useState(false);
  const [closeModal, setCloseModal] = useState<null | { vaultId: string }>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchBoxes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/boxes?includeClosed=1");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setBoxes(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleReopen(id: string) {
    const res = await fetch(`/api/boxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reopen" }),
    });
    if (res.ok) {
      setToast("Box reopened.");
      fetchBoxes();
      setTimeout(() => setToast(null), 2500);
    }
  }

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const activeBoxes = boxes.filter((b) => !b.isClosed);
  const closedBoxes = boxes.filter((b) => b.isClosed);
  const vaults = activeBoxes.map(toVaultShape);
  const closedVaults = closedBoxes.map(toVaultShape);
  const getBox = (id: string) => boxes.find((b) => b.id === id);

  return (
    <>
      <VaultsScreen
        vaults={vaults}
        closedVaults={closedVaults}
        vaultsLoading={loading}
        vaultsError={error}
        onCreateNew={() => setNewVaultOpen(true)}
        highlightId={highlightId}
        onCloseBox={(id) => setCloseModal({ vaultId: id })}
        onReopenBox={handleReopen}
        setShowTransfer={setShowTransfer}
        setAddFundsModal={setAddFundsModal}
        setLockModal={setLockModal}
        setUnlockModal={setUnlockModal}
        setSoftUnlockModal={setSoftUnlockModal}
      />
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
      {closeModal && (
        <ModalSheet onClose={() => setCloseModal(null)}>
          <CloseBoxFlow
            box={getBox(closeModal.vaultId) ?? null}
            onClose={() => setCloseModal(null)}
            onSuccess={(msg) => {
              setCloseModal(null);
              if (msg) {
                setToast(msg);
                setTimeout(() => setToast(null), 3000);
              }
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Transfer modal */}
      {showTransfer && (
        <ModalSheet onClose={() => setShowTransfer(null)}>
          <h3 className="font-semibold text-lg mb-4">Transfer Funds</h3>
          <TransferForm
            fromBoxId={showTransfer.id}
            allBoxes={boxes}
            onClose={() => setShowTransfer(null)}
            onSuccess={() => {
              setShowTransfer(null);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Create box modal */}
      {newVaultOpen && (
        <ModalSheet onClose={() => setNewVaultOpen(false)}>
          <h3 className="font-semibold text-lg mb-4">New Safe Deposit Box</h3>
          <CreateBoxForm
            onClose={() => setNewVaultOpen(false)}
            onSuccess={() => {
              setNewVaultOpen(false);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Deposit modal */}
      {addFundsModal && (
        <ModalSheet onClose={() => setAddFundsModal(null)}>
          <h3 className="font-semibold text-lg mb-4">Add Funds</h3>
          <DepositForm
            boxId={addFundsModal.vaultId}
            onClose={() => setAddFundsModal(null)}
            onSuccess={() => {
              setAddFundsModal(null);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Lock modal */}
      {lockModal && (
        <ModalSheet onClose={() => setLockModal(null)}>
          <h3 className="font-semibold text-lg mb-4">Lock Safe Deposit Box</h3>
          <LockForm
            boxId={lockModal.vaultId}
            boxBalance={getBox(lockModal.vaultId)?.balance ?? 0}
            onClose={() => setLockModal(null)}
            onSuccess={() => {
              setLockModal(null);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Unlock request modal */}
      {unlockModal && (
        <ModalSheet onClose={() => setUnlockModal(null)}>
          <UnlockRequestForm
            box={getBox(unlockModal.vaultId) ?? null}
            onClose={() => setUnlockModal(null)}
            onSuccess={() => {
              setUnlockModal(null);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Soft unlock confirmation modal */}
      {softUnlockModal && (
        <ModalSheet onClose={() => setSoftUnlockModal(null)}>
          <SoftUnlockForm
            box={getBox(softUnlockModal.vaultId) ?? null}
            onClose={() => setSoftUnlockModal(null)}
            onSuccess={() => {
              setSoftUnlockModal(null);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}
    </>
  );
}

// ── Shared modal shell ─────────────────────────────────────

function ModalSheet({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl p-6 w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Create Box Form ────────────────────────────────────────

type KeyholderRelationship = {
  id: string;
  status: string;
  profile: { name: string | null; email: string };
};

function LockTypeSelector({
  lockType,
  onChange,
}: {
  lockType: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
        Protection level
      </label>
      {[
        { id: "SOFT", icon: "🛡️", label: "Flexible", desc: "Unlock with a confirmation" },
        { id: "HARD", icon: "🔒", label: "Fully locked", desc: "No withdrawals until you unlock" },
        { id: "KEYHOLDER", icon: "👤", label: "Keyholder required", desc: "Someone you trust must approve" },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
            lockType === opt.id ? "border-emerald-600 bg-emerald-50" : "border-gray-100"
          }`}
        >
          <span>{opt.icon}</span>
          <div>
            <div className={`text-sm font-medium ${lockType === opt.id ? "text-emerald-700" : "text-gray-900"}`}>
              {opt.label}
            </div>
            <div className="text-xs text-gray-500">{opt.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-0.5">
        Lock until date
      </label>
      <p className="text-xs text-gray-400 mb-2">Funds will be protected until this date.</p>
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function KeyholderPicker({
  selectedId,
  onChange,
}: {
  selectedId: string;
  onChange: (id: string) => void;
}) {
  const [keyholders, setKeyholders] = useState<KeyholderRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/keyholders")
      .then((r) => r.json())
      .then((data: KeyholderRelationship[]) => {
        const active = Array.isArray(data) ? data.filter((k) => k.status === "ACTIVE") : [];
        setKeyholders(active);
        if (active.length > 0 && !selectedId) onChange(active[0].id);
      })
      .catch(() => setKeyholders([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <p className="text-xs text-gray-400">Loading keyholders…</p>;
  }

  if (keyholders.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-sm text-amber-800 mb-2">{"You don't have a keyholder yet."}</p>
        <Link
          href="/keyholders"
          className="text-sm font-medium text-emerald-600 underline"
        >
          Invite a keyholder
        </Link>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Select keyholder
      </label>
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
      >
        {keyholders.map((k) => (
          <option key={k.id} value={k.id}>
            {k.profile.name ? `${k.profile.name} (${k.profile.email})` : k.profile.email}
          </option>
        ))}
      </select>
    </div>
  );
}

function CreateBoxForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [lockType, setLockType] = useState("SOFT");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [lockUntil, setLockUntil] = useState("");
  const [selectedKeyholderId, setSelectedKeyholderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (lockType === "KEYHOLDER" && !selectedKeyholderId) {
      setError("Select a keyholder before saving, or invite one first.");
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
          lockType,
          keyholderRelationshipId: lockType === "KEYHOLDER" ? selectedKeyholderId : undefined,
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
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        placeholder="Name (e.g. Rent — May)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        placeholder="Target amount ($)"
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      />
      <LockTypeSelector lockType={lockType} onChange={setLockType} />
      {lockType !== "SOFT" && (
        <DateField value={lockUntil} onChange={setLockUntil} />
      )}
      {lockType === "KEYHOLDER" && (
        <KeyholderPicker selectedId={selectedKeyholderId} onChange={setSelectedKeyholderId} />
      )}
      {error && <p className="text-rose-600 text-sm">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  );
}

// ── Deposit Form ───────────────────────────────────────────

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
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Depositing…" : `Deposit $${amount || "0"}`}
        </button>
      </div>
    </div>
  );
}

// ── Lock Form ──────────────────────────────────────────────

function LockForm({
  boxId,
  boxBalance,
  onClose,
  onSuccess,
}: {
  boxId: string;
  boxBalance: number; // cents
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [lockUntil, setLockUntil] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockType, setLockType] = useState("SOFT");
  const [selectedKeyholderId, setSelectedKeyholderId] = useState("");
  const balanceDollars = boxBalance / 100;
  // Default to full balance locked
  const [lockAmount, setLockAmount] = useState<string>(balanceDollars.toString());

  // For HARD/KEYHOLDER, lockedAmount is always full balance (server enforces too)
  const showAmountSelector = lockType === "SOFT" && boxBalance > 0;

  const setChip = (pct: 0.25 | 0.5 | 0.75 | 1) => {
    const v = Math.max(1, Math.round(balanceDollars * pct));
    setLockAmount(String(v));
  };

  async function handleSubmit() {
    // Only require a date for HARD and KEYHOLDER
    if (lockType !== "SOFT") {
      if (!lockUntil) { setError("Pick a date"); return; }
      if (new Date(lockUntil) <= new Date()) { setError("Must be a future date"); return; }
    }
    if (lockType === "KEYHOLDER" && !selectedKeyholderId) {
      setError("Select a keyholder before locking, or invite one first.");
      return;
    }
    let lockedAmountInDollars: number | undefined = undefined;
    if (showAmountSelector) {
      const n = Number(lockAmount);
      if (!Number.isFinite(n) || n < 1) { setError("Lock amount must be at least $1"); return; }
      if (n > balanceDollars) { setError(`Lock amount cannot exceed balance of $${balanceDollars}`); return; }
      lockedAmountInDollars = n;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/boxes/${boxId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "lock",
          lockUntil: lockUntil ? new Date(lockUntil).toISOString() : undefined,
          lockType,
          keyholderRelationshipId: lockType === "KEYHOLDER" ? selectedKeyholderId : undefined,
          lockedAmountInDollars,
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

  const remaining = showAmountSelector
    ? Math.max(0, balanceDollars - Number(lockAmount || 0))
    : 0;

  return (
    <div className="space-y-4">
      <LockTypeSelector lockType={lockType} onChange={setLockType} />
      {lockType !== "SOFT" && (
        <DateField value={lockUntil} onChange={setLockUntil} />
      )}
      {lockType === "KEYHOLDER" && (
        <KeyholderPicker selectedId={selectedKeyholderId} onChange={setSelectedKeyholderId} />
      )}
      {showAmountSelector && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            How much do you want to lock?
          </label>
          <input
            type="number"
            min="1"
            max={balanceDollars}
            value={lockAmount}
            onChange={(e) => setLockAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
          />
          <div className="flex gap-2 mt-2">
            {([["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["All", 1]] as const).map(([label, pct]) => (
              <button
                key={label}
                type="button"
                onClick={() => setChip(pct)}
                className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} will remain available.
          </p>
        </div>
      )}
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
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Locking…" : "🔒 Lock"}
        </button>
      </div>
    </div>
  );
}

// ── Unlock Request Form ────────────────────────────────────

function UnlockRequestForm({
  box,
  onClose,
  onSuccess,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Please provide a reason for the unlock request");
      return;
    }
    if (!box) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/unlock-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxId: box.id,
          reason: reason.trim(),
          reflection: reflection.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-4">📬</div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">
          Request sent
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          Your keyholder has been notified. You'll hear back once they review
          your request.
        </p>
        <button
          onClick={onSuccess}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          Done
        </button>
      </div>
    );
  }

  const currency = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-gray-900">
          Request early unlock
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {box?.name} · {currency((box?.balance ?? 0) / 100)} locked
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-800">
          Your keyholder will be notified and must approve this request before
          your funds are unlocked.
        </p>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Why do you need early access? <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Unexpected car repair, medical expense…"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Reflection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Reflect on your decision{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Why did you lock this money? Is this expense worth breaking that commitment?"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <p className="text-xs text-gray-400 mt-1">
          This helps you and your keyholder make a more considered decision.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !reason.trim()}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}
// ── Close Box Flow ────────────────────────────────────────

function CloseBoxFlow({
  box,
  onClose,
  onSuccess,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: (toastMessage?: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [balances, setBalances] = useState<{ balance: number; lockedAmount: number; available: number } | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const currency = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  // Simulate preflight: the DELETE endpoint returns blockers if unmet.
  // We attempt DELETE only on explicit confirmation. First render we compute
  // a hopeful "eligible" view from local data, but the server is source of truth.
  async function handleConfirm() {
    if (!box) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/boxes/${box.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data.blockers)) {
          setBlockers(data.blockers);
          setBalances({
            balance: data.balance ?? 0,
            lockedAmount: data.lockedAmount ?? 0,
            available: data.available ?? 0,
          });
        } else {
          setError(data.error ?? "Failed to close box");
        }
        return;
      }
      onSuccess(`${box.name} closed. ${currency(data.sweptToWallet ?? 0)} moved to your Wallet.`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!box) return null;

  // Local preflight — determine if we can show a confirmation first
  const locallyEligible =
    !box.isWallet &&
    !box.isClosed &&
    box.lockedAmount === 0 &&
    box.status !== "LOCKED" &&
    box.status !== "UNLOCK_PENDING";

  const availableLocal = (box.balance - box.lockedAmount) / 100;

  if (blockers) {
    const msgMap: Record<string, string> = {
      locked_amount: "Withdraw or transfer the available funds, then unlock the rest.",
      status_locked: "Submit an unlock request and wait for it to resolve.",
      pending_unlock: "Clear the pending unlock request first.",
      active_keyholder: "Remove the keyholder from this box before closing.",
    };
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-900">Can't close this box yet</h3>
        {balances && (
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 space-y-0.5">
            <div>Total: <span className="font-semibold">{currency(balances.balance)}</span></div>
            <div>Locked: <span className="font-semibold">{currency(balances.lockedAmount)}</span></div>
            <div>Available: <span className="font-semibold">{currency(balances.available)}</span></div>
          </div>
        )}
        <div className="space-y-2">
          {blockers.map((b) => (
            <div key={b} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
              {msgMap[b] ?? b}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!confirmed) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-900">Close {box.name}?</h3>
        <p className="text-sm text-gray-600 leading-snug">
          Your available balance of <span className="font-semibold">{currency(availableLocal)}</span> will be moved to your Wallet.
          This box will be archived. You can reopen it later.
        </p>
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 space-y-0.5">
          <div>Available: <span className="font-semibold">{currency(availableLocal)}</span></div>
          <div>Locked: <span className="font-semibold">{currency(box.lockedAmount / 100)}</span></div>
        </div>
        {!locallyEligible && (
          <p className="text-xs text-amber-700">
            Some conditions may need to be resolved first. Tap Close box to check.
          </p>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
            Cancel
          </button>
          <button
            onClick={() => { setConfirmed(true); handleConfirm(); }}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Closing…" : "Close box"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6 text-center text-sm text-gray-500">
      Closing…
    </div>
  );
}

// ── Transfer Form ─────────────────────────────────────────

function TransferForm({
  fromBoxId,
  allBoxes,
  onClose,
  onSuccess,
}: {
  fromBoxId: string;
  allBoxes: Box[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const fromBox = allBoxes.find((b) => b.id === fromBoxId);
  const destBoxes = allBoxes.filter((b) => b.id !== fromBoxId);
  const [toBoxId, setToBoxId] = useState(destBoxes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [success, setSuccess] = useState(false);

  const currency = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  async function handleSubmit() {
    setError(null);
    const amt = Number(amount);
    if (!toBoxId) { setError({ message: "Select a destination box" }); return; }
    if (!amt || amt < 1) { setError({ message: "Minimum transfer is $1" }); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/boxes/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromBoxId, toBoxId, amountInDollars: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({
          message: data.error ?? "Transfer failed",
          hint: data.message,
        });
        return;
      }
      setSuccess(true);
    } catch {
      setError({ message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Transfer complete</h3>
        <p className="text-sm text-gray-500 mb-6">
          ${Number(amount).toLocaleString()} moved to{" "}
          {allBoxes.find((b) => b.id === toBoxId)?.name ?? "destination box"}.
        </p>
        <button onClick={onSuccess} className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium">
          Done
        </button>
      </div>
    );
  }

  if (destBoxes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          You need at least two boxes to transfer funds. Create another box first.
        </p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
        <div className="text-xs text-gray-400 mb-0.5">From</div>
        <div className="font-semibold text-gray-900 text-sm">{fromBox?.name ?? "—"}</div>
        <div className="text-xs text-gray-500 mt-0.5">{currency((fromBox?.balance ?? 0) / 100)} available</div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">To</label>
        <select
          value={toBoxId}
          onChange={(e) => setToBoxId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        >
          {destBoxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({currency(b.balance / 100)})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount ($)</label>
        <input
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
          placeholder="0"
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-rose-700">{error.message}</p>
          {error.hint && <p className="text-xs text-rose-600 mt-1">{error.hint}</p>}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Transferring…" : `Transfer $${amount || "0"}`}
        </button>
      </div>
    </div>
  );
}

// ── Soft Unlock Form ───────────────────────────────────────

function SoftUnlockForm({
  box,
  onClose,
  onSuccess,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUnlock() {
    if (!box) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock" }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      onSuccess();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const currency = (n: number) =>
    n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-gray-900">
          Unlock this box?
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {box?.name} · {currency((box?.balance ?? 0) / 100)} saved
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800 leading-relaxed">
          You set this money aside for a reason. Unlocking it early means it's
          available to spend.
        </p>
        <p className="text-xs text-amber-700 mt-2 italic">
          "Stay consistent." — The Banker
        </p>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
        >
          Keep it locked
        </button>
        <button
          onClick={handleUnlock}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Unlocking…" : "Unlock anyway"}
        </button>
      </div>
    </div>
  );
}
