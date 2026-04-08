// app/api/summary/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const toDollars = (cents: number) => cents / 100;

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.sub as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all active boxes for this user
  const boxes = await prisma.box.findMany({
    where: {
      userId,
      status: { not: "CLOSED" },
    },
    select: {
      balance: true,
      status: true,
    },
  });

  // Calculate totals in cents first, then convert
  const totalSavedCents = boxes.reduce((sum, b) => sum + b.balance, 0);
  const totalLockedCents = boxes
    .filter((b) => b.status === "LOCKED" || b.status === "UNLOCK_PENDING")
    .reduce((sum, b) => sum + b.balance, 0);
  const totalAvailableCents = totalSavedCents - totalLockedCents;

  // Get recent transactions
  const recentRaw = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { postedAt: "desc" },
    take: 5,
    include: {
      vault: { select: { name: true } },
      category: { select: { name: true } },
    },
  });

  // Convert transaction amounts cents → dollars
  const recent = recentRaw.map((tx) => ({
    ...tx,
    amount: toDollars(tx.amount),
  }));

  return NextResponse.json({
    totalSaved: toDollars(totalSavedCents),
    totalLocked: toDollars(totalLockedCents),
    totalAvailable: toDollars(totalAvailableCents),
    recent,
  });
}
