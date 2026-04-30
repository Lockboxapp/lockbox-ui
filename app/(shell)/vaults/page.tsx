// ============================================================
// app/(shell)/vaults/page.tsx
// Safe Deposit Boxes screen — light theme, wired to real API
// ============================================================

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  // Sprint 13 — daysRemaining is the ceiling in days; negative = overdue.
  const daysRemaining = box.lockUntil
    ? Math.ceil(
        (new Date(box.lockUntil).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  // Sprint 14 — HARD and KEYHOLDER boxes display a single "Protected" figure
  // instead of Saved/Locked split. Wallet is never fully protected.
  const isFullyProtected =
    !box.isWallet &&
    (box.lockType === "HARD" || box.lockType === "KEYHOLDER");
  return {
    id: box.id,
    name: box.name,
    target: box.targetAmount ? box.targetAmount / 100 : 0,
    locked: (box.lockedAmount ?? 0) / 100,
    saved: box.balance / 100,
    protectedAmount: box.balance / 100, // display figure for fully-protected cards
    isFullyProtected,
    // keep `dueDays` key for backwards compat with existing consumers
    dueDays: daysRemaining,
    daysRemaining,
    isOverdue,
    lockUntil: box.lockUntil ?? null,
    isLocked: box.status === "LOCKED" || box.status === "UNLOCK_PENDING",
    // Sprint 7 refinement: HARD/KEYHOLDER render as locked when their locked amount is real.
    // After a HARD self-unlock (lockedAmount = 0), the box visibly unlocks. After a
    // switch-to-Flexible fallback, enforcement follows the new lockType.
    effectivelyLocked:
      box.status === "LOCKED" ||
      box.status === "UNLOCK_PENDING" ||
      ((box.lockType === "HARD" || box.lockType === "KEYHOLDER") && (box.lockedAmount ?? 0) > 0),
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const boxParam = searchParams.get("box");
  const actionParam = searchParams.get("action");
  const sourceParam = searchParams.get("source");
  const [highlightId, setHighlightId] = useState<string | null>(boxParam);
  // Sprint 17 extended hotfix — banner shown after a successful
  // "Add from external" deposit; clarifies that real bank transfers
  // require BaaS.
  const [externalDepositToast, setExternalDepositToast] = useState(false);

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
  const [renameModal, setRenameModal] = useState<null | { vaultId: string }>(null);
  const [dueDateModal, setDueDateModal] = useState<null | { vaultId: string }>(null);
  const [protectionModal, setProtectionModal] = useState<null | { vaultId: string }>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Sprint 11 — active keyholder relationships, used to derive missingKeyholder state
  type ActiveKH = {
    id: string;
    status: string;
    scopeType: string;
    boxes?: { boxId: string }[];
  };
  const [activeKeyholders, setActiveKeyholders] = useState<ActiveKH[]>([]);

  const fetchBoxes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [boxesRes, khRes] = await Promise.all([
        fetch("/api/boxes?includeClosed=1"),
        fetch("/api/keyholders"),
      ]);
      if (!boxesRes.ok) throw new Error("Failed to load");
      const boxesData = await boxesRes.json();
      setBoxes(boxesData);
      if (khRes.ok) {
        const khData: ActiveKH[] = await khRes.json();
        if (Array.isArray(khData)) {
          setActiveKeyholders(khData.filter((k) => k.status === "ACTIVE"));
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSwitchToFlexible(boxId: string) {
    const res = await fetch(`/api/boxes/${boxId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switchToFlexible" }),
    });
    if (res.ok) {
      setToast("Switched to Flexible.");
      fetchBoxes();
      setTimeout(() => setToast(null), 2500);
    } else {
      const data = await res.json().catch(() => ({}));
      setToast(data.error ?? "Could not switch.");
      setTimeout(() => setToast(null), 3000);
    }
  }

  function isBoxMissingKeyholder(boxId: string, lockType: string, isClosed: boolean) {
    if (isClosed) return false;
    if (lockType !== "KEYHOLDER") return false;
    const anyAll = activeKeyholders.some((k) => k.scopeType === "ALL");
    if (anyAll) return false;
    const selectedCovers = activeKeyholders.some(
      (k) =>
        k.scopeType === "SELECTED" &&
        (k.boxes ?? []).some((b) => b.boxId === boxId),
    );
    return !selectedCovers;
  }

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

  // Sprint 16 — deep-link: /vaults?box={id}&action=<rename|date|protection|close>
  // opens the corresponding modal once boxes are loaded. Clears the action param
  // from the URL on first use so refresh / back doesn't re-open.
  // Sprint 17 extended hotfix — additional path:
  //   /vaults?action=addFunds[&source=external]  → opens Add Funds on the Wallet
  //   used by ConnectedBankBalance's "Add to LockBox" button on home.
  useEffect(() => {
    if (!actionParam || boxes.length === 0) return;

    // Wallet-targeted Add Funds (no boxParam required).
    if (actionParam === "addFunds") {
      const wallet = boxes.find((b) => b.isWallet);
      if (wallet) {
        setAddFundsModal({ vaultId: wallet.id });
        // The Add Funds modal honors `source` from URL; we keep it on the URL
        // until the modal closes so source pre-selection works on first paint.
        return;
      }
    }

    if (!boxParam) return;
    const target = boxes.find((b) => b.id === boxParam);
    if (!target) return;
    switch (actionParam) {
      case "rename":
        setRenameModal({ vaultId: boxParam });
        break;
      case "date":
        if (target.lockType === "SOFT" && !target.isWallet) {
          setDueDateModal({ vaultId: boxParam });
        }
        break;
      case "protection":
        if (!target.isWallet) {
          setProtectionModal({ vaultId: boxParam });
        }
        break;
      case "close":
        if (!target.isWallet) {
          setCloseModal({ vaultId: boxParam });
        }
        break;
    }
    router.replace(`/vaults?box=${boxParam}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionParam, boxParam, boxes.length]);

  const activeBoxes = boxes.filter((b) => !b.isClosed);
  const closedBoxes = boxes.filter((b) => b.isClosed);
  const vaults = activeBoxes.map((b) => ({
    ...toVaultShape(b),
    missingKeyholder: isBoxMissingKeyholder(b.id, b.lockType, b.isClosed),
  }));
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
        onRenameBox={(id) => setRenameModal({ vaultId: id })}
        onEditDueDate={(id) => setDueDateModal({ vaultId: id })}
        onChangeProtection={(id) => setProtectionModal({ vaultId: id })}
        onReopenBox={handleReopen}
        onSwitchToFlexible={handleSwitchToFlexible}
        onAssignKeyholder={() => router.push("/keyholders")}
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
            // Sprint 15 — tappable blocker CTAs redirect to the right flow
            onGoTransfer={(id) => {
              setCloseModal(null);
              setShowTransfer({ id });
            }}
            onGoUnlock={(id) => {
              setCloseModal(null);
              setUnlockModal({ vaultId: id });
            }}
            onGoKeyholders={() => {
              setCloseModal(null);
              router.push("/keyholders");
            }}
          />
        </ModalSheet>
      )}
      {renameModal && (
        <ModalSheet onClose={() => setRenameModal(null)}>
          <RenameBoxForm
            box={getBox(renameModal.vaultId) ?? null}
            onClose={() => setRenameModal(null)}
            onSuccess={() => {
              setRenameModal(null);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}
      {dueDateModal && (
        <ModalSheet onClose={() => setDueDateModal(null)}>
          <EditDueDateForm
            box={getBox(dueDateModal.vaultId) ?? null}
            onClose={() => setDueDateModal(null)}
            onSuccess={() => {
              setDueDateModal(null);
              setToast("Target date updated.");
              setTimeout(() => setToast(null), 2500);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}
      {protectionModal && (
        <ModalSheet onClose={() => setProtectionModal(null)}>
          <ChangeProtectionForm
            box={getBox(protectionModal.vaultId) ?? null}
            onClose={() => setProtectionModal(null)}
            onSuccess={(msg) => {
              setProtectionModal(null);
              if (msg) {
                setToast(msg);
                setTimeout(() => setToast(null), 3000);
              }
              fetchBoxes();
            }}
            onGoUnlock={(id) => {
              setProtectionModal(null);
              setUnlockModal({ vaultId: id });
            }}
            onGoKeyholders={() => {
              setProtectionModal(null);
              router.push("/keyholders");
            }}
          />
        </ModalSheet>
      )}

      {/* Transfer modal — Sprint 6: routes by lockType */}
      {showTransfer && (() => {
        const src = getBox(showTransfer.id);
        const close = () => setShowTransfer(null);
        const success = () => {
          setShowTransfer(null);
          fetchBoxes();
        };
        if (!src) return null;
        // Sprint 8/15 — status-first enforcement (AGENT.md Section 7 critical rule).
        // UNLOCKED boxes allow direct transfer regardless of lockType. Only
        // status-locked boxes route to the special flows.
        const srcStatusLocked =
          src.status === "LOCKED" || src.status === "UNLOCK_PENDING";
        // HARD + status-locked: transfer blocked — route to self-unlock
        if (srcStatusLocked && src.lockType === "HARD" && !src.isWallet) {
          return (
            <ModalSheet onClose={close}>
              <HardSelfUnlockForm
                box={src}
                headline="Unlock this box to transfer"
                intro="Transfers from fully locked boxes aren't allowed. You can unlock this box yourself — this cannot be undone."
                onClose={close}
                onSuccess={(msg) => {
                  setToast(msg ?? "Box unlocked.");
                  setTimeout(() => setToast(null), 3000);
                  success();
                }}
              />
            </ModalSheet>
          );
        }
        // KEYHOLDER + status-locked: transfer request flow
        if (srcStatusLocked && src.lockType === "KEYHOLDER" && !src.isWallet) {
          return (
            <ModalSheet onClose={close}>
              <TransferRequestForm
                box={src}
                allBoxes={boxes}
                onClose={close}
                onSuccess={() => {
                  setToast("Transfer request sent to your keyholder.");
                  setTimeout(() => setToast(null), 3500);
                  success();
                }}
              />
            </ModalSheet>
          );
        }
        // SOFT or Wallet: direct transfer
        return (
          <ModalSheet onClose={close}>
            <h3 className="font-semibold text-lg text-gray-900 mb-4">Transfer Funds</h3>
            <TransferForm
              fromBoxId={showTransfer.id}
              allBoxes={boxes}
              onClose={close}
              onSuccess={success}
            />
          </ModalSheet>
        );
      })()}

      {/* Create box modal */}
      {newVaultOpen && (
        <ModalSheet onClose={() => setNewVaultOpen(false)}>
          <h3 className="font-semibold text-lg text-gray-900 mb-4">New Safe Deposit Box</h3>
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
        <ModalSheet
          onClose={() => {
            setAddFundsModal(null);
            // Strip ?action=&source= from the URL so refresh / back doesn't re-open.
            if (actionParam === "addFunds") {
              router.replace("/vaults");
            }
          }}
        >
          <h3 className="font-semibold text-lg text-gray-900 mb-4">Add Funds</h3>
          <DepositForm
            boxId={addFundsModal.vaultId}
            allBoxes={boxes}
            defaultSource={
              sourceParam === "external"
                ? "external"
                : sourceParam === "wallet"
                  ? "wallet"
                  : null
            }
            onClose={() => {
              setAddFundsModal(null);
              if (actionParam === "addFunds") router.replace("/vaults");
            }}
            onSuccess={(usedSource) => {
              setAddFundsModal(null);
              if (actionParam === "addFunds") router.replace("/vaults");
              if (usedSource === "external") setExternalDepositToast(true);
              fetchBoxes();
            }}
          />
        </ModalSheet>
      )}

      {/* Sprint 17 extended hotfix — external-deposit clarification banner */}
      {externalDepositToast && (
        <div className="fixed inset-x-0 bottom-20 z-50 px-4">
          <div className="max-w-md mx-auto bg-emerald-700 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">Added to your Wallet.</div>
              <div className="text-xs opacity-80 mt-0.5">
                Real bank transfers will be available when LockBox launches with
                live banking.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExternalDepositToast(false)}
              className="text-xs underline opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Lock modal */}
      {lockModal && (
        <ModalSheet onClose={() => setLockModal(null)}>
          <h3 className="font-semibold text-lg text-gray-900 mb-4">Lock Safe Deposit Box</h3>
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

      {/* Unlock modal — Sprint 6: HARD self-unlock vs KEYHOLDER request */}
      {unlockModal && (() => {
        const box = getBox(unlockModal.vaultId);
        const close = () => setUnlockModal(null);
        const success = () => {
          setUnlockModal(null);
          fetchBoxes();
        };
        if (!box) return null;
        if (box.lockType === "HARD") {
          return (
            <ModalSheet onClose={close}>
              <HardSelfUnlockForm
                box={box}
                onClose={close}
                onSuccess={(msg) => {
                  setToast(msg ?? "Box unlocked.");
                  setTimeout(() => setToast(null), 3000);
                  success();
                }}
              />
            </ModalSheet>
          );
        }
        return (
          <ModalSheet onClose={close}>
            <UnlockRequestForm
              box={box}
              allBoxes={boxes}
              onClose={close}
              onSuccess={(msg) => {
                if (msg) {
                  setToast(msg);
                  setTimeout(() => setToast(null), 3000);
                }
                success();
              }}
            />
          </ModalSheet>
        );
      })()}

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
        Target date
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
  const [initialDeposit, setInitialDeposit] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const autoLocks = lockType === "HARD" || lockType === "KEYHOLDER";

  async function handleSubmit() {
    if (!name.trim()) { setError("Name is required"); return; }
    if (name.trim().length > 50) { setError("Name must be 50 characters or fewer"); return; }
    if (lockType === "KEYHOLDER" && !selectedKeyholderId) {
      setError("Select a keyholder before saving, or invite one first.");
      return;
    }
    let initialDepositInDollars: number | undefined;
    if (autoLocks && initialDeposit.trim()) {
      const n = Number(initialDeposit);
      if (!Number.isFinite(n) || n < 1) { setError("Initial deposit must be at least $1"); return; }
      initialDepositInDollars = n;
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
          initialDepositInDollars,
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
        maxLength={50}
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
      {autoLocks && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0.5">
            Add funds now?
          </label>
          <p className="text-xs text-gray-500 mb-2">
            This box will be locked as soon as it's created. You can add funds now or skip and come back.
          </p>
          <input
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
            placeholder="Amount ($) — leave blank to skip"
            type="number"
            min="1"
            value={initialDeposit}
            onChange={(e) => setInitialDeposit(e.target.value)}
          />
        </div>
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
  allBoxes,
  onClose,
  onSuccess,
  defaultSource,
}: {
  boxId: string;
  allBoxes: Box[];
  onClose: () => void;
  onSuccess: (usedSource: "wallet" | "external") => void;
  defaultSource?: "wallet" | "external" | null;
}) {
  // Sprint 7 — source selection step first. Wallet internal allocation vs fresh external deposit.
  type Source = "wallet" | "external";
  const targetBox = allBoxes.find((b) => b.id === boxId);
  const wallet = allBoxes.find((b) => b.isWallet);
  const walletDollars = wallet ? wallet.balance / 100 : 0;
  // If target IS the Wallet, only external deposit makes sense
  const targetIsWallet = !!targetBox?.isWallet;

  const [source, setSource] = useState<Source | null>(
    defaultSource ?? (targetIsWallet ? "external" : null),
  );
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currency = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  async function handleSubmit() {
    setError("");
    const amt = Number(amount);
    if (!amt || amt < 1) { setError("Minimum $1"); return; }
    if (source === "wallet" && amt > walletDollars) {
      setError(`Wallet has ${currency(walletDollars)} available.`);
      return;
    }
    setLoading(true);
    try {
      let res: Response;
      if (source === "wallet") {
        if (!wallet) { setError("Wallet not found."); setLoading(false); return; }
        res = await fetch("/api/boxes/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromBoxId: wallet.id, toBoxId: boxId, amountInDollars: amt }),
        });
      } else {
        res = await fetch(`/api/boxes/${boxId}/deposit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountInDollars: amt }),
        });
      }
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Request failed");
      }
      onSuccess(source!);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 1: source selection
  if (source === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">Where should the funds come from?</p>
        <button
          type="button"
          onClick={() => setSource("wallet")}
          disabled={!wallet}
          className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors disabled:opacity-50 disabled:hover:border-gray-100 disabled:hover:bg-transparent"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Move from Wallet</div>
              <div className="text-xs text-gray-500 mt-0.5">
                Internal allocation — no new money added
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {wallet ? currency(walletDollars) : "—"}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSource("external")}
          className="w-full p-4 rounded-xl border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 text-left transition-colors"
        >
          <div className="text-sm font-semibold text-gray-900">Add from external account</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Fresh deposit from a connected bank account
          </div>
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm text-gray-500"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Step 2: amount entry for the selected source
  const headerLabel = source === "wallet" ? "Move from Wallet" : "Add from external";
  const ctaLabel =
    loading
      ? source === "wallet" ? "Moving…" : "Depositing…"
      : source === "wallet" ? `Move $${amount || "0"}` : `Deposit $${amount || "0"}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">{headerLabel}</div>
        {!targetIsWallet && (
          <button
            type="button"
            onClick={() => { setSource(null); setError(""); }}
            className="text-xs text-emerald-600 font-medium"
          >
            Change
          </button>
        )}
      </div>
      {source === "wallet" && wallet && (
        <div className="text-xs text-gray-500">
          Wallet available: <span className="font-semibold text-gray-700">{currency(walletDollars)}</span>
        </div>
      )}
      <input
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        placeholder="Amount ($)"
        type="number"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        autoFocus
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
          {ctaLabel}
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
  const [selectedChip, setSelectedChip] = useState<number | null>(1);

  // For HARD/KEYHOLDER, lockedAmount is always full balance (server enforces too)
  const showAmountSelector = lockType === "SOFT" && boxBalance > 0;

  const setChip = (pct: 0.25 | 0.5 | 0.75 | 1) => {
    const v = Math.max(1, Math.round(balanceDollars * pct));
    setLockAmount(String(v));
    setSelectedChip(pct);
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
            onChange={(e) => {
              setLockAmount(e.target.value);
              setSelectedChip(null);
            }}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
          />
          <div className="flex gap-2 mt-2">
            {([["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["All", 1]] as const).map(([label, pct]) => {
              const active = selectedChip === pct;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setChip(pct)}
                  className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors active:scale-95 ${
                    active
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
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

// ── HARD Self-Unlock Form ─────────────────────────────────
// No keyholder language. Explicit self-action. Reason required.

function HardSelfUnlockForm({
  box,
  onClose,
  onSuccess,
  headline,
  intro,
}: {
  box: Box;
  onClose: () => void;
  onSuccess: (toastMessage?: string) => void;
  headline?: string;
  intro?: string;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!reason.trim()) { setError("Please provide a reason."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", reason: reason.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Unlock failed");
      }
      onSuccess(`${box.name} unlocked.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-gray-900">
          {headline ?? "Unlock this box"}
        </h3>
        <p className="text-sm text-gray-500 mt-1">{box.name}</p>
      </div>
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-3">
        <p className="text-sm text-rose-800 leading-snug">
          {intro ?? "You are unlocking this box yourself. This releases all locked funds and cannot be undone automatically."}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Why are you unlocking this? <span className="text-rose-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Unexpected car repair"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-rose-400"
        />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Keep locked
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !reason.trim()}
          className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Unlocking…" : "Unlock box"}
        </button>
      </div>
    </div>
  );
}

// ── KEYHOLDER Transfer Request Form ───────────────────────
// Creates an UnlockRequest with requestType=TRANSFER. Box stays locked.

function TransferRequestForm({
  box,
  allBoxes,
  onClose,
  onSuccess,
}: {
  box: Box;
  allBoxes: Box[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const destBoxes = allBoxes.filter((b) => b.id !== box.id && !b.isClosed);
  const [toBoxId, setToBoxId] = useState(destBoxes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const currency = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  async function handleSubmit() {
    setError("");
    const amt = Number(amount);
    if (!toBoxId) { setError("Pick a destination box."); return; }
    if (!Number.isFinite(amt) || amt < 1) { setError("Amount must be at least $1."); return; }
    const lockedDollars = box.lockedAmount / 100;
    if (amt > lockedDollars) {
      setError(`Amount can't exceed the locked amount ($${lockedDollars}).`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/unlock-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boxId: box.id,
          requestType: "TRANSFER",
          transferAmountInDollars: amt,
          destinationBoxId: toBoxId,
          reason: reason.trim() || "Transfer request",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to send transfer request.");
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
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Request sent</h3>
        <p className="text-sm text-gray-500 mb-6">
          Your keyholder will review the transfer. The box stays locked while they decide.
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
        <h3 className="font-semibold text-lg text-gray-900">Request a transfer</h3>
        <p className="text-sm text-gray-500">
          You need another active box to transfer into. Create a second box first.
        </p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg text-gray-900">Request a transfer</h3>
        <p className="text-sm text-gray-500 mt-1">
          {box.name} · {currency(box.lockedAmount / 100)} locked
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs text-amber-800 leading-snug">
          Your keyholder must approve. The box stays locked — only the amount you choose will move.
        </p>
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
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Reason <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Helps your keyholder understand the ask"
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 resize-none"
        />
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send request"}
        </button>
      </div>
    </div>
  );
}

function UnlockRequestForm({
  box,
  allBoxes,
  onClose,
  onSuccess,
}: {
  box: Box | null;
  allBoxes?: Box[];
  onClose: () => void;
  onSuccess: (successMessage?: string) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedToName, setSubmittedToName] = useState<string | null>(null);
  // Sprint 6 — Banker intervention for KEYHOLDER only; user can switch to transfer request
  const [bankerDismissed, setBankerDismissed] = useState(false);
  const [switchToTransfer, setSwitchToTransfer] = useState(false);

  // Sprint 7 — fetch ACTIVE keyholders eligible for this box (ALL scope or SELECTED for this box).
  type ActiveKH = { id: string; label: string };
  const [keyholders, setKeyholders] = useState<ActiveKH[] | null>(null);
  const [selectedKhId, setSelectedKhId] = useState("");
  const [switchingToFlexible, setSwitchingToFlexible] = useState(false);

  useEffect(() => {
    if (!box || box.lockType !== "KEYHOLDER") return;
    fetch("/api/keyholders")
      .then((r) => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) { setKeyholders([]); return; }
        const eligible: ActiveKH[] = data
          .filter((r) => r.status === "ACTIVE")
          .filter((r) => {
            if (r.scopeType === "ALL") return true;
            if (r.scopeType === "SELECTED") {
              const boxes = r.boxes ?? [];
              return boxes.some((b: any) => b.boxId === box.id);
            }
            return false;
          })
          .map((r) => ({
            id: r.id,
            label: r.profile?.name
              ? `${r.profile.name} (${r.profile.email})`
              : r.profile?.email ?? "Keyholder",
          }));
        setKeyholders(eligible);
        if (eligible.length > 0) setSelectedKhId(eligible[0].id);
      })
      .catch(() => setKeyholders([]));
  }, [box]);

  async function handleSwitchToFlexible() {
    if (!box) return;
    setSwitchingToFlexible(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switchToFlexible" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to switch.");
      onSuccess(`${box.name} switched to Flexible. You can unlock it yourself.`);
    } catch (e: any) {
      setError(e.message);
      setSwitchingToFlexible(false);
    }
  }

  if (switchToTransfer && box && allBoxes) {
    return (
      <TransferRequestForm
        box={box}
        allBoxes={allBoxes}
        onClose={onClose}
        onSuccess={() => onSuccess()}
      />
    );
  }

  async function handleSubmit() {
    if (!reason.trim()) {
      setError("Please provide a reason for the unlock request");
      return;
    }
    if (!box) return;
    if (box.lockType === "KEYHOLDER" && !selectedKhId) {
      setError("Select a keyholder before submitting.");
      return;
    }
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
          keyholderRelationshipId: box.lockType === "KEYHOLDER" ? selectedKhId : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      setSubmittedToName(data.keyholderName ?? null);
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    const name = submittedToName ?? "your keyholder";
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-4">📬</div>
        <h3 className="font-semibold text-lg text-gray-900 mb-2">
          Unlock request sent to {name}.
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {submittedToName
            ? `${submittedToName} will review your request and approve or deny it.`
            : "You'll hear back once they review your request."}
        </p>
        <button
          onClick={() => onSuccess()}
          className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
        >
          Done
        </button>
      </div>
    );
  }

  // Sprint 7 — recovery state: KEYHOLDER box with no active keyholder attached.
  // Spec: never trap funds behind incomplete setup. Offer Create keyholder / Switch to Flexible.
  if (box?.lockType === "KEYHOLDER" && keyholders !== null && keyholders.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg text-gray-900">No keyholder attached</h3>
          <p className="text-sm text-gray-500 mt-1">
            This box is marked Keyholder, but there's no one active to receive your request.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-sm text-amber-800 leading-snug">
            Invite a keyholder, or switch this box to Flexible so you can unlock it yourself.
          </p>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="space-y-2">
          <button
            onClick={() => router.push("/keyholders")}
            className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium"
          >
            Create keyholder
          </button>
          <button
            onClick={handleSwitchToFlexible}
            disabled={switchingToFlexible}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            {switchingToFlexible ? "Switching…" : "Switch box to Flexible"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm text-gray-500"
          >
            Cancel
          </button>
        </div>
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

      {/* Sprint 7 — keyholder selection (KEYHOLDER only) */}
      {box?.lockType === "KEYHOLDER" && keyholders && keyholders.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Send request to
          </label>
          {keyholders.length === 1 ? (
            <div className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 bg-gray-50">
              {keyholders[0].label}
            </div>
          ) : (
            <select
              value={selectedKhId}
              onChange={(e) => setSelectedKhId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
            >
              {keyholders.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Sprint 6 — Banker intervention (KEYHOLDER only) */}
      {box?.lockType === "KEYHOLDER" && !bankerDismissed && allBoxes && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
            The Banker
          </div>
          <p className="text-sm text-gray-800 leading-snug mb-3">
            Before fully unlocking — do you actually need all of it? If you just need some of it,
            you can keep the rest protected.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSwitchToTransfer(true)}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium"
            >
              Request transfer instead
            </button>
            <button
              type="button"
              onClick={() => setBankerDismissed(true)}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600"
            >
              Unlock anyway
            </button>
          </div>
        </div>
      )}

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
// ── Rename Box Form ───────────────────────────────────────

// ── Change Protection Type (Sprint 15) ────────────────────

type ProtectionOption = {
  id: "SOFT" | "HARD" | "KEYHOLDER";
  icon: string;
  label: string;
  desc: string;
};

const PROTECTION_OPTIONS: ProtectionOption[] = [
  { id: "SOFT", icon: "🛡️", label: "Flexible", desc: "Unlock with a confirmation." },
  { id: "HARD", icon: "🔒", label: "Fully locked", desc: "No withdrawals until you unlock." },
  { id: "KEYHOLDER", icon: "👤", label: "Keyholder required", desc: "Someone you trust must approve." },
];

function warningFor(from: string, to: string): string {
  if (to === "SOFT" && (from === "HARD" || from === "KEYHOLDER")) {
    return "Switching to Flexible means you can access these funds without going through the unlock process. Your discipline protection will be removed.";
  }
  if (from === "SOFT" && to === "HARD") {
    return "Switching to Fully Locked means you will need to unlock this box before accessing funds. The full balance will be locked immediately.";
  }
  if (to === "KEYHOLDER") {
    return "Switching to Keyholder means a person you trust must approve any early access. The full balance will be locked immediately. You will need to assign a keyholder.";
  }
  if (from === "KEYHOLDER" && to === "HARD") {
    return "Switching to Fully Locked means the keyholder will no longer be required for this box. You will need to self-unlock to access funds.";
  }
  return "This will change the protection on this box.";
}

function ChangeProtectionForm({
  box,
  onClose,
  onSuccess,
  onGoUnlock,
  onGoKeyholders,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: (toastMessage?: string) => void;
  // Sprint 16 hotfix — CTA callbacks for blocked protection changes.
  onGoUnlock?: (boxId: string) => void;
  onGoKeyholders?: () => void;
}) {
  const [selected, setSelected] = useState<"SOFT" | "HARD" | "KEYHOLDER" | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(
    null,
  );

  if (!box) return null;

  const current = box.lockType as "SOFT" | "HARD" | "KEYHOLDER";

  async function handleConfirm() {
    if (!box || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changeProtectionType", lockType: selected }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError({
          message: d.error ?? "Failed to change protection.",
          code: d.code,
        });
        return;
      }
      onSuccess(`Protection changed to ${PROTECTION_OPTIONS.find((o) => o.id === selected)?.label}.`);
    } catch {
      setError({ message: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  if (confirmed && selected) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-lg text-gray-900">
          Change to {PROTECTION_OPTIONS.find((o) => o.id === selected)?.label}?
        </h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 leading-snug">
          {warningFor(current, selected)}
        </div>
        {selected === "KEYHOLDER" && (
          <p className="text-xs text-gray-500">
            You can assign a keyholder from the Keyholders page after this change.
          </p>
        )}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-800 space-y-2">
            <p>{error.message}</p>
            {error.code === "box_is_locked" && onGoUnlock && box && (
              <button
                type="button"
                onClick={() => onGoUnlock(box.id)}
                className="w-full py-2 rounded-lg bg-rose-600 text-white text-xs font-medium"
              >
                Unlock this box →
              </button>
            )}
            {error.code === "active_keyholder_exists" && onGoKeyholders && (
              <button
                type="button"
                onClick={onGoKeyholders}
                className="w-full py-2 rounded-lg bg-rose-600 text-white text-xs font-medium"
              >
                Manage keyholders →
              </button>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setConfirmed(false);
              setError(null);
            }}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !!error}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Updating…" : "Confirm change"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-gray-900">Change protection type</h3>
      <p className="text-xs text-gray-500">
        {box.name} is currently {PROTECTION_OPTIONS.find((o) => o.id === current)?.label}.
      </p>
      <div className="space-y-2">
        {PROTECTION_OPTIONS.map((opt) => {
          const isCurrent = opt.id === current;
          const isSelected = opt.id === selected;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => !isCurrent && setSelected(opt.id)}
              disabled={isCurrent}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                isCurrent
                  ? "border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed"
                  : isSelected
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-100 hover:border-gray-200"
              }`}
            >
              <span>{opt.icon}</span>
              <div className="flex-1">
                <div className={`text-sm font-medium ${isSelected ? "text-emerald-700" : "text-gray-900"}`}>
                  {opt.label}
                  {isCurrent && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-500">
                      current
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{opt.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-sm text-rose-600">{error.message}</p>
      )}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Cancel
        </button>
        <button
          onClick={() => selected && setConfirmed(true)}
          disabled={!selected}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function RenameBoxForm({
  box,
  onClose,
  onSuccess,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(box?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name can't be empty"); return; }
    if (trimmed.length > 50) { setError("Name must be 50 characters or fewer"); return; }
    if (!box) return;
    if (trimmed === box.name) { onClose(); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Rename failed");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!box) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-gray-900">Rename box</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        />
        <p className="text-xs text-gray-400 mt-1">{name.length}/50</p>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Edit Due Date (SOFT only) ─────────────────────────────

function EditDueDateForm({
  box,
  onClose,
  onSuccess,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const current = box?.lockUntil ? new Date(box.lockUntil).toISOString().slice(0, 10) : "";
  const [date, setDate] = useState(current);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(clear: boolean = false) {
    if (!box) return;
    if (!clear) {
      if (!date) { setError("Pick a date."); return; }
      if (new Date(date) <= new Date()) { setError("Must be a future date."); return; }
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/boxes/${box.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockUntil: clear ? null : new Date(date).toISOString() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Update failed");
      }
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!box) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-gray-900">Edit target date</h3>
      <p className="text-xs text-gray-500">{box.name}</p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-0.5">Target date</label>
        <p className="text-xs text-gray-400 mb-2">Funds will be protected until this date.</p>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900"
        />
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
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>
      {current && (
        <button
          onClick={() => handleSubmit(true)}
          disabled={loading}
          className="w-full py-2 text-xs text-gray-500 hover:text-rose-600"
        >
          Clear target date
        </button>
      )}
    </div>
  );
}

// ── Close Box Flow ────────────────────────────────────────

function CloseBoxFlow({
  box,
  onClose,
  onSuccess,
  onGoTransfer,
  onGoUnlock,
  onGoKeyholders,
}: {
  box: Box | null;
  onClose: () => void;
  onSuccess: (toastMessage?: string) => void;
  // Sprint 15 — tappable blocker CTAs
  onGoTransfer?: (boxId: string) => void;
  onGoUnlock?: (boxId: string) => void;
  onGoKeyholders?: () => void;
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
    // Sprint 15 — tappable blocker rows with chevrons, routing to the right flow.
    type BlockerCta = {
      label: string;
      onClick: (() => void) | null; // null = no direct action (text-only)
    };
    const ctaFor = (b: string): BlockerCta => {
      switch (b) {
        case "locked_amount":
          return {
            label: "Withdraw or transfer the available funds",
            onClick: onGoTransfer && box ? () => onGoTransfer(box.id) : null,
          };
        case "status_locked":
          return {
            label: "Submit an unlock request and wait for it to resolve",
            onClick: onGoUnlock && box ? () => onGoUnlock(box.id) : null,
          };
        case "pending_unlock":
          return {
            label: "Clear the pending unlock request first",
            onClick: null,
          };
        case "active_keyholder":
          return {
            label: "Remove the keyholder from this box before closing",
            onClick: onGoKeyholders ?? null,
          };
        default:
          return { label: b, onClick: null };
      }
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
          {blockers.map((b) => {
            const cta = ctaFor(b);
            if (cta.onClick) {
              return (
                <button
                  key={b}
                  onClick={cta.onClick}
                  className="w-full bg-amber-50 border-l-4 border-amber-400 rounded-xl px-3 py-3 text-sm text-amber-900 flex items-center gap-2 hover:bg-amber-100 transition-colors text-left"
                >
                  <span className="flex-1">{cta.label}</span>
                  <span className="text-amber-500 text-lg shrink-0">›</span>
                </button>
              );
            }
            return (
              <div
                key={b}
                className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800"
              >
                {cta.label}
              </div>
            );
          })}
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
  // Sprint 6 — exclude closed boxes from destinations
  const destBoxes = allBoxes.filter((b) => b.id !== fromBoxId && !b.isClosed);
  const [toBoxId, setToBoxId] = useState(destBoxes[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [success, setSuccess] = useState(false);
  // Sprint 14 — lock warning confirmation step for HARD/KEYHOLDER destinations
  const [showLockWarning, setShowLockWarning] = useState(false);

  const currency = (n: number) =>
    n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  const destBox = destBoxes.find((b) => b.id === toBoxId) ?? null;
  const destIsLocked =
    !!destBox && !destBox.isWallet &&
    (destBox.lockType === "HARD" || destBox.lockType === "KEYHOLDER");

  function handleInitialSubmit() {
    setError(null);
    const amt = Number(amount);
    if (!toBoxId) { setError({ message: "Select a destination box" }); return; }
    if (!amt || amt < 1) { setError({ message: "Minimum transfer is $1" }); return; }

    // Sprint 14 — if destination is HARD/KEYHOLDER, show warning before executing.
    if (destIsLocked) {
      setShowLockWarning(true);
      return;
    }
    void executeTransfer();
  }

  async function executeTransfer() {
    setError(null);
    setShowLockWarning(false);
    const amt = Number(amount);
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
        <div className="text-xs font-medium text-gray-700 mb-0.5">From</div>
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
          onClick={handleInitialSubmit}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Transferring…" : `Transfer $${amount || "0"}`}
        </button>
      </div>

      {/* Sprint 14 — lock warning modal for HARD/KEYHOLDER destinations */}
      {showLockWarning && destBox && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
          onClick={() => setShowLockWarning(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              These funds will be locked
            </h3>
            <p className="text-sm text-gray-600 leading-snug mb-5">
              Once transferred, this money will be locked in{" "}
              <strong>{destBox.name}</strong>. You&apos;ll need to go through
              the unlock process to access it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLockWarning(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => void executeTransfer()}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Transferring…" : "Confirm transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
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
