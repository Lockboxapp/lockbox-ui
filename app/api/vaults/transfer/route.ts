import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { fromVaultId, toVaultId, amount } = body;

    // Basic validation
    const amt = Number(amount);
    if (!fromVaultId || !toVaultId || !Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Cannot transfer to the same vault
    if (fromVaultId === toVaultId) {
      return NextResponse.json({ error: "Cannot transfer to the same vault" }, { status: 400 });
    }

    // Fetch both vaults
    const [from, to] = await prisma.$transaction([
      prisma.vault.findUnique({ where: { id: fromVaultId } }),
      prisma.vault.findUnique({ where: { id: toVaultId } }),
    ]);

    if (!from || !to) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    // Ownership check
    if (from.userId !== session.user.id || to.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized access to vaults" }, { status: 403 });
    }

    // Make sure the source vault has enough *unlocked* funds
    const unlocked = Math.max(0, from.saved - from.locked);
    if (amt > unlocked) {
      return NextResponse.json({ error: "Insufficient unlocked funds" }, { status: 400 });
    }

    // Transfer funds atomically
    const [updatedFrom, updatedTo] = await prisma.$transaction([
      prisma.vault.update({
        where: { id: fromVaultId },
        data: { saved: from.saved - amt },
      }),
      prisma.vault.update({
        where: { id: toVaultId },
        data: { saved: to.saved + amt },
      }),
    ]);

    // (Optional) Log transactions for each vault
    // await prisma.transaction.createMany({
    //   data: [
    //     {
    //       userId: session.user.id,
    //       vaultId: fromVaultId,
    //       type: "TRANSFER_OUT",
    //       amount: amt,
    //       description: `Transfer to ${to.name}`,
    //     },
    //     {
    //       userId: session.user.id,
    //       vaultId: toVaultId,
    //       type: "TRANSFER_IN",
    //       amount: amt,
    //       description: `Transfer from ${from.name}`,
    //     },
    //   ],
    // });

    return NextResponse.json({ from: updatedFrom, to: updatedTo }, { status: 200 });
  } catch (err: any) {
    console.error("Transfer error:", err);
    return NextResponse.json({ error: "Server error", detail: String(err.message || err) }, { status: 500 });
  }
}
