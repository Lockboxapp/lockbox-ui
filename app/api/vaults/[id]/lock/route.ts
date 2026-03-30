import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TX, TransactionType } from "lib/types";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
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
    where: { id: params.id, userId: user.id },
  });
  if (!vault) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { amount } = await req.json();
  const amt = Math.max(0, Number(amount) || 0);
  if (!amt) return NextResponse.json({ error: "Bad amount" }, { status: 400 });

  // Record a logical lock event only
  await prisma.transaction.create({
    data: {
      userId: user.id, // use user.id so type is strictly string
      vaultId: vault.id,
      type: TX.LOCK as TransactionType,
      amount: Math.round(amt), // adjust if your UI passes dollars
      description: "Locked funds",
      postedAt: new Date(),
    },
  });

  // Return current vault (unchanged balance)
  const updated = await prisma.vault.findUnique({ where: { id: vault.id } });
  return NextResponse.json(updated);
}
