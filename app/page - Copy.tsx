"use client";

/* ╔════════════════════════════════════════════════════════════════╗
   ║                      LOCKBOX — MAIN SCREEN                      ║
   ║     One-tap lock/unlock, keyholder approvals, settings, etc.    ║
   ╚════════════════════════════════════════════════════════════════╝ */

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  // Header + Nav
  Menu, X, Home, MessageSquare, Star,
  // Cards / UI
  PiggyBank, Shield, Wallet, Sparkles, ChevronRight, ChevronLeft,
  // Vault actions
  Lock, Unlock, Plus, ArrowRightLeft,
  // Settings icons
  Link2, CreditCard, Users, Languages, HelpCircle, LogOut, Trash2,
} from "lucide-react";
import { useEffect } from "react";
import BottomNav from "@/components/nav/BottomNav";





/* ╔════════════════════════════════════════════════════════════════╗
   ║  1) TYPES & BASIC UI HELPERS                                   ║
   ╚════════════════════════════════════════════════════════════════╝ */

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

type TabKey = "home" | "vaults" | "banker" | "rewards";

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
  (typeof n === "number" && !isNaN(n))
    ? n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "$0";

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

/* ╔════════════════════════════════════════════════════════════════╗
   ║  2) MAIN APP                                                   ║
   ╚════════════════════════════════════════════════════════════════╝ */

export function LockBoxApp() {
  /* ── 2.1 Tabs / Modals / Settings State ───────────────────────── */
  const [tab, setTab] = useState<TabKey>("home");
  const [showGoal, setShowGoal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Settings data
  const [bankConnected, setBankConnected] = useState(false);
  const [bankName, setBankName] = useState<string>("");
  const [keyholders, setKeyholders] = useState<
    Array<{ id: string; name: string; contact: string }>
  >([]);
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [budgets, setBudgets] = useState<{
    rent: number;
    emergency: number;
    spending: number;
  }>({ rent: 50, emergency: 30, spending: 20 });
  
  
  React.useEffect(() => {
  let ignore = false;

  async function loadVaults() {
    try {
      setVaultsLoading(true);
      setVaultsError(null);

      const res = await fetch("/api/vaults", { cache: "no-store" });
      if (!res.ok) {
        // if you decided to return 401 when logged out, handle it gracefully
        if (res.status === 401) {
          if (!ignore) setVaults([]);
          return;
        }
        throw new Error(`Failed to load vaults (${res.status})`);
      }

      const data = await res.json();
      if (!ignore) {
        const list: Vault[] = (data?.vaults ?? []).map((v: any) => ({
          id: v.id,
          name: v.name ?? "Untitled vault",
          target: Number(v.target || 0),
          locked: Number(v.locked || 0),
          saved: Number(v.saved || 0),
          dueDays: v.dueDays ?? null,
          isLocked: Boolean(v.isLocked),
          requireKeyholder: Boolean(v.requireKeyholder),
        }));
        setVaults(list);
      }
    } catch (err: any) {
      if (!ignore) setVaultsError(err?.message || "Failed to load vaults");
    } finally {
      if (!ignore) setVaultsLoading(false);
    }
  }

  loadVaults();
  return () => { ignore = true; };
}, []);


  // Vaults
 // replace your current "Vaults" initialization with:
const [vaults, setVaults] = useState<Vault[]>([]);
const [vaultsLoading, setVaultsLoading] = useState(true);
const [vaultsError, setVaultsError] = useState<string | null>(null);


useEffect(() => {
  (async () => {
    try {
      const res = await fetch("/api/vaults", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        setVaults(
          data.map((d: any) => ({
            id: d.id,
            name: d.name,
            target: d.target,
            locked: d.locked,
            saved: d.saved,
            dueDays: d.dueDays,
            isLocked: d.isLocked,
            requireKeyholder: d.requireKH,
          }))
        );
      } else {
        // First-time users: create two starter vaults once
        const seeds = [
          { name: "Rent safe-deposit box", target: 1500, locked: 900, saved: 1200, dueDays: 8, isLocked: true, requireKH: true },
          { name: "Emergency fund", target: 2000, locked: 0, saved: 850, dueDays: null, isLocked: false, requireKH: false },
        ];
        const created = await Promise.all(
          seeds.map(s =>
            fetch("/api/vaults", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(s),
            }).then(r => r.json())
          )
        );
        setVaults(created.map((d: any) => ({
          id: d.id,
          name: d.name,
          target: d.target,
          locked: d.locked,
          saved: d.saved,
          dueDays: d.dueDays,
          isLocked: d.isLocked,
          requireKeyholder: d.requireKH,
        })));
      }
    } catch (e) {
      console.error("Failed to load vaults", e);
    }
  })();
}, []);


  // Action modals
  const [showTransfer, setShowTransfer] = useState<null | { id: string }>(null);
  const [lockModal, setLockModal] = useState<null | { vaultId: string }>(null);
  const [addFundsModal, setAddFundsModal] = useState<null | { vaultId: string }>(null);
  const [newVaultModal, setNewVaultModal] = useState(false);

  // Unlock flow + keyholder portal
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [unlockModal, setUnlockModal] = useState<null | { vaultId: string }>(null);
  const [keyholderPortalOpen, setKeyholderPortalOpen] = useState(false);

  // Sign out flow
  const { data: session, status } = useSession();


  /* ── 2.2 Derived ──────────────────────────────────────────────── */
  const totalSaved = useMemo(
    () => vaults.reduce((a, v) => a + v.saved, 0),
    [vaults]
  );

  /* ── 2.3 Money Helpers ────────────────────────────────────────── */
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
        return { ...v, locked: Math.min(v.target, v.locked + amt), isLocked: true };
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

  /* ── 2.4 Unlock Flow Helpers ──────────────────────────────────── */
  function generateCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  function sendKeyholderNotification(
    req: UnlockRequest,
    partner: { name: string; contact: string } | null
  ) {
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

  /** Create an unlock request.
   * If sendToPartner = false OR no keyholders configured -> auto-approve.
   */
  function submitUnlockRequest(
    vaultId: string,
    amount: number,
    reason: string,
    sendToPartner: boolean
  ) {
    const v = vaults.find((x) => x.id === vaultId);
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

    setRequests((r) => [req, ...r]);

    if (!shouldSend) {
      // instant approve path
      setVaults((prev) =>
        prev.map((x) =>
          x.id === vaultId ? { ...x, locked: Math.max(0, x.locked - req.amount) } : x
        )
      );
      alert("Unlocked instantly (no keyholder required).");
      return;
    }

    // Notify first partner (demo)
    sendKeyholderNotification(req, keyholders[0] ?? null);
  }

  /* ── 2.5 UI: Header / Pages / Bottom Nav ──────────────────────── */
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      {/* ── Header with Hamburger ─────────────────────────────────── */} <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100"> <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between"> <div className="flex items-center gap-2"> <div className="h-9 w-9 rounded-full grid place-items-center bg-emerald-100"> <PiggyBank className="h-5 w-5 text-emerald-600" /> </div> <div className="leading-tight"> <div className="font-semibold">LockBox</div> <div className="text-xs text-gray-500">with The Banker</div> </div> </div> <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-100 transition" aria-label="Open settings" > <Menu className="h-5 w-5 text-gray-700" /> </motion.button> </div> </header>

      {/* ── Pages ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-md pb-24">
        {tab === "home" && <HomeScreen totalSaved={totalSaved} />}
        {tab === "vaults" && (
          <VaultsScreen
            vaults={vaults}
            setShowTransfer={setShowTransfer}
            setAddFundsModal={setAddFundsModal}
            setLockModal={setLockModal}
            setUnlockModal={setUnlockModal}
          />
        )}
        {tab === "banker" && <BankerChat />}
        {tab === "rewards" && <Rewards />}
      </main>

      {/* ── Bottom Nav ────────────────────────────────────────────── */}
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
              key === "home" ? Home : key === "vaults" ? Lock : key === "banker" ? MessageSquare : Star;
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="py-3 flex flex-col items-center gap-1"
              >
                <Icon className={`h-5 w-5 ${active ? "text-emerald-600" : "text-gray-500"}`} />
                <span className={`text-xs ${active ? "text-emerald-700 font-medium" : "text-gray-500"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Modals (Global) ───────────────────────────────────────── */}
      <TransferModal
        open={Boolean(showTransfer)}
        onClose={() => setShowTransfer(null)}
        sourceVault={showTransfer ? vaults.find((v) => v.id === showTransfer.id) ?? null : null}
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
        keyholderAvailable={keyholders.length > 0}
        initialRequireKeyholder={
          lockModal
            ? vaults.find((v) => v.id === lockModal.vaultId)?.requireKeyholder ?? false
            : false
        }
        onSubmit={(amount, requireKeyholder) => {
          if (!lockModal) return;
          // lock amount
          lockFunds(lockModal.vaultId, amount);
          // persist rule + set locked state
          setVaults((prev) =>
            prev.map((x) =>
              x.id === lockModal.vaultId ? { ...x, isLocked: true, requireKeyholder } : x
            )
          );
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
        defaultSendToPartner={
          unlockModal
            ? (vaults.find((v) => v.id === unlockModal.vaultId)?.requireKeyholder ?? false) &&
              keyholders.length > 0
            : false
        }
        onSubmit={(amount, reason, sendToPartner) => {
          if (!unlockModal) return;
          submitUnlockRequest(unlockModal.vaultId, amount, reason, sendToPartner);
          setUnlockModal(null);
        }}
      />

      <KeyholderPortalModal
        open={keyholderPortalOpen}
        onClose={() => setKeyholderPortalOpen(false)}
        requests={requests}
        onApprove={(code) => {
          const r = requests.find((x) => x.status === "pending" && x.code === code.trim());
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
          alert("Approved. Funds unlocked.");
        }}
        onReject={(code) => {
          const r = requests.find((x) => x.status === "pending" && x.code === code.trim());
          if (!r) {
            alert("Invalid or expired code.");
            return;
          }
          setRequests((all) => all.map((x) => (x.id === r.id ? { ...x, status: "rejected" } : x)));
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
import HomeDashboard from "@/components/screens/HomeDashboard";
export default function Page(){ return <HomeDashboard />; }


/* ╔════════════════════════════════════════════════════════════════╗
   ║  3) PAGE SECTIONS (HOME, VAULTS, BANKER, REWARDS)              ║
   ╚════════════════════════════════════════════════════════════════╝ */

function HomeScreen({ totalSaved }: { totalSaved: number }) {
  return (
    <div className="px-4 py-5 space-y-12">
      {/* Overview */}
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

      {/* Totals */}
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
  );
}

function VaultsScreen({
  vaults,
  vaultsLoading,
  vaultsError,
  setShowTransfer,
  setAddFundsModal,
  setLockModal,
  setUnlockModal,
}: {
  vaults: Vault[];
  vaultsLoading: boolean;
  vaultsError: string | null;
  setShowTransfer: React.Dispatch<React.SetStateAction<null | { id: string }>>;
  setAddFundsModal: React.Dispatch<React.SetStateAction<null | { vaultId: string }>>;
  setLockModal: React.Dispatch<React.SetStateAction<null | { vaultId: string }>>;
  setUnlockModal: React.Dispatch<React.SetStateAction<null | { vaultId: string }>>;
}) {
  return (
    <div className="px-4 py-5 space-y-5">
      <h2 className="text-2xl font-semibold">Vaults</h2>

      {vaultsLoading ? (
        <div className="text-sm text-gray-500">Loading vaults…</div>
      ) : vaultsError ? (
        <div className="text-sm text-rose-600">Error: {vaultsError}</div>
      ) : vaults.length === 0 ? (
        <div className="text-sm text-gray-500">No vaults found for your account.</div>
      ) : (
        <>
          {vaults.map((v) => {
            const pct = (v.saved / Math.max(1, v.target)) * 100; // guard divide-by-zero
            return (
              <Card key={v.id} className="p-4">
                {/* Header */}
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

                {/* Progress */}
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
                    {/* Transfer */}
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

                    {/* One-tap lock/unlock */}
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      animate={{
                        scale: 1,
                        boxShadow: v.isLocked
                          ? "0 3px 5px rgba(0,0,0,0.25)"
                          : "inset 0 2px 4px rgba(0,0,0,0.15)",
                        backgroundColor: v.isLocked ? "#f3f4f6" : "#d1fae5",
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 18 }}
                      onClick={() => {
                        if (v.isLocked) setUnlockModal({ vaultId: v.id });
                        else setLockModal({ vaultId: v.id });
                      }}
                      className="h-9 w-9 grid place-items-center rounded-xl cursor-pointer border border-gray-200"
                      aria-label={v.isLocked ? "Vault locked" : "Vault unlocked"}
                      title={v.isLocked ? "Tap to request unlock" : "Tap to lock funds"}
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

          {/* Create a new vault (tip) */}
          <Card className="p-4 border-dashed">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() =>
                alert("Use Settings → Budgets to plan; New Vault modal available above.")
              }
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-50 hover:bg-gray-100"
            >
              <Plus className="h-5 w-5" /> Tip: Use the “Create new vault” button from the design
              phase (optional)
            </motion.button>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── 4.2 Add Funds Modal ────────────────────────────────────────── */
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

/* ── 4.3 Lock Modal (with "Require Keyholder" toggle) ───────────── */
function LockModal({
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
              <input
                type="checkbox"
                className="sr-only"
                checked={usePartner}
                onChange={(e) => setUsePartner(e.target.checked)}
              />
              <div
                className={`w-11 h-6 rounded-full ${
                  usePartner ? "bg-emerald-600" : "bg-gray-300"
                } relative transition`}
              >
                <span
                  className={`absolute top-0.5 ${
                    usePartner ? "left-6" : "left-0.5"
                  } h-5 w-5 bg-white rounded-full transition`}
                />
              </div>
            </label>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              disabled={amount <= 0 || amount > lockable}
              onClick={() => onSubmit(amount, usePartner)}
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

/* ── 4.4 Unlock Modal (with "Send to partner" toggle) ───────────── */
function UnlockModal({
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
            {sendToPartner
              ? "We’ll send this to your accountability partner for approval."
              : "No partner approval required — unlock will process immediately."}
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

          <div className="p-3 rounded-xl border flex items-center justify-between mb-4">
            <div>
              <div className="font-medium text-sm">Send to accountability partner</div>
              <div className="text-xs text-gray-500">
                Toggle off to unlock instantly (if allowed).
              </div>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={sendToPartner}
                onChange={(e) => setSendToPartner(e.target.checked)}
              />
              <div
                className={`w-11 h-6 rounded-full ${
                  sendToPartner ? "bg-emerald-600" : "bg-gray-300"
                } relative transition`}
              >
                <span
                  className={`absolute top-0.5 ${
                    sendToPartner ? "left-6" : "left-0.5"
                  } h-5 w-5 bg-white rounded-full transition`}
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={onClose} className="py-3 rounded-xl border">
              Cancel
            </button>
            <button
              onClick={() => onSubmit(amount, reason, sendToPartner)}
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

/* ── 4.5 Keyholder Portal (demo) ────────────────────────────────── */
function KeyholderPortalModal({
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-sm rounded-3xl bg-white p-6"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
        >
          <div className="text-lg font-semibold mb-1">Keyholder Portal (demo)</div>
          <div className="text-sm text-gray-500 mb-3">
            Enter the 6-digit code from the SMS to approve or reject.
          </div>

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
            <button onClick={() => setCode("")} className="py-2 rounded-xl border">
              Clear
            </button>
            <button onClick={() => onReject(code)} className="py-2 rounded-xl bg-rose-600 text-white">
              Reject
            </button>
            <button onClick={() => onApprove(code)} className="py-2 rounded-xl bg-emerald-600 text-white">
              Approve
            </button>
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
            <button onClick={onClose} className="w-full py-3 rounded-xl border">
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── 4.6 Celebrate Modal ────────────────────────────────────────── */
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

/* ╔════════════════════════════════════════════════════════════════╗
   ║  5) SETTINGS DRAWER + UTIL ROWS                                ║
   ╚════════════════════════════════════════════════════════════════╝ */

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
  setKeyholders: React.Dispatch<
    React.SetStateAction<Array<{ id: string; name: string; contact: string }>>
  >;
  language: "en" | "es";
  setLanguage: (l: "en" | "es") => void;
  budgets: { rent: number; emergency: number; spending: number };
  setBudgets: React.Dispatch<
    React.SetStateAction<{ rent: number; emergency: number; spending: number }>
  >;
  openPortal: () => void;
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
                  <button className="py-3 rounded-xl border" onClick={() => setView("root")}>
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

                <div className="mt-5">
                  <button
                    onClick={openPortal}
                    className="w-full py-3 rounded-xl border"
                    title="Open demo portal for partners to approve with a code"
                  >
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
                    onClick={() => {alert("Signed out.");
                      resetAndClose();
			signOut({ callbackUrl: "/signin"})
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

/* ── Utility rows for drawer ─────────────────────────────────────── */

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
