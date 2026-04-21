// ============================================================
// app/(shell)/settings/page.tsx
// Settings root — dedicated pages per area, no silent dead taps.
// Sprint 16: removed Manage Budgets & Savings + Language (never built);
// marked Connect Bank as "Coming soon"; added Profile, My Boxes, Help.
// ============================================================

"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Users,
  HelpCircle,
  LogOut,
  ChevronRight,
  User,
  Package,
  Star,
} from "lucide-react";

type Item = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  comingSoon?: boolean;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const items: Item[] = [
    {
      icon: User,
      label: "Profile",
      sub: "Name, email, timezone",
      href: "/settings/profile",
    },
    {
      icon: Package,
      label: "My boxes",
      sub: "Rename, change protection, close",
      href: "/settings/boxes",
    },
    {
      icon: Users,
      label: "Keyholders",
      sub: "Manage accountability partners",
      href: "/keyholders",
    },
    {
      icon: Star,
      label: "Rewards",
      sub: "Consistency streak and more",
      href: "/rewards",
    },
    {
      icon: Link2,
      label: "Connect Bank",
      sub: "Not yet available",
      comingSoon: true,
    },
    {
      icon: HelpCircle,
      label: "Help & Feedback",
      sub: "Send feedback, report a bug, how it works",
      href: "/settings/help",
    },
    {
      icon: LogOut,
      label: "Sign Out",
      sub: "You'll need to sign in again",
      onClick: () => signOut({ callbackUrl: "/signin" }),
      danger: true,
    },
  ];

  function handleClick(item: Item) {
    if (item.comingSoon) return;
    if (item.href) {
      router.push(item.href);
      return;
    }
    item.onClick?.();
  }

  return (
    <div className="px-4 py-5 pb-24 max-w-md mx-auto">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h2>

      {/* User info */}
      {session?.user && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <div className="text-sm font-medium text-gray-900">
            {session.user.name ?? "—"}
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
              onClick={() => handleClick(item)}
              disabled={item.comingSoon}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-50 disabled:hover:bg-transparent disabled:cursor-default transition-colors text-left"
            >
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${item.danger ? "bg-rose-50" : "bg-gray-100"}`}
              >
                <Icon
                  className={`h-4 w-4 ${item.danger ? "text-rose-600" : "text-gray-600"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm font-medium ${
                    item.danger
                      ? "text-rose-600"
                      : item.comingSoon
                      ? "text-gray-400"
                      : "text-gray-900"
                  }`}
                >
                  {item.label}
                  {item.comingSoon && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400 font-medium">
                      Coming soon
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{item.sub}</div>
              </div>
              {!item.comingSoon && (
                <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
              )}
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
