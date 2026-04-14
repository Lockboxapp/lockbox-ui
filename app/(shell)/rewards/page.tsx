// ============================================================
// app/(shell)/rewards/page.tsx
// Rewards — Consistency Streak lives here (moved from /home in Sprint 3)
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const userId = session.user.id;
  const now = new Date();

  const [dbUser, lastUnlockAttempt] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    prisma.unlockRequest.findFirst({
      where: { box: { userId } },
      orderBy: { requestedAt: "desc" },
      select: { requestedAt: true },
    }),
  ]);

  // Streak: days since last unlock attempt, fallback to account creation
  const streakStart = lastUnlockAttempt?.requestedAt ?? dbUser?.createdAt ?? now;
  const streakDays = Math.floor(
    (now.getTime() - new Date(streakStart).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="px-4 pt-4 pb-24 space-y-4 max-w-md mx-auto">
      <div className="pt-1">
        <h2 className="text-xl font-semibold text-gray-900">Rewards</h2>
      </div>

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

      <p className="text-xs text-gray-400 text-center pt-1">More rewards coming soon.</p>
    </div>
  );
}
