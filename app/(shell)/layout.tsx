// ============================================================
// app/(shell)/layout.tsx
// Authenticated shell — renders ONCE across all tab navigation
// Header + bottom nav live here only
// ============================================================

"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Lock, MessageSquare, Star, Menu, PiggyBank } from "lucide-react";
import { useState } from "react";

const tabs = [
  { key: "home", label: "Home", icon: Home, href: "/" },
  { key: "vaults", label: "Vaults", icon: Lock, href: "/vaults" },
  { key: "banker", label: "Banker", icon: MessageSquare, href: "/banker" },
  { key: "rewards", label: "Rewards", icon: Star, href: "/rewards" },
] as const;

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Redirect unauthenticated users to signin
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  function getActiveTab() {
    if (pathname.startsWith("/vaults")) return "vaults";
    if (pathname.startsWith("/banker")) return "banker";
    if (pathname.startsWith("/rewards")) return "rewards";
    return "home";
  }

  const activeTab = getActiveTab();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-emerald-600" />
          <span className="text-base font-bold text-gray-900">LockBox</span>
          <span className="text-xs text-gray-400 font-medium">
            with The Banker
          </span>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Menu className="h-4 w-4 text-gray-600" />
        </button>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>

      {/* ── Bottom nav — renders once, persists across all routes ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-100">
        <div className="max-w-md mx-auto grid grid-cols-4">
          {tabs.map((t) => {
            const active = activeTab === t.key;
            const Icon = t.icon;
            return (
              <Link
                key={t.key}
                href={t.href}
                className="py-3 flex flex-col items-center gap-1 w-full"
              >
                <Icon
                  className={`h-5 w-5 ${
                    active ? "text-emerald-600" : "text-gray-400"
                  }`}
                />
                <span
                  className={`text-xs ${
                    active ? "text-emerald-700 font-medium" : "text-gray-400"
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Settings drawer ── */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900">Settings</span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-gray-400"
              >
                ✕
              </button>
            </div>
            <div className="text-sm text-gray-500">{session?.user?.email}</div>
            <hr className="border-gray-100" />
            <button
              onClick={() => signOut({ callbackUrl: "/signin" })}
              className="text-left text-sm text-rose-600 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
