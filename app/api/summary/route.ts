import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vaults = await prisma.vault.findMany({ where: { userId: user.id } });
  const totals = vaults.reduce(
    (acc, v) => {
      acc.saved += v.saved;
      acc.locked += v.locked;
      return acc;
    },
    { saved: 0, locked: 0 }
  );

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.id },
    orderBy: { postedAt: "desc" },
    take: 10,
    include: { vault: true, category: true },
  });

  return NextResponse.json({
    totalSaved: totals.saved,
    totalLocked: totals.locked,
    totalAvailable: totals.saved - totals.locked,
    recent: transactions,
  });
}
