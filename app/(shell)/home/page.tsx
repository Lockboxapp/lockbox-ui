// ============================================================
// app/(shell)/home/page.tsx
// Home Dashboard v1 — Board Approved
// Purpose: guidance and overview (not management — that's /vaults)
// Widgets: Header, Snapshot, Banker Insight, Priority Boxes,
//          Today's Actions, Consistency Streak, Recent Activity
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

// ── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const dueDaysFrom = (lockUntil: Date | null): number | null => {
  if (!lockUntil) return null;
  return Math.ceil(
    (new Date(lockUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
};

const ACTIVE_STATUSES = ["CREATED", "FUNDING", "LOCKED", "UNLOCK_PENDING"];
const LOCKED_STATUSES = ["LOCKED", "UNLOCK_PENDING"];

const TX_LABELS: Record<string, string> = {
  DEPOSIT: "Added funds",
  WITHDRAWAL: "Withdrew funds",
  TRANSFER: "Transferred",
  LOCK: "Locked funds",
  UNLOCK: "Unlocked funds",
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;
  const now = new Date();

  // ── All primary queries in parallel ─────────────────────────────────────
  const [boxes, pendingUnlockRequests, recentTransactions, dbUser, lastUnlockAttempt] =
    await Promise.all([
      prisma.box.findMany({
        where: { userId, status: { in: ACTIVE_STATUSES } },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          balance: true,
          targetAmount: true,
          lockUntil: true,
          updatedAt: true,
        },
      }),
      prisma.unlockRequest.findMany({
        where: { status: "PENDING", box: { userId } },
        orderBy: { requestedAt: "desc" },
        include: { box: { select: { id: true, name: true } } },
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { postedAt: "desc" },
        take: 8,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          postedAt: true,
          box: { select: { name: true } },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, createdAt: true },
      }),
      prisma.unlockRequest.findFirst({
        where: { box: { userId } },
        orderBy: { requestedAt: "desc" },
        select: { requestedAt: true },
      }),
    ]);

  // ── 1. Snapshot ──────────────────────────────────────────────────────────
  const totalSaved = boxes.reduce((sum, b) => sum + b.balance, 0);
  const totalLocked = boxes
    .filter((b) => LOCKED_STATUSES.includes(b.status))
    .reduce((sum, b) => sum + b.balance, 0);
  const availableToMove = totalSaved - totalLocked;

  const nextDueBox = boxes
    .filter((b) => b.lockUntil && LOCKED_STATUSES.includes(b.status))
    .sort(
      (a, b) =>
        new Date(a.lockUntil!).getTime() - new Date(b.lockUntil!).getTime()
    )[0] ?? null;

  const nextDueDays = nextDueBox ? dueDaysFrom(nextDueBox.lockUntil) : null;

  // ── 2. Banker Insight (priority order: unlock > behind > positive) ────────
  type InsightType = "unlock_pending" | "behind_target" | "positive";
  let bankerInsight: { type: InsightType; message: string };

  if (pendingUnlockRequests.length > 0) {
    const count = pendingUnlockRequests.length;
    bankerInsight = {
      type: "unlock_pending",
      message: `You have ${count} pending unlock request${count > 1 ? "s" : ""}. Your keyholder is waiting.`,
    };
  } else {
    const behindBox = boxes.find(
      (b) =>
        b.targetAmount &&
        b.balance < b.targetAmount &&
        b.lockUntil &&
        new Date(b.lockUntil) > now
    );
    if (behindBox) {
      const gap = behindBox.targetAmount! - behindBox.balance;
      bankerInsight = {
        type: "behind_target",
        message: `Your ${behindBox.name} is behind by ${fmt(gap)}.`,
      };
    } else {
      bankerInsight = {
        type: "positive",
        message:
          boxes.length > 0
            ? "All your boxes are on track. Keep it up."
            : "Ready to protect your first dollar?",
      };
    }
  }

  // ── 3. Priority Boxes (top 3 by urgency score) ───────────────────────────
  const scoredBoxes = boxes.map((b) => {
    const dueDays = dueDaysFrom(b.lockUntil);
    const progressPercent = b.targetAmount
      ? Math.min(100, Math.round((b.balance / b.targetAmount) * 100))
      : null;

    let score = 0;
    if (b.status === "UNLOCK_PENDING") score += 5;
    if (dueDays !== null && dueDays <= 7) score += 4;
    else if (dueDays !== null && dueDays <= 14) score += 2;
    if (b.targetAmount && b.balance < b.targetAmount) score += 2;

    // Fix 5 — contextual urgency label instead of abstract high/medium/low
    let urgencyLabel: string | null = null;
    if (b.status === "UNLOCK_PENDING") urgencyLabel = "Unlock pending";
    else if (dueDays !== null && dueDays <= 14) urgencyLabel = `Due in ${dueDays}d`;
    else if (b.targetAmount && b.balance < b.targetAmount * 0.8) urgencyLabel = "Behind target";

    return { ...b, dueDays, progressPercent, urgencyLabel, score };
  });

  const priorityBoxes = scoredBoxes
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // ── 4. Today's Actions (deterministic only) ───────────────────────────────
  type ActionType = "unlock_request" | "underfunded_box";
  const todaysActions: Array<{ type: ActionType; label: string; targetId: string }> = [];

  if (pendingUnlockRequests.length > 0) {
    const count = pendingUnlockRequests.length;
    todaysActions.push({
      type: "unlock_request",
      label: `Review ${count} pending unlock request${count > 1 ? "s" : ""}`,
      targetId: pendingUnlockRequests[0].box.id,
    });
  }

  const underfundedBoxes = boxes.filter(
    (b) =>
      b.targetAmount &&
      b.balance < b.targetAmount &&
      b.lockUntil &&
      new Date(b.lockUntil) > now
  );

  for (const box of underfundedBoxes.slice(0, 2)) {
    todaysActions.push({
      type: "underfunded_box",
      label: `Add funds to ${box.name} to stay on track`,
      targetId: box.id,
    });
  }

  // ── 5. Consistency Streak ────────────────────────────────────────────────
  const streakStart = lastUnlockAttempt?.requestedAt ?? dbUser?.createdAt ?? now;
  const streakDays = Math.floor(
    (now.getTime() - new Date(streakStart).getTime()) / (1000 * 60 * 60 * 24)
  );

  // ── 6. Recent Activity ───────────────────────────────────────────────────
  const recentActivity = recentTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    label:
      (TX_LABELS[tx.type] ?? tx.type) +
      (tx.box?.name ? ` · ${tx.box.name}` : ""),
    amount: tx.amount,
    postedAt: tx.postedAt,
  }));

  // ── Greeting ─────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = dbUser?.name?.split(" ")[0] ?? "there";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-md mx-auto">

      {/* ── 1. Header ── */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <div className="text-xs text-gray-400 font-medium">{greeting}</div>
          <div className="text-xl font-bold text-gray-900">{firstName}</div>
        </div>
        <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold select-none">
          {firstName[0]?.toUpperCase() ?? "?"}
        </div>
      </div>

      {/* ── 2. Money Snapshot ── */}
      <div className="bg-emerald-700 rounded-2xl p-5 text-white shadow-sm">
        <div className="text-xs font-semibold opacity-60 uppercase tracking-widest mb-1">
          Total Saved
        </div>
        <div className="text-4xl font-bold tracking-tight mb-4">
          {fmt(totalSaved)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs opacity-60 mb-0.5">Locked</div>
            <div className="text-base font-semibold">{fmt(totalLocked)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs opacity-60 mb-0.5">Available</div>
            <div className="text-base font-semibold">{fmt(availableToMove)}</div>
          </div>
        </div>
        {nextDueBox && nextDueDays !== null && (
          <div className="mt-3 text-xs opacity-60">
            Next due: {nextDueBox.name}{" "}
            {nextDueDays <= 0 ? "· today" : `· in ${nextDueDays}d`}
          </div>
        )}
      </div>

      {/* ── 3. Banker Insight ── */}
      <div
        className={`rounded-2xl p-4 border flex items-start gap-3 ${
          bankerInsight.type === "unlock_pending"
            ? "bg-amber-50 border-amber-200"
            : bankerInsight.type === "behind_target"
            ? "bg-rose-50 border-rose-200"
            : "bg-emerald-50 border-emerald-200"
        }`}
      >
        <span className="text-base mt-0.5 flex-shrink-0">
          {bankerInsight.type === "unlock_pending"
            ? "⏳"
            : bankerInsight.type === "behind_target"
            ? "📉"
            : "✓"}
        </span>
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
            The Banker
          </div>
          <div className="text-sm font-medium text-gray-800 leading-snug">
            {bankerInsight.message}
          </div>
        </div>
      </div>

      {/* ── 4. Priority Boxes ── */}
      {priorityBoxes.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Priority Boxes
          </div>
          <div className="space-y-3">
            {priorityBoxes.map((box) => (
              <Link key={box.id} href="/vaults" className="block">
              <div
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm leading-tight">
                      {box.name}
                    </div>
                    {box.dueDays !== null && (
                      <div
                        className={`text-xs mt-0.5 ${
                          box.dueDays <= 0
                            ? "text-rose-600 font-medium"
                            : box.dueDays <= 7
                            ? "text-rose-500"
                            : box.dueDays <= 14
                            ? "text-amber-500"
                            : "text-gray-400"
                        }`}
                      >
                        {box.dueDays <= 0
                          ? "Due today"
                          : `Due in ${box.dueDays}d`}
                      </div>
                    )}
                  </div>
                  {box.urgencyLabel && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        box.urgencyLabel === "Unlock pending"
                          ? "bg-amber-100 text-amber-700"
                          : box.urgencyLabel === "Behind target"
                          ? "bg-indigo-100 text-indigo-700"
                          : box.dueDays !== null && box.dueDays <= 7
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {box.urgencyLabel}
                    </span>
                  )}
                </div>

                {box.targetAmount ? (
                  <>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${box.progressPercent ?? 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{fmt(box.balance)} saved</span>
                      <span>
                        {fmt(box.targetAmount)} goal · {box.progressPercent ?? 0}%
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">{fmt(box.balance)} saved</div>
                )}
              </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Today's Actions ── */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {"Today's Actions"}
        </div>
        {todaysActions.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-5 text-sm text-gray-400 text-center shadow-sm">
            {"No actions needed. You're on track."}
          </div>
        ) : (
          <div className="space-y-2">
            {todaysActions.map((action, i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm"
              >
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm ${
                    action.type === "unlock_request"
                      ? "bg-amber-100"
                      : "bg-blue-100"
                  }`}
                >
                  {action.type === "unlock_request" ? "🔓" : "💰"}
                </div>
                <div className="text-sm font-medium text-gray-800 leading-snug">
                  {action.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Consistency Streak ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
            Consistency Streak
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-gray-900">{streakDays}</span>
            <span className="text-sm text-gray-400 font-medium">days</span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Without an early unlock attempt
          </div>
        </div>
        <div className={`text-4xl ${streakDays >= 7 ? "opacity-100" : "opacity-25"}`}>
          🔒
        </div>
      </div>

      {/* ── 7. Recent Activity ── */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Recent Activity
        </div>
        {recentActivity.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-5 text-sm text-gray-400 text-center shadow-sm">
            No activity yet. Start by adding funds to a box.
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {recentActivity.map((item, i) => {
              const isPositive = ["DEPOSIT", "TRANSFER_IN", "INCOME"].includes(item.type);
              const amtDollars = Math.round(item.amount / 100);
              const amtStr = `${isPositive ? "+" : "−"}$${amtDollars.toLocaleString("en-US")}`;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i < recentActivity.length - 1
                      ? "border-b border-gray-50"
                      : ""
                  }`}
                >
                  <div className="text-sm text-gray-700 leading-snug">{item.label}</div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className={`text-sm font-semibold ${isPositive ? "text-emerald-600" : "text-gray-700"}`}>
                      {amtStr}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(item.postedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
