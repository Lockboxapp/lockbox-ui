// ============================================================
// app/admin/page.tsx
// Founder-only admin dashboard — requires isAdmin = true
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ActivityChart, { ChartDataPoint, ChartRanges } from "@/components/admin/ActivityChart";
import SupportTools from "@/components/admin/SupportTools";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// Build an N-day date series and merge counts into it
function buildChartData(
  users: { createdAt: Date }[],
  waitlist: { createdAt: Date }[],
  boxes: { createdAt: Date }[],
  days: number,
): ChartDataPoint[] {
  const series: ChartDataPoint[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    series.push({ date: key, users: 0, waitlist: 0, boxes: 0 });
  }

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  for (const u of users) {
    const dt = new Date(u.createdAt);
    if (dt < cutoff) continue;
    const point = series.find((s) => s.date === fmt(dt));
    if (point) point.users += 1;
  }
  for (const w of waitlist) {
    const dt = new Date(w.createdAt);
    if (dt < cutoff) continue;
    const point = series.find((s) => s.date === fmt(dt));
    if (point) point.waitlist += 1;
  }
  for (const b of boxes) {
    const dt = new Date(b.createdAt);
    if (dt < cutoff) continue;
    const point = series.find((s) => s.date === fmt(dt));
    if (point) point.boxes += 1;
  }

  return series;
}

export default async function AdminPage() {
  // ── Auth check ──────────────────────────────────────────────
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/signin");
  }

  const adminUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { isAdmin: true, name: true },
  });

  if (!adminUser?.isAdmin) {
    redirect("/");
  }

  const nDaysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  // ── Stats + chart queries (all in parallel) ──────────────────
  const [
    waitlistTotal,
    waitlistRecent,
    userTotal,
    userRecent,
    onboardingCompleted,
    allUsersForTools,
    allBoxesForTools,
    boxTotal,
    boxLocked,
    boxUnlockPending,
    unlockTotal,
    unlockPending,
    unlockApproved,
    unlockDenied,
    keyholderTotal,
    keyholderActive,
    // chart data — fetch 90 days, slice for shorter ranges client-side
    waitlistActivity,
    userActivity,
    boxActivity,
  ] = await Promise.all([
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.user.count({ where: { onboardingCompletedAt: { not: null } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        isRestricted: true,
        restrictedReason: true,
      },
    }),
    prisma.box.findMany({
      where: { isClosed: false },
      select: { id: true, name: true, balance: true, isWallet: true, isClosed: true, userId: true },
    }),
    prisma.box.count(),
    prisma.box.count({ where: { status: "LOCKED" } }),
    prisma.box.count({ where: { status: "UNLOCK_PENDING" } }),
    prisma.unlockRequest.count(),
    prisma.unlockRequest.count({ where: { status: "PENDING" } }),
    prisma.unlockRequest.count({ where: { status: "APPROVED" } }),
    prisma.unlockRequest.count({ where: { status: "DENIED" } }),
    prisma.keyholderRelationship.count(),
    prisma.keyholderRelationship.count({ where: { status: "ACTIVE" } }),
    prisma.waitlistEntry.findMany({
      where: { createdAt: { gte: nDaysAgo(90) } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: nDaysAgo(90) } },
      select: { createdAt: true },
    }),
    prisma.box.findMany({
      where: { createdAt: { gte: nDaysAgo(90) } },
      select: { createdAt: true },
    }),
  ]);

  const chartRanges: ChartRanges = {
    "7":  buildChartData(userActivity, waitlistActivity, boxActivity, 7),
    "30": buildChartData(userActivity, waitlistActivity, boxActivity, 30),
    "90": buildChartData(userActivity, waitlistActivity, boxActivity, 90),
  };

  const updatedAt = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="w-4 h-4 stroke-white fill-none"
                strokeWidth={2}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900">LockBox Admin</div>
              <div className="text-xs text-gray-500">
                Founder Dashboard · {adminUser.name ?? session.user.email}
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-400">Last updated: {updatedAt}</div>
        </div>

        {/* Row 1 — top-level counts */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Waitlist Signups"
            value={waitlistTotal}
            sub="Emails collected"
          />
          <StatCard
            label="Total Users"
            value={userTotal}
            sub="Accounts created"
          />
          <StatCard
            label="Boxes Created"
            value={boxTotal}
            sub="Across all users"
          />
        </div>

        {/* Row 2 — box states + keyholders */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Boxes Locked"
            value={boxLocked}
            sub={`${boxUnlockPending} unlock pending`}
          />
          <StatCard
            label="Unlock Requests"
            value={unlockTotal}
            sub="All time"
          />
          <StatCard
            label="Active Keyholders"
            value={keyholderActive}
            sub={`${keyholderTotal} total relationships`}
          />
        </div>

        {/* Row 3 — unlock breakdown + onboarding */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Onboarding Completed"
            value={onboardingCompleted}
            sub={`of ${userTotal} users`}
          />
          <StatCard
            label="Unlock — Pending"
            value={unlockPending}
            sub="Awaiting keyholder"
          />
          <StatCard
            label="Unlock — Approved"
            value={unlockApproved}
            sub="Keyholder approved"
          />
          <StatCard
            label="Unlock — Denied"
            value={unlockDenied}
            sub="Keyholder denied"
          />
        </div>

        {/* Activity chart */}
        <ActivityChart ranges={chartRanges} />

        {/* Two-column recent activity */}
        <div className="grid grid-cols-2 gap-6">

          {/* Recent waitlist signups */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="font-semibold text-gray-900 mb-4">
              Recent Waitlist Signups
            </div>
            {waitlistRecent.length === 0 ? (
              <p className="text-sm text-gray-400">No signups yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {waitlistRecent.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-900">{entry.email}</td>
                      <td className="py-2 text-gray-400 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent user signups */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="font-semibold text-gray-900 mb-4">
              Recent User Signups
            </div>
            {userRecent.length === 0 ? (
              <p className="text-sm text-gray-400">No users yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 font-medium">Name / Email</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {userRecent.map((u) => (
                    <tr key={u.email} className="border-b border-gray-50">
                      <td className="py-2">
                        <div className="text-gray-900">{u.name ?? "—"}</div>
                        <div className="text-gray-400 text-xs">{u.email}</div>
                      </td>
                      <td className="py-2 text-gray-400 whitespace-nowrap">
                        {new Date(u.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

        </div>

        <SupportTools
          users={allUsersForTools
            .filter((u): u is typeof u & { email: string } => !!u.email)
            .map((u) => ({
              id: u.id,
              email: u.email,
              name: u.name,
              isRestricted: u.isRestricted,
              restrictedReason: u.restrictedReason,
            }))}
          allBoxes={allBoxesForTools}
        />
      </div>
    </div>
  );
}
