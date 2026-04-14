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
import { Home, Lock, MessageSquare, CreditCard, Menu, PiggyBank } from "lucide-react";
import { useState } from "react";

const tabs = [
  { key: "home", label: "Home", icon: Home, href: "/home" },
  { key: "vaults", label: "Vaults", icon: Lock, href: "/vaults" },
  { key: "card", label: "Card", icon: CreditCard, href: "/card" },
  { key: "banker", label: "Banker", icon: MessageSquare, href: "/banker" },
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
    if (pathname.startsWith("/card")) return "card";
    if (pathname.startsWith("/banker")) return "banker";
    if (pathname.startsWith("/home")) return "home";
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
            className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Settings</span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* User info */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900">
                {session?.user?.name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {session?.user?.email}
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-2">
              {[
                {
                  icon: "🔗",
                  label: "Connect Bank",
                  sub: "Not connected",
                  href: null,
                },
                {
                  icon: "👥",
                  label: "Manage Accountability Partners",
                  sub: "Keyholders",
                  href: "/keyholders",
                },
                {
                  icon: "⭐",
                  label: "Rewards",
                  sub: "Consistency streak and more",
                  href: "/rewards",
                },
                {
                  icon: "💳",
                  label: "Manage Budgets & Savings",
                  sub: "Split: 50/30/20",
                  href: null,
                },
                { icon: "🌐", label: "Language", sub: "English", href: null },
                {
                  icon: "❓",
                  label: "Help & Feedback",
                  sub: "Report a bug, request a feature",
                  href: null,
                },
                {
                  icon: "🔗",
                  label: "Share LockBox",
                  sub: "Invite a friend",
                  href: null,
                  share: true,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={async () => {
                    if ((item as any).share) {
                      const shareData = {
                        title: "LockBox",
                        text: "I'm using LockBox to protect my rent money. Try it:",
                        url: "https://lockboxfinance.com/welcome",
                      };
                      if (navigator.share) {
                        await navigator.share(shareData);
                      } else {
                        await navigator.clipboard.writeText(
                          "https://lockboxfinance.com/welcome",
                        );
                        alert("Link copied!");
                      }
                      setSettingsOpen(false);
                      return;
                    }
                    if (item.href) {
                      setSettingsOpen(false);
                      router.push(item.href);
                    }
                  }}
                  className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 text-left"
                >
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500">{item.sub}</div>
                  </div>
                  <span className="text-gray-400 text-sm">›</span>
                </button>
              ))}
              <button
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 text-left"
              >
                <span className="text-lg">🚪</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-rose-600">
                    Sign Out
                  </div>
                  <div className="text-xs text-gray-500">
                    You'll need to sign in again
                  </div>
                </div>
              </button>
            </div>

            {/* Version */}
            <div className="px-6 py-4 border-t border-gray-100 text-center text-xs text-gray-400">
              LockBox v1.0.0
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
