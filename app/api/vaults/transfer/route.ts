import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TX, type TransactionType } from "@/lib/types";
import { prisma } from "@/lib/db"; // or instantiate here if you don't have this helper

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fromVaultId, toVaultId, amount } = await req.json();

    const amtNum = Number(amount);
    if (!fromVaultId || !toVaultId || !Number.isFinite(amtNum) || amtNum <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (fromVaultId === toVaultId) {
      return NextResponse.json(
        { error: "Cannot transfer to the same vault" },
        { status: 400 }
      );
    }

    // Load both vaults and verify ownership
    const [from, to] = await prisma.$transaction([
      prisma.vault.findUnique({ where: { id: fromVaultId } }),
      prisma.vault.findUnique({ where: { id: toVaultId } }),
    ]);

    if (!from || !to) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }
    if (from.userId !== user.id || to.userId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to vaults" },
        { status: 403 }
      );
    }

    if (from.balance < amtNum) {
      return NextResponse.json(
        { error: "Insufficient balance in source vault" },
        { status: 400 }
      );
    }

    const cents = Math.round(amtNum); // adjust if your UI passes dollars

    const result = await prisma.$transaction(async (tx) => {
      const updatedFrom = await tx.vault.update({
        where: { id: from.id },
        data: { balance: { decrement: amtNum } },
      });
      const updatedTo = await tx.vault.update({
        where: { id: to.id },
        data: { balance: { increment: amtNum } },
      });

      await tx.transaction.createMany({
        data: [
          {
            userId: user.id,
            vaultId: from.id,
            type: TX.TRANSFER_OUT as TransactionType,
            amount: cents,
            description: `Transfer to ${to.name}`,
            postedAt: new Date(),
          },
          {
            userId: user.id,
            vaultId: to.id,
            type: TX.TRANSFER_IN as TransactionType,
            amount: cents,
            description: `Transfer from ${from.name}`,
            postedAt: new Date(),
          },
        ],
      });

      return { from: updatedFrom, to: updatedTo };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("Transfer error:", err);
    return NextResponse.json(
      { error: "Server error", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
