import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TX, type TransactionType } from "@/lib/types";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vault = await prisma.vault.findFirst({
    where: { id: id, userId: user.id },
  });
  if (!vault) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { amount } = await req.json();
  const amt = Math.max(0, Number(amount) || 0);
  if (!amt) return NextResponse.json({ error: "Bad amount" }, { status: 400 });

  const updated = await prisma.vault.update({
    where: { id: vault.id },
    data: { balance: { decrement: amt } },
  });

  await prisma.transaction.create({
    data: {
      userId: user.id, // use user.id so it’s non-nullable string
      vaultId: vault.id,
      type: TX.WITHDRAW as TransactionType,
      amount: Math.round(amt),
      description: "Withdrawal",
      postedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
