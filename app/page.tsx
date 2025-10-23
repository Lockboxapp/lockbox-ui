"use client";
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  PiggyBank,
  Shield,
  Wallet,
  MessageSquare,
  Home,
  Lock,
  Unlock,
  Star,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Link2,
  CreditCard,
  Users,
  Languages, 
  HelpCircle, 
  LogOut, 
  Trash2,
  Plus,
  ArrowRightLeft,
} from "lucide-react";

/* =========================================
   Types & Small UI helpers
========================================= */
type Vault = {
  id: string;
  name: string;
  target: number;
  locked: number;
  saved: number;
  dueDays: number | null;
  isLocked: boolean;
};

type UnlockRequest = {
  id: string;
  vaultId: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  code: string;
};

const genApprovalCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

type TabKey = "home" | "vaults" | "banker" | "rewards";

const currency = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function Progress({ value }: { value: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div
        className="h-full bg-emerald-600"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

/* =========================================
   Main App
========================================= */
export default function LockBoxApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const [showGoal, setShowGoal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

// Settings data
const [bankConnected, setBankConnected] = useState(false);
const [bankName, setBankName] = useState<string>(""); // e.g., "Chase"
const [keyholders, setKeyholders] = useState<Array<{ id: string; name: string; contact: string }>>([]);
const [language, setLanguage] = useState<"en" | "es">("en");
const [budgets, setBudgets] = useState<{ rent: number; emergency: number; spending: number }>({
  rent: 50,
  emergency: 30,
  spending: 20,
});


  // Vaults
  const [vaults, setVaults] = useState<Vault[]>([
    {
      id: "rent",
      name: "Rent safe-deposit box",
      target: 1500,
      locked: 900,
      saved: 1200,
      dueDays: 8,
      isLocked: true,
    },
    {
      id: "emergency",
      name: "Emergency fund",
      target: 2000,
      locked: 0,
      saved: 850,
      dueDays: null,
      isLocked: false,
    },
  ]);

  // Modals
  const [showTransfer, setShowTransfer] = useState<null | { id: string }>(null);
  const [lockModal, setLockModal] = useState<null | { vaultId: string }>(null);
  const [addFundsModal, setAddFundsModal] = useState<null | { vaultId: string }>(
    null
  );
  const [newVaultModal, setNewVaultModal] = useState(false);
  // Keyholder unlock flow
const [requests, setRequests] = useState<UnlockRequest[]>([]);
const [unlockModal, setUnlockModal] = useState<null | { vaultId: string }>(null);


  const totalSaved = useMemo(
    () => vaults.reduce((a, v) => a + v.saved, 0),
    [vaults]
  );

  function toggleVaultLock(vaultId: string) {
    setVaults((prev) =>
      prev.map((v) => (v.id === vaultId ? { ...v, isLocked: !v.isLocked } : v))
    );
  }

  /* ---- Money helpers ---- */
  function addFunds(vaultId: string, amount: number) {
    setVaults((prev) =>
      prev.map((v) =>
        v.id === vaultId
          ? { ...v, saved: Math.min(v.target, v.saved + Math.max(0, amount)) }
          : v
      )
    );
  }

  function lockFunds(vaultId: string, amount: number) {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        const lockable = Math.max(0, v.saved - v.locked);
        const amt = Math.max(0, Math.min(amount, lockable));
        if (amt === 0) return v;
        return { ...v, locked: Math.min(v.target, v.locked + amt) };
      })
    );
  }

  function withdrawToBank(vaultId: string, amount: number) {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        const unlocked = Math.max(0, v.saved - v.locked);
        const amt = Math.max(0, Math.min(amount, unlocked));
        if (amt === 0) return v;
        return { ...v, saved: Math.max(0, v.saved - amt) };
      })
    );
  }

  function moveBetweenVaults(fromId: string, toId: string, amount: number) {
    if (fromId === toId) return;
    setVaults((prev) => {
      const from = prev.find((v) => v.id === fromId);
      const to = prev.find((v) => v.id === toId);
      if (!from || !to) return prev;

      const unlocked = Math.max(0, from.saved - from.locked);
      const amt = Math.max(0, Math.min(amount, unlocked));
      if (amt === 0) return prev;

      return prev.map((v) => {
        if (v.id === fromId) return { ...v, saved: Math.max(0, v.saved - amt) };
        if (v.id === toId) return { ...v, saved: Math.min(v.target, v.saved + amt) };
        return v;
      });
    });
  }

  function sendKeyholderNotification(req: {
  id: string;
  vaultId: string;
  amount: number;
  reason: string;
  code: string;
  link: string;
}) {
  const message = `
📩 LockBox Notification

The user requested an early unlock of $${req.amount} from "${req.vaultId}".
Reason: "${req.reason || "No reason provided."}"

Approve or reject:
👉 ${req.link}

If approved, share this code with them so they can unlock immediately:
🔐 Code: ${req.code}
`.trim();

  console.log("📱 Simulated Keyholder SMS:", message);
  alert("Simulated SMS to Keyholder sent.\nOpen the browser console to copy the link.");
}

function submitUnlockRequest(vaultId: string, amount: number, reason: string) {
  const code = genApprovalCode();
  const req: UnlockRequest = {
    id: `${Date.now()}`,
    vaultId,
    amount,
    reason,
    status: requests ? "pending" : "pending",
    createdAt: Date.now(),
    code,
  };

  setRequests((r) => [req, ...r]);

  // Build deep link for a (future) Keyholder web page (or same app route if you add it)
  if (typeof window !== "undefined") {
    const v = vaults.find((x) => x.id === vaultId);
    const qp = new URLSearchParams({
      vault: vaultId,
      name: v?.name || "Vault",
      amount: String(amount),
      reason: reason || "",
      code,
    });
    sendKeyholderNotification({
      id: req.id,
      vaultId,
      amount,
      reason,
      code,
      link: `${window.location.origin}/keyholder?${qp.toString()}`,
    });
  }
}

// Demo-only helpers to flip status (optional)
function simulateApprove(id: string) {
  const req = requests.find((r) => r.id === id);
  if (!req) return;
  setRequests((all) => all.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
  setVaults((prev) =>
    prev.map((v) =>
      v.id === req.vaultId ? { ...v, locked: Math.max(0, v.locked - req.amount) } : v
    )
  );
}
function simulateReject(id: string) {
  setRequests((all) => all.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
}
  
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full grid place-items-center bg-emerald-100">
              <PiggyBank className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold">LockBox</div>
              <div className="text-xs text-gray-500">with The Banker</div>
            </div>
          </div>
          <motion.button
  whileTap={{ scale: 0.9 }}
  onClick={() => setSettingsOpen(true)}
  className="p-2 rounded-full hover:bg-gray-100 transition"
  aria-label="Open settings"
>
  <Menu className="h-5 w-5 text-gray-700" />
</motion.button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-md pb-24">
        {tab === "home" && (
          <div className="px-4 py-5 space-y-12">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">Home</h2>
              <Card className="p-4 bg-emerald-600 text-white">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-700 grid place-items-center">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-lg">Earn More</div>
                    <p className="text-sm/5 opacity-90">
                      Find flexible side gigs to make extra cash
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5" />
                </div>
              </Card>
            </section>

            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Your savings</h3>
              <div className="grid grid-cols-1 gap-3">
                <Card className="p-4 bg-[#0E3559] text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm opacity-80">Total saved</span>
                    <Wallet className="h-4 w-4 opacity-80" />
                  </div>
                  <div className="text-2xl font-bold">{currency(totalSaved)}</div>
                </Card>
              </div>
            </section>
          </div>
        )}

        {tab === "vaults" && (
          <div className="px-4 py-5 space-y-5">
            <h2 className="text-2xl font-semibold">Vaults</h2>

            {vaults.map((v) => {
              const pct = (v.saved / v.target) * 100;
              return (
                <Card key={v.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-sm text-gray-500">
                        {currency(v.target)}
                        {v.dueDays ? ` due in ${v.dueDays} days` : " target"}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      Locked: {currency(v.locked)}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Progress value={pct} />
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Saved:{" "}
                      <span className="font-medium text-gray-900">
                        {currency(v.saved)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Transfer (to bank or between vaults) */}
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowTransfer({ id: v.id })}
                        className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1 bg-gray-900 text-white"
                      >
                        <ArrowRightLeft className="h-4 w-4" /> Transfer
                      </motion.button>

                      {/* Add Funds */}
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setAddFundsModal({ vaultId: v.id })}
                        className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1 bg-emerald-600 text-white"
                      >
                        <Plus className="h-4 w-4" /> Add funds
                      </motion.button>

                      {/* Raised lock square (tap toggle; double-tap opens Lock Funds) */}
                      <motion.button
  whileTap={{ scale: 0.88 }}
  animate={{
    scale: 1,
    boxShadow: v.isLocked
      ? "0 3px 5px rgba(0,0,0,0.25)"
      : "inset 0 2px 4px rgba(0,0,0,0.15)",
    backgroundColor: v.isLocked ? "#f3f4f6" : "#d1fae5",
  }}
  transition={{ type: "spring", stiffness: 260, damping: 18 }}
  onClick={() => toggleVaultLock(v.id)}
  onDoubleClick={() => setLockModal({ vaultId: v.id })}
  onContextMenu={(e) => {
    e.preventDefault();
    if (v.locked > 0) setUnlockModal({ vaultId: v.id });
    else alert("No locked funds to request.");
  }}
  className="h-9 w-9 grid place-items-center rounded-xl cursor-pointer border border-gray-200"
  aria-label={v.isLocked ? "Vault locked" : "Vault unlocked"}
  title="Tap to toggle; double-tap to lock amount; right-click to request unlock"
>

                        {v.isLocked ? (
                          <Lock className="h-4 w-4 text-gray-600" />
                        ) : (
                          <Unlock className="h-4 w-4 text-emerald-600" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Create a new vault */}
            <Card className="p-4 border-dashed">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setNewVaultModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-50 hover:bg-gray-100"
              >
                <Plus className="h-5 w-5" /> Create a new vault
              </motion.button>
            </Card>
          </div>
        )}

        {tab === "banker" && <BankerChat />}
        {tab === "rewards" && <Rewards />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100">
        <div className="mx-auto max-w-md grid grid-cols-4">
          {(["home", "vaults", "banker", "rewards"] as TabKey[]).map((key) => {
            const label =
              key === "home"
                ? "Home"
                : key === "vaults"
                ? "Vaults"
                : key === "banker"
                ? "Banker"
                : "Rewards";
            const Icon =
              key === "home"
                ? Home
                : key === "vaults"
                ? Lock
                : key === "banker"
                ? MessageSquare
                : Star;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="py-3 flex flex-col items-center gap-1"
              >
                <Icon
                  className={`h-5 w-5 ${
                    tab === key ? "text-emerald-600" : "text-gray-500"
                  }`}
                />
                <span
                  className={`text-xs ${
                    tab === key
                      ? "text-emerald-700 font-medium"
                      : "text-gray-500"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <TransferModal
        open={Boolean(showTransfer)}
        onClose={() => setShowTransfer(null)}
        sourceVault={
          showTransfer ? vaults.find((v) => v.id === showTransfer.id) ?? null : null
        }
        vaults={vaults}
        onTransferToBank={(amount) => {
          const id = showTransfer?.id;
          if (!id) return;
          withdrawToBank(id, amount);
        }}
        onTransferBetween={(amount, toId) => {
          const id = showTransfer?.id;
          if (!id) return;
          moveBetweenVaults(id, toId, amount);
        }}
      />

      <AddFundsModal
        open={Boolean(addFundsModal)}
        onClose={() => setAddFundsModal(null)}
        vault={
          addFundsModal
            ? vaults.find((v) => v.id === addFundsModal.vaultId) ?? null
            : null
        }
        onSubmit={(amount) => {
          if (!addFundsModal) return;
          addFunds(addFundsModal.vaultId, amount);
          setAddFundsModal(null);
        }}
      />

      <LockModal
        open={Boolean(lockModal)}
        onClose={() => setLockModal(null)}
        vault={lockModal ? vaults.find((v) => v.id === lockModal.vaultId) ?? null : null}
        onSubmit={(amount) => {
          if (!lockModal) return;
          lockFunds(lockModal.vaultId, amount);
          setLockModal(null);
        }}
      />

  <UnlockModal
  open={Boolean(unlockModal)}
  onClose={() => setUnlockModal(null)}
  vault={
    unlockModal
      ? vaults.find((v) => v.id === unlockModal.vaultId) ?? null
      : null
  }
  onSubmit={(amount, reason) => {
    if (!unlockModal) return;
    submitUnlockRequest(unlockModal.vaultId, amount, reason);
    setUnlockModal(null);
  }}
  onApproveCode={(code) => {
    if (!unlockModal) return;
    const r = requests.find(
      (x) =>
        x.vaultId === unlockModal.vaultId &&
        x.status === "pending" &&
        x.code === code.trim()
    );
    if (!r) {
      alert("Invalid or expired code.");
      return;
    }
    setRequests((all) => all.map((x) => (x.id === r.id ? { ...x, status: "approved" } : x)));
    setVaults((prev) =>
      prev.map((v) =>
        v.id === r.vaultId ? { ...v, locked: Math.max(0, v.locked - r.amount) } : v
      )
    );
    alert("Approved by code. Funds unlocked.");
    setUnlockModal(null);
  }}
/>
      
      <NewVaultModal
        open={newVaultModal}
        onClose={() => setNewVaultModal(false)}
        onCreate={(payload) => {
          const id = `vault-${Date.now()}`;
          setVaults((v) => [
            ...v,
            {
              id,
              name: payload.name,
              target: payload.target,
              saved: 0,
              locked: 0,
              dueDays: payload.dueDays,
              isLocked: false,
            },
          ]);
          setNewVaultModal(false);
        }}
      />
       {/* Settings modal */}
<SettingsDrawer
  open={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  // data + setters
  bankConnected={bankConnected}
  bankName={bankName}
  setBankConnected={setBankConnected}
  setBankName={setBankName}
  keyholders={keyholders}
  setKeyholders={setKeyholders}
  language={language}
  setLanguage={setLanguage}
  budgets={budgets}
  setBudgets={setBudgets}
/>

      {/* Celebrate modal */}
      <GoalAchieved open={showGoal} onClose={() => setShowGoal(false)} />
    </div>
  );
}

/* =========================================
   Modals
========================================= */
function TransferModal({
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
  onTransferBetween: (amount: number, toVaultId: string) => void;
}) {
  // Hooks must always be called (even if we return null later)
  const [mode, setMode] = useState<"bank" | "vault">("bank");
  const [amount, setAmount] = useState(100);
  const [toVaultId, setToVaultId] = useState<string>("");

  if (!open || !sourceVault) return null;

  const unlocked = Math.max(0, sourceVault.saved - sourceVault.locked);
  const otherVaults = vaults.filter((v) => v.id !== sourceVault.id);
  const effectiveToId = toVaultId || (otherVaults[0]?.id ?? "");

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
          <div className="text-lg font-semibold mb-2">Transfer</div>
          <div className="text-sm text-gray-500 mb-1">
            From: <span className="font-medium text-gray-800">{sourceVault.name}</span>
          </div>
          <div className="text-xs text-gray-500 mb-4">
            Available from unlocked: <b>${unlocked}</b>
          </div>

          {/* Mode switch */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("bank")}
              className={`py-2 rounded-xl border ${
                mode === "bank" ? "bg-gray-900 text-white border-gray-900" : "bg-white"
              }`}
            >
              To bank
            </button>
            <button
              onClick={() => setMode("vault")}
              className={`py-2 rounded-xl border ${
                mode === "vault" ? "bg-gray-900 text-white border-gray-900" : "bg-white"
              }`}
            >
              Between vaults
            </button>
          </div>

          {/* Amount */}
          <div className="flex items-center rounded-xl border px-3 py-2">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number"
              min={0}
              max={unlocked}
              className="w-full outline-none py-2"
            />
          </div>

          {/* Quick chips */}
          <div className="mt-4 flex gap-2">
            {[25, 50, 100].map((n) => (
              <button
                key={n}
                onClick={() => setAmount(Math.min(n, unlocked))}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-sm"
              >
                ${n}
              </button>
            ))}
            <button
              onClick={() => setAmount(unlocked)}
              className="px-3 py-1.5 rounded-full bg-gray-100 text-sm"
            >
              Max
            </button>
          </div>

          {/* Destination (if moving between vaults) */}
          {mode === "vault" && (
            <div className="mt-4">
              <label className="text-sm text-gray-600">To vault</label>
              <select
                value={effectiveToId}
                onChange={(e) => setToVaultId(e.target.value)}
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
              >
                {otherVaults.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              disabled={
                amount <= 0 ||
                amount > unlocked ||
                (mode === "vault" && !effectiveToId)
              }
              onClick={() => {
                if (amount <= 0 || amount > unlocked) return;
                if (mode === "bank") onTransferToBank(amount);
                else onTransferBetween(amount, effectiveToId);
                onClose();
              }}
              className={`py-3 rounded-xl text-white ${
                amount > 0 && amount <= unlocked && (mode === "bank" || effectiveToId)
                  ? "bg-emerald-600"
                  : "bg-gray-300"
              }`}
            >
              {mode === "bank" ? "Transfer to bank" : "Transfer to vault"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AddFundsModal({
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
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number"
              min={0}
              className="w-full outline-none py-2"
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

function LockModal({
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
  const [amount, setAmount] = useState(100);
  if (!open || !vault) return null;
  const lockable = Math.max(0, vault.saved - vault.locked);

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
          <div className="text-lg font-semibold mb-2">Lock funds</div>
          <div className="text-sm text-gray-500 mb-3">
            Lock up to <b>${lockable}</b> in “{vault.name}”.
          </div>

          <div className="flex items-center rounded-xl border px-3 py-2">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number"
              min={0}
              max={lockable}
              className="w-full outline-none py-2"
            />
          </div>

          <div className="mt-5 flex gap-2">
            {[50, 100, 250].map((n) => (
              <button
                key={n}
                onClick={() => setAmount(Math.min(n, lockable))}
                className="px-3 py-1.5 rounded-full bg-gray-100 text-sm"
              >
                ${n}
              </button>
            ))}
            <button
              onClick={() => setAmount(lockable)}
              className="px-3 py-1.5 rounded-full bg-gray-100 text-sm"
            >
              Max
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              disabled={amount <= 0 || amount > lockable}
              onClick={() => onSubmit(amount)}
              className={`py-3 rounded-xl text-white ${
                amount > 0 && amount <= lockable ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              Lock
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function UnlockModal({
  open,
  onClose,
  vault,
  onSubmit,
  onApproveCode,
}: {
  open: boolean;
  onClose: () => void;
  vault: Vault | null;
  onSubmit: (amount: number, reason: string) => void;
  onApproveCode: (code: string) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");

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
          <div className="text-lg font-semibold mb-1">Request early unlock</div>
          <div className="text-sm text-gray-500 mb-4">
            Your Keyholder will review and approve. If you already have an approval code,
            enter it below.
          </div>

          <div className="flex items-center rounded-xl border px-3 py-2 mb-3">
            <span className="text-gray-500 mr-1">$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
              type="number"
              min={0}
              className="w-full outline-none py-2"
            />
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for unlock..."
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none mb-4"
          />

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              onClick={() => onSubmit(amount, reason)}
              className="py-3 rounded-xl bg-emerald-600 text-white"
            >
              Submit
            </button>
          </div>

          {/* Approval code path */}
          <div className="mt-4 text-xs text-gray-500">
            <button onClick={() => setShowCode((s) => !s)} className="underline">
              {showCode ? "Hide approval code" : "Have an approval code?"}
            </button>
          </div>

          {showCode && (
            <div className="mt-2">
              <div className="flex items-center rounded-xl border px-3 py-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full outline-none py-2"
                  maxLength={6}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button onClick={() => setShowCode(false)} className="py-3 rounded-xl border">
                  Back
                </button>
                <button
                  onClick={() => onApproveCode(code)}
                  className="py-3 rounded-xl bg-gray-900 text-white"
                >
                  Approve with code
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


function NewVaultModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; target: number; dueDays: number | null }) => void;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState(500);
  const [dueDays, setDueDays] = useState<number | "none">(30);

  if (!open) return null;
  const canSave = name.trim().length > 0 && target > 0;

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
          <div className="text-lg font-semibold mb-2">Create new vault</div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600">Vault name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rent safe-deposit box"
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Goal amount</label>
              <div className="flex items-center rounded-xl border px-3 py-2">
                <span className="text-gray-500 mr-1">$</span>
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value || 0))}
                  className="w-full outline-none py-2"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-600">Due in (days)</label>
              <select
                value={dueDays}
                onChange={(e) =>
                  setDueDays(e.target.value === "none" ? "none" : Number(e.target.value))
                }
                className="mt-1 w-full rounded-xl border px-3 py-2 outline-none"
              >
                <option value="none">No due date</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              disabled={!canSave}
              onClick={() =>
                onCreate({
                  name: name.trim(),
                  target,
                  dueDays: dueDays === "none" ? null : (dueDays as number),
                })
              }
              className={`py-3 rounded-xl text-white ${
                canSave ? "bg-emerald-600" : "bg-gray-300"
              }`}
            >
              Create
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function SettingsDrawer({
  open,
  onClose,
  bankConnected,
  bankName,
  setBankConnected,
  setBankName,
  keyholders,
  setKeyholders,
  language,
  setLanguage,
  budgets,
  setBudgets,
}: {
  open: boolean;
  onClose: () => void;
  bankConnected: boolean;
  bankName: string;
  setBankConnected: (v: boolean) => void;
  setBankName: (n: string) => void;
  keyholders: Array<{ id: string; name: string; contact: string }>;
  setKeyholders: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; contact: string }>>>;
  language: "en" | "es";
  setLanguage: (l: "en" | "es") => void;
  budgets: { rent: number; emergency: number; spending: number };
  setBudgets: React.Dispatch<React.SetStateAction<{ rent: number; emergency: number; spending: number }>>;
}) {
  const [view, setView] = useState<
    "root" | "bank" | "partners" | "budgets" | "language" | "help" | "signout"
  >("root");

  // local state for each sub-view
  const [pendingProvider, setPendingProvider] = useState<string>("");
  const [khName, setKhName] = useState("");
  const [khContact, setKhContact] = useState("");

  const totalBudget = budgets.rent + budgets.emergency + budgets.spending;
  const providers = ["Chase", "Bank of America", "Wells Fargo", "Cash App", "Citi", "ADP"];

  const resetAndClose = () => {
    setView("root");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* backdrop */}
          <div className="flex-1" onClick={resetAndClose} />

          {/* drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="w-80 max-w-full h-full bg-white shadow-2xl p-5 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {view !== "root" ? (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setView("root")}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Back"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </motion.button>
                ) : null}
                <div className="text-lg font-semibold">
                  {view === "root" && "Settings"}
                  {view === "bank" && "Connect Bank"}
                  {view === "partners" && "Accountability Partners"}
                  {view === "budgets" && "Budgets & Savings"}
                  {view === "language" && "Language"}
                  {view === "help" && "Help & Feedback"}
                  {view === "signout" && "Sign Out"}
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={resetAndClose}
                className="p-2 rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-gray-700" />
              </motion.button>
            </div>

            {/* Root list */}
            {view === "root" && (
              <div className="flex-1 overflow-y-auto">
                <ListRow
                  icon={<Link2 className="h-5 w-5" />}
                  title="Connect Bank"
                  subtitle={bankConnected ? `Connected: ${bankName}` : "Not connected"}
                  onClick={() => setView("bank")}
                />
                <ListRow
                  icon={<Users className="h-5 w-5" />}
                  title="Manage Accountability Partners"
                  subtitle={`${keyholders.length} partner${keyholders.length === 1 ? "" : "s"}`}
                  onClick={() => setView("partners")}
                />
                <ListRow
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Manage Budgets & Savings"
                  subtitle={`Split: ${budgets.rent}/${budgets.emergency}/${budgets.spending}`}
                  onClick={() => setView("budgets")}
                />
                <ListRow
                  icon={<Languages className="h-5 w-5" />}
                  title="Language"
                  subtitle={language === "en" ? "English" : "Español"}
                  onClick={() => setView("language")}
                />
                <ListRow
                  icon={<HelpCircle className="h-5 w-5" />}
                  title="Help & Feedback"
                  subtitle="Report a bug, request a feature"
                  onClick={() => setView("help")}
                />
                <ListRow
                  icon={<LogOut className="h-5 w-5" />}
                  title="Sign Out"
                  subtitle="You’ll need to sign in again"
                  onClick={() => setView("signout")}
                />

                <div className="mt-6 text-xs text-gray-400 text-center">
                  LockBox v1.0.0
                </div>
              </div>
            )}

            {/* Connect Bank */}
            {view === "bank" && (
              <div className="flex-1 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-3">
                  Link a provider (mock). This simulates Plaid/Payroll.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {providers.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPendingProvider(p)}
                      className={`px-3 py-2 rounded-xl border text-sm ${
                        pendingProvider === p ? "border-emerald-500 bg-emerald-50" : ""
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    className="py-3 rounded-xl border"
                    onClick={() => setView("root")}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!pendingProvider}
                    className={`py-3 rounded-xl text-white ${
                      pendingProvider ? "bg-emerald-600" : "bg-gray-300"
                    }`}
                    onClick={() => {
                      setBankConnected(true);
                      setBankName(pendingProvider);
                      setPendingProvider("");
                      setView("root");
                    }}
                  >
                    {bankConnected ? "Switch" : "Connect"}
                  </button>
                </div>

                {bankConnected && (
                  <div className="mt-4 text-xs text-gray-500">
                    Connected to: <b>{bankName}</b>
                    <br />
                    (Demo) Disconnect?
                    <button
                      onClick={() => {
                        setBankConnected(false);
                        setBankName("");
                      }}
                      className="ml-2 text-rose-600 underline"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Partners */}
            {view === "partners" && (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-3">
                  {keyholders.length === 0 && (
                    <div className="text-sm text-gray-500">No partners yet.</div>
                  )}
                  {keyholders.map((k) => (
                    <div
                      key={k.id}
                      className="p-3 rounded-xl border flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{k.name}</div>
                        <div className="text-xs text-gray-500">{k.contact}</div>
                      </div>
                      <button
                        onClick={() =>
                          setKeyholders((prev) => prev.filter((x) => x.id !== k.id))
                        }
                        className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-3 rounded-xl border">
                  <div className="text-sm font-medium mb-2">Add a partner</div>
                  <input
                    value={khName}
                    onChange={(e) => setKhName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-xl border px-3 py-2 outline-none mb-2"
                  />
                  <input
                    value={khContact}
                    onChange={(e) => setKhContact(e.target.value)}
                    placeholder="Email or phone"
                    className="w-full rounded-xl border px-3 py-2 outline-none"
                  />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                      Cancel
                    </button>
                    <button
                      disabled={!khName.trim() || !khContact.trim()}
                      onClick={() => {
                        setKeyholders((prev) => [
                          ...prev,
                          { id: `${Date.now()}`, name: khName.trim(), contact: khContact.trim() },
                        ]);
                        setKhName("");
                        setKhContact("");
                      }}
                      className={`py-3 rounded-xl text-white ${
                        khName.trim() && khContact.trim() ? "bg-emerald-600" : "bg-gray-300"
                      }`}
                    >
                      <Plus className="inline h-4 w-4 mr-1" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Budgets */}
            {view === "budgets" && (
              <div className="flex-1 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-3">
                  Set your monthly split. Total must equal <b>100%</b>.
                </div>

                <SliderRow
                  label="Rent safe-deposit box"
                  value={budgets.rent}
                  onChange={(v) => setBudgets((b) => ({ ...b, rent: v }))}
                />
                <SliderRow
                  label="Emergency fund"
                  value={budgets.emergency}
                  onChange={(v) => setBudgets((b) => ({ ...b, emergency: v }))}
                />
                <SliderRow
                  label="Spending"
                  value={budgets.spending}
                  onChange={(v) => setBudgets((b) => ({ ...b, spending: v }))}
                />

                <div className="mt-2 text-sm">
                  Total:{" "}
                  <span
                    className={
                      totalBudget === 100 ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"
                    }
                  >
                    {totalBudget}%
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                    Cancel
                  </button>
                  <button
                    disabled={totalBudget !== 100}
                    onClick={() => setView("root")}
                    className={`py-3 rounded-xl text-white ${
                      totalBudget === 100 ? "bg-emerald-600" : "bg-gray-300"
                    }`}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Language */}
            {view === "language" && (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={language === "en"}
                      onChange={() => setLanguage("en")}
                    />
                    English
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer">
                    <input
                      type="radio"
                      name="lang"
                      checked={language === "es"}
                      onChange={() => setLanguage("es")}
                    />
                    Español
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button
                    onClick={() => setView("root")}
                    className="py-3 rounded-xl bg-emerald-600 text-white"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Help */}
            {view === "help" && (
              <div className="flex-1 overflow-y-auto">
                <div className="space-y-3 text-sm">
                  <p>Need help or want to send feedback?</p>
                  <button
                    onClick={() => alert("Opening email client (demo)…")}
                    className="w-full px-3 py-3 rounded-xl bg-gray-900 text-white"
                  >
                    Email support
                  </button>
                  <button
                    onClick={() => alert("Opening docs (demo)…")}
                    className="w-full px-3 py-3 rounded-xl border"
                  >
                    Read docs
                  </button>
                </div>
                <div className="mt-6 text-xs text-gray-400">
                  Version 1.0.0 • Thanks for trying LockBox!
                </div>
              </div>
            )}

            {/* Sign out */}
            {view === "signout" && (
              <div className="flex-1 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-4">
                  Are you sure you want to sign out?
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      alert("Signed out (demo).");
                      resetAndClose();
                    }}
                    className="py-3 rounded-xl bg-rose-600 text-white"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ——— Small helpers used by SettingsDrawer ——— */

function ListRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left px-3 py-3 rounded-xl hover:bg-gray-50 flex justify-between items-center text-gray-800"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gray-100 grid place-items-center">{icon}</div>
        <div>
          <div className="font-medium">{title}</div>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-400" />
    </motion.button>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-gray-600">{label}</div>
        <div className="text-sm font-medium">{value}%</div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}


/* =========================================
   Banker & Rewards (unchanged basics)
========================================= */
function BankerChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "banker" | "user"; text: string }>
  >([
    {
      role: "banker",
      text: "You spent $40 on pizza yesterday. I'm not upset. I'm just… disappointed.",
    },
    {
      role: "banker",
      text: "That's 40% of what you saved in your Rent safe deposit box last month.",
    },
  ]);

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input.trim() }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "banker", text: "Let's redirect that energy into your vault." },
      ]);
    }, 600);
  };

  return (
    <div className="px-4 py-5">
      <div className="text-2xl font-semibold mb-4">The Banker</div>
      <div className="space-y-3 mb-20">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2 text-[15px] ${
                m.role === "user"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="fixed bottom-16 left-0 right-0">
        <div className="mx-auto max-w-md px-4">
          <Card className="p-2 flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message The Banker"
              className="flex-1 px-3 py-2 outline-none"
            />
            <button
              onClick={send}
              className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm"
            >
              Send
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Rewards() {
  return (
    <div className="px-4 py-5 space-y-4">
      <h2 className="text-2xl font-semibold">Rewards</h2>
      <Card className="p-5 bg-[#0E3559] text-white">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/10 grid place-items-center">
            <Star className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold text-lg">Goal streak</div>
            <div className="text-sm text-white/80">
              Hit 3 goals this month to earn a badge
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* =========================================
   Celebrate modal
========================================= */
function GoalAchieved({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 text-center"
          >
            <div className="mx-auto h-20 w-20 rounded-full grid place-items-center bg-emerald-100 mb-4">
              <Shield className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mb-1">Goal achieved!</div>
            <p className="text-gray-500 mb-6">
              Nice job! I knew you had it in you.
            </p>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium"
            >
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
