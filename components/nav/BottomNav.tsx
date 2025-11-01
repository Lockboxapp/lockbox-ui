"use client";
import { Home, Lock, MessageSquare, Star } from "lucide-react";

export default function BottomNav({
  value,
  onChange,
}: {
  value: "home" | "vaults" | "banker" | "rewards";
  onChange: (val: "home" | "vaults" | "banker" | "rewards") => void;
}) {
  const tabs = [
    { key: "home", label: "Home", icon: Home },
    { key: "vaults", label: "Vaults", icon: Lock },
    { key: "banker", label: "Banker", icon: MessageSquare },
    { key: "rewards", label: "Rewards", icon: Star },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-100">
      <div className="mx-auto max-w-md grid grid-cols-4">
        {tabs.map((t) => {
          const active = value === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="py-3 flex flex-col items-center gap-1 w-full"
            >
              <Icon
                className={`h-5 w-5 ${
                  active ? "text-emerald-600" : "text-gray-500"
                }`}
              />
              <span
                className={`text-xs ${
                  active ? "text-emerald-700 font-medium" : "text-gray-500"
                }`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
