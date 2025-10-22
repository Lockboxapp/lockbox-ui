"use client";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
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
} from "lucide-react";

/* -------------------------------
   Types
--------------------------------*/
type Vault = {
  id: string;
  name: string;
  target: number;
  locked: number;
  saved: number;
  dueDays: number | null;
  isLocked: boolean;
};

type TabKey = "home" | "vaults" | "banker" | "rewards";

/* -------------------------------
   Helpers
--------------------------------*/
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

/** Typed haptic helper (no `any`) */
type VibrateNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
};
function haptic(pattern: number | number[] = 35) {
  if (typeof window === "undefined") return;
  const nav = window.navigator as VibrateNavigator;
  if (typeof nav.vibrate === "function") nav.vibrate(pattern);
}

/* -------------------------------
   Main App
--------------------------------*/
export default function LockBoxApp() {
  const [tab, setTab] = useState<TabKey>("home");
  const [showGoal, setShowGoal] = useState(false);

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

  const totalSaved = useMemo(
    () => vaults.reduce((a, v) => a + v.saved, 0),
    [vaults]
  );

  function toggleVaultLock(vaultId: string) {
    setVaults((prev) =>
      prev.map((v) =>
        v.id === vaultId ? { ...v, isLocked: !v.isLocked } : v
      )
    );
  }

  /* -------------------------------
     UI
  --------------------------------*/
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
          <button
            onClick={() => setShowGoal(true)}
            className="text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition"
          >
            Demo Win
          </button>
        </div>
      </header>

      {/* Tabs */}
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
                  <div className="text-2xl font-bold">
                    {currency(totalSaved)}
                  </div>
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

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Saved:{" "}
                      <span className="font-medium text-gray-900">
                        {currency(v.saved)}
                      </span>
                    </div>

                    {/* Raised lock button */}
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      animate={{
                        scale: 1,
                        boxShadow: v.isLocked
                          ? "0 3px 5px rgba(0,0,0,0.25)"
                          : "inset 0 2px 4px rgba(0,0,0,0.15)",
                        backgroundColor: v.isLocked ? "#f3f4f6" : "#d1fae5",
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                      }}
                      onClick={() => {
                        haptic(35);
                        toggleVaultLock(v.id);
                      }}
                      className="h-9 w-9 grid place-items-center rounded-xl cursor-pointer border border-gray-200"
                      aria-label={v.isLocked ? "Vault locked" : "Vault unlocked"}
                      title={v.isLocked ? "Toggle to unlock view" : "Toggle to lock view"}
                    >
                      {v.isLocked ? (
                        <Lock className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Unlock className="h-4 w-4 text-emerald-600" />
                      )}
                    </motion.button>
                  </div>
                </Card>
              );
            })}
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

      <GoalAchieved open={showGoal} onClose={() => setShowGoal(false)} />
    </div>
  );
}

/* -------------------------------
   Goal Achieved Modal
--------------------------------*/
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

/* -------------------------------
   Banker Chat
--------------------------------*/
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
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
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

/* -------------------------------
   Rewards Tab
--------------------------------*/
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