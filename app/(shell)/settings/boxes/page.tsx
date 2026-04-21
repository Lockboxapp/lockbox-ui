// ============================================================
// app/(shell)/settings/boxes/page.tsx
// My Boxes — list all boxes; tap a box to open a settings sheet.
// Each sheet action deep-links to /vaults?box={id}&action=<kind> so the
// full modal/validation logic stays in one place (vaults/page.tsx).
// ============================================================

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import BoxesSettingsList from "./BoxesSettingsList";

export const dynamic = "force-dynamic";

export default async function MyBoxesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const boxes = await prisma.box.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isWallet: "desc" }, { isClosed: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      lockType: true,
      status: true,
      balance: true,
      lockedAmount: true,
      targetAmount: true,
      lockUntil: true,
      isWallet: true,
      isClosed: true,
      updatedAt: true,
    },
  });

  const serialized = boxes.map((b) => ({
    ...b,
    lockUntil: b.lockUntil?.toISOString() ?? null,
    updatedAt: b.updatedAt.toISOString(),
  }));

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-md mx-auto">
      <div className="pt-1">
        <h2 className="text-xl font-semibold text-gray-900">My boxes</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Tap a box to rename, change protection, or close it.
        </p>
      </div>
      <BoxesSettingsList boxes={serialized} />
    </div>
  );
}
