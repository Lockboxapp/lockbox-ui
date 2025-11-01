// app/api/dev/seed-vaults/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  // Only seed if the user has no vaults yet
  const count = await prisma.vault.count({ where: { userId } });
  if (count === 0) {
    await prisma.vault.createMany({
      data: [
        { userId, name: "Rent safe-deposit box", target: 1500, saved: 1200, locked: 900, isLocked: true, requireKeyholder: true },
        { userId, name: "Emergency fund", target: 2000, saved: 850, locked: 0, isLocked: false, requireKeyholder: false },
      ],
    });
  }
  return NextResponse.json({ ok: true, seeded: count === 0 });
}
