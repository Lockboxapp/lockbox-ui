// ============================================================
// app/(shell)/card/page.tsx
// Virtual Card placeholder — shows Wallet balance, no real issuing
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import CardSimulate from "./CardSimulate";

export const dynamic = "force-dynamic";

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export default async function CardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true },
  });

  // Lazy-backfill wallet if somehow missing
  let wallet = await prisma.box.findFirst({
    where: { userId: session.user.id, isWallet: true },
  });
  if (!wallet) {
    wallet = await prisma.box.create({
      data: {
        userId: session.user.id,
        name: "Wallet",
        status: "CREATED",
        lockType: "SOFT",
        isWallet: true,
      },
    });
  }

  const displayName = user?.name ?? "LockBox Member";
  const balance = wallet.balance;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-md mx-auto">
      <div className="pt-1">
        <h2 className="text-xl font-semibold text-gray-900">Card</h2>
        <p className="text-xs text-gray-500 mt-0.5">Spends from your Wallet.</p>
      </div>

      {/* Card visual */}
      <div className="rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-emerald-900 p-5 text-white shadow-lg aspect-[1.586/1] flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest opacity-60">LockBox</div>
            <div className="text-[11px] uppercase tracking-wide opacity-50">Virtual Card</div>
          </div>
          <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center text-xs">🔒</div>
        </div>

        <div>
          <div className="text-[11px] opacity-50 uppercase tracking-widest mb-1">Available to spend</div>
          <div className="text-3xl font-bold tracking-tight">{fmt(balance)}</div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs opacity-50 tracking-widest">•••• •••• •••• ••••</div>
            <div className="text-sm font-medium mt-2 opacity-90">{displayName}</div>
          </div>
          <div className="text-xs opacity-60">DEBIT</div>
        </div>
      </div>

      {/* Sprint 12 — Wallet-low warning on the Card tab (mirrors Banker nudge). */}
      {balance < 2000 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <div className="text-sm text-amber-900 font-medium">
            Your Wallet is running low.
          </div>
          <div className="text-xs text-amber-800 mt-0.5">
            Move funds from a box if you need more.
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <div className="text-xs text-amber-800 font-medium">Your card is on the way.</div>
        <div className="text-xs text-amber-700 mt-0.5">Once active, it will spend from your Wallet.</div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-1">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">How it works</div>
        <p className="text-sm text-gray-700 leading-relaxed">
          Your card spends only from your Wallet. Money protected in boxes stays protected — the card
          can't touch it.
        </p>
      </div>

      <CardSimulate walletBalance={balance} />
    </div>
  );
}
