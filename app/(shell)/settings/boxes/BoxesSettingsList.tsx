"use client";

// ============================================================
// BoxesSettingsList — Sprint 16
// Renders active + closed boxes. Tapping a box opens an action
// sheet with Rename / Edit target date (SOFT) / Change protection /
// Close box. Each action deep-links to /vaults with the right param.
// ============================================================

import Link from "next/link";
import { useState } from "react";
import { Wallet as WalletIcon } from "lucide-react";

type Box = {
  id: string;
  name: string;
  lockType: string;
  status: string;
  balance: number;
  lockedAmount: number;
  targetAmount: number | null;
  lockUntil: string | null;
  isWallet: boolean;
  isClosed: boolean;
  updatedAt: string;
};

const currency = (cents: number) =>
  (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function LockTypeBadge({ lockType }: { lockType: string }) {
  const config =
    lockType === "HARD"
      ? { label: "Fully locked", cls: "bg-emerald-100 text-emerald-700" }
      : lockType === "KEYHOLDER"
      ? { label: "Keyholder", cls: "bg-amber-100 text-amber-700" }
      : { label: "Flexible", cls: "bg-gray-100 text-gray-600" };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.cls}`}
    >
      {config.label}
    </span>
  );
}

export default function BoxesSettingsList({ boxes }: { boxes: Box[] }) {
  const wallet = boxes.find((b) => b.isWallet) ?? null;
  const active = boxes.filter((b) => !b.isClosed && !b.isWallet);
  const closed = boxes.filter((b) => b.isClosed);

  const [sheetBoxId, setSheetBoxId] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);

  const sheetBox = sheetBoxId ? boxes.find((b) => b.id === sheetBoxId) : null;

  return (
    <>
      {wallet && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
                <WalletIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Wallet</div>
                <div className="text-[11px] opacity-75">
                  Always liquid · system-managed
                </div>
              </div>
            </div>
            <div className="text-lg font-bold">{currency(wallet.balance)}</div>
          </div>
          <p className="text-[11px] opacity-75 mt-3">
            Wallet can't be renamed, locked, or closed.
          </p>
        </div>
      )}

      {active.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">
          <p className="text-sm text-gray-600">No active boxes yet.</p>
          <Link
            href="/vaults"
            className="text-xs text-emerald-600 font-medium mt-2 inline-block"
          >
            Go to Vaults to create one →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {active.map((b, i) => {
            const days = b.lockUntil
              ? Math.ceil(
                  (new Date(b.lockUntil).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;
            return (
              <button
                key={b.id}
                onClick={() => setSheetBoxId(b.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${
                  i < active.length - 1 ? "border-b border-gray-50" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {b.name}
                    </span>
                    <LockTypeBadge lockType={b.lockType} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {currency(b.balance)}
                    {days != null && (
                      <>
                        {" · "}
                        {days < 0
                          ? "target date passed"
                          : days === 0
                          ? "target today"
                          : `target in ${days} day${days === 1 ? "" : "s"}`}
                      </>
                    )}
                  </div>
                </div>
                <span className="text-gray-300 text-lg shrink-0">›</span>
              </button>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <button
            onClick={() => setClosedOpen(!closedOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <span>Closed boxes ({closed.length})</span>
            <span>{closedOpen ? "▾" : "▸"}</span>
          </button>
          {closedOpen && (
            <div className="space-y-2 mt-2">
              {closed.map((b) => (
                <div
                  key={b.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-700">{b.name}</div>
                    <div className="text-xs text-gray-500">
                      Final balance: {currency(b.balance)}
                    </div>
                  </div>
                  <Link
                    href={`/vaults?box=${b.id}`}
                    className="text-xs text-emerald-600 font-medium"
                  >
                    View →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {sheetBox && (
        <BoxActionSheet
          box={sheetBox}
          onClose={() => setSheetBoxId(null)}
        />
      )}
    </>
  );
}

function BoxActionSheet({
  box,
  onClose,
}: {
  box: Box;
  onClose: () => void;
}) {
  const canEditDate = box.lockType === "SOFT" && !box.isWallet;
  const deepLink = (action: string) =>
    `/vaults?box=${box.id}&action=${action}`;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-5 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm text-gray-500">Manage</div>
            <div className="text-lg font-semibold text-gray-900">{box.name}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-sm">✕</button>
        </div>

        <Link
          href={deepLink("rename")}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50"
        >
          <span className="text-sm text-gray-900 font-medium">Rename</span>
          <span className="text-gray-300 text-lg">›</span>
        </Link>

        {canEditDate ? (
          <Link
            href={deepLink("date")}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50"
          >
            <span className="text-sm text-gray-900 font-medium">
              Edit target date
            </span>
            <span className="text-gray-300 text-lg">›</span>
          </Link>
        ) : (
          <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 opacity-60">
            <div>
              <div className="text-sm text-gray-400 font-medium">
                Edit target date
              </div>
              <div className="text-[11px] text-gray-400">
                Flexible boxes only
              </div>
            </div>
          </div>
        )}

        <Link
          href={deepLink("protection")}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50"
        >
          <span className="text-sm text-gray-900 font-medium">
            Change protection type
          </span>
          <span className="text-gray-300 text-lg">›</span>
        </Link>

        <Link
          href={deepLink("close")}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-rose-100 bg-rose-50 hover:bg-rose-100"
        >
          <span className="text-sm text-rose-700 font-medium">Close box</span>
          <span className="text-rose-400 text-lg">›</span>
        </Link>

        <button
          onClick={onClose}
          className="w-full mt-2 py-2.5 rounded-xl text-sm text-gray-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
