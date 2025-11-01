"use client";

/* ===================================================================
   LOCKBOX — MAIN SCREEN
   One-tap lock/unlock, keyholder approvals, settings, etc.
   =================================================================== */

import React, { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  // Header + Nav
  Menu, X,
  // Brand / UI
  PiggyBank, Shield, Wallet, Sparkles, ChevronRight, ChevronLeft,
  // Vault actions
  Lock, Unlock, Plus, ArrowRightLeft,
  // Settings icons
  Link2, CreditCard, Users, Languages, HelpCircle, LogOut, Trash2,
} from "lucide-react";

// Screens
import BottomNav from "@/components/nav/BottomNav";
import HomeDashboard from "@/components/screens/HomeDashboard";
import VaultsScreen from "@/components/screens/VaultsScreen";

// Modals (extracted components)
import TransferModal from "@/components/modals/TransferModal";
import AddFundsModal from "@/components/modals/AddFundsModal";
import LockModal from "@/components/modals/LockModal";
import UnlockModal from "@/components/modals/UnlockModal";
import KeyholderPortalModal from "@/components/modals/KeyholderPortalModal";
import NewVaultModal from "@/components/modals/NewVaultModal";
// Optional celebration
import GoalAchieved from "@/components/modals/GoalAchieved";

/* ===================================================================
   1) TYPES & LIGHT HELPERS
   =================================================================== */

type Vault = {
  id: string;
  name: string;
  target: number;
  locked: number;
  saved: number;
  dueDays: number | null;
  isLocked: boolean;
  /** If true, early unlocks should go to a keyholder (when one exists) */
  requireKeyholder?: boolean;
};

type UnlockRequest = {
  id: string;
  vaultId: string;
  amount: number;
  reason: string;
  code: string; // 6-digit approval code
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

const currency = (n: number | null | undefined) =>
  typeof n === "number" && !isNaN(n)
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "$0";

/* ===================================================================
   2) MAIN APP
   =================================================================== */

export default function LockBoxApp() {
  /* -- 2.1 Global UI state ------------------------------------------------- */
  const [tab, setTab] = useState<"home" | "vaults" | "banker" | "rewards">("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showGoal, setShowGoal] = useState(false);

  /* -- 2.2 Vault data state ------------------------------------------------ */
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [vaultsLoading, setVaultsLoading] = useState<boolean>(true);
  const [vaultsError, setVaultsError] = useState<string | null>(null);

  /* -- 2.3 Settings state -------------------------------------------------- */
  const [bankConnected, setBankConnected] = useState(false);
  const [bankName, setBankName] = useState<string>("");
  const [keyholders, setKeyholders] = useState<Array<{ id: string; name: string; contact: string }>>([]);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [budgets, setBudgets] = useState({ rent: 50, emergency: 30, spending: 20 });

  /* -- 2.4 Modal state ----------------------------------------------------- */
  const [showTransfer, setShowTransfer] = useState<null | { id: string }>(null);
  const [lockModal, setLockModal] = useState<null | { vaultId: string }>(null);
  const [addFundsModal, setAddFundsModal] = useState<null | { vaultId: string }>(null);
  const [unlockModal, setUnlockModal] = useState<null | { vaultId: string }>(null);
  const [keyholderPortalOpen, setKeyholderPortalOpen] = useState(false);
  const [newVaultOpen, setNewVaultOpen] = useState(false);

  /* -- 2.5 Auth ------------------------------------------------------------ */
  const { data: session, status } = useSession();

  /* -- 2.6 Derived --------------------------------------------------------- */
  const totalSaved = useMemo(() => vaults.reduce((a, v) => a + v.saved, 0), [vaults]);

  /* -- 2.7 Server sync helpers (optimistic first, then reconcile) ---------- */
  function addFunds(vaultId: string, amount: number) {
    setVaults(prev =>
      prev.map(v => (v.id === vaultId ? { ...v, saved: Math.min(v.target, v.saved + Math.max(0, amount)) } : v))
    );
  }

  function lockFunds(vaultId: string, amount: number) {
    setVaults(prev =>
      prev.map(v => {
        if (v.id !== vaultId) return v;
        const lockable = Math.max(0, v.saved - v.locked);
        const amt = Math.max(0, Math.min(amount, lockable));
        if (amt === 0) return v;
        return { ...v, locked: Math.min(v.target, v.locked + amt), isLocked: true };
      })
    );
  }

  function withdrawToBank(vaultId: string, amount: number) {
    setVaults(prev =>
      prev.map(v => {
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
    setVaults(prev => {
      const from = prev.find(v => v.id === fromId);
      const to = prev.find(v => v.id === toId);
      if (!from || !to) return prev;

      const unlocked = Math.max(0, from.saved - from.locked);
      const amt = Math.max(0, Math.min(amount, unlocked));
      if (amt === 0) return prev;

      return prev.map(v => {
        if (v.id === fromId) return { ...v, saved: Math.max(0, v.saved - amt) };
        if (v.id === toId) return { ...v, saved: Math.min(v.target, v.saved + amt) };
        return v;
      });
    });
  }

  /* -- 2.8 Refetch vaults (shared by all writers) -------------------------- */
  async function refetchVaults() {
    try {
      setVaultsLoading(true);
      setVaultsError(null);

      const res = await fetch("/api/vaults", { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load vaults (${res.status})`);

      const raw = await res.json();
      const items = Array.isArray(raw) ? raw : raw?.vaults ?? [];

      const list: Vault[] = items.map((v: any) => ({
        id: String(v.id),
        name: v.name ?? "Untitled vault",
        target: Number(v.target ?? 0),
        locked: Number(v.locked ?? 0),
        saved: Number(v.saved ?? 0),
        dueDays: v.dueDays ?? null,
        isLocked: Boolean(v.isLocked),
        requireKeyholder: Boolean(v.requireKeyholder),
      }));

      setVaults(list);
    } catch (err: any) {
      setVaultsError(err?.message || "Failed to load vaults");
      setVaults([]); // avoid stale UI
    } finally {
      setVaultsLoading(false);
    }
  }

  /* -- 2.9 Initial load / auth-aware refresh ------------------------------- */
  useEffect(() => {
    if (status === "authenticated") {
      refetchVaults();
    } else if (status === "unauthenticated") {
      setVaults([]);
      setVaultsLoading(false);
      setVaultsError(null);
    }
  }, [status]);

  /* -- 2.10 Keyholder / Unlock request helpers ----------------------------- */
  const [requests, setRequests] = useState<UnlockRequest[]>([]);

  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function sendKeyholderNotification(req: UnlockRequest, partner: { name: string; contact: string } | null) {
    const partnerLine = partner ? `${partner.name} (${partner.contact})` : "—";
    const msg = `
📩 LockBox — Early Unlock Request
Vault: ${req.vaultId}
Amount: $${req.amount}
Reason: ${req.reason || "(none)"}
Approval code: ${req.code}

Keyholder: ${partnerLine}
(Use 'Keyholder Portal' in the app and enter this code to approve.)
`.trim();

    console.log(msg);
    alert("Simulated SMS to Keyholder sent (see console). Code: " + req.code);
  }

  /** If sendToPartner = false OR no keyholders -> auto-approve. */
  function submitUnlockRequest(vaultId: string, amount: number, reason: string, sendToPartner: boolean) {
    const v = vaults.find(x => x.id === vaultId);
    if (!v) return;

    const thereIsPartner = keyholders.length > 0;
    const shouldSend = sendToPartner && thereIsPartner;

    const req: UnlockRequest = {
      id: `${Date.now()}`,
      vaultId,
      amount: Math.max(0, amount),
      reason,
      code: generateCode(),
      status: shouldSend ? "pending" : "approved",
      createdAt: Date.now(),
    };

    setRequests(r => [req, ...r]);

    if (!shouldSend) {
      // instant approve path
      setVaults(prev =>
        prev.map(x => (x.id === vaultId ? { ...x, locked: Math.max(0, x.locked - req.amount) } : x))
      );
      alert("Unlocked instantly (no keyholder required).");
      return;
    }

    // Notify first partner (demo)
    sendKeyholderNotification(req, keyholders[0] ?? null);
  }

  /* -- 2.11 Render --------------------------------------------------------- */
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      {/* Header ------------------------------------------------------------- */}
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

      {/* Pages -------------------------------------------------------------- */}
      <main className="mx-auto max-w-md pb-24">
        {tab === "home" && <HomeDashboard />}

        {tab === "vaults" && (
          <VaultsScreen
            vaults={vaults}
            vaultsLoading={vaultsLoading}
            vaultsError={vaultsError}
            onCreateNew={() => setNewVaultOpen(true)}
            setShowTransfer={setShowTransfer}
            setAddFundsModal={setAddFundsModal}
            setLockModal={setLockModal}
            setUnlockModal={setUnlockModal}
          />
        )}

        {tab === "banker" && <BankerChat />}
        {tab === "rewards" && <Rewards />}
      </main>

      {/* Bottom Nav --------------------------------------------------------- */}
      <BottomNav value={tab} onChange={setTab} />

      {/* Modals ------------------------------------------------------------- */}
      <TransferModal
        open={Boolean(showTransfer)}
        onClose={() => setShowTransfer(null)}
        sourceVault={showTransfer ? vaults.find(v => v.id === showTransfer.id) ?? null : null}
        vaults={vaults}
        onTransferToBank={async (amount) => {
          const id = showTransfer?.id;
          if (!id) return;
          withdrawToBank(id, amount);
          setShowTransfer(null);
          try {
            await fetch(`/api/vaults/${id}/withdraw`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount }),
            });
          } finally {
            await refetchVaults();
          }
        }}
        onTransferBetween={async (amount, toVaultId) => {
          const fromVaultId = showTransfer?.id;
          if (!fromVaultId || !toVaultId || amount <= 0) return;

          // optimistic
          moveBetweenVaults(fromVaultId, toVaultId, amount);

          try {
            await fetch(`/api/vaults/transfer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fromVaultId, toVaultId, amount }),
            });
          } finally {
            await refetchVaults();
            setShowTransfer(null);
          }
        }}
      />

      <AddFundsModal
        open={Boolean(addFundsModal)}
        onClose={() => setAddFundsModal(null)}
        vault={addFundsModal ? vaults.find(v => v.id === addFundsModal.vaultId) ?? null : null}
        onSubmit={async (amount) => {
          if (!addFundsModal) return;
          const { vaultId } = addFundsModal;

          // optimistic
          addFunds(vaultId, amount);
          setAddFundsModal(null);

          try {
            await fetch(`/api/vaults/${vaultId}/deposit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount }),
            });
          } finally {
            await refetchVaults();
          }
        }}
      />

      <LockModal
        open={Boolean(lockModal)}
        onClose={() => setLockModal(null)}
        vault={lockModal ? vaults.find(v => v.id === lockModal.vaultId) ?? null : null}
        keyholderAvailable={keyholders.length > 0}
        initialRequireKeyholder={lockModal ? vaults.find(v => v.id === lockModal.vaultId)?.requireKeyholder ?? false : false}
        onSubmit={async (amount, requireKeyholder) => {
          if (!lockModal) return;
          const { vaultId } = lockModal;

          // optimistic
          lockFunds(vaultId, amount);
          setVaults(p => p.map(v => (v.id === vaultId ? { ...v, isLocked: true, requireKeyholder } : v)));
          setLockModal(null);

          try {
            await fetch(`/api/vaults/${vaultId}/lock`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount, requireKeyholder }),
            });
          } finally {
            await refetchVaults();
          }
        }}
      />

      <UnlockModal
        open={Boolean(unlockModal)}
        onClose={() => setUnlockModal(null)}
        vault={unlockModal ? vaults.find(v => v.id === unlockModal.vaultId) ?? null : null}
        defaultSendToPartner={
          unlockModal
            ? (vaults.find(v => v.id === unlockModal.vaultId)?.requireKeyholder ?? false) &&
              keyholders.length > 0
            : false
        }
        onSubmit={async (amount, reason, sendToPartner) => {
          if (!unlockModal) return;
          submitUnlockRequest(unlockModal.vaultId, amount, reason, sendToPartner);
          setUnlockModal(null);
          await refetchVaults();
        }}
      />

      <NewVaultModal
        open={newVaultOpen}
        onClose={() => setNewVaultOpen(false)}
        onCreated={(created) => {
          // optimistic
          setVaults(prev => [...prev, created]);
          setNewVaultOpen(false);
          // defensive refresh
          refetchVaults();
        }}
      />

      <KeyholderPortalModal
        open={keyholderPortalOpen}
        onClose={() => setKeyholderPortalOpen(false)}
        requests={requests}
        onApprove={(code) => {
          const r = requests.find(x => x.status === "pending" && x.code === code.trim());
          if (!r) {
            alert("Invalid or expired code.");
            return;
          }
          setRequests(all => all.map(x => (x.id === r.id ? { ...x, status: "approved" } : x)));
          setVaults(prev =>
            prev.map(v => (v.id === r.vaultId ? { ...v, locked: Math.max(0, v.locked - r.amount) } : v))
          );
          alert("Approved. Funds unlocked.");
        }}
        onReject={(code) => {
          const r = requests.find(x => x.status === "pending" && x.code === code.trim());
          if (!r) {
            alert("Invalid or expired code.");
            return;
          }
          setRequests(all => all.map(x => (x.id === r.id ? { ...x, status: "rejected" } : x)));
          alert("Rejected.");
        }}
      />

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
        // open portal
        openPortal={() => setKeyholderPortalOpen(true)}
      />

      <GoalAchieved open={showGoal} onClose={() => setShowGoal(false)} />
    </div>
  );
}

/* ===================================================================
   3) SIMPLE SUB-SCREENS (Banker / Rewards) — stubs for now
   =================================================================== */
function BankerChat() {
  return <div className="p-4 text-sm text-gray-600">Banker chat (simulated for now).</div>;
}
function Rewards() {
  return <div className="p-4 text-sm text-gray-600">Rewards coming soon.</div>;
}

/* ===================================================================
   4) SETTINGS DRAWER + SMALL UI ROWS
   =================================================================== */

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
  openPortal,
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
  openPortal: () => void;
}) {
  const [view, setView] = useState<"root" | "bank" | "partners" | "budgets" | "language" | "help" | "signout">("root");

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
        <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setView("root")} className="p-2 rounded-full hover:bg-gray-100" aria-label="Back">
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

              <motion.button whileTap={{ scale: 0.9 }} onClick={resetAndClose} className="p-2 rounded-full hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5 text-gray-700" />
              </motion.button>
            </div>

            {/* Root list */}
            {view === "root" && (
              <div className="flex-1 overflow-y-auto">
                <ListRow icon={<Link2 className="h-5 w-5" />} title="Connect Bank" subtitle={bankConnected ? `Connected: ${bankName}` : "Not connected"} onClick={() => setView("bank")} />
                <ListRow icon={<Users className="h-5 w-5" />} title="Manage Accountability Partners" subtitle={`${keyholders.length} partner${keyholders.length === 1 ? "" : "s"}`} onClick={() => setView("partners")} />
                <ListRow icon={<CreditCard className="h-5 w-5" />} title="Manage Budgets & Savings" subtitle={`Split: ${budgets.rent}/${budgets.emergency}/${budgets.spending}`} onClick={() => setView("budgets")} />
                <ListRow icon={<Languages className="h-5 w-5" />} title="Language" subtitle={language === "en" ? "English" : "Español"} onClick={() => setView("language")} />
                <ListRow icon={<HelpCircle className="h-5 w-5" />} title="Help & Feedback" subtitle="Report a bug, request a feature" onClick={() => setView("help")} />
                <ListRow icon={<LogOut className="h-5 w-5" />} title="Sign Out" subtitle="You’ll need to sign in again" onClick={() => setView("signout")} />

                <div className="mt-6 text-xs text-gray-400 text-center">LockBox v1.0.0</div>
              </div>
            )}

            {/* Connect Bank */}
            {view === "bank" && (
              <div className="flex-1 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-3">Link a provider (mock). This simulates Plaid/Payroll.</div>
                <div className="grid grid-cols-2 gap-2">
                  {providers.map(p => (
                    <button
                      key={p}
                      onClick={() => setPendingProvider(p)}
                      className={`px-3 py-2 rounded-xl border text-sm ${pendingProvider === p ? "border-emerald-500 bg-emerald-50" : ""}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button className="py-3 rounded-xl border" onClick={() => setView("root")}>
                    Cancel
                  </button>
                  <button
                    disabled={!pendingProvider}
                    className={`py-3 rounded-xl text-white ${pendingProvider ? "bg-emerald-600" : "bg-gray-300"}`}
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
                  {keyholders.length === 0 && <div className="text-sm text-gray-500">No partners yet.</div>}
                  {keyholders.map(k => (
                    <div key={k.id} className="p-3 rounded-xl border flex items-center justify-between">
                      <div>
                        <div className="font-medium">{k.name}</div>
                        <div className="text-xs text-gray-500">{k.contact}</div>
                      </div>
                      <button
                        onClick={() => setKeyholders(prev => prev.filter(x => x.id !== k.id))}
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
                  <input value={khName} onChange={(e) => setKhName(e.target.value)} placeholder="Name" className="w-full rounded-xl border px-3 py-2 outline-none mb-2" />
                  <input value={khContact} onChange={(e) => setKhContact(e.target.value)} placeholder="Email or phone" className="w-full rounded-xl border px-3 py-2 outline-none" />
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                      Cancel
                    </button>
                    <button
                      disabled={!khName.trim() || !khContact.trim()}
                      onClick={() => {
                        setKeyholders(prev => [...prev, { id: `${Date.now()}`, name: khName.trim(), contact: khContact.trim() }]);
                        setKhName("");
                        setKhContact("");
                      }}
                      className={`py-3 rounded-xl text-white ${khName.trim() && khContact.trim() ? "bg-emerald-600" : "bg-gray-300"}`}
                    >
                      <Plus className="inline h-4 w-4 mr-1" />
                      Add
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <button onClick={openPortal} className="w-full py-3 rounded-xl border" title="Open demo portal for partners to approve with a code">
                    Open Keyholder Portal (demo)
                  </button>
                </div>
              </div>
            )}

            {/* Budgets */}
            {view === "budgets" && (
              <div className="flex-1 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-3">
                  Set your monthly split. Total must equal <b>100%</b>.
                </div>

                <SliderRow label="Rent safe-deposit box" value={budgets.rent} onChange={(v) => setBudgets(b => ({ ...b, rent: v }))} />
                <SliderRow label="Emergency fund" value={budgets.emergency} onChange={(v) => setBudgets(b => ({ ...b, emergency: v }))} />
                <SliderRow label="Spending" value={budgets.spending} onChange={(v) => setBudgets(b => ({ ...b, spending: v }))} />

                <div className="mt-2 text-sm">
                  Total:{" "}
                  <span className={budgets.rent + budgets.emergency + budgets.spending === 100 ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
                    {budgets.rent + budgets.emergency + budgets.spending}%
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                    Cancel
                  </button>
                  <button
                    disabled={budgets.rent + budgets.emergency + budgets.spending !== 100}
                    onClick={() => setView("root")}
                    className={`py-3 rounded-xl text-white ${budgets.rent + budgets.emergency + budgets.spending === 100 ? "bg-emerald-600" : "bg-gray-300"}`}
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
                    <input type="radio" name="lang" checked={language === "en"} onChange={() => setLanguage("en")} />
                    English
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer">
                    <input type="radio" name="lang" checked={language === "es"} onChange={() => setLanguage("es")} />
                    Español
                  </label>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button onClick={() => setView("root")} className="py-3 rounded-xl bg-emerald-600 text-white">
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
                  <button onClick={() => alert("Opening email client (demo)…")} className="w-full px-3 py-3 rounded-xl bg-gray-900 text-white">
                    Email support
                  </button>
                  <button onClick={() => alert("Opening docs (demo)…")} className="w-full px-3 py-3 rounded-xl border">
                    Read docs
                  </button>
                </div>
                <div className="mt-6 text-xs text-gray-400">Version 1.0.0 • Thanks for trying LockBox!</div>
              </div>
            )}

            {/* Sign out */}
            {view === "signout" && (
              <div className="flex-1 overflow-y-auto">
                <div className="text-sm text-gray-600 mb-4">Are you sure you want to sign out?</div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setView("root")} className="py-3 rounded-xl border">
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      alert("Signed out.");
                      resetAndClose();
                      signOut({ callbackUrl: "/signin" });
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

/* Small drawer UI helpers -------------------------------------------------- */
function ListRow({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle?: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} className="w-full text-left px-3 py-3 rounded-xl hover:bg-gray-50 flex justify-between items-center text-gray-800">
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

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-gray-600">{label}</div>
        <div className="text-sm font-medium">{value}%</div>
      </div>
      <input type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}

/* ===================================================================
   5) (Kept) COMMENTED INLINE MODALS — preserved for reference
   -------------------------------------------------------------------
   The large commented blocks you had for AddFundsModal / LockModal /
   UnlockModal / KeyholderPortal / NewVaultModal were intentionally left
   out here to shorten the file since they now live in /components/modals.
   If you want them preserved as comments in this file, say the word and
   I’ll paste them back exactly as you had them.
   =================================================================== */
