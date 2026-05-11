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
import BankerCarousel from "./BankerCarousel";
import PendingAcceptanceRow from "./PendingAcceptanceRow";
import ConnectedBankBalance from "@/components/ConnectedBankBalance";

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
  WITHDRAW: "Withdrew funds",
  WITHDRAWAL: "Withdrew funds",
  TRANSFER: "Transferred",
  TRANSFER_IN: "Received transfer",
  TRANSFER_OUT: "Sent transfer",
  LOCK: "Locked funds",
  UNLOCK: "Unlocked funds",
  // Sprint 15 — CARD_SPEND rows include merchant via description field.
  CARD_SPEND: "Card purchase",
  // Sprint 16 hotfix — protection type change as an activity-feed entry.
  PROTECTION_TYPE_CHANGED: "Protection changed",
};

// ── Page ────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;
  const now = new Date();

  // ── All primary queries in parallel ─────────────────────────────────────
  const [
    boxes,
    pendingUnlockRequests,
    recentTransactions,
    dbUser,
    lastUnlockAttempt,
    wallet,
    activeKeyholders,
  ] = await Promise.all([
      prisma.box.findMany({
        where: {
          userId,
          status: { in: ACTIVE_STATUSES },
          isClosed: false,
          isWallet: false, // Sprint 4: exclude Wallet from regular box widgets
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          balance: true,
          lockedAmount: true,
          lockType: true,
          targetAmount: true,
          lockUntil: true,
          isPriority: true,
          updatedAt: true,
        },
      }),
      prisma.unlockRequest.findMany({
        where: {
          status: { in: ["PENDING", "PENDING_USER_ACCEPTANCE"] },
          box: { userId },
        },
        orderBy: { requestedAt: "desc" },
        select: {
          id: true,
          status: true,
          requestType: true,
          transferAmount: true,
          destinationBoxId: true,
          box: { select: { id: true, name: true } },
        },
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
      prisma.box.findFirst({
        where: { userId, isWallet: true },
        select: { id: true, balance: true },
      }),
      // Sprint 11 — all ACTIVE keyholder relationships for this user, to detect
      // KEYHOLDER boxes that currently have no one covering them.
      prisma.keyholderRelationship.findMany({
        where: { userId, status: "ACTIVE" },
        select: {
          id: true,
          scopeType: true,
          boxes: { select: { boxId: true } },
        },
      }),
    ]);

  // ── 1. Snapshot (Sprint 4: Wallet added; Sprint 3 defensive effectiveLocked kept) ──
  const effectiveLocked = (b: typeof boxes[number]) => {
    if (b.lockedAmount > 0) return b.lockedAmount;
    if (b.status === "LOCKED" || b.status === "UNLOCK_PENDING") return b.balance;
    return 0;
  };
  const walletBalance = wallet?.balance ?? 0;
  const boxTotal = boxes.reduce((sum, b) => sum + b.balance, 0);
  const protectedInBoxes = boxes.reduce((sum, b) => sum + effectiveLocked(b), 0);
  const totalInLockBox = walletBalance + boxTotal;

  const nextDueBox = boxes
    .filter((b) => b.lockUntil && LOCKED_STATUSES.includes(b.status))
    .sort(
      (a, b) =>
        new Date(a.lockUntil!).getTime() - new Date(b.lockUntil!).getTime()
    )[0] ?? null;

  const nextDueDays = nextDueBox ? dueDaysFrom(nextDueBox.lockUntil) : null;

  // ── 3. Priority Boxes (Sprint 2 Fix 4: tightened criteria) ──────────────
  // A box qualifies if:
  //   1. status === UNLOCK_PENDING, OR
  //   2. lockUntil within 7 days AND balance < targetAmount, OR
  //   3. lockUntil within 14 days AND balance < 80% of targetAmount, OR
  //   4. isPriority === true (manually pinned)
  const scoredBoxes = boxes.map((b) => {
    const daysRemaining = dueDaysFrom(b.lockUntil);
    const isOverdue = daysRemaining !== null && daysRemaining < 0;
    const progressPercent = b.targetAmount
      ? Math.min(100, Math.round((b.balance / b.targetAmount) * 100))
      : null;

    const hasTargetDate = b.lockUntil !== null && daysRemaining !== null;
    const qualifiesUnlockPending = b.status === "UNLOCK_PENDING";
    // Sprint 13 — overdue boxes ALWAYS qualify regardless of how far past.
    const qualifiesOverdue =
      isOverdue && b.targetAmount != null && b.balance < b.targetAmount;
    const qualifiesDue7 =
      hasTargetDate &&
      daysRemaining! >= 0 &&
      daysRemaining! <= 7 &&
      b.targetAmount != null &&
      b.balance < b.targetAmount;
    const qualifiesDue14 =
      hasTargetDate &&
      daysRemaining! >= 0 &&
      daysRemaining! <= 14 &&
      b.targetAmount != null &&
      b.balance < b.targetAmount * 0.8;
    const qualifiesPinned = b.isPriority === true;

    const qualifies =
      qualifiesUnlockPending ||
      qualifiesOverdue ||
      qualifiesDue7 ||
      qualifiesDue14 ||
      qualifiesPinned;

    // Urgency score — only used for ranking among qualifying boxes
    let score = 0;
    if (qualifiesUnlockPending) score += 5;
    if (qualifiesOverdue) score += 6; // highest — past deadlines surface first
    if (hasTargetDate && daysRemaining! >= 0 && daysRemaining! <= 7) score += 4;
    else if (hasTargetDate && daysRemaining! >= 0 && daysRemaining! <= 14) score += 2;
    if (b.targetAmount && b.balance < b.targetAmount) score += 2;
    if (qualifiesPinned) score += 1;

    // Contextual urgency label
    let urgencyLabel: string | null = null;
    if (qualifiesUnlockPending) urgencyLabel = "Unlock pending";
    else if (isOverdue) urgencyLabel = "Overdue";
    else if (hasTargetDate && daysRemaining! <= 14) urgencyLabel = `Target in ${daysRemaining}d`;
    else if (b.targetAmount && b.balance < b.targetAmount * 0.8) urgencyLabel = "Behind target";

    return {
      ...b,
      dueDays: daysRemaining, // keep old key for existing consumers
      daysRemaining,
      isOverdue,
      progressPercent,
      urgencyLabel,
      score,
      qualifies,
    };
  });

  const priorityBoxes = scoredBoxes
    .filter((b) => b.qualifies)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // ── Sprint 14 — resolve pending user-acceptance transfers early.
  // Needed by both the Banker carousel (top message) and Today's Actions
  // (top row), so compute before both.
  const pendingAcceptance = pendingUnlockRequests.filter(
    (r) => r.status === "PENDING_USER_ACCEPTANCE",
  );
  const pendingUnlocks = pendingUnlockRequests.filter(
    (r) => r.status === "PENDING" && r.requestType !== "TRANSFER",
  );
  const pendingTransfers = pendingUnlockRequests.filter(
    (r) => r.status === "PENDING" && r.requestType === "TRANSFER",
  );
  const acceptanceDestIds = pendingAcceptance
    .map((r) => r.destinationBoxId)
    .filter((x): x is string => !!x);
  const acceptanceDestBoxes = acceptanceDestIds.length
    ? await prisma.box.findMany({
        where: { id: { in: acceptanceDestIds } },
        select: { id: true, name: true, lockType: true },
      })
    : [];
  const destLookup = new Map(acceptanceDestBoxes.map((b) => [b.id, b]));
  const acceptanceCards = pendingAcceptance.map((r) => {
    const dest = r.destinationBoxId ? destLookup.get(r.destinationBoxId) : null;
    return {
      id: r.id,
      sourceBoxName: r.box.name,
      destinationBoxName: dest?.name ?? "another box",
      destinationLockType: dest?.lockType ?? "HARD",
      amountDollars: (r.transferAmount ?? 0) / 100,
    };
  });

  // ── 2b. Banker Insight (Sprint 14 — now a priority-ordered carousel) ──
  // Each qualifying message is pushed in priority order. The client renders
  // the first by default and lets the user swipe through the rest.
  type InsightType = "unlock_pending" | "behind_target" | "positive";

  const unlockPendingQualifier = priorityBoxes.find((b) => b.status === "UNLOCK_PENDING");
  // Sprint 13 — overdue branch (between empty-locked and unlock-pending in ladder)
  const overdueQualifier = priorityBoxes.find((b) => b.isOverdue && b.targetAmount);
  const behindQualifier = priorityBoxes.find(
    (b) =>
      b.status !== "UNLOCK_PENDING" &&
      !b.isOverdue &&
      b.targetAmount &&
      b.balance < b.targetAmount &&
      b.lockUntil,
  );

  // Sprint 13 — Banker pace calculation helper.
  // Returns a fully formatted string or null if inputs don't qualify for pace coaching.
  function buildPaceMessage(box: typeof priorityBoxes[number]): string | null {
    if (!box.targetAmount || !box.lockUntil) return null;
    const remainingCents = box.targetAmount - box.balance;
    if (remainingCents <= 0) return `Your ${box.name} is fully funded. Well done.`;
    const daysLeft = box.daysRemaining;
    if (daysLeft === null) return null;
    if (daysLeft < 0) return null; // overdue handled separately
    const dateStr = new Date(box.lockUntil).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    // Almost there — skip dollar-per-day when remaining is small change
    if (remainingCents < 1000) {
      return `Your ${box.name} is almost there. ${fmt(remainingCents)} to go.`;
    }
    if (daysLeft === 0) {
      return `Your ${box.name} target date is today. ${fmt(remainingCents)} still needed.`;
    }
    // Round up to nearest dollar — never divide by zero (guarded above)
    const dailyDollars = Math.ceil(remainingCents / daysLeft / 100);
    return `Your ${box.name} target is ${dateStr}. You need $${dailyDollars}/day to get there on time.`;
  }

  // Sprint 5: empty-locked nudge takes highest priority — HARD/KEYHOLDER box created but unfunded
  const emptyLockedBox = boxes.find(
    (b) =>
      (b.lockType === "HARD" || b.lockType === "KEYHOLDER") &&
      b.status === "LOCKED" &&
      b.balance === 0,
  );

  // Sprint 11: KEYHOLDER boxes that currently have no active keyholder covering them.
  const hasAllScope = activeKeyholders.some((k) => k.scopeType === "ALL");
  const missingKeyholderBox = boxes.find((b) => {
    if (b.lockType !== "KEYHOLDER") return false;
    if (hasAllScope) return false;
    const covered = activeKeyholders.some(
      (k) =>
        k.scopeType === "SELECTED" && k.boxes.some((kb) => kb.boxId === b.id),
    );
    return !covered;
  });

  // Sprint 4: Wallet-low nudge — fires when Wallet < $20 and there's money protected in boxes
  const walletLow = walletBalance < 2000 && protectedInBoxes > 0;

  // Sprint 14 — Banker is now a carousel of messages ordered by priority.
  // Each entry in order:
  //   1. PENDING_USER_ACCEPTANCE transfer awaiting user action
  //   2. Empty locked box
  //   3. Overdue target
  //   4. Unlock pending
  //   5. Behind target with pace
  //   6. Missing keyholder
  //   7. Low Wallet
  //   8. 30-day discipline streak
  //   9. Default fallback
  const bankerMessages: { type: InsightType; message: string }[] = [];

  if (acceptanceCards.length > 0) {
    const first = acceptanceCards[0];
    bankerMessages.push({
      type: "behind_target",
      message: `Your keyholder approved your transfer of ${fmt(first.amountDollars * 100)} from ${first.sourceBoxName}. Tap Today's Actions to accept or cancel.`,
    });
  }
  if (emptyLockedBox) {
    bankerMessages.push({
      type: "behind_target",
      message: `You created ${emptyLockedBox.name} to lock away some money. Let's start doing that.`,
    });
  }
  if (overdueQualifier) {
    const dateStr = overdueQualifier.lockUntil
      ? new Date(overdueQualifier.lockUntil).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "earlier";
    bankerMessages.push({
      type: "behind_target",
      message: `Your ${overdueQualifier.name} target date was ${dateStr}. Do you want to extend it or start withdrawing?`,
    });
  }
  if (unlockPendingQualifier) {
    bankerMessages.push({
      type: "unlock_pending",
      message: "You have a pending unlock request. Think carefully before proceeding.",
    });
  }
  if (behindQualifier) {
    const paceMsg = buildPaceMessage(behindQualifier);
    bankerMessages.push({
      type: "behind_target",
      message:
        paceMsg ??
        `Your ${behindQualifier.name} is behind. You may not hit your target in time.`,
    });
  }
  if (missingKeyholderBox) {
    bankerMessages.push({
      type: "behind_target",
      message: `${missingKeyholderBox.name} has no active keyholder. Assign one to restore protection.`,
    });
  }
  if (walletLow) {
    bankerMessages.push({
      type: "behind_target",
      message: `Your Wallet is running low. You have ${fmt(walletBalance)} left. You also have money protected in boxes — only move what you need.`,
    });
  }
  const accountAgeDays = dbUser?.createdAt
    ? Math.floor(
        (now.getTime() - new Date(dbUser.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : 0;
  if (accountAgeDays >= 30 && !lastUnlockAttempt && bankerMessages.length === 0) {
    bankerMessages.push({
      type: "positive",
      message: "30 days of discipline. Keep it going.",
    });
  }
  // Always include at least one card — default fallback last.
  if (bankerMessages.length === 0) {
    bankerMessages.push({
      type: "positive",
      message: "You are on track. Stay consistent.",
    });
  }

  // ── 4. Today's Actions (Sprint 2 Fix 5: tightened logic; Sprint 13: +transfer +overdue) ──
  type ActionType =
    | "unlock_request"
    | "transfer_pending"
    | "underfunded_box"
    | "overdue_box";
  const todaysActions: Array<{
    type: ActionType;
    label: string;
    targetId: string;
    href: string;
  }> = [];

  // Sprint 14 — pendingAcceptance/Unlocks/Transfers were computed earlier.
  if (pendingUnlocks.length > 0) {
    const count = pendingUnlocks.length;
    todaysActions.push({
      type: "unlock_request",
      label: `Review ${count} pending unlock request${count > 1 ? "s" : ""}`,
      targetId: pendingUnlocks[0].box.id,
      href: `/vaults?box=${pendingUnlocks[0].box.id}`,
    });
  }

  for (const r of pendingTransfers) {
    todaysActions.push({
      type: "transfer_pending",
      label: `Waiting for your keyholder to approve your transfer from ${r.box.name}`,
      targetId: r.box.id,
      href: `/vaults?box=${r.box.id}`,
    });
  }

  // Sprint 14 — acceptanceCards were computed earlier, above the Banker block.

  // Sprint 13 — overdue boxes with a target amount below goal get a clear action.
  const overdueBoxes = boxes.filter(
    (b) =>
      b.lockUntil &&
      new Date(b.lockUntil) < now &&
      b.targetAmount != null &&
      b.balance < b.targetAmount,
  );
  for (const b of overdueBoxes.slice(0, 2)) {
    todaysActions.push({
      type: "overdue_box",
      label: `${b.name} target date has passed — extend it or start withdrawing`,
      targetId: b.id,
      href: `/vaults?box=${b.id}`,
    });
  }

  const underfundedBoxes = boxes.filter((b) => {
    if (b.status !== "LOCKED") return false;
    if (!b.lockUntil) return false;
    if (!b.targetAmount) return false;
    const dueDays = dueDaysFrom(b.lockUntil);
    // Sprint 13 — overdue boxes are handled above; this bucket is for
    // still-on-track windows only (0..14 days remaining).
    if (dueDays === null || dueDays < 0 || dueDays > 14) return false;
    return b.balance < b.targetAmount * 0.8;
  });

  for (const box of underfundedBoxes.slice(0, 2)) {
    todaysActions.push({
      type: "underfunded_box",
      label: `Add funds to ${box.name} to stay on track`,
      targetId: box.id,
      href: `/vaults?box=${box.id}`,
    });
  }

  // ── 6. Recent Activity ───────────────────────────────────────────────────
  // Sprint 15 — CARD_SPEND rows surface the merchant (from description) instead
  // of the box name so the activity feed reads like a statement entry.
  const recentActivity = recentTransactions.map((tx) => {
    const base = TX_LABELS[tx.type] ?? tx.type;
    let label: string;
    if (tx.type === "CARD_SPEND") {
      const merchant = tx.description?.replace(/^Card purchase — /, "") ?? "";
      label = merchant ? `${base} · ${merchant}` : base;
    } else {
      label = base + (tx.box?.name ? ` · ${tx.box.name}` : "");
    }
    return {
      id: tx.id,
      type: tx.type,
      label,
      amount: tx.amount,
      postedAt: tx.postedAt,
    };
  });

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

      {/* ── 2. Money Snapshot (Sprint 4: Wallet + Protected in boxes + Total) ── */}
      <div className="bg-emerald-700 rounded-2xl p-5 text-white shadow-sm">
        <div className="text-xs font-semibold opacity-60 uppercase tracking-widest mb-1">
          Total in LockBox
        </div>
        <div className="text-4xl font-bold tracking-tight mb-4">
          {fmt(totalInLockBox)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs opacity-60 mb-0.5">Wallet</div>
            <div className="text-base font-semibold">{fmt(walletBalance)}</div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <div className="text-xs opacity-60 mb-0.5">Protected in boxes</div>
            <div className="text-base font-semibold">{fmt(protectedInBoxes)}</div>
          </div>
        </div>
        {nextDueBox && nextDueDays !== null && (
          <div className="mt-3 text-xs opacity-60">
            Next target: {nextDueBox.name}{" "}
            {nextDueDays < 0
              ? "· target date passed"
              : nextDueDays === 0
              ? "· today"
              : `· in ${nextDueDays}d`}
          </div>
        )}
      </div>

      {/* Sprint 17 (Phase 2) — Connected bank balance (Plaid, read-only). */}
      <ConnectedBankBalance />

      {/* ── 3. Banker Insight (Sprint 14 — carousel) ── */}
      <BankerCarousel messages={bankerMessages} />

      {/* ── 4. Priority Boxes (Fix 4: tightened + empty state; Fix 6: deep link) ── */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Priority Boxes
        </div>
        {priorityBoxes.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-5 text-center shadow-sm">
            <div className="text-sm text-gray-600 font-medium">No priority boxes right now</div>
            <div className="text-xs text-gray-400 mt-0.5">Your important boxes are on track.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {priorityBoxes.map((box) => (
              <Link key={box.id} href={`/vaults?box=${box.id}`} className="block">
              <div
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm active:scale-[0.98] transition-transform"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm leading-tight">
                      {box.name}
                    </div>
                    {box.lockUntil && box.dueDays !== null ? (
                      <div
                        className={`text-xs mt-0.5 ${
                          box.dueDays < 0
                            ? "text-rose-600 font-medium"
                            : box.dueDays === 0
                            ? "text-rose-600 font-medium"
                            : box.dueDays <= 7
                            ? "text-rose-500"
                            : box.dueDays <= 14
                            ? "text-amber-500"
                            : "text-gray-400"
                        }`}
                      >
                        {box.dueDays < 0
                          ? "Target date passed"
                          : box.dueDays === 0
                          ? "Target today"
                          : `Target in ${box.dueDays}d`}
                      </div>
                    ) : (
                      <div className="text-xs mt-0.5 text-gray-400">Open-ended</div>
                    )}
                  </div>
                  {box.urgencyLabel && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        box.urgencyLabel === "Unlock pending"
                          ? "bg-amber-100 text-amber-700"
                          : box.urgencyLabel === "Overdue"
                          ? "bg-rose-100 text-rose-700"
                          : box.urgencyLabel === "Behind target"
                          ? "bg-indigo-100 text-indigo-700"
                          : box.dueDays !== null && box.dueDays >= 0 && box.dueDays <= 7
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
        )}
      </div>

      {/* ── 5. Today's Actions (Fix 1: clickable + chevron; Fix 5 logic applied) ── */}
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {"Today's Actions"}
        </div>
        {todaysActions.length === 0 && acceptanceCards.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-5 text-center shadow-sm">
            <div className="text-sm text-gray-600 font-medium">{"You're all caught up. Stay consistent."}</div>
            <div className="text-xs text-gray-400 italic mt-1">— The Banker</div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Sprint 14 — PENDING_USER_ACCEPTANCE rows go first */}
            {acceptanceCards.map((c) => (
              <PendingAcceptanceRow key={c.id} card={c} />
            ))}
            {todaysActions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div
                  className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                    action.type === "unlock_request"
                      ? "bg-amber-100"
                      : action.type === "transfer_pending"
                      ? "bg-indigo-100"
                      : action.type === "overdue_box"
                      ? "bg-rose-100"
                      : "bg-blue-100"
                  }`}
                >
                  {action.type === "unlock_request"
                    ? "🔓"
                    : action.type === "transfer_pending"
                    ? "⏳"
                    : action.type === "overdue_box"
                    ? "⚠️"
                    : "💰"}
                </div>
                <div className="flex-1 text-sm font-medium text-gray-800 leading-snug">
                  {action.label}
                </div>
                <div className="text-gray-300 text-lg shrink-0">›</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Recent Activity ── */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            Recent Activity
          </div>
          <Link
            href="/transactions"
            className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
          >
            View all →
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-5 text-sm text-gray-400 text-center shadow-sm">
            No activity yet. Start by adding funds to a box.
          </div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {recentActivity.map((item, i) => {
              const isPositive = ["DEPOSIT", "TRANSFER_IN", "INCOME"].includes(item.type);
              // Event rows (LOCK / UNLOCK / PROTECTION_TYPE_CHANGED) have amount=0 —
              // the number would be meaningless. Skip it.
              const isEventRow =
                item.type === "LOCK" ||
                item.type === "UNLOCK" ||
                item.type === "PROTECTION_TYPE_CHANGED";
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
                    {!isEventRow && (
                      <span className={`text-sm font-semibold ${isPositive ? "text-emerald-600" : "text-gray-700"}`}>
                        {amtStr}
                      </span>
                    )}
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
