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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vault = await prisma.vault.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!vault) return NextResponse.json({ error: "Vault not found" }, { status: 404 });

  const body = await req.json();
  const { action, amount, toVaultId } = body;
  const amt = Math.max(0, Number(amount) || 0);

  const toCents = (n: number) => Math.round(n); // use this if amounts are already in cents
  // const toCents = (n: number) => Math.round(n * 100); // use this if you’re passing dollars

  let updated;

  switch (action) {
    case "addFunds": {
      updated = await prisma.vault.update({
        where: { id: vault.id },
        data: { saved: { increment: amt } },
      });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TransactionType.INCOME,
          amount: toCents(amt),
          description: "Added funds",
        },
      });
      break;
    }

    case "lockFunds": {
      const lockable = Math.max(0, vault.saved - vault.locked);
      const lockAmt = Math.min(amt, lockable);
      updated = await prisma.vault.update({
        where: { id: vault.id },
        data: {
          locked: { increment: lockAmt },
          isLocked: true,
        },
      });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TransactionType.TRANSFER,
          amount: toCents(lockAmt),
          description: "Locked funds",
        },
      });
      break;
    }

    case "unlockFunds": {
      const unlockAmt = Math.min(amt, vault.locked);
      updated = await prisma.vault.update({
        where: { id: vault.id },
        data: {
          locked: { decrement: unlockAmt },
          isLocked: unlockAmt < vault.locked ? true : false,
        },
      });
      await prisma.transaction.create({
        data: {
          userId: user.id,
          vaultId: vault.id,
          type: TransactionType.TRANSFER,
          amount: toCents(unlockAmt),
          description: "Unlocked funds",
        },
      });
      break;
    }

    case "transfer": {
      const toVault = await prisma.vault.findFirst({
        where: { id: toVaultId, userId: user.id },
      });
      if (!toVault)
        return NextResponse.json({ error: "Target vault not found" }, { status: 404 });

      const transferable = Math.max(0, vault.saved - vault.locked);
      const transferAmt = Math.min(amt, transferable);

      updated = await prisma.$transaction(async (tx) => {
        const src = await tx.vault.update({
          where: { id: vault.id },
          data: { saved: { decrement: transferAmt } },
        });
        const dest = await tx.vault.update({
          where: { id: toVault.id },
          data: { saved: { increment: transferAmt } },
        });
        await tx.transaction.createMany({
          data: [
            {
              userId: user.id,
              vaultId: vault.id,
              type: TransactionType.TRANSFER,
              amount: toCents(transferAmt),
              description: `Transfer OUT → ${toVault.name}`,
            },
            {
              userId: user.id,
              vaultId: toVault.id,
              type: TransactionType.TRANSFER,
              amount: toCents(transferAmt),
              description: `Transfer IN ← ${vault.name}`,
            },
          ],
        });
        return src;
      });
      break;
    }

    default: {
      // Generic update (for renaming or toggles)
      const allowed: any = {};
      for (const k of [
        "name",
        "target",
        "locked",
        "saved",
        "dueDate",
        "isLocked",
        "requireKeyholder",
      ]) {
        if (k in body) allowed[k] = body[k];
      }
      updated = await prisma.vault.update({
        where: { id: vault.id },
        data: allowed,
      });
    }
  }

  return NextResponse.json(updated);
}
