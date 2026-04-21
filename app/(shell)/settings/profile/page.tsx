// ============================================================
// app/(shell)/settings/profile/page.tsx
// Profile — editable name + timezone, read-only email + created-on.
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
      createdAt: true,
    },
  });

  if (!user) redirect("/signin");

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-md mx-auto">
      <div className="pt-1">
        <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Manage how LockBox shows up for you.
        </p>
      </div>

      <ProfileForm
        initialName={user.name ?? ""}
        email={user.email ?? ""}
        initialTimezone={user.timezone ?? ""}
        memberSince={user.createdAt.toISOString()}
      />
    </div>
  );
}
