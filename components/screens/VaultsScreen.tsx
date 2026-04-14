"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowRightLeft, Lock, Unlock, MoreVertical, Wallet as WalletIcon, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import Card from "@/components/ui/Card";

type Vault = {
  id: string;
  name: string;
  target: number;
  locked: number;
  saved: number;
  dueDays: number | null;
  isLocked: boolean;
  lockType?: string;
  isWallet?: boolean;
  isClosed?: boolean;
  closedAt?: string | null;
};

type Props = {
  vaults: Vault[];
  closedVaults?: Vault[];
  vaultsLoading: boolean;
  vaultsError: string | null;
  onCreateNew: () => void;
  highlightId?: string | null;
  onCloseBox?: (id: string) => void;
  onReopenBox?: (id: string) => void;
  setShowTransfer: React.Dispatch<React.SetStateAction<null | { id: string }>>;
  setAddFundsModal: React.Dispatch<
    React.SetStateAction<null | { vaultId: string }>
  >;
  setLockModal: React.Dispatch<
    React.SetStateAction<null | { vaultId: string }>
  >;
  setUnlockModal: React.Dispatch<
    React.SetStateAction<null | { vaultId: string }>
  >;
  setSoftUnlockModal: React.Dispatch<
    React.SetStateAction<null | { vaultId: string }>
  >;
};

function LockTypeBadge({ lockType }: { lockType?: string }) {
  const config =
    lockType === "HARD"
      ? { label: "Fully locked", cls: "bg-emerald-100 text-emerald-700" }
      : lockType === "KEYHOLDER"
      ? { label: "Keyholder", cls: "bg-amber-100 text-amber-700" }
      : { label: "Flexible", cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.cls}`}>
      {config.label}
    </span>
  );
}

const currency = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n)
    ? n.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      })
    : "$0";

function Progress({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden">
      <div className="h-full bg-emerald-600" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function VaultsScreen({
  vaults,
  closedVaults = [],
  vaultsLoading,
  vaultsError,
  onCreateNew,
  highlightId,
  onCloseBox,
  onReopenBox,
  setShowTransfer,
  setAddFundsModal,
  setLockModal,
  setUnlockModal,
  setSoftUnlockModal,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [closedOpen, setClosedOpen] = useState(false);

  // Sprint 4 — pin Wallet at top, separate from regular boxes
  const wallet = vaults.find((v) => v.isWallet) ?? null;
  const regularVaults = vaults.filter((v) => !v.isWallet);
  const hasVaults = !vaultsLoading && !vaultsError && regularVaults.length > 0;

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Vaults</h2>
        {hasVaults && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 text-white shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Create New</span>
          </motion.button>
        )}
      </div>

      {/* States */}
      {vaultsLoading && (
        <div className="text-sm text-gray-500">Loading vaults…</div>
      )}
      {vaultsError && (
        <div className="text-sm text-rose-600">Error: {vaultsError}</div>
      )}
      {/* Wallet pinned at top */}
      {wallet && (
        <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
                <WalletIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold">Wallet</div>
                <div className="text-[11px] opacity-75">Always liquid · spends from card</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{currency(wallet.saved)}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowTransfer({ id: wallet.id })}
              className="flex-1 bg-white/15 hover:bg-white/20 rounded-xl px-3 py-2 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
            </button>
            <button
              onClick={() => setAddFundsModal({ vaultId: wallet.id })}
              className="flex-1 bg-white/15 hover:bg-white/20 rounded-xl px-3 py-2 text-xs font-medium inline-flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add funds
            </button>
          </div>
        </div>
      )}

      {!vaultsLoading && !vaultsError && regularVaults.length === 0 && (
        <Card className="p-6 text-center border-dashed border-gray-300">
          <div className="text-gray-600 mb-3 text-sm">
            No vaults yet. Let’s start building your savings!
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Create Your First Vault
          </motion.button>
        </Card>
      )}

      {/* List */}
      {!vaultsLoading && !vaultsError && regularVaults.length > 0 && (
        <>
          {regularVaults.map((v) => {
            const pct = (v.saved / Math.max(1, v.target)) * 100;
            const isHighlighted = highlightId === v.id;
            return (
              <div
                key={v.id}
                ref={(el) => {
                  if (isHighlighted && el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }}
                className={`transition-all rounded-2xl ${
                  isHighlighted ? "ring-2 ring-emerald-500 ring-offset-2" : ""
                }`}
              >
              <Card className="p-4">
                {/* Row: title + locked */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{v.name}</div>
                      <LockTypeBadge lockType={v.lockType} />
                    </div>
                    <div className="text-sm text-gray-500">
                      {currency(v.target)}
                      {v.dueDays ? ` due in ${v.dueDays} days` : " target"}
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    <div className="text-right text-sm text-gray-500">
                      Locked: {currency(v.locked)}
                    </div>
                    {onCloseBox && (
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenuId(openMenuId === v.id ? null : v.id)
                          }
                          className="h-7 w-7 rounded-full hover:bg-gray-100 flex items-center justify-center"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4 text-gray-500" />
                        </button>
                        {openMenuId === v.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setOpenMenuId(null)}
                            />
                            <div className="absolute right-0 top-8 z-20 w-40 bg-white border border-gray-200 rounded-xl shadow-lg py-1">
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onCloseBox(v.id);
                                }}
                                className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                              >
                                Close box
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
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

                    {/* Add funds */}
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
                      transition={{
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                      }}
                      onClick={() => {
                        if (v.isLocked) {
                          if (v.lockType === "SOFT") {
                            setSoftUnlockModal({ vaultId: v.id });
                          } else {
                            setUnlockModal({ vaultId: v.id });
                          }
                        } else {
                          setLockModal({ vaultId: v.id });
                        }
                      }}
                      className="h-9 w-9 grid place-items-center rounded-xl cursor-pointer border border-gray-200"
                      aria-label={
                        v.isLocked ? "Vault locked" : "Vault unlocked"
                      }
                      title={
                        v.isLocked
                          ? "Tap to request unlock"
                          : "Tap to lock funds"
                      }
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
              </div>
            );
          })}
        </>
      )}

      {/* Sprint 4 — Closed boxes collapsible */}
      {closedVaults.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setClosedOpen(!closedOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            <span>Closed boxes ({closedVaults.length})</span>
            {closedOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {closedOpen && (
            <div className="space-y-2 mt-2">
              {closedVaults.map((v) => (
                <div
                  key={v.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-700">{v.name}</div>
                    <div className="text-xs text-gray-500">
                      Final balance: {currency(v.saved)}
                      {v.closedAt
                        ? ` · Closed ${new Date(v.closedAt).toLocaleDateString()}`
                        : ""}
                    </div>
                  </div>
                  {onReopenBox && (
                    <button
                      onClick={() => onReopenBox(v.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reopen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
