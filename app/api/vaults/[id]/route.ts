import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { TX, type TransactionType } from "@/lib/types";
import { prisma } from "@/lib/db"; // ensure this exists; otherwise instantiate PrismaClient here

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
  if (!vault)
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });

  const body = await req.json();
  const { action, amount, toVaultId, name } = body as {
    action?: "addFunds" | "withdraw" | "lockFunds" | "unlockFunds" | "transfer";
    amount?: number;
    toVaultId?: string;
    name?: string;
  };

  const amt = Math.max(0, Number(amount) || 0);

  // If your Transaction.amount is already in cents, keep Math.round(n).
  // If you pass dollars from UI, switch to Math.round(n * 100).
  const toCents = (n: number) => Math.round(n);

  let updated = vault;

  switch (action) {
    case "addFunds": {
      if (!amt)
        return NextResponse.json({ error: "Bad amount" }, { status: 400 });
      updated = await prisma.vault.update({
        where: { id: vault.id },
        data: { balance: { increment: amt } },
      });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TX.DEPOSIT as TransactionType,
          amount: toCents(amt),
          description: "Added funds",
          postedAt: new Date(),
        },
      });
      break;
    }

    case "withdraw": {
      if (!amt)
        return NextResponse.json({ error: "Bad amount" }, { status: 400 });
      updated = await prisma.vault.update({
        where: { id: vault.id },
        data: { balance: { decrement: amt } },
      });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TX.WITHDRAW as TransactionType,
          amount: toCents(amt),
          description: "Withdrawal",
          postedAt: new Date(),
        },
      });
      break;
    }

    case "lockFunds": {
      if (!amt)
        return NextResponse.json({ error: "Bad amount" }, { status: 400 });
      // Logical lock event only — no balance column in schema to change
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TX.LOCK as TransactionType,
          amount: toCents(amt), // positive = lock
          description: "Locked funds",
          postedAt: new Date(),
        },
      });
      // Return unchanged vault
      updated = (await prisma.vault.findUnique({
        where: { id: vault.id },
      })) as typeof vault;
      break;
    }

    case "unlockFunds": {
      if (!amt)
        return NextResponse.json({ error: "Bad amount" }, { status: 400 });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TX.LOCK as TransactionType,
          amount: toCents(-amt), // negative = unlock
          description: "Unlocked funds",
          postedAt: new Date(),
        },
      });
      updated = (await prisma.vault.findUnique({
        where: { id: vault.id },
      })) as typeof vault;
      break;
    }

    case "transfer": {
      if (!amt || !toVaultId) {
        return NextResponse.json(
          { error: "Bad transfer params" },
          { status: 400 },
        );
      }

      const toVault = await prisma.vault.findFirst({
        where: { id: toVaultId, userId: user.id },
      });
      if (!toVault)
        return NextResponse.json(
          { error: "Target vault not found" },
          { status: 404 },
        );

      updated = await prisma.$transaction(async (tx: any) => {
        const fromAfter = await tx.vault.update({
          where: { id: vault.id },
          data: { balance: { decrement: amt } },
        });
        await tx.vault.update({
          where: { id: toVault.id },
          data: { balance: { increment: amt } },
        });

        await tx.transaction.createMany({
          data: [
            {
              userId: user.id,
              vaultId: vault.id,
              type: TX.TRANSFER_OUT as TransactionType,
              amount: toCents(amt),
              description: `Transfer to ${toVault.name}`,
              postedAt: new Date(),
            },
            {
              userId: user.id,
              vaultId: toVault.id,
              type: TX.TRANSFER_IN as TransactionType,
              amount: toCents(amt),
              description: `Transfer from ${vault.name}`,
              postedAt: new Date(),
            },
          ],
        });

        return fromAfter;
      });
      break;
    }

    default: {
      // Only allow renaming in the default branch with current schema
      if (typeof name === "string" && name.trim().length > 0) {
        updated = await prisma.vault.update({
          where: { id: vault.id },
          data: { name: name.trim() },
        });
      }
    }
  }

  return NextResponse.json(updated);
}
