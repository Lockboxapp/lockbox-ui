// ============================================================
// app/(shell)/settings/page.tsx
// Settings screen — extracted from monolith, properly routed
// ============================================================

"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Users,
  CreditCard,
  Languages,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const items = [
    {
      icon: Link2,
      label: "Connect Bank",
      sub: "Not connected",
      onClick: () => {},
    },
    {
      icon: Users,
      label: "Manage Accountability Partners",
      sub: "0 partners",
      onClick: () => {},
    },
    {
      icon: CreditCard,
      label: "Manage Budgets & Savings",
      sub: "Split: 50/30/20",
      onClick: () => {},
    },
    {
      icon: Languages,
      label: "Language",
      sub: "English",
      onClick: () => {},
    },
    {
      icon: HelpCircle,
      label: "Help & Feedback",
      sub: "Report a bug, request a feature",
      onClick: () => {},
    },
    {
      icon: LogOut,
      label: "Sign Out",
      sub: "You'll need to sign in again",
      onClick: () => signOut({ callbackUrl: "/signin" }),
      danger: true,
    },
  ];

  return (
    <div className="px-4 py-5">
      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      {/* User info */}
      {session?.user && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-sm font-medium text-gray-900">
            {session.user.name}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {session.user.email}
          </div>
        </div>
      )}

      {/* Settings items */}
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${item.danger ? "bg-rose-50" : "bg-gray-100"}`}
              >
                <Icon
                  className={`h-4 w-4 ${item.danger ? "text-rose-600" : "text-gray-600"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium ${item.danger ? "text-rose-600" : "text-gray-900"}`}
                >
                  {item.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{item.sub}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Version */}
      <div className="mt-8 text-center text-xs text-gray-400">
        LockBox v1.0.0
      </div>
    </div>
  );
}
