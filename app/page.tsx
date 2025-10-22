"use client";
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PiggyBank,
  Shield,
  Wallet,
  MessageSquare,
  Home,
  Lock,
  Star,
  Sparkles,
  ChevronRight,
  Plus,
  ArrowRightLeft,
  PlayCircle,
  CheckCircle2,
  Banknote,
  Users,
  Clock,
  Check,
  CircleSlash,
  History,
  Calendar,
} from "lucide-react";

/**
 * LockBox + The Banker — working UX with Onboarding
 * -------------------------------------------------
 * - Dashboard-first app with bottom tabs (Home, Vaults, Banker, Rewards)
 * - Full-screen onboarding wizard (Welcome → Connect → Split → Lock Rules → Keyholder → Review)
 * - Lock indicator + modal (no big lock/unlock buttons)
 * - New Vault modal (name, goal, MM/DD/YYYY + calendar, partner toggle)
 * - Transfer modal (to bank / between vaults)
 * - Unlock requests history
 * - Local state only (mocked). No backend required.
 */

// ------------------------- Types -------------------------
type Vault = {
  id: string;
  name: string;
  target: number;
  locked: number;
  saved: number;
  dueDays: number | null;
};

type UnlockRequest = {
  id: string;
  vaultId: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
};

// ------------------------- Utils/UI -------------------------
const currency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Progress({ value }: { value: number }) {
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div className="h-full bg-emerald-600" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl shadow-sm border border-gray-100 ${className}`}>{children}</div>;
}

// Animated, tactile lock indicator (tap → haptic + open modal)
function LockIndicator({ active, onOpen }: { active: boolean; onOpen: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={() => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
  navigator.vibrate?.(30);
}
        }
        onOpen();
      }}
      whileTap={{ scale: 0.88 }}
      initial={false}
      animate={active ? { scale: [1, 1.12, 1] } : { scale: 1 }}
      transition={{ duration: 1.6, repeat: active ? Infinity : 0, repeatDelay: 1.4, ease: "easeInOut" }}
      className="inline-flex"
      title={active ? "Funds locked (tap for details)" : "Tap to lock funds"}
    >
      <Lock className={`h-3.5 w-3.5 ${active ? "text-emerald-600" : "text-gray-400"}`} />
    </motion.button>
  );
}

const TABS = [
  { key: "home", label: "Home", icon: Home },
  { key: "vaults", label: "Vaults", icon: Lock },
  { key: "banker", label: "Banker", icon: MessageSquare },
  { key: "rewards", label: "Rewards", icon: Star },
] as const;

type TabKey = (typeof TABS)[number]["key"];

enum OnbStep {
  Welcome = 0,
  Connect = 1,
  Split = 2,
  LockRules = 3,
  Keyholder = 4,
  Review = 5,
}

export default function LockBoxApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const [showGoal, setShowGoal] = useState(false);
  const [showTransfer, setShowTransfer] = useState<null | { id: string }>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Lock modal
  const [showLockModal, setShowLockModal] = useState(false);
  const [activeVault, setActiveVault] = useState<Vault | null>(null);

  // Early unlock flow
  const [requests, setRequests] = useState<UnlockRequest[]>([]);

  // New Vault modal
  const [newVaultOpen, setNewVaultOpen] = useState(false);

  // Mock vaults
  const [vaults, setVaults] = useState<Vault[]>([
    { id: "rent", name: "Rent safe-deposit box", target: 1500, locked: 900, saved: 1200, dueDays: 8 },
    { id: "emergency", name: "Emergency fund", target: 2000, locked: 0, saved: 850, dueDays: null },
  ]);

  const totalSaved = useMemo(() => vaults.reduce((a, v) => a + v.saved, 0), [vaults]);

  // Onboarding state
  const [onbStep, setOnbStep] = useState<OnbStep>(OnbStep.Welcome);
  const [connected, setConnected] = useState(false);
  const [netPay, setNetPay] = useState(2200);
  const [alloc, setAlloc] = useState({ rent: 50, emergency: 30, spending: 20 });
  const [lockUntilDue, setLockUntilDue] = useState(true);
  const [keyholder, setKeyholder] = useState({ enabled: true, contact: "", rule: "approve_over_100" });

  const startOnboarding = () => {
    setShowOnboarding(true);
    setOnbStep(OnbStep.Welcome);
  };

  const finishOnboarding = () => {
    const rentAdd = Math.round((alloc.rent / 100) * netPay);
    const emerAdd = Math.round((alloc.emergency / 100) * netPay);

    setVaults((prev) =>
      prev
        .map((v) =>
          v.id === "rent"
            ? { ...v, saved: Math.min(v.target, v.saved + rentAdd), locked: lockUntilDue ? Math.min(v.target, v.locked + rentAdd) : v.locked }
            : v
        )
        .map((v) => (v.id === "emergency" ? { ...v, saved: Math.min(v.target, v.saved + emerAdd) } : v))
    );

    setShowOnboarding(false);
    setTab("home");
    setShowGoal(true);
  };

  // -------- Money helpers --------

  // Lock from UNLOCKED -> LOCKED
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

  // Withdraw from UNLOCKED to bank
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

  // Move UNLOCKED from one vault to another's SAVED
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

  // --- Simulated Keyholder notification (console + alert) ---
  function sendKeyholderNotification(req: { id: string; vaultId: string; amount: number; reason: string }) {
    const message = `
📩 LockBox Notification

User requested an early unlock of $${req.amount} from their "${req.vaultId}" vault.
Reason: "${req.reason || "No reason provided."}"

Reply YES or NO to approve/decline.

Or view the request online:
👉 http://localhost:3000/keyholder?id=${req.id}
`.trim();

    console.log("📱 Simulated Keyholder SMS:\n" + message);
    alert("Simulated SMS sent to Keyholder. Open the browser console to copy the link.");
  }

  // Create an unlock request (requires Keyholder if enabled)
  function submitUnlockRequest(vaultId: string, amount: number, reason: string) {
    const req: UnlockRequest = {
      id: `${Date.now()}`,
      vaultId,
      amount,
      reason,
      status: keyholder.enabled ? "pending" : "approved",
      createdAt: Date.now(),
    };

    setRequests((r) => [req, ...r]);

    if (!keyholder.enabled) {
      // no keyholder → instant unlock
      setVaults((prev) =>
        prev.map((v) => (v.id === vaultId ? { ...v, locked: Math.max(0, v.locked - amount) } : v))
      );
      setShowGoal(true);
    } else {
      sendKeyholderNotification(req);
    }
  }

  // Demo-only: approve / reject from within app
  function simulateApprove(id: string) {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    setRequests((all) => all.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
    setVaults((prev) =>
      prev.map((v) => (v.id === req.vaultId ? { ...v, locked: Math.max(0, v.locked - req.amount) } : v))
    );
  }
  function simulateReject(id: string) {
    setRequests((all) => all.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
  }

  // Lock toggle handler used by modal
  function handleToggleLock(id: string, lockNow: boolean) {
    if (lockNow) {
      // lock everything currently unlocked
      const vault = vaults.find((v) => v.id === id);
      if (!vault) return;
      const toLock = Math.max(0, vault.saved - vault.locked);
      if (toLock > 0) lockFunds(id, toLock);
    } else {
      // replace with real unlock request flow:
      setActiveVault(vaults.find((v) => v.id === id) || null);
      // open request flow inside lock modal (handled via submitUnlockRequest)
    }
  }

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      {/* Top bar */}
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
          <div className="flex items-center gap-2">
            <button
              onClick={startOnboarding}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition inline-flex items-center gap-1"
              title="Start onboarding"
            >
              <PlayCircle className="h-4 w-4" /> Set up
            </button>
            <button
              onClick={() => setNewVaultOpen(true)}
              className="text-xs px-3 py-1.5 rounded-full border hover:bg-gray-50 transition"
              title="Create a new vault"
            >
              New vault
            </button>
            <button
              onClick={() => setShowGoal(true)}
              className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition"
              title="Demo: show goal achieved"
            >
              Demo Win
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-md pb-24">
        <AnimatePresence mode="wait">
          {tab === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-4 py-5 space-y-12">
              <section className="space-y-4">
                <h2 className="text-2xl font-semibold">Home</h2>
                <Card className="p-4 bg-emerald-600 text-white">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-emerald-700 grid place-items-center">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-lg">Earn More</div>
                      <p className="text-sm/5 opacity-90">Find flexible side gigs to make extra cash</p>
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
                  <Card className="p-4 bg-[#103E68] text-white">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm opacity-80">Safe deposit box</span>
                      <Shield className="h-4 w-4 opacity-80" />
                    </div>
                    <div className="text-2xl font-bold">{currency(vaults.find((v) => v.id === "rent")?.target || 1500)}</div>
                  </Card>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-lg font-semibold">Suggested actions</h3>
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-gray-100 grid place-items-center">
                      <MessageSquare className="h-5 w-5 text-gray-700" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Reflect on a recent impulse purchase</div>
                      <p className="text-sm text-gray-500">The Banker left feedback in chat</p>
                    </div>
                    <button onClick={() => setTab("banker")} className="px-3 py-1.5 rounded-full text-sm bg-gray-900 text-white">
                      Open
                    </button>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-emerald-100 grid place-items-center">
                      <PiggyBank className="h-5 w-5 text-emerald-700" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">Finish setup to auto-split your paycheck</div>
                      <p className="text-sm text-gray-500">Onboarding takes about a minute</p>
                    </div>
                    <button onClick={startOnboarding} className="px-3 py-1.5 rounded-full text-sm bg-emerald-600 text-white">
                      Start
                    </button>
                  </div>
                </Card>
              </section>
            </motion.div>
          )}

          {tab === "vaults" && (
            <motion.div key="vaults" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-4 py-5 space-y-5">
              <h2 className="text-2xl font-semibold">Vault</h2>
              {vaults.map((v) => {
                const pct = (v.saved / v.target) * 100;
                const unlocked = Math.max(0, v.saved - v.locked);
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
                      <div className="text-right">
                        <div className="text-sm text-gray-500 flex items-center justify-end gap-1">
                          <LockIndicator
                            active={v.locked > 0}
                            onOpen={() => {
                              setActiveVault(v);
                              setShowLockModal(true);
                            }}
                          />
                          <span>{currency(v.locked)} locked</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Progress value={pct} />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-sm text-gray-600">
                      <span>
                        Saved: <span className="font-medium text-gray-900">{currency(v.saved)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        Unlocked:{" "}
                        <span className={unlocked > 0 ? "text-emerald-600 font-medium" : "text-gray-400"}>
                          {currency(unlocked)}
                        </span>
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowTransfer({ id: v.id })}
                          disabled={unlocked <= 0}
                          className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 ${
                            unlocked > 0 ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"
                          }`}
                          title={unlocked > 0 ? "Transfer from unlocked funds" : "Nothing unlocked to transfer"}
                        >
                          <ArrowRightLeft className="h-4 w-4" /> Transfer
                        </button>
                        <button
                          onClick={() => {
                            const plus = 50;
                            setVaults((prev) =>
                              prev.map((x) => (x.id === v.id ? { ...x, saved: Math.min(x.target, x.saved + plus) } : x))
                            );
                          }}
                          className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1 bg-emerald-600 text-white"
                        >
                          <Plus className="h-4 w-4" /> Add $50
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}

              <Card className="p-4 border-dashed">
                <button
                  onClick={() => setNewVaultOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-50 hover:bg-gray-100"
                >
                  <Plus className="h-5 w-5" /> Create a new vault
                </button>
              </Card>

              {/* Unlock requests history */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-gray-700" />
                  <div className="font-medium">Unlock requests</div>
                </div>

                {requests.length === 0 ? (
                  <div className="text-sm text-gray-500">No requests yet.</div>
                ) : (
                  <div className="space-y-2">
                    {requests.map((r) => {
                      const v = vaults.find((vv) => vv.id === r.vaultId);
                      const statusStyles =
                        r.status === "approved"
                          ? "text-emerald-700 bg-emerald-50"
                          : r.status === "rejected"
                          ? "text-rose-700 bg-rose-50"
                          : "text-amber-700 bg-amber-50";
                      return (
                        <div key={r.id} className="p-3 rounded-xl border flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-sm">
                              {v?.name || r.vaultId} — {currency(r.amount)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(r.createdAt).toLocaleString()} • {r.reason || "No reason provided"}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded-md text-xs ${statusStyles}`}>{r.status}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* demo-only inline controls */}
                {requests.some((r) => r.status === "pending") && (
                  <div className="mt-3 text-xs text-gray-600">
                    (Demo) Manage pending:{" "}
                    {requests
                      .filter((r) => r.status === "pending")
                      .map((r) => (
                        <span key={r.id} className="inline-flex items-center gap-2 mr-2">
                          <button onClick={() => simulateApprove(r.id)} className="px-2 py-1 rounded-md bg-emerald-600 text-white">
                            Approve
                          </button>
                          <button onClick={() => simulateReject(r.id)} className="px-2 py-1 rounded-md bg-rose-600 text-white">
                            Reject
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {tab === "banker" && <BankerChat key="banker" onCelebrate={() => setShowGoal(true)} />}

          {tab === "rewards" && (
            <motion.div key="rewards" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-4 py-5 space-y-4">
              <h2 className="text-2xl font-semibold">Rewards</h2>
              <Card className="p-5 bg-[#0E3559] text-white">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white/10 grid place-items-center">
                    <Star className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-semibold text-lg">Goal streak</div>
                    <div className="text-sm text-white/80">Hit 3 goals this month to earn a badge</div>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="font-medium mb-2">Badges</div>
                <div className="grid grid-cols-3 gap-3">
                  {["On-time rent", "Impulse slayer", "Streak x7"].map((b) => (
                    <div key={b} className="aspect-square rounded-xl border grid place-items-center text-center text-sm p-2">
                      {b}
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100">
        <div className="mx-auto max-w-md grid grid-cols-4">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button key={key} onClick={() => setTab(key)} className="py-3 flex flex-col items-center gap-1">
                <Icon className={`h-5 w-5 ${active ? "text-emerald-600" : "text-gray-500"}`} />
                <span className={`text-xs ${active ? "text-emerald-700 font-medium" : "text-gray-500"}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals */}
      <GoalAchieved open={showGoal} onClose={() => setShowGoal(false)} />

      <TransferModal
        open={Boolean(showTransfer)}
        onClose={() => setShowTransfer(null)}
        sourceVault={showTransfer ? vaults.find((v) => v.id === showTransfer.id) || null : null}
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

      <LockModal
        open={showLockModal}
        onClose={() => setShowLockModal(false)}
        vault={activeVault}
        onLockNow={(id) => handleToggleLock(id, true)}
        onRequestUnlock={(id, amount, reason) => submitUnlockRequest(id, amount, reason)}
      />

      <NewVaultModal
        open={newVaultOpen}
        onClose={() => setNewVaultOpen(false)}
        onCreate={(nv) => {
          const id = `vault-${Date.now()}`;
          setVaults((prev) => [
            ...prev,
            {
              id,
              name: nv.name,
              target: nv.target,
              saved: 0,
              locked: 0,
              dueDays: nv.unlockDate
                ? Math.max(0, Math.ceil((+new Date(nv.unlockDate) - Date.now()) / 86400000))
                : null,
            },
          ]);

          // simple demo: append partner contact to name if provided
          if (nv.partnerEnabled && nv.partnerContact) {
            setVaults((prev) => prev.map((v) => (v.id === id ? { ...v, name: `${v.name} · 👥 ${nv.partnerContact}` } : v)));
          }

          setNewVaultOpen(false);
        }}
      />

      <OnboardingWizard
        open={showOnboarding}
        step={onbStep}
        setStep={setOnbStep}
        connected={connected}
        setConnected={setConnected}
        netPay={netPay}
        setNetPay={setNetPay}
        alloc={alloc}
        setAlloc={setAlloc}
        lockUntilDue={lockUntilDue}
        setLockUntilDue={setLockUntilDue}
        keyholder={keyholder}
        setKeyholder={setKeyholder}
        onClose={() => setShowOnboarding(false)}
        onFinish={finishOnboarding}
      />
    </div>
  );
}

// ------------- Goal Achieved Modal -------------
function GoalAchieved({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-6 text-center">
            <div className="mx-auto h-20 w-20 rounded-full grid place-items-center bg-emerald-100 mb-4">
              <Shield className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold mb-1">Goal achieved!</div>
            <p className="text-gray-500 mb-6">Nice job! I knew you had it in you.</p>
            <button onClick={onClose} className="w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium">
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------- Transfer Modal (to Bank OR between Vaults) -------------
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
  sourceVault: { id: string; name: string; saved: number; locked: number } | null;
  vaults: Array<{ id: string; name: string; target: number; saved: number; locked: number }>;
  onTransferToBank: (amount: number) => void;
  onTransferBetween: (amount: number, toVaultId: string) => void;
}) {
  const [mode, setMode] = useState<"bank" | "vault">("bank");
  const [amount, setAmount] = useState(100);
  const [toVaultId, setToVaultId] = useState<string>("");
  const sourceId = sourceVault?.id ?? "";
  const otherVaults = React.useMemo(
  () => vaults.filter(v => v.id !== sourceId),
  [vaults, sourceId]
);

useEffect(() => {
  // safe: this runs every render in the same order, but exits early if not ready
  if (mode !== "vault") return;
  if (!toVaultId && otherVaults.length > 0) {
    setToVaultId(otherVaults[0].id);
  }
}, [mode, otherVaults, toVaultId]);

  if (!sourceVault) return null;

  const unlocked = Math.max(0, sourceVault.saved - sourceVault.locked);
  const otherVaults = vaults.filter((v) => v.id !== sourceVault.id);

  useEffect(() => {
    if (mode === "vault" && otherVaults.length > 0 && !toVaultId) {
      setToVaultId(otherVaults[0].id);
    }
  }, [mode, otherVaults, toVaultId]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-6">
            <div className="text-lg font-semibold mb-2">Transfer</div>
            <div className="text-sm text-gray-500 mb-1">
              From: <span className="font-medium text-gray-800">{sourceVault.name}</span>
            </div>
            <div className="text-xs text-gray-500 mb-4">Available from unlocked: <b>${unlocked}</b></div>

            {/* Mode switch */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button onClick={() => setMode("bank")} className={`py-2 rounded-xl border ${mode === "bank" ? "bg-gray-900 text-white border-gray-900" : "bg-white"}`}>
                To bank
              </button>
              <button onClick={() => setMode("vault")} className={`py-2 rounded-xl border ${mode === "vault" ? "bg-gray-900 text-white border-gray-900" : "bg-white"}`}>
                Between vaults
              </button>
            </div>

            {/* Amount */}
            <div className="flex items-center rounded-xl border px-3 py-2">
              <span className="text-gray-500 mr-1">$</span>
              <input
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value || 0))}
                type="number"
                min={0}
                max={unlocked}
                className="w-full outline-none py-2"
              />
            </div>

            {/* Quick chips */}
            <div className="mt-4 flex gap-2">
              {[25, 50, 100].map((n) => (
                <button key={n} onClick={() => setAmount(Math.min(n, unlocked))} className="px-3 py-1.5 rounded-full bg-gray-100 text-sm">
                  ${n}
                </button>
              ))}
              <button onClick={() => setAmount(unlocked)} className="px-3 py-1.5 rounded-full bg-gray-100 text-sm">
                Max
              </button>
            </div>

            {/* Destination (if moving between vaults) */}
            {mode === "vault" && (
              <div className="mt-4">
                <label className="text-sm text-gray-600">To vault</label>
                <select value={toVaultId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setToVaultId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 outline-none">
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
                disabled={amount <= 0 || amount > unlocked || (mode === "vault" && !toVaultId)}
                onClick={() => {
                  if (amount <= 0 || amount > unlocked) return;
                  if (mode === "bank") onTransferToBank(amount);
                  else {
                    if (!toVaultId) return;
                    onTransferBetween(amount, toVaultId);
                  }
                  onClose();
                }}
                className={`py-3 rounded-xl text-white ${
                  amount > 0 && amount <= unlocked && (mode === "bank" || toVaultId) ? "bg-emerald-600" : "bg-gray-300"
                }`}
              >
                {mode === "bank" ? "Transfer to bank" : "Transfer to vault"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------- Lock Modal (status + actions) -------------
function LockModal({
  open,
  onClose,
  vault,
  onLockNow,
  onRequestUnlock,
}: {
  open: boolean;
  onClose: () => void;
  vault: Vault | null;
  onLockNow: (id: string) => void;
  onRequestUnlock: (id: string, amount: number, reason: string) => void;
}) {
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("");
  if (!vault) return null;

  const lockable = Math.max(0, vault.saved - vault.locked);
  const isLocked = vault.locked > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-6">
            <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 grid place-items-center mb-3">
              <Lock className={`h-8 w-8 ${isLocked ? "text-emerald-600" : "text-gray-500"}`} />
            </div>

            <h3 className="text-xl font-semibold mb-1 text-center">{isLocked ? "Funds Locked" : "Unlocked Vault"}</h3>
            <p className="text-gray-600 mb-4 text-sm text-center">
              {isLocked
                ? "These funds are protected until your unlock date or approval from your keyholder."
                : "Funds are currently unlocked. Locking will prevent withdrawals until due."}
            </p>

            {!isLocked ? (
              <>
                <div className="text-sm text-gray-600 mb-2">Lock available up to: <b>${lockable}</b></div>
                <div className="flex items-center rounded-xl border px-3 py-2 mb-4">
                  <span className="text-gray-500 mr-1">$</span>
                  <input
                    value={amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value || 0))}
                    type="number"
                    min={0}
                    max={lockable}
                    className="w-full outline-none py-2"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-600 mb-2">Request early unlock</div>
                <div className="flex items-center rounded-xl border px-3 py-2 mb-3">
                  <span className="text-gray-500 mr-1">$</span>
                  <input
                    value={amount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value || 0))}
                    type="number"
                    min={0}
                    max={vault.locked}
                    className="w-full outline-none py-2"
                  />
                </div>
                <textarea
                  value={reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                  placeholder="Reason for unlock..."
                  className="w-full rounded-xl border px-3 py-2 text-sm outline-none mb-2"
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button onClick={onClose} className="py-3 rounded-xl border border-gray-300">
                Close
              </button>
              {!isLocked ? (
                <button
                  onClick={() => {
                    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
  navigator.vibrate?.(30);
}
                    onLockNow(vault.id);
                    onClose();
                  }}
                  className="py-3 rounded-xl text-white font-medium bg-emerald-600 hover:bg-emerald-700"
                  disabled={lockable <= 0}
                >
                  Lock Now
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (amount <= 0) return;
                    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
  navigator.vibrate?.(30);
}
                    onRequestUnlock(vault.id, amount, reason);
                    onClose();
                  }}
                  className="py-3 rounded-xl text-white font-medium bg-gray-700 hover:bg-gray-800"
                >
                  Request Unlock
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------- New Vault Modal (name, goal, MM/DD/YYYY + calendar, partner) -------------
function NewVaultModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: { name: string; target: number; unlockDate: string | null; partnerEnabled: boolean; partnerContact: string }) => void;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number>(500);

  // Date text with validation + calendar
  const [dateText, setDateText] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");
  const datePickerRef = useRef<HTMLInputElement | null>(null);

  const [partnerEnabled, setPartnerEnabled] = useState(false);
  const [partnerContact, setPartnerContact] = useState("");

  // Helpers
  function parseUsDate(s: string): Date | null {
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    const yyyy = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return d;
  }
  function formatUsDate(d: Date): string {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
    }
  function toIsoDate(s: string): string | null {
    const d = parseUsDate(s);
    if (!d) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const isDateValid = !dateText || !!toIsoDate(dateText);
  const isNameValid = name.trim().length > 0;
  const canSubmit = isNameValid && isDateValid;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-6">
            <div className="text-lg font-semibold mb-3">Create new vault</div>

            <label className="text-sm text-gray-600">Vault name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none mb-3"
              placeholder="e.g., Vacation, Car, Tuition"
            />

            <label className="text-sm text-gray-600">Goal amount ($)</label>
            <input
              type="number"
              value={target}
              min={1}
              onChange={(e) => setTarget(Number(e.target.value || 0))}
              className="mt-1 w-full rounded-xl border px-3 py-2 outline-none mb-3"
            />

            <label className="text-sm text-gray-600">Unlock date (optional)</label>
            <div className="mt-1 relative">
              <input
                inputMode="numeric"
                placeholder="MM/DD/YYYY"
                value={dateText}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d/]/g, "");
                  setDateText(val);
                  if (val.length === 10) {
                    const ok = parseUsDate(val) !== null;
                    setDateError(ok ? "" : "Please use MM/DD/YYYY and a real calendar date.");
                  } else {
                    setDateError("");
                  }
                }}
                onBlur={() => {
                  if (!dateText) {
                    setDateError("");
                    return;
                  }
                  const ok = parseUsDate(dateText) !== null;
                  setDateError(ok ? "" : "Please use MM/DD/YYYY and a real calendar date.");
                }}
                className={`w-full rounded-xl border px-3 py-2 pr-11 outline-none ${dateError ? "border-rose-400" : ""}`}
                maxLength={10}
                pattern="^\d{2}/\d{2}/\d{4}$"
              />
              <button
                type="button"
                onClick={() => datePickerRef.current?.showPicker?.()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-gray-50"
                title="Pick a date"
              >
                <Calendar className="h-5 w-5 text-gray-600" />
              </button>
              <input
                ref={datePickerRef}
                type="date"
                onChange={(e) => {
                  const v = e.target.value; // YYYY-MM-DD
                  if (!v) return;
                  const [yyyy, mm, dd] = v.split("-");
                  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                  const formatted = formatUsDate(d);
                  setDateText(formatted);
                  setDateError("");
                }}
                className="sr-only absolute opacity-0 pointer-events-none"
                tabIndex={-1}
              />
            </div>
            {dateError && <div className="mt-1 text-xs text-rose-600">{dateError}</div>}

            <div className="flex items-center gap-2 mt-4 mb-2">
              <input id="partner" type="checkbox" checked={partnerEnabled} onChange={(e) => setPartnerEnabled(e.target.checked)} />
              <label htmlFor="partner" className="text-sm">
                Add accountability partner
              </label>
            </div>
            <input
              value={partnerContact}
              onChange={(e) => setPartnerContact(e.target.value)}
              placeholder="email or phone (optional)"
              className="w-full rounded-xl border px-3 py-2 outline-none mb-4 disabled:opacity-50"
              disabled={!partnerEnabled}
            />

            <div className="grid grid-cols-2 gap-3">
              <button onClick={onClose} className="py-3 rounded-xl border">
                Cancel
              </button>
              <button
                disabled={!canSubmit}
                onClick={() => {
                  if (dateText && !toIsoDate(dateText)) {
                    setDateError("Please use MM/DD/YYYY and a real calendar date.");
                    return;
                  }
                  onCreate({
                    name: name.trim() || "New goal",
                    target: Math.max(1, target),
                    unlockDate: dateText ? toIsoDate(dateText) : null,
                    partnerEnabled,
                    partnerContact: partnerContact.trim(),
                  });
                }}
                className={`py-3 rounded-xl text-white font-medium transition ${
                  canSubmit ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                Create
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------- Banker Chat -------------
function BankerChat({ onCelebrate }: { onCelebrate: () => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "banker" | "user"; text: string }>>([
    { role: "banker", text: "You spent $40 on pizza yesterday. I'm not upset. I'm just… disappointed." },
    { role: "banker", text: "That's 40% of what you saved in your Rent safe deposit box last month." },
    { role: "banker", text: "Was it worth delaying your goal?" },
  ]);

  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input.trim() }]);
    setInput("");
    setTimeout(() => {
      const lines = [
        "Duly noted. Let’s redirect that energy into your vault.",
        "Understood. I care about outcomes — want to move $50 now?",
        "Thanks for the honesty. Tap 'Demo Win' to see your progress.",
      ];
      const text = lines[Math.floor(Math.random() * lines.length)];
      setMessages((m) => [...m, { role: "banker", text }]);
    }, 500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="px-4 py-5">
      <div className="text-2xl font-semibold mb-4">The Banker</div>
      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-[15px] ${m.role === "user" ? "bg-gray-900 text-white" : "bg-gray-100"}`}>{m.text}</div>
          </div>
        ))}
      </div>
      <div className="h-20" />
      <div className="fixed bottom-16 left-0 right-0">
        <div className="mx-auto max-w-md px-4">
          <Card className="p-2 flex items-center gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message The Banker" className="flex-1 px-3 py-2 outline-none" />
            <button onClick={send} className="px-3 py-2 rounded-xl bg-gray-900 text-white text-sm">
              Send
            </button>
            <button onClick={onCelebrate} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm">
              Celebrate
            </button>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}

// ------------- Onboarding Wizard -------------
function Stepper({ step }: { step: OnbStep }) {
  const steps = ["Welcome", "Connect", "Split", "Lock", "Keyholder", "Review"];
  return (
    <div className="flex items-center justify-between gap-2 text-xs mb-4">
      {steps.map((label, idx) => (
        <div key={label} className="flex-1 flex items-center gap-2">
          <div className={`h-7 px-2 rounded-full border flex items-center gap-1 ${idx <= step ? "bg-emerald-50 border-emerald-200" : "bg-white"}`}>
            {idx <= step ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <span className="h-3.5 w-3.5 rounded-full bg-gray-200" />}
            <span className={`hidden sm:block ${idx <= step ? "text-emerald-700" : "text-gray-500"}`}>{label}</span>
          </div>
          {idx < steps.length - 1 && <div className={`h-px flex-1 ${idx < step ? "bg-emerald-200" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );
}

function OnboardingWizard(props: {
  open: boolean;
  step: OnbStep;
  setStep: (s: OnbStep) => void;
  connected: boolean;
  setConnected: (b: boolean) => void;
  netPay: number;
  setNetPay: (n: number) => void;
  alloc: { rent: number; emergency: number; spending: number };
  setAlloc: (a: { rent: number; emergency: number; spending: number }) => void;
  lockUntilDue: boolean;
  setLockUntilDue: (b: boolean) => void;
  keyholder: { enabled: boolean; contact: string; rule: string };
  setKeyholder: (k: { enabled: boolean; contact: string; rule: string }) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const { open, step, setStep, connected, setConnected, netPay, setNetPay, alloc, setAlloc, lockUntilDue, setLockUntilDue, keyholder, setKeyholder, onClose, onFinish } =
    props;

  const totalPct = alloc.rent + alloc.emergency + alloc.spending;
  const remaining = Math.max(0, 100 - totalPct);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 bg-white overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="mx-auto max-w-md px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Setup</div>
              <button onClick={onClose} className="text-sm text-gray-500">
                Close
              </button>
            </div>
            <Stepper step={step} />

            {step === OnbStep.Welcome && (
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <PiggyBank className="h-6 w-6 text-emerald-600" />
                  <div className="text-lg font-semibold">Welcome to LockBox</div>
                </div>
                <p className="text-gray-600 mb-4">We’ll auto-split your paycheck into a rent safe-deposit box and savings so your bills are always ready on time.</p>
                <ul className="text-sm text-gray-600 space-y-2 mb-4">
                  <li className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" /> Connect income
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4" /> Set your split
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="h-4 w-4" /> Lock until due date (optional)
                  </li>
                  <li className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Add a Keyholder (optional)
                  </li>
                </ul>
                <div className="flex gap-3">
                  <button onClick={() => setStep(OnbStep.Connect)} className="flex-1 py-3 rounded-xl bg-emerald-600 text-white">
                    Start
                  </button>
                </div>
              </Card>
            )}

            {step === OnbStep.Connect && (
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Banknote className="h-6 w-6 text-emerald-600" />
                  <div className="text-lg font-semibold">Connect your income</div>
                </div>
                <p className="text-gray-600 mb-4">Mock connection for now — this simulates Plaid/Payroll link.</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[["Chase"], ["BofA"], ["Wells"], ["Cash App"], ["Citi"], ["ADP"]].map(([name], i) => (
                    <button key={i} onClick={() => setConnected(true)} className={`p-3 rounded-xl border ${connected ? "border-emerald-500" : ""}`}>
                      {name}
                    </button>
                  ))}
                </div>
                <div className="mb-4">
                  <label className="text-sm text-gray-600">Typical net paycheck</label>
                  <div className="flex items-center rounded-xl border px-3 py-2 mt-1">
                    <span className="text-gray-500 mr-1">$</span>
                    <input type="number" value={netPay} onChange={(e) => setNetPay(Number(e.target.value || 0))} className="w-full outline-none py-1.5" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(OnbStep.Welcome)} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button disabled={!connected} onClick={() => setStep(OnbStep.Split)} className={`py-3 rounded-xl text-white ${connected ? "bg-emerald-600" : "bg-gray-300"}`}>
                    {connected ? "Continue" : "Choose an account"}
                  </button>
                </div>
              </Card>
            )}

            {step === OnbStep.Split && (
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <ArrowRightLeft className="h-6 w-6 text-emerald-600" />
                  <div className="text-lg font-semibold">Split your paycheck</div>
                </div>
                <p className="text-gray-600 mb-4">Decide where every dollar goes. Total should be 100%.</p>

                <SplitRow label="Rent safe-deposit box" value={alloc.rent} onChange={(v) => setAlloc({ ...alloc, rent: v })} preview={Math.round((alloc.rent / 100) * netPay)} />
                <SplitRow label="Emergency fund" value={alloc.emergency} onChange={(v) => setAlloc({ ...alloc, emergency: v })} preview={Math.round((alloc.emergency / 100) * netPay)} />
                <SplitRow label="Spending account" value={alloc.spending} onChange={(v) => setAlloc({ ...alloc, spending: v })} preview={Math.round((alloc.spending / 100) * netPay)} />

                <div className="mt-3 text-sm flex items-center justify-between">
                  <div className="text-gray-600">
                    Allocated: <span className={`${remaining === 0 ? "text-emerald-700" : "text-amber-600"}`}>{100 - remaining}%</span>
                  </div>
                  <div className="text-gray-600">
                    Remaining: <span className={`${remaining === 0 ? "text-emerald-700" : "text-amber-600"}`}>{remaining}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button onClick={() => setStep(OnbStep.Connect)} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button disabled={remaining !== 0} onClick={() => setStep(OnbStep.LockRules)} className={`py-3 rounded-xl text-white ${remaining === 0 ? "bg-emerald-600" : "bg-gray-300"}`}>
                    Continue
                  </button>
                </div>
              </Card>
            )}

            {step === OnbStep.LockRules && (
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="h-6 w-6 text-emerald-600" />
                  <div className="text-lg font-semibold">Lock rules</div>
                </div>
                <p className="text-gray-600 mb-4">Prevent accidental spending by locking the rent vault until its due date.</p>
                <div className="flex items-center justify-between p-3 rounded-xl border mb-3">
                  <div>
                    <div className="font-medium">Lock until rent due date</div>
                    <div className="text-sm text-gray-500">Unlocks automatically 2 days before</div>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={lockUntilDue} onChange={(e) => setLockUntilDue(e.target.checked)} />
                    <div className={`w-11 h-6 rounded-full ${lockUntilDue ? "bg-emerald-600" : "bg-gray-300"} relative transition`}>
                      <span className={`absolute top-0.5 ${lockUntilDue ? "left-6" : "left-0.5"} h-5 w-5 bg-white rounded-full transition`} />
                    </div>
                  </label>
                </div>
                <div className="p-3 rounded-xl border text-sm text-gray-600 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> If you need it early, request an early unlock. The Banker will review your reason.
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button onClick={() => setStep(OnbStep.Split)} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button onClick={() => setStep(OnbStep.Keyholder)} className="py-3 rounded-xl bg-emerald-600 text-white">
                    Continue
                  </button>
                </div>
              </Card>
            )}

            {step === OnbStep.Keyholder && (
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-6 w-6 text-emerald-600" />
                  <div className="text-lg font-semibold">Add a Keyholder (optional)</div>
                </div>
                <p className="text-gray-600 mb-4">Pick someone you trust. They’ll approve big moves and keep you on track.</p>
                <div className="flex items-center gap-2 mb-3">
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={keyholder.enabled} onChange={(e) => setKeyholder({ ...keyholder, enabled: e.target.checked })} />
                    <div className={`w-11 h-6 rounded-full ${keyholder.enabled ? "bg-emerald-600" : "bg-gray-300"} relative transition`}>
                      <span className={`absolute top-0.5 ${keyholder.enabled ? "left-6" : "left-0.5"} h-5 w-5 bg-white rounded-full transition`} />
                    </div>
                  </label>
                  <span className="text-sm">Enable Keyholder</span>
                </div>
                <div className={`space-y-3 ${keyholder.enabled ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
                  <div>
                    <label className="text-sm text-gray-600">Contact (email or phone)</label>
                    <input value={keyholder.contact} onChange={(e) => setKeyholder({ ...keyholder, contact: e.target.value })} placeholder="e.g. ashley@example.com" className="mt-1 w-full rounded-xl border px-3 py-2 outline-none" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Approval rule</label>
                    <select value={keyholder.rule} onChange={(e) => setKeyholder({ ...keyholder, rule: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 outline-none">
                      <option value="approve_over_100">Approve transfers over $100</option>
                      <option value="approve_any_unlock">Approve any early unlock</option>
                      <option value="view_only">View-only accountability</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button onClick={() => setStep(OnbStep.LockRules)} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button onClick={() => setStep(OnbStep.Review)} className="py-3 rounded-xl bg-emerald-600 text-white">
                    Continue
                  </button>
                </div>
              </Card>
            )}

            {step === OnbStep.Review && (
              <Card className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <div className="text-lg font-semibold">Review & finish</div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between p-3 rounded-xl border">
                    <span>Account linked</span>
                    {connected ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <Check className="h-4 w-4" /> Connected
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <CircleSlash className="h-4 w-4" /> Not connected
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-xl border">
                    <div className="font-medium mb-1">Split</div>
                    <ul className="space-y-1 text-gray-700">
                      <li>
                        Rent safe-deposit box — {alloc.rent}% ({currency(Math.round((netPay * alloc.rent) / 100))})
                      </li>
                      <li>
                        Emergency fund — {alloc.emergency}% ({currency(Math.round((netPay * alloc.emergency) / 100))})
                      </li>
                      <li>
                        Spending — {alloc.spending}% ({currency(Math.round((netPay * alloc.spending) / 100))})
                      </li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-xl border flex items-center justify-between">
                    <span>Lock until rent due</span>
                    <span className="text-gray-700">{lockUntilDue ? "On" : "Off"}</span>
                  </div>
                  <div className="p-3 rounded-xl border flex items-center justify-between">
                    <span>Keyholder</span>
                    <span className="text-gray-700">{keyholder.enabled ? keyholder.contact || "Enabled" : "Disabled"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <button onClick={() => setStep(OnbStep.Keyholder)} className="py-3 rounded-xl border">
                    Back
                  </button>
                  <button onClick={onFinish} className="py-3 rounded-xl bg-emerald-600 text-white">
                    Finish setup
                  </button>
                </div>
              </Card>
            )}
            <div className="h-10" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SplitRow({ label, value, onChange, preview }: { label: string; value: number; onChange: (v: number) => void; preview: number }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-gray-600">{label}</div>
        <div className="text-sm font-medium">
          {value}% <span className="text-gray-500">({currency(preview)})</span>
        </div>
      </div>
      <input type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}
